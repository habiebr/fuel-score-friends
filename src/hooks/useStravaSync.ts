// Strava Activities Sync Hook
// Handles syncing activities from Strava API
// Separate from Google Fit to avoid breaking existing code

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncOptions {
  after?: number; // Unix timestamp
  before?: number; // Unix timestamp
  per_page?: number;
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  distance: number;
  start_date: string;
}

interface SyncResult {
  success: boolean;
  synced: number;
  total_fetched: number;
  errors: any[];
  activities: StravaActivity[];
}

export function useStravaSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const syncActivities = useCallback(async (options: SyncOptions = {}) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to sync Strava activities',
        variant: 'destructive',
      });
      return null;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      console.log('Syncing Strava activities...');

      const { data, error } = await supabase.functions.invoke('sync-strava-activities', {
        body: {
          after: options.after,
          before: options.before,
          per_page: options.per_page || 30,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Sync error:', error);
        throw error;
      }

      if (data?.success) {
        setSyncResult(data);
        setLastSync(new Date());

        toast({
          title: 'Sync Complete',
          description: `Synced ${data.synced} activities from Strava`,
        });

        return data;
      } else {
        throw new Error(data?.message || 'Sync failed');
      }

    } catch (error) {
      console.error('Strava sync error:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to sync Strava activities';

      toast({
        title: 'Sync Failed',
        description: errorMessage,
        variant: 'destructive',
      });

      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [user, toast]);

  const syncRecentActivities = useCallback(async () => {
    // Sync activities from the last 30 days
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    return syncActivities({ after: thirtyDaysAgo, per_page: 50 });
  }, [syncActivities]);

  const syncAllActivities = useCallback(async () => {
    // Sync all activities (no time limit)
    return syncActivities({ per_page: 200 });
  }, [syncActivities]);

  const syncDateRange = useCallback(async (startDate: Date, endDate: Date) => {
    const after = Math.floor(startDate.getTime() / 1000);
    const before = Math.floor(endDate.getTime() / 1000);
    return syncActivities({ after, before, per_page: 100 });
  }, [syncActivities]);

  return {
    isSyncing,
    lastSync,
    syncResult,
    syncActivities,
    syncRecentActivities,
    syncAllActivities,
    syncDateRange,
  };
}
