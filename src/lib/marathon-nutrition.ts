/**
 * Marathon Nutrition MVP
 * Deterministic function for calculating daily calorie & macronutrient targets
 * for endurance training days based on user profile and training load.
 */

export type Sex = 'male' | 'female';
export type TrainingLoad = 'rest' | 'easy' | 'moderate' | 'long' | 'quality';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
}

export interface Meal {
  meal: MealType;
  ratio: number;
  cho_g: number;
  protein_g: number;
  fat_g: number;
  kcal: number;
}

export interface FuelingWindow {
  pre?: {
    hoursBefore: number;
    cho_g: number;
  };
  duringCHOgPerHour?: number | null;
  post?: {
    minutesAfter: number;
    cho_g: number;
    protein_g: number;
  };
}

export interface NutritionTarget {
  date: string;
  load: TrainingLoad;
  kcal: number;
  grams: {
    cho: number;
    protein: number;
    fat: number;
  };
  fueling: FuelingWindow;
  meals: Meal[];
}

/**
 * Step 1: Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 */
export function calculateBMR(profile: UserProfile): number {
  const { weightKg, heightCm, age, sex } = profile;
  const sexOffset = sex === 'male' ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  return bmr;
}

/**
 * Step 2: Get activity factor based on training load
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
 * Step 3: Calculate macronutrient targets per kg body weight
 */
export function getMacroTargetsPerKg(load: TrainingLoad): { cho: number; protein: number } {
  const targets: Record<TrainingLoad, { cho: number; protein: number }> = {
    rest: { cho: 3.5, protein: 1.6 },       // midpoint of 3–4
    easy: { cho: 5.5, protein: 1.7 },       // midpoint of 5–6
    moderate: { cho: 7, protein: 1.8 },     // midpoint of 6–8
    long: { cho: 9, protein: 1.9 },         // midpoint of 8–10
    quality: { cho: 8, protein: 1.9 },      // midpoint of 7–9
  };
  return targets[load];
}

/**
 * Calculate total daily energy expenditure
 */
export function calculateTDEE(profile: UserProfile, load: TrainingLoad): number {
  const bmr = calculateBMR(profile);
  const activityFactor = getActivityFactor(load);
  return Math.round((bmr * activityFactor) / 10) * 10; // Round to nearest 10
}

/**
 * Calculate macronutrient grams
 */
export function calculateMacros(
  profile: UserProfile,
  load: TrainingLoad,
  tdee: number
): { cho: number; protein: number; fat: number } {
  const macrosPerKg = getMacroTargetsPerKg(load);
  
  // Calculate CHO and protein based on body weight
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
 * Step 4: Get meal distribution ratios
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
 * Step 5: Calculate fueling windows
 */
export function calculateFuelingWindows(
  profile: UserProfile,
  load: TrainingLoad
): FuelingWindow {
  const isRestDay = load === 'rest';
  
  if (isRestDay) {
    return {}; // No specific fueling windows on rest days
  }
  
  // Pre-workout fueling (3 hours before)
  const preCHOPerKg: Record<Exclude<TrainingLoad, 'rest'>, number> = {
    easy: 1.5,
    moderate: 2.5,
    long: 3.5,
    quality: 3.0,
  };
  
  const preCHO = Math.round(profile.weightKg * preCHOPerKg[load as Exclude<TrainingLoad, 'rest'>]);
  
  // During workout (if duration ≥75 min, applicable for long/quality runs)
  const duringCHOPerHour: Record<Exclude<TrainingLoad, 'rest'>, number | null> = {
    easy: null,
    moderate: null,
    long: 45,      // 30-60 g/h midpoint
    quality: 45,
  };
  
  // Post-workout fueling (within 60 minutes)
  const postCHO = Math.round(profile.weightKg * 1.0);
  const postProtein = Math.round(profile.weightKg * 0.3);
  
  return {
    pre: {
      hoursBefore: 3,
      cho_g: preCHO,
    },
    duringCHOgPerHour: duringCHOPerHour[load as Exclude<TrainingLoad, 'rest'>],
    post: {
      minutesAfter: 60,
      cho_g: postCHO,
      protein_g: postProtein,
    },
  };
}

/**
 * Calculate individual meals based on total macros and ratios
 */
export function calculateMeals(
  tdee: number,
  macros: { cho: number; protein: number; fat: number },
  load: TrainingLoad
): Meal[] {
  const ratios = getMealRatios(load);
  const meals: Meal[] = [];
  
  const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  
  for (const mealType of mealOrder) {
    const ratio = ratios[mealType];
    
    if (ratio === 0) continue; // Skip meals with 0 ratio
    
    const mealKcal = Math.round((tdee * ratio) / 10) * 10; // Round to nearest 10
    
    // Distribute macros proportionally
    const mealCHO = Math.round(macros.cho * ratio);
    const mealProtein = Math.round(macros.protein * ratio);
    const mealFat = Math.round(macros.fat * ratio);
    
    meals.push({
      meal: mealType,
      ratio,
      cho_g: mealCHO,
      protein_g: mealProtein,
      fat_g: mealFat,
      kcal: mealKcal,
    });
  }
  
  return meals;
}

/**
 * Main MVP function: Calculate complete daily nutrition targets
 */
export function targetsMVP(
  profile: UserProfile,
  load: TrainingLoad,
  dateISO: string
): NutritionTarget {
  // Step 1 & 2: Calculate TDEE
  const tdee = calculateTDEE(profile, load);
  
  // Step 3: Calculate macros
  const macros = calculateMacros(profile, load, tdee);
  
  // Step 4: Calculate meals
  const meals = calculateMeals(tdee, macros, load);
  
  // Step 5: Calculate fueling windows
  const fueling = calculateFuelingWindows(profile, load);
  
  return {
    date: dateISO,
    load,
    kcal: tdee,
    grams: macros,
    fueling,
    meals,
  };
}

/**
 * OPTIONAL: Classify training load from session details
 */
export interface TrainingSession {
  durationMinutes: number;
  intensity: 'low' | 'medium' | 'high';
  type?: 'recovery' | 'easy' | 'tempo' | 'interval' | 'long';
}

export function classifyLoad(session: TrainingSession): TrainingLoad {
  const { durationMinutes, intensity, type } = session;
  
  // Rest day (no session)
  if (durationMinutes === 0) {
    return 'rest';
  }
  
  // Use explicit type if provided
  if (type === 'recovery') return 'easy';
  if (type === 'easy') return 'easy';
  if (type === 'tempo') return 'moderate';
  if (type === 'interval') return 'quality';
  if (type === 'long') return 'long';
  
  // Classify by duration and intensity
  if (durationMinutes >= 90) {
    return 'long';
  }
  
  if (intensity === 'high') {
    return 'quality';
  }
  
  if (intensity === 'medium' && durationMinutes >= 45) {
    return 'moderate';
  }
  
  return 'easy';
}

/**
 * OPTIONAL: Reconcile planned vs actual sessions for a day
 */
export interface SessionPlan {
  id: string;
  plannedLoad: TrainingLoad;
  plannedDuration: number;
}

export interface SessionActual {
  id: string;
  actualLoad: TrainingLoad;
  actualDuration: number;
  caloriesBurned?: number;
}

export interface DayReconciliation {
  date: string;
  plannedLoad: TrainingLoad;
  actualLoad: TrainingLoad;
  variance: number; // percentage difference in expected calories
  adjustedTarget: NutritionTarget;
}

export function reconcileDay(
  profile: UserProfile,
  dateISO: string,
  plans: SessionPlan[],
  actuals: SessionActual[]
): DayReconciliation {
  // Determine highest load from plans
  const loadPriority: TrainingLoad[] = ['quality', 'long', 'moderate', 'easy', 'rest'];
  const plannedLoad = plans.reduce((highest, plan) => {
    const planIndex = loadPriority.indexOf(plan.plannedLoad);
    const currentIndex = loadPriority.indexOf(highest);
    return planIndex < currentIndex ? plan.plannedLoad : highest;
  }, 'rest' as TrainingLoad);
  
  // Determine highest load from actuals
  const actualLoad = actuals.reduce((highest, actual) => {
    const actualIndex = loadPriority.indexOf(actual.actualLoad);
    const currentIndex = loadPriority.indexOf(highest);
    return actualIndex < currentIndex ? actual.actualLoad : highest;
  }, 'rest' as TrainingLoad);
  
  // Calculate targets for both
  const plannedTarget = targetsMVP(profile, plannedLoad, dateISO);
  const adjustedTarget = targetsMVP(profile, actualLoad, dateISO);
  
  // Calculate variance
  const variance = Math.round(((adjustedTarget.kcal - plannedTarget.kcal) / plannedTarget.kcal) * 100);
  
  return {
    date: dateISO,
    plannedLoad,
    actualLoad,
    variance,
    adjustedTarget,
  };
}

/**
 * OPTIONAL: Update session actual from wearable data
 * (Google Fit integration would connect here)
 */
export interface WearableData {
  activityType: string;
  durationMinutes: number;
  caloriesBurned: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
}

export function inferLoadFromWearable(wearable: WearableData): TrainingLoad {
  const { durationMinutes, caloriesBurned, averageHeartRate, maxHeartRate } = wearable;
  
  // Estimate intensity from heart rate if available
  let intensity: 'low' | 'medium' | 'high' = 'medium';
  
  if (averageHeartRate && maxHeartRate) {
    const hrPercent = (averageHeartRate / maxHeartRate) * 100;
    if (hrPercent < 65) intensity = 'low';
    else if (hrPercent > 85) intensity = 'high';
    else intensity = 'medium';
  } else if (caloriesBurned > 0) {
    // Rough estimate: >10 kcal/min is high intensity
    const kcalPerMin = caloriesBurned / durationMinutes;
    if (kcalPerMin < 6) intensity = 'low';
    else if (kcalPerMin > 10) intensity = 'high';
    else intensity = 'medium';
  }
  
  return classifyLoad({ durationMinutes, intensity });
}

