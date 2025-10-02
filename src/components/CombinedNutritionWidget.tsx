import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, Utensils, Flame, Zap, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { deriveMacrosFromCalories } from '@/lib/nutrition';
import { accumulatePlannedFromMealPlans, accumulateConsumedFromFoodLogs, adjustedPlannedCaloriesForActivity } from '@/lib/nutrition';

interface CombinedNutritionData {
  // Calories section
  baseGoal: number;
  food: number;
  exercise: number;
  remainingCalories: number;
  
  // Nutrition breakdown
  planned: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
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
  
  // Activity data
  activityCalories: number;
  adjustedPlannedCalories: number;
}

export function CombinedNutritionWidget() {
  const { user } = useAuth();
  const [data, setData] = useState<CombinedNutritionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNutritionData();
    }
  }, [user]);

  const loadNutritionData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch user profile for activity level
      const { data: profile } = await supabase
        .from('profiles')
        .select('activity_level')
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
      const { data: wearableToday } = await (supabase as any)
        .from('wearable_data')
        .select('calories_burned')
        .eq('user_id', user.id)
        .eq('date', today);

      const plannedNutrition = accumulatePlannedFromMealPlans(mealPlans || []);
      const consumedNutrition = accumulateConsumedFromFoodLogs(foodLogs || []);

      // Sum activity calories for today
      let activityCalories = 0;
      if (wearableToday && Array.isArray(wearableToday)) {
        for (const w of wearableToday as any[]) {
          activityCalories += w.calories_burned || 0;
        }
      }

      // Adjust planned calories by activity calories
      const adjustedPlannedCalories = adjustedPlannedCaloriesForActivity(plannedNutrition.calories, activityCalories);

      // If planned macros are missing (no meal plan), derive from adjusted daily calories (TDEE-based)
      const fallbackPlanned = (() => {
        if ((plannedNutrition.protein || plannedNutrition.carbs || plannedNutrition.fat) > 0) return plannedNutrition;
        const macros = deriveMacrosFromCalories(adjustedPlannedCalories);
        return {
          calories: adjustedPlannedCalories,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
        };
      })();

      const finalPlanned = {
        calories: adjustedPlannedCalories,
        protein: fallbackPlanned.protein,
        carbs: fallbackPlanned.carbs,
        fat: fallbackPlanned.fat,
      };

      const remaining = {
        calories: Math.max(0, finalPlanned.calories - consumedNutrition.calories),
        protein: Math.max(0, finalPlanned.protein - consumedNutrition.protein),
        carbs: Math.max(0, finalPlanned.carbs - consumedNutrition.carbs),
        fat: Math.max(0, finalPlanned.fat - consumedNutrition.fat),
      };

      // Calculate calories widget data
      const baseGoal = finalPlanned.calories;
      const foodCalories = consumedNutrition.calories;
      const remainingCalories = baseGoal - foodCalories + activityCalories;

      setData({
        // Calories section
        baseGoal,
        food: foodCalories,
        exercise: activityCalories,
        remainingCalories: Math.max(0, remainingCalories),
        
        // Nutrition breakdown
        planned: finalPlanned,
        consumed: consumedNutrition,
        remaining,
        
        // Activity data
        activityCalories,
        adjustedPlannedCalories,
      });
    } catch (error) {
      console.error('Error loading nutrition data:', error);
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
            <div className="mt-6 space-y-3">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded"></div>
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
            <p>Unable to load nutrition data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate progress percentage for the circular progress
  const progressPercentage = Math.min(100, Math.max(0, ((data.baseGoal - data.remainingCalories) / data.baseGoal) * 100));

  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        {/* Title and Formula */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-foreground mb-1">Daily Nutrition</h3>
          <p className="text-sm text-muted-foreground">Remaining = Goal - Food + Exercise</p>
        </div>

        {/* Calories Section */}
        <div className="flex items-center gap-6 mb-6">
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
              <div className="text-2xl font-bold text-foreground">{data.remainingCalories}</div>
              <div className="text-sm text-foreground">Remaining</div>
            </div>
          </div>

          {/* Calories Breakdown */}
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

        {/* Macro Breakdown */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-foreground">Macro Breakdown</h4>
          
          {/* Protein */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <Zap className="h-3 w-3 text-red-600" />
                </div>
                <span className="text-sm font-medium">Protein</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {data.consumed.protein}g / {data.planned.protein}g
              </span>
            </div>
            <Progress 
              value={(data.consumed.protein / data.planned.protein) * 100} 
              className="h-2"
            />
          </div>

          {/* Carbs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 text-yellow-600" />
                </div>
                <span className="text-sm font-medium">Carbs</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {data.consumed.carbs}g / {data.planned.carbs}g
              </span>
            </div>
            <Progress 
              value={(data.consumed.carbs / data.planned.carbs) * 100} 
              className="h-2"
            />
          </div>

          {/* Fat */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <Target className="h-3 w-3 text-green-600" />
                </div>
                <span className="text-sm font-medium">Fat</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {data.consumed.fat}g / {data.planned.fat}g
              </span>
            </div>
            <Progress 
              value={(data.consumed.fat / data.planned.fat) * 100} 
              className="h-2"
            />
          </div>
        </div>

      </CardContent>
    </Card>
  );
}