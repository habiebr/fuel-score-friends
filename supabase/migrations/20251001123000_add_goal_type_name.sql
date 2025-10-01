-- Add goal_type and goal_name to profiles for clearer semantics
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS goal_type TEXT,
  ADD COLUMN IF NOT EXISTS goal_name TEXT;

COMMENT ON COLUMN public.profiles.goal_type IS 'Predetermined goal type (e.g., 5k, 10k, half_marathon, full_marathon, ultra, custom)';
COMMENT ON COLUMN public.profiles.goal_name IS 'Human-readable race/event name';

