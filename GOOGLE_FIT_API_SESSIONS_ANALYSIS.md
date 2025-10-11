# Google Fit API Deep Dive: Understanding Session Data Issues

## Problem Analysis

You're experiencing an issue where **historical Google Fit data often lacks session information**, making it difficult to determine activity types. Let me explain why this happens and how to fix it.

## Why Sessions Are Missing in Historical Data

### Current Implementation Issues

Looking at your code in `supabase/functions/sync-historical-google-fit-data/index.ts`, I found the problem:

**Line 217 in `fetchDayData()` function:**
```typescript
sessions: [], // Could be enhanced to fetch actual sessions
```

**The historical sync is NOT fetching sessions at all!** It only fetches:
- Steps (aggregate)
- Calories (aggregate)
- Active minutes (aggregate)
- Heart rate (aggregate)
- Distance (aggregate)

But it **never calls the Sessions API** to get the actual workout/activity sessions.

### Why This Matters

Without session data, you have:
- ✅ Total steps for the day
- ✅ Total calories burned
- ✅ Total active minutes
- ❌ **No idea WHAT activities were performed**
- ❌ **No individual workout details**
- ❌ **No activity types** (run, bike, swim, etc.)

## Google Fit API Structure

### Two Main Data Types:

1. **Aggregated Data** (what you're currently getting)
   - Total steps, calories, distance for a time period
   - No context about individual activities
   - Good for daily totals, but lacks detail

2. **Session Data** (what you're missing)
   - Individual workout sessions
   - Activity type (running, cycling, swimming, etc.)
   - Start/end times
   - Session-specific metrics

### Google Fit Sessions API

**Endpoint:**
```
GET https://www.googleapis.com/fitness/v1/users/me/sessions
```

**Query Parameters:**
- `startTime` - ISO 8601 timestamp
- `endTime` - ISO 8601 timestamp
- `activityType` - (optional) Filter by activity type

**Example Response:**
```json
{
  "session": [
    {
      "id": "1234567890",
      "name": "Morning Run",
      "description": "Easy 5K",
      "startTimeMillis": "1633075200000",
      "endTimeMillis": "1633077000000",
      "activityType": 8,  // 8 = Running
      "application": {
        "packageName": "com.google.android.apps.fitness"
      }
    }
  ]
}
```

## The Fix: Enhanced Historical Sync

I'll create an improved version of your historical sync that properly fetches sessions:

### Key Changes Needed:

1. **Fetch sessions for each day** using the Sessions API
2. **Normalize activity types** using your existing activity mapping
3. **Filter exercise sessions** (exclude walking, etc.)
4. **Store session data** in the database
5. **Calculate session-specific metrics** (distance per activity)

## Activity Type Codes (Google Fit)

Google Fit uses numeric codes for activities. Here are the main ones:

| Code | Activity | Code | Activity |
|------|----------|------|----------|
| 1 | Aerobics | 56 | Rock climbing |
| 5 | Basketball | 57 | Running (sand) |
| 7 | Walking | 58 | Running (stairs) |
| 8 | Running | 59 | Running (treadmill) |
| 9 | Jogging | 71 | Road biking |
| 10 | Sprinting | 72 | Trail running |
| 1 | Cycling | 82 | Swimming |
| 14 | Dancing | 112 | CrossFit |
| 15 | Elliptical | 116 | HIIT |
| 19 | Football | 117 | Spinning |
| 26 | Golf | 119 | Indoor cycling |
| 38 | Hiking | 169 | Swimming (general) |
| 46 | Pilates | 170 | Swimming (open water) |
| 48 | Rowing | 171 | Swimming (pool) |
| 52 | Skiing | 173 | Running (general) |

## Why Some Historical Data Lacks Sessions

### Common Reasons:

1. **Not Fetched** (your current issue)
   - Your code doesn't call the Sessions API for historical data

2. **User Never Created Sessions**
   - User just walked around without logging workouts
   - Phone tracked steps automatically, but no explicit "workout" was started

3. **Data Source Differences**
   - Some apps write raw sensor data (steps) without creating sessions
   - Google Fit auto-detects some activities but may not create formal sessions

4. **Time Period**
   - Very old data may have been recorded before apps created proper sessions
   - Data retention policies

5. **Third-Party Apps**
   - Some fitness apps sync data to Google Fit but don't create sessions
   - They just dump aggregate numbers

## Solution Strategy

### Approach 1: Fetch Sessions (Recommended)

**Modify historical sync to fetch sessions:**

```typescript
async function fetchDayData(accessToken: string, startOfDay: Date, endOfDay: Date) {
  // ... existing aggregate fetching ...
  
  // ADD: Fetch sessions for this day
  const sessionsRes = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/sessions?` +
    `startTime=${startOfDay.toISOString()}&` +
    `endTime=${endOfDay.toISOString()}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  
  let sessions = [];
  if (sessionsRes.ok) {
    const sessionsData = await sessionsRes.json();
    sessions = sessionsData.session || [];
  }
  
  // Filter and normalize sessions (use your existing logic)
  const filteredSessions = filterExerciseSessions(sessions);
  
  return {
    steps,
    caloriesBurned,
    activeMinutes,
    distanceMeters,
    heartRateAvg,
    sessions: filteredSessions, // ← Now has actual sessions!
    date: startOfDay.toISOString().split('T')[0]
  };
}
```

### Approach 2: Infer Activity from Metrics

When sessions are truly missing (not just unfetched), you can infer activity:

```typescript
function inferActivityType(data: {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distanceMeters: number;
}) {
  // High calories + distance + steps = likely running/cycling
  if (data.caloriesBurned > 300 && data.distanceMeters > 3000) {
    const pace = data.distanceMeters / (data.activeMinutes / 60); // meters per minute
    if (pace > 100) {
      return 'running'; // ~6+ min/km
    } else if (pace > 50) {
      return 'cycling';
    }
  }
  
  // High active minutes but low distance = stationary exercise
  if (data.activeMinutes > 30 && data.distanceMeters < 500) {
    return 'strength_training';
  }
  
  return 'general_activity';
}
```

### Approach 3: Use Detailed Segment Data

Google Fit also has a **segment** endpoint that provides minute-by-minute data:

```typescript
const segmentRes = await fetch(
  'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      aggregateBy: [
        { dataTypeName: 'com.google.activity.segment' }
      ],
      bucketByTime: { durationMillis: 60000 }, // 1-minute buckets
      startTimeMillis: startOfDay.getTime(),
      endTimeMillis: endOfDay.getTime()
    })
  }
);
```

This gives you minute-by-minute activity types, which you can use to reconstruct sessions.

## Implementation Plan

I'll create an enhanced version of your historical sync function that:

1. ✅ Fetches session data properly
2. ✅ Filters exercise activities
3. ✅ Normalizes activity types
4. ✅ Handles missing sessions gracefully
5. ✅ Stores complete data

Would you like me to create the improved version now?

## Additional Google Fit API Resources

### Official Documentation
- [Sessions API](https://developers.google.com/fit/rest/v1/sessions)
- [Data Types](https://developers.google.com/fit/datatypes)
- [Activity Types](https://developers.google.com/fit/scenarios/activity-types)

### Key Endpoints

**List Sessions:**
```
GET /fitness/v1/users/{userId}/sessions
```

**Get Session Details:**
```
GET /fitness/v1/users/{userId}/sessions/{sessionId}
```

**Get Data During Session:**
```
POST /fitness/v1/users/{userId}/dataset:aggregate
```

### Rate Limits
- **100 requests per 100 seconds per user**
- **10,000 requests per day per project**

That's why your current implementation adds delays between requests!

## Next Steps

1. **Review the analysis** - Does this explain your issue?
2. **Choose approach** - Fetch sessions (recommended) or infer from metrics?
3. **Implement fix** - I can create the improved code
4. **Test** - Run historical sync with session fetching
5. **Verify** - Check database for session data

Let me know which approach you'd like to pursue!
