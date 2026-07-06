-- RLS (Row Level Security) — pilier Alimentation, profil nutritionnel (item 9.6, V0.4).
-- Appliqué manuellement après 20260706140000_nutrition_tables.sql.
-- Table « utilisateur » (user_id) : select / insert / update — pas de delete (soft delete).

alter table public.nutrition_profiles enable row level security;

create policy nutrition_profiles_select on public.nutrition_profiles
  for select using (user_id = auth.uid());
create policy nutrition_profiles_insert on public.nutrition_profiles
  for insert with check (user_id = auth.uid());
create policy nutrition_profiles_update on public.nutrition_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
