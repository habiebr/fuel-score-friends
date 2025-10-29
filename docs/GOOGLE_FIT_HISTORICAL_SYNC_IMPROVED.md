# Google Fit Historical Sync - Improved Version

## The Problem We Found

Your current historical sync (`sync-historical-google-fit-data/index.ts`) **does NOT fetch session data**!

**Line 217 in the old version:**
```typescript
sessions: [], // Could be enhanced to fetch actual sessions
```

This means when you sync historical data, you get:
- ✅ Steps count
- ✅ Calories burned  
- ✅ Active minutes
- ❌ **NO SESSION INFORMATION** (no activity types, no individual workouts)

## What Sessions Give You

Sessions provide the actual workout details:
- 🏃 **Activity type** (running, cycling, swimming, etc.)
- ⏱️ **Start and end times** of each workout
- 📝 **Workout names** ("Morning Run", "Interval Training", etc.)
- 🎯 **Specific activity codes** (8 = Running, 1 = Cycling, etc.)

**Without sessions**, you just know "user burned 500 calories" but not *how* (was it running? cycling? swimming?).

**With sessions**, you know "user did a 5K run from 7am-7:30am, then cycling from 5pm-6pm".

## The Solution

I've created an **improved version** that:

### 1. Fetches Sessions from Google Fit API

```typescript
// NEW: Fetch sessions for each day
const sessionsRes = await fetch(
  `https://www.googleapis.com/fitness/v1/users/me/sessions?` +
  `startTime=${startOfDay.toISOString()}&` +
  `endTime=${endOfDay.toISOString()}`,
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);
```

### 2. Filters Exercise Activities

Uses your existing filtering logic to exclude walking and include only real workouts:
- ✅ Running, jogging, sprinting
- ✅ Cycling, swimming
- ✅ Strength training, CrossFit
- ❌ Walking, commuting

### 3. Normalizes Activity Names

Converts Google's numeric codes (8, 9, 10) to friendly names:
- `8` → "Running"
- `1` → "Cycling"  
- `169` → "Swimming"

### 4. Stores Session Data

Saves sessions to both:
- `google_fit_data` table (aggregate + sessions array)
- `google_fit_sessions` table (individual session records)

### 5. Enhanced Logging

```
📅 Fetching data from 2024-10-01 to 2024-10-30
   📊 2024-10-15: 2 sessions found
   📊 2024-10-16: 1 sessions found
   ✅ Stored 3 sessions for 2024-10-15
✅ Historical sync completed: 30 days synced
📊 Sessions found: 45 total
```

## File Comparison

### Old Version (`index.ts`)
```typescript
async function fetchDayData(...) {
  // Fetches only aggregates
  const steps = ...
  const calories = ...
  
  return {
    steps,
    caloriesBurned,
    sessions: [], // ← Empty!
    ...
  };
}
```

### New Version (`index-improved.ts`)
```typescript
async function fetchDayDataWithSessions(...) {
  // Fetches aggregates
  const steps = ...
  const calories = ...
  
  // ✨ NEW: Fetch actual sessions
  const sessionsRes = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/sessions?...'
  );
  
  const sessions = filterExerciseSessions(rawSessions);
  
  return {
    steps,
    caloriesBurned,
    sessions, // ← Now has real session data!
    ...
  };
}
```

## How to Deploy

### Option 1: Replace Existing (Recommended)

```bash
cd /Users/habiebraharjo/fuel-score-friends/supabase/functions/sync-historical-google-fit-data

# Backup old version
cp index.ts index-old.ts

# Replace with improved version
cp index-improved.ts index.ts

# Deploy
cd ..
supabase functions deploy sync-historical-google-fit-data
```

### Option 2: Deploy as New Function

```bash
cd /Users/habiebraharjo/fuel-score-friends/supabase/functions

# Create new function
mkdir sync-historical-google-fit-data-v2
cp sync-historical-google-fit-data/index-improved.ts sync-historical-google-fit-data-v2/index.ts

# Deploy
supabase functions deploy sync-historical-google-fit-data-v2
```

Then update your client code to call the new function name.

## Testing the Improved Version

### 1. Via Interactive Test

```bash
# First, update client to call new function if you deployed as v2
node test-google-fit-sync-interactive.js
```

### 2. Via Direct API Call

```bash
# Get your access token first
ACCESS_TOKEN="your-google-fit-token"
USER_TOKEN="your-supabase-user-token"

curl -X POST \
  https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/sync-historical-google-fit-data \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"accessToken\": \"$ACCESS_TOKEN\", \"daysBack\": 7}"
```

### 3. Check Results in Database

```sql
-- Check google_fit_data for sessions
SELECT 
  date, 
  steps, 
  calories_burned,
  jsonb_array_length(sessions) as session_count,
  sync_source
FROM google_fit_data
WHERE user_id = 'your-user-id'
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- Check google_fit_sessions table
SELECT 
  DATE(start_time) as date,
  activity_type,
  name,
  start_time,
  end_time,
  source
FROM google_fit_sessions
WHERE user_id = 'your-user-id'
  AND start_time >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY start_time DESC;
```

## Expected Results

### Before (Old Version)
```json
{
  "date": "2024-10-15",
  "steps": 8532,
  "calories_burned": 456,
  "sessions": []  // ← Empty!
}
```

### After (Improved Version)
```json
{
  "date": "2024-10-15",
  "steps": 8532,
  "calories_burned": 456,
  "sessions": [  // ← Now populated!
    {
      "id": "1234567890",
      "name": "Morning Run",
      "activityType": 8,
      "startTimeMillis": "1697356800000",
      "endTimeMillis": "1697358600000",
      "_activityTypeNumeric": 8
    },
    {
      "id": "1234567891", 
      "name": "Evening Cycling",
      "activityType": 1,
      "startTimeMillis": "1697392800000",
      "endTimeMillis": "1697396400000",
      "_activityTypeNumeric": 1
    }
  ]
}
```

## Key Improvements

| Feature | Old Version | Improved Version |
|---------|-------------|------------------|
| Aggregate data (steps, calories) | ✅ | ✅ |
| Session data | ❌ Empty array | ✅ **Fetched from API** |
| Activity type detection | ❌ No data | ✅ Full detection |
| Session filtering | ❌ N/A | ✅ Exercise-only |
| Activity name normalization | ❌ N/A | ✅ Friendly names |
| Session storage | ❌ Not stored | ✅ Stored in DB |
| Logging | ⚠️ Basic | ✅ Enhanced |
| Sync source tracking | ✅ | ✅ Version tracked |

## Why Some Days Still Won't Have Sessions

Even with the improved version, some days may not have sessions because:

1. **User didn't log workouts** - Just walked around without starting a workout in Google Fit
2. **Auto-detection disabled** - Google Fit's automatic workout detection was off
3. **Third-party apps** - Some apps sync raw data without creating sessions
4. **Very old data** - Pre-2015 data may lack session structure
5. **Data privacy settings** - User may have restricted session sharing

For these cases, you can use the aggregate data (steps, calories) to infer activity levels, even without specific session details.

## Next Steps

1. **Review the improved code** - Check `index-improved.ts`
2. **Test locally** (optional) - Run with `deno run` if you have Deno installed
3. **Deploy** - Use one of the deployment options above
4. **Re-sync historical data** - Run the sync again to fetch sessions
5. **Verify in database** - Check that sessions are now populated
6. **Update client** - Ensure your frontend displays session data

## Performance Notes

### Rate Limiting
The improved version adds an extra API call per day (Sessions API), so:
- **Old version**: ~5 API calls per day (aggregates)
- **New version**: ~6 API calls per day (aggregates + sessions)

This is still well within Google Fit's rate limits (100 requests per 100 seconds).

### Delays
I've added appropriate delays:
- **150ms between days** (up from 100ms) to be safe
- **100ms between database batches**

### Caching
Consider adding caching for sessions (like your fetch-google-fit-data function does) if you re-sync frequently.

## Troubleshooting

### "Sessions API returned 404"
This is normal - it means no sessions exist for that day. The code handles this gracefully.

### "Token expired"
The function will throw an error. Make sure tokens are refreshed before running historical sync.

### "Too many requests"
Reduce the batch size or increase delays:
```typescript
await new Promise(resolve => setTimeout(resolve, 200)); // Increase from 150ms
```

### Sessions still empty
1. Check if user actually logged workouts in Google Fit
2. Verify the date range has activity
3. Check API permissions include fitness.activity.read
4. Look at raw Google Fit app to see if sessions exist there

---

**Ready to deploy?** Replace the old version with the improved one and re-sync your historical data! 🚀
