import { useState, useEffect, useCallback } from 'react';
import { useGoogleFitSync } from './useGoogleFitSync';
import { useHealthKit } from './useHealthKit';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

interface HealthData {
  steps: number;
  calories: number;
  activeMinutes: number;
  heartRate: number;
  distance: number;
  date: string;
  source: 'wearable_fit' | 'google_fit' | 'apple_health' | 'manual';
}

interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingSync: boolean;
  error: string | null;
}

export function useHealthSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const googleFit = useGoogleFitSync();
  const healthKit = useHealthKit();
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    lastSync: null,
    pendingSync: false,
    error: null
  });

  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true, error: null }));
      // Auto-sync when coming back online
      if (syncStatus.pendingSync) {
        syncHealthData();
      }
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncStatus.pendingSync]);

  // Load today's data on mount
  useEffect(() => {
    if (user) {
      loadTodayData();
    }
  }, [user]);

  // Load today's data from database (prioritize wearable .fit entries if present)
  const loadTodayData = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('wearable_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        const dbSource = (data.source as string) || 'manual';
        setHealthData({
          steps: data.steps || 0,
          calories: data.calories_burned || 0,
          activeMinutes: data.active_minutes || 0,
          heartRate: data.heart_rate_avg || 0,
          distance: data.distance || 0,
          date: data.date,
          source: dbSource === 'fit' || dbSource === 'garmin' ? 'wearable_fit' : (dbSource as any)
        });
      }
    } catch (error) {
      console.error('Failed to load today\'s data:', error);
    }
  };

  // Sync health data from all available sources
  const syncHealthData = async (force: boolean = false) => {
    if (!user || isLoading) return;

    setIsLoading(true);
    setSyncStatus(prev => ({ ...prev, error: null }));

    try {
      let newData: HealthData | null = null;
      let source: HealthData['source'] = 'manual';

      // 1) Prefer existing wearable .fit data for today if present
      {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('wearable_data')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .in('source', ['fit', 'garmin'])
          .single();
        if (!error && data) {
          newData = {
            steps: data.steps || 0,
            calories: data.calories_burned || 0,
            activeMinutes: data.active_minutes || 0,
            heartRate: data.heart_rate_avg || 0,
            distance: data.distance || 0,
            date: data.date,
            source: 'wearable_fit'
          };
          source = 'wearable_fit';
        }
      }

      // 2) If no wearable .fit, try Google Fit (if connected)
      if (!newData && googleFit.isConnected) {
        const googleData = await googleFit.getTodayData();
        if (googleData) {
          newData = {
            steps: googleData.steps,
            calories: googleData.caloriesBurned,
            activeMinutes: googleData.activeMinutes,
            heartRate: googleData.heartRateAvg || 0,
            distance: googleData.distanceMeters,
            date: new Date().toISOString().split('T')[0],
            source: 'google_fit'
          };
          source = 'google_fit';
        }
      }

      // 3) If still no data, try Apple Health (if available and authorized)
      if (!newData && healthKit.isAuthorized) {
        const appleData = await healthKit.fetchTodayData();
        if (appleData) {
          newData = {
            ...appleData,
            source: 'apple_health'
          };
          source = 'apple_health';
        }
      }

      // If we have new data, save it
      if (newData) {
        await saveHealthData(newData);
        setHealthData(newData);
        setSyncStatus(prev => ({
          ...prev,
          lastSync: new Date(),
          pendingSync: false
        }));

        toast({
          title: "Health data synced!",
          description: `Updated from ${source === 'wearable_fit' ? '.fit files' : source === 'google_fit' ? 'Google Fit' : 'Apple Health'}`,
        });
      } else if (force) {
        toast({
          title: "No new data",
          description: "No health data available to sync",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSyncStatus(prev => ({
        ...prev,
        error: errorMessage,
        pendingSync: true
      }));

      toast({
        title: "Sync failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save health data to database
  const saveHealthData = async (data: HealthData) => {
    if (!user) return;

    const { error } = await supabase
      .from('wearable_data')
      .upsert({
        user_id: user.id,
        date: data.date,
        steps: data.steps,
        calories_burned: data.calories,
        active_minutes: data.activeMinutes,
        heart_rate_avg: data.heartRate,
        distance: data.distance,
        source: data.source
      }, {
        onConflict: 'user_id,date'
      });

    if (error) throw error;
  };

  // Manual data entry
  const updateManualData = async (updates: Partial<HealthData>) => {
    if (!user || !healthData) return;

    const updatedData = {
      ...healthData,
      ...updates,
      source: 'manual' as const
    };

    try {
      await saveHealthData(updatedData);
      setHealthData(updatedData);
      
      toast({
        title: "Data updated",
        description: "Your health data has been updated",
      });
    } catch (error) {
      console.error('Failed to update data:', error);
      toast({
        title: "Update failed",
        description: "Failed to update health data",
        variant: "destructive",
      });
    }
  };

  // Background sync (called by service worker)
  const backgroundSync = useCallback(async () => {
    if (!syncStatus.isOnline || !user) return;

    try {
      await syncHealthData();
    } catch (error) {
      console.error('Background sync failed:', error);
      setSyncStatus(prev => ({ ...prev, pendingSync: true }));
    }
  }, [syncStatus.isOnline, user]);

  // Register background sync
  useEffect(() => {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        // Register background sync for health data
        registration.sync.register('health-sync').catch(console.error);
      });
    }
  }, []);

  return {
    healthData,
    syncStatus,
    isLoading,
    syncHealthData,
    updateManualData,
    backgroundSync,
    loadTodayData,
    // Expose individual service states
    googleFit: {
      isConnected: googleFit.isConnected,
      connectGoogleFit: googleFit.connectGoogleFit,
      syncGoogleFit: googleFit.syncGoogleFit
    },
    appleHealth: {
      isAvailable: healthKit.isAvailable,
      isAuthorized: healthKit.isAuthorized,
      requestAuthorization: healthKit.requestAuthorization
    }
  };
}
