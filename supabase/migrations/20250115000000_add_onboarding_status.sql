-- Add onboarding completion tracking to profiles table
-- This allows us to track which users have completed the onboarding process

-- Add onboarding_completed column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add sex column if it doesn't exist (needed for nutrition calculations)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('male', 'female'));

-- Add comments
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Tracks whether user has completed the onboarding wizard';
COMMENT ON COLUMN public.profiles.sex IS 'Biological sex for BMR calculation (Mifflin-St Jeor equation)';

-- Mark existing users as having completed onboarding (they're already using the app)
UPDATE public.profiles 
SET onboarding_completed = TRUE 
WHERE onboarding_completed IS FALSE;

-- Verify the changes
SELECT 'Onboarding status column added successfully' as status;
