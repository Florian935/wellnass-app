# US Refonte-C3 — Écran de séance : ajustements en direct — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Étapes en checkbox (`- [ ]`).

**Goal:** Réorganiser les exercices restants (↑/↓ + « Plus tard »), superset (couple positionnel, repos différé), remplacer un exercice en direct (picker existant, filtré), note persistante par exercice (nouvelle table), suggestion de progression discrète RPE-aware.

**Architecture:** Deux algorithmes à risque (renumérotation d'`order_index`, règle de suggestion) sont extraits en **fonctions pures testables** dans `packages/shared` (Vitest, TDD rouge→vert) — le repository mobile ne fait que dériver l'état courant, appeler la fonction pure, puis écrire le résultat en transaction. Le superset est une liaison **positionnelle** (aucune colonne), résolue dans `workout.tsx` à partir de `entries`. Une seule migration cloud (`exercise_notes`), tout le reste est mobile-only.

**Tech Stack:** `packages/shared` (Zod + Vitest). `apps/mobile` (Expo Router, PowerSync `writeTransaction`, i18next). Aucune dépendance native ajoutée.

**Spec :** [refonte-muscu-c3-ajustements-live.md](../specs/functional/us/refonte-muscu-c3-ajustements-live.md) (validée Florian, 20/07/2026). **Analyse :** [analyse-seance-en-cours.md](../refonte-muscu/analyse-seance-en-cours.md) (points 10, 19, 20, 22).

**Branche :** `feature/refonte-muscu-c3` (créée depuis `dev`).

> **Invariants :**
> - **Offline-first** : écritures optimistes locales (`writeTransaction`/`patch`/`insertWithSyncFields`), lecture réactive `useQuery`.
> - **🔴 Migration = checkpoint cloud** (`exercise_notes`, base partagée `nsxzflxsgovriwwvflxe`) : `db:push` **seulement après go explicite de Florian**. Jamais de SQL collé à la main.
> - **i18n** parité FR/EN stricte, aucune chaîne en dur.
> - **Périmètre C3 strict** : PAS de variantes suggérées (3.20), PAS de progression automatique du plan (3.7) ni deload (3.8), PAS de circuits 3+ exercices, PAS d'accès démo (**abandonné**, pas différé).
> - **Règle réorganisation** : ne touche que les exercices **non entièrement validés** ; les exercices terminés gardent leur position absolue.
> - **Règle remplacement** : le picker **exclut** les exercices déjà présents dans la séance ; ne réécrit jamais une série déjà validée.
> - **Règle suggestion** : aucune suggestion si une série qualifiante de la dernière fois est `failure` ou si le RPE max **≥ 8** ; adaptée au type (charge/reps/durée).
> - À chaque commit : `npm run typecheck` + `npm run lint -w @wellness/mobile` + `npm run test` verts. Ne jamais stager `apps/mobile/eas.json`. Tests mobile jest-expo non câblés → vérif typecheck/lint + relecture + recette device ; les fonctions pures (shared) suivent TDD strict.

---

## Task 1 : Migration cloud (🔴 checkpoint)

**Files:** Create `supabase/migrations/<horodatage>_refonte_muscu_c3_note_exercice.sql` ; Modify `supabase/MIGRATIONS.md`, `packages/shared/src/database.types.ts` (régénéré).

- [ ] **Étape 1 — créer le fichier.** `npm run db:new refonte_muscu_c3_note_exercice` puis copier le SQL complet
  de la spec §4.1 (table `exercise_notes`, index unique partiel, trigger `set_updated_at`, publication
  `powersync`, RLS select/insert/update sans delete — patron `running_pace_records.sql`).
- [ ] **Étape 2 — prévisualiser.** `npm run db:push:dry` ; vérifier que **seule** cette migration part.
- [ ] **Étape 3 — 🔴 GO explicite Florian**, puis `npm run db:push`. Vérifier « Remote database is up to date ».
- [ ] **Étape 4 — types.** `npm run db:types`. Vérifier que `exercise_notes.Row` contient `note: string | null`.
- [ ] **Étape 5 — registre.** Cocher dans `supabase/MIGRATIONS.md` (case + date + note « C3 »).
- [ ] **Étape 6 — commit** (`feat(db)`), typecheck vert.

> ⚠️ Non idempotente (comme toutes les migrations `create table` du projet) : ne jamais rejouer.

---

## Task 2 : Partagé — fonctions pures testables (packages/shared)

**Files:** Modify `packages/shared/src/workout.ts` ; Test `packages/shared/src/workout.test.ts`. **Lis les fichiers d'abord.**

Deux algorithmes à risque sont extraits ici pour bénéficier de Vitest (le reste de C3 est mobile-only, sans
tests automatisés).

### 2a. Réorganisation (`computeReorderedExerciseOrder`)

- [ ] **Étape 1 — test rouge.** Dans `workout.test.ts`, ajouter un `describe('computeReorderedExerciseOrder')`
  avec des cas :
  - `swap 'up'` : `[{id:'A',done:true},{id:'B',done:false},{id:'C',done:false}]` + `{type:'swap', exerciseId:'C', direction:'up'}` → `['A','C','B']` (A terminé reste en tête, B et C restants échangés).
  - `swap 'down'` sur le dernier restant → **no-op** (déjà en fin, retourne l'ordre inchangé).
  - `swap` avec un exercice **terminé** intercalé entre deux restants : `[{id:'A',done:false},{id:'B',done:true},{id:'C',done:false}]` + swap 'down' sur A → `['C','B','A']` (A et C échangent leur **position relative parmi les restants**, B garde sa position absolue au milieu — donc le résultat place C **avant** B et A **après** B, pas un simple swap adjacent en indices bruts : vérifier précisément ce cas, c'est le plus piégeux).
  - `toEnd` : `[{id:'A',done:false},{id:'B',done:true},{id:'C',done:false},{id:'D',done:false}]` + `{type:'toEnd', exerciseId:'C'}` → `['A','B','D','C']` (B terminé reste à sa position absolue 2 ; parmi les restants A,C,D → C passe en dernier → A,D,C réinjectés dans les positions restantes 1,3,4 dans cet ordre).
  - Idempotence : appliquer `toEnd` sur l'exercice déjà en dernière position des restants → inchangé.
  Lancer `npm run test -w @wellness/shared` → rouge (fonction absente).
- [ ] **Étape 2 — implémentation.**
```ts
export type ReorderOperation =
  | { type: 'swap'; exerciseId: string; direction: 'up' | 'down' }
  | { type: 'toEnd'; exerciseId: string };

/**
 * Calcule le nouvel ordre des exercices d'une séance après une opération de
 * réorganisation (§2.1/§4.3 US Refonte-C3). Ne réordonne QUE les exercices
 * `done: false` entre eux ; les exercices `done: true` gardent leur position
 * absolue (index dans le tableau retourné). Fonction pure : ne fait aucune
 * lecture/écriture, le repository se charge de dériver l'entrée et d'écrire
 * le résultat (renumérotation complète des `order_index`, voir workout-repository.ts).
 */
export function computeReorderedExerciseOrder(
  exercises: ReadonlyArray<{ exerciseId: string; done: boolean }>,
  operation: ReorderOperation,
): string[] {
  const remaining = exercises.filter((e) => !e.done).map((e) => e.exerciseId);

  if (operation.type === 'swap') {
    const index = remaining.indexOf(operation.exerciseId);
    if (index === -1) return exercises.map((e) => e.exerciseId);
    const target = operation.direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= remaining.length) return exercises.map((e) => e.exerciseId);
    [remaining[index], remaining[target]] = [remaining[target], remaining[index]];
  } else {
    const index = remaining.indexOf(operation.exerciseId);
    if (index !== -1) {
      remaining.splice(index, 1);
      remaining.push(operation.exerciseId);
    }
  }

  let cursor = 0;
  return exercises.map((e) => (e.done ? e.exerciseId : remaining[cursor++] ?? e.exerciseId));
}
```
- [ ] **Étape 3 — vérifier vert.** `npm run test -w @wellness/shared`. Vérifier particulièrement le cas
  « exercice terminé intercalé » (le plus contre-intuitif) correspond bien à l'algorithme (positions absolues
  des `done` figées, les restants comblent les trous dans leur nouvel ordre).

### 2b. Suggestion de progression (`computeProgressionSuggestion`)

- [ ] **Étape 4 — test rouge.** Ajouter `describe('computeProgressionSuggestion')` avec des cas (spec §2.4/§3) :
  - Aucune série qualifiante (`lastSets` vide) → `null`.
  - Une série qualifiante `failure` → `null` (même si `referenceSet` normal).
  - RPE max des `lastSets` = 9 (≥ 8) → `null`.
  - RPE max = 7, `referenceSet` normal `{weightKg:80, reps:8}` → `{ kind:'weightOrReps', weightKg:82.5, reps:9 }` (incrément 2,5 par défaut).
  - Toutes les `lastSets` ont `rpe: null` (jamais renseigné) → **éligible** (traité comme si absent de contrainte), suggestion normale si pas de `failure`.
  - `referenceSet.setType === 'bodyweight'` et `weightKg: null` → `{ kind:'reps', reps: referenceSet.reps + 1 }` (pas de volet charge).
  - `referenceSet.setType === 'duration'` → `{ kind:'duration', durationSeconds: referenceSet.durationSeconds + 10 }`.
  - `referenceSet` absent (`undefined`, jamais fait à ce rang) → `null`.
  Lancer → rouge.
- [ ] **Étape 5 — implémentation.**
```ts
export type ProgressionSuggestion =
  | { kind: 'weightOrReps'; weightKg: number; reps: number }
  | { kind: 'reps'; reps: number }
  | { kind: 'duration'; durationSeconds: number }
  | null;

/**
 * Règle de suggestion de progression discrète (§2.4/§3 US Refonte-C3), RPE-aware.
 * `lastSets` = séries qualifiantes (non-warmup) de la dernière séance terminée où
 * l'exercice apparaît — sert de garde-fou (échec / RPE élevé → aucune suggestion).
 * `referenceSet` = la série de la dernière fois au même rang que la série en cours
 * (peut être absente) — sert de base aux valeurs suggérées.
 */
export function computeProgressionSuggestion(
  lastSets: ReadonlyArray<{ setType: string; rpe: number | null; done: boolean }>,
  referenceSet:
    | { setType: string; reps: number | null; weightKg: number | null; durationSeconds: number | null }
    | undefined,
  opts: { weightIncrementKg: number; durationIncrementSeconds: number },
): ProgressionSuggestion {
  const qualifying = lastSets.filter((s) => s.done);
  if (qualifying.length === 0 || !referenceSet) return null;
  if (qualifying.some((s) => s.setType === 'failure')) return null;

  const rpeValues = qualifying.map((s) => s.rpe).filter((r): r is number => r != null);
  const maxRpe = rpeValues.length > 0 ? Math.max(...rpeValues) : null;
  if (maxRpe != null && maxRpe >= 8) return null;

  if (referenceSet.setType === 'duration') {
    if (referenceSet.durationSeconds == null) return null;
    return { kind: 'duration', durationSeconds: referenceSet.durationSeconds + opts.durationIncrementSeconds };
  }
  if (referenceSet.weightKg == null) {
    if (referenceSet.reps == null) return null;
    return { kind: 'reps', reps: referenceSet.reps + 1 };
  }
  if (referenceSet.reps == null) return null;
  return {
    kind: 'weightOrReps',
    weightKg: referenceSet.weightKg + opts.weightIncrementKg,
    reps: referenceSet.reps + 1,
  };
}
```
- [ ] **Étape 6 — vérifier vert.** `npm run test -w @wellness/shared` + `npm run typecheck`. Commit (`feat(shared)`).

---

## Task 3 : Schéma PowerSync local (apps/mobile)

**Files:** Modify `apps/mobile/src/powersync/schema.ts`.

- [ ] **Étape 1 —** ajouter la table `exercise_notes` (`user_id: column.text`, `exercise_id: column.text`,
  `note: column.text`, `created_at`/`updated_at`/`deleted_at: column.text`), l'ajouter à l'export `AppSchema`.
- [ ] **Étape 2 — vérifier** `npm run typecheck`. Commit (fusionné à Task 1 ou séparé, `feat(mobile)`).

---

## Task 4 : Repository — réorganisation (workout-repository.ts)

**Files:** Modify `apps/mobile/src/data/repositories/workout-repository.ts`. **Lis `groupSetsByExercise`
(~l.187-207) et `nextOrderIndex`/`addSet` (~l.370-420, ~l.664) d'abord.**

- [ ] **Étape 1 — helper de renumérotation.** Fonction privée `renumberWorkout(workoutId: string, orderedExerciseIds: string[]): Promise<void>` : dans une transaction, pour chaque `exerciseId` de `orderedExerciseIds` (dans l'ordre), lit ses séries actuelles (`SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND deleted_at IS NULL ORDER BY order_index`), et réattribue un `order_index` séquentiel global (compteur qui continue d'exercice en exercice) via `UPDATE workout_sets SET order_index = ? WHERE id = ?`.
- [ ] **Étape 2 — `reorderExercise`.** `export async function reorderExercise(workoutId: string, exerciseId: string, direction: 'up' | 'down'): Promise<void>` : lit les séries de la séance (comme `SELECT_SETS_FOR_WORKOUT` sans jointure langue, ou réutilise `getWorkoutSets`), groupe par exercice (réutilise `groupSetsByExercise`), construit `exercises: {exerciseId, done}[]` (`done = doneCount === total`), appelle `computeReorderedExerciseOrder` (import `@wellness/shared`), puis `renumberWorkout(workoutId, result)`.
- [ ] **Étape 3 — `sendExerciseToEnd`.** `export async function sendExerciseToEnd(workoutId: string, exerciseId: string): Promise<void>` : même construction, opération `{type:'toEnd', exerciseId}`, puis `renumberWorkout`.
- [ ] **Étape 4 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Pas de test automatisé (jest-expo non câblé) : relire attentivement la correspondance avec les cas Vitest de Task 2a. Commit (`feat(mobile)`).

---

## Task 5 : Repository — remplacer un exercice

**Files:** Modify `apps/mobile/src/data/repositories/workout-repository.ts`.

- [ ] **Étape 1 —** `export async function replaceExercise(workoutId: string, exerciseId: string, newExerciseId: string): Promise<void>` : `UPDATE workout_sets SET exercise_id = ?, updated_at = ? WHERE workout_id = ? AND exercise_id = ? AND done = 0 AND deleted_at IS NULL`, params `[newExerciseId, nowUtc(), workoutId, exerciseId]`. Pas de transaction nécessaire (single statement), mais utiliser `powerSync.execute`.
- [ ] **Étape 2 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Commit.

---

## Task 6 : Repository — note par exercice

**Files:** Modify `apps/mobile/src/data/repositories/workout-repository.ts` (ou nouveau fichier `exercise-note-repository.ts` si le fichier principal devient trop long — à la discrétion de l'implémenteur, cohérence avec le reste du fichier).

- [ ] **Étape 1 — read.** `export function useExerciseNote(exerciseId: string): { note: string | null; isLoading: boolean }` : `useQuery<{note: string | null}>('SELECT note FROM exercise_notes WHERE exercise_id = ? AND deleted_at IS NULL LIMIT 1', [exerciseId])`.
- [ ] **Étape 2 — write.** `export async function setExerciseNote(exerciseId: string, note: string | null): Promise<void>` : normalise (`note?.trim() || null`), puis upsert : cherche une ligne existante (`SELECT id FROM exercise_notes WHERE user_id = ? AND exercise_id = ? AND deleted_at IS NULL`) → `patch` si trouvée, sinon `insertWithSyncFields('exercise_notes', { user_id, exercise_id, note })`.
- [ ] **Étape 3 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Commit.

---

## Task 7 : Repository — dernière perf étendue (set_type + rpe) pour la suggestion

**Files:** Modify `apps/mobile/src/data/repositories/workout-repository.ts`. **Lis `SELECT_LAST_PERFORMANCE`/`useLastPerformance` (~l.319-352) d'abord.**

- [ ] **Étape 1 —** étendre `LastPerformanceDbRow` avec `set_type: string`, `rpe: number | null`, `duration_seconds: number | null` ; `SELECT_LAST_PERFORMANCE` : ajouter `s.set_type, s.rpe, s.duration_seconds` aux colonnes sélectionnées.
- [ ] **Étape 2 —** `useLastPerformance` : la signature déclare **explicitement** le type de retour
  (`): { weightKg: number | null; reps: number | null }[]`) — **modifier cette annotation** en plus du mapping
  interne (ajouter `setType: SetType; rpe: number | null; durationSeconds: number | null`), sinon le littéral
  objet retourné par `.map()` échoue au typecheck (vérification par excédent de propriétés sur un objet
  littéral annoté). Extension non cassante pour les appelants existants (`formatLastPerf`, `prefillReps`,
  `prefillWeightKg` dans `workout.tsx`) : ils consomment une variable, pas un littéral, donc aucune régression.
- [ ] **Étape 3 — vérifier** `npm run typecheck`. Commit.

---

## Task 8 : Logique superset (workout.tsx)

**Files:** Modify `apps/mobile/src/app/workout.tsx`. **Lis `resolveCurrentSet` et `onValidate` (~l.246-265) d'abord.**

- [ ] **Étape 1 — détection du partenaire.** Helper `findSupersetPartner(entries: WorkoutEntry[], entry: WorkoutEntry, rang: number): { entry: WorkoutEntry; set: WorkoutSetItem } | null` : si `entries[entry index].sets[rang].setType !== 'superset'` → `null`. Sinon cherche dans `entries[index+1]` et `entries[index-1]` (voisins adjacents) une entrée dont `sets[rang]?.setType === 'superset'` — retourne la première trouvée (avec son set au même rang).
- [ ] **Étape 2 — `onValidate` étendu.** Après le `updateSet(current.set.id, {...})` existant :
  - Calcule le partenaire via l'étape 1.
  - **Partenaire trouvé et `!partner.set.done`** : `setFocusOverride(partner.entry.exerciseId)` ; **ne pas** poser `restEndsAt`/`restCollapsed` (sauter ce bloc) ; sortir.
  - **Sinon** (pas de partenaire, ou partenaire déjà `done` — on vient de faire la 2ᵉ du couple) : comportement actuel inchangé (repos + `setFocusOverride(null)`).
- [ ] **Étape 3 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Relire attentivement contre spec §2.2/§4.5 (dégradation silencieuse si partenaire absent). Commit.

---

## Task 9 : CurrentSetCard — superset, suggestion, note

**Files:** Modify `apps/mobile/src/components/workout/CurrentSetCard.tsx`. **Lis le fichier (post-C2) d'abord.**

- [ ] **Étape 1 — réintégrer superset.** `TYPE_CHIPS` : ajouter `'superset'` (retirer le commentaire « hors périmètre C3 » devenu obsolète). Libellé `workout.setType.superset`.
- [ ] **Étape 2 — ligne de suggestion.** Nouvelle prop `suggestion: ProgressionSuggestion` (import type depuis `@wellness/shared`). Si non nulle, afficher une ligne discrète sous « dernière fois » : `kind==='weightOrReps'` → `t('workout.suggestion.weightOrReps', {weight, reps})` ; `kind==='reps'` → `t('workout.suggestion.reps', {reps})` ; `kind==='duration'` → `t('workout.suggestion.duration', {duration})`. Texte informatif, **non tappable** (pas de `Pressable`).
- [ ] **Étape 3 — note éditable.** Nouvelles props `note: string | null`, `onChangeNote: (v: string) => void`, `onBlurNote: () => void`. `TextInput` compact sous le nom de l'exercice, placeholder `workout.exerciseNote.placeholder`.
- [ ] **Étape 4 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Commit.

---

## Task 10 : ExerciseList — réorganiser, Plus tard, Remplacer, note, badge superset

**Files:** Modify `apps/mobile/src/components/workout/ExerciseList.tsx`. **Lis le fichier (post-C2) d'abord.**

- [ ] **Étape 1 — badge superset.** `BADGE_TYPES` : ajouter `'superset'` ; mettre à jour le commentaire
  au-dessus (« `normal`/`superset` n'en ont pas » devient obsolète). Libellé `workout.setTypeBadge.superset`.
- [ ] **Étape 2 — flèches ↑/↓ + Plus tard.** Nouvelles props `onReorder: (exerciseId: string, direction: 'up'|'down') => void`, `onSendLater: (exerciseId: string) => void`. Affichées **uniquement si** `!allDone` (exercice non entièrement validé), à côté du chevron déplier/replier.
- [ ] **Étape 3 — Remplacer.** Nouvelle prop `onReplace: (exerciseId: string) => void`. Action dans la liste dépliée (icône/texte « Remplacer »).
- [ ] **Étape 4 — note (lecture).** Nouvelle prop `notes: Record<string, string | null>` (ou hook direct par exercice) : afficher la note sous le nom si non vide.
- [ ] **Étape 5 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Commit.

---

## Task 11 : Navigation — mode remplacement (exercises.tsx) + câblage workout.tsx

**Files:** Modify `apps/mobile/src/app/exercises.tsx`, `apps/mobile/src/app/workout.tsx`. **Lis `exercises.tsx` (`onPick` ~l.44-49, `items` ~l.38-42) d'abord.**

- [ ] **Étape 1 — paramètre de route.** `exercises.tsx` : lire `replaceExerciseId` via `useLocalSearchParams<{ replaceExerciseId?: string }>()`.
- [ ] **Étape 2 — filtrage.** `items` : si `replaceExerciseId` fourni, filtrer `exercises` pour exclure les `exerciseId` déjà présents dans `active.entries` (comparer via `active?.entries.map(e => e.exerciseId)`), **avant** le tri favoris.
- [ ] **Étape 3 — `onPick` branché.** ⚠️ Toute la logique reste **imbriquée dans la garde `if (active)`
  existante** (ne pas en sortir `replaceExercise`/`router.back()` — `active` est `ActiveWorkout | null`, et le
  comportement actuel n'appelle `router.back()` que si `active` existe : préserver exactement cette garde).
  À l'intérieur : si `replaceExerciseId` fourni, `await replaceExercise(active.id, replaceExerciseId, item.id)`
  au lieu d'`addExerciseToWorkout(active.id, item.id)` ; sinon comportement actuel inchangé. `router.back()`
  dans les deux branches, comme aujourd'hui.
- [ ] **Étape 4 — câblage `workout.tsx`.** Action « Remplacer » de `ExerciseList` (`onReplace`) → `router.push({ pathname: '/exercises', params: { replaceExerciseId: exerciseId } })`. Câbler aussi `onReorder`→`reorderExercise`, `onSendLater`→`sendExerciseToEnd`, note (`useExerciseNote`/`setExerciseNote`), et la `suggestion` passée à `CurrentSetCard` (calculée via `useLastPerformance` étendu (Task 7) + `computeProgressionSuggestion` (Task 2b), avec `referenceSet = lastPerf[rang]` et `lastSets = lastPerf` en entier).
- [ ] **Étape 5 — vérifier** `npm run typecheck` + `npm run lint -w @wellness/mobile`. Non-régression : « + Ajouter un exercice » (sans `replaceExerciseId`) inchangé. Commit.

---

## Task 12 : i18n FR/EN + parité

**Files:** Modify `apps/mobile/src/i18n/locales/fr.json` + `en.json`.

- [ ] **Étape 1 — clés.** `workout.setType.superset`, `workout.setTypeBadge.superset` ; `workout.reorder.up`,
  `workout.reorder.down` (accessibilityLabel) ; `workout.later` ; `workout.replace` ; `workout.exerciseNote.placeholder` ;
  `workout.suggestion.weightOrReps`, `workout.suggestion.reps`, `workout.suggestion.duration`.
- [ ] **Étape 2 — parité.** Contrôle node ad hoc (même script que C2 — comparaison des clés aplaties FR/EN) → 2 listes vides.
- [ ] **Étape 3 — vérifier** typecheck/lint. Commit.

---

## Task 13 : Vérification finale & recette

- [ ] `npm run typecheck` + `npm run lint` + `npm run test` (tous workspaces) verts.
- [ ] **Non-régression C1/C2** : flux guidé (log+repos+avance), types de séries, RPE/série, charge planifiée/
  réalisée, dé-valider, +Série toujours fonctionnels.
- [ ] **Recette device (Florian)** :
  - Réorganiser deux exercices restants (↑/↓) ; vérifier qu'un exercice terminé ne bouge pas et n'affiche pas
    les flèches.
  - « Plus tard » sur l'exercice courant → focus bascule sur le nouvel exercice en tête.
  - Superset : marquer 2 exercices adjacents en `superset` au même rang → valider le 1er bascule direct sur le
    2ᵉ sans repos ; valider le 2ᵉ déclenche le repos.
  - Remplacer un exercice non commencé → bascule complète ; remplacer un exercice avec 1 série déjà validée →
    l'ancienne reste dans l'historique, les séries restantes basculent.
  - Note par exercice : saisie en séance A, vérifiée présente en séance B (même exercice).
  - Suggestion de progression : dernière fois sans échec/RPE bas → suggestion visible ; dernière fois en échec
    ou RPE élevé → aucune suggestion.
- [ ] CHANGELOG + TODO + roadmap (aucune ligne roadmap versionnée concernée directement, sauf mention chantier)
  via `/commit` ; PR relue par les deux devs.

---

## Ordre & dépendances

Task 1 (migration) bloque 3/6 (colonnes/table `exercise_notes`). Task 2 (shared) avant 4/9 (fonctions pures
importées). Task 3 avant 6. Tasks 4/5/6/7 (repository) indépendantes entre elles. **Task 8 (superset) ne
dépend que du code déjà existant avant C3** (`entries`/`WorkoutEntry`/`WorkoutSetItem`) — aucune dépendance
réelle sur Task 7, peut démarrer dès Task 2 fait. Tasks 9/10 (UI) dépendent de Task 7 (suggestion) et Task 6
(note). Task 11 dépend de 4/5/9/10. Task 12 (i18n) transverse, verrouillée en fin. Task 13 = porte de sortie.
Migration = **seul** point cloud → une passe, go explicite.
