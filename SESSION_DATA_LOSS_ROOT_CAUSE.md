# 🔍 Session Data Loss - ROOT CAUSE FOUND!

## Problem

**Sessions are stored in `google_fit_sessions` table** ✅  
**BUT sessions array in `google_fit_data` table is EMPTY** ❌

## Root Cause

The cron job is calling the **WRONG function**!

### Current Setup (BROKEN)
```sql
-- From setup_auto_sync_cron.sql
SELECT cron.schedule(
  'auto-sync-google-fit-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/auto-sync-google-fit',  ← OLD FUNCTION
    ...
  )
  $$
);
```

**Problem**: `auto-sync-google-fit` is an OLD version that:
- ❌ Does NOT populate `google_fit_data.sessions` array
- ❌ Source code not in local repository
- ✅ DOES populate `google_fit_sessions` table (that's why sessions exist there)

### Correct Function (WORKING)
```typescript
// sync-all-users-direct/index.ts (lines 300-314)
const daySessions = (exerciseSessions || []).filter((s: any) => {
  const sDate = new Date(parseInt(s.startTimeMillis)).toISOString().slice(0, 10);
  return sDate === day;
}).map((s: any) => {
  // ... format sessions
});

const { error: upErr } = await supabaseClient
  .from('google_fit_data')
  .upsert({
    user_id: token.user_id,
    date: day,
    steps,
    distance_meters: distance,
    calories_burned: calories,
    active_minutes: activeMinutes || null,
    heart_rate_avg: heartRateAvg,
    sessions: daySessions  ← THIS IS WHAT WE NEED!
  }, { onConflict: 'user_id,date' });
```

**This function**: `sync-all-users-direct`
- ✅ Populates `google_fit_sessions` table
- ✅ Populates `google_fit_data.sessions` array  
- ✅ Already deployed and working

---

## Solution

### Option 1: Update Cron Job (RECOMMENDED)

**File**: Create `fix_cron_job.sql`

```sql
-- Remove the old cron job
SELECT cron.unschedule('auto-sync-google-fit-every-5-min');

-- Create new cron job calling the correct function
SELECT cron.schedule(
  'sync-all-users-every-5-min',  -- New name
  '*/5 * * * *',                  -- Same schedule: every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/sync-all-users-direct',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer cc31eefcfdb9545d51cd6784229026eb559e8a8b4a05b77d4282fd3922bb6e5f'
    ),
    body := jsonb_build_object(
      'admin_key', 'force_sync_2025',
      'daysBack', 1
    )
  ) AS request_id;
  $$
);
```

**Benefits**:
- ✅ Uses the newer, better function
- ✅ Populates both tables AND sessions array
- ✅ Has source code in repository (maintainable)
- ✅ More features (pagination, better error handling)

---

### Option 2: Redeploy auto-sync-google-fit with Fix

Create new version of `auto-sync-google-fit` using `google-fit-sync-core.ts` which properly stores sessions.

**File**: Create `supabase/functions/auto-sync-google-fit/index.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { fetchDayData, storeDayData, ensureValidToken } from '../_shared/google-fit-sync-core.ts';

// ... (implementation using sync-core which properly stores sessions)
```

Then redeploy:
```bash
supabase functions deploy auto-sync-google-fit
```

**Benefits**:
- ✅ No need to change cron job
- ✅ Uses shared sync-core module
- ❌ More work (need to write the function)

---

## Recommended Action

**Use Option 1** - It's faster and uses existing, tested code.

### Steps:

1. **Run the SQL fix** (in Supabase SQL Editor):
   ```sql
   -- Remove old cron job
   SELECT cron.unschedule('auto-sync-google-fit-every-5-min');
   
   -- Create new cron job
   SELECT cron.schedule(
     'sync-all-users-every-5-min',
     '*/5 * * * *',
     $$
     SELECT net.http_post(
       url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/sync-all-users-direct',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer cc31eefcfdb9545d51cd6784229026eb559e8a8b4a05b77d4282fd3922bb6e5f'
       ),
       body := jsonb_build_object(
         'admin_key', 'force_sync_2025',
         'daysBack', 1
       )
     ) AS request_id;
     $$
   );
   ```

2. **Verify it's running**:
   ```sql
   SELECT jobid, jobname, schedule, active
   FROM cron.job
   WHERE jobname = 'sync-all-users-every-5-min';
   ```

3. **Wait 5 minutes**, then check:
   ```sql
   SELECT 
     date,
     jsonb_array_length(sessions) as session_count,
     sessions
   FROM google_fit_data
   WHERE date = CURRENT_DATE
   ORDER BY date DESC
   LIMIT 5;
   ```

**Expected**: `session_count` > 0 (sessions array now populated!)

---

## Why This Happened

1. `auto-sync-google-fit` was deployed BEFORE `google-fit-sync-core.ts` was created
2. Cron job was set up to call the old function
3. Later, `sync-all-users-direct` was created with proper session storage
4. But cron job was never updated to use the new function
5. Result: `google_fit_sessions` gets populated, but `google_fit_data.sessions` stays empty

---

## Impact on Weekly Miles

Once this is fixed:
- ✅ `google_fit_data.sessions` will be populated
- ✅ Weekly running leaderboard can read sessions from there
- ✅ Running activities will show up properly
- ✅ Distance calculations will work

---

**Status**: Ready to apply fix
**Risk**: Low (just changing which function cron calls)
**Downtime**: None (cron runs every 5 min anyway)
**Rollback**: Easy (re-run old SQL to restore previous cron)
