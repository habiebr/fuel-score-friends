-- Add notes column to training_notifications
-- This stores additional metadata about the workout for recovery notifications
-- Date: 2025-10-17

ALTER TABLE public.training_notifications 
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '{}'::jsonb;

-- Add index for querying notes
CREATE INDEX IF NOT EXISTS idx_training_notifications_notes 
ON public.training_notifications USING gin(notes);

-- Add comment
COMMENT ON COLUMN public.training_notifications.notes IS 
  'Additional metadata for notifications (e.g., session_id, minutes_since_end, distance)';

