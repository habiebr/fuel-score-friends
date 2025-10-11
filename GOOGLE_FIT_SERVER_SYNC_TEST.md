# Testing Google Fit Server Sync

This guide will help you test the Google Fit auto-sync edge function that runs on the server to sync all users' fitness data.

## Prerequisites

1. **Service Role Key** - You need the Supabase service role key
2. **Google Fit Tokens** - At least one user must have connected Google Fit
3. **Edge Function Deployed** - The `auto-sync-google-fit` function must be deployed

## Step 1: Get Your Service Role Key

### Option A: From Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/qiwndzsrmtxmgngnupml/settings/api
2. Find the **service_role** key (NOT the anon key)
3. Copy the entire key

### Option B: Using Supabase CLI
```bash
supabase projects api-keys --project-ref qiwndzsrmtxmgngnupml
```

### Step 2: Add to Environment

Add the service role key to your `.env` file:

```bash
# Add this line to .env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-key-here...
```

## Step 3: Run the Test

### Quick Test (Check tokens and sync)
```bash
node test-google-fit-sync.js --check-tokens
```

### Sync Only
```bash
node test-google-fit-sync.js --sync-only
```

### Check Google Token Status Only
```bash
node test-google-fit-sync.js --check-only
```

## Understanding the Results

### Successful Sync Response
```json
{
  "success": true,
  "synced": 2,      // Number of users successfully synced
  "skipped": 1,     // Users skipped (recently synced within 5 min)
  "errors": 0,      // Number of errors
  "total": 3        // Total users with Google Fit connected
}
```

### What Each Status Means

- **synced**: Users whose data was successfully fetched from Google Fit and stored
- **skipped**: Users who were synced recently (within last 5 minutes) to avoid rate limiting
- **errors**: Users who had token issues or API errors
- **total**: Total number of active Google Fit connections

## Troubleshooting

### No Users Found
```
⚠️  No active Google tokens found
💡 Users need to connect Google Fit first
```
**Solution**: At least one user needs to connect their Google Fit account via the app

### Unauthorized Error
```
❌ Error: Unauthorized
```
**Solution**: Check that `SUPABASE_SERVICE_ROLE_KEY` is correctly set in `.env`

### All Users Skipped
```
✅ Sync completed successfully!
   • Users synced: 0
   • Users skipped: 3
```
**Explanation**: This is normal if the sync ran recently (within 5 minutes). The function skips recently synced users to avoid hitting Google API rate limits.

### Token Expired Errors
```
⚠️  Some users encountered errors - check the function logs
```
**Solution**: The function should automatically refresh expired tokens. If this persists, check the function logs:
```bash
supabase functions logs auto-sync-google-fit --project-ref qiwndzsrmtxmgngnupml
```

## Manual Sync via cURL

If you prefer to test with cURL:

```bash
curl -X POST \
  https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/auto-sync-google-fit \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Checking the Results in Database

After a successful sync, you can verify the data in Supabase:

1. Go to: https://supabase.com/dashboard/project/qiwndzsrmtxmgngnupml/editor
2. Open the `google_fit_data` table
3. Check for recent entries with today's date
4. Verify `last_synced_at` timestamp is recent

## Automated Sync Schedule

The function is configured to run automatically via cron:
- **Frequency**: Every 5 minutes
- **Time**: Continuous throughout the day
- **Configuration**: See `supabase/migrations/20251008010000_schedule_google_fit_sync.sql`

## Next Steps

After successful testing:

1. **Monitor the sync**: Check function logs regularly
2. **Verify data accuracy**: Compare app data with Google Fit
3. **Adjust frequency**: Modify cron schedule if needed
4. **Set up alerts**: Configure monitoring for sync failures

## Related Files

- Test Script: `test-google-fit-sync.js`
- Edge Function: `supabase/functions/auto-sync-google-fit/index.ts`
- Cron Setup: `supabase/migrations/20251008010000_schedule_google_fit_sync.sql`
- Google Fit Integration: `src/hooks/useGoogleFitSync.ts`
