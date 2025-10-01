import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WearablesSync } from '@/components/WearablesSync';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { LogOut, User, Target, Activity as ActivityIcon, Download, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subDays } from 'date-fns';

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [nutritionData, setNutritionData] = useState<any[]>([]);
  const { toast } = useToast();

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
    }
  }, [user]);

  const loadActivityData = async () => {
    if (!user) return;

    try {
      // Get last 7 days of data
      const endDate = new Date();
      const startDate = subDays(endDate, 6);

      const { data: wearableData } = await supabase
        .from('wearable_data')
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

      // Format data for charts
      const formattedActivity = (wearableData || []).map(d => ({
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
        <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Profile</h1>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
        </div>

        {/* Wearables Sync */}
        <WearablesSync />

        {/* Profile Stats */}
        <Card className="shadow-card mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Your Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Days</span>
              <span className="font-semibold">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Average Score</span>
              <span className="font-semibold">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Meals Logged</span>
              <span className="font-semibold">0</span>
            </div>
          </CardContent>
        </Card>

        {/* Goals */}
        <Card className="shadow-card mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => navigate('/goals')}
            >
              Set Your Goals
            </Button>
          </CardContent>
        </Card>

        {/* Activity Metrics */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground mb-4">Activity Metrics</h2>
          
          {/* Steps Chart */}
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ActivityIcon className="h-4 w-4 text-primary" />
                Daily Steps (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">Loading...</div>
                </div>
              ) : activityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="steps" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No activity data yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calories Burned */}
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-secondary" />
                Calories Burned
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">Loading...</div>
                </div>
              ) : activityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="calories" fill="hsl(var(--secondary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No activity data yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Nutrition Macros */}
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ActivityIcon className="h-4 w-4 text-success" />
                Nutrition Macros
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">Loading...</div>
                </div>
              ) : nutritionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={nutritionData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="protein" stroke="hsl(var(--success))" strokeWidth={2} name="Protein" />
                    <Line type="monotone" dataKey="carbs" stroke="hsl(var(--warning))" strokeWidth={2} name="Carbs" />
                    <Line type="monotone" dataKey="fat" stroke="hsl(var(--info))" strokeWidth={2} name="Fat" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No nutrition data yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Install App */}
        {isInstallable && (
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Install App
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="default" 
                className="w-full"
                onClick={handleInstallClick}
              >
                Install Nutrisync
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
        </div>
      </div>
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
