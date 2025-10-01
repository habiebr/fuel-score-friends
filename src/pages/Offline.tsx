import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Offline() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-4">
          <div className="mx-auto w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-blue-400" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">You're Offline</h1>
            <p className="text-slate-300">
              It looks like you're not connected to the internet. Check your connection and try again.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Button 
            onClick={handleRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          
          <p className="text-sm text-slate-400">
            Some features may still work offline if you've used them before.
          </p>
        </div>
      </div>
    </div>
  );
}
