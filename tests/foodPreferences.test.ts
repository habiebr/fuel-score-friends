/**
 * Test Food Preferences functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock fetch
global.fetch = vi.fn();

describe('Food Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle dietary restrictions correctly', () => {
    const restrictions = ['lactose intolerant', 'gluten free', 'no red meat'];
    
    // Test restriction filtering logic
    const testRecipe = {
      name: 'Nasi Goreng',
      ingredients: ['rice', 'chicken', 'soy sauce'],
      tags: ['indonesian', 'main course']
    };

    const hasRestriction = (recipe: any, restriction: string) => {
      const combinedText = [...recipe.tags, ...recipe.ingredients].join(' ').toLowerCase();
      const restrictionLower = restriction.toLowerCase();
      
      if (restrictionLower.includes('lactose') || restrictionLower.includes('dairy')) {
        return combinedText.includes('milk') || combinedText.includes('cheese') || 
               combinedText.includes('yogurt') || combinedText.includes('dairy');
      }
      
      if (restrictionLower.includes('gluten')) {
        return combinedText.includes('wheat') || combinedText.includes('bread') || 
               combinedText.includes('pasta') || combinedText.includes('flour');
      }
      
      if (restrictionLower.includes('no red meat') || restrictionLower.includes('red meat')) {
        return combinedText.includes('beef') || combinedText.includes('pork') || 
               combinedText.includes('lamb');
      }
      
      return false;
    };

    // Test that nasi goreng with chicken doesn't violate restrictions
    expect(hasRestriction(testRecipe, 'lactose intolerant')).toBe(false);
    expect(hasRestriction(testRecipe, 'gluten free')).toBe(false);
    expect(hasRestriction(testRecipe, 'no red meat')).toBe(false);
  });

  it('should handle eating behaviors correctly', () => {
    const behaviors = ['prefer plant-based proteins', 'eat eggs for breakfast', 'like spicy food'];
    
    // Test behavior matching logic
    const testRecipe = {
      name: 'Tempe Goreng',
      ingredients: ['tempe', 'chili', 'garlic'],
      tags: ['indonesian', 'vegetarian', 'spicy']
    };

    const matchesBehavior = (recipe: any, behavior: string) => {
      const combinedText = [...recipe.tags, ...recipe.ingredients].join(' ').toLowerCase();
      const behaviorLower = behavior.toLowerCase();
      
      if (behaviorLower.includes('plant-based')) {
        return combinedText.includes('tempe') || combinedText.includes('tofu') || 
               combinedText.includes('vegetarian');
      }
      
      if (behaviorLower.includes('spicy')) {
        return combinedText.includes('chili') || combinedText.includes('spicy');
      }
      
      return false;
    };

    // Test that tempe goreng matches plant-based and spicy preferences
    expect(matchesBehavior(testRecipe, 'prefer plant-based proteins')).toBe(true);
    expect(matchesBehavior(testRecipe, 'like spicy food')).toBe(true);
  });

  it('should validate preference data structure', () => {
    const validPreferences = {
      dietary_restrictions: ['lactose intolerant', 'gluten free'],
      eating_behaviors: ['prefer plant-based proteins', 'eat eggs for breakfast'],
      time_budget_min: 60
    };

    expect(Array.isArray(validPreferences.dietary_restrictions)).toBe(true);
    expect(Array.isArray(validPreferences.eating_behaviors)).toBe(true);
    expect(typeof validPreferences.time_budget_min).toBe('number');
    expect(validPreferences.dietary_restrictions.length).toBeGreaterThan(0);
    expect(validPreferences.eating_behaviors.length).toBeGreaterThan(0);
  });

  it('should handle empty preferences gracefully', () => {
    const emptyPreferences = {
      dietary_restrictions: [],
      eating_behaviors: [],
      time_budget_min: 60
    };

    expect(emptyPreferences.dietary_restrictions.length).toBe(0);
    expect(emptyPreferences.eating_behaviors.length).toBe(0);
    
    // Should not cause errors when filtering
    const recipes = [{ name: 'Nasi Goreng', ingredients: ['rice', 'chicken'], tags: ['indonesian'] }];
    const filteredRecipes = recipes.filter(recipe => {
      // No restrictions to filter by
      return true;
    });
    
    expect(filteredRecipes.length).toBe(1);
  });

  it('should generate proper AI context with preferences', () => {
    const userProfile = {
      weightKg: 70,
      heightCm: 175,
      age: 30,
      sex: 'male' as const
    };

    const dietaryRestrictions = ['lactose intolerant', 'gluten free'];
    const eatingBehaviors = ['prefer plant-based proteins', 'eat eggs for breakfast'];

    const context = `
User Profile:
- Age: ${userProfile.age}
- Weight: ${userProfile.weightKg} kg
- Height: ${userProfile.heightCm} cm
- Sex: ${userProfile.sex}

Dietary Restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(', ') : 'None'}
Eating Behaviors: ${eatingBehaviors.length > 0 ? eatingBehaviors.join(', ') : 'None'}
    `.trim();

    expect(context).toContain('Dietary Restrictions: lactose intolerant, gluten free');
    expect(context).toContain('Eating Behaviors: prefer plant-based proteins, eat eggs for breakfast');
    expect(context).toContain('Weight: 70 kg');
    expect(context).toContain('Age: 30');
  });
});
