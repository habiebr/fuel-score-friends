import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Watch, Upload, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHealthKit } from '@/hooks/useHealthKit';
import { Capacitor } from '@capacitor/core';
import { AppleHealthSync } from './AppleHealthSync';

export function WearablesSync() {
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();
  const { isAvailable, isAuthorized, requestAuthorization, fetchTodayData } = useHealthKit();
  const isNative = Capacitor.isNativePlatform();

  const handleFitFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.fit')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a .fit file from your Garmin device",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Dynamically import the FIT parser to avoid bundling issues
      const fileData = await file.arrayBuffer();
      const FitParser = (await import('fit-file-parser')).default;
      
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'km/h',
        lengthUnit: 'km',
        temperatureUnit: 'celsius',
        elapsedRecordField: true,
        mode: 'both'
      });

      // Parse the file
      fitParser.parse(fileData, async (error: any, data: any) => {
        if (error) {
          console.error('FIT parsing error:', error);
          toast({
            title: "Parsing failed",
            description: "Failed to parse .fit file. The file may be corrupted.",
            variant: "destructive",
          });
          setUploading(false);
          event.target.value = '';
          return;
        }

        console.log('Parsed FIT data:', data);

        // Extract rich data from parsed file
        const activityData = extractActivityData(data);
        
        // Send parsed data to backend
        const { error: invokeError } = await supabase.functions.invoke('parse-fit-data', {
          body: { parsedData: activityData }
        });

        if (invokeError) throw invokeError;

        setLastSync(new Date());
        toast({
          title: "Data synced successfully!",
          description: `Imported ${activityData.sessions.length} activity sessions with detailed metrics`,
        });
        
        setUploading(false);
        event.target.value = '';
      });
    } catch (error) {
      console.error('Error uploading .fit file:', error);
      toast({
        title: "Upload failed",
        description: "Failed to process .fit file. Please try again.",
        variant: "destructive",
      });
      setUploading(false);
      event.target.value = '';
    }
  };

  // Extract rich activity data from parsed FIT file
  const extractActivityData = (fitData: any) => {
    const sessions: any[] = [];
    const records: any[] = [];
    const gpsPoints: any[] = [];
    
    // Extract session data (overall activity summary)
    if (fitData.sessions && fitData.sessions.length > 0) {
      fitData.sessions.forEach((session: any) => {
        sessions.push({
          timestamp: session.start_time || session.timestamp,
          activityType: session.sport || session.sub_sport || 'unknown',
          totalDistance: session.total_distance || 0,
          totalCalories: session.total_calories || 0,
          avgHeartRate: session.avg_heart_rate || 0,
          maxHeartRate: session.max_heart_rate || 0,
          avgCadence: session.avg_cadence || 0,
          avgPower: session.avg_power || 0,
          maxSpeed: session.max_speed || 0,
          totalAscent: session.total_ascent || 0,
          duration: session.total_elapsed_time || 0,
          activeMinutes: Math.round((session.total_timer_time || 0) / 60)
        });
      });
    }

    // Extract detailed record data (time-series data points)
    if (fitData.records && fitData.records.length > 0) {
      fitData.records.forEach((record: any) => {
        records.push({
          timestamp: record.timestamp,
          heartRate: record.heart_rate,
          cadence: record.cadence,
          speed: record.speed,
          power: record.power,
          altitude: record.altitude,
          distance: record.distance
        });

        // Collect GPS data if available
        if (record.position_lat && record.position_long) {
          gpsPoints.push({
            lat: record.position_lat,
            lng: record.position_long,
            altitude: record.altitude,
            timestamp: record.timestamp
          });
        }
      });
    }

    // Calculate heart rate zones if we have HR data
    const heartRateZones = calculateHeartRateZones(records);

    return {
      sessions,
      records,
      gpsPoints,
      heartRateZones,
      totalRecords: records.length
    };
  };

  // Calculate time spent in different heart rate zones
  const calculateHeartRateZones = (records: any[]) => {
    const zones = {
      zone1: 0, // < 114 bpm (recovery)
      zone2: 0, // 114-133 (endurance)
      zone3: 0, // 133-152 (tempo)
      zone4: 0, // 152-171 (threshold)
      zone5: 0  // > 171 (max)
    };

    records.forEach(record => {
      const hr = record.heartRate;
      if (!hr) return;

      if (hr < 114) zones.zone1++;
      else if (hr < 133) zones.zone2++;
      else if (hr < 152) zones.zone3++;
      else if (hr < 171) zones.zone4++;
      else zones.zone5++;
    });

    // Convert to minutes (assuming 1 record per second)
    return {
      zone1: Math.round(zones.zone1 / 60),
      zone2: Math.round(zones.zone2 / 60),
      zone3: Math.round(zones.zone3 / 60),
      zone4: Math.round(zones.zone4 / 60),
      zone5: Math.round(zones.zone5 / 60)
    };
  };

  return (
    <div className="space-y-4">
      {/* Garmin Sync */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Watch className="h-5 w-5 text-primary" />
            Garmin / Wearables
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm">Garmin Connect</h4>
                <p className="text-xs text-muted-foreground">Upload .fit files from your device</p>
              </div>
            </div>
            <label htmlFor="fit-upload">
              <Button 
                variant="secondary" 
                className="w-full" 
                disabled={uploading}
                asChild
              >
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload .fit File'}
                </span>
              </Button>
              <input
                id="fit-upload"
                type="file"
                accept=".fit"
                className="hidden"
                onChange={handleFitFileUpload}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Last Sync Status */}
          {lastSync && (
            <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-xs text-success">
                Last synced: {lastSync.toLocaleString()}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-info/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-info mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Export from Garmin:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open Garmin Connect app/website</li>
                <li>Go to Activities → Select activity</li>
                <li>Export as .fit file</li>
                <li>Upload here</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apple Health for PWA */}
      {!isNative && <AppleHealthSync />}

      {/* Native Health Sync */}
      {isNative && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Native Health Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">Apple Health / Google Fit</h4>
                  <p className="text-xs text-muted-foreground">
                    {isAuthorized ? 'Connected' : 'Authorize access'}
                  </p>
                </div>
              </div>
              <Button 
                variant={isAuthorized ? "outline" : "secondary"} 
                className="w-full"
                onClick={async () => {
                  if (!isAuthorized) {
                    await requestAuthorization();
                  } else {
                    setSyncing(true);
                    const data = await fetchTodayData();
                    if (data) {
                      toast({
                        title: "Health data synced!",
                        description: "Your wearable data has been updated",
                      });
                      setLastSync(new Date());
                    }
                    setSyncing(false);
                  }
                }}
                disabled={syncing}
              >
                <Smartphone className="h-4 w-4 mr-2" />
                {syncing ? 'Syncing...' : (isAuthorized ? 'Sync Now' : 'Authorize')}
              </Button>
            </div>

            {lastSync && (
              <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-xs text-success">
                  Last synced: {lastSync.toLocaleString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
