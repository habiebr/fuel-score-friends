import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Utensils, Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { getDateRangeInUserTimezone } from '@/lib/timezone';
import { accumulatePlannedFromMealPlans, accumulateConsumedFromFoodLogs } from '@/lib/nutrition';

interface CaloriesData {
  baseGoal: number;
  food: number;
  exercise: number;
  remaining: number;
}

export function CaloriesWidget() {
  const { user } = useAuth();
  const [data, setData] = useState<CaloriesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCaloriesData();
    }
  }, [user]);

  const loadCaloriesData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const todayRange = getDateRangeInUserTimezone();
      const today = todayRange.dateString;

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
        .gte('logged_at', todayRange.start)
        .lte('logged_at', todayRange.end);

      // Fetch today's wearable calories burned
      const { data: wearableToday } = await (supabase as any)
        .from('wearable_data')
        .select('calories_burned')
        .eq('user_id', user.id)
        .eq('date', today);

      const plannedNutrition = accumulatePlannedFromMealPlans(mealPlans || []);
      const consumedNutrition = accumulateConsumedFromFoodLogs(foodLogs || []);

      // Sum activity calories for today
      let exerciseCalories = 0;
      if (wearableToday && Array.isArray(wearableToday)) {
        for (const w of wearableToday as any[]) {
          exerciseCalories += w.calories_burned || 0;
        }
      }

      // Calculate remaining calories: Base Goal - Food + Exercise
      const baseGoal = plannedNutrition.calories || 2000; // Default to 2000 if no meal plan
      const foodCalories = consumedNutrition.calories || 0;
      const remaining = baseGoal - foodCalories + exerciseCalories;

      setData({
        baseGoal,
        food: foodCalories,
        exercise: exerciseCalories,
        remaining: Math.max(0, remaining)
      });
    } catch (error) {
      console.error('Error loading calories data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-4"></div>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-muted rounded-full"></div>
              <div className="space-y-4 flex-1">
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
              </div>
            </div>
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
            <p>Unable to load calories data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate progress percentage for the circular progress
  const progressPercentage = Math.min(100, Math.max(0, ((data.baseGoal - data.remaining) / data.baseGoal) * 100));

  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        {/* Title and Formula */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-foreground mb-1">Calories</h3>
          <p className="text-sm text-muted-foreground">Remaining = Goal - Food + Exercise</p>
        </div>

        <div className="flex items-center gap-6">
          {/* Circular Progress Display */}
          <div className="relative">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progressPercentage / 100)}`}
                className="text-primary transition-all duration-300"
                strokeLinecap="round"
              />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold text-foreground">{data.remaining}</div>
              <div className="text-sm text-foreground">Remaining</div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="flex-1 space-y-4">
            {/* Base Goal */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Target className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Base Goal</div>
                <div className="text-lg font-bold text-foreground">{data.baseGoal}</div>
              </div>
            </div>

            {/* Food */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Utensils className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Food</div>
                <div className="text-lg font-bold text-foreground">{data.food}</div>
              </div>
            </div>

            {/* Exercise */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <Flame className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Exercise</div>
                <div className="text-lg font-bold text-foreground">{data.exercise}</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
