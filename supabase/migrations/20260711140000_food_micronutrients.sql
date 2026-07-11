-- V0.4 : US 4.33 — Micronutriments (socle ciblé).
-- Enrichit la base d'aliments et le journal d'un panel de micronutriments stocké en JSON :
--   foods.micronutrients        : valeurs pour 100 g (clé absente = non renseigné, jamais 0)
--   food_entries.micronutrients : snapshot figé pour la quantité (comme les macros)
-- Clés du socle : cholesterol_mg, sodium_mg, magnesium_mg, potassium_mg, calcium_mg, iron_mg,
--   vitamin_c_mg, vitamin_d_ug, vitamin_b9_ug, vitamin_b12_ug.
-- Additif et rétrocompatible : défaut '{}', aucune donnée existante impactée.
-- Sync rules : rien à faire — les streams foods/food_entries sont en `select *`
--   (docs/specs/technical/powersync-sync-rules.yaml). La publication `powersync` inclut
--   déjà toutes les colonnes des tables publiées.
-- Réf. : docs/specs/functional/us/4.33-micronutriments.md.

alter table public.foods
  add column micronutrients jsonb not null default '{}';

alter table public.food_entries
  add column micronutrients jsonb not null default '{}';
