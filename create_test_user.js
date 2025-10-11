// Create a test user in Supabase
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'test123456';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createTestUser() {
  console.log('Creating test user...');
  
  // Try to sign up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });

  if (signUpError) {
    console.error('Failed to create test user:', signUpError);
  } else {
    console.log('Test user created:', {
      email: TEST_USER_EMAIL,
      id: signUpData?.user?.id,
      confirmed: signUpData?.user?.confirmed_at
    });
  }

  // Try to sign in
  console.log('\nTrying to sign in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });

  if (signInError) {
    console.error('Failed to sign in:', signInError);
  } else {
    console.log('Sign in successful:', {
      userId: signInData?.user?.id,
      hasSession: !!signInData?.session,
      tokenExpires: signInData?.session?.expires_at
    });
  }
}

createTestUser().catch(console.error);