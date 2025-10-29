-- ============================================================================
-- HYBRID RECOVERY NUTRITION MIGRATIONS
-- Apply these in Supabase Dashboard → SQL Editor
-- URL: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Clean Up Token Refresh
-- ============================================================================

-- Remove the broken duplicate cron job
DO $$
DECLARE
  broken_job_id integer;
BEGIN
  SELECT jobid INTO broken_job_id
  FROM cron.job
  WHERE jobname = 'refresh-expiring-google-tokens';

  IF broken_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(broken_job_id);
    RAISE NOTICE 'Removed broken cron job: refresh-expiring-google-tokens (ID: %)', broken_job_id;
  ELSE
    RAISE NOTICE 'Broken cron job not found (may have been removed already)';
  END IF;
END $$;

-- Verify the working cron job is still active
DO $$
DECLARE
  working_job_id integer;
  working_job_schedule text;
BEGIN
  SELECT jobid, schedule INTO working_job_id, working_job_schedule
  FROM cron.job
  WHERE jobname = 'refresh-google-tokens';

  IF working_job_id IS NOT NULL THEN
    RAISE NOTICE '✅ Working cron job active: refresh-google-tokens (ID: %, Schedule: %)', working_job_id, working_job_schedule;
  ELSE
    RAISE NOTICE '⚠️ WARNING: Working cron job not found! May need to recreate.';
  END IF;
END $$;

-- Log all active token-related cron jobs
DO $$
DECLARE
  job_record RECORD;
  job_count integer := 0;
BEGIN
  RAISE NOTICE '=== Active Token Refresh Jobs ===';
  
  FOR job_record IN 
    SELECT jobid, jobname, schedule, command 
    FROM cron.job 
    WHERE jobname LIKE '%token%' OR jobname LIKE '%refresh%'
    ORDER BY jobname
  LOOP
    job_count := job_count + 1;
    RAISE NOTICE 'Job %: % | Schedule: % | ID: %', job_count, job_record.jobname, job_record.schedule, job_record.jobid;
  END LOOP;
  
  IF job_count = 0 THEN
    RAISE NOTICE 'No token refresh jobs found';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION 2: Increase Sync Frequency
-- ============================================================================

-- Remove the existing daily sync job
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'sync-google-fit-daily';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
    RAISE NOTICE 'Removed old sync-google-fit-daily job (ID: %)', existing_job_id;
  END IF;
END $$;

-- Create frequent sync job for recent workout detection (every 10 minutes)
SELECT cron.schedule(
  'sync-google-fit-frequent',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/sync-all-users-direct',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'daysBack', 1
      )
    ) AS request_id;
  $$
);

-- Keep daily full sync for historical data (30 days)
SELECT cron.schedule(
  'sync-google-fit-full',
  '15 1 * * *',
  $$
    SELECT net.http_post(
      url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/sync-all-users-direct',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'daysBack', 30
      )
    ) AS request_id;
  $$
);

-- Log the updated jobs
DO $$
DECLARE
  job_record RECORD;
BEGIN
  RAISE NOTICE '=== Updated Google Fit Sync Jobs ===';
  
  FOR job_record IN 
    SELECT jobid, jobname, schedule, command 
    FROM cron.job 
    WHERE jobname LIKE '%sync-google-fit%'
    ORDER BY jobname
  LOOP
    RAISE NOTICE 'Job: % | Schedule: % | ID: %', job_record.jobname, job_record.schedule, job_record.jobid;
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION QUERY
-- Run this after applying both migrations to verify everything worked:
-- ============================================================================

SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN jobname = 'refresh-google-tokens' THEN '✅ Token refresh (every 15 min)'
    WHEN jobname = 'sync-google-fit-frequent' THEN '✅ Quick sync (every 10 min)'
    WHEN jobname = 'sync-google-fit-full' THEN '✅ Full sync (daily at 01:15 UTC)'
    ELSE '⚠️ Unknown job'
  END as description
FROM cron.job
WHERE jobname LIKE '%sync%' OR jobname LIKE '%token%'
ORDER BY jobname;

-- ============================================================================
-- Expected Result: You should see 3 jobs:
-- 1. refresh-google-tokens        | */15 * * * * | true
-- 2. sync-google-fit-frequent     | */10 * * * * | true
-- 3. sync-google-fit-full         | 15 1 * * *   | true
-- ============================================================================

