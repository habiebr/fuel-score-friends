-- Create a small settings table to store the token refresh secret without requiring GUCs
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: allow only service role to read; block anon/authenticated
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_deny_all ON public.app_settings;
CREATE POLICY app_settings_deny_all ON public.app_settings FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Convenience upsert to seed from SQL (run once via admin):
-- INSERT INTO public.app_settings(key, value) VALUES ('refresh_secret', '<LONG_SECRET>')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();


