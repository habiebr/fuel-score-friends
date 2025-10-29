#!/usr/bin/env node

/**
 * Comprehensive test comparing Gemini vs Grok for meal suggestions
 * Tests both the new Gemini function and existing Grok implementation
 */

// Load test environment variables
import { config } from 'dotenv';
config({ path: './test.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testMealSuggestions() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const testData = {
    userProfile: {
      age: 30,
      weightKg: 70,
      heightCm: 175,
      sex: 'male'
    },
    dayTarget: {
      kcal: 2400,
      cho_g: 300,
      protein_g: 120,
      fat_g: 80
    },
    trainingLoad: 'moderate',
    date: '2024-12-20',
    includeSnack: true,
    unifiedMealPlan: {
      breakfast: { kcal: 600, protein_g: 30, cho_g: 75, fat_g: 20 },
      lunch: { kcal: 800, protein_g: 40, cho_g: 100, fat_g: 25 },
      dinner: { kcal: 700, protein_g: 35, cho_g: 85, fat_g: 20 },
      snack: { kcal: 300, protein_g: 15, cho_g: 40, fat_g: 15 }
    },
    dietaryRestrictions: [],
    eatingBehaviors: []
  };

  console.log('🧪 Testing Gemini vs Grok for Indonesian Meal Suggestions\n');
  console.log('='.repeat(60));
  console.log('Test Parameters:');
  console.log(`- User: ${testData.userProfile.age}y, ${testData.userProfile.weightKg}kg, ${testData.userProfile.sex}`);
  console.log(`- Training Load: ${testData.trainingLoad}`);
  console.log(`- Target Calories: ${testData.dayTarget.kcal} kcal`);
  console.log(`- Indonesian Cuisine Focus`);
  console.log('='.repeat(60));
  console.log('');

  // Test Gemini
  console.log('🤖 Testing Gemini Implementation...');
  const geminiStart = Date.now();

  try {
    const geminiResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-meal-plan-gemini`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const geminiTime = Date.now() - geminiStart;

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`${geminiResponse.status}: ${errorText}`);
    }

    const geminiResult = await geminiResponse.json();
    console.log(`✅ Gemini Response: ${geminiTime}ms`);

    if (geminiResult.error) {
      console.log(`❌ Gemini Error Details: ${JSON.stringify(geminiResult.error, null, 2)}`);
    }

    displayResults('Gemini', geminiResult, geminiTime);

  } catch (error) {
    console.log(`❌ Gemini Failed: ${error.message}`);
  }

  console.log('\n' + '-'.repeat(40) + '\n');

  // Test Grok (existing implementation)
  console.log('🚀 Testing Grok Implementation...');
  const grokStart = Date.now();

  try {
    const grokResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-meal-plan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testData,
        userId: 'test-user', // Grok function requires userId
        useAI: true
      })
    });

    const grokTime = Date.now() - grokStart;

    if (!grokResponse.ok) {
      const errorText = await grokResponse.text();
      throw new Error(`${grokResponse.status}: ${errorText}`);
    }

    const grokResult = await grokResponse.json();
    console.log(`✅ Grok Response: ${grokTime}ms`);

    if (grokResult.error) {
      console.log(`❌ Grok Error Details: ${JSON.stringify(grokResult.error, null, 2)}`);
    } else {
      console.log(`ℹ️ Grok Response Keys: ${Object.keys(grokResult).join(', ')}`);
      console.log(`ℹ️ Grok Success: ${grokResult.success}`);
      console.log(`ℹ️ Grok Total Calories: ${grokResult.totalCalories}`);
      console.log(`ℹ️ Grok Training Load: ${grokResult.trainingLoad}`);
      console.log(`ℹ️ Grok Meals: ${JSON.stringify(grokResult.meals, null, 2)}`);
      console.log(`ℹ️ Grok Message: ${grokResult.message}`);
    }

    displayResults('Grok', grokResult, grokTime);

  } catch (error) {
    console.log(`❌ Grok Failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 SUMMARY & RECOMMENDATIONS');
  console.log('='.repeat(60));
  console.log('');
  console.log('📋 Key Comparison Points:');
  console.log('• Indonesian Cuisine Authenticity');
  console.log('• Portion Accuracy & Detail');
  console.log('• Meal Variety (2-3 options per type)');
  console.log('• Nutrition Target Matching');
  console.log('• Response Time & Reliability');
  console.log('');
  console.log('🔧 To get Gemini working:');
  console.log('1. Get valid Google Gemini API key from Google AI Studio');
  console.log('2. Update GEMINI_API_KEY in Supabase secrets');
  console.log('3. Test with proper API key');
  console.log('');
  console.log('📊 Current Status: Grok is the reliable choice for meal suggestions');
}

function displayResults(provider, result, responseTime) {
  if (result.error) {
    console.log(`❌ ${provider} failed: ${result.error}`);
    return;
  }

  console.log(`📊 ${provider} Results:`);
  console.log(`   Response Time: ${responseTime}ms`);

  // Handle Gemini response structure
  if (result.suggestions) {
    const suggestions = result.suggestions;
    const mealTypes = Object.keys(suggestions);
    const totalSuggestions = mealTypes.reduce((sum, type) => sum + (suggestions[type]?.length || 0), 0);

    console.log(`   Model: ${result.model || 'Unknown'}`);
    console.log(`   Total Meal Types: ${mealTypes.length}`);
    console.log(`   Total Suggestions: ${totalSuggestions}`);

    if (totalSuggestions > 0) {
      console.log(`   Meal Breakdown:`);
      mealTypes.forEach(type => {
        const mealSuggestions = suggestions[type] || [];
        if (mealSuggestions.length > 0) {
          const firstSuggestion = mealSuggestions[0];
          console.log(`   • ${type}: ${mealSuggestions.length} options`);
          console.log(`     Example: "${firstSuggestion.name || firstSuggestion}"`);
          if (firstSuggestion.calories && firstSuggestion.protein) {
            console.log(`     Nutrition: ${firstSuggestion.calories} kcal, ${firstSuggestion.protein}g protein`);
          } else if (firstSuggestion.kcal && firstSuggestion.protein_g) {
            console.log(`     Nutrition: ${firstSuggestion.kcal} kcal, ${firstSuggestion.protein_g}g protein`);
          }
        }
      });
    }
  }
  // Handle Grok response structure
  else if (result.meals) {
    const meals = result.meals;
    const mealTypes = Object.keys(meals);
    const totalSuggestions = mealTypes.reduce((sum, type) => sum + (meals[type]?.suggestions?.length || 0), 0);

    console.log(`   Model: ${result.trainingLoad ? 'Grok (Unified Engine)' : 'Unknown'}`);
    console.log(`   Total Meal Types: ${mealTypes.length}`);
    console.log(`   Total Suggestions: ${totalSuggestions}`);
    console.log(`   Total Calories: ${result.totalCalories}`);
    console.log(`   Training Load: ${result.trainingLoad}`);

    if (totalSuggestions > 0) {
      console.log(`   Meal Breakdown:`);
      mealTypes.forEach(type => {
        const mealData = meals[type];
        const suggestions = mealData?.suggestions || [];
        if (suggestions.length > 0) {
          const firstSuggestion = suggestions[0];
          console.log(`   • ${type}: ${suggestions.length} options`);
          console.log(`     Example: "${firstSuggestion.name}"`);
          console.log(`     Nutrition: ${firstSuggestion.calories} kcal, ${firstSuggestion.protein}g protein`);
        }
      });
    }
  }
  else {
    console.log(`   Model: Unknown`);
    console.log(`   Total Meal Types: 0`);
    console.log(`   Total Suggestions: 0`);
  }
}

// Run the test
testMealSuggestions().catch(console.error);
