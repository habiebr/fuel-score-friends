import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Watch, Upload, CheckCircle, AlertCircle, Smartphone, FileCheck, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHealthKit } from '@/hooks/useHealthKit';
import { Capacitor } from '@capacitor/core';
import { AppleHealthSync } from './AppleHealthSync';

type FileProgress = {
  name: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
};

export function WearablesSync() {
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const { isAvailable, isAuthorized, requestAuthorization, fetchTodayData } = useHealthKit();
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

    setUploading(true);
    const fileArray = Array.from(files);
    const progress: FileProgress[] = fileArray.map(f => ({
      name: f.name,
      status: 'pending'
    }));
    setFileProgress(progress);

    let successCount = 0;
    let errorCount = 0;
    const totalFiles = fileArray.length;

    try {
      // Process files sequentially to avoid overwhelming the server
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        // Update status to uploading
        setFileProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, status: 'uploading' } : p
        ));
        setUploadProgress(Math.round((i / totalFiles) * 100));

        try {
          const fileData = await file.arrayBuffer();
          const base64Data = btoa(
            new Uint8Array(fileData).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );

          const { data, error } = await supabase.functions.invoke('parse-fit-data', {
            body: { fitData: base64Data }
          });

          if (error) throw error;

          // Update status to success
          setFileProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, status: 'success' } : p
          ));
          successCount++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          // Update status to error
          setFileProgress(prev => prev.map((p, idx) => 
            idx === i ? { 
              ...p, 
              status: 'error',
              error: error instanceof Error ? error.message : 'Upload failed'
            } : p
          ));
          errorCount++;
        }
      }

      setUploadProgress(100);
      setLastSync(new Date());
      
      // Show summary toast
      if (successCount > 0 && errorCount === 0) {
        toast({
          title: "All files synced successfully!",
          description: `Successfully imported ${successCount} activity file(s)`,
        });
      } else if (successCount > 0 && errorCount > 0) {
        toast({
          title: "Partial success",
          description: `${successCount} file(s) imported, ${errorCount} failed`,
          variant: "default",
        });
      } else {
        toast({
          title: "Upload failed",
          description: `Failed to process ${errorCount} file(s)`,
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
      event.target.value = '';
      // Clear progress after 5 seconds
      setTimeout(() => {
        setFileProgress([]);
        setUploadProgress(0);
      }, 5000);
    }
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

          {/* Upload Progress */}
          {uploading && fileProgress.length > 0 && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Uploading {fileProgress.length} file(s)</span>
                <span className="text-muted-foreground">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {fileProgress.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    {file.status === 'pending' && (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground animate-pulse" />
                    )}
                    {file.status === 'uploading' && (
                      <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    )}
                    {file.status === 'success' && (
                      <FileCheck className="h-4 w-4 text-success" />
                    )}
                    {file.status === 'error' && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className={`flex-1 truncate ${
                      file.status === 'error' ? 'text-destructive' : 
                      file.status === 'success' ? 'text-success' : 
                      'text-muted-foreground'
                    }`}>
                      {file.name}
                    </span>
                    {file.error && (
                      <span className="text-destructive text-xs">{file.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
