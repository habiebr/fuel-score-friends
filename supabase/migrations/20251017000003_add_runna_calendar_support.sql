-- Add Runna Calendar Integration Support
-- Date: 2025-10-17

-- Add Runna calendar URL to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS runna_calendar_url TEXT,
ADD COLUMN IF NOT EXISTS runna_last_synced_at TIMESTAMPTZ;

-- Add Runna source flag to training_activities
ALTER TABLE public.training_activities
ADD COLUMN IF NOT EXISTS is_from_runna BOOLEAN DEFAULT FALSE;

-- Create index for efficient Runna activity lookups
CREATE INDEX IF NOT EXISTS idx_training_activities_runna
ON public.training_activities(user_id, date, is_from_runna)
WHERE is_from_runna = TRUE;

-- Add comments for clarity
COMMENT ON COLUMN public.profiles.runna_calendar_url IS 
  'ICS calendar URL from Runna (e.g., https://cal.runna.com/xxx.ics)';

COMMENT ON COLUMN public.profiles.runna_last_synced_at IS 
  'Last time Runna calendar was successfully synced';

COMMENT ON COLUMN public.training_activities.is_from_runna IS 
  'TRUE if this activity was imported from Runna calendar, FALSE for manual or pattern-generated activities';

-- Update RLS policies to handle Runna activities
-- (Users can only see/edit their own activities regardless of source)

