import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Activity, Download } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function AppIntegrations() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { syncGoogleFit, isSyncing } = useGoogleFitSync();
  const { signInWithGoogle } = useAuth();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [fitnessScreenshotOpen, setFitnessScreenshotOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = async () => {
    try {
      await signInWithGoogle();
      await syncGoogleFit();
      setIsConnected(true);
      toast({
        title: "Google Fit connected",
        description: "Your fitness data will now sync automatically",
      });
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Could not connect to Google Fit",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    toast({
      title: "Google Fit disconnected",
      description: "Your fitness data will no longer sync",
    });
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="w-full mx-auto">
          {/* Header */}
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/profile')}
                className="flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Activity className="w-6 h-6 text-white dark:text-black" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold leading-tight">App Integrations</h1>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* App Integrations Section */}
            <div>
              <h2 className="text-xl font-bold mb-2">App Integrations</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Connect with fitness apps to sync your training data
              </p>

              {/* Google Fit */}
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base">Google Fit</h3>
                      <p className="text-sm text-muted-foreground">
                        {isConnected ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                    <Button
                      onClick={isConnected ? handleDisconnect : handleConnect}
                      disabled={isSyncing}
                      variant={isConnected ? 'destructive' : 'default'}
                      className="flex-shrink-0"
                    >
                      {isSyncing ? 'Syncing...' : isConnected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Privacy & Data Section */}
            <div>
              <h2 className="text-xl font-bold mb-2">Privacy & Data</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Control how your data is used and shared
              </p>

              <Card className="shadow-card">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                    Your nutrition and training data is stored securely and never shared with third parties without your explicit consent. Connected apps only sync the data necessary for providing personalized recommendations.
                  </p>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button className="flex items-center gap-3 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 p-3 rounded-lg transition-colors">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <Download className="w-5 h-5" />
                      </div>
                      <span className="font-medium">Export My Data</span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
      <ActionFAB
        onLogMeal={() => setFoodTrackerOpen(true)}
        onUploadActivity={() => setFitnessScreenshotOpen(true)}
      />
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <FitnessScreenshotDialog open={fitnessScreenshotOpen} onOpenChange={setFitnessScreenshotOpen} />
    </>
  );
}

