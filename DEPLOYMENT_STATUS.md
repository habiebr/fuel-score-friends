# 🚀 Deployment Status - Hybrid Recovery Nutrition

**Date:** October 17, 2025  
**Feature:** Hybrid Recovery Nutrition Detection

---

## ✅ Deployment Progress

### 1. Edge Function ✅ DEPLOYED
```
Function: sync-all-users-direct
Status: ✅ Deployed to eecdbddpzwedficnpenm
Dashboard: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/functions
```

**What was deployed:**
- Workout detection logic (< 30 min)
- Training notification creation
- Push notification integration
- Comprehensive logging

---

### 2. Frontend ✅ BUILT
```
Build Status: ✅ Success (3.62s)
Output: dist/
Size: 622.70 kB (gzipped: 166.46 kB)
Service Worker: ✅ Generated
```

**What was built:**
- Hybrid recovery detection useEffect
- Training notifications check
- Fresh sync with timeout
- 30-minute detection window

**Auto-Deploy:** Will deploy automatically when pushed to Git (Cloudflare Pages)

---

### 3. Database Migrations ⏳ MANUAL STEP REQUIRED

**Status:** ⚠️ Needs manual application via Supabase Dashboard

**Files to apply:**
1. `supabase/migrations/20251017000000_cleanup_duplicate_token_refresh.sql`
2. `supabase/migrations/20251017000001_increase_sync_frequency.sql`

---

## 📋 Manual Steps Required

### Step 1: Apply Database Migrations

Go to Supabase Dashboard → SQL Editor:
👉 https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql/new

**Migration 1: Token Cleanup**
```sql
-- Copy and paste content from:
-- supabase/migrations/20251017000000_cleanup_duplicate_token_refresh.sql

-- This will:
-- ✓ Remove broken refresh-expiring-google-tokens cron
-- ✓ Keep working refresh-google-tokens cron
-- ✓ Log all active jobs
```

**Migration 2: Sync Frequency**
```sql
-- Copy and paste content from:
-- supabase/migrations/20251017000001_increase_sync_frequency.sql

-- This will:
-- ✓ Create sync-google-fit-frequent (every 10 min)
-- ✓ Create sync-google-fit-full (daily)
-- ✓ Remove old sync-google-fit-daily
-- ✓ Log all sync jobs
```

---

### Step 2: Verify Cron Jobs

After applying migrations, run this query:

```sql
-- Check all active cron jobs
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname LIKE '%sync%' OR jobname LIKE '%token%'
ORDER BY jobname;
```

**Expected Results:**
```
refresh-google-tokens        | */15 * * * * | Active
sync-google-fit-frequent     | */10 * * * * | Active  ← NEW
sync-google-fit-full         | 15 1 * * *   | Active  ← NEW
```

---

### Step 3: Push Frontend to Git

```bash
# Commit changes
git add .
git commit -m "feat: hybrid recovery nutrition detection

- Add instant foreground detection (iOS: 3-5 sec)
- Add background detection (Android: 10 min)
- Push notifications for Android users
- Change detection window: 6 hours → 30 minutes
- Increase sync frequency: daily → every 10 min
- Clean up duplicate token refresh cron"

# Push to deploy
git push origin main
```

**Cloudflare Pages will automatically deploy** ✅

---

### Step 4: Test Backend Detection

Wait 10 minutes for the first cron run, then check:

```sql
-- Check if cron is running
SELECT *
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'sync-google-fit-frequent'
)
ORDER BY start_time DESC
LIMIT 5;

-- Check if notifications are being created
SELECT *
FROM training_notifications
WHERE type = 'recovery'
ORDER BY scheduled_for DESC
LIMIT 10;
```

---

## 🧪 Testing Instructions

### iOS Testing (Foreground Detection)

1. **Setup:**
   - Open app on iPhone (PWA)
   - Ensure Google Fit is connected
   - Close app completely

2. **Record Workout:**
   - Open Google Fit app
   - Record a workout (e.g., 10-minute run)
   - Wait for workout to finish and sync

3. **Test Detection:**
   - Wait 2-3 minutes
   - Open Fuel Score app
   - Check console logs (Safari Dev Tools)
   - **Expected:** Recovery widget appears within 5 seconds

4. **Verify:**
   - Widget shows workout name
   - Countdown timer shows ~27 minutes remaining
   - Can dismiss and won't reappear
   - Can log recovery meal

---

### Android Testing (Background Detection)

1. **Setup:**
   - Install PWA on Android device
   - Ensure Google Fit is connected
   - Grant push notification permission

2. **Record Workout:**
   - Open Google Fit app
   - Record a workout
   - Wait for workout to finish and sync

3. **Test Background Detection:**
   - Close Google Fit
   - Close Fuel Score app (completely)
   - Wait 10-15 minutes (for cron to run)
   - **Expected:** Push notification appears

4. **Test Foreground Detection:**
   - Open Fuel Score app
   - **Expected:** Recovery widget visible immediately (from cached notification)

5. **Verify:**
   - Push notification received while app closed
   - Widget appears instantly on open
   - Countdown timer accurate
   - Can log recovery meal

---

## 🔍 Monitoring Queries

### Check Detection Success Rate

```sql
-- Recovery notifications created today
SELECT COUNT(*) as notifications_created
FROM training_notifications
WHERE type = 'recovery'
AND scheduled_for > CURRENT_DATE;

-- Average detection delay
SELECT 
  AVG((notes::json->>'minutes_since_end')::integer) as avg_delay_minutes,
  MIN((notes::json->>'minutes_since_end')::integer) as min_delay,
  MAX((notes::json->>'minutes_since_end')::integer) as max_delay
FROM training_notifications
WHERE type = 'recovery'
AND scheduled_for > CURRENT_DATE;

-- Notifications by hour (to see cron pattern)
SELECT 
  EXTRACT(HOUR FROM scheduled_for) as hour,
  COUNT(*) as count
FROM training_notifications
WHERE type = 'recovery'
AND scheduled_for > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

### Check Cron Performance

```sql
-- Recent cron runs
SELECT 
  j.jobname,
  r.runid,
  r.start_time,
  r.end_time,
  r.status,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time)) as duration_seconds
FROM cron.job j
JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname LIKE '%sync%'
ORDER BY r.start_time DESC
LIMIT 20;

-- Failure rate
SELECT 
  jobname,
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures,
  ROUND(100.0 * SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate_pct
FROM cron.job j
JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname LIKE '%sync%'
AND r.start_time > NOW() - INTERVAL '24 hours'
GROUP BY jobname;
```

---

## 📊 Deployment Checklist

- [x] Edge function deployed (sync-all-users-direct)
- [x] Frontend built successfully
- [ ] Database migrations applied (manual step)
- [ ] Cron jobs verified (after migrations)
- [ ] Frontend pushed to Git (auto-deploy)
- [ ] iOS testing completed
- [ ] Android testing completed
- [ ] Backend detection verified
- [ ] Push notifications tested
- [ ] Monitoring queries run

---

## 🐛 Troubleshooting

### Issue: Cron job not running

**Check:**
```sql
-- Are jobs scheduled?
SELECT * FROM cron.job WHERE jobname LIKE '%sync%';

-- Are they active?
SELECT * FROM cron.job WHERE active = false;

-- Recent runs?
SELECT * FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%sync%')
ORDER BY start_time DESC LIMIT 5;
```

**Fix:** Ensure migrations were applied correctly

---

### Issue: No notifications created

**Check:**
```sql
-- Any users have active Google tokens?
SELECT COUNT(*) FROM google_tokens WHERE is_active = true;

-- Any sessions in last 30 minutes?
SELECT COUNT(*) FROM google_fit_sessions 
WHERE end_time > NOW() - INTERVAL '30 minutes';

-- Edge function logs
-- Go to: Dashboard → Functions → sync-all-users-direct → Logs
```

**Fix:** Ensure users have workouts in last 30 min

---

### Issue: Widget not appearing on iOS

**Check:**
- Browser console logs
- Google Fit connection status
- Workout ended < 30 minutes ago
- No previous acknowledgment in localStorage

**Fix:** Clear localStorage key `lastAckSessionId` and try again

---

## 📈 Expected Results

### After Successful Deployment:

**Backend:**
- Cron runs every 10 minutes ✅
- Detects workouts within 30 min ✅
- Creates training_notifications ✅
- Sends push notifications ✅

**Frontend:**
- iOS: Widget in 3-5 seconds ✅
- Android: Instant widget (cached) ✅
- Accurate countdown timer ✅
- No false positives from old workouts ✅

**User Experience:**
- Recovery window preserved (20-27 min) ✅
- Platform-optimized detection ✅
- Reliable and fast ✅

---

## 🎯 Next Steps

1. **Apply migrations** (see Step 1 above)
2. **Push to Git** for frontend auto-deploy
3. **Wait 10-15 minutes** for first cron run
4. **Test with real workout** on both platforms
5. **Monitor queries** to verify success
6. **Document any issues** for quick fixes

---

## 📞 Support

**Dashboard:** https://supabase.com/dashboard/project/eecdbddpzwedficnpenm  
**Functions:** https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/functions  
**SQL Editor:** https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql  
**Cron Jobs:** https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/database/cron-jobs

---

**Status:** 🟡 Partially Deployed (Manual steps required)  
**ETA to Complete:** 15 minutes (apply migrations + git push)  
**Ready for Testing:** After migrations applied ✅

