# Emergency Signup Fix - Manual Steps

## The Problem
Users getting "Database error saving new user" (500 error) when trying to sign up.

## Root Cause Analysis
This error happens BEFORE our database trigger runs, meaning it's an Auth configuration issue.

## Immediate Fix Options

### Option 1: Check Auth Settings
1. Go to: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/auth/users
2. Click "Configuration" → "Email Auth"
3. Make sure "Enable Email Signups" is **ON**
4. Check "Confirm email" - if it's ON and email service isn't configured, turn it **OFF**

### Option 2: Check Email Confirmation Settings
1. Go to: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/auth/email-templates
2. Check if email confirmation is required
3. If yes, either:
   - Configure SMTP settings, OR
   - Disable email confirmation (in Auth → Policies → Email Confirmations → Disable)

### Option 3: Disable Our Trigger Temporarily
If the issue IS our trigger, run this SQL:

```sql
-- Temporarily disable the profile creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Allow direct access to profiles table
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
```

Then try signing up. If it works, the problem is our trigger.

### Option 4: Check Database Logs
1. Go to: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/logs/postgres-logs
2. Click "Sign Up" on your app
3. Immediately check the logs
4. Look for the error message

## Most Likely Cause
Based on error code 500 and "Database error saving new user", this is likely:

**Email confirmation is enabled but SMTP is not configured**

### Quick Fix:
1. Go to: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/auth/providers
2. Click "Email"
3. Scroll to "Confirm email"
4. **Turn it OFF**
5. Click "Save"
6. Try signing up again

## Test After Fix
Try creating a test account at: https://app.nutrisync.id/auth

If you can create an account but have no profile, run this to create profiles for existing users:

```sql
INSERT INTO public.profiles (user_id, display_name, timezone)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  'UTC'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles);
```
