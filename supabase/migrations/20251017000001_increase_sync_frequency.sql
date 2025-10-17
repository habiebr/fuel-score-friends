-- Increase Google Fit sync frequency for instant recovery nutrition
-- Date: 2025-10-17
-- Purpose: Enable 10-minute sync for recent workout detection
--          Keep daily full sync for historical data

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
  '*/10 * * * *', -- Every 10 minutes
  $$
    SELECT net.http_post(
      url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/sync-all-users-direct',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'daysBack', 1  -- Only sync today (more efficient for frequent runs)
      )
    ) AS request_id;
  $$
);

-- Keep daily full sync for historical data (30 days)
SELECT cron.schedule(
  'sync-google-fit-full',
  '15 1 * * *', -- Daily at 01:15 UTC
  $$
    SELECT net.http_post(
      url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/sync-all-users-direct',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'daysBack', 30  -- Full 30-day sync
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

-- Add comment
COMMENT ON EXTENSION pg_cron IS 'Google Fit sync frequency increased to 10 minutes for instant recovery nutrition detection (2025-10-17)';

