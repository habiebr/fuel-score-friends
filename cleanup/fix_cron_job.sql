-- ============================================
-- FIX: Update Cron Job to Use Correct Sync Function
-- ============================================
-- Problem: Cron is calling old auto-sync-google-fit which doesn't
--          populate google_fit_data.sessions array
-- Solution: Switch to sync-all-users-direct which properly stores sessions
-- ============================================

-- Step 1: Remove the old cron job
SELECT cron.unschedule('auto-sync-google-fit-every-5-min');

-- Step 2: Create new cron job calling the correct function
SELECT cron.schedule(
  'sync-all-users-every-5-min',  -- New job name
  '*/5 * * * *',                  -- Every 5 minutes (same as before)
  $$
  SELECT net.http_post(
    url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/sync-all-users-direct',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer cc31eefcfdb9545d51cd6784229026eb559e8a8b4a05b77d4282fd3922bb6e5f'
    ),
    body := jsonb_build_object(
      'admin_key', 'force_sync_2025',
      'daysBack', 1  -- Only sync last day (faster, cron runs every 5 min anyway)
    )
  ) AS request_id;
  $$
);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check new cron job was created
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'sync-all-users-every-5-min';

-- Expected output:
-- jobname: sync-all-users-every-5-min
-- schedule: */5 * * * *
-- active: true
-- command: SELECT net.http_post...sync-all-users-direct...

-- Wait 5 minutes, then check if sessions are being populated:
-- SELECT date, jsonb_array_length(sessions) as session_count, sessions
-- FROM google_fit_data
-- WHERE date = CURRENT_DATE
-- ORDER BY date DESC LIMIT 5;

-- Expected: session_count > 0 for days with workouts!
