-- ============================================
-- AUTO-SYNC GOOGLE FIT - CRON JOB SETUP
-- ============================================
-- This script sets up an automatic background sync for Google Fit data
-- that runs every 5 minutes via pg_cron.
--
-- PREREQUISITES:
-- 1. Edge function 'auto-sync-google-fit' must be deployed
-- 2. CRON_SECRET must be set in Supabase secrets
-- 3. Project must be on Supabase Pro plan (cron requires Pro)
--
-- HOW TO RUN:
-- Option 1: Supabase Dashboard
--   1. Go to SQL Editor
--   2. Copy-paste this entire file
--   3. Click "Run"
--
-- Option 2: Supabase CLI
--   supabase db execute --file setup_auto_sync_cron.sql
--
-- ============================================

-- Step 1: Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Step 2: Schedule the cron job to run every 5 minutes
-- Cron syntax: */5 * * * * = Every 5 minutes
-- Alternative schedules:
--   */2 * * * * = Every 2 minutes (faster)
--   */10 * * * * = Every 10 minutes (slower)
SELECT cron.schedule(
  'auto-sync-google-fit-every-5-min',  -- Job name
  '*/5 * * * *',                        -- Schedule: Every 5 minutes
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

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if cron job was created successfully
SELECT jobid, jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'auto-sync-google-fit-every-5-min';

-- View recent cron job runs (last 10)
SELECT jobid, runid, job_pid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'auto-sync-google-fit-every-5-min'
)
ORDER BY start_time DESC
LIMIT 10;

-- ============================================
-- MANAGEMENT QUERIES
-- ============================================

-- To PAUSE the cron job (without deleting it):
-- UPDATE cron.job SET active = false WHERE jobname = 'auto-sync-google-fit-every-5-min';

-- To RESUME the cron job:
-- UPDATE cron.job SET active = true WHERE jobname = 'auto-sync-google-fit-every-5-min';

-- To DELETE the cron job:
-- SELECT cron.unschedule('auto-sync-google-fit-every-5-min');

-- To CHANGE the schedule (example: change to every 10 minutes):
-- SELECT cron.alter_job(
--   (SELECT jobid FROM cron.job WHERE jobname = 'auto-sync-google-fit-every-5-min'),
--   schedule := '*/10 * * * *'
-- );

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- Check if extensions are enabled:
-- SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'http');

-- View all cron jobs:
-- SELECT * FROM cron.job;

-- View failed job runs:
-- SELECT * FROM cron.job_run_details WHERE status = 'failed' ORDER BY start_time DESC LIMIT 10;

-- Manually trigger the edge function to test:
-- SELECT net.http_post(
--   url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/auto-sync-google-fit',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer cc31eefcfdb9545d51cd6784229026eb559e8a8b4a05b77d4282fd3922bb6e5f'
--   )
-- );

-- ============================================
-- SUCCESS!
-- ============================================
-- If you see a row returned from the verification query above,
-- the cron job is set up and will run every 5 minutes automatically.
--
-- Monitor the edge function logs in:
-- Supabase Dashboard > Edge Functions > auto-sync-google-fit > Logs
--
-- Expected output every 5 minutes:
-- 🔄 Starting auto-sync for all active Google Fit users...
-- Found X users with Google Fit tokens
-- ✅ Synced user abcd1234...: 8500 steps, 350 cal
-- 🎯 Auto-sync complete: X synced, Y skipped, Z errors
