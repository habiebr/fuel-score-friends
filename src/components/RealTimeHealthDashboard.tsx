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
  Wifi, 
  WifiOff,
  RefreshCw,
  TrendingUp,
  Target,
  Zap
} from 'lucide-react';
import { useHealthSync } from '@/hooks/useHealthSync';
import { useHealthKit } from '@/hooks/useHealthKit';
import { usePWA } from '@/hooks/usePWA';
import { useToast } from '@/hooks/use-toast';

interface HealthMetrics {
  steps: number;
  calories: number;
  activeMinutes: number;
  heartRate: number;
  distance: number;
}

interface DailyGoals {
  steps: number;
  calories: number;
  activeMinutes: number;
}

export function RealTimeHealthDashboard() {
  const { healthData, syncStatus, isLoading, syncHealthData, updateManualData } = useHealthSync();
  const { isAvailable: isHealthKitAvailable, isAuthorized: isHealthKitAuthorized } = useHealthKit();
  const { isOnline } = usePWA();
  const { toast } = useToast();
  
  const [goals, setGoals] = useState<DailyGoals>({
    steps: 10000,
    calories: 500,
    activeMinutes: 30
  });
  
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isAutoSync, setIsAutoSync] = useState(true);

  // Auto-sync every 5 minutes when online
  useEffect(() => {
    if (!isAutoSync || !isOnline) return;

    const interval = setInterval(() => {
      syncHealthData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isAutoSync, isOnline, syncHealthData]);

  // Update last update time
  useEffect(() => {
    if (healthData) {
      setLastUpdate(new Date());
    }
  }, [healthData]);

  // Calculate progress percentages
  const progress = {
    steps: Math.min((healthData?.steps || 0) / goals.steps * 100, 100),
    calories: Math.min((healthData?.calories || 0) / goals.calories * 100, 100),
    activeMinutes: Math.min((healthData?.activeMinutes || 0) / goals.activeMinutes * 100, 100)
  };

  // Calculate remaining values
  const remaining = {
    steps: Math.max(goals.steps - (healthData?.steps || 0), 0),
    calories: Math.max(goals.calories - (healthData?.calories || 0), 0),
    activeMinutes: Math.max(goals.activeMinutes - (healthData?.activeMinutes || 0), 0)
  };

  // Handle manual data update
  const handleManualUpdate = async (metric: keyof HealthMetrics, value: number) => {
    await updateManualData({ [metric]: value });
  };

  // Handle sync
  const handleSync = async () => {
    await syncHealthData(true);
  };

  // Get status color
  const getStatusColor = (progress: number) => {
    if (progress >= 100) return 'text-green-500';
    if (progress >= 75) return 'text-yellow-500';
    if (progress >= 50) return 'text-blue-500';
    return 'text-gray-500';
  };

  // Get status badge
  const getStatusBadge = (progress: number) => {
    if (progress >= 100) return <Badge className="bg-green-500">Complete</Badge>;
    if (progress >= 75) return <Badge className="bg-yellow-500">Almost There</Badge>;
    if (progress >= 50) return <Badge className="bg-blue-500">Good Progress</Badge>;
    return <Badge variant="secondary">Getting Started</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Real-Time Health Dashboard</h2>
          <p className="text-muted-foreground">
            {isOnline ? 'Live tracking enabled' : 'Offline mode - data will sync when online'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-500" />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600">Offline</span>
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {lastUpdate && `Last update: ${lastUpdate.toLocaleTimeString()}`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Steps */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4" />
                Steps
              </div>
              {getStatusBadge(progress.steps)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {(healthData?.steps || 0).toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {goals.steps.toLocaleString()}
                </span>
              </div>
              <Progress value={progress.steps} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress.steps)}% complete</span>
                <span>{remaining.steps.toLocaleString()} remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4" />
                Calories Burned
              </div>
              {getStatusBadge(progress.calories)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {Math.round(healthData?.calories || 0)}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {goals.calories}
                </span>
              </div>
              <Progress value={progress.calories} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress.calories)}% complete</span>
                <span>{remaining.calories} remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Minutes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Active Minutes
              </div>
              {getStatusBadge(progress.activeMinutes)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {healthData?.activeMinutes || 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {goals.activeMinutes}
                </span>
              </div>
              <Progress value={progress.activeMinutes} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress.activeMinutes)}% complete</span>
                <span>{remaining.activeMinutes} remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Heart Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4" />
              Heart Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {healthData?.heartRate || 0}
              </div>
              <div className="text-xs text-muted-foreground">BPM</div>
            </div>
          </CardContent>
        </Card>

        {/* Distance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" />
              Distance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {(healthData?.distance || 0).toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">km</div>
            </div>
          </CardContent>
        </Card>

        {/* Data Source */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4" />
              Data Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-2">
              <Badge variant="outline">
                {healthData?.source === 'google_fit' ? 'Google Fit' : 
                 healthData?.source === 'apple_health' ? 'Apple Health' : 'Manual'}
              </Badge>
              {isHealthKitAvailable && (
                <div className="text-xs text-muted-foreground">
                  {isHealthKitAuthorized ? 'Apple Health Connected' : 'Apple Health Available'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status */}
      {syncStatus.error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <WifiOff className="h-4 w-4" />
              <span className="text-sm">Sync Error: {syncStatus.error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleManualUpdate('steps', (healthData?.steps || 0) + 1000)}
            >
              +1K Steps
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleManualUpdate('calories', (healthData?.calories || 0) + 50)}
            >
              +50 Calories
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleManualUpdate('activeMinutes', (healthData?.activeMinutes || 0) + 5)}
            >
              +5 Min
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAutoSync(!isAutoSync)}
            >
              {isAutoSync ? 'Disable' : 'Enable'} Auto-Sync
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
