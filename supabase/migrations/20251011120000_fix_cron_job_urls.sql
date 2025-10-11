-- Fix hardcoded Supabase URLs in cron jobs
-- Update to correct project URL: eecdbddpzwedficnpenm

-- First, get all existing cron jobs to see what needs updating
DO $$
DECLARE
  job_record RECORD;
BEGIN
  -- List all cron jobs for reference
  RAISE NOTICE 'Current cron jobs:';
  FOR job_record IN 
    SELECT jobid, jobname, schedule, command 
    FROM cron.job 
    ORDER BY jobname
  LOOP
    RAISE NOTICE 'Job ID: %, Name: %, Schedule: %', job_record.jobid, job_record.jobname, job_record.schedule;
  END LOOP;
END $$;

-- Update the Google Fit daily sync job
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  -- Find existing job
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'sync-google-fit-daily';

  -- Remove old job if exists
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
    RAISE NOTICE 'Removed old sync-google-fit-daily job (ID: %)', existing_job_id;
  END IF;
END $$;

-- Recreate with correct URL
SELECT cron.schedule(
  'sync-google-fit-daily',
  '15 1 * * *', -- Daily at 01:15 UTC
  $$
    SELECT net.http_post(
      url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/sync-all-users-direct',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('daysBack', 30)
    ) AS request_id;
  $$
);

-- Update the token refresh job
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  -- Find existing job
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'refresh-expiring-google-tokens';

  -- Remove old job if exists
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
    RAISE NOTICE 'Removed old refresh-expiring-google-tokens job (ID: %)', existing_job_id;
  END IF;
END $$;

-- Recreate with correct URL
SELECT cron.schedule(
  'refresh-expiring-google-tokens',
  '*/30 * * * *', -- Every 30 minutes
  $$
    SELECT net.http_post(
      url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/refresh-expiring-google-tokens',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Update daily nutrition generation job if it exists
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  -- Find existing job
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'generate-daily-nutrition';

  -- Remove old job if exists
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
    RAISE NOTICE 'Removed old generate-daily-nutrition job (ID: %)', existing_job_id;
  END IF;
END $$;

-- Recreate with correct URL
SELECT cron.schedule(
  'generate-daily-nutrition',
  '0 0 * * *', -- Daily at midnight UTC
  $$
    SELECT net.http_post(
      url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/generate-daily-nutrition',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Log final state
DO $$
DECLARE
  job_record RECORD;
BEGIN
  RAISE NOTICE '=== Updated cron jobs ===';
  FOR job_record IN 
    SELECT jobid, jobname, schedule, command 
    FROM cron.job 
    ORDER BY jobname
  LOOP
    RAISE NOTICE 'Job: % | Schedule: % | ID: %', job_record.jobname, job_record.schedule, job_record.jobid;
  END LOOP;
END $$;
