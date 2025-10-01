-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily nutrition generation to run every day at 6 AM UTC
SELECT cron.schedule(
  'generate-daily-nutrition',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/generate-daily-nutrition',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job;