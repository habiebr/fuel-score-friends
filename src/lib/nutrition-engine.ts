/**
 * Unified Nutrition Engine
 * Following architecture: User/Profile → RaceInfo/Session → DayTarget → MealPlan
 * 
 * Flow:
 * 1. Planner (Periodization Engine): Profile + RaceInfo/Session → load classification
 * 2. Science Layer (Targets Engine): load + profile → DayTarget (kcal, CHO, protein, fat)
 * 3. Meal Generator (Optimization Engine): DayTarget → MealPlan
 * 4. Hydration Engine: Session → HydrationPlan
 * 5. Glycogen Model: DayTarget + history → glycogen_pct
 * 6. Feedback Loop: user ratings → Recommender (Personalization Engine)
 */

export type Sex = 'male' | 'female';
export type TrainingLoad = 'rest' | 'easy' | 'moderate' | 'long' | 'quality';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type GoalType = '5k' | '10k' | 'half_marathon' | 'full_marathon' | 'ultra' | 'weight_loss' | 'gain_muscle' | 'general';
export type RacePhase = 'off' | 'base' | 'build' | 'peak' | 'taper' | 'race';

export interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel?: string;
}

export interface RaceInfo {
  raceDate: string;
  distanceKm: number;
  goalTime?: string;
}

export interface Session {
  date: string;
  type: TrainingLoad;
  durationMin: number;
  intensity?: 'low' | 'moderate' | 'high';
}

export interface DayTarget {
  date: string;
  load: TrainingLoad;
  kcal: number;
  cho_g: number;
  protein_g: number;
  fat_g: number;
  preFuelingCHO_g?: number;
  duringCHOgPerHour?: number;
  postCHO_g?: number;
  postProtein_g?: number;
}

export interface HydrationPlan {
  sessionId: string;
  fluidMLPerHour: number;
  sodiumMgPerHour: number;
}

export interface GlycogenModel {
  userId: string;
  date: string;
  glycogenPct: number;
  notes?: string;
}

export interface MealPlan {
  userId: string;
  date: string;
  dayTargetId: string;
  meals: {
    mealType: MealType;
    targetKcal: number;
    targetCHO_g: number;
    targetProtein_g: number;
    targetFat_g: number;
  }[];
}

/**
 * STEP 1: Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor equation
 */
export function calculateBMR(profile: UserProfile): number {
  const { weightKg, heightCm, age, sex } = profile;
  const sexOffset = sex === 'male' ? 5 : -161;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset);
}

/**
 * STEP 2: Get activity factor based on training load
 */
export function getActivityFactor(load: TrainingLoad): number {
  const factors: Record<TrainingLoad, number> = {
    rest: 1.4,
    easy: 1.6,
    moderate: 1.8,
    long: 2.0,
    quality: 2.1,
  };
  return factors[load];
}

/**
 * STEP 3: Calculate TDEE (Total Daily Energy Expenditure)
 */
export function calculateTDEE(profile: UserProfile, load: TrainingLoad): number {
  const bmr = calculateBMR(profile);
  const activityFactor = getActivityFactor(load);
  return Math.round((bmr * activityFactor) / 10) * 10; // Round to nearest 10
}

/**
 * STEP 4: Get macronutrient targets per kg body weight (Science Layer)
 */
export function getMacroTargetsPerKg(load: TrainingLoad): { cho: number; protein: number } {
  const targets: Record<TrainingLoad, { cho: number; protein: number }> = {
    rest: { cho: 3.5, protein: 1.6 },       // 3–4 g/kg CHO, 1.6 g/kg protein
    easy: { cho: 5.5, protein: 1.7 },       // 5–6 g/kg CHO, 1.7 g/kg protein
    moderate: { cho: 7, protein: 1.8 },     // 6–8 g/kg CHO, 1.8 g/kg protein
    long: { cho: 9, protein: 1.9 },         // 8–10 g/kg CHO, 1.9 g/kg protein
    quality: { cho: 8, protein: 1.9 },      // 7–9 g/kg CHO, 1.9 g/kg protein
  };
  return targets[load];
}

/**
 * STEP 5: Calculate macronutrients (CHO, Protein, Fat)
 */
export function calculateMacros(
  profile: UserProfile,
  load: TrainingLoad,
  tdee: number
): { cho: number; protein: number; fat: number } {
  const macrosPerKg = getMacroTargetsPerKg(load);
  
  // CHO and protein based on body weight
  const choGrams = Math.round(profile.weightKg * macrosPerKg.cho);
  const proteinGrams = Math.round(profile.weightKg * macrosPerKg.protein);
  
  // Calculate calories from CHO and protein (4 kcal/g each)
  const choKcal = choGrams * 4;
  const proteinKcal = proteinGrams * 4;
  
  // Remaining calories for fat (minimum 20% of TDEE)
  const minFatKcal = tdee * 0.2;
  const remainingKcal = tdee - choKcal - proteinKcal;
  const fatKcal = Math.max(minFatKcal, remainingKcal);
  
  // Convert fat calories to grams (9 kcal/g)
  const fatGrams = Math.round(fatKcal / 9);
  
  return {
    cho: choGrams,
    protein: proteinGrams,
    fat: fatGrams,
  };
}

/**
 * STEP 6: Generate DayTarget (Targets Engine output)
 */
export function generateDayTarget(
  profile: UserProfile,
  session: Session,
  glycogenPct?: number
): DayTarget {
  const tdee = calculateTDEE(profile, session.type);
  const macros = calculateMacros(profile, session.type, tdee);
  
  // Fueling windows based on session type
  let preFuelingCHO_g: number | undefined;
  let duringCHOgPerHour: number | undefined;
  let postCHO_g: number | undefined;
  let postProtein_g: number | undefined;

  if (session.type !== 'rest') {
    // Pre-fueling: 1-2g CHO/kg body weight, 1-2 hours before
    preFuelingCHO_g = Math.round(profile.weightKg * 1.5);
    
    // During: 30-60g CHO/hour for sessions > 60 min
    if (session.durationMin > 60) {
      duringCHOgPerHour = session.intensity === 'high' ? 60 : 45;
    }
    
    // Post: 1.2g CHO/kg + 0.3g protein/kg within 30-60 min
    postCHO_g = Math.round(profile.weightKg * 1.2);
    postProtein_g = Math.round(profile.weightKg * 0.3);
  }
  
  return {
    date: session.date,
    load: session.type,
    kcal: tdee,
    cho_g: macros.cho,
    protein_g: macros.protein,
    fat_g: macros.fat,
    preFuelingCHO_g,
    duringCHOgPerHour,
    postCHO_g,
    postProtein_g,
  };
}

/**
 * Helper: Aggregate multiple activities in a day into one Session.
 * - Chooses the highest load as the session type
 * - Sums durations; if any high intensity, mark intensity as high
 */
export function aggregateActivitiesToSession(
  dateISO: string,
  activities: Array<{
    activity_type: 'rest' | 'run' | 'strength' | 'cardio' | 'other';
    duration_minutes?: number | null;
    distance_km?: number | null;
    intensity?: 'low' | 'moderate' | 'high' | null;
  }>
): Session {
  if (!activities || activities.length === 0) {
    return { date: dateISO, type: 'rest', durationMin: 0, intensity: 'low' };
  }

  // Determine load priority
  const loadPriority: TrainingLoad[] = ['rest', 'easy', 'moderate', 'long', 'quality'];

  const classifyActivityToLoad = (a: any): TrainingLoad => {
    if (a.activity_type === 'run') {
      if (typeof a.distance_km === 'number' && a.distance_km >= 15) return 'long';
      if ((a.intensity || 'moderate') === 'high') return 'quality';
      if (typeof a.duration_minutes === 'number' && a.duration_minutes >= 60) return 'moderate';
      return 'easy';
    }
    if (a.activity_type === 'cardio') {
      if ((a.intensity || 'moderate') === 'high' || (a.duration_minutes || 0) >= 60) return 'moderate';
      return 'easy';
    }
    if (a.activity_type === 'strength') {
      return 'easy';
    }
    return 'rest';
  };

  let maxLoad: TrainingLoad = 'rest';
  let totalDuration = 0;
  let highIntensity = false;
  for (const a of activities) {
    const load = classifyActivityToLoad(a);
    if (loadPriority.indexOf(load) > loadPriority.indexOf(maxLoad)) {
      maxLoad = load;
    }
    totalDuration += Math.max(0, a.duration_minutes || 0);
    if (a.intensity === 'high') highIntensity = true;
  }

  return {
    date: dateISO,
    type: maxLoad,
    durationMin: totalDuration,
    intensity: highIntensity ? 'high' : 'moderate',
  };
}

/**
 * Adjust DayTarget based on high-level goal type
 * - Marathon/ultra: prioritize carbs slightly higher (+5% kcal to CHO, from fat)
 * - Weight loss: reduce kcal by 10% and increase protein (+10%), reduce fat
 * - Gain muscle: increase protein (+15%) with small kcal surplus (+5%)
 */
export function adjustTargetForGoal(target: DayTarget, profile: UserProfile, goal: GoalType | undefined): DayTarget {
  if (!goal || goal === 'general') return target;

  let kcal = target.kcal;
  let cho = target.cho_g;
  let protein = target.protein_g;
  let fat = target.fat_g;

  const applyRedistribute = (fromFatKcal: number, toChoKcal: number, extraProtein_g: number = 0) => {
    const toCho_g = Math.round(toChoKcal / 4);
    const fromFat_g = Math.round(fromFatKcal / 9);
    cho += toCho_g;
    fat = Math.max(0, fat - fromFat_g);
    protein += extraProtein_g;
  };

  if (goal === 'full_marathon' || goal === 'half_marathon' || goal === 'ultra' || goal === '10k' || goal === '5k') {
    // Shift ~5% kcal from fat to carbs
    const shiftKcal = Math.round(kcal * 0.05);
    applyRedistribute(shiftKcal, shiftKcal, 0);
  } else if (goal === 'weight_loss') {
    // 10% deficit, +10% protein grams
    kcal = Math.round(kcal * 0.9);
    protein = Math.round(protein * 1.1);
    // Recompute fat to fit new kcal maintaining CHO
    const choKcal = cho * 4;
    const proteinKcal = protein * 4;
    const fatKcal = Math.max(Math.round(kcal * 0.2), kcal - choKcal - proteinKcal);
    fat = Math.max(0, Math.round(fatKcal / 9));
  } else if (goal === 'gain_muscle') {
    // 5% surplus, +15% protein grams
    kcal = Math.round(kcal * 1.05);
    protein = Math.round(protein * 1.15);
    const choKcal = cho * 4;
    const proteinKcal = protein * 4;
    const fatKcal = Math.max(Math.round(kcal * 0.2), kcal - choKcal - proteinKcal);
    fat = Math.max(0, Math.round(fatKcal / 9));
  }

  return {
    ...target,
    kcal,
    cho_g: cho,
    protein_g: protein,
    fat_g: fat,
  };
}

/**
 * Generate DayTarget from multiple activities and a goal type
 */
export function generateDayTargetFromActivities(
  profile: UserProfile,
  dateISO: string,
  activities: Array<{
    activity_type: 'rest' | 'run' | 'strength' | 'cardio' | 'other';
    duration_minutes?: number | null;
    distance_km?: number | null;
    intensity?: 'low' | 'moderate' | 'high' | null;
  }>,
  goal?: GoalType
): DayTarget {
  const session = aggregateActivitiesToSession(dateISO, activities);
  const base = generateDayTarget(profile, session);
  return adjustTargetForGoal(base, profile, goal);
}

/**
 * Determine race phase from date and target race date.
 * - race: same day
 * - taper: <= 7 days before race
 * - peak: 8-21 days before race
 * - build: 22-56 days before race (3-8 weeks)
 * - base: > 56 days
 * - off: past race date
 */
export function determineRacePhase(dateISO: string, raceDateISO?: string | null): RacePhase {
  if (!raceDateISO) return 'base';
  const today = new Date(dateISO + 'T00:00:00');
  const raceDate = new Date(raceDateISO + 'T00:00:00');
  const diffDays = Math.floor((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'off';
  if (diffDays === 0) return 'race';
  if (diffDays <= 7) return 'taper';
  if (diffDays <= 21) return 'peak';
  if (diffDays <= 56) return 'build';
  return 'base';
}

/**
 * Adjust target for race phase (periodization)
 * - base/build: small kcal surplus on long/quality days
 * - peak: ensure higher CHO (shift from fat), maintain kcal
 * - taper: reduce kcal ~10% except day-before where CHO up
 * - race: bump pre/during/post fueling guidance; kcal steady
 */
export function adjustTargetForRacePhase(target: DayTarget, phase: RacePhase): DayTarget {
  let t = { ...target };
  const isHighLoad = target.load === 'long' || target.load === 'quality';
  if (phase === 'build' && isHighLoad) {
    t.kcal = Math.round(t.kcal * 1.05);
  }
  if (phase === 'peak') {
    const shiftKcal = Math.round(t.kcal * 0.05);
    const toCho_g = Math.round(shiftKcal / 4);
    const fromFat_g = Math.round(shiftKcal / 9);
    t.cho_g += toCho_g;
    t.fat_g = Math.max(0, t.fat_g - fromFat_g);
  }
  if (phase === 'taper') {
    // Default: small deficit; but if high-load day, keep kcal
    if (!isHighLoad) {
      t.kcal = Math.round(t.kcal * 0.9);
      const choKcal = t.cho_g * 4;
      const proteinKcal = t.protein_g * 4;
      const fatKcal = Math.max(Math.round(t.kcal * 0.2), t.kcal - choKcal - proteinKcal);
      t.fat_g = Math.max(1, Math.round(fatKcal / 9));
    }
  }
  if (phase === 'race') {
    // Emphasize fueling windows; macros stay similar
    t.preFuelingCHO_g = Math.max(t.preFuelingCHO_g || 0, Math.round(1.5 * (t.cho_g / (t.kcal / 4)) * 60));
    t.duringCHOgPerHour = Math.max(t.duringCHOgPerHour || 0, 60);
    t.postCHO_g = Math.max(t.postCHO_g || 0, Math.round(1.2 * (t.cho_g / (t.kcal / 4)) * 60));
  }
  return t;
}

/**
 * Goal-centric generator: focuses on race goal and periodization.
 * Provide goal type and target race date for phase-aware adjustments.
 */
export function generateGoalCentricTarget(
  profile: UserProfile,
  dateISO: string,
  activities: Array<{
    activity_type: 'rest' | 'run' | 'strength' | 'cardio' | 'other';
    duration_minutes?: number | null;
    distance_km?: number | null;
    intensity?: 'low' | 'moderate' | 'high' | null;
  }>,
  goal?: GoalType,
  targetRaceDateISO?: string | null
): DayTarget {
  const base = generateDayTargetFromActivities(profile, dateISO, activities, goal);
  const phase = determineRacePhase(dateISO, targetRaceDateISO);
  return adjustTargetForRacePhase(base, phase);
}

/**
 * STEP 7: Get meal distribution ratios
 */
export function getMealRatios(load: TrainingLoad): Record<MealType, number> {
  const isRestDay = load === 'rest';
  
  if (isRestDay) {
    return {
      breakfast: 0.30,
      lunch: 0.35,
      dinner: 0.35,
      snack: 0.0,
    };
  }
  
  return {
    breakfast: 0.25,
    lunch: 0.30,
    dinner: 0.30,
    snack: 0.15,
  };
}

/**
 * STEP 8: Generate MealPlan from DayTarget (Meal Generator / Optimization Engine)
 */
export function generateMealPlan(
  dayTarget: DayTarget,
  userId: string,
  dayTargetId: string
): MealPlan {
  const ratios = getMealRatios(dayTarget.load);
  
  const meals = Object.entries(ratios)
    .filter(([_, ratio]) => ratio > 0)
    .map(([mealType, ratio]) => {
      const targetKcal = Math.round(dayTarget.kcal * ratio);
      const targetCHO_g = Math.round(dayTarget.cho_g * ratio);
      const targetProtein_g = Math.round(dayTarget.protein_g * ratio);
      const targetFat_g = Math.round(dayTarget.fat_g * ratio);
      
      return {
        mealType: mealType as MealType,
        targetKcal,
        targetCHO_g,
        targetProtein_g,
        targetFat_g,
      };
    });
  
  return {
    userId,
    date: dayTarget.date,
    dayTargetId,
    meals,
  };
}

/**
 * STEP 9: Generate HydrationPlan from Session (Hydration Engine)
 */
export function generateHydrationPlan(session: Session, sessionId: string): HydrationPlan {
  let fluidMLPerHour = 500; // Base: 500ml/hour
  let sodiumMgPerHour = 300; // Base: 300mg/hour
  
  // Adjust based on duration and intensity
  if (session.durationMin > 90) {
    fluidMLPerHour = 600;
    sodiumMgPerHour = 400;
  }
  
  if (session.intensity === 'high') {
    fluidMLPerHour += 100;
    sodiumMgPerHour += 100;
  }
  
  return {
    sessionId,
    fluidMLPerHour,
    sodiumMgPerHour,
  };
}

/**
 * STEP 10: Update Glycogen Model (updates DayTarget context)
 */
export function updateGlycogenModel(
  previousGlycogen: number,
  dayTarget: DayTarget,
  consumedCHO: number
): number {
  // Glycogen depletion based on load
  const depletionRates: Record<TrainingLoad, number> = {
    rest: -5,
    easy: -10,
    moderate: -20,
    long: -35,
    quality: -30,
  };
  
  const depletion = depletionRates[dayTarget.load];
  
  // Glycogen replenishment based on CHO intake
  const targetCHO = dayTarget.cho_g;
  const replenishment = (consumedCHO / targetCHO) * Math.abs(depletion) * 1.2; // 120% efficiency if well-fueled
  
  // New glycogen percentage (capped at 100%)
  const newGlycogen = Math.min(100, Math.max(0, previousGlycogen + depletion + replenishment));
  
  return Math.round(newGlycogen);
}

/**
 * STEP 11: Calculate Daily Score (Feedback system input)
 */
export function calculateDailyScore(
  dayTarget: DayTarget,
  consumed: { kcal: number; cho_g: number; protein_g: number; fat_g: number }
): number {
  const calorieScore = Math.min(100, (consumed.kcal / dayTarget.kcal) * 100);
  const choScore = Math.min(100, (consumed.cho_g / dayTarget.cho_g) * 100);
  const proteinScore = Math.min(100, (consumed.protein_g / dayTarget.protein_g) * 100);
  const fatScore = Math.min(100, (consumed.fat_g / dayTarget.fat_g) * 100);
  
  // Weighted score: CHO most important for runners
  const weighted = calorieScore * 0.3 + choScore * 0.4 + proteinScore * 0.2 + fatScore * 0.1;
  
  // Penalty for overconsumption
  if (consumed.kcal > dayTarget.kcal * 1.15) return Math.max(0, weighted - 10);
  
  return Math.round(Math.min(100, weighted));
}

/**
 * HELPER: Convert old nutrition format to new DayTarget format
 */
export function convertLegacyToTarget(
  planned: { calories: number; protein: number; carbs: number; fat: number },
  date: string,
  load: TrainingLoad = 'moderate'
): DayTarget {
  return {
    date,
    load,
    kcal: planned.calories,
    cho_g: planned.carbs,
    protein_g: planned.protein,
    fat_g: planned.fat,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * RECOMMENDATION ENGINE (Personalization Engine)
 * ═══════════════════════════════════════════════════════════════════════
 */

export interface Recipe {
  id: string;
  name: string;
  nutrients_per_serving: {
    calories: number;
    cho_g: number;
    protein_g: number;
    fat_g: number;
  };
  prep_time: number;
  cost_est: number;
  tags: string[];
  ingredients?: string[];
}

export interface UserPreferences {
  dietary_restrictions: string[];
  eating_behaviors: string[];
  time_budget_min?: number;
}

export interface RecipeScore {
  recipe: Recipe;
  score: number;
  reasons: string[];
  compatibility: 'excellent' | 'good' | 'fair' | 'incompatible';
}

/**
 * STEP 12: Filter recipes based on dietary restrictions
 */
export function filterRecipesByRestrictions(
  recipes: Recipe[],
  restrictions: string[]
): Recipe[] {
  if (restrictions.length === 0) return recipes;

  return recipes.filter(recipe => {
    const recipeTags = recipe.tags.map(t => t.toLowerCase());
    const recipeIngredients = (recipe.ingredients || []).map(i => i.toLowerCase());
    const combinedText = [...recipeTags, ...recipeIngredients].join(' ');

    // Check each restriction
    for (const restriction of restrictions) {
      const restrictionLower = restriction.toLowerCase();

      // Common restriction patterns
      if (restrictionLower.includes('lactose') || restrictionLower.includes('dairy')) {
        if (combinedText.includes('milk') || combinedText.includes('cheese') || 
            combinedText.includes('yogurt') || combinedText.includes('dairy')) {
          return false;
        }
      }

      if (restrictionLower.includes('gluten')) {
        if (combinedText.includes('wheat') || combinedText.includes('bread') || 
            combinedText.includes('pasta') || combinedText.includes('flour')) {
          return false;
        }
      }

      if (restrictionLower.includes('no red meat') || restrictionLower.includes('red meat')) {
        if (combinedText.includes('beef') || combinedText.includes('pork') || 
            combinedText.includes('lamb')) {
          return false;
        }
      }

      if (restrictionLower.includes('vegan')) {
        if (combinedText.includes('meat') || combinedText.includes('dairy') || 
            combinedText.includes('egg') || combinedText.includes('fish')) {
          return false;
        }
      }

      if (restrictionLower.includes('vegetarian')) {
        if (combinedText.includes('meat') || combinedText.includes('chicken') || 
            combinedText.includes('beef') || combinedText.includes('fish')) {
          return false;
        }
      }

      if (restrictionLower.includes('nut')) {
        if (combinedText.includes('almond') || combinedText.includes('peanut') || 
            combinedText.includes('cashew') || combinedText.includes('walnut')) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * STEP 13: Score recipes based on nutrition target match
 */
export function scoreRecipeForTarget(
  recipe: Recipe,
  target: { kcal: number; cho_g: number; protein_g: number; fat_g: number }
): number {
  const nutrients = recipe.nutrients_per_serving;
  
  // Calculate how well each macro matches the target (per serving)
  const calorieMatch = 1 - Math.abs(nutrients.calories - target.kcal) / target.kcal;
  const choMatch = 1 - Math.abs(nutrients.cho_g - target.cho_g) / target.cho_g;
  const proteinMatch = 1 - Math.abs(nutrients.protein_g - target.protein_g) / target.protein_g;
  const fatMatch = 1 - Math.abs(nutrients.fat_g - target.fat_g) / target.fat_g;
  
  // Weighted average (CHO most important for runners)
  const score = (
    calorieMatch * 0.3 +
    choMatch * 0.4 +
    proteinMatch * 0.2 +
    fatMatch * 0.1
  );
  
  return Math.max(0, Math.min(1, score)) * 100; // 0-100 scale
}

/**
 * STEP 14: Boost recipe score based on eating behaviors
 */
export function applyBehaviorBoost(
  recipe: Recipe,
  behaviors: string[],
  mealType: MealType
): number {
  let boost = 0;
  const recipeName = recipe.name.toLowerCase();
  const recipeTags = recipe.tags.map(t => t.toLowerCase()).join(' ');

  for (const behavior of behaviors) {
    const behaviorLower = behavior.toLowerCase();

    // Breakfast preferences
    if (mealType === 'breakfast' && behaviorLower.includes('breakfast')) {
      if (behaviorLower.includes('egg') && recipeName.includes('egg')) {
        boost += 15;
      }
      if (behaviorLower.includes('oatmeal') && recipeName.includes('oat')) {
        boost += 15;
      }
      if (behaviorLower.includes('protein shake') && recipeName.includes('shake')) {
        boost += 15;
      }
    }

    // Protein preferences
    if (behaviorLower.includes('plant-based') || behaviorLower.includes('plant based')) {
      if (recipeTags.includes('plant-based') || recipeTags.includes('vegan') || 
          recipeTags.includes('vegetarian')) {
        boost += 20;
      }
    }

    if (behaviorLower.includes('high protein')) {
      if (recipe.nutrients_per_serving.protein_g > 25) {
        boost += 10;
      }
    }

    // Meal timing preferences
    if (behaviorLower.includes('light dinner') && mealType === 'dinner') {
      if (recipe.nutrients_per_serving.calories < 500) {
        boost += 10;
      }
    }
  }

  return boost;
}

/**
 * STEP 15: Recommend recipes for a meal (MAIN RECOMMENDATION FUNCTION)
 */
export function recommendRecipesForMeal(
  recipes: Recipe[],
  mealTarget: { kcal: number; cho_g: number; protein_g: number; fat_g: number },
  mealType: MealType,
  preferences: UserPreferences,
  topN: number = 10
): RecipeScore[] {
  // Step 1: Filter by dietary restrictions
  const compatibleRecipes = filterRecipesByRestrictions(recipes, preferences.dietary_restrictions);

  // Step 2: Filter by time budget if specified
  let timeFilteredRecipes = compatibleRecipes;
  if (preferences.time_budget_min) {
    timeFilteredRecipes = compatibleRecipes.filter(
      r => r.prep_time <= preferences.time_budget_min!
    );
  }

  // Step 3: Score each recipe
  const scoredRecipes: RecipeScore[] = timeFilteredRecipes.map(recipe => {
    // Base score from nutrition match
    let score = scoreRecipeForTarget(recipe, mealTarget);

    // Apply behavior boost
    const behaviorBoost = applyBehaviorBoost(recipe, preferences.eating_behaviors, mealType);
    score += behaviorBoost;

    // Determine compatibility level
    let compatibility: 'excellent' | 'good' | 'fair' | 'incompatible';
    const reasons: string[] = [];

    if (score >= 80) {
      compatibility = 'excellent';
      reasons.push('Excellent nutrition match');
    } else if (score >= 60) {
      compatibility = 'good';
      reasons.push('Good nutrition match');
    } else if (score >= 40) {
      compatibility = 'fair';
      reasons.push('Fair nutrition match');
    } else {
      compatibility = 'incompatible';
      reasons.push('Poor nutrition match');
    }

    if (behaviorBoost > 0) {
      reasons.push('Matches your eating preferences');
    }

    if (recipe.prep_time <= 15) {
      reasons.push('Quick to prepare');
      score += 5; // Bonus for convenience
    }

    return {
      recipe,
      score: Math.min(100, score),
      reasons,
      compatibility
    };
  });

  // Step 4: Sort by score and return top N
  return scoredRecipes
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * STEP 16: Generate meal suggestions for entire day
 */
export function generateDailyMealSuggestions(
  recipes: Recipe[],
  dayTarget: DayTarget,
  mealPlan: MealPlan,
  preferences: UserPreferences
): Record<MealType, RecipeScore[]> {
  const suggestions: Record<string, RecipeScore[]> = {};

  for (const meal of mealPlan.meals) {
    const mealTarget = {
      kcal: meal.targetKcal,
      cho_g: meal.targetCHO_g,
      protein_g: meal.targetProtein_g,
      fat_g: meal.targetFat_g
    };

    suggestions[meal.mealType] = recommendRecipesForMeal(
      recipes,
      mealTarget,
      meal.mealType,
      preferences,
      5 // Top 5 suggestions per meal
    );
  }

  return suggestions as Record<MealType, RecipeScore[]>;
}

