# Plan — MUSC-09 · Record personnel par plage de répétitions

Spec : [musc09-record-plage-reps.md](../specs/functional/us/musc09-record-plage-reps.md) ·
branche `feature/musc09-record-plage-reps` · roadmap **3.56**.

## Étape 1 — Le bucketing, pur et testé *(≈ 1 h)*

`packages/shared/src/records.ts` (même fichier que `computeWorkoutRecords`/`RECORD_TYPES`) :

```ts
export const REP_BUCKETS = [
  { key: '1', minReps: 1, maxReps: 1 },
  { key: '3', minReps: 2, maxReps: 4 },
  { key: '5', minReps: 5, maxReps: 7 },
  { key: '8', minReps: 8, maxReps: 9 },
  { key: '10', minReps: 10, maxReps: 11 },
  { key: '12plus', minReps: 12, maxReps: Infinity },
] as const;
export type RepBucketKey = (typeof REP_BUCKETS)[number]['key'];

resolveRepBucketRecords(
  sets: { reps: number; weightKg: number; achievedAt: string }[],
): { bucketKey: RepBucketKey; weightKg: number; achievedAt: string }[]
```

- Une série arrive déjà **filtrée en éligibilité** (spec R3) — cette fonction ne fait que
  bucketer + garder le max, elle ne réapplique **pas** les conditions `done`/`set_type` (déjà
  appliquées côté requête, comme pour `SELECT_EXERCISE_TOP_SINGLE`). Séparation nette : la requête
  filtre, la fonction agrège.
- Pour chaque plage, garde la série au `weightKg` maximal ; égalité → la plus récente (`achievedAt`
  le plus grand, spec R5).
- Plage sans série qualifiante → **absente** du résultat (spec R4).
- Ordre du résultat = ordre de `REP_BUCKETS` (spec R6).

**Tests, écrits d'abord** :
- Séries à 1/5/10 reps, charges différentes → 3 entrées, dans l'ordre `1`/`5`/`10`.
- Deux séries à reps=3 et reps=4 (même plage `'3'`) → une seule entrée, celle à la charge la plus
  haute (peu importe l'ordre d'entrée du tableau).
- Égalité de charge dans la même plage → la plus récente (`achievedAt`) est retenue — **le test le
  plus important de cette étape**, sans lui une régression sur R5 passerait inaperçue.
- Aucune série → `[]`.
- `reps = 12`, `reps = 15`, `reps = 30` → tous dans `'12plus'` (borne haute `Infinity`, pas de
  plage 7 qui les exclurait par erreur).

## Étape 2 — La requête et l'affichage *(≈ 1 h 30)*

`apps/mobile/src/data/repositories/records-repository.ts` — nouvelle requête, même patron que
`SELECT_EXERCISE_TOP_SINGLE` mais **sans** le `s.reps = 1` (on veut tout, pas une seule plage) :

```sql
SELECT s.reps, s.weight_kg AS weight_kg, w.finished_at AS achieved_at
FROM workout_sets s
JOIN workouts w ON w.id = s.workout_id AND w.status = 'completed' AND w.deleted_at IS NULL AND w.finished_at IS NOT NULL
WHERE s.exercise_id = ? AND s.deleted_at IS NULL AND s.done = 1
  AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
  AND s.set_type NOT IN ('warmup','duration')
```

- `useExerciseRepRanges(exerciseId)` : exécute la requête, mappe vers `resolveRepBucketRecords`.
- Étendre `ExerciseFicheRecords`/`useExerciseFicheRecords` avec un champ `repRanges` — **composition**,
  pas un hook parallèle que l'écran devrait appeler séparément (cohérent avec la façon dont
  `useExerciseFicheRecords` compose déjà `useExerciseRecords` + `useExerciseTopSingle`).
- Sur [id].tsx](../../apps/mobile/src/app/exercises/[id].tsx), nouvelle section **sous** les 3
  tuiles de records existantes : un tableau, une ligne par plage présente (label + charge formatée
  `units.formatWeight` + date via `formatRecordDate` déjà défini dans ce fichier). État vide si
  `repRanges.length === 0`.
- Chaque ligne = un bloc `accessible` unique (spec §6).

## Étape 3 — Solde *(≈ 20 min)*

Roadmap **3.56 → ✅** (nouvelle ligne, section musculation — voir spec §0 sur l'erreur de lien
vers 6.3). CHANGELOG + `etat.mjs` via `/commit`. BACKLOG.md : retirer MUSC-09 de la salve
« Après V0.9 ».

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/records.ts` (+ `.test.ts`) | `REP_BUCKETS`, `resolveRepBucketRecords` |
| `apps/mobile/src/data/repositories/records-repository.ts` | `useExerciseRepRanges` + extension `ExerciseFicheRecords` |
| `apps/mobile/src/app/exercises/[id].tsx` | nouvelle section sous les tuiles existantes |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `exercises.detail.records.repRanges.*` (8 clés) |

## Migration / sync rules

**Aucune.** `workout_sets` déjà en base et synchronisé.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟢 **Aucun risque de ricochet** : lecture pure, aucune écriture, n'altère aucun des 3 records
  existants ni `personal_records` (table intouchée).
- 🟠 **Les bornes de plage (§1 de la spec) sont un choix produit implicite**, pas neutre — à
  confirmer explicitement : un coureur de force pure loggant presque tout en 1-3 reps pourrait
  préférer des plages plus fines à l'extrémité basse. Assumé pour ce premier jet (R1 : fixe, non
  paramétrable).
- 🟢 Le point dur du catalogue (« aucune ligne roadmap ») est déjà résolu par cette spec (3.56,
  section §0) — pas un risque résiduel.
