-- MUSC-F1b : anatomie fine sur les exercices (0..N muscles, référentiel à 10 clés, spec §1).
-- Additive, indépendante de muscles_secondary (spec §0) : les lignes existantes prennent '[]'.
-- La table exercises est déjà dans la publication PowerSync (select *) → aucun changement de sync rule.
alter table public.exercises
  add column muscles_fine jsonb not null default '[]'::jsonb;
