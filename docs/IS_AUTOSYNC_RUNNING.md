# 🔍 Is Auto-Sync Running in Background?

## Quick Answer: **WE NEED TO CHECK** ⚠️

The **function works** when called manually, but we don't know if the **cron job is set up** to run it automatically every 5 minutes.

---

## Current Status

### ✅ What We Know Works
1. **Function is deployed** - `auto-sync-google-fit` is active
2. **Function executes correctly** - 90% success rate when triggered manually
3. **Test script works** - `./test-auto-sync.sh` successfully calls the function

### ❓ What We DON'T Know Yet
1. **Is the cron job set up?** - Need to check database
2. **Is it running every 5 minutes?** - Need to verify execution history
3. **Is data actually fresh?** - Need to check sync timestamps

---

## How to Check (You Need to Do This)

### Step 1: Check if Cron Job Exists

**Go to**: [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql)

**Run this query**:
```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname LIKE '%auto-sync%';
```

**What to look for**:
- ✅ **If you see a row**: Cron job EXISTS!
  - Check that `active = true`
  - Check that `schedule = '*/5 * * * *'` (every 5 minutes)
  
- ❌ **If query returns empty**: Cron job is NOT set up
  - This means auto-sync is NOT running in background
  - You need to run `setup_auto_sync_cron.sql` to enable it

---

### Step 2: Check if Cron is Actually Running

**Run this query** (only if Step 1 shows cron job exists):
```sql
SELECT 
  status,
  return_message,
  start_time,
  end_time,
  (end_time - start_time) as duration
FROM cron.job_run_details
WHERE jobname = 'auto-sync-google-fit-every-5-min'
ORDER BY start_time DESC
LIMIT 10;
```

**What to look for**:
- ✅ **If you see recent rows** (within last 10 minutes):
  - Cron IS running automatically! 🎉
  - Check `status = 'succeeded'`
  - Should see rows every 5 minutes
  
- ❌ **If no recent rows** or empty:
  - Cron job exists but hasn't run
  - Either it's not active or just created
  - Wait 5 minutes and check again

---

### Step 3: Check Data Freshness

**Run this query**:
```sql
SELECT 
  user_id,
  date,
  last_synced_at,
  NOW() - last_synced_at as time_since_sync,
  steps,
  calories
FROM google_fit_data
WHERE date = CURRENT_DATE
ORDER BY last_synced_at DESC
LIMIT 10;
```

**What to look for**:
- ✅ **If `time_since_sync` < 10 minutes**:
  - Data is FRESH! Auto-sync IS working! 🎉
  
- ⚠️ **If `time_since_sync` > 1 hour**:
  - Data is STALE
  - Cron job is NOT running
  - Need to set it up

---

## Scenarios

### Scenario A: Cron Job Exists ✅
```
Step 1: Returns row with active=true, schedule='*/5 * * * *'
Step 2: Shows recent runs (last 5-10 minutes)
Step 3: Data synced within 10 minutes
```
**Result**: ✅ **AUTO-SYNC IS WORKING IN BACKGROUND!**

---

### Scenario B: Cron Job Missing ❌
```
Step 1: Returns empty (no rows)
Step 2: Can't check (job doesn't exist)
Step 3: Data is hours/days old
```
**Result**: ❌ **AUTO-SYNC NOT RUNNING - NEEDS SETUP**

**Fix**: Run `setup_auto_sync_cron.sql` in SQL Editor

---

### Scenario C: Cron Exists But Not Running ⚠️
```
Step 1: Returns row
Step 2: Returns empty or very old timestamps
Step 3: Data is old
```
**Result**: ⚠️ **CRON JOB INACTIVE**

**Possible causes**:
- Job is not active (`active = false`)
- pg_cron extension not enabled
- Function URL or auth token incorrect
- Supabase plan doesn't support cron (need Pro)

---

## What Happens WITHOUT Cron?

### Manual Triggers Only
- Function works when YOU call it (`./test-auto-sync.sh`)
- Data only syncs when users manually refresh in app
- No automatic background updates
- Recovery window feature doesn't work
- Weekly miles shows stale data

### With Cron Running
- Function runs automatically every 5 minutes
- Data always fresh (< 10 minutes old)
- Recovery window works (30-minute window)
- Weekly miles updates automatically
- No manual intervention needed

---

## How to Enable Auto-Sync

**If cron job is missing**, run this in SQL Editor:

```sql
-- File: setup_auto_sync_cron.sql
-- This sets up automatic sync every 5 minutes

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

SELECT cron.schedule(
  'auto-sync-google-fit-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/auto-sync-google-fit',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer cc31eefcfdb9545d51cd6784229026eb559e8a8b4a05b77d4282fd3922bb6e5f'
    )
  ) AS request_id;
  $$
);
```

**Takes**: 30 seconds to run
**Starts**: Immediately (first run in 5 minutes)

---

## Summary

### What We Tested ✅
- Function deployment: **WORKS**
- Function execution: **WORKS** (90% success)
- Manual trigger: **WORKS**

### What We Still Need to Check ❓
- Is cron job set up? **UNKNOWN**
- Is it running every 5 minutes? **UNKNOWN**
- Is data being synced automatically? **UNKNOWN**

### Action Required 🎯
**You need to**:
1. Go to Supabase Dashboard
2. Run the SQL queries above
3. Tell me what you see

**Then we'll know**:
- If auto-sync is working in background ✅
- Or if we need to set it up ⚠️

---

**Files**:
- `setup_auto_sync_cron.sql` - Run this if cron is missing
- `check-cron-jobs.sql` - SQL queries to verify status
- `test-auto-sync.sh` - Manual test (working)

**Last Updated**: October 15, 2025  
**Status**: Function works, cron status unknown
