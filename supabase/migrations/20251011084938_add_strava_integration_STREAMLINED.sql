-- Strava Integration Tables (STREAMLINED VERSION)
-- Created: 2025-10-11
-- Purpose: Store Strava OAuth tokens, activities, and webhook data
-- Completely separate from Google Fit tables
-- OPTIMIZED: Uses generic updated_at trigger function

-- =====================================================
-- 0. GENERIC TRIGGER FUNCTION (if not already exists)
-- =====================================================
-- This function can be reused across ALL tables in the database
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trigger_set_updated_at() IS 
  'Generic trigger function to automatically update updated_at timestamp on any table';

-- =====================================================
-- 1. STRAVA TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.strava_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id BIGINT NOT NULL, -- Strava's athlete ID
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT, -- e.g., "read,activity:read_all,activity:write"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one user can only have one Strava connection
  UNIQUE(user_id),
  -- Index for quick athlete_id lookups
  UNIQUE(athlete_id)
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_strava_tokens_user_id ON public.strava_tokens(user_id);

-- Auto-update updated_at timestamp (uses generic function)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.strava_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- 2. STRAVA ACTIVITIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.strava_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id BIGINT NOT NULL, -- Strava's activity ID
  athlete_id BIGINT NOT NULL, -- For quick filtering
  
  -- Activity metadata
  name TEXT,
  type TEXT, -- Run, Ride, Swim, etc.
  sport_type TEXT, -- More specific: TrailRun, VirtualRide, etc.
  start_date TIMESTAMPTZ NOT NULL,
  start_date_local TIMESTAMPTZ,
  timezone TEXT,
  
  -- Location
  start_latlng POINT, -- PostGIS point type (lat, lng)
  end_latlng POINT,
  
  -- Core metrics
  distance REAL, -- meters
  moving_time INTEGER, -- seconds
  elapsed_time INTEGER, -- seconds
  total_elevation_gain REAL, -- meters
  
  -- Performance metrics
  average_speed REAL, -- meters/second
  max_speed REAL, -- meters/second
  average_heartrate REAL,
  max_heartrate REAL,
  average_cadence REAL,
  average_watts REAL,
  max_watts REAL,
  kilojoules REAL,
  
  -- Training metrics
  suffer_score INTEGER, -- Strava's Suffer Score
  calories REAL,
  
  -- Flags
  manual BOOLEAN DEFAULT FALSE,
  trainer BOOLEAN DEFAULT FALSE,
  commute BOOLEAN DEFAULT FALSE,
  
  -- Raw data (for future use)
  raw_data JSONB, -- Full activity object from Strava
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one activity per user
  UNIQUE(user_id, activity_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_id ON public.strava_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_start_date ON public.strava_activities(start_date);
CREATE INDEX IF NOT EXISTS idx_strava_activities_type ON public.strava_activities(type);
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_date ON public.strava_activities(user_id, start_date DESC);

-- Auto-update updated_at timestamp (uses generic function)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.strava_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- 3. STRAVA WEBHOOK SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.strava_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id INTEGER NOT NULL UNIQUE, -- Strava's subscription ID
  callback_url TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Only one active subscription at a time
  is_active BOOLEAN DEFAULT TRUE
);

-- Auto-update updated_at timestamp (uses generic function)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.strava_webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- 4. STRAVA WEBHOOK EVENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.strava_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_type TEXT NOT NULL, -- "activity" or "athlete"
  object_id BIGINT NOT NULL, -- Activity or Athlete ID
  aspect_type TEXT NOT NULL, -- "create", "update", "delete"
  owner_id BIGINT NOT NULL, -- Athlete ID who owns the object
  subscription_id INTEGER NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  
  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Raw event data
  raw_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for webhook processing
CREATE INDEX IF NOT EXISTS idx_strava_webhook_events_processed ON public.strava_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_strava_webhook_events_owner_id ON public.strava_webhook_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_strava_webhook_events_event_time ON public.strava_webhook_events(event_time DESC);

-- Auto-update updated_at timestamp (uses generic function)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.strava_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_webhook_events ENABLE ROW LEVEL SECURITY;

-- strava_tokens policies
CREATE POLICY "Users can view own Strava tokens"
  ON public.strava_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Strava tokens"
  ON public.strava_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Strava tokens"
  ON public.strava_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Strava tokens"
  ON public.strava_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role can manage strava_tokens"
  ON public.strava_tokens FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- strava_activities policies
CREATE POLICY "Users can view own Strava activities"
  ON public.strava_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Strava activities"
  ON public.strava_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Strava activities"
  ON public.strava_activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Strava activities"
  ON public.strava_activities FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role can manage strava_activities"
  ON public.strava_activities FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- strava_webhook_subscriptions policies (admin only)
CREATE POLICY "Service role can manage webhook subscriptions"
  ON public.strava_webhook_subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- strava_webhook_events policies (admin only)
CREATE POLICY "Service role can manage webhook events"
  ON public.strava_webhook_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to check if user has valid Strava token
CREATE OR REPLACE FUNCTION public.has_valid_strava_token(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.strava_tokens
    WHERE user_id = p_user_id
      AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get Strava athlete ID for user
CREATE OR REPLACE FUNCTION public.get_strava_athlete_id(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  v_athlete_id BIGINT;
BEGIN
  SELECT athlete_id INTO v_athlete_id
  FROM public.strava_tokens
  WHERE user_id = p_user_id;
  
  RETURN v_athlete_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old webhook events (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_strava_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.strava_webhook_events
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND processed = TRUE;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.strava_tokens IS 'OAuth tokens for Strava API access';
COMMENT ON TABLE public.strava_activities IS 'Activities synced from Strava API';
COMMENT ON TABLE public.strava_webhook_subscriptions IS 'Active webhook subscriptions with Strava';
COMMENT ON TABLE public.strava_webhook_events IS 'Webhook events received from Strava';

COMMENT ON COLUMN public.strava_activities.start_latlng IS 'Start coordinates as PostGIS POINT(lat, lng)';
COMMENT ON COLUMN public.strava_activities.end_latlng IS 'End coordinates as PostGIS POINT(lat, lng)';
COMMENT ON COLUMN public.strava_activities.raw_data IS 'Full JSON response from Strava API for future extensibility';
