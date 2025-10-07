-- Create weekly Google Fit aggregates table for better performance
-- This table stores pre-calculated weekly totals to avoid recalculating every time

CREATE TABLE IF NOT EXISTS public.weekly_google_fit_aggregates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Weekly totals
  total_distance_km DECIMAL(10, 2) DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  total_calories_burned DECIMAL(10, 2) DEFAULT 0,
  total_active_minutes INTEGER DEFAULT 0,
  average_heart_rate DECIMAL(5, 2),
  
  -- Daily breakdown (JSON array)
  daily_breakdown JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per week
  UNIQUE(user_id, week_start_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_weekly_gf_aggregates_user_week 
  ON public.weekly_google_fit_aggregates(user_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_gf_aggregates_last_calculated 
  ON public.weekly_google_fit_aggregates(last_calculated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.weekly_google_fit_aggregates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own weekly aggregates"
  ON public.weekly_google_fit_aggregates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekly aggregates"
  ON public.weekly_google_fit_aggregates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly aggregates"
  ON public.weekly_google_fit_aggregates
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weekly aggregates"
  ON public.weekly_google_fit_aggregates
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_weekly_google_fit_aggregates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER weekly_google_fit_aggregates_set_updated_at
  BEFORE UPDATE ON public.weekly_google_fit_aggregates
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_google_fit_aggregates_updated_at();

-- Function to calculate and store weekly aggregates
CREATE OR REPLACE FUNCTION calculate_weekly_google_fit_aggregates(
  p_user_id UUID,
  p_week_start_date DATE
) RETURNS VOID AS $$
DECLARE
  week_end_date DATE;
  total_distance DECIMAL(10, 2) := 0;
  total_steps INTEGER := 0;
  total_calories DECIMAL(10, 2) := 0;
  total_active_minutes INTEGER := 0;
  total_heart_rate DECIMAL(10, 2) := 0;
  heart_rate_count INTEGER := 0;
  daily_breakdown JSONB := '[]'::jsonb;
  day_record RECORD;
BEGIN
  -- Calculate week end date (6 days after start)
  week_end_date := p_week_start_date + INTERVAL '6 days';
  
  -- Calculate totals from daily data
  SELECT 
    COALESCE(SUM(distance_meters), 0) / 1000,
    COALESCE(SUM(steps), 0),
    COALESCE(SUM(calories_burned), 0),
    COALESCE(SUM(active_minutes), 0),
    COALESCE(AVG(heart_rate_avg), 0),
    COUNT(CASE WHEN heart_rate_avg IS NOT NULL THEN 1 END)
  INTO 
    total_distance,
    total_steps,
    total_calories,
    total_active_minutes,
    total_heart_rate,
    heart_rate_count
  FROM public.google_fit_data
  WHERE user_id = p_user_id
    AND date >= p_week_start_date
    AND date <= week_end_date;
  
  -- Build daily breakdown
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'distanceKm', COALESCE(distance_meters, 0) / 1000,
      'steps', COALESCE(steps, 0),
      'caloriesBurned', COALESCE(calories_burned, 0),
      'activeMinutes', COALESCE(active_minutes, 0),
      'heartRate', heart_rate_avg
    ) ORDER BY date
  )
  INTO daily_breakdown
  FROM public.google_fit_data
  WHERE user_id = p_user_id
    AND date >= p_week_start_date
    AND date <= week_end_date;
  
  -- Insert or update the weekly aggregate
  INSERT INTO public.weekly_google_fit_aggregates (
    user_id,
    week_start_date,
    week_end_date,
    total_distance_km,
    total_steps,
    total_calories_burned,
    total_active_minutes,
    average_heart_rate,
    daily_breakdown,
    last_calculated_at
  ) VALUES (
    p_user_id,
    p_week_start_date,
    week_end_date,
    total_distance,
    total_steps,
    total_calories,
    total_active_minutes,
    CASE WHEN heart_rate_count > 0 THEN total_heart_rate ELSE NULL END,
    COALESCE(daily_breakdown, '[]'::jsonb),
    NOW()
  )
  ON CONFLICT (user_id, week_start_date)
  DO UPDATE SET
    total_distance_km = EXCLUDED.total_distance_km,
    total_steps = EXCLUDED.total_steps,
    total_calories_burned = EXCLUDED.total_calories_burned,
    total_active_minutes = EXCLUDED.total_active_minutes,
    average_heart_rate = EXCLUDED.average_heart_rate,
    daily_breakdown = EXCLUDED.daily_breakdown,
    last_calculated_at = EXCLUDED.last_calculated_at,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get or calculate weekly aggregates
CREATE OR REPLACE FUNCTION get_weekly_google_fit_aggregates(
  p_user_id UUID,
  p_week_start_date DATE DEFAULT NULL
) RETURNS TABLE (
  total_distance_km DECIMAL(10, 2),
  total_steps INTEGER,
  total_calories_burned DECIMAL(10, 2),
  total_active_minutes INTEGER,
  average_heart_rate DECIMAL(5, 2),
  daily_breakdown JSONB
) AS $$
DECLARE
  actual_week_start DATE;
  week_end_date DATE;
  aggregate_exists BOOLEAN;
BEGIN
  -- Use current week if no date provided
  IF p_week_start_date IS NULL THEN
    actual_week_start := date_trunc('week', CURRENT_DATE)::DATE;
  ELSE
    actual_week_start := p_week_start_date;
  END IF;
  
  week_end_date := actual_week_start + INTERVAL '6 days';
  
  -- Check if aggregate exists and is recent (within last hour)
  SELECT EXISTS(
    SELECT 1 FROM public.weekly_google_fit_aggregates
    WHERE user_id = p_user_id
      AND week_start_date = actual_week_start
      AND last_calculated_at > NOW() - INTERVAL '1 hour'
  ) INTO aggregate_exists;
  
  -- If no recent aggregate, calculate it
  IF NOT aggregate_exists THEN
    PERFORM calculate_weekly_google_fit_aggregates(p_user_id, actual_week_start);
  END IF;
  
  -- Return the aggregate data
  RETURN QUERY
  SELECT 
    w.total_distance_km,
    w.total_steps,
    w.total_calories_burned,
    w.total_active_minutes,
    w.average_heart_rate,
    w.daily_breakdown
  FROM public.weekly_google_fit_aggregates w
  WHERE w.user_id = p_user_id
    AND w.week_start_date = actual_week_start;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.weekly_google_fit_aggregates IS 'Pre-calculated weekly Google Fit data aggregates for better performance';
COMMENT ON FUNCTION calculate_weekly_google_fit_aggregates IS 'Calculates and stores weekly Google Fit aggregates';
COMMENT ON FUNCTION get_weekly_google_fit_aggregates IS 'Gets or calculates weekly Google Fit aggregates with caching';
