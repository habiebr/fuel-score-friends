import { useState, useEffect } from 'react';
import { useMealCron } from '@/hooks/useMealCron';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { Calendar, Search, ArrowLeft, Utensils, TrendingUp, Loader2, ChevronLeft, ChevronRight, Clock, BookOpen, Plus } from 'lucide-react';
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

export default function Meals() {
  useMealCron();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthorized: isGoogleFitAuthorized, fetchTodayData: fetchGoogleFitToday } = useGoogleFit();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [dailyMealPlan, setDailyMealPlan] = useState<any>(null);
  const [loadingMealPlan, setLoadingMealPlan] = useState(false);
  const [weeklyPlans, setWeeklyPlans] = useState<Record<string, any[]>>({});
  const [loadingWeeklyPlans, setLoadingWeeklyPlans] = useState(false);
  const [generatingWeek, setGeneratingWeek] = useState(false);
  const [trainingDays, setTrainingDays] = useState<Record<string, boolean>>({});
  
  // Regenerate the next 7 days: delete existing + generate fresh via AI
  const regenerateWeek = async () => {
    if (!user || !session?.access_token) return;
    setGeneratingWeek(true);
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + 6);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      // Hard reset the window to avoid stale rows
      await supabase
        .from('daily_meal_plans')
        .delete()
        .eq('user_id', user.id)
        .gte('date', startStr)
        .lte('date', endStr);

      // Generate fresh week (AI driven)
      await supabase.functions.invoke('generate-meal-plan-range', {
        body: { startDate: startStr, weeks: 1 },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      // Reload
      await loadWeeklyMealPlans();
    } catch (e) {
      console.warn('Regenerate week failed', e);
    } finally {
      setGeneratingWeek(false);
    }
  };
  const [currentMealIndex, setCurrentMealIndex] = useState(0);
  const [currentMealType, setCurrentMealType] = useState('breakfast');
  const [activityCaloriesToday, setActivityCaloriesToday] = useState<number>(0);

  // Carousel navigation functions
  const nextMeal = () => {
    const availableMeals = getAvailableMeals();
    setCurrentMealIndex((prev) => (prev + 1) % availableMeals.length);
  };

  const prevMeal = () => {
    const availableMeals = getAvailableMeals();
    setCurrentMealIndex((prev) => (prev - 1 + availableMeals.length) % availableMeals.length);
  };

  const getAvailableMeals = () => {
    if (!dailyMealPlan || !dailyMealPlan[currentMealType]) return [];
    return dailyMealPlan[currentMealType].suggestions || [];
  };

  const switchMealType = (mealType: string) => {
    setCurrentMealType(mealType);
    setCurrentMealIndex(0);
  };

  const getCurrentMealType = () => {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 19) return 'dinner';
    return 'snack';
  };

  useEffect(() => {
    if (user) {
      loadWeekData();
      loadDailyMealPlan();
      loadWearableToday();
      loadWeeklyMealPlans();
    }
  }, [user]);

  // When training plan changes, force recreate the upcoming week
  useEffect(() => {
    if (!user || !session?.access_token) return;
    const channel = (supabase as any)
      .channel('meals-profiles-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, async () => {
        await regenerateWeek();
      })
      .subscribe();
    return () => { try { (supabase as any).removeChannel(channel); } catch {} };
  }, [user, session?.access_token]);

  // Reset carousel when meal plans change
  useEffect(() => {
    if (dailyMealPlan) {
      setCurrentMealType(getCurrentMealType());
      setCurrentMealIndex(0);
    }
  }, [dailyMealPlan]);

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

  const loadWeekData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, 6);

      const { data: logs, error } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', startDate.toISOString())
        .lte('logged_at', endDate.toISOString())
        .order('logged_at', { ascending: false });

      if (error) throw error;

      // Group by date
      const groupedByDate: { [key: string]: FoodLog[] } = {};
      logs?.forEach((log) => {
        const dateKey = format(new Date(log.logged_at), 'yyyy-MM-dd');
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(log);
      });

      // Create day data for last 7 days
      const daysData: DayData[] = [];
      for (let i = 0; i < 7; i++) {
        const date = format(subDays(endDate, i), 'yyyy-MM-dd');
        const dayLogs = groupedByDate[date] || [];
        daysData.push({
          date,
          logs: dayLogs,
          totalCalories: dayLogs.reduce((sum, log) => sum + log.calories, 0),
          totalProtein: dayLogs.reduce((sum, log) => sum + log.protein_grams, 0),
          totalCarbs: dayLogs.reduce((sum, log) => sum + log.carbs_grams, 0),
          totalFat: dayLogs.reduce((sum, log) => sum + log.fat_grams, 0),
        });
      }

      setWeekData(daysData);
    } catch (error) {
      console.error('Error loading week data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load meal history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDailyMealPlan = async () => {
    if (!user) return;

    setLoadingMealPlan(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Load meal plans from database (same as Dashboard)
      const { data: plans, error } = await supabase
        .from('daily_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      if (error) throw error;

      if (plans && plans.length > 0) {
        const mealPlanData: any = {};
        plans.forEach(plan => {
          mealPlanData[plan.meal_type] = {
            target_calories: plan.recommended_calories,
            target_protein: plan.recommended_protein_grams,
            target_carbs: plan.recommended_carbs_grams,
            target_fat: plan.recommended_fat_grams,
            suggestions: Array.isArray(plan.meal_suggestions) ? (plan.meal_suggestions as any[]) : []
          };
        });

        if (Object.keys(mealPlanData).length > 0) {
          setDailyMealPlan(mealPlanData);
        }
      }
    } catch (error) {
      console.error('Error loading meal plan:', error);
      // Don't show error toast for meal plan as it's optional
    } finally {
      setLoadingMealPlan(false);
    }
  };

  const loadWeeklyMealPlans = async () => {
    if (!user) return;

    setLoadingWeeklyPlans(true);
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + 6);

      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const { data: plans, error } = await supabase
        .from('daily_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true });

      if (error) throw error;

      // If no plans found for the next 7 days, attempt on-demand generation then refetch once
      let allPlans = plans || [];
      if ((allPlans.length === 0) && session?.access_token) {
        try {
          await supabase.functions.invoke('generate-meal-plan-range', {
            body: { startDate: startStr, weeks: 1 },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const retry = await supabase
            .from('daily_meal_plans')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', startStr)
            .lte('date', endStr)
            .order('date', { ascending: true });
          if (!retry.error && retry.data) {
            allPlans = retry.data;
          }
          // As a final fallback, generate each day individually using the AI-powered single-day function
          if (allPlans.length === 0) {
            const days: string[] = [];
            for (let i = 0; i < 7; i++) {
              const d = new Date(start);
              d.setDate(start.getDate() + i);
              days.push(format(d, 'yyyy-MM-dd'));
            }
            for (const day of days) {
              try {
                await supabase.functions.invoke('generate-meal-plan', {
                  body: { date: day },
                  headers: { Authorization: `Bearer ${session.access_token}` },
                });
              } catch (e) {
                console.warn('Per-day generation failed for', day, e);
              }
            }
            const retry2 = await supabase
              .from('daily_meal_plans')
              .select('*')
              .eq('user_id', user.id)
              .gte('date', startStr)
              .lte('date', endStr)
              .order('date', { ascending: true });
            if (!retry2.error && retry2.data) {
              allPlans = retry2.data;
            }
          }
        } catch (genErr) {
          console.warn('Auto-generation of weekly plans failed:', genErr);
        }
      }

      const grouped: Record<string, any[]> = {};
      (allPlans || []).forEach((p: any) => {
        const key = p.date;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
      });
      setWeeklyPlans(grouped);

      // Color-code by training plan for each day in the 7-day window
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('activity_level')
          .eq('user_id', user.id)
          .maybeSingle();
        const weekPlan = profile?.activity_level ? JSON.parse(profile.activity_level as any) : null;
        const map: Record<string, boolean> = {};
        if (Array.isArray(weekPlan)) {
          for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const dateStr = format(d, 'yyyy-MM-dd');
            const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
            const dayPlan = weekPlan.find((w: any) => w && w.day === weekday);
            const hasTraining = !!(dayPlan && dayPlan.activity && dayPlan.activity !== 'rest' && (dayPlan.estimatedCalories || dayPlan.distanceKm || dayPlan.duration));
            map[dateStr] = !!hasTraining;
          }
        }
        setTrainingDays(map);
      } catch (_) {
        setTrainingDays({});
      }
    } catch (e) {
      console.error('Failed to load weekly meal plans', e);
    } finally {
      setLoadingWeeklyPlans(false);
    }
  };

  const handleSearchFood = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('nutrition-ai', {
        body: {
          type: 'food_search',
          query: searchQuery,
        },
      });

      if (error) throw error;

      if (data.nutritionData) {
        setSearchResults(data.nutritionData);
        toast({
          title: 'Food found!',
          description: `Nutrition info retrieved for ${data.nutritionData.food_name}`,
        });
      }
    } catch (error) {
      console.error('Error searching food:', error);
      toast({
        title: 'Search failed',
        description: 'Failed to find food. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
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
            <h1 className="text-2xl font-bold text-foreground mb-2">Meal Diary</h1>
            <p className="text-muted-foreground text-sm">Track your nutrition and search for foods</p>
          </div>

          {/* Food Search */}
          <Card className="shadow-card mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Food Search
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search for any food (e.g., banana, chicken breast)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchFood()}
                />
                <Button onClick={handleSearchFood} disabled={searching || !searchQuery.trim()}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {searchResults && (
                <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                  <div className="font-semibold mb-2">{searchResults.food_name}</div>
                  <div className="text-sm text-muted-foreground mb-3">Serving: {searchResults.serving_size}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-semibold">{searchResults.calories}</span>
                      <span className="text-muted-foreground"> cal</span>
                    </div>
                    <div>
                      <span className="font-semibold text-success">{searchResults.protein_grams}g</span>
                      <span className="text-muted-foreground"> protein</span>
                    </div>
                    <div>
                      <span className="font-semibold text-warning">{searchResults.carbs_grams}g</span>
                      <span className="text-muted-foreground"> carbs</span>
                    </div>
                    <div>
                      <span className="font-semibold text-info">{searchResults.fat_grams}g</span>
                      <span className="text-muted-foreground"> fat</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Meal Plan */}
          {!dailyMealPlan && !loadingMealPlan && (
            <Card className="shadow-card mb-6">
              <CardContent className="text-center py-8">
                <Utensils className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Meal Plan Available</h3>
                <p className="text-muted-foreground mb-4">
                  Generate a personalized meal plan based on your running goals
                </p>
                <Button 
                  onClick={async () => {
                    setLoadingMealPlan(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
                        body: { date: format(new Date(), 'yyyy-MM-dd') },
                        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
                      });
                      if (error) throw error;
                      if (data.success) {
                        await loadDailyMealPlan(); // Reload from database
                      }
                    } catch (error) {
                      console.error('Error generating meal plan:', error);
                    } finally {
                      setLoadingMealPlan(false);
                    }
                  }}
                  disabled={loadingMealPlan}
                  className="bg-primary hover:bg-primary/90"
                >
                  {loadingMealPlan ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Utensils className="mr-2 h-4 w-4" />
                      Generate Meal Plan
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {dailyMealPlan && (
            <Card className="shadow-card mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Utensils className="h-5 w-5 text-primary" />
                      Today's Meal Plan
                      {loadingMealPlan && <Loader2 className="h-4 w-4 animate-spin" />}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Indonesian meal suggestions with precise gram portions for runners
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setLoadingMealPlan(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
                          body: { date: format(new Date(), 'yyyy-MM-dd') },
                          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
                        });
                        if (error) throw error;
                        if (data.success) {
                          await loadDailyMealPlan(); // Reload from database
                        }
                      } catch (error) {
                        console.error('Error regenerating meal plan:', error);
                      } finally {
                        setLoadingMealPlan(false);
                      }
                    }}
                    disabled={loadingMealPlan}
                    className="flex items-center gap-2"
                  >
                    <Utensils className="h-4 w-4" />
                    Regenerate
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Meal Type Selector */}
                <div className="flex gap-2 mb-4">
                  {['breakfast', 'lunch', 'dinner', 'snack'].map((mealType) => (
                    <Button
                      key={mealType}
                      variant={currentMealType === mealType ? "default" : "outline"}
                      size="sm"
                      onClick={() => switchMealType(mealType)}
                      className="capitalize"
                    >
                      {mealType}
                    </Button>
                  ))}
                </div>

                {/* Swipeable Meal Carousel */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Current Meal Recommendation
                    </h4>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={prevMeal}
                        disabled={getAvailableMeals().length <= 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {currentMealIndex + 1} / {getAvailableMeals().length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={nextMeal}
                        disabled={getAvailableMeals().length <= 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {(() => {
                    const plan = dailyMealPlan[currentMealType];
                    const availableMeals = getAvailableMeals();
                    const currentMeal = availableMeals[currentMealIndex];

                    if (!currentMeal) {
                      return (
                        <div className="p-4 bg-muted/30 border rounded-lg text-center text-muted-foreground">
                          No meal suggestions available for {currentMealType}
                        </div>
                      );
                    }

                    // Get current time for display
                    const now = new Date();
                    const currentTime = now.toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    });

                    return (
                      <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium text-lg capitalize flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {currentMealType} - {currentTime}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {(() => {
                                const baseTarget = plan?.target_calories || 400;
                                const mealsCount = 3;
                                const activityShare = Math.max(0, Math.round(activityCaloriesToday / mealsCount));
                                const adjustedTarget = baseTarget + activityShare;
                                return (
                                  <>
                                    Target: {adjustedTarget} kcal
                                    {activityCaloriesToday > 0 && (
                                      <span className="ml-2 text-xs">(+{activityShare} from today's activity)</span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Current Meal Suggestion */}
                        <div className="space-y-3">
                          <div className="text-lg font-semibold text-primary">
                            🇮🇩 {currentMeal.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {currentMeal.description}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <div className="font-medium mb-2">📋 Bahan & Porsi:</div>
                            <ul className="list-disc list-inside space-y-1">
                              {currentMeal.foods?.map((food: string, index: number) => (
                                <li key={index}>{food}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">🔥 {currentMeal.calories} cal</span>
                            <span className="flex items-center gap-1">🥩 {currentMeal.protein}g protein</span>
                            <span className="flex items-center gap-1">🍚 {currentMeal.carbs}g carbs</span>
                            <span className="flex items-center gap-1">🥑 {currentMeal.fat}g fat</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Week Overview */}
          <div className="space-y-4">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    7-Day Meal Plan
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      disabled={generatingWeek}
                      onClick={regenerateWeek}
                      className="flex items-center gap-2"
                    >
                      {generatingWeek ? <Loader2 className="h-4 w-4 animate-spin" /> : <Utensils className="h-4 w-4" />}
                      {generatingWeek ? 'Recreating…' : 'Recreate Week'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Render each day */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 7 }).map((_, idx) => {
                    const d = new Date();
                    d.setDate(d.getDate() + idx);
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const dayPlans = weeklyPlans[dateStr] || [];
                    const isTraining = !!trainingDays[dateStr];
                    return (
                      <Card key={dateStr} className={isTraining ? "border bg-primary/5" : "border"}>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className={isTraining ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"} />
                            {format(d, 'EEEE, MMM dd')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {dayPlans.length === 0 ? (
                            <div className={isTraining ? "text-sm text-primary" : "text-sm text-muted-foreground"}>
                              {isTraining ? 'Training day — generate to tailor meals.' : 'No plan yet. Generate to fill this day.'}
                            </div>
                          ) : (
                            ['breakfast','lunch','dinner'].map((type) => {
                              const plan = dayPlans.find((p: any) => p.meal_type === type);
                              if (!plan) return null;
                              const first = Array.isArray(plan.meal_suggestions) && plan.meal_suggestions.length > 0 ? plan.meal_suggestions[0] : null;
                              return (
                                <div key={type} className={isTraining ? "p-3 rounded border bg-primary/10 border-primary/20" : "p-3 bg-muted/20 rounded border"}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="font-semibold capitalize">{type}</div>
                                    <div className="text-xs text-muted-foreground">Target: {plan.recommended_calories} kcal</div>
                                  </div>
                                  {first ? (
                                    <div className="text-sm">
                                      <div className="font-medium text-primary">{first.name}</div>
                                      <div className="text-muted-foreground">{first.description}</div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground">No suggestions.</div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            {weekData.map((day) => (
              <Card key={day.date} className="shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-4 w-4 text-primary" />
                      {format(new Date(day.date), 'EEEE, MMM dd')}
                    </CardTitle>
                    <div className="text-sm font-semibold">
                      {day.totalCalories} <span className="text-muted-foreground font-normal">cal</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Macros Summary */}
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

                  {/* Meals */}
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
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
