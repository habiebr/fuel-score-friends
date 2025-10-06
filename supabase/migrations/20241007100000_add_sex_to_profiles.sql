-- Add sex column to profiles table for nutrition calculations
-- Required for BMR calculation using Mifflin-St Jeor equation

-- Add sex column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'sex'
  ) THEN
    ALTER TABLE profiles ADD COLUMN sex text CHECK (sex IN ('male', 'female')) DEFAULT 'male';
  END IF;
END $$;

-- Add comment to explain the column
COMMENT ON COLUMN profiles.sex IS 'Biological sex for BMR calculation (Mifflin-St Jeor equation uses different formulas for male/female)';

