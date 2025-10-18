-- Script to mark current users as having completed onboarding
-- Run this in Supabase SQL Editor to mark existing users as onboarding completed

-- Add the columns if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('male', 'female'));

-- Mark all existing users as having completed onboarding
UPDATE public.profiles 
SET onboarding_completed = TRUE 
WHERE onboarding_completed IS FALSE OR onboarding_completed IS NULL;

-- Verify the update
SELECT 
  user_id, 
  full_name, 
  onboarding_completed,
  sex,
  created_at
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 10;
