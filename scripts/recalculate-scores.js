import { createClient } from '@supabase/supabase-js';

// Prefer CLI args; fallback to environment variables
const args = process.argv.slice(2);
const SUPABASE_URL = args[0] || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = args[1] || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const DAYS_TO_RECALCULATE = parseInt(args[2] || process.env.DAYS_TO_RECALCULATE || '7', 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase configuration. Provide CLI args or set env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---- Minimal unified scoring helpers (mirrors Edge function logic) ----
const SCORING_CONFIG = {
  'runner-focused': {
    macroWeights: { calories: 0.35, protein: 0.25, carbs: 0.25, fat: 0.15 },
    nutritionWeights: { macros: 0.50, timing: 0.35, structure: 0.15 }
  }
};
const LOAD_WEIGHTS = {
  rest: { nutrition: 0.85, training: 0.15 },
  easy: { nutrition: 0.80, training: 0.20 },
  quality: { nutrition: 0.70, training: 0.30 },
  long: { nutrition: 0.65, training: 0.35 }
};
function calculateMacroScore(actual, target) {
  if (!target) return 100;
  const ratio = actual / target;
  if (ratio >= 0.9 && ratio <= 1.1) return 100;
  if (ratio >= 0.8 && ratio <= 1.2) return 80;
  if (ratio >= 0.7 && ratio <= 1.3) return 60;
  if (ratio >= 0.6 && ratio <= 1.4) return 40;
  return 0;
}
function calculateTimingScore(target, actual, windows) {
  let score = 100;
  if (windows.pre.applicable && !windows.pre.inWindow) score -= 20;
  if (windows.post.applicable && !windows.post.inWindow) score -= 20;
  return Math.max(0, score);
}
function calculateStructureScore(meals, load, singleMealOver60pct) {
  let score = 0;
  const hasB = meals.includes('breakfast');
  const hasL = meals.includes('lunch');
  const hasD = meals.includes('dinner');
  const hasS = meals.includes('snack');
  const needSnack = load === 'quality' || load === 'long';
  score += hasB ? 25 : 0;
  score += hasL ? 25 : 0;
  score += hasD ? 25 : 0;
  if (needSnack) score += hasS ? 25 : 0;
  if (singleMealOver60pct) score = Math.min(score, 70);
  return score;
}
function calculateUnifiedScore(context) {
  const { nutrition, training, load, strategy } = context;
  const config = SCORING_CONFIG[strategy];
  const weights = LOAD_WEIGHTS[load];
  const calorieScore = calculateMacroScore(nutrition.actual.calories, nutrition.target.calories);
  const proteinScore = calculateMacroScore(nutrition.actual.protein, nutrition.target.protein);
  const carbsScore = calculateMacroScore(nutrition.actual.carbs, nutrition.target.carbs);
  const fatScore = calculateMacroScore(nutrition.actual.fat, nutrition.target.fat);
  const macrosScore =
    calorieScore * config.macroWeights.calories +
    proteinScore * config.macroWeights.protein +
    carbsScore * config.macroWeights.carbs +
    fatScore * config.macroWeights.fat;
  const timingScore = calculateTimingScore(nutrition.target, nutrition.actual, nutrition.windows);
  const structureScore = calculateStructureScore(nutrition.mealsPresent, load, nutrition.singleMealOver60pct);
  const nutritionTotal = macrosScore * config.nutritionWeights.macros + timingScore * config.nutritionWeights.timing + structureScore * config.nutritionWeights.structure;
  let trainingTotal = 100;
  if (training.plan || training.actual) {
    const completionScore = training.actual?.durationMin && training.plan?.durationMin
      ? calculateMacroScore(training.actual.durationMin, training.plan.durationMin)
      : 100;
    const typeMatchScore = training.typeFamilyMatch ? 100 : 0;
    const intensityScore = training.intensityOk ? 100 : training.intensityNear ? 60 : 0;
    const intensityWeight = training.actual?.avgHr ? 0.15 : 0;
    const completionWeight = 0.60 + (0.15 - intensityWeight);
    trainingTotal = completionScore * completionWeight + typeMatchScore * 0.25 + intensityScore * intensityWeight;
  }
  let bonus = 0;
  if (context.flags?.windowSyncAll) bonus += 5;
  if (context.flags?.streakDays && context.flags.streakDays > 0) bonus += Math.min(5, context.flags.streakDays);
  if (context.flags?.hydrationOk) bonus += 2;
  bonus = Math.min(10, bonus);
  let penalty = 0;
  const hardUnderfuel = context.flags?.isHardDay && nutrition.actual.carbs < (nutrition.target.carbs * 0.8);
  if (hardUnderfuel) penalty -= 5;
  if (context.flags?.bigDeficit && (training.actual?.durationMin ?? 0) >= 90) penalty -= 10;
  if (context.flags?.missedPostWindow) penalty -= 3;
  penalty = Math.max(-15, penalty);
  const final = nutritionTotal * weights.nutrition + trainingTotal * weights.training + bonus + penalty;
  return Math.max(0, Math.min(100, Math.round(final)));
}

async function recalcForUser(userId, daysBack) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack + 1);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateISO = d.toISOString().slice(0, 10);
    const { data: mealPlans } = await supabase
      .from('daily_meal_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateISO);
    const { data: foodLogs } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', `${dateISO}T00:00:00`)
      .lte('logged_at', `${dateISO}T23:59:59`);
    const { data: fit } = await supabase
      .from('google_fit_data')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateISO)
      .maybeSingle();
    const { data: profile } = await supabase
      .from('profiles')
      .select('weight_kg')
      .eq('user_id', userId)
      .maybeSingle();
    const weight = profile?.weight_kg || 70;
    const targets = (mealPlans || []).reduce((acc, p) => ({
      calories: acc.calories + (p.recommended_calories || 0),
      protein: acc.protein + (p.recommended_protein_grams || 0),
      carbs: acc.carbs + (p.recommended_carbs_grams || 0),
      fat: acc.fat + (p.recommended_fat_grams || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const targetsWithWindows = {
      ...targets,
      preCho: Math.round(weight * 1.5),
      duringChoPerHour: 60,
      postCho: Math.round(weight * 1.0),
      postPro: Math.round(weight * 0.3),
      fatMin: Math.round((targets.calories * 0.2) / 9)
    };
    const actuals = (foodLogs || []).reduce((acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein: acc.protein + (l.protein_grams || 0),
      carbs: acc.carbs + (l.carbs_grams || 0),
      fat: acc.fat + (l.fat_grams || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const mealsPresent = [...new Set((foodLogs || []).map(l => l.meal_type).filter(Boolean))];
    const load = (fit?.active_minutes || 0) > 60 ? 'quality' : (fit?.active_minutes || 0) > 30 ? 'easy' : 'rest';
    const context = {
      load,
      strategy: 'runner-focused',
      nutrition: {
        target: targetsWithWindows,
        actual: actuals,
        windows: {
          pre: { applicable: load !== 'rest', inWindow: true },
          during: { applicable: load === 'long' },
          post: { applicable: load !== 'rest', inWindow: true }
        },
        mealsPresent,
        singleMealOver60pct: false
      },
      training: {
        actual: { durationMin: fit?.active_minutes || 0, avgHr: fit?.heart_rate_avg },
        intensityOk: true,
        intensityNear: true
      },
      flags: { windowSyncAll: true, streakDays: 0, hydrationOk: true, bigDeficit: false, isHardDay: load !== 'rest', missedPostWindow: false }
    };
    const score = calculateUnifiedScore(context);
    await supabase
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
      }, { onConflict: 'user_id,date' });
  }
}

async function recalculateScores() {
  try {
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('user_id')
      .not('user_id', 'is', null);
    if (usersError) throw usersError;
    console.log(`Found ${users.length} users to process`);
    for (const u of users) {
      console.log(`Recalculating for user ${u.user_id} (last ${DAYS_TO_RECALCULATE} days)...`);
      try {
        await recalcForUser(u.user_id, DAYS_TO_RECALCULATE);
      } catch (e) {
        console.error(`Failed for user ${u.user_id}:`, e);
      }
    }
    console.log('Score recalculation complete!');
  } catch (error) {
    console.error('Failed to recalculate scores:', error);
  }
}

recalculateScores()
  .catch(console.error)
  .finally(() => process.exit());