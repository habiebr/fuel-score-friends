import { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
// Prefer client-side FIT parsing when available; fall back to server parsing
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type FileProgress = {
  name: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
};

type UploadContextType = {
  uploading: boolean;
  fileProgress: FileProgress[];
  uploadProgress: number;
  startUpload: (files: File[]) => Promise<void>;
};

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploading, setUploading] = useState(false);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const { user, session } = useAuth();

  const startUpload = async (files: File[]) => {
    if (uploading) {
      toast({
        title: "Upload in progress",
        description: "Please wait for the current upload to complete",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload files",
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
          console.log(`Processing file: ${file.name} (${file.size} bytes)`);
          
          const fileData = await file.arrayBuffer();
          const bytes = new Uint8Array(fileData);

          // Try local FIT parsing first via dynamic import (to avoid bundler issues)
          let invokedServer = false;
          try {
            const mod: any = await import(/* @vite-ignore */ '@garmin/fitsdk').catch(() => null);
            const messages = mod?.parse && typeof mod.parse === 'function' ? mod.parse(bytes) : null;

              const sessionsRaw: any[] = Array.isArray((messages as any)?.sessions)
                ? (messages as any).sessions
                : Array.isArray((messages as any)?.session) ? (messages as any).session : [];

              const toInt = (v: any) => v == null ? 0 : Math.round(Number(v));
              const toDate = (v: any) => {
                try { return new Date(v); } catch { return new Date(); }
              };

              const sessions = sessionsRaw.map((s: any) => {
                const rawTs = s?.startTime || s?.start_time || s?.timestamp || s?.time_created || s?.start || Date.now();
                const ts = toDate(rawTs);
                const localDate = new Date(ts.getTime() - ts.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                return {
                  timestamp: ts.toISOString(),
                  date: localDate,
                  activityType: s?.sport || s?.activity || 'activity',
                  totalDistance: toInt(s?.totalDistance || s?.total_distance),
                  totalCalories: toInt(s?.totalCalories || s?.total_calories),
                  avgHeartRate: toInt(s?.avgHeartRate || s?.avg_heart_rate),
                  maxHeartRate: toInt(s?.maxHeartRate || s?.max_heart_rate),
                  duration: toInt(s?.totalTimerTime || s?.total_timer_time || s?.total_elapsed_time),
                  activeMinutes: Math.round(toInt(s?.totalTimerTime || s?.total_timer_time) / 60) || 0,
                  trainingEffect: s?.trainingEffect ?? null,
                  recoveryTime: s?.recoveryTime ?? null,
                };
              });

              if (Array.isArray(sessions) && sessions.length > 0) {
                console.log(`Inserting ${sessions.length} session(s) directly from client for ${file.name}`);
                for (const s of sessions) {
                  const ts = new Date(s.timestamp);
                  const dateStr = new Date(ts.getTime() - ts.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                  const toInt = (v: any) => (v == null ? 0 : Math.round(Number(v)));
                  const row = {
                    user_id: user.id,
                    date: dateStr,
                    calories_burned: toInt(s.totalCalories),
                    active_minutes: Math.max(0, Math.round(toInt(s.duration) / 60)),
                    heart_rate_avg: toInt(s.avgHeartRate),
                    max_heart_rate: toInt(s.maxHeartRate) || null,
                    distance_meters: toInt(s.totalDistance),
                    activity_type: s.activityType || 'activity',
                    training_effect: s.trainingEffect ?? null,
                    recovery_time: s.recoveryTime ?? null,
                    source: 'fit'
                  } as any;
                  const { error: insErr } = await (supabase as any)
                    .from('wearable_data')
                    .insert(row);
                  if (insErr) throw insErr;
                }
                invokedServer = true;
              }
          } catch (e) {
            console.warn('Local FIT parse failed, falling back to server:', e);
          }

          if (!invokedServer) {
            // Fallback: send base64 to server-side parser
            const base64Data = btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));
            console.log(`Calling parse-fit-data function (fallback) for ${file.name}`);
            const { error } = await supabase.functions.invoke('parse-fit-data', {
              body: { fitData: base64Data },
              headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
            });
            if (error) throw error;
          }

          console.log(`Successfully processed ${file.name}`);
          // Update status to success
          setFileProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, status: 'success' } : p
          ));
          successCount++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          
          // Update status to error
          setFileProgress(prev => prev.map((p, idx) => 
            idx === i ? { 
              ...p, 
              status: 'error',
              error: errorMessage
            } : p
          ));
          errorCount++;
        }
      }

      setUploadProgress(100);
      
      // Show summary toast (this will show even if user navigates away)
      if (successCount > 0 && errorCount === 0) {
        toast({
          title: "✅ All files synced successfully!",
          description: `Successfully imported ${successCount} activity file(s)`,
        });
      } else if (successCount > 0 && errorCount > 0) {
        toast({
          title: "⚠️ Partial success",
          description: `${successCount} file(s) imported, ${errorCount} failed`,
          variant: "default",
        });
      } else {
        toast({
          title: "❌ Upload failed",
          description: `Failed to process ${errorCount} file(s)`,
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
      // Clear progress after 10 seconds
      setTimeout(() => {
        setFileProgress([]);
        setUploadProgress(0);
      }, 10000);
    }
  };

  return (
    <UploadContext.Provider value={{ uploading, fileProgress, uploadProgress, startUpload }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
}