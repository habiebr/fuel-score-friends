# Google Fit Server Sync - Testing Summary

## What We Created

I've set up comprehensive testing tools for your Google Fit server-side auto-sync functionality:

### 1. **Interactive Test Script** (Recommended)
📄 `test-google-fit-sync-interactive.js`

**Features:**
- Step-by-step guided testing
- Checks environment setup
- Shows Google Fit connection status
- Tests the sync function
- Provides helpful error messages

**Usage:**
```bash
node test-google-fit-sync-interactive.js
```

### 2. **Command-Line Test Script**
📄 `test-google-fit-sync.js`

**Features:**
- Quick testing with options
- Check token status
- Run sync tests
- View sync results

**Usage:**
```bash
# Check tokens and run sync
node test-google-fit-sync.js --check-tokens

# Just sync
node test-google-fit-sync.js --sync-only

# Help
node test-google-fit-sync.js --help
```

### 3. **Complete Testing Guide**
📄 `GOOGLE_FIT_SERVER_SYNC_TEST.md`

Full documentation covering:
- Prerequisites
- How to get service role key
- How to run tests
- Understanding results
- Troubleshooting
- Manual testing with cURL

## What You Need Before Testing

### 1. Service Role Key

You need to get this from Supabase:

**Option A: Dashboard**
1. Go to: https://supabase.com/dashboard/project/qiwndzsrmtxmgngnupml/settings/api
2. Copy the **service_role** key (NOT the anon key)
3. Add to `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your-key-here
   ```

**Option B: CLI**
```bash
supabase projects api-keys --project-ref qiwndzsrmtxmgngnupml
```

⚠️ **IMPORTANT**: The service role key has admin access. Never share it or commit it to Git!

### 2. Google Fit Connection

At least one user must have connected Google Fit via the app for meaningful testing.

## Quick Start

1. **Get your service role key** (see above)

2. **Add it to .env file:**
   ```bash
   echo "SUPABASE_SERVICE_ROLE_KEY=your-key-here" >> .env
   ```

3. **Run the interactive test:**
   ```bash
   node test-google-fit-sync-interactive.js
   ```

4. **Follow the prompts** - the script will guide you through everything!

## What the Sync Function Does

The `auto-sync-google-fit` edge function:

1. **Finds all users** with active Google Fit connections
2. **Checks last sync time** - skips if synced within 5 minutes
3. **Refreshes tokens** if expired
4. **Fetches data** from Google Fit API:
   - Steps
   - Calories burned
   - Distance
   - Active minutes
5. **Stores in database** - `google_fit_data` table
6. **Returns results** - synced, skipped, errors count

## Expected Results

### Successful Sync
```json
{
  "success": true,
  "synced": 2,      // Successfully synced
  "skipped": 1,     // Recently synced (within 5 min)
  "errors": 0,      // No errors
  "total": 3        // Total users with Google Fit
}
```

### Normal Scenarios

**All Skipped (Good)**
```
Users synced: 0
Users skipped: 3
```
This is normal if the sync ran recently. Prevents API rate limiting.

**Mix of Results**
```
Users synced: 2
Users skipped: 1
Errors: 0
```
Perfect! Most users synced, one was recently updated.

**Some Errors**
```
Users synced: 2
Users skipped: 0
Errors: 1
```
Check function logs to see what went wrong:
```bash
supabase functions logs auto-sync-google-fit
```

## Verification After Sync

After successful sync, verify in Supabase dashboard:

1. Go to: https://supabase.com/dashboard/project/qiwndzsrmtxmgngnupml/editor
2. Open `google_fit_data` table
3. Check for:
   - Today's date entries
   - Recent `last_synced_at` timestamps
   - Step counts and calories data

## Automated Sync

The function runs automatically:
- **Frequency**: Every 5 minutes (via cron)
- **Configuration**: `supabase/migrations/20251008010000_schedule_google_fit_sync.sql`
- **No manual intervention needed** once deployed

## Troubleshooting

### "Service role key not found"
→ Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` file

### "No active Google Fit connections"
→ At least one user needs to connect Google Fit in the app

### "Unauthorized"
→ Check that service role key is correct

### All users skipped
→ Normal if synced recently (within 5 minutes)

### Token refresh errors
→ Check function logs for details

## Manual Testing (cURL)

If you prefer command-line testing:

```bash
curl -X POST \
  https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/auto-sync-google-fit \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Files Reference

| File | Purpose |
|------|---------|
| `test-google-fit-sync-interactive.js` | Interactive guided test |
| `test-google-fit-sync.js` | CLI test with options |
| `GOOGLE_FIT_SERVER_SYNC_TEST.md` | Complete documentation |
| `supabase/functions/auto-sync-google-fit/index.ts` | The actual sync function |

## Next Steps

1. ✅ Get service role key
2. ✅ Add to `.env` file
3. ✅ Run interactive test
4. ✅ Verify results in dashboard
5. ✅ Monitor automated syncs
6. ✅ Set up error alerts (optional)

## Support

For issues or questions:
- Check `GOOGLE_FIT_SERVER_SYNC_TEST.md` for detailed troubleshooting
- View function logs: `supabase functions logs auto-sync-google-fit`
- Check Supabase dashboard for database state

---

**Ready to test?** Run `node test-google-fit-sync-interactive.js` and follow the prompts! 🚀
