export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface TDEEInput {
  weightKg?: number | null;
  heightCm?: number | null;
  ageYears?: number | null;
  activityLevel?: ActivityLevel | string | null;
  wearableCaloriesToday?: number | null;
  fitnessGoal?: string | null;
  weekPlan?: Array<{ day: string; activity?: string; duration?: number } > | null;
}

export interface TDEEResult {
  bmr: number;
  activityMultiplier: number;
  baseTDEE: number;
  trainingAdjustment: number;
  totalDailyCalories: number;
  trainingIntensity: 'low' | 'moderate' | 'moderate-high' | 'high';
}

export function calculateBMR(weightKg?: number | null, heightCm?: number | null, ageYears?: number | null): number {
  if (!weightKg || !heightCm || !ageYears) {
    return 2000;
  }
  // Mifflin-St Jeor (male default)
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5);
}

export function getActivityMultiplier(level?: ActivityLevel | string | null): number {
  const map: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  if (!level) return 1.55;
  const key = String(level).toLowerCase();
  return map[key] || 1.55;
}

export function calculateTDEE(input: TDEEInput): TDEEResult {
  const bmr = calculateBMR(input.weightKg, input.heightCm, input.ageYears);
  const activityMultiplier = getActivityMultiplier(input.activityLevel || 'moderate');

  // Start with BMR*multiplier
  let total = Math.round(bmr * activityMultiplier);

  // If we have real wearable calories for today, prefer bmr + actual activity calories
  if (typeof input.wearableCaloriesToday === 'number' && input.wearableCaloriesToday > 0) {
    total = Math.round(bmr + input.wearableCaloriesToday);
  }

  let trainingAdjustment = 0;
  let trainingIntensity: TDEEResult['trainingIntensity'] = 'moderate';

  const goal = (input.fitnessGoal || '').toLowerCase();
  if (goal) {
    if (goal.includes('marathon')) {
      trainingAdjustment += 500;
      trainingIntensity = 'high';
    } else if (goal.includes('half')) {
      trainingAdjustment += 300;
      trainingIntensity = 'moderate-high';
    } else if (goal.includes('5k') || goal.includes('10k')) {
      trainingAdjustment += 200;
      trainingIntensity = 'moderate';
    } else if (goal === 'lose_weight') {
      trainingAdjustment -= 500;
      trainingIntensity = 'moderate';
    } else if (goal === 'gain_muscle') {
      trainingAdjustment += 300;
      trainingIntensity = 'moderate';
    }
  }

  // Adjust by today's planned training if available
  if (input.weekPlan && Array.isArray(input.weekPlan)) {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayPlan = input.weekPlan.find(d => d && d.day === todayName);
    if (todayPlan) {
      if (todayPlan.activity === 'run' && (todayPlan.duration || 0) > 60) {
        trainingAdjustment += 400;
        trainingIntensity = 'high';
      } else if (todayPlan.activity === 'run' && (todayPlan.duration || 0) > 30) {
        trainingAdjustment += 200;
        trainingIntensity = 'moderate-high';
      } else if (todayPlan.activity === 'run') {
        trainingAdjustment += 100;
        trainingIntensity = 'moderate';
      } else if (todayPlan.activity === 'rest') {
        trainingAdjustment -= 100;
        trainingIntensity = 'low';
      }
    }
  }

  const totalDailyCalories = total + trainingAdjustment;
  return {
    bmr,
    activityMultiplier,
    baseTDEE: total,
    trainingAdjustment,
    totalDailyCalories,
    trainingIntensity,
  };
}

export function splitCaloriesToMeals(totalDailyCalories: number) {
  return {
    breakfast: Math.round(totalDailyCalories * 0.30),
    lunch: Math.round(totalDailyCalories * 0.40),
    dinner: Math.round(totalDailyCalories * 0.30),
  };
}

export function deriveMacros(caloriesForMeal: number) {
  const proteinCalories = Math.round(caloriesForMeal * 0.30);
  const carbsCalories = Math.round(caloriesForMeal * 0.40);
  const fatCalories = Math.round(caloriesForMeal * 0.30);
  return {
    proteinGrams: Math.round(proteinCalories / 4),
    carbsGrams: Math.round(carbsCalories / 4),
    fatGrams: Math.round(fatCalories / 9),
  };
}


