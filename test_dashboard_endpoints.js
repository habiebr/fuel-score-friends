// Test file to verify dashboard endpoints with proper authentication
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

async function testEndpoints() {
  try {
    // Sign in (replace with test credentials)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'your-test-password'
    });

    if (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    console.log('Authentication successful');
    console.log('Access token:', authData.session?.access_token ? 'Present' : 'Missing');

    // Test dashboard endpoints
    const endpoints = [
      'aggregate-weekly-activity',
      'weekly-running-leaderboard',
      'calculate-day-target'
    ];

    for (const endpoint of endpoints) {
      console.log(`\nTesting endpoint: ${endpoint}`);
      try {
        const { data, error } = await supabase.functions.invoke(endpoint, {
          body: { date: new Date().toISOString() }
        });

        if (error) {
          console.error(`Error calling ${endpoint}:`, error);
        } else {
          console.log(`${endpoint} response:`, data ? 'Success' : 'No data');
        }
      } catch (e) {
        console.error(`Exception calling ${endpoint}:`, e);
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testEndpoints().catch(console.error);