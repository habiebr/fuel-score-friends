-- Add body metrics columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS weight NUMERIC,
ADD COLUMN IF NOT EXISTS height NUMERIC,
ADD COLUMN IF NOT EXISTS age INTEGER;

-- Add comments to document the column purposes
COMMENT ON COLUMN public.profiles.weight IS 'User weight in kg';
COMMENT ON COLUMN public.profiles.height IS 'User height in cm';
COMMENT ON COLUMN public.profiles.age IS 'User age in years';
