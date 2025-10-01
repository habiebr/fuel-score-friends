-- Quick fix for goals save issue
-- Run this in Supabase SQL Editor

-- Add missing columns for the new two-step goals flow
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_date DATE,
ADD COLUMN IF NOT EXISTS fitness_level TEXT;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('target_date', 'fitness_level')
ORDER BY column_name;

