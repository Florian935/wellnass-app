# US MUSC-F12 — Cohérence de la fiche exercice (perso ↔ bibliothèque)

> Retour recette F10c (Florian, 23/07/2026, [IDEAS.md](../../../../IDEAS.md)). Fait suite à MUSC-F11
> (modale de **création**). Branche : `feature/muscf12-coherence-fiche-exo-perso`. **Aucune migration.**
> **Statut : à valider (pas de code avant validation).**

## 0. Contexte

En recette, la **fiche d'un exercice perso** paraît incohérente avec celle d'un exo **bibliothèque** :
- *Volontaire* : seuls les exos perso portent **Modifier / Supprimer** (on n'édite pas un exo éditorial).
- *Subi* : le formulaire d'édition d'un exo perso ne gère que **nom / groupe / matériel** — **pas** les
  **instructions** ni les **muscles secondaires**. Comme la fiche masque les sections vides, un exo perso
  apparaît « plus pauvre » → sensation d'incohérence.

Décisions de cadrage (brainstorming Florian, 23/07/2026) :
- **Refermer l'écart** en rendant **instructions + muscles secondaires** éditables sur un exo perso.
- Passer l'**édition** d'un exo perso dans une **modale bottom-sheet** (cohérente avec la création,
  MUSC-F11) — on retire le formulaire d'édition **inline** de la fiche.
- La **création** reste **minimale** (nom + groupe, MUSC-F11) ; la richesse se fait à l'édition.

## 1. Périmètre à livrer

- **`updateCustomExercise` étendu** : gère `name`, `muscle`, `equipment`, **`musclesSecondary`**,
  **`instructions`** (atomique, garde propriétaire inchangée).
- Nouveau composant **`EditExerciseModal`** (bottom-sheet, patron `CreateExerciseModal`) : nom, groupe
  (`Segment scrollable`), matériel (`Segment scrollable` + « aucun »), **muscles secondaires** (chips
  multi, hors primaire), **instructions** (champ multiligne). Pré-rempli depuis l'exercice.
- **Fiche `[id].tsx`** : le bouton **Modifier** ouvre la modale (au lieu du formulaire inline) ;
  suppression de tout l'état/JSX d'édition inline (`isEditing`, `onSave`, champs `edit*`).
- **i18n** FR/EN ; offline-first ; **aucune chaîne en dur**.

**Hors périmètre :**
- Enrichir la **création** (reste nom + groupe — MUSC-F11).
- Édition des exos **éditoriaux** depuis le mobile (réservée à l'admin).
- Refonte visuelle de la fiche au-delà du retrait du formulaire inline (les sections restent masquées
  si vides — comportement déjà **cohérent** entre perso et biblio une fois les données saisissables).

## 2. Comportement attendu

### 2.1 Ouverture de l'édition
- Sur la fiche d'un exo **perso**, **Modifier** ouvre **`EditExerciseModal`** (bottom-sheet), pré-remplie
  avec les valeurs actuelles (nom, groupe, matériel, muscles secondaires, instructions).
- Les exos **bibliothèque** n'ont **pas** de bouton Modifier (inchangé).

### 2.2 Champs de la modale
- **Nom** (requis, trim non vide) — `TextField`.
- **Groupe musculaire** — `Segment scrollable` (`MUSCLE_GROUPS`).
- **Matériel** — `Segment scrollable` avec sentinelle « aucun » (= `null`) puis `EQUIPMENTS` (comme
  l'actuel formulaire inline).
- **Muscles secondaires** — **chips multi-sélection** sur `MUSCLE_GROUPS` **excluant le groupe primaire**
  courant ; au changement de primaire, retirer ce muscle de la sélection secondaire (invariant primaire ∉
  secondaires).
- **Instructions** — `TextField` **multiligne** (optionnel).

### 2.3 Enregistrement / annulation
- **Enregistrer** (désactivé si nom vide) → `updateCustomExercise(id, { name, muscle, equipment,
  musclesSecondary, instructions })` → ferme la modale ; la fiche reflète les changements (réactif).
- **Annuler** / backdrop / retour Android → ferme **sans** enregistrer.
- Erreur d'écriture (improbable, offline-first) → modale reste ouverte, log ; pas de fermeture silencieuse.

### 2.4 Fiche après édition
- La fiche (mode lecture) affiche désormais **muscles secondaires** et **instructions** de l'exo perso
  s'ils sont renseignés — **mêmes sections, même ordre** qu'un exo bibliothèque (cohérence atteinte).
- Section masquée si vide (inchangé, et identique biblio/perso).

## 3. Règles métier

- **Garde de portée** : édition réservée à un exo `source = 'custom'` appartenant à l'utilisateur
  (`assertOwnedCustomExercise`, inchangé). La RLS autorise déjà le `update` par le propriétaire.
- **Muscles secondaires** : normalisés via `normalizeSecondaryMuscles(input, primary)` (dédup, exclusion
  du primaire, valeurs valides) ; stockés en **JSON** dans `exercises.muscles_secondary`
  (`JSON.stringify`, comme `active_pillars`).
- **Instructions** : écrites sur l'**unique** ligne de traduction de l'exo perso (`exercise_translations`),
  champ `instructions` (`null` si vide après trim).
- **Atomicité** : `updateCustomExercise` reste une **`writeTransaction`** (ligne `exercises` +
  traduction).
- **Offline-first** : écriture locale PowerSync (UUID/timestamps déjà gérés) ; lecture réactive.
- **i18n** : libellés via `t()` ; parité FR/EN.

## 4. Architecture & données

### 4.1 Aucune migration
Colonne `muscles_secondary` déjà présente (F10c-1) ; RLS `exercises_update` autorise déjà
`owner_id = auth.uid()` (US 8.2). Aucune sync rule à toucher.

### 4.2 Repository (`apps/mobile/src/data/repositories/exercise-repository.ts`)
- Étendre la signature :
  `updateCustomExercise(id, { name, muscle, equipment, musclesSecondary: MuscleGroup[], instructions: string | null })`.
- Dans la `writeTransaction` :
  - `UPDATE exercises SET muscle_primary = ?, equipment = ?, muscles_secondary = ?, updated_at = ? WHERE id = ?`
    avec `muscles_secondary = JSON.stringify(normalizeSecondaryMuscles(input.musclesSecondary, input.muscle))`.
  - `UPDATE exercise_translations SET name = ?, instructions = ?, updated_at = ? WHERE id = ?`
    avec `instructions = input.instructions?.trim() ? input.instructions.trim() : null`.
- Importer `normalizeSecondaryMuscles` depuis `@wellness/shared`.
- ⚠️ **Tous les appelants** de `updateCustomExercise` doivent fournir les nouveaux champs (aujourd'hui :
  la fiche `[id].tsx`). Recenser au plan (grep) — a priori un seul appelant.

### 4.3 Nouveau composant `apps/mobile/src/components/exercises/EditExerciseModal.tsx`
- Props : `{ visible: boolean; onClose: () => void; exercise: ExerciseDetail }` (valeurs initiales). État
  de formulaire interne, initialisé à l'ouverture depuis `exercise` (réinitialiser quand `exercise.id`
  change ou à chaque ouverture).
- Structure bottom-sheet identique à `CreateExerciseModal` (`Modal` + backdrop + `KeyboardAvoidingView` +
  sheet + `ScrollView`).
- Champs (cf. §2.2). Pour les **muscles secondaires**, chips toggle (patron `ExerciseFilterDrawer`), en
  excluant le groupe primaire courant.
- `Enregistrer` → `updateCustomExercise(exercise.id, {...})` → `onClose()`. `disabled` si nom vide.
  ⚠️ Libellé du bouton = `exercises.detail.save` (« Enregistrer »), **pas** `exercises.add` (« Ajouter »)
  du patron création. `ExerciseDetail.equipment` est typé `string | null` → caster en `Equipment | null`
  pour pré-remplir le `Segment` matériel (comme la fiche actuelle, `as Equipment | null`).
- **Mutualisation** : possibilité d'extraire un wrapper `BottomSheet` commun avec `CreateExerciseModal`
  (à trancher au plan ; sinon duplication assumée du shell, dette mineure notée).

### 4.4 Fiche (`apps/mobile/src/app/exercises/[id].tsx`)
- Retirer : `isEditing`, `isSaving`, `editName`, `editMuscle`, `editEquipment`, `onStartEdit`, `onSave`,
  et tout le bloc JSX du formulaire inline (`isEditing ? <form> : <read>`).
- Le mode lecture devient l'unique rendu ; le bouton **Modifier** fait `setEditOpen(true)`.
- Monter `<EditExerciseModal visible={editOpen} onClose={() => setEditOpen(false)} exercise={exercise} />`.
- La fiche lit déjà `exercise.musclesSecondary` (F10c-1) et `exercise.instructions` — l'affichage se met
  à jour automatiquement (réactif) après édition.

### 4.5 i18n
- Réutilise : `exercises.detail.editTitle` (« Modifier l'exercice », existe), `exercises.detail.muscle`,
  `exercises.detail.equipment`, `exercises.detail.equipmentNone`, `exercises.detail.instructions`,
  `exercises.detail.secondaryMuscles` (existe, F10c-1), `exercises.customName`, `exercises.detail.save`,
  `common.cancel`.
- **Nouvelles clés éventuelles** (à confirmer au plan) : placeholder instructions
  (`exercises.detail.instructionsPlaceholder`) — sinon aucun ajout i18n.

## 5. Tests
- **Mobile** : `updateCustomExercise` étendu — vérifier (test ciblé ou smoke) que les 2 UPDATE incluent
  `muscles_secondary` (JSON normalisé, primaire exclu) et `instructions` (null si vide). Au minimum, un
  test de la **normalisation** appliquée (réutilise `normalizeSecondaryMuscles`, déjà testé shared).
- Smoke **`EditExerciseModal`** : rendu pré-rempli (nom/instructions/chips), `Enregistrer` désactivé si
  nom vidé, appel `updateCustomExercise` avec les bons champs puis `onClose`.
- **Non-régression** : la fiche lecture (biblio + perso) et la suppression (`deleteCustomExercise`)
  restent inchangées ; le smoke fiche existant reste vert (adapter les mocks si besoin — la fiche importe
  désormais `EditExerciseModal`).

## 6. Definition of Done
- [ ] Spec + plan + design (validé au brainstorming) — pas de code avant validation.
- [ ] `updateCustomExercise` gère instructions + muscles secondaires (atomique, normalisés) ; appelant(s) mis à jour.
- [ ] `EditExerciseModal` (bottom-sheet) : nom, groupe, matériel, muscles secondaires (hors primaire),
      instructions ; pré-rempli ; clavier géré ; a11y.
- [ ] Fiche : formulaire inline retiré, bouton Modifier ouvre la modale ; lecture inchangée + cohérente.
- [ ] i18n FR/EN (parité) ; aucune chaîne en dur ; **aucune migration**.
- [ ] Tests (updateCustomExercise + smoke modale) + non-régression verts ; typecheck/lint verts ; PR relue.

## 7. Explicitement différé
- Enrichissement de la **création** (MUSC-F11 reste minimal).
- Mutualisation d'un composant `BottomSheet` create/edit (si non fait ici → dette mineure).
- Toute refonte visuelle de la fiche au-delà de la cohérence des sections.
