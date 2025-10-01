-- Add enhanced metrics columns to wearable_data
ALTER TABLE public.wearable_data
ADD COLUMN avg_temperature integer,
ADD COLUMN training_effect numeric(3,1),
ADD COLUMN recovery_time integer;

-- Create laps table for lap-by-lap analysis
CREATE TABLE public.wearable_laps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  wearable_data_id uuid REFERENCES public.wearable_data(id) ON DELETE CASCADE,
  lap_index integer NOT NULL,
  start_time timestamp with time zone NOT NULL,
  total_time numeric,
  total_distance numeric,
  avg_heart_rate integer,
  max_heart_rate integer,
  avg_speed numeric,
  calories integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on laps table
ALTER TABLE public.wearable_laps ENABLE ROW LEVEL SECURITY;

-- RLS policies for laps
CREATE POLICY "Users can view their own laps"
ON public.wearable_laps
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own laps"
ON public.wearable_laps
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own laps"
ON public.wearable_laps
FOR UPDATE
USING (auth.uid() = user_id);

-- Add index for better query performance
CREATE INDEX idx_wearable_laps_user_id ON public.wearable_laps(user_id);
CREATE INDEX idx_wearable_laps_data_id ON public.wearable_laps(wearable_data_id);