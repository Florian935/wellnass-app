-- US RUN-F4 (mur M8) — la séance à allure PROGRESSIVE.
-- Réf. : docs/product/analyse-seances-structurees-running.md (mur M8)
--
-- Le seul mur de l'analyse du 04/09/2026 qui n'avait été affecté à AUCUN des 10 lots. Signalé
-- comme tel à Florian le 09/09 ; il a demandé de finir la vague, d'où cette migration tardive.
--
-- Le besoin : « les 10 dernières minutes de 4:35 VERS 4:25 » (S16 du plan analysé). Aujourd'hui
-- ce segment se saisit avec la plage 4:25–4:35 — ce qui décrit une TOLÉRANCE (« tiens-toi entre
-- ces deux allures »), alors que le plan décrit une RAMPE (« pars à 4:35, finis à 4:25 »). Deux
-- consignes différentes, et la seconde était inexprimable.
--
-- ⚠️ **Un booléen, et surtout PAS deux colonnes d'allure de plus.** Les bornes existent déjà :
-- `fast_pace_max_s_per_km` est la plus lente (le départ), `fast_pace_min_s_per_km` la plus
-- rapide (l'arrivée). Ajouter `pace_start`/`pace_end` dupliquerait la même information et
-- ouvrirait la porte à des états contradictoires (une plage qui dit une chose, une rampe qui en
-- dit une autre). Le booléen ne fait que changer la LECTURE des deux bornes déjà là :
--   false (défaut) -> plage de tolérance, comportement actuel, inchangé pour toutes les lignes ;
--   true           -> rampe de `max` vers `min` sur la durée du segment.
--
-- Additif, avec défaut : aucune ligne existante ne change de sens.

alter table public.session_intervals
  add column if not exists fast_pace_progressive boolean not null default false;

comment on column public.session_intervals.fast_pace_progressive is
  'true = les deux bornes d''allure décrivent une RAMPE (max -> min) et non une tolérance. Mur M8.';
