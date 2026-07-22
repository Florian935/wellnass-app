# Plan d'implémentation — MUSC-F12 (cohérence fiche exo perso)

> **Pour les workers agentiques :** SOUS-SKILL REQUISE — `superpowers:subagent-driven-development`.
> Étapes en cases (`- [ ]`).

**But :** rendre la fiche d'un exo perso cohérente avec un exo bibliothèque en rendant **instructions +
muscles secondaires** éditables, via une **modale d'édition bottom-sheet** (patron `CreateExerciseModal`).

**Architecture :** `updateCustomExercise` étendu (transaction : `exercises` + traduction) ; nouveau
composant `EditExerciseModal` ; la fiche `[id].tsx` perd son formulaire inline (Modifier ouvre la modale).
Aucune migration.

**Stack :** React Native/Expo, PowerSync, i18next, jest-expo.

**Spec :** [docs/specs/functional/us/muscf12-coherence-fiche-exo-perso.md](../specs/functional/us/muscf12-coherence-fiche-exo-perso.md)

---

## Structure des fichiers
- `apps/mobile/src/data/repositories/exercise-repository.ts` — **modifier** (`updateCustomExercise` +
  helper pur `buildCustomExerciseWrite`).
- `apps/mobile/src/data/repositories/__tests__/exercise-guard.test.ts` — **modifier** (tests du helper),
  ou nouveau fichier `__tests__/custom-exercise-write.test.ts`.
- `apps/mobile/src/components/exercises/EditExerciseModal.tsx` — **créer**.
- `apps/mobile/src/components/exercises/__tests__/edit-exercise-modal-smoke.test.tsx` — **créer**.
- `apps/mobile/src/app/exercises/[id].tsx` — **modifier** (retirer le formulaire inline, brancher la modale).
- `apps/mobile/src/i18n/locales/fr.json` + `en.json` — **modifier** si placeholder instructions ajouté.

---

## Task 1 : Repository — `updateCustomExercise` étendu + helper testé (TDD)

**Files:**
- Modify: `apps/mobile/src/data/repositories/exercise-repository.ts`
- Test: `apps/mobile/src/data/repositories/__tests__/custom-exercise-write.test.ts`

- [ ] **Étape 1 : test d'abord** — créer `__tests__/custom-exercise-write.test.ts` (jest-expo, globals) :

```ts
import { buildCustomExerciseWrite } from '../exercise-repository';

describe('buildCustomExerciseWrite', () => {
  it('normalise les muscles secondaires (exclut le primaire, dédup) en JSON', () => {
    const out = buildCustomExerciseWrite({
      muscle: 'chest',
      musclesSecondary: ['chest', 'arms', 'arms', 'shoulders'],
      instructions: null,
    });
    expect(JSON.parse(out.musclesSecondaryJson)).toEqual(['arms', 'shoulders']);
  });
  it('instructions vides → null ; sinon trim', () => {
    expect(buildCustomExerciseWrite({ muscle: 'back', musclesSecondary: [], instructions: '   ' }).instructions).toBeNull();
    expect(buildCustomExerciseWrite({ muscle: 'back', musclesSecondary: [], instructions: '  Dos droit  ' }).instructions).toBe('Dos droit');
  });
});
```

- [ ] **Étape 2 : lancer, vérifier l'échec** — `npm run test --workspace=@wellness/mobile -- custom-exercise-write`.

- [ ] **Étape 3 : implémenter** dans `exercise-repository.ts` :
  - importer `normalizeSecondaryMuscles` depuis `@wellness/shared` (ajouter à l'import existant).
  - ajouter le helper pur (au-dessus de `updateCustomExercise`) :

```ts
/**
 * Prépare les valeurs d'écriture d'un exo perso : muscles secondaires **normalisés**
 * (dédup, exclusion du primaire) sérialisés en JSON, et instructions (trim → null si vide).
 * Pur → testable sans PowerSync.
 */
export function buildCustomExerciseWrite(input: {
  muscle: MuscleGroup;
  musclesSecondary: MuscleGroup[];
  instructions: string | null;
}): { musclesSecondaryJson: string; instructions: string | null } {
  return {
    musclesSecondaryJson: JSON.stringify(normalizeSecondaryMuscles(input.musclesSecondary, input.muscle)),
    instructions: input.instructions?.trim() ? input.instructions.trim() : null,
  };
}
```

  - étendre `updateCustomExercise` :

```ts
export async function updateCustomExercise(
  id: string,
  input: {
    name: string;
    muscle: MuscleGroup;
    equipment: Equipment | null;
    musclesSecondary: MuscleGroup[];
    instructions: string | null;
  },
): Promise<void> {
  const userId = currentUserId();
  assertOwnedCustomExercise(await getExerciseOwnership(id), userId);

  const translation = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM exercise_translations WHERE exercise_id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  if (!translation) {
    throw new Error("Traduction de l'exercice introuvable.");
  }

  const { musclesSecondaryJson, instructions } = buildCustomExerciseWrite(input);
  const now = nowUtc();
  await powerSync.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE exercises SET muscle_primary = ?, equipment = ?, muscles_secondary = ?, updated_at = ? WHERE id = ?`,
      [input.muscle, input.equipment, musclesSecondaryJson, now, id],
    );
    await tx.execute(
      `UPDATE exercise_translations SET name = ?, instructions = ?, updated_at = ? WHERE id = ?`,
      [input.name.trim(), instructions, now, translation.id],
    );
  });
}
```

- [ ] **Étape 4 : lancer, vérifier le succès** — test du helper vert.
- [ ] **Étape 5 : ne PAS committer maintenant** — le changement de signature casse l'appelant `[id].tsx`
      (typecheck rouge tant que Task 3 n'est pas faite). On enchaîne Task 2 puis Task 3, et on fait **un
      seul commit final** (voir Clôture). `npm run test` (helper vert) suffit ici.

> **Séquencement** : **Task 1 → Task 2 → Task 3**, puis **un unique commit** couvrant les 3 (repo +
> modale + fiche), pour ne jamais committer sur un typecheck rouge. Aucun commit intermédiaire.

---

## Task 2 : `EditExerciseModal` (+ i18n + smoke)

**Files:**
- Create: `apps/mobile/src/components/exercises/EditExerciseModal.tsx`
- Test: `apps/mobile/src/components/exercises/__tests__/edit-exercise-modal-smoke.test.tsx`
- Modify (option): `apps/mobile/src/i18n/locales/fr.json` + `en.json` (placeholder instructions)

- [ ] **Étape 1 : i18n (optionnel)** — si on veut un placeholder d'instructions, ajouter sous
      `exercises.detail` : `"instructionsPlaceholder": "Ex. Garder le dos plaqué au banc."` (FR) /
      `"E.g. Keep your back flat on the bench."` (EN). Sinon, ne pas mettre de placeholder (acceptable).

- [ ] **Étape 2 : smoke test d'abord** — `__tests__/edit-exercise-modal-smoke.test.tsx` (jest-expo,
      globals ; `await render`/`await fireEvent` comme les smokes existants ; mock repo + `useTheme`) :

```tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { EditExerciseModal } from '../EditExerciseModal';
import { updateCustomExercise } from '@/data/repositories/exercise-repository';

jest.mock('@/data/repositories/exercise-repository', () => ({
  updateCustomExercise: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#000', textMuted: '#888', background: '#fff', surface: '#f5f5f5',
      surfaceAlt: '#eee', border: '#ddd', accent: '#6b0028', accentText: '#fff',
    },
  })),
}));

const exercise = {
  id: 'exo-1', name: 'Mon exo', muscle: 'chest' as const, source: 'custom' as const,
  equipment: null, mediaUrl: null, isFavorite: false, instructions: 'Notes',
  musclesSecondary: ['arms' as const],
};

describe('EditExerciseModal — smoke', () => {
  it('pré-remplit le nom et enregistre', async () => {
    const onClose = jest.fn();
    const { getByText, getByDisplayValue } = await render(
      <EditExerciseModal visible exercise={exercise} onClose={onClose} />,
    );
    expect(getByDisplayValue('Mon exo')).toBeTruthy();
    await fireEvent.press(getByText('Enregistrer'));
    expect(updateCustomExercise).toHaveBeenCalledWith('exo-1', expect.objectContaining({ name: 'Mon exo' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```
> Adapter les requêtes au rendu réel si besoin (`getByDisplayValue` selon `TextField`). Le smoke doit
> vérifier : pré-remplissage + appel `updateCustomExercise(id, {...})` + `onClose`.

- [ ] **Étape 3 : lancer, vérifier l'échec**.
- [ ] **Étape 4 : implémenter** `EditExerciseModal.tsx` — patron `CreateExerciseModal` + champs
      supplémentaires. Points clés :
  - Props `{ visible, onClose, exercise: ExerciseDetail }`.
  - État initialisé depuis `exercise` ; **réinitialiser quand `exercise.id` change** (via un `useEffect`
    déclenché sur `exercise.id` **et** `visible`, ou une `key` sur le composant côté parent — trancher :
    le plus simple est un `key={exercise.id}` posé par la fiche, l'état s'initialise alors dans `useState`).
  - Champs : `name` (TextField), `muscle` (Segment scrollable), `equipment` (Segment scrollable avec
    sentinelle `'none'` → `null`, cast `exercise.equipment as Equipment | null` à l'init), **muscles
    secondaires** (chips toggle sur `MUSCLE_GROUPS.filter(m => m !== muscle)`, patron
    `ExerciseFilterDrawer`), `instructions` (TextField `multiline`).
  - Au changement de `muscle`, retirer ce muscle de `musclesSecondary`.
  - Bouton **`exercises.detail.save`** (« Enregistrer », **pas** `exercises.add`) : `disabled` si nom vide ;
    `onPress` → `updateCustomExercise(exercise.id, { name, muscle, equipment, musclesSecondary, instructions })`
    → `onClose()`. Gestion erreur = `try/catch` + `saving` (comme `CreateExerciseModal`).
  - `KeyboardAvoidingView`, backdrop, a11y (label fermeture) comme `CreateExerciseModal`.
  - Section muscles secondaires : titre `t('exercises.detail.secondaryMuscles')` ; chips avec
    `accessibilityState={{ selected }}`.
  - `TextField multiline` pour instructions : label `t('exercises.detail.instructions')`, `multiline`
    (transmis via `...inputProps`). Sur Android, ajouter `textAlignVertical="top"` (+ éventuellement
    `numberOfLines`) pour un rendu multiligne correct (le `TextField` a `minHeight: 52` sans gestion
    multiligne dédiée).

- [ ] **Étape 5 : lancer, vérifier le succès** (smoke modale) + **lint**. ⚠️ **Ne pas exiger un
      typecheck global vert ici** : `[id].tsx` reste cassé (ancienne signature) jusqu'à Task 3 → le
      typecheck global est validé **en Clôture uniquement**. Se limiter à vérifier que la modale et son
      test compilent/passent.

---

## Task 3 : Fiche `[id].tsx` — retirer le formulaire inline, brancher la modale

**Files:**
- Modify: `apps/mobile/src/app/exercises/[id].tsx`

- [ ] **Étape 1 : imports** — retirer `TextField` et `Segment` (n'étaient utilisés que par le formulaire
      inline), retirer la constante `EQUIPMENT_OPTIONS`/type `EquipmentOption` (idem), et retirer les
      imports de valeurs **`EQUIPMENTS` et `MUSCLE_GROUPS`** (devenus inutilisés) ainsi que les types
      `Equipment`/`MuscleGroup` s'ils ne servent plus après retrait des états d'édition. Ajouter
      `import { EditExerciseModal } from '@/components/exercises/EditExerciseModal';`. Conserver `Button`,
      `Ionicons`, `Alert`, etc. Le **lint (Étape 6)** confirmera qu'aucun import ne reste inutilisé.
- [ ] **Étape 2 : état** — supprimer `isEditing`, `isSaving`, `editName`, `editMuscle`, `editEquipment`,
      `canSave`, `onStartEdit`, `onSave`. Ajouter `const [editOpen, setEditOpen] = useState(false);`.
- [ ] **Étape 3 : JSX** — remplacer le bloc `{isEditing ? (<form inline>) : (<>lecture</>)}` par le
      **seul** contenu de lecture (le `<>…</>` actuel). Dans le bloc d'actions custom, le bouton
      **Modifier** appelle désormais `onPress={() => setEditOpen(true)}` (au lieu de `onStartEdit`).
      Le bouton **Supprimer** (`onDelete`) est inchangé.
- [ ] **Étape 4 : monter la modale** — à la fin du `ScrollView`/juste avant sa fermeture (ou après),
      ajouter (uniquement pour un exo perso) :

```tsx
{isCustom ? (
  <EditExerciseModal
    key={exercise.id}
    visible={editOpen}
    exercise={exercise}
    onClose={() => setEditOpen(false)}
  />
) : null}
```
> `key={exercise.id}` garantit la réinitialisation de l'état interne de la modale si l'exercice change.

- [ ] **Étape 5 : nettoyage styles** — retirer les styles devenus morts (ceux du formulaire inline :
      `form`, `editTitle`, `field`/`label`/`value` **s'ils ne servent plus** au mode lecture —
      ⚠️ **vérifier** : `field`, `label`, `value`, `instructions` sont **aussi** utilisés par le mode
      lecture → **les conserver**. Ne retirer que ceux exclusivement liés au formulaire : `form`,
      `editTitle`, `actions`/`flex` si plus utilisés par les actions custom — `actions`/`flex` **restent**
      utilisés par le bloc Modifier/Supprimer). Lint « no-unused-styles » n'existe pas ici, mais éviter
      le code mort.
- [ ] **Étape 6 : vérifier** — `npm run typecheck` (vert, appelant aligné), `npm run lint` (vert),
      `npm run test --workspace=@wellness/mobile` (tous verts ; **adapter le smoke fiche existant** si
      l'import de `EditExerciseModal` casse le rendu — au besoin mocker `@/components/exercises/EditExerciseModal`
      dans `exercise-detail-smoke.test.tsx`, ou vérifier qu'il rend sans mock).

---

## Clôture — Commit unique (repo + modale + fiche) puis merge

> Le changement de signature de `updateCustomExercise` casse `[id].tsx` tant que Task 3 n'est pas faite.
> Pour ne **jamais committer sur du rouge**, faire **Task 1 → Task 2 → Task 3** puis **un seul commit**.

- [ ] **Vérif finale** : `npm run typecheck` + `npm run lint` + `npm run test --workspace=@wellness/mobile`
      + `npm run test -w packages/shared` (tous verts).
- [ ] **Commit** :

```bash
git add apps/mobile/src/data/repositories/exercise-repository.ts \
        apps/mobile/src/data/repositories/__tests__/custom-exercise-write.test.ts \
        apps/mobile/src/components/exercises/EditExerciseModal.tsx \
        apps/mobile/src/components/exercises/__tests__/edit-exercise-modal-smoke.test.tsx \
        "apps/mobile/src/app/exercises/[id].tsx" \
        apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "feat(muscf12): édition exo perso enrichie (instructions + muscles secondaires) en modale

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] Revue de code finale (subagent) sur le diff.
- [ ] CHANGELOG + TODO + roadmap (note sur 3.16/3.19 : édition enrichie perso) ; merge ff `dev` + push.
- [ ] Recette Florian (édition perso : instructions + secondaires, modale, cohérence fiche) + relecture Damien.
