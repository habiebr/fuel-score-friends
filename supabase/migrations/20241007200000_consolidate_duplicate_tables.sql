-- Consolidate duplicate tables and remove redundancy
-- This migration cleans up tables that were created multiple times

-- ============================================================================
-- 1. Drop old wearable_data table (replaced by google_fit_data)
-- ============================================================================
-- We now use google_fit_data exclusively
DROP TABLE IF EXISTS public.wearable_data CASCADE;
DROP TABLE IF EXISTS public.wearable_laps CASCADE;

COMMENT ON TABLE public.google_fit_data IS 'Google Fit activity data - replaces wearable_data table';

-- ============================================================================
-- 2. Ensure google_fit_data has all necessary columns
-- ============================================================================
-- Make sure google_fit_data is our single source of truth for fitness data
DO $$ 
BEGIN
  -- Add any missing columns to google_fit_data
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'google_fit_data' AND column_name = 'sessions') THEN
    ALTER TABLE public.google_fit_data 
    ADD COLUMN sessions JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- 3. Clean up duplicate marathon_events tables
-- ============================================================================
-- marathon_events was created twice, ensure we only have one
DO $$ 
BEGIN
  -- Check if marathon_events exists and has proper structure
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'marathon_events') THEN
    
    -- Ensure it has all required columns
    ALTER TABLE public.marathon_events 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS event_name TEXT,
    ADD COLUMN IF NOT EXISTS event_date DATE,
    ADD COLUMN IF NOT EXISTS distance_km NUMERIC,
    ADD COLUMN IF NOT EXISTS goal_time TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    
  END IF;
END $$;

-- ============================================================================
-- 4. Consolidate profiles table columns
-- ============================================================================
-- Remove duplicate weight/height/age columns (INTEGER vs NUMERIC)
-- Keep NUMERIC for better precision

DO $$ 
BEGIN
  -- Check if we have duplicate weight columns
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'profiles' AND column_name = 'weight' 
             AND data_type = 'integer') THEN
    
    -- Move INTEGER weight to NUMERIC weight_kg if weight_kg doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'weight_kg') THEN
      ALTER TABLE public.profiles RENAME COLUMN weight TO weight_kg;
      ALTER TABLE public.profiles ALTER COLUMN weight_kg TYPE NUMERIC;
    ELSE
      -- If weight_kg exists, drop the integer weight column
      ALTER TABLE public.profiles DROP COLUMN IF EXISTS weight;
    END IF;
  END IF;

  -- Same for height
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'profiles' AND column_name = 'height' 
             AND data_type = 'integer') THEN
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'height_cm') THEN
      ALTER TABLE public.profiles RENAME COLUMN height TO height_cm;
      ALTER TABLE public.profiles ALTER COLUMN height_cm TYPE NUMERIC;
    ELSE
      ALTER TABLE public.profiles DROP COLUMN IF EXISTS height;
    END IF;
  END IF;

  -- Remove duplicate display_name (we use full_name)
  ALTER TABLE public.profiles DROP COLUMN IF EXISTS display_name;
END $$;

-- ============================================================================
-- 5. Add comments to clarify table purposes
-- ============================================================================
COMMENT ON TABLE public.profiles IS 'User profile data: name, body metrics, preferences';
COMMENT ON TABLE public.nutrition_scores IS 'Daily nutrition scores and macro tracking';
COMMENT ON TABLE public.food_logs IS 'Individual meal/food logging entries';
COMMENT ON TABLE public.daily_meal_plans IS 'AI-generated meal recommendations per day';
COMMENT ON TABLE public.google_fit_data IS 'Google Fit exercise data (steps, calories, distance, heart rate)';
COMMENT ON TABLE public.friends IS 'Friend connections for community features';

-- ============================================================================
-- 6. Create helpful views for common queries
-- ============================================================================

-- View: User summary with all related data
CREATE OR REPLACE VIEW public.user_summary AS
SELECT 
  p.user_id,
  p.full_name,
  p.sex,
  p.weight_kg,
  p.height_cm,
  p.age,
  COUNT(DISTINCT fl.id) as total_meals_logged,
  COUNT(DISTINCT ns.date) as days_with_scores,
  AVG(ns.daily_score) as avg_nutrition_score,
  SUM(COALESCE(gf.distance_meters, 0)) / 1609.34 as total_miles
FROM public.profiles p
LEFT JOIN public.food_logs fl ON fl.user_id = p.user_id
LEFT JOIN public.nutrition_scores ns ON ns.user_id = p.user_id
LEFT JOIN public.google_fit_data gf ON gf.user_id = p.user_id
GROUP BY p.user_id, p.full_name, p.sex, p.weight_kg, p.height_cm, p.age;

COMMENT ON VIEW public.user_summary IS 'Consolidated view of user profile with activity summary';

-- ============================================================================
-- 7. Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_scores_user_date ON public.nutrition_scores(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged ON public.food_logs(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_fit_user_date ON public.google_fit_data(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_meal_plans_user_date_meal ON public.daily_meal_plans(user_id, date, meal_type);

-- ============================================================================
-- 8. Summary of table structure
-- ============================================================================
/*
FINAL TABLE STRUCTURE:

✅ profiles - User profile (1 per user)
   - user_id (FK to auth.users)
   - full_name, sex, weight_kg, height_cm, age
   - dietary_restrictions, eating_behaviors
   - goal_type, goal_name, target_date

✅ google_fit_data - Exercise data (1 per user per day)
   - user_id, date
   - steps, calories_burned, active_minutes, distance_meters, heart_rate_avg
   - sessions (JSONB)

✅ nutrition_scores - Daily nutrition summary (1 per user per day)
   - user_id, date
   - daily_score, calories_consumed, protein/carbs/fat grams
   - meals_logged, planned vs actual macros

✅ food_logs - Individual meal entries (many per user)
   - user_id, logged_at
   - food_name, meal_type, calories, macros

✅ daily_meal_plans - AI meal suggestions (3 per user per day: breakfast/lunch/dinner)
   - user_id, date, meal_type
   - recommended macros, meal_suggestions (JSONB)

✅ marathon_events - Race goals
   - user_id, event_name, event_date, distance_km, goal_time

✅ friends - Community connections
   - user_id, friend_id, status

✅ hydration_logs - Water intake tracking
   - user_id, date, amount_ml

❌ REMOVED: wearable_data (replaced by google_fit_data)
❌ REMOVED: wearable_laps (not needed)
❌ REMOVED: duplicate weight/height columns
❌ REMOVED: display_name (use full_name)
*/

