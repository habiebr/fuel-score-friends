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

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAuth() {
  console.log('Testing Authentication Methods...\n');

  // First, try to get a valid session token by signing in
  console.log('Attempting to sign in for a valid session token...');
  const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'test123'
  });

  if (signInError) {
    console.error('Failed to get session token:', signInError);
  } else {
    console.log('Got session token:', session?.access_token ? 'Yes' : 'No');
  }

  // 1. Test with admin key and session token
  console.log('\n1. Testing with admin key and session token:');
  try {
    const { data: adminData, error: adminError } = await supabase.functions.invoke('test-auth', {
      body: { admin_key: ADMIN_KEY },
      headers: session?.access_token ? {
        'Authorization': `Bearer ${session.access_token}`
      } : undefined
    });

    if (adminError) {
      console.error('Admin key test failed:', {
        status: adminError.context?.status,
        statusText: adminError.context?.statusText,
        message: adminError.message,
        responseBody: await adminError.context?.text()
      });
    } else {
      console.log('Admin key test succeeded:', adminData);
    }
  } catch (e) {
    console.error('Admin key test exception:', e);
  }

  // 2. Test without any auth
  console.log('\n2. Testing without auth:');
  try {
    const { data: noAuthData, error: noAuthError } = await supabase.functions.invoke('test-auth', {
      body: {}
    });

    if (noAuthError) {
      console.log('No auth test (expected failure):', {
        status: noAuthError.context?.status,
        statusText: noAuthError.context?.statusText,
        message: noAuthError.message,
        responseBody: await noAuthError.context?.text()
      });
    } else {
      console.log('No auth test result:', noAuthData);
    }
  } catch (e) {
    console.error('No auth test exception:', e);
  }

  // 3. Test with session token only
  console.log('\n3. Testing with session token only:');
  try {
    const { data: sessionData, error: sessionError } = await supabase.functions.invoke('test-auth', {
      body: {},
      headers: session?.access_token ? {
        'Authorization': `Bearer ${session.access_token}`
      } : undefined
    });

    if (sessionError) {
      console.log('Session token test result:', {
        status: sessionError.context?.status,
        statusText: sessionError.context?.statusText,
        message: sessionError.message,
        responseBody: await sessionError.context?.text()
      });
    } else {
      console.log('Session token test succeeded:', sessionData);
    }
  } catch (e) {
    console.error('Anon key test exception:', e);
  }
}

testAuth().catch(console.error);