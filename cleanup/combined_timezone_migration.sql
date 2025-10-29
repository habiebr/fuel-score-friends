-- Combined timezone migrations for easy execution in SQL editor

-- First, add timezone column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- Create timezone validation function
CREATE OR REPLACE FUNCTION public.validate_timezone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Check if timezone exists in pg_timezone_names
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Invalid timezone: %', NEW.timezone;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for timezone validation
DROP TRIGGER IF EXISTS validate_timezone_trigger ON public.profiles;
CREATE TRIGGER validate_timezone_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_timezone();

-- Update existing profiles with 'UTC' timezone
UPDATE public.profiles 
SET timezone = 'UTC' 
WHERE timezone IS NULL;

-- Update handle_new_user function to set default timezone from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  default_timezone TEXT;
  user_locale TEXT;
BEGIN
  -- Try to get timezone from user metadata
  default_timezone := NEW.raw_user_meta_data->>'timezone';
  
  -- If not in metadata, try to get from locale data
  IF default_timezone IS NULL THEN
    user_locale := NEW.raw_user_meta_data->>'locale';
    
    default_timezone := CASE user_locale
      WHEN 'id' THEN 'Asia/Jakarta'
      WHEN 'ja' THEN 'Asia/Tokyo'
      WHEN 'zh-CN' THEN 'Asia/Shanghai'
      WHEN 'zh-TW' THEN 'Asia/Taipei'
      ELSE 'UTC'
    END;
  END IF;

  -- Validate timezone against pg_timezone_names
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = default_timezone) THEN
    default_timezone := 'UTC';
  END IF;

  -- Insert new profile with timezone
  INSERT INTO public.profiles (user_id, display_name, timezone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    default_timezone
  );
  
  RETURN NEW;
END;
$function$;