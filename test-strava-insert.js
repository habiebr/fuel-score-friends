// Test inserting Strava token directly
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testInsert() {
  console.log('Testing Strava token insert...\n');

  const testData = {
    user_id: '8c2006e2-5512-4865-ba05-618cf2161ec1', // Your user ID from the JWT
    athlete_id: 12345678, // Test athlete ID
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    scope: 'read,activity:read_all',
  };

  console.log('Attempting to insert:', testData);

  const { data, error } = await supabase
    .from('strava_tokens')
    .upsert(testData, {
      onConflict: 'user_id'
    });

  if (error) {
    console.log('\n❌ Insert failed:');
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    console.log('Error details:', error.details);
    console.log('Error hint:', error.hint);
  } else {
    console.log('\n✅ Insert successful!');
    console.log('Data:', data);
    
    // Verify it was inserted
    const { data: checkData, error: checkError } = await supabase
      .from('strava_tokens')
      .select('*')
      .eq('user_id', testData.user_id)
      .single();

    if (checkError) {
      console.log('Check error:', checkError.message);
    } else {
      console.log('Verified in database:', checkData);
    }
  }
}

testInsert();
