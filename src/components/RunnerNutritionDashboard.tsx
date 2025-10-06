import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalorieRing } from './CalorieRing';
import { MacroProgressBars } from './MacroProgressBars';
import { NutritionInsights } from './NutritionInsights';
import { HydrationTracker } from './HydrationTracker';
import { WeeklyNutritionTrends } from './WeeklyNutritionTrends';
import { MealTimeline } from './MealTimeline';
import { QuickMealLog } from './QuickMealLog';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { deriveMacrosFromCalories, accumulatePlannedFromMealPlans, accumulateConsumedFromFoodLogs, adjustedPlannedCaloriesForActivity } from '@/lib/nutrition';

interface RunnerNutritionDashboardProps {
  className?: string;
}

export function RunnerNutritionDashboard({ className = '' }: RunnerNutritionDashboardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState({
    calories: {
      baseGoal: 2000,
      consumed: 0,
      exercise: 0,
      remaining: 2000,
    },
    macros: {
      protein: { consumed: 0, target: 150 },
      carbs: { consumed: 0, target: 250 },
      fat: { consumed: 0, target: 67 },
    },
    profile: {
      runningGoal: 'general',
      trainingIntensity: 'moderate',
    },
    hydrationMl: 0,
  });

  useEffect(() => {
    if (user) {
      loadNutritionData();
    }
  }, [user, refreshKey]);

  const loadNutritionData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('fitness_goals, training_intensity, activity_level')
        .eq('user_id', user.id)
        .single();

      // Fetch meal plans for today
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

      // Fetch wearable data for today
      const { data: wearableToday } = await supabase
        .from('wearable_data')
        .select('calories_burned')
        .eq('user_id', user.id)
        .eq('date', today);

      // Fetch hydration logs for today (commented out until migration is applied)
      // const { data: hydrationLogs } = await supabase
      //   .from('hydration_logs')
      //   .select('amount_ml')
      //   .eq('user_id', user.id)
      //   .gte('logged_at', `${today}T00:00:00`)
      //   .lte('logged_at', `${today}T23:59:59`);

      const plannedNutrition = accumulatePlannedFromMealPlans(mealPlans || []);
      const consumedNutrition = accumulateConsumedFromFoodLogs(foodLogs || []);
      const activityCalories = (wearableToday || []).reduce((sum: number, w: any) => sum + (w.calories_burned || 0), 0);
      const hydrationMl = 0; // (hydrationLogs || []).reduce((sum, log) => sum + (log.amount_ml || 0), 0);

      // Base calorie goal from meal plan or default to 2000
      const baseGoal = plannedNutrition.calories || 2000;
      const adjustedPlannedCalories = adjustedPlannedCaloriesForActivity(baseGoal, activityCalories);

      // Derive macros if not in meal plan
      const macrosFromCalories = deriveMacrosFromCalories(adjustedPlannedCalories);
      const targetMacros = {
        protein: plannedNutrition.protein || macrosFromCalories.protein,
        carbs: plannedNutrition.carbs || macrosFromCalories.carbs,
        fat: plannedNutrition.fat || macrosFromCalories.fat,
      };

      const remaining = baseGoal - consumedNutrition.calories + activityCalories;

      setData({
        calories: {
          baseGoal,
          consumed: consumedNutrition.calories,
          exercise: activityCalories,
          remaining: Math.max(0, remaining),
        },
        macros: {
          protein: {
            consumed: consumedNutrition.protein,
            target: targetMacros.protein,
          },
          carbs: {
            consumed: consumedNutrition.carbs,
            target: targetMacros.carbs,
          },
          fat: {
            consumed: consumedNutrition.fat,
            target: targetMacros.fat,
          },
        },
        profile: {
          runningGoal: profile?.fitness_goals || 'general',
          trainingIntensity: profile?.training_intensity || 'moderate',
        },
        hydrationMl,
      });
    } catch (error) {
      console.error('Error loading nutrition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMealLogged = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (!user) {
    return (
      <div className={`${className} flex items-center justify-center min-h-[400px]`}>
        <p className="text-gray-500">Please log in to view your nutrition dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center min-h-[400px]`}>
        <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className={className}>
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4 h-12">
          <TabsTrigger value="today" className="text-sm font-medium">Today</TabsTrigger>
          <TabsTrigger value="timeline" className="text-sm font-medium">Timeline</TabsTrigger>
          <TabsTrigger value="trends" className="text-sm font-medium">Trends</TabsTrigger>
        </TabsList>

        {/* Today Tab - Mobile Optimized */}
        <TabsContent value="today" className="space-y-4 mt-0">
          {/* Calorie Ring */}
          <CalorieRing
            baseGoal={data.calories.baseGoal}
            consumed={data.calories.consumed}
            exercise={data.calories.exercise}
            remaining={data.calories.remaining}
          />

          {/* Macro Progress Bars */}
          <MacroProgressBars data={data.macros} />

          {/* Hydration Tracker - Temporarily disabled until migration is applied */}
          {/* <HydrationTracker exerciseCalories={data.calories.exercise} /> */}

          {/* Insights */}
          <NutritionInsights
            calories={{
              consumed: data.calories.consumed,
              target: data.calories.baseGoal,
              exercise: data.calories.exercise,
            }}
            macros={data.macros}
            runningGoal={data.profile.runningGoal}
            trainingIntensity={data.profile.trainingIntensity}
            hydrationMl={data.hydrationMl}
          />
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          <MealTimeline />
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <WeeklyNutritionTrends />
        </TabsContent>
      </Tabs>

      {/* Quick Meal Log FAB */}
      <QuickMealLog onMealLogged={handleMealLogged} />
    </div>
  );
}

