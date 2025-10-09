-- Create table for caching Google Fit API responses
CREATE TABLE IF NOT EXISTS public.google_fit_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, endpoint, request_hash)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_fit_cache_lookup 
ON public.google_fit_cache (user_id, endpoint, request_hash)
WHERE expires_at > NOW();

-- Add index for cleanup
CREATE INDEX IF NOT EXISTS idx_google_fit_cache_cleanup 
ON public.google_fit_cache (expires_at)
WHERE expires_at <= NOW();

-- Enable RLS
ALTER TABLE public.google_fit_cache ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read their own cache"
ON public.google_fit_cache FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_google_fit_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.google_fit_cache
  WHERE expires_at <= NOW();
END;
$$;

-- Schedule cache cleanup every hour
SELECT cron.schedule(
  'clean-google-fit-cache',
  '0 * * * *',  -- Every hour
  'SELECT clean_expired_google_fit_cache();'
);
