# 🚀 Quick Deployment Guide: Background Google Fit Sync

## What Was Changed?

✅ **Silent automatic syncs** - No more notification spam  
✅ **3x faster refresh** - 5 minutes instead of 15  
✅ **Server-side background sync** - Works when app is closed  
✅ **Near-instant recovery data** - Perfect for instant recovery meal feature

## Deploy in 5 Minutes

### Step 1: Deploy Edge Function

**Via Supabase Dashboard** (recommended):
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Edge Functions** (left sidebar)
4. Click **"Create Function"**
5. Name: `auto-sync-google-fit`
6. Copy the code from: `supabase/functions/auto-sync-google-fit/index.ts`
7. Click **"Deploy"**

### Step 2: Add Secrets

In **Edge Functions → Secrets**, add these:

```
CRON_SECRET=your-random-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

> **Tip**: Generate a random secret: `openssl rand -hex 32`

### Step 3: Create Cron Job

In **SQL Editor**, run this:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule sync every 5 minutes
SELECT cron.schedule(
  'auto-sync-google-fit',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/auto-sync-google-fit',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
    ) AS request_id;
  $$
);
```

**Replace**:
- `YOUR_PROJECT_ID` → Your Supabase project ID
- `YOUR_CRON_SECRET` → The CRON_SECRET you set in Step 2

### Step 4: Test It

```bash
curl -X POST \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/auto-sync-google-fit \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected response**:
```json
{
  "success": true,
  "synced": 5,
  "skipped": 2,
  "errors": 0,
  "total": 7
}
```

### Step 5: Verify Cron Runs

Check if cron job is running:

```sql
-- View scheduled jobs
SELECT * FROM cron.job;

-- View recent runs
SELECT * 
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

## What Happens Now?

### Automatic Behavior
- ⏰ Every 5 minutes, server syncs Google Fit data for all users
- 🔕 No notifications (silent background operation)
- 🔋 Zero battery drain (runs on server)
- ✅ Works even when app is closed

### Manual Sync
- 👆 Users can still manually sync via Import page
- 🔔 Manual syncs show notifications
- ⚡ Instant feedback for user-initiated actions

### Instant Recovery Feature
- 🏃 User finishes workout → Google Fit records
- ⏱️ Within 5 minutes → Server auto-syncs  
- 📱 User opens app → Instant recovery shows accurate meals
- 🎯 No manual sync needed!

## Monitoring

### Check Sync Health

**Dashboard → Edge Functions → auto-sync-google-fit → Logs**

Look for:
```
✅ Synced user a1b2c3d4...: 8500 steps, 350 cal
🎯 Auto-sync complete: 8 synced, 2 skipped, 0 errors
```

### Alert on Errors

If you see consistent errors:
1. Check Google OAuth credentials
2. Verify users haven't revoked access
3. Check API quota limits

## Troubleshooting

### "No users synced"
- Users need to connect Google Fit first
- Check `google_provider_tokens` table has entries

### "Token refresh failed"
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- User may need to re-authenticate (tokens expire after 60 days)

### "Cron job not running"
- Ensure pg_cron extension is enabled
- Check project is on Supabase Pro plan (cron requires Pro)
- Verify cron job exists: `SELECT * FROM cron.job;`

### "High error rate"
- Check Edge Function logs for specific errors
- Verify Google Fit API quota hasn't been exceeded
- Check network connectivity

## Rollback

If you need to disable:

```sql
-- Stop cron job
SELECT cron.unschedule('auto-sync-google-fit');

-- Optionally delete edge function via Dashboard
```

## Cost Estimate

### With 100 Active Users
- **Google Fit API calls**: ~29,000/day (well within 1M quota)
- **Edge Function invocations**: ~9,000/month (well within 500K free tier)
- **Database operations**: Minimal (1 upsert per user per sync)

**Verdict**: Free tier friendly! 🎉

## Next Steps

After deployment:
1. ✅ Monitor logs for first 24 hours
2. ✅ Check user feedback on recovery feature
3. ✅ Consider adjusting sync interval based on usage
4. ✅ Set up alerts for error rates > 10%

## Support

- **Full Documentation**: `BACKGROUND_SYNC_IMPLEMENTATION.md`
- **Technical Details**: `GOOGLE_FIT_SYNC_OPTIMIZATION.md`
- **Supabase Docs**: https://supabase.com/docs/guides/functions/cron-jobs

---

**Status**: ✅ Ready to deploy  
**Time to deploy**: ~5 minutes  
**Complexity**: Low (copy-paste friendly)
