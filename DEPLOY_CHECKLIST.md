# ✅ Google Fit Background Sync - Deployment Checklist

## Status: READY TO DEPLOY

All code is ready and tested. Just need to run the SQL script to enable the cron job.

---

## What's Already Done ✅

- ✅ **Edge Function Deployed**: `auto-sync-google-fit` 
- ✅ **Secrets Configured**: All required environment variables set
- ✅ **Function Tested**: Manually tested and working (synced 2 users)
- ✅ **Client Code Updated**: Silent sync implemented
- ✅ **Documentation Created**: Comprehensive guides written

---

## Final Step: Enable Cron Job (2 minutes)

### Option 1: Supabase Dashboard (Recommended)

1. **Go to SQL Editor**
   - Open: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql

2. **Run the SQL Script**
   - Copy all contents of `setup_auto_sync_cron.sql`
   - Paste into SQL Editor
   - Click **"Run"** button

3. **Verify Setup**
   - You should see: `jobid | jobname | schedule | command` output
   - Check that `jobname = 'auto-sync-google-fit-every-5-min'`

4. **Monitor First Run**
   - Go to: Edge Functions > auto-sync-google-fit > Logs
   - Wait ~5 minutes for first cron execution
   - Look for: `🎯 Auto-sync complete: X synced, Y skipped, Z errors`

### Option 2: Supabase CLI

```bash
supabase db execute --file setup_auto_sync_cron.sql
```

---

## What This Does

Once the cron job is enabled:

1. **Every 5 minutes**, the server automatically:
   - Fetches all users with Google Fit tokens
   - Syncs their latest fitness data (steps, calories, distance, active minutes)
   - Skips users who were synced < 5 minutes ago (efficient)
   - Refreshes expired OAuth tokens automatically

2. **No more**:
   - ❌ Client-side polling (battery drain)
   - ❌ Notification spam
   - ❌ Unreliable syncs when app is closed

3. **Benefits**:
   - ✅ Silent background sync
   - ✅ Near-instant data (max 5-minute staleness)
   - ✅ Works even when app is closed
   - ✅ Automatic token refresh

---

## Verification Steps

### Check Cron Job is Running

```sql
-- Run this in SQL Editor after 5-10 minutes
SELECT jobid, runid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'auto-sync-google-fit-every-5-min'
)
ORDER BY start_time DESC
LIMIT 5;
```

**Expected Output:**
- Status: `succeeded`
- Return message: (empty or success indicator)
- Start/end times: Should show runs every 5 minutes

### Check Edge Function Logs

1. Go to: Dashboard > Edge Functions > auto-sync-google-fit > Logs
2. Filter by: Last 1 hour
3. Look for entries like:

```
🔄 Starting auto-sync for all active Google Fit users...
Found 5 users with Google Fit tokens
✅ Synced user a1b2c3d4...: 8500 steps, 350 cal
✅ Synced user e5f6g7h8...: 12000 steps, 480 cal
Skipping user i9j0k1l2... (synced 120s ago)
🎯 Auto-sync complete: 4 synced, 1 skipped, 0 errors
```

### Test Instant Recovery Feature

1. Complete a workout (or use test data)
2. Open app within 5 minutes
3. Navigate to instant recovery meal feature
4. Should show accurate calories burned and recovery recommendations

---

## Rollback Plan

If you need to disable the cron job:

```sql
-- Pause the cron job (keeps it but stops execution)
UPDATE cron.job SET active = false 
WHERE jobname = 'auto-sync-google-fit-every-5-min';

-- Or completely remove it
SELECT cron.unschedule('auto-sync-google-fit-every-5-min');
```

---

## Cost Impact

**Expected Load:**
- 288 cron runs per day (every 5 minutes)
- ~5-10 Google Fit API calls per run (depends on active users)
- Total: ~1,500-3,000 API calls/day

**Supabase Limits:**
- Free tier: 500,000 edge function invocations/month
- Current usage: 8,640 invocations/month (288/day × 30 days)
- **Headroom: 98%** ✅

**Google Fit Limits:**
- Quota: 1,000,000 requests/day
- Current usage: ~3,000/day
- **Headroom: 99.7%** ✅

---

## Support & Monitoring

### Health Check Dashboard

Create this SQL query as a saved view:

```sql
CREATE VIEW auto_sync_health AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'succeeded') as successful_runs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
  MAX(start_time) as last_run,
  AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration_seconds
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'auto-sync-google-fit-every-5-min'
)
AND start_time > NOW() - INTERVAL '24 hours';
```

### Alert Thresholds

- ⚠️ Warning: If failed_runs > 5 in 24 hours
- 🚨 Critical: If no successful runs in last 1 hour
- ℹ️ Info: If avg_duration_seconds > 10 seconds

---

## Next Steps After Deployment

1. ✅ **Enable cron job** (run SQL script)
2. ⏱️ **Wait 5-10 minutes** for first execution
3. 🔍 **Check logs** for successful sync
4. 🧪 **Test instant recovery** feature
5. 📊 **Monitor for 24 hours** to ensure stability
6. 🚀 **Deploy to production** when stable

---

## Summary

**Status**: ✅ Code complete, tested, and ready  
**Action Required**: Run `setup_auto_sync_cron.sql` in Supabase Dashboard  
**Time to Deploy**: ~2 minutes  
**Impact**: Near-instant sync for instant recovery meal feature  

🎯 **You're one SQL script away from production-ready background sync!**
