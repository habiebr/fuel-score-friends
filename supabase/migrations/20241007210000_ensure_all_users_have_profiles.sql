-- Ensure all existing auth.users have a corresponding profile
-- This fixes the issue where users registered before profile creation triggers were set up

DO $$
DECLARE
  user_record RECORD;
  profile_count INTEGER;
BEGIN
  -- Loop through all auth.users
  FOR user_record IN SELECT id, email, raw_user_meta_data FROM auth.users
  LOOP
    -- Check if this user has a profile
    SELECT COUNT(*) INTO profile_count 
    FROM public.profiles 
    WHERE user_id = user_record.id;
    
    -- If no profile exists, create one
    IF profile_count = 0 THEN
      INSERT INTO public.profiles (user_id, full_name, created_at, updated_at)
      VALUES (
        user_record.id,
        COALESCE(
          user_record.raw_user_meta_data->>'full_name',
          user_record.raw_user_meta_data->>'display_name',
          split_part(user_record.email, '@', 1)
        ),
        now(),
        now()
      );
      
      RAISE NOTICE 'Created profile for user: % (%)', user_record.email, user_record.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Profile sync complete!';
END $$;

-- Verify the sync worked
DO $$
DECLARE
  auth_user_count INTEGER;
  profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO auth_user_count FROM auth.users;
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  
  RAISE NOTICE 'Auth users: %, Profiles: %', auth_user_count, profile_count;
  
  IF auth_user_count != profile_count THEN
    RAISE WARNING 'Mismatch! % auth users but % profiles', auth_user_count, profile_count;
  ELSE
    RAISE NOTICE '✅ All users have profiles!';
  END IF;
END $$;

