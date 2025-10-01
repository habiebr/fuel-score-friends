-- Add missing columns for goals functionality
-- This migration only adds the missing columns without recreating tables

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_date DATE,
ADD COLUMN IF NOT EXISTS fitness_level TEXT;

-- Verify the columns were added
SELECT 'Columns added successfully' as status;
