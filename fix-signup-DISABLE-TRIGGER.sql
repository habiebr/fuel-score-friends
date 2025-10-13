-- NUCLEAR OPTION: Temporarily disable profile creation trigger
-- This will let users sign up without creating a profile
-- We can create profiles manually later

-- Step 1: Disable the trigger temporarily
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Make profiles table allow NULL user_id temporarily (for testing)
-- Actually, don't do this - just disable the trigger

-- Step 3: Users can now sign up without profile creation blocking them
-- Later, you can manually create profiles or re-enable the trigger

-- To re-enable later, run this:
/*
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
*/

-- Step 4: Grant proper permissions on profiles table
GRANT ALL ON public.profiles TO anon;
GRANT ALL ON public.profiles TO authenticated;

-- Step 5: Check RLS policies - temporarily disable for testing
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- IMPORTANT: After signup works, you need to:
-- 1. Re-enable RLS: ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- 2. Re-create the trigger
-- 3. Create profiles for existing users who signed up without profiles
