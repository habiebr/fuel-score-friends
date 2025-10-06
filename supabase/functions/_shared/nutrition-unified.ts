/**
 * Unified Nutrition Engine for Edge Functions
 * Based on src/lib/nutrition-engine.ts
 * 
 * Flow: User/Profile → TrainingLoad/Session → DayTarget → MealPlan
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

export interface DayTarget {
  date: string;
  load: TrainingLoad;
  kcal: number;
  cho_g: number;
  protein_g: number;
  fat_g: number;
}

/**
 * STEP 1: Calculate BMR using Mifflin-St Jeor equation
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
  return Math.round(bmr * activityFactor);
}

/**
 * STEP 4: Determine training load from workout data
 */
export function determineTrainingLoad(
  workoutType?: string,
  durationMin?: number,
  distanceKm?: number
): TrainingLoad {
  if (!workoutType || workoutType === 'rest') return 'rest';
  
  if (workoutType === 'run' || workoutType === 'running') {
    if (durationMin && durationMin > 90) return 'long';
    if (distanceKm && distanceKm > 20) return 'long';
    if (durationMin && durationMin > 60) return 'moderate';
    if (workoutType.includes('interval') || workoutType.includes('tempo')) return 'quality';
    return 'easy';
  }
  
  if (workoutType.includes('interval') || workoutType.includes('speed')) return 'quality';
  if (workoutType.includes('long')) return 'long';
  
  return 'moderate';
}

/**
 * STEP 5: Calculate macro targets based on training load
 */
export function calculateMacros(tdee: number, load: TrainingLoad): {
  cho_g: number;
  protein_g: number;
  fat_g: number;
} {
  let choRatio = 0.50;  // 50% default
  let proteinRatio = 0.25;  // 25% default
  let fatRatio = 0.25;  // 25% default

  // Adjust based on training load
  if (load === 'long' || load === 'quality') {
    choRatio = 0.55;  // Higher carbs for intense training
    proteinRatio = 0.25;
    fatRatio = 0.20;
  } else if (load === 'moderate') {
    choRatio = 0.50;
    proteinRatio = 0.25;
    fatRatio = 0.25;
  } else if (load === 'easy') {
    choRatio = 0.45;
    proteinRatio = 0.30;
    fatRatio = 0.25;
  } else if (load === 'rest') {
    choRatio = 0.40;
    proteinRatio = 0.30;
    fatRatio = 0.30;
  }

  return {
    cho_g: Math.round((tdee * choRatio) / 4),      // 4 cal/g
    protein_g: Math.round((tdee * proteinRatio) / 4),  // 4 cal/g
    fat_g: Math.round((tdee * fatRatio) / 9),      // 9 cal/g
  };
}

/**
 * STEP 6: Generate day target from profile and training
 */
export function generateDayTarget(
  profile: UserProfile,
  date: string,
  load: TrainingLoad
): DayTarget {
  const tdee = calculateTDEE(profile, load);
  const macros = calculateMacros(tdee, load);

  return {
    date,
    load,
    kcal: tdee,
    ...macros,
  };
}

/**
 * STEP 7: Split daily calories into meals
 */
export function splitCaloriesToMeals(
  dayTarget: DayTarget,
  hasSnack: boolean = false
) {
  const { kcal } = dayTarget;

  if (hasSnack) {
    return {
      breakfast: Math.round(kcal * 0.25),
      lunch: Math.round(kcal * 0.35),
      dinner: Math.round(kcal * 0.30),
      snack: Math.round(kcal * 0.10),
    };
  }

  return {
    breakfast: Math.round(kcal * 0.30),
    lunch: Math.round(kcal * 0.40),
    dinner: Math.round(kcal * 0.30),
  };
}

/**
 * STEP 8: Calculate meal macros based on meal percentage and training load
 */
export function calculateMealMacros(
  dayTarget: DayTarget,
  mealPercentage: number,
  mealType: MealType
): {
  kcal: number;
  cho_g: number;
  protein_g: number;
  fat_g: number;
} {
  const mealKcal = Math.round(dayTarget.kcal * mealPercentage);
  
  // Adjust macro ratios for meal type
  let choRatio = 0.50;
  let proteinRatio = 0.25;
  let fatRatio = 0.25;

  if (mealType === 'breakfast') {
    choRatio = 0.45;  // Moderate carbs for breakfast
    proteinRatio = 0.30;  // Higher protein
    fatRatio = 0.25;
  } else if (mealType === 'snack') {
    choRatio = 0.60;  // Higher carbs for quick energy
    proteinRatio = 0.20;
    fatRatio = 0.20;
  } else if (dayTarget.load === 'long' || dayTarget.load === 'quality') {
    choRatio = 0.55;  // Higher carbs for recovery
    proteinRatio = 0.25;
    fatRatio = 0.20;
  }

  return {
    kcal: mealKcal,
    cho_g: Math.round((mealKcal * choRatio) / 4),
    protein_g: Math.round((mealKcal * proteinRatio) / 4),
    fat_g: Math.round((mealKcal * fatRatio) / 9),
  };
}

/**
 * STEP 9: Generate complete meal plan
 */
export function generateMealPlan(
  dayTarget: DayTarget,
  includeSnack: boolean = false
) {
  const meals: Record<string, any> = {
    breakfast: calculateMealMacros(dayTarget, 0.30, 'breakfast'),
    lunch: calculateMealMacros(dayTarget, 0.40, 'lunch'),
    dinner: calculateMealMacros(dayTarget, 0.30, 'dinner'),
  };

  if (includeSnack) {
    meals.breakfast = calculateMealMacros(dayTarget, 0.25, 'breakfast');
    meals.lunch = calculateMealMacros(dayTarget, 0.35, 'lunch');
    meals.dinner = calculateMealMacros(dayTarget, 0.30, 'dinner');
    meals.snack = calculateMealMacros(dayTarget, 0.10, 'snack');
  }

  return meals;
}

/**
 * STEP 10: Calculate nutrition score based on actual vs planned
 */
export function calculateNutritionScore(
  plannedKcal: number,
  plannedProtein: number,
  plannedCarbs: number,
  plannedFat: number,
  actualKcal: number,
  actualProtein: number,
  actualCarbs: number,
  actualFat: number
): number {
  // Avoid division by zero
  if (plannedKcal === 0) return 0;

  // Calculate deviation scores (0-100 each)
  const calorieScore = Math.max(0, 100 - Math.abs(actualKcal - plannedKcal) / plannedKcal * 100);
  const proteinScore = plannedProtein > 0 ? Math.max(0, 100 - Math.abs(actualProtein - plannedProtein) / plannedProtein * 100) : 100;
  const carbsScore = plannedCarbs > 0 ? Math.max(0, 100 - Math.abs(actualCarbs - plannedCarbs) / plannedCarbs * 100) : 100;
  const fatScore = plannedFat > 0 ? Math.max(0, 100 - Math.abs(actualFat - plannedFat) / plannedFat * 100) : 100;

  // Weighted average
  // Calories: 30%, Carbs: 30% (important for runners), Protein: 25%, Fat: 15%
  const score = Math.round(
    calorieScore * 0.30 +
    carbsScore * 0.30 +
    proteinScore * 0.25 +
    fatScore * 0.15
  );

  return Math.max(0, Math.min(100, score));
}

/**
 * STEP 11: Determine if snack is needed based on training
 */
export function shouldIncludeSnack(load: TrainingLoad): boolean {
  return load === 'long' || load === 'quality';
}

/**
 * LEGACY COMPATIBILITY: Map old activity level to training load
 */
export function mapActivityLevelToTrainingLoad(activityLevel?: string): TrainingLoad {
  if (!activityLevel) return 'moderate';
  
  const level = activityLevel.toLowerCase();
  if (level.includes('sedentary')) return 'rest';
  if (level.includes('light')) return 'easy';
  if (level.includes('moderate')) return 'moderate';
  if (level.includes('active') || level.includes('very')) return 'long';
  
  return 'moderate';
}

