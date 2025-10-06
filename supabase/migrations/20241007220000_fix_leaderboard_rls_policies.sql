-- Fix RLS policies to allow global leaderboard visibility
-- Users need to see other users' basic profile info (name, stats) for the leaderboard

-- Drop the old restrictive policy that only allows viewing own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create new policies that allow:
-- 1. All authenticated users can VIEW all profiles (for leaderboard)
-- 2. Users can only UPDATE/INSERT their own profile (for security)

CREATE POLICY "Authenticated users can view all profiles for leaderboard" 
ON public.profiles FOR SELECT 
TO authenticated
USING (true); -- Allow viewing all profiles

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also fix nutrition_scores to allow viewing all scores for leaderboard
DROP POLICY IF EXISTS "Users can view their own nutrition scores" ON public.nutrition_scores;
DROP POLICY IF EXISTS "Users can insert their own nutrition scores" ON public.nutrition_scores;
DROP POLICY IF EXISTS "Users can update their own nutrition scores" ON public.nutrition_scores;

CREATE POLICY "Authenticated users can view all nutrition scores for leaderboard" 
ON public.nutrition_scores FOR SELECT 
TO authenticated
USING (true); -- Allow viewing all scores

-- Keep the insert/update policies restrictive
CREATE POLICY "Users can insert their own nutrition scores" 
ON public.nutrition_scores FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nutrition scores" 
ON public.nutrition_scores FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Fix google_fit_data policies for leaderboard visibility
DROP POLICY IF EXISTS "Users can view their own wearable data" ON public.google_fit_data;
DROP POLICY IF EXISTS "Users can insert their own wearable data" ON public.google_fit_data;
DROP POLICY IF EXISTS "Users can update their own wearable data" ON public.google_fit_data;
DROP POLICY IF EXISTS "Users can insert their own Google Fit data" ON public.google_fit_data;
DROP POLICY IF EXISTS "Users can update their own Google Fit data" ON public.google_fit_data;

CREATE POLICY "Authenticated users can view all Google Fit data for leaderboard" 
ON public.google_fit_data FOR SELECT 
TO authenticated
USING (true); -- Allow viewing all fitness data

CREATE POLICY "Users can insert their own Google Fit data" 
ON public.google_fit_data FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google Fit data" 
ON public.google_fit_data FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON POLICY "Authenticated users can view all profiles for leaderboard" ON public.profiles IS 
'Allow all authenticated users to view profile data for global leaderboard. Write operations are still restricted to own data.';

COMMENT ON POLICY "Authenticated users can view all nutrition scores for leaderboard" ON public.nutrition_scores IS 
'Allow all authenticated users to view nutrition scores for global leaderboard rankings.';

COMMENT ON POLICY "Authenticated users can view all Google Fit data for leaderboard" ON public.google_fit_data IS 
'Allow all authenticated users to view fitness data for global leaderboard rankings.';

