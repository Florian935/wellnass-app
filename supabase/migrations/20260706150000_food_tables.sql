-- V0.4 : pilier Alimentation — base d'aliments + journal.
--   foods              : aliments (owner_id null = bibliothèque app/CIQUAL, non-null = perso/OFF)
--   food_translations  : nom par langue
--   food_favorites     : favoris utilisateur
--   food_entries       : lignes du journal (snapshot des valeurs)
-- Appliqué manuellement après le socle muscu. Publication `powersync` requise.
-- Réf. : docs/specs/functional/alimentation.md §3-§4.

create table public.foods (
  id uuid primary key,
  owner_id uuid references auth.users (id) on delete cascade,
  source text not null default 'library' check (source in ('library','openfoodfacts','custom')),
  category text not null check (category in
    ('meat','fish','starchy','vegetables','fruits','dairy','nuts','drinks','other')),
  barcode text,
  kcal_per_100g numeric not null check (kcal_per_100g >= 0),
  protein_per_100g numeric, carbs_per_100g numeric, sugars_per_100g numeric,
  fat_per_100g numeric, saturated_fat_per_100g numeric, fiber_per_100g numeric,
  portions jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.food_translations (
  id uuid primary key,
  food_id uuid not null references public.foods (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  lang text not null check (lang in ('fr','en')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (food_id, lang)
);

create table public.food_favorites (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, food_id)
);

create table public.food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  order_index integer not null default 0,
  food_id uuid references public.foods (id),
  name text not null,
  quantity_g numeric,
  kcal integer not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Triggers updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.foods             for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.food_translations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.food_favorites    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.food_entries      for each row execute function public.set_updated_at();

-- Index partiels (lignes non supprimées)
create index on public.foods (owner_id) where deleted_at is null;
create index on public.food_translations (food_id, lang) where deleted_at is null;
create index on public.food_entries (user_id, log_date) where deleted_at is null;

-- Publication logique PowerSync
alter publication powersync add table
  public.foods, public.food_translations, public.food_favorites, public.food_entries;
