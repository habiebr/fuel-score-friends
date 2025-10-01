import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, TrendingUp, Heart, Footprints, Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface TodayMetrics {
  steps: number;
  calories: number;
  heartRate: number;
  sleep: number;
  activityType?: string;
  trainingEffect?: number;
}

interface NutritionTargets {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export function DailyNutritionSummary() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<TodayMetrics | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDailyData();
    }
  }, [user]);

  const loadDailyData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Load today's wearable data
      const { data: wearableData } = await supabase
        .from('wearable_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (wearableData) {
        setMetrics({
          steps: wearableData.steps || 0,
          calories: wearableData.calories_burned || 0,
          heartRate: wearableData.heart_rate_avg || 0,
          sleep: wearableData.sleep_hours || 0,
          activityType: wearableData.activity_type,
          trainingEffect: wearableData.training_effect,
        });
      }

      // Load today's meal plan targets
      const { data: mealPlans } = await supabase
        .from('daily_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      if (mealPlans && mealPlans.length > 0) {
        const totals = mealPlans.reduce(
          (acc, plan) => ({
            totalCalories: acc.totalCalories + (plan.recommended_calories || 0),
            totalProtein: acc.totalProtein + (plan.recommended_protein_grams || 0),
            totalCarbs: acc.totalCarbs + (plan.recommended_carbs_grams || 0),
            totalFat: acc.totalFat + (plan.recommended_fat_grams || 0),
          }),
          { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
        );
        setTargets(totals);
      }
    } catch (error) {
      console.error('Error loading daily data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Daily Nutrition Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's Activity Snapshot */}
        {metrics && (
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <div className="text-sm font-semibold mb-3 text-muted-foreground">Today's Activity</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Steps</div>
                  <div className="font-semibold">{metrics.steps.toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-warning" />
                <div>
                  <div className="text-xs text-muted-foreground">Calories</div>
                  <div className="font-semibold">{metrics.calories}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-destructive" />
                <div>
                  <div className="text-xs text-muted-foreground">Avg HR</div>
                  <div className="font-semibold">{metrics.heartRate} bpm</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-info" />
                <div>
                  <div className="text-xs text-muted-foreground">Sleep</div>
                  <div className="font-semibold">{metrics.sleep}h</div>
                </div>
              </div>
            </div>
            {metrics.activityType && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground">Activity Type</div>
                <div className="font-semibold capitalize">{metrics.activityType}</div>
              </div>
            )}
          </div>
        )}

        {/* Nutrition Targets */}
        {targets ? (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="text-center mb-3">
              <div className="text-3xl font-bold text-primary">{targets.totalCalories}</div>
              <div className="text-sm text-muted-foreground">Daily Calorie Target</div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center p-3 bg-success/10 rounded-lg">
                <div className="text-xl font-bold text-success">{targets.totalProtein}g</div>
                <div className="text-xs text-muted-foreground">Protein</div>
              </div>
              <div className="text-center p-3 bg-warning/10 rounded-lg">
                <div className="text-xl font-bold text-warning">{targets.totalCarbs}g</div>
                <div className="text-xs text-muted-foreground">Carbs</div>
              </div>
              <div className="text-center p-3 bg-info/10 rounded-lg">
                <div className="text-xl font-bold text-info">{targets.totalFat}g</div>
                <div className="text-xs text-muted-foreground">Fat</div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3 text-center">
              Automatically calculated based on your profile, activity level, and fitness goals
            </p>
          </div>
        ) : (
          <div className="p-4 bg-muted/30 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              No nutrition plan generated yet. Plans are automatically created daily based on your data.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
