-- Consolidate Google Fit token refresh schedulers into a single pg_cron job
-- Ensures pg_cron/pg_net exist
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule any previous token refresh jobs by known names
DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN SELECT jobid, jobname FROM cron.job WHERE jobname IN (
    'refresh-google-fit-tokens',
    'refresh_expiring_google_tokens',
    'google_token_refresh_worker'
  ) LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END
$$;

-- Create a single canonical job: every 15 minutes with reasonable batch size
SELECT cron.schedule(
  'refresh-google-fit-tokens',
  '*/15 * * * *',
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
          'batch_size', 50,
          'threshold_minutes', 25
        )
      ) AS request_id;
  $$
);



