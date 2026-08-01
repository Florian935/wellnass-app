-- US RUN-F3 (roadmap 5.25) : lien entre une course et la séance planifiée qu'elle réalise.
-- Additif, nullable : une course libre n'en a pas. Posé une seule fois, à la création
-- (startRun), jamais modifié ensuite. Pas de contrainte FK formelle (cohérent avec le reste
-- du schéma applicatif) : la validité de la référence est garantie côté application
-- (planned_session_id vient toujours d'un planned_sessions.id lu juste avant).
--
-- `runs` est déjà en "select *" dans la sync rule PowerSync (powersync-sync-rules.yaml) :
-- aucun redéploiement nécessaire pour cette colonne additive.
alter table public.runs
  add column planned_session_id uuid null;
