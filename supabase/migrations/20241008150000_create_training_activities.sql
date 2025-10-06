-- Create training_activities table for storing planned training activities
CREATE TABLE IF NOT EXISTS public.training_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  activity_type TEXT NOT NULL, -- 'rest', 'run', 'strength', 'cardio', 'other'
  start_time TIME, -- Optional start time for the activity
  duration_minutes INTEGER NOT NULL,
  distance_km NUMERIC(5,2), -- Optional distance for run activities
  intensity TEXT NOT NULL, -- 'low', 'moderate', 'high'
  estimated_calories INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_training_activities_user_date ON public.training_activities(user_id, date);

-- Add RLS policies
ALTER TABLE public.training_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own training activities"
  ON public.training_activities
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own training activities"
  ON public.training_activities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training activities"
  ON public.training_activities
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own training activities"
  ON public.training_activities
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.training_activities IS 'Stores planned training activities with support for multiple activities per day';

-- Create function to calculate total daily calories from activities
CREATE OR REPLACE FUNCTION get_daily_training_calories(
  p_user_id UUID,
  p_date DATE
) RETURNS INTEGER AS $$
DECLARE
  total_calories INTEGER;
BEGIN
  SELECT COALESCE(SUM(estimated_calories), 0)
  INTO total_calories
  FROM public.training_activities
  WHERE user_id = p_user_id
    AND date = p_date;
  
  RETURN total_calories;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
