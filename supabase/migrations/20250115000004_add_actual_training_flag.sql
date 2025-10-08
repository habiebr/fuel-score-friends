-- Add is_actual flag to training_activities table to distinguish between planned and actual activities
-- This allows the system to track both planned training and actual completed training

-- Add is_actual column with default false (for backward compatibility)
ALTER TABLE public.training_activities 
ADD COLUMN IF NOT EXISTS is_actual boolean NOT NULL DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS training_activities_user_date_actual_idx 
ON public.training_activities(user_id, date, is_actual);

-- Add comment for documentation
COMMENT ON COLUMN public.training_activities.is_actual IS 'Flag to distinguish between planned (false) and actual (true) training activities';

-- Update existing records to be marked as planned (is_actual = false)
-- This ensures all existing records are treated as planned activities
UPDATE public.training_activities 
SET is_actual = false 
WHERE is_actual IS NULL;
