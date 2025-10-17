-- Debug Recovery Widget
-- Run these queries step by step to find the issue

-- Step 1: Add the missing notes column (IMPORTANT - RUN THIS FIRST!)
ALTER TABLE public.training_notifications 
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '{}'::jsonb;

-- Verify it was added
SELECT 'Step 1: Column Added' as status, 
       column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'training_notifications' 
AND column_name = 'notes';

-- Step 2: Check if your workout was synced
SELECT 
  'Step 2: Recent Workouts' as status,
  activity_type,
  name,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (NOW() - end_time))/60 as minutes_ago,
  raw->>'distance' as distance
FROM google_fit_sessions
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
AND end_time > NOW() - INTERVAL '2 hours'
ORDER BY end_time DESC
LIMIT 5;

-- Step 3: Check if any notifications exist
SELECT 
  'Step 3: Notifications' as status,
  type,
  title,
  message,
  scheduled_for,
  activity_type,
  is_read,
  created_at
FROM training_notifications
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
ORDER BY created_at DESC
LIMIT 5;

-- Step 4: Check if cron has run recently
SELECT 
  'Step 4: Cron Status' as status,
  j.jobname,
  r.start_time,
  r.status,
  EXTRACT(EPOCH FROM (NOW() - r.start_time))/60 as minutes_ago
FROM cron.job j
JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname = 'sync-google-fit-frequent'
ORDER BY r.start_time DESC
LIMIT 3;

-- Step 5: Check if workout is within 30-minute window
SELECT 
  'Step 5: Detection Window' as status,
  activity_type,
  end_time,
  EXTRACT(EPOCH FROM (NOW() - end_time))/60 as minutes_ago,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - end_time))/60 < 30 
    THEN '✅ Within 30-min window'
    ELSE '❌ Outside window'
  END as detection_status
FROM google_fit_sessions
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
ORDER BY end_time DESC
LIMIT 1;

