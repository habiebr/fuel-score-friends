-- Ensure core schema for NutriSync app

-- 1) Profiles columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS goal_type TEXT,
  ADD COLUMN IF NOT EXISTS goal_name TEXT,
  ADD COLUMN IF NOT EXISTS weight NUMERIC,
  ADD COLUMN IF NOT EXISTS height NUMERIC,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS activity_level TEXT,
  ADD COLUMN IF NOT EXISTS fitness_level TEXT,
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS fitness_goals TEXT[];

COMMENT ON COLUMN public.profiles.goal_type IS 'Predetermined goal type (5k, 10k, half_marathon, full_marathon, ultra, custom)';
COMMENT ON COLUMN public.profiles.goal_name IS 'Human-readable race/event name';

-- 2) daily_meal_plans table
CREATE TABLE IF NOT EXISTS public.daily_meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL, -- breakfast, lunch, dinner
  recommended_calories INTEGER DEFAULT 0,
  recommended_protein_grams INTEGER DEFAULT 0,
  recommended_carbs_grams INTEGER DEFAULT 0,
  recommended_fat_grams INTEGER DEFAULT 0,
  meal_suggestions JSONB DEFAULT '[]'::jsonb,
  meal_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, meal_type)
);

-- 3) wearable_data table (ensure core columns)
CREATE TABLE IF NOT EXISTS public.wearable_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INTEGER DEFAULT 0,
  calories_burned INTEGER DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  heart_rate_avg INTEGER DEFAULT 0,
  max_heart_rate INTEGER,
  distance_meters INTEGER,
  activity_type TEXT,
  sleep_hours DECIMAL(3,1),
  training_effect DECIMAL(3,1),
  recovery_time INTEGER,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 4) nutrition_scores table (ensure core)
CREATE TABLE IF NOT EXISTS public.nutrition_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_score INTEGER NOT NULL DEFAULT 0,
  calories_consumed INTEGER DEFAULT 0,
  protein_grams INTEGER DEFAULT 0,
  carbs_grams INTEGER DEFAULT 0,
  fat_grams INTEGER DEFAULT 0,
  meals_logged INTEGER DEFAULT 0,
  breakfast_score INTEGER,
  lunch_score INTEGER,
  dinner_score INTEGER,
  planned_calories INTEGER DEFAULT 0,
  planned_protein_grams INTEGER DEFAULT 0,
  planned_carbs_grams INTEGER DEFAULT 0,
  planned_fat_grams INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 5) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_daily_meal_plans_user_date ON public.daily_meal_plans(user_id, date);
CREATE INDEX IF NOT EXISTS idx_wearable_data_user_date ON public.wearable_data(user_id, date);
-- Defensive unique indexes (if table existed without constraints)
DO $$ BEGIN
  ALTER TABLE public.daily_meal_plans
  ADD CONSTRAINT daily_meal_plans_user_date_meal_type_key UNIQUE (user_id, date, meal_type);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.wearable_data
  ADD CONSTRAINT wearable_data_user_date_key UNIQUE (user_id, date);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged_at ON public.food_logs(user_id, logged_at);

-- 6) RLS enable (if not already) and simple policies
ALTER TABLE public.daily_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_data ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY daily_meal_plans_select_self ON public.daily_meal_plans FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY daily_meal_plans_upsert_self ON public.daily_meal_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY wearable_data_select_self ON public.wearable_data FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY wearable_data_upsert_self ON public.wearable_data FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


