-- US 8.6 — Import d'aliments par CSV : clé d'import stable pour l'upsert idempotent.
-- 🔴 checkpoint cloud : appliqué manuellement par un humain (dashboard SQL Editor), puis `db:types`.
--    Aucune sync rule à redéployer (colonne éditoriale, pas de nouveau bucket).
-- Réf. : docs/specs/functional/us/8.6-import-csv-ciqual.md §4,
--        docs/plans/8.6-import-csv-ciqual.md (Task 2).
--
-- `import_key` : identifiant stable fourni par le CSV (ex. code CIQUAL). Sert d'arbitre à
-- `on conflict (import_key)` lors de l'import éditorial → ré-import idempotent, jamais de doublon.
-- Nullable : le contenu OpenFoodFacts / custom n'en a pas.

alter table public.foods add column if not exists import_key text;

-- Index unique SIMPLE (non partiel) : les NULL (OFF/custom) restent illimités ; seules les clés
-- non nulles (éditorial importé) sont uniques. Volontairement non partiel : supabase-js ne peut
-- pas cibler un index partiel comme arbitre `on conflict`. Sûr car seul l'import écrit `import_key`.
create unique index if not exists foods_import_key_key on public.foods (import_key);
