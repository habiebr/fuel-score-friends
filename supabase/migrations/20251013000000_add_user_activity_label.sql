-- Add user_activity_label column to training_activities table
-- This preserves the user's explicit activity type selection (long_run, interval, etc.)

ALTER TABLE public.training_activities 
ADD COLUMN IF NOT EXISTS user_activity_label TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.training_activities.user_activity_label IS 
'User-selected activity type label: long_run, interval, regular_run, strength, rest. Used to respect user intent over automatic classification.';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_training_activities_user_activity_label 
ON public.training_activities(user_activity_label);

-- Update existing records with inferred labels based on parameters
UPDATE public.training_activities
SET user_activity_label = 
  CASE 
    WHEN activity_type = 'rest' THEN 'rest'
    WHEN activity_type = 'strength' THEN 'strength'
    WHEN activity_type = 'run' AND distance_km >= 15 THEN 'long_run'
    WHEN activity_type = 'run' AND intensity = 'high' THEN 'interval'
    WHEN activity_type = 'run' THEN 'regular_run'
    WHEN activity_type = 'cardio' THEN 'cardio'
    ELSE 'other'
  END
WHERE user_activity_label IS NULL;
