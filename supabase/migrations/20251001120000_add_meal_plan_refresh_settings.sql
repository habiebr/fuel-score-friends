-- Add meal plan refresh settings to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS meal_plan_refresh_mode TEXT DEFAULT 'daily_6am',
  ADD COLUMN IF NOT EXISTS timezone TEXT;

COMMENT ON COLUMN public.profiles.meal_plan_refresh_mode IS 'Meal plan auto refresh cadence: daily_6am or every_15m';
COMMENT ON COLUMN public.profiles.timezone IS 'User IANA timezone (e.g., Asia/Jakarta)';

