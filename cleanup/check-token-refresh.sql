-- Check Token Refresh System
-- Run this after reconnecting Google Fit

-- 1. Check if token refresh cron is running
SELECT 
  '=== TOKEN REFRESH CRON ===' as check,
  j.jobname,
  j.schedule,
  j.active,
  r.start_time as last_run,
  r.status as last_status
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT start_time, status 
  FROM cron.job_run_details 
  WHERE jobid = j.jobid 
  ORDER BY start_time DESC 
  LIMIT 1
) r ON true
WHERE j.jobname LIKE '%token%'
ORDER BY j.jobname;

-- Expected: refresh-google-tokens active, recent successful runs

-- 2. Check current token status
SELECT 
  '=== CURRENT TOKEN ===' as check,
  user_id,
  is_active,
  expires_at,
  created_at,
  NOW() as current_time,
  expires_at - NOW() as time_until_expiry,
  CASE 
    WHEN expires_at > NOW() THEN '✅ Valid'
    WHEN expires_at > NOW() - INTERVAL '1 hour' THEN '⚠️ Just Expired'
    ELSE '❌ Long Expired'
  END as status
FROM google_tokens
ORDER BY created_at DESC
LIMIT 3;

-- 3. Check if app_settings has OAuth credentials
SELECT 
  '=== OAUTH CREDENTIALS ===' as check,
  key,
  CASE 
    WHEN key LIKE '%client_id%' THEN '✅ Has Client ID'
    WHEN key LIKE '%client_secret%' THEN '✅ Has Client Secret'
    ELSE key
  END as credential_type,
  created_at
FROM app_settings
WHERE key LIKE '%google%'
ORDER BY key;

-- Expected: google_oauth_client_id and google_oauth_client_secret present

-- 4. Check recent token refresh attempts
SELECT 
  '=== RECENT REFRESH ATTEMPTS ===' as check,
  r.start_time,
  r.status,
  r.return_message,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time)) as duration_seconds
FROM cron.job j
JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname = 'refresh-google-tokens'
ORDER BY r.start_time DESC
LIMIT 5;

-- This will show if refresh has been working

