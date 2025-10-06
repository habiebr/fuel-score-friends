/**
 * Tests for Marathon Nutrition MVP
 * Vitest test suite for deterministic nutrition calculations
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBMR,
  getActivityFactor,
  getMacroTargetsPerKg,
  calculateTDEE,
  calculateMacros,
  getMealRatios,
  calculateFuelingWindows,
  calculateMeals,
  targetsMVP,
  classifyLoad,
  reconcileDay,
  inferLoadFromWearable,
  type UserProfile,
  type TrainingLoad,
} from './marathon-nutrition';

describe('Marathon Nutrition MVP', () => {
  const sampleProfile: UserProfile = {
    weightKg: 70,
    heightCm: 175,
    age: 30,
    sex: 'male',
  };

  describe('calculateBMR', () => {
    it('calculates BMR correctly for male', () => {
      const bmr = calculateBMR(sampleProfile);
      // 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
      expect(bmr).toBeCloseTo(1648.75, 1);
    });

    it('calculates BMR correctly for female', () => {
      const femaleProfile: UserProfile = { ...sampleProfile, sex: 'female' };
      const bmr = calculateBMR(femaleProfile);
      // 10*70 + 6.25*175 - 5*30 - 161 = 700 + 1093.75 - 150 - 161 = 1482.75
      expect(bmr).toBeCloseTo(1482.75, 1);
    });
  });

  describe('getActivityFactor', () => {
    it('returns correct factors for each load', () => {
      expect(getActivityFactor('rest')).toBe(1.4);
      expect(getActivityFactor('easy')).toBe(1.6);
      expect(getActivityFactor('moderate')).toBe(1.8);
      expect(getActivityFactor('long')).toBe(2.0);
      expect(getActivityFactor('quality')).toBe(2.1);
    });
  });

  describe('getMacroTargetsPerKg', () => {
    it('returns correct midpoint values', () => {
      expect(getMacroTargetsPerKg('rest')).toEqual({ cho: 3.5, protein: 1.6 });
      expect(getMacroTargetsPerKg('easy')).toEqual({ cho: 5.5, protein: 1.7 });
      expect(getMacroTargetsPerKg('moderate')).toEqual({ cho: 7, protein: 1.8 });
      expect(getMacroTargetsPerKg('long')).toEqual({ cho: 9, protein: 1.9 });
      expect(getMacroTargetsPerKg('quality')).toEqual({ cho: 8, protein: 1.9 });
    });
  });

  describe('calculateTDEE', () => {
    it('calculates TDEE and rounds to nearest 10', () => {
      const tdee = calculateTDEE(sampleProfile, 'moderate');
      // BMR ≈ 1648.75 * 1.8 = 2967.75 → rounds to 2970
      expect(tdee).toBe(2970);
    });

    it('returns different values for different loads', () => {
      const rest = calculateTDEE(sampleProfile, 'rest');
      const long = calculateTDEE(sampleProfile, 'long');
      expect(long).toBeGreaterThan(rest);
    });
  });

  describe('calculateMacros', () => {
    it('calculates macros based on body weight', () => {
      const tdee = 2750;
      const macros = calculateMacros(sampleProfile, 'moderate', tdee);
      
      // CHO: 70kg * 7 g/kg = 490g
      // Protein: 70kg * 1.8 g/kg = 126g
      expect(macros.cho).toBe(490);
      expect(macros.protein).toBe(126);
      expect(macros.fat).toBeGreaterThan(0);
    });

    it('ensures fat is at least 20% of TDEE', () => {
      const tdee = 2000;
      const macros = calculateMacros(sampleProfile, 'rest', tdee);
      
      const fatKcal = macros.fat * 9;
      const fatPercent = (fatKcal / tdee) * 100;
      expect(fatPercent).toBeGreaterThanOrEqual(20);
    });
  });

  describe('getMealRatios', () => {
    it('returns 3 meals for rest day', () => {
      const ratios = getMealRatios('rest');
      expect(ratios.breakfast).toBe(0.30);
      expect(ratios.lunch).toBe(0.35);
      expect(ratios.dinner).toBe(0.35);
      expect(ratios.snack).toBe(0.0);
      expect(ratios.breakfast + ratios.lunch + ratios.dinner + ratios.snack).toBeCloseTo(1.0, 10);
    });

    it('returns 4 meals for training day', () => {
      const ratios = getMealRatios('moderate');
      expect(ratios.breakfast).toBe(0.25);
      expect(ratios.lunch).toBe(0.30);
      expect(ratios.dinner).toBe(0.30);
      expect(ratios.snack).toBe(0.15);
      expect(ratios.breakfast + ratios.lunch + ratios.dinner + ratios.snack).toBe(1.0);
    });
  });

  describe('calculateFuelingWindows', () => {
    it('returns empty object for rest day', () => {
      const fueling = calculateFuelingWindows(sampleProfile, 'rest');
      expect(fueling).toEqual({});
    });

    it('calculates pre-workout fueling', () => {
      const fueling = calculateFuelingWindows(sampleProfile, 'moderate');
      expect(fueling.pre).toBeDefined();
      expect(fueling.pre?.hoursBefore).toBe(3);
      expect(fueling.pre?.cho_g).toBeGreaterThan(0);
    });

    it('includes during-workout CHO for long runs', () => {
      const fueling = calculateFuelingWindows(sampleProfile, 'long');
      expect(fueling.duringCHOgPerHour).toBe(45);
    });

    it('calculates post-workout fueling', () => {
      const fueling = calculateFuelingWindows(sampleProfile, 'quality');
      expect(fueling.post).toBeDefined();
      expect(fueling.post?.minutesAfter).toBe(60);
      expect(fueling.post?.cho_g).toBe(70); // 70kg * 1.0 g/kg
      expect(fueling.post?.protein_g).toBe(21); // 70kg * 0.3 g/kg
    });
  });

  describe('calculateMeals', () => {
    it('distributes macros across meals correctly', () => {
      const tdee = 2750;
      const macros = { cho: 490, protein: 125, fat: 60 };
      const meals = calculateMeals(tdee, macros, 'moderate');
      
      expect(meals).toHaveLength(4); // breakfast, lunch, dinner, snack
      
      // Total macros should approximately match
      const totalCHO = meals.reduce((sum, m) => sum + m.cho_g, 0);
      const totalProtein = meals.reduce((sum, m) => sum + m.protein_g, 0);
      const totalFat = meals.reduce((sum, m) => sum + m.fat_g, 0);
      
      // Within reasonable rounding tolerance (due to meal-by-meal rounding)
      expect(Math.abs(totalCHO - macros.cho)).toBeLessThanOrEqual(5);
      expect(Math.abs(totalProtein - macros.protein)).toBeLessThanOrEqual(5);
      expect(Math.abs(totalFat - macros.fat)).toBeLessThanOrEqual(5);
    });

    it('skips snack on rest days', () => {
      const tdee = 2300;
      const macros = { cho: 245, protein: 112, fat: 51 };
      const meals = calculateMeals(tdee, macros, 'rest');
      
      expect(meals).toHaveLength(3); // breakfast, lunch, dinner only
      expect(meals.find(m => m.meal === 'snack')).toBeUndefined();
    });
  });

  describe('targetsMVP', () => {
    it('returns complete nutrition target object', () => {
      const result = targetsMVP(sampleProfile, 'moderate', '2025-10-06');
      
      expect(result).toHaveProperty('date', '2025-10-06');
      expect(result).toHaveProperty('load', 'moderate');
      expect(result).toHaveProperty('kcal');
      expect(result).toHaveProperty('grams');
      expect(result).toHaveProperty('fueling');
      expect(result).toHaveProperty('meals');
      
      expect(result.kcal).toBeGreaterThan(0);
      expect(result.grams.cho).toBeGreaterThan(0);
      expect(result.grams.protein).toBeGreaterThan(0);
      expect(result.grams.fat).toBeGreaterThan(0);
      expect(result.meals.length).toBeGreaterThan(0);
    });

    it('is deterministic (same inputs = same outputs)', () => {
      const result1 = targetsMVP(sampleProfile, 'long', '2025-10-07');
      const result2 = targetsMVP(sampleProfile, 'long', '2025-10-07');
      
      expect(result1).toEqual(result2);
    });

    it('returns different targets for different loads', () => {
      const restDay = targetsMVP(sampleProfile, 'rest', '2025-10-06');
      const longDay = targetsMVP(sampleProfile, 'long', '2025-10-06');
      
      expect(longDay.kcal).toBeGreaterThan(restDay.kcal);
      expect(longDay.grams.cho).toBeGreaterThan(restDay.grams.cho);
      expect(longDay.meals.length).toBeGreaterThan(restDay.meals.length);
    });

    it('matches example output structure', () => {
      const result = targetsMVP(sampleProfile, 'moderate', '2025-10-06');
      
      // Should be close to example: kcal: 2750, cho: 490, protein: 125
      expect(result.kcal).toBeGreaterThan(2500);
      expect(result.kcal).toBeLessThan(3000);
      expect(result.grams.cho).toBeGreaterThan(400);
      expect(result.grams.protein).toBeGreaterThan(100);
    });
  });

  describe('classifyLoad', () => {
    it('classifies rest day', () => {
      expect(classifyLoad({ durationMinutes: 0, intensity: 'low' })).toBe('rest');
    });

    it('classifies easy run', () => {
      expect(classifyLoad({ durationMinutes: 30, intensity: 'low' })).toBe('easy');
      expect(classifyLoad({ durationMinutes: 40, intensity: 'low', type: 'easy' })).toBe('easy');
    });

    it('classifies moderate run', () => {
      expect(classifyLoad({ durationMinutes: 60, intensity: 'medium' })).toBe('moderate');
      expect(classifyLoad({ durationMinutes: 45, intensity: 'medium', type: 'tempo' })).toBe('moderate');
    });

    it('classifies long run', () => {
      expect(classifyLoad({ durationMinutes: 120, intensity: 'low' })).toBe('long');
      expect(classifyLoad({ durationMinutes: 90, intensity: 'medium', type: 'long' })).toBe('long');
    });

    it('classifies quality run', () => {
      expect(classifyLoad({ durationMinutes: 60, intensity: 'high' })).toBe('quality');
      expect(classifyLoad({ durationMinutes: 45, intensity: 'high', type: 'interval' })).toBe('quality');
    });
  });

  describe('reconcileDay', () => {
    it('reconciles planned vs actual sessions', () => {
      const plans = [{ id: '1', plannedLoad: 'moderate' as TrainingLoad, plannedDuration: 60 }];
      const actuals = [{ id: '1', actualLoad: 'long' as TrainingLoad, actualDuration: 90 }];
      
      const result = reconcileDay(sampleProfile, '2025-10-06', plans, actuals);
      
      expect(result.date).toBe('2025-10-06');
      expect(result.plannedLoad).toBe('moderate');
      expect(result.actualLoad).toBe('long');
      expect(result.variance).not.toBe(0); // Should show difference
      expect(result.adjustedTarget.load).toBe('long');
    });

    it('selects highest load when multiple sessions', () => {
      const plans = [
        { id: '1', plannedLoad: 'easy' as TrainingLoad, plannedDuration: 30 },
        { id: '2', plannedLoad: 'quality' as TrainingLoad, plannedDuration: 45 },
      ];
      const actuals = [
        { id: '1', actualLoad: 'easy' as TrainingLoad, actualDuration: 30 },
        { id: '2', actualLoad: 'quality' as TrainingLoad, actualDuration: 45 },
      ];
      
      const result = reconcileDay(sampleProfile, '2025-10-06', plans, actuals);
      
      expect(result.plannedLoad).toBe('quality');
      expect(result.actualLoad).toBe('quality');
    });
  });

  describe('inferLoadFromWearable', () => {
    it('infers long run from duration', () => {
      const wearable = {
        activityType: 'running',
        durationMinutes: 120,
        caloriesBurned: 800,
        averageHeartRate: 140,
        maxHeartRate: 190,
      };
      
      expect(inferLoadFromWearable(wearable)).toBe('long');
    });

    it('infers quality run from high heart rate', () => {
      const wearable = {
        activityType: 'running',
        durationMinutes: 45,
        caloriesBurned: 500,
        averageHeartRate: 170,
        maxHeartRate: 190,
      };
      
      expect(inferLoadFromWearable(wearable)).toBe('quality');
    });

    it('infers easy run from low intensity', () => {
      const wearable = {
        activityType: 'running',
        durationMinutes: 40,
        caloriesBurned: 300,
        averageHeartRate: 120,
        maxHeartRate: 190,
      };
      
      expect(inferLoadFromWearable(wearable)).toBe('easy');
    });
  });
});

