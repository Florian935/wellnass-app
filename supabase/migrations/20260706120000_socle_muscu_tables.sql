-- US1 : tables socle transverse (profiles, user_settings) + pilier musculation
-- (exercises, exercise_translations, exercise_favorites, workouts, workout_sets).
-- Appliqué manuellement par un humain sur le cloud Supabase ou en local (Docker).
-- Vérifier le nom de la publication PowerSync avant d'appliquer :
--   - si la publication `powersync` n'existe pas encore : `create publication powersync;`
--   - si elle a un autre nom, adapter le dernier `alter publication … add table` ci-dessous.
-- Réf. : docs/specs/technical/schema-donnees-muscu.md §3, §4.1, §4.2, §4.4.

create table public.profiles (
  id uuid primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  first_name text, birth_date date,
  sex text check (sex in ('female','male','unspecified')),
  height_cm numeric, weight_kg numeric,
  main_goal text check (main_goal in ('muscle','weightloss','performance','health')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.user_settings (
  id uuid primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  units text not null default 'metric' check (units in ('metric','imperial')),
  language text not null default 'fr' check (language in ('fr','en')),
  active_pillars jsonb not null default '["strength","running","nutrition"]',
  notifications jsonb not null default '{}',
  dashboard_layout jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.exercises (
  id uuid primary key,
  owner_id uuid references auth.users (id) on delete cascade,
  source text not null default 'library' check (source in ('library','custom')),
  muscle_primary text not null check (muscle_primary in ('chest','back','legs','shoulders','arms','core')),
  equipment text, media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.exercise_translations (
  id uuid primary key,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  lang text not null check (lang in ('fr','en')),
  name text not null, instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (exercise_id, lang)
);
create table public.exercise_favorites (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, exercise_id)
);
create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid, program_id uuid,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  started_at timestamptz not null, finished_at timestamptz,
  duration_seconds integer, rpe integer check (rpe between 1 and 10), notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.workout_sets (
  id uuid primary key,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  order_index integer not null default 0,
  set_type text not null default 'normal' check (set_type in ('normal','warmup','superset','duration','bodyweight')),
  reps integer, weight_kg numeric, duration_seconds integer,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.profiles              for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_settings         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.exercises             for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.exercise_translations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.exercise_favorites    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workouts              for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workout_sets          for each row execute function public.set_updated_at();

-- Index partiels (lignes non supprimées uniquement)
create index on public.exercises (owner_id) where deleted_at is null;
create index on public.workouts (user_id, status) where deleted_at is null;
create index on public.workout_sets (workout_id) where deleted_at is null;

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table
  public.profiles, public.user_settings, public.exercises,
  public.exercise_translations, public.exercise_favorites,
  public.workouts, public.workout_sets;
