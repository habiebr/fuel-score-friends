# 🧪 Quick Test Guide - Recovery Nutrition

**Status:** ✅ System deployed and ready  
**URL:** https://app.nutrisync.id

---

## 📋 Pre-Test Checklist

Run this SQL first to verify system health:

### **System Health Check** (Copy-paste into SQL Editor)

```sql
-- 1. Check cron jobs are active
SELECT 
  jobname,
  schedule,
  active,
  CASE WHEN active THEN '✅' ELSE '❌' END as status
FROM cron.job
WHERE jobname LIKE '%sync%' OR jobname LIKE '%token%'
ORDER BY jobname;

-- Expected: 3 active jobs
-- ✅ refresh-google-tokens (*/15 * * * *)
-- ✅ sync-google-fit-frequent (*/10 * * * *)
-- ✅ sync-google-fit-full (15 1 * * *)

-- 2. Check if cron ran recently
SELECT 
  j.jobname,
  r.start_time,
  r.status,
  r.return_message
FROM cron.job j
JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname = 'sync-google-fit-frequent'
ORDER BY r.start_time DESC
LIMIT 3;

-- Expected: Recent runs in last hour with status 'succeeded'

-- 3. Check your Google Fit connection
SELECT 
  user_id,
  is_active,
  expires_at,
  CASE 
    WHEN expires_at > NOW() THEN '✅ Valid'
    ELSE '❌ Expired'
  END as token_status
FROM google_tokens
WHERE user_id = (SELECT id FROM auth.users WHERE email = '<YOUR_EMAIL>')
LIMIT 1;

-- Replace <YOUR_EMAIL> with your actual email
-- Expected: is_active = true, expires_at > now
```

**Run these in:** https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql

---

## 🏃‍♂️ Test 1: Quick Manual Test (5 minutes)

### **Step 1: Open the App**
1. Go to: https://app.nutrisync.id
2. Open DevTools: F12 (or Right-click → Inspect)
3. Go to Console tab
4. Look for: `"🏃 Checking for recent Google Fit workouts..."`
5. ✅ If you see it → New code is running!

### **Step 2: Record a Workout**
**Option A: Manual Log (Fastest)**
1. Open Google Fit app on your phone
2. Tap "+" → Add activity
3. Choose: Running (or any activity)
4. Duration: 10 minutes
5. **Important:** Set end time to "5 minutes ago"
6. Tap Save

**Option B: Real Quick Workout**
1. Start Google Fit workout tracker
2. Walk/jog for 2-3 minutes
3. Stop workout
4. Wait for it to sync (1-2 minutes)

### **Step 3: Test Detection**
1. Wait 2-3 minutes after saving workout
2. Go back to: https://app.nutrisync.id
3. Refresh the page (Cmd+R or Ctrl+R)
4. **Watch the dashboard**

**Expected (iOS):**
- Widget appears in **3-5 seconds** ⚡
- Shows workout name and distance
- Countdown timer shows ~25-27 minutes
- Can dismiss widget

**Expected (Android):**
- If app was closed: Check for push notification
- Open app: Widget appears instantly
- Countdown timer accurate

### **Step 4: Check Console Logs**

In browser console, you should see:
```
🏃 Checking for recent Google Fit workouts...
✅ Found recent workout from training_notifications
```

OR if fresh sync:
```
⏱️ Triggering fresh sync...
✅ Fresh sync completed, found workout
```

---

## 🔍 Test 2: Verify Backend Detection (SQL)

After recording your workout, check if the backend detected it:

```sql
-- Find your user ID first
SELECT id, email FROM auth.users WHERE email = '<YOUR_EMAIL>';

-- Check if workout was synced
SELECT 
  activity_type,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (NOW() - end_time))/60 as minutes_since_end,
  duration_minutes,
  distance_km,
  calories_burned
FROM google_fit_sessions
WHERE user_id = '<YOUR_USER_ID>'
AND end_time > NOW() - INTERVAL '2 hours'
ORDER BY end_time DESC
LIMIT 5;

-- Expected: Your workout appears here

-- Check if notification was created
SELECT 
  title,
  message,
  scheduled_for,
  is_read,
  notes->>'workout_type' as workout_type,
  notes->>'minutes_since_end' as detection_delay
FROM training_notifications
WHERE user_id = '<YOUR_USER_ID>'
AND type = 'recovery'
AND scheduled_for > NOW() - INTERVAL '2 hours'
ORDER BY scheduled_for DESC
LIMIT 5;

-- Expected: Notification created for your workout
```

---

## 🎯 Test 3: Full Android Background Test (15 minutes)

**Only for Android users:**

1. **Setup:**
   - Ensure PWA is installed
   - Grant notification permission
   - Google Fit connected

2. **Record Workout:**
   - Open Google Fit
   - Start real workout (walk 3-5 min)
   - Stop workout
   - Wait for sync

3. **Test Background:**
   - Close Google Fit app
   - Close Fuel Score app **completely**
   - Put phone down
   - **Wait 10-15 minutes**

4. **Expected:**
   - Push notification appears: "Recovery Nutrition Ready! 🍌"
   - Tap notification → Opens app
   - Widget visible immediately

5. **If no notification:**
   - Open app manually
   - Widget should still appear (from cached notification)

---

## 📊 Test Results Monitoring

### **Success Metrics:**

```sql
-- How many workouts detected today?
SELECT COUNT(*) as workouts_detected
FROM training_notifications
WHERE type = 'recovery'
AND scheduled_for > CURRENT_DATE;

-- Average detection delay
SELECT 
  ROUND(AVG((notes::json->>'minutes_since_end')::numeric), 1) as avg_delay_min,
  MIN((notes::json->>'minutes_since_end')::numeric) as min_delay,
  MAX((notes::json->>'minutes_since_end')::numeric) as max_delay
FROM training_notifications
WHERE type = 'recovery'
AND scheduled_for > CURRENT_DATE;

-- Target: 5-10 min average delay
```

---

## ✅ Test Success Criteria:

- [ ] Console shows new detection logs
- [ ] Workout appears in `google_fit_sessions`
- [ ] Notification created in `training_notifications`
- [ ] Widget appears on app open
- [ ] Countdown timer accurate (25-27 min)
- [ ] Can dismiss widget (doesn't reappear)
- [ ] Widget shows correct workout info
- [ ] Can log recovery meal

---

## 🐛 Troubleshooting:

### **Issue: Widget doesn't appear**

**Check 1: Was workout synced?**
```sql
SELECT * FROM google_fit_sessions 
WHERE user_id = '<YOUR_USER_ID>'
AND end_time > NOW() - INTERVAL '1 hour';
```
- If empty: Google Fit hasn't synced yet, wait 5 min

**Check 2: Was notification created?**
```sql
SELECT * FROM training_notifications 
WHERE user_id = '<YOUR_USER_ID>'
AND type = 'recovery'
ORDER BY scheduled_for DESC LIMIT 1;
```
- If empty: Workout might be > 30 min old

**Check 3: Clear cache**
```javascript
// In browser console:
localStorage.removeItem('lastAckSessionId');
location.reload();
```

### **Issue: Old widget appears**

This means localStorage has a cached acknowledgment.

**Fix:**
```javascript
// In browser console:
localStorage.removeItem('lastAckSessionId');
location.reload();
```

### **Issue: Cron not running**

**Check:**
```sql
SELECT * FROM cron.job WHERE active = false;
```

**Fix:** Re-enable the job if needed

---

## 📱 Testing Platforms:

### **iOS (PWA in Safari):**
- ✅ Foreground detection (3-5 sec)
- ❌ Background notifications (iOS limitation)
- ✅ Recovery window preserved
- ✅ Widget functionality

### **Android (Chrome PWA):**
- ✅ Foreground detection (instant)
- ✅ Background notifications (10 min)
- ✅ Recovery window preserved
- ✅ Full PWA features

---

## 🎉 Test Complete Checklist:

After testing, verify:

- [ ] System health check passed
- [ ] Workout logged in Google Fit
- [ ] Workout appears in database
- [ ] Notification created automatically
- [ ] Widget appeared on app open
- [ ] Timer countdown accurate
- [ ] Could dismiss widget
- [ ] No errors in console
- [ ] Recovery meal can be logged

---

## 📝 Report Results:

After testing, note:

1. **Platform:** iOS / Android
2. **Detection time:** How long after workout?
3. **Widget accuracy:** Correct info?
4. **Any issues:** Errors or problems?
5. **User experience:** Rating 1-10?

---

**Ready to start?** 

1. Run system health check SQL ✅
2. Open app.nutrisync.id ✅
3. Record workout in Google Fit ✅
4. Watch for widget! 🎯

