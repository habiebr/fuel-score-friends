import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePWA } from '@/hooks/usePWA';

export function PWAUpdateNotification() {
  const { needRefresh, updatePWA, setNeedRefresh } = usePWA();
  const [isVisible, setIsVisible] = useState(true);

  if (!needRefresh || !isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-white">
                Update Available
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                A new version of the app is ready. Update now for the latest features.
              </p>
            </div>
            <div className="flex gap-2 ml-2">
              <Button
                size="sm"
                onClick={updatePWA}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
              >
                Update
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsVisible(false);
                  setNeedRefresh(false);
                }}
                className="text-slate-400 hover:text-white p-1 h-6 w-6"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
