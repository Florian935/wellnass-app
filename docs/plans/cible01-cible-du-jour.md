# Plan — CIBLE-01 · Une seule « cible du jour » dans tout le pilier Nutrition

Spec : [cible01-cible-du-jour.md](../specs/functional/us/cible01-cible-du-jour.md) · 21-22/10/2026 · branche
`feature/cible01-cible-du-jour` (worktree `.expo/claude-worktrees/cible-01`, créé depuis `origin/dev` à
`9a3ca226` ; poussé par `git push origin HEAD:dev` après vérification de l'avance rapide).

✅ **Validé par Florian le 22/10/2026** avec la spec (D1 à D12 telles que proposées). Écrit sur les propositions de la spec : **D1** (la séance prévue d'aujourd'hui compte), **D2** (la séance
sautée ne compte pas), **D3** (jour futur en `activities` : socle + objectif), **D4** (règle de
`trainedOnDay` pour le planning), **D5** (groupes d'APPORT-01 sur `trainedOnDay`), **D6** (une lecture par
plage), **D7-B** (le planning garde sa règle « ni muscu ni course »), **D8-A** (le widget prend la cible
effective), **D9-A** (régularité sur la cible de chaque jour), **D10** et **D12** (signalés), **D11**
(compte de test). Une autre réponse : **D8-B** réduit l'étape 5 à la cible de base, sans module SQL ;
**D9-B** supprime l'étape 6 ; **D1-B** fait passer un ensemble de séances planifiées vide à l'historique
(étape 3) ; **D7-A** retire la règle propre au planning (étape 4) ; **D12-B** ajoute une étape (K8, K9,
K11 sur `useDailyCalorieTargets`) ; **D11-B** remplace les chiffres du test de recette par des égalités
entre écrans. Le reste tient.

**Aucune migration, aucune sync rule, aucun `db:types`, aucun déploiement** (spec §9, §7). Aucune action
sur le cloud. Rien dans `C:\noryn`.

## Ordre de build

Un lot, neuf étapes, **un commit par étape** : chacune laisse `npm run typecheck`, `npm run lint` et
`npm run test` verts (code de sortie lu **sans pipe**). Le filet d'abord, vert sur le code d'aujourd'hui ;
la brique ensuite (aucun écran ne bouge) ; puis un écran par étape, où **seuls** les tests étiquetés du
§6 de la spec changent d'attendu.

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 0 | **Relecture** de la spec et du plan — faite le 22/10/2026 | spec §15 | — |
| 1 | **Le filet**, figé sur le code actuel ; bundle Noryn de départ | `test-utils/day-target-sources.ts` (étendu) ; `__tests__/` neufs ; `meal-plan-screen.test.tsx` (sources seulement) | ~80 cas Jest |
| 2 | **La brique**, **la lecture par plage**, **le hook** | `packages/shared/src/day-target-range.ts` **(neuf)**, `index.ts` ; `data/repositories/day-target-sql.ts` **(neuf)**, `day-targets-repository.ts` **(neuf)**, `planned-session-repository.ts` | Vitest de la brique (100 %) ; parité SQL ; filet **inchangé** |
| 3 | **L'historique** : `useDailyCalorieTargets` | `dashboard-repository.ts`, `HistorySection.tsx` (commentaire) | filet : C1-C4 changent d'attendu, rien d'autre ; parité K1 = K2 |
| 4 | **Le planning repas** | `app/meal-plan/index.tsx`, `MealPlanDayCard.tsx`, `meal-plan.ts`, `i18n/locales/{fr,en}.json` | filet : C7-C14 ; libellés FR/EN |
| 5 | **Le widget** (D8-A) | `widgets/home-widget-data.ts` ; `day-target-sql.ts` (constantes et lecteurs déplacés, réexportés) | filet : C16-C19 ; test-garde R6 ; parité SQL |
| 6 | **La régularité** (D9-A) | `RegularityCard.tsx`, `journal-regularity.ts`, `ProgressSection.tsx`, `(tabs)/nutrition.tsx`, `nutrition-stats.tsx` | filet : C6 |
| 7 | **Ménage et preuve Noryn** | `nutrition.ts` (brique morte, DD5) | test-garde R1 ; bundle Noryn identique ; tests NORYN-02 intacts |
| 8 | **Recette et docs** | `supabase/scripts/cible01-recette-{donnees,nettoyage}.sql` **(neufs)**, `RECETTES.md` §94, spec, specs voisines, roadmap, CHANGELOG, BACKLOG | `cible01-recette.test.tsx` **(neuf)** |

**Préalable d'environnement** (comme le worktree de NORYN-02) : une jonction
`node_modules/@wellness/shared` → `packages/shared` **du worktree**, à la racine du worktree ; le reste se
résout dans `C:\wellness-app\node_modules` en remontant. Sans elle, les tests du mobile liraient le
`packages/shared` du dépôt principal. `node_modules` est ignoré par git.

## Étape 1 — le filet

Patron : [goal-adherence-assembly.test.tsx](../../apps/mobile/src/data/repositories/__tests__/goal-adherence-assembly.test.tsx)
et [day-target-sources.ts](../../apps/mobile/src/test-utils/day-target-sources.ts) (NORYN-02). Les
**sources** sont mockées au niveau des repositories, les **briques pures ne le sont jamais**. Profil A,
horloge figée (`FROZEN_CLOCK`).

**Le harnais décrit un scénario une fois, et nourrit toutes les lectures, anciennes et futures** — c'est
ce qui permet au filet de rester inchangé quand un écran change de sources :
- `Sources.plannedSessions?: { date, status: 'planned' | 'done' | 'skipped' }[]` nourrit
  `useHasPlannedSession` (`planned`/`done`) et `useWeekPlan` (tout statut, la lecture actuelle du
  planning) ; à l'étape 2, `usePlannedDayKeys` (`planned`/`done`). `plannedDays` reste accepté.
- `setSources` passe par `jest.requireMock(module)` et **ne configure que les fonctions mockées par le
  fichier de test** (`jest.isMockFunction`) : les filets de NORYN-02, qui ne mockent que
  `useHasPlannedSession`, restent **inchangés**. Le harnais ne référence par son nom aucun export qui
  n'existe pas encore (le code des tests est typé : `tsc` refuserait).
- La dépense par jour (`energyByDay`) nourrit `useDayEnergy` et `useEnergyTargetByDay`, comme aujourd'hui.

Fichiers :
- **`daily-calorie-targets-assembly.test.tsx`** (neuf) — `useDailyCalorieTargets`,
  `useGoalAdherenceForRange`, `useTrainingNutritionCross`, dans les trois modes : jour de repos, séance
  faite, course faite (pilier course actif / éteint), deux courses le même jour, vie réelle sur le seul
  jour, surcharge, profil nutritionnel absent, profil incomplet (`hasTarget` faux), marge réglée et
  absente, borne `toKey`, jours non notés absents, `weightKg` rendu (pesée, sinon profil) ; **et les cas
  qui vont changer, avec leurs valeurs d'aujourd'hui** : autre activité seule (C1), séance prévue
  aujourd'hui (C2), jour futur noté avec séance prévue (C3), groupes d'APPORT-01 (C4). Chacun porte
  l'étiquette `CIBLE-01 C<n>`.
- **`day-target-parity.test.tsx`** (neuf) — `useDayCalorieTarget(D)` contre le jour D de
  `useDailyCalorieTargets`, sur le jeu de la spec §14, trois modes : égalité sur les jours témoins ;
  **l'écart d'aujourd'hui affirmé** sur J−5 et J (étiquetés C1, C2).
- **`meal-plan-screen.test.tsx`** — ses sept tests « objectif calorique du jour » passent sur le harnais
  (sources seulement : **aucun attendu ne change**). Le fichier mocke dès maintenant **toutes** les
  sources que lira le hook de l'étape 2 (`workout-`, `run-`, `activity-`, `energy-`, `bodyweight-`,
  `real-life-`, `settings-`, `planned-session-repository`) : leurs modules réels, qui chargent `@/i18n`,
  ne sont jamais importés — le fichier mocke `react-i18next` sans `initReactI18next`. S'y ajoutent les
  valeurs actuelles de la colonne « Avant » du §14.2, le mode `activities` (socle `tdee`), `auto` (forfait
  seul), la séance sautée et la séance passée non faite (forfait), la ligne de réglages absente (aucun
  bonus), étiquetés C7-C14 ; et le pilier éteint (aucun bonus, D7-B : **ne changera pas**).
- **`home-widget-data.test.ts`** — kcal restantes d'aujourd'hui, trois modes, jour de séance, dernière
  pesée ≠ poids du profil, profil sans poids avec une pesée (C16-C19, valeurs actuelles).
- **`nutrition-progress-section.test.tsx`** et un test de `RegularityCard` — le seuil « complète » sur la
  cible d'aujourd'hui (Progrès) et sur 600 kcal (Statistiques), C6.

**Bundle Noryn de départ** : avant la première ligne de code, `buildNorynBundle()` lancé dans ce
worktree, texte écrit dans le scratchpad (jamais commité, jamais affiché) — la référence de l'étape 7.

Le filet est **vert sur le code actuel** avant toute modification. La couverture Jest des fichiers touchés
est relevée ici, et comparée à la fin.

## Étape 2 — la brique, la lecture par plage, le hook

**`packages/shared/src/day-target-range.ts`** (neuf, exporté par `index.ts`) :

```ts
composeCalorieTargetsForDays(input: {
  dayKeys: readonly string[]; todayKey: string;
  profile: TargetProfile | null; nutritionProfile: TargetNutritionProfile | null;
  latestWeightKg: number | null; activePillars: readonly Pillar[] | null | undefined;
  realLifePeriods: ReadonlyArray<RealLifeSpan>;
  workouts: ReadonlyArray<{ finishedAt: string | null }>;
  completedRuns: ReadonlyArray<{ finishedAt: string | null; distanceM: number | null; durationSeconds: number | null }>;
  activities: ReadonlyArray<{ startedAt: string }>;
  plannedDayKeys: ReadonlySet<string>;
  energyKcalByDay: ReadonlyMap<string, number>;
  dayKeyOf: DayKeyOf; at: Date;
}): Map<string, DayCalorieTargetResult & { trainedThatDay: boolean; trainedBy: 'done' | 'planned' | null }>
```

- Range **une fois** séances, courses (par `finishedAt`) et activités (par `startedAt`) dans des seaux
  par jour (`dayKeyOf` appelé une fois par ligne) ; pour chaque jour demandé, appelle **`trainedOnDay`**
  (seaux du jour, `hasPlanned = plannedDayKeys.has(jour)`), puis **`composeDayCalorieTarget`** (courses
  du jour, `energyKcal = energyKcalByDay.get(jour) ?? 0`). `trainedBy` : `trainedOnDay` rappelée avec
  `hasPlanned = false` → `'done'` si vrai, sinon `'planned'` si le jour est entraîné, sinon `null`
  (DD7). Le rattachement au jour pour le rangement est le seul point repris (spec §4) ; le test
  d'équivalence le verrouille.
- N'importe que `day-target.ts` et des types. Ne modifie ni `day-target.ts`, ni `day-energy.ts`.

Tests Vitest `day-target-range.test.ts` :
- **équivalence** (R3) : sur un jeu de 400 jours qui contient chaque cas du §6 de la spec (et une course
  `active` avec `finished_at`, une séance sans `finished_at`, une activité à 23 h 50, deux courses le même
  jour), pour chaque mode, chaque jour : même résultat que `trainedOnDay` + `composeDayCalorieTarget`
  appelés sur les **tableaux entiers** ;
- jours demandés seulement (un jour hors `dayKeys` est absent), liste vide, jour sans ligne, `dayKeyOf`
  injecté (un rattachement « à Paris » déplace la séance de 00 h 30), `trainedBy` dans les trois cas ;
- couverture 100 % du fichier.

**`data/repositories/day-target-sql.ts`** (neuf) — module **feuille** : aucun import en dehors de types et
de `@wellness/shared`. Y vivent `SELECT_HAS_PLANNED` (déplacée de `planned-session-repository.ts`, qui la
**réexporte** sous le même nom) et la neuve `SELECT_PLANNED_DAYS_BETWEEN` : `SELECT DISTINCT
scheduled_date FROM planned_sessions WHERE owner_id = ? AND status IN ('planned','done') AND deleted_at
IS NULL AND scheduled_date >= ? AND scheduled_date <= ?` — le filtre de `SELECT_HAS_PLANNED`, mot pour mot
(R5). `planned-session-repository.ts` gagne `usePlannedDayKeys(fromKey, toKey)` → `{ dayKeys:
ReadonlySet<string>, isLoading }` ; plage vide (`fromKey > toKey`) → ensemble vide.

**`cible01-planned-days-sql.test.ts`** (neuf, harnais SQLite) : pour chaque jour d'une plage, la ligne de
`SELECT_HAS_PLANNED` existe **si et seulement si** le jour sort de `SELECT_PLANNED_DAYS_BETWEEN` —
statuts `planned`, `done`, `skipped`, occurrence supprimée, autre propriétaire, programme supprimé
(cascade), séance-modèle supprimée, bornes incluses.

**`data/repositories/day-targets-repository.ts`** (neuf) — `useCalorieTargetsForDays(dayKeys)` : les
lectures (profil, profil nutritionnel, dernière pesée, réglages, `useWorkoutHistory`, `useRunHistory`,
`useActivities`, `useRealLifePeriods`, `useEnergyTargetByDay`, `usePlannedDayKeys(max(min(dayKeys),
aujourd'hui), max(dayKeys))`, `useTodayKey`, `useTodayDate`), puis `composeCalorieTargetsForDays`. Rend
`byDay`, `hasTarget` (`nutritionSocle(…).socle != null`, DD3), `weightKg` (dernière pesée, sinon profil),
`isLoading` (toutes les lectures, DD4). Les `dayKeys` sont mémorisés par leur contenu (une liste neuve à
chaque rendu relancerait la requête). N'importe ni `dashboard-repository.ts` ni `@/i18n`.

Personne ne l'appelle encore : le filet de l'étape 1 est vert **sans une ligne modifiée**.

## Étape 3 — l'historique

`dashboard-repository.ts` :
- `useDailyCalorieTargets(fromKey, toKey)` : totaux bornés comme aujourd'hui → `dayKeys` →
  `useCalorieTargetsForDays` → `{ dayKey, kcal, effectiveTarget, isTrainingDay: trainedThatDay }` (DD2).
  La formule des lignes 1671-1757 disparaît, et ses imports (`tdee`, `sportFreeTdee`, `targetCalories`,
  `effectiveNutritionObjective`, `isRealLifeDay`, `estimateRunCalories`, `computeAge`,
  `computeEffectiveTargetForDay`, `DEFAULT_SPORT_FREE_LEVEL`, `objectiveFromGoal`).
- Les types `DailyCalorieTarget` et `DayCalorieTarget` documentent les deux sens d'`isTrainingDay` (DD2).
- Les blocs de commentaire de `useDailyCalorieTargets` et de `useTrainingNutritionCross` (« Pourquoi
  `trainedDays` et non `isTrainingDay` ») sont réécrits : la garantie d'APPORT-01 tient désormais par la
  composition, autres activités comprises — et à peu près seulement en mode `activities` (spec D5).

Tests :
- filet : **seuls** les tests étiquetés C1, C2, C3, C4 changent d'attendu, chacun avec la référence
  « spec §6 C<n> » ; `goal-adherence-assembly.test.tsx` passe **sans modification** (ni activité, ni
  séance planifiée dans ses cas) ; `day-target-parity` : égalité K1 = K2 sur **tous** les jours ;
- `useQuery` n'est appelé **qu'une fois** avec `SELECT_PLANNED_DAYS_BETWEEN` pour une plage de 366 jours
  (D6) ;
- les écrans qui mockent `useDailyCalorieTargets` (`nutrition-day-screen`, `nutrition-history-section`,
  `nutrition-stats-screen`, `CrossTrainingSection`) ne bougent pas.

## Étape 4 — le planning repas

`app/meal-plan/index.tsx` :
- `useCalorieTargetsForDays(weekDayKeys(weekStart))` remplace `tdee`, `baseTargetFor`, `trainingBonus`,
  `trainingPillarsActive`, `trainingDays` et `useWeekPlan` (qui ne servait qu'à ces jours).
- **D7-B** : `resolveActivePillars(settings?.activePillars)` (DD12) ; ni muscu ni course actif → la cible
  affichée est `target` (la base de la composition) et aucune pastille ; sinon `effectiveTarget`.
- « Aujourd'hui » et la semaine courante viennent de `useTodayKey` (DD8 : `:96` et `:174`).
- Par jour, la pastille `{ kcal: trainingBonus, kind }` où `kind` ∈ `planned` (forfait, `trainedBy =
  'planned'`), `done` (forfait, `'done'`), `run`, `energy`, `energyLater` (`activities`, jour ≥
  aujourd'hui, `trainedBy = 'planned'`, bonus 0) — règle écrite une fois, dans une fonction pure de
  `meal-plan.ts` (`mealPlanBonusBadge`), testée.

`MealPlanDayCard.tsx` : reçoit la pastille ; libellé par `kind` (spec §11), icône `barbell-outline` /
`walk-outline` / `flame-outline` ; même style, même place ; le chiffre de la cible garde sa couleur
d'alerte quand un bonus s'ajoute. `energyLater` s'affiche sans montant.

`i18n/locales/{fr,en}.json` : `mealPlan.day.trainingDone`, `runBonus`, `energyBonus`, `energyLater`
(spec §11) ; `locale-parity.test.ts` les couvre.

`meal-plan.ts` : `dayTargetKcal` retiré avec ses tests (DD5) ; `mealPlanBonusBadge` ajouté.

Tests : filet du planning — **seuls** C7 à C14 changent d'attendu ; le test « sans pilier
d'entraînement actif, AUCUN bonus » reste vert sans changement (D7-B) ; la colonne « Après » du §14.2 en
cas neufs ; parité « planning = `useDayCalorieTarget` » sur chaque jour de la semaine, trois modes, piliers
actifs ; `mealPlanBonusBadge` en Vitest ; libellés FR et EN rendus.

## Étape 5 — le widget (D8-A)

**Le module feuille** `day-target-sql.ts` reçoit, **déplacés et réexportés** sous leurs noms actuels par
leurs repositories d'origine : `SELECT_WORKOUTS` et `SELECT_RUNS` (`energy-repository.ts`),
`SELECT_ACTIVITIES` et son lecteur `toActivity` (`activity-repository.ts`), le `SELECT_HISTORY` des
courses et son lecteur (`run-repository.ts`, qui garde `SELECT_HISTORY_FOR_TEST` : la parité de NORYN-02
l'importe), `SELECT_PERIODS` et son lecteur (`real-life-repository.ts`). Les pesées restent dans
`bodyweight-repository.ts`, que le widget importe déjà. Les séances passent par `SELECT_WORKOUTS` (les
lignes que `trainedOnDay` retient du `SELECT_HISTORY` des séances — qui exige `[lang, lang]` et calcule
noms et records — sans son coût).

`widgets/home-widget-data.ts`, `computeKcalRemainingMetric` :
- lit séances, courses terminées, activités, séance planifiée d'aujourd'hui, dernière pesée et périodes
  par ces constantes et lecteurs ; en mode `activities` seulement, aussi `SELECT_RUNS` (toute course
  finie) et les pesées (`SELECT_WEIGHT_ENTRIES`) pour la dépense (`energyItemsByDay`) ;
- garde ses lectures du profil, du profil nutritionnel (étendue à `training_day_bonus`,
  `training_bonus_mode`, `sport_free_level`) et des repas du jour, avec son décodage `.catch(…)` ;
- appelle `composeCalorieTargetsForDays({ dayKeys: [aujourd'hui], … })` → `effectiveTarget − mangé`.
- N'importe ni `workout-repository`, ni `run-repository`, ni `planned-session-repository`, ni
  `energy-repository` (graphe chargé avant expo-router, cycle avec `refresh-home-widget`).

Tests : filet — **seuls** C16 à C19 changent ; **parité SQL** (harnais SQLite) : sur un jeu commun, les
jours d'entraînement et la cible d'aujourd'hui obtenus par les lectures du widget égalent ceux des hooks
(`SELECT_WORKOUTS` contre le `SELECT_HISTORY` des séances compris) ; **test-garde R6** : les lectures de
`computeKcalRemainingMetric` sur `workouts`, `runs`, `activities`, `planned_sessions`,
`body_weight_entries` et `real_life_periods` viennent des constantes partagées ; un test-garde d'imports
(aucun des quatre repositories ci-dessus) ; « pilier Nutrition éteint → `null` » et « profil incomplet →
`null` » restent.

⚠️ Le widget lit l'historique entier des séances et des courses, comme les hooks, dans sa tâche de fond :
quelques centaines de lignes. Si une mesure sur le téléphone le contredit, borner ses lectures à J−2 est
un écart à noter ici, pas une règle à changer.

## Étape 6 — la régularité (D9-A)

- `journal-regularity.ts` : `buildHeatmap(dayKeys, totals, targetFor)` où `targetFor: (dayKey) => number
  | null` remplace la cible unique (`dayFill` inchangé) ; ses tests passent sur une fonction constante
  (mêmes attendus) et gagnent un cas « cible par jour ».
- `RegularityCard.tsx` lit `useDailyCalorieTargets(dayKeys[0], null)` et passe la cible de chaque jour ;
  ses `dayKeys` partent de `useTodayKey` (DD8, `:49-54`) ; la prop `targetKcal` disparaît de
  `RegularityCard`, de `ProgressSection` et de leurs appelants (`(tabs)/nutrition.tsx:367`,
  `nutrition-stats.tsx:161`).

Tests : filet C6 ; Progrès et Statistiques donnent les mêmes cases pour la même fenêtre.

## Étape 7 — ménage et preuve Noryn

- Retirer `computeEffectiveTargetForDay` de `nutrition.ts` et ses tests de `nutrition.test.ts` (DD5).
- **Test-garde R1** (`cible01-no-formula.test.ts`) : `dashboard-repository.ts`, `meal-plan/index.tsx` et
  `home-widget-data.ts` n'importent aucune des briques de la liste de R1 (spec §5).
- **Preuve Noryn** (spec §7) : `buildNorynBundle()` relancé dans ce worktree, comparé en mémoire au texte
  de départ (étape 1), verdict seul affiché ; `git diff 9a3ca226 --stat -- packages/shared/src/noryn
  packages/shared/src/day-target.ts packages/shared/src/day-energy.ts packages/shared/src/readiness.ts
  supabase/functions` **vide** ; aucun fichier de test de NORYN-02 modifié (même commande sur
  `packages/shared/src/noryn/*.test.ts`, `noryn02-parity-sql.test.ts`, `day-calorie-target-assembly`,
  `day-nutrition-targets-assembly`, `readiness-assembly`). Le résultat est consigné au §7 de la spec.

## Étape 8 — recette et docs

- `supabase/scripts/cible01-recette-donnees.sql` : le jeu du §14.1 de la spec — garde « compte vierge »
  (exception si repas, séances, courses, activités, séances planifiées ou périodes « vie réelle » non
  supprimés entre J−30 et J+10, ou une pesée quelconque) ; pose du profil A et du profil nutritionnel ;
  identifiants `c1b1e001-0000-4000-8000-…` ; exercice de la bibliothèque choisi par requête (`owner_id IS
  NULL`) ; dates relatives à aujourd'hui à Paris, heures de Paris ; une transaction (`do $$ … $$`).
  Rejoué d'abord sur un Postgres jetable du scratchpad (`initdb`), schéma des migrations appliqué, si
  l'environnement le permet.
- `supabase/scripts/cible01-recette-nettoyage.sql` : suppression par identifiants fixes, dans l'ordre des
  clés étrangères ; ne rétablit pas le profil (compte de test).
- **`cible01-recette.test.tsx`** (neuf) : le même jeu sur le harnais, et **les tableaux du §14.2** affirmés
  écran par écran, trois modes (historique, Statistiques 7 et 30 j, APPORT-01, planning, widget,
  régularité, témoins). Le tableau de RECETTES est **copié de ce test** : il ne peut pas dériver du code.
- `RECETTES.md` **§94** : préparation (compte de test, import Health Connect des pesées coupé), critères 1
  à 12 de la spec §14.3 (le critère hors ligne en dernier), et un encadré « À lire avant de recetter » —
  les sections en attente dont un critère change : §27 LAUNCHER-01 (le « Restant »), §28 REPAS-01
  (critère 5 en mode `activities`), §53 APPORT-01 (groupes), §47 NUTR-18 et §8 BILAN-01 (bilans), §88
  NUTRI-UX03 (critère 13 : la case d'aujourd'hui), §65 DEPENSE / AUTRE-01.
- Spec : `etape: recette`, écarts au plan en fin de plan ; notes datées dans les specs voisines encore en
  recette : NUTRI-UX03 (D9 : l'écart est réparé), REPAS-01 (R5 : gardée, D7-B), APPORT-01 (D1),
  LAUNCHER-01 (§8 : la simplification est levée).
- Roadmap : remarques de **4.7**, **4.27**, **4.40**, **4.44**, **7.19**, entrée au journal des
  réconciliations ; aucun compteur ne bouge (pas de ligne neuve).
- CHANGELOG par commit ; `node scripts/etat.mjs`.

## Ce que le plan ne fait pas

- Aucun changement à `useDayCalorieTarget`, `useIsTrainingDay`, `trainedOnDay`, `composeDayCalorieTarget`,
  `energyItemsByDay`, `composeReadiness`, ni à `noryn/` (DD1, spec §7).
- Les écarts du §13 de la spec (BACKLOG CIBLE-02 à CIBLE-06 ; `WeekStrip.tsx` en dette).

## Écarts au plan

*(à remplir à l'implémentation)*
