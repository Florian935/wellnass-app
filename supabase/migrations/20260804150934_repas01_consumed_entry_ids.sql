-- US REPAS-01 — complément : traçabilité du portage au journal (règle R3).
-- Réf. : docs/specs/functional/us/repas01-planning-repas-liste-courses.md §3 R3
--
-- « J'ai mangé ça » crée des food_entries normales. Pour qu'« Annuler » puisse retirer
-- EXACTEMENT ces lignes — et rien d'autre du journal du jour — il faut retenir lesquelles.
-- Les retrouver par (log_date, meal_type, name) serait faux dès que l'utilisateur a mangé
-- deux fois la même chose, ou renommé un aliment : on supprimerait la mauvaise ligne.
--
-- Additive, nullable : les entrées de planning déjà posées restent valides.
alter table public.meal_plan_entries
  add column if not exists consumed_entry_ids jsonb;
