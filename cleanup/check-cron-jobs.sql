-- Check if auto-sync cron job exists
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname LIKE '%auto-sync%' OR jobname LIKE '%google%';
