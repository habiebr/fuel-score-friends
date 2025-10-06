-- Add dashboard_prefs JSONB column to store dashboard customization
alter table if exists public.profiles
  add column if not exists dashboard_prefs jsonb default '{}'::jsonb;

comment on column public.profiles.dashboard_prefs is 'User dashboard preferences: {"hidden": string[], "widgetOrder": string[] }';

