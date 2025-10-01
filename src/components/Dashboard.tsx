import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreCard } from '@/components/ScoreCard';
import { DailyNutritionSummary } from '@/components/DailyNutritionSummary';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Target, Users, Zap, TrendingUp, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { accumulatePlannedFromMealPlans, accumulateConsumedFromFoodLogs, computeDailyScore, calculateBMR, getActivityMultiplier, deriveMacrosFromCalories } from '@/lib/nutrition';

interface MealSuggestion {
  name: string;
  foods: string[];
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealPlan {
  meal_type: string;
  recommended_calories: number;
  recommended_protein_grams: number;
  recommended_carbs_grams: number;
  recommended_fat_grams: number;
  meal_suggestions: MealSuggestion[];
  meal_score: number | null;
}

interface DashboardData {
  dailyScore: number;
  caloriesConsumed: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  mealsLogged: number;
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  heartRateAvg?: number | null;
  plannedCalories: number;
  plannedProtein: number;
  plannedCarbs: number;
  plannedFat: number;
  breakfastScore: number | null;
  lunchScore: number | null;
  dinnerScore: number | null;
}

interface DashboardProps {
  onAddMeal?: () => void;
}

export function Dashboard({ onAddMeal }: DashboardProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [raceGoal, setRaceGoal] = useState<string>('');
  // targetMonths is shown as a derived label; compute dynamically from raceDate
  const [raceDate, setRaceDate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [currentMealIndex, setCurrentMealIndex] = useState(0);

  // Function to determine current meal based on time and wearable data patterns
  const getCurrentMealType = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Check if we have wearable stats to determine patterns
    if (data) {
      const steps = data.steps || 0;
      const calories_burned = data.caloriesBurned || 0;
      const heart_rate_avg = data.heartRateAvg || 0;
      
      // If user has been very active (high steps, high calories), they might need more frequent meals
      if (steps > 8000 || calories_burned > 500) {
        // More frequent meal pattern for active users
        if (currentHour >= 5 && currentHour < 10) return 'breakfast';
        if (currentHour >= 10 && currentHour < 14) return 'lunch';
        if (currentHour >= 14 && currentHour < 18) return 'snack';
        if (currentHour >= 18 && currentHour < 22) return 'dinner';
        return 'breakfast'; // Default to breakfast for very early/late hours
      }
      
      // If user has elevated heart rate, they might need energy
      if (heart_rate_avg && heart_rate_avg > 80) {
        if (currentHour >= 5 && currentHour < 11) return 'breakfast';
        if (currentHour >= 11 && currentHour < 16) return 'lunch';
        if (currentHour >= 16 && currentHour < 21) return 'dinner';
        return 'breakfast';
      }
    }
    
    // Default time-based pattern
    if (currentHour >= 5 && currentHour < 11) return 'breakfast';
    if (currentHour >= 11 && currentHour < 16) return 'lunch';
    if (currentHour >= 16 && currentHour < 21) return 'dinner';
    return 'breakfast'; // Default to breakfast for very early/late hours
  };

  // Carousel navigation functions
  const nextMeal = () => {
    setCurrentMealIndex((prev) => (prev + 1) % getAvailableMeals().length);
  };

  const prevMeal = () => {
    setCurrentMealIndex((prev) => (prev - 1 + getAvailableMeals().length) % getAvailableMeals().length);
  };

  const getAvailableMeals = () => {
    const currentMealType = getCurrentMealType();
    const plan = mealPlans.find(p => p.meal_type === currentMealType);
    
    if (plan && plan.meal_suggestions && Array.isArray(plan.meal_suggestions) && plan.meal_suggestions.length > 0) {
      return plan.meal_suggestions;
    }
    
    // Fallback to static suggestions
    const targetCalories = plan?.recommended_calories || 400;
    const indonesianSuggestion = getIndonesianMealSuggestions(currentMealType, targetCalories);
    return [indonesianSuggestion];
  };

  // Indonesian food suggestions with portions
  const getIndonesianMealSuggestions = (mealType: string, targetCalories: number) => {
    const suggestions = {
      breakfast: [
        {
          name: "Nasi Uduk + Ayam Goreng",
          description: "Nasi uduk dengan ayam goreng dan sambal kacang",
          foods: [
            "Nasi uduk (150g)",
            "Ayam goreng (100g)", 
            "Sambal kacang (30g)",
            "Timun (50g)",
            "Daun seledri (5g)"
          ],
          calories: 450,
          protein: 25,
          carbs: 45,
          fat: 18
        },
        {
          name: "Bubur Ayam",
          description: "Bubur nasi dengan ayam suwir dan pelengkap",
          foods: [
            "Bubur nasi (200g)",
            "Ayam suwir (80g)", 
            "Kacang kedelai (20g)",
            "Daun seledri (10g)",
            "Bawang goreng (5g)"
          ],
          calories: 380,
          protein: 22,
          carbs: 42,
          fat: 12
        },
        {
          name: "Lontong Sayur",
          description: "Lontong dengan sayur labu siam dan kuah santan",
          foods: [
            "Lontong (120g)",
            "Sayur labu siam (150g)", 
            "Santan (100ml)",
            "Tempe (50g)",
            "Bawang merah (10g)"
          ],
          calories: 320,
          protein: 18,
          carbs: 38,
          fat: 14
        }
      ],
      lunch: [
        {
          name: "Nasi Padang",
          description: "Nasi putih dengan rendang dan sayuran",
          foods: [
            "Nasi putih (150g)",
            "Rendang daging (100g)", 
            "Sayur daun singkong (100g)",
            "Sambal ijo (20g)",
            "Kerupuk (10g)"
          ],
          calories: 650,
          protein: 35,
          carbs: 55,
          fat: 28
        },
        {
          name: "Gado-gado",
          description: "Salad sayuran dengan bumbu kacang",
          foods: [
            "Sayuran segar (200g)",
            "Tahu (80g)", 
            "Tempe (60g)",
            "Bumbu kacang (45g)",
            "Kerupuk (15g)"
          ],
          calories: 420,
          protein: 28,
          carbs: 35,
          fat: 22
        },
        {
          name: "Soto Ayam",
          description: "Sup ayam dengan bumbu kuning dan pelengkap",
          foods: [
            "Daging ayam (120g)",
            "Nasi putih (150g)", 
            "Tauge (60g)",
            "Bawang goreng (10g)",
            "Sambal (15g)"
          ],
          calories: 480,
          protein: 32,
          carbs: 48,
          fat: 16
        }
      ],
      dinner: [
        {
          name: "Pecel Lele",
          description: "Lele goreng dengan sambal dan lalapan",
          foods: [
            "Lele goreng (200g)",
            "Nasi putih (150g)", 
            "Lalapan (100g)",
            "Sambal terasi (30g)",
            "Daun kemangi (10g)"
          ],
          calories: 520,
          protein: 38,
          carbs: 45,
          fat: 20
        },
        {
          name: "Rawon",
          description: "Sup daging dengan bumbu hitam khas Jawa Timur",
          foods: [
            "Daging sapi (120g)",
            "Nasi putih (150g)", 
            "Tauge (60g)",
            "Bawang goreng (10g)",
            "Sambal (15g)"
          ],
          calories: 480,
          protein: 35,
          carbs: 42,
          fat: 18
        },
        {
          name: "Ayam Bakar",
          description: "Ayam bakar dengan bumbu kecap dan nasi",
          foods: [
            "Ayam bakar (150g)",
            "Nasi putih (150g)", 
            "Tempe goreng (60g)",
            "Sambal (15g)",
            "Timun (50g)"
          ],
          calories: 450,
          protein: 30,
          carbs: 40,
          fat: 16
        }
      ]
    };

    const mealSuggestions = suggestions[mealType as keyof typeof suggestions] || [];
    
    // Find the suggestion closest to target calories
    const closestSuggestion = mealSuggestions.reduce((closest, current) => {
      const closestDiff = Math.abs(closest.calories - targetCalories);
      const currentDiff = Math.abs(current.calories - targetCalories);
      return currentDiff < closestDiff ? current : closest;
    }, mealSuggestions[0]);

    return closestSuggestion || mealSuggestions[0];
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
      loadGoals();
    }
  }, [user]);

  // Realtime: refresh when profile or meal plans change
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, () => {
        loadGoals();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_meal_plans', filter: `user_id=eq.${user.id}` }, () => {
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_logs', filter: `user_id=eq.${user.id}` }, () => {
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wearable_data', filter: `user_id=eq.${user.id}` }, () => {
        loadDashboardData();
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [user]);

  // Countdown timer effect
  useEffect(() => {
    if (!raceDate) return;

    const updateCountdown = () => {
      const now = new Date();
      const target = new Date(raceDate);
      
      console.log('Countdown update:', { now, target, raceDate });
      
      if (target <= now) {
        console.log('Target date has passed');
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const totalSeconds = differenceInSeconds(target, now);
      const days = Math.floor(totalSeconds / (24 * 60 * 60));
      const hours = differenceInHours(target, now) % 24;
      const minutes = differenceInMinutes(target, now) % 60;
      const seconds = differenceInSeconds(target, now) % 60;

      console.log('Countdown calculated:', { days, hours, minutes, seconds });
      setCountdown({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [raceDate]);

  const loadGoals = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('fitness_goals, goal_type, goal_name, target_date, fitness_level, activity_level')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Profile data:', profile);

      if (profile) {
        const formatLabel = (value?: string | null) => {
          if (!value) return '';
          return String(value)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
        };

        const goalName = profile.goal_name && String(profile.goal_name).trim().length > 0
          ? profile.goal_name
          : (Array.isArray(profile.fitness_goals) && profile.fitness_goals.length > 0
            ? String(profile.fitness_goals[0])
            : formatLabel(profile.goal_type));

        setRaceGoal(goalName || '');
        console.log('Race goal set:', goalName);

        // Use target_date from profile if available
        if (profile.target_date) {
          const targetDate = new Date(profile.target_date);
          setRaceDate(targetDate);
          console.log('Target date set:', targetDate);
        } else {
          // Try to find the marathon event matching this goal as fallback
          const { data: marathonEvent } = await supabase
            .from('marathon_events')
            .select('event_date, event_name')
            .ilike('event_name', `%${goalName}%`)
            .maybeSingle();

          if (marathonEvent) {
            setRaceDate(new Date(marathonEvent.event_date));
            console.log('Marathon event date set:', marathonEvent.event_date);
          } else {
            console.log('No target date or marathon event found');
          }
        }
      } else {
        console.log('No fitness goals found in profile');
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const generateDailyMealPlan = async () => {
    if (!user) return;
    
    setGeneratingPlan(true);
    try {
      console.log('Generating meal plan...');
      const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
        body: { date: format(new Date(), 'yyyy-MM-dd') },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      
      if (error) {
        console.error('Error generating meal plan:', error);
        toast({
          title: 'Generation failed',
          description: error.message || 'Unable to generate meal plan. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      console.log('Meal plan generated:', data);
      toast({
        title: 'Success!',
        description: 'Your daily meal plan has been generated',
      });

      // Reload dashboard data after successful generation
      await loadDashboardData();
    } catch (error) {
      console.error('Error invoking meal plan function:', error);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPlan(false);
    }
  };

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch nutrition score for today
      const { data: nutritionScore } = await supabase
        .from('nutrition_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      // Fetch wearable data for today
      const { data: wearableRaw } = await (supabase as any)
        .from('wearable_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      const wearableData: any = wearableRaw as any;

      // Fetch meal plans for today
      const { data: plans } = await supabase
        .from('daily_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      // Fetch food logs for today (actual consumed)
      const { data: foodLogs } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`);

      if (plans) {
        setMealPlans(plans.map(plan => ({
          ...plan,
          meal_suggestions: (plan.meal_suggestions as unknown as MealSuggestion[]) || []
        })));
      }

      const plannedNutrition = accumulatePlannedFromMealPlans(plans || []);
      const consumedNutrition = accumulateConsumedFromFoodLogs(foodLogs || []);
      const dailyScore = computeDailyScore(plannedNutrition, consumedNutrition, wearableData?.calories_burned || 0);

      setData({
        dailyScore,
        caloriesConsumed: consumedNutrition.calories,
        proteinGrams: consumedNutrition.protein,
        carbsGrams: consumedNutrition.carbs,
        fatGrams: consumedNutrition.fat,
        mealsLogged: foodLogs?.length || 0,
        steps: wearableData?.steps || 0,
        caloriesBurned: wearableData?.calories_burned || 0,
        activeMinutes: wearableData?.active_minutes || 0,
        heartRateAvg: wearableData?.heart_rate_avg ?? null,
        plannedCalories: plannedNutrition.calories,
        plannedProtein: plannedNutrition.protein,
        plannedCarbs: plannedNutrition.carbs,
        plannedFat: plannedNutrition.fat,
        breakfastScore: nutritionScore?.breakfast_score || null,
        lunchScore: nutritionScore?.lunch_score || null,
        dinnerScore: nutritionScore?.dinner_score || null,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-primary rounded-full animate-pulse-glow"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background p-3 sm:p-4 pb-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Good morning! 👋
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {format(new Date(), 'EEEE, MMMM do')}
          </p>
        </div>

        {/* Daily Score - Hero Section */}
        <div className="mb-6">
          <ScoreCard
            title="Daily Score"
            score={data?.dailyScore || 0}
            maxScore={100}
            subtitle="Keep it up!"
            variant="success"
            className="animate-fade-in"
          />
        </div>


        {/* Daily Nutrient Needs (TDEE-based) */}
        <Card className="shadow-card mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Daily Nutrient Needs</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">Calories Target</div>
                  <div className="font-semibold">
                    {(() => {
                      const hasPlanned = (data.plannedCalories || 0) > 0;
                      const total = hasPlanned
                        ? Math.max(0, (data.plannedCalories || 0) + (data.caloriesBurned || 0))
                        : (() => {
                            const bmr = calculateBMR((user as any)?.user_metadata?.weight || null, (user as any)?.user_metadata?.height || null, (user as any)?.user_metadata?.age || null);
                            const mult = getActivityMultiplier((user as any)?.user_metadata?.activity_level || 'moderate');
                            const base = bmr > 0 ? Math.round(bmr * mult) : 0;
                            return Math.max(0, base + (data.caloriesBurned || 0));
                          })();
                      return `${total} kcal`;
                    })()}
                  </div>
                  {data.caloriesBurned > 0 && (
                    <div className="text-[11px] text-muted-foreground">includes +{data.caloriesBurned} activity</div>
                  )}
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">Protein</div>
                  <div className="font-semibold">
                    {(() => {
                      const hasPlanned = (data.plannedProtein || 0) > 0;
                      if (hasPlanned) return `${data.plannedProtein} g`;
                      const bmr = calculateBMR((user as any)?.user_metadata?.weight || null, (user as any)?.user_metadata?.height || null, (user as any)?.user_metadata?.age || null);
                      const mult = getActivityMultiplier((user as any)?.user_metadata?.activity_level || 'moderate');
                      const base = bmr > 0 ? Math.round(bmr * mult) : 0;
                      const total = Math.max(0, base + (data.caloriesBurned || 0));
                      const macros = deriveMacrosFromCalories(total);
                      return `${macros.protein} g`;
                    })()}
                  </div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">Carbs</div>
                  <div className="font-semibold">
                    {(() => {
                      const hasPlanned = (data.plannedCarbs || 0) > 0;
                      if (hasPlanned) return `${data.plannedCarbs} g`;
                      const bmr = calculateBMR((user as any)?.user_metadata?.weight || null, (user as any)?.user_metadata?.height || null, (user as any)?.user_metadata?.age || null);
                      const mult = getActivityMultiplier((user as any)?.user_metadata?.activity_level || 'moderate');
                      const base = bmr > 0 ? Math.round(bmr * mult) : 0;
                      const total = Math.max(0, base + (data.caloriesBurned || 0));
                      const macros = deriveMacrosFromCalories(total);
                      return `${macros.carbs} g`;
                    })()}
                  </div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">Fat</div>
                  <div className="font-semibold">
                    {(() => {
                      const hasPlanned = (data.plannedFat || 0) > 0;
                      if (hasPlanned) return `${data.plannedFat} g`;
                      const bmr = calculateBMR((user as any)?.user_metadata?.weight || null, (user as any)?.user_metadata?.height || null, (user as any)?.user_metadata?.age || null);
                      const mult = getActivityMultiplier((user as any)?.user_metadata?.activity_level || 'moderate');
                      const base = bmr > 0 ? Math.round(bmr * mult) : 0;
                      const total = Math.max(0, base + (data.caloriesBurned || 0));
                      const macros = deriveMacrosFromCalories(total);
                      return `${macros.fat} g`;
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No targets yet — generate a meal plan first.</div>
            )}
          </CardContent>
        </Card>

        {/* Race Goals Widget */}
        {raceGoal ? (
          <Card className="shadow-card mb-6 bg-gradient-to-br from-primary/5 to-primary-glow/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Race Goal</span>
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {raceGoal}
                  </div>
                  {raceDate && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Target: {Math.max(0, Math.floor(differenceInDays(raceDate, new Date()) / 30))} months
                    </div>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/goals')}
                  className="text-primary hover:text-primary-glow"
                >
                  Update
                </Button>
              </div>

              {/* Countdown Timer */}
              {countdown && raceDate && (
                <div className="pt-3 border-t border-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Time until race:
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center bg-primary/10 rounded-lg p-2">
                      <div className="text-xl font-bold text-primary">
                        {countdown.days}
                      </div>
                      <div className="text-xs text-muted-foreground">Days</div>
                    </div>
                    <div className="text-center bg-primary/10 rounded-lg p-2">
                      <div className="text-xl font-bold text-primary">
                        {countdown.hours}
                      </div>
                      <div className="text-xs text-muted-foreground">Hours</div>
                    </div>
                    <div className="text-center bg-primary/10 rounded-lg p-2">
                      <div className="text-xl font-bold text-primary">
                        {countdown.minutes}
                      </div>
                      <div className="text-xs text-muted-foreground">Mins</div>
                    </div>
                    <div className="text-center bg-primary/10 rounded-lg p-2">
                      <div className="text-xl font-bold text-primary">
                        {countdown.seconds}
                      </div>
                      <div className="text-xs text-muted-foreground">Secs</div>
                    </div>
                  </div>
                  <div className="text-xs text-center text-muted-foreground mt-2">
                    Race date: {format(raceDate, 'MMM dd, yyyy')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card mb-6 bg-gradient-to-br from-muted/5 to-muted/10 border-muted/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm text-muted-foreground">Race Goal</span>
                  </div>
                  <div className="text-lg font-bold text-muted-foreground">
                    No goal set
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Set your running goal to see countdown timer
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/goals')}
                  className="text-primary hover:text-primary-glow"
                >
                  Set Goal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Nutrition Summary */}
        <DailyNutritionSummary />

        {/* Today's Nutrition Plan */}
        <Card className="shadow-card mb-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Target className="h-5 w-5 text-primary" />
                Today's Nutrition Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mealPlans.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    No meal plan for today.
                  </p>
                  <Button 
                    onClick={generateDailyMealPlan}
                    disabled={generatingPlan}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {generatingPlan ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Target className="mr-2 h-4 w-4" />
                        Generate Meal Plan
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(['breakfast','lunch','dinner'] as const).map((type) => {
                    const plan = mealPlans.find(p => p.meal_type === type);
                    if (!plan) return null;
                    const first = Array.isArray(plan.meal_suggestions) && plan.meal_suggestions.length > 0 ? plan.meal_suggestions[0] : null;
                    return (
                      <div key={type} className="p-4 bg-muted/20 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold capitalize">{type}</div>
                          <div className="text-xs text-muted-foreground">Target: {plan.recommended_calories} kcal</div>
                        </div>
                        {first ? (
                          <div className="space-y-2 text-sm">
                            <div className="font-medium text-primary">{first.name}</div>
                            <div className="text-muted-foreground">{first.description}</div>
                            <div className="flex gap-4 text-muted-foreground">
                              <span>🔥 {first.calories} cal</span>
                              <span>🥩 {first.protein}g</span>
                              <span>🍚 {first.carbs}g</span>
                              <span>🥑 {first.fat}g</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No suggestion available.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        {/* Additional Sections */}
        <div className="space-y-4 sm:space-y-6">


          {/* Quick Actions */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/meals')}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Meal Diary
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/profile')}
              >
                <Target className="h-4 w-4 mr-2" />
                Profile & Goals
              </Button>
              <Button 
                variant="default" 
                className="w-full col-span-2"
                onClick={generateDailyMealPlan}
                disabled={generatingPlan}
              >
                <Zap className="h-4 w-4 mr-2" />
                {generatingPlan ? 'Generating...' : 'Generate Daily Plan'}
              </Button>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}