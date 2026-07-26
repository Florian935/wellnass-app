---
id: NUTR-10
titre: "Adhérence à l'objectif calorique"
roadmap: []
catalogue: [NUTR-10]
etape: close
branche: feature/nutr10-adherence-objectif
maj: 16/07/2026
---
# US NUTR-10 — Adhérence à l'objectif calorique

_Spec fonctionnelle. Statut : en validation (brainstorming Florian, 16/07/2026). Branche :
`feature/nutr10-adherence-objectif` (depuis `dev`). Analyse **NUTR-10** du
[catalogue](../../product/analyses-donnees.md), Phase A._

## 1. Contexte & objectif

L'écran **Stats nutrition** montre déjà les **apports moyens** 7 j / 30 j (NUTR-05) et le delta vs
période précédente (META-06). Il manque une lecture de **régularité qualitative** : sur la fenêtre,
**combien de jours l'utilisateur est resté proche de son objectif** calorique. NUTR-10 ajoute une carte
**« Adhérence à l'objectif »** : la part (et le nombre) de **jours loggés** dont les calories tombent
dans une **fourchette** autour de l'**objectif effectif du jour**.

Objectif : répondre à « sur les 7 (ou 30) derniers jours renseignés, combien de fois ai-je tenu ma
cible ? » — un indicateur de constance, complémentaire de la moyenne (qui masque les compensations).

## 2. Décisions de cadrage (Florian, 16/07/2026)
- **Fourchette « dans la cible »** : `|kcal du jour − objectif effectif| ≤ objectif × marge%`.
- **Marge configurable** en **pourcentage**, **défaut 10 %**, **synchronisée** (colonne
  `nutrition_profiles`, migration cloud).
- **Dénominateur = jours loggés seulement** (jours vides exclus, comme les apports moyens NUTR-05).
- **Objectif de référence = objectif effectif du jour** (base + bonus jour d'entraînement, mode
  Forfait/Auto de RN-01) — pas l'objectif de base.

## 3. Périmètre

- **Inclus** :
  - Migration : colonne `nutrition_profiles.adherence_margin_pct` (défaut 10). **Pas de sync rule à
    redéployer** (la règle est `select * from nutrition_profiles` → la colonne descend au client).
  - Schéma `@wellness/shared` du profil nutritionnel étendu (row + input + type) : champ marge.
  - Logique pure `computeGoalAdherence(perDay, marginPct)` (testée).
  - Hook `useGoalAdherence(windowDays)` : compose totaux jours loggés + objectif effectif **par jour**
    (réutilise les briques pures de RN-01) + marge du profil.
  - Carte **« Adhérence à l'objectif »** dans [nutrition-stats.tsx](../../../apps/mobile/src/app/nutrition-stats.tsx)
    (section apports, réutilise le sélecteur 7 j / 30 j existant).
  - **Réglage de la marge** dans [nutrition-profile.tsx](../../../apps/mobile/src/app/nutrition-profile.tsx)
    (sélecteur 5 / 10 / 15 %).
  - i18n FR + EN (parité).
- **Exclu (YAGNI)** :
  - Adhérence **macros** (P/G/L) — calorique seulement pour cette US.
  - Fourchette **asymétrique** (sous/au-dessus traités différemment) — fourchette symétrique ±marge.
  - Historique/courbe d'adhérence dans le temps — une valeur par fenêtre (7/30 j).
  - Régularité de saisie (jours renseignés / calendaires) = **NUTR-17**, US séparée.
- **Maquette** : écartée (carte + sélecteur alignés sur l'existant de Stats nutrition ; réglage =
  `Segment` comme ailleurs). À confirmer à la validation.

## 4. Modèle de données

### 4.1 Migration `nutrition_profiles.adherence_margin_pct`
`alter table public.nutrition_profiles add column if not exists adherence_margin_pct integer not null
default 10 check (adherence_margin_pct between 1 and 50);` (même patron que
`training_bonus_mode`, migration `20260715152227`).
- **Défaut 10** → comportement immédiat sans réglage.
- Plage `1..50` (garde-fou : une marge de 0 % rendrait l'adhérence quasi toujours fausse ; > 50 %
  n'aurait pas de sens).
- **Sync rule inchangée** (`select *`). `db:types` à régénérer. Checkpoint 🔴 (migration cloud).

### 4.2 Schéma client PowerSync (⚠️ étape critique — ne pas oublier)
`apps/mobile/src/powersync/schema.ts` déclare **chaque colonne explicitement** : PowerSync n'expose en
SQLite local **que** les colonnes déclarées. Une colonne synchronisée mais **non déclarée** est
téléchargée puis **ignorée** (le `select *` du repo ne la voit pas, l'upsert ne la persiste pas → le
réglage n'aurait **aucun effet**). **Ajouter `adherence_margin_pct: column.integer`** au `Table
nutrition_profiles` (comme RN-02 l'a fait pour `training_bonus_mode`).

### 4.3 Schéma partagé + repository
- `@wellness/shared` `nutrition.ts` : ajouter `adherenceMarginPct` (entier, défaut 10, borné 1..50) au
  `nutritionProfileRowSchema` **et** au type/`Input` d'écriture (`NutritionProfileInput`).
- `nutrition-repository.ts` — mapping **manuel colonne par colonne**, 4 points à toucher :
  1. type `NutritionDbRow` (colonne `adherence_margin_pct`) ;
  2. `rowToNutritionProfile` (`adherenceMarginPct: row.adherence_margin_pct ?? 10`) ;
  3. `inputToColumns` (écriture `adherence_margin_pct`) ;
  4. le `Pick` de `NutritionProfileInput`.
- Écriture via **`upsertNutritionProfile(patch)`** (nom réel ; accepte un patch partiel).

## 5. Calcul (logique)

### 5.1 Objectif effectif par jour (réutilisation RN-01)
Pour chaque jour **loggé** de la fenêtre :
`effectiveTarget(day) = trainingDayCalories(targetBase, dayCalorieBonus({ mode, isTrainingDay(day),
fixedBonus, runCaloriesToday(day) }))`, où :
- `targetBase` : objectif de base (TDEE + objectif + override manuel), **indépendant du jour** (calculé
  une fois, même logique que `useDayCalorieTarget`).
- `isTrainingDay(day)` : séance muscu **ou** course **terminée** ce jour (rétroactif ; pour un jour
  passé `computeIsTrainingDay` se réduit à `retroactiveDone`).
- `runCaloriesToday(day)` : Σ `estimateRunCalories` des courses terminées ce jour (si running actif).
- Briques toutes **pures** (`dayCalorieBonus`, `trainingDayCalories`, `estimateRunCalories`) et données
  (`workouts`/`runs`) **déjà en mémoire** → calcul en mémoire, **aucun surcoût réseau**, mode Auto inclus.
- **Extraire un helper pur** `computeEffectiveTargetForDay({ targetBase, mode, fixedBonus,
  isTrainingDay, runCaloriesToday })` dans `@wellness/shared` (compose `dayCalorieBonus` +
  `trainingDayCalories`) → **testable** en Vitest (au lieu de laisser la composition dans le hook).
- ⚠️ **Simplification assumée (jour courant)** : pour un **jour passé**, `isTrainingDay(day) =
  retroactiveDone` (séance/course terminée). Pour **aujourd'hui**, on **n'anticipe pas** le bonus d'une
  séance *planifiée mais non faite* (le batch n'appelle pas `useHasPlannedSession`). Conséquence : sur le
  seul cas « aujourd'hui + séance planifiée non encore faite + repas déjà loggés », l'objectif effectif
  du jour utilisé ici peut différer de celui du dashboard (qui anticipe). Cas marginal, **assumé** pour
  garder le calcul batch pur ; l'adhérence porte de toute façon surtout sur des jours écoulés.

### 5.2 `computeGoalAdherence` (fonction pure, testée)
Entrée : `perDay: { kcal: number; effectiveTarget: number | null }[]` (jours **loggés**) + `marginPct`.
- Ignore les jours dont `effectiveTarget` est `null` (profil incomplet) → non comptés.
- Un jour est **dans la cible** si `Math.abs(kcal − effectiveTarget) ≤ effectiveTarget × marginPct/100`.
- Sortie : `{ loggedDays, daysInTarget, pct }` où `loggedDays` = jours avec `effectiveTarget` non nul,
  `pct = loggedDays > 0 ? round(daysInTarget / loggedDays × 100) : 0`.

### 5.3 Hook `useGoalAdherence(windowDays)` — dans `dashboard-repository.ts`
**Emplacement : `dashboard-repository.ts`** (couche de composition — y vivent déjà `useDayCalorieTarget`
et `useDeficitVolumeAlert`, et **tous** les hooks nécessaires y sont déjà importés). Le mettre dans
`nutrition-repository` forcerait un import des repos workout/run (couplage/cycle nouveau) → à éviter.
Compose : `useDailyTotals(daysAgo(windowDays))` (jours loggés) ; objectif base + mode + `fixedBonus` +
`adherenceMarginPct` (`useNutritionProfile`/`useProfile`/`useLatestWeight`/`useSettings`) ;
`useWorkoutHistory` + `useRunHistory` (jours d'entraînement + dépense course par jour). Construit
`perDay` (§5.1, via `computeEffectiveTargetForDay`) puis délègue à `computeGoalAdherence`. Hooks
inconditionnels. Renvoie `{ loggedDays, daysInTarget, pct, marginPct, isLoading }`.

## 6. UI

### 6.1 Carte « Adhérence à l'objectif » (Stats nutrition)
- Placée dans la **section apports**, **sous** la même bascule 7 j / 30 j (`intakeRange` existant) — un
  seul sélecteur pilote apports moyens + adhérence.
- Affiche : **`pct %`** en valeur forte + **« N / M jours dans la cible »** (M = jours loggés) + mention
  discrète de la marge (« ±10 % de l'objectif »).
- **États** : profil incomplet (objectif `null`) → message « Définis ton objectif » (lien profil) ;
  **aucun jour loggé** sur la fenêtre → état vide (« Aucun jour renseigné »).
- Pas de graphique (principe 2.10 : pas de chart vide).

### 6.2 Réglage de la marge (profil nutritionnel)
- Dans [nutrition-profile.tsx](../../../apps/mobile/src/app/nutrition-profile.tsx), un `Segment`
  **5 % / 10 % / 15 %** → `upsertNutritionProfile({ adherenceMarginPct })`. ⚠️ `Segment` opère sur des
  options **string** (cf. mode bonus) → options `['5','10','15']` + `parseInt` à l'écriture, libellés
  « 5 % / 10 % / 15 % ».
- Effet immédiat sur la carte (réactif). Persisté + synchronisé (PowerSync).

## 7. i18n (FR + EN, parité)
Namespace `stats.adherence.*` : `title` (« Adhérence à l'objectif » / « Goal adherence ») ;
**`inTarget_one` / `inTarget_other`** (patron pluriel i18next comme `home.runningWeek.sessions_*` :
`count` pilote le pluriel, `total` est un paramètre — « {{count}} / {{total}} jour dans la cible » /
« …jours… ») ; `margin` (« ±{{pct}} % de l'objectif ») ; `empty` (« Aucun jour renseigné ») ;
`noTarget` (« Définis ton objectif calorique »). Réglage : `nutrition.adherenceMargin` (« Marge
d'adhérence »). Parité FR/EN vérifiée (0 clé orpheline ; double accolade i18next).

## 8. Cas limites
- **Profil incomplet** (objectif base `null`) → carte en état « définis ton objectif », pct non calculé.
- **Aucun jour loggé** sur la fenêtre → « Aucun jour renseigné », pas de division par zéro.
- **Jour d'entraînement** → comparé à l'objectif **effectif** (base + bonus), pas à la base.
- **Mode Auto sans course** un jour de séance → repli forfait (déjà géré par `dayCalorieBonus`).
- **Marge** : bornée 1..50 par la contrainte SQL ; le `Segment` n'expose que 5/10/15.
- **Offline** : tout en local (hooks `useQuery`), réactif ; la marge se synchronise ensuite.
- **Changement de fenêtre 7 j ↔ 30 j** → recalcul immédiat (même `intakeRange`).

## 9. Tests
- **Shared (Vitest)** : `computeGoalAdherence` (dans/hors cible, marge, jours `effectiveTarget` null
  ignorés, 0 jour loggé → pct 0, arrondi) + `computeEffectiveTargetForDay` (base seule hors séance,
  base+forfait jour de séance, base+dépense course mode auto) + schéma profil (défaut 10, borne). 
- **Mobile** : `typecheck` + `lint` verts ; rendu vérifié en recette.

## 10. Definition of Done
- Migration `adherence_margin_pct` appliquée cloud + `db:types` (checkpoint 🔴, pas de sync rule) ;
  **colonne déclarée dans `powersync/schema.ts`** ; schéma shared + repository (4 points) étendus.
- `computeGoalAdherence` (testée) + `useGoalAdherence` (objectif effectif par jour) ; carte Adhérence
  dans Stats nutrition (7 j/30 j) ; réglage marge (5/10/15 %) dans le profil ; i18n FR/EN.
- typecheck/lint/tests verts. **100 % client hormis la migration.**
- Catalogue NUTR-10 → ✅. Reste : recette device + relecture Damien.
