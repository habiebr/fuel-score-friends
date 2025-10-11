-- Create nutrition scores table
CREATE TABLE IF NOT EXISTS public.nutrition_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_score INTEGER NOT NULL,
  nutrition_score INTEGER NOT NULL,
  training_score INTEGER NOT NULL,
  bonuses INTEGER DEFAULT 0,
  penalties INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_scores_user_date ON public.nutrition_scores (user_id, date);
CREATE INDEX IF NOT EXISTS idx_nutrition_scores_date ON public.nutrition_scores (date);

-- Add RLS policies
ALTER TABLE public.nutrition_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own nutrition scores"
  ON public.nutrition_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own nutrition scores"
  ON public.nutrition_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nutrition scores"
  ON public.nutrition_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own nutrition scores"
  ON public.nutrition_scores FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to persist scores
CREATE OR REPLACE FUNCTION persist_unified_score(
  p_user_id UUID,
  p_date DATE,
  p_total_score INTEGER,
  p_nutrition_score INTEGER,
  p_training_score INTEGER,
  p_bonuses INTEGER DEFAULT 0,
  p_penalties INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.nutrition_scores (
    user_id,
    date,
    total_score,
    nutrition_score,
    training_score,
    bonuses,
    penalties,
    updated_at
  )
  VALUES (
    p_user_id,
    p_date,
    p_total_score,
    p_nutrition_score,
    p_training_score,
    p_bonuses,
    p_penalties,
    NOW()
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_score = EXCLUDED.total_score,
    nutrition_score = EXCLUDED.nutrition_score,
    training_score = EXCLUDED.training_score,
    bonuses = EXCLUDED.bonuses,
    penalties = EXCLUDED.penalties,
    updated_at = EXCLUDED.updated_at;
END;
$$;
