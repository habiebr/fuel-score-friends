import { supabase } from '@/integrations/supabase/client';

export interface SyncPhase {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
  data?: any;
}

export interface SyncState {
  isRunning: boolean;
  currentPhase?: string;
  phases: SyncPhase[];
  lastSync?: Date;
  nextSync?: Date;
  error?: string;
}

export class UnifiedSyncService {
  private static instance: UnifiedSyncService;
  private syncState: SyncState = {
    isRunning: false,
    phases: [],
    lastSync: undefined,
    nextSync: undefined
  };
  
  private listeners: ((state: SyncState) => void)[] = [];
  private syncInterval?: NodeJS.Timeout;
  private backgroundSyncInterval?: number;

  private constructor() {
    this.initializePhases();
    this.setupBackgroundSync();
  }

  static getInstance(): UnifiedSyncService {
    if (!UnifiedSyncService.instance) {
      UnifiedSyncService.instance = new UnifiedSyncService();
    }
    return UnifiedSyncService.instance;
  }

  private initializePhases(): void {
    this.syncState.phases = [
      { id: 'auth', name: 'Authentication Check', status: 'pending' },
      { id: 'token', name: 'Token Validation', status: 'pending' },
      { id: 'fetch', name: 'Fetch Google Fit Data', status: 'pending' },
      { id: 'process', name: 'Process Activity Data', status: 'pending' },
      { id: 'store', name: 'Store in Database', status: 'pending' },
      { id: 'cleanup', name: 'Cleanup & Notify', status: 'pending' }
    ];
  }

  private updatePhase(phaseId: string, updates: Partial<SyncPhase>): void {
    const phase = this.syncState.phases.find(p => p.id === phaseId);
    if (phase) {
      Object.assign(phase, updates);
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({ ...this.syncState }));
  }

  public subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    // Immediately notify with current state
    listener({ ...this.syncState });
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public getState(): SyncState {
    return { ...this.syncState };
  }

  private async executePhase(phaseId: string, phaseFunction: () => Promise<any>): Promise<any> {
    const phase = this.syncState.phases.find(p => p.id === phaseId);
    if (!phase) throw new Error(`Phase ${phaseId} not found`);

    try {
      this.updatePhase(phaseId, { 
        status: 'running', 
        startTime: new Date(),
        error: undefined 
      });

      const result = await phaseFunction();
      
      this.updatePhase(phaseId, { 
        status: 'completed', 
        endTime: new Date(),
        data: result 
      });

      return result;
    } catch (error) {
      this.updatePhase(phaseId, { 
        status: 'failed', 
        endTime: new Date(),
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  public async syncGoogleFit(force: boolean = false): Promise<SyncState> {
    if (this.syncState.isRunning && !force) {
      console.log('Sync already running, skipping...');
      return this.syncState;
    }

    this.syncState.isRunning = true;
    this.syncState.error = undefined;
    this.initializePhases();
    this.notifyListeners();

    try {
      // Phase 1: Authentication Check
      await this.executePhase('auth', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No active session');
        return { userId: session.user.id };
      });

      // Phase 2: Token Validation
      const { userId } = await this.executePhase('token', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');
        
        const { data: tokenData, error } = await supabase
          .from('google_tokens')
          .select('access_token, expires_at')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !tokenData?.access_token) {
          throw new Error('No valid Google Fit token found');
        }

        return { 
          accessToken: tokenData.access_token,
          expiresAt: tokenData.expires_at 
        };
      });

      // Phase 3: Fetch Google Fit Data
      const googleFitData = await this.executePhase('fetch', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        // Get current token (background token renewal handles refresh)
        const { data: tokenData, error: tokenError } = await supabase
          .from('google_tokens')
          .select('access_token')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (tokenError || !tokenData?.access_token) {
          throw new Error('No valid Google Fit token found - background token renewal should handle this');
        }

        // Fetch data using existing fetch-google-fit-data function
        const { data, error } = await supabase.functions.invoke('fetch-google-fit-data', {
          body: { accessToken: tokenData.access_token },
          headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to fetch Google Fit data');
        
        return data.data;
      });

      // Phase 4: Process Activity Data
      const processedData = await this.executePhase('process', async () => {
        return {
          steps: googleFitData.steps || 0,
          caloriesBurned: googleFitData.caloriesBurned || 0,
          activeMinutes: googleFitData.activeMinutes || 0,
          distanceMeters: googleFitData.distanceMeters || 0,
          heartRateAvg: googleFitData.heartRateAvg,
          sessions: googleFitData.sessions || [],
          timestamp: new Date().toISOString()
        };
      });

      // Phase 5: Store in Database
      await this.executePhase('store', async () => {
        const today = new Date().toISOString().split('T')[0];
        
        const { error } = await supabase
          .from('google_fit_data')
          .upsert({
            user_id: userId,
            date: today,
            steps: processedData.steps,
            calories_burned: processedData.caloriesBurned,
            active_minutes: processedData.activeMinutes,
            distance_meters: processedData.distanceMeters,
            heart_rate_avg: processedData.heartRateAvg,
            sessions: processedData.sessions,
            last_synced_at: processedData.timestamp,
            sync_source: 'unified_sync'
          }, { onConflict: 'user_id,date' });

        if (error) throw error;
        return { stored: true };
      });

      // Phase 6: Cleanup & Notify
      await this.executePhase('cleanup', async () => {
        this.syncState.lastSync = new Date();
        this.syncState.nextSync = new Date(Date.now() + 15 * 60 * 1000); // Next sync in 15 minutes
        
        // Trigger any additional post-sync actions
        try {
          await this.refreshWeeklyAggregates(userId);
        } catch (error) {
          console.warn('Failed to refresh weekly aggregates:', error);
        }

        return { completed: true };
      });

      this.syncState.isRunning = false;
      this.notifyListeners();

      return this.syncState;

    } catch (error) {
      this.syncState.isRunning = false;
      this.syncState.error = error instanceof Error ? error.message : String(error);
      this.notifyListeners();
      throw error;
    }
  }

  private async refreshWeeklyAggregates(userId: string): Promise<void> {
    try {
      // Call the weekly aggregates refresh function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // This would call your existing weekly aggregate refresh logic
      console.log('Refreshing weekly aggregates for user:', userId);
      
      // You can add specific weekly aggregate refresh logic here
      // For now, just log that it would be called
    } catch (error) {
      console.warn('Failed to refresh weekly aggregates:', error);
    }
  }

  private setupBackgroundSync(): void {
    // Set up interval for automatic syncing
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncGoogleFit();
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    }, 15 * 60 * 1000); // Every 15 minutes

    // Set up service worker communication for background sync
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_REQUEST') {
          this.syncGoogleFit();
        }
      });
    }
  }

  public startBackgroundSync(): void {
    if (this.backgroundSyncInterval) return;
    
    this.backgroundSyncInterval = window.setInterval(async () => {
      try {
        await this.syncGoogleFit();
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    }, 15 * 60 * 1000);
  }

  public stopBackgroundSync(): void {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
      this.backgroundSyncInterval = undefined;
    }
  }

  public destroy(): void {
    this.stopBackgroundSync();
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.listeners = [];
  }
}

// Export singleton instance
export const unifiedSyncService = UnifiedSyncService.getInstance();
