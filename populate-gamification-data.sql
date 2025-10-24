-- Populate user_daily_scores from nutrition_scores for gamification system
-- This ensures the gamification system has data to work with

-- First, ensure the user_daily_scores table exists
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

-- Ensure the user_gamification_state table exists
CREATE TABLE IF NOT EXISTS user_gamification_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'learner' CHECK (tier IN ('learner', 'athlete', 'elite')),
  last_milestone TEXT CHECK (last_milestone IN ('D7', 'D21', 'D45')),
  total_days_logged INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
ON CONFLICT (user_id, score_date) DO UPDATE SET
  fuel_score = EXCLUDED.fuel_score,
  calories_consumed = EXCLUDED.calories_consumed,
  meals_logged = EXCLUDED.meals_logged,
  updated_at = NOW();

-- Initialize gamification state for users who have scores but no gamification state
INSERT INTO user_gamification_state (user_id, current_streak, best_streak, tier, total_days_logged)
SELECT 
  user_id,
  0 as current_streak,
  0 as best_streak,
  'learner' as tier,
  COUNT(*) as total_days_logged
FROM user_daily_scores
WHERE user_id NOT IN (SELECT user_id FROM user_gamification_state)
GROUP BY user_id
ON CONFLICT (user_id) DO NOTHING;

-- Update gamification state with calculated streaks
UPDATE user_gamification_state 
SET 
  current_streak = COALESCE((
    WITH streak_calc AS (
      SELECT 
        score_date,
        fuel_score,
        ROW_NUMBER() OVER (ORDER BY score_date DESC) as rn
      FROM user_daily_scores 
      WHERE user_id = user_gamification_state.user_id 
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
    SELECT COUNT(*) FILTER (WHERE fuel_score >= 70 AND streak_group = 0)
    FROM streak_groups
    WHERE streak_group = 0
  ), 0),
  best_streak = COALESCE((
    WITH streak_calc AS (
      SELECT 
        score_date,
        fuel_score,
        CASE WHEN fuel_score >= 70 THEN 1 ELSE 0 END as is_good_day
      FROM user_daily_scores 
      WHERE user_id = user_gamification_state.user_id 
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
    FROM (
      SELECT COUNT(*) as streak_length
      FROM streak_groups
      WHERE is_good_day = 1
      GROUP BY group_id
    ) streaks
  ), 0),
  total_days_logged = (
    SELECT COUNT(*) 
    FROM user_daily_scores 
    WHERE user_id = user_gamification_state.user_id
  ),
  updated_at = NOW();

-- Update tiers based on 28-day average
UPDATE user_gamification_state 
SET 
  tier = CASE 
    WHEN (
      SELECT COALESCE(AVG(fuel_score), 0)
      FROM user_daily_scores 
      WHERE user_id = user_gamification_state.user_id 
        AND score_date >= CURRENT_DATE - INTERVAL '28 days'
    ) > 85 THEN 'elite'
    WHEN (
      SELECT COALESCE(AVG(fuel_score), 0)
      FROM user_daily_scores 
      WHERE user_id = user_gamification_state.user_id 
        AND score_date >= CURRENT_DATE - INTERVAL '28 days'
    ) >= 70 THEN 'athlete'
    ELSE 'learner'
  END,
  updated_at = NOW();



