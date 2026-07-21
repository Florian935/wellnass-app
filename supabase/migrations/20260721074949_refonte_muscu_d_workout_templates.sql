-- US Refonte-D : templates de séance libre (routines réutilisables). Patron identique
-- à meal_templates/meal_template_items (repas types nutrition).
-- Réf. : docs/specs/functional/us/refonte-muscu-d-templates-seance-libre.md.

create table public.workout_templates (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workout_template_exercises (
  id uuid primary key,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  order_index integer not null default 0,
  set_type text not null default 'normal'
    check (set_type in ('normal','warmup','superset','duration','bodyweight','dropset','failure')),
  target_sets integer check (target_sets > 0),
  target_reps text,
  target_weight_kg numeric check (target_weight_kg >= 0),
  rest_seconds integer check (rest_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Triggers updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.workout_templates
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workout_template_exercises
  for each row execute function public.set_updated_at();

-- Index partiel (lecture ordonnée des exercices d'un template)
create index on public.workout_template_exercises (template_id) where deleted_at is null;

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table
  public.workout_templates, public.workout_template_exercises;

-- RLS (Row Level Security) — tables « utilisateur », pas de delete (soft delete).
alter table public.workout_templates           enable row level security;
alter table public.workout_template_exercises   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['workout_templates','workout_template_exercises']
  loop
    execute format('create policy %I_select on public.%I for select using (user_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (user_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t, t);
  end loop;
end $$;
