-- Running R3c-i : planification datée (table générique pilier-agnostique).
-- Une ligne = une instance datée d'une séance-gabarit (sessions) d'un programme (programs).
-- Le pilier est hérité de la séance/programme lié — jamais dupliqué ici.
-- Appliqué manuellement sur le cloud APRÈS 20260712090000 (R3a) et 20260712100000 (R3b-i).
-- Réf. : docs/specs/functional/us/5.5-5.7-running-r3c1-planning.md.

create table public.planned_sessions (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  scheduled_date date not null,
  status text not null default 'planned' check (status in ('planned','done','skipped')),
  week_index integer,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index planned_sessions_owner_date_idx
  on public.planned_sessions (owner_id, scheduled_date)
  where deleted_at is null;

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.planned_sessions
  for each row execute function public.set_updated_at();

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table public.planned_sessions;

-- RLS (Row Level Security) — planification datée générique (owner_id).
-- Table « utilisateur » (owner_id) : select / insert / update — pas de delete (soft delete).

alter table public.planned_sessions enable row level security;

create policy planned_sessions_select on public.planned_sessions
  for select using (owner_id = auth.uid());
create policy planned_sessions_insert on public.planned_sessions
  for insert with check (owner_id = auth.uid());
create policy planned_sessions_update on public.planned_sessions
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
