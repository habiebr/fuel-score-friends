# Weekly Kilometers Showing 0 - Debug Analysis

## Issue
The weekly kilometers widget shows 0 km despite the API returning correct data:
```json
{
  "user_id":"8c2006e2-5512-4865-ba05-618cf2161ec1",
  "distance_meters":8540.769659622349,
  "session_count":2
}
```

This should display as **8.54 km** but shows **0 km**.

## Root Cause Analysis

### Potential Issues:

1. **Cache Timing Problem** ⭐ Most Likely
   - The cache is loaded first with old data (0 km)
   - Sets `weeklyGoogleFitData` to `{ current: 0, target: 30 }`
   - API call happens but results might not be updating the state
   
2. **API Response Structure**
   - Code expects `weeklyRunningData.entries` array
   - Your API returns this correctly
   
3. **User ID Mismatch**
   - Code filters by `user_id === user.id`
   - Need to verify IDs match exactly

## Code Flow

```typescript
// Step 1: Cache loaded (potentially stale data)
const cached = readDashboardCache(user.id);
setWeeklyGoogleFitData(weekly?.weeklyKm || { current: 0, target: 30 }); // Sets to 0

// Step 2: API call (fresh data)
const weeklyRunningData = await supabase.functions.invoke('weekly-running-leaderboard');
const entry = weeklyRunningData?.entries?.find(e => e.user_id === user.id);
weeklyKm = (Number(entry?.distance_meters) || 0) / 1000; // 8.54
setWeeklyGoogleFitData({ current: weeklyKm, target: 30 }); // Should set to 8.54
```

## Debug Steps Added

Added console logs to track:
1. Week start date being queried
2. User ID being searched for
3. Full API response
4. Entry found for user
5. Calculated weekly kilometers

## Next Steps

1. **Check Browser Console** - Look for the 🏃 emoji logs to see:
   - Is the API being called?
   - What data is returned?
   - Is the entry found?
   - What is the calculated value?

2. **Clear Cache** - Try:
   ```javascript
   localStorage.clear();
   ```
   Then refresh to see if it shows correct value

3. **Check Network Tab** - Verify the API call to `weekly-running-leaderboard`

## Expected Console Output

```
🏃 Fetching weekly running distance for week: 2025-10-06 user: 8c2006e2-5512-4865-ba05-618cf2161ec1
🏃 Weekly running API response: {week_start: "2025-10-06", week_end: "2025-10-12", entries: Array(2)}
🏃 Found entry for user: {user_id: "8c2006e2-5512-4865-ba05-618cf2161ec1", distance_meters: 8540.769659622349, session_count: 2}
🏃 Weekly kilometers calculated: 8.540769659622349
```

## Temporary Fix

If cache is the issue, you can force a refresh by:
1. Open browser console
2. Run: `localStorage.removeItem('dashboard-cache-your-user-id')`
3. Refresh page

## Permanent Fix (if cache is confirmed as issue)

We may need to:
1. Add a timestamp to cache and invalidate after X minutes
2. Always show fresh API data regardless of cache
3. Only use cache for initial render, then replace with API data
