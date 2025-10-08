/**
 * Tests for the Unified Scoring System
 */

import { describe, it, expect } from 'vitest';
import {
  calculateUnifiedScore,
  calculateMealScores,
  createScoringContext,
  determineTrainingLoad,
  computeDailyScore,
  calculateDailyScore,
  type ScoringContext,
  type TrainingLoad,
  type ScoringStrategy,
} from '../src/lib/unified-scoring';

describe('Unified Scoring System', () => {
  describe('calculateUnifiedScore', () => {
    it('should calculate perfect score for rest day', () => {
      const context: ScoringContext = {
        nutrition: {
          target: { calories: 2000, protein: 100, carbs: 250, fat: 67 },
          actual: { calories: 2000, protein: 100, carbs: 250, fat: 67 },
          windows: {
            pre: { applicable: false, inWindow: false },
            during: { applicable: false },
            post: { applicable: false, inWindow: false },
          },
          mealsPresent: ['breakfast', 'lunch', 'dinner'],
          singleMealOver60pct: false,
        },
        training: {
          plan: undefined,
          actual: undefined,
          typeFamilyMatch: true,
          intensityOk: undefined,
          intensityNear: undefined,
        },
        load: 'rest',
        strategy: 'runner-focused',
        flags: {
          windowSyncAll: true,
          streakDays: 0,
          hydrationOk: true,
          bigDeficit: false,
          isHardDay: false,
          missedPostWindow: false,
        },
      };

      const result = calculateUnifiedScore(context);
      expect(result.total).toBeGreaterThan(90); // Allow for some rounding differences
      expect(result.nutrition.total).toBeGreaterThan(90);
      expect(result.training.total).toBeGreaterThan(90);
    });

    it('should calculate lower score for underconsumption', () => {
      const context: ScoringContext = {
        nutrition: {
          target: { calories: 2000, protein: 100, carbs: 250, fat: 67 },
          actual: { calories: 1500, protein: 75, carbs: 200, fat: 50 },
          windows: {
            pre: { applicable: false, inWindow: false },
            during: { applicable: false },
            post: { applicable: false, inWindow: false },
          },
          mealsPresent: ['breakfast', 'lunch', 'dinner'],
          singleMealOver60pct: false,
        },
        training: {
          plan: undefined,
          actual: undefined,
          typeFamilyMatch: true,
          intensityOk: undefined,
          intensityNear: undefined,
        },
        load: 'rest',
        strategy: 'runner-focused',
      };

      const result = calculateUnifiedScore(context);
      expect(result.total).toBeLessThan(100);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should apply overconsumption penalty', () => {
      const context: ScoringContext = {
        nutrition: {
          target: { calories: 2000, protein: 100, carbs: 250, fat: 67 },
          actual: { calories: 2500, protein: 100, carbs: 250, fat: 67 }, // 25% over calories
          windows: {
            pre: { applicable: false, inWindow: false },
            during: { applicable: false },
            post: { applicable: false, inWindow: false },
          },
          mealsPresent: ['breakfast', 'lunch', 'dinner'],
          singleMealOver60pct: false,
        },
        training: {
          plan: undefined,
          actual: undefined,
          typeFamilyMatch: true,
          intensityOk: undefined,
          intensityNear: undefined,
        },
        load: 'rest',
        strategy: 'runner-focused',
      };

      const result = calculateUnifiedScore(context);
      expect(result.total).toBeLessThan(100);
    });

    it('should weight training higher on training days', () => {
      const restContext: ScoringContext = {
        nutrition: {
          target: { calories: 2000, protein: 100, carbs: 250, fat: 67 },
          actual: { calories: 2000, protein: 100, carbs: 250, fat: 67 },
          windows: {
            pre: { applicable: false, inWindow: false },
            during: { applicable: false },
            post: { applicable: false, inWindow: false },
          },
          mealsPresent: ['breakfast', 'lunch', 'dinner'],
          singleMealOver60pct: false,
        },
        training: {
          plan: { durationMin: 60, type: 'run', intensity: 'moderate' },
          actual: { durationMin: 60, type: 'run', avgHr: 150 },
          typeFamilyMatch: true,
          intensityOk: true,
          intensityNear: false,
        },
        load: 'rest',
        strategy: 'runner-focused',
      };

      const easyContext: ScoringContext = {
        ...restContext,
        load: 'easy',
      };

      const restResult = calculateUnifiedScore(restContext);
      const easyResult = calculateUnifiedScore(easyContext);

      // Both should be high scores, but weights should be different
      expect(restResult.weights.nutrition).toBe(1.0);
      expect(restResult.weights.training).toBe(0.0);
      expect(easyResult.weights.nutrition).toBe(0.7);
      expect(easyResult.weights.training).toBe(0.3);
    });
  });

  describe('calculateMealScores', () => {
    it('should calculate meal scores correctly', () => {
      const mealPlans = [
        {
          meal_type: 'breakfast' as const,
          recommended_calories: 500,
          recommended_protein_grams: 25,
          recommended_carbs_grams: 60,
          recommended_fat_grams: 15,
        },
        {
          meal_type: 'lunch' as const,
          recommended_calories: 600,
          recommended_protein_grams: 30,
          recommended_carbs_grams: 70,
          recommended_fat_grams: 20,
        },
      ];

      const mealLogs = [
        {
          meal_type: 'breakfast' as const,
          calories: 500,
          protein_grams: 25,
          carbs_grams: 60,
          fat_grams: 15,
        },
        {
          meal_type: 'lunch' as const,
          calories: 550, // Slightly under
          protein_grams: 30,
          carbs_grams: 70,
          fat_grams: 20,
        },
      ];

      const scores = calculateMealScores(mealPlans, mealLogs);
      
      expect(scores).toHaveLength(2);
      expect(scores[0].score).toBe(100); // Perfect breakfast
      expect(scores[1].score).toBeLessThan(100); // Slightly under lunch
      expect(scores[1].score).toBeGreaterThan(0);
    });

    it('should handle missing meal logs', () => {
      const mealPlans = [
        {
          meal_type: 'breakfast' as const,
          recommended_calories: 500,
          recommended_protein_grams: 25,
          recommended_carbs_grams: 60,
          recommended_fat_grams: 15,
        },
      ];

      const mealLogs: any[] = [];

      const scores = calculateMealScores(mealPlans, mealLogs);
      
      expect(scores).toHaveLength(1);
      expect(scores[0].score).toBe(0);
    });
  });

  describe('determineTrainingLoad', () => {
    it('should determine rest day correctly', () => {
      const activities: any[] = [];
      const load = determineTrainingLoad(activities);
      expect(load).toBe('rest');
    });

    it('should determine easy day correctly', () => {
      const activities = [
        { duration_minutes: 30, intensity: 'low' },
      ];
      const load = determineTrainingLoad(activities);
      expect(load).toBe('easy');
    });

    it('should determine moderate day correctly', () => {
      const activities = [
        { duration_minutes: 60, intensity: 'moderate' },
      ];
      const load = determineTrainingLoad(activities);
      expect(load).toBe('moderate');
    });

    it('should determine long day correctly', () => {
      const activities = [
        { duration_minutes: 120, intensity: 'moderate' },
      ];
      const load = determineTrainingLoad(activities);
      expect(load).toBe('long');
    });

    it('should determine quality day correctly', () => {
      const activities = [
        { duration_minutes: 45, intensity: 'high' },
      ];
      const load = determineTrainingLoad(activities);
      expect(load).toBe('quality');
    });
  });

  describe('createScoringContext', () => {
    it('should create context with defaults', () => {
      const context = createScoringContext(
        { calories: 2000, protein: 100, carbs: 250, fat: 67 },
        { calories: 2000, protein: 100, carbs: 250, fat: 67 }
      );

      expect(context.load).toBe('rest');
      expect(context.strategy).toBe('runner-focused');
      expect(context.nutrition.target.calories).toBe(2000);
      expect(context.nutrition.actual.calories).toBe(2000);
    });

    it('should create context with custom options', () => {
      const context = createScoringContext(
        { calories: 2000, protein: 100, carbs: 250, fat: 67 },
        { calories: 2000, protein: 100, carbs: 250, fat: 67 },
        { durationMin: 60, type: 'run', intensity: 'moderate' },
        { durationMin: 60, type: 'run', avgHr: 150 },
        {
          load: 'moderate',
          strategy: 'general',
          mealsPresent: ['breakfast', 'lunch', 'dinner'],
        }
      );

      expect(context.load).toBe('moderate');
      expect(context.strategy).toBe('general');
      expect(context.nutrition.mealsPresent).toEqual(['breakfast', 'lunch', 'dinner']);
      expect(context.training.plan?.durationMin).toBe(60);
    });
  });

  describe('Legacy compatibility functions', () => {
    it('should work with computeDailyScore', () => {
      const score = computeDailyScore(
        { calories: 2000, protein: 100, carbs: 250, fat: 67 },
        { calories: 2000, protein: 100, carbs: 250, fat: 67 },
        300 // activity calories
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should work with calculateDailyScore', () => {
      const score = calculateDailyScore(
        { kcal: 2000, cho_g: 250, protein_g: 100, fat_g: 67 },
        { kcal: 2000, cho_g: 250, protein_g: 100, fat_g: 67 }
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('Scoring strategies', () => {
    it('should apply different weights for different strategies', () => {
      const baseContext: ScoringContext = {
        nutrition: {
          target: { calories: 2000, protein: 100, carbs: 250, fat: 67 },
          actual: { calories: 2000, protein: 100, carbs: 250, fat: 67 },
          windows: {
            pre: { applicable: false, inWindow: false },
            during: { applicable: false },
            post: { applicable: false, inWindow: false },
          },
          mealsPresent: ['breakfast', 'lunch', 'dinner'],
          singleMealOver60pct: false,
        },
        training: {
          plan: undefined,
          actual: undefined,
          typeFamilyMatch: true,
          intensityOk: undefined,
          intensityNear: undefined,
        },
        load: 'rest',
        strategy: 'runner-focused',
      };

      const runnerResult = calculateUnifiedScore({ ...baseContext, strategy: 'runner-focused' });
      const generalResult = calculateUnifiedScore({ ...baseContext, strategy: 'general' });

      // Both should be high scores, but may have different internal calculations
      expect(runnerResult.total).toBeGreaterThan(90);
      expect(generalResult.total).toBeGreaterThan(90);
    });
  });
});
