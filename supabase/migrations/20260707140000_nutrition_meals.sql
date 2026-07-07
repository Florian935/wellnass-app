-- V0.4 (4.15) : repas personnalisables (renommer / ajouter / supprimer).
-- - Config des repas stockée par utilisateur dans nutrition_profiles.meals (JSON).
-- - food_entries.meal_type devient une clé libre (plus de CHECK sur l'enum fixe) pour
--   autoriser des repas custom (« Pré-workout »…). Les clés par défaut restent
--   breakfast/lunch/dinner/snack.

alter table public.nutrition_profiles add column if not exists meals jsonb;

alter table public.food_entries drop constraint if exists food_entries_meal_type_check;
