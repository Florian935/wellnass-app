# Plan — TRI-12 · Détection de surcharge / sous-récupération globale

Spec : [tri12-garde-fou-global.md](../specs/functional/us/tri12-garde-fou-global.md) ·
branche `feature/tri12-garde-fou-global` · **aucune ligne roadmap** (US d'analyse, catalogue seul).

## Étape 1 — Les deux fonctions pures, testées d'abord *(≈ 1 h)*

`packages/shared/src/training-time.ts` — même fichier que `sessionLoad`/`computeAcwr` (même
famille de calcul « charge », pas un nouveau module) :

```ts
const OVERTRAINING_LOAD_STREAK_DAYS = 6;           // R2 — aligné fourchette catalogue MR-14 (6-7j)
const OVERTRAINING_DEFICIT_WINDOW_DAYS = 7;        // R3 — fenêtre fixe calendaire
const OVERTRAINING_DEFICIT_DAYS_REQUIRED = 4;      // R3 — compte absolu, PAS lié à MIN_LOGGED_DAYS (bodyweight.ts)

export function countDeficitDaysInWindow(
  loggedDays: ReadonlyArray<{ kcal: number }>,
  targetKcal: number,
): number
```

- Importe `DEFICIT_ALERT_RATIO` de `./bodyweight` (seule chose réutilisée de MN-02, cf. spec §2).
- `targetKcal <= 0` → `0` (pas de division par une cible absente).
- Un jour est "en déficit" si `(targetKcal - kcal) / targetKcal >= DEFICIT_ALERT_RATIO`.
- **Ne fait aucun découpage de fenêtre** : reçoit une liste déjà bornée aux 7 derniers jours
  calendaires par l'appelant (même discipline que `computeAcwr`, qui ne connaît aucune notion de
  date) — compte juste combien de jours de la liste qualifient.

**Tests, écrits d'abord** :
- 4 jours en déficit sur une liste de 7 → `4`.
- 3 jours en déficit sur une liste de 5 (jours loggés incomplets) → `3`, **pas** un ratio/majorité —
  le test qui vérifie explicitement que ce n'est pas une proportion (spec R3, point relu).
- `targetKcal <= 0` → `0`.
- Aucun jour → `0`.

```ts
export type OvertrainingGuardResult = { show: boolean };

export function computeOvertrainingGuard(input: {
  loadStreakDays: number;
  deficitDaysCount: number;
}): OvertrainingGuardResult
```

- `show = loadStreakDays >= OVERTRAINING_LOAD_STREAK_DAYS && deficitDaysCount >= OVERTRAINING_DEFICIT_DAYS_REQUIRED`
  (R4 — les deux, jamais un seul).
- Reçoit des résultats **déjà calculés** par l'appelant (`computeStreak(...).current` pour le
  streak, `countDeficitDaysInWindow(...)` pour le compte) — cette fonction n'agrège rien elle-même,
  elle applique seulement la règle R4. Pas de nouvelle notion de date ici non plus.

**Tests, écrits d'abord** :
- Streak 6 + déficit 4 → `show: true` (les deux bornes pile atteintes).
- Streak 6 + déficit 3 → `show: false` (R4, un seul signal ne suffit pas — le test le plus important
  de cette étape, comme R3 l'était pour RUN-14).
- Streak 5 + déficit 4 → `show: false`.
- Streak 8 + déficit 7 → `show: true` (au-delà des deux seuils).

## Étape 2 — Le hook + le widget *(≈ 1 h 30)*

`apps/mobile/src/data/repositories/dashboard-repository.ts` — `useOvertrainingGuardAlert()`, même
patron que `useTrainingLoadAlert` (META-19) :

- Gating `['strength', 'running', 'nutrition']` — les **trois**, via `resolveActivePillars`. Hors
  gating, retour anticipé `{ show: false }` (hooks sous-jacents quand même appelés inconditionnellement,
  règle des hooks).
- Jours à charge (R1) : `useWorkoutHistory()` + `useRunHistory()`, filtrées aux ~30 derniers jours
  (borne large mais bornée — largement suffisante pour détecter un streak ≥ 6 sans coût de calcul
  significatif), regroupées par `localDayKey(finishedAt)`, `sessionLoad` sommée par jour, jour
  retenu si somme > 0. Passé à `computeStreak(chargeDays, todayKey).current`.
- Jours en déficit (R3) : `useDailyTotals(useWindowStartKey(7))` (déjà utilisé par
  `useDeficitVolumeAlert`, tableau épars des jours loggés) + `useNutritionSummary().target` (cible
  de base, hors bonus jour d'entraînement — même convention que MN-02). Passé à
  `countDeficitDaysInWindow`.
- `computeOvertrainingGuard({ loadStreakDays, deficitDaysCount })` → `{ show }`.

`apps/mobile/src/components/dashboard/OvertrainingGuardCard.tsx` (nouveau) — copie structurelle de
`TrainingLoadAlertCard.tsx` (META-19) : `if (!alert.show) return null;`, `tone="warn"`, 3 formes
(small/wide/large), bloc `accessible` unique par forme (spec §7), clés `home.overtrainingGuard.*`.

`packages/shared/src/widgets.ts` :
- `'overtraining-guard'` ajouté **en fin** de `HOME_WIDGET_IDS` (15 → 16).
- `WIDGET_REGISTRY.home.pillars['overtraining-guard'] = ['strength', 'running', 'nutrition']`.

`apps/mobile/src/components/dashboard/dashboard-widgets.tsx` : entrée `WIDGET_COMPONENTS`.

`apps/mobile/src/i18n/locales/{fr,en}.json` : famille `home.overtrainingGuard.*` (4 clés).

**Tests widgets.ts à mettre à jour** (même piège que META-19, 5 assertions `toHaveLength()` codées
en dur, +1 partout où les 3 piliers sont actifs sans exclusion spécifique) — repérer les mêmes
emplacements que la correction META-19 (`widgets.test.ts` : registre, `defaultScreenLayout`,
3 scénarios `resolveScreenLayout`) et vérifier s'il y en a d'autres avec `nutrition` inclus dans
`all`.

## Étape 3 — Solde *(≈ 20 min)*

**Pas de ligne roadmap** (front-matter `roadmap: []`). Mettre à jour
[analyses-donnees.md](../product/analyses-donnees.md) : TRI-12 🆕 → ✅ (reste recette). CHANGELOG +
`etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/training-time.ts` (+ `.test.ts`) | `countDeficitDaysInWindow`, `computeOvertrainingGuard` |
| `apps/mobile/src/data/repositories/dashboard-repository.ts` | `useOvertrainingGuardAlert` |
| `apps/mobile/src/components/dashboard/OvertrainingGuardCard.tsx` (nouveau) | widget conditionnel |
| `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` | enregistrement `WIDGET_COMPONENTS` |
| `packages/shared/src/widgets.ts` (+ `.test.ts`) | `'overtraining-guard'` dans `HOME_WIDGET_IDS`/`WIDGET_REGISTRY` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `home.overtrainingGuard.*` (4 clés) |
| `docs/product/analyses-donnees.md` | TRI-12 🆕 → ✅ |

## Migration / sync rules

**Aucune.** Données déjà en base (`workouts`, `runs`, `food_entries`), calcul pur en lecture seule.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟠 **Empilement de widgets** (spec §1) : `DeficitVolumeAlertCard`, `TrainingLoadAlertCard` et ce
  nouveau widget peuvent s'afficher simultanément si les 3 piliers sont actifs et la situation
  mauvaise sur plusieurs fronts — assumé en V1 (pas de mécanisme de priorité), à surveiller en usage
  réel plutôt qu'à résoudre préventivement.
- 🟠 **Confusion `MIN_LOGGED_DAYS` (bodyweight.ts) / `OVERTRAINING_DEFICIT_DAYS_REQUIRED`** : même
  valeur numérique (4), sens différent — nommer la nouvelle constante sans réutiliser le nom
  existant, ne pas les faire pointer vers la même déclaration même si la coïncidence est tentante.
- 🟢 **Aucun risque de ricochet sur META-19/RUN-18** : `sessionLoad`/`computeAcwr` ne sont pas
  modifiées, seules deux fonctions neuves s'ajoutent au même fichier.
- 🟠 **R4 est la règle la plus facile à casser par erreur** (afficher l'alerte sur un seul signal
  au lieu des deux) — d'où le test dédié "streak 6 + déficit 3 → false" à l'étape 1, à ne pas
  retirer même si la couverture globale paraît suffisante sans lui (même logique que R3/RUN-14).
