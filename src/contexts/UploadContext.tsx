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
          
          // Only support screenshot uploads analyzed by AI (no FIT files)
          if (!file.type.startsWith('image/')) {
            throw new Error('Only image uploads are supported for activity screenshots');
          }

          // Upload to Storage and analyze via analyze-fitness-screenshot
          const userId = user.id;
          const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
          const path = `${userId}/fitness-screenshots/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const bucket = supabase.storage.from('fitness-screenshots');
          const uploadRes = await bucket.upload(path, file, { upsert: true, contentType: file.type });
          if (uploadRes.error) throw uploadRes.error;
          const signed = await bucket.createSignedUrl(path, 600);
          if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error('Failed to create signed URL');

          const { data, error } = await supabase.functions.invoke('analyze-fitness-screenshot', {
            body: {
              image: signed.data.signedUrl
            },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          });
          if (error) throw error;
          console.log(`Screenshot analyzed and saved:`, data);

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