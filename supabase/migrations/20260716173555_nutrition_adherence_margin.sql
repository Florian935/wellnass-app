-- US NUTR-10 — marge d'adhérence configurable (% de l'objectif) sur le profil nutritionnel.
-- Sync rule PowerSync = "select * from nutrition_profiles" => la colonne descend au client sans modif.
alter table public.nutrition_profiles
  add column if not exists adherence_margin_pct integer not null default 10
    check (adherence_margin_pct between 1 and 50);
