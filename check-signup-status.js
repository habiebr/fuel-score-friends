#!/usr/bin/env node
// Check current handle_new_user function in database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkDatabase() {
  console.log('🔍 Checking database configuration...\n');

  // Check if profiles table exists and has timezone column
  console.log('1. Checking profiles table structure:');
  const { data: columns, error: colError } = await supabase
    .from('profiles')
    .select('*')
    .limit(0);
  
  if (colError) {
    console.error('❌ Error checking profiles table:', colError);
  } else {
    console.log('✅ Profiles table exists');
  }

  // Try to create a test user profile directly
  console.log('\n2. Testing profile creation with test data:');
  const testUserId = '00000000-0000-0000-0000-000000000001';
  
  try {
    // First, delete test profile if exists
    await supabase.from('profiles').delete().eq('user_id', testUserId);
    
    // Try to insert
    const { data: insertData, error: insertError } = await supabase
      .from('profiles')
      .insert({
        user_id: testUserId,
        display_name: 'Test User',
        timezone: 'UTC'
      })
      .select();

    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      console.log('\nPossible issues:');
      console.log('- RLS policies may be blocking the insert');
      console.log('- Timezone column may have NOT NULL constraint without default');
      console.log('- Trigger validation may be failing');
    } else {
      console.log('✅ Profile insert successful:', insertData);
      
      // Clean up
      await supabase.from('profiles').delete().eq('user_id', testUserId);
    }
  } catch (err) {
    console.error('❌ Exception during test:', err);
  }

  // Check current function definition
  console.log('\n3. Checking if handle_new_user function exists:');
  const { data: funcData, error: funcError } = await supabase.rpc('pg_get_functiondef', {
    funcoid: 'public.handle_new_user'::any
  }).single();

  if (funcError) {
    console.log('ℹ️  Cannot retrieve function definition via RPC');
    console.log('   This is normal - requires direct database access');
  } else {
    console.log('Function definition:', funcData);
  }

  console.log('\n4. Testing auth signup flow:');
  console.log('   You can test by trying to sign up at: https://app.nutrisync.id/auth');
  
  console.log('\n📋 Next Steps:');
  console.log('1. Try signing up with a test email');
  console.log('2. Share the exact error message you see');
  console.log('3. Check Supabase logs at:');
  console.log('   https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/logs/explorer');
}

checkDatabase();
