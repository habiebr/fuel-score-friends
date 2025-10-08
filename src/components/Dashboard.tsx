import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreCard } from '@/components/ScoreCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Target, Users, Zap, TrendingUp, ChevronLeft, ChevronRight, Camera, Utensils, Settings } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { RaceGoalWidget } from '@/components/RaceGoalWidget';
import { CombinedNutritionWidget } from '@/components/CombinedNutritionWidget';
import { RunnerNutritionDashboard } from '@/components/RunnerNutritionDashboard';
import { WeeklyScoreCard } from '@/components/WeeklyScoreCard';
import { getTodayScore, getWeeklyScorePersisted } from '@/services/score.service';
import { getTodayUnifiedScore } from '@/services/unified-score.service';
import { TodayMealScoreCard } from '@/components/TodayMealScoreCard';
import { TodayNutritionCard } from '@/components/TodayNutritionCard';
import { WeeklyKilometersCard } from '@/components/WeeklyMilesCard';
import { UpcomingWorkouts } from '@/components/UpcomingWorkouts';
import { TodayInsightsCard } from '@/components/TodayInsightsCard';
import { format, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { RecoverySuggestion } from '@/components/RecoverySuggestion';
import { accumulatePlannedFromMealPlans, accumulateConsumedFromFoodLogs, computeDailyScore, getActivityMultiplier, deriveMacrosFromCalories } from '@/lib/nutrition';
import { calculateBMR } from '@/lib/nutrition-engine';
import { getWeeklyGoogleFitData, getWeeklyMileageTarget } from '@/lib/weekly-google-fit';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';

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
  calories?: {
    consumed: number;
    target: number;
  };
  macros?: {
    protein?: { consumed: number; target: number };
    carbs?: { consumed: number; target: number };
    fat?: { consumed: number; target: number };
  };
  nextRun?: string;
}

interface DashboardProps {
  onAddMeal?: () => void;
  onAnalyzeFitness?: () => void;
}

export function Dashboard({ onAddMeal, onAnalyzeFitness }: DashboardProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { getTodayData } = useGoogleFitSync();
  const [data, setData] = useState<DashboardData | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyScore, setWeeklyScore] = useState(0);
  const [todayScore, setTodayScore] = useState(0);
  const [todayBreakdown, setTodayBreakdown] = useState<{ nutrition: number; training: number; bonuses?: number; penalties?: number }>({ nutrition: 0, training: 0 });
  // Removed manual generate plan action from dashboard
  const [currentMealIndex, setCurrentMealIndex] = useState(0);
  const [newActivity, setNewActivity] = useState<null | { planned?: string; actual?: string; sessionId: string }>(null);
  const [weeklyGoogleFitData, setWeeklyGoogleFitData] = useState<{ current: number; target: number }>({ current: 0, target: 30 });

  // Function to determine current meal based on time and Google Fit activity patterns
  const getCurrentMealType = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Check if we have Google Fit data to determine activity patterns
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

    setLoading((prev) => prev || !data);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const scoringPromise = Promise.allSettled([
        getTodayUnifiedScore(user.id, 'runner-focused'),
        getWeeklyScorePersisted(user.id)
      ]);

      const weeklyGoogleFitPromise = Promise.all([
        getWeeklyGoogleFitData(user.id),
        getWeeklyMileageTarget(user.id)
      ]);

      const [
        nutritionScoreResult,
        mealPlansResult,
        foodLogsResult,
        profileResult,
        googleFitData
      ] = await Promise.all([
        supabase
          .from('nutrition_scores')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle(),
        supabase
          .from('daily_meal_plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today),
        supabase
          .from('food_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('logged_at', `${today}T00:00:00`)
          .lte('logged_at', `${today}T23:59:59`),
        (supabase as any)
          .from('profiles')
          .select('age, sex, weight_kg, height_cm, activity_level')
          .eq('user_id', user.id)
          .maybeSingle(),
        getTodayData()
      ]);

      const nutritionScore = nutritionScoreResult?.data;
      const rawMealPlans = Array.isArray(mealPlansResult?.data) ? mealPlansResult.data : [];
      const normalizedMealPlans: MealPlan[] = rawMealPlans.map((plan) => ({
        ...plan,
        meal_suggestions: Array.isArray(plan.meal_suggestions)
          ? (plan.meal_suggestions as unknown as MealSuggestion[])
          : []
      }));
      const foodLogs = Array.isArray(foodLogsResult?.data) ? foodLogsResult.data : [];
      const profile = profileResult?.data;

      setMealPlans(normalizedMealPlans);

      const exerciseData = {
        steps: googleFitData?.steps || 0,
        calories_burned: googleFitData?.caloriesBurned || 0,
        active_minutes: googleFitData?.activeMinutes || 0,
        heart_rate_avg: googleFitData?.heartRateAvg || null,
        distance_meters: googleFitData?.distanceMeters || 0,
        sessions: googleFitData?.sessions || []
      };

      const plannedNutrition = accumulatePlannedFromMealPlans(rawMealPlans);
      const consumedNutrition = accumulateConsumedFromFoodLogs(foodLogs);
      
      // Use unified scoring system for more accurate scoring
      const unifiedScoreResult = await getTodayUnifiedScore(user.id, 'runner-focused');
      const dailyScore = unifiedScoreResult.score;

      const bmr = profile ? calculateBMR({
        age: profile.age || 30,
        sex: profile.sex || 'male',
        weightKg: profile.weight_kg || 70,
        heightCm: profile.height_cm || 170
      }) : 1800;
      
      const activityMultiplier = profile?.activity_level 
        ? getActivityMultiplier(profile.activity_level)
        : 1.5;
      
      const calorieTarget = Math.round(bmr * activityMultiplier);
      const macroTargets = deriveMacrosFromCalories(calorieTarget);

      try {
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const weekPlan = profile?.activity_level ? JSON.parse(profile.activity_level) : null;
        const dayPlan = Array.isArray(weekPlan) ? weekPlan.find((d: any) => d && d.day === todayName) : null;
        const plannedText = dayPlan ? `${dayPlan.activity || 'rest'}${dayPlan.distanceKm ? ` ${dayPlan.distanceKm} km` : dayPlan.duration ? ` ${dayPlan.duration} min` : ''}` : 'rest';

        const sessions: any[] = Array.isArray(exerciseData.sessions) ? [...exerciseData.sessions] : [];
        sessions.sort((a, b) => (parseInt(b.endTimeMillis || '0') - parseInt(a.endTimeMillis || '0')));
        const latest = sessions[0];
        if (latest) {
          const id = `${latest.startTimeMillis}-${latest.endTimeMillis}`;
          const lastAck = localStorage.getItem('lastAckSessionId');
          const ended = parseInt(latest.endTimeMillis || '0');
          const isRecent = Date.now() - ended < 6 * 60 * 60 * 1000;
          const activityType = (latest.activityType || latest.application || latest.name || 'activity').toString();
          const actualText = `${activityType}${latest?.distance ? ` ${(latest.distance / 1000).toFixed(1)} km` : ''}`;
          if (isRecent && id !== lastAck) {
            setNewActivity({ planned: plannedText, actual: actualText, sessionId: id });
          }
        }
      } catch (_) {}

      setData({
        dailyScore,
        caloriesConsumed: consumedNutrition.calories,
        proteinGrams: consumedNutrition.protein,
        carbsGrams: consumedNutrition.carbs,
        fatGrams: consumedNutrition.fat,
        mealsLogged: foodLogs.length,
        steps: exerciseData.steps,
        caloriesBurned: exerciseData.calories_burned,
        activeMinutes: exerciseData.active_minutes,
        heartRateAvg: exerciseData.heart_rate_avg,
        plannedCalories: plannedNutrition.calories,
        plannedProtein: plannedNutrition.protein,
        plannedCarbs: plannedNutrition.carbs,
        plannedFat: plannedNutrition.fat,
        breakfastScore: nutritionScore?.breakfast_score || null,
        lunchScore: nutritionScore?.lunch_score || null,
        dinnerScore: nutritionScore?.dinner_score || null,
        calories: {
          consumed: consumedNutrition.calories,
          target: calorieTarget
        },
        macros: {
          protein: {
            consumed: consumedNutrition.protein,
            target: macroTargets.protein
          },
          carbs: {
            consumed: consumedNutrition.carbs,
            target: macroTargets.carbs
          },
          fat: {
            consumed: consumedNutrition.fat,
            target: macroTargets.fat
          }
        }
      });

      const [todayScoreOutcome, weeklyScoreOutcome] = await scoringPromise;
      if (todayScoreOutcome.status === 'fulfilled') {
        setTodayScore(todayScoreOutcome.value.score);
        setTodayBreakdown(todayScoreOutcome.value.breakdown);
      } else {
        setTodayScore(0);
        setTodayBreakdown({ nutrition: 0, training: 0 });
      }

      if (weeklyScoreOutcome.status === 'fulfilled') {
        setWeeklyScore(weeklyScoreOutcome.value);
      } else {
        setWeeklyScore(0);
      }

      try {
        const [weeklyData, target] = await weeklyGoogleFitPromise;
        setWeeklyGoogleFitData({
          current: weeklyData.totalDistanceKm,
          target
        });
      } catch (e) {
        console.error('Error loading weekly Google Fit data:', e);
      }
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

  // Calculate meal score and timing
  const calculateMealScore = () => {
    // Mock calculation based on actual nutrition data
    const safePct = (consumed?: number, target?: number) => {
      if (!target || target <= 0) return 0;
      const pct = ((consumed || 0) / target) * 100;
      if (!isFinite(pct) || isNaN(pct)) return 0;
      return Math.min(pct, 100);
    };
    const proteinScore = safePct(data?.macros?.protein?.consumed, data?.macros?.protein?.target);
    const carbsScore = safePct(data?.macros?.carbs?.consumed, data?.macros?.carbs?.target);
    const fatScore = safePct(data?.macros?.fat?.consumed, data?.macros?.fat?.target);
    
    const avgScore = Math.round((proteinScore + carbsScore + fatScore) / 3);
    
    if (avgScore >= 80) return { score: avgScore, rating: 'Excellent' as const };
    if (avgScore >= 65) return { score: avgScore, rating: 'Good' as const };
    if (avgScore >= 50) return { score: avgScore, rating: 'Fair' as const };
    return { score: avgScore, rating: 'Needs Improvement' as const };
  };

  const mealScore = calculateMealScore();

  // Get upcoming workouts from user data
  const nextWorkout = data?.nextRun ? {
    type: 'Tempo Run',
    date: new Date(data.nextRun),
    distance: 8
  } : undefined;

  // Pre-run meal suggestion with nutrition details
  const preRunMeal = nextWorkout ? {
    food: 'Banana + Almond Butter',
    time: new Date(nextWorkout.date.getTime() - 60 * 60000), // 1 hour before
    calories: 280,
    carbs: 34,
    protein: 8,
    fat: 14,
    notes: [
      'Banana provides quick-release carbs for energy',
      'Almond butter adds healthy fats for sustained energy',
      'Light and easy to digest before running',
      'Aim to finish eating 1 hour before your run'
    ]
  } : undefined;

  // Today's insights
  const insights = [
    {
      icon: 'zap' as const,
      title: 'Pre-Run Nutrition',
      message: nextWorkout 
        ? `Tempo run tomorrow - have your pre-run snack 1 hour before.`
        : 'Plan your pre-run nutrition for optimal performance.',
      color: 'bg-blue-50 dark:bg-blue-900/20',
      details: [
        'Eat 1-2 hours before running',
        'Focus on easily digestible carbs',
        'Include a small amount of protein',
        'Stay hydrated'
      ]
    },
    {
      icon: 'droplets' as const,
      title: 'Hydration Goal',
      message: '2 glasses away from your daily goal. Great progress!',
      color: 'bg-green-50 dark:bg-green-900/20'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-background p-3 pb-28 safe-area-inset">
      <div className="max-w-none mx-auto">
        {/* Header - NutriSync Branding */}
        <div className="mb-6 pt-2">
          <div className="flex items-center justify-between">
            <AppHeader />
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                Customize
              </Button>
            </div>
          </div>
        </div>

        {/* Recovery Suggestion */}
        {newActivity && (
          <RecoverySuggestion
            sessionEnd={new Date(parseInt(newActivity.sessionId.split('-')[1]))}
            intensity={newActivity.actual.toLowerCase().includes('tempo') || newActivity.actual.toLowerCase().includes('interval') ? 'high' : 'moderate'}
            duration={60} // TODO: Get from Google Fit session
            distance={parseFloat(newActivity.actual.match(/(\d+\.?\d*)\s*km/)?.[1] || '0')}
            calories_burned={data?.caloriesBurned || 0}
            onDismiss={() => {
              localStorage.setItem('lastAckSessionId', newActivity.sessionId);
              setNewActivity(null);
            }}
          />
        )}

        {/* 1. Today & Weekly Scores */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <ScoreCard 
            title="Daily Score" 
            score={todayScore} 
            subtitle="Today" 
            variant="success" 
            tooltip={
              <>
                <p className="font-semibold">🟢 Daily Score</p>
                <p>Reflects how well you met today&apos;s nutrition and training goals.</p>
                <p>Resets every day to track your daily balance.</p>
              </>
            }
          />
          <ScoreCard 
            title="Weekly Score" 
            score={weeklyScore} 
            subtitle="Mon–Sun avg" 
            variant="warning"
            tooltip={
              <>
                <p className="font-semibold">🟠 Weekly Score</p>
                <p>Shows your 7-day average performance and consistency.</p>
                <p>Higher scores mean steadier nutrition–training habits.</p>
              </>
            }
          />
        </div>

        {/* 2. Marathon Countdown */}
        <div className="mb-5">
          <RaceGoalWidget />
        </div>

        {/* 3. Today's Meal Score */}
        <div className="mb-5">
          <TodayMealScoreCard
            score={mealScore.score}
            rating={mealScore.rating}
          />
        </div>

        {/* 4. Today's Nutrition */}
        <div className="mb-5">
          <TodayNutritionCard
            calories={{
              current: data?.calories?.consumed || 0,
              target: data?.calories?.target || 2400
            }}
            protein={{
              current: data?.macros?.protein?.consumed || 0,
              target: data?.macros?.protein?.target || 120,
              color: '#3F8CFF'
            }}
            carbs={{
              current: data?.macros?.carbs?.consumed || 0,
              target: data?.macros?.carbs?.target || 330,
              color: '#39D98A'
            }}
            fat={{
              current: data?.macros?.fat?.consumed || 0,
              target: data?.macros?.fat?.target || 67,
              color: '#FFC15E'
            }}
            showEducation={true}
          />
        </div>

        {/* 5. Weekly Kilometers */}
        <div className="mb-5">
          <WeeklyKilometersCard
            current={weeklyGoogleFitData.current}
            target={weeklyGoogleFitData.target}
          />
        </div>

        {/* 6. Upcoming Workouts */}
        {(nextWorkout || preRunMeal) && (
          <div className="mb-5">
            <UpcomingWorkouts
              workouts={nextWorkout ? [nextWorkout] : []}
              preRunMeal={preRunMeal}
            />
          </div>
        )}

        {/* 7. Today's Insights */}
        <div className="mb-5">
          <TodayInsightsCard insights={insights} />
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
