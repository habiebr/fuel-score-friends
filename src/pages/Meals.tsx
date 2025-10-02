import { useState, useEffect } from 'react';
import { useMealCron } from '@/hooks/useMealCron';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { Calendar, ArrowLeft, Utensils, TrendingUp, Loader2, BookOpen, Plus, History } from 'lucide-react';
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

  useEffect(() => {
    if (user) {
      loadMealPlan();
      loadWearableToday();
    }
  }, [user]);

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
      const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
        body: { date: format(new Date(), 'yyyy-MM-dd') },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });

      if (error) throw error;

      if (data && data.plans) {
        setDailyMealPlan(data.plans);
        toast({
          title: 'Meal plan generated!',
          description: 'Your personalized meal plan has been created.',
        });
      }
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

          {/* Tabs */}
          <Tabs defaultValue="diary" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="diary" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Meal Diary
              </TabsTrigger>
              <TabsTrigger value="plans" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Meal Plans
              </TabsTrigger>
            </TabsList>

            {/* Meal Diary Tab */}
            <TabsContent value="diary" className="space-y-6">
              {/* Quick Actions */}
              <Card className="shadow-card">
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
                      onClick={() => navigate('/meal-history')}
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center gap-2"
                    >
                      <History className="h-6 w-6" />
                      <span className="text-sm">View History</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Meal Plans Tab */}
            <TabsContent value="plans" className="space-y-6">
              <Card className="shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Today's Meal Plan
                    </CardTitle>
                    <Button
                      onClick={generateMealPlan}
                      disabled={loadingMealPlan}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {loadingMealPlan ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {loadingMealPlan ? 'Generating...' : 'Generate Plan'}
                    </Button>
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
                      <p className="text-sm mb-4">Generate a personalized meal plan based on your goals and activity level.</p>
                      <Button
                        onClick={generateMealPlan}
                        disabled={loadingMealPlan}
                        className="flex items-center gap-2"
                      >
                        {loadingMealPlan ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        {loadingMealPlan ? 'Generating...' : 'Generate Meal Plan'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
