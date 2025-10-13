import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreCard } from '@/components/ScoreCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Target, Users, Zap, TrendingUp, ChevronLeft, ChevronRight, Camera, Utensils, Settings, RefreshCw } from 'lucide-react';
import { Home } from 'lucide-react';
import { PageHeading } from '@/components/PageHeading';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { RaceGoalWidget } from '@/components/RaceGoalWidget';
import { CombinedNutritionWidget } from '@/components/CombinedNutritionWidget';
import { RunnerNutritionDashboard } from '@/components/RunnerNutritionDashboard';
import { WeeklyScoreCard } from '@/components/WeeklyScoreCard';
import { getTodayUnifiedScore, getWeeklyUnifiedScore } from '@/services/unified-score.service';
import { TodayMealScoreCard } from '@/components/TodayMealScoreCard';
import { TodayNutritionCard } from '@/components/TodayNutritionCard';
import { WeeklyKilometersCard } from '@/components/WeeklyMilesCard';
import { getLocalDayBoundaries, getLocalDateString } from '@/lib/timezone';
import { UpcomingWorkouts } from '@/components/UpcomingWorkouts';
import { TodayInsightsCard } from '@/components/TodayInsightsCard';
import { format, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { RecoverySuggestion } from '@/components/RecoverySuggestion';
import { accumulatePlannedFromMealPlans, accumulateConsumedFromFoodLogs, computeDailyScore, getActivityMultiplier, deriveMacrosFromCalories } from '@/lib/nutrition';
import { calculateBMR } from '@/lib/nutrition-engine';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';
import { useWidgetCache, clearUserCache } from '@/hooks/useWidgetCache';
import { IncompleteProfileAlert, DataCompletenessScoreDisplay } from '@/components/IncompleteProfileAlert';



import { readDashboardCache, writeDashboardCache } from '@/lib/dashboard-cache';

// Types
interface MealSuggestion {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string;
  description?: string;
  image_url?: string;
}

interface MealPlan {
  id: string;
  meal_type: string;
  recommended_calories: number;
  recommended_protein_grams: number;
  recommended_carbs_grams: number;
  recommended_fat_grams: number;
  meal_suggestions: MealSuggestion[];
  date: string;
  user_id: string;
}

interface DashboardData {
  dailyScore: number;
  caloriesConsumed: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  mealsLogged: number;
  hasMainMeals: boolean;
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  heartRateAvg: number | null;
  plannedCalories: number;
  plannedProtein: number;
  plannedCarbs: number;
  plannedFat: number;
  breakfastScore: number | null;
  lunchScore: number | null;
  dinnerScore: number | null;
  calories: {
    consumed: number;
    target: number;
    percentage: number;
  };
  protein: {
    consumed: number;
    target: number;
    percentage: number;
    color: string;
  };
  carbs: {
    consumed: number;
    target: number;
    percentage: number;
    color: string;
  };
  fat: {
    consumed: number;
    target: number;
    percentage: number;
    color: string;
  };
  nextRun?: string;
  insights: string[];
}

interface DashboardProps {
  onAddMeal?: () => void;
  onAnalyzeFitness?: () => void;
}

export function CachedDashboard({ onAddMeal, onAnalyzeFitness }: DashboardProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { syncGoogleFit, isSyncing, lastSync, syncStatus } = useGoogleFitSync();

  // Cached data hooks
  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    lastUpdated: dashboardLastUpdated,
    refreshData: refreshDashboard,
    isCached: isDashboardCached
  } = useWidgetCache<DashboardData>(
    'dashboard-data',
    async () => {
      if (!user || !session) throw new Error('No authenticated user');
      
      const today = getLocalDateString();
      const { start, end } = getLocalDayBoundaries(new Date());
      
      // Fetch all data in parallel
      const [foodLogsData, mealPlansData, profileData, googleFitData] = await Promise.all([
        supabase
          .from('food_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('logged_at', start)
          .lte('logged_at', end)
          .order('logged_at', { ascending: false }),
        supabase
          .from('daily_meal_plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today),
        supabase
          .from('profiles')
          .select('age, sex, weight_kg, height_cm, activity_level')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('google_fit_data')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()
      ]);

      // Check for authentication errors
      if (foodLogsData.error && foodLogsData.error.message.includes('access control')) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const foodLogs = foodLogsData.data || [];
      const rawMealPlans = mealPlansData.data || [];
      const profile = profileData.data;
      const todayGoogleFitData = googleFitData.data;

      // Check if user has logged any main meals (not just snacks)
      const mainMeals = foodLogs.filter(log => 
        ['breakfast', 'lunch', 'dinner'].includes(log.meal_type?.toLowerCase() || '')
      );
      const hasMainMeals = mainMeals.length > 0;

      const exerciseData = {
        steps: todayGoogleFitData?.steps || 0,
        calories_burned: todayGoogleFitData?.caloriesBurned || 0,
        active_minutes: todayGoogleFitData?.activeMinutes || 0,
        heart_rate_avg: todayGoogleFitData?.heartRateAvg || null,
        distance_meters: todayGoogleFitData?.distanceMeters || 0,
        sessions: todayGoogleFitData?.sessions || []
      };

      const plannedNutrition = accumulatePlannedFromMealPlans(rawMealPlans);
      const consumedNutrition = accumulateConsumedFromFoodLogs(foodLogs);
      
      // Get unified scores
      const unifiedScoreResult = await getTodayUnifiedScore(user.id, 'runner-focused');
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const weeklyScoreResult = await getWeeklyUnifiedScore(user.id, weekStart, 'runner-focused');

      // Calculate BMR and targets
      const bmr = profile ? calculateBMR({
        age: profile.age || 30,
        sex: profile.sex || 'male',
        weight: profile.weight_kg || 70,
        height: profile.height_cm || 175
      }) : 1800;

      const activityMultiplier = getActivityMultiplier(profile?.activity_level || 'moderate');
      const tdee = bmr * activityMultiplier;

      const dashboardData: DashboardData = {
        dailyScore: unifiedScoreResult?.score || 0,
        caloriesConsumed: consumedNutrition.calories,
        proteinGrams: consumedNutrition.protein,
        carbsGrams: consumedNutrition.carbs,
        fatGrams: consumedNutrition.fat,
        mealsLogged: foodLogs.length,
        hasMainMeals: hasMainMeals,
        steps: exerciseData.steps,
        caloriesBurned: exerciseData.calories_burned,
        activeMinutes: exerciseData.active_minutes,
        heartRateAvg: exerciseData.heart_rate_avg,
        plannedCalories: plannedNutrition.calories,
        plannedProtein: plannedNutrition.protein,
        plannedCarbs: plannedNutrition.carbs,
        plannedFat: plannedNutrition.fat,
        breakfastScore: null,
        lunchScore: null,
        dinnerScore: null,
        calories: {
          consumed: consumedNutrition.calories,
          target: Math.round(tdee),
          percentage: Math.round((consumedNutrition.calories / tdee) * 100)
        },
        protein: {
          consumed: consumedNutrition.protein,
          target: Math.round(tdee * 0.25 / 4), // 25% of calories from protein
          percentage: Math.round((consumedNutrition.protein / (tdee * 0.25 / 4)) * 100),
          color: '#FF6B6B' // Vibrant red/coral for protein
        },
        carbs: {
          consumed: consumedNutrition.carbs,
          target: Math.round(tdee * 0.45 / 4), // 45% of calories from carbs
          percentage: Math.round((consumedNutrition.carbs / (tdee * 0.45 / 4)) * 100),
          color: '#4ECDC4' // Vibrant teal/cyan for carbs
        },
        fat: {
          consumed: consumedNutrition.fat,
          target: Math.round(tdee * 0.30 / 9), // 30% of calories from fat
          percentage: Math.round((consumedNutrition.fat / (tdee * 0.30 / 9)) * 100),
          color: '#FFD93D' // Vibrant yellow for fat
        },
        insights: [
          `You've logged ${foodLogs.length} meals today`,
          `Your daily score is ${unifiedScoreResult?.score || 0}/100`,
          `You've burned ${Math.round(exerciseData.calories_burned)} calories through activity`
        ]
      };

      return dashboardData;
    },
    {
      ttl: 2 * 60 * 1000, // 2 minutes cache
      version: 'v1.0.0'
    }
  );

  const {
    data: mealPlans,
    loading: mealPlansLoading,
    refreshData: refreshMealPlans,
    isCached: isMealPlansCached
  } = useWidgetCache<MealPlan[]>(
    'meal-plans',
    async () => {
      if (!user) throw new Error('No authenticated user');
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('daily_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      if (error) throw error;
      
      return (data || []).map((plan) => ({
        ...plan,
        meal_suggestions: Array.isArray(plan.meal_suggestions)
          ? (plan.meal_suggestions as unknown as MealSuggestion[])
          : []
      }));
    },
    {
      ttl: 5 * 60 * 1000, // 5 minutes cache
      version: 'v1.0.0'
    }
  );

  const {
    data: weeklyData,
    loading: weeklyLoading,
    refreshData: refreshWeekly,
    isCached: isWeeklyCached
  } = useWidgetCache<{ current: number; target: number }>(
    'weekly-data',
    async () => {
      if (!user) throw new Error('No authenticated user');
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('google_fit_data')
        .select('distance_meters')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', today);

      if (error) throw error;
      
      const totalDistance = (data || []).reduce((sum, d) => sum + (d.distance_meters || 0), 0) / 1000;
      
      return {
        current: totalDistance,
        target: 30 // Default target
      };
    },
    {
      ttl: 10 * 60 * 1000, // 10 minutes cache
      version: 'v1.0.0'
    }
  );

  // Global refresh function
  const refreshAllData = useCallback(async () => {
    console.log('CachedDashboard: Refreshing all cached data');
    try {
      await Promise.all([
        refreshDashboard(),
        refreshMealPlans(),
        refreshWeekly()
      ]);
      toast({
        title: "Data refreshed",
        description: "All dashboard data has been updated",
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: "Refresh failed",
        description: "Some data could not be updated",
        variant: "destructive",
      });
    }
  }, [refreshDashboard, refreshMealPlans, refreshWeekly, toast]);

  // Handle authentication errors
  useEffect(() => {
    if (dashboardError && dashboardError.message.includes('Authentication required')) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to continue.",
        variant: "destructive",
      });
      navigate('/auth', { replace: true });
    }
  }, [dashboardError, toast, navigate]);

  // Loading state
  if (dashboardLoading && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-primary rounded-full animate-pulse-glow"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (dashboardError && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-xl">!</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
          <p className="text-muted-foreground mb-4">{dashboardError.message}</p>
          <Button onClick={refreshAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <div className="max-w-none mx-auto p-4">
        {/* Cache Status Indicator */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${isDashboardCached ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span>
              {isDashboardCached ? 'Cached' : 'Live'} data
              {dashboardLastUpdated && ` • Updated ${format(dashboardLastUpdated, 'HH:mm')}`}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAllData}
            disabled={dashboardLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${dashboardLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Dashboard Content */}
        <div className="space-y-6">
          {/* Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ScoreCard
              title="Daily Score"
              value={dashboardData.dailyScore}
              max={100}
              icon={<Target className="h-4 w-4" />}
              description="Overall performance today"
            />
            <ScoreCard
              title="Calories"
              value={dashboardData.calories.percentage}
              max={100}
              icon={<Zap className="h-4 w-4" />}
              description={`${dashboardData.calories.consumed}/${dashboardData.calories.target} kcal`}
            />
            <ScoreCard
              title="Steps"
              value={dashboardData.steps}
              max={10000}
              icon={<Users className="h-4 w-4" />}
              description="Activity today"
            />
            <ScoreCard
              title="Meals"
              value={dashboardData.mealsLogged}
              max={6}
              icon={<Utensils className="h-4 w-4" />}
              description="Logged today"
            />
          </div>

          {/* Nutrition Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TodayNutritionCard
              calories={{
                current: dashboardData.calories.consumed,
                target: dashboardData.calories.target
              }}
              protein={{
                current: dashboardData.protein.consumed,
                target: dashboardData.protein.target,
                color: dashboardData.protein.color
              }}
              carbs={{
                current: dashboardData.carbs.consumed,
                target: dashboardData.carbs.target,
                color: dashboardData.carbs.color
              }}
              fat={{
                current: dashboardData.fat.consumed,
                target: dashboardData.fat.target,
                color: dashboardData.fat.color
              }}
            />
            <TodayMealScoreCard
              score={dashboardData.hasMainMeals ? dashboardData.dailyScore : 0}
              rating={!dashboardData.hasMainMeals ? 'Needs Improvement' :
                     dashboardData.dailyScore >= 80 ? 'Excellent' : 
                     dashboardData.dailyScore >= 65 ? 'Good' : 
                     dashboardData.dailyScore >= 50 ? 'Fair' : 'Needs Improvement'}
            />
          </div>

          {/* Weekly Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WeeklyScoreCard
              weeklyScore={weeklyData?.current || 0}
              weeklyTarget={weeklyData?.target || 30}
            />
            <WeeklyKilometersCard
              current={weeklyData?.current || 0}
              target={weeklyData?.target || 30}
            />
          </div>

          {/* Insights */}
          <TodayInsightsCard insights={dashboardData.insights} />
        </div>
      </div>

      {/* Food Tracker Dialog */}
      <FoodTrackerDialog open={false} onOpenChange={() => {}} />
    </div>
  );
}
