-- Add activity_level column to profiles table for storing weekly training plan
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS activity_level TEXT;

-- Add comment to document the column purpose
COMMENT ON COLUMN public.profiles.activity_level IS 'JSON string containing weekly training plan with daily activities, durations, and estimated calories';
