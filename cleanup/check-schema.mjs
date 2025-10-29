// Check database schema for profile tables
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Checking profile table schema...\n');

  // Try profiles table
  console.log('1️⃣  Checking "profiles" table:');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (profilesError) {
    console.log(`   ❌ Error: ${profilesError.message}`);
  } else if (profiles && profiles.length > 0) {
    console.log('   ✅ Table exists! Columns:', Object.keys(profiles[0]));
  } else {
    console.log('   ⚠️  Table exists but empty');
  }

  // Try user_profiles table  
  console.log('\n2️⃣  Checking "user_profiles" table:');
  const { data: userProfiles, error: userProfilesError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);

  if (userProfilesError) {
    console.log(`   ❌ Error: ${userProfilesError.message}`);
  } else if (userProfiles && userProfiles.length > 0) {
    console.log('   ✅ Table exists! Columns:', Object.keys(userProfiles[0]));
  } else {
    console.log('   ⚠️  Table exists but empty');
  }

  // Find Muhammad Habieb's profile
  console.log('\n3️⃣  Finding Muhammad Habieb\'s profile:');
  const userId = '8c2006e2-5512-4865-ba05-618cf2161ec1';

  // Try profiles
  const { data: p1 } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (p1) {
    console.log('   Found in "profiles":', p1);
  } else {
    console.log('   Not found in "profiles"');
  }

  // Try user_profiles
  const { data: p2 } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (p2) {
    console.log('   Found in "user_profiles":', p2);
  } else {
    console.log('   Not found in "user_profiles"');
  }
}

checkSchema().catch(console.error);
