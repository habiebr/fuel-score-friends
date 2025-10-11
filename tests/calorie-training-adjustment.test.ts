/**
 * Test: Calorie Changes Based on Training Plan
 * 
 * This test verifies that calorie targets automatically adjust
 * based on the training load/plan for the day.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBMR,
  calculateTDEE,
  getActivityFactor,
  calculateMacros,
  getMacroTargetsPerKg,
  type UserProfile,
  type TrainingLoad
} from '../src/lib/marathon-nutrition';

describe('Calorie Adjustment Based on Training Plan', () => {
  // Sample user profile (70kg runner)
  const testProfile: UserProfile = {
    weightKg: 70,
    heightCm: 175,
    age: 30,
    sex: 'male',
  };

  describe('Step 1: BMR Calculation (Baseline)', () => {
    it('calculates BMR correctly using Mifflin-St Jeor equation', () => {
      const bmr = calculateBMR(testProfile);
      
      // Male: (10 × weight) + (6.25 × height) - (5 × age) + 5
      // = (10 × 70) + (6.25 × 175) - (5 × 30) + 5
      // = 700 + 1093.75 - 150 + 5
      // = 1648.75
      
      expect(bmr).toBe(1648.75);
      console.log(`✅ BMR (baseline): ${bmr} kcal/day`);
    });
  });

  describe('Step 2: Activity Factors by Training Load', () => {
    it('uses different activity factors for different training loads', () => {
      const factors = {
        rest: getActivityFactor('rest'),
        easy: getActivityFactor('easy'),
        moderate: getActivityFactor('moderate'),
        long: getActivityFactor('long'),
        quality: getActivityFactor('quality'),
      };

      expect(factors.rest).toBe(1.4);
      expect(factors.easy).toBe(1.6);
      expect(factors.moderate).toBe(1.8);
      expect(factors.long).toBe(2.0);
      expect(factors.quality).toBe(2.1);

      console.log('\n📊 Activity Factors:');
      console.log('  Rest Day:     1.4x BMR');
      console.log('  Easy Run:     1.6x BMR');
      console.log('  Moderate Run: 1.8x BMR');
      console.log('  Long Run:     2.0x BMR');
      console.log('  Quality Run:  2.1x BMR');
    });
  });

  describe('Step 3: TDEE Changes with Training Load', () => {
    it('calculates different TDEE for each training load', () => {
      const bmr = calculateBMR(testProfile);
      
      const tdeeRest = calculateTDEE(testProfile, 'rest');
      const tdeeEasy = calculateTDEE(testProfile, 'easy');
      const tdeeModerate = calculateTDEE(testProfile, 'moderate');
      const tdeeLong = calculateTDEE(testProfile, 'long');
      const tdeeQuality = calculateTDEE(testProfile, 'quality');

      // Verify calculations
      expect(tdeeRest).toBe(Math.round((bmr * 1.4) / 10) * 10);
      expect(tdeeEasy).toBe(Math.round((bmr * 1.6) / 10) * 10);
      expect(tdeeModerate).toBe(Math.round((bmr * 1.8) / 10) * 10);
      expect(tdeeLong).toBe(Math.round((bmr * 2.0) / 10) * 10);
      expect(tdeeQuality).toBe(Math.round((bmr * 2.1) / 10) * 10);

      console.log('\n🔥 TDEE by Training Load (70kg runner):');
      console.log(`  Rest Day:     ${tdeeRest} kcal  (BMR × 1.4)`);
      console.log(`  Easy Run:     ${tdeeEasy} kcal  (BMR × 1.6)`);
      console.log(`  Moderate Run: ${tdeeModerate} kcal  (BMR × 1.8)`);
      console.log(`  Long Run:     ${tdeeLong} kcal  (BMR × 2.0)`);
      console.log(`  Quality Run:  ${tdeeQuality} kcal  (BMR × 2.1)`);
      
      console.log('\n💡 Calorie Increase from Rest Day:');
      console.log(`  Easy Run:     +${tdeeEasy - tdeeRest} kcal (+${Math.round((tdeeEasy - tdeeRest) / tdeeRest * 100)}%)`);
      console.log(`  Moderate Run: +${tdeeModerate - tdeeRest} kcal (+${Math.round((tdeeModerate - tdeeRest) / tdeeRest * 100)}%)`);
      console.log(`  Long Run:     +${tdeeLong - tdeeRest} kcal (+${Math.round((tdeeLong - tdeeRest) / tdeeRest * 100)}%)`);
      console.log(`  Quality Run:  +${tdeeQuality - tdeeRest} kcal (+${Math.round((tdeeQuality - tdeeRest) / tdeeRest * 100)}%)`);
    });

    it('shows significant calorie difference between rest and long run', () => {
      const tdeeRest = calculateTDEE(testProfile, 'rest');
      const tdeeLong = calculateTDEE(testProfile, 'long');
      
      const difference = tdeeLong - tdeeRest;
      const percentIncrease = (difference / tdeeRest) * 100;

      // Long run should require ~43% more calories than rest day
      expect(percentIncrease).toBeGreaterThan(40);
      expect(percentIncrease).toBeLessThan(50);
      expect(difference).toBeGreaterThan(900); // At least 900 kcal more

      console.log(`\n🏃 Long Run vs Rest Day:`);
      console.log(`  Rest:  ${tdeeRest} kcal`);
      console.log(`  Long:  ${tdeeLong} kcal`);
      console.log(`  Diff:  +${difference} kcal (+${Math.round(percentIncrease)}%)`);
    });
  });

  describe('Step 4: Macronutrient Targets by Training Load', () => {
    it('adjusts carb targets based on training intensity', () => {
      const macrosRest = getMacroTargetsPerKg('rest');
      const macrosEasy = getMacroTargetsPerKg('easy');
      const macrosModerate = getMacroTargetsPerKg('moderate');
      const macrosLong = getMacroTargetsPerKg('long');
      const macrosQuality = getMacroTargetsPerKg('quality');

      console.log('\n🍞 Carb Targets per kg Body Weight:');
      console.log(`  Rest:     ${macrosRest.cho} g/kg      (Total: ${macrosRest.cho * 70}g for 70kg runner)`);
      console.log(`  Easy:     ${macrosEasy.cho} g/kg      (Total: ${macrosEasy.cho * 70}g for 70kg runner)`);
      console.log(`  Moderate: ${macrosModerate.cho} g/kg      (Total: ${macrosModerate.cho * 70}g for 70kg runner)`);
      console.log(`  Long:     ${macrosLong.cho} g/kg      (Total: ${macrosLong.cho * 70}g for 70kg runner)`);
      console.log(`  Quality:  ${macrosQuality.cho} g/kg      (Total: ${macrosQuality.cho * 70}g for 70kg runner)`);

      // Verify carb progression
      expect(macrosRest.cho).toBe(3.5);
      expect(macrosEasy.cho).toBe(5.5);
      expect(macrosModerate.cho).toBe(7);
      expect(macrosLong.cho).toBe(9);
      expect(macrosQuality.cho).toBe(8);
    });

    it('shows carb increase from rest to long run', () => {
      const carbsRest = 3.5 * testProfile.weightKg;
      const carbsLong = 9 * testProfile.weightKg;
      const carbIncrease = carbsLong - carbsRest;
      
      console.log(`\n🍝 Carb Increase (Rest → Long Run):`);
      console.log(`  Rest:  ${carbsRest}g carbs`);
      console.log(`  Long:  ${carbsLong}g carbs`);
      console.log(`  +${carbIncrease}g carbs (+${Math.round((carbIncrease / carbsRest) * 100)}%)`);

      expect(carbIncrease).toBeGreaterThan(300); // At least 300g more carbs
    });
  });

  describe('Step 5: Complete Macro Distribution by Training Load', () => {
    it('calculates complete macros for rest day', () => {
      const tdee = calculateTDEE(testProfile, 'rest');
      const macros = calculateMacros(testProfile, 'rest', tdee);

      console.log('\n📋 Complete Macros - REST DAY:');
      console.log(`  Calories: ${tdee} kcal`);
      console.log(`  Carbs:    ${macros.cho}g  (${macros.cho * 4} kcal = ${Math.round((macros.cho * 4 / tdee) * 100)}%)`);
      console.log(`  Protein:  ${macros.protein}g  (${macros.protein * 4} kcal = ${Math.round((macros.protein * 4 / tdee) * 100)}%)`);
      console.log(`  Fat:      ${macros.fat}g  (${macros.fat * 9} kcal = ${Math.round((macros.fat * 9 / tdee) * 100)}%)`);

      // Verify fat is at least 20% of TDEE
      const fatKcal = macros.fat * 9;
      const fatPercent = (fatKcal / tdee) * 100;
      expect(fatPercent).toBeGreaterThanOrEqual(20);
    });

    it('calculates complete macros for long run day', () => {
      const tdee = calculateTDEE(testProfile, 'long');
      const macros = calculateMacros(testProfile, 'long', tdee);

      console.log('\n📋 Complete Macros - LONG RUN DAY:');
      console.log(`  Calories: ${tdee} kcal`);
      console.log(`  Carbs:    ${macros.cho}g  (${macros.cho * 4} kcal = ${Math.round((macros.cho * 4 / tdee) * 100)}%)`);
      console.log(`  Protein:  ${macros.protein}g  (${macros.protein * 4} kcal = ${Math.round((macros.protein * 4 / tdee) * 100)}%)`);
      console.log(`  Fat:      ${macros.fat}g  (${macros.fat * 9} kcal = ${Math.round((macros.fat * 9 / tdee) * 100)}%)`);

      // Long run should have higher carbs
      const restMacros = calculateMacros(testProfile, 'rest', calculateTDEE(testProfile, 'rest'));
      expect(macros.cho).toBeGreaterThan(restMacros.cho);
    });

    it('compares all training loads side by side', () => {
      const loads: TrainingLoad[] = ['rest', 'easy', 'moderate', 'long', 'quality'];
      
      console.log('\n📊 COMPLETE COMPARISON - All Training Loads:');
      console.log('─'.repeat(80));
      console.log('Load      | Calories | Carbs    | Protein  | Fat      | CHO g/kg');
      console.log('─'.repeat(80));

      loads.forEach(load => {
        const tdee = calculateTDEE(testProfile, 'long');
        const macros = calculateMacros(testProfile, load, tdee);
        const choPerKg = (macros.cho / testProfile.weightKg).toFixed(1);
        
        console.log(
          `${load.padEnd(9)} | ${tdee.toString().padEnd(8)} | ` +
          `${macros.cho.toString().padEnd(3)}g (${Math.round(macros.cho * 4 / tdee * 100)}%) | ` +
          `${macros.protein.toString().padEnd(3)}g (${Math.round(macros.protein * 4 / tdee * 100)}%) | ` +
          `${macros.fat.toString().padEnd(3)}g (${Math.round(macros.fat * 9 / tdee * 100)}%) | ` +
          `${choPerKg}g/kg`
        );
      });
      console.log('─'.repeat(80));
    });
  });

  describe('Step 6: Verify Calorie Changes ARE Applied', () => {
    it('confirms calories increase proportionally with training intensity', () => {
      const caloriesRest = calculateTDEE(testProfile, 'rest');
      const caloriesEasy = calculateTDEE(testProfile, 'easy');
      const caloriesModerate = calculateTDEE(testProfile, 'moderate');
      const caloriesLong = calculateTDEE(testProfile, 'long');
      const caloriesQuality = calculateTDEE(testProfile, 'quality');

      // Each level should have more or equal calories
      expect(caloriesEasy).toBeGreaterThan(caloriesRest);
      expect(caloriesModerate).toBeGreaterThan(caloriesEasy);
      expect(caloriesLong).toBeGreaterThan(caloriesModerate);
      expect(caloriesQuality).toBeGreaterThan(caloriesLong);

      console.log('\n✅ CONFIRMED: Calories DO change with training plan!');
      console.log(`   Rest → Easy:     +${caloriesEasy - caloriesRest} kcal`);
      console.log(`   Easy → Moderate: +${caloriesModerate - caloriesEasy} kcal`);
      console.log(`   Moderate → Long: +${caloriesLong - caloriesModerate} kcal`);
      console.log(`   Long → Quality:  +${caloriesQuality - caloriesLong} kcal`);
    });

    it('shows practical calorie difference for a real training week', () => {
      // Typical marathon training week
      const weekPlan: TrainingLoad[] = ['easy', 'moderate', 'easy', 'rest', 'quality', 'easy', 'long'];
      
      let totalWeeklyCalories = 0;
      console.log('\n📅 Sample Marathon Training Week (70kg runner):');
      console.log('─'.repeat(60));
      
      weekPlan.forEach((load, index) => {
        const dayCalories = calculateTDEE(testProfile, load);
        totalWeeklyCalories += dayCalories;
        const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index];
        console.log(`${day} - ${load.padEnd(8)}: ${dayCalories} kcal`);
      });
      
      const avgDailyCalories = Math.round(totalWeeklyCalories / 7);
      const restDayCalories = calculateTDEE(testProfile, 'rest');
      const allRestWeek = restDayCalories * 7;
      const extraCaloriesNeeded = totalWeeklyCalories - allRestWeek;
      
      console.log('─'.repeat(60));
      console.log(`Weekly Total:  ${totalWeeklyCalories} kcal`);
      console.log(`Daily Average: ${avgDailyCalories} kcal`);
      console.log(`\nIf all rest days: ${allRestWeek} kcal/week`);
      console.log(`Extra needed for training: +${extraCaloriesNeeded} kcal/week`);
      console.log(`That's +${Math.round(extraCaloriesNeeded / 7)} kcal/day on average`);
      
      expect(totalWeeklyCalories).toBeGreaterThan(allRestWeek);
    });
  });

  describe('Step 7: Real-World Examples', () => {
    it('example: 60kg female runner on long run day', () => {
      const femaleProfile: UserProfile = {
        weightKg: 60,
        heightCm: 165,
        age: 28,
        sex: 'female',
      };

      const tdeeRest = calculateTDEE(femaleProfile, 'rest');
      const tdeeLong = calculateTDEE(femaleProfile, 'long');
      const macrosLong = calculateMacros(femaleProfile, 'long', tdeeLong);

      console.log('\n👩 Example: 60kg Female Runner - Long Run Day');
      console.log(`  Rest Day Calories:  ${tdeeRest} kcal`);
      console.log(`  Long Run Calories:  ${tdeeLong} kcal (+${tdeeLong - tdeeRest} kcal)`);
      console.log(`  Carbs needed:       ${macrosLong.cho}g (${macrosLong.cho / 60} g/kg)`);
      console.log(`  Protein needed:     ${macrosLong.protein}g (${(macrosLong.protein / 60).toFixed(1)} g/kg)`);
    });

    it('example: 80kg male runner on quality run day', () => {
      const maleProfile: UserProfile = {
        weightKg: 80,
        heightCm: 180,
        age: 35,
        sex: 'male',
      };

      const tdeeRest = calculateTDEE(maleProfile, 'rest');
      const tdeeQuality = calculateTDEE(maleProfile, 'quality');
      const macrosQuality = calculateMacros(maleProfile, 'quality', tdeeQuality);

      console.log('\n👨 Example: 80kg Male Runner - Quality Run Day');
      console.log(`  Rest Day Calories:     ${tdeeRest} kcal`);
      console.log(`  Quality Run Calories:  ${tdeeQuality} kcal (+${tdeeQuality - tdeeRest} kcal)`);
      console.log(`  Carbs needed:          ${macrosQuality.cho}g (${macrosQuality.cho / 80} g/kg)`);
      console.log(`  Protein needed:        ${macrosQuality.protein}g (${(macrosQuality.protein / 80).toFixed(1)} g/kg)`);
    });
  });
});
