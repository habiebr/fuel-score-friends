# URGENT: Fix Signup Database Error (500)

## Problem
Users cannot sign up - getting "Database error saving new user" with HTTP 500.

## Root Cause
The `handle_new_user()` database trigger has a syntax error in the CASE statement (missing variable assignment).

## Solution
Run the SQL migration to fix the trigger function.

---

## 🚀 Quick Fix - Run This SQL

**Go to:** https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql/new

**Paste and run this SQL:**

```sql
-- Fix handle_new_user function CASE syntax error and improve error handling

-- First, drop and recreate the validation trigger to ensure it doesn't interfere
DROP TRIGGER IF EXISTS validate_timezone_trigger ON public.profiles;

-- Recreate handle_new_user function with proper CASE syntax
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
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RAISE;
END;
$function$;

-- Recreate timezone validation function with better error handling
CREATE OR REPLACE FUNCTION public.validate_timezone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only validate if timezone is not NULL
  IF NEW.timezone IS NOT NULL THEN
    -- Check if timezone exists in pg_timezone_names
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
      -- Auto-fix invalid timezone instead of raising exception
      NEW.timezone := 'UTC';
      RAISE WARNING 'Invalid timezone % changed to UTC for user %', NEW.timezone, NEW.user_id;
    END IF;
  ELSE
    -- Auto-set to UTC if NULL
    NEW.timezone := 'UTC';
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate validation trigger
CREATE TRIGGER validate_timezone_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_timezone();
```

---

## ✅ What This Fixes

1. **CASE Syntax Error**: Fixed missing variable assignment in CASE statement
2. **Better Error Handling**: Added exception handling with detailed logging
3. **Timezone Validation**: Changed from raising errors to auto-fixing invalid timezones
4. **Default Values**: Ensures all new users get a valid timezone (UTC fallback)

---

## 📝 Verification

After running the SQL, test signup:

1. Go to: https://app.nutrisync.id/auth
2. Try to create a new account
3. Should succeed without "Database error"

---

## 🔍 Technical Details

**What was wrong:**
```sql
-- WRONG (old code):
CASE NEW.raw_user_meta_data->>'locale'
  WHEN 'id' THEN default_timezone := 'Asia/Jakarta'  -- Missing END;
```

**What's fixed:**
```sql
-- CORRECT (new code):
user_locale := NEW.raw_user_meta_data->>'locale';
default_timezone := CASE user_locale
  WHEN 'id' THEN 'Asia/Jakarta'
  ELSE 'UTC'
END;  -- Properly closed with assignment
```
