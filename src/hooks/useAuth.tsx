import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;

  signInWithGoogle: () => Promise<{ error: any }>;
  getGoogleAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Persist Google Fit connection status/token when available
        try {
          const s: any = session || {};
          const providerToken = s?.provider_token || s?.provider_access_token;
          if (providerToken) {
            // Store locally for quick reuse between reloads
            localStorage.setItem('google_fit_connected', 'true');
            localStorage.setItem('google_fit_provider_token', providerToken);
            // Also mirror to Supabase so other clients/devices can infer connection
            if (s?.user?.id) {
              (supabase as any)
                .from('user_preferences')
                .upsert({
                  user_id: s.user.id,
                  key: 'googleFitStatus',
                  value: { connected: true, updatedAt: new Date().toISOString() },
                  updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,key' })
                .then(() => {});
            }
          }
        } catch {}
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

    // Persist Google Fit status on initial load too
    try {
      const s: any = session || {};
      const providerToken = s?.provider_token || s?.provider_access_token;
      if (providerToken) {
        localStorage.setItem('google_fit_connected', 'true');
        localStorage.setItem('google_fit_provider_token', providerToken);
        if (s?.user?.id) {
          (supabase as any)
            .from('user_preferences')
            .upsert({
              user_id: s.user.id,
              key: 'googleFitStatus',
              value: { connected: true, updatedAt: new Date().toISOString() },
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,key' })
            .then(() => {});
        }
      }
    } catch {}
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const getGoogleAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    // Supabase exposes the provider token on OAuth sessions
    // @ts-ignore provider_token is present for OAuth providers
    const s = (data?.session as any) || {};
    // Try both common fields
    return s.provider_token || s.provider_access_token || null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

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