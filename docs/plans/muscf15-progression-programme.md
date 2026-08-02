# Plan — MUSC-F15 · Progression au niveau du programme (roadmap 3.7)

Spec : [muscf15-progression-programme.md](../specs/functional/us/muscf15-progression-programme.md) ·
branche `feature/muscf15-progression-programme` · roadmap **3.7**.

## Étape 1 — La fonction pure + l'extension de `computeProgressionSuggestion`, testées d'abord *(≈ 1 h)*

`packages/shared/src/workout.ts` (même fichier que `computeProgressionSuggestion`/`sessionStruggled`,
pas un nouveau module) :

```ts
export function computeWeekCompletionRate(
  sessions: ReadonlyArray<{ status: 'planned' | 'done' | 'skipped' }>,
): number | null {
  if (sessions.length === 0) return null;
  const done = sessions.filter((s) => s.status === 'done').length;
  return done / sessions.length;
}
```

**Tests, écrits d'abord** :
- 4 séances dont 3 `done` → `0.75`.
- Liste vide → `null` (pas de division par zéro déguisée en `0`, spec R2).
- 1 séance `done` sur 1 → `1`.
- Mélange `done`/`skipped`/`planned` (jamais deviné, compté tel quel) → valeur exacte vérifiée à la main.

Extension de `ProgressionSuggestion` (ligne 185) : ajoute
`| { kind: 'weightHold'; weightKg: number; reps: number }`. Extension de `computeProgressionSuggestion` :
nouvel `opts.priorWeekAdherenceOk?: boolean` (défaut non fourni = comportement actuel inchangé — pas
de `??` qui forcerait une valeur, juste une garde `=== false` explicite, spec R2/R4). Dans la branche
`weightOrReps` existante (ligne ~266) :

```ts
if (referenceSet.reps == null) return null;
if (opts.priorWeekAdherenceOk === false) {
  return { kind: 'weightHold', weightKg: referenceSet.weightKg, reps: referenceSet.reps + 1 };
}
return { kind: 'weightOrReps', weightKg: referenceSet.weightKg + opts.weightIncrementKg, reps: referenceSet.reps + 1 };
```

**Tests, écrits d'abord** (aux côtés des tests `computeProgressionSuggestion` existants) :
- `priorWeekAdherenceOk` omis → comportement identique à avant cette US (non-régression explicite,
  rejoue un cas déjà testé par MUSC-F7/Refonte-C3 pour confirmer qu'il n'a pas changé).
- `priorWeekAdherenceOk: true` → `weightOrReps` inchangé.
- `priorWeekAdherenceOk: false` → `weightHold`, avec `weightKg` **égal** à `referenceSet.weightKg`
  (pas incrémenté) et `reps` incrémenté normalement.
- `previousStruggled: true` **et** `priorWeekAdherenceOk: false` en même temps → `deload` gagne
  (la branche `sessionStruggled` est évaluée avant la branche `weightOrReps`/`weightHold` dans le
  code existant — le test vérifie que ça reste vrai, spec R4/critère 5).

## Étape 2 — Résoudre le signal côté mobile *(≈ 1 h 30)*

**a) `ActiveWorkout` gagne `programId`/`plannedSessionId`/`weekIndex`**
(`apps/mobile/src/data/repositories/workout-repository.ts`) :

```ts
export type ActiveWorkout = {
  id: string;
  startedAt: string;
  sessionId: string | null;
  programId: string | null;
  plannedSessionId: string | null;
  weekIndex: number | null;
  entries: WorkoutEntry[];
};

const SELECT_ACTIVE_WORKOUT = `
  SELECT w.id, w.started_at, w.finished_at, w.duration_seconds, w.rpe, w.notes, w.session_id,
         w.program_id, w.planned_session_id, ps.week_index
  FROM workouts w
  LEFT JOIN planned_sessions ps ON ps.id = w.planned_session_id AND ps.deleted_at IS NULL
  WHERE w.status = 'active' AND w.deleted_at IS NULL
  LIMIT 1
`;
```

Une seule requête (jointure), pas un aller-retour supplémentaire — `weekIndex` est `null` dès que
`planned_session_id` l'est (spec R3, les deux cas « pas de gate »).

**b) Nouveau hook `usePriorWeekAdherence`**
(`apps/mobile/src/data/repositories/planned-session-repository.ts`) :

```ts
const SELECT_WEEK_STATUSES = `
  SELECT status FROM planned_sessions
  WHERE owner_id = ? AND program_id = ? AND week_index = ? AND deleted_at IS NULL
`;

/** `null` : pas de programme/semaine connus → pas de gate (spec R2/R3). */
export function usePriorWeekAdherence(programId: string | null, weekIndex: number | null): boolean | null {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const priorWeekIndex = weekIndex != null ? weekIndex - 1 : -1;
  const { data } = useQuery<{ status: string }>(SELECT_WEEK_STATUSES, [
    userId,
    programId ?? '',
    priorWeekIndex,
  ]);
  if (programId == null || weekIndex == null) return null;
  const rate = computeWeekCompletionRate(data.map((r) => ({ status: r.status as PlannedSessionStatus })));
  return rate == null ? null : rate >= 0.8;
}
```

Retourne `boolean | null` plutôt que forcer un défaut ici : c'est **l'appelant**
(`workout.tsx`, en passant `priorWeekAdherenceOk={result ?? undefined}` — `undefined`, pas `true`
explicite, pour laisser `computeProgressionSuggestion` appliquer son propre défaut, cf. étape 1) qui
matérialise la règle R2, pas le hook — même séparation que les hooks d'alerte dashboard
(`useTrainingLoadAlert` calcule, ne décide pas du texte).

**c) Câblage dans `workout.tsx`** — à l'appel existant de `computeProgressionSuggestion` (ligne
~275-279), ajouter `priorWeekAdherenceOk: usePriorWeekAdherence(activeWorkout?.programId ?? null, activeWorkout?.weekIndex ?? null) ?? undefined`
dans l'objet `opts`. Ajouter la branche `weightHold` dans le `switch` de libellé (`suggestionLabel`,
ligne ~281-300) :

```ts
if (suggestion.kind === 'weightHold') {
  return t('workout.suggestion.weightHold', {
    weight: units.formatWeight(suggestion.weightKg),
    reps: suggestion.reps,
  });
}
```

i18n : `workout.suggestion.weightHold` (FR + EN, spec §5).

## Étape 3 — Solde *(≈ 20 min)*

Roadmap **3.7 → ✅** (statut passe de 🟡 à ✅, Récapitulatif mis à jour). CHANGELOG + `etat.mjs` via
`/commit`. BACKLOG.md : retirer la ligne « Progression au niveau du programme (3.7) » de la table
Musculation (P1) — l'US a désormais une spec, elle quitte le backlog par construction.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/workout.ts` (+ `.test.ts`) | `computeWeekCompletionRate`, extension `ProgressionSuggestion`/`computeProgressionSuggestion` |
| `apps/mobile/src/data/repositories/workout-repository.ts` | `ActiveWorkout` + `SELECT_ACTIVE_WORKOUT` étendus |
| `apps/mobile/src/data/repositories/planned-session-repository.ts` | `usePriorWeekAdherence` (nouveau) |
| `apps/mobile/src/app/workout.tsx` | câblage `priorWeekAdherenceOk` + branche `weightHold` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `workout.suggestion.weightHold` (1 clé) |
| `docs/roadmap/roadmap.md` / `BACKLOG.md` | 3.7 🟡 → ✅ |

## Migration / sync rules

**Aucune.** `workouts.program_id`/`planned_session_id` et `planned_sessions.week_index`/`status`
sont déjà en base et déjà synchronisés — seule la requête de lecture change.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟠 **Ordre des gates dans `computeProgressionSuggestion`** : `sessionStruggled` (deload, MUSC-F7)
  doit continuer à être évalué **avant** le nouveau gate d'adhérence — un exercice en échec ne doit
  jamais afficher `weightHold` au lieu de `deload`. Test dédié à l'étape 1 (les deux gates actifs en
  même temps), à ne pas retirer.
- 🟢 **Aucun risque de ricochet sur MUSC-F7/Refonte-C3** : `weightOrReps`/`deload`/`reps`/`duration`
  ne changent pas de forme, seule une 5ᵉ variante s'ajoute au type union.
- 🟠 **`week_index` est `programId`-relatif, pas calendaire** : bien vérifier en recette qu'un
  programme re-planifié (`planProgram`, qui régénère les `planned_sessions` à venir) ne casse pas
  la lecture de la semaine `N-1` déjà `done`/`skipped` — ces lignes passées ne sont **pas**
  soft-supprimées par `planProgram` (seules les `status = 'planned'` le sont), donc la lecture
  reste valide, mais à confirmer sur device (critère de recette à ajouter si un doute survit à
  l'implémentation).
