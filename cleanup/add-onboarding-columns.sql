-- Add onboarding status columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('male', 'female'));

-- Mark existing users as having completed onboarding
UPDATE public.profiles 
SET onboarding_completed = TRUE 
WHERE onboarding_completed IS FALSE OR onboarding_completed IS NULL;

-- Add comments
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Tracks whether user has completed the onboarding wizard';
COMMENT ON COLUMN public.profiles.sex IS 'Biological sex for BMR calculation (Mifflin-St Jeor equation)';

-- Verify the changes
SELECT 
  user_id, 
  full_name, 
  onboarding_completed,
  sex,
  created_at
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 5;
