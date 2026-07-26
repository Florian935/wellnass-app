---
id: MUSC-F10c1
titre: "Muscles secondaires sur la fiche exercice"
roadmap: [3.19]
catalogue: []
etape: close
branche: feature/muscf10c1-muscles-secondaires
maj: 22/07/2026
---
# US MUSC-F10c-1 — Muscles secondaires sur la fiche exercice

> **Premier des 2 incréments** de F10c (= MUSC-F2) : **F10c-1 (muscles secondaires)** →
> F10c-2 (variantes / alternatives, plus tard). Cadrage validé Florian (brainstorming, 22/07/2026 —
> design présenté et approuvé « Ok ça me va »). Branche : `feature/muscf10c1-muscles-secondaires`.
> **Statut : à valider (pas de code avant validation).** **Une migration** (ajout d'une colonne).

## 0. Contexte

La fiche exercice ([app/exercises/[id].tsx](../../../../apps/mobile/src/app/exercises/%5Bid%5D.tsx),
livrée F10a → enrichie records F10b) affiche aujourd'hui : nom, **groupe musculaire (primaire)**,
matériel, instructions, favori, section « Tes records ». Un exercice ne porte qu'**un seul** muscle
(`exercises.muscle_primary`, `MUSCLE_GROUPS` — chest/back/legs/shoulders/arms/core).

En réalité, la plupart des mouvements sollicitent des **muscles secondaires** (ex. le développé
couché → primaire *chest*, secondaires *arms* + *shoulders*). Les afficher **enrichit la fiche**
sans changer le classement principal de l'exercice.

Décisions de cadrage (brainstorming Florian, 22/07/2026) :
- Ajouter aux exercices une **liste de muscles secondaires** (0..N groupes musculaires).
- **Saisie éditoriale seule** : renseignée depuis le back-office admin ([apps/admin](../../../../apps/admin))
  sur les exercices de la bibliothèque. Les exercices **personnalisés** (mobile) n'exposent pas
  cette saisie ; ils valent **liste vide** par défaut.
- **Affichage** sur la fiche mobile (mode lecture) : une ligne « Muscles secondaires » listant les
  noms résolus (réutilise les libellés `muscle.*`), **uniquement si la liste est non vide**.
- **Filtre MUSC-F3 inchangé** : le filtre par groupe musculaire continue de matcher le **muscle
  primaire seul** (décision Florian : « filtre sur muscle primaire seul »).

## 1. Périmètre à livrer

- **Migration** : nouvelle colonne `exercises.muscles_secondary jsonb not null default '[]'`
  (tableau de groupes musculaires canoniques). Aucune autre table, aucun changement de sync rule
  (la table `exercises` est **déjà** dans la publication PowerSync).
- **PowerSync** : `muscles_secondary: column.text` sur la table `exercises` (schéma local SQLite).
- **Partagé (`packages/shared`)** : `exerciseRowSchema` étendu avec `musclesSecondary` (tableau de
  `muscleGroupSchema`, défaut `[]`) ; validation/normalisation testée (Vitest).
- **Admin** : dans `ExerciseEditScreen`, un **multi-sélecteur** « Muscles secondaires » (cases à
  cocher / chips sur `MUSCLE_GROUPS`, **excluant le muscle primaire** sélectionné) ; lecture +
  écriture de `muscles_secondary` via `apps/admin/src/data/exercises.ts`.
- **Mobile — fiche** : `useExercise`/`ExerciseDetail` exposent `musclesSecondary` ; la fiche affiche
  la ligne « Muscles secondaires » (mode lecture) quand la liste est non vide.
- **i18n** FR/EN (parité) ; réutilise `muscle.*` ; nouvelle clé de libellé de section.

**Hors périmètre :**
- **Variantes / alternatives** → **F10c-2** (table de liaison, saisie admin, liens sur la fiche).
- **Filtre** sur les muscles secondaires (MUSC-F3 reste primaire seul).
- **Édition mobile** des muscles secondaires (exercices persos) — non prévue ; défaut `[]`.
- **Schéma corporel / silhouette** (visualisation graphique des muscles) → hors périmètre
  (MUSC-F1b / roadmap 6.2, séparé).
- Migration de données rétroactive : les exercices existants restent à `[]` jusqu'à édition admin.

## 2. Comportement attendu

### 2.1 Fiche mobile (mode lecture)
- Sous le champ **« Groupe musculaire »** (le primaire, inchangé), une ligne **« Muscles
  secondaires »** listant les noms résolus (`muscle.*`), séparés par **« · »**, dans l'ordre de la
  liste stockée.
- La ligne n'apparaît **pas** si `musclesSecondary` est vide (aucun libellé vide, aucun placeholder).
- La ligne n'apparaît **pas** en mode édition (formulaire d'un exo perso, F10a) — cohérent avec les
  autres champs de lecture.

### 2.2 Admin (`ExerciseEditScreen`)
- Nouveau bloc « Muscles secondaires » : un choix multiple sur `MUSCLE_GROUPS`, présentant les
  libellés FR (`fr.exercises.groupNames`), **excluant** le muscle primaire actuellement sélectionné.
- Si le muscle primaire change et qu'il figurait dans les secondaires sélectionnés, il est **retiré**
  automatiquement de la sélection secondaire (invariant : primaire ∉ secondaires).
- À l'enregistrement (`saveExercise`), la sélection est écrite dans `muscles_secondary` (tableau).
- À l'édition, `getExercise` lit `muscles_secondary` et pré-remplit la sélection.

### 2.3 États
- Exercice **sans** muscle secondaire (défaut, ou tous décochés) → colonne `[]` ; **pas de ligne**
  sur la fiche.
- Exercice **personnalisé** (mobile) → toujours `[]` (pas de saisie) ; **pas de ligne**.

## 3. Règles métier

- **Valeurs autorisées** : uniquement des membres de `MUSCLE_GROUPS`. Tableau **dédupliqué**,
  **excluant** le `muscle_primary` de l'exercice. Ordre non significatif (affichage = ordre stocké).
- **Défaut** : `[]` (colonne `not null default '[]'`) — jamais `null`, jamais de valeur factice.
- **Sérialisation** :
  - **Écriture admin** (`supabase-js`) : tableau JS → colonne `jsonb` native (pas de
    double-encodage ; l'admin écrit dans le cloud, la RLS `is_admin()` est la frontière).
  - **Lecture mobile** (PowerSync SQLite, `column.text`) : chaîne JSON → parsée via
    **`parseJsonColumn`** ([packages/shared/src/json-column.ts](../../../../packages/shared/src/json-column.ts))
    avec un garde de forme (`isValid` → tableau de `MuscleGroup` valides), repli `[]`. Robuste au
    simple/double encodage et aux lignes corrompues (cf. `active_pillars`).
- **Filtre MUSC-F3** : **inchangé** — matche le `muscle_primary` seul. `muscles_secondary` n'entre
  pas dans `buildExerciseFilterClause`.
- **Offline-first** : lecture mobile via requête locale PowerSync réactive ; aucune écriture mobile ;
  aucune dépendance réseau à l'affichage.
- **i18n** : les noms de muscles réutilisent les clés `muscle.*` (mobile) / `groupNames` (admin) ;
  aucune chaîne en dur.

## 4. Architecture & données

### 4.1 Migration (checkpoint cloud, faible risque)
- `npm run db:new muscf10c1_exercises_muscles_secondary` → SQL :
  `alter table public.exercises add column muscles_secondary jsonb not null default '[]'::jsonb;`
- **Pas** de changement de publication PowerSync (`exercises` déjà répliquée) ; ajout de colonne
  additif, rétrocompatible (les lignes existantes prennent `[]`).
- `npm run db:push` (après feu vert Florian — base cloud partagée), puis `npm run db:types`, puis
  cocher dans [supabase/MIGRATIONS.md](../../../../supabase/MIGRATIONS.md).

### 4.2 PowerSync (`apps/mobile/src/powersync/schema.ts`)
- Ajouter `muscles_secondary: column.text` à la table `exercises`.

### 4.3 Partagé (`packages/shared/src/exercise.ts`)
- Étendre `exerciseRowSchema` : `musclesSecondary: z.array(muscleGroupSchema).default([])`.
- **Fonction pure** de normalisation testable — `normalizeSecondaryMuscles(input, primary)` :
  entrée `unknown` (ou `MuscleGroup[]`) + le primaire → sortie `MuscleGroup[]` **dédupliquée**,
  **filtrée** aux valeurs valides et **privée** du primaire. Utilisée côté admin (avant écriture) et
  utilisable comme garde de forme à la lecture. Tests Vitest : valeurs valides, doublons, primaire
  présent, valeurs inconnues, entrée non-tableau → `[]`.

### 4.4 Admin (`apps/admin`)
- `data/exercises.ts` :
  - `AdminExerciseRow`/`ExerciseDetail`/`ExerciseInput` : ajouter `musclesSecondary: MuscleGroup[]`.
  - `getExercise` : sélectionner `muscles_secondary`, le mapper (via `normalizeSecondaryMuscles`).
  - `saveExercise` : écrire `muscles_secondary` dans l'upsert `exercises`
    (`normalizeSecondaryMuscles(input.musclesSecondary, input.musclePrimary)`).
- `ExerciseEditScreen.tsx` :
  - État `musclesSecondary: MuscleGroup[]` ; pré-rempli au `load`.
  - Bloc de cases à cocher sur `MUSCLE_GROUPS` **hors** `musclePrimary` ; libellés `groupNames`.
  - Au changement de `musclePrimary`, retirer ce muscle de `musclesSecondary`.
  - Transmis à `saveExercise`.
  - Libellé FR de section : `fr.exercises.secondaryMusclesLabel`.

### 4.5 Mobile (`apps/mobile`)
- `data/repositories/exercise-repository.ts` :
  - **Détail seulement** : ajouter `muscles_secondary: string | null` à `ExerciseDetailDbRow`
    uniquement (via `ExerciseDetailDbRow = ExerciseListDbRow & { … }`) et sélectionner
    `e.muscles_secondary` dans **`SELECT_EXERCISE_DETAIL` seulement**. `ExerciseListItem`,
    `ExerciseListDbRow` et `SELECT_EXERCISES` restent **inchangés** (la liste n'a pas besoin des
    secondaires).
  - `ExerciseDetail` : ajouter `musclesSecondary: MuscleGroup[]` (parse via `parseJsonColumn` +
    garde `normalizeSecondaryMuscles` avec le `muscle` primaire de la ligne).
- `app/exercises/[id].tsx` : en mode lecture, sous le champ « Groupe musculaire », afficher la ligne
  « Muscles secondaires » si `exercise.musclesSecondary.length > 0` :
  libellé `t('exercises.detail.secondaryMuscles')`, valeur = `musclesSecondary.map(m => t('muscle.'+m)).join(' · ')`.

### 4.6 i18n
- **Mobile** : nouvelle clé `exercises.detail.secondaryMuscles` (FR « Muscles secondaires » / EN
  « Secondary muscles »). Réutilise `muscle.*` pour les noms.
- **Admin** : `fr.exercises.secondaryMusclesLabel` (« Muscles secondaires »). Réutilise `groupNames`.

## 5. Tests
- **Shared (Vitest)** : `normalizeSecondaryMuscles` — dédup, exclusion du primaire, filtrage des
  valeurs inconnues, entrée non-tableau → `[]` ; `exerciseRowSchema` accepte `musclesSecondary`
  (défaut `[]`, valeurs valides).
- **Non-régression** : la fiche F10a/F10b reste inchangée quand `musclesSecondary` est vide (pas de
  ligne) ; le filtre MUSC-F3 (primaire) inchangé. Smoke : fiche avec secondaires non vides → ligne
  présente et libellés résolus.
- **UI admin** : vérifier (test ou recette) le retrait automatique du primaire de la sélection
  secondaire au changement de muscle primaire (invariant côté `ExerciseEditScreen`).

## 6. Definition of Done
- [ ] Spec + plan + (design validé au brainstorming) — pas de code avant validation.
- [ ] Migration `muscles_secondary` créée, poussée sur le cloud (feu vert Florian) et cochée dans
      MIGRATIONS.md ; `db:types` régénérés.
- [ ] `column.text` ajouté au schéma PowerSync ; `exerciseRowSchema` étendu.
- [ ] `normalizeSecondaryMuscles` pure + testée ; invariant primaire ∉ secondaires garanti.
- [ ] Admin : multi-sélecteur « Muscles secondaires » (hors primaire), lu/écrit ; retrait auto du
      primaire ; libellés FR.
- [ ] Mobile : ligne « Muscles secondaires » sur la fiche (mode lecture), affichée seulement si non
      vide ; libellés résolus `muscle.*`.
- [ ] i18n FR/EN (parité) ; aucune chaîne en dur ; **filtre MUSC-F3 inchangé**.
- [ ] typecheck / lint / tests verts ; PR relue par les deux devs.

## 7. Explicitement différé
- **F10c-2 (= reste de MUSC-F2)** : variantes / alternatives (table de liaison + saisie admin +
  liens sur la fiche).
- **Filtre** par muscle secondaire (MUSC-F3 reste primaire seul).
- **Édition mobile** des muscles secondaires pour les exercices personnalisés.
- **Schéma corporel** / silhouette anatomique (MUSC-F1b / roadmap 6.2).
