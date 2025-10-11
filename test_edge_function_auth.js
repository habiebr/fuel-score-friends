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
const ADMIN_KEY = process.env.ADMIN_FORCE_SYNC_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testEndpoint(endpoint, options = {}) {
  const { body = {}, useAdminKey = true } = options;
  
  console.log(`\nTesting ${endpoint} with ${useAdminKey ? 'admin key' : 'anonymous access'}:`);
  try {
    const { data, error } = await supabase.functions.invoke(endpoint, {
      body: useAdminKey ? { ...body, admin_key: ADMIN_KEY } : body,
      headers: {
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (error) {
      console.error(`Error:`, {
        status: error.context?.status,
        statusText: error.context?.statusText,
        message: error.message,
        responseBody: await error.context?.text()
      });
      return false;
    } else {
      console.log(`Success:`, data ? 'Got data' : 'No data');
      return true;
    }
  } catch (e) {
    console.error(`Exception:`, e);
    return false;
  }
}

async function runTests() {
  console.log('Testing Edge Function Access...\n');
  
  const endpoints = [
    {
      name: 'calculate-day-target',
      body: {
        date: new Date().toISOString(),
        profile: {
          weightKg: 70,
          heightCm: 175,
          age: 30,
          gender: 'male'
        },
        load: {
          type: 'rest',
          duration: 0
        }
      }
    }
  ];

  let adminSuccessCount = 0;
  let anonSuccessCount = 0;

  // Test each endpoint with both admin key and anonymous access
  for (const { name, body } of endpoints) {
    if (await testEndpoint(name, { body, useAdminKey: true })) {
      adminSuccessCount++;
    }
    if (await testEndpoint(name, { body, useAdminKey: false })) {
      anonSuccessCount++;
    }
  }

  console.log('\nTest Summary:');
  console.log(`Total Endpoints: ${endpoints.length}`);
  console.log(`Admin Key Success: ${adminSuccessCount}/${endpoints.length}`);
  console.log(`Anonymous Success: ${anonSuccessCount}/${endpoints.length}`);
}

runTests().catch(console.error);