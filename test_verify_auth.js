// Test Edge Function authentication with proper JWT handling
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
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'test123456';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getOrCreateTestUser() {
  // Try to sign in first
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });

  if (!signInError && signInData?.session) {
    console.log('Signed in existing user:', { email: TEST_USER_EMAIL });
    return signInData.session;
  }

  // If sign in fails, try to sign up
  console.log('Sign in failed, attempting to sign up...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });

  if (signUpError) {
    throw new Error(`Failed to create user: ${signUpError.message}`);
  }

  console.log('Created new user:', { 
    email: TEST_USER_EMAIL,
    id: signUpData?.user?.id,
    confirmed: signUpData?.user?.confirmed_at
  });

  return signUpData.session;
}

async function testAuthFunction(session) {
  const accessToken = session?.access_token;
  if (!accessToken) {
    console.error('No access token available');
    return;
  }

  console.log('\n1. Testing regular user access:');
  try {
    const { data: userData, error: userError } = await supabase.functions.invoke(
      'verify-auth',
      {
        body: {},
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (userError) {
      console.error('Regular access failed:', userError);
    } else {
      console.log('Regular access succeeded:', userData);
    }
  } catch (e) {
    console.error('Regular access error:', e);
  }

  console.log('\n2. Testing admin access:');
  try {
    const { data: adminData, error: adminError } = await supabase.functions.invoke(
      'verify-auth',
      {
        body: { admin_key: ADMIN_KEY },
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (adminError) {
      console.error('Admin access failed:', adminError);
    } else {
      console.log('Admin access succeeded:', adminData);
    }
  } catch (e) {
    console.error('Admin access error:', e);
  }
}

async function runTests() {
  try {
    console.log('Setting up test user...');
    const session = await getOrCreateTestUser();
    if (session) {
      await testAuthFunction(session);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests().catch(console.error);