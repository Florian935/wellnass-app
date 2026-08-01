-- US RUN-F3 (D3) : terrain de course, saisie facultative sans rapport avec le GPS.
-- Additif, nullable. 4 valeurs (RUN_TERRAINS, packages/shared/src/running.ts).
-- `runs` est déjà en "select *" dans la sync rule PowerSync : aucun redéploiement nécessaire.
alter table public.runs
  add column terrain text null check (terrain in ('road', 'trail', 'track', 'treadmill'));
