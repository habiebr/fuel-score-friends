-- Create beta_reports table for collecting beta testing feedback
CREATE TABLE IF NOT EXISTS beta_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'ui', 'performance', 'other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE beta_reports ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own reports
CREATE POLICY "Users can insert their own beta reports" ON beta_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to view their own reports
CREATE POLICY "Users can view their own beta reports" ON beta_reports
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_beta_reports_user_id ON beta_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_reports_created_at ON beta_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_beta_reports_category ON beta_reports(category);
