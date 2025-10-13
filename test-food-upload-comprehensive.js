#!/usr/bin/env node

/**
 * Comprehensive Food Photo Upload Test
 * Tests with real food images and AI analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://eecdbddpzwedficnpenm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Error: VITE_SUPABASE_ANON_KEY not found in environment');
  console.log('Please run:');
  console.log('export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NTczMjIsImV4cCI6MjA3MTIzMzMyMn0.DsT8hmM9CPW-0yrcchJAKOulyH6p_GnjoVIz1S0CbvI"');
  process.exit(1);
}

// Test images - using publicly accessible food images
const TEST_IMAGES = [
  {
    name: 'Pizza',
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
    expectedFood: 'pizza',
    minCalories: 200,
  },
  {
    name: 'Salad',
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
    expectedFood: 'salad',
    minCalories: 50,
  },
  {
    name: 'Burger',
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    expectedFood: 'burger',
    minCalories: 300,
  },
];

async function testEdgeFunction(testImage) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 Testing: ${testImage.name}`);
  console.log(`${'='.repeat(70)}\n`);
  
  console.log('📍 Endpoint:', `${SUPABASE_URL}/functions/v1/nutrition-ai`);
  console.log('🔑 API Key:', SUPABASE_ANON_KEY.substring(0, 30) + '...');
  console.log('📸 Image URL:', testImage.url);
  console.log('🎯 Expected:', testImage.expectedFood);
  console.log('');
  
  const payload = {
    type: 'food_photo',
    image: testImage.url,
    mealType: 'lunch'
  };
  
  console.log('📤 Sending request to Gemini AI...\n');
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/nutrition-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  Response received in ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log('⚠️  Non-JSON response:', text.substring(0, 200));
      throw new Error('Expected JSON response');
    }
    
    if (!response.ok) {
      console.log('\n❌ Request failed');
      console.log('Error:', JSON.stringify(data, null, 2));
      return { success: false, error: data, duration };
    }
    
    console.log('\n✅ AI Analysis Complete!\n');
    
    if (data?.nutritionData) {
      const nutrition = data.nutritionData;
      
      console.log('🍽️  Analysis Results:');
      console.log('  ├─ Food Name:', nutrition.food_name);
      console.log('  ├─ Serving Size:', nutrition.serving_size);
      console.log('  ├─ Calories:', nutrition.calories, 'kcal');
      console.log('  ├─ Protein:', nutrition.protein_grams, 'g');
      console.log('  ├─ Carbs:', nutrition.carbs_grams, 'g');
      console.log('  └─ Fat:', nutrition.fat_grams, 'g');
      console.log('');
      
      // Validate results
      const validations = [];
      
      // Check if it identified food
      if (nutrition.calories > 0) {
        validations.push({ test: 'Identified as food', pass: true });
      } else {
        validations.push({ test: 'Identified as food', pass: false, detail: 'Calories = 0' });
      }
      
      // Check if calories are reasonable
      if (nutrition.calories >= testImage.minCalories) {
        validations.push({ test: 'Reasonable calories', pass: true });
      } else {
        validations.push({ 
          test: 'Reasonable calories', 
          pass: false, 
          detail: `Expected >= ${testImage.minCalories}, got ${nutrition.calories}` 
        });
      }
      
      // Check if macros add up (1g protein = 4 cal, 1g carb = 4 cal, 1g fat = 9 cal)
      const calculatedCalories = (nutrition.protein_grams * 4) + (nutrition.carbs_grams * 4) + (nutrition.fat_grams * 9);
      const caloriesDiff = Math.abs(calculatedCalories - nutrition.calories);
      const caloriesMatch = caloriesDiff <= nutrition.calories * 0.3; // Allow 30% variance
      
      if (caloriesMatch) {
        validations.push({ test: 'Macros match calories', pass: true });
      } else {
        validations.push({ 
          test: 'Macros match calories', 
          pass: false, 
          detail: `Calculated: ${calculatedCalories}, Reported: ${nutrition.calories}` 
        });
      }
      
      // Check if food name contains expected food
      const foodNameLower = nutrition.food_name.toLowerCase();
      const expectedLower = testImage.expectedFood.toLowerCase();
      const nameMatches = foodNameLower.includes(expectedLower) || 
                         expectedLower.includes(foodNameLower.split(' ')[0]);
      
      if (nameMatches) {
        validations.push({ test: 'Correct food identified', pass: true });
      } else {
        validations.push({ 
          test: 'Correct food identified', 
          pass: false, 
          detail: `Expected "${testImage.expectedFood}", got "${nutrition.food_name}"` 
        });
      }
      
      console.log('🔍 Validation Results:');
      validations.forEach(v => {
        const icon = v.pass ? '✅' : '❌';
        const detail = v.detail ? ` (${v.detail})` : '';
        console.log(`  ${icon} ${v.test}${detail}`);
      });
      
      const allPassed = validations.every(v => v.pass);
      const somePassed = validations.some(v => v.pass);
      
      return { 
        success: allPassed, 
        partial: somePassed && !allPassed,
        data: nutrition, 
        duration,
        validations 
      };
    } else {
      console.log('❌ No nutrition data in response');
      console.log('Response:', JSON.stringify(data, null, 2));
      return { success: false, error: 'No nutrition data', duration };
    }
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Network error - cannot reach edge function');
    } else if (error.message.includes('timeout')) {
      console.log('\n💡 Request timed out');
    }
    
    console.log('\n🔍 Stack trace:');
    console.log(error.stack);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('\n🚀 Starting Comprehensive Food Upload Tests');
  console.log('=' .repeat(70));
  console.log('📅 Date:', new Date().toISOString());
  console.log('🌐 Supabase URL:', SUPABASE_URL);
  console.log('🤖 AI Model: Google Gemini 2.5 Flash');
  console.log('📋 Total Tests:', TEST_IMAGES.length);
  
  const results = [];
  
  for (const testImage of TEST_IMAGES) {
    const result = await testEdgeFunction(testImage);
    results.push({ 
      name: testImage.name, 
      ...result 
    });
    
    // Wait 2 seconds between tests to avoid rate limiting
    if (TEST_IMAGES.indexOf(testImage) < TEST_IMAGES.length - 1) {
      console.log('\n⏳ Waiting 2s before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(70)}\n`);
  
  const passed = results.filter(r => r.success).length;
  const partial = results.filter(r => r.partial).length;
  const failed = results.filter(r => !r.success && !r.partial).length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Partial: ${partial}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');
  
  results.forEach(r => {
    const icon = r.success ? '✅' : r.partial ? '⚠️ ' : '❌';
    const duration = r.duration ? ` (${(r.duration / 1000).toFixed(2)}s)` : '';
    const food = r.data?.food_name ? ` - "${r.data.food_name}"` : '';
    console.log(`${icon} ${r.name}${food}${duration}`);
    
    if (r.validations && !r.success) {
      const failedValidations = r.validations.filter(v => !v.pass);
      failedValidations.forEach(v => {
        console.log(`    └─ Failed: ${v.test}${v.detail ? ` (${v.detail})` : ''}`);
      });
    }
  });
  
  console.log('');
  
  // Average response time
  const avgDuration = results
    .filter(r => r.duration)
    .reduce((sum, r) => sum + r.duration, 0) / results.filter(r => r.duration).length;
  
  if (avgDuration) {
    console.log(`⏱️  Average Response Time: ${(avgDuration / 1000).toFixed(2)}s`);
  }
  
  console.log(`\n${'='.repeat(70)}\n`);
  
  // Exit code based on results
  if (failed > 0) {
    console.log('❌ Some tests failed');
    process.exit(1);
  } else if (partial > 0) {
    console.log('⚠️  All tests passed with some validations failing');
    process.exit(0);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

// Timeout for the entire test suite (5 minutes)
const timeout = setTimeout(() => {
  console.log('\n⏰ Test suite timed out after 5 minutes');
  process.exit(1);
}, 300000);

runAllTests()
  .then(() => {
    clearTimeout(timeout);
  })
  .catch(err => {
    clearTimeout(timeout);
    console.error('\n💥 Unexpected error:', err);
    process.exit(1);
  });
