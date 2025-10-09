-- Create meal plans cache table
CREATE TABLE IF NOT EXISTS public.meal_plans_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT,
  recommended_calories INTEGER,
  recommended_protein_grams INTEGER,
  recommended_carbs_grams INTEGER,
  recommended_fat_grams INTEGER,
  meal_suggestions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_meal_plans_cache_user_date ON public.meal_plans_cache (user_id, date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_cache_expires ON public.meal_plans_cache (expires_at);

-- Add RLS policies
ALTER TABLE public.meal_plans_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own meal plans cache"
  ON public.meal_plans_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meal plans cache"
  ON public.meal_plans_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meal plans cache"
  ON public.meal_plans_cache FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meal plans cache"
  ON public.meal_plans_cache FOR DELETE
  USING (auth.uid() = user_id);

-- Add cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_meal_plans_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.meal_plans_cache WHERE expires_at < NOW();
END;
$$;

-- Schedule cleanup job
SELECT cron.schedule(
  'cleanup-meal-plans-cache',
  '0 * * * *', -- Every hour
  'SELECT public.cleanup_meal_plans_cache();'
);
