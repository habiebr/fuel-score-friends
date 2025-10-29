-- Check Token Refresh Health for All Users
-- Run this to verify tokens are being refreshed properly

-- 1. Overall Token Health Summary
SELECT 
  '=== TOKEN HEALTH SUMMARY ===' as check,
  COUNT(*) as total_tokens,
  COUNT(CASE WHEN is_active THEN 1 END) as active_tokens,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as valid_tokens,
  COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_tokens,
  COUNT(CASE WHEN expires_at <= NOW() + INTERVAL '15 minutes' THEN 1 END) as expiring_soon
FROM google_tokens;

-- 2. Detailed Token Status Per User
SELECT 
  '=== PER USER STATUS ===' as check,
  gt.user_id,
  u.email,
  gt.is_active,
  gt.expires_at,
  gt.created_at,
  gt.updated_at,
  EXTRACT(EPOCH FROM (gt.expires_at - NOW()))/60 as minutes_until_expiry,
  CASE 
    WHEN gt.expires_at > NOW() + INTERVAL '30 minutes' THEN '✅ Healthy'
    WHEN gt.expires_at > NOW() THEN '⚠️ Expiring Soon'
    ELSE '❌ Expired'
  END as status,
  CASE
    WHEN gt.updated_at > NOW() - INTERVAL '1 hour' THEN '✅ Recently Refreshed'
    WHEN gt.updated_at > NOW() - INTERVAL '24 hours' THEN '⚠️ Not Refreshed Recently'
    ELSE '❌ Very Stale'
  END as refresh_status
FROM google_tokens gt
LEFT JOIN auth.users u ON u.id = gt.user_id
ORDER BY gt.expires_at ASC;

-- 3. Check if Token Refresh Cron is Running
SELECT 
  '=== CRON JOB STATUS ===' as check,
  j.jobname,
  j.schedule,
  j.active,
  r.start_time as last_run,
  r.status as last_status,
  EXTRACT(EPOCH FROM (NOW() - r.start_time))/60 as minutes_since_last_run
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT start_time, status 
  FROM cron.job_run_details 
  WHERE jobid = j.jobid 
  ORDER BY start_time DESC 
  LIMIT 1
) r ON true
WHERE j.jobname = 'refresh-google-tokens'
ORDER BY j.jobname;

-- 4. Recent Token Refresh Activity
SELECT 
  '=== RECENT REFRESH ATTEMPTS ===' as check,
  r.start_time,
  r.end_time,
  r.status,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time)) as duration_seconds,
  r.return_message
FROM cron.job j
JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname = 'refresh-google-tokens'
ORDER BY r.start_time DESC
LIMIT 10;

-- 5. Tokens that Failed to Refresh
SELECT 
  '=== PROBLEMATIC TOKENS ===' as check,
  gt.user_id,
  u.email,
  gt.expires_at,
  EXTRACT(EPOCH FROM (NOW() - gt.expires_at))/60 as minutes_expired,
  gt.updated_at as last_update,
  CASE 
    WHEN gt.expires_at < NOW() - INTERVAL '24 hours' THEN '🚨 CRITICAL - Expired > 24h'
    WHEN gt.expires_at < NOW() - INTERVAL '1 hour' THEN '⚠️ WARNING - Expired > 1h'
    ELSE '❌ Just Expired'
  END as severity
FROM google_tokens gt
LEFT JOIN auth.users u ON u.id = gt.user_id
WHERE gt.expires_at <= NOW()
OR gt.is_active = false
ORDER BY gt.expires_at ASC;

-- 6. Check if OAuth Credentials are Set
SELECT 
  '=== OAUTH CREDENTIALS ===' as check,
  key,
  CASE 
    WHEN key LIKE '%client_id%' THEN '✅ Client ID Present'
    WHEN key LIKE '%client_secret%' THEN '✅ Client Secret Present'
    ELSE key
  END as credential,
  created_at,
  updated_at
FROM app_settings
WHERE key LIKE '%google%'
ORDER BY key;

-- 7. Refresh Rate Analysis
SELECT 
  '=== REFRESH STATISTICS ===' as check,
  COUNT(*) as total_refresh_runs,
  COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(100.0 * COUNT(CASE WHEN status = 'succeeded' THEN 1 END) / COUNT(*), 2) as success_rate_pct,
  MIN(start_time) as first_run,
  MAX(start_time) as last_run
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'refresh-google-tokens')
AND start_time > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- EXPECTED RESULTS:
-- 
-- ✅ All tokens have expires_at > NOW()
-- ✅ Cron job runs every 15 minutes
-- ✅ Recent runs all succeeded
-- ✅ No tokens expired > 1 hour
-- ✅ OAuth credentials present
-- ✅ Success rate > 95%
-- 
-- If any issues found, see remediation steps below
-- ============================================================================

-- REMEDIATION:
-- 
-- Issue: Tokens expired
-- Fix: They will auto-refresh on next cron run (every 15 min)
--      OR users can manually reconnect on app-integrations page
-- 
-- Issue: Cron not running
-- Fix: Check if cron job is active, re-enable if needed
-- 
-- Issue: OAuth credentials missing
-- Fix: Add to app_settings table or environment variables
-- 
-- Issue: High failure rate
-- Fix: Check cron logs for error messages, may need to update refresh logic

