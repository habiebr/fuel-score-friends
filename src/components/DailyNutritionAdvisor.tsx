import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Activity, TrendingUp, Loader2, Heart, Footprints, Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface NutritionAdvice {
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  insights: string[];
  recommendations: string[];
}

interface TodayMetrics {
  steps: number;
  calories: number;
  heartRate: number;
  sleep: number;
  activityType?: string;
  trainingEffect?: number;
}

export function DailyNutritionAdvisor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<NutritionAdvice | null>(null);
  const [metrics, setMetrics] = useState<TodayMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    if (user) {
      loadTodayMetrics();
    }
  }, [user]);

  const loadTodayMetrics = async () => {
    if (!user) return;

    setLoadingMetrics(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('wearable_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (data) {
        setMetrics({
          steps: data.steps || 0,
          calories: data.calories_burned || 0,
          heartRate: data.heart_rate_avg || 0,
          sleep: data.sleep_hours || 0,
          activityType: data.activity_type,
          trainingEffect: data.training_effect,
        });
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const generateAdvice = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('estimate-macros', {
        body: {}
      });

      if (error) throw error;

      if (data.estimation) {
        setAdvice(data.estimation);
        toast({
          title: 'Nutrition advice generated!',
          description: 'AI has analyzed your data and created personalized recommendations',
        });
      }
    } catch (error) {
      console.error('Error generating nutrition advice:', error);
      toast({
        title: 'Generation failed',
        description: 'Failed to generate nutrition advice. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Nutrition Advisor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's Activity Snapshot */}
        {!loadingMetrics && metrics && (
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

        <p className="text-sm text-muted-foreground">
          Get AI-powered daily nutrition recommendations based on your wearable data, body metrics, and fitness goals
        </p>

        {!advice ? (
          <Button 
            onClick={generateAdvice} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing your data...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Generate Daily Nutrition Plan
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            {/* Daily Target */}
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="text-center mb-3">
                <div className="text-3xl font-bold text-primary">{advice.dailyCalories}</div>
                <div className="text-sm text-muted-foreground">Recommended Daily Calories</div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-3 bg-success/10 rounded-lg">
                  <div className="text-xl font-bold text-success">{advice.protein}g</div>
                  <div className="text-xs text-muted-foreground">Protein</div>
                </div>
                <div className="text-center p-3 bg-warning/10 rounded-lg">
                  <div className="text-xl font-bold text-warning">{advice.carbs}g</div>
                  <div className="text-xs text-muted-foreground">Carbs</div>
                </div>
                <div className="text-center p-3 bg-info/10 rounded-lg">
                  <div className="text-xl font-bold text-info">{advice.fat}g</div>
                  <div className="text-xs text-muted-foreground">Fat</div>
                </div>
              </div>
            </div>

            {/* AI Insights */}
            {advice.insights && advice.insights.length > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                <div className="font-semibold text-sm text-foreground">AI Insights</div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {advice.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {advice.recommendations && advice.recommendations.length > 0 && (
              <div className="p-3 bg-success/10 border border-success/20 rounded-lg space-y-2">
                <div className="font-semibold text-sm text-foreground">Today's Recommendations</div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {advice.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-success mt-0.5">✓</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button 
              onClick={generateAdvice} 
              variant="outline"
              className="w-full"
            >
              Regenerate Advice
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
