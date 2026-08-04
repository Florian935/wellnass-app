# Plan — MUSC-19 · Tonnage cumulé (lifetime/annuel)

Spec : [musc19-tonnage-cumule.md](../specs/functional/us/musc19-tonnage-cumule.md) ·
branche `feature/musc19-tonnage-cumule` · **aucune ligne roadmap** (US d'analyse, catalogue seul).

✅ Décisions D1-D4 arbitrées par Florian le 04/08/2026 (spec §1) — implémentation ci-dessous
conforme (année civile, section Tier 1 sur `/progress`, jalon unique, badge silencieux).

**Pas de widget dashboard, pas de registre `widgets.ts`** : nouvelle section sur un écran existant
(`/progress`), périmètre comparable à MN-04 (petit).

## Étape 1 — Les 2 briques pures, testées d'abord *(≈ 40 min)*

`packages/shared/src/date.ts` — juste après `localMidnightDaysAgo` (même famille de bornes
locales) :

```ts
/** Minuit local du 1er janvier de l'année de `ref` (US MUSC-19, spec D1/R2). */
export function localStartOfYear(ref: Date = new Date()): Date {
  return new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
}
```

**Tests, écrits d'abord** :
- `ref` un 15 juillet → 1er janvier de la même année, heure/minute/seconde à 0.
- `ref` un 1er janvier à 23h59 → toujours le 1er janvier (pas de décalage de jour).
- Année bissextile (2028) → même comportement, aucun cas particulier requis (pas de dépendance au
  29 février pour un 1er janvier).

`packages/shared/src/workout.ts` — juste après `computeVolume` (même voisinage) :

```ts
/** Jalon symbolique du tonnage à vie (spec D3, catalogue) — un seul seuil, pas une échelle. */
export const TONNAGE_MILESTONE_KG = 1_000_000;

export function hasReachedTonnageMilestone(lifetimeKg: number): boolean {
  return lifetimeKg >= TONNAGE_MILESTONE_KG;
}
```

**Tests, écrits d'abord** :
- `999_999` → `false`.
- `1_000_000` pile → `true` (borne incluse).
- `1_500_000` → `true`.
- `0` → `false`.

## Étape 2 — Le hook + la section d'écran *(≈ 1 h)*

`apps/mobile/src/data/repositories/records-repository.ts` — `useLifetimeTonnage()`, même patron
SQL que `useMuscleBalance` (`SUM(s.reps * s.weight_kg)`, mêmes filtres R1), sans le `GROUP BY` :

```ts
export function useLifetimeTonnage(): {
  lifetimeKg: number;
  thisYearKg: number;
  isLoading: boolean;
} {
  const today = useTodayDate();
  const yearStartIso = localStartOfYear(today).toISOString();

  const sql = `
    SELECT
      SUM(s.reps * s.weight_kg) AS lifetime,
      SUM(CASE WHEN w.finished_at >= ? THEN s.reps * s.weight_kg ELSE 0 END) AS this_year
    FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
      AND w.status = 'completed' AND w.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
      AND s.done = 1 AND s.set_type <> 'warmup'
      AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
  `;
  const { data, isLoading } = useQuery<{ lifetime: number | null; this_year: number | null }>(
    sql,
    [yearStartIso],
  );
  const row = data[0];
  return { lifetimeKg: row?.lifetime ?? 0, thisYearKg: row?.this_year ?? 0, isLoading };
}
```

`apps/mobile/src/app/progress/index.tsx` — nouvelle section `Card`, après la section « Volume · 7
derniers jours » (avant le sélecteur d'exercice) :
- Titre `progress.lifetimeTonnage.title`.
- Deux `Metric`/`Text` : à vie (`toLocaleString`) + cette année.
- Si `hasReachedTonnageMilestone(lifetimeKg)` : ligne badge `progress.lifetimeTonnage.milestone`.
- Bloc `accessible` unique (spec §8).
- `isLoading` : squelette cohérent avec les autres sections de l'écran (vérifier le patron déjà en
  place pour `useMuscleBalance`/`useMuscleVolumeThisWeek` et le reprendre à l'identique).

`apps/mobile/src/i18n/locales/{fr,en}.json` : famille `progress.lifetimeTonnage.*` (4 clés).

**Pas de test de composant nouveau requis** : logique testable entièrement dans les 2 fonctions
pures de l'étape 1 ; la section d'écran ne fait qu'assembler un résultat de hook déjà correct
(même discipline que MN-04 — pas de test de composant si aucune branche de rendu non triviale).

## Étape 3 — Catalogue & solde *(≈ 15 min)*

- `docs/product/analyses-donnees.md` : MUSC-19 🆕 → statut réel selon l'avancement au moment du
  commit.
- **Pas de ligne roadmap** (front-matter `roadmap: []`).
- CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/date.ts` (+ `.test.ts`) | `localStartOfYear` |
| `packages/shared/src/workout.ts` (+ `.test.ts`) | `TONNAGE_MILESTONE_KG`, `hasReachedTonnageMilestone` |
| `apps/mobile/src/data/repositories/records-repository.ts` | `useLifetimeTonnage` |
| `apps/mobile/src/app/progress/index.tsx` | nouvelle section |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `progress.lifetimeTonnage.*` |
| `docs/product/analyses-donnees.md` | MUSC-19 🆕 → statut réel |

## Migration / sync rules

**Aucune.** Données déjà en base (`workout_sets`, `workouts`), agrégation SQL en lecture seule.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🔴 **D1-D4 non arbitrées changent le comportement** (année civile vs glissante, emplacement,
  jalon unique vs échelle, notification vs silencieux) — ne pas coder avant l'arbitrage.
- 🟢 **Aucun risque de ricochet** : `computeVolume`, `useMuscleBalance` et le reste de l'écran
  Progression ne sont pas modifiés, seule une section s'ajoute.
- 🟠 **Performance de la requête lifetime** : pas de borne de date basse, donc balaye
  potentiellement tout l'historique `workout_sets` d'un utilisateur — acceptable pour une agrégation
  SQL locale (SQLite, patron déjà utilisé par `useMuscleBalance` sur un sous-ensemble), mais à
  garder à l'œil si un profil avec plusieurs années d'historique montre une latence perceptible en
  recette (pas de pagination/cache prévu en V1, pas demandé par la spec).
