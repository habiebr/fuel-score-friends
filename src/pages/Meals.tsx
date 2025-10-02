import { useState, useEffect } from 'react';
import { useMealCron } from '@/hooks/useMealCron';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { Calendar, ArrowLeft, Utensils, TrendingUp, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGoogleFit } from '@/hooks/useGoogleFit';
import { format, subDays } from 'date-fns';

interface FoodLog {
  id: string;
  food_name: string;
  meal_type: string;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  serving_size: string;
  logged_at: string;
}

interface DayData {
  date: string;
  logs: FoodLog[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export default function MealsTabbed() {
  useMealCron();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthorized: isGoogleFitAuthorized, fetchTodayData: fetchGoogleFitToday } = useGoogleFit();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dailyMealPlan, setDailyMealPlan] = useState<any>(null);
  const [loadingMealPlan, setLoadingMealPlan] = useState(false);
  const [activityCaloriesToday, setActivityCaloriesToday] = useState(0);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    return startOfWeek;
  });
  const [weekData, setWeekData] = useState<DayData[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await Promise.all([loadMealPlan(), loadWearableToday(), loadWeekData()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, currentWeekStart]);

  const loadWearableToday = async () => {
    if (!user) return;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: wearableToday } = await (supabase as any)
        .from('wearable_data')
        .select('calories_burned')
        .eq('user_id', user.id)
        .eq('date', today);
      const activity = (wearableToday || []).reduce((sum: number, w: any) => sum + (w.calories_burned || 0), 0);

      // Prefer .fit/garmin wearable data when present; otherwise fall back to Google Fit
      if (activity > 0) {
        setActivityCaloriesToday(activity);
      } else if (isGoogleFitAuthorized) {
        try {
          const gf = await fetchGoogleFitToday();
          const gfCalories = Math.max(0, gf?.calories || 0);
          setActivityCaloriesToday(gfCalories);
        } catch (_) {
          setActivityCaloriesToday(0);
        }
      } else {
        setActivityCaloriesToday(0);
      }
    } catch (e) {
      console.error('Failed to load wearable calories for today', e);
    }
  };


  const loadMealPlan = async () => {
    if (!user) return;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: plans } = await supabase
        .from('daily_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('meal_type');

      if (plans && plans.length > 0) {
        setDailyMealPlan(plans);
      }
    } catch (error) {
      console.error('Error loading meal plan:', error);
    }
  };

  const generateMealPlan = async () => {
    if (!user) return;
    setLoadingMealPlan(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const apiKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
      const { error } = await supabase.functions.invoke('generate-meal-plan', {
        body: { date: format(new Date(), 'yyyy-MM-dd') },
        headers: {
          ...(apiKey ? { apikey: apiKey } : {}),
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      });

      if (error) throw error;

      // Refresh from DB to reflect persisted plans
      await loadMealPlan();
      toast({
        title: 'Meal plan generated!',
        description: 'Your personalized meal plan has been created.',
      });
    } catch (error) {
      console.error('Error generating meal plan:', error);
      toast({
        title: 'Generation failed',
        description: 'Failed to generate meal plan. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingMealPlan(false);
    }
  };

  const loadWeekData = async () => {
    if (!user) return;
    try {
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

      const { data: logs } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${startDate}T00:00:00`)
        .lte('logged_at', `${endDate}T23:59:59`)
        .order('logged_at', { ascending: false });

      const days: DayData[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        const dateStr = format(date, 'yyyy-MM-dd');

        const dayLogs = logs?.filter(log => 
          format(new Date(log.logged_at), 'yyyy-MM-dd') === dateStr
        ) || [];

        const totalCalories = dayLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
        const totalProtein = dayLogs.reduce((sum, log) => sum + (log.protein_grams || 0), 0);
        const totalCarbs = dayLogs.reduce((sum, log) => sum + (log.carbs_grams || 0), 0);
        const totalFat = dayLogs.reduce((sum, log) => sum + (log.fat_grams || 0), 0);

        days.push({
          date: dateStr,
          logs: dayLogs,
          totalCalories,
          totalProtein,
          totalCarbs,
          totalFat,
        });
      }

      setWeekData(days);
    } catch (error) {
      console.error('Error loading week data:', error);
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
        <BottomNav />
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
            <Button variant="ghost" onClick={() => navigate('/')} className="mb-4 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-foreground mb-2">Meals</h1>
            <p className="text-muted-foreground text-sm">Track your nutrition and meal plans</p>
          </div>

          {/* Quick Actions */}
          <Card className="shadow-card mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => setFoodTrackerOpen(true)}
                  className="h-20 flex flex-col items-center justify-center gap-2"
                >
                  <Plus className="h-6 w-6" />
                  <span className="text-sm">Add Meal</span>
                </Button>
                <Button
                  onClick={() => navigate('/meal-plans')}
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                >
                  <Calendar className="h-6 w-6" />
                  <span className="text-sm">7-Day Plans</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Meal Plan */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Today's Meal Plan
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {dailyMealPlan && dailyMealPlan.length > 0 ? (
                <div className="space-y-4">
                  {dailyMealPlan.map((meal: any, index: number) => (
                    <div key={index} className="p-4 bg-muted/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold capitalize">{meal.meal_type}</h3>
                        <div className="text-sm text-muted-foreground">
                          {meal.recommended_calories} cal
                        </div>
                      </div>
                      {meal.meal_suggestions && meal.meal_suggestions.length > 0 && (
                        <div className="space-y-2">
                          {meal.meal_suggestions.map((suggestion: any, idx: number) => (
                            <div key={idx} className="text-sm">
                              <div className="font-medium">{suggestion.name}</div>
                              <div className="text-muted-foreground">{suggestion.description}</div>
                              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                <span>🔥 {suggestion.calories} cal</span>
                                <span>🥩 {suggestion.protein}g</span>
                                <span>🍚 {suggestion.carbs}g</span>
                                <span>🥑 {suggestion.fat}g</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No meal plan for today</p>
                  <p className="text-sm">You can create plans from the 7-Day Plans page.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History - This Week */}
          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">This Week</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeekStart(subDays(currentWeekStart, 7))}
                >
                  ‹
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {format(currentWeekStart, 'MMM dd')} - {format(new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM dd')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeekStart(subDays(currentWeekStart, -7))}
                >
                  ›
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {weekData.map((day) => (
                <Card key={day.date} className="shadow-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {format(new Date(day.date), 'EEEE, MMM dd')}
                      </CardTitle>
                      <div className="text-sm font-semibold">
                        {day.totalCalories} <span className="text-muted-foreground font-normal">cal</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {day.logs.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 text-xs mb-3 p-3 bg-muted/30 rounded-lg">
                        <div className="text-center">
                          <div className="font-semibold text-success">{day.totalProtein}g</div>
                          <div className="text-muted-foreground">Protein</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-warning">{day.totalCarbs}g</div>
                          <div className="text-muted-foreground">Carbs</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-info">{day.totalFat}g</div>
                          <div className="text-muted-foreground">Fat</div>
                        </div>
                      </div>
                    )}

                    {day.logs.length > 0 ? (
                      <div className="space-y-2">
                        {day.logs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/40 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Utensils className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-sm capitalize">{log.meal_type}</div>
                                <div className="text-xs text-muted-foreground">{log.food_name}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-sm">{log.calories} cal</div>
                              <div className="text-xs text-muted-foreground">
                                P:{log.protein_grams}g C:{log.carbs_grams}g F:{log.fat_grams}g
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No meals logged for this day
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
