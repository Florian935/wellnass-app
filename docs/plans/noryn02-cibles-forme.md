# Plan — NORYN-02 · Noryn reçoit les cibles et le verdict de forme

Spec : [noryn02-cibles-forme.md](../specs/functional/us/noryn02-cibles-forme.md) · 12/10/2026 · branche
`feature/noryn02-cibles-forme` (worktree `.expo/claude-worktrees/noryn-02`, poussé par
`git push origin HEAD:dev`) · contrat Noryn **inchangé** (TASK-013).

Écrit sur les propositions de la spec : **D1-A** (une seule règle de protéines), **D2-A** (écart
`useDailyCalorieTargets` signalé, BACKLOG CIBLE-01), **D3** (date future = même composition), **D4**
(verdict d'aujourd'hui, si `show`). Une autre réponse à D1 supprime ou réduit l'étape 4 ; à D2, ajoute
une étape après la 4 (aligner `useDailyCalorieTargets`) ; à D3 ou D4, ne change que l'étape 7. Le reste
tient.

**Aucune migration, aucune sync rule, aucun `db:types`** (spec §8). Aucune action sur le cloud par un
agent : le seul geste humain est le redéploiement, **par Florian**, avec `npm run noryn:deploy`.

## Ordre de build

Un lot, huit étapes, **un commit par étape** : chacune laisse `typecheck`, `lint` et `test` verts. Les
preuves d'abord (parité des lectures, filet de l'assemblage), toutes deux vertes sur le code
d'aujourd'hui ; l'extraction ensuite (rien ne bouge) ; la réparation D1 à part (seul ce que la spec
annonce bouge) ; Noryn en dernier.

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 0 | **Relecture** de la spec et du plan — faite le 12/10/2026 | spec §14 | — |
| 1 | **Parité des lectures**, côté app | `energy-repository.ts`, `activity-repository.ts`, `planned-session-repository.ts`, `bodyweight-repository.ts`, `real-life-repository.ts` (requêtes **exportées**, inchangées) ; `packages/shared/src/noryn/parity.fixture.json` **(neuf)** | `apps/mobile/src/data/repositories/__tests__/noryn02-parity-sql.test.ts` **(neuf)** |
| 2 | **Le filet** : l'assemblage des hooks, figé sur le code actuel | `apps/mobile/src/data/repositories/__tests__/` : `day-energy-assembly`, `day-calorie-target-assembly`, `readiness-assembly` ; `apps/mobile/src/hooks/__tests__/day-nutrition-targets-assembly` **(neufs)** | ~70 cas Jest |
| 3 | **L'extraction**, sans changement | `packages/shared/src/day-energy.ts`, `day-target.ts` **(neufs)**, `readiness.ts`, `index.ts` ; `energy-repository.ts`, `dashboard-repository.ts`, `hooks/useDayNutritionTargets.ts` ; `hooks/__tests__/no-frozen-clock.test.ts` | Vitest des briques ; filets des étapes 1-2 **inchangés** |
| 4 | **D1** : une seule règle de protéines | `day-target.ts`, `useDayNutritionTargets.ts`, `NutritionSummaryCard.tsx`, `dashboard-repository.ts` (`useProteinTarget`), `useNutritionRelay.ts`, `nutrition-profile.tsx`, `(tabs)/nutrition.tsx`, `explain.ts`, `i18n/locales/{fr,en}.json` | filet : seules les lignes du §1.2 de la spec changent ; cas neufs |
| 5 | **Noryn — décodage** des lignes Postgres | `noryn/snapshot.ts` | `snapshot.test.ts` |
| 6 | **Noryn — la source** : deux temps, listes par usage, parité | `noryn/source.ts`, `noryn/noryn.testkit.ts` | `source.test.ts` (parité sur `parity.fixture.json`, isolation, filtres, test-garde par usage) |
| 7 | **Noryn — la journée** : cibles et verdict | `noryn/targets.ts` **(neuf)**, `noryn/day.ts`, `noryn/handler.ts` | `targets.test.ts` **(neuf)**, `day.test.ts`, `handler.test.ts`, `bundle.test.ts` |
| 8 | **Recette et docs** | `supabase/scripts/noryn02-recette-{donnees,nettoyage}.sql` **(neufs)**, spec (`etape: recette`), `RECETTES.md`, roadmap 9.18, `BACKLOG.md` | — |

## Étape 1 — la parité des lectures, côté app

Le filet de l'étape 2 simule `useQuery` : il ne passe jamais par les `WHERE` de l'app. Or une partie de
« ce que l'app retient » vit dans ce SQL (relecture, 🔴). D'où un jeu de données **unique**, joué des
deux côtés.

- Exporter, **sans les modifier**, les requêtes concernées (export « pour les tests », patron
  `SELECT_HISTORY_FOR_TEST`) : `SELECT_WORKOUTS`, `SELECT_RUNS` (`energy-repository.ts`),
  `SELECT_ACTIVITIES`, `SELECT_HAS_PLANNED`, la dernière pesée et `useWeightEntries`, `SELECT_PERIODS`.
  `SELECT_DAILY_TOTALS`, `SELECT_HISTORY` (séances, courses) le sont déjà.
- `packages/shared/src/noryn/parity.fixture.json` : `rows` (lignes par table, au format neutre — dates
  `AAAA-MM-JJ`, instants ISO, booléens) et `expected` (ce que chaque lecture doit retenir :
  identifiants, nombre de séries validées par séance, dernière pesée, pesée à la date, totaux de kcal
  par jour, `hasPlanned` par jour, périodes). Cas obligatoires : série `done = 0`, série supprimée,
  échauffement ; course `active` et course `cancelled` **non supprimées** avec `finished_at` ; séance
  `completed` sans `finished_at` ; séance planifiée `skipped`, et d'un programme supprimé ; période
  supprimée ; deux pesées le même jour ; un jour de repas à 0 kcal ; un repas daté de demain.
- `noryn02-parity-sql.test.ts` charge `rows` dans le harnais SQLite (`@/test-utils/sqlite-harness`),
  joue les requêtes de l'app, compare à `expected`. Le côté Noryn (étape 6) compare **au même
  `expected`** : un écart entre R4 et le SQL réel fait échouer l'un des deux.
- DD9 (deux pesées le même jour) : `expected` ne fige que ce qui est déterministe des deux côtés ; le
  départage par `id` côté serveur a son propre test (étape 6).

## Étape 2 — le filet

Patron : [goal-adherence-assembly.test.tsx](../../apps/mobile/src/data/repositories/__tests__/goal-adherence-assembly.test.tsx).
Les **sources** sont mockées (repositories, `useQuery` par requête, `useTodayKey` figé), les **briques
pures ne le sont pas**. Profil de référence : le profil A de la spec, plus un profil incomplet.

- **`day-energy-assembly`** — `useEnergyItemsByDay`, `useDayEnergy`, `useRestingMetabolismAt` : séance,
  course, activité le même jour ; course finie à 23 h 30 (jour local) ; poids à la date (pesée avant,
  après seulement → la plus ancienne, aucune → profil) ; total central et bas de fourchette ; `weightKg`
  rendu par `useRestingMetabolismAt`.
- **`day-calorie-target-assembly`** — `useIsTrainingDay` et `useDayCalorieTarget`, pour chaque mode :
  jour de repos, séance faite, course faite (pilier course actif / éteint), **autre activité seule**,
  séance planifiée aujourd'hui et demain (anticipation) mais pas hier, période « vie réelle » sur le jour
  seulement, `manual_calories`, profil nutritionnel absent, profil incomplet, dernière pesée ≠ poids du
  profil (le socle prend le profil, la course `auto` la pesée).
- **`day-nutrition-targets-assembly`** — `useDayNutritionTargets`, `useProteinTarget`, le calcul des
  macros de `NutritionSummaryCard` et de `nutrition-profile.tsx` : les lignes du tableau §1.2 de la spec
  **avec leurs valeurs actuelles, défaut compris** (236 / 205 / 265…), macros manuelles complètes,
  partielles, absentes, objectif jamais posé, profil incomplet avec macros manuelles.
- **`readiness-assembly`** — `useReadiness` : bornes (séance à J−6 / J−7, J−27 / J−28, check-in à J−2 /
  J−3, repas sans borne haute), piliers éteints un à un, autre activité dans la charge pilier course
  éteint, moins de 4 jours notés, déficit ≥ 15 % contre la cible **de base**, « malade » et nuit courte
  pilier Bien-être allumé / éteint, aucune composante → `show: false`.

Le filet est **vert sur le code actuel** avant toute modification. La couverture Jest des hooks touchés
est relevée ici, et comparée après l'étape 3.

## Étape 3 — l'extraction

Nouvelles briques, exportées par `packages/shared/src/index.ts`. **Aucune ne lit l'horloge** ni ne
connaît un fuseau : le jour d'un instant (`dayKeyOf: (iso: string) => string`) et l'instant de l'âge
(`at: Date`, **obligatoire**) sont passés (spec D7). Le mobile passe `dayKeyOf = (iso) =>
localDayKey(new Date(iso))` et `at = useTodayDate()` — minuit local réactif : `computeAge` ne compare
que des dates, l'âge est le même qu'avec `new Date()`, et plus aucune horloge ne peut être gelée par le
compilateur React. Les entrées sont des `Pick<>` de `ProfileRow`, `NutritionProfileRow`,
`Omit<Activity, 'notes'>`, `Pick<RealLifePeriod, 'startedOn' | 'endsOn'>` (spec D8) ; les replis vivent
dans les briques.

**`day-energy.ts`**
- `type DayEnergyItem` (quitte `energy-repository.ts`) ; entrées `EnergyWorkout`
  (`id, startedAt, finishedAt, durationSeconds, rpe, totalSets`) et `EnergyRun`
  (`id, finishedAt, distanceM, durationSeconds, elevationGainM, rpe`).
- `restingMetabolismOn({ profile, weightEntries, dayKey, at })` → `{ resting, weightKg }` — l'unique
  copie de la règle du repos (F7).
- `energyItemsByDay({ profile, weightEntries, workouts, finishedRuns, activities, dayKeyOf, at })` — le
  corps du `useMemo` de `useEnergyItemsByDay`, à la ligne près (cache par jour, tri par `startedAt`).
- `dayEnergyTotals(items)` → `{ totalKcal, targetKcal }`.

**`day-target.ts`**
- `trainedOnDay({ dayKey, todayKey, workouts, completedRuns, activities, hasPlanned, dayKeyOf })`.
- `composeDayCalorieTarget({ dayKey, profile, nutritionProfile, latestWeightKg, activePillars,
  realLifePeriods, trainedThatDay, completedRuns, energyKcal, dayKeyOf, at })` → `{ socle, socleKind,
  target, effectiveTarget, trainingBonus, bonusSource, isTrainingDay }` — le socle est **rendu** (spec
  §4) : plus personne ne le recalcule à côté.
- `composeDayNutritionTargets({ dayKey, profile, nutritionProfile, realLifePeriods, dayTarget, at })`
  → `{ tdeeValue, target, targetMacros, profileComplete }` — **socle `tdee` compris** à cette étape (le
  défaut E4 est déplacé, pas réparé).

**`readiness.ts`**
- `activityLoadSessions` quitte `dashboard-repository.ts` (`useTrainingLoadAlert` et le garde-fou
  l'importent).
- `composeReadiness({ todayKey, activePillars, wellbeingPillarEnabled, workouts, completedRuns,
  activities, dailyKcal: { logDate, kcal }[], baseTargetKcal, wellbeingRows, dayKeyOf })` →
  `ReadinessResult`, fenêtres comprises, calculées depuis `todayKey` comme `useWindowStartKey`.

**Les hooks** ne gardent que leurs lectures et l'appel. `no-frozen-clock.test.ts` surveille en plus
`energy-repository.ts` et `hooks/useDayNutritionTargets.ts`.

Tests Vitest (TDD) : chaque branche, les bords de fenêtre, les replis, un `dayKeyOf` qui n'est **pas**
le jour local (preuve que la brique ne lit aucun fuseau), un `at` la nuit d'un anniversaire. **Critère
de sortie** : filets des étapes 1 et 2 verts **sans modification**, fichiers neufs à 100 %.

## Étape 4 — D1 : une seule règle de protéines

- `day-target.ts` : `dayMacroTargets({ nutritionProfile, profile, dayTarget })` — « une macro manuelle
  posée → les manuelles (`?? 0`) ; sinon `trainingDayMacroGrams({ targetBase: dayTarget.target,
  effectiveTarget: dayTarget.effectiveTarget, objective })` ». `composeDayNutritionTargets` prend la base
  de `dayTarget` : plus de `tdee` à part.
- Appelants : `useDayNutritionTargets` (onglet Nutrition), `NutritionSummaryCard` (supprime sa copie),
  `useNutritionRelay` (supprime sa copie), `useProteinTarget` (garde « objectif jamais posé → `null` »,
  et rend `null` au lieu de 0 g). Réglages › Nutrition : la même base **sans bonus**, socle selon le
  mode, toujours sans vie réelle (VIE-01).
- Explication de la cible : la première ligne porte `dayTarget.socle`, libellée selon `socleKind`
  (`explain.kcal.sportFree`, FR « Ta dépense hors sport », EN « Your expenditure outside training ») ;
  l'addition tombe juste.
- Filet : **seules** changent les attentes du tableau §1.2 de la spec, chacune commentée avec la règle
  qui la justifie. Cas neufs : la somme des macros égale la cible à l'arrondi près, l'explication
  additionne, Réglages et onglet Nutrition donnent les mêmes protéines un jour sans bonus.

## Étape 5 — Noryn : décoder les lignes Postgres

`noryn/snapshot.ts` : types de lignes `snake_case` des colonnes neuves (renommés `Pg…Row` : `ProfileRow`
et `NutritionProfileRow` y existent déjà et collisionneraient avec ceux du paquet) et un décodeur par
règle de R4 (spec §6) vers les entrées de l'étape 3 : séances, `completedRuns` / `finishedRuns`, séries
validées par séance, activités, `hasPlanned`, totaux de kcal par jour arrondis jour par jour, pesées,
périodes, profils. Énumérations à `CHECK` validées par les schémas zod partagés, `null` admis là où la
colonne l'admet ; `activity_type` tel quel ; une valeur impossible rend l'entrée **invalide** (DD4).

Tests : des lignes « comme PostgREST les rend » (instants à microsecondes et `+00:00`, `numeric` en
nombres) → les entrées attendues, en clair ; énumération inconnue → invalide ; `active_pillars`
corrompu → repli de l'app.

## Étape 6 — Noryn : la source

- **Deux temps** (spec D9). D'abord reçu, réglages, `profiles (user_id, daily_step_goal)` — décider
  `unknown_owner` comme NORYN-01. Ensuite, si le reçu existe : lectures de la journée (NORYN-01), plus
  les entrées des cibles **si le pilier Nutrition est actif**, plus celles du verdict **si la date est
  aujourd'hui à Paris** (`NorynLoadRange` gagne `today`). Jamais synchronisé → aucune lecture d'entrée.
  Pilier Nutrition éteint → ni `nutrition_profiles` ni `food_entries` (spec §7, note ¹).
- `NorynQuery` gagne `order(column, { ascending })` et `limit(n)` (que `supabase-js` a déjà) ; la
  fausse base les applique.
- **Pesées** (modes `auto` et `activities` seulement) : trois lectures ciblées — la dernière ; la plus
  récente au plus tard D ; la plus ancienne (ordre `log_date` puis `id`, DD9). **Périodes** : celles qui
  couvrent D (et aujourd'hui pour la cible de base du verdict). **Séries** : mode `activities`, séances
  du jour seulement.
- Plages : séances, courses, activités de D lues un jour de plus de chaque côté en UTC (patron
  NORYN-01) ; pour le verdict, `finished_at` depuis J−28 en UTC et `started_at` des activités depuis
  J−29, **sans borne haute** ; repas depuis J−6 sans borne haute ; check-ins depuis J−2.
- **Garde de troncature** : une lecture qui rend 1 000 lignes (`max_rows`) échoue (`db_error`, 503) au
  lieu de calculer sur une liste coupée.
- Listes blanches **par (table, usage)** (spec §7) : `READ_COLUMNS` (journée NORYN-01),
  `WEEK_…_COLUMNS`, `TARGET_…_COLUMNS`, `READINESS_…_COLUMNS`.

Tests (`noryn.testkit.ts` étendu : l'autre compte reçoit pesées, périodes, activités, séances et séries
**reconnaissables** aux mêmes dates) :
- **parité** : `parity.fixture.json` chargé dans la fausse base ; les décodeurs de l'étape 5 retiennent
  exactement `expected` — le même que celui du harnais SQLite (étape 1) ;
- isolation : la réponse est **identique** avec et sans les lignes de l'autre compte ; une ligne
  étrangère dans une table neuve → 503 ;
- enregistreur : chaque requête neuve porte son filtre propriétaire et ses filtres R4 ; en retirer un
  fait échouer un test (vérifié par mutation, comme NORYN-01) ;
- **minimisation** : pilier Nutrition éteint → ni profil étendu, ni profil nutritionnel, ni repas, ni
  pesées, ni périodes ; mode `fixed` → aucune pesée ; hors mode `activities` → aucune série ; date ≠
  aujourd'hui → aucune lecture sur 28 j ni du stress ; jamais synchronisé → aucune entrée ; la semaine
  → **exactement** les requêtes de NORYN-01 ;
- **test-garde par usage** : chaque sélection égale sa liste blanche, figée en clair ; `weight_kg`
  seulement dans `profiles` et `body_weight_entries`, `distance_m` dans `runs` et `activities`, `stress`
  pour le verdict seulement ; `mood`, `notes`, `name`, `meal_type`, les modules, les heures de nuit,
  `gps_track`, les charges et répétitions de `workout_sets` : jamais ;
- troncature : 1 000 lignes → 503.

## Étape 7 — Noryn : la journée

`noryn/targets.ts` :
- `norynTargets(snapshot, { date, today })` → `{ energyTargetKcal, proteinTargetG }` : décode, appelle
  `energyItemsByDay`, `trainedOnDay`, `composeDayCalorieTarget`, `dayMacroTargets` avec
  `dayKeyOf = (iso) => parisDayKey(new Date(iso))` et `at` = **midi UTC d'aujourd'hui à Paris**, quelle
  que soit la date demandée (sur un serveur en UTC, les accesseurs locaux de `computeAge` y lisent la
  date de Paris) ; borne (DD1).
- `norynReadiness(snapshot, { today })` → verdict ou `null` : `composeReadiness`, cible de base
  d'aujourd'hui par `composeDayCalorieTarget` (pilier Nutrition actif), `show ? verdict : null`.
- Une exception dans l'une ou l'autre : ce seul champ à `null`, journal `target_error` /
  `readiness_error` (DD8).

`day.ts` remplit les trois champs (spec §5) ; DD2, DD3, D4. `handler.ts` passe `today` à la source et
à `buildNorynDay`.

Tests :
- **parité de bout en bout** : pour chaque cas du filet de l'étape 2 qui a un sens côté serveur, les
  mêmes données en lignes Postgres donnent **la même valeur** que le filet — valeurs écrites en clair ;
- aujourd'hui, hier, J+3 (anticipation), J+5 en période « vie réelle », mode par mode ; protéines sans
  cible calorique (DD7) ; deux pesées le même jour (DD9) ;
- Paris : course finie le lundi 26/10/2026 à 00 h 30 (dimanche en UTC) comptée le lundi ; fenêtre de
  charge à J−27 à Paris ; âge la nuit d'un anniversaire, pour une date demandée passée et future ;
- `readiness` : aujourd'hui avec verdict, `show: false` → `null`, autre date → `null`, « malade » →
  `rest` ;
- bornes : cible 0 ou > 20 000 → `null`, protéines 0 → `null` ; exception simulée → champ `null`,
  réponse 200, code journalisé ;
- **R1 (test-garde)** : `noryn/targets.ts` n'importe que ce que permet sa liste (compositions de
  l'étape 3, décodeurs, dates de Paris) ;
- chaque réponse passe `contract.ts` ; la semaine est inchangée (ses tests de NORYN-01 passent tels
  quels) ; `bundle.test.ts` construit et exécute le bundle élargi.

## Étape 8 — recette et docs

- `supabase/scripts/noryn02-recette-donnees.sql` (patron NORYN-01) : dates **relatives** à aujourd'hui
  à Paris (`(now() at time zone 'Europe/Paris')::date`), identifiants fixes, UUID du compte à remplacer
  à la main, **jamais commité**. Contenu : à J−2 une autre activité (vélo 60 min, RPE 6) et une course
  terminée (8 km, 45 min, RPE 5) ; à J−4 une autre activité **seule** (rando 90 min) ; à J+3 une séance
  planifiée (programme brouillon) ; de J+5 à J+6 une période « vie réelle ». En tête, les réponses
  attendues **en fonction de l'écran** (pas de chiffres en dur : la cible dépend du profil réel).
  `noryn02-recette-nettoyage.sql` les retire.
- Spec : `etape: recette`, écarts au plan en fin de plan ; `RECETTES.md` : nouvelle section avec les
  critères §13 ; roadmap **9.18** ✅ ; `BACKLOG.md` : mettre à jour CIBLE-01 selon D2 ; CHANGELOG par
  `/commit`.
- **Geste humain** : `npm run noryn:deploy` par Florian, puis recette.

## Ce que la CI vérifie

`npm run typecheck`, `npm run lint`, `npm run test` (Vitest `shared` + Jest `mobile`, code de sortie lu
**sans pipe**), `test:coverage` sur `shared` (fichiers neufs à 100 % ; le seuil global était déjà rouge
avant NORYN-01, dette connue). La suite entière est relancée après la dernière retouche.

## Volume estimé

`shared` : 2 fichiers neufs (~500 lignes) et `readiness.ts` (+80), ~1 000 lignes de tests, un jeu de
parité ; mobile : −300 lignes de hooks, 5 fichiers de tests (~1 000 lignes) ; Noryn : 1 fichier neuf,
4 modifiés (~500 lignes), ~700 lignes de tests ; 2 scripts SQL.

## Risques

- **Le filet ne voit que ce qu'il teste** : une branche oubliée serait extraite sans preuve. Parade :
  couverture Jest des hooks relevée avant et après l'étape 3, parité SQL sur un jeu commun.
- **Hooks les plus centraux de l'app** (accueil, Nutrition, forme) : l'étape 3 ne change que leur
  intérieur ; l'étape 4 change des chiffres annoncés. Recette §13, critères 9 et 10.
- **Bundle plus gros** : il embarque le moteur de dépense, la nutrition et la forme. Sans effet
  fonctionnel ; `bundle.test.ts` le construit et l'exécute.
