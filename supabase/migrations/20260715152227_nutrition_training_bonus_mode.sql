-- RN-02 — Mode de bonus calorique des jours d'entrainement (forfait fixe vs auto/depense course).
-- Colonne additive et retrocompatible : defaut 'fixed' => comportement actuel inchange pour l'existant.
-- Sync rule PowerSync = "select * from nutrition_profiles" => la colonne descend au client sans modif.

alter table public.nutrition_profiles
  add column if not exists training_bonus_mode text not null default 'fixed'
    check (training_bonus_mode in ('fixed', 'auto'));
