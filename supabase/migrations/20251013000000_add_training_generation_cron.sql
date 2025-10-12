-- Create weekly training plan generation cron job
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  -- Find existing job
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'generate-weekly-training';

  -- Remove old job if exists
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
    RAISE NOTICE 'Removed old generate-weekly-training job (ID: %)', existing_job_id;
  END IF;
END $$;

-- Schedule generation every Sunday at midnight UTC
SELECT cron.schedule(
  'generate-weekly-training',
  '0 0 * * 0', -- At 00:00 on Sunday
  $$
    SELECT net.http_post(
      url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/generate-training-activities',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);