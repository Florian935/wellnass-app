-- RLS (Row Level Security) — tables programmes muscu (US2).
-- Appliqué manuellement après 20260706130000_programmes_tables.sql.
-- Réf. : docs/specs/technical/schema-donnees-muscu.md §3.3.
--
-- Règles (tables contenu partageable avec owner_id) :
--   select : owner_id is null (éditorial/bibliothèque) ou owner_id = auth.uid() (custom utilisateur).
--   insert/update : uniquement si owner_id = auth.uid() (le contenu éditorial n'est jamais écrit depuis l'app).
--   Pas de delete (soft delete via deleted_at).

alter table public.programs              enable row level security;
alter table public.program_translations  enable row level security;
alter table public.sessions              enable row level security;
alter table public.exercise_plans        enable row level security;

-- Tables « contenu partageable » (owner_id) : même logique que exercises/exercise_translations en US1
do $$
declare t text;
begin
  foreach t in array array['programs','program_translations','sessions','exercise_plans']
  loop
    execute format('create policy %I_select on public.%I for select using (owner_id is null or owner_id = auth.uid());', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (owner_id = auth.uid());', t, t);
    execute format('create policy %I_update on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());', t, t);
  end loop;
end $$;
