-- Add detailed activity metrics columns to wearable_data table
ALTER TABLE wearable_data
ADD COLUMN IF NOT EXISTS distance_meters numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS elevation_gain numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_heart_rate integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS heart_rate_zones jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS avg_cadence integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_power integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_speed numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS activity_type text,
ADD COLUMN IF NOT EXISTS gps_data jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS detailed_metrics jsonb DEFAULT '{}';