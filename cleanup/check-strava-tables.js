// Check if Strava tables exist in database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkStravaTables() {
  console.log('Checking Strava tables...\n');

  // Check strava_tokens table
  console.log('1. Checking strava_tokens table...');
  const { data: tokens, error: tokensError } = await supabase
    .from('strava_tokens')
    .select('*')
    .limit(1);

  if (tokensError) {
    console.log('❌ strava_tokens error:', tokensError.message);
  } else {
    console.log('✅ strava_tokens exists, rows:', tokens?.length || 0);
  }

  // Check strava_activities table
  console.log('\n2. Checking strava_activities table...');
  const { data: activities, error: activitiesError } = await supabase
    .from('strava_activities')
    .select('*')
    .limit(1);

  if (activitiesError) {
    console.log('❌ strava_activities error:', activitiesError.message);
  } else {
    console.log('✅ strava_activities exists, rows:', activities?.length || 0);
  }

  // Check strava_webhook_subscriptions table
  console.log('\n3. Checking strava_webhook_subscriptions table...');
  const { data: webhooks, error: webhooksError } = await supabase
    .from('strava_webhook_subscriptions')
    .select('*')
    .limit(1);

  if (webhooksError) {
    console.log('❌ strava_webhook_subscriptions error:', webhooksError.message);
  } else {
    console.log('✅ strava_webhook_subscriptions exists, rows:', webhooks?.length || 0);
  }

  // Check strava_webhook_events table
  console.log('\n4. Checking strava_webhook_events table...');
  const { data: events, error: eventsError } = await supabase
    .from('strava_webhook_events')
    .select('*')
    .limit(1);

  if (eventsError) {
    console.log('❌ strava_webhook_events error:', eventsError.message);
  } else {
    console.log('✅ strava_webhook_events exists, rows:', events?.length || 0);
  }

  console.log('\n=== Summary ===');
  const allGood = !tokensError && !activitiesError && !webhooksError && !eventsError;
  if (allGood) {
    console.log('✅ All Strava tables exist!');
  } else {
    console.log('❌ Some tables are missing. Run the migration:');
    console.log('   supabase/migrations/20251011084938_add_strava_integration.sql');
  }
}

checkStravaTables();
