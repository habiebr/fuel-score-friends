-- Run this SQL in your Supabase SQL Editor to add missing columns
-- Go to: Supabase Dashboard > SQL Editor > New Query > Paste this code > Run

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_date DATE,
ADD COLUMN IF NOT EXISTS fitness_level TEXT;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('target_date', 'fitness_level');


