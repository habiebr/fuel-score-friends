-- Add timezone column to profiles table with UTC as default
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- Add check constraint to ensure timezone is a valid IANA timezone name
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_timezone_check CHECK (
  timezone IN (
    SELECT name FROM pg_timezone_names()
  )
);

-- Update existing profiles with 'UTC' timezone
UPDATE public.profiles 
SET timezone = 'UTC' 
WHERE timezone IS NULL;