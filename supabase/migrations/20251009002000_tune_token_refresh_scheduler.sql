-- Tune token refresh scheduler cadence and parameters
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  job_id integer;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'refresh-google-fit-tokens';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'refresh-google-fit-tokens',
  '*/20 * * * *',
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
          'batch_size', 75,
          'threshold_minutes', 30
        )
      ) AS request_id;
  $$
);


