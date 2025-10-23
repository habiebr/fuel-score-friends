import { supabase } from '@/integrations/supabase/client';
import { getLocalDayBoundaries, getLocalDateString } from '@/lib/timezone';

export interface OptimizedDashboardData {
  // Core nutrition data
  dailyScore: number;
  weeklyScore: number;
  caloriesConsumed: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  mealsLogged: number;
  
  // Activity data
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  heartRateAvg?: number | null;
  
  // Planned nutrition
  plannedCalories: number;
  plannedProtein: number;
  plannedCarbs: number;
  plannedFat: number;
  
  // Meal scores
  breakfastScore: number | null;
  lunchScore: number | null;
  dinnerScore: number | null;
  
  // Gamification data
  currentStreak: number;
  bestStreak: number;
  tier: string;
  avg28d: number;
  
  // Recovery data
  newActivity: any;
}

/**
 * Optimized data fetching with parallel queries and caching
 */
export async function fetchOptimizedDashboardData(userId: string): Promise<OptimizedDashboardData> {
  const today = getLocalDateString();
  const { start, end } = getLocalDayBoundaries(new Date());
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Parallel fetch all critical data
  const [
    foodLogsResult,
    mealPlansResult,
    profileResult,
    googleFitResult,
    nutritionScoresResult,
    gamificationResult
  ] = await Promise.all([
    // Food logs for today
    supabase
      .from('food_logs')
      .select('calories, protein_grams, carbs_grams, fat_grams, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', start)
      .lte('logged_at', end)
      .order('logged_at', { ascending: false }),

    // Meal plans for today
    supabase
      .from('daily_meal_plans')
      .select('meal_type, recommended_calories, recommended_protein_grams, recommended_carbs_grams, recommended_fat_grams, meal_score')
      .eq('user_id', userId)
      .eq('date', today),

    // User profile
    supabase
      .from('profiles')
      .select('age, sex, weight_kg, height_cm, activity_level')
      .eq('user_id', userId)
      .maybeSingle(),

    // Google Fit data for today
    supabase
      .from('google_fit_data')
      .select('steps, calories_burned, active_minutes, heart_rate_avg')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),

    // Nutrition scores for weekly calculation
    supabase
      .from('nutrition_scores')
      .select('date, daily_score')
      .eq('user_id', userId)
      .gte('date', weekStart)
      .lte('date', today)
      .order('date', { ascending: false }),

    // Gamification data (with fallback)
    supabase.functions.invoke('gamification', { body: {} }).catch(() => ({ data: null }))
  ]);

  // Process food logs
  const foodLogs = foodLogsResult.data || [];
  const caloriesConsumed = foodLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
  const proteinGrams = foodLogs.reduce((sum, log) => sum + (log.protein_grams || 0), 0);
  const carbsGrams = foodLogs.reduce((sum, log) => sum + (log.carbs_grams || 0), 0);
  const fatGrams = foodLogs.reduce((sum, log) => sum + (log.fat_grams || 0), 0);
  const mealsLogged = foodLogs.length;

  // Process meal plans
  const mealPlans = mealPlansResult.data || [];
  const plannedCalories = mealPlans.reduce((sum, plan) => sum + (plan.recommended_calories || 0), 0);
  const plannedProtein = mealPlans.reduce((sum, plan) => sum + (plan.recommended_protein_grams || 0), 0);
  const plannedCarbs = mealPlans.reduce((sum, plan) => sum + (plan.recommended_carbs_grams || 0), 0);
  const plannedFat = mealPlans.reduce((sum, plan) => sum + (plan.recommended_fat_grams || 0), 0);

  // Extract meal scores
  const breakfastScore = mealPlans.find(p => p.meal_type === 'breakfast')?.meal_score || null;
  const lunchScore = mealPlans.find(p => p.meal_type === 'lunch')?.meal_score || null;
  const dinnerScore = mealPlans.find(p => p.meal_type === 'dinner')?.meal_score || null;

  // Process Google Fit data
  const googleFitData = googleFitResult.data;
  const steps = googleFitData?.steps || 0;
  const caloriesBurned = googleFitData?.calories_burned || 0;
  const activeMinutes = googleFitData?.active_minutes || 0;
  const heartRateAvg = googleFitData?.heart_rate_avg || null;

  // Calculate daily score (simplified calculation)
  const dailyScore = Math.round((caloriesConsumed / Math.max(plannedCalories, 1)) * 100);
  const dailyScoreClamped = Math.min(Math.max(dailyScore, 0), 100);

  // Calculate weekly score
  const nutritionScores = nutritionScoresResult.data || [];
  const validScores = nutritionScores.filter(score => score.daily_score > 0);
  const weeklyScore = validScores.length > 0 
    ? Math.round(validScores.reduce((sum, score) => sum + score.daily_score, 0) / validScores.length)
    : 0;

  // Process gamification data
  const gamificationData = gamificationResult.data?.data;
  const currentStreak = gamificationData?.state?.current_streak || 0;
  const bestStreak = gamificationData?.state?.best_streak || 0;
  const tier = gamificationData?.state?.tier || 'bronze';
  const avg28d = gamificationData?.state?.avg_28d || 0;

  // Check for new activity (simplified)
  const newActivity = null; // This would be determined by checking recent training activities

  return {
    dailyScore: dailyScoreClamped,
    weeklyScore,
    caloriesConsumed,
    proteinGrams,
    carbsGrams,
    fatGrams,
    mealsLogged,
    steps,
    caloriesBurned,
    activeMinutes,
    heartRateAvg,
    plannedCalories,
    plannedProtein,
    plannedCarbs,
    plannedFat,
    breakfastScore,
    lunchScore,
    dinnerScore,
    currentStreak,
    bestStreak,
    tier,
    avg28d,
    newActivity
  };
}

/**
 * Lightweight data fetching for initial load
 */
export async function fetchCriticalDashboardData(userId: string): Promise<Partial<OptimizedDashboardData>> {
  const today = getLocalDateString();
  const { start, end } = getLocalDayBoundaries(new Date());

  // Only fetch the most critical data for initial render
  const [foodLogsResult, mealPlansResult] = await Promise.all([
    supabase
      .from('food_logs')
      .select('calories')
      .eq('user_id', userId)
      .gte('logged_at', start)
      .lte('logged_at', end),
    supabase
      .from('daily_meal_plans')
      .select('recommended_calories')
      .eq('user_id', userId)
      .eq('date', today)
  ]);

  const caloriesConsumed = (foodLogsResult.data || []).reduce((sum, log) => sum + (log.calories || 0), 0);
  const plannedCalories = (mealPlansResult.data || []).reduce((sum, plan) => sum + (plan.recommended_calories || 0), 0);
  const dailyScore = Math.round((caloriesConsumed / Math.max(plannedCalories, 1)) * 100);

  return {
    dailyScore: Math.min(Math.max(dailyScore, 0), 100),
    caloriesConsumed,
    plannedCalories,
    mealsLogged: (foodLogsResult.data || []).length
  };
}


