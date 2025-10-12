-- Update handle_new_user function to set default timezone from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  default_timezone TEXT;
BEGIN
  -- Try to get timezone from user metadata
  default_timezone := NEW.raw_user_meta_data->>'timezone';
  
  -- If not in metadata, try to get from locale data
  IF default_timezone IS NULL THEN
    CASE NEW.raw_user_meta_data->>'locale'
      WHEN 'id' THEN default_timezone := 'Asia/Jakarta'
      WHEN 'ja' THEN default_timezone := 'Asia/Tokyo'
      WHEN 'zh-CN' THEN default_timezone := 'Asia/Shanghai'
      WHEN 'zh-TW' THEN default_timezone := 'Asia/Taipei'
      ELSE default_timezone := 'UTC'
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