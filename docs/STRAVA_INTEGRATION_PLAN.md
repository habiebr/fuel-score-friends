# Strava Integration - Implementation Plan

## 🎯 Overview

Strava is a popular fitness tracking platform used by runners, cyclists, and athletes. Integrating Strava will:

- ✅ Provide more accurate workout data (GPS tracking, power meters, heart rate)
- ✅ Access detailed activity types (Run, Ride, Swim, Hike, etc.)
- ✅ Get workout segments, splits, and performance metrics
- ✅ Sync activities automatically via webhooks
- ✅ Appeal to serious athletes who use Strava

## 📊 Strava vs Google Fit

| Feature | Google Fit | Strava |
|---------|-----------|--------|
| Activity types | Basic (8, 1, 82) | Detailed (30+ types) |
| GPS tracking | Limited | Excellent |
| Segments/Splits | No | Yes |
| Performance metrics | Basic | Advanced (pace, power, HR zones) |
| Social features | No | Yes (kudos, comments) |
| Workout analysis | Basic | Detailed |
| User base | General fitness | Serious athletes |
| Auto-sync | Polling required | Webhook support |

## 🏗️ Architecture

### Database Schema

```sql
-- Strava tokens table
CREATE TABLE strava_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  athlete_id BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Strava activities table
CREATE TABLE strava_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id BIGINT NOT NULL,
  name TEXT,
  type TEXT NOT NULL, -- Run, Ride, Swim, etc.
  sport_type TEXT, -- TrailRun, VirtualRide, etc.
  start_date TIMESTAMPTZ NOT NULL,
  start_date_local TIMESTAMPTZ,
  timezone TEXT,
  distance FLOAT, -- meters
  moving_time INTEGER, -- seconds
  elapsed_time INTEGER, -- seconds
  total_elevation_gain FLOAT, -- meters
  average_speed FLOAT, -- m/s
  max_speed FLOAT, -- m/s
  average_heartrate FLOAT,
  max_heartrate FLOAT,
  average_cadence FLOAT,
  average_watts FLOAT,
  calories FLOAT,
  suffer_score FLOAT,
  has_heartrate BOOLEAN,
  elev_high FLOAT,
  elev_low FLOAT,
  achievement_count INTEGER,
  kudos_count INTEGER,
  comment_count INTEGER,
  athlete_count INTEGER,
  photo_count INTEGER,
  trainer BOOLEAN,
  commute BOOLEAN,
  manual BOOLEAN,
  private BOOLEAN,
  visibility TEXT,
  flagged BOOLEAN,
  gear_id TEXT,
  from_accepted_tag BOOLEAN,
  upload_id BIGINT,
  external_id TEXT,
  map_polyline TEXT,
  map_summary_polyline TEXT,
  device_name TEXT,
  embed_token TEXT,
  splits_metric JSONB,
  splits_standard JSONB,
  laps JSONB,
  best_efforts JSONB,
  photos JSONB,
  segment_efforts JSONB,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, activity_id)
);

-- Strava webhook subscriptions
CREATE TABLE strava_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id BIGINT NOT NULL,
  callback_url TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subscription_id)
);

-- Strava webhook events
CREATE TABLE strava_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id BIGINT,
  object_type TEXT NOT NULL, -- activity, athlete
  object_id BIGINT NOT NULL,
  aspect_type TEXT NOT NULL, -- create, update, delete
  owner_id BIGINT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  raw_event JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_strava_tokens_user_id ON strava_tokens(user_id);
CREATE INDEX idx_strava_tokens_athlete_id ON strava_tokens(athlete_id);
CREATE INDEX idx_strava_activities_user_id ON strava_activities(user_id);
CREATE INDEX idx_strava_activities_activity_id ON strava_activities(activity_id);
CREATE INDEX idx_strava_activities_start_date ON strava_activities(start_date DESC);
CREATE INDEX idx_strava_activities_type ON strava_activities(type);
CREATE INDEX idx_strava_webhook_events_processed ON strava_webhook_events(processed, created_at);
CREATE INDEX idx_strava_webhook_events_owner ON strava_webhook_events(owner_id);
```

### Edge Functions

```
supabase/functions/
├── strava-auth/
│   └── index.ts           # OAuth callback handler
├── strava-webhook/
│   └── index.ts           # Webhook receiver
├── sync-strava-activities/
│   └── index.ts           # Manual sync
├── fetch-strava-activity/
│   └── index.ts           # Fetch single activity
├── refresh-strava-token/
│   └── index.ts           # Token refresh
└── process-strava-event/
    └── index.ts           # Process webhook events
```

### Frontend Components

```
src/
├── hooks/
│   ├── useStravaAuth.ts       # OAuth flow
│   └── useStravaSync.ts       # Sync activities
├── components/
│   ├── StravaConnect.tsx      # Connection UI
│   ├── StravaActivityCard.tsx # Activity display
│   └── StravaStats.tsx        # Statistics
└── lib/
    └── strava.ts              # Strava utilities
```

## 🔧 Implementation Steps

### Phase 1: Strava App Setup (5 min)

1. **Create Strava App**
   - Go to: https://www.strava.com/settings/api
   - Click "Create & Manage Your App"
   - Fill in:
     - Application Name: "Fuel Score Friends"
     - Category: "Training"
     - Club: Leave blank
     - Website: Your app URL
     - Authorization Callback Domain: Your domain
     - Icon: Upload logo

2. **Get Credentials**
   - Copy Client ID
   - Copy Client Secret
   - Add to `.env`:
     ```bash
     VITE_STRAVA_CLIENT_ID=your-client-id
     STRAVA_CLIENT_SECRET=your-client-secret
     ```

3. **Set Scopes**
   - Request: `activity:read_all,activity:write`

### Phase 2: Database Setup (10 min)

1. **Create Migration**
   ```bash
   cd supabase/migrations
   # Create new migration file
   ```

2. **Run Migration**
   ```bash
   supabase db push
   ```

3. **Enable RLS**
   ```sql
   ALTER TABLE strava_tokens ENABLE ROW LEVEL SECURITY;
   ALTER TABLE strava_activities ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can read own tokens" 
     ON strava_tokens FOR SELECT 
     USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can read own activities" 
     ON strava_activities FOR SELECT 
     USING (auth.uid() = user_id);
   ```

### Phase 3: Edge Functions (2-3 hours)

1. **OAuth Flow** (`strava-auth`)
   - Handle OAuth callback
   - Exchange code for tokens
   - Store in database

2. **Activity Sync** (`sync-strava-activities`)
   - Fetch recent activities
   - Parse and store
   - Map to your data model

3. **Webhook Handler** (`strava-webhook`)
   - Verify webhook
   - Queue events
   - Process updates

4. **Token Refresh** (`refresh-strava-token`)
   - Auto-refresh expired tokens
   - Update database

### Phase 4: Frontend Integration (2-3 hours)

1. **Connection Flow**
   - Add Strava connect button
   - Handle OAuth redirect
   - Show connection status

2. **Activity Display**
   - Show recent activities
   - Map activity types
   - Display metrics

3. **Sync UI**
   - Manual sync button
   - Auto-sync indicator
   - Last sync timestamp

### Phase 5: Webhook Setup (30 min)

1. **Register Webhook**
   - Create subscription via Strava API
   - Set callback URL
   - Verify webhook

2. **Process Events**
   - Handle create/update/delete
   - Update database
   - Trigger UI updates

## 🔌 Strava API Endpoints

### OAuth
```
GET https://www.strava.com/oauth/authorize
POST https://www.strava.com/oauth/token
```

### Activities
```
GET /api/v3/athlete/activities
GET /api/v3/activities/{id}
GET /api/v3/activities/{id}/streams
```

### Webhooks
```
POST /api/v3/push_subscriptions
GET /api/v3/push_subscriptions
DELETE /api/v3/push_subscriptions/{id}
```

### Rate Limits
- **15-minute limit:** 100 requests
- **Daily limit:** 1,000 requests
- Strategy: Use webhooks instead of polling

## 📋 Activity Type Mapping

### Strava Activity Types
```typescript
const STRAVA_ACTIVITY_TYPES = {
  Run: 'Running',
  TrailRun: 'Trail Running',
  VirtualRun: 'Treadmill Running',
  Ride: 'Cycling',
  VirtualRide: 'Indoor Cycling',
  MountainBikeRide: 'Mountain Biking',
  GravelRide: 'Gravel Cycling',
  EBikeRide: 'E-Bike',
  Swim: 'Swimming',
  Hike: 'Hiking',
  Walk: 'Walking',
  AlpineSki: 'Skiing',
  NordicSki: 'Cross-Country Skiing',
  Snowboard: 'Snowboarding',
  IceSkate: 'Ice Skating',
  InlineSkate: 'Inline Skating',
  RockClimbing: 'Rock Climbing',
  Rowing: 'Rowing',
  Crossfit: 'CrossFit',
  Workout: 'Workout',
  WeightTraining: 'Strength Training',
  Yoga: 'Yoga',
  // ... 30+ more types
};
```

## 🎨 UI/UX Considerations

### Connection Screen
```
┌─────────────────────────────────────┐
│  Connect Fitness Trackers           │
├─────────────────────────────────────┤
│                                     │
│  [ Google Fit ]  ✓ Connected       │
│                                     │
│  [ Strava ]      Connect →         │
│                                     │
│  [ Garmin ]      Coming Soon       │
│                                     │
└─────────────────────────────────────┘
```

### Activity List
```
┌─────────────────────────────────────┐
│  Recent Workouts                    │
├─────────────────────────────────────┤
│  🏃 Morning Run                     │
│  5.2 km • 28:34 • 5:30 /km         │
│  ❤️ 152 bpm avg • 🔥 350 cal      │
│  via Strava                         │
│                                     │
│  🚴 Evening Ride                    │
│  32.1 km • 1:15:22 • 25.5 km/h    │
│  ⚡ 180W avg • 🔥 520 cal          │
│  via Google Fit                     │
└─────────────────────────────────────┘
```

## 🔄 Data Sync Strategy

### Initial Sync
1. User connects Strava
2. Fetch last 30 days of activities
3. Store in `strava_activities`
4. Map to unified activity model

### Ongoing Sync
1. **Webhook-based** (preferred)
   - Strava sends event when activity created/updated
   - Process event immediately
   - Update database

2. **Fallback Polling** (backup)
   - Check for new activities every 15 minutes
   - Fetch only since last sync
   - Handle rate limits

### Data Unification
```typescript
interface UnifiedActivity {
  id: string;
  source: 'strava' | 'google_fit' | 'manual';
  type: ActivityType;
  name: string;
  startTime: Date;
  duration: number; // seconds
  distance?: number; // meters
  calories?: number;
  avgHeartRate?: number;
  avgPace?: number; // min/km
  avgSpeed?: number; // km/h
  avgPower?: number; // watts
  elevationGain?: number; // meters
  splits?: Split[];
  segments?: Segment[];
  metadata: Record<string, any>;
}
```

## 🚀 Deployment Checklist

### Before Deployment
- [ ] Create Strava app and get credentials
- [ ] Add credentials to environment variables
- [ ] Create database migrations
- [ ] Test OAuth flow in development
- [ ] Test webhook verification
- [ ] Test activity sync
- [ ] Test token refresh

### Deployment
- [ ] Run database migrations
- [ ] Deploy edge functions
- [ ] Register webhook subscription
- [ ] Update frontend
- [ ] Test end-to-end flow
- [ ] Monitor error logs

### Post-Deployment
- [ ] Test with real Strava account
- [ ] Verify webhook events
- [ ] Check activity syncing
- [ ] Monitor rate limits
- [ ] Gather user feedback

## 📊 Success Metrics

- **Connection rate:** % of users who connect Strava
- **Sync success rate:** % of activities successfully synced
- **Webhook delivery:** % of webhook events processed
- **API errors:** Track 4xx/5xx responses
- **User engagement:** Activity views, interactions

## 🔒 Security Considerations

1. **Token Storage**
   - Encrypt tokens at rest
   - Never expose in frontend
   - Rotate regularly

2. **Webhook Verification**
   - Verify Strava signature
   - Check subscription ID
   - Rate limit webhook endpoint

3. **User Privacy**
   - Respect Strava privacy settings
   - Don't share private activities
   - Allow users to disconnect

4. **Rate Limiting**
   - Implement backoff strategy
   - Queue requests
   - Cache responses

## 📚 Resources

### Strava API Documentation
- [API Reference](https://developers.strava.com/docs/reference/)
- [OAuth Guide](https://developers.strava.com/docs/authentication/)
- [Webhooks](https://developers.strava.com/docs/webhooks/)
- [Activity Streams](https://developers.strava.com/docs/reference/#api-Streams)

### Example Apps
- [Strava OAuth Example](https://github.com/strava/api-example-app)
- [Strava Webhooks Example](https://github.com/strava/webhook-example)

## 💡 Future Enhancements

### Phase 2 Features
- [ ] Segment analysis
- [ ] Personal records tracking
- [ ] Training load calculation
- [ ] Route recommendations
- [ ] Social features (kudos, comments)
- [ ] Activity photos
- [ ] GPS map display
- [ ] Elevation profiles
- [ ] Heart rate zones
- [ ] Power zones (cycling)

### Integrations
- [ ] Garmin Connect
- [ ] Polar Flow
- [ ] Wahoo
- [ ] Apple Health (enhanced)
- [ ] Fitbit

## 🎯 Quick Start Files

When you're ready to start, I can create:
1. Database migration file
2. Edge function templates
3. Frontend hook skeletons
4. Environment variable template
5. Deployment scripts

---

**Ready to start?** Let me know and I'll generate all the implementation files! 🚀
