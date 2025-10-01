export interface PlannedNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function accumulatePlannedFromMealPlans(mealPlans: any[] | null | undefined): PlannedNutrition {
  const initial = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  if (!Array.isArray(mealPlans)) return initial;
  return mealPlans.reduce((acc, plan) => ({
    calories: acc.calories + (plan.recommended_calories || 0),
    protein: acc.protein + (plan.recommended_protein_grams || 0),
    carbs: acc.carbs + (plan.recommended_carbs_grams || 0),
    fat: acc.fat + (plan.recommended_fat_grams || 0),
  }), initial);
}

export function accumulateConsumedFromFoodLogs(foodLogs: any[] | null | undefined): PlannedNutrition {
  const initial = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  if (!Array.isArray(foodLogs)) return initial;
  return foodLogs.reduce((acc, log) => ({
    calories: acc.calories + (log.calories || 0),
    protein: acc.protein + (log.protein_grams || 0),
    carbs: acc.carbs + (log.carbs_grams || 0),
    fat: acc.fat + (log.fat_grams || 0),
  }), initial);
}

export function adjustedPlannedCaloriesForActivity(plannedCalories: number, activityCalories: number): number {
  return Math.max(0, (plannedCalories || 0) + (activityCalories || 0));
}

export function computeDailyScore(planned: PlannedNutrition, consumed: PlannedNutrition, activityCalories: number): number {
  const basePlannedCalories = Math.max(0, planned.calories || 0);
  const extraCalories = Math.max(0, activityCalories || 0);
  const adjustedPlannedCalories = basePlannedCalories + extraCalories;
  if (adjustedPlannedCalories === 0) return 0;

  // Scale macro targets proportionally with the calorie increase from activity
  let proteinTarget = Math.max(0, planned.protein || 0);
  let carbsTarget = Math.max(0, planned.carbs || 0);
  let fatTarget = Math.max(0, planned.fat || 0);
  if (basePlannedCalories > 0 && extraCalories > 0) {
    const scale = adjustedPlannedCalories / basePlannedCalories;
    proteinTarget = Math.round(proteinTarget * scale);
    carbsTarget = Math.round(carbsTarget * scale);
    fatTarget = Math.round(fatTarget * scale);
  }

  const calorieScore = Math.min(100, (consumed.calories / adjustedPlannedCalories) * 100);
  const proteinScore = proteinTarget > 0 ? Math.min(100, (consumed.protein / proteinTarget) * 100) : 100;
  const carbsScore = carbsTarget > 0 ? Math.min(100, (consumed.carbs / carbsTarget) * 100) : 100;
  const fatScore = fatTarget > 0 ? Math.min(100, (consumed.fat / fatTarget) * 100) : 100;

  let weighted = calorieScore * 0.4 + proteinScore * 0.3 + carbsScore * 0.2 + fatScore * 0.1;

  const calorieOver = consumed.calories > adjustedPlannedCalories * 1.1;
  const proteinOver = proteinTarget > 0 && consumed.protein > proteinTarget * 1.1;
  if (calorieOver) weighted -= 5;
  if (proteinOver) weighted -= 2;

  return Math.max(0, Math.min(100, Math.round(weighted)));
}

// ---- TDEE helpers for client fallback ----
export function calculateBMR(weightKg?: number | null, heightCm?: number | null, ageYears?: number | null): number {
  if (!weightKg || !heightCm || !ageYears) return 0;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5);
}

export function getActivityMultiplier(level?: string | null): number {
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

export function deriveMacrosFromCalories(totalCalories: number) {
  const proteinCalories = Math.round(totalCalories * 0.30);
  const carbsCalories = Math.round(totalCalories * 0.40);
  const fatCalories = Math.round(totalCalories * 0.30);
  return {
    protein: Math.round(proteinCalories / 4),
    carbs: Math.round(carbsCalories / 4),
    fat: Math.round(fatCalories / 9),
  };
}


