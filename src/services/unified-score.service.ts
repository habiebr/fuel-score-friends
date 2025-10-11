/**
 * Unified Score Service
 * 
 * This service provides a clean API for calculating scores using the unified scoring system.
 * It handles data fetching, context creation, and score calculation.
 */

import { supabase } from '@/integrations/supabase/client';
import { getDateRangeForQuery, getWeekStartIndonesian } from '@/lib/timezone';
import { 
  calculateUnifiedScore, 
  calculateMealScores, 
  createScoringContext,
  determineTrainingLoad,
  type ScoringContext,
  type ScoreBreakdown,
  type MealScore,
  type TrainingLoad,
  type ScoringStrategy
} from '@/lib/unified-scoring';
import { format } from 'date-fns';

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  context: ScoringContext;
}

export interface MealScoreResult {
  scores: MealScore[];
  average: number;
}

/**
 * Get today's score using the unified scoring system
 */
export async function getTodayUnifiedScore(
  userId: string,
  strategy: ScoringStrategy = 'runner-focused'
): Promise<ScoreResult> {
  const today = format(new Date(), 'yyyy-MM-dd');
  return getDailyUnifiedScore(userId, today, strategy);
}

/**
 * Get daily score for a specific date using the unified scoring system
 */
export async function getDailyUnifiedScore(
  userId: string,
  dateISO: string,
  strategy: ScoringStrategy = 'runner-focused'
): Promise<ScoreResult> {
  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('weight_kg, height_cm, age, sex')
    .eq('user_id', userId)
    .maybeSingle();

  console.log('Profile data:', profile);

  // Fetch meal plans for the day
  const { data: mealPlans } = await supabase
    .from('daily_meal_plans')
    .select('meal_type, recommended_calories, recommended_protein_grams, recommended_carbs_grams, recommended_fat_grams')
    .eq('user_id', userId)
    .eq('date', dateISO);

  // Calculate nutrition targets
  const nutritionTargets = (mealPlans || []).reduce((acc, plan) => ({
    calories: acc.calories + (plan.recommended_calories || 0),
    protein: acc.protein + (plan.recommended_protein_grams || 0),
    carbs: acc.carbs + (plan.recommended_carbs_grams || 0),
    fat: acc.fat + (plan.recommended_fat_grams || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Add fueling windows for runners
  const weight = profile?.weight_kg || 70;
  const nutritionTargetsWithWindows = {
    ...nutritionTargets,
    preCho: Math.round(weight * 1.5),
    duringChoPerHour: 60, // Will be adjusted based on training load
    postCho: Math.round(weight * 1.0),
    postPro: Math.round(weight * 0.3),
    fatMin: Math.round((nutritionTargets.calories * 0.2) / 9),
  };

  console.log('Nutrition targets with windows:', nutritionTargetsWithWindows);

  // Fetch food logs for the day
  const dateRange = getDateRangeForQuery(dateISO);
  const { data: foodLogs } = await supabase
    .from('food_logs')
    .select('meal_type, calories, protein_grams, carbs_grams, fat_grams, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', dateRange.start)
    .lte('logged_at', dateRange.end);

  // Calculate nutrition actuals
  const nutritionActuals = (foodLogs || []).reduce((acc, log) => ({
    calories: acc.calories + (log.calories || 0),
    protein: acc.protein + (log.protein_grams || 0),
    carbs: acc.carbs + (log.carbs_grams || 0),
    fat: acc.fat + (log.fat_grams || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Fetch planned training activities (plan)
  const { data: activities } = await supabase
    .from('training_activities')
    .select('activity_type, duration_minutes, intensity, start_time')
    .eq('user_id', userId)
    .eq('date', dateISO);

  // Fetch actual session-linked activity for the day
  // We only consider google_fit_data rows that have sessions (true exercise sessions)
  const { data: fitData } = await (supabase as any)
    .from('google_fit_data')
    .select('sessions, calories_burned, active_minutes, distance_meters, heart_rate_avg')
    .eq('user_id', userId)
    .eq('date', dateISO)
    .not('sessions', 'is', null);

  // Aggregate actuals across sessions
  const actualDurationMin = (fitData || []).reduce((s: number, r: any) => s + (r.active_minutes || 0), 0);
  const actualCalories = (fitData || []).reduce((s: number, r: any) => s + (r.calories_burned || 0), 0);
  const actualDistance = (fitData || []).reduce((s: number, r: any) => s + (Number(r.distance_meters) || 0), 0);
  const avgHr = (() => {
    const hrs = (fitData || []).map((r: any) => r.heart_rate_avg).filter((v: any) => typeof v === 'number');
    if (!hrs.length) return undefined;
    return Math.round(hrs.reduce((a: number, b: number) => a + b, 0) / hrs.length);
  })();

  // Determine training load: prefer planned load if plan exists, otherwise infer from actual duration
  const load = (activities && activities.length > 0)
    ? determineTrainingLoad(activities)
    : (actualDurationMin > 60 ? 'quality' : actualDurationMin > 30 ? 'easy' : 'rest');

  // Build training plan summary
  const planDuration = (activities || []).reduce((sum, act) => sum + (act.duration_minutes || 0), 0);
  const trainingPlan = planDuration > 0 ? {
    durationMin: planDuration,
    type: activities?.[0]?.activity_type,
    intensity: activities?.[0]?.intensity as 'low' | 'moderate' | 'high',
  } : undefined;

  // Build training actual summary from session-linked data
  const trainingActual = actualDurationMin > 0 ? {
    durationMin: actualDurationMin,
    type: trainingPlan?.type, // best effort; detailed type matching can be added via sessions join
    avgHr: avgHr,
  } : undefined;

  // Determine meals present
  const mealsPresent = (mealPlans || []).map(p => p.meal_type).filter(Boolean) as Array<'breakfast' | 'lunch' | 'dinner' | 'snack'>;
  const hasSnack = mealsPresent.includes('snack');

  // Create fueling windows
  const windows = {
    pre: { applicable: load !== 'rest', inWindow: true },
    during: { applicable: load === 'long' || hasSnack },
    post: { applicable: load !== 'rest', inWindow: true },
  };

  // Create scoring context
  const context = createScoringContext(
    nutritionTargetsWithWindows,
    nutritionActuals,
    trainingPlan,
    trainingActual,
    {
      load,
      strategy,
      mealsPresent,
      windows,
      flags: {
        windowSyncAll: true,
        streakDays: 0,
        hydrationOk: true,
        bigDeficit: false,
        isHardDay: load === 'long' || load === 'quality',
        missedPostWindow: false,
      },
    }
  );

  // Calculate score
  const breakdown = calculateUnifiedScore(context);
  console.log('Calculated score:', {
    userId,
    dateISO,
    breakdown,
    context,
    nutritionTargets: nutritionTargetsWithWindows,
    nutritionActuals,
    trainingPlan,
    trainingActual
  });

  // Persist score to database using direct table insert
  try {
    const { error } = await supabase
      .from('nutrition_scores')
      .upsert({
        user_id: userId,
        date: dateISO,
        daily_score: breakdown.total,
        calories_consumed: nutritionActuals.calories,
        protein_grams: nutritionActuals.protein,
        carbs_grams: nutritionActuals.carbs,
        fat_grams: nutritionActuals.fat,
        meals_logged: (foodLogs || []).length,
        planned_calories: nutritionTargetsWithWindows.calories,
        planned_protein_grams: nutritionTargetsWithWindows.protein,
        planned_carbs_grams: nutritionTargetsWithWindows.carbs,
        planned_fat_grams: nutritionTargetsWithWindows.fat,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      });
    
    if (error) {
      console.error('Failed to persist score:', error);
    } else {
      console.log('Score persisted successfully:', {
        userId,
        dateISO,
        daily_score: breakdown.total,
        nutrition: breakdown.nutrition.total,
        training: breakdown.training.total
      });
    }
  } catch (error) {
    console.error('Failed to persist score:', error);
  }

  return {
    score: breakdown.total,
    breakdown,
    context,
  };
}

/**
 * Get meal-level scores for a specific date
 */
export async function getMealScores(
  userId: string,
  dateISO: string
): Promise<MealScoreResult> {
  // Fetch meal plans
  const { data: mealPlans } = await supabase
    .from('daily_meal_plans')
    .select('meal_type, recommended_calories, recommended_protein_grams, recommended_carbs_grams, recommended_fat_grams')
    .eq('user_id', userId)
    .eq('date', dateISO);

  // Fetch food logs
  const dateRange = getDateRangeForQuery(dateISO);
  const { data: foodLogs } = await supabase
    .from('food_logs')
    .select('meal_type, calories, protein_grams, carbs_grams, fat_grams')
    .eq('user_id', userId)
    .gte('logged_at', dateRange.start)
    .lte('logged_at', dateRange.end);

  if (!mealPlans || mealPlans.length === 0) {
    return { scores: [], average: 0 };
  }

  // Calculate meal scores
  const scores = calculateMealScores(mealPlans, foodLogs || []);
  const average = scores.length > 0 
    ? Math.round(scores.reduce((sum, score) => sum + score.score, 0) / scores.length)
    : 0;

  return { scores, average };
}

/**
 * Get weekly score from cached data (no recalculation)
 * Week starts Monday 00:00 Indonesian time (WIB/UTC+7)
 */
export async function getWeeklyScoreFromCache(
  userId: string,
  weekStart?: Date
): Promise<{ average: number; dailyScores: Array<{ date: string; score: number }> }> {
  // Get Monday 00:00 in Indonesian timezone
  const startDate = weekStart || getWeekStartIndonesian();
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6); // End of week (Sunday)
  
  const { data: scores } = await supabase
    .from('nutrition_scores')
    .select('date, daily_score')
    .eq('user_id', userId)
    .gte('date', format(startDate, 'yyyy-MM-dd'))
    .lte('date', format(endDate, 'yyyy-MM-dd'))
    .order('date', { ascending: true });
  
  const dailyScores = (scores || []).map(score => ({
    date: score.date,
    score: score.daily_score
  }));
  
  const validScores = dailyScores.filter(d => d.score > 0);
  const average = validScores.length > 0
    ? Math.round(validScores.reduce((sum, d) => sum + d.score, 0) / validScores.length)
    : 0;
  
  return { average, dailyScores };
}

/**
 * Get weekly score with unified scoring (alias for getWeeklyScoreFromCache)
 * This function is used when you want to get weekly scores for a specific week
 */
export async function getWeeklyUnifiedScore(
  userId: string,
  weekStart?: Date,
  strategy?: ScoringStrategy
): Promise<{ average: number; dailyScores: Array<{ date: string; score: number }> }> {
  // Strategy parameter is kept for API compatibility but not used
  // since we're reading from cached scores
  return getWeeklyScoreFromCache(userId, weekStart);
}

/**
 * Get all users' weekly scores from cache for leaderboard
 * Week starts Monday 00:00 Indonesian time (WIB/UTC+7)
 */
export async function getAllUsersWeeklyScoresFromCache(
  weekStart?: Date
): Promise<Array<{ user_id: string; weekly_score: number; daily_scores: Array<{ date: string; score: number }> }>> {
  // Get Monday 00:00 in Indonesian timezone
  const startDate = weekStart || getWeekStartIndonesian();
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6); // End of week (Sunday)
  
  // Get all users' scores for the week
  const { data: scores } = await supabase
    .from('nutrition_scores')
    .select('user_id, date, daily_score')
    .gte('date', format(startDate, 'yyyy-MM-dd'))
    .lte('date', format(endDate, 'yyyy-MM-dd'))
    .order('user_id, date', { ascending: true });
  
  // Group by user_id and calculate weekly averages
  const userScores = new Map<string, Array<{ date: string; score: number }>>();
  
  (scores || []).forEach(score => {
    if (!userScores.has(score.user_id)) {
      userScores.set(score.user_id, []);
    }
    userScores.get(score.user_id)!.push({
      date: score.date,
      score: score.daily_score
    });
  });
  
  // Calculate weekly averages for each user
  const result: Array<{ user_id: string; weekly_score: number; daily_scores: Array<{ date: string; score: number }> }> = [];
  
  userScores.forEach((dailyScores, userId) => {
    const validScores = dailyScores.filter(d => d.score > 0);
    const weeklyScore = validScores.length > 0
      ? Math.round(validScores.reduce((sum, d) => sum + d.score, 0) / validScores.length)
      : 0;
    
    result.push({
      user_id: userId,
      weekly_score: weeklyScore,
      daily_scores: dailyScores
    });
  });
  
  return result;
}

/**

/**
 * Legacy compatibility functions
 */
export async function getTodayScore(userId: string): Promise<{
  score: number;
  breakdown: { nutrition: number; training: number; bonuses: number; penalties: number };
}> {
  const result = await getTodayUnifiedScore(userId, 'runner-focused');
  
  return {
    score: result.score,
    breakdown: {
      nutrition: result.breakdown.nutrition.total,
      training: result.breakdown.training.total,
      bonuses: result.breakdown.bonuses,
      penalties: result.breakdown.penalties,
    },
  };
}

export async function getDailyScoreForDate(userId: string, dateISO: string): Promise<{
  score: number;
  breakdown: { nutrition: number; training: number; bonuses: number; penalties: number };
}> {
  const result = await getDailyUnifiedScore(userId, dateISO, 'runner-focused');
  
  return {
    score: result.score,
    breakdown: {
      nutrition: result.breakdown.nutrition.total,
      training: result.breakdown.training.total,
      bonuses: result.breakdown.bonuses,
      penalties: result.breakdown.penalties,
    },
  };
}

export async function getWeeklyScorePersisted(userId: string): Promise<{
  average: number;
  dailyScores: Array<{ date: string; score: number }>;
}> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Start of week (Monday)
  
  return getWeeklyUnifiedScore(userId, weekStart, 'runner-focused');
}
