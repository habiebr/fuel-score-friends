import { useUpload } from '@/contexts/UploadContext';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FileCheck, XCircle, Upload } from 'lucide-react';

export function GlobalUploadIndicator() {
  const { uploading, fileProgress, uploadProgress } = useUpload();

  if (!uploading && fileProgress.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 w-80 animate-fade-in">
      <Card className="premium-card shadow-lg border-primary/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary animate-pulse" />
              <span className="font-medium">
                {uploading ? 'Uploading...' : 'Upload Complete'}
              </span>
            </div>
            <span className="text-muted-foreground">{uploadProgress}%</span>
          </div>
          
          <Progress value={uploadProgress} className="h-2" />
          
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {fileProgress.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                {file.status === 'pending' && (
                  <div className="h-3 w-3 rounded-full border-2 border-muted-foreground animate-pulse" />
                )}
                {file.status === 'uploading' && (
                  <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                )}
                {file.status === 'success' && (
                  <FileCheck className="h-3 w-3 text-success" />
                )}
                {file.status === 'error' && (
                  <XCircle className="h-3 w-3 text-destructive" />
                )}
                <span className={`flex-1 truncate ${
                  file.status === 'error' ? 'text-destructive' : 
                  file.status === 'success' ? 'text-success' : 
                  'text-muted-foreground'
                }`}>
                  {file.name}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}