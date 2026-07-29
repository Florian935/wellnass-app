-- US UX-05 — échelle d'intensité affichée : RPE ou RIR (roadmap 3.55).
--
-- ── Ce qui n'est PAS stocké, et c'est tout le principe ────────────────────────────────────────
-- Le RIR **n'est jamais stocké**. `workout_sets.rpe` reste la seule vérité ; cette colonne ne dit
-- que dans quelle langue l'afficher. C'est exactement le patron de `user_settings.units` :
-- « stockage toujours en métrique (SI), conversion à l'affichage ».
--
-- Conséquence voulue : basculer d'une échelle à l'autre **ne perd aucune donnée** et ne demande
-- aucune conversion en base. Un RPE saisi hier se lit en RIR aujourd'hui, et inversement.
--
-- ── Aucune sync rule à redéployer ────────────────────────────────────────────────────────────
-- `user_settings` est déjà dans la publication `powersync` et lue en `select *` par les sync rules :
-- une colonne de plus est transportée sans changement côté dashboard. Même situation que
-- `health_connect_enabled` (20260726202133), vérifiée à l'époque.

alter table public.user_settings
  add column intensity_scale text not null default 'rpe';

-- `check` plutôt qu'un type enum, comme `personal_goals.kind` : si une troisième échelle apparaît
-- un jour (%1RM par exemple), il suffira de remplacer le check — pas de migration de données.
alter table public.user_settings
  add constraint user_settings_intensity_scale_check
  check (intensity_scale in ('rpe', 'rir'));

comment on column public.user_settings.intensity_scale is
  'Échelle d''intensité AFFICHÉE pour les séries de musculation (US UX-05). '
  'La donnée stockée reste `workout_sets.rpe` : RIR = 10 - RPE, converti à l''affichage seulement.';
