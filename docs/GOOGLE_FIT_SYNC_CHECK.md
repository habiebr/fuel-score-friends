# Google Fit Sync Status Check - December 2024

## Quick Summary

**Status**: 🟡 Partially Complete
- ✅ **auto-sync-google-fit function**: DEPLOYED (confirmed)
- ❓ **Cron job**: Unknown (needs verification)
- ❓ **Data freshness**: Needs checking
- ❓ **Weekly miles**: Needs debugging

---

## Investigation Checklist

### 1. ✅ Edge Function Status

**Result**: CONFIRMED DEPLOYED

```
Function ID: ff4f0c70-a331-4d87-956c-b51dcfbcd77f
Name: auto-sync-google-fit
Status: ACTIVE
Version: 7
Last Updated: 2025-10-11 08:13:14
```

**Action**: ✅ No action needed - function exists and is active

---

### 2. ⏳ Cron Job Verification

**What to check**:
```sql
-- Run this in Supabase SQL Editor
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname LIKE '%auto-sync%' OR jobname LIKE '%google%';
```

**Expected result**:
- Job name: `auto-sync-google-fit-every-5-min`
- Schedule: `*/5 * * * *` (every 5 minutes)
- Active: `true`

**If missing**: Run `setup_auto_sync_cron.sql` in SQL Editor

---

### 3. ⏳ Manual Function Test

**How to test**:
```bash
# Run from project root
./test-auto-sync.sh
```

**Expected response**:
```json
{
  "success": true,
  "synced": X,
  "skipped": Y,
  "errors": 0,
  "total": X+Y
}
```

**If errors**: Check function logs in Supabase Dashboard

---

### 4. ⏳ Check Data Freshness

**Query to run**:
```sql
-- Check last sync times for all users
SELECT 
  user_id,
  date,
  last_synced_at,
  NOW() - last_synced_at as time_since_sync,
  distance_meters,
  steps,
  calories
FROM google_fit_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY last_synced_at DESC
LIMIT 20;
```

**What to look for**:
- `time_since_sync` should be < 10 minutes for recent dates
- If > 1 hour, sync is NOT working
- If NULL, user has never synced

---

### 5. ⏳ Debug Weekly Miles

**Test the leaderboard function**:
```bash
# Get your user ID from Supabase Dashboard first
export USER_ID="your-user-id-here"

curl -X POST \
  https://eecdbddpzwedficnpenm.supabase.co/functions/v1/weekly-running-leaderboard \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"weekStart\": \"2024-12-09\", \"userId\": \"$USER_ID\"}"
```

**Check running sessions**:
```sql
-- See if running activities are being stored
SELECT 
  user_id,
  session_id,
  activity_type,
  name,
  start_time,
  end_time,
  (raw->>'distance_meters')::numeric / 1000.0 as distance_km
FROM google_fit_sessions
WHERE user_id = 'YOUR_USER_ID'
  AND start_time >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY start_time DESC;
```

---

## Common Issues & Fixes

### Issue 1: Cron Job Not Set Up

**Symptoms**:
- Data only syncs once per day (at 01:15 UTC)
- Recovery window doesn't work
- Weekly miles shows stale data

**Fix**:
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `setup_auto_sync_cron.sql`
3. Click "Run"
4. Verify job created: `SELECT * FROM cron.job WHERE jobname = 'auto-sync-google-fit-every-5-min';`

---

### Issue 2: Function Missing CRON_SECRET

**Symptoms**:
- Function returns 401 Unauthorized
- Logs show "Missing or invalid CRON_SECRET"

**Fix**:
1. Go to Edge Functions → Secrets
2. Add: `CRON_SECRET=your-random-secret-string`
3. Redeploy function if needed

---

### Issue 3: OAuth Tokens Expired

**Symptoms**:
- Function returns errors for specific users
- Logs show "invalid_grant" or "Token expired"

**Fix**:
- Tokens should auto-refresh via `refresh-expiring-google-tokens` cron (runs every 15 min)
- If not working, users need to reconnect Google Fit in App Integrations page

---

### Issue 4: Running Sessions Not Detected

**Symptoms**:
- Google Fit shows runs
- App shows 0 km weekly miles

**Possible causes**:
1. **Activity type not recognized**: Check if activity code is in `RUN_ACTIVITY_CODES`
2. **No distance data**: Google Fit session missing distance metadata
3. **Session not synced**: Data not in `google_fit_sessions` table

**Debug steps**:
```sql
-- 1. Check if sessions exist
SELECT COUNT(*) FROM google_fit_sessions 
WHERE user_id = 'YOUR_USER_ID' 
  AND start_time >= CURRENT_DATE - INTERVAL '7 days';

-- 2. Check activity types
SELECT DISTINCT activity_type, COUNT(*) 
FROM google_fit_sessions 
WHERE user_id = 'YOUR_USER_ID'
GROUP BY activity_type;

-- 3. Check for distance data
SELECT 
  activity_type,
  name,
  (raw->>'distance_meters')::numeric / 1000.0 as km
FROM google_fit_sessions 
WHERE user_id = 'YOUR_USER_ID'
  AND start_time >= CURRENT_DATE - INTERVAL '7 days';
```

---

## Quick Diagnosis Commands

### Check Everything at Once
```bash
# 1. Verify function is deployed
supabase functions list | grep auto-sync

# 2. Test function manually
./test-auto-sync.sh

# 3. Check recent sync activity (requires psql access)
# Open SQL Editor in Dashboard and run:
SELECT * FROM google_fit_data 
WHERE last_synced_at > NOW() - INTERVAL '1 hour' 
ORDER BY last_synced_at DESC;
```

---

## Expected Behavior After Fix

### If Everything is Working:

1. **Auto-sync runs every 5 minutes**
   - Check cron.job_run_details for recent runs
   - Function logs show successful syncs

2. **Data is fresh**
   - `google_fit_data.last_synced_at` within 5-10 minutes
   - New activities appear quickly

3. **Recovery window works**
   - Finish workout → App shows recovery meals within 5-10 min
   - No need to manually refresh

4. **Weekly miles updates automatically**
   - Dashboard shows accurate running distance
   - Updates within 5-10 min of completing run

---

## Files for Reference

- `setup_auto_sync_cron.sql` - SQL to create cron job
- `test-auto-sync.sh` - Manual function test script
- `check-cron-jobs.sql` - Query to check cron status
- `GOOGLE_FIT_SYNC_INVESTIGATION.md` - Original investigation
- `BACKGROUND_SYNC_IMPLEMENTATION.md` - Implementation details
- `CLI_DEPLOYMENT_SUCCESS.md` - Deployment history

---

## Next Steps

1. **Verify cron job** - Run check-cron-jobs.sql
2. **Test function** - Run ./test-auto-sync.sh
3. **Check data** - Query google_fit_data for freshness
4. **Debug weekly miles** - Test leaderboard function
5. **Document results** - Update this file with findings

---

## Support

If issues persist:
1. Check function logs: Dashboard → Edge Functions → auto-sync-google-fit → Logs
2. Check cron logs: Query `cron.job_run_details` table
3. Enable debug mode: Add console.log statements to function
4. Check Google Fit API quota: Verify not rate-limited

---

**Last Updated**: December 2024
**Status**: Investigation in progress
