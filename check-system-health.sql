-- ============================================================================
-- SYSTEM HEALTH CHECK - Recovery Nutrition
-- Run this to verify everything is working before testing
-- ============================================================================

-- 1. Check Cron Jobs Status
SELECT 
  '=== CRON JOBS ===' as section,
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '✅ Active'
    ELSE '❌ Inactive'
  END as status
FROM cron.job
WHERE jobname LIKE '%sync%' OR jobname LIKE '%token%'
ORDER BY jobname;

-- 2. Check Recent Cron Runs (Last hour)
SELECT 
  '=== RECENT CRON RUNS ===' as section,
  j.jobname,
  r.start_time,
  r.status,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time)) as duration_seconds
FROM cron.job j
LEFT JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname IN ('sync-google-fit-frequent', 'sync-google-fit-full')
AND r.start_time > NOW() - INTERVAL '1 hour'
ORDER BY r.start_time DESC
LIMIT 10;

-- 3. Check Active Google Fit Users
SELECT 
  '=== ACTIVE USERS ===' as section,
  COUNT(*) as total_active_users,
  COUNT(DISTINCT user_id) as unique_users
FROM google_tokens
WHERE is_active = true;

-- 4. Check Recent Google Fit Sessions (Today)
SELECT 
  '=== TODAY\'S WORKOUTS ===' as section,
  COUNT(*) as total_workouts,
  COUNT(DISTINCT user_id) as users_with_workouts,
  MIN(end_time) as earliest_workout,
  MAX(end_time) as latest_workout
FROM google_fit_sessions
WHERE end_time > CURRENT_DATE;

-- 5. Check Recent Workouts Details
SELECT 
  '=== RECENT WORKOUT DETAILS ===' as section,
  user_id,
  activity_type,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (NOW() - end_time))/60 as minutes_since_end,
  duration_minutes,
  distance_km,
  calories_burned
FROM google_fit_sessions
WHERE end_time > NOW() - INTERVAL '2 hours'
ORDER BY end_time DESC
LIMIT 5;

-- 6. Check Recovery Notifications (Today)
SELECT 
  '=== RECOVERY NOTIFICATIONS ===' as section,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN is_read THEN 1 END) as read_count,
  COUNT(CASE WHEN NOT is_read THEN 1 END) as unread_count
FROM training_notifications
WHERE type = 'recovery'
AND scheduled_for > CURRENT_DATE;

-- 7. Check Recent Notifications Details
SELECT 
  '=== NOTIFICATION DETAILS ===' as section,
  user_id,
  title,
  scheduled_for,
  is_read,
  notes->>'workout_type' as workout_type,
  notes->>'minutes_since_end' as detection_delay_minutes
FROM training_notifications
WHERE type = 'recovery'
AND scheduled_for > NOW() - INTERVAL '2 hours'
ORDER BY scheduled_for DESC
LIMIT 5;

-- 8. System Health Summary
SELECT 
  '=== SYSTEM HEALTH SUMMARY ===' as section,
  CASE 
    WHEN (SELECT COUNT(*) FROM cron.job WHERE jobname = 'sync-google-fit-frequent' AND active) > 0 
    THEN '✅ Frequent sync active'
    ELSE '❌ Frequent sync missing'
  END as frequent_sync_status,
  CASE 
    WHEN (SELECT COUNT(*) FROM google_tokens WHERE is_active = true) > 0 
    THEN '✅ Users have active tokens'
    ELSE '⚠️ No active users'
  END as token_status,
  CASE 
    WHEN (SELECT COUNT(*) FROM cron.job_run_details r 
          JOIN cron.job j ON j.jobid = r.jobid 
          WHERE j.jobname = 'sync-google-fit-frequent' 
          AND r.start_time > NOW() - INTERVAL '15 minutes') > 0 
    THEN '✅ Cron ran recently'
    ELSE '⚠️ No recent cron runs'
  END as cron_health,
  CASE 
    WHEN (SELECT COUNT(*) FROM google_fit_sessions WHERE end_time > NOW() - INTERVAL '30 minutes') > 0 
    THEN '🏃 Recent workout detected'
    ELSE '💤 No recent workouts'
  END as recent_activity;

-- ============================================================================
-- EXPECTED RESULTS:
-- 
-- ✅ 3 active cron jobs (token refresh, frequent sync, full sync)
-- ✅ Recent cron runs in last hour
-- ✅ At least 1 active user with Google Fit token
-- ✅ Recent workouts appear if you exercised today
-- ✅ Notifications created for workouts < 30 min old
-- 
-- If any checks fail, review the specific section output above
-- ============================================================================

