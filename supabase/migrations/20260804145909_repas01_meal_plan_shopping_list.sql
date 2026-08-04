-- US REPAS-01 (roadmap 4.27 / 4.28 / 4.29) — planning repas à la semaine, liste de courses, partage.
-- Réf. : docs/specs/functional/us/repas01-planning-repas-liste-courses.md
--
-- Trois tables utilisateur (user_id), toutes en soft delete :
--   meal_plan_entries   : une case remplie du planning (recette ou repas type).
--   shopping_lists      : une liste générée pour une semaine ISO.
--   shopping_list_items : les lignes agrégées de cette liste, cochables.
--
-- ⚠️ Le planning n'écrit JAMAIS dans food_entries (règle R1 de la spec) : c'est un modèle
-- d'intention, strictement séparé du consommé. Le portage au journal est un geste explicite
-- de l'utilisateur, qui crée des food_entries normales.

-- ── Planning repas ──────────────────────────────────────────────────────────
-- meal_key est une clé LIBRE (aucun CHECK), comme food_entries.meal_type depuis l'US 4.15 :
-- les repas sont personnalisables (nutrition_profiles.meals). Une clé qui ne correspond plus à
-- aucun repas configuré est traitée comme orpheline côté app (bucket « Autre », règle R10).
--
-- label / kcal / protein_g / carbs_g / fat_g sont un SNAPSHOT pris à la planification : modifier
-- une recette ensuite ne fait pas bouger le planning déjà posé (même principe que food_entries).
-- Les INGRÉDIENTS, eux, sont relus vivants à la génération de la liste de courses (règle R6).
create table public.meal_plan_entries (
  id            uuid primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  plan_date     date not null,
  meal_key      text not null,
  order_index   integer not null default 0,
  source_type   text not null check (source_type in ('recipe', 'template')),
  recipe_id     uuid references public.recipes (id),
  template_id   uuid references public.meal_templates (id),
  servings      numeric not null default 1 check (servings > 0),
  label         text not null,
  kcal          integer not null default 0,
  protein_g     numeric not null default 0,
  carbs_g       numeric not null default 0,
  fat_g         numeric not null default 0,
  consumed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- ── Liste de courses ────────────────────────────────────────────────────────
-- Liste MATÉRIALISÉE (décision D5) : figée à la génération, régénérée sur geste explicite.
-- Une liste dérivée à la volée bougerait pendant qu'on est au rayon et perdrait les cases cochées.
--
-- ⚠️ PAS de contrainte unique (user_id, week_start_date) — délibérément (décision D6).
-- En offline-first, deux appareils peuvent générer la liste de la même semaine hors réseau ; à la
-- synchro, une violation d'unicité ferait ÉCHOUER l'upload PowerSync et bloquerait la file
-- d'écriture. La liste active d'une semaine est simplement la plus récente par generated_at ;
-- régénérer soft-delete les précédentes.
create table public.shopping_lists (
  id               uuid primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  week_start_date  date not null,
  generated_at     timestamptz not null default now(),
  -- Entrées de planning dont aucun ingrédient n'a pu être résolu (recette archivée, repas type
  -- vide) : la liste ANNONCE ce qu'elle ne sait pas (règle R12) au lieu de sous-estimer en silence.
  unresolved_count integer not null default 0,
  planned_count    integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- quantity_g est nullable et ce n'est PAS un détail : les ingrédients sources (recipe_ingredients,
-- meal_template_items) l'ont nullable. Une quantité absente n'est jamais 0 (règle R7) — elle est
-- comptée à part dans unquantified_count et restituée en clair (« + 2 sans quantité »).
create table public.shopping_list_items (
  id                 uuid primary key,
  list_id            uuid not null references public.shopping_lists (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  food_id            uuid references public.foods (id),
  name               text not null,
  category           text not null default 'other',
  quantity_g         numeric,
  unquantified_count integer not null default 0,
  checked            boolean not null default false,
  order_index        integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

-- ── Index partiels (mêmes conventions que le reste du schéma) ───────────────
create index on public.meal_plan_entries (user_id, plan_date) where deleted_at is null;
create index on public.shopping_lists (user_id, week_start_date) where deleted_at is null;
create index on public.shopping_list_items (list_id) where deleted_at is null;

-- ── Triggers updated_at (fonction définie dans 20260705150000_init_conventions.sql) ─────
create trigger set_updated_at before update on public.meal_plan_entries
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.shopping_lists
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

-- ── Publication logique PowerSync ───────────────────────────────────────────
-- ⚠️ Ne suffit PAS : les sync rules de l'instance PowerSync doivent être redéployées à la main
-- (docs/specs/technical/powersync-sync-rules.yaml → dashboard). Étape manuelle déjà oubliée
-- deux fois sur ce projet (BIEN-01, RUN-F2c).
alter publication powersync add table
  public.meal_plan_entries, public.shopping_lists, public.shopping_list_items;

-- ── RLS — tables utilisateur, patron de personal_goals ──────────────────────
-- Pas de politique `delete` : le projet fait du soft delete (`deleted_at`).
alter table public.meal_plan_entries   enable row level security;
alter table public.shopping_lists      enable row level security;
alter table public.shopping_list_items enable row level security;

create policy meal_plan_entries_select on public.meal_plan_entries
  for select using (user_id = auth.uid());
create policy meal_plan_entries_insert on public.meal_plan_entries
  for insert with check (user_id = auth.uid());
create policy meal_plan_entries_update on public.meal_plan_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy shopping_lists_select on public.shopping_lists
  for select using (user_id = auth.uid());
create policy shopping_lists_insert on public.shopping_lists
  for insert with check (user_id = auth.uid());
create policy shopping_lists_update on public.shopping_lists
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy shopping_list_items_select on public.shopping_list_items
  for select using (user_id = auth.uid());
create policy shopping_list_items_insert on public.shopping_list_items
  for insert with check (user_id = auth.uid());
create policy shopping_list_items_update on public.shopping_list_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
