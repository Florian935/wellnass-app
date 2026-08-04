# Plan — MUSC-20 · Régularité & consistance d'entraînement

Spec : [musc20-regularite-entrainement.md](../specs/functional/us/musc20-regularite-entrainement.md) ·
branche `feature/musc20-regularite-entrainement` · **aucune ligne roadmap** (US d'analyse,
catalogue seul).

✅ Décisions D1-D4 arbitrées par Florian le 04/08/2026 (spec §1) — implémentation ci-dessous
conforme (28 j glissants, dégradation par composante, seuil 3 séances, 5ᵉ section acceptée telle
quelle).

## Étape 1 — L'écart-type des intervalles, testée d'abord *(≈ 45 min)*

`packages/shared/src/workout.ts` — juste après `computeTrainingDensity` :

```ts
/**
 * Régularité des intervalles entre séances (US MUSC-20, spec R3/D3) : écart-type de
 * population des écarts en jours, même formule que CYCLE-01 (`stdDev`, menstrual-cycle.ts,
 * privée — reprise ici, pas importée). `null` sous 3 séances (2 intervalles, spec D3).
 */
export function computeIntervalRegularity(intervalDays: readonly number[]): number | null {
  if (intervalDays.length < 2) return null;
  const mean = intervalDays.reduce((a, b) => a + b, 0) / intervalDays.length;
  const variance =
    intervalDays.reduce((sum, d) => sum + (d - mean) ** 2, 0) / intervalDays.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}
```

**Tests, écrits d'abord** :
- 1 seul intervalle (2 séances) → `null` (D3).
- 3 séances parfaitement régulières (intervalles `[7, 7]`) → `0`.
- Intervalles irréguliers (`[2, 10, 3]`) → écart-type positif, valeur vérifiée au calcul exact.
- Liste vide → `null`.

**Aucune fonction d'adhérence nouvelle** : R4 réutilise `computeWeekCompletionRate` (déjà dans
`workout.ts`, testée par MUSC-F15) — rien à écrire à cette étape au-delà de la fonction
d'écart-type.

## Étape 2 — Le hook + la section d'écran *(≈ 1 h 30)*

`apps/mobile/src/data/repositories/planned-session-repository.ts` — `useTrainingRegularity()`,
même fichier que `usePriorWeekAdherence` (déjà consommateur de `computeWeekCompletionRate`) :

```ts
const REGULARITY_WINDOW_DAYS = 28; // spec D1

const SELECT_PLANNED_STRENGTH_IN_WINDOW = `
  SELECT ps.status
  FROM planned_sessions ps
  JOIN programs p ON p.id = ps.program_id AND p.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL
    AND p.pillar = 'strength'
    AND ps.scheduled_date >= ? AND ps.scheduled_date <= ?
`;

const SELECT_COMPLETED_STRENGTH_IN_WINDOW = `
  SELECT finished_at FROM workouts
  WHERE status = 'completed' AND deleted_at IS NULL AND finished_at >= ?
  ORDER BY finished_at
`;
```

- `sessionsPerWeek` (R1) : nb de lignes de `SELECT_COMPLETED_STRENGTH_IN_WINDOW` ÷
  (`REGULARITY_WINDOW_DAYS / 7`).
- `targetPerWeek` (R2) : nb de lignes de `SELECT_PLANNED_STRENGTH_IN_WINDOW` ÷
  (`REGULARITY_WINDOW_DAYS / 7`) ; `null` si 0 ligne (D2).
- `intervalRegularity` (R3) : `finished_at` triés → écarts en jours entre dates consécutives
  (`localDayKey` puis `daysBetween`, comme ailleurs) → `computeIntervalRegularity`.
- `adherenceRate` (R4) : `computeWeekCompletionRate(plannedRows)` — `null` si `plannedRows.length
  === 0` (déjà le comportement de la fonction, spec R2 de MUSC-F15).
- Toutes les requêtes bornées par `useWindowStartKey(REGULARITY_WINDOW_DAYS)` (ISO UTC, même
  discipline que le reste du repository).

`apps/mobile/src/app/progress/index.tsx` — nouvelle section `RegularitySection`, après la section
Tonnage cumulé (US MUSC-19) :
- 3 blocs (ou 2/1 selon disponibilité, spec R5/R6) : séances/sem (+ objectif si disponible),
  régularité des intervalles, taux de séances tenues.
- État vide (spec R6) si les 3 métriques sont `null`.
- Bloc `accessible` unique.

`apps/mobile/src/i18n/locales/{fr,en}.json` : famille `progress.regularity.*` (spec §6).

**⚠️ Rappel ADR-007 (spec D4)** : 5ᵉ section sur `/progress`. Pas de mécanisme de repli construit
ici (hors périmètre explicite) — noter dans le commit que le seuil de vigilance ADR-007 est atteint.

**Pas de test de composant nouveau** : logique dans les fonctions pures (étape 1 +
`computeWeekCompletionRate` déjà testée) ; la section assemble un résultat déjà correct.

## Étape 3 — Catalogue & solde *(≈ 15 min)*

- `docs/product/analyses-donnees.md` : MUSC-20 🆕 → statut réel.
- **Pas de ligne roadmap** (front-matter `roadmap: []`).
- CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/workout.ts` (+ `.test.ts`) | `computeIntervalRegularity` |
| `apps/mobile/src/data/repositories/planned-session-repository.ts` | `useTrainingRegularity` |
| `apps/mobile/src/app/progress/index.tsx` | nouvelle section `RegularitySection` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `progress.regularity.*` |
| `docs/product/analyses-donnees.md` | MUSC-20 🆕 → statut réel |

## Migration / sync rules

**Aucune.** Données déjà en base (`workouts`, `planned_sessions`, `programs`), calcul pur en
lecture seule.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🔴 **D1-D4 non arbitrées changent le comportement** — en particulier D2 (dégradation) et D4
  (5ᵉ section, seuil ADR-007) sont des choix de fond, pas des détails.
- 🟠 **`computeWeekCompletionRate` compte les séances futures de la fenêtre comme non tenues**
  (constaté pendant le cadrage, spec R4) — comportement hérité de MUSC-F15, assumé pour cohérence,
  mais à vérifier en recette que le taux affiché ne semble pas anormalement bas en tout début de
  fenêtre (peu de séances encore passées).
- 🟠 **Densité de `/progress`** : 5ᵉ section, seuil de repli ADR-007 atteint (D4) — signalé, pas
  résolu ici.
- 🟢 **Aucun risque de ricochet** : `computeWeekCompletionRate`/`isMissed`/`useMuscleBalance` etc.
  ne sont pas modifiées, seule leur sortie est consommée.
