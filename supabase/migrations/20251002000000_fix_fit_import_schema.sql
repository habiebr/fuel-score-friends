-- Fix FIT import schema to support multiple sessions per day
-- Add session_start column and remove unique constraint

-- Add session_start column
ALTER TABLE public.wearable_data 
ADD COLUMN IF NOT EXISTS session_start TIMESTAMPTZ;

-- Drop the unique constraint that prevents multiple sessions per day
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'wearable_data'
      AND n.nspname = 'public'
      AND c.conname = 'wearable_data_user_date_key'
  ) THEN
    ALTER TABLE public.wearable_data DROP CONSTRAINT wearable_data_user_date_key;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Add a unique constraint on (user_id, session_start) to prevent duplicate sessions
-- This allows multiple sessions per day but prevents exact duplicates
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'wearable_data'
      AND n.nspname = 'public'
      AND c.conname = 'wearable_data_user_session_unique'
  ) THEN
    ALTER TABLE public.wearable_data 
    ADD CONSTRAINT wearable_data_user_session_unique 
    UNIQUE (user_id, session_start);
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Ensure we have proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_wearable_data_user_date ON public.wearable_data (user_id, date);
CREATE INDEX IF NOT EXISTS idx_wearable_data_session_start ON public.wearable_data (session_start);
CREATE INDEX IF NOT EXISTS idx_wearable_data_source ON public.wearable_data (source);

-- Update existing records to have session_start = created_at if NULL
UPDATE public.wearable_data 
SET session_start = created_at 
WHERE session_start IS NULL;
