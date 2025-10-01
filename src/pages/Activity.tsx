import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { Activity as ActivityIcon, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subDays } from 'date-fns';

export default function Activity() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [nutritionData, setNutritionData] = useState<any[]>([]);
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);

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

      const { data: nutritionData } = await supabase
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

      const formattedNutrition = (nutritionData || []).map(d => ({
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

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-background flex items-center justify-center pb-20">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-primary rounded-full"></div>
          </div>
        </div>
        <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
        <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      </>
    );
  }

  return (
    <>
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-7xl mx-auto p-4">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Activity Metrics</h1>
            <p className="text-muted-foreground text-sm">Last 7 days of training data</p>
          </div>

          {/* Steps Chart */}
          <Card className="shadow-card mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ActivityIcon className="h-4 w-4 text-primary" />
                Daily Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="steps" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="calories" fill="hsl(var(--secondary))" />
                </BarChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={nutritionData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="protein" stroke="hsl(var(--success))" strokeWidth={2} />
                  <Line type="monotone" dataKey="carbs" stroke="hsl(var(--warning))" strokeWidth={2} />
                  <Line type="monotone" dataKey="fat" stroke="hsl(var(--info))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
