import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, Utensils, Flame, Zap, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { accumulatePlannedFromMealPlans, accumulateConsumedFromFoodLogs, adjustedPlannedCaloriesForActivity } from '@/lib/nutrition';

interface DailyNutritionData {
  planned: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  // Additional calories from activity (tracker)
  activityCalories: number;
  // Planned calories adjusted by activityCalories
  adjustedPlannedCalories: number;
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  remaining: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  mealPlan: any;
  runningGoal: string;
  trainingIntensity: string;
}

export function DailyNutritionSummary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<DailyNutritionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDailyNutrition();
    }
  }, [user]);

  const loadDailyNutrition = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch user profile for running goals
      const { data: profile } = await supabase
        .from('profiles')
        .select('fitness_goals, target_date, fitness_level, activity_level')
        .eq('user_id', user.id)
        .single();

      // Fetch meal plan for today from database
      const { data: mealPlans } = await supabase
        .from('daily_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      // Fetch food logs for today
      const { data: foodLogs } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`);

      // Fetch today's wearable calories burned
      const { data: wearableToday } = await supabase
        .from('wearable_data')
        .select('calories_burned')
        .eq('user_id', user.id)
        .eq('date', today);

      const plannedNutrition = accumulatePlannedFromMealPlans(mealPlans || []);
      const consumedNutrition = accumulateConsumedFromFoodLogs(foodLogs || []);

      // Sum activity calories for today
      const activityCalories = (wearableToday || []).reduce((sum: number, w: any) => sum + (w.calories_burned || 0), 0);

      // Adjust planned calories by activity calories
      const adjustedPlannedCalories = adjustedPlannedCaloriesForActivity(plannedNutrition.calories, activityCalories);

      // Calculate remaining nutrition
      const remainingNutrition = {
        calories: Math.max(0, adjustedPlannedCalories - consumedNutrition.calories),
        protein: Math.max(0, plannedNutrition.protein - consumedNutrition.protein),
        carbs: Math.max(0, plannedNutrition.carbs - consumedNutrition.carbs),
        fat: Math.max(0, plannedNutrition.fat - consumedNutrition.fat),
      };

      // Determine training intensity based on running goals and training plan
      let trainingIntensity = "moderate";
      const fitnessGoal = profile?.fitness_goals?.[0];
      const weekPlan = profile?.activity_level ? JSON.parse(profile.activity_level) : null;
      
      if (fitnessGoal && fitnessGoal.includes('marathon')) {
        trainingIntensity = "high";
      } else if (fitnessGoal && fitnessGoal.includes('half')) {
        trainingIntensity = "moderate-high";
      } else if (weekPlan && Array.isArray(weekPlan)) {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todayPlan = weekPlan.find(day => day.day === today);
        if (todayPlan?.activity === 'run' && todayPlan.duration > 60) {
          trainingIntensity = "high";
        } else if (todayPlan?.activity === 'run' && todayPlan.duration > 30) {
          trainingIntensity = "moderate-high";
        }
      }

      setData({
        planned: plannedNutrition,
        activityCalories,
        adjustedPlannedCalories,
        consumed: consumedNutrition,
        remaining: remainingNutrition,
        mealPlan: mealPlans,
        runningGoal: fitnessGoal || "general fitness",
        trainingIntensity,
      });
    } catch (error) {
      console.error('Error loading daily nutrition:', error);
      toast({
        title: 'Error',
        description: 'Failed to load daily nutrition data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = (consumed: number, planned: number) => {
    if (planned === 0) return 0;
    return Math.min(100, (consumed / planned) * 100);
  };

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'high': return 'text-destructive';
      case 'moderate-high': return 'text-warning';
      case 'moderate': return 'text-primary';
      case 'low': return 'text-muted-foreground';
      default: return 'text-primary';
    }
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading nutrition data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No nutrition data available</p>
            <Button onClick={loadDailyNutrition} variant="outline" size="sm" className="mt-2">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="h-5 w-5 text-primary" />
          Daily Nutrition Summary
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span>{data.runningGoal.replace('_', ' ')}</span>
          </div>
          <div className={`flex items-center gap-1 ${getIntensityColor(data.trainingIntensity)}`}>
            <Zap className="h-4 w-4" />
            <span className="capitalize">{data.trainingIntensity} intensity</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Calorie Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Calories</span>
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <span>
                {data.consumed.calories} / {data.adjustedPlannedCalories}
              </span>
              {data.activityCalories > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] uppercase tracking-wide">
                  +activity
                </span>
              )}
            </span>
          </div>
          <Progress 
            value={getProgressPercentage(data.consumed.calories, data.adjustedPlannedCalories)} 
            className="h-2"
          />
          {data.activityCalories > 0 && (
            <p className="text-xs text-muted-foreground">
              Includes +{data.activityCalories} kcal from today's activity
            </p>
          )}
          {data.remaining.calories > 0 && (
            <p className="text-xs text-muted-foreground">
              {data.remaining.calories} calories remaining
            </p>
          )}
        </div>

        {/* Macronutrients */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-success">{data.consumed.protein}g</div>
            <div className="text-xs text-muted-foreground">Protein</div>
            <div className="text-xs text-muted-foreground">
              / {data.planned.protein}g
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning">{data.consumed.carbs}g</div>
            <div className="text-xs text-muted-foreground">Carbs</div>
            <div className="text-xs text-muted-foreground">
              / {data.planned.carbs}g
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-info">{data.consumed.fat}g</div>
            <div className="text-xs text-muted-foreground">Fat</div>
            <div className="text-xs text-muted-foreground">
              / {data.planned.fat}g
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button onClick={loadDailyNutrition} variant="outline" size="sm" className="flex-1">
            <TrendingUp className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
