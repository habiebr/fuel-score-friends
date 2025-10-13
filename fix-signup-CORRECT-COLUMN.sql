-- FIX: Use correct column name (full_name instead of display_name)

-- Drop the timezone validation trigger
DROP TRIGGER IF EXISTS validate_timezone_trigger ON public.profiles;

-- Make timezone nullable temporarily
ALTER TABLE public.profiles ALTER COLUMN timezone DROP NOT NULL;

-- Fix handle_new_user to use correct column name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Use full_name instead of display_name
  INSERT INTO public.profiles (user_id, full_name, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'UTC'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user failed for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Set timezone default
ALTER TABLE public.profiles ALTER COLUMN timezone SET DEFAULT 'UTC';
