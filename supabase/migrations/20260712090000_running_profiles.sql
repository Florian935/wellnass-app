-- Running R3a : profil coureur (une ligne par compte).
-- Appliqué manuellement par un humain sur le cloud Supabase ou en local (Docker), après
-- les migrations du socle running (20260707120000+).
-- Réf. : docs/specs/functional/running.md §2 · US Running R3a (profil & types de course).

create table public.running_profiles (
  id uuid primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  objective text check (objective in ('5k','10k','semi','marathon','perte_poids','endurance')),
  level text check (level in ('debutant','regulier','confirme')),
  ref_5k_pace_s_per_km numeric,
  weekly_frequency integer check (weekly_frequency between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.running_profiles
  for each row execute function public.set_updated_at();

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table public.running_profiles;

-- RLS (Row Level Security) — pilier Running, profil coureur.
-- Table « utilisateur » (user_id) : select / insert / update — pas de delete (soft delete).

alter table public.running_profiles enable row level security;

create policy running_profiles_select on public.running_profiles
  for select using (user_id = auth.uid());
create policy running_profiles_insert on public.running_profiles
  for insert with check (user_id = auth.uid());
create policy running_profiles_update on public.running_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
