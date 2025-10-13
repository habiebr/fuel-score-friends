#!/usr/bin/env node

/**
 * Test CORS Preflight and Actual Request
 * This will verify that CORS is properly configured
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://eecdbddpzwedficnpenm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NTczMjIsImV4cCI6MjA3MTIzMzMyMn0.DsT8hmM9CPW-0yrcchJAKOulyH6p_GnjoVIz1S0CbvI';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/nutrition-ai`;

async function testCorsPreFlight() {
  console.log('🧪 Testing CORS Preflight Request (OPTIONS)\n');
  console.log('📍 Endpoint:', ENDPOINT);
  console.log('');
  
  try {
    const response = await fetch(ENDPOINT, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://app.nutrisync.id',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, apikey, content-type',
      },
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log('');
    console.log('📋 CORS Headers Received:');
    
    const corsHeadersToCheck = [
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-max-age',
      'access-control-allow-credentials',
    ];
    
    const results = {};
    corsHeadersToCheck.forEach(header => {
      const value = response.headers.get(header);
      results[header] = value || '❌ MISSING';
      console.log(`  ${value ? '✅' : '❌'} ${header}: ${value || 'MISSING'}`);
    });
    
    console.log('');
    
    // Validate
    const validations = [];
    
    if (results['access-control-allow-origin']) {
      validations.push({ test: 'Allow-Origin header present', pass: true });
    } else {
      validations.push({ test: 'Allow-Origin header present', pass: false });
    }
    
    if (results['access-control-allow-methods']?.includes('POST')) {
      validations.push({ test: 'POST method allowed', pass: true });
    } else {
      validations.push({ test: 'POST method allowed', pass: false });
    }
    
    if (results['access-control-allow-headers']?.toLowerCase().includes('authorization')) {
      validations.push({ test: 'Authorization header allowed', pass: true });
    } else {
      validations.push({ test: 'Authorization header allowed', pass: false });
    }
    
    if (results['access-control-allow-headers']?.toLowerCase().includes('apikey')) {
      validations.push({ test: 'ApiKey header allowed', pass: true });
    } else {
      validations.push({ test: 'ApiKey header allowed', pass: false });
    }
    
    if (results['access-control-max-age']) {
      validations.push({ test: 'Max-Age header present (caching)', pass: true });
    } else {
      validations.push({ test: 'Max-Age header present (caching)', pass: false });
    }
    
    console.log('🔍 Validation Results:');
    validations.forEach(v => {
      const icon = v.pass ? '✅' : '❌';
      console.log(`  ${icon} ${v.test}`);
    });
    console.log('');
    
    const allPassed = validations.every(v => v.pass);
    
    if (allPassed) {
      console.log('✅ CORS Preflight: PASSED\n');
      return true;
    } else {
      console.log('❌ CORS Preflight: FAILED\n');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error during preflight:', error.message);
    console.log('');
    return false;
  }
}

async function testActualRequest() {
  console.log('🧪 Testing Actual Request with CORS Headers\n');
  console.log('📍 Endpoint:', ENDPOINT);
  console.log('');
  
  const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Origin': 'https://app.nutrisync.id',
      },
      body: JSON.stringify({
        type: 'food_photo',
        image: testImage,
        mealType: 'lunch',
      }),
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log('');
    console.log('📋 CORS Headers in Response:');
    
    const corsHeaders = [
      'access-control-allow-origin',
      'access-control-allow-credentials',
    ];
    
    corsHeaders.forEach(header => {
      const value = response.headers.get(header);
      console.log(`  ${value ? '✅' : '❌'} ${header}: ${value || 'MISSING'}`);
    });
    
    console.log('');
    
    const allowOrigin = response.headers.get('access-control-allow-origin');
    
    if (response.ok && allowOrigin) {
      console.log('✅ Actual Request: PASSED');
      console.log('   - Response successful');
      console.log('   - CORS headers present');
      console.log('');
      return true;
    } else {
      console.log('❌ Actual Request: FAILED');
      if (!response.ok) {
        console.log(`   - Response error: ${response.status}`);
      }
      if (!allowOrigin) {
        console.log('   - Missing CORS headers');
      }
      console.log('');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error during request:', error.message);
    console.log('');
    return false;
  }
}

async function runTests() {
  console.log('\n🚀 CORS Configuration Test');
  console.log('=' .repeat(70));
  console.log('📅 Date:', new Date().toISOString());
  console.log('🌐 Endpoint:', ENDPOINT);
  console.log('🔑 Testing with CORS from: https://app.nutrisync.id');
  console.log('=' .repeat(70));
  console.log('');
  
  const preFlightPass = await testCorsPreFlight();
  
  console.log('=' .repeat(70));
  console.log('');
  
  const actualRequestPass = await testActualRequest();
  
  console.log('=' .repeat(70));
  console.log('📊 SUMMARY');
  console.log('=' .repeat(70));
  console.log('');
  console.log(`Preflight (OPTIONS): ${preFlightPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Actual Request (POST): ${actualRequestPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  if (preFlightPass && actualRequestPass) {
    console.log('✅ ALL CORS TESTS PASSED');
    console.log('   The edge function should work for all users now!');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ SOME CORS TESTS FAILED');
    console.log('   Users may still experience CORS errors');
    console.log('');
    process.exit(1);
  }
}

runTests();
