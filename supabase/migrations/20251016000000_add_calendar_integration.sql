-- Migration: Add Calendar Integration (Runna, TrainingPeaks, etc.)
-- Created: 2025-10-16

-- Create calendar_integrations table
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('runna', 'trainingpeaks', 'final_surge', 'custom')),
  calendar_url TEXT NOT NULL,
  calendar_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT CHECK (sync_status IN ('success', 'error', 'pending')),
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- One calendar URL per user (can be added multiple times if user disconnects/reconnects)
  UNIQUE(user_id, calendar_url)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user 
  ON public.calendar_integrations(user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_active 
  ON public.calendar_integrations(user_id, is_active) 
  WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own calendar integrations"
  ON public.calendar_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar integrations"
  ON public.calendar_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar integrations"
  ON public.calendar_integrations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar integrations"
  ON public.calendar_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Add calendar tracking fields to training_activities
ALTER TABLE public.training_activities 
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_integration_id UUID REFERENCES public.calendar_integrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_from_calendar BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Index for efficient sync lookups
CREATE INDEX IF NOT EXISTS idx_training_activities_external_id 
  ON public.training_activities(calendar_integration_id, external_id) 
  WHERE calendar_integration_id IS NOT NULL;

-- Unique constraint: one external event per calendar
-- This ensures we don't duplicate calendar events
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_activities_calendar_external_unique
  ON public.training_activities(calendar_integration_id, external_id)
  WHERE calendar_integration_id IS NOT NULL AND external_id IS NOT NULL;

-- Updated_at trigger for calendar_integrations
CREATE OR REPLACE FUNCTION public.set_updated_at_calendar_integrations()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calendar_integrations_updated_at ON public.calendar_integrations;
CREATE TRIGGER calendar_integrations_updated_at
  BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_calendar_integrations();

-- Add comments
COMMENT ON TABLE public.calendar_integrations IS 'Stores user connections to external training calendars (Runna, TrainingPeaks, etc.)';
COMMENT ON COLUMN public.training_activities.external_id IS 'UID from external calendar event (for sync tracking)';
COMMENT ON COLUMN public.training_activities.calendar_integration_id IS 'Reference to calendar source';
COMMENT ON COLUMN public.training_activities.is_from_calendar IS 'True if activity was synced from external calendar';
COMMENT ON COLUMN public.training_activities.last_synced_at IS 'When this calendar event was last synced';

