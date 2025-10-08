-- Ensure required extensions exist for scheduling and HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule previous versions of the Google token refresh job if present
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  SELECT jobid
    INTO existing_job_id
    FROM cron.job
   WHERE jobname = 'refresh-google-fit-tokens';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

-- Schedule the Google Fit token refresh worker to run every 10 minutes
SELECT cron.schedule(
  'refresh-google-fit-tokens',
  '*/10 * * * *',
  $$
    SELECT
      net.http_post(
        url := 'https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/refresh-expiring-google-tokens',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.refresh_google_token_secret', true), ''),
          'X-Refresh-Secret', coalesce(current_setting('app.settings.refresh_google_token_secret', true), '')
        ),
        body := jsonb_build_object(
          'batch_size', 25,
          'threshold_minutes', 20
        )
      ) AS request_id;
  $$
);
