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
  const adjustedPlanned = adjustedPlannedCaloriesForActivity(planned.calories, activityCalories);
  if (adjustedPlanned === 0) return 0;

  const calorieScore = Math.min(100, (consumed.calories / adjustedPlanned) * 100);
  const proteinScore = planned.protein > 0 ? Math.min(100, (consumed.protein / planned.protein) * 100) : 100;
  const carbsScore = planned.carbs > 0 ? Math.min(100, (consumed.carbs / planned.carbs) * 100) : 100;
  const fatScore = planned.fat > 0 ? Math.min(100, (consumed.fat / planned.fat) * 100) : 100;

  let weighted = calorieScore * 0.4 + proteinScore * 0.3 + carbsScore * 0.2 + fatScore * 0.1;

  const calorieOver = consumed.calories > adjustedPlanned * 1.1;
  const proteinOver = planned.protein > 0 && consumed.protein > planned.protein * 1.1;
  if (calorieOver) weighted -= 5;
  if (proteinOver) weighted -= 2;

  return Math.max(0, Math.min(100, Math.round(weighted)));
}


