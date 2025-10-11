// Test file to verify Edge Function authentication
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env.local') });

// Get environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testEndpoint(endpoint, body = {}, authToken = null) {
  console.log(`\nTesting endpoint: ${endpoint}`);
  try {
    const { data, error } = await supabase.functions.invoke(endpoint, {
      body: { ...body, admin_key: process.env.ADMIN_FORCE_SYNC_KEY },
      headers: {
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        'apikey': process.env.VITE_SUPABASE_ANON_KEY
      }
    });

    if (error) {
      console.error(`Error calling ${endpoint}:`, {
        status: error.context?.status,
        statusText: error.context?.statusText,
        message: error.message,
        responseBody: await error.context?.text()
      });
      return false;
    } else {
      console.log(`${endpoint} response:`, data ? 'Success' : 'No data');
      console.log('Response data:', data);
      return true;
    }
  } catch (e) {
    console.error(`Exception calling ${endpoint}:`, e);
    return false;
  }
}

async function runTests() {
  try {
    console.log('Testing Edge Function Authentication...');
    
    // Sign in to get a valid JWT token
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'test-password'
    });

    if (authError) {
      console.error('Authentication failed:', authError);
      return;
    }

    const authToken = authData?.session?.access_token;
    console.log('Authentication successful:', authToken ? 'Got token' : 'No token');
    
    // Test endpoints that should work with admin key
    const endpoints = [
      { name: 'aggregate-weekly-activity', body: { date: new Date().toISOString() } },
      { name: 'weekly-running-leaderboard', body: { date: new Date().toISOString() } },
      { name: 'calculate-day-target', body: { date: new Date().toISOString() } }
    ];

    let successCount = 0;
    for (const { name, body } of endpoints) {
      // Try with both JWT token and admin key
      if (await testEndpoint(name, body, authToken)) {
        successCount++;
      }
    }

    console.log(`\nTest Summary:`);
    console.log(`Total Tests: ${endpoints.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${endpoints.length - successCount}`);

  } catch (error) {
    console.error('Test suite failed:', error);
  }
}

runTests().catch(console.error);