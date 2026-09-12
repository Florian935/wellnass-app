-- US MUSCU-UX02 — niveau de lecture du bilan de séance.
--
-- Colonne DISTINCTE de `workout_display_level` (décision D1) : ce dernier règle la densité de
-- SAISIE pendant la séance, sous la barre, où l'on veut le minimum de champs ; celle-ci règle la
-- profondeur de LECTURE du bilan, consulté assis au calme. Rien n'impose que ce soit le même choix,
-- et les confondre forcerait l'un des deux réglages à être mauvais.
--
-- Mêmes valeurs et même défaut applicatif que `workout_display_level` : le vocabulaire technique est
-- partagé (`coerceWorkoutDisplayLevel` relit les deux), seuls les libellés i18n diffèrent.
--
-- NULL est traité comme 'normal' côté application, comme pour `workout_display_level` et
-- `daily_steps` — la valeur par défaut ne couvre que les lignes créées après cette migration.

alter table profiles
  add column summary_display_level text default 'normal'
  check (summary_display_level in ('simplified', 'normal', 'detailed'));
