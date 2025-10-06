-- Add food preferences columns to profiles table
-- These are used by the Meal Generator and Recipe Recommender (Personalization Engine)

-- Add dietary_restrictions column (array of strings)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'dietary_restrictions'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dietary_restrictions text[] DEFAULT '{}';
  END IF;
END $$;

-- Add eating_behaviors column (array of strings)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'eating_behaviors'
  ) THEN
    ALTER TABLE profiles ADD COLUMN eating_behaviors text[] DEFAULT '{}';
  END IF;
END $$;

-- Add comments to explain the columns
COMMENT ON COLUMN profiles.dietary_restrictions IS 'User dietary restrictions (e.g., lactose intolerant, no red meat) - used by Recipe Recommender to filter incompatible meals';
COMMENT ON COLUMN profiles.eating_behaviors IS 'User eating habits and preferences (e.g., eat eggs for breakfast, prefer plant-based proteins) - used by Meal Generator for personalization';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_profiles_dietary_restrictions ON profiles USING GIN (dietary_restrictions);
CREATE INDEX IF NOT EXISTS idx_profiles_eating_behaviors ON profiles USING GIN (eating_behaviors);

