# Plan — CIBLE-04 · Le socle du Labo « Et si… » et du Conseil des trois

Spec : [cible04-socle-labo.md](../specs/functional/us/cible04-socle-labo.md) · 23/10/2026 · branche
`fix/cible04-socle-labo` (worktree `.expo/claude-worktrees/cible-04`, créé depuis `origin/dev` à
`d604dec2` ; poussé par `git fetch origin` + `git rebase origin/dev` + `git push origin HEAD:dev`, jamais
de `git checkout dev`, jamais de force).

✅ **Validé par Florian le 23/10/2026** avec la spec (D1-A, D2-A, D3-A). Écrit sur les propositions de la spec : **D1-A** (pause : l'objectif réglé), **D2-A** (surcharge : le
socle), **D3-A** (deux libellés). Une autre réponse : **D3-B** supprime l'étape 3 (et ajoute une ligne au
BACKLOG) ; **D3-C** ajoute une US à cadrer ; **D1-C** ou **D2-C** remplacent l'étape 2 par un `null`
conditionnel et changent les attendus de l'étape 1 ; **D1-B** / **D2-B** reviennent à ne rien faire.

**Aucune migration, aucune sync rule, aucun `db:types`, aucun déploiement, aucune action sur le cloud.**
Aucun fichier de `packages/shared` ni de `supabase/` (spec §6, DD5). Rien dans `C:\noryn`.

**La recette.** La consigne de départ réservait RECETTES §99. Le 23/10/2026, Florian a arrêté la
recette consignée (RECETTES.md retiré, une US passe de `code` à `close`) — changement **pas encore poussé
sur `origin/dev`** au moment du cadrage. À l'étape 4, on suit la règle **en vigueur sur `dev`** après le
`git rebase origin/dev` : sans RECETTES.md, `close` et rien de plus ; s'il existe encore, `recette` et la
section §99 avec les critères du §11 de la spec. Dans les deux cas, les chiffres attendus sont **affirmés
par le test d'assemblage**, et il n'y a pas de script SQL de recette (la vérification sur téléphone se
déroule à la demande).

## Ordre de build

Un lot, quatre étapes. Chaque commit laisse `npm run typecheck`, `npm run lint` et `npm run test` verts
(code de sortie lu **sans pipe**) : le rouge de l'étape 1 est **constaté et noté** (sortie copiée dans le
CHANGELOG), pas commité seul.

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 0 | **Environnement** | — | `npm install` dans le worktree (Node 24) ; vérifier que `@wellness/shared` se résout vers `packages/shared` **du worktree** |
| 1 | **Le test qui échoue d'abord** | `__tests__/lab-composer-socle.test.tsx` **(neuf)** ; `__tests__/lab-sql.test.tsx` (mock, trois tests adaptés, un ajouté) | rouge sur S1, S2, S3, S5 ; vert sur S0, S4, profil incomplet |
| 2 | **La correction** | `data/repositories/lab-repository.ts` | tout vert ; parité R3 |
| 3 | **Les libellés** (D3-A) | `i18n/locales/fr.json`, `i18n/locales/en.json` | parité des clés FR/EN ; aucun test d'écran ne lit ces valeurs (`react-i18next` simulé) |
| 4 | **Docs** | spec (`etape: close`, ou `recette` + RECETTES §99 si la règle du 23/10 n'est pas sur `dev`), roadmap (remarques 7.30 et 7.34 + journal des réconciliations, aucun compteur ne bouge), CHANGELOG, ETAT | `node scripts/etat.mjs --check` |

## Étape 0 — environnement

`npm install` à la racine du worktree. Contrôle : `node -e "console.log(require.resolve('@wellness/shared/package.json'))"`
doit pointer **dans** `.expo/claude-worktrees/cible-04/`. Sinon (patron de CIBLE-01), une jonction
`node_modules/@wellness/shared` → `packages/shared` du worktree. `node_modules` est ignoré par git.

## Étape 1 — le test qui échoue d'abord

### 1.a `lab-composer-socle.test.tsx` (neuf) — l'assemblage

Patron : [cible01-recette.test.tsx](../../apps/mobile/src/data/repositories/__tests__/cible01-recette.test.tsx)
et [day-target-sources.ts](../../apps/mobile/src/test-utils/day-target-sources.ts). Les **sources** sont
simulées au niveau des repositories ; `dashboard-repository` (donc `useDayCalorieTarget`,
`useNutritionSummary`, `useTrainingLoadAlert`), `lab-repository` et toutes les briques pures sont
**réels**. Horloge figée (`FROZEN_CLOCK`, jeudi 08/10/2026 : le profil A a 30 ans, socle 2 759 / 2 448 —
mêmes chiffres qu'au 23/10).

- Mocks de tête (ceux de `cible01-recette.test.tsx`, dont `real-life-repository` qui doit exporter
  `SELECT_WEEK_STRENGTH_SESSIONS`) + les sources propres à `useLabComposer` : `planned-session-repository`
  (`useWeekPlan` en plus de `useHasPlannedSession` / `usePlannedDayKeys`), `running-profile-repository`
  (`useRunnerProfile`), `daily-wellbeing-repository` (`useWellbeingEntries` en plus de
  `useWellbeingRows`), `strength-repository` (`useStrengthSection`). `setSources` ne les remplit pas : on
  les pose **dans le `beforeEach` du test**, sans toucher au harnais partagé (sessions parallèles).
  Valeurs neutres : semaine vide, pas de profil coureur, pas de nuit, pas d'historique de force.
  `useQuery` est déjà simulé globalement (`jest.setup.ts`).
- `setSources` : profil A, `NUTRITION_A` (sèche, modéré, forfait 300, `fixed`), pesée 80 kg, trois piliers,
  aucune séance ni course.
- Cas (tableau `it.each`) :

  | Cas | Sources en plus | `tdeeKcal` attendu |
  |---|---|---|
  | S0 | — | 2 759 |
  | S1 | `periods: [{ startedOn: J(−1), endsOn: J(+2) }]` | 2 759 — **3 159 avant** |
  | S2 | `nutrition.manualCalories: 2000` | 2 759 — **2 400 avant** |
  | S3 | S1 + S2 | 2 759 — **2 400 avant** |
  | S4 | `trainingBonusMode: 'activities'`, `sportFreeLevel: 'standing'` | 2 448 |
  | S5 | S4 + S1 | 2 448 — **2 848 avant** |
  | incomplet | `profile.heightCm: null` (± surcharge) | `null` |

- Pour chaque cas : **parité R3** — `tdeeKcal` égal au `socle` de `useDayCalorieTarget(TODAY)` rendu
  dans le même `renderHook` (un seul rendu, deux hooks).
- **Chiffres du §1 de la spec** : depuis le `context` rendu, `composeLab` sur les quatre objectifs
  (`LAB_OBJECTIVE_ORDER`) → `kcalTarget`, `weightChangeKg`, `proteinGPerDay` ; `buildCouncil` sur le
  conflit `bulkVsCut` → voix Nutrition `{ kcal, tdee }` et `kcalTarget` des deux issues. Les attendus sont
  **écrits en dur** (2 359, 2 509, 2 759, 3 059…), pas recalculés par les mêmes fonctions.
- Exécution sur le code actuel **avant** l'étape 2 : constater 4 rouges (S1, S2, S3, S5), chiffres
  obtenus notés pour le CHANGELOG.

### 1.b `lab-sql.test.tsx` — le câblage

- Le mock de `../dashboard-repository` gagne `useDayCalorieTarget: jest.fn()` ; `setupAll` le remplit
  (`{ socle: 2400, socleKind: 'tdee', target: 2400, … , isLoading: false }` : objectif `maintain` par
  repli du but principal, delta 0, cohérent avec la cible de 2 400 déjà simulée).
- « remonte au TDEE depuis la cible… » devient **« lit le socle de la cible du jour »** :
  `tdeeKcal === socle`.
- « laisse le TDEE à null quand aucune cible n'est connue » devient **« … quand aucun socle n'est
  connu »** (`socle: null`).
- La ligne `['résumé nutrition', …]` du `it.each` « relaie le chargement de la source » (`:693`) devient
  **`['cible du jour', …]`** sur `useDayCalorieTarget` (`{ socle: null, isLoading: true }`) : après la
  correction, le chargement du résumé n'est plus relayé par `useLabComposer`.
- Ajouté : **« ni une cible au maintien ni une surcharge ne déplacent le socle »**, en deux cas, avec une
  **sèche** posée (`nutritionProfile.objective: 'cut'` — sinon l'objectif retombe sur `maintain`, delta 0,
  et le cas « pause » serait vert avant la correction) et `useDayCalorieTarget` à `socle: 2759` :
  pause → `useNutritionSummary` rend 2 759 (3 159 avant la correction) ; surcharge → il rend 2 000
  (2 400 avant). Attendu : 2 759 dans les deux cas. Rouges avant l'étape 2.
- `useLabHistory` garde son mock de `useNutritionSummary` (CIBLE-05 hors périmètre).

## Étape 2 — la correction

`apps/mobile/src/data/repositories/lab-repository.ts`, `useLabComposer` seulement :

- import de `useDayCalorieTarget` depuis `./dashboard-repository` ;
- `const { target, isLoading: summaryLoading } = useNutritionSummary();` →
  `const { socle, isLoading: targetLoading } = useDayCalorieTarget(todayKey);` (`todayKey` est déjà lu en
  tête du hook) ;
- `tdeeKcal: socle`, avec un commentaire court : le socle de la cible du jour (NORYN-02), ni pause ni
  surcharge — la cible, elle, en dépend (CIBLE-04) ; le commentaire faux « l'écran le dit » disparaît
  (DD4) ;
- `isLoading` : `summaryLoading` → `targetLoading` (DD3) ;
- `objectiveCalorieDelta` sort des imports s'il n'a plus d'appelant dans le fichier (c'est le cas).

`useLabHistory`, `useLabWeek`, `useLabCore` : **intouchés**.

## Étape 3 — les libellés (D3-A)

`lab.composer.kcal` et `council.voice.nutritionTarget`, FR et EN, valeurs du §8 de la spec. Aucune clé
ajoutée ni retirée ; interpolations `{{kcal}}` / `{{tdee}}` inchangées. Vérifier qu'aucun test ne compare
ces valeurs (`CouncilSheet.test.tsx` simule `react-i18next` et lit des clés).

## Étape 4 — docs

- Spec : `etape: close` dans le commit qui livre le code complet ; bandeau d'en-tête (codée le …, rouge
  constaté, chiffres affirmés par `lab-composer-socle.test.tsx`).
- Roadmap : remarque courte sur **7.30** et **7.34** (le socle du Composer et du Conseil vient de la
  composition, CIBLE-04) et une entrée au journal des réconciliations. Statuts déjà ✅ : **aucun compteur
  du Récapitulatif ne bouge**.
- BACKLOG : la ligne CIBLE-04 est retirée dès l'entrée dans le pipeline (fait au cadrage). Constats du §12
  de la spec : ajoutés si Florian le demande à la validation.
- CHANGELOG (entrée par commit), ETAT régénéré (`node scripts/etat.mjs`).
- Preuve Noryn : `git diff --stat origin/dev -- packages/shared supabase` **vide**.

## Ce que le plan ne fait pas

- Ne touche ni `composeDayCalorieTarget` ni rien dans `packages/shared` (redéploiement Noryn évité).
- Ne touche ni `useLabHistory` ni l'enquête « déficit » (CIBLE-05), ni le contexte du Labo IA (CIBLE-06).
- Ne touche aucun écran Muscu, Nutrition, Course, ni Prisme ; ni `LabComposerPanel.tsx` ni
  `CouncilSheet.tsx` (seules leurs traductions bougent, si D3-A).
- Ne crée ni section RECETTES ni script SQL de recette.

## Exécution (23/10/2026)

Suivi tel quel, **en un seul commit** (le plan en prévoyait un par étape, chacun vert : le lot tenait en
une vingtaine de lignes de code, le rouge de l'étape 1 a été constaté avant la correction et noté au
CHANGELOG). Rouge constaté : 13 tests — S1, S2, S3, S5 (socle et projections) dans
`lab-composer-socle.test.tsx`, et les cinq tests de câblage neufs ou adaptés de `lab-sql.test.tsx` ; vert
sur S0, S4 et le profil incomplet. Après la correction : 79/79 sur les deux fichiers. La règle « recette à
la demande » (23/10/2026) s'applique : `etape: close`, aucune section RECETTES.
