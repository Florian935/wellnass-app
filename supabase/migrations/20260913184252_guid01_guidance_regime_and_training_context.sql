-- US GUID-01 — le régime de guidage, le contexte d'entraînement et l'échéance d'objectif.
--
-- ── Ce que cette migration répare ────────────────────────────────────────────────────────────────
-- L'onboarding demandait un objectif en promettant qu'il « oriente les recommandations ».
-- Cartographie du 12/09/2026 : `main_goal` était lu à HUIT endroits, tous le même appel
-- `objectiveFromGoal(...)` — le repli de l'objectif nutritionnel. Musculation et Course : zéro
-- lecture. Et `performance` / `health` tombaient dans le même `default`, donc deux options sur
-- quatre donnaient une application identique à celle de quelqu'un qui avait appuyé sur « Passer ».
--
-- Les colonnes ci-dessous portent ce qui manquait pour que la promesse tienne : un niveau
-- d'expérience réel (la muscu n'en avait AUCUN et triait ses programmes sur une préférence
-- d'affichage), une disponibilité hebdomadaire, et le régime de guidage.
--
-- ── Toutes nullable, et c'est le fond du sujet ───────────────────────────────────────────────────
-- `null` veut dire « la question n'a jamais été posée », JAMAIS « la valeur par défaut ». C'est la
-- leçon de NUTRI-UX01 (R1.3) : `activity_level` retombait silencieusement sur 'moderate' (×1,55) et
-- l'écran affichait ce repli comme une SÉLECTION de l'utilisateur — pour un sédentaire, ~614
-- kcal/jour d'objectif en trop, sans qu'aucun écran ne le signale. Ici, l'application distingue
-- partout `effectiveRegime()` (ce qui est APPLIQUÉ) de `hasChosenRegime()` (ce qui a été CHOISI).
--
-- Aucune valeur `default` côté SQL, donc : une colonne à défaut ne saurait plus dire « jamais
-- répondu » pour les lignes créées après elle.
--
-- ✅ AUCUNE sync rule PowerSync à redéployer : `profiles` est déjà publiée et son bucket lit
-- `select *`. Les huit colonnes sont couvertes d'office par la RLS, l'export de données (CONF-01)
-- et la suppression de compte (CONF-02), qui opèrent tous sur la ligne entière.
--
-- 🔴 LES HUIT COLONNES DOIVENT ÊTRE DÉCLARÉES DANS `apps/mobile/src/powersync/schema.ts` et dans
-- les quatre points d'édition de `profile-repository.ts` (`ProfileInput`, `ProfileDbRow`,
-- `rowToProfile`, `inputToColumns`). Absente du schéma LOCAL, une colonne n'existe pas dans la base
-- SQLite embarquée : l'écriture échoue, `void upsertProfile()` avale le rejet, et le sélecteur
-- revient à sa valeur précédente SANS LE MOINDRE MESSAGE. C'est la panne exacte de CYCLE-01
-- (recette du 31/07/2026) et celle de `daily_step_goal` (03/08/2026). Le piège a déjà coûté deux
-- recettes ; un test de garde le fige désormais côté repository.

alter table public.profiles
  add column if not exists main_goal_deadline date,
  add column if not exists training_focus text,
  add column if not exists training_level text,
  add column if not exists weekly_availability integer,
  add column if not exists guidance_regime text,
  add column if not exists guidance_strength text,
  add column if not exists guidance_cardio text,
  add column if not exists guidance_nutrition text;

-- Discipline visée quand l'objectif principal est « performance » (décision D2). Deux valeurs
-- seulement : avec trois piliers, « Performance » ne dit pas EN QUOI, mais rallonger la liste des
-- objectifs à cinq aurait allongé un écran d'onboarding pour tout le monde.
alter table public.profiles
  add constraint profiles_training_focus_ck
  check (training_focus is null or training_focus in ('strength', 'endurance'));

-- Mêmes valeurs que `programs.level` : c'est volontaire, le tri des programmes compare les deux.
alter table public.profiles
  add constraint profiles_training_level_ck
  check (training_level is null or training_level in ('beginner', 'intermediate', 'advanced'));

alter table public.profiles
  add constraint profiles_weekly_availability_ck
  check (weekly_availability is null or weekly_availability between 1 and 7);

-- Les trois régimes. L'axe est « qui décide » — pas « combien de messages » : `guided` n'envoie pas
-- plus de notifications que `assisted`, il en envoie des DIFFÉRENTES (des annonces de décisions
-- prises, au lieu de questions).
alter table public.profiles
  add constraint profiles_guidance_regime_ck
  check (guidance_regime is null or guidance_regime in ('guided', 'assisted', 'autonomous'));

alter table public.profiles
  add constraint profiles_guidance_strength_ck
  check (guidance_strength is null or guidance_strength in ('guided', 'assisted', 'autonomous'));

alter table public.profiles
  add constraint profiles_guidance_cardio_ck
  check (guidance_cardio is null or guidance_cardio in ('guided', 'assisted', 'autonomous'));

alter table public.profiles
  add constraint profiles_guidance_nutrition_ck
  check (guidance_nutrition is null or guidance_nutrition in ('guided', 'assisted', 'autonomous'));

comment on column public.profiles.main_goal_deadline is
  'US GUID-01 — échéance optionnelle de l''objectif principal (étape 3 de l''onboarding). null = pas de date, le cas normal.';
comment on column public.profiles.training_focus is
  'US GUID-01 — discipline visée si main_goal = performance. Question conditionnelle : posée seulement si les deux piliers d''entraînement sont actifs.';
comment on column public.profiles.training_level is
  'US GUID-01 — niveau d''entraînement DÉCLARÉ. À ne pas confondre avec workout_display_level, qui servait de proxy faute de mieux. null = jamais demandé.';
comment on column public.profiles.weekly_availability is
  'US GUID-01 — jours d''entraînement disponibles par semaine (1-7). null = jamais demandé.';
comment on column public.profiles.guidance_regime is
  'US GUID-01 — régime de guidage global (étape 4 de l''onboarding). null = jamais posé → assisted appliqué, affiché comme repli.';
comment on column public.profiles.guidance_strength is
  'US GUID-01 — surcharge du régime pour la musculation. null = hérite du global ; le global ne réécrit jamais une surcharge.';
comment on column public.profiles.guidance_cardio is
  'US GUID-01 — surcharge du régime pour la course. null = hérite du global.';
comment on column public.profiles.guidance_nutrition is
  'US GUID-01 — surcharge du régime pour la nutrition. null = hérite du global.';
