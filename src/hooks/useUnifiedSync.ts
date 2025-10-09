import { useState, useEffect, useCallback } from 'react';
import { unifiedSyncService, SyncState } from '@/services/unified-sync.service';
import { useToast } from '@/hooks/use-toast';

export function useUnifiedSync() {
  const [syncState, setSyncState] = useState<SyncState>(unifiedSyncService.getState());
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = unifiedSyncService.subscribe((newState) => {
      setSyncState(newState);
      
      // Show toast notifications for sync completion/failure
      if (newState.lastSync && !newState.isRunning && !newState.error) {
        const lastPhase = newState.phases[newState.phases.length - 1];
        if (lastPhase?.status === 'completed') {
          toast({
            title: "Sync completed",
            description: `Google Fit data synced successfully`,
          });
        }
      }
      
      if (newState.error && !newState.isRunning) {
        toast({
          title: "Sync failed",
          description: newState.error,
          variant: "destructive",
        });
      }
    });

    return unsubscribe;
  }, [toast]);

  const syncNow = useCallback(async (force: boolean = false) => {
    try {
      await unifiedSyncService.syncGoogleFit(force);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }, []);

  const startBackgroundSync = useCallback(() => {
    unifiedSyncService.startBackgroundSync();
  }, []);

  const stopBackgroundSync = useCallback(() => {
    unifiedSyncService.stopBackgroundSync();
  }, []);

  return {
    syncState,
    syncNow,
    startBackgroundSync,
    stopBackgroundSync,
    isRunning: syncState.isRunning,
    lastSync: syncState.lastSync,
    nextSync: syncState.nextSync,
    error: syncState.error,
    phases: syncState.phases
  };
}
