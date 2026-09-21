-- US SERIE-01 — la régularité comptée en semaines, et l'objectif hebdomadaire transverse.
-- Réf. : docs/specs/functional/us/serie01-serie-hebdomadaire.md §5
--
-- ── Pourquoi cette US existe ────────────────────────────────────────────────────────────────────
-- La série est quotidienne, donc fragile : rater un mardi la casse. On l'a déjà reconnu **deux
-- fois**, en empilant deux mécanismes correctifs par-dessus — le **joker** (STREAK-01) et les
-- **jours en pause** (VIE-01, un troisième état de jour dans le calcul). Et un jour de repos, que
-- nos propres programmes recommandent, reste un jour perdu. Une semaine laisse sept occasions de la
-- sauver.
--
-- ── Deux colonnes, et rien d'autre ──────────────────────────────────────────────────────────────
-- Additives, nullables, sur une table déjà publiée. Aucune table neuve, aucune donnée migrée.

alter table public.user_settings
  add column if not exists streak_unit text;

alter table public.user_settings
  add column if not exists weekly_activity_goal integer;

-- Contraintes **nommées** et posées à part : `add column … check (…)` produit une contrainte au nom
-- généré, impossible à reprendre proprement plus tard. Patron de
-- `nutrition_profiles_training_bonus_mode_check` (DEPENSE-00).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_settings_streak_unit_check') then
    alter table public.user_settings
      add constraint user_settings_streak_unit_check
      check (streak_unit in ('day', 'week'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_settings_weekly_activity_goal_check') then
    alter table public.user_settings
      add constraint user_settings_weekly_activity_goal_check
      check (weekly_activity_goal between 1 and 14);
  end if;
end $$;

-- ── 🔴 Aucune valeur `default`, et c'est une décision ───────────────────────────────────────────
-- `null` doit vouloir dire « **la question n'a jamais été posée** », jamais « la valeur par
-- défaut ». C'est la leçon d'`activity_level` (NUTRI-UX01) : la colonne était `not null default
-- 'moderate'`, donc l'app ne pouvait pas distinguer un choix d'un repli — et l'écran l'affichait
-- comme une sélection. Ce champ étant le multiplicateur du TDEE, un sédentaire recevait une cible
-- **surestimée de ~614 kcal/jour**, en silence.
--
-- Ici, `weekly_activity_goal is null` fait afficher le **compte nu** de la semaine au lieu d'une
-- cible inventée, et `streak_unit is null` laisse **le code** trancher (spec D1) : la **semaine**
-- pour un compte neuf, le **jour** pour un compte qui a déjà un historique. Poser `'day'` en SQL
-- pour tout le monde priverait les comptes neufs du défaut voulu.
--
-- ── Ce qu'il ne faut pas oublier ────────────────────────────────────────────────────────────────
-- ✅ **Aucune sync rule à déployer** : `user_settings` est publiée depuis le socle et lue en
--    `select *`. Le réflexe « migration ⇒ sync rule à la main » ne vaut que pour une **table
--    neuve**, jamais pour une colonne.
-- 🔴 **Mais les deux autres gestes restent dus** : déclarer les colonnes dans
--    `apps/mobile/src/powersync/schema.ts` **et** dans `settings-repository.ts`. Sans le premier,
--    l'écriture échoue en local et `void updateSettings()` avale l'erreur : l'interrupteur revient
--    à sa valeur précédente **sans le moindre message** (panne exacte de `cycle_tracking_enabled`,
--    recette du 31/07/2026, puis de `daily_step_goal` le 03/08).
