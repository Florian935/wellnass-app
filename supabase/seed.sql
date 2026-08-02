-- Seed de développement (données de test bilingues FR+EN : exercices, programmes, aliments).
-- Exécuté par `supabase db reset`. Vide tant qu'aucune table de contenu n'existe.
-- À enrichir avec les US de contenu (voir /seed dans bonnes-pratiques §13).

-- ============================================================
-- US1 — 16 exercices de bibliothèque + US2 — programme placeholder « Full Body Débutant »
-- Déplacés dans une MIGRATION versionnée le 02/08/2026 (dette technique — ces deux blocs étaient
-- déjà sur le cloud, arrivés par un chemin non tracé) :
--   supabase/migrations/20260802055147_debt_seed_exercices_programme_placeholder.sql
-- Même patron que le seed CIQUAL ci-dessous : contenu identique, `on conflict do nothing`.
-- ============================================================

-- ============================================================
-- Bibliothèque d'aliments (bilingue FR/EN) — données CIQUAL 2025 (ANSES / Licence Etalab)
-- Déplacée dans une MIGRATION versionnée (donnée de référence poussée au cloud via db:push) :
--   supabase/migrations/20260714120000_seed_library_foods_ciqual.sql
-- Générée par supabase/scripts/enrich-ciqual/ — ne pas éditer à la main (régénérer).
-- ============================================================
