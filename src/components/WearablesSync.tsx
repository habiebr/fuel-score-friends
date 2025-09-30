import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Watch, Upload, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHealthKit } from '@/hooks/useHealthKit';
import { Capacitor } from '@capacitor/core';

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
      const fileData = await file.arrayBuffer();
      const base64Data = btoa(
        new Uint8Array(fileData).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const { data, error } = await supabase.functions.invoke('parse-fit-data', {
        body: { fitData: base64Data }
      });

      if (error) throw error;

      setLastSync(new Date());
      toast({
        title: "Data synced successfully!",
        description: `Imported ${data.recordsImported} activity records`,
      });
    } catch (error) {
      console.error('Error uploading .fit file:', error);
      toast({
        title: "Upload failed",
        description: "Failed to process .fit file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Watch className="h-5 w-5 text-primary" />
          Wearables Data Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Garmin Sync */}
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

        {/* Apple Health */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm">Apple Health / Google Fit</h4>
              <p className="text-xs text-muted-foreground">
                {isNative ? (isAuthorized ? 'Connected' : 'Authorize access') : 'Available in mobile app'}
              </p>
            </div>
          </div>
          {isNative ? (
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
                    // Sync to database
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
          ) : (
            <Button variant="secondary" className="w-full" disabled>
              <Watch className="h-4 w-4 mr-2" />
              Build Mobile App First
            </Button>
          )}
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
  );
}
