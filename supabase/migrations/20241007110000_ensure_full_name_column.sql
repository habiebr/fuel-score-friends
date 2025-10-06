-- Ensure full_name column exists in profiles table
-- This stores the user's display name

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN full_name text;
  END IF;
END $$;

-- Add comment to explain the column
COMMENT ON COLUMN profiles.full_name IS 'User display name for profile';

-- Note: activity_level is deprecated - activity level should be calculated from
-- training sessions and goals, not stored as a static value

