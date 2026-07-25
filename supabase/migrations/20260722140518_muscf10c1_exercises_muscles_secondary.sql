-- MUSC-F10c-1 : muscles secondaires sur les exercices (0..N groupes musculaires).
-- Additif, rétrocompatible : les lignes existantes prennent '[]'. La table exercises
-- est déjà dans la publication PowerSync → aucun changement de sync rule.
alter table public.exercises
  add column muscles_secondary jsonb not null default '[]'::jsonb;
