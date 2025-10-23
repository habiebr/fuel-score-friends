-- ============================================================================
-- Gamification System Schema Migration (Fixed)
-- ============================================================================
-- This migration creates the complete gamification system schema
-- with proper conflict handling for existing objects

-- ============================================================================
-- 1. ENUMS AND TYPES
-- ============================================================================

-- Performance tiers based on 28-day average fuel scores
DO $$ BEGIN
    CREATE TYPE performance_tier AS ENUM ('learner', 'athlete', 'elite');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Milestone codes for streak achievements
DO $$ BEGIN
    CREATE TYPE milestone_code AS ENUM ('D7', 'D21', 'D45');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

-- Daily scores table (consolidated view of existing nutrition_scores)
CREATE TABLE IF NOT EXISTS user_daily_scores (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_date DATE NOT NULL,
  fuel_score NUMERIC(5,2) NOT NULL CHECK (fuel_score >= 0 AND fuel_score <= 100),
  calories_consumed INTEGER DEFAULT 0,
  meals_logged INTEGER DEFAULT 0,
  training_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, score_date)
);

-- Gamification state per user
CREATE TABLE IF NOT EXISTS user_gamification_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  tier performance_tier NOT NULL DEFAULT 'learner',
  last_milestone milestone_code,
  streak_freeze_count INTEGER DEFAULT 0 CHECK (streak_freeze_count >= 0),
  total_days_logged INTEGER DEFAULT 0 CHECK (total_days_logged >= 0),
  last_streak_update TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Milestones achieved by users
CREATE TABLE IF NOT EXISTS user_milestones (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone milestone_code NOT NULL,
  achieved_on DATE NOT NULL DEFAULT (NOW()::DATE),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, milestone)
);

-- Weekly insights and analytics
CREATE TABLE IF NOT EXISTS user_weekly_insights (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  avg_fuel_score NUMERIC(5,2) NOT NULL CHECK (avg_fuel_score >= 0 AND avg_fuel_score <= 100),
  pre_window_ok_pct NUMERIC(5,2) CHECK (pre_window_ok_pct >= 0 AND pre_window_ok_pct <= 100),
  during_window_ok_pct NUMERIC(5,2) CHECK (during_window_ok_pct >= 0 AND during_window_ok_pct <= 100),
  post_window_ok_pct NUMERIC(5,2) CHECK (post_window_ok_pct >= 0 AND post_window_ok_pct <= 100),
  meals_logged_avg NUMERIC(5,2) DEFAULT 0,
  training_completion_pct NUMERIC(5,2) DEFAULT 0,
  predicted_impact_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

-- ============================================================================
-- 3. VIEWS AND MATERIALIZED VIEWS
-- ============================================================================

-- 28-day average scores view (for tier calculation)
CREATE OR REPLACE VIEW user_28d_avg_scores AS
SELECT
  uds.user_id,
  (CURRENT_DATE - INTERVAL '28 days')::DATE AS from_date,
  CURRENT_DATE::DATE AS to_date,
  AVG(uds.fuel_score)::NUMERIC(5,2) AS avg_28d,
  COUNT(*) AS days_count,
  MIN(uds.score_date) AS first_score_date,
  MAX(uds.score_date) AS last_score_date
FROM user_daily_scores uds
WHERE uds.score_date >= (CURRENT_DATE - INTERVAL '28 days')::DATE
GROUP BY uds.user_id;

-- Materialized view for better performance (refresh weekly)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_28d_avg_scores_mv AS
SELECT
  uds.user_id,
  (CURRENT_DATE - INTERVAL '28 days')::DATE AS from_date,
  CURRENT_DATE::DATE AS to_date,
  AVG(uds.fuel_score)::NUMERIC(5,2) AS avg_28d,
  COUNT(*) AS days_count,
  MIN(uds.score_date) AS first_score_date,
  MAX(uds.score_date) AS last_score_date,
  NOW() AS refreshed_at
FROM user_daily_scores uds
WHERE uds.score_date >= (CURRENT_DATE - INTERVAL '28 days')::DATE
GROUP BY uds.user_id;

-- User streak summary view
CREATE OR REPLACE VIEW user_streak_summary AS
SELECT
  ugs.user_id,
  ugs.current_streak,
  ugs.best_streak,
  ugs.tier,
  ugs.last_milestone,
  ugs.total_days_logged,
  u28.avg_28d,
  CASE 
    WHEN ugs.current_streak >= 7 THEN 'D7'
    WHEN ugs.current_streak >= 21 THEN 'D21'
    WHEN ugs.current_streak >= 45 THEN 'D45'
    ELSE NULL
  END AS next_milestone,
  CASE 
    WHEN ugs.tier = 'learner' AND u28.avg_28d >= 70 THEN 'athlete'
    WHEN ugs.tier = 'athlete' AND u28.avg_28d >= 85 THEN 'elite'
    ELSE NULL
  END AS next_tier
FROM user_gamification_state ugs
LEFT JOIN user_28d_avg_scores u28 ON ugs.user_id = u28.user_id;

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Daily scores indexes
CREATE INDEX IF NOT EXISTS idx_user_daily_scores_user_date 
  ON user_daily_scores(user_id, score_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_daily_scores_date_score 
  ON user_daily_scores(score_date, fuel_score);

-- Gamification state indexes
CREATE INDEX IF NOT EXISTS idx_user_gamification_tier 
  ON user_gamification_state(tier);

CREATE INDEX IF NOT EXISTS idx_user_gamification_streak 
  ON user_gamification_state(current_streak DESC);

CREATE INDEX IF NOT EXISTS idx_user_gamification_best_streak 
  ON user_gamification_state(best_streak DESC);

-- Milestones indexes
CREATE INDEX IF NOT EXISTS idx_user_milestones_user_milestone 
  ON user_milestones(user_id, milestone);

CREATE INDEX IF NOT EXISTS idx_user_milestones_achieved 
  ON user_milestones(achieved_on DESC);

-- Weekly insights indexes
CREATE INDEX IF NOT EXISTS idx_user_weekly_insights_user_week 
  ON user_weekly_insights(user_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_user_weekly_insights_week 
  ON user_weekly_insights(week_start DESC);

-- Materialized view index
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_28d_avg_scores_mv_user 
  ON user_28d_avg_scores_mv(user_id);

-- ============================================================================
-- 5. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update gamification state
CREATE OR REPLACE FUNCTION update_gamification_state(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_current_streak INTEGER := 0;
  v_best_streak INTEGER := 0;
  v_total_days INTEGER := 0;
  v_avg_28d NUMERIC(5,2);
  v_new_tier performance_tier;
BEGIN
  -- Calculate current streak
  WITH streak_calc AS (
    SELECT 
      score_date,
      fuel_score,
      ROW_NUMBER() OVER (ORDER BY score_date DESC) as rn
    FROM user_daily_scores 
    WHERE user_id = p_user_id 
      AND score_date <= CURRENT_DATE
    ORDER BY score_date DESC
  ),
  streak_groups AS (
    SELECT 
      score_date,
      fuel_score,
      rn,
      SUM(CASE WHEN fuel_score < 70 THEN 1 ELSE 0 END) 
        OVER (ORDER BY rn) as streak_group
    FROM streak_calc
  )
  SELECT 
    COUNT(*) FILTER (WHERE fuel_score >= 70 AND streak_group = 0),
    COUNT(*) FILTER (WHERE fuel_score >= 70)
  INTO v_current_streak, v_total_days
  FROM streak_groups
  WHERE streak_group = 0;

  -- Calculate best streak
  WITH streak_calc AS (
    SELECT 
      score_date,
      fuel_score,
      CASE WHEN fuel_score >= 70 THEN 1 ELSE 0 END as is_good_day
    FROM user_daily_scores 
    WHERE user_id = p_user_id 
    ORDER BY score_date
  ),
  streak_groups AS (
    SELECT 
      score_date,
      is_good_day,
      SUM(CASE WHEN is_good_day = 0 THEN 1 ELSE 0 END) 
        OVER (ORDER BY score_date) as group_id
    FROM streak_calc
  )
  SELECT COALESCE(MAX(streak_length), 0)
  INTO v_best_streak
  FROM (
    SELECT COUNT(*) as streak_length
    FROM streak_groups
    WHERE is_good_day = 1
    GROUP BY group_id
  ) streaks;

  -- Get 28-day average for tier calculation
  SELECT COALESCE(avg_28d, 0) INTO v_avg_28d
  FROM user_28d_avg_scores
  WHERE user_id = p_user_id;

  -- Calculate tier
  v_new_tier := CASE 
    WHEN v_avg_28d >= 85 THEN 'elite'::performance_tier
    WHEN v_avg_28d >= 70 THEN 'athlete'::performance_tier
    ELSE 'learner'::performance_tier
  END;

  -- Update gamification state
  INSERT INTO user_gamification_state (
    user_id, 
    current_streak, 
    best_streak, 
    tier, 
    total_days_logged,
    last_streak_update,
    updated_at
  )
  VALUES (
    p_user_id, 
    v_current_streak, 
    v_best_streak, 
    v_new_tier, 
    v_total_days,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    best_streak = GREATEST(user_gamification_state.best_streak, EXCLUDED.best_streak),
    tier = EXCLUDED.tier,
    total_days_logged = EXCLUDED.total_days_logged,
    last_streak_update = EXCLUDED.last_streak_update,
    updated_at = EXCLUDED.updated_at;

END;
$$ LANGUAGE plpgsql;

-- Function to check and award milestones
CREATE OR REPLACE FUNCTION check_milestones(p_user_id UUID)
RETURNS TABLE(milestone_code milestone_code) AS $$
BEGIN
  RETURN QUERY
  WITH current_streak AS (
    SELECT current_streak FROM user_gamification_state WHERE user_id = p_user_id
  ),
  eligible_milestones AS (
    SELECT 
      CASE 
        WHEN cs.current_streak >= 7 AND NOT EXISTS (
          SELECT 1 FROM user_milestones WHERE user_id = p_user_id AND milestone = 'D7'
        ) THEN 'D7'::milestone_code
        WHEN cs.current_streak >= 21 AND NOT EXISTS (
          SELECT 1 FROM user_milestones WHERE user_id = p_user_id AND milestone = 'D21'
        ) THEN 'D21'::milestone_code
        WHEN cs.current_streak >= 45 AND NOT EXISTS (
          SELECT 1 FROM user_milestones WHERE user_id = p_user_id AND milestone = 'D45'
        ) THEN 'D45'::milestone_code
        ELSE NULL
      END as milestone
    FROM current_streak cs
  )
  SELECT milestone FROM eligible_milestones WHERE milestone IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update gamification state when daily scores change
CREATE OR REPLACE FUNCTION trigger_update_gamification()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_gamification_state(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers if they don't exist
DO $$ BEGIN
    CREATE TRIGGER trg_update_gamification_after_insert
      AFTER INSERT ON user_daily_scores
      FOR EACH ROW
      EXECUTE FUNCTION trigger_update_gamification();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER trg_update_gamification_after_update
      AFTER UPDATE ON user_daily_scores
      FOR EACH ROW
      EXECUTE FUNCTION trigger_update_gamification();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gamification_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_weekly_insights ENABLE ROW LEVEL SECURITY;

-- Daily scores policies
DO $$ BEGIN
    CREATE POLICY "Users can view their own daily scores" ON user_daily_scores
      FOR SELECT USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert their own daily scores" ON user_daily_scores
      FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update their own daily scores" ON user_daily_scores
      FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Gamification state policies
DO $$ BEGIN
    CREATE POLICY "Users can view their own gamification state" ON user_gamification_state
      FOR SELECT USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update their own gamification state" ON user_gamification_state
      FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Milestones policies
DO $$ BEGIN
    CREATE POLICY "Users can view their own milestones" ON user_milestones
      FOR SELECT USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert their own milestones" ON user_milestones
      FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update their own milestones" ON user_milestones
      FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Weekly insights policies
DO $$ BEGIN
    CREATE POLICY "Users can view their own weekly insights" ON user_weekly_insights
      FOR SELECT USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert their own weekly insights" ON user_weekly_insights
      FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 7. DATA MIGRATION FROM EXISTING TABLES
-- ============================================================================

-- Migrate existing nutrition_scores to user_daily_scores
INSERT INTO user_daily_scores (user_id, score_date, fuel_score, calories_consumed, meals_logged)
SELECT 
  user_id,
  date,
  daily_score,
  calories_consumed,
  meals_logged
FROM nutrition_scores
WHERE daily_score IS NOT NULL
ON CONFLICT (user_id, score_date) DO NOTHING;

-- ============================================================================
-- 8. COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE user_daily_scores IS 'Consolidated daily fuel scores for gamification system';
COMMENT ON TABLE user_gamification_state IS 'Current gamification state per user including streaks and tiers';
COMMENT ON TABLE user_milestones IS 'Achieved milestones by users';
COMMENT ON TABLE user_weekly_insights IS 'Weekly analytics and insights for users';

COMMENT ON COLUMN user_gamification_state.current_streak IS 'Current consecutive days with fuel_score >= 70';
COMMENT ON COLUMN user_gamification_state.best_streak IS 'Best streak ever achieved by user';
COMMENT ON COLUMN user_gamification_state.tier IS 'Performance tier based on 28-day average';
COMMENT ON COLUMN user_gamification_state.streak_freeze_count IS 'Number of streak freezes used (future feature)';

COMMENT ON VIEW user_28d_avg_scores IS '28-day rolling average fuel scores for tier calculation';
COMMENT ON VIEW user_streak_summary IS 'Comprehensive streak and tier summary per user';

