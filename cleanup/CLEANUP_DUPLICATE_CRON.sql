-- ============================================================================
-- CLEANUP DUPLICATE CRON JOBS
-- Remove old/duplicate jobs that are no longer needed
-- ============================================================================

-- Remove duplicate token refresh job (jobid 8)
DO $$
DECLARE
  duplicate_token_job_id integer;
BEGIN
  SELECT jobid INTO duplicate_token_job_id
  FROM cron.job
  WHERE jobname = 'refresh-google-fit-tokens';

  IF duplicate_token_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(duplicate_token_job_id);
    RAISE NOTICE '✅ Removed duplicate: refresh-google-fit-tokens (ID: %)', duplicate_token_job_id;
  ELSE
    RAISE NOTICE '⚠️  Job already removed: refresh-google-fit-tokens';
  END IF;
END $$;

-- Remove old 5-minute sync job (jobid 10)
DO $$
DECLARE
  old_sync_job_id integer;
BEGIN
  SELECT jobid INTO old_sync_job_id
  FROM cron.job
  WHERE jobname = 'sync-all-users-every-5-min';

  IF old_sync_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(old_sync_job_id);
    RAISE NOTICE '✅ Removed old job: sync-all-users-every-5-min (ID: %)', old_sync_job_id;
  ELSE
    RAISE NOTICE '⚠️  Job already removed: sync-all-users-every-5-min';
  END IF;
END $$;

-- Verify only the correct jobs remain
DO $$
DECLARE
  job_record RECORD;
  job_count integer := 0;
BEGIN
  RAISE NOTICE '=== Remaining Cron Jobs ===';
  
  FOR job_record IN 
    SELECT jobid, jobname, schedule
    FROM cron.job 
    WHERE jobname LIKE '%sync%' OR jobname LIKE '%token%'
    ORDER BY jobname
  LOOP
    job_count := job_count + 1;
    RAISE NOTICE 'Job %: % (ID: %) | Schedule: %', 
      job_count, job_record.jobname, job_record.jobid, job_record.schedule;
  END LOOP;
  
  RAISE NOTICE 'Total jobs: %', job_count;
  
  IF job_count = 3 THEN
    RAISE NOTICE '✅ Perfect! Exactly 3 jobs remain.';
  ELSE
    RAISE NOTICE '⚠️  Expected 3 jobs, found %', job_count;
  END IF;
END $$;

-- Final verification query
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN jobname = 'refresh-google-tokens' THEN '✅ Token refresh (every 15 min)'
    WHEN jobname = 'sync-google-fit-frequent' THEN '✅ Quick sync (every 10 min)'
    WHEN jobname = 'sync-google-fit-full' THEN '✅ Full sync (daily at 01:15 UTC)'
    ELSE '❌ UNEXPECTED JOB - Should be removed'
  END as description
FROM cron.job
WHERE jobname LIKE '%sync%' OR jobname LIKE '%token%'
ORDER BY jobname;

-- ============================================================================
-- Expected Result: You should see ONLY 3 jobs:
-- 1. refresh-google-tokens        | */15 * * * * | true
-- 2. sync-google-fit-frequent     | */10 * * * * | true
-- 3. sync-google-fit-full         | 15 1 * * *   | true
-- ============================================================================

