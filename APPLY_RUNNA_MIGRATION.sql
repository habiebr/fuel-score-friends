-- ============================================
-- RUNNA CALENDAR INTEGRATION - APPLY MIGRATION
-- ============================================
-- Run this in Supabase SQL Editor
-- Project: app.nutrisync.id

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

-- Verify the changes
DO $$
DECLARE
  runna_url_exists boolean;
  runna_sync_exists boolean;
  is_from_runna_exists boolean;
  index_exists boolean;
BEGIN
  -- Check profiles columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'runna_calendar_url'
  ) INTO runna_url_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'runna_last_synced_at'
  ) INTO runna_sync_exists;
  
  -- Check training_activities column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'training_activities' 
    AND column_name = 'is_from_runna'
  ) INTO is_from_runna_exists;
  
  -- Check index
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_training_activities_runna'
  ) INTO index_exists;
  
  -- Report results
  RAISE NOTICE '=== Migration Verification ===';
  RAISE NOTICE 'profiles.runna_calendar_url: %', CASE WHEN runna_url_exists THEN '✅ Added' ELSE '❌ Missing' END;
  RAISE NOTICE 'profiles.runna_last_synced_at: %', CASE WHEN runna_sync_exists THEN '✅ Added' ELSE '❌ Missing' END;
  RAISE NOTICE 'training_activities.is_from_runna: %', CASE WHEN is_from_runna_exists THEN '✅ Added' ELSE '❌ Missing' END;
  RAISE NOTICE 'idx_training_activities_runna: %', CASE WHEN index_exists THEN '✅ Created' ELSE '❌ Missing' END;
  
  -- Final status
  IF runna_url_exists AND runna_sync_exists AND is_from_runna_exists AND index_exists THEN
    RAISE NOTICE '🎉 Migration applied successfully!';
  ELSE
    RAISE WARNING '⚠️ Migration incomplete - check errors above';
  END IF;
END $$;

-- Show sample data structure
SELECT 
  'Sample profiles structure' as info,
  user_id,
  runna_calendar_url,
  runna_last_synced_at
FROM profiles
LIMIT 1;

SELECT 
  'Sample training_activities structure' as info,
  user_id,
  date,
  activity_type,
  is_from_runna,
  is_actual
FROM training_activities
ORDER BY date DESC
LIMIT 1;

