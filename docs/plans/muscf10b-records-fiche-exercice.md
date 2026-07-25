# MUSC-F10b — Section records sur la fiche exercice · Plan

> **Pour l'exécutant :** subagent-driven-development, une tâche à la fois, TDD quand c'est utile, commits fréquents.

**Goal :** afficher sur la fiche exercice une section « Tes records » en tuiles (1RM réel/estimé, charge max,
meilleur volume + dates) et un lien « Voir la progression » qui ouvre l'écran Progression pré-sélectionné.

**Spec :** [docs/specs/functional/us/muscf10b-records-fiche-exercice.md](../specs/functional/us/muscf10b-records-fiche-exercice.md).

**Architecture :** une fonction pure `pickOneRepMax` (shared, testée) + un hook `useExerciseTopSingle` (1RM réel
dérivé de `workout_sets`) + un hook composite `useExerciseFicheRecords` (assemble les records existants
`useExerciseRecords` + le 1RM réel via `pickOneRepMax`) → section tuiles sur la fiche `[id].tsx` (mode lecture) +
lien vers `/progress?exerciseId=…` → l'écran Progression lit ce param et pré-sélectionne l'exercice. **Aucune
migration**, lecture seule.

**Tech :** TypeScript, Vitest (shared), PowerSync `useQuery`, Expo Router (`useLocalSearchParams`), i18next FR/EN,
`useUnits().formatWeight`.

**Ordre :** 1 (shared `pickOneRepMax`) → 2 (hooks repo) → 3 (i18n) → 4 (/progress param) → 5 (UI fiche) →
6 (revue + clôture).

**Rappels projet :** offline-first (lecture locale réactive), aucune chaîne en dur (tout via `t()`), parité i18n
FR/EN, dates JJ/MM/AAAA. Ne PAS lancer `/commit` ni pousser par tâche : commit local sur la branche
`feature/muscf10b-records-fiche-exercice` ; la clôture (CHANGELOG/TODO/roadmap + merge `dev`) est faite par le
contrôleur en Task 6.

---

### Task 1 : Shared — `pickOneRepMax` (fonction pure, TDD)

**Files :**
- Modify : `packages/shared/src/records.ts`
- Modify : `packages/shared/src/records.test.ts`

- [ ] **Step 1 — Test qui échoue.** Ajouter dans `records.test.ts` :

```ts
import { pickOneRepMax } from './records';

describe('pickOneRepMax', () => {
  it('réel prioritaire quand présent', () => {
    expect(
      pickOneRepMax({ value: 100, date: '2026-07-12T10:00:00Z' }, { value: 98, date: '2026-07-05T10:00:00Z' }),
    ).toEqual({ value: 100, date: '2026-07-12T10:00:00Z', real: true });
  });
  it('repli sur estimé si pas de réel', () => {
    expect(pickOneRepMax(null, { value: 98, date: '2026-07-05T10:00:00Z' })).toEqual({
      value: 98,
      date: '2026-07-05T10:00:00Z',
      real: false,
    });
  });
  it('null si ni réel ni estimé', () => {
    expect(pickOneRepMax(null, null)).toBeNull();
  });
});
```

- [ ] **Step 2 — Échec.** `npm run test -w @wellness/shared -- records` → FAIL (fonction absente).
- [ ] **Step 3 — Implémenter** dans `records.ts` (après `sessionBestEstimated1RM`, section helpers) :

```ts
/** Une mesure de 1RM (valeur en kg + date ISO UTC de réalisation). */
export type OneRepMaxSample = { value: number; date: string };

/**
 * Choisit le 1RM à afficher : le **réel** (série effectuée à 1 rep) s'il existe,
 * sinon l'**estimé** (Epley). `real` indique la provenance. `null` si aucun.
 */
export function pickOneRepMax(
  real: OneRepMaxSample | null,
  estimated: OneRepMaxSample | null,
): { value: number; date: string; real: boolean } | null {
  if (real) return { value: real.value, date: real.date, real: true };
  if (estimated) return { value: estimated.value, date: estimated.date, real: false };
  return null;
}
```

- [ ] **Step 4 — Succès.** `npm run test -w @wellness/shared -- records` PASS + `npm run typecheck -w @wellness/shared`.
- [ ] **Step 5 — Commit.** `feat(shared): pickOneRepMax — 1RM réel sinon estimé (MUSC-F10b)`

---

### Task 2 : Repository — `useExerciseTopSingle` + `useExerciseFicheRecords`

**Files :**
- Modify : `apps/mobile/src/data/repositories/records-repository.ts`

- [ ] **Step 1 — SELECT + hook 1RM réel.** Ajouter le SELECT (près des autres constantes SELECT) :

```ts
/**
 * 1RM « réel » d'un exercice : charge max d'une série réellement effectuée à
 * 1 répétition (validée, hors échauffement/durée), + la date de la séance qui
 * la détient. `?` = id de l'exercice. `null` si aucune telle série.
 */
const SELECT_EXERCISE_TOP_SINGLE = `
  SELECT s.weight_kg AS value, w.finished_at AS achieved_at
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL
  WHERE s.exercise_id = ?
    AND s.deleted_at IS NULL
    AND s.done = 1
    AND s.reps = 1
    AND s.weight_kg IS NOT NULL
    AND s.set_type NOT IN ('warmup','duration')
  ORDER BY s.weight_kg DESC, w.finished_at DESC
  LIMIT 1
`;
```
  Puis le hook :

```ts
/**
 * 1RM réel (charge max d'une série à 1 rep) d'un exercice, réactif. `null` si
 * l'utilisateur n'a jamais validé de série à 1 rep pour cet exercice.
 */
export function useExerciseTopSingle(
  exerciseId: string,
): { topSingle: { value: number; date: string } | null; isLoading: boolean } {
  const { data, isLoading } = useQuery<{ value: number; achieved_at: string }>(
    SELECT_EXERCISE_TOP_SINGLE,
    [exerciseId],
  );
  const row = data[0];
  const topSingle = row ? { value: row.value, date: row.achieved_at } : null;
  return { topSingle, isLoading };
}
```

- [ ] **Step 2 — Hook composite pour la fiche.** Ajouter, en réutilisant `useExerciseRecords` (existant) +
  `pickOneRepMax` (Task 1, import depuis `@wellness/shared`) :

```ts
/** Vue records prête pour la fiche exercice (F10b). Chaque entrée : valeur + date ISO. */
export type ExerciseFicheRecords = {
  oneRepMax: { value: number; date: string; real: boolean } | null;
  maxWeight: { value: number; date: string } | null;
  bestVolume: { value: number; date: string } | null;
};

/**
 * Records d'un exercice pour la fiche : 1RM (réel si dispo, sinon estimé),
 * charge max, meilleur volume — chacun avec sa date. Compose `useExerciseRecords`
 * (personal_records) + `useExerciseTopSingle` (1RM réel dérivé) + `pickOneRepMax`.
 */
export function useExerciseFicheRecords(
  exerciseId: string,
): { records: ExerciseFicheRecords; isLoading: boolean } {
  const { records: best, isLoading: bestLoading } = useExerciseRecords(exerciseId);
  const { topSingle, isLoading: singleLoading } = useExerciseTopSingle(exerciseId);

  const byType = (t: RecordType) => best.find((r) => r.type === t) ?? null;
  const maxW = byType('max_weight');
  const est = byType('estimated_1rm');
  const vol = byType('best_volume');

  const records: ExerciseFicheRecords = {
    oneRepMax: pickOneRepMax(
      topSingle,
      est ? { value: est.value, date: est.achievedAt } : null,
    ),
    maxWeight: maxW ? { value: maxW.value, date: maxW.achievedAt } : null,
    bestVolume: vol ? { value: vol.value, date: vol.achievedAt } : null,
  };

  return { records, isLoading: bestLoading || singleLoading };
}
```
  Importer `pickOneRepMax` depuis `@wellness/shared` (à côté des autres imports shared en tête du fichier).
  `RecordType` est déjà importé.

- [ ] **Step 3 — Vérifs.** `npm run typecheck -w @wellness/mobile` + `npm run lint -w @wellness/mobile`.
- [ ] **Step 4 — Commit.** `feat(muscu): useExerciseTopSingle + useExerciseFicheRecords (MUSC-F10b)`

---

### Task 3 : i18n — section records + lien progression (FR/EN)

**Files :**
- Modify : `apps/mobile/src/i18n/locales/fr.json`
- Modify : `apps/mobile/src/i18n/locales/en.json`

- [ ] **Step 1 — FR.** Dans `exercises.detail`, ajouter un sous-objet `records` :

```json
      "records": {
        "title": "Tes records",
        "oneRepMax": "1RM",
        "real": "réel",
        "estimated": "estimé",
        "seeProgression": "Voir la progression"
      }
```

- [ ] **Step 2 — EN.** Miroir :

```json
      "records": {
        "title": "Your records",
        "oneRepMax": "1RM",
        "real": "actual",
        "estimated": "est.",
        "seeProgression": "View progression"
      }
```

- [ ] **Step 3 — Parité + JSON valide.** Les libellés des tuiles **Charge max** / **Volume** et l'état vide
  réutilisent les clés existantes `progress.records.type.max_weight`, `progress.records.type.best_volume`,
  `progress.records.empty` (présentes FR+EN — ne pas dupliquer). Valider que les 2 fichiers parsent
  (`node -e "JSON.parse(...)"`) et que `exercises.detail.records.*` est identique des deux côtés.
- [ ] **Step 4 — Commit.** `feat(i18n): clés records fiche + lien progression FR/EN (MUSC-F10b)`

---

### Task 4 : Écran Progression — pré-sélection par `exerciseId`

**Files :**
- Modify : `apps/mobile/src/app/progress/index.tsx`

- [ ] **Step 1 — Lire le param + pré-sélectionner.** Dans `ProgressScreen` :
  - Importer `useLocalSearchParams` depuis `expo-router`, `useExercise` depuis
    `@/data/repositories/exercise-repository`, et **ajouter `useEffect`** à l'import `react` (le fichier n'importe
    aujourd'hui que `useState`) (vérifier les imports existants pour ne pas dupliquer).
  - `const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();`
  - `const { exercise: paramExercise } = useExercise(typeof exerciseId === 'string' ? exerciseId : '');`
  - Un `useEffect` idempotent : si `paramExercise` est chargé **et** qu'aucun exercice n'est encore sélectionné,
    `setSelectedExercise(paramExercise)`. `ExerciseDetail` étant un sur-ensemble d'`ExerciseListItem`, il est
    assignable à `selectedExercise: ExerciseListItem | null` (vérifier au typecheck ; sinon mapper les champs
    d'`ExerciseListItem`).
    ```ts
    useEffect(() => {
      if (paramExercise && !selectedExercise) {
        setSelectedExercise(paramExercise);
      }
    }, [paramExercise, selectedExercise]);
    ```
  - **Sans** `exerciseId` → comportement **inchangé** (`useExercise('')` renvoie `null`, l'effet ne fait rien).
- [ ] **Step 2 — Vérifs.** `npm run typecheck -w @wellness/mobile` + `npm run lint -w @wellness/mobile` + `npm run
  test -w @wellness/mobile` (non-régression /progress).
- [ ] **Step 3 — Commit.** `feat(muscu): /progress — pré-sélection de l'exercice via param exerciseId (MUSC-F10b)`

---

### Task 5 : Fiche — section « Tes records » (tuiles) + lien progression

**Files :**
- Modify : `apps/mobile/src/app/exercises/[id].tsx`

- [ ] **Step 1 — Section records (mode lecture uniquement).** Dans la vue lecture de la fiche (pas le formulaire
  d'édition), sous les champs infos, ajouter une section « Tes records » :
  - `const units = useUnits();` (import `@/hooks/useUnits`) ; `const { records, isLoading } =
    useExerciseFicheRecords(exercise.id);` (import depuis le records-repository).
  - Construire la liste des tuiles à afficher (n'inclure que les non-nuls) :
    - **1RM** : `records.oneRepMax` → label `t('exercises.detail.records.oneRepMax')`, valeur
      `units.formatWeight(oneRepMax.value)`, sous-texte = badge (`real` → `t('…records.real')`, sinon
      `t('…records.estimated')`) + date.
    - **Charge max** : `records.maxWeight` → label `t('progress.records.type.max_weight')`, valeur
      `units.formatWeight(...)`, sous-texte = date.
    - **Volume** : `records.bestVolume` → label `t('progress.records.type.best_volume')`, valeur
      `value.toFixed(0)` (pas d'unité de charge, cohérent /progress), sous-texte = date.
  - **Tuiles côte à côte** (mise en page option A validée) : reproduire le style des record-chips de
    `/progress` (`recordsGrid`/`recordChip`/`recordLabel`/`recordValue`, fond `colors.surfaceAlt`, bordure
    `colors.border`) dans le `StyleSheet` local de la fiche. Duplication assumée (dette de partage notée spec §7).
  - **Date** : helper local `formatDate(iso)` → `JJ/MM/AAAA` (`new Date(iso)`, `getDate`/`getMonth`+1/`getFullYear`
    zero-paddés). Affichée en petit sous la valeur.
  - **États** : `isLoading` → rien / petit spinner ; **aucune tuile** (les 3 nuls) → message
    `t('progress.records.empty')`.
- [ ] **Step 2 — Lien « Voir la progression ».** Sous les tuiles (affiché dès qu'au moins une tuile existe, ou
  toujours en lecture — au choix, mais cohérent) : un `Pressable`/lien `accessibilityRole="button"` libellé
  `t('exercises.detail.records.seeProgression')` → `router.push({ pathname: '/progress', params: { exerciseId:
  exercise.id } })`.
- [ ] **Step 3 — Vérifs.** `npm run typecheck -w @wellness/mobile` + `npm run lint -w @wellness/mobile` + `npm run
  test -w @wellness/mobile` (le smoke fiche existant doit rester vert ; adapter le mock si la fiche importe
  désormais `useExerciseFicheRecords`/`useUnits` — les mocker dans `exercise-detail-smoke.test.tsx` si besoin).
- [ ] **Step 4 — Commit.** `feat(muscu): fiche — section records (tuiles) + lien progression (MUSC-F10b)`

> ⚠️ **Smoke test** : la fiche `[id].tsx` a un smoke test (`exercise-detail-smoke.test.tsx`, F10a) qui rend le
> vrai écran. L'ajout de `useExerciseFicheRecords` (PowerSync `useQuery`, mocké par jest.setup → `data: []`) et
> `useUnits` doit continuer de rendre sans planter. Vérifier ; si `useUnits` ou le hook records provoque une
> erreur en test, les mocker dans le fichier de test (comme `programs-smoke` mocke son repository). Garder les
> 2 cas existants verts + éventuellement un cas « avec records » mocké.

---

### Task 6 : Revue finale + clôture

- [ ] **Step 1 — Revue finale** (subagent `superpowers:code-reviewer` sur le diff complet de la branche vs `dev`,
  comparé à la spec) — vérifier : requête 1RM réel (reps=1, done, hors warmup/durée, workout completed) ;
  `pickOneRepMax` réel-prioritaire ; tuiles + unités + dates ; /progress sans param inchangé ; parité i18n ;
  aucune chaîne en dur ; aucune migration ; lecture seule.
- [ ] **Step 2 — Vérifs globales.** `npm run typecheck` + `npm run lint` + `npm run test` (racine) verts.
- [ ] **Step 3 — Clôture** via `/commit` (CHANGELOG + TODO : MUSC-F10b **code livré**, reste recette device +
  relecture Damien ; **roadmap inchangée** — records ≠ ligne roadmap dédiée, le signaler) + merge sur `dev` + push.
- [ ] **Step 4 — Recette.** Fournir à Florian le plan de recette device (fiche d'un exo travaillé → tuiles
  records ; 1RM réel si série à 1 rep, sinon estimé + badge ; exo sans charge → pas de tuiles ; aucun record →
  message ; lien « Voir la progression » ouvre l'écran pré-sélectionné ; unités métrique/impérial ; i18n FR/EN).

---

## Definition of Done (rappel spec §6)

Section « Tes records » en tuiles sur la fiche (mode lecture) : 1RM (réel/estimé + badge), charge max, volume —
label · valeur · date, unités respectées ; 1RM réel dérivé de `workout_sets` (reps=1, validé, hors warmup/durée) +
`pickOneRepMax` pur testé ; états (aucun record / sans charge / chargement) ; lien « Voir la progression » →
écran Progression pré-sélectionné, `/progress` sans param inchangé ; i18n FR/EN ; **aucune migration** ;
typecheck/lint/tests verts ; PR relue par les deux devs.
