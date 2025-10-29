# One-Time Historical Resync - Add Session Data

## What This Does

This script adds session data to existing Google Fit historical records for all users. It:

1. ✅ Finds all users with Google Fit connected
2. ✅ Fetches their existing records (last 30 days)
3. ✅ Gets session data from Google Fit API
4. ✅ Updates records to include sessions
5. ✅ Stores sessions in `google_fit_sessions` table

## Before Running

### 1. Ensure Environment Variables

Make sure your `.env` file has:

```bash
VITE_SUPABASE_URL=https://qiwndzsrmtxmgngnupml.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
VITE_GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. Get Service Role Key

If you don't have `SUPABASE_SERVICE_ROLE_KEY` in `.env`:

1. Go to: https://supabase.com/dashboard/project/qiwndzsrmtxmgngnupml/settings/api
2. Copy the **service_role** key
3. Add to `.env`:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your-key-here
   ```

## How to Run

### Simple - Just Run It

```bash
node resync-historical-sessions.js
```

### What You'll See

```
╔════════════════════════════════════════════════════════╗
║   One-Time Historical Resync - Add Session Data       ║
╚════════════════════════════════════════════════════════╝

⚙️  Configuration:
   • Days back: 30
   • Supabase URL: https://qiwndzsrmtxmgngnupml.supabase.co

🔍 Finding users with Google Fit connected...
✅ Found 3 user(s) with Google Fit connected

[1/3] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Processing user 12345678...
  📋 Found 25 existing records
  ✅ 2024-10-10: Added 2 session(s)
  ✅ 2024-10-09: Added 1 session(s)
  ✅ 2024-10-08: Added 3 session(s)
  🎯 Updated 15 days with 28 total sessions

[2/3] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Processing user 87654321...
  📋 Found 30 existing records
  ✅ 2024-10-10: Added 1 session(s)
  🎯 Updated 10 days with 12 total sessions

╔════════════════════════════════════════════════════════╗
║                    RESYNC COMPLETE                     ║
╚════════════════════════════════════════════════════════╝

📊 Summary:
   • Users processed:     3
   • Successful:          3
   • Errors:              0
   • Days updated:        25
   • Sessions added:      40

✨ Successfully added 40 workout sessions!
```

## Configuration

You can modify these constants in the script:

```javascript
// How many days back to resync (default: 30)
const DAYS_BACK = 30;

// Which activities to include (default: exercise only, no walking)
const EXERCISE_ACTIVITY_CODES = new Set([
  1, 8, 9, 10, // Cycling, Running, Jogging, Sprinting
  56, 57, 58, 59, // Climbing, Beach/Stair/Treadmill Running
  71, 72, // Road Biking, Trail Running
  82, // Swimming
  112, 116, 117, 119, // CrossFit, HIIT, Spinning, Indoor Cycling
  169, 170, 171, 173 // Various Swimming, Running
]);
```

## What Gets Updated

### google_fit_data Table

```sql
-- Before
{
  "date": "2024-10-15",
  "steps": 8532,
  "sessions": []  -- Empty
}

-- After
{
  "date": "2024-10-15",
  "steps": 8532,
  "sessions": [
    {
      "id": "1697356800000",
      "name": "Running",
      "activityType": 8,
      "startTimeMillis": "1697356800000",
      "endTimeMillis": "1697358600000"
    }
  ]
}
```

### google_fit_sessions Table

New records added:
```sql
INSERT INTO google_fit_sessions (
  user_id, session_id, activity_type, 
  start_time, end_time, source
)
```

## Verify Results

### Check Updated Records

```sql
-- See which days now have sessions
SELECT 
  date,
  steps,
  jsonb_array_length(sessions) as session_count,
  sync_source
FROM google_fit_data
WHERE user_id = 'your-user-id'
  AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;
```

### Check Sessions Table

```sql
-- See individual sessions
SELECT 
  DATE(start_time) as date,
  activity_type,
  name,
  start_time,
  end_time,
  source
FROM google_fit_sessions
WHERE user_id = 'your-user-id'
  AND source = 'google_fit_resync'
ORDER BY start_time DESC;
```

### Count Total Sessions Added

```sql
-- Total sessions added across all users
SELECT COUNT(*) as total_sessions
FROM google_fit_sessions
WHERE source = 'google_fit_resync';
```

## Troubleshooting

### No sessions added

**Reason**: Records already have sessions or no workouts exist
**Solution**: Normal if data was already synced or users didn't log workouts

### Token expired errors

**Reason**: Google Fit token expired and refresh failed
**Solution**: The script auto-refreshes tokens, but if it fails, user needs to reconnect Google Fit

### Rate limit errors

**Reason**: Too many API calls too fast
**Solution**: Script has built-in delays (100ms between days, 500ms between users)

### Missing environment variables

**Reason**: `.env` file incomplete
**Solution**: Add required variables (see "Before Running" section)

## Safety Notes

- ✅ **Idempotent**: Can run multiple times safely
- ✅ **Skip existing**: Won't overwrite records that already have sessions
- ✅ **Non-destructive**: Only adds data, doesn't remove anything
- ✅ **Rate limited**: Respects Google Fit API limits
- ✅ **Error handling**: Continues processing other users if one fails

## What Gets Excluded

The script excludes:
- ❌ Walking (activity code 7)
- ❌ Commuting
- ❌ Non-exercise activities

Only includes:
- ✅ Running, jogging, sprinting
- ✅ Cycling, biking
- ✅ Swimming
- ✅ CrossFit, HIIT, spinning
- ✅ Other exercise activities

## Performance

- **Time**: ~1-2 seconds per user per day with sessions
- **API calls**: ~1 call per day per user
- **Database**: Batch updates for efficiency
- **Memory**: Processes users sequentially

For 3 users with 30 days each:
- Total time: ~2-3 minutes
- API calls: ~90 calls
- Well within rate limits

## After Running

1. ✅ Verify data in Supabase dashboard
2. ✅ Check that `sessions` column is populated
3. ✅ Update frontend to display session data
4. ✅ Test activity type detection in your app

## Next Steps

After successful resync:

1. **Deploy improved sync function** (so new data includes sessions)
   ```bash
   cd supabase/functions/sync-historical-google-fit-data
   cp index-improved.ts index.ts
   supabase functions deploy sync-historical-google-fit-data
   ```

2. **Update frontend** to show workout sessions

3. **Add activity-specific features** (run pace, cycling distance, etc.)

## Need Help?

- Check the main documentation: `GOOGLE_FIT_INVESTIGATION_SUMMARY.md`
- Review API examples: `GOOGLE_FIT_API_EXAMPLES.md`
- See the index: `GOOGLE_FIT_DOCS_INDEX.md`

---

**Ready to run?** Just execute: `node resync-historical-sessions.js` 🚀
