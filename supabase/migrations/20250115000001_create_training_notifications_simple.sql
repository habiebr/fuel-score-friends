-- Create training notifications table (simplified version)
CREATE TABLE IF NOT EXISTS public.training_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pre_training', 'post_training', 'recovery')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  training_date DATE NOT NULL,
  activity_type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_training_notifications_user_id 
  ON public.training_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_notifications_scheduled 
  ON public.training_notifications(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_training_notifications_unread 
  ON public.training_notifications(user_id, is_read) 
  WHERE is_read = FALSE;

-- Enable Row Level Security
ALTER TABLE public.training_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (only create if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_notifications' AND policyname = 'Users can view their own notifications') THEN
    CREATE POLICY "Users can view their own notifications"
      ON public.training_notifications
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_notifications' AND policyname = 'Users can insert their own notifications') THEN
    CREATE POLICY "Users can insert their own notifications"
      ON public.training_notifications
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_notifications' AND policyname = 'Users can update their own notifications') THEN
    CREATE POLICY "Users can update their own notifications"
      ON public.training_notifications
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_notifications' AND policyname = 'Users can delete their own notifications') THEN
    CREATE POLICY "Users can delete their own notifications"
      ON public.training_notifications
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_training_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at (only create if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_training_notifications_updated_at_trigger') THEN
    CREATE TRIGGER update_training_notifications_updated_at_trigger
      BEFORE UPDATE ON public.training_notifications
      FOR EACH ROW
      EXECUTE FUNCTION update_training_notifications_updated_at();
  END IF;
END $$;

-- Add comment
COMMENT ON TABLE public.training_notifications IS 'Training nutrition notifications and recommendations';
