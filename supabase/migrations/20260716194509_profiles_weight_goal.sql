-- NUTR-11 : progression vers l'objectif de poids.
-- Ajoute deux colonnes nullable à public.profiles : poids cible et poids de départ.
-- Migration additive et sûre (colonnes nullable, `if not exists`, aucune donnée touchée).
-- Réf. : docs/specs/functional/alimentation.md · US NUTR-11 (progression poids).

alter table public.profiles
  add column if not exists target_weight_kg numeric check (target_weight_kg > 0),
  add column if not exists start_weight_kg  numeric check (start_weight_kg  > 0);
