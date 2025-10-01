import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Heart, Footprints, Flame } from 'lucide-react';
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

export function DailyNutritionSummary() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<TodayMetrics | null>(null);
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
          <Activity className="h-5 w-5 text-primary" />
          Today's Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {metrics ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Footprints className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Steps</div>
                  <div className="text-lg font-semibold">{metrics.steps.toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Flame className="h-5 w-5 text-warning" />
                <div>
                  <div className="text-xs text-muted-foreground">Calories Burned</div>
                  <div className="text-lg font-semibold">{metrics.calories}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Heart className="h-5 w-5 text-destructive" />
                <div>
                  <div className="text-xs text-muted-foreground">Avg Heart Rate</div>
                  <div className="text-lg font-semibold">{metrics.heartRate} bpm</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Activity className="h-5 w-5 text-info" />
                <div>
                  <div className="text-xs text-muted-foreground">Sleep</div>
                  <div className="text-lg font-semibold">{metrics.sleep}h</div>
                </div>
              </div>
            </div>
            {metrics.activityType && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Latest Activity</div>
                <div className="font-semibold capitalize text-primary">{metrics.activityType}</div>
                {metrics.trainingEffect && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Training Effect: {metrics.trainingEffect.toFixed(1)}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-6 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No activity data for today yet</p>
            <p className="text-xs mt-1">Sync your wearable device to see metrics</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
