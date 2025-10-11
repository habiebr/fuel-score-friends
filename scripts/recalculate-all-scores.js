/**
 * Comprehensive Score Recalculation Script
 * 
 * This script recalculates:
 * 1. Daily scores based on food logs and activity data
 * 2. Weekly scores as averages of daily scores
 * 
 * Usage: 
 *   node scripts/recalculate-all-scores.js [DAYS_BACK]
 *   
 * Example:
 *   node scripts/recalculate-all-scores.js 30  # Recalculate last 30 days
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const args = process.argv.slice(2);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const DAYS_TO_RECALCULATE = parseInt(args[0] || process.env.DAYS_TO_RECALCULATE || '7', 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase configuration.');
  console.error('Set environment variables: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================================
// UNIFIED SCORING SYSTEM (mirrors src/lib/unified-scoring.ts)
// ============================================================================

const SCORING_CONFIG = {
  'runner-focused': {
    macroWeights: {
      calories: 0.35,
      protein: 0.25,
      carbs: 0.25,
      fat: 0.15
    },
    nutritionWeights: {
      macros: 0.50,
      timing: 0.35,
      structure: 0.15
    }
  }
};

const LOAD_WEIGHTS = {
  rest: { nutrition: 1.0, training: 0.0 },      // 100% nutrition
  easy: { nutrition: 0.70, training: 0.30 },    // 70/30
  moderate: { nutrition: 0.60, training: 0.40 }, // 60/40
  long: { nutrition: 0.55, training: 0.45 },    // 55/45
  quality: { nutrition: 0.60, training: 0.40 }  // 60/40
};

function calculateMacroScore(actual, target) {
  if (!target || target === 0) return 100;
  const ratio = actual / target;
  
  // Piecewise scoring
  if (ratio >= 0.95 && ratio <= 1.05) return 100; // ±5%
  if (ratio >= 0.90 && ratio <= 1.10) return 60;  // ±10%
  if (ratio >= 0.80 && ratio <= 1.20) return 20;  // ±20%
  return 0; // >20% off
}

function calculateTimingScore(target, actual, windows) {
  let score = 100;
  
  if (windows.pre.applicable && !windows.pre.inWindow) {
    score -= 20;
  }
  if (windows.post.applicable && !windows.post.inWindow) {
    score -= 20;
  }
  
  return Math.max(0, score);
}

function calculateStructureScore(meals, load, singleMealOver60pct) {
  let score = 0;
  const hasBreakfast = meals.includes('breakfast');
  const hasLunch = meals.includes('lunch');
  const hasDinner = meals.includes('dinner');
  const hasSnack = meals.includes('snack');
  
  const needSnack = load === 'quality' || load === 'long';
  
  score += hasBreakfast ? 25 : 0;
  score += hasLunch ? 25 : 0;
  score += hasDinner ? 25 : 0;
  
  if (needSnack) {
    score += hasSnack ? 25 : 0;
  }
  
  // Penalty for imbalanced eating
  if (singleMealOver60pct) {
    score = Math.min(score, 70);
  }
  
  return score;
}

function calculateUnifiedScore(context) {
  const { nutrition, training, load, strategy } = context;
  const config = SCORING_CONFIG[strategy];
  const weights = LOAD_WEIGHTS[load];
  
  // 1. Macro Scores
  const calorieScore = calculateMacroScore(nutrition.actual.calories, nutrition.target.calories);
  const proteinScore = calculateMacroScore(nutrition.actual.protein, nutrition.target.protein);
  const carbsScore = calculateMacroScore(nutrition.actual.carbs, nutrition.target.carbs);
  const fatScore = calculateMacroScore(nutrition.actual.fat, nutrition.target.fat);
  
  const macrosScore =
    calorieScore * config.macroWeights.calories +
    proteinScore * config.macroWeights.protein +
    carbsScore * config.macroWeights.carbs +
    fatScore * config.macroWeights.fat;
  
  // 2. Timing Score
  const timingScore = calculateTimingScore(
    nutrition.target,
    nutrition.actual,
    nutrition.windows
  );
  
  // 3. Structure Score
  const structureScore = calculateStructureScore(
    nutrition.mealsPresent,
    load,
    nutrition.singleMealOver60pct
  );
  
  // 4. Nutrition Total
  const nutritionTotal =
    macrosScore * config.nutritionWeights.macros +
    timingScore * config.nutritionWeights.timing +
    structureScore * config.nutritionWeights.structure;
  
  // 5. Training Score
  let trainingTotal = 100;
  
  if (training.plan || training.actual) {
    const completionScore = (training.actual?.durationMin && training.plan?.durationMin)
      ? calculateMacroScore(training.actual.durationMin, training.plan.durationMin)
      : 100;
    
    const typeMatchScore = training.typeFamilyMatch ? 100 : 0;
    
    const intensityScore = training.intensityOk 
      ? 100 
      : (training.intensityNear ? 60 : 0);
    
    const intensityWeight = training.actual?.avgHr ? 0.15 : 0;
    const completionWeight = 0.60 + (0.15 - intensityWeight);
    
    trainingTotal =
      completionScore * completionWeight +
      typeMatchScore * 0.25 +
      intensityScore * intensityWeight;
  }
  
  // 6. Bonuses
  let bonus = 0;
  if (context.flags?.windowSyncAll) bonus += 5;
  if (context.flags?.streakDays && context.flags.streakDays > 0) {
    bonus += Math.min(5, context.flags.streakDays);
  }
  if (context.flags?.hydrationOk) bonus += 2;
  bonus = Math.min(10, bonus);
  
  // 7. Penalties
  let penalty = 0;
  const hardUnderfuel = context.flags?.isHardDay && 
    nutrition.actual.carbs < (nutrition.target.carbs * 0.8);
  if (hardUnderfuel) penalty -= 5;
  if (context.flags?.bigDeficit && (training.actual?.durationMin ?? 0) >= 90) {
    penalty -= 10;
  }
  if (context.flags?.missedPostWindow) penalty -= 3;
  penalty = Math.max(-15, penalty);
  
  // 8. Final Score
  const final =
    nutritionTotal * weights.nutrition +
    trainingTotal * weights.training +
    bonus +
    penalty;
  
  return Math.max(0, Math.min(100, Math.round(final)));
}

// ============================================================================
// TRAINING LOAD DETERMINATION
// ============================================================================

function determineTrainingLoad(activity) {
  if (!activity) return 'rest';
  
  const distance = activity.distance_km || 0;
  const duration = activity.duration_minutes || 0;
  const intensity = activity.intensity || 'moderate';
  const type = (activity.activity_type || '').toLowerCase();
  
  // Long run: 90+ minutes OR 15+ km
  if (duration >= 90 || distance >= 15) {
    return 'long';
  }
  
  // Quality: high intensity workouts
  if (intensity === 'high' || type.includes('quality') || type.includes('tempo') || type.includes('interval')) {
    return 'quality';
  }
  
  // Easy: 30-90 min OR 5-15 km at low/moderate intensity
  if ((duration >= 30 && duration < 90) || (distance >= 5 && distance < 15)) {
    return 'easy';
  }
  
  // Moderate: shorter workouts
  if (duration >= 20 || distance >= 3) {
    return 'moderate';
  }
  
  return 'rest';
}

// ============================================================================
// RECALCULATION LOGIC
// ============================================================================

async function recalculateDailyScore(userId, dateISO) {
  try {
    // 1. Get meal plan targets
    const { data: mealPlans } = await supabase
      .from('daily_meal_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateISO);
    
    // 2. Get actual food logs
    const { data: foodLogs } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', `${dateISO}T00:00:00`)
      .lte('logged_at', `${dateISO}T23:59:59`);
    
    // 3. Get training activity
    const { data: trainingActivity } = await supabase
      .from('training_activities')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateISO)
      .maybeSingle();
    
    // 4. Get Google Fit data
    const { data: fitData } = await supabase
      .from('google_fit_data')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateISO)
      .maybeSingle();
    
    // 5. Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('weight_kg')
      .eq('user_id', userId)
      .maybeSingle();
    
    const weight = profile?.weight_kg || 70;
    
    // 6. Calculate targets from meal plans
    const targets = (mealPlans || []).reduce((acc, plan) => ({
      calories: acc.calories + (plan.recommended_calories || 0),
      protein: acc.protein + (plan.recommended_protein_grams || 0),
      carbs: acc.carbs + (plan.recommended_carbs_grams || 0),
      fat: acc.fat + (plan.recommended_fat_grams || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    
    // Add fueling windows
    const targetsWithWindows = {
      ...targets,
      preCho: Math.round(weight * 1.5),
      duringChoPerHour: 60,
      postCho: Math.round(weight * 1.0),
      postPro: Math.round(weight * 0.3),
      fatMin: Math.round((targets.calories * 0.2) / 9)
    };
    
    // 7. Calculate actuals from food logs
    const actuals = (foodLogs || []).reduce((acc, log) => ({
      calories: acc.calories + (log.calories || 0),
      protein: acc.protein + (log.protein_grams || 0),
      carbs: acc.carbs + (log.carbs_grams || 0),
      fat: acc.fat + (log.fat_grams || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    
    // 8. Determine training load
    const load = determineTrainingLoad(trainingActivity);
    
    // 9. Get meals present
    const mealsPresent = [...new Set(
      (foodLogs || [])
        .map(log => log.meal_type)
        .filter(Boolean)
    )];
    
    // 10. Check for meal imbalance
    const totalCalories = actuals.calories;
    const maxMealCalories = (foodLogs || []).reduce((max, log) => 
      Math.max(max, log.calories || 0), 0
    );
    const singleMealOver60pct = totalCalories > 0 && 
      (maxMealCalories / totalCalories) > 0.6;
    
    // 11. Build scoring context
    const context = {
      load,
      strategy: 'runner-focused',
      nutrition: {
        target: targetsWithWindows,
        actual: actuals,
        windows: {
          pre: { 
            applicable: load !== 'rest', 
            inWindow: true  // Simplified for now
          },
          during: { 
            applicable: load === 'long' 
          },
          post: { 
            applicable: load !== 'rest', 
            inWindow: true  // Simplified for now
          }
        },
        mealsPresent,
        singleMealOver60pct
      },
      training: {
        plan: trainingActivity ? {
          durationMin: trainingActivity.duration_minutes,
          type: trainingActivity.activity_type,
          intensity: trainingActivity.intensity
        } : undefined,
        actual: fitData || trainingActivity ? {
          durationMin: fitData?.active_minutes || trainingActivity?.duration_minutes || 0,
          avgHr: fitData?.heart_rate_avg
        } : undefined,
        typeFamilyMatch: true,  // Simplified
        intensityOk: true,       // Simplified
        intensityNear: true      // Simplified
      },
      flags: {
        windowSyncAll: true,
        streakDays: 0,
        hydrationOk: true,
        bigDeficit: actuals.calories < (targetsWithWindows.calories * 0.7),
        isHardDay: load !== 'rest',
        missedPostWindow: false
      }
    };
    
    // 12. Calculate score
    const score = calculateUnifiedScore(context);
    
    // 13. Save to database
    const { error: upsertError } = await supabase
      .from('nutrition_scores')
      .upsert({
        user_id: userId,
        date: dateISO,
        daily_score: score,
        calories_consumed: actuals.calories,
        protein_grams: actuals.protein,
        carbs_grams: actuals.carbs,
        fat_grams: actuals.fat,
        meals_logged: (foodLogs || []).length,
        planned_calories: targetsWithWindows.calories,
        planned_protein_grams: targetsWithWindows.protein,
        planned_carbs_grams: targetsWithWindows.carbs,
        planned_fat_grams: targetsWithWindows.fat,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id,date' 
      });
    
    if (upsertError) {
      throw upsertError;
    }
    
    return { date: dateISO, score, load };
    
  } catch (error) {
    console.error(`  ❌ Error recalculating ${dateISO}:`, error.message);
    return { date: dateISO, score: null, error: error.message };
  }
}

async function recalculateWeeklyScore(userId, weekStartDate) {
  try {
    // Get all daily scores for the week
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const weekStartISO = weekStartDate.toISOString().split('T')[0];
    const weekEndISO = weekEnd.toISOString().split('T')[0];
    
    const { data: dailyScores, error } = await supabase
      .from('nutrition_scores')
      .select('daily_score')
      .eq('user_id', userId)
      .gte('date', weekStartISO)
      .lte('date', weekEndISO);
    
    if (error) throw error;
    
    if (!dailyScores || dailyScores.length === 0) {
      return { week: weekStartISO, score: null, daysCount: 0 };
    }
    
    // Average the daily scores (0-100 range)
    const validScores = dailyScores
      .map(d => d.daily_score)
      .filter(s => s !== null && s !== undefined);
    
    if (validScores.length === 0) {
      return { week: weekStartISO, score: null, daysCount: 0 };
    }
    
    const weeklyScore = Math.round(
      validScores.reduce((sum, score) => sum + score, 0) / validScores.length
    );
    
    return { 
      week: weekStartISO, 
      score: weeklyScore, 
      daysCount: validScores.length 
    };
    
  } catch (error) {
    console.error(`  ❌ Error calculating weekly score for ${weekStartDate}:`, error.message);
    return { week: weekStartDate, score: null, error: error.message };
  }
}

async function recalculateForUser(userId, daysBack) {
  console.log(`\n👤 Processing user: ${userId}`);
  console.log(`   Days to recalculate: ${daysBack}`);
  
  const results = {
    daily: [],
    weekly: []
  };
  
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack + 1);
  
  // Recalculate daily scores
  console.log('   📊 Recalculating daily scores...');
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateISO = d.toISOString().split('T')[0];
    const result = await recalculateDailyScore(userId, dateISO);
    results.daily.push(result);
    
    if (result.score !== null) {
      console.log(`      ✓ ${dateISO}: ${result.score} (${result.load})`);
    }
  }
  
  // Recalculate weekly scores
  console.log('   📅 Recalculating weekly scores...');
  
  // Get all unique weeks in the date range
  const weeks = new Set();
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - dayOfWeek);
    weeks.add(weekStart.toISOString().split('T')[0]);
  }
  
  for (const weekStartISO of Array.from(weeks).sort()) {
    const weekStartDate = new Date(weekStartISO);
    const result = await recalculateWeeklyScore(userId, weekStartDate);
    results.weekly.push(result);
    
    if (result.score !== null) {
      console.log(`      ✓ Week ${result.week}: ${result.score} (${result.daysCount} days)`);
    }
  }
  
  return results;
}

async function recalculateAllScores() {
  console.log('🚀 Starting comprehensive score recalculation...\n');
  console.log(`Configuration:`);
  console.log(`  - Days to recalculate: ${DAYS_TO_RECALCULATE}`);
  console.log(`  - Supabase URL: ${SUPABASE_URL}`);
  console.log('');
  
  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('user_id')
      .not('user_id', 'is', null);
    
    if (usersError) throw usersError;
    
    console.log(`📋 Found ${users.length} users to process\n`);
    
    const allResults = [];
    
    // Process each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`[${i + 1}/${users.length}]`);
      
      try {
        const results = await recalculateForUser(user.user_id, DAYS_TO_RECALCULATE);
        allResults.push({
          userId: user.user_id,
          success: true,
          results
        });
      } catch (error) {
        console.error(`   ❌ Failed for user ${user.user_id}:`, error.message);
        allResults.push({
          userId: user.user_id,
          success: false,
          error: error.message
        });
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ RECALCULATION COMPLETE');
    console.log('='.repeat(60));
    
    const successCount = allResults.filter(r => r.success).length;
    const failureCount = allResults.filter(r => !r.success).length;
    
    console.log(`\nUsers processed: ${users.length}`);
    console.log(`  ✓ Success: ${successCount}`);
    console.log(`  ✗ Failed: ${failureCount}`);
    
    if (successCount > 0) {
      const totalDailyScores = allResults
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.results.daily.filter(d => d.score !== null).length, 0);
      
      const totalWeeklyScores = allResults
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.results.weekly.filter(w => w.score !== null).length, 0);
      
      console.log(`\nScores recalculated:`);
      console.log(`  📊 Daily scores: ${totalDailyScores}`);
      console.log(`  📅 Weekly scores: ${totalWeeklyScores}`);
    }
    
    console.log('');
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run the recalculation
recalculateAllScores()
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('👋 Exiting...\n');
    process.exit(0);
  });
