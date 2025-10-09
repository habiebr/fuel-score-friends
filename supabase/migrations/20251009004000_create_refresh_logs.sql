-- Persisted logs for token refresh runs
CREATE TABLE IF NOT EXISTS public.refresh_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  processed INTEGER DEFAULT 0,
  refreshed INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  deactivated INTEGER DEFAULT 0,
  force_refresh BOOLEAN DEFAULT false,
  threshold_minutes INTEGER,
  batch_size INTEGER,
  error TEXT
);

ALTER TABLE public.refresh_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refresh_logs_deny_all ON public.refresh_logs;
CREATE POLICY refresh_logs_deny_all ON public.refresh_logs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);


