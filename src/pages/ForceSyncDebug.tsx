import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  Database,
  Users,
  Activity
} from 'lucide-react';

export default function ForceSyncDebug() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [clearResult, setClearResult] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);

  const clearGoogleFitData = async () => {
    if (!user) return;

    setIsClearing(true);
    setClearResult(null);

    try {
      // Clear google_fit_data
      const { error: dataError } = await supabase
        .from('google_fit_data')
        .delete()
        .eq('user_id', user.id);

      if (dataError) throw dataError;

      // Clear google_fit_sessions
      const { error: sessionsError } = await supabase
        .from('google_fit_sessions')
        .delete()
        .eq('user_id', user.id);

      if (sessionsError) throw sessionsError;

      // Clear user preferences
      const { error: prefsError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id)
        .in('key', ['googleFitLastSync', 'googleFitStatus']);

      if (prefsError) throw prefsError;

      setClearResult({
        success: true,
        message: 'Google Fit data cleared successfully',
        cleared: {
          data: true,
          sessions: true,
          preferences: true
        }
      });

      toast({
        title: "Data cleared",
        description: "Google Fit data has been cleared for re-sync",
      });

    } catch (error) {
      console.error('Error clearing data:', error);
      setClearResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      toast({
        title: "Clear failed",
        description: "Failed to clear Google Fit data",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const forceSyncAllUsers = async () => {
    setIsForceSyncing(true);
    setSyncResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('force-sync-all-users', {
        body: {
          admin_key: 'force_sync_2025', // You should set this as an environment variable
          days: 30
        }
      });

      if (error) throw error;

      setSyncResult(data);

      toast({
        title: "Force sync completed",
        description: `Synced ${data.results?.successful_syncs || 0} users successfully`,
      });

    } catch (error) {
      console.error('Error force syncing:', error);
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      toast({
        title: "Force sync failed",
        description: "Failed to force sync all users",
        variant: "destructive",
      });
    } finally {
      setIsForceSyncing(false);
    }
  };

  const forceSyncCurrentUser = async () => {
    if (!user) return;

    setIsForceSyncing(true);
    setSyncResult(null);

    try {
      // Get current user's Google Fit token
      const { data: tokenData, error: tokenError } = await supabase
        .from('google_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('No active Google Fit token found');
      }

      const { data, error } = await supabase.functions.invoke('sync-all-google-fit-data', {
        body: {
          accessToken: tokenData.access_token,
          days: 30
        }
      });

      if (error) throw error;

      setSyncResult(data);

      toast({
        title: "Sync completed",
        description: `Synced ${data.sessions_synced || 0} sessions and ${data.days_processed || 0} days`,
      });

    } catch (error) {
      console.error('Error syncing current user:', error);
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      toast({
        title: "Sync failed",
        description: "Failed to sync current user",
        variant: "destructive",
      });
    } finally {
      setIsForceSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 pb-28 safe-area-inset">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Force Sync Debug</h1>
          <p className="text-gray-400">Clear Google Fit data and force re-sync with exercise-only filtering</p>
        </div>

        {/* Clear Data Section */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Clear Google Fit Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4">
              This will clear all existing Google Fit data for the current user, allowing for a fresh sync with the new exercise-only filtering.
            </p>
            
            <div className="flex gap-4 mb-4">
              <Button
                onClick={clearGoogleFitData}
                disabled={isClearing}
                variant="destructive"
                className="flex items-center gap-2"
              >
                {isClearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {isClearing ? 'Clearing...' : 'Clear My Data'}
              </Button>
            </div>

            {clearResult && (
              <Alert className={clearResult.success ? 'border-green-500' : 'border-red-500'}>
                {clearResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {clearResult.success ? clearResult.message : clearResult.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Force Sync Section */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Force Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4">
              Force sync Google Fit data with the new exercise-only filtering (excludes walking).
            </p>
            
            <div className="flex gap-4 mb-4">
              <Button
                onClick={forceSyncCurrentUser}
                disabled={isForceSyncing}
                className="flex items-center gap-2"
              >
                {isForceSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4" />
                )}
                {isForceSyncing ? 'Syncing...' : 'Sync Current User'}
              </Button>

              {/* Removed global sync to enforce per-user only */}
            </div>

            {syncResult && (
              <Alert className={syncResult.success !== false ? 'border-green-500' : 'border-red-500'}>
                {syncResult.success !== false ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {syncResult.success !== false ? (
                    <div>
                      <p className="font-medium mb-2">Sync Results:</p>
                      {syncResult.results ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Total Users</Badge>
                            <span>{syncResult.results.total_users}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">Successful</Badge>
                            <span>{syncResult.results.successful_syncs}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">Failed</Badge>
                            <span>{syncResult.results.failed_syncs}</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p>Sessions synced: {syncResult.sessions_synced || 0}</p>
                          <p>Days processed: {syncResult.days_processed || 0}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    syncResult.error
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Filtering Info */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="h-5 w-5" />
              New Filtering Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-white font-medium mb-2">Included Activities:</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Running', 'Cycling', 'Swimming', 'Hiking', 'Elliptical', 'Rowing',
                    'Soccer', 'Basketball', 'Tennis', 'Volleyball', 'Golf', 'Skiing',
                    'Skating', 'Dancing', 'Aerobics', 'Strength Training', 'CrossFit',
                    'Yoga', 'Pilates', 'Martial Arts', 'Climbing', 'Surfing', 'Triathlon'
                  ].map(activity => (
                    <Badge key={activity} variant="secondary" className="text-xs">
                      {activity}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-white font-medium mb-2">Excluded Activities:</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Walking', 'Strolling', 'Dog Walking', 'Power Walking',
                    'Commuting', 'Transportation', 'Travel'
                  ].map(activity => (
                    <Badge key={activity} variant="destructive" className="text-xs">
                      {activity}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
