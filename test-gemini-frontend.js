#!/usr/bin/env node

// Test script to verify Gemini meal plan generation works
import { config } from 'dotenv';
config({ path: './test.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testGeminiMealPlan() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  console.log('🤖 Testing Gemini 2.0 Flash Meal Plan Generation');
  console.log('================================================');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-meal-plan-gemini`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        useAI: true,
        userId: 'test-user'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Request failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Response received');

    if (result.success) {
      console.log(`✅ Success: ${result.message}`);
      console.log(`📊 Total Calories: ${result.totalCalories}`);
      console.log(`🏃 Training Load: ${result.trainingLoad}`);

      if (result.meals) {
        const mealTypes = Object.keys(result.meals);
        console.log(`🍽️  Meal Types: ${mealTypes.join(', ')}`);

        mealTypes.forEach(type => {
          const meal = result.meals[type];
          if (meal.suggestions && meal.suggestions.length > 0) {
            console.log(`  • ${type}: ${meal.suggestions.length} suggestions`);
            console.log(`    Example: "${meal.suggestions[0].name}"`);
            console.log(`    Nutrition: ${meal.suggestions[0].calories} kcal, ${meal.suggestions[0].protein}g protein`);
          }
        });
      }

      console.log('\n🎉 Gemini 2.0 Flash meal suggestions are working perfectly!');
    } else {
      console.error('❌ Generation failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testGeminiMealPlan().catch(console.error);
