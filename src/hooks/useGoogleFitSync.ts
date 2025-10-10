import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GoogleFitData {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distanceMeters: number;
  heartRateAvg?: number;
  sessions?: any[];
}

export function useGoogleFitSync() {
  const { user, getGoogleAccessToken } = useAuth();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'success' | 'error' | 'pending' | null>(null);
  const [lastErrorTime, setLastErrorTime] = useState<number | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [isHistoricalSyncing, setIsHistoricalSyncing] = useState(false);
  const [historicalSyncProgress, setHistoricalSyncProgress] = useState<{
    syncedDays: number;
    totalDays: number;
    isComplete: boolean;
  } | null>(null);

  // Load last sync time from google_tokens table
  useEffect(() => {
    if (!user) return;
    const loadLastSync = async () => {
      try {
        const { data } = await (supabase as any)
          .from('google_tokens')
          .select('last_refreshed_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('last_refreshed_at', { ascending: false })
          .limit(1)
          .single();
        
        if (data?.last_refreshed_at) {
          setLastSync(new Date(data.last_refreshed_at));
        }
      } catch (error) {
        console.error('Error loading last sync time:', error);
      }
    };
    loadLastSync();
  }, [user]);

  // Check connection status on mount and token refresh
  useEffect(() => {
    let cancelled = false;
    const checkConnection = async () => {
      try {
        // Prefer live token
        const token = await getGoogleAccessToken();
        if (!cancelled && token) {
          setIsConnected(true);
          return;
        }
      } catch {}

      try {
        // Check for active token in database
        const { data } = await (supabase as any)
          .from('google_tokens')
          .select('id')
          .eq('user_id', user?.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (!cancelled && data?.id) {
          setIsConnected(true);
          return;
        }
      } catch {}

      if (!cancelled) setIsConnected(false);
    };
    checkConnection();
    return () => { cancelled = true; };
  }, [getGoogleAccessToken, user?.id]);

  // Auto-sync every 15 minutes if connected
  useEffect(() => {
    if (!user || !isConnected) return;

    const checkAndSync = async () => {
      try {
        const { data } = await (supabase as any)
          .from('google_fit_data')
          .select('last_synced_at')
          .eq('user_id', user.id)
          .eq('date', new Date().toISOString().split('T')[0])
          .maybeSingle();
        
        const lastSyncTime = data?.last_synced_at ? new Date(data.last_synced_at) : null;
        if (!lastSyncTime || (Date.now() - lastSyncTime.getTime()) > (15 * 60 * 1000)) {
          syncGoogleFit();
        }
      } catch (error) {
        console.error('Error checking sync status:', error);
        syncGoogleFit();
      }
    };

    checkAndSync();

    // Foreground interval (15 minutes)
    const interval = setInterval(syncGoogleFit, 15 * 60 * 1000);

    // Also trigger sync on resume/online
    const onFocus = () => syncGoogleFit();
    const onOnline = () => syncGoogleFit();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [user, isConnected]);

  const connectGoogleFit = useCallback(async () => {
    try {
      // Set return URL for OAuth redirect
      try { localStorage.setItem('oauth_return_to', '/onboarding?step=5'); } catch {}
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: [
            'https://www.googleapis.com/auth/fitness.activity.read',
            'https://www.googleapis.com/auth/fitness.location.read',
            'https://www.googleapis.com/auth/fitness.heart_rate.read',
            'https://www.googleapis.com/auth/fitness.body.read'
          ].join(' '),
        }
      });
      if (error) throw error;
      setIsConnected(true);
      
      // Check if this is a first-time connection and trigger historical sync
      setTimeout(() => {
        checkAndTriggerHistoricalSync();
      }, 2000); // Wait 2 seconds for token to be stored
      
      return data;
    } catch (error: any) {
      toast({
        title: 'Google Fit connection failed',
        description: error.message || 'Unable to start Google OAuth',
        variant: 'destructive'
      });
      setIsConnected(false);
      return null;
    }
  }, [toast]);

  /**
   * Fetch today's Google Fit data and sync to database
   */
  const syncGoogleFit = useCallback(async (): Promise<GoogleFitData | null> => {
    if (!user) {
      console.error('No user authenticated');
      return null;
    }

    // Circuit breaker: if we've had too many consecutive errors, wait before retrying
    const now = Date.now();
    if (consecutiveErrors >= 3 && lastErrorTime && (now - lastErrorTime) < 5 * 60 * 1000) {
      console.log('Circuit breaker active: too many consecutive errors, skipping sync');
      return null;
    }

    setIsSyncing(true);
    setSyncStatus('pending');

    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        toast({
          title: 'Google Fit not connected',
          description: 'Please connect Google Fit to sync your activity.',
        });
        setIsConnected(false);
        setSyncStatus('error');
        return null;
      }

      // Call the Edge Function to fetch and store data
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not signed in');
      }

      const { data: response, error: functionError } = await (supabase as any).functions.invoke('fetch-google-fit-data', {
        body: { accessToken },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to fetch Google Fit data');
      }

      if (!response?.success || !response?.data) {
        throw new Error(response?.error || 'Invalid response from Google Fit');
      }

      const googleFitData = response.data;
      const now = new Date();
      setLastSync(now);
      setSyncStatus('success');
      setIsConnected(true);
      
      // Reset error counters on successful sync
      setConsecutiveErrors(0);
      setLastErrorTime(null);

      // Refresh weekly aggregates after successful sync
      try {
        // TODO: Implement weekly aggregates refresh if needed
        console.log('Weekly aggregates refresh would be called here');
      } catch (aggregateError) {
        console.warn('Failed to refresh weekly aggregates:', aggregateError);
      }

      // Trigger automatic training activity update
        try {
          const today = new Date().toISOString().split('T')[0];
          await supabase.functions.invoke('update-actual-training', {
            body: { date: today }
          });
          console.log('Triggered automatic training activity update');
        } catch (updateError) {
          console.error('Error triggering training update:', updateError);
        }

      toast({
        title: "Google Fit synced",
        description: `${googleFitData.steps} steps, ${Math.round(googleFitData.caloriesBurned)} calories burned`,
      });

      return googleFitData;

    } catch (error: any) {
      console.error('Google Fit sync failed:', error);

      // Increment error counter and set last error time
      setConsecutiveErrors(prev => prev + 1);
      setLastErrorTime(Date.now());

      const errorMessage = error?.message || "Could not sync Google Fit data";
      
      if (error?.code === 'TOKEN_EXPIRED' || error?.message?.includes('401') || error?.message?.includes('token expired')) {
        toast({
          title: 'Re-authentication required',
          description: 'Your Google Fit session expired. Please reconnect Google Fit from the Import page.',
          variant: 'destructive',
        });
        setIsConnected(false);
        try {
          localStorage.removeItem('google_fit_provider_token');
        } catch {}
      } else {
        toast({
          title: 'Sync failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }

      setSyncStatus('error');
      return null;

    } finally {
      setIsSyncing(false);
    }
  }, [user, getGoogleAccessToken, toast, consecutiveErrors, lastErrorTime]);

  /**
   * Fetch today's Google Fit data from database (cached)
   */
  const getTodayData = useCallback(async (): Promise<GoogleFitData | null> => {
    if (!user) return null;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await (supabase as any)
        .from('google_fit_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // Ignore "not found" error
        throw error;
      }

      if (!data) {
        // No data for today, trigger a sync
        return await syncGoogleFit();
      }

      // Check if data is stale (older than 15 minutes)
      const lastSyncedAt = data.last_synced_at ? new Date(data.last_synced_at) : null;
      if (!lastSyncedAt || (Date.now() - lastSyncedAt.getTime()) > (15 * 60 * 1000)) {
        // Data is stale, trigger a background sync
        syncGoogleFit();
      }

      return {
        steps: data.steps || 0,
        caloriesBurned: data.calories_burned || 0,
        activeMinutes: data.active_minutes || 0,
        distanceMeters: data.distance_meters || 0,
        heartRateAvg: data.heart_rate_avg,
        sessions: data.sessions || []
      };

    } catch (error) {
      console.error('Error fetching Google Fit data:', error);
      return null;
    }
  }, [user, syncGoogleFit]);

  /**
   * Check if this is a first-time Google Fit connection and trigger historical sync
   */
  const checkAndTriggerHistoricalSync = useCallback(async () => {
    if (!user) return;

    try {
      // Check if user has any existing Google Fit data
      const { data: existingData, error } = await (supabase as any)
        .from('google_fit_data')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking existing data:', error);
        return;
      }

      // If no existing data, this is a first-time connection
      if (!existingData) {
        console.log('First-time Google Fit connection detected, triggering historical sync');
        await syncHistoricalData(30); // Sync last 30 days
      }
    } catch (error) {
      console.error('Error checking for first-time connection:', error);
    }
  }, [user]);

  /**
   * Sync historical Google Fit data
   */
  const syncHistoricalData = useCallback(async (daysBack: number = 30): Promise<void> => {
    if (!user) return;

    setIsHistoricalSyncing(true);
    setHistoricalSyncProgress({ syncedDays: 0, totalDays: daysBack, isComplete: false });

    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        throw new Error('No Google Fit access token available');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not signed in');
      }

      toast({
        title: "Syncing historical data",
        description: `Fetching your last ${daysBack} days of Google Fit data...`,
      });

      const { data: response, error: functionError } = await (supabase as any).functions.invoke('sync-historical-google-fit-data', {
        body: { accessToken, daysBack },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to sync historical data');
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Invalid response from historical sync');
      }

      setHistoricalSyncProgress({
        syncedDays: response.data.syncedDays,
        totalDays: response.data.totalDays,
        isComplete: true
      });

      toast({
        title: "Historical sync complete!",
        description: `Successfully synced ${response.data.syncedDays} days of data`,
      });

      // Trigger a regular sync to get today's data
      setTimeout(() => {
        syncGoogleFit();
      }, 1000);

    } catch (error: any) {
      console.error('Historical sync failed:', error);
      
      toast({
        title: 'Historical sync failed',
        description: error.message || 'Could not sync historical data',
        variant: 'destructive',
      });

      setHistoricalSyncProgress(null);
    } finally {
      setIsHistoricalSyncing(false);
    }
  }, [user, getGoogleAccessToken, toast, syncGoogleFit]);

  const resetErrorState = useCallback(() => {
    setConsecutiveErrors(0);
    setLastErrorTime(null);
    setSyncStatus(null);
  }, []);

  return {
    syncGoogleFit,
    getTodayData,
    isSyncing,
    lastSync,
    isConnected,
    syncStatus,
    connectGoogleFit,
    resetErrorState,
    consecutiveErrors,
    lastErrorTime,
    // Historical sync functionality
    syncHistoricalData,
    isHistoricalSyncing,
    historicalSyncProgress,
    checkAndTriggerHistoricalSync
  };
}
