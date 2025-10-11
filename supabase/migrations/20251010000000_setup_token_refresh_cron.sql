-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to refresh tokens
CREATE OR REPLACE FUNCTION refresh_google_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/refresh-all-google-tokens',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'batch_size', 50,
      'threshold_minutes', 30
    )
  );
END;
$$;

-- Schedule the refresh to run every 15 minutes
SELECT cron.schedule(
  'refresh-google-tokens',  -- unique job name
  '*/15 * * * *',          -- every 15 minutes
  'SELECT refresh_google_tokens()'
);
