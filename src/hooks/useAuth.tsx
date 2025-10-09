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

// Only store active session token in localStorage
const GOOGLE_TOKEN_KEY = "google_fit_provider_token";

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

  const persistTokensToStorage = useCallback((token?: string | null) => {
    try {
      if (token) {
        localStorage.setItem(GOOGLE_TOKEN_KEY, token);
      }
    } catch (error) {
      console.warn("Failed to persist Google Fit token", error);
    }
  }, []);

  const persistGoogleTokens = useCallback(async (sessionLike?: ProviderSession | null) => {
    if (!sessionLike) return;
    try {
      const providerToken = sessionLike.provider_token || sessionLike.provider_access_token || null;
      const providerRefreshToken = sessionLike.provider_refresh_token || ((sessionLike.user as any)?.user_metadata?.provider_refresh_token ?? null);
      let expiresIn = 3600; // Default 1 hour

      if (typeof sessionLike.provider_token_expires_at === "number") {
        expiresIn = sessionLike.provider_token_expires_at - Math.floor(Date.now() / 1000);
      } else if (typeof sessionLike.provider_token_expires_in === "number") {
        expiresIn = sessionLike.provider_token_expires_in;
      }

      persistTokensToStorage(providerToken);

      if (sessionLike.user?.id && providerToken && providerRefreshToken) {
        // Store token in database for better management
        try {
          // expiresIn already calculated above
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

        // No longer need to update user_preferences - using google_tokens table only
      }
    } catch (error) {
      console.warn("Failed to persist Google Fit session tokens", error);
    }
  }, [persistTokensToStorage]);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.id, session?.access_token ? 'has_token' : 'no_token');
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        persistGoogleTokens(session as ProviderSession);

        // Note: Notification permission should only be requested on user interaction
        // We'll handle this in components that have user gestures
      }
    );

    // Check for existing session
    console.log('Checking for existing session...');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('Initial session check:', session?.user?.id, session?.access_token ? 'has_token' : 'no_token', error);
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
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const isCursorHost = host.includes('cursor.nutrisync.pages.dev');
    const isBetaHost = host.includes('beta.nutrisync.pages.dev') || host.endsWith('beta.nutrisync.id');
    const isProdNutrisync = host.endsWith('nutrisync.id') || host.includes('nutrisync.pages.dev') || host.includes('app.nutrisync.id');

    if (isCursorHost) {
      try {
        const back = localStorage.getItem('oauth_return_to');
        if (back) return `https://cursor.nutrisync.pages.dev${back}`;
      } catch {}
      return 'https://cursor.nutrisync.pages.dev/auth/callback';
    }
    if (isBetaHost) {
      try {
        const back = typeof window !== 'undefined' ? localStorage.getItem('oauth_return_to') : null;
        if (back) return `https://beta.nutrisync.id${back}`;
      } catch {}
      return 'https://beta.nutrisync.id/auth/callback';
    }
    if (isProdNutrisync) {
      try {
        const back = typeof window !== 'undefined' ? localStorage.getItem('oauth_return_to') : null;
        if (back) return `https://app.nutrisync.id${back}`;
      } catch {}
      return 'https://app.nutrisync.id/auth/callback';
    }
    try {
      const back = typeof window !== 'undefined' ? localStorage.getItem('oauth_return_to') : null;
      if (back) return `${origin}${back}`;
    } catch {}
    return `${origin}/auth/callback`;
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
        const { data, error } = await (supabase as any).functions.invoke('refresh-all-google-tokens', {
          method: 'POST',
          body: { 
            batch_size: 1,
            threshold_minutes: 60,
            user_id: user.id  // Optional: will be used in future to target specific user
          },
        });

        if (error) {
          console.error('Database token refresh failed:', error);
          throw new Error(error.message || 'Database refresh failed');
        }

        // Check if any tokens were successfully refreshed
        if (data?.successful_refreshes > 0 && data?.results?.length > 0) {
          const result = data.results[0];
          if (result.success) {
            persistTokensToStorage(result.access_token);
            console.log(`Google Fit token refreshed successfully via database, expires at: ${result.expires_at}`);
            return result.access_token;
          }
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

  const getGoogleAccessToken = async (options?: { forceRefresh?: boolean }): Promise<string | null> => {
    try {
      // First try to get token from database
      const { data: tokenData, error: tokenError } = await (supabase as any)
        .from('google_tokens')
        .select('access_token, expires_at')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // If token exists and not expired (or force refresh not requested), use it
      if (!tokenError && tokenData?.access_token && !options?.forceRefresh) {
        const expiresAt = new Date(tokenData.expires_at);
        if (expiresAt > new Date()) {
          return tokenData.access_token;
        }
      }

      // If we need a refresh, try server-side refresh
      const refreshed = await refreshGoogleAccessToken();
      if (refreshed) return refreshed;

      // If refresh failed, try session token as fallback
      const { data } = await supabase.auth.getSession();
      const sessionLike = data?.session as ProviderSession | null;
      if (!sessionLike) return null;

      // Store session token in database
      persistGoogleTokens(sessionLike);
      return sessionLike.provider_token || sessionLike.provider_access_token || null;
    } catch (e) {
      console.warn('Failed to get Google Fit token', e);
      return null;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    try {
      localStorage.removeItem(GOOGLE_TOKEN_KEY);
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
