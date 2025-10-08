-- Clear existing Google Fit data to force re-sync with exercise-only filtering
-- This migration removes all existing Google Fit data so it can be re-synced with proper filtering

-- Clear google_fit_data table
DELETE FROM google_fit_data;

-- Clear google_fit_sessions table  
DELETE FROM google_fit_sessions;

-- Clear any related user preferences
DELETE FROM user_preferences WHERE key IN ('googleFitLastSync', 'googleFitStatus');

-- Note: Weekly aggregates are calculated dynamically, no need to reset

-- Add comment for tracking
COMMENT ON TABLE google_fit_data IS 'Cleared on 2025-01-15 to implement exercise-only filtering (no walking)';
COMMENT ON TABLE google_fit_sessions IS 'Cleared on 2025-01-15 to implement exercise-only filtering (no walking)';
