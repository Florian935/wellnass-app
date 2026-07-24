-- US 9.10 — analytics_events : événements d'usage anonymisés (first-party). Append-only.
create table public.analytics_events (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  event_name  text not null,
  properties  text not null default '{}',   -- JSON sérialisé (text : cohérent PowerSync)
  app_version text,
  platform    text,
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now()
);
create index analytics_events_user_id_idx on public.analytics_events (user_id);

alter table public.analytics_events enable row level security;
create policy "analytics_events_insert_own" on public.analytics_events
  for insert with check (auth.uid() = user_id);
create policy "analytics_events_select_own" on public.analytics_events
  for select using (auth.uid() = user_id);

-- Consentement analytics (opt-out : activé par défaut).
alter table public.user_settings add column analytics_enabled boolean not null default true;
