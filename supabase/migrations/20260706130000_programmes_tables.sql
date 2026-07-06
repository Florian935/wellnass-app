-- US2 : tables programmes muscu (programs, program_translations, sessions, exercise_plans)
-- + FK différées sur workouts (session_id, program_id) laissées colonne-seule en US1.
-- Appliqué manuellement par un humain sur le cloud Supabase ou en local (Docker).
-- La publication `powersync` est supposée existante (créée en US1).
-- Réf. : docs/specs/technical/schema-donnees-muscu.md §4.3.

create table public.programs (
  id         uuid primary key,
  owner_id   uuid references auth.users (id) on delete cascade,
  pillar     text not null check (pillar in ('strength','running')),
  status     text not null default 'draft' check (status in ('draft','published')),
  is_active  boolean not null default false,
  level      text check (level in ('beginner','intermediate','advanced')),
  goal       text,
  duration_weeks integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.program_translations (
  id         uuid primary key,
  program_id uuid not null references public.programs (id) on delete cascade,
  owner_id   uuid references auth.users (id) on delete cascade,
  lang       text not null check (lang in ('fr','en')),
  name       text not null,
  summary    text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (program_id, lang)
);

create table public.sessions (
  id          uuid primary key,
  program_id  uuid not null references public.programs (id) on delete cascade,
  owner_id    uuid references auth.users (id) on delete cascade,
  order_index integer not null default 0,
  name        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.exercise_plans (
  id               uuid primary key,
  session_id       uuid not null references public.sessions (id) on delete cascade,
  owner_id         uuid references auth.users (id) on delete cascade,
  exercise_id      uuid not null references public.exercises (id),
  order_index      integer not null default 0,
  set_type         text not null default 'normal' check (set_type in ('normal','warmup','superset','duration','bodyweight')),
  target_sets      integer,
  target_reps      text,
  target_weight_kg numeric,
  rest_seconds     integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.programs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.program_translations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.exercise_plans
  for each row execute function public.set_updated_at();

-- Index partiels (lignes non supprimées uniquement)
create index on public.programs           (owner_id) where deleted_at is null;
create index on public.program_translations (program_id);
create index on public.sessions           (program_id);
create index on public.exercise_plans     (session_id);

-- FK différées : workouts.session_id et workouts.program_id étaient colonne-seule en US1
alter table public.workouts
  add constraint workouts_session_id_fkey
  foreign key (session_id) references public.sessions (id);

alter table public.workouts
  add constraint workouts_program_id_fkey
  foreign key (program_id) references public.programs (id);

-- Publication logique PowerSync (extension de US1)
alter publication powersync add table
  public.programs, public.program_translations,
  public.sessions, public.exercise_plans;
