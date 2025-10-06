-- Replace wearable_stats with google_fit_data table
-- This migration creates a new table specifically for Google Fit exercise data

-- Create google_fit_data table
CREATE TABLE IF NOT EXISTS public.google_fit_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Exercise/Activity Data
  steps INTEGER DEFAULT 0,
  calories_burned DECIMAL(10, 2) DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  distance_meters DECIMAL(10, 2) DEFAULT 0,
  heart_rate_avg DECIMAL(5, 2),
  
  -- Activity Sessions (from Google Fit activities)
  sessions JSONB DEFAULT '[]'::jsonb,
  
  -- Sync metadata
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_source TEXT DEFAULT 'google_fit',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per date
  UNIQUE(user_id, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_google_fit_data_user_date 
  ON public.google_fit_data(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_google_fit_data_last_synced 
  ON public.google_fit_data(last_synced_at DESC);

-- Enable Row Level Security
ALTER TABLE public.google_fit_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own google fit data"
  ON public.google_fit_data
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own google fit data"
  ON public.google_fit_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google fit data"
  ON public.google_fit_data
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google fit data"
  ON public.google_fit_data
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_fit_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_google_fit_data_updated_at_trigger
  BEFORE UPDATE ON public.google_fit_data
  FOR EACH ROW
  EXECUTE FUNCTION update_google_fit_data_updated_at();

-- Add comment
COMMENT ON TABLE public.google_fit_data IS 'Stores exercise and activity data from Google Fit integration';

