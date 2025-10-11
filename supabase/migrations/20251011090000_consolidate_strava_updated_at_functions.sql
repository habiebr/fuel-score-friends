-- Consolidate Strava updated_at Functions
-- Created: 2025-10-11
-- Purpose: Replace 4 duplicate functions with 1 generic function
-- Reduces code duplication and improves maintainability

-- =====================================================
-- 1. CREATE GENERIC TRIGGER FUNCTION
-- =====================================================
-- This generic function can be used by ALL tables in the database
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trigger_set_updated_at() IS 
  'Generic trigger function to automatically update updated_at timestamp on any table. Use this instead of creating table-specific functions.';

-- =====================================================
-- 2. RECREATE STRAVA_TOKENS TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_strava_tokens_updated_at ON public.strava_tokens;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.strava_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- 3. RECREATE STRAVA_ACTIVITIES TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_strava_activities_updated_at ON public.strava_activities;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.strava_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- 4. RECREATE STRAVA_WEBHOOK_SUBSCRIPTIONS TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_strava_webhook_subscriptions_updated_at ON public.strava_webhook_subscriptions;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.strava_webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- 5. RECREATE STRAVA_WEBHOOK_EVENTS TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_strava_webhook_events_updated_at ON public.strava_webhook_events;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.strava_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- 6. DROP OLD TABLE-SPECIFIC FUNCTIONS
-- =====================================================
-- These are no longer needed since we're using the generic function
DROP FUNCTION IF EXISTS update_strava_tokens_updated_at();
DROP FUNCTION IF EXISTS update_strava_activities_updated_at();
DROP FUNCTION IF EXISTS update_strava_webhook_subscriptions_updated_at();
DROP FUNCTION IF EXISTS update_strava_webhook_events_updated_at();

-- =====================================================
-- 7. VERIFICATION
-- =====================================================
-- Run this to verify the migration worked:
-- 
-- SELECT 
--   tablename,
--   triggername,
--   tgtype
-- FROM pg_trigger
-- JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
-- WHERE tablename LIKE 'strava_%'
--   AND triggername = 'set_updated_at';
--
-- Expected: 4 rows showing all 4 strava tables have the set_updated_at trigger
