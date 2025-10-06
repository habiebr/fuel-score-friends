import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Heart, 
  Flame, 
  Footprints, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  ExternalLink,
  Settings
} from 'lucide-react';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';
import { useToast } from '@/hooks/use-toast';

interface GoogleFitData {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  heartRateAvg?: number;
  distanceMeters: number;
  sessions?: any[];
}

export function GoogleFitIntegration() {
  const { 
    isConnected, 
    isSyncing, 
    lastSync, 
    syncStatus, 
    connectGoogleFit, 
    getTodayData 
  } = useGoogleFitSync();
  
  const { toast } = useToast();
  const [healthData, setHealthData] = useState<GoogleFitData | null>(null);

  // Load data when connected
  useEffect(() => {
    if (isConnected) {
      loadHealthData();
    }
  }, [isConnected]);

  const loadHealthData = async () => {
    if (!isConnected) return;

    try {
      const data = await getTodayData();
      if (data) {
        setHealthData(data);
      }
    } catch (err) {
      console.error('Failed to load health data:', err);
      toast({
        title: "Failed to load data",
        description: "Could not fetch health data from Google Fit",
        variant: "destructive",
      });
    }
  };

  const handleAuthorize = async () => {
    try {
      const result = await connectGoogleFit();
      if (result) {
        toast({
          title: "Google Fit connected!",
          description: "Successfully authorized Google Fit access",
        });
        await loadHealthData();
      }
    } catch (err) {
      console.error('Authorization failed:', err);
      toast({
        title: "Authorization failed",
        description: "Could not connect to Google Fit. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      // For now, just clear local state since Supabase handles the actual sign out
      setHealthData(null);
      toast({
        title: "Disconnected",
        description: "Google Fit has been disconnected",
      });
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const handleSync = async () => {
    await loadHealthData();
  };

  // Calculate progress (assuming daily goals)
  const goals = {
    steps: 10000,
    calories: 500,
    activeMinutes: 30
  };

  const progress = {
    steps: Math.min((healthData?.steps || 0) / goals.steps * 100, 100),
    calories: Math.min((healthData?.caloriesBurned || 0) / goals.calories * 100, 100),
    activeMinutes: Math.min((healthData?.activeMinutes || 0) / goals.activeMinutes * 100, 100)
  };

  if (isSyncing) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Syncing Google Fit data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Google Fit Integration
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge className="bg-green-500">Connected</Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Display */}
        {syncStatus === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600">Failed to sync with Google Fit</span>
          </div>
        )}

        {/* Authorization Section */}
        {!isConnected ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Connect your Google Fit account to automatically sync health data
              </p>
              <Button 
                onClick={handleAuthorize}
                disabled={isSyncing}
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {isSyncing ? 'Connecting...' : 'Connect Google Fit'}
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">What we'll access:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Step count and activity data</li>
                <li>Calories burned (active and resting)</li>
                <li>Heart rate and fitness metrics</li>
                <li>Distance and workout information</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sync Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">Connected to Google Fit</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>

            {/* Last Sync */}
            {lastSync && (
              <div className="text-xs text-muted-foreground">
                Last synced: {lastSync.toLocaleString()}
                {syncStatus === 'success' && (
                  <span className="ml-2 text-green-600">✓</span>
                )}
                {syncStatus === 'error' && (
                  <span className="ml-2 text-red-600">✗</span>
                )}
                {syncStatus === 'pending' && (
                  <span className="ml-2 text-blue-600">⟳</span>
                )}
              </div>
            )}

            {/* Health Data Display */}
            {healthData ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Steps */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Footprints className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Steps</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {healthData.steps.toLocaleString()}
                  </div>
                  <Progress value={progress.steps} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    {Math.round(progress.steps)}% of daily goal
                  </div>
                </div>

                {/* Calories */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Calories</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {Math.round(healthData.caloriesBurned)}
                  </div>
                  <Progress value={progress.calories} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    {Math.round(progress.calories)}% of daily goal
                  </div>
                </div>

                {/* Active Minutes */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Active Min</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {healthData.activeMinutes}
                  </div>
                  <Progress value={progress.activeMinutes} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    {Math.round(progress.activeMinutes)}% of daily goal
                  </div>
                </div>

                {/* Heart Rate */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Heart Rate</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {healthData.heartRateAvg ? Math.round(healthData.heartRateAvg) : 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    BPM
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  No health data available. Try syncing to fetch your latest data.
                </p>
              </div>
            )}

            {/* Data Source Info */}
            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <p className="font-semibold mb-1">Data Source: Google Fit</p>
              <p>Data is synced from your Google Fit account and updated in real-time.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
