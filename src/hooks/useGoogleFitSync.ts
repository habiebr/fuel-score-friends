import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { refreshWeeklyAggregates } from '@/lib/weekly-google-fit';

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

    // Also trigger sync on resume/online for PWA usage
    const onFocus = () => { syncGoogleFit(); };
    const onOnline = () => { syncGoogleFit(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

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

    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); window.removeEventListener('online', onOnline); };
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

    // Circuit breaker: if we've had too many consecutive errors, wait before retrying
    const now = Date.now();
    if (consecutiveErrors >= 3 && lastErrorTime && (now - lastErrorTime) < 5 * 60 * 1000) {
      console.log('Circuit breaker active: too many consecutive errors, skipping sync');
      return null;
    }

    setIsSyncing(true);
    setSyncStatus('pending');

    const performSync = async (accessToken: string, attempt: number): Promise<GoogleFitData | null> => {
      try {
        // Validate token before making API calls
        if (!accessToken) {
          throw new Error('No access token available');
        }

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const aggregate = async (dataTypeName: string) => {
          const res = await fetch('/fitness', {
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

          if (res.status === 401) {
            const err: any = new Error('Google Fit token expired');
            err.status = 401;
            throw err;
          }

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Google Fit API error: ${res.status} - ${errorText}`);
          }

          return await res.json();
        };

        const [stepsData, caloriesData, activeMinutesData, heartRateData] = await Promise.all([
          aggregate('com.google.step_count.delta'),
          aggregate('com.google.calories.expended'),
          aggregate('com.google.active_minutes'),
          aggregate('com.google.heart_rate.bpm').catch(() => null)
        ]);

        const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
        const caloriesBurned = caloriesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
        const activeMinutes = activeMinutesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
        const heartRateAvg = heartRateData?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal;

        // For sessions, we'll need to create a proxy or use a different approach
        // For now, let's skip sessions to avoid CORS issues
        let sessions: any[] = [];
        try {
          const sessionsRes = await fetch(
            `/fitness?startTime=${startOfDay.toISOString()}&endTime=${endOfDay.toISOString()}`,
            { 
              method: 'GET',
              headers: { 'Authorization': `Bearer ${accessToken}` } 
            }
          );
          if (sessionsRes.ok) {
            const sessionsData = await sessionsRes.json();
            sessions = sessionsData.session || [];
          }
        } catch (error) {
          console.warn('Failed to fetch sessions (proxy not available):', error);
          sessions = [];
        }

        // Filter sessions to only include running/sport activities (exclude walking)
        // More comprehensive list of exercise activities, explicitly excluding walking
        const exerciseActivities = [
          'running', 'jogging', 'sprint', 'marathon', 'half_marathon', '5k', '10k',
          'cycling', 'biking', 'bike', 'road_cycling', 'mountain_biking', 'indoor_cycling',
          'swimming', 'swim', 'pool_swimming', 'open_water_swimming',
          'hiking', 'trail_running', 'mountain_hiking',
          'elliptical', 'elliptical_trainer',
          'rowing', 'indoor_rowing', 'outdoor_rowing',
          'soccer', 'football', 'basketball', 'tennis', 'volleyball', 'badminton',
          'golf', 'golfing',
          'skiing', 'alpine_skiing', 'cross_country_skiing', 'snowboarding',
          'skating', 'ice_skating', 'roller_skating', 'inline_skating',
          'dancing', 'aerobic_dance', 'zumba', 'salsa', 'hip_hop',
          'aerobics', 'step_aerobics', 'water_aerobics',
          'strength_training', 'weight_lifting', 'weight_training', 'resistance_training',
          'crossfit', 'functional_fitness',
          'yoga', 'power_yoga', 'hot_yoga', 'vinyasa_yoga',
          'pilates', 'mat_pilates', 'reformer_pilates',
          'martial_arts', 'karate', 'taekwondo', 'judo', 'boxing', 'kickboxing', 'muay_thai',
          'climbing', 'rock_climbing', 'indoor_climbing', 'bouldering',
          'surfing', 'kayaking', 'canoeing', 'paddleboarding',
          'triathlon', 'duathlon', 'athletics', 'track_and_field',
          'gymnastics', 'calisthenics', 'plyometrics',
          'kickboxing', 'boxing', 'mma', 'wrestling',
          'rugby', 'hockey', 'lacrosse', 'baseball', 'softball',
          'cricket', 'squash', 'racquetball', 'handball',
          'archery', 'shooting', 'fencing',
          'rowing_machine', 'treadmill', 'stair_climbing', 'stair_master'
        ];
        
        // Explicitly exclude walking and related activities
        const excludedActivities = [
          'walking', 'walk', 'strolling', 'leisurely_walk', 'casual_walk',
          'dog_walking', 'power_walking', 'brisk_walking',
          'commuting', 'transportation', 'travel'
        ];
        
        const filteredSessions = sessions.filter((session: any) => {
          const activityType = String(session.activityType || session.activityTypeId || session.activity || '').toLowerCase();
          const sessionName = String(session.name || '').toLowerCase();
          const sessionDescription = String(session.description || '').toLowerCase();
          
          // Check if it's explicitly excluded
          const isExcluded = excludedActivities.some(excluded => 
            activityType.includes(excluded) || 
            sessionName.includes(excluded) || 
            sessionDescription.includes(excluded)
          );
          
          if (isExcluded) {
            console.log(`Excluding session: ${sessionName || activityType} (${sessionDescription})`);
            return false;
          }
          
          // Check if it's an exercise activity
          const isExercise = exerciseActivities.some(activity => 
            activityType.includes(activity) || 
            sessionName.includes(activity) || 
            sessionDescription.includes(activity)
          );
          
          if (isExercise) {
            console.log(`Including exercise session: ${sessionName || activityType} (${sessionDescription})`);
          }
          
          return isExercise;
        });

        // Calculate distance only from exercise activities
        let exerciseDistanceMeters = 0;
        if (filteredSessions.length > 0) {
          // Get detailed data for each exercise session to calculate distance
          for (const session of filteredSessions) {
            try {
              const sessionStartTime = new Date(Number(session.startTimeMillis));
              const sessionEndTime = new Date(Number(session.endTimeMillis));
              
              const sessionDistanceRes = await fetch(
                "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
                {
                  method: "POST",
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    aggregateBy: [{ dataTypeName: 'com.google.distance.delta' }],
                    bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
                    startTimeMillis: sessionStartTime.getTime(),
                    endTimeMillis: sessionEndTime.getTime(),
                    filter: [{
                      dataSourceId: session.dataSourceId || undefined
                    }].filter(f => f.dataSourceId)
                  }),
                }
              );
              
              if (sessionDistanceRes.ok) {
                const sessionDistanceData = await sessionDistanceRes.json();
                const sessionDistance = sessionDistanceData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
                exerciseDistanceMeters += sessionDistance;
              }
            } catch (error) {
              console.warn('Failed to get distance for session:', error);
            }
          }
        }

        const googleFitData: GoogleFitData = {
          steps,
          caloriesBurned,
          activeMinutes,
          distanceMeters: exerciseDistanceMeters, // Use exercise-only distance
          heartRateAvg,
          sessions: filteredSessions // Use filtered sessions
        };

        const { error: upsertErr } = await (supabase as any)
          .from('google_fit_data')
          .upsert({
            user_id: user.id,
            date: today.toISOString().split('T')[0],
            steps,
            calories_burned: caloriesBurned,
            active_minutes: activeMinutes,
            distance_meters: exerciseDistanceMeters, // Use exercise-only distance
            heart_rate_avg: heartRateAvg,
            sessions: filteredSessions, // Use filtered sessions
            last_synced_at: new Date().toISOString(),
            sync_source: 'google_fit'
          }, { onConflict: 'user_id,date' });
        if (upsertErr) throw upsertErr;

        try {
          if (Array.isArray(filteredSessions) && filteredSessions.length > 0) {
            const mapped = filteredSessions.map((s: any) => ({
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
        
        // Reset error counters on successful sync
        setConsecutiveErrors(0);
        setLastErrorTime(null);

        // Refresh weekly aggregates after successful sync
        try {
          await refreshWeeklyAggregates(user.id);
        } catch (aggregateError) {
          console.warn('Failed to refresh weekly aggregates:', aggregateError);
        }

        // Trigger automatic training activity update for today
        try {
          const today = new Date().toISOString().split('T')[0];
          await supabase.functions.invoke('update-actual-training', {
            body: { date: today }
          });
          console.log('Triggered automatic training activity update');
        } catch (updateError) {
          console.error('Error triggering training update:', updateError);
          // Don't fail the whole sync if training update fails
        }

        toast({
          title: "Google Fit synced",
          description: `${steps} steps, ${Math.round(caloriesBurned)} calories burned`,
        });

        return googleFitData;
      } catch (error: any) {
        console.error(`Google Fit API call failed (attempt ${attempt + 1}):`, error);
        
        // Handle token expiration with retry
        if (attempt === 0 && (error?.status === 401 || `${error?.message || ''}`.includes('401') || error?.message?.includes('invalid_token'))) {
          console.log('Token appears to be expired, attempting refresh...');
          try {
            const refreshed = await getGoogleAccessToken({ forceRefresh: true });
            if (refreshed && refreshed !== accessToken) {
              console.log('Token refreshed successfully, retrying sync...');
              return performSync(refreshed, attempt + 1);
            } else {
              console.error('Failed to refresh token - no new token received');
              throw new Error('Unable to refresh Google Fit token');
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            throw new Error('Unable to refresh Google Fit token');
          }
        }
        throw error;
      }
    };

    try {
      const initialToken = await getGoogleAccessToken();
      if (!initialToken) {
        toast({
          title: 'Google Fit not connected',
          description: 'Please connect Google Fit to sync your activity.',
        });
        setIsConnected(false);
        setSyncStatus('error');
        return null;
      }

      return await performSync(initialToken, 0);
    } catch (error: any) {
      console.error('Google Fit sync failed:', error);

      // Increment error counter and set last error time
      setConsecutiveErrors(prev => prev + 1);
      setLastErrorTime(Date.now());

      const errorMessage = error?.message || "Could not sync Google Fit data";
      
      toast({
        title: "Sync failed",
        description: errorMessage,
        variant: "destructive",
      });

      setSyncStatus('error');
      
      // Handle different types of errors
      if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('invalid_token')) {
        console.log('Setting Google Fit as disconnected due to authentication error');
        setIsConnected(false);
        // Clear stored tokens on auth failure
        try {
          localStorage.removeItem('google_fit_provider_token');
          localStorage.removeItem('google_fit_provider_refresh_token');
          localStorage.removeItem('google_fit_provider_token_expires_at');
        } catch {}
      }

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
    lastErrorTime
  };
}
