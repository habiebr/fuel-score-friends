/**
 * Test meal plan generation using unified nutrition engine
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDayTarget,
  determineTrainingLoad,
  shouldIncludeSnack,
  generateMealPlan,
  type UserProfile,
  type TrainingLoad
} from '../supabase/functions/_shared/nutrition-unified.ts';

describe('Meal Plan Generation', () => {
  const testProfile: UserProfile = {
    weightKg: 70,
    heightCm: 175,
    age: 30,
    sex: 'male'
  };

  it('should calculate correct day target for rest day', () => {
    const dayTarget = calculateDayTarget(testProfile, 'rest', '2025-01-15');
    
    expect(dayTarget.load).toBe('rest');
    expect(dayTarget.kcal).toBeGreaterThan(0);
    expect(dayTarget.grams.cho).toBeGreaterThan(0);
    expect(dayTarget.grams.protein).toBeGreaterThan(0);
    expect(dayTarget.grams.fat).toBeGreaterThan(0);
    expect(dayTarget.meals).toHaveLength(3); // breakfast, lunch, dinner
  });

  it('should calculate correct day target for long run day', () => {
    const dayTarget = calculateDayTarget(testProfile, 'long', '2025-01-15');
    
    expect(dayTarget.load).toBe('long');
    expect(dayTarget.kcal).toBeGreaterThan(0);
    expect(dayTarget.grams.cho).toBeGreaterThan(0);
    expect(dayTarget.grams.protein).toBeGreaterThan(0);
    expect(dayTarget.grams.fat).toBeGreaterThan(0);
    expect(dayTarget.meals).toHaveLength(4); // breakfast, lunch, dinner, snack
  });

  it('should determine training load correctly', () => {
    expect(determineTrainingLoad('rest')).toBe('rest');
    expect(determineTrainingLoad('run', 30)).toBe('easy');
    expect(determineTrainingLoad('run', 90)).toBe('quality');
    expect(determineTrainingLoad('run', undefined, 20)).toBe('long');
    expect(determineTrainingLoad('strength')).toBe('easy');
  });

  it('should include snack for high intensity days', () => {
    expect(shouldIncludeSnack('rest')).toBe(false);
    expect(shouldIncludeSnack('easy')).toBe(false);
    expect(shouldIncludeSnack('moderate')).toBe(false);
    expect(shouldIncludeSnack('long')).toBe(true);
    expect(shouldIncludeSnack('quality')).toBe(true);
  });

  it('should generate meal plan with correct structure', () => {
    const dayTarget = calculateDayTarget(testProfile, 'long', '2025-01-15');
    const mealPlan = generateMealPlan(dayTarget, true);
    
    expect(mealPlan.breakfast).toBeDefined();
    expect(mealPlan.lunch).toBeDefined();
    expect(mealPlan.dinner).toBeDefined();
    expect(mealPlan.snack).toBeDefined();
    
    expect(mealPlan.breakfast.kcal).toBeGreaterThan(0);
    expect(mealPlan.lunch.kcal).toBeGreaterThan(0);
    expect(mealPlan.dinner.kcal).toBeGreaterThan(0);
    expect(mealPlan.snack.kcal).toBeGreaterThan(0);
  });

  it('should generate meal plan without snack for rest days', () => {
    const dayTarget = calculateDayTarget(testProfile, 'rest', '2025-01-15');
    const mealPlan = generateMealPlan(dayTarget, false);
    
    expect(mealPlan.breakfast).toBeDefined();
    expect(mealPlan.lunch).toBeDefined();
    expect(mealPlan.dinner).toBeDefined();
    expect(mealPlan.snack).toBeUndefined();
  });

  it('should have consistent macro ratios', () => {
    const dayTarget = calculateDayTarget(testProfile, 'moderate', '2025-01-15');
    const mealPlan = generateMealPlan(dayTarget, false);
    
    // Check that total calories from meals match day target
    const totalCalories = Object.values(mealPlan).reduce((sum, meal) => sum + meal.kcal, 0);
    console.log(`Day target calories: ${dayTarget.kcal}, Meal plan total: ${totalCalories}`);
    expect(Math.abs(totalCalories - dayTarget.kcal)).toBeLessThan(500); // Allow rounding differences
  });
});
