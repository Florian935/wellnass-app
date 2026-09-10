-- US NUTRI-UX01 — refonte UX du pilier Nutrition.
--
-- Deux blocs, une seule migration : scinder imposerait deux `db:push` pour une même US, alors que
-- le CLI ne joue de toute façon que les migrations manquantes, chacune en transaction.
--
--   ① `water_entries`      — suivi de l'hydratation (R5, catalogue NUTR-12).
--   ② `meal_plan_entries`  — le planning accepte enfin un aliment simple et un ajout rapide (R7.1).
--
-- ⚠️ APRÈS `npm run db:push` : coller `docs/specs/technical/powersync-sync-rules.yaml` dans le
-- dashboard PowerSync et déployer. `water_entries` est une nouvelle table synchronisée : sans ce
-- geste, les verres bus n'arrivent jamais sur le cloud. Étape déjà oubliée une fois dans ce
-- projet (une note d'exercice n'avait pas survécu à une resynchro).

-- ══════════════════════════════════════════════════════════════════════════════
-- ① Hydratation
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Une ligne PAR AJOUT, jamais un total mis à jour. Deux raisons, toutes deux offline-first :
--   • annuler doit défaire *le dernier geste* (le volume exact ajouté), pas décrémenter un cumul ;
--   • deux appareils qui boivent hors réseau produisent deux lignes qui s'additionnent — un
--     compteur unique produirait un écrasement au dernier écrivain, donc des verres perdus.
create table public.water_entries (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,
  volume_ml  integer not null check (volume_ml > 0 and volume_ml <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_updated_at before update on public.water_entries
  for each row execute function public.set_updated_at();

create index on public.water_entries (user_id, log_date) where deleted_at is null;

alter table public.water_entries enable row level security;

create policy water_entries_select on public.water_entries
  for select using (user_id = auth.uid());
create policy water_entries_insert on public.water_entries
  for insert with check (user_id = auth.uid());
create policy water_entries_update on public.water_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Réglages d'hydratation sur le profil nutritionnel : objectif du jour et volume d'un verre.
-- `null` = jamais réglé → l'app applique ses défauts (2 000 ml / 250 ml) sans les figer en base,
-- pour qu'un changement de défaut applicatif profite à ceux qui n'ont rien choisi.
alter table public.nutrition_profiles
  add column water_target_ml integer check (water_target_ml > 0 and water_target_ml <= 10000),
  add column glass_size_ml   integer check (glass_size_ml   > 0 and glass_size_ml   <= 2000);

-- ══════════════════════════════════════════════════════════════════════════════
-- ② Le planning accepte un aliment simple et un ajout rapide (R7.1)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Le planning n'acceptait que `recipe` et `template` : planifier un premier repas imposait donc de
-- créer d'abord une recette (~20 taps). C'est ce qui condamnait le module, pas son ergonomie.
--
-- `food_id` est nullable et sans contrainte d'existence forte au-delà de la FK : un ajout rapide
-- (« 300 kcal au restaurant ») n'a pas d'aliment, et c'est un cas normal, pas une anomalie.
alter table public.meal_plan_entries
  drop constraint meal_plan_entries_source_type_check;

alter table public.meal_plan_entries
  add constraint meal_plan_entries_source_type_check
  check (source_type in ('recipe', 'template', 'food', 'quick'));

alter table public.meal_plan_entries
  add column food_id    uuid references public.foods (id),
  -- Quantité en grammes pour une entrée `food`. `null` pour les autres types, qui portent déjà
  -- leur échelle dans `servings`.
  add column quantity_g integer check (quantity_g > 0);

-- Cohérence de la source : chaque type porte exactement la référence qui le concerne. Sans cette
-- contrainte, une entrée `food` sans `food_id` passerait, et la liste de courses la compterait
-- comme non résolue en silence (règle R12 de REPAS-01).
alter table public.meal_plan_entries
  add constraint meal_plan_entries_source_reference_check
  check (
    (source_type = 'recipe'   and recipe_id   is not null) or
    (source_type = 'template' and template_id is not null) or
    (source_type = 'food'     and food_id     is not null) or
    (source_type = 'quick')
  );
