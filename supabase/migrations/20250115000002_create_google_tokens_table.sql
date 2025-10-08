-- Create Google tokens table for tracking token periods and automatic refresh
CREATE TABLE IF NOT EXISTS public.google_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT DEFAULT 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  refresh_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_google_tokens_user_id 
  ON public.google_tokens(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_google_tokens_expires_at 
  ON public.google_tokens(expires_at) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_google_tokens_user_active 
  ON public.google_tokens(user_id, is_active, expires_at);

-- Enable Row Level Security
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own tokens"
  ON public.google_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON public.google_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON public.google_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON public.google_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_google_tokens_updated_at_trigger
  BEFORE UPDATE ON public.google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_tokens_updated_at();

-- Function to deactivate old tokens when new ones are inserted
CREATE OR REPLACE FUNCTION deactivate_old_google_tokens()
RETURNS TRIGGER AS $$
BEGIN
  -- Deactivate all other active tokens for this user
  UPDATE public.google_tokens 
  SET is_active = FALSE, updated_at = NOW()
  WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND is_active = TRUE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to deactivate old tokens
CREATE TRIGGER deactivate_old_google_tokens_trigger
  AFTER INSERT ON public.google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_old_google_tokens();

-- Add comment
COMMENT ON TABLE public.google_tokens IS 'Google OAuth tokens with automatic refresh tracking';
COMMENT ON COLUMN public.google_tokens.refresh_count IS 'Number of times this token has been refreshed';
COMMENT ON COLUMN public.google_tokens.is_active IS 'Whether this is the current active token for the user';
