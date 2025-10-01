-- Allow multiple wearable_data rows per user per date
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'wearable_data'
      AND n.nspname = 'public'
      AND c.conname = 'wearable_data_user_id_date_key'
  ) THEN
    ALTER TABLE public.wearable_data DROP CONSTRAINT wearable_data_user_id_date_key;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Optional: add an index to keep queries fast
CREATE INDEX IF NOT EXISTS idx_wearable_data_user_date ON public.wearable_data(user_id, date);


