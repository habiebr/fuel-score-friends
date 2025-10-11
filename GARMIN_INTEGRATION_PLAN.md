# Garmin Integration Research & Implementation Plan

## Overview

Garmin Connect is a fitness tracking platform similar to Google Fit. This document outlines how we can integrate Garmin into NutriSync.

## Garmin Health API

### Official API
- **Name**: Garmin Health API
- **Documentation**: https://developer.garmin.com/health-api/
- **OAuth**: OAuth 1.0a (older protocol than OAuth 2.0 used by Google)
- **Data Types Available**:
  - Daily summaries (steps, calories, distance, active minutes)
  - Activities (runs, rides, swims, strength training)
  - Sleep data
  - Heart rate data
  - Body composition (weight, BMI)
  - Stress and respiration

### API Access Requirements
1. **Developer Account**:
   - Register at https://developer.garmin.com
   - Apply for Health API access
   - Wait for approval (can take several days)

2. **OAuth 1.0a Setup**:
   - Consumer Key
   - Consumer Secret
   - Request Token URL
   - Access Token URL
   - Authorization URL

3. **Scopes**:
   - `WELLNESS_READ` - Daily summaries
   - `ACTIVITIES_READ` - Activity data
   - `SLEEP_READ` - Sleep data
   - `STRESS_READ` - Stress data

## Comparison: Garmin vs Google Fit

| Feature | Google Fit | Garmin Connect |
|---------|-----------|----------------|
| OAuth | OAuth 2.0 | OAuth 1.0a |
| API Complexity | Moderate | Moderate-High |
| Data Quality | Good | Excellent |
| User Base | Very Large | Large (serious athletes) |
| Real-time Sync | Yes | Yes |
| Approval Process | Automatic | Manual (3-7 days) |
| Rate Limits | 1000 req/day | Varies by tier |

## Implementation Architecture

### Option 1: Parallel Integration (Recommended)
Keep both Google Fit and Garmin as separate data sources.

```
┌─────────────┐     ┌──────────────┐
│ Google Fit  │     │   Garmin     │
└──────┬──────┘     └──────┬───────┘
       │                   │
       ├───────────┬───────┤
       │           │       │
       ▼           ▼       ▼
  ┌────────────────────────────┐
  │  Unified Data Layer        │
  │  (wearable_data table)     │
  └────────────┬───────────────┘
               │
               ▼
          Dashboard
```

### Option 2: Primary/Fallback
Use one as primary, other as fallback.

```
Try Garmin → If no data → Try Google Fit → If no data → Manual input
```

## Database Schema

### Modify existing `google_fit_data` table → `wearable_data`

```sql
-- Rename table to be vendor-agnostic
ALTER TABLE google_fit_data RENAME TO wearable_data;

-- Add source column if not exists
ALTER TABLE wearable_data 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'google_fit';

-- Create index for source
CREATE INDEX IF NOT EXISTS idx_wearable_data_source 
ON wearable_data(source);

-- Update source values
-- 'google_fit' | 'garmin' | 'apple_health'
```

### New table: `garmin_tokens`

```sql
CREATE TABLE IF NOT EXISTS public.garmin_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- OAuth 1.0a tokens
  oauth_token TEXT NOT NULL,
  oauth_token_secret TEXT NOT NULL,
  
  -- User identifiers
  garmin_user_id TEXT,
  garmin_user_access_token TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.garmin_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can manage their own Garmin tokens"
  ON public.garmin_tokens
  FOR ALL
  USING (auth.uid() = user_id);
```

## Implementation Steps

### Phase 1: Setup (Week 1)
- [ ] Register for Garmin Developer account
- [ ] Apply for Health API access
- [ ] Wait for approval
- [ ] Set up OAuth 1.0a credentials
- [ ] Create test Garmin account

### Phase 2: Backend (Week 2)
- [ ] Create `garmin_tokens` table
- [ ] Rename `google_fit_data` to `wearable_data`
- [ ] Create Supabase Edge Function: `garmin-oauth-callback`
- [ ] Create Supabase Edge Function: `sync-garmin-data`
- [ ] Implement OAuth 1.0a flow
- [ ] Test data fetching from Garmin API

### Phase 3: Frontend (Week 3)
- [ ] Create `useGarminSync` hook (similar to `useGoogleFitSync`)
- [ ] Update `AppIntegrations` page with Garmin option
- [ ] Add "Connect Garmin" button
- [ ] Update Dashboard to show Garmin data
- [ ] Handle both Google Fit and Garmin data sources

### Phase 4: Data Reconciliation (Week 4)
- [ ] Priority logic: Which data source wins?
- [ ] Deduplication: Avoid counting same activity twice
- [ ] Conflict resolution: Handle overlapping data
- [ ] Testing with users who have both connected

## Code Examples

### 1. OAuth 1.0a Flow (Edge Function)

```typescript
// supabase/functions/garmin-oauth-start/index.ts
import { OAuth } from 'oauth-1.0a';
import crypto from 'crypto';

const oauth = new OAuth({
  consumer: {
    key: Deno.env.get('GARMIN_CONSUMER_KEY')!,
    secret: Deno.env.get('GARMIN_CONSUMER_SECRET')!
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto
      .createHmac('sha1', key)
      .update(base_string)
      .digest('base64');
  }
});

serve(async (req) => {
  // Step 1: Get request token
  const requestData = {
    url: 'https://connectapi.garmin.com/oauth-service/oauth/request_token',
    method: 'POST'
  };
  
  const requestToken = await fetch(requestData.url, {
    method: requestData.method,
    headers: oauth.toHeader(oauth.authorize(requestData))
  });
  
  // Step 2: Redirect user to authorization page
  const authUrl = `https://connect.garmin.com/oauthConfirm?oauth_token=${token}`;
  
  return new Response(JSON.stringify({ authUrl }));
});
```

### 2. Fetch Garmin Data

```typescript
// supabase/functions/sync-garmin-data/index.ts
serve(async (req) => {
  const { userId, date } = await req.json();
  
  // Get Garmin tokens
  const { data: tokens } = await supabase
    .from('garmin_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  // Fetch daily summary
  const summaryUrl = `https://apis.garmin.com/wellness-api/rest/dailies/${date}`;
  const summaryData = await fetchWithOAuth(summaryUrl, tokens);
  
  // Fetch activities
  const activitiesUrl = `https://apis.garmin.com/wellness-api/rest/activities`;
  const activitiesData = await fetchWithOAuth(activitiesUrl, tokens);
  
  // Save to wearable_data table
  await supabase
    .from('wearable_data')
    .upsert({
      user_id: userId,
      date,
      source: 'garmin',
      steps: summaryData.totalSteps,
      calories_burned: summaryData.totalKilocalories,
      distance_meters: summaryData.totalDistanceMeters,
      active_minutes: summaryData.activeTimeInSeconds / 60,
      sessions: activitiesData
    });
});
```

### 3. Frontend Hook

```typescript
// src/hooks/useGarminSync.ts
export function useGarminSync() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  const connectGarmin = async () => {
    // Start OAuth flow
    const { data } = await supabase.functions.invoke('garmin-oauth-start');
    window.location.href = data.authUrl;
  };
  
  const syncGarmin = async () => {
    setIsSyncing(true);
    const today = new Date().toISOString().split('T')[0];
    
    await supabase.functions.invoke('sync-garmin-data', {
      body: { userId: user.id, date: today }
    });
    
    setIsSyncing(false);
    setLastSync(new Date());
  };
  
  return { isConnected, isSyncing, lastSync, connectGarmin, syncGarmin };
}
```

### 4. UI Component

```typescript
// src/pages/AppIntegrations.tsx
<Card>
  <CardContent className="p-6">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
        <Watch className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold">Garmin Connect</h3>
        <p className="text-sm text-muted-foreground">
          {isGarminConnected ? 'Connected' : 'Sync your Garmin activities'}
        </p>
      </div>
    </div>
    
    {isGarminConnected ? (
      <Button onClick={syncGarmin} disabled={isSyncing}>
        {isSyncing ? 'Syncing...' : 'Sync Now'}
      </Button>
    ) : (
      <Button onClick={connectGarmin}>Connect Garmin</Button>
    )}
  </CardContent>
</Card>
```

## Data Reconciliation Strategy

### Priority Order
1. **Garmin** (if connected) - Highest priority for serious runners
2. **Google Fit** (if connected) - Fallback for non-Garmin users
3. **Manual Entry** - Last resort

### Deduplication Logic
```typescript
function deduplicateActivities(garminData, googleFitData) {
  // If both have data for same timestamp (within 5 minutes)
  // Keep Garmin data (more accurate for serious training)
  
  const activities = [...garminData];
  
  for (const gfActivity of googleFitData) {
    const isDuplicate = garminData.some(ga => 
      Math.abs(ga.startTime - gfActivity.startTime) < 5 * 60 * 1000
    );
    
    if (!isDuplicate) {
      activities.push(gfActivity);
    }
  }
  
  return activities;
}
```

## Challenges & Solutions

### Challenge 1: OAuth 1.0a Complexity
**Solution**: Use existing OAuth libraries and document the flow clearly

### Challenge 2: API Approval Wait Time
**Solution**: Start application process early, develop mock data in parallel

### Challenge 3: Rate Limiting
**Solution**: Implement caching, batch requests, respect rate limits

### Challenge 4: Data Duplication
**Solution**: Timestamp-based deduplication, clear priority rules

## Testing Plan

### Unit Tests
- OAuth flow components
- Data parsing functions
- Deduplication logic

### Integration Tests
- Full OAuth flow end-to-end
- Data sync from Garmin API
- Database storage and retrieval

### User Acceptance Tests
- Connect/disconnect Garmin
- Sync data manually
- View Garmin data in dashboard
- Handle both Garmin + Google Fit

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| API Application | 1 week | Not started |
| Backend Development | 2 weeks | Not started |
| Frontend Development | 1 week | Not started |
| Testing & QA | 1 week | Not started |
| **Total** | **5 weeks** | |

## Environment Variables

Add to `.env`:
```bash
GARMIN_CONSUMER_KEY=your_consumer_key
GARMIN_CONSUMER_SECRET=your_consumer_secret
GARMIN_REQUEST_TOKEN_URL=https://connectapi.garmin.com/oauth-service/oauth/request_token
GARMIN_ACCESS_TOKEN_URL=https://connectapi.garmin.com/oauth-service/oauth/access_token
GARMIN_AUTHORIZE_URL=https://connect.garmin.com/oauthConfirm
```

## Resources

- **Garmin Health API Docs**: https://developer.garmin.com/health-api/overview/
- **OAuth 1.0a Spec**: https://oauth.net/core/1.0a/
- **Garmin Developer Forum**: https://forums.garmin.com/developer/
- **Example Implementation**: https://github.com/cpfair/tapiriik (multi-platform sync tool)

## Recommendation

**Start with Phase 1 immediately**: Register for API access while continuing development on other features. The approval wait time is the main bottleneck.

**Parallel Development**: Once approved, implement Garmin sync alongside existing Google Fit. Keep both as separate, equal options for users.

**User Benefit**: Many serious runners prefer Garmin devices. Adding this integration will attract a new user segment and improve data accuracy for existing users with Garmin watches.
