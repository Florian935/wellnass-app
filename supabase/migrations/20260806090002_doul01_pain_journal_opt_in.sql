-- US DOUL-01 (roadmap 1.29) — opt-in strict du journal des zones douloureuses.
--
-- `not null default false` : c'est une **donnée de santé**. Un `default true` ouvrirait la collecte à
-- tout le monde dès la première synchro, ce qui est exactement l'inverse d'un opt-in — même règle que
-- `cycle_tracking_enabled` (CYCLE-01).
--
-- ✅ **Aucune sync rule à redéployer pour cette colonne** : `user_settings` est déjà publiée et lue en
-- `select *`. C'est la 5ᵉ colonne de cette table dans ce cas, après `session_conflicts_enabled`
-- (COLLIS-01), `sbd_lifts` (MUSCPWR-01), `intensity_scale` (UX-05) et `cycle_tracking_enabled`.
-- (La table `pain_reports`, elle, est neuve et exige bien une sync rule — migration voisine.)
--
-- 🔴 **En revanche, la colonne DOIT être ajoutée à `apps/mobile/src/powersync/schema.ts`**, ainsi
-- qu'aux quatre points d'édition de `settings-repository.ts` et au schéma Zod des réglages. Absente
-- du schéma **local**, elle n'existe pas dans la base SQLite embarquée : l'écriture échoue et
-- l'erreur est avalée — l'interrupteur reste éteint sans le moindre message. C'est la panne exacte
-- de CYCLE-01, constatée en recette device le 31/07/2026.

alter table public.user_settings
  add column if not exists pain_journal_enabled boolean not null default false;

comment on column public.user_settings.pain_journal_enabled is
  'US DOUL-01 — opt-in du journal des zones douloureuses (donnée de santé). Désactivé par défaut.';
