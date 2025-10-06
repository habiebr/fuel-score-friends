import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreCard } from '@/components/ScoreCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Target, Users, Zap, TrendingUp, ChevronLeft, ChevronRight, Camera, Utensils } from 'lucide-react';
import { RaceGoalWidget } from '@/components/RaceGoalWidget';
import { CombinedNutritionWidget } from '@/components/CombinedNutritionWidget';
import { RunnerNutritionDashboard } from '@/components/RunnerNutritionDashboard';
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
  onAnalyzeFitness?: () => void;
}

export function Dashboard({ onAddMeal, onAnalyzeFitness }: DashboardProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  // Removed manual generate plan action from dashboard
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
    }
  }, [user]);

  // Realtime: refresh when profile or meal plans change
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dashboard-realtime')
      // profiles changes previously drove race goal widget; removed
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

  // race goal widget removed

  // Manual plan generation removed

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

      // Fetch wearable data for today (pick latest if duplicates exist)
      const { data: wearableList } = await (supabase as any)
        .from('wearable_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1);
      const wearableData: any = Array.isArray(wearableList) && wearableList.length > 0 ? wearableList[0] : null;

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
    <div className="min-h-screen bg-gradient-background p-4 pb-28 safe-area-inset">
      <div className="w-full mx-auto">
        {/* Header - Mobile Optimized */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            Good morning! 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), 'EEEE, MMMM do')}
          </p>
        </div>

        {/* Quick Stats Row - Mobile Optimized */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* 1. Daily Score - Compact */}
          <ScoreCard
            title="Score"
            score={data?.dailyScore || 0}
            maxScore={100}
            subtitle="Today"
            variant="success"
            className="animate-fade-in"
          />

          {/* 2. Race Goal Widget - Compact */}
          <RaceGoalWidget />
        </div>

        {/* 3. Runner Nutrition Dashboard - Featured Section */}
        <div className="mb-4">
          <RunnerNutritionDashboard />
        </div>

        {/* 4. Additional Tools - Mobile Optimized */}
        <div className="grid grid-cols-1 gap-3 mb-4">
          {/* Quick Recovery Plan - Touch-Friendly */}
          <Card className="shadow-card active:scale-[0.98] transition-transform">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Camera className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base leading-tight">Recovery Plan</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload activity photo</p>
                </div>
                <Button 
                  onClick={onAnalyzeFitness}
                  size="lg"
                  className="flex-shrink-0 h-11 w-11 p-0"
                >
                  <Camera className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Add Meal Quick Action - Info Card */}
          <Card className="shadow-card bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-900/10 dark:to-pink-900/10 border-orange-200 dark:border-orange-800 active:scale-[0.98] transition-transform">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Utensils className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base leading-tight">Quick Meal Log</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Tap the orange button below →</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center animate-pulse">
                  <Target className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 4. Today's Nutrition Plan - Carousel */}
        <Card className="shadow-card mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Target className="h-5 w-5 text-primary" />
              Today's Nutrition Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mealPlans.length === 0 ? (
              <>
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    No meal plan found for today. Showing default runner-friendly suggestions.
                  </p>
                </div>
                <div className="relative">
                  <div className="overflow-hidden">
                    <div className="flex transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${currentMealIndex * 100}%)` }}>
                      {([
                        { meal_type: 'breakfast', target: 400, suggestion: getIndonesianMealSuggestions('breakfast', 400) },
                        { meal_type: 'lunch', target: 600, suggestion: getIndonesianMealSuggestions('lunch', 600) },
                        { meal_type: 'dinner', target: 600, suggestion: getIndonesianMealSuggestions('dinner', 600) },
                      ] as const).map((m) => (
                        <div key={m.meal_type} className="w-full flex-shrink-0 px-2">
                          <div className="p-4 bg-muted/20 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-semibold capitalize">{m.meal_type}</div>
                              <div className="text-xs text-muted-foreground">Target: {m.target} kcal</div>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="font-medium text-primary">{m.suggestion.name}</div>
                              <div className="text-muted-foreground">{m.suggestion.description}</div>
                              <div className="flex gap-4 text-muted-foreground">
                                <span>🔥 {m.suggestion.calories} cal</span>
                                <span>🥩 {m.suggestion.protein}g</span>
                                <span>🍚 {m.suggestion.carbs}g</span>
                                <span>🥑 {m.suggestion.fat}g</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-center mt-4 space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMealIndex(Math.max(0, currentMealIndex - 1))}
                      disabled={currentMealIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex space-x-1">
                      {[0, 1, 2].map((index) => (
                        <button
                          key={index}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            index === currentMealIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                          onClick={() => setCurrentMealIndex(index)}
                        />
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMealIndex(Math.min(2, currentMealIndex + 1))}
                      disabled={currentMealIndex === 2}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="relative">
                <div className="overflow-hidden">
                  <div className="flex transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${currentMealIndex * 100}%)` }}>
                    {(['breakfast','lunch','dinner'] as const).map((type) => {
                      const plan = mealPlans.find(p => p.meal_type === type);
                      if (!plan) return null;
                      const first = Array.isArray(plan.meal_suggestions) && plan.meal_suggestions.length > 0 ? plan.meal_suggestions[0] : null;
                      return (
                        <div key={type} className="w-full flex-shrink-0 px-2">
                          <div className="p-4 bg-muted/20 rounded-lg border">
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
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-center mt-4 space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMealIndex(Math.max(0, currentMealIndex - 1))}
                    disabled={currentMealIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex space-x-1">
                    {[0, 1, 2].map((index) => (
                      <button
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === currentMealIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                        onClick={() => setCurrentMealIndex(index)}
                      />
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMealIndex(Math.min(2, currentMealIndex + 1))}
                    disabled={currentMealIndex === 2}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


      </div>
    </div>
  );
}