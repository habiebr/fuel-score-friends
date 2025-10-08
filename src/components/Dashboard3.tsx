import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreCard } from '@/components/ScoreCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Target, Users, Zap, TrendingUp, ChevronLeft, ChevronRight, Camera, Utensils, Settings } from 'lucide-react';
import { Home } from 'lucide-react';
import { PageHeading } from '@/components/PageHeading';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
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
import { format } from 'date-fns';
import { RecoverySuggestion } from '@/components/RecoverySuggestion';
import { accumulatePlannedFromMealPlans, accumulateConsumedFromFoodLogs, getActivityMultiplier, deriveMacrosFromCalories } from '@/lib/nutrition';
import { calculateBMR } from '@/lib/nutrition-engine';
import { getWeeklyGoogleFitData, getWeeklyMileageTarget } from '@/lib/weekly-google-fit';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';

// Simple TTL cache helpers (localStorage) for faster first paint
const DASHBOARD_CACHE_KEY = 'dashboard3:data:v1';
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readDashboardCache(userId?: string) {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.userId !== userId) return null;
    if (Date.now() - (parsed.ts || 0) > DASHBOARD_CACHE_TTL_MS) return null;
    return parsed.payload as DashboardData & { weeklyScore?: number; weeklyKm?: { current: number; target: number } };
  } catch { return null; }
}

function writeDashboardCache(userId: string, payload: any) {
  try {
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ userId, ts: Date.now(), payload }));
  } catch {}
}

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

export function Dashboard3({ onAddMeal, onAnalyzeFitness }: DashboardProps) {
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
  const [newActivity, setNewActivity] = useState<null | { planned?: string; actual?: string; sessionId: string }>(null);
  const [weeklyGoogleFitData, setWeeklyGoogleFitData] = useState<{ current: number; target: number }>({ current: 0, target: 30 });
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);

  useEffect(() => {
    if (user) {
      // Fast-path: hydrate from cache
      const cached = readDashboardCache(user.id);
      if (cached) {
        setData(cached);
        setTodayScore((cached as any).dailyScore || 0);
        if ((cached as any).weeklyScore !== undefined) setWeeklyScore((cached as any).weeklyScore || 0);
        if ((cached as any).weeklyKm) setWeeklyGoogleFitData((cached as any).weeklyKm);
      }
      fetchEdgeData();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dashboard-realtime')
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
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [user]);

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
      const [ nutritionScoreResult, mealPlansResult, foodLogsResult, profileResult, googleFitData ] = await Promise.all([
        supabase.from('nutrition_scores').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
        supabase.from('daily_meal_plans').select('*').eq('user_id', user.id).eq('date', today),
        supabase.from('food_logs').select('*').eq('user_id', user.id).gte('logged_at', `${today}T00:00:00`).lte('logged_at', `${today}T23:59:59`),
        (supabase as any).from('profiles').select('age, sex, weight_kg, height_cm, activity_level').eq('user_id', user.id).maybeSingle(),
        getTodayData()
      ]);
      const rawMealPlans = Array.isArray(mealPlansResult?.data) ? mealPlansResult.data : [];
      const foodLogs = Array.isArray(foodLogsResult?.data) ? foodLogsResult.data : [];
      const profile = profileResult?.data;
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
      const unifiedScoreResult = await getTodayUnifiedScore(user.id, 'runner-focused');
      const dailyScore = unifiedScoreResult.score;
      const bmr = profile ? calculateBMR({
        age: profile.age || 30,
        sex: profile.sex || 'male',
        weightKg: profile.weight_kg || 70,
        heightCm: profile.height_cm || 170
      }) : 1800;
      const activityMultiplier = profile?.activity_level ? getActivityMultiplier(profile.activity_level) : 1.5;
      const calorieTarget = Math.round(bmr * activityMultiplier);
      const macroTargets = deriveMacrosFromCalories(calorieTarget);
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
        breakfastScore: nutritionScoreResult?.data?.breakfast_score || null,
        lunchScore: nutritionScoreResult?.data?.lunch_score || null,
        dinnerScore: nutritionScoreResult?.data?.dinner_score || null,
        calories: { consumed: consumedNutrition.calories, target: calorieTarget },
        macros: {
          protein: { consumed: consumedNutrition.protein, target: macroTargets.protein },
          carbs: { consumed: consumedNutrition.carbs, target: macroTargets.carbs },
          fat: { consumed: consumedNutrition.fat, target: macroTargets.fat },
        }
      });
      const [todayScoreOutcome, weeklyScoreOutcome] = await scoringPromise;
      setTodayScore(todayScoreOutcome.status === 'fulfilled' ? todayScoreOutcome.value.score : 0);
      setTodayBreakdown(todayScoreOutcome.status === 'fulfilled' ? { nutrition: todayScoreOutcome.value.breakdown.nutrition as any as number, training: todayScoreOutcome.value.breakdown.training as any as number } : { nutrition: 0, training: 0 });
      setWeeklyScore(weeklyScoreOutcome.status === 'fulfilled' ? weeklyScoreOutcome.value : 0);
      try {
        const [weeklyData, target] = await weeklyGoogleFitPromise;
        setWeeklyGoogleFitData({ current: weeklyData.totalDistanceKm, target });
      } catch (e) { console.error('Error loading weekly Google Fit data:', e); }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally { setLoading(false); }
  };

  const fetchEdgeData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
      const { data, error } = await supabase.functions.invoke('dashboard3-data', {
        body: { user_id: user.id },
        headers: {
          ...(apiKey ? { apikey: apiKey } : {}),
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        }
      });
      if (error) throw error;
      setData({
        dailyScore: data.dailyScore,
        caloriesConsumed: data.calories.consumed,
        proteinGrams: data.macros.protein.consumed,
        carbsGrams: data.macros.carbs.consumed,
        fatGrams: data.macros.fat.consumed,
        mealsLogged: 0,
        steps: 0,
        caloriesBurned: 0,
        activeMinutes: 0,
        plannedCalories: 0,
        plannedProtein: 0,
        plannedCarbs: 0,
        plannedFat: 0,
        breakfastScore: null,
        lunchScore: null,
        dinnerScore: null,
        calories: { consumed: data.calories.consumed, target: data.calories.target },
        macros: {
          protein: { consumed: data.macros.protein.consumed, target: data.macros.protein.target },
          carbs: { consumed: data.macros.carbs.consumed, target: data.macros.carbs.target },
          fat: { consumed: data.macros.fat.consumed, target: data.macros.fat.target },
        },
      });
      setTodayScore(data.dailyScore || 0);
      setWeeklyScore(data.weeklyScore || 0);
      setWeeklyGoogleFitData(data.weeklyKm || { current: 0, target: 30 });
      // Persist to cache for fast reloads
      try { if (user?.id) writeDashboardCache(user.id, { ...data }); } catch {}

      // Fallbacks when Edge Function omits or returns zeros
      try {
        const fallbackPromises: Promise<any>[] = [];
        if (!data?.dailyScore || data.dailyScore === 0) {
          fallbackPromises.push(getTodayUnifiedScore(user.id));
        } else {
          fallbackPromises.push(Promise.resolve(null));
        }
        if (!data?.weeklyScore || data.weeklyScore === 0) {
          fallbackPromises.push(getWeeklyScorePersisted(user.id));
        } else {
          fallbackPromises.push(Promise.resolve(null));
        }
        const needsKmFallback = !data?.weeklyKm || (data.weeklyKm.current ?? 0) === 0;
        if (needsKmFallback) {
          fallbackPromises.push(getWeeklyGoogleFitData(user.id));
          fallbackPromises.push(getWeeklyMileageTarget(user.id));
        } else {
          fallbackPromises.push(Promise.resolve(null));
          fallbackPromises.push(Promise.resolve(null));
        }

        const [dailyScoreRes, weeklyScoreRes, weeklyKmData, weeklyKmTarget] = await Promise.all(fallbackPromises);

        if (dailyScoreRes && typeof dailyScoreRes.score === 'number') {
          setTodayScore(dailyScoreRes.score);
        }
        if (typeof weeklyScoreRes === 'number') {
          setWeeklyScore(weeklyScoreRes);
        }
        if (weeklyKmData && typeof weeklyKmTarget === 'number') {
          setWeeklyGoogleFitData({ current: weeklyKmData.totalDistanceKm || 0, target: weeklyKmTarget });
        }
        // Update cache with fallbacks applied where present
        try {
          if (user?.id) {
            const merged = {
              ...data,
              dailyScore: (dailyScoreRes && typeof dailyScoreRes.score === 'number') ? dailyScoreRes.score : data.dailyScore,
              weeklyScore: (typeof weeklyScoreRes === 'number') ? weeklyScoreRes : data.weeklyScore,
              weeklyKm: (weeklyKmData && typeof weeklyKmTarget === 'number') ? { current: weeklyKmData.totalDistanceKm || 0, target: weeklyKmTarget } : data.weeklyKm,
            };
            writeDashboardCache(user.id, merged);
          }
        } catch {}
      } catch (fallbackErr) {
        console.warn('Fallback fetches for scores/km failed:', fallbackErr);
      }
    } catch (e) {
      console.error('Edge data load failed, falling back to client aggregation', e);
      await loadDashboardData();
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

  const calculateMealScore = () => {
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
  const nextWorkout = data?.nextRun ? { type: 'Tempo Run', date: new Date(data.nextRun), distance: 8 } : undefined;

  const insights = [
    {
      icon: 'zap' as const,
      title: 'Pre-Run Nutrition',
      message: nextWorkout ? `Tempo run tomorrow - have your pre-run snack 1 hour before.` : 'Plan your pre-run nutrition for optimal performance.',
      color: 'bg-blue-50 dark:bg-blue-900/20',
      details: ['Eat 1-2 hours before running','Focus on easily digestible carbs','Include a small amount of protein','Stay hydrated']
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
        {/* Header */}
        <div className="mb-6 pt-2">
          <div className="flex items-center justify-between">
            <PageHeading title="Dashboard 3" description="Your nutrition and training overview" icon={Home} />
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/profile/notifications')}>
                <Settings className="w-4 h-4" />
                Customize
              </Button>
            </div>
          </div>
        </div>

        {/* Scores */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <ScoreCard title="Daily Score" score={todayScore} subtitle="Today" variant="success" />
          <ScoreCard title="Weekly Score" score={weeklyScore} subtitle="Mon–Sun avg" variant="warning" />
        </div>

        {/* Marathon Countdown */}
        <div className="mb-5">
          <RaceGoalWidget />
        </div>

        {/* Today's Meal Score */}
        <div className="mb-5">
          <TodayMealScoreCard score={mealScore.score} rating={mealScore.rating} />
        </div>

        {/* Today's Nutrition */}
        <div className="mb-5">
          <TodayNutritionCard
            calories={{ current: data?.calories?.consumed || 0, target: data?.calories?.target || 2400 }}
            protein={{ current: data?.macros?.protein?.consumed || 0, target: data?.macros?.protein?.target || 120, color: '#3F8CFF' }}
            carbs={{ current: data?.macros?.carbs?.consumed || 0, target: data?.macros?.carbs?.target || 330, color: '#39D98A' }}
            fat={{ current: data?.macros?.fat?.consumed || 0, target: data?.macros?.fat?.target || 67, color: '#FFC15E' }}
            showEducation={true}
          />
        </div>

        {/* Weekly Kilometers */}
        <div className="mb-5">
          <WeeklyKilometersCard current={weeklyGoogleFitData.current} target={weeklyGoogleFitData.target} />
        </div>

        {/* Upcoming Workouts */}
        {(nextWorkout) && (
          <div className="mb-5">
            <UpcomingWorkouts workouts={[nextWorkout]} />
          </div>
        )}

        {/* Today's Insights */}
        <div className="mb-5">
          <TodayInsightsCard insights={insights} />
        </div>

        {/* Removed: Today's Nutrition Plan */}

      </div>
    </div>
  );
}


