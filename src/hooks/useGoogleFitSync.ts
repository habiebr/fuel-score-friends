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

  // Load last sync time from Supabase on mount
  useEffect(() => {
    if (!user) return;
    const loadLastSync = async () => {
      try {
        const { data } = await (supabase as any)
          .from('user_preferences')
          .select('value')
          .eq('user_id', user.id)
          .eq('key', 'googleFitLastSync')
          .maybeSingle();
        
        if (data?.value?.lastSync) {
          setLastSync(new Date(data.value.lastSync));
        }
      } catch (error) {
        console.error('Error loading last sync time:', error);
      }
    };
    loadLastSync();
  }, [user]);

  // Save last sync time to Supabase
  useEffect(() => {
    if (user && lastSync) {
      (supabase as any)
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          key: 'googleFitLastSync',
          value: { lastSync: lastSync.toISOString() },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,key'
        })
        .then(({ error }) => {
          if (error) console.error('Error saving last sync time:', error);
        });
    }
  }, [user, lastSync]);

  // Check connection status on mount and token refresh, with resilient fallbacks
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
        // Fallback to persisted local storage flag/token
        const persisted = localStorage.getItem('google_fit_connected') === 'true';
        const storedToken = localStorage.getItem('google_fit_provider_token');
        if (!cancelled && (persisted || storedToken)) {
          setIsConnected(true);
          return;
        }
      } catch {}

      if (!cancelled) setIsConnected(false);
    };
    checkConnection();
    return () => { cancelled = true; };
  }, [getGoogleAccessToken]);

  // Auto-sync every 15 minutes if connected (foreground) and register SW periodic sync
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
        // If we can't check, try to sync anyway
        syncGoogleFit();
      }
    };

    checkAndSync();

    // Foreground interval (15 minutes)
    const interval = setInterval(() => { syncGoogleFit(); }, 15 * 60 * 1000);

    // Register periodic background sync via Service Worker when available
    (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          // Try to register periodic sync (may require origin trial/permissions)
          // @ts-ignore
          if ('periodicSync' in reg) {
            // @ts-ignore
            await reg.periodicSync.register('health-periodic-sync', { minInterval: 15 * 60 * 1000 });
          } else {
            // Fallback: message SW to run sync when app is active
            reg.active?.postMessage({ type: 'TRIGGER_HEALTH_SYNC' });
          }
        }
      } catch {}
    })();

    return () => clearInterval(interval);
  }, [user, isConnected]);

  const connectGoogleFit = useCallback(async () => {
    try {
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

    setIsSyncing(true);
    setSyncStatus('pending');
    
    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        toast({
          title: 'Google Fit not connected',
          description: 'Please connect Google Fit to sync your activity.',
        });
        setIsSyncing(false);
        setIsConnected(false);
        setSyncStatus('error');
        return null;
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      // Helper function to aggregate Google Fit data
      const aggregate = async (dataTypeName: string) => {
        const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            aggregateBy: [{ dataTypeName }],
            bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
            startTimeMillis: startOfDay.getTime(),
            endTimeMillis: endOfDay.getTime()
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Google Fit API error: ${res.status} - ${errorText}`);
        }

        return await res.json();
      };

      // Client-side aggregation
      const [stepsData, caloriesData, activeMinutesData, distanceData, heartRateData] = await Promise.all([
        aggregate('com.google.step_count.delta'),
        aggregate('com.google.calories.expended'),
        aggregate('com.google.active_minutes'),
        aggregate('com.google.distance.delta'),
        aggregate('com.google.heart_rate.bpm').catch(() => null)
      ]);

      const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
      const caloriesBurned = caloriesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
      const activeMinutes = activeMinutesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
      const distanceMeters = distanceData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
      const heartRateAvg = heartRateData?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal;

      // Sessions
      const sessionsRes = await fetch(
        `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startOfDay.toISOString()}&endTime=${endOfDay.toISOString()}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      let sessions: any[] = [];
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        sessions = sessionsData.session || [];
      }

      const googleFitData: GoogleFitData = {
        steps,
        caloriesBurned,
        activeMinutes,
        distanceMeters,
        heartRateAvg,
        sessions
      };

      // Save aggregates to database
      const { error: upsertErr } = await (supabase as any)
        .from('google_fit_data')
        .upsert({
          user_id: user.id,
          date: today.toISOString().split('T')[0],
          steps,
          calories_burned: caloriesBurned,
          active_minutes: activeMinutes,
          distance_meters: distanceMeters,
          heart_rate_avg: heartRateAvg,
          sessions,
          last_synced_at: new Date().toISOString(),
          sync_source: 'google_fit'
        }, { onConflict: 'user_id,date' });
      if (upsertErr) throw upsertErr;

      // Upsert normalized per-session records
      try {
        if (Array.isArray(sessions) && sessions.length > 0) {
          const mapped = sessions.map((s: any) => ({
            user_id: user.id,
            session_id: String(s.id || `${s.startTimeMillis}-${s.endTimeMillis}`),
            start_time: s.startTimeMillis ? new Date(Number(s.startTimeMillis)).toISOString() : new Date().toISOString(),
            end_time: s.endTimeMillis ? new Date(Number(s.endTimeMillis)).toISOString() : new Date().toISOString(),
            activity_type: s.activityType || s.activityTypeId || s.activity || null,
            name: s.name || null,
            description: s.description || null,
            source: 'google_fit',
            raw: s
          }));

          const batchSize = 50;
          for (let i = 0; i < mapped.length; i += batchSize) {
            const chunk = mapped.slice(i, i + batchSize);
            await (supabase as any)
              .from('google_fit_sessions')
              .upsert(chunk, { onConflict: 'user_id,session_id' });
          }
        }
      } catch (e) {
        console.error('Failed to upsert google_fit_sessions:', e);
      }

      const now = new Date();
      setLastSync(now);
      setSyncStatus('success');
      setIsConnected(true);
      
      toast({
        title: "Google Fit synced",
        description: `${steps} steps, ${Math.round(caloriesBurned)} calories burned`,
      });

      return googleFitData;

    } catch (error: any) {
      console.error('Google Fit sync failed:', error);
      
      toast({
        title: "Sync failed",
        description: error.message || "Could not sync Google Fit data",
        variant: "destructive",
      });
      
      setSyncStatus('error');
      if (error.message?.includes('401')) {
        setIsConnected(false);
      }
      
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [user, getGoogleAccessToken, toast]);

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

  return {
    syncGoogleFit,
    getTodayData,
    isSyncing,
    lastSync,
    isConnected,
    syncStatus,
    connectGoogleFit
  };
}