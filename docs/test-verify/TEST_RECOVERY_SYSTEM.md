# 🧪 Test Recovery Nutrition System

**System Status:** 🟢 Deployed & Running  
**Date:** October 17, 2025

---

## 📊 Pre-Test Monitoring

Run these queries to check system health:

### 1. Verify Cron Jobs Are Running

```sql
-- Check recent cron runs (last hour)
SELECT 
  j.jobname,
  r.runid,
  r.start_time,
  r.end_time,
  r.status,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time)) as duration_seconds
FROM cron.job j
LEFT JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname IN ('sync-google-fit-frequent', 'sync-google-fit-full', 'refresh-google-tokens')
AND r.start_time > NOW() - INTERVAL '1 hour'
ORDER BY r.start_time DESC;
```

**Expected:** Should see recent runs of `sync-google-fit-frequent` (every 10 min)

---

### 2. Check Active Users with Google Fit

```sql
-- How many users have active Google Fit tokens?
SELECT COUNT(*) as active_users
FROM google_tokens 
WHERE is_active = true;
```

**Expected:** At least 1 active user (you!)

---

### 3. Check Recent Google Fit Sessions

```sql
-- Recent workouts in last 24 hours
SELECT 
  user_id,
  activity_type,
  start_time,
  end_time,
  NOW() - end_time as time_since_workout,
  duration_minutes,
  distance_km,
  calories_burned
FROM google_fit_sessions
WHERE end_time > NOW() - INTERVAL '24 hours'
ORDER BY end_time DESC
LIMIT 10;
```

**Expected:** Shows any recent workouts synced from Google Fit

---

### 4. Check Existing Recovery Notifications

```sql
-- Any recovery notifications created today?
SELECT 
  user_id,
  title,
  message,
  scheduled_for,
  is_read,
  notes
FROM training_notifications
WHERE type = 'recovery'
AND scheduled_for > CURRENT_DATE
ORDER BY scheduled_for DESC;
```

**Expected:** May be empty if no workouts detected yet

---

## 🏃‍♂️ Manual Testing Steps

### Test 1: iOS Foreground Detection (3-5 seconds)

**Setup:**
1. ✅ Ensure you're logged into the app
2. ✅ Verify Google Fit is connected (Settings → Integrations)
3. ✅ Close the Fuel Score app completely

**Test Steps:**
1. **Open Google Fit app** on your iPhone
2. **Record a workout** (any type):
   - Quick option: Start a workout, wait 2 minutes, stop
   - Or: Log a past workout manually
3. **Wait 2-3 minutes** for Google Fit to sync
4. **Open Fuel Score PWA**
5. **Watch the dashboard** - recovery widget should appear in 3-5 seconds

**Expected Result:**
```
✅ Recovery widget appears within 5 seconds
✅ Shows workout name and distance
✅ Countdown timer shows ~25-27 minutes remaining
✅ Can dismiss and won't reappear (uses localStorage)
```

**Check Console Logs (Safari):**
```javascript
// Should see these logs:
"🏃 Checking for recent Google Fit workouts..."
"✅ Found recent workout from training_notifications"
// OR
"⏱️ Triggering fresh sync..."
"✅ Fresh sync completed, found workout"
```

---

### Test 2: Android Background Detection (10 minutes)

**Setup:**
1. ✅ Ensure PWA is installed on Android device
2. ✅ Push notifications enabled
3. ✅ Google Fit connected

**Test Steps:**
1. **Record workout** in Google Fit app
2. **Close Google Fit** app
3. **Close Fuel Score** app completely
4. **Wait 10-15 minutes** (for cron to run)
5. **Check notifications** - should receive push notification

**Expected Result:**
```
✅ Push notification arrives in ~10 minutes
✅ Title: "Recovery Nutrition Ready! 🍌"
✅ Body: "Your post-workout meal window is open for 20 more minutes"
✅ Tap notification → Opens app
✅ Recovery widget visible immediately
```

**Fallback Test (if no push):**
1. Open app manually after 10-15 min
2. Widget should appear instantly (from cached notification)

---

### Test 3: Backend Detection (SQL Monitoring)

**After recording a workout, monitor the database:**

```sql
-- Check if sync detected your workout
SELECT 
  user_id,
  activity_type,
  start_time,
  end_time,
  NOW() - end_time as minutes_since_end,
  duration_minutes
FROM google_fit_sessions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com')
AND end_time > NOW() - INTERVAL '30 minutes'
ORDER BY end_time DESC;
```

**Then check if notification was created:**

```sql
-- Should create notification for workouts < 30 min old
SELECT 
  title,
  message,
  scheduled_for,
  notes
FROM training_notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com')
AND type = 'recovery'
ORDER BY scheduled_for DESC
LIMIT 1;
```

**Expected Timing:**
- Workout ends at **T+0**
- Next cron runs at **T+0 to T+10** (within 10 min)
- Notification created if workout ended **< 30 min ago**
- Widget visible in app immediately after

---

## 🔍 Debugging Queries

### If widget doesn't appear:

**1. Check if workout was synced:**
```sql
SELECT * FROM google_fit_sessions
WHERE user_id = 'your-user-id'
AND end_time > NOW() - INTERVAL '1 hour'
ORDER BY end_time DESC;
```

**2. Check if notification was created:**
```sql
SELECT * FROM training_notifications
WHERE user_id = 'your-user-id'
AND type = 'recovery'
ORDER BY scheduled_for DESC
LIMIT 5;
```

**3. Check cron job logs:**
```sql
SELECT 
  r.start_time,
  r.status,
  r.return_message
FROM cron.job_run_details r
JOIN cron.job j ON j.jobid = r.jobid
WHERE j.jobname = 'sync-google-fit-frequent'
ORDER BY r.start_time DESC
LIMIT 5;
```

**4. Check edge function logs:**
- Go to: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/functions
- Click: `sync-all-users-direct`
- View: Recent logs
- Look for: "🎯 Detected recent workout" or "Created recovery notification"

---

## 📈 Success Metrics

After testing, check these metrics:

### Detection Rate
```sql
-- How many workouts detected vs total workouts?
SELECT 
  (SELECT COUNT(*) FROM training_notifications WHERE type = 'recovery' AND scheduled_for > CURRENT_DATE) as notifications_created,
  (SELECT COUNT(*) FROM google_fit_sessions WHERE end_time > CURRENT_DATE) as total_workouts,
  ROUND(
    100.0 * (SELECT COUNT(*) FROM training_notifications WHERE type = 'recovery' AND scheduled_for > CURRENT_DATE) /
    NULLIF((SELECT COUNT(*) FROM google_fit_sessions WHERE end_time > CURRENT_DATE), 0),
    1
  ) as detection_rate_pct;
```

### Average Detection Delay
```sql
-- How fast is the backend detection?
SELECT 
  AVG((notes::json->>'minutes_since_end')::numeric) as avg_delay_minutes,
  MIN((notes::json->>'minutes_since_end')::numeric) as min_delay,
  MAX((notes::json->>'minutes_since_end')::numeric) as max_delay
FROM training_notifications
WHERE type = 'recovery'
AND scheduled_for > CURRENT_DATE;
```

**Target:** 5-10 min average delay

---

## 🐛 Common Issues & Fixes

### Issue 1: Widget doesn't appear (iOS)

**Possible causes:**
- Workout ended > 30 minutes ago
- Google Fit not synced yet
- localStorage has cached acknowledgment

**Fix:**
```javascript
// Clear localStorage in browser console:
localStorage.removeItem('lastAckSessionId');
// Refresh page
```

---

### Issue 2: No push notification (Android)

**Possible causes:**
- Notifications not enabled
- Cron hasn't run yet (wait 10 min)
- Workout ended > 30 minutes ago

**Fix:**
1. Check notification permissions in Android settings
2. Wait full 10 minutes after workout ends
3. Check if notification was created in database (query above)

---

### Issue 3: Cron not running

**Check:**
```sql
SELECT * FROM cron.job WHERE active = false;
```

**Fix:** Re-enable the job if it's disabled

---

## 📱 Test Scenarios

### Scenario A: Quick Test (5 minutes)
1. Open Google Fit
2. Manually log a 10-minute run that "ended 5 minutes ago"
3. Open Fuel Score app
4. Widget should appear in 3-5 seconds

### Scenario B: Real Workout Test (30 minutes)
1. Go for an actual 10-minute run
2. Track with Google Fit
3. Wait 2-3 minutes after finishing
4. Open Fuel Score app
5. Widget should appear

### Scenario C: Background Detection (15 minutes)
1. Record workout in Google Fit
2. Close all apps
3. Wait 10-15 minutes
4. Check phone for push notification (Android)
5. Open app - widget should be instant

---

## ✅ Test Completion Checklist

After testing, verify:

- [ ] Cron jobs are running (no failures)
- [ ] Workouts appear in `google_fit_sessions`
- [ ] Notifications created in `training_notifications`
- [ ] iOS: Widget appears in 3-5 seconds
- [ ] Android: Push notification received
- [ ] Widget countdown timer accurate
- [ ] Can dismiss widget (doesn't reappear)
- [ ] Can log recovery meal from widget

---

## 🎯 What to Report

After testing, note:

1. **Platform tested:** iOS / Android
2. **Detection time:** How long after workout?
3. **Widget accuracy:** Correct workout info?
4. **Timer accuracy:** Countdown matches expectation?
5. **Any errors:** Console logs or issues
6. **User experience:** Smooth? Confusing? Perfect?

---

**Ready to test!** 🚀

Start with the monitoring queries above, then try a quick manual workout test!

