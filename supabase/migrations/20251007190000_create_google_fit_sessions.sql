-- Create normalized table for individual Google Fit sessions
CREATE TABLE IF NOT EXISTS public.google_fit_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  activity_type TEXT,
  name TEXT,
  description TEXT,
  source TEXT DEFAULT 'google_fit',
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, session_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_gf_sessions_user_time
  ON public.google_fit_sessions(user_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_gf_sessions_activity
  ON public.google_fit_sessions(activity_type);

-- Row Level Security
ALTER TABLE public.google_fit_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sessions"
  ON public.google_fit_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own sessions"
  ON public.google_fit_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
  ON public.google_fit_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own sessions"
  ON public.google_fit_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER google_fit_sessions_set_updated_at
BEFORE UPDATE ON public.google_fit_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.google_fit_sessions IS 'Normalized per-activity sessions captured from Google Fit';

