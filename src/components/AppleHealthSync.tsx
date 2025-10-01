import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Apple, Upload, CheckCircle, AlertCircle, Info, RefreshCw, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHealthKit } from '@/hooks/useHealthKit';
import { useToast } from '@/hooks/use-toast';
import { HealthPermissionsDialog } from './HealthPermissionsDialog';

export function AppleHealthSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    isAvailable, 
    isAuthorized, 
    permissions, 
    fetchTodayData, 
    fetchHistoricalData 
  } = useHealthKit();
  const [uploading, setUploading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Auto-sync when component mounts if authorized
  useEffect(() => {
    if (isAuthorized && isAvailable) {
      handleRealTimeSync();
    }
  }, [isAuthorized, isAvailable]);

  const handleRealTimeSync = async () => {
    if (!isAuthorized || !isAvailable) {
      toast({
        title: "Not Authorized",
        description: "Please connect to Apple Health first",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const todayData = await fetchTodayData();
      const historicalData = await fetchHistoricalData(7);

      if (todayData) {
        // Save today's data
        const { error: todayError } = await supabase
          .from('wearable_data')
          .upsert({
            user_id: user?.id,
            date: todayData.date,
            steps: todayData.steps,
            calories_burned: todayData.calories,
            active_minutes: todayData.activeMinutes,
            heart_rate_avg: todayData.heartRate,
            distance_km: todayData.distance,
            source: todayData.source
          }, {
            onConflict: 'user_id,date'
          });

        if (todayError) throw todayError;
      }

      // Save historical data
      if (historicalData.length > 0) {
        const historicalRecords = historicalData.map(data => ({
          user_id: user?.id,
          date: data.date,
          steps: data.steps,
          calories_burned: data.calories,
          active_minutes: data.activeMinutes,
          heart_rate_avg: data.heartRate,
          distance_km: data.distance,
          source: data.source
        }));

        const { error: historicalError } = await supabase
          .from('wearable_data')
          .upsert(historicalRecords, {
            onConflict: 'user_id,date'
          });

        if (historicalError) throw historicalError;
      }

      setLastSync(new Date());
      toast({
        title: "Apple Health Synced!",
        description: `Successfully synced ${todayData ? 'today\'s data' : 'historical data'} from Apple Health`,
      });
    } catch (error) {
      console.error('Error syncing Apple Health:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync data from Apple Health",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAppleHealthXML = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Apple Health export XML file",
        variant: "destructive",
      });
      return;
    }

    // Check file size (warn if > 200MB)
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please use a smaller export or the mobile app for very large files (max 200MB)",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      
      // Check for parsing errors
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Invalid XML format');
      }
      
      // Extract health records
      const records = Array.from(xmlDoc.querySelectorAll('Record'));
      const workouts = Array.from(xmlDoc.querySelectorAll('Workout'));
      
      let totalSteps = 0;
      let totalCalories = 0;
      let heartRateSum = 0;
      let heartRateCount = 0;
      let activeMinutes = 0;
      
      // Process records in chunks to avoid blocking UI
      const CHUNK_SIZE = 100;
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        
        // Process chunk
        chunk.forEach(record => {
          const type = record.getAttribute('type');
          const value = parseFloat(record.getAttribute('value') || '0');
          
          if (type?.includes('StepCount')) {
            totalSteps += value;
          } else if (type?.includes('ActiveEnergyBurned')) {
            totalCalories += value;
          } else if (type?.includes('HeartRate')) {
            heartRateSum += value;
            heartRateCount++;
          }
        });
        
        // Yield to UI thread every chunk
        if (i + CHUNK_SIZE < records.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // Parse workouts
      workouts.forEach(workout => {
        const duration = parseFloat(workout.getAttribute('duration') || '0');
        const calories = parseFloat(workout.getAttribute('totalEnergyBurned') || '0');
        
        activeMinutes += Math.floor(duration / 60);
        totalCalories += calories;
      });
      
      // Save to database
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('wearable_data')
        .upsert({
          user_id: user?.id,
          date: today,
          steps: Math.round(totalSteps),
          calories_burned: Math.round(totalCalories),
          active_minutes: activeMinutes,
          heart_rate_avg: heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : 0,
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;

      setLastSync(new Date());
      toast({
        title: "Apple Health data synced!",
        description: `Imported ${records.length} records and ${workouts.length} workouts`,
      });
    } catch (error) {
      console.error('Error parsing Apple Health XML:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Upload failed",
        description: errorMessage.includes('Invalid XML') 
          ? "Invalid XML format. Please upload a valid Apple Health export."
          : "Failed to parse Apple Health data. Try a smaller date range export.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Apple className="h-5 w-5 text-foreground" />
              Apple Health
            </div>
            <div className="flex items-center gap-2">
              {isAvailable && (
                <Badge variant={isAuthorized ? 'default' : 'secondary'}>
                  {isAuthorized ? 'Connected' : 'Not Connected'}
                </Badge>
              )}
              {isAvailable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPermissions(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Real-time Sync Section */}
          {isAvailable && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Real-time Sync</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRealTimeSync}
                  disabled={!isAuthorized || isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
              
              {!isAuthorized ? (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700">
                    Connect to Apple Health to enable real-time sync
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPermissions(true)}
                    className="ml-auto"
                  >
                    Connect
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700">
                    Connected to Apple Health - data syncs automatically
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Manual Upload Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Manual Upload (PWA)</h4>
            <div className="flex items-start gap-2 p-3 bg-info/10 rounded-lg">
              <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-2">How to export from Apple Health:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Health app on iPhone</li>
                  <li>Tap profile picture (top right)</li>
                  <li>Scroll down, tap "Export All Health Data"</li>
                  <li>Share the export.zip file to this device</li>
                  <li>Extract export.xml and upload here</li>
                </ol>
              </div>
            </div>
          </div>

        {/* Upload Button */}
        <label htmlFor="apple-health-xml">
          <Button 
            variant="secondary" 
            className="w-full" 
            disabled={uploading}
            asChild
          >
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Processing...' : 'Upload export.xml'}
            </span>
          </Button>
          <input
            id="apple-health-xml"
            type="file"
            accept=".xml"
            className="hidden"
            onChange={handleAppleHealthXML}
            disabled={uploading}
          />
        </label>

        {/* Last Sync Status */}
        {lastSync && (
          <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-xs text-success">
              Last synced: {lastSync.toLocaleString()}
            </span>
          </div>
        )}

          {/* Note */}
          <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {isAvailable 
                ? "Real-time sync is available on mobile devices. Manual upload works on all platforms."
                : "This imports data from your Apple Health export XML. For real-time sync, use the mobile app."
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Permissions Dialog */}
      <HealthPermissionsDialog
        open={showPermissions}
        onOpenChange={setShowPermissions}
        onComplete={() => {
          setShowPermissions(false);
          handleRealTimeSync();
        }}
      />
    </>
  );
}
