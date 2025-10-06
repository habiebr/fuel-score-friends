import { useState, useCallback } from 'react';
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

  /**
   * Fetch today's Google Fit data and sync to database
   */
  const syncGoogleFit = useCallback(async (): Promise<GoogleFitData | null> => {
    if (!user) {
      console.error('No user authenticated');
      return null;
    }

    setIsSyncing(true);
    
    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        throw new Error('No Google access token available. Please connect Google Fit.');
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

      // Fetch all data types in parallel
      const [stepsData, caloriesData, activeMinutesData, distanceData, heartRateData] = await Promise.all([
        aggregate('com.google.step_count.delta'),
        aggregate('com.google.calories.expended'),
        aggregate('com.google.active_minutes'),
        aggregate('com.google.distance.delta'),
        aggregate('com.google.heart_rate.bpm').catch(() => null) // Optional
      ]);

      // Extract values from responses
      const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
      const caloriesBurned = caloriesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
      const activeMinutes = activeMinutesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
      const distanceMeters = distanceData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
      const heartRateAvg = heartRateData?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal;

      // Fetch activity sessions (runs, bike rides, etc.)
      const sessionsRes = await fetch(
        `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startOfDay.toISOString()}&endTime=${endOfDay.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
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

      // Save to database using upsert (insert or update)
      const { error } = await supabase
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
        }, {
          onConflict: 'user_id,date'
        });

      if (error) {
        throw error;
      }

      setLastSync(new Date());
      
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
      
      const { data, error } = await supabase
        .from('google_fit_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') { // Ignore "not found" error
        throw error;
      }

      if (!data) {
        // No data for today, trigger a sync
        return await syncGoogleFit();
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
    lastSync
  };
}

