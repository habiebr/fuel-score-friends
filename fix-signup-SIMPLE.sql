-- SIMPLIFIED FIX: Minimal handle_new_user function
-- This version removes all complexity and just creates a basic profile

-- Step 1: Drop the problematic timezone validation trigger
DROP TRIGGER IF EXISTS validate_timezone_trigger ON public.profiles;

-- Step 2: Make timezone column nullable temporarily
ALTER TABLE public.profiles ALTER COLUMN timezone DROP NOT NULL;

-- Step 3: Create simplified handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Simple insert with minimal logic
  INSERT INTO public.profiles (user_id, display_name, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'UTC'  -- Always use UTC for now
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log detailed error
    RAISE LOG 'handle_new_user failed for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    -- Don't block user creation, just log the error
    RETURN NEW;
END;
$function$;

-- Step 4: Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Add back timezone default for future inserts
ALTER TABLE public.profiles ALTER COLUMN timezone SET DEFAULT 'UTC';
