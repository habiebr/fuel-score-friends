/**
 * Validation test for nutrition calculations
 * Ensures targets prevent underfueling
 */

import { describe, it, expect } from 'vitest';
import { calculateTDEE, calculateMacros, type UserProfile } from '../nutrition-engine';
import { calculateMacros as calculateMacrosMVP, calculateTDEE as calculateTDEEMVP } from '../marathon-nutrition';

describe('Nutrition Underfueling Safeguards', () => {
  const sampleProfile: UserProfile = {
    weightKg: 70,
    heightCm: 175,
    age: 30,
    sex: 'male'
  };

  it('should ensure macros sum to TDEE or higher (no underfueling)', () => {
    const loads: Array<{ load: string; minKcal: number }> = [
      { load: 'rest', minKcal: 1800 },
      { load: 'easy', minKcal: 2000 },
      { load: 'moderate', minKcal: 2300 },
      { load: 'long', minKcal: 2500 },
      { load: 'quality', minKcal: 2700 }
    ];

    loads.forEach(({ load, minKcal }) => {
      const tdee = calculateTDEEMVP(sampleProfile, load as any);
      
      console.log(`${load.toUpperCase()} Day:`);
      console.log(`  TDEE: ${tdee} kcal`);
      console.log(`  Expected minimum: ${minKcal} kcal`);
      
      // Calculate macros (using MVP which has the fix)
      const macros = calculateMacrosMVP(sampleProfile, load as any, tdee);
      
      // Calculate total calories from macros
      const choKcal = macros.cho * 4;
      const proteinKcal = macros.protein * 4;
      const fatKcal = macros.fat * 9;
      const totalMacroKcal = choKcal + proteinKcal + fatKcal;
      
      console.log(`  CHO: ${macros.cho}g = ${choKcal} kcal`);
      console.log(`  Protein: ${macros.protein}g = ${proteinKcal} kcal`);
      console.log(`  Fat: ${macros.fat}g = ${fatKcal} kcal`);
      console.log(`  Total from macros: ${totalMacroKcal} kcal`);
      console.log(`  Difference from TDEE: ${totalMacroKcal - tdee} kcal`);
      
      // KEY ASSERTION: Total macros must meet TDEE or be very close (within 10 kcal for rounding)
      // This ensures no significant underfueling
      expect(totalMacroKcal).toBeGreaterThanOrEqual(tdee - 10); // Allow small rounding error
      
      // Allow reasonable overage on hard training days
      // Long runs need extra carbs (9g/kg = more than TDEE can hold)
      const maxAllowedOver = load === 'long' || load === 'quality' ? 500 : 200;
      expect(totalMacroKcal).toBeLessThanOrEqual(tdee + maxAllowedOver);
    });
  });

  it('should ensure minimum fat intake (20% of TDEE)', () => {
    const tdee = calculateTDEE(sampleProfile, 'long');
    const macros = calculateMacros(sampleProfile, 'long', tdee);
    
    const minFatKcal = tdee * 0.2;
    const minFatGrams = minFatKcal / 9;
    
    console.log(`TDEE: ${tdee} kcal`);
    console.log(`Fat: ${macros.fat}g (minimum should be ${Math.round(minFatGrams)}g)`);
    
    // Fat must be at least 20% of calories
    expect(macros.fat).toBeGreaterThanOrEqual(minFatGrams - 0.5); // Allow rounding
  });

  it('should provide adequate carbs for long runs', () => {
    const tdee = calculateTDEE(sampleProfile, 'long');
    const macros = calculateMacros(sampleProfile, 'long', tdee);
    
    // For long runs, should have at least 7-8g CHO/kg for glycogen stores
    const minCHO = sampleProfile.weightKg * 7;
    
    console.log(`Long run CHO: ${macros.cho}g (should be ≥${minCHO}g)`);
    
    expect(macros.cho).toBeGreaterThanOrEqual(minCHO);
  });

  it('should provide adequate protein for recovery', () => {
    const tdee = calculateTDEE(sampleProfile, 'quality');
    const macros = calculateMacros(sampleProfile, 'quality', tdee);
    
    // Should have at least 1.6g protein/kg for recovery
    const minProtein = sampleProfile.weightKg * 1.6;
    
    console.log(`Quality workout protein: ${macros.protein}g (should be ≥${minProtein}g)`);
    
    expect(macros.protein).toBeGreaterThanOrEqual(minProtein);
  });
});

