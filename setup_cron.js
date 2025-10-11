#!/usr/bin/env node

/**
 * Setup cron job for auto-sync Google Fit via Supabase CLI
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDEyNDA2NiwiZXhwIjoyMDM5NzAwMDY2fQ.TUjcOVZaHY5maSI3YbsrQOBKYVfz75qDiNvvhyZjUEw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupCronJob() {
  console.log('🔧 Setting up cron job for auto-sync Google Fit...\n');

  try {
    // Step 1: Enable extensions
    console.log('1️⃣ Enabling pg_cron extension...');
    const { error: cronError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE EXTENSION IF NOT EXISTS pg_cron;'
    });

    if (cronError && !cronError.message.includes('already exists')) {
      console.error('⚠️  pg_cron extension error:', cronError.message);
    } else {
      console.log('✅ pg_cron extension enabled');
    }

    // Step 2: Schedule the cron job
    console.log('\n2️⃣ Scheduling cron job (every 5 minutes)...');
    
    const cronSQL = `
      SELECT cron.schedule(
        'auto-sync-google-fit-every-5-min',
        '*/5 * * * *',
        $$
        SELECT net.http_post(
          url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/auto-sync-google-fit',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer cc31eefcfdb9545d51cd6784229026eb559e8a8b4a05b77d4282fd3922bb6e5f'
          )
        ) AS request_id;
        $$
      );
    `;

    const { data: scheduleData, error: scheduleError } = await supabase.rpc('exec_sql', {
      sql: cronSQL
    });

    if (scheduleError) {
      if (scheduleError.message.includes('already exists')) {
        console.log('⚠️  Cron job already exists, updating...');
        
        // Unschedule and reschedule
        await supabase.rpc('exec_sql', {
          sql: "SELECT cron.unschedule('auto-sync-google-fit-every-5-min');"
        });
        
        const { error: rescheduleError } = await supabase.rpc('exec_sql', {
          sql: cronSQL
        });
        
        if (rescheduleError) {
          throw rescheduleError;
        }
        console.log('✅ Cron job updated successfully');
      } else {
        throw scheduleError;
      }
    } else {
      console.log('✅ Cron job scheduled successfully');
    }

    // Step 3: Verify the cron job
    console.log('\n3️⃣ Verifying cron job...');
    const { data: jobs, error: verifyError } = await supabase
      .from('cron.job')
      .select('*')
      .eq('jobname', 'auto-sync-google-fit-every-5-min');

    if (verifyError) {
      console.log('⚠️  Could not verify (this is normal if pg_cron schema is not exposed)');
    } else if (jobs && jobs.length > 0) {
      console.log('✅ Cron job verified:', jobs[0]);
    }

    console.log('\n🎉 Setup complete!');
    console.log('\n📊 Next steps:');
    console.log('   1. Wait 5-10 minutes for first cron run');
    console.log('   2. Check logs: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/functions/auto-sync-google-fit');
    console.log('   3. Look for: "🔄 Starting auto-sync for all active Google Fit users..."');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Alternative: Run setup_auto_sync_cron.sql in Supabase Dashboard SQL Editor');
    process.exit(1);
  }
}

setupCronJob();
