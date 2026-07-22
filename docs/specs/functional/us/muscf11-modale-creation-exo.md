# US MUSC-F11 — Création d'exercice perso en modale (bottom-sheet)

> Retour recette F10c (Florian, 23/07/2026, [IDEAS.md](../../../../IDEAS.md)). US **UX** bornée.
> Branche : `feature/muscf11-modale-creation-exo`. **Aucune migration.**
> **Statut : à valider (pas de code avant validation).**

## 0. Contexte

Sur l'écran **liste des exercices** ([app/exercises.tsx](../../../../apps/mobile/src/app/exercises.tsx)),
le bouton **« + Créer un exercice perso »** ouvre aujourd'hui une **card intercalée** (état `creating` +
`createBox`) **entre** la barre de recherche et la liste des exercices. Problèmes constatés en recette :

1. Effet **« sandwich »** : la card de création s'insère entre la recherche (au-dessus) et la liste (en
   dessous) → composition confuse.
2. Le sélecteur de **groupe musculaire** (`Segment`) n'est **pas `scrollable`** → il déborde sur
   **plusieurs lignes** (contrairement à la fiche exercice qui l'utilise en `scrollable`).
3. Le champ **nom** n'a **pas de placeholder** → l'input paraît **vide / invisible**.

Décision de cadrage (Florian) : passer la création en **modale bottom-sheet**, sur le patron déjà en
place [ExerciseFilterDrawer](../../../../apps/mobile/src/components/programs/ExerciseFilterDrawer.tsx).

## 1. Périmètre à livrer

- Nouveau composant **`CreateExerciseModal`** (bottom-sheet) : titre, champ **Nom** (avec placeholder),
  sélecteur **groupe musculaire** en `Segment` **`scrollable`**, boutons **Annuler** / **Ajouter**.
- Intégration dans `exercises.tsx` : le bouton « Créer un exercice perso » **ouvre la modale** ;
  suppression de la **card inline** (`createBox`) et de la logique `creating`/`newName`/`newMuscle`
  déplacée dans la modale.
- **Gestion clavier** : le champ nom reste visible quand le clavier s'ouvre.
- **i18n** FR/EN : titre de la modale + placeholder du nom (nouvelles clés) ; réutilise
  `customName`, `add`, `common.cancel`.
- **Comportement métier inchangé** : nom requis (trim non vide) → `addCustomExercise(name, muscle)` ;
  fermeture + reset après ajout.

**Hors périmètre :**
- Cohérence fiche biblio VS perso (point 1 du retour recette → **US séparée**).
- Ajout de champs à la création (matériel, instructions…) — la création reste **nom + groupe** comme
  aujourd'hui.
- Le même bouton « créer » dans d'autres écrans (le picker en séance n'a pas ce bouton — inchangé).

## 2. Comportement attendu

- Appui sur **« + Créer un exercice perso »** → ouvre la **modale bottom-sheet** (glisse du bas,
  fond assombri) par-dessus la liste. La liste et la recherche ne sont plus « coupées » par une card.
- La modale contient : **titre** (« Créer un exercice »), champ **Nom** (placeholder d'exemple),
  **groupe musculaire** en chips/segment **scrollable horizontalement** (une seule ligne), boutons
  **Annuler** (ferme sans créer) et **Ajouter**.
- **Ajouter** est **désactivé** tant que le nom est vide (trim). Au clic : `addCustomExercise` →
  fermeture de la modale + reset des champs (nom vidé, groupe réinitialisé au défaut).
- **Annuler** / tap sur le fond / bouton retour Android → ferme la modale **sans** créer, et **reset**.
- Après création, le nouvel exercice apparaît dans la liste (déjà réactif via `useExercises`).
- **Clavier** : à l'ouverture du champ nom, la modale/les boutons restent accessibles (pas masqués).

## 3. Règles métier

- **Validation** : nom `trim()` non vide requis (inchangé). Groupe musculaire par défaut = premier de
  `MUSCLE_GROUPS` (`chest`), comme aujourd'hui.
- **Reset** : à chaque fermeture (ajout, annulation, dismiss), l'état du formulaire est réinitialisé.
- **Offline-first** : `addCustomExercise` est une écriture locale PowerSync (inchangé) ; aucune
  dépendance réseau.
- **i18n** : aucune chaîne en dur ; parité FR/EN.
- **A11y** : bouton de fermeture / backdrop avec `accessibilityRole`/label (comme `ExerciseFilterDrawer`).

## 4. Architecture & données

### 4.1 Nouveau composant `apps/mobile/src/components/exercises/CreateExerciseModal.tsx`
- Props : `{ visible: boolean; onClose: () => void }`. Le composant **gère son propre état** de
  formulaire (nom, groupe) et appelle `addCustomExercise` puis `onClose`. (Alternative : état remonté au
  parent — à trancher au plan ; préférence : état interne, plus simple, reset à la fermeture.)
- Structure calquée sur `ExerciseFilterDrawer` : `<Modal transparent animationType="slide">` +
  `Pressable` backdrop + `View` sheet (bottom). Ajouter un **`KeyboardAvoidingView`** autour du contenu
  (`behavior="padding"` iOS / gestion Android) pour garder le champ nom visible.
- Contenu : `Text` titre, `TextField` (label `customName` + **placeholder** `customNamePlaceholder`),
  `Segment` `options={MUSCLE_GROUPS}` **`scrollable`** `label={(m) => t('muscle.'+m)}`, ligne de 2
  boutons (`common.cancel` ghost / `add`), `Ajouter` `disabled` si nom vide.

### 4.2 `apps/mobile/src/app/exercises.tsx`
- Retirer l'état `creating`, `newName`, `newMuscle`, la fonction `onCreate`, le bloc `createBox` et le
  bloc `createTrigger` conditionnel.
- Ajouter un état `createOpen` (bool) ; le bouton « Créer un exercice perso » (toujours visible, même
  emplacement qu'actuellement le `createTrigger`) fait `setCreateOpen(true)`.
- Monter `<CreateExerciseModal visible={createOpen} onClose={() => setCreateOpen(false)} />` (à côté du
  `ExerciseFilterDrawer`).
- Nettoyer les styles devenus inutiles (`createBox`, `createActions`) ; garder `createTrigger`.

### 4.3 i18n (`apps/mobile/src/i18n/locales/fr.json` + `en.json`)
- Nouvelles clés sous `exercises` : `createTitle` (« Créer un exercice » / « Create an exercise ») et
  `customNamePlaceholder` (« Ex. Développé couché » / « E.g. Bench press »). Réutilise `customName`,
  `add`, `common.cancel`, `createCustom`.

## 5. Tests
- Smoke (jest-expo, `@testing-library/react-native`) sur `CreateExerciseModal` : rendu ouvert (titre +
  champ + segment + boutons) ; **Ajouter désactivé** si nom vide ; saisie d'un nom → **Ajouter** actif ;
  mock de `addCustomExercise` → appelé avec `(nom, groupe)` puis `onClose`.
- Non-régression : `exercises.tsx` — recherche, filtres, liste, modes `browse`/`replace`/`add`/
  `pickVariant` inchangés ; le smoke existant reste vert.

## 6. Definition of Done
- [ ] Spec + plan + design (bottom-sheet validé) — pas de code avant validation.
- [ ] `CreateExerciseModal` bottom-sheet : nom (placeholder), groupe `scrollable`, Annuler/Ajouter,
      clavier géré, a11y.
- [ ] Card inline supprimée de `exercises.tsx` ; bouton ouvre la modale ; styles morts nettoyés.
- [ ] Comportement métier inchangé (nom requis, `addCustomExercise`, reset à la fermeture).
- [ ] i18n FR/EN (parité) ; aucune chaîne en dur.
- [ ] Tests (smoke modale) + non-régression verts ; typecheck/lint verts ; PR relue.

## 7. Explicitement différé
- **Cohérence fiche exercice bibliothèque VS perso** (point 1 du retour recette) → US séparée.
- Enrichissement des champs de création (matériel, instructions).
