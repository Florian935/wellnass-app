-- US RUN-F4 (lot H) — un programme ancré sur une date de course et un objectif chrono.
-- Réf. : docs/product/analyse-seances-structurees-running.md (mur M12)
--
-- `programs` portait `duration_weeks` et un `goal` en TEXTE LIBRE : ni date cible, ni chrono
-- visé, ni événement. Le calendrier existait pourtant déjà (`planned_sessions.scheduled_date`
-- + `week_index`, et l'heure depuis HORAIRE-01) : **il manquait l'ancre, pas le calendrier**.
--
-- Paradoxe que ces 3 colonnes referment : RUN-14 sait PRÉDIRE un temps de course (Riegel) et
-- la 5.31 sait RECALER l'allure de référence sur un record 5 km, mais on ne pouvait nulle part
-- écrire « ma course est le 25/10/2026 et je vise 20:00 ».
--
-- Additive, nullable, sans défaut : un programme sans échéance (la majorité — « Reprise en
-- douceur ») reste un programme sans échéance, et rien ne s'affiche.

alter table public.programs
  -- `date` nu et non `timestamptz` : même raisonnement que `planned_sessions.scheduled_date`
  -- (HORAIRE-01, D8) — une course le 25/10 doit rester le 25/10 quel que soit le fuseau.
  add column if not exists target_date date,

  -- Objectif chrono en secondes (20:00 -> 1200). Sur la distance de `target_distance_m` de la
  -- séance de course du programme, pas sur le programme lui-même.
  add column if not exists target_time_seconds integer,

  -- Nom de l'événement (« Course caritative »). Non traduit : c'est un nom propre saisi par
  -- l'utilisateur, pas du contenu éditorial.
  add column if not exists event_name text;

comment on column public.programs.target_date is
  'Date de l''échéance (course). NULL = programme sans échéance. `date` nu : insensible au fuseau.';
