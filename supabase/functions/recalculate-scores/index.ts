import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  preCho?: number;
  duringChoPerHour?: number;
  postCho?: number;
  postPro?: number;
  fatMin?: number;
}

interface NutritionActuals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ScoringContext {
  load: 'rest' | 'easy' | 'quality' | 'long';
  strategy: 'runner-focused';
  nutrition: {
    target: NutritionTargets;
    actual: NutritionActuals;
    windows: {
      pre: { applicable: boolean; inWindow: boolean };
      during: { applicable: boolean };
      post: { applicable: boolean; inWindow: boolean };
    };
    mealsPresent: string[];
    singleMealOver60pct?: boolean;
  };
  training: {
    plan?: { durationMin?: number; type?: string; intensity?: number };
    actual?: { durationMin?: number; type?: string; avgHr?: number };
    typeFamilyMatch?: boolean;
    intensityOk?: boolean;
    intensityNear?: boolean;
  };
  flags?: {
    windowSyncAll?: boolean;
    streakDays?: number;
    hydrationOk?: boolean;
    bigDeficit?: boolean;
    isHardDay?: boolean;
    missedPostWindow?: boolean;
  };
}

// Scoring configuration
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
  'rest': { nutrition: 0.85, training: 0.15 },
  'easy': { nutrition: 0.80, training: 0.20 },
  'quality': { nutrition: 0.70, training: 0.30 },
  'long': { nutrition: 0.65, training: 0.35 }
};

// Penalty Configuration (matches unified-scoring.ts)
const PENALTY_PROFILES = {
  reduced: {
    hardUnderfuel: -2,           // Old: -5
    bigDeficit: -5,              // Old: -10
    missedPostWindow: -1,        // Old: -3
    maxCombined: -8,             // Old: -15
    noFoodLogs: -15,             // Old: -30
    noStructuredMeals: 0,         // Old: -10 (DISABLED)
  },
  strict: {
    hardUnderfuel: -5,
    bigDeficit: -10,
    missedPostWindow: -3,
    maxCombined: -15,
    noFoodLogs: -30,
    noStructuredMeals: -10,
  },
};

const ACTIVE_PENALTY_PROFILE: 'reduced' | 'strict' = 'reduced';
const PENALTIES = PENALTY_PROFILES[ACTIVE_PENALTY_PROFILE];

function calculateMacroScore(actual: number, target: number): number {
  if (target === 0) return 100;
  const ratio = actual / target;
  if (ratio >= 0.9 && ratio <= 1.1) return 100;
  if (ratio >= 0.8 && ratio <= 1.2) return 80;
  if (ratio >= 0.7 && ratio <= 1.3) return 60;
  if (ratio >= 0.6 && ratio <= 1.4) return 40;
  return 0;
}

function calculateTimingScore(target: NutritionTargets, actual: NutritionActuals, windows: any): number {
  let score = 100;
  if (windows.pre.applicable && !windows.pre.inWindow) score -= 20;
  if (windows.post.applicable && !windows.post.inWindow) score -= 20;
  return Math.max(0, score);
}

function calculateStructureScore(meals: string[], load: string, singleMealOver60pct?: boolean): number {
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

function calculateUnifiedScore(context: ScoringContext) {
  const { nutrition, training, load, strategy } = context;
  const config = SCORING_CONFIG[strategy];
  const weights = LOAD_WEIGHTS[load];
  
  // Calculate macro scores
  const calorieScore = calculateMacroScore(nutrition.actual.calories, nutrition.target.calories);
  const proteinScore = calculateMacroScore(nutrition.actual.protein, nutrition.target.protein);
  const carbsScore = calculateMacroScore(nutrition.actual.carbs, nutrition.target.carbs);
  const fatScore = calculateMacroScore(nutrition.actual.fat, nutrition.target.fat);
  
  // Weighted macro score
  const macrosScore = 
    calorieScore * config.macroWeights.calories +
    proteinScore * config.macroWeights.protein +
    carbsScore * config.macroWeights.carbs +
    fatScore * config.macroWeights.fat;
  
  // Calculate timing score
  const timingScore = calculateTimingScore(nutrition.target, nutrition.actual, nutrition.windows);
  
  // Calculate structure score
  const structureScore = calculateStructureScore(
    nutrition.mealsPresent,
    load,
    nutrition.singleMealOver60pct
  );
  
  // Overall nutrition score
  const nutritionTotal = 
    macrosScore * config.nutritionWeights.macros +
    timingScore * config.nutritionWeights.timing +
    structureScore * config.nutritionWeights.structure;
  
  // Calculate training scores if applicable
  let trainingTotal = 100;
  if (training.plan || training.actual) {
    const completionScore = training.actual?.durationMin && training.plan?.durationMin
      ? calculateMacroScore(training.actual.durationMin, training.plan.durationMin)
      : 100;
    const typeMatchScore = training.typeFamilyMatch ? 100 : 0;
    const intensityScore = training.intensityOk ? 100 : training.intensityNear ? 60 : 0;
    const intensityWeight = training.actual?.avgHr ? 0.15 : 0;
    const completionWeight = 0.60 + (0.15 - intensityWeight);
    trainingTotal = 
      completionScore * completionWeight +
      typeMatchScore * 0.25 +
      intensityScore * intensityWeight;
  }

  // Calculate modifiers
  let bonus = 0;
  if (context.flags?.windowSyncAll) bonus += 5;
  if (context.flags?.streakDays && context.flags.streakDays > 0) {
    bonus += Math.min(5, context.flags.streakDays);
  }
  if (context.flags?.hydrationOk) bonus += 2;
  bonus = Math.min(10, bonus);

  let penalty = 0;
  const hardUnderfuel = context.flags?.isHardDay && nutrition.actual.carbs < (nutrition.target.carbs * 0.8);
  if (hardUnderfuel) penalty += PENALTIES.hardUnderfuel; // Negative value
  if (context.flags?.bigDeficit && (training.actual?.durationMin ?? 0) >= 90) penalty += PENALTIES.bigDeficit; // Negative value
  if (context.flags?.missedPostWindow) penalty += PENALTIES.missedPostWindow; // Negative value
  penalty = Math.max(PENALTIES.maxCombined, penalty);

  // Final weighted score
  const final = (nutritionTotal * weights.nutrition) + (trainingTotal * weights.training) + bonus + penalty;
  return {
    total: Math.max(0, Math.min(100, Math.round(final))),
    nutrition: { total: nutritionTotal, macros: macrosScore, timing: timingScore, structure: structureScore },
    training: { total: trainingTotal },
    modifiers: { bonuses: bonus, penalties: penalty }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { daysBack = 30 } = await req.json();
    
    // Create authenticated Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get user from auth header
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    // Get date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get user profile for weight-based calculations
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('weight_kg, height_cm, age, sex, activity_level')
      .eq('user_id', user.id)
      .single();

    const weight = profile?.weight_kg || 70;

    // Process each day
    const results = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateISO = d.toISOString().split('T')[0];
      
      // Get meal plans
      const { data: mealPlans } = await supabaseClient
        .from('daily_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateISO);

      // Get food logs
      const { data: foodLogs } = await supabaseClient
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${dateISO}T00:00:00`)
        .lte('logged_at', `${dateISO}T23:59:59`);

      // Get training data
      const { data: trainingData } = await supabaseClient
        .from('google_fit_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateISO)
        .maybeSingle();

      // Calculate targets from meal plans
      const nutritionTargets = (mealPlans || []).reduce((acc, plan) => ({
        calories: acc.calories + (plan.recommended_calories || 0),
        protein: acc.protein + (plan.recommended_protein_grams || 0),
        carbs: acc.carbs + (plan.recommended_carbs_grams || 0),
        fat: acc.fat + (plan.recommended_fat_grams || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

      // Add fueling windows
      const nutritionTargetsWithWindows = {
        ...nutritionTargets,
        preCho: Math.round(weight * 1.5),
        duringChoPerHour: 60,
        postCho: Math.round(weight * 1.0),
        postPro: Math.round(weight * 0.3),
        fatMin: Math.round((nutritionTargets.calories * 0.2) / 9),
      };

      // Calculate actuals from food logs
      const nutritionActuals = (foodLogs || []).reduce((acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein_grams || 0),
        carbs: acc.carbs + (log.carbs_grams || 0),
        fat: acc.fat + (log.fat_grams || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

      // Determine meal presence
      const mealsPresent = [...new Set((foodLogs || []).map(log => log.meal_type))];

      // Calculate training load
      const load = trainingData?.active_minutes > 60 ? 'quality' : 
                  trainingData?.active_minutes > 30 ? 'easy' : 'rest';

      // Create scoring context
      const context: ScoringContext = {
        load,
        strategy: 'runner-focused',
        nutrition: {
          target: nutritionTargetsWithWindows,
          actual: nutritionActuals,
          windows: {
            pre: { applicable: load !== 'rest', inWindow: true },
            during: { applicable: load === 'long' },
            post: { applicable: load !== 'rest', inWindow: true }
          },
          mealsPresent,
          singleMealOver60pct: false // TODO: Calculate this
        },
        training: {
          actual: {
            durationMin: trainingData?.active_minutes || 0,
            avgHr: trainingData?.heart_rate_avg
          },
          intensityOk: true, // Simplified for now
          intensityNear: true
        },
        flags: {
          windowSyncAll: true,
          streakDays: 0, // TODO: Calculate this
          hydrationOk: true,
          bigDeficit: false,
          isHardDay: load === 'long' || load === 'quality',
          missedPostWindow: false
        }
      };

      // Calculate score
      const score = calculateUnifiedScore(context);

      // Store result
      const { error: upsertError } = await supabaseClient
        .from('nutrition_scores')
        .upsert({
          user_id: user.id,
          date: dateISO,
          daily_score: score.total,
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

      if (upsertError) {
        console.error(`Error updating score for ${dateISO}:`, upsertError);
      }

      results.push({
        date: dateISO,
        score: score.total,
        breakdown: score
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recalculated scores for ${results.length} days`,
        data: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Score recalculation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
