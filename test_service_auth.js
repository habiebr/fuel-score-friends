// Test Edge Function authentication with service role client
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env.local') });

// Get environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'test123456';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Create Supabase client with service role
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

async function createServiceUser() {
  console.log('Creating user with service role...');

  try {
    // Create user with service role
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true // Automatically confirm the email
    });

    if (createError) {
      console.error('Failed to create user:', createError);
      return null;
    }

    console.log('User created successfully:', {
      id: userData.user.id,
      email: userData.user.email,
      confirmed: userData.user.confirmed_at
    });

    return userData.user;
  } catch (error) {
    console.error('Service role operation failed:', error);
    return null;
  }
}

async function createTestSession() {
  // Create a regular Supabase client for getting a session
  const supabase = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

  try {
    // Try to sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    if (signInError) {
      console.error('Failed to sign in:', signInError);
      return null;
    }

    console.log('Successfully got session token');
    return signInData.session;
  } catch (error) {
    console.error('Session creation failed:', error);
    return null;
  }
}

async function runTests() {
  try {
    // Create user with service role
    const user = await createServiceUser();
    if (!user) {
      throw new Error('Failed to create test user');
    }

    // Get a session for the user
    const session = await createTestSession();
    if (!session) {
      throw new Error('Failed to create session');
    }

    // Test the verify-auth function
    console.log('\nTesting verify-auth function...');
    
    const { data, error } = await supabaseAdmin.functions.invoke('verify-auth', {
      body: { admin_key: process.env.ADMIN_FORCE_SYNC_KEY },
      headers: { Authorization: `Bearer ${session.access_token}` }
    });

    if (error) {
      console.error('Verify auth test failed:', error);
    } else {
      console.log('Verify auth test succeeded:', data);
    }

  } catch (error) {
    console.error('Test suite failed:', error);
  }
}

runTests().catch(console.error);