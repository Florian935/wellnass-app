-- US HORAIRE-01 (roadmap 2.4) — heure facultative d'une séance planifiée.
--
-- Réf. : docs/specs/functional/us/horaire01-heure-seance-planifiee.md
--
-- POURQUOI `time` ET NON `timestamptz` (décision D8) :
-- même raisonnement que `scheduled_date`, qui est déjà un `date` nu. Une séance prévue à 18 h doit
-- rester à 18 h — un `timestamptz` la déplacerait au changement de fuseau horaire, ce qui est faux
-- pour un rendez-vous récurrent avec soi-même. L'heure est locale, comme la date qu'elle complète.
--
-- POURQUOI NULLABLE, SANS DÉFAUT (décision D1) :
-- planifier « jeudi » sans savoir quand est un usage NORMAL, pas un oubli à corriger. Toutes les
-- lignes existantes sont sans heure, et le rappel d'échéance apprise (MUSC-F8) reste leur régime.
-- Un défaut inventerait une heure que personne n'a saisie, et déclencherait des convocations pour
-- des séances qui n'en attendaient pas.
--
-- PAS D'INDEX : la colonne ne filtre rien. Elle est lue avec sa ligne, via l'index existant
-- `planned_sessions_owner_date_idx (owner_id, scheduled_date)`.

alter table public.planned_sessions
  add column scheduled_time time;

comment on column public.planned_sessions.scheduled_time is
  'US HORAIRE-01 — heure LOCALE de début, facultative. NULL = pas d''heure définie : le rappel '
  'retombe alors sur l''échéance apprise (MUSC-F8). Jamais de valeur par défaut.';
