// Test JWT auth requirement for Edge Functions
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

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testJwtAuth() {
  console.log('Testing JWT Authentication\n');

  // Step 1: Sign in with test user
  console.log('1. Signing in with test user...');
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError || !signInData.session?.access_token) {
    console.error('Failed to sign in:', signInError);
    return;
  }

  const { access_token } = signInData.session;
  console.log('Got access token:', access_token ? 'Yes' : 'No');

  // Step 2: Test verify-auth endpoint with JWT
  console.log('\n2. Testing verify-auth with JWT...');
  try {
    const { data: authData, error: authError } = await supabase.functions.invoke(
      'verify-auth',
      {
        body: {},
        headers: { 
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    if (authError) {
      console.error('JWT test failed:', {
        status: authError.context?.status,
        message: authError.message,
        response: await authError.context?.text()
      });
    } else {
      console.log('JWT test succeeded:', authData);
    }
  } catch (e) {
    console.error('JWT test error:', e);
  }

  // Step 3: Test verify-auth endpoint with JWT + admin key
  console.log('\n3. Testing verify-auth with JWT + admin key...');
  try {
    const { data: adminData, error: adminError } = await supabase.functions.invoke(
      'verify-auth',
      {
        body: { admin_key: ADMIN_KEY },
        headers: { 
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    if (adminError) {
      console.error('Admin test failed:', {
        status: adminError.context?.status,
        message: adminError.message,
        response: await adminError.context?.text()
      });
    } else {
      console.log('Admin test succeeded:', adminData);
    }
  } catch (e) {
    console.error('Admin test error:', e);
  }
}

testJwtAuth().catch(console.error);