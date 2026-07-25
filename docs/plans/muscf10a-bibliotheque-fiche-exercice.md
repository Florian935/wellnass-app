# MUSC-F10a — Bibliothèque en accès direct + fiche exercice (socle) · Plan

> **Pour l'exécutant :** subagent-driven-development, une tâche à la fois, TDD quand c'est utile, commits fréquents.

**Goal :** rendre la bibliothèque d'exercices accessible directement depuis le hub Muscu (sans lancer de
séance) et ajouter un écran de **fiche exercice** (données actuelles) permettant aussi de **modifier/supprimer**
ses exercices perso.

**Spec :** [docs/specs/functional/us/muscf10a-bibliotheque-fiche-exercice.md](../specs/functional/us/muscf10a-bibliotheque-fiche-exercice.md).

**Architecture :** un hook de lecture `useExercise(id)` + deux écritures (`updateCustomExercise`,
`deleteCustomExercise`) dans le repository existant → nouvel écran `app/exercises/[id].tsx` (fiche) →
`exercises.tsx` gagne un **mode parcours** (param de route : tap → fiche au lieu d'ajouter en séance) → entrée
persistante dans le hub Muscu. **Aucune migration.** Soft-delete de la **ligne `exercises` seule** (jamais les
traductions — sinon le nom se vide sur les écrans d'historique/programmes qui résolvent le nom via
`exercise_translations`).

**Tech :** TypeScript, Expo Router (routes modales), PowerSync (`useQuery` / `powerSync.execute` /
`writeTransaction`), i18next FR/EN, Vitest (fonction pure de garde) + jest-expo (smoke écran).

**Ordre :** 1 (hook lecture) → 2 (écritures + garde testée) → 3 (i18n) → 4 (fiche lecture + route) → 5 (gestion
perso) → 6 (mode parcours) → 7 (entrée hub) → 8 (revue + clôture).

**Rappels projet :** offline-first (écritures optimistes locales, UUID client, UTC, soft delete), aucune chaîne
en dur (tout via `t(...)`), parité i18n FR/EN stricte. Ne PAS lancer `/commit` ni pousser par tâche : commit
local sur la branche `feature/muscf10a-bibliotheque-fiche-exercice` ; la clôture (CHANGELOG/TODO/roadmap + merge
`dev`) est faite par le contrôleur en Task 8.

---

### Task 1 : Repository — `useExercise(id)` + type `ExerciseDetail`

**Files :**
- Modify : `apps/mobile/src/data/repositories/exercise-repository.ts`

- [ ] **Step 1 — Type `ExerciseDetail`.** Sous `ExerciseListItem`, ajouter :

```ts
/** Fiche exercice : vue liste + instructions résolues (langue courante → fr). */
export type ExerciseDetail = ExerciseListItem & {
  instructions: string | null;
};
```

- [ ] **Step 2 — SELECT dédié + ligne DB.** Ajouter, à côté de `SELECT_EXERCISES` :

```ts
/** Ligne brute de la fiche (comme la vue liste + instructions résolues). */
type ExerciseDetailDbRow = ExerciseListDbRow & { instructions: string | null };

/**
 * Sélection d'un exercice unique pour la fiche : nom + instructions résolus
 * (langue courante → fr) + drapeau favori. `?` #1 = langue, `?` #2 = id.
 * Filtre `e.deleted_at IS NULL` : un exo supprimé → aucune ligne → « introuvable ».
 */
const SELECT_EXERCISE_DETAIL = `
  SELECT e.id, e.source, e.muscle_primary, e.equipment, e.media_url,
         COALESCE(tl.name, tfr.name) AS name,
         COALESCE(tl.instructions, tfr.instructions) AS instructions,
         (f.id IS NOT NULL) AS is_favorite
  FROM exercises e
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = e.id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = e.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  LEFT JOIN exercise_favorites f      ON f.exercise_id = e.id AND f.deleted_at IS NULL
  WHERE e.deleted_at IS NULL AND e.id = ?
  LIMIT 1
`;
```

- [ ] **Step 3 — Hook `useExercise`.** Après `useFavorites` :

```ts
/**
 * Fiche d'un exercice unique (nom + instructions résolus, drapeau favori),
 * réactive aux changements locaux. `null` si l'id est introuvable ou supprimé.
 * `isLoading` ne dépend QUE de la requête locale (offline-first, ADR-001).
 */
export function useExercise(id: string): {
  exercise: ExerciseDetail | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const { data, isLoading } = useQuery<ExerciseDetailDbRow>(SELECT_EXERCISE_DETAIL, [lang, id]);

  const row = data[0];
  const exercise: ExerciseDetail | null = row
    ? { ...rowToListItem(row), instructions: row.instructions }
    : null;

  return { exercise, isLoading };
}
```

- [ ] **Step 4 — Vérifs.** `npm run typecheck -w @wellness/mobile` + `npm run lint -w @wellness/mobile`.
- [ ] **Step 5 — Commit.** `feat(muscu): useExercise(id) — fiche exercice (nom/instructions/favori) (MUSC-F10a)`

---

### Task 2 : Repository — garde testée + `updateCustomExercise` / `deleteCustomExercise`

**Files :**
- Modify : `apps/mobile/src/data/repositories/exercise-repository.ts`
- Create : `apps/mobile/src/data/repositories/__tests__/exercise-guard.test.ts`

- [ ] **Step 1 — Test qui échoue (garde pure).** Créer le test :

```ts
import { assertOwnedCustomExercise } from '../exercise-repository';

describe('assertOwnedCustomExercise', () => {
  const U = 'user-1';
  it('accepte un exo perso de l’utilisateur', () => {
    expect(() =>
      assertOwnedCustomExercise({ source: 'custom', owner_id: 'user-1' }, U),
    ).not.toThrow();
  });
  it('refuse un exo de bibliothèque', () => {
    expect(() =>
      assertOwnedCustomExercise({ source: 'library', owner_id: null }, U),
    ).toThrow();
  });
  it('refuse l’exo perso d’un autre utilisateur', () => {
    expect(() =>
      assertOwnedCustomExercise({ source: 'custom', owner_id: 'user-2' }, U),
    ).toThrow();
  });
  it('refuse un exo introuvable (null)', () => {
    expect(() => assertOwnedCustomExercise(null, U)).toThrow();
  });
});
```

- [ ] **Step 2 — Échec.** `npm run test -w @wellness/mobile -- exercise-guard` → FAIL (fonction absente).
- [ ] **Step 3 — Implémenter la garde + les écritures.** Ajouter dans `exercise-repository.ts` (importer
  **`nowUtc`** depuis `./_sql` — `softDelete` y est déjà importé ; **ne pas** importer `patch`, le code
  ci-dessous utilise `tx.execute` brut, un import `patch` inutilisé ferait échouer le lint) :

```ts
/**
 * Garde : seules les modifications/suppressions d'un exercice **perso**
 * (`source = 'custom'`) appartenant à l'utilisateur courant sont autorisées.
 * Lève sinon (la RLS l'empêcherait aussi côté serveur ; garde applicative pour
 * un échec clair et immédiat). `row` null = exercice introuvable.
 */
export function assertOwnedCustomExercise(
  row: { source: string; owner_id: string | null } | null,
  userId: string,
): void {
  if (!row) {
    throw new Error('Exercice introuvable.');
  }
  if (row.source !== 'custom' || row.owner_id !== userId) {
    throw new Error('Seuls tes exercices personnels peuvent être modifiés ou supprimés.');
  }
}

/** Charge (source, owner_id) d'un exercice pour la garde. */
async function getExerciseOwnership(
  id: string,
): Promise<{ source: string; owner_id: string | null } | null> {
  return powerSync.getOptional<{ source: string; owner_id: string | null }>(
    `SELECT source, owner_id FROM exercises WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
}

/**
 * Met à jour un exercice **perso** de l'utilisateur courant : groupe musculaire,
 * matériel (optionnel), et le nom (unique ligne de traduction du custom). Atomique.
 */
export async function updateCustomExercise(
  id: string,
  input: { name: string; muscle: MuscleGroup; equipment: Equipment | null },
): Promise<void> {
  const userId = currentUserId();
  assertOwnedCustomExercise(await getExerciseOwnership(id), userId);

  const translation = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM exercise_translations WHERE exercise_id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );

  const now = nowUtc();
  await powerSync.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE exercises SET muscle_primary = ?, equipment = ?, updated_at = ? WHERE id = ?`,
      [input.muscle, input.equipment, now, id],
    );
    if (translation) {
      await tx.execute(
        `UPDATE exercise_translations SET name = ?, updated_at = ? WHERE id = ?`,
        [input.name.trim(), now, translation.id],
      );
    }
  });
}

/**
 * Supprime (soft-delete) un exercice **perso** de l'utilisateur courant.
 * ⚠️ Soft-delete de la ligne `exercises` UNIQUEMENT — jamais les traductions
 * (sinon le nom se vide sur l'historique/les programmes, voir spec §3).
 * Suppression toujours autorisée (pas de blocage si référencé — décision Florian).
 */
export async function deleteCustomExercise(id: string): Promise<void> {
  const userId = currentUserId();
  assertOwnedCustomExercise(await getExerciseOwnership(id), userId);
  await softDelete('exercises', id);
}
```
  Importer `nowUtc` depuis `./_sql` si pas déjà importé (utilisé ci-dessus). Vérifier la signature de
  `powerSync.writeTransaction` déjà utilisée ailleurs dans le repo (workout-repository) et l'aligner.

- [ ] **Step 4 — Succès.** `npm run test -w @wellness/mobile -- exercise-guard` → PASS ; `npm run typecheck -w
  @wellness/mobile` + `npm run lint -w @wellness/mobile` verts.
- [ ] **Step 5 — Commit.** `feat(muscu): update/deleteCustomExercise + garde exo perso (MUSC-F10a)`

---

### Task 3 : i18n — entrée hub + fiche (FR/EN, parité)

**Files :**
- Modify : `apps/mobile/src/i18n/locales/fr.json`
- Modify : `apps/mobile/src/i18n/locales/en.json`

- [ ] **Step 1 — FR.** Dans l'objet `"exercises"`, ajouter :

```json
    "library": "Bibliothèque d'exercices",
    "detail": {
      "title": "Fiche exercice",
      "muscle": "Groupe musculaire",
      "equipment": "Matériel",
      "instructions": "Instructions",
      "edit": "Modifier",
      "delete": "Supprimer",
      "deleteConfirm": "Supprimer cet exercice ?",
      "notFound": "Exercice introuvable.",
      "editTitle": "Modifier l'exercice",
      "equipmentNone": "Aucun",
      "save": "Enregistrer"
    }
```

- [ ] **Step 2 — EN.** Miroir :

```json
    "library": "Exercise library",
    "detail": {
      "title": "Exercise",
      "muscle": "Muscle group",
      "equipment": "Equipment",
      "instructions": "Instructions",
      "edit": "Edit",
      "delete": "Delete",
      "deleteConfirm": "Delete this exercise?",
      "notFound": "Exercise not found.",
      "editTitle": "Edit exercise",
      "equipmentNone": "None",
      "save": "Save"
    }
```

- [ ] **Step 3 — Parité + JSON valide.** Vérifier que les deux fichiers parsent (`node -e "JSON.parse(...)"`)
  et que la structure `exercises.detail.*` est identique des deux côtés.
- [ ] **Step 4 — Commit.** `feat(i18n): clés bibliothèque + fiche exercice FR/EN (MUSC-F10a)`

---

### Task 4 : Écran fiche (lecture) `app/exercises/[id].tsx` + route

**Files :**
- Create : `apps/mobile/src/app/exercises/[id].tsx`
- Modify : `apps/mobile/src/app/_layout.tsx`
- Create : `apps/mobile/src/app/exercises/__tests__/exercise-detail-smoke.test.tsx`

> **Routing** : conserver `app/exercises.tsx` (liste, route `/exercises`) et ajouter `app/exercises/[id].tsx`
> (route `/exercises/:id`). Expo Router autorise un fichier `exercises.tsx` et un dossier `exercises/` avec
> `[id].tsx` à coexister (paths distincts). **Ne pas** créer `exercises/index.tsx` (conflit avec `exercises.tsx`).

- [ ] **Step 1 — Écran fiche (lecture seule d'abord).** Créer `[id].tsx` : lit `id` via
  `useLocalSearchParams`, `useExercise(id)`. États : chargement (spinner), `null` → message
  `t('exercises.detail.notFound')` + retour, sinon affiche nom (titre), groupe (`muscle.*`), matériel
  (`equipment.*` si non nul), instructions (si non nulles), badge « perso » si `source === 'custom'`, bouton
  favori ⭐ (réutilise `toggleFavorite`). Suivre les conventions des écrans voisins (`useTheme`, `fontFamily`,
  `Ionicons`, `Card`/`Screen` si adaptés). Les actions perso (Modifier/Supprimer) seront ajoutées en Task 5.
- [ ] **Step 2 — Enregistrer la route.** Dans `_layout.tsx`, ajouter un `<Stack.Screen name="exercises/[id]"
  options={{ headerShown: true, title: t('exercises.detail.title'), headerStyle/headerTitleStyle/headerTintColor
  comme les autres écrans }} />` (présentation par défaut = card poussée au-dessus de la modale `exercises`).
- [ ] **Step 3 — Smoke test.** Créer `exercise-detail-smoke.test.tsx` : mocker `@/data/repositories/exercise-repository`
  (`useExercise` renvoyant un exo custom, puis `null`), monter l'écran, vérifier qu'il rend le nom et le badge
  perso, et l'état « introuvable ». (S'inspirer de `programs-smoke.test.tsx` et du mock du smoke existant.)
- [ ] **Step 4 — Vérifs.** `npm run test -w @wellness/mobile -- exercise-detail-smoke` PASS ; typecheck + lint verts.
- [ ] **Step 5 — Commit.** `feat(muscu): écran fiche exercice (lecture) + route (MUSC-F10a)`

---

### Task 5 : Gestion des exos perso sur la fiche (Modifier + Supprimer)

**Files :**
- Modify : `apps/mobile/src/app/exercises/[id].tsx`

- [ ] **Step 1 — Actions custom.** Sur la fiche, si `exercise.source === 'custom'`, afficher **Modifier** et
  **Supprimer** (masqués pour la bibliothèque).
  - **Modifier** : bascule un formulaire inline (ou sous-vue) : `TextField` nom (pré-rempli), `Segment`
    `MUSCLE_GROUPS` pour le groupe (pré-sélectionné, `label={(m) => t('muscle.'+m)}`), et un sélecteur
    **matériel** optionnel (chips single-select sur `EQUIPMENTS` + option « Aucun » `equipmentNone` = `null`,
    cohérent visuellement avec `ExerciseFilterDrawer`). Bouton Enregistrer (désactivé si nom vide) →
    `updateCustomExercise(id, { name, muscle, equipment })` → la fiche se rafraîchit (le hook `useExercise` est
    réactif). Bouton Annuler.
  - **Supprimer** : `Alert.alert` (titre = nom, message `t('exercises.detail.deleteConfirm')`, boutons
    Annuler / Supprimer destructif) → `deleteCustomExercise(id)` → `router.back()` (retour à la biblio ; l'exo
    disparaît de la liste). Gérer l'erreur sans planter (offline-first : succès local attendu).
- [ ] **Step 2 — i18n.** Utiliser uniquement les clés de Task 3 (aucune chaîne en dur).
- [ ] **Step 3 — Vérifs.** typecheck + lint + `npm run test -w @wellness/mobile` (non-régression smoke) verts.
- [ ] **Step 4 — Commit.** `feat(muscu): fiche — modifier/supprimer un exo perso (MUSC-F10a)`

---

### Task 6 : Mode parcours dans `exercises.tsx` (tap → fiche)

**Files :**
- Modify : `apps/mobile/src/app/exercises.tsx`

- [ ] **Step 1 — Lire le mode + router le tap.**
  - Étendre `useLocalSearchParams` : `const { replaceExerciseId, mode } = useLocalSearchParams<{ replaceExerciseId?: string; mode?: string }>();`
  - `const browse = mode === 'browse';`
  - Modifier `onPick` :
    ```ts
    const onPick = async (item: ExerciseListItem) => {
      if (browse) {
        router.push(`/exercises/${item.id}`);
        return;
      }
      if (active) {
        if (replaceExerciseId) {
          await replaceExercise(active.id, replaceExerciseId, item.id);
        } else {
          await addExerciseToWorkout(active.id, item.id);
        }
        router.back();
      }
    };
    ```
  - Le reste (recherche, filtres MUSC-F3, création perso, favoris, état vide) **inchangé**. Le mode
    « ajout/remplacement en séance » (hors `browse`) est **strictement préservé**.
- [ ] **Step 2 — Vérifs.** typecheck + lint + tests verts (non-régression du picker/écran).
- [ ] **Step 3 — Commit.** `feat(muscu): exercises.tsx — mode parcours (tap → fiche) (MUSC-F10a)`

---

### Task 7 : Entrée « Bibliothèque d'exercices » dans le hub Muscu

**Files :**
- Modify : `apps/mobile/src/app/(tabs)/strength.tsx`

- [ ] **Step 1 — Entrée persistante.** Ajouter, **entre** la carte d'action épinglée et la `WidgetGrid`
  (donc toujours visible, hors grille personnalisable), une entrée tappable dédiée :
  - Un `Pressable` (ou `Card` compacte) : icône `Ionicons` (`library-outline`), libellé
    `t('exercises.library')`, chevron `chevron-forward`.
  - `onPress` → `router.push({ pathname: '/exercises', params: { mode: 'browse' } })`.
  - Styles cohérents avec les cartes existantes du hub (couleurs `useTheme`, `fontFamily`).
  - `accessibilityRole="button"`.
- [ ] **Step 2 — Vérifs.** typecheck + lint verts.
- [ ] **Step 3 — Commit.** `feat(muscu): entrée Bibliothèque d'exercices dans le hub Muscu (MUSC-F10a)`

---

### Task 8 : Revue finale + clôture

- [ ] **Step 1 — Revue finale** (subagent `superpowers:code-reviewer` sur le diff complet de la branche vs `dev`,
  comparé à la spec) — vérifier notamment : soft-delete `exercises` seul (pas les traductions), mode séance
  inchangé, garde custom+owner, parité i18n, aucune chaîne en dur, aucune migration.
- [ ] **Step 2 — Vérifs globales.** `npm run typecheck` + `npm run lint` + `npm run test` (racine) verts.
- [ ] **Step 3 — Clôture** via `/commit` (CHANGELOG + TODO : MUSC-F10a **code livré**, reste recette device +
  relecture Damien ; roadmap : la fiche relève de MUSC-F2/3.13 — laisser 3.13/3.19/3.20 en l'état car muscles
  secondaires/variantes = F10c, non livrés ici → **pas de changement de statut roadmap**, le signaler) + merge
  sur `dev` + push.
- [ ] **Step 4 — Recette.** Fournir à Florian le plan de recette device (entrée hub → biblio parcours → fiche →
  favori → modifier/supprimer un exo perso → vérifier que l'historique/programmes affichent toujours le nom d'un
  exo perso supprimé → i18n FR/EN).

---

## Definition of Done (rappel spec §6)

Entrée persistante « Bibliothèque » dans le hub → biblio en mode parcours (tap → fiche, mode séance inchangé) ;
fiche `/exercises/[id]` (nom, groupe, matériel, instructions, favori, badge perso, état introuvable) ; exos perso
Modifier/Supprimer (custom & owner only ; soft-delete de `exercises` seule, toujours autorisé) ; historique &
programmes/templates affichent toujours le nom d'un exo supprimé (traductions préservées, aucune requête
d'affichage modifiée) ; garde pure testée (Vitest/jest) + smoke fiche ; i18n FR/EN ; **aucune migration** ;
typecheck/lint/tests verts ; PR relue par les deux devs.
