-- RLS (Row Level Security) — socle transverse + pilier musculation (item 9.6, US1).
-- Appliqué manuellement après 20260706120000_socle_muscu_tables.sql.
-- Réf. : docs/specs/technical/schema-donnees-muscu.md §3.3.
--
-- Règles :
--   Tables utilisateur (user_id) : select / insert / update — pas de delete (soft delete via updated_at/deleted_at).
--   Tables contenu (owner_id)    : select si owner_id is null (bibliothèque) ou owner_id = auth.uid() ;
--                                  insert/update uniquement si owner_id = auth.uid().

alter table public.profiles              enable row level security;
alter table public.user_settings         enable row level security;
alter table public.exercises             enable row level security;
alter table public.exercise_translations enable row level security;
alter table public.exercise_favorites    enable row level security;
alter table public.workouts              enable row level security;
alter table public.workout_sets          enable row level security;

-- Tables « utilisateur » : accès restreint à la propre ligne de l'utilisateur (user_id = auth.uid())
do $$
declare t text;
begin
  foreach t in array array['profiles','user_settings','exercise_favorites','workouts','workout_sets']
  loop
    execute format('create policy %I_select on public.%I for select using (user_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (user_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t, t);
  end loop;
end $$;

-- Tables « contenu partageable » : lecture bibliothèque (owner_id is null) + contenu custom de l'utilisateur
do $$
declare t text;
begin
  foreach t in array array['exercises','exercise_translations']
  loop
    execute format('create policy %I_select on public.%I for select using (owner_id is null or owner_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t, t);
  end loop;
end $$;
