import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Activity, Download, History } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PageHeading } from '@/components/PageHeading';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { StravaConnectButton, StravaDisconnectButton } from '@/components/StravaConnectButton';
import { GoogleFitConnectButton, GoogleFitDisconnectButton } from '@/components/GoogleFitConnectButton';
import { useStravaAuth } from '@/hooks/useStravaAuth';
import { useStravaSync } from '@/hooks/useStravaSync';

export default function AppIntegrations() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { syncGoogleFit, isSyncing, lastSync, connectGoogleFit, syncHistoricalData, isHistoricalSyncing, historicalSyncProgress } = useGoogleFitSync();
  const { signInWithGoogle, getGoogleAccessToken } = useAuth();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [fitnessScreenshotOpen, setFitnessScreenshotOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [syncLabel, setSyncLabel] = useState<string>('');
  
  // Strava integration
  const { isConnected: isStravaConnected, connectStrava, disconnectStrava, checkConnectionStatus } = useStravaAuth();
  const { syncActivities, isSyncing: isStravaSyncing, lastSync: stravaLastSync } = useStravaSync();

  // Handle Strava OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaConnected = params.get('strava_connected');
    const stravaError = params.get('strava_error');

    if (stravaConnected === 'true') {
      toast({
        title: 'Strava Connected',
        description: 'Your Strava account has been successfully connected!',
      });
      // Refresh connection status
      checkConnectionStatus();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (stravaError) {
      toast({
        title: 'Strava Connection Failed',
        description: `Error: ${stravaError.replace(/_/g, ' ')}`,
        variant: 'destructive',
      });
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast, checkConnectionStatus]);

  useEffect(() => {
    (async () => {
      const token = await getGoogleAccessToken();
      setIsConnected(!!token);
    })();
  }, [getGoogleAccessToken]);

  useEffect(() => {
    if (lastSync) {
      setSyncLabel(`Last sync ${new Date(lastSync).toLocaleTimeString()}`);
    }
  }, [lastSync]);

  const handleConnect = async () => {
    try {
      await signInWithGoogle();
      await syncGoogleFit(false); // Show toast for manual connection
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
        <div className="max-w-none mx-auto p-4">
          {/* Header */}
          <div className="mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/profile')}
              className="-ml-2 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black sm:h-12 sm:w-12">
              <Activity className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <PageHeading
              title="App Integrations"
              description="Manage your connected fitness apps and data sync."
              className="!mb-0 flex-1"
            />
          </div>

          {/* Content */}
          <div className="space-y-4">
            {/* App Integrations Section */}
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Connected Apps</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Choose which fitness platforms sync activity to NutriSync.
              </p>

              {/* Google Fit */}
              <Card className="shadow-card">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-200">
                      {/* Google "G" Logo */}
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground">Google Fit</h3>
                      <p className="text-sm text-muted-foreground">
                        {isConnected ? (syncLabel || 'Connected') : 'Daily activity and workouts'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isConnected ? (
                      <>
                        <Button
                          onClick={() => syncGoogleFit(false)}
                          disabled={isSyncing}
                          variant="outline"
                          className="flex-1"
                        >
                          {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                        <GoogleFitDisconnectButton
                          onClick={handleDisconnect}
                          disabled={isSyncing}
                          size="default"
                        />
                      </>
                    ) : (
                      <GoogleFitConnectButton
                        onClick={handleConnect}
                        variant="blue"
                        size="default"
                        className="w-full"
                      />
                    )}
                  </div>

                  {/* Historical Sync */}
                  {isConnected && (
                    <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-muted">
                      <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        <div className="text-sm">
                          <div className="font-semibold text-foreground">Backfill Historical Data</div>
                          <div className="text-xs text-muted-foreground">
                            Sync past activity to see your full history
                          </div>
                        </div>
                      </div>
                      
                      {isHistoricalSyncing && historicalSyncProgress ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Syncing... {historicalSyncProgress.syncedDays}/{historicalSyncProgress.totalDays} days
                            </span>
                            <span className="text-primary font-medium">
                              {Math.round((historicalSyncProgress.syncedDays / historicalSyncProgress.totalDays) * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-primary h-full transition-all duration-300"
                              style={{ 
                                width: `${(historicalSyncProgress.syncedDays / historicalSyncProgress.totalDays) * 100}%` 
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isHistoricalSyncing}
                            onClick={() => syncHistoricalData(7)}
                            className="flex-1"
                          >
                            7 days
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={isHistoricalSyncing}
                            onClick={() => syncHistoricalData(30)}
                            className="flex-1"
                          >
                            30 days
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isHistoricalSyncing}
                            onClick={() => syncHistoricalData(90)}
                            className="flex-1"
                          >
                            90 days
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PWA Install - placed under integrations */}
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">Install NutriSync as an app</div>
                      <PWAInstallButton size="sm" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Strava */}
              <Card className="shadow-card mt-4">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#FC5200] rounded-full flex items-center justify-center flex-shrink-0">
                      {/* Strava Logo */}
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path 
                          d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" 
                          fill="white"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground">Strava</h3>
                      <p className="text-sm text-muted-foreground">
                        {isStravaConnected 
                          ? (stravaLastSync ? `Last sync ${new Date(stravaLastSync).toLocaleTimeString()}` : 'Connected') 
                          : 'Track runs, rides, and workouts'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isStravaConnected ? (
                      <>
                        <Button
                          onClick={() => syncActivities()}
                          disabled={isStravaSyncing}
                          variant="outline"
                          className="flex-1"
                        >
                          {isStravaSyncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                        <StravaDisconnectButton
                          onClick={async () => {
                            await disconnectStrava();
                            toast({
                              title: "Strava disconnected",
                              description: "Your Strava activities will no longer sync",
                            });
                          }}
                          disabled={isStravaSyncing}
                          size="default"
                        />
                      </>
                    ) : (
                      <StravaConnectButton
                        onClick={() => {
                          connectStrava();
                        }}
                        variant="orange"
                        size="default"
                        className="w-full"
                      />
                    )}
                  </div>

                  {isStravaConnected && (
                    <div className="pt-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Activity className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          Strava provides detailed activity data including GPS tracks, heart rate zones, power metrics, and elevation profiles for comprehensive training analysis.
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Privacy & Data Section */}
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Privacy & Data</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Control how your data is used and shared
              </p>

              <Card className="shadow-card">
                <CardContent className="p-6">
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
