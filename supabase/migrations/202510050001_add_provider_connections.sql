-- Provider connections to store OAuth tokens per user
create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava', 'garmin', 'google_fit')),
  access_token text,
  refresh_token text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create index if not exists idx_provider_connections_user on public.provider_connections(user_id);

-- Raw webhook events (optional storage for debugging / replay)
create table if not exists public.strava_events (
  id bigserial primary key,
  object_type text,
  aspect_type text,
  object_id bigint,
  owner_id bigint,
  event_time timestamptz default now(),
  raw jsonb
);

create index if not exists idx_strava_events_object on public.strava_events(object_id);

-- Row Level Security (enabled, allow users to see only their own connections)
alter table public.provider_connections enable row level security;

create policy "Users can view own provider connections" on public.provider_connections
  for select using (auth.uid() = user_id);

create policy "Users can upsert own provider connections" on public.provider_connections
  for insert with check (auth.uid() = user_id);

create policy "Users can update own provider connections" on public.provider_connections
  for update using (auth.uid() = user_id);


