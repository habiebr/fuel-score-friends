import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
// WearablePerformanceGraph removed - using Google Fit data now
import { BodyMetricsForm } from '@/components/BodyMetricsForm';
import { LogOut, User, Target, Activity as ActivityIcon, Download, TrendingUp, Flame, Heart, Zap, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PageHeading } from '@/components/PageHeading';

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [nutritionData, setNutritionData] = useState<any[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { toast } = useToast();
  const [refreshMode, setRefreshMode] = useState<string>('daily_6am');
  const [timezone, setTimezone] = useState<string>('UTC');

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
      navigate('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign out failed",
        description: "There was an error signing out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (user) {
      loadActivityData();
      loadRefreshSettings();
    }
  }, [user]);
  const loadRefreshSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('meal_plan_refresh_mode, timezone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!error && data) {
        if (data.meal_plan_refresh_mode) setRefreshMode(data.meal_plan_refresh_mode);
        if (data.timezone) setTimezone(data.timezone);
      }
    } catch (e) {
      // noop
    }
  };

  const saveRefreshSettings = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ meal_plan_refresh_mode: refreshMode, timezone })
      .eq('user_id', user.id);
    if (error) {
      toast({ title: 'Failed to save', description: 'Could not save refresh settings', variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Refresh settings updated' });
    }
  };


  const loadActivityData = async () => {
    if (!user) return;

    try {
      // Get last 7 days of data
      const endDate = new Date();
      const startDate = subDays(endDate, 6);

      const { data: googleFitData } = await supabase
        .from('google_fit_data')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      const { data: nutritionDataRes } = await supabase
        .from('nutrition_scores')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      // Format data for charts (Google Fit)
      const formattedActivity = ((googleFitData as any[]) || []).map((d: any) => ({
        date: format(new Date(d.date), 'MMM dd'),
        steps: d.steps,
        calories: d.calories_burned,
        activeMinutes: d.active_minutes,
        heartRate: d.heart_rate_avg
      }));

      const formattedNutrition = (nutritionDataRes || []).map(d => ({
        date: format(new Date(d.date), 'MMM dd'),
        calories: d.calories_consumed,
        protein: d.protein_grams,
        carbs: d.carbs_grams,
        fat: d.fat_grams,
        score: d.daily_score
      }));

      setActivityData(formattedActivity);
      setNutritionData(formattedNutrition);
    } catch (error) {
      console.error('Error loading activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast({
        title: "App installed!",
        description: "You can now use Nutrisync from your home screen.",
      });
      setIsInstallable(false);
    }

    setDeferredPrompt(null);
  };

  return (
    <>
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4">
          {/* Premium Header */}
          <PageHeading
            title="Profile"
            description={user?.email || 'Manage your NutriSync account.'}
            actions={
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="hover:bg-destructive/10 hover:text-destructive"
                title="Sign out"
              >
                <LogOut className={`h-5 w-5 ${isLoggingOut ? 'animate-spin' : ''}`} />
              </Button>
            }
            className="mb-6"
          />

          {/* Premium Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="premium-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-6 text-center">
                <User className="h-6 w-6 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold text-foreground">0</div>
                <div className="text-xs text-muted-foreground">Days</div>
              </CardContent>
            </Card>
            <Card className="premium-card bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20">
              <CardContent className="p-6 text-center">
                <Target className="h-6 w-6 mx-auto mb-2 text-secondary" />
                <div className="text-2xl font-bold text-foreground">0</div>
                <div className="text-xs text-muted-foreground">Score</div>
              </CardContent>
            </Card>
            <Card className="premium-card bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
              <CardContent className="p-6 text-center">
                <Flame className="h-6 w-6 mx-auto mb-2 text-accent" />
                <div className="text-2xl font-bold text-foreground">0</div>
                <div className="text-xs text-muted-foreground">Meals</div>
              </CardContent>
            </Card>
          </div>

          {/* Google Fit Sync Section */}
          <Card className="premium-card mb-6 bg-gradient-to-br from-primary/5 to-primary-glow/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">Google Fit Integration</h3>
                  <p className="text-sm text-muted-foreground">Sync your activity data automatically</p>
                </div>
                <Button 
                  variant="default" 
                  onClick={() => navigate('/profile/integrations')}
                  className="premium-button"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Connect
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Body Metrics */}
          <div className="mb-6">
            <BodyMetricsForm />
          </div>

          {/* Goals Section */}
          <Card className="premium-card mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg mb-1">Training Goals</h3>
                  <p className="text-sm text-muted-foreground">Set your fitness objectives</p>
                </div>
                <Button 
                  variant="default" 
                  onClick={() => navigate('/goals')}
                  className="premium-button"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Set Goals
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Meal Plan Refresh Settings */}
          <Card className="premium-card mb-6">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Meal Plan Refresh</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Refresh cadence</Label>
                  <Select value={refreshMode} onValueChange={setRefreshMode}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select refresh mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily_6am">Daily at 6:00 (user timezone)</SelectItem>
                      <SelectItem value="every_15m">Every 15 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Timezone</Label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g., Asia/Jakarta" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveRefreshSettings} className="premium-button">Save</Button>
              </div>
            </CardContent>
          </Card>

          {/* Google Fit Activity Metrics */}
          <div className="mb-6">
            {/* Google Fit performance graph will be integrated here */}
          </div>

          {/* Activity Metrics with Premium Tabs */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">Activity Metrics</h2>
            
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Zap className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="performance" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Heart className="h-4 w-4 mr-2" />
                  Performance
                </TabsTrigger>
                <TabsTrigger value="nutrition" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Flame className="h-4 w-4 mr-2" />
                  Nutrition
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <Card className="premium-card overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/10 to-primary-glow/10 p-4 border-b">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ActivityIcon className="h-5 w-5 text-primary" />
                      Daily Steps
                      <span className="ml-auto text-sm font-normal text-muted-foreground">Last 7 Days</span>
                    </CardTitle>
                  </div>
                  <CardContent className="pt-6">
                    {loading ? (
                      <div className="h-[220px] flex items-center justify-center">
                        <div className="animate-pulse text-muted-foreground">Loading data...</div>
                      </div>
                    ) : activityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={activityData}>
                          <defs>
                            <linearGradient id="stepsGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis dataKey="date" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="steps" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={3}
                            fill="url(#stepsGradient)"
                            dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex flex-col items-center justify-center">
                        <ActivityIcon className="h-12 w-12 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No activity data yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Performance Tab */}
              <TabsContent value="performance" className="space-y-4">
                <Card className="premium-card overflow-hidden">
                  <div className="bg-gradient-to-r from-secondary/10 to-secondary/20 p-4 border-b">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="h-5 w-5 text-secondary" />
                      Calories Burned
                      <span className="ml-auto text-sm font-normal text-muted-foreground">Weekly</span>
                    </CardTitle>
                  </div>
                  <CardContent className="pt-6">
                    {loading ? (
                      <div className="h-[220px] flex items-center justify-center">
                        <div className="animate-pulse text-muted-foreground">Loading data...</div>
                      </div>
                    ) : activityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={activityData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis dataKey="date" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }} 
                          />
                          <Bar 
                            dataKey="calories" 
                            fill="hsl(var(--secondary))" 
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex flex-col items-center justify-center">
                        <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No performance data yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="premium-card overflow-hidden">
                  <div className="bg-gradient-to-r from-accent/10 to-accent/20 p-4 border-b">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Heart className="h-5 w-5 text-accent" />
                      Heart Rate Trends
                    </CardTitle>
                  </div>
                  <CardContent className="pt-6">
                    {loading ? (
                      <div className="h-[220px] flex items-center justify-center">
                        <div className="animate-pulse text-muted-foreground">Loading data...</div>
                      </div>
                    ) : activityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={activityData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis dataKey="date" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="heartRate" 
                            stroke="hsl(var(--accent))" 
                            strokeWidth={3}
                            dot={{ fill: 'hsl(var(--accent))', r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex flex-col items-center justify-center">
                        <Heart className="h-12 w-12 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No heart rate data yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Nutrition Tab */}
              <TabsContent value="nutrition" className="space-y-4">
                <Card className="premium-card overflow-hidden">
                  <div className="bg-gradient-to-r from-success/10 to-success/20 p-4 border-b">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Flame className="h-5 w-5 text-success" />
                      Macronutrients
                      <span className="ml-auto text-sm font-normal text-muted-foreground">7-Day Trend</span>
                    </CardTitle>
                  </div>
                  <CardContent className="pt-6">
                    {loading ? (
                      <div className="h-[220px] flex items-center justify-center">
                        <div className="animate-pulse text-muted-foreground">Loading data...</div>
                      </div>
                    ) : nutritionData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={nutritionData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis dataKey="date" fontSize={11} />
                          <YAxis fontSize={11} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="protein" 
                            stroke="hsl(var(--success))" 
                            strokeWidth={2.5} 
                            name="Protein"
                            dot={{ fill: 'hsl(var(--success))', r: 3 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="carbs" 
                            stroke="hsl(var(--warning))" 
                            strokeWidth={2.5} 
                            name="Carbs"
                            dot={{ fill: 'hsl(var(--warning))', r: 3 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="fat" 
                            stroke="hsl(var(--info))" 
                            strokeWidth={2.5} 
                            name="Fat"
                            dot={{ fill: 'hsl(var(--info))', r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[220px] flex flex-col items-center justify-center">
                        <Flame className="h-12 w-12 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No nutrition data yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Install App */}
          {isInstallable && (
            <Card className="premium-card mb-4 bg-gradient-to-br from-primary/5 to-primary-glow/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <Download className="h-10 w-10 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold text-lg mb-2">Install Nutrisync</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get instant access from your home screen
                </p>
                <Button 
                  variant="default" 
                  className="premium-button w-full"
                  onClick={handleInstallClick}
                >
                  Install Now
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
