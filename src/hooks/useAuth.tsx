import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;

  signInWithGoogle: () => Promise<{ error: any }>;
  getGoogleAccessToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GOOGLE_TOKEN_KEY = "google_fit_provider_token";
const GOOGLE_REFRESH_KEY = "google_fit_provider_refresh_token";
const GOOGLE_TOKEN_EXPIRY_KEY = "google_fit_provider_token_expires_at";
const TOKEN_REFRESH_BUFFER_MS = 15 * 60 * 1000; // 15 minutes buffer - refresh when 15 min left
const BACKGROUND_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
const DEFAULT_ACCESS_TOKEN_TTL = 50 * 60 * 1000; // 50 minutes buffer
const TOKEN_EXPIRY_WARNING_MS = 20 * 60 * 1000; // Warn when 20 minutes left

type ProviderSession = Session & {
  provider_token?: string;
  provider_access_token?: string;
  provider_refresh_token?: string;
  provider_token_expires_at?: number;
  provider_token_expires_in?: number;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const persistTokensToStorage = useCallback((token?: string | null, refreshToken?: string | null, expiresAt?: number | null) => {
    try {
      if (token) {
        localStorage.setItem(GOOGLE_TOKEN_KEY, token);
        localStorage.setItem("google_fit_connected", "true");
      }
      if (refreshToken) {
        localStorage.setItem(GOOGLE_REFRESH_KEY, refreshToken);
      }
      if (expiresAt) {
        localStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, String(expiresAt));
      } else if (token && !localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY)) {
        localStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, String(Date.now() + DEFAULT_ACCESS_TOKEN_TTL));
      }
    } catch (error) {
      console.warn("Failed to persist Google Fit tokens", error);
    }
  }, []);

  const persistGoogleTokens = useCallback(async (sessionLike?: ProviderSession | null) => {
    if (!sessionLike) return;
    try {
      const providerToken = sessionLike.provider_token || sessionLike.provider_access_token || null;
      const providerRefreshToken =
        sessionLike.provider_refresh_token ||
        ((sessionLike.user as any)?.user_metadata?.provider_refresh_token ?? null);
      let expiresAt: number | null = null;

      if (typeof sessionLike.provider_token_expires_at === "number") {
        // Supabase returns seconds; convert to ms
        expiresAt = sessionLike.provider_token_expires_at * 1000;
      } else if (typeof sessionLike.provider_token_expires_in === "number") {
        expiresAt = Date.now() + sessionLike.provider_token_expires_in * 1000;
      }

      persistTokensToStorage(providerToken, providerRefreshToken, expiresAt);

      if (sessionLike.user?.id && providerToken && providerRefreshToken) {
        // Store token in database for better management
        try {
          const expiresIn = expiresAt ? Math.floor((expiresAt - Date.now()) / 1000) : 3600;
          await (supabase as any).functions.invoke('store-google-token', {
            method: 'POST',
            body: {
              user_id: sessionLike.user.id,
              access_token: providerToken,
              refresh_token: providerRefreshToken,
              expires_in: expiresIn,
              token_type: 'Bearer',
              scope: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read'
            },
          });
          console.log('Google token stored in database successfully');
        } catch (dbError) {
          console.warn('Failed to store Google token in database:', dbError);
        }

        // Also update user preferences for backward compatibility
        const connected = Boolean(providerToken || providerRefreshToken);
        const payload = {
          user_id: sessionLike.user.id,
          key: "googleFitStatus",
          value: {
            connected,
            updatedAt: new Date().toISOString(),
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          },
          updated_at: new Date().toISOString(),
        };
        (supabase as any)
          .from("user_preferences")
          .upsert(payload, { onConflict: "user_id,key" })
          .then(() => {})
          .catch(() => {});
      }
    } catch (error) {
      console.warn("Failed to persist Google Fit session tokens", error);
    }
  }, [persistTokensToStorage]);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        persistGoogleTokens(session as ProviderSession);

        // Attempt to prompt OS notification permission shortly after login
        try {
          if (session?.user && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            setTimeout(async () => {
              try {
                // Ensure SW is ready to make the permission meaningful for PWA
                if ('serviceWorker' in navigator) {
                  try { await navigator.serviceWorker.ready; } catch {}
                }
                await Notification.requestPermission();
              } catch {}
            }, 1000);
          }
        } catch {}
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      persistGoogleTokens(session as ProviderSession);
    });

    return () => subscription.unsubscribe();
  }, [persistGoogleTokens]);

  const resolveRedirectUrl = () => {
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_REDIRECT_URL as string | undefined;
    if (envUrl && envUrl.trim().length > 0) return envUrl;
    // Force cursor branch deployments to use Pages cursor alias
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isCursorHost = host.includes('cursor.nutrisync.pages.dev');
    const isProdNutrisync = host.endsWith('nutrisync.id') || host.includes('nutrisync.pages.dev') || host.includes('app.nutrisync.id');

    if (isCursorHost) {
      try {
        const back = localStorage.getItem('oauth_return_to');
        if (back) return `https://cursor.nutrisync.pages.dev${back}`;
      } catch {}
      return 'https://cursor.nutrisync.pages.dev/';
    }
    if (isProdNutrisync) {
      try {
        const back = typeof window !== 'undefined' ? localStorage.getItem('oauth_return_to') : null;
        if (back) return `https://app.nutrisync.id${back}`;
      } catch {}
      return 'https://app.nutrisync.id/';
    }
    try {
      const back = typeof window !== 'undefined' ? localStorage.getItem('oauth_return_to') : null;
      if (back) return `${window.location.origin}${back}`;
    } catch {}
    return `${window.location.origin}/`;
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = resolveRedirectUrl();
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const refreshGoogleAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      if (!user?.id) {
        console.log('No user ID available for Google Fit token refresh');
        return null;
      }

      console.log('Refreshing Google Fit access token using database...');
      
      // Try database refresh first
      try {
        const { data, error } = await (supabase as any).functions.invoke('refresh-google-fit-token-v2', {
          method: 'POST',
          body: { user_id: user.id },
        });

        if (error) {
          console.error('Database token refresh failed:', error);
          throw new Error(error.message || 'Database refresh failed');
        }

        const accessToken = data?.access_token as string | undefined;
        const expiresAt = data?.expires_at as string | undefined;

        if (accessToken && expiresAt) {
          const expiresAtMs = new Date(expiresAt).getTime();
          persistTokensToStorage(accessToken, null, expiresAtMs);
          console.log(`Google Fit token refreshed successfully via database, expires at: ${expiresAt}`);
          return accessToken;
        }
      } catch (dbError) {
        console.warn('Database refresh failed (no custom local OAuth fallback).', dbError);
      }

      console.warn('No access token received from refresh response');
      return null;
    } catch (error) {
      console.error('Failed to refresh Google Fit token', error);
      
      // Only clear tokens if it's a permanent auth failure
      if (error instanceof Error && (
        error.message.includes('invalid_grant') || 
        error.message.includes('invalid_token') ||
        error.message.includes('unauthorized_client')
      )) {
        console.log('Permanent auth failure detected, clearing tokens');
        try {
          localStorage.removeItem(GOOGLE_TOKEN_KEY);
          localStorage.removeItem(GOOGLE_REFRESH_KEY);
          localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
          localStorage.removeItem("google_fit_connected");
        } catch {}
      }
      
      return null;
    }
  }, [persistTokensToStorage, user?.id]);

  const signInWithGoogle = async () => {
    const redirectUrl = resolveRedirectUrl();
    const scopes = [
      'https://www.googleapis.com/auth/fitness.activity.read',
      'https://www.googleapis.com/auth/fitness.body.read',
      'https://www.googleapis.com/auth/fitness.location.read',
    ].join(' ');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        scopes,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'true',
        },
      },
    });
    return { error };
  };

  const getGoogleAccessToken = async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      const sessionLike = data?.session as ProviderSession | null;
      if (!sessionLike) return null;
      // Supabase auto-refreshes the provider access token; just read it from session
      persistGoogleTokens(sessionLike);
      return sessionLike.provider_token || sessionLike.provider_access_token || null;
    } catch (e) {
      console.warn('Failed to read provider token from session', e);
      return null;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    try {
      localStorage.removeItem(GOOGLE_TOKEN_KEY);
      localStorage.removeItem(GOOGLE_REFRESH_KEY);
      localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
      localStorage.removeItem('google_fit_connected');
    } catch {}
  };

  // Remove custom background refresh logic; rely on Supabase session auto-refresh

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      getGoogleAccessToken,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
