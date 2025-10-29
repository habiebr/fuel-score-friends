# Google Fit API - Practical Examples

## 🎯 Sessions API - Real Examples

### Fetching Sessions for a Day

```bash
# Request
GET https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=2024-10-15T00:00:00.000Z&endTime=2024-10-15T23:59:59.999Z
Authorization: Bearer YOUR_ACCESS_TOKEN
```

```json
// Response
{
  "session": [
    {
      "id": "1697356800000",
      "name": "Morning Run",
      "description": "Easy 5K run in the park",
      "startTimeMillis": "1697356800000",
      "endTimeMillis": "1697358600000",
      "modifiedTimeMillis": "1697358700000",
      "application": {
        "packageName": "com.google.android.apps.fitness",
        "version": "1.0"
      },
      "activityType": 8,  // Running
      "activeTimeMillis": "1800000"  // 30 minutes
    },
    {
      "id": "1697392800000",
      "name": "Evening Bike Ride",
      "description": "Cycling through the city",
      "startTimeMillis": "1697392800000",
      "endTimeMillis": "1697396400000",
      "modifiedTimeMillis": "1697396500000",
      "application": {
        "packageName": "com.strava",
        "version": "1.0"
      },
      "activityType": 1,  // Cycling
      "activeTimeMillis": "3600000"  // 60 minutes
    }
  ]
}
```

### Activity Type Reference

```javascript
// Common Activity Types
const ACTIVITY_TYPES = {
  1: 'Cycling',
  7: 'Walking',
  8: 'Running',
  9: 'Jogging',
  10: 'Sprinting',
  56: 'Rock Climbing',
  57: 'Running (Sand)',
  58: 'Running (Stairs)',
  59: 'Running (Treadmill)',
  71: 'Road Biking',
  72: 'Trail Running',
  82: 'Swimming',
  112: 'CrossFit',
  116: 'HIIT',
  117: 'Spinning',
  119: 'Indoor Cycling',
  169: 'Swimming',
  170: 'Open Water Swimming',
  171: 'Pool Swimming',
  173: 'Running'
};

// In your code:
const activityName = ACTIVITY_TYPES[session.activityType] || 'Unknown';
```

## 📊 Aggregate Data API

### Fetching Daily Totals

```bash
# Request
POST https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

```json
// Request Body
{
  "aggregateBy": [
    { "dataTypeName": "com.google.step_count.delta" },
    { "dataTypeName": "com.google.calories.expended" },
    { "dataTypeName": "com.google.distance.delta" },
    { "dataTypeName": "com.google.active_minutes" }
  ],
  "bucketByTime": { 
    "durationMillis": 86400000  // 24 hours
  },
  "startTimeMillis": 1697328000000,  // 2024-10-15 00:00:00
  "endTimeMillis": 1697414400000     // 2024-10-16 00:00:00
}
```

```json
// Response
{
  "bucket": [
    {
      "startTimeMillis": "1697328000000",
      "endTimeMillis": "1697414400000",
      "dataset": [
        {
          "dataSourceId": "...",
          "point": [
            {
              "startTimeNanos": "1697328000000000000",
              "endTimeNanos": "1697414400000000000",
              "dataTypeName": "com.google.step_count.delta",
              "value": [
                { "intVal": 8532 }  // Steps
              ]
            }
          ]
        },
        {
          "dataSourceId": "...",
          "point": [
            {
              "startTimeNanos": "1697328000000000000",
              "endTimeNanos": "1697414400000000000",
              "dataTypeName": "com.google.calories.expended",
              "value": [
                { "fpVal": 456.7 }  // Calories
              ]
            }
          ]
        },
        {
          "dataSourceId": "...",
          "point": [
            {
              "startTimeNanos": "1697328000000000000",
              "endTimeNanos": "1697414400000000000",
              "dataTypeName": "com.google.distance.delta",
              "value": [
                { "fpVal": 6820.5 }  // Meters
              ]
            }
          ]
        },
        {
          "dataSourceId": "...",
          "point": [
            {
              "startTimeNanos": "1697328000000000000",
              "endTimeNanos": "1697414400000000000",
              "dataTypeName": "com.google.active_minutes",
              "value": [
                { "intVal": 45 }  // Minutes
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## 🔧 Complete TypeScript Example

### Historical Sync with Sessions

```typescript
async function syncDayWithSessions(
  accessToken: string,
  date: Date
): Promise<DayData> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Fetch aggregate data
  const aggregateRes = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' },
          { dataTypeName: 'com.google.calories.expended' },
          { dataTypeName: 'com.google.active_minutes' },
          { dataTypeName: 'com.google.distance.delta' }
        ],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startOfDay.getTime(),
        endTimeMillis: endOfDay.getTime()
      })
    }
  );

  const aggregateData = await aggregateRes.json();
  const bucket = aggregateData.bucket?.[0];

  const steps = bucket?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
  const calories = bucket?.dataset?.[1]?.point?.[0]?.value?.[0]?.fpVal || 0;
  const activeMinutes = bucket?.dataset?.[2]?.point?.[0]?.value?.[0]?.intVal || 0;
  const distance = bucket?.dataset?.[3]?.point?.[0]?.value?.[0]?.fpVal || 0;

  // 2. Fetch sessions
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

  // 3. Filter and normalize sessions
  const exerciseSessions = sessions.filter(s => {
    const activityType = Number(s.activityType);
    // Exclude walking (7)
    if (activityType === 7) return false;
    // Include running, cycling, etc.
    return [1, 8, 9, 10, 82, 112, 116, 117].includes(activityType);
  });

  const normalizedSessions = exerciseSessions.map(s => ({
    id: s.id,
    name: s.name || ACTIVITY_TYPES[s.activityType] || 'Workout',
    activityType: s.activityType,
    startTime: new Date(Number(s.startTimeMillis)),
    endTime: new Date(Number(s.endTimeMillis)),
    duration: (Number(s.endTimeMillis) - Number(s.startTimeMillis)) / 60000, // minutes
    description: s.description
  }));

  return {
    date: startOfDay.toISOString().split('T')[0],
    steps,
    calories,
    activeMinutes,
    distance,
    sessions: normalizedSessions
  };
}
```

### Usage Example

```typescript
// Sync last 7 days with sessions
async function syncLastWeek(accessToken: string) {
  const results = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const dayData = await syncDayWithSessions(accessToken, date);
    results.push(dayData);
    
    console.log(`${dayData.date}: ${dayData.sessions.length} sessions`);
    dayData.sessions.forEach(s => {
      console.log(`  - ${s.name} (${s.duration} min)`);
    });
    
    // Respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}
```

## 🧪 Testing API Calls

### Using cURL

```bash
# 1. Get sessions for today
curl "https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=$(date -u +%Y-%m-%dT00:00:00.000Z)&endTime=$(date -u +%Y-%m-%dT23:59:59.999Z)" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 2. Get steps for today
curl -X POST "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "aggregateBy": [{"dataTypeName": "com.google.step_count.delta"}],
    "bucketByTime": {"durationMillis": 86400000},
    "startTimeMillis": '$(date -u +%s000 -d "today 00:00")',
    "endTimeMillis": '$(date -u +%s000 -d "today 23:59")'
  }'
```

### Using Postman

**Request 1: Get Sessions**
```
GET https://www.googleapis.com/fitness/v1/users/me/sessions
Query Params:
  startTime: 2024-10-15T00:00:00.000Z
  endTime: 2024-10-15T23:59:59.999Z
Headers:
  Authorization: Bearer {{access_token}}
```

**Request 2: Get Aggregates**
```
POST https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate
Headers:
  Authorization: Bearer {{access_token}}
  Content-Type: application/json
Body (JSON):
{
  "aggregateBy": [
    {"dataTypeName": "com.google.step_count.delta"}
  ],
  "bucketByTime": {"durationMillis": 86400000},
  "startTimeMillis": 1697328000000,
  "endTimeMillis": 1697414400000
}
```

## 🐛 Common Issues

### Issue 1: Empty Sessions Array

```json
{
  "session": []  // No sessions found
}
```

**Possible reasons:**
1. User didn't log any workouts that day
2. Date range is wrong (check timezone)
3. No activities recorded in Google Fit
4. User's auto-detection is off

**Solution:**
```typescript
// Always check if sessions exist
if (!sessionsData.session || sessionsData.session.length === 0) {
  console.log('No sessions found - using aggregate data only');
  // Fall back to aggregate metrics
}
```

### Issue 2: 401 Unauthorized

```json
{
  "error": {
    "code": 401,
    "message": "Invalid Credentials"
  }
}
```

**Solution:**
```typescript
// Refresh the access token
const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })
});

const newToken = await refreshRes.json();
accessToken = newToken.access_token;
```

### Issue 3: Rate Limit Exceeded

```json
{
  "error": {
    "code": 429,
    "message": "Rate Limit Exceeded"
  }
}
```

**Solution:**
```typescript
// Add delays between requests
for (const day of days) {
  await syncDay(day);
  await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
}
```

## 📋 Checklist for Implementation

- [ ] Fetch aggregate data (steps, calories, distance)
- [ ] Fetch sessions data
- [ ] Filter out excluded activities (walking, commuting)
- [ ] Normalize activity type codes to names
- [ ] Store sessions in database
- [ ] Handle missing sessions gracefully
- [ ] Add appropriate delays for rate limiting
- [ ] Implement token refresh logic
- [ ] Log sync progress
- [ ] Handle errors properly

## 🎯 Best Practices

1. **Always fetch both aggregates and sessions** for complete data
2. **Filter sessions** to exclude non-exercise activities
3. **Normalize activity types** for better UX
4. **Add delays** to respect rate limits (100-200ms between requests)
5. **Handle token expiry** with automatic refresh
6. **Cache responses** when appropriate
7. **Store raw session data** for future processing
8. **Log everything** for debugging
9. **Graceful degradation** when sessions are missing
10. **Validate responses** before storing

---

**Now you have practical, working examples of the Google Fit API!** 🚀

Use these examples as reference when implementing or debugging your sync functions.
