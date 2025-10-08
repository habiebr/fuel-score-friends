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
const TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000; // 10 minutes buffer (increased from 5)
const BACKGROUND_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // Refresh every 15 minutes
const DEFAULT_ACCESS_TOKEN_TTL = 50 * 60 * 1000; // 50 minutes buffer

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

  const persistGoogleTokens = useCallback((sessionLike?: ProviderSession | null) => {
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

      if (sessionLike.user?.id) {
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

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
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
      const refreshToken = localStorage.getItem(GOOGLE_REFRESH_KEY);
      if (!refreshToken) {
        console.log('No refresh token available for Google Fit');
        return null;
      }

      console.log('Refreshing Google Fit access token...');
      const { data, error } = await (supabase as any).functions.invoke('refresh-google-fit-token', {
        method: 'POST',
        body: { refreshToken },
      });

      if (error) {
        console.error('Google token refresh failed:', error);
        throw new Error(error.message || 'Unable to refresh Google token');
      }

      const accessToken = data?.access_token as string | undefined;
      const newRefreshToken = (data?.refresh_token as string | undefined) || null;
      const expiresIn = typeof data?.expires_in === 'number' ? data.expires_in : 3600;

      if (accessToken) {
        const expiresAt = Date.now() + Math.max(0, expiresIn - 60) * 1000;
        persistTokensToStorage(accessToken, newRefreshToken || undefined, expiresAt);
        console.log(`Google Fit token refreshed successfully, expires at: ${new Date(expiresAt).toISOString()}`);
        return accessToken;
      }

      console.warn('No access token received from refresh response');
      return null;
    } catch (error) {
      console.error('Failed to refresh Google Fit token', error);
      // Clear invalid tokens on refresh failure
      try {
        localStorage.removeItem(GOOGLE_TOKEN_KEY);
        localStorage.removeItem(GOOGLE_REFRESH_KEY);
        localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
      } catch {}
      return null;
    }
  }, [persistTokensToStorage]);

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
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
    const forceRefresh = options?.forceRefresh ?? false;
    let providerToken: string | null = null;

    try {
      const { data } = await supabase.auth.getSession();
      const sessionLike = data?.session as ProviderSession | null;
      if (sessionLike) {
        persistGoogleTokens(sessionLike);
        providerToken = sessionLike.provider_token || sessionLike.provider_access_token || null;
      }
    } catch (error) {
      console.warn('Failed to obtain session for Google token', error);
    }

    let expiresAt: number | null = null;
    try {
      const expiresAtStr = localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY);
      expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
    } catch {}

    const storedToken = providerToken || localStorage.getItem(GOOGLE_TOKEN_KEY);
    const shouldRefresh =
      forceRefresh ||
      !storedToken ||
      (expiresAt !== null && Number.isFinite(expiresAt) && Date.now() > expiresAt - TOKEN_REFRESH_BUFFER_MS);

    if (!shouldRefresh && storedToken) {
      console.log('Using cached Google Fit token');
      return storedToken;
    }

    console.log('Refreshing Google Fit token...');
    const refreshedToken = await refreshGoogleAccessToken();
    if (refreshedToken) {
      return refreshedToken;
    }

    console.warn('Failed to refresh Google Fit token, using stored token if available');
    return storedToken || null;
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

  // Background token refresh mechanism
  useEffect(() => {
    if (!user) return;

    const backgroundRefresh = async () => {
      try {
        const refreshToken = localStorage.getItem(GOOGLE_REFRESH_KEY);
        if (!refreshToken) return;

        const expiresAtStr = localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY);
        const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
        
        // Only refresh if token exists and is close to expiring
        if (expiresAt && Date.now() > expiresAt - TOKEN_REFRESH_BUFFER_MS) {
          console.log('Background refresh: Token is close to expiring, refreshing...');
          await refreshGoogleAccessToken();
        }
      } catch (error) {
        console.error('Background token refresh failed:', error);
      }
    };

    // Initial check
    backgroundRefresh();

    // Set up interval for background refresh
    const interval = setInterval(backgroundRefresh, BACKGROUND_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user, refreshGoogleAccessToken]);

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
