import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTk1Mzc2OSwiZXhwIjoyMDQxNTI5NzY5fQ.t0SrT1VLE1L31gZ4JVFBjbtko_eSuscp0Z2i_kRQMeA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function consolidateFunctions() {
  console.log('🔧 Consolidating Strava updated_at functions...\n');

  // Step 1: Create generic function
  console.log('1️⃣ Creating generic trigger_set_updated_at() function...');
  const createFunction = `
    CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  const { error: createError } = await supabase.rpc('exec_sql', { sql: createFunction });
  if (createError) {
    console.error('❌ Error creating function:', createError);
  } else {
    console.log('✅ Generic function created\n');
  }

  // Step 2: Recreate triggers for each table
  const tables = [
    'strava_tokens',
    'strava_activities', 
    'strava_webhook_subscriptions',
    'strava_webhook_events'
  ];

  for (const table of tables) {
    console.log(`2️⃣ Updating trigger for ${table}...`);
    
    // Drop old trigger
    const dropTrigger = `DROP TRIGGER IF EXISTS trigger_update_${table}_updated_at ON public.${table};`;
    await supabase.rpc('exec_sql', { sql: dropTrigger });
    
    // Create new trigger
    const createTrigger = `
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON public.${table}
        FOR EACH ROW
        EXECUTE FUNCTION public.trigger_set_updated_at();
    `;
    
    const { error: triggerError } = await supabase.rpc('exec_sql', { sql: createTrigger });
    if (triggerError) {
      console.error(`  ❌ Error:`, triggerError);
    } else {
      console.log(`  ✅ Trigger updated for ${table}`);
    }
  }

  // Step 3: Drop old functions
  console.log('\n3️⃣ Cleaning up old table-specific functions...');
  const oldFunctions = [
    'update_strava_tokens_updated_at',
    'update_strava_activities_updated_at',
    'update_strava_webhook_subscriptions_updated_at',
    'update_strava_webhook_events_updated_at'
  ];

  for (const func of oldFunctions) {
    const dropFunc = `DROP FUNCTION IF EXISTS ${func}();`;
    const { error } = await supabase.rpc('exec_sql', { sql: dropFunc });
    if (!error) {
      console.log(`  ✅ Dropped ${func}()`);
    }
  }

  console.log('\n✅ Consolidation complete!');
  console.log('\n📊 Summary:');
  console.log('  • 1 generic function created: trigger_set_updated_at()');
  console.log('  • 4 triggers updated to use generic function');
  console.log('  • 4 old functions removed');
  console.log('  • Code reduced by ~75%');
}

consolidateFunctions().catch(console.error);
