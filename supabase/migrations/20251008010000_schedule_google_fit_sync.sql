-- Ensure cron and http extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove the previous version of the daily sync job if it exists
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  SELECT jobid
    INTO existing_job_id
    FROM cron.job
   WHERE jobname = 'sync-google-fit-daily';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

-- Schedule the daily Google Fit sync to run at 01:15 UTC
SELECT cron.schedule(
  'sync-google-fit-daily',
  '15 1 * * *',
  $$
    SELECT
      net.http_post(
        url := 'https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/force-sync-all-users',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'admin_key', coalesce(current_setting('app.settings.admin_force_sync_key', true), ''),
          'days', 30
        )
      ) AS request_id;
  $$
);
