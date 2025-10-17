-- Clean up duplicate and broken token refresh cron job
-- Date: 2025-10-17
-- Purpose: Remove the broken refresh-expiring-google-tokens cron that calls an empty function
--          Keep the working refresh-google-tokens cron that calls refresh-all-google-tokens

-- Remove the broken duplicate cron job
DO $$
DECLARE
  broken_job_id integer;
BEGIN
  -- Find the broken job
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
  -- Find the working job
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

-- Add comment
COMMENT ON EXTENSION pg_cron IS 'Token refresh cron cleaned up on 2025-10-17: Removed duplicate broken job, kept working job';

