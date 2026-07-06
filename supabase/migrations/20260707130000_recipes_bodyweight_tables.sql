-- V0.4 : recettes & repas types (spec §5) + poids corporel (spec §7.1).
-- Toutes des tables « utilisateur » (user_id). Publication `powersync` requise.
-- Réf. : docs/specs/functional/alimentation.md §5, §7.

create table public.recipes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  servings integer not null default 1 check (servings >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.recipe_ingredients (
  id uuid primary key,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
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

create table public.meal_templates (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.meal_template_items (
  id uuid primary key,
  template_id uuid not null references public.meal_templates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
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

create table public.body_weight_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric not null check (weight_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Triggers updated_at
create trigger set_updated_at before update on public.recipes             for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.recipe_ingredients  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.meal_templates      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.meal_template_items for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.body_weight_entries for each row execute function public.set_updated_at();

-- Index partiels
create index on public.recipe_ingredients (recipe_id) where deleted_at is null;
create index on public.meal_template_items (template_id) where deleted_at is null;
create index on public.body_weight_entries (user_id, log_date) where deleted_at is null;

-- Publication PowerSync
alter publication powersync add table
  public.recipes, public.recipe_ingredients, public.meal_templates,
  public.meal_template_items, public.body_weight_entries;
