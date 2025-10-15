# Google Fit Sync Investigation - October 2025

## Issue Summary
1. **Late Sync**: Google Fit activities syncing late, causing long windows that miss the 30-minute recovery window feature
2. **Missing Weekly Miles**: Running activities from Google Fit not showing properly in weekly miles tracker

## Investigation Results

### 1. Background Sync Status ❌ NOT DEPLOYED

**Finding**: The `auto-sync-google-fit` edge function does **NOT exist** in your deployed functions.

**Evidence**:
- Function directory listing shows NO `auto-sync-google-fit/` folder
- Only `sync-all-users-direct/` exists (for daily sync, not frequent background sync)
- Setup script exists (`setup_auto_sync_cron.sql`) but function was never deployed

**Current State**:
```
Available sync functions:
✅ fetch-google-fit-data           - Manual user sync (on-demand)
✅ sync-historical-google-fit-data - Historical backfill
✅ sync-all-users-direct          - Daily batch sync (01:15 UTC)
❌ auto-sync-google-fit           - MISSING! (Should run every 5 min)
```

**Configured Cron Jobs** (from migrations):
- `sync-google-fit-daily` - Runs daily at 01:15 UTC (calls `sync-all-users-direct`)
- `refresh-google-fit-tokens` - Runs every 15 minutes (token refresh only)
- NO 5-minute auto-sync cron job is active

**Impact**:
- No automatic background sync happening every 5 minutes
- Users must manually sync or wait until next day (01:15 UTC)
- Recovery window feature likely fails because activity data is hours old

---

### 2. Cron Schedule Details

**Active Scheduled Jobs**:

1. **Daily Google Fit Sync**
   - Name: `sync-google-fit-daily`
   - Schedule: `15 1 * * *` (Daily at 01:15 UTC)
   - Function: `sync-all-users-direct`
   - Purpose: Bulk sync all users once per day

2. **Token Refresh**
   - Name: `refresh-google-fit-tokens`
   - Schedule: `*/15 * * * *` (Every 15 minutes)
   - Function: `refresh-expiring-google-tokens`
   - Purpose: Keep OAuth tokens fresh

**Missing**:
```sql
-- This cron job should exist but doesn't:
SELECT cron.schedule(
  'auto-sync-google-fit-every-5-min',
  '*/5 * * * *',  -- Every 5 minutes
  -- Call auto-sync-google-fit function
);
```

---

### 3. Weekly Miles Calculation Issue 🔍

**How It Works**:
- Dashboard calls `weekly-running-leaderboard` edge function
- Function queries `google_fit_data` table for sessions in current week
- Filters for running activities using `isRunningSession()` utility
- Sums up distance from running sessions

**Possible Issues**:

**A. Late Sync Problem**
If background sync isn't running every 5 minutes, recent running activities won't appear:
```
User finishes run at 6:00 PM
→ Data sits in Google Fit (not synced)
→ Dashboard loads at 6:30 PM
→ Weekly miles shows 0 km (data not in database yet)
→ Data only syncs next day at 01:15 UTC
```

**B. Session Detection**
Running activities might not be detected if:
- Activity type code not in `RUN_ACTIVITY_CODES` set
- Session name doesn't include running keywords
- Distance not properly attached to session

**C. Distance Calculation**
Distance might be missing if:
- Google Fit session has no distance metadata
- Fallback to `distance_meters` column not working
- Sessions filtered out before distance calculation

**Code Check** (weekly-running-leaderboard):
```typescript
// Lines 114-125: Fallback logic exists
if (hasRunning && positiveDistance === 0) {
  const fallbackDistance = Number((row as any)?.distance_meters) || 0;
  if (fallbackDistance > 0) {
    upsertSessionDistance(userId, `daily-${(row as any)?.date ?? ''}`, fallbackDistance);
  }
}
```

This should work, but only if:
1. Session is detected as running
2. Google Fit data is synced to database

---

## Root Cause Analysis

### Primary Issue: Missing Background Sync Function

**Why recovery window fails**:
```
Timeline:
6:00 PM - User finishes workout (Google Fit records it)
6:05 PM - No sync happens (auto-sync-google-fit doesn't exist)
6:10 PM - No sync happens
6:15 PM - No sync happens
6:20 PM - No sync happens
6:25 PM - No sync happens
6:30 PM - Recovery window expires (30 min after workout)
6:35 PM - User opens app, sees no recovery meals
         (Data will only sync tomorrow at 01:15 UTC)
```

**Why weekly miles doesn't update**:
- Same problem - data not synced from Google Fit to database
- Even if user manually syncs, there's no automatic refresh
- Dashboard expects data to be recent but it's stale

---

## Recommended Solutions

### Solution 1: Deploy Missing Background Sync Function ⭐ RECOMMENDED

**Create the missing function**:
```bash
# Create function directory
mkdir -p supabase/functions/auto-sync-google-fit

# Function should:
# 1. Get all users with active Google Fit tokens
# 2. For each user, call fetch-google-fit-data
# 3. Skip users synced < 5 min ago
# 4. Handle errors gracefully
# 5. Return sync stats
```

**Deploy**:
```bash
supabase functions deploy auto-sync-google-fit
```

**Set up cron**:
```sql
-- Run setup_auto_sync_cron.sql
-- This creates a cron job that runs every 5 minutes
```

**Benefits**:
- ✅ Near-instant data (max 5-minute lag)
- ✅ Recovery window feature works
- ✅ Weekly miles updates automatically
- ✅ Zero battery drain (server-side)

---

### Solution 2: Increase Manual Sync Frequency (Temporary)

If you can't deploy auto-sync immediately, improve client-side sync:

**File**: `src/hooks/useGoogleFitSync.ts`

Current: Syncs every 5 minutes on client
Problem: Only when app is open, unreliable

**Improvement**:
```typescript
// Add sync on app focus/resume
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      syncGoogleFit(true); // Silent sync when app becomes visible
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

---

### Solution 3: Debug Weekly Miles Display

**Check these potential issues**:

1. **Verify Google Fit data is syncing**:
```sql
-- Check recent Google Fit data
SELECT 
  date,
  distance_meters,
  sessions,
  last_synced_at
FROM google_fit_data
WHERE user_id = 'YOUR_USER_ID'
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

2. **Check running sessions detection**:
```sql
-- Check if running sessions are being stored
SELECT 
  session_id,
  activity_type,
  name,
  start_time,
  raw->>'distance_meters' as distance
FROM google_fit_sessions
WHERE user_id = 'YOUR_USER_ID'
  AND start_time >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY start_time DESC;
```

3. **Test weekly-running-leaderboard directly**:
```bash
curl -X POST \
  https://eecdbddpzwedficnpenm.supabase.co/functions/v1/weekly-running-leaderboard \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"weekStart": "2025-10-13", "userId": "YOUR_USER_ID"}'
```

---

## Next Steps

### Immediate (Fix Background Sync):

1. **Create auto-sync-google-fit function** - Based on documentation in `BACKGROUND_SYNC_IMPLEMENTATION.md`
2. **Deploy function** - `supabase functions deploy auto-sync-google-fit`
3. **Run cron setup** - Execute `setup_auto_sync_cron.sql`
4. **Verify** - Check cron job runs every 5 minutes

### Short-term (Debug Weekly Miles):

1. **Check user's Google Fit data** - Run SQL queries above
2. **Verify session detection** - Check if running activities are identified
3. **Test leaderboard function** - Confirm distance calculation works
4. **Check Dashboard component** - Verify `weeklyKm` state updates

### Long-term (Prevent Future Issues):

1. **Add monitoring** - Alert if sync hasn't run in 10+ minutes
2. **Add user feedback** - Show "Last synced: X min ago" in UI
3. **Add manual refresh** - Button to force immediate sync
4. **Add debug logs** - Track when sync fails and why

---

## Files to Review

1. `setup_auto_sync_cron.sql` - Cron job configuration (ready to run)
2. `BACKGROUND_SYNC_IMPLEMENTATION.md` - Full implementation guide
3. `DEPLOY_BACKGROUND_SYNC.md` - Step-by-step deployment guide
4. `src/hooks/useGoogleFitSync.ts` - Client-side sync logic
5. `supabase/functions/weekly-running-leaderboard/index.ts` - Weekly miles calculation
6. `src/components/Dashboard.tsx` - Lines 847-873 (weekly miles loading)

---

## Verification Checklist

After deploying auto-sync:

- [ ] Function appears in `supabase/functions/` directory
- [ ] Cron job exists: `SELECT * FROM cron.job WHERE jobname = 'auto-sync-google-fit-every-5-min'`
- [ ] Cron runs successfully: Check `cron.job_run_details` table
- [ ] Google Fit data updates every 5 min: Check `google_fit_data.last_synced_at`
- [ ] Recovery window shows meals within 30 min of workout
- [ ] Weekly miles updates automatically after runs
- [ ] No battery drain on client devices

---

## Summary

**Problem 1: Background sync doesn't work**
- ❌ `auto-sync-google-fit` function missing
- ❌ No 5-minute cron job active
- ✅ Daily sync works but only once per day

**Problem 2: Weekly miles not updating**
- Likely caused by Problem 1 (stale data)
- Function logic looks correct
- Need to verify data is actually in database

**Solution**: Deploy the missing `auto-sync-google-fit` function + cron job
