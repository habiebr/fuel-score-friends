# Google Fit Session Data Loss Investigation

## Quick Check Queries

Run these in Supabase SQL Editor to diagnose the issue:

### 1. Check if sessions are being stored in google_fit_data table
```sql
SELECT 
  date,
  steps,
  calories_burned,
  jsonb_array_length(sessions) as session_count,
  sessions
FROM google_fit_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC
LIMIT 10;
```

**Expected**: `session_count` > 0 for days with workouts
**If 0**: Sessions are not being synced properly

---

### 2. Check google_fit_sessions table
```sql
SELECT 
  session_id,
  activity_type,
  name,
  description,
  start_time,
  end_time,
  source,
  raw->'_computed_distance_meters' as distance_meters
FROM google_fit_sessions
WHERE user_id = auth.uid()
  AND start_time >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY start_time DESC
LIMIT 20;
```

**Expected**: Recent running/cycling sessions
**If empty**: Sessions table not being populated

---

### 3. Check for running sessions specifically
```sql
SELECT 
  activity_type,
  name,
  start_time,
  end_time,
  raw->'_computed_distance_meters' as distance_meters,
  (EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::int as duration_minutes
FROM google_fit_sessions
WHERE user_id = auth.uid()
  AND start_time >= CURRENT_DATE - INTERVAL '7 days'
  AND (
    activity_type ILIKE '%run%'
    OR name ILIKE '%run%'
    OR description ILIKE '%run%'
  )
ORDER BY start_time DESC;
```

**Expected**: Your recent running activities
**If empty**: Running sessions not being captured

---

### 4. Check weekly running leaderboard data
```sql
SELECT 
  user_id,
  week_start,
  total_miles,
  total_runs,
  longest_run_miles,
  avg_pace_per_mile,
  sessions
FROM weekly_running_stats
WHERE week_start >= CURRENT_DATE - INTERVAL '14 days'
ORDER BY week_start DESC, total_miles DESC
LIMIT 10;
```

**Expected**: Recent weekly stats with running data
**If empty or 0 miles**: Leaderboard not calculating from sessions

---

## Common Issues & Fixes

### Issue 1: Sessions array is empty in google_fit_data
**Symptom**: `session_count = 0` in Query #1

**Possible Causes**:
1. Google Fit API not returning sessions
2. Sessions being filtered out (not recognized as exercise)
3. Token doesn't have session permissions

**Fix**: Check auto-sync function logs in Supabase Dashboard

---

### Issue 2: google_fit_sessions table is empty
**Symptom**: Query #2 returns no rows

**Possible Causes**:
1. Session storage code not running
2. Error when storing sessions (check logs)
3. RLS policy blocking inserts

**Fix**: 
```sql
-- Check if table exists and RLS is configured
SELECT tablename FROM pg_tables WHERE tablename = 'google_fit_sessions';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'google_fit_sessions';
```

---

### Issue 3: Running sessions not recognized
**Symptom**: Query #3 returns no rows, but Query #2 shows other activities

**Possible Causes**:
1. Activity type codes not recognized as "running"
2. Session names don't contain "run"
3. Sessions stored with different activity labels

**Debug**:
```sql
-- See what activity types ARE being stored
SELECT 
  activity_type,
  COUNT(*) as count
FROM google_fit_sessions
WHERE user_id = auth.uid()
  AND start_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY activity_type
ORDER BY count DESC;
```

---

### Issue 4: Weekly leaderboard not calculating
**Symptom**: Query #4 shows 0 miles despite sessions existing

**Possible Causes**:
1. `isRunningSession()` function not recognizing activity types
2. Distance not being extracted from sessions
3. weekly-running-leaderboard function not deployed/updated

**Fix**: Check weekly-running-leaderboard function code

---

## Next Steps

1. **Run Query #1** to check if sessions are in google_fit_data
2. **Run Query #2** to check if google_fit_sessions table has data
3. **Report results** and we'll diagnose from there

---

## Expected Data Flow

```
Google Fit API
    ↓
fetchSessions() ← Gets all sessions for the day
    ↓
filterExerciseSessions() ← Filters to only exercise (not walking)
    ↓
enhanceSessions() ← Adds distance data
    ↓
storeDayData() ← Stores in TWO places:
    ├─→ google_fit_data.sessions (JSON array)
    └─→ google_fit_sessions (normalized table)
        ↓
weekly-running-leaderboard reads from google_fit_sessions
    ↓
Shows in UI
```

---

**Quick Test**: Run Query #1 and #2, paste results here.
