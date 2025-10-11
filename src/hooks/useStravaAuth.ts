// Strava Authentication Hook
// Handles Strava OAuth flow and connection status
// Separate from Google Fit to avoid breaking existing code

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_OAUTH_URL = 'https://www.strava.com/oauth/authorize';

interface StravaConnectionStatus {
  isConnected: boolean;
  athleteId?: number;
  expiresAt?: string;
  scope?: string;
}

export function useStravaAuth() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [athleteId, setAthleteId] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<StravaConnectionStatus>({
    isConnected: false,
  });

  // Check connection status on mount
  useEffect(() => {
    if (!user) return;
    checkConnectionStatus();
  }, [user]);

  const checkConnectionStatus = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('strava_tokens' as any)
        .select('athlete_id, expires_at, scope')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        setIsConnected(false);
        setAthleteId(null);
        setConnectionStatus({ isConnected: false });
        return;
      }

      const expiresAt = new Date((data as any).expires_at);
      const isExpired = expiresAt <= new Date();

      setIsConnected(!isExpired);
      setAthleteId((data as any).athlete_id);
      setConnectionStatus({
        isConnected: !isExpired,
        athleteId: (data as any).athlete_id,
        expiresAt: (data as any).expires_at,
        scope: (data as any).scope,
      });

    } catch (error) {
      console.error('Error checking Strava connection:', error);
      setIsConnected(false);
      setAthleteId(null);
    }
  }, [user]);

  const connectStrava = useCallback(async () => {
    if (!STRAVA_CLIENT_ID) {
      toast({
        title: 'Configuration Error',
        description: 'Strava client ID is not configured',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to connect Strava',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get user's current session token to pass in state parameter
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Session Error',
          description: 'Please sign in again',
          variant: 'destructive',
        });
        return;
      }

      // Redirect URI is the Supabase edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const redirectUri = `${supabaseUrl}/functions/v1/strava-auth`;
      const scope = 'read,activity:read_all,activity:write';
      
      // Pass user's access token in state parameter for authentication
      const state = session.access_token;

      const authUrl = `${STRAVA_OAUTH_URL}?` + new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        approval_prompt: 'auto',
        scope: scope,
        state: state,
      });

      // Open Strava OAuth in same window
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating Strava OAuth:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to start Strava connection',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  const disconnectStrava = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      // First, get the access token to revoke it with Strava
      const { data: tokenData, error: fetchError } = await supabase
        .from('strava_tokens' as any)
        .select('access_token')
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      // Call Strava's deauthorization endpoint to properly revoke access
      if ((tokenData as any)?.access_token) {
        try {
          const deauthResponse = await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `access_token=${(tokenData as any).access_token}`,
          });

          if (!deauthResponse.ok) {
            console.warn('Failed to deauthorize with Strava API, continuing with local deletion');
          }
        } catch (deauthError) {
          console.warn('Error calling Strava deauthorization endpoint:', deauthError);
          // Continue with local deletion even if Strava API call fails
        }
      }

      // Delete the token from our database
      const { error } = await supabase
        .from('strava_tokens' as any)
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setIsConnected(false);
      setAthleteId(null);
      setConnectionStatus({ isConnected: false });

      toast({
        title: 'Disconnected from Strava',
        description: 'Your Strava account has been disconnected',
      });

    } catch (error) {
      console.error('Error disconnecting Strava:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect Strava account',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const handleOAuthCallback = useCallback(async (code: string, scope: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsLoading(true);

    try {
      // Get user's auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      // Call strava-auth edge function
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: {},
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        // Pass code and scope as query params
        method: 'GET',
        // Note: We'll need to append code/scope to function URL
      });

      if (error) throw error;

      if (data?.success) {
        setIsConnected(true);
        setAthleteId(data.athlete.id);
        setConnectionStatus({
          isConnected: true,
          athleteId: data.athlete.id,
          expiresAt: data.expires_at,
          scope: scope,
        });

        toast({
          title: 'Connected to Strava',
          description: `Successfully connected as ${data.athlete.firstname} ${data.athlete.lastname}`,
        });

        return data;
      }

    } catch (error) {
      console.error('OAuth callback error:', error);
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to Strava. Please try again.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const refreshToken = useCallback(async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      const { data, error } = await supabase.functions.invoke('refresh-strava-token', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        await checkConnectionStatus();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }, [user, checkConnectionStatus]);

  return {
    isConnected,
    isLoading,
    athleteId,
    connectionStatus,
    connectStrava,
    disconnectStrava,
    handleOAuthCallback,
    refreshToken,
    checkConnectionStatus,
  };
}
