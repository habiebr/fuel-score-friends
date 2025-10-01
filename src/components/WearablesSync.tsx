import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Watch, Upload, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHealthKit } from '@/hooks/useHealthKit';
import { Capacitor } from '@capacitor/core';
import { AppleHealthSync } from './AppleHealthSync';
import { GoogleFitIntegration } from './GoogleFitIntegration';
import { useUpload } from '@/contexts/UploadContext';

export function WearablesSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();
  const { isAvailable, isAuthorized, requestAuthorization, fetchTodayData } = useHealthKit();
  const { uploading, startUpload } = useUpload();
  const isNative = Capacitor.isNativePlatform();

  const handleFitFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate all files are .fit
    const invalidFiles = Array.from(files).filter(f => !f.name.endsWith('.fit'));
    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: `${invalidFiles.length} file(s) are not .fit files. Only .fit files are accepted.`,
        variant: "destructive",
      });
      return;
    }

    // Start the upload via context
    await startUpload(Array.from(files));
    setLastSync(new Date());
    event.target.value = '';
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
                <p className="text-xs text-muted-foreground">Upload single or multiple .fit files</p>
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
                  {uploading ? 'Uploading...' : 'Upload .fit Files (Bulk)'}
                </span>
              </Button>
              <input
                id="fit-upload"
                type="file"
                accept=".fit"
                multiple
                className="hidden"
                onChange={handleFitFileUpload}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Last Sync Status */}
          {lastSync && !uploading && (
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
                <li>Go to Activities → Select activity(ies)</li>
                <li>Export as .fit file(s)</li>
                <li>Upload here (supports bulk upload)</li>
              </ol>
              <p className="mt-2 text-info font-medium">💡 Progress persists across pages!</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Fit Integration */}
      <GoogleFitIntegration />

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
