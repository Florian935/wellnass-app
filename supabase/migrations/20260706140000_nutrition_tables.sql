-- V0.4 : table socle du pilier Alimentation — profil nutritionnel (une ligne par compte).
-- Appliqué manuellement par un humain sur le cloud Supabase ou en local (Docker), après
-- les migrations du socle muscu (20260706120000+).
-- Réf. : docs/specs/functional/alimentation.md §2 · docs/specs/functional/us/4.1-profil-nutritionnel.md.

create table public.nutrition_profiles (
  id uuid primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  objective text check (objective in ('bulk','cut','maintain','weightloss')),
  activity_level text not null default 'moderate'
    check (activity_level in ('sedentary','light','moderate','active','very_active')),
  manual_calories integer check (manual_calories is null or manual_calories > 0),
  manual_protein_g integer check (manual_protein_g is null or manual_protein_g >= 0),
  manual_carbs_g integer check (manual_carbs_g is null or manual_carbs_g >= 0),
  manual_fat_g integer check (manual_fat_g is null or manual_fat_g >= 0),
  restrictions jsonb not null default '[]',
  allergens jsonb not null default '[]',
  training_day_bonus integer not null default 0 check (training_day_bonus >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Trigger updated_at (fonction définie dans 20260705150000_init_conventions.sql)
create trigger set_updated_at before update on public.nutrition_profiles
  for each row execute function public.set_updated_at();

-- Publication logique PowerSync (réplication vers l'instance PowerSync provisionnée)
alter publication powersync add table public.nutrition_profiles;
