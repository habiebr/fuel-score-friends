-- Add unique constraint for laps upsert functionality
ALTER TABLE public.wearable_laps
ADD CONSTRAINT wearable_laps_data_lap_unique UNIQUE (wearable_data_id, lap_index);