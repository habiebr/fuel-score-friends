-- Create hydration_logs table for tracking daily water intake
CREATE TABLE IF NOT EXISTS hydration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_ml INTEGER NOT NULL CHECK (amount_ml > 0),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_hydration_logs_user_id ON hydration_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_hydration_logs_logged_at ON hydration_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_hydration_logs_user_date ON hydration_logs(user_id, logged_at);

-- Enable Row Level Security
ALTER TABLE hydration_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own hydration logs"
  ON hydration_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own hydration logs"
  ON hydration_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hydration logs"
  ON hydration_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hydration logs"
  ON hydration_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE hydration_logs IS 'Tracks daily water/hydration intake for runners';

