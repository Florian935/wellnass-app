-- US COLLIS-01 (roadmap 3.57) — détecteur de collisions entre séances planifiées.
--
-- Réglage **opt-in strict** du détecteur : il repère les enchaînements qui s'auto-sabotent (une
-- grosse séance de jambes la veille d'une sortie longue ou d'un fractionné) et propose un jour de
-- repli. Comme toute couche d'intégration inter-piliers, il est **désactivé par défaut**
-- (décision H — intégration sans imposition).
--
-- `not null default false` : un `default true` ouvrirait la fonctionnalité à tout le monde dès la
-- première synchro, ce qui est exactement le contraire d'un opt-in.
--
-- ✅ **Aucune sync rule à redéployer** : `user_settings` est déjà publiée et lue en `select *` —
-- même situation que `sbd_lifts` (MUSCPWR-01, la veille), `intensity_scale` (UX-05) et
-- `cycle_tracking_enabled` (CYCLE-01).
--
-- 🔴 **En revanche, la colonne DOIT être ajoutée à `apps/mobile/src/powersync/schema.ts`.** Toute
-- colonne absente du schéma **local** n'existe pas dans la base SQLite embarquée : l'écriture
-- échoue et `void updateSettings()` avale l'erreur — l'interrupteur reste éteint sans le moindre
-- message. C'est la panne exacte de CYCLE-01, constatée en recette device le 31/07/2026.
alter table public.user_settings
  add column if not exists session_conflicts_enabled boolean not null default false;

comment on column public.user_settings.session_conflicts_enabled is
  'US COLLIS-01 — opt-in du détecteur de collisions entre séances. Désactivé par défaut.';
