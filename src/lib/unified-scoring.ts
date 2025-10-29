/**
 * Unified Scoring System
 * 
 * This module consolidates all nutrition and training scoring logic into a single,
 * comprehensive system that can be used throughout the application.
 * 
 * Features:
 * - Single source of truth for all scoring calculations
 * - Configurable scoring strategies (runner-focused, general, meal-level)
 * - Comprehensive breakdown of score components
 * - Support for different training loads and contexts
 * - Extensible design for future scoring requirements
 */

export type TrainingLoad = 'rest' | 'easy' | 'moderate' | 'long' | 'quality';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type ScoringStrategy = 'runner-focused' | 'general' | 'meal-level';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // Fueling windows for runners
  preCho?: number;
  duringChoPerHour?: number;
  postCho?: number;
  postPro?: number;
  fatMin?: number;
}

export interface NutritionActuals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // Fueling windows
  preCho?: number;
  duringChoPerHour?: number;
  postCho?: number;
  postPro?: number;
}

export interface TrainingPlan {
  durationMin?: number;
  type?: string;
  intensity?: 'low' | 'moderate' | 'high';
}

export interface TrainingActual {
  durationMin?: number;
  type?: string;
  avgHr?: number;
}

export interface FuelingWindows {
  pre: { applicable: boolean; inWindow: boolean };
  during: { applicable: boolean };
  post: { applicable: boolean; inWindow: boolean };
}

export interface ScoringContext {
  // Core data
  nutrition: {
    target: NutritionTargets;
    actual: NutritionActuals;
    windows: FuelingWindows;
    mealsPresent: MealType[];
    singleMealOver60pct?: boolean;
  };
  training: {
    plan?: TrainingPlan;
    actual?: TrainingActual;
    typeFamilyMatch?: boolean;
    intensityOk?: boolean;
    intensityNear?: boolean;
  };
  // Scoring configuration
  load: TrainingLoad;
  strategy: ScoringStrategy;
  experienceLevel?: ExperienceLevel;
  // Flags and bonuses
  flags?: {
    windowSyncAll?: boolean;
    streakDays?: number;
    hydrationOk?: boolean;
    bigDeficit?: boolean;
    isHardDay?: boolean;
    missedPostWindow?: boolean;
  };
}

export interface ScoreBreakdown {
  // Overall score
  total: number;
  // Component scores
  nutrition: {
    total: number;
    macros: number;
    timing: number;
    structure: number;
  };
  training: {
    total: number;
    completion: number;
    typeMatch: number;
    intensity: number;
  };
  // Modifiers
  bonuses: number;
  penalties: number;
  // Load-based weights
  weights: {
    nutrition: number;
    training: number;
  };
  // Data completeness tracking
  dataCompleteness?: {
    hasBodyMetrics: boolean;
    hasMealPlan: boolean;
    hasFoodLogs: boolean;
    mealsLogged: number;
    reliable: boolean;
    missingData: string[];
  };
}

export interface MealScore {
  mealType: MealType;
  score: number;
  breakdown: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

/**
 * Penalty Configuration
 * 
 * Option 1 (Current - Reduced Severity): Less strict penalties for better user experience
 * Option 2 (Legacy - Strict): Original strict penalties for maximum accountability
 * 
 * To switch: Change ACTIVE_PENALTY_PROFILE below
 */
const PENALTY_PROFILES = {
  reduced: {
    // Activity-based penalties (max -8 instead of -15)
    hardUnderfuel: -2,           // Old: -5
    bigDeficit: -5,              // Old: -10
    missedPostWindow: -1,        // Old: -3
    maxCombined: -8,             // Old: -15
    
    // Data completeness penalties (reduced)
    noFoodLogs: -15,             // Old: -30
    noStructuredMeals: 0,        // Old: -10 (DISABLED)
  },
  strict: {
    // Activity-based penalties (original strict values)
    hardUnderfuel: -5,
    bigDeficit: -10,
    missedPostWindow: -3,
    maxCombined: -15,
    
    // Data completeness penalties (original values)
    noFoodLogs: -30,
    noStructuredMeals: -10,
  },
} as const;

// Switch penalty profile here: 'reduced' or 'strict'
const ACTIVE_PENALTY_PROFILE: 'reduced' | 'strict' = 'reduced';

const PENALTIES = PENALTY_PROFILES[ACTIVE_PENALTY_PROFILE];

/**
 * Configuration for different scoring strategies
 */
const SCORING_CONFIG = {
  'runner-focused': {
    macroWeights: { calories: 0.3, carbs: 0.4, protein: 0.2, fat: 0.1 },
    nutritionWeights: { macros: 0.50, timing: 0.35, structure: 0.15 },
    overconsumptionThreshold: 1.15,
    overconsumptionPenalty: 10,
  },
  'general': {
    macroWeights: { calories: 0.4, protein: 0.3, carbs: 0.2, fat: 0.1 },
    nutritionWeights: { macros: 0.60, timing: 0.25, structure: 0.15 },
    overconsumptionThreshold: 1.1,
    overconsumptionPenalty: 5,
  },
  'meal-level': {
    macroWeights: { calories: 0.4, protein: 0.2, carbs: 0.2, fat: 0.2 },
    nutritionWeights: { macros: 0.60, timing: 0.25, structure: 0.15 },
    overconsumptionThreshold: 1.1,
    overconsumptionPenalty: 3,
  },
} as const;

/**
 * Progressive scoring tolerances based on experience level
 */
const EXPERIENCE_TOLERANCES = {
  beginner: {
    perfect: 0.15,    // ±15% = perfect (very forgiving)
    good: 0.25,       // ±25% = good
    fair: 0.40,       // ±40% = fair
    poor: 0.60,       // ±60% = poor
    veryPoor: 1.0,    // >60% = very poor
  },
  intermediate: {
    perfect: 0.10,    // ±10% = perfect (current default)
    good: 0.20,       // ±20% = good
    fair: 0.30,       // ±30% = fair
    poor: 0.50,       // ±50% = poor
    veryPoor: 0.80,   // >50% = very poor
  },
  advanced: {
    perfect: 0.05,    // ±5% = perfect (strict)
    good: 0.10,       // ±10% = good
    fair: 0.20,       // ±20% = fair
    poor: 0.30,       // ±30% = poor
    veryPoor: 0.50,   // >30% = very poor
  },
} as const;

/**
 * Load-based weights for nutrition vs training importance
 */
const LOAD_WEIGHTS: Record<TrainingLoad, { nutrition: number; training: number }> = {
  rest: { nutrition: 1.0, training: 0.0 },
  easy: { nutrition: 0.7, training: 0.3 },
  moderate: { nutrition: 0.6, training: 0.4 },
  long: { nutrition: 0.55, training: 0.45 },
  quality: { nutrition: 0.6, training: 0.4 },
};

/**
 * Calculate macro score using piecewise function with progressive tolerances
 */
function calculateMacroScore(actual: number, target: number, experienceLevel: ExperienceLevel = 'intermediate'): number {
  // If target is 0 or missing, this indicates missing meal plan data
  // Return 0 instead of 100 to avoid rewarding incomplete data
  if (target <= 0) return 0;
  
  const errorPercent = Math.abs(actual - target) / target;
  const tolerances = EXPERIENCE_TOLERANCES[experienceLevel];
  
  // Progressive scoring based on experience level
  if (errorPercent <= tolerances.perfect) return 100;
  if (errorPercent <= tolerances.good) return 80;
  if (errorPercent <= tolerances.fair) return 60;
  if (errorPercent <= tolerances.poor) return 40;
  if (errorPercent <= tolerances.veryPoor) return 20;
  return 0;  // Beyond very poor threshold
}

/**
 * Calculate timing score for fueling windows
 */
function calculateTimingScore(
  target: NutritionTargets,
  actual: NutritionActuals,
  windows: FuelingWindows
): number {
  let preScore = 100;
  if (windows.pre.applicable) {
    const need = (target.preCho ?? 0) * 0.8;
    const got = actual.preCho ?? 0;
    if (need <= 0) {
      preScore = 100;
    } else if (windows.pre.inWindow) {
      // In window: gradual scoring based on how close to target
      const ratio = got / need;
      if (ratio >= 1.0) preScore = 100;      // 100%+ of target
      else if (ratio >= 0.8) preScore = 90;  // 80-99% of target
      else if (ratio >= 0.6) preScore = 70;  // 60-79% of target
      else if (ratio >= 0.4) preScore = 50;  // 40-59% of target
      else preScore = 30;                     // <40% of target
    } else {
      // Out of window: partial credit for effort
      const ratio = got / need;
      if (ratio >= 0.8) preScore = 60;        // Good amount, wrong timing
      else if (ratio >= 0.5) preScore = 40;  // Decent amount, wrong timing
      else preScore = 20;                     // Low amount, wrong timing
    }
  }

  let duringScore = 100;
  if (windows.during.applicable) {
    const need = target.duringChoPerHour ?? 0;
    const got = actual.duringChoPerHour ?? 0;
    if (need <= 0) {
      duringScore = 100;
    } else {
      const delta = Math.abs(got - need);
      if (delta >= 30) {
        duringScore = 0;
      } else if (delta <= 10) {
        duringScore = 100;
      } else {
        duringScore = Math.round(100 * (1 - (delta - 10) / 20));
      }
    }
  }

  let postScore = 100;
  if (windows.post.applicable) {
    const needCho = (target.postCho ?? 0) * 0.8;
    const needPro = (target.postPro ?? 0) * 0.8;
    const gotCho = actual.postCho ?? 0;
    const gotPro = actual.postPro ?? 0;
    
    if (needCho + needPro <= 0) {
      postScore = 100;
    } else if (windows.post.inWindow) {
      // In window: score both carbs and protein separately, then average
      const choRatio = needCho > 0 ? Math.min(gotCho / needCho, 1.0) : 1.0;
      const proRatio = needPro > 0 ? Math.min(gotPro / needPro, 1.0) : 1.0;
      
      const choScore = choRatio >= 0.8 ? 100 : choRatio >= 0.6 ? 80 : choRatio >= 0.4 ? 60 : 40;
      const proScore = proRatio >= 0.8 ? 100 : proRatio >= 0.6 ? 80 : proRatio >= 0.4 ? 60 : 40;
      
      postScore = Math.round((choScore + proScore) / 2);
    } else {
      // Out of window: partial credit
      const choRatio = needCho > 0 ? Math.min(gotCho / needCho, 1.0) : 1.0;
      const proRatio = needPro > 0 ? Math.min(gotPro / needPro, 1.0) : 1.0;
      const avgRatio = (choRatio + proRatio) / 2;
      
      if (avgRatio >= 0.8) postScore = 60;      // Good amount, wrong timing
      else if (avgRatio >= 0.5) postScore = 40; // Decent amount, wrong timing
      else postScore = 20;                       // Low amount, wrong timing
    }
  }

  return preScore * 0.4 + duringScore * 0.4 + postScore * 0.2;
}

/**
 * Calculate structure score based on meal distribution
 */
function calculateStructureScore(
  mealsPresent: MealType[],
  load: TrainingLoad,
  singleMealOver60pct?: boolean
): number {
  const needSnack = load !== 'rest';
  let score = 0;
  
  const hasBreakfast = mealsPresent.includes('breakfast');
  const hasLunch = mealsPresent.includes('lunch');
  const hasDinner = mealsPresent.includes('dinner');
  const hasSnack = mealsPresent.includes('snack');
  
  score += hasBreakfast ? 25 : 0;
  score += hasLunch ? 25 : 0;
  score += hasDinner ? 25 : 0;
  if (needSnack) score += hasSnack ? 25 : 0;
  
  // Penalty for single meal over 60% of calories
  if (singleMealOver60pct) score = Math.min(score, 70);
  
  return score;
}

/**
 * Calculate training completion score
 */
function calculateTrainingCompletion(plan?: TrainingPlan, actual?: TrainingActual): number {
  const planned = plan?.durationMin ?? 0;
  const actualDur = actual?.durationMin ?? 0;
  
  if (planned === 0 && actualDur === 0) return 100;
  if (planned === 0) return 100; // No plan, any activity is good
  
  const ratio = actualDur / planned;
  if (ratio >= 0.9 && ratio <= 1.1) return 100;
  if (ratio >= 0.75 && ratio <= 1.25) return 60;
  return 0;
}

/**
 * Calculate training type match score
 */
function calculateTypeMatch(typeFamilyMatch?: boolean): number {
  return typeFamilyMatch ? 100 : 0;
}

/**
 * Calculate training intensity score
 */
function calculateIntensityScore(
  intensityOk?: boolean,
  intensityNear?: boolean,
  hasHeartRate?: boolean
): { score: number; weight: number } {
  let score = 0;
  if (intensityOk) score = 100;
  else if (intensityNear) score = 60;
  else score = 0;
  
  // Weight is 0 if no heart rate data available
  const weight = hasHeartRate ? 0.15 : 0;
  
  return { score, weight };
}

/**
 * Calculate bonuses and penalties
 */
function calculateModifiers(
  flags?: ScoringContext['flags'],
  actual: NutritionActuals = { calories: 0, protein: 0, carbs: 0, fat: 0 },
  target: NutritionTargets = { calories: 0, protein: 0, carbs: 0, fat: 0 },
  actualDur: number = 0
): { bonuses: number; penalties: number } {
  let bonuses = 0;
  let penalties = 0;
  
  if (!flags) return { bonuses, penalties };
  
  // Bonuses
  if (flags.windowSyncAll) bonuses += 5;
  if (flags.streakDays && flags.streakDays > 0) bonuses += Math.min(5, flags.streakDays);
  if (flags.hydrationOk) bonuses += 2;
  bonuses = Math.min(10, bonuses);
  
  // Penalties - using configurable values
  const hardUnderfuel = flags.isHardDay && actual.carbs < (target.carbs * 0.8);
  if (hardUnderfuel) penalties += PENALTIES.hardUnderfuel; // Negative value
  if (flags.bigDeficit && actualDur >= 90) penalties += PENALTIES.bigDeficit; // Negative value
  if (flags.missedPostWindow) penalties += PENALTIES.missedPostWindow; // Negative value
  penalties = Math.max(PENALTIES.maxCombined, penalties);
  
  return { bonuses, penalties };
}

/**
 * Main unified scoring function
 */
export function calculateUnifiedScore(context: ScoringContext): ScoreBreakdown {
  const { nutrition, training, load, strategy, flags, experienceLevel = 'intermediate' } = context;
  const config = SCORING_CONFIG[strategy];
  const weights = LOAD_WEIGHTS[load];
  
  // Check data completeness
  const hasMealPlan = nutrition.target.calories > 0;
  const hasFoodLogs = nutrition.actual.calories > 0 || nutrition.mealsPresent.length > 0;
  const mealsLogged = nutrition.mealsPresent.length;
  
  // Calculate macro scores with experience level
  const calorieScore = calculateMacroScore(nutrition.actual.calories, nutrition.target.calories, experienceLevel);
  const proteinScore = calculateMacroScore(nutrition.actual.protein, nutrition.target.protein, experienceLevel);
  const carbsScore = calculateMacroScore(nutrition.actual.carbs, nutrition.target.carbs, experienceLevel);
  const fatScore = calculateMacroScore(nutrition.actual.fat, nutrition.target.fat, experienceLevel);
  
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
  
  // Calculate training scores
  const completionScore = calculateTrainingCompletion(training.plan, training.actual);
  const typeMatchScore = calculateTypeMatch(training.typeFamilyMatch);
  const intensity = calculateIntensityScore(
    training.intensityOk,
    training.intensityNear,
    training.actual?.avgHr !== undefined
  );
  
  // Overall training score
  const completionWeight = 0.60 + (0.15 - intensity.weight);
  const trainingTotal = 
    completionScore * completionWeight +
    typeMatchScore * 0.25 +
    intensity.score * intensity.weight;
  
  // Calculate modifiers
  const modifiers = calculateModifiers(
    flags,
    nutrition.actual,
    nutrition.target,
    training.actual?.durationMin ?? 0
  );
  
  // Apply overconsumption penalty
  let overconsumptionPenalty = 0;
  if (nutrition.actual.calories > nutrition.target.calories * config.overconsumptionThreshold) {
    overconsumptionPenalty = config.overconsumptionPenalty;
  }
  
  // Apply incomplete data penalty
  let incompletePenalty = 0;
  const missingData: string[] = [];
  
  // NOTE: We do NOT penalize for missing meal plan!
  // The science layer can calculate targets from body metrics + training load
  // So a user with body metrics but no database meal plan should still get appropriate scores
  
  if (!hasFoodLogs) {
    // User didn't log any food - this deserves a penalty
    incompletePenalty += PENALTIES.noFoodLogs; // Negative value
    missingData.push('food logs');
  }
  // Structured meals penalty is now disabled (set to 0 in reduced profile)
  // but kept available in legacy strict profile for easy recall
  if (mealsLogged === 0 && hasFoodLogs && PENALTIES.noStructuredMeals < 0) {
    // User logged food but not in structured meals
    incompletePenalty += PENALTIES.noStructuredMeals; // Negative value
    missingData.push('structured meals');
  }
  
  // Calculate final score
  const baseScore = (nutritionTotal * weights.nutrition) + (trainingTotal * weights.training);
  const total = Math.max(0, Math.min(100, Math.round(
    baseScore + modifiers.bonuses + modifiers.penalties - overconsumptionPenalty + incompletePenalty
  )));
  
  // Determine if score is reliable
  // NOTE: Meal plan is NOT required for reliability!
  // As long as user has body metrics (checked in service layer), targets can be calculated
  const reliable = hasFoodLogs && mealsLogged > 0;
  
  return {
    total,
    nutrition: {
      total: Math.round(nutritionTotal),
      macros: Math.round(macrosScore),
      timing: Math.round(timingScore),
      structure: Math.round(structureScore),
    },
    training: {
      total: Math.round(trainingTotal),
      completion: Math.round(completionScore),
      typeMatch: Math.round(typeMatchScore),
      intensity: Math.round(intensity.score),
    },
    bonuses: modifiers.bonuses,
    penalties: modifiers.penalties + incompletePenalty,
    weights,
    dataCompleteness: {
      hasBodyMetrics: true, // Will be set by service layer
      hasMealPlan,
      hasFoodLogs,
      mealsLogged,
      reliable,
      missingData,
    },
  };
}

/**
 * Calculate meal-level scores
 */
export function calculateMealScores(
  mealPlans: Array<{ meal_type: MealType; recommended_calories: number; recommended_protein_grams: number; recommended_carbs_grams: number; recommended_fat_grams: number }>,
  mealLogs: Array<{ meal_type: MealType; calories: number; protein_grams: number; carbs_grams: number; fat_grams: number }>
): MealScore[] {
  const scores: MealScore[] = [];
  
  for (const plan of mealPlans) {
    const logs = mealLogs.filter(log => log.meal_type === plan.meal_type);
    
    if (logs.length === 0) {
      scores.push({
        mealType: plan.meal_type,
        score: 0,
        breakdown: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      });
      continue;
    }
    
    const actual = logs.reduce((acc, log) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + (log.protein_grams || 0),
      carbs: acc.carbs + (log.carbs_grams || 0),
      fat: acc.fat + (log.fat_grams || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    
    const calorieScore = calculateMacroScore(actual.calories, plan.recommended_calories);
    const proteinScore = calculateMacroScore(actual.protein, plan.recommended_protein_grams);
    const carbsScore = calculateMacroScore(actual.carbs, plan.recommended_carbs_grams);
    const fatScore = calculateMacroScore(actual.fat, plan.recommended_fat_grams);
    
    const mealScore = Math.round(
      calorieScore * 0.4 + 
      (proteinScore + carbsScore + fatScore) / 3 * 0.6
    );
    
    scores.push({
      mealType: plan.meal_type,
      score: mealScore,
      breakdown: {
        calories: calorieScore,
        protein: proteinScore,
        carbs: carbsScore,
        fat: fatScore,
      },
    });
  }
  
  return scores;
}

/**
 * Determine training load from activities
 */
export function determineTrainingLoad(activities: Array<{ duration_minutes?: number; intensity?: string }>): TrainingLoad {
  if (!activities || activities.length === 0) return 'rest';
  
  const totalDuration = activities.reduce((sum, act) => sum + (act.duration_minutes || 0), 0);
  const hasLong = activities.some(act => (act.duration_minutes || 0) >= 90);
  const hasQuality = activities.some(act => act.intensity === 'high');
  
  if (hasLong) return 'long';
  if (hasQuality) return 'quality';
  if (totalDuration >= 60) return 'moderate';
  return 'easy';
}

/**
 * Determine user's experience level based on their data history
 */
export function determineExperienceLevel(
  daysWithData: number,
  averageScore: number,
  hasConsistentLogging: boolean
): ExperienceLevel {
  // Beginner: < 30 days of data OR average score < 60
  if (daysWithData < 30 || averageScore < 60) {
    return 'beginner';
  }
  
  // Advanced: > 90 days AND average score > 80 AND consistent logging
  if (daysWithData > 90 && averageScore > 80 && hasConsistentLogging) {
    return 'advanced';
  }
  
  // Intermediate: everything else
  return 'intermediate';
}

/**
 * Create scoring context from raw data
 */
export function createScoringContext(
  nutritionTargets: NutritionTargets,
  nutritionActuals: NutritionActuals,
  trainingPlan?: TrainingPlan,
  trainingActual?: TrainingActual,
  options: {
    load?: TrainingLoad;
    strategy?: ScoringStrategy;
    mealsPresent?: MealType[];
    windows?: FuelingWindows;
    flags?: ScoringContext['flags'];
  } = {}
): ScoringContext {
  const load = options.load || 'rest';
  const strategy = options.strategy || 'runner-focused';
  
  // Default fueling windows
  const windows: FuelingWindows = options.windows || {
    pre: { applicable: load !== 'rest', inWindow: true },
    during: { applicable: load === 'long' },
    post: { applicable: load !== 'rest', inWindow: true },
  };
  
  return {
    nutrition: {
      target: nutritionTargets,
      actual: nutritionActuals,
      windows,
      mealsPresent: options.mealsPresent || [],
      singleMealOver60pct: false,
    },
    training: {
      plan: trainingPlan,
      actual: trainingActual,
      typeFamilyMatch: true,
      intensityOk: undefined,
      intensityNear: undefined,
    },
    load,
    strategy,
    flags: options.flags,
  };
}

/**
 * Legacy compatibility functions
 */
export function computeDailyScore(
  planned: { calories: number; protein: number; carbs: number; fat: number },
  consumed: { calories: number; protein: number; carbs: number; fat: number },
  activityCalories: number
): number {
  const context = createScoringContext(
    {
      calories: planned.calories + activityCalories,
      protein: planned.protein,
      carbs: planned.carbs,
      fat: planned.fat,
    },
    consumed,
    undefined,
    undefined,
    { strategy: 'general' }
  );
  
  return calculateUnifiedScore(context).total;
}

export function calculateDailyScore(
  dayTarget: { kcal: number; cho_g: number; protein_g: number; fat_g: number },
  consumed: { kcal: number; cho_g: number; protein_g: number; fat_g: number }
): number {
  const context = createScoringContext(
    {
      calories: dayTarget.kcal,
      protein: dayTarget.protein_g,
      carbs: dayTarget.cho_g,
      fat: dayTarget.fat_g,
    },
    {
      calories: consumed.kcal,
      protein: consumed.protein_g,
      carbs: consumed.cho_g,
      fat: consumed.fat_g,
    },
    undefined,
    undefined,
    { strategy: 'runner-focused' }
  );
  
  return calculateUnifiedScore(context).total;
}
