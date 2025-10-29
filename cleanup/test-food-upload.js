#!/usr/bin/env node

/**
 * Test script for food photo upload and AI analysis
 * This will help diagnose edge function issues
 */

import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://eecdbddpzwedficnpenm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Error: VITE_SUPABASE_ANON_KEY not found in environment');
  console.log('Please set it in your .env file or export it:');
  console.log('export VITE_SUPABASE_ANON_KEY="your-key-here"');
  process.exit(1);
}

async function testEdgeFunction() {
  console.log('🧪 Testing nutrition-ai edge function...\n');
  
  // Test with a sample base64 image (1x1 red pixel PNG)
  const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  
  console.log('📍 Endpoint:', `${SUPABASE_URL}/functions/v1/nutrition-ai`);
  console.log('🔑 API Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
  console.log('📸 Image type: Test base64 image\n');
  
  const payload = {
    type: 'food_photo',
    image: testImage,
    mealType: 'lunch'
  };
  
  console.log('📤 Sending request...\n');
  
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
    
    console.log(`⏱️  Response received in ${duration}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Headers:`, Object.fromEntries(response.headers.entries()));
    
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
      console.log('\n✅ Response body (JSON):');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('\n📄 Response body (text):');
      console.log(text);
      data = text;
    }
    
    if (!response.ok) {
      console.log('\n❌ Request failed with status', response.status);
      if (data?.error) {
        console.log('Error message:', data.error);
        console.log('Error details:', data.details || 'N/A');
      }
      process.exit(1);
    }
    
    console.log('\n✅ Test passed!');
    
    if (data?.nutritionData) {
      console.log('\n🍽️  Nutrition data received:');
      console.log('  Food:', data.nutritionData.food_name);
      console.log('  Calories:', data.nutritionData.calories);
      console.log('  Protein:', data.nutritionData.protein_grams + 'g');
      console.log('  Carbs:', data.nutritionData.carbs_grams + 'g');
      console.log('  Fat:', data.nutritionData.fat_grams + 'g');
    }
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Diagnosis: Network/fetch error');
      console.log('   This usually means:');
      console.log('   1. Cannot reach the edge function endpoint');
      console.log('   2. CORS issue');
      console.log('   3. Edge function is not deployed');
      console.log('   4. DNS/connectivity issue');
    } else if (error.message.includes('timeout')) {
      console.log('\n💡 Diagnosis: Request timed out');
      console.log('   The edge function is taking too long to respond');
    } else {
      console.log('\n💡 Unexpected error type');
    }
    
    console.log('\n🔍 Stack trace:');
    console.log(error.stack);
    process.exit(1);
  }
}

// Add timeout to the whole test
const timeout = setTimeout(() => {
  console.log('\n⏰ Test timed out after 60 seconds');
  process.exit(1);
}, 60000);

testEdgeFunction()
  .then(() => {
    clearTimeout(timeout);
    process.exit(0);
  })
  .catch(err => {
    clearTimeout(timeout);
    console.error('Unexpected error:', err);
    process.exit(1);
  });
