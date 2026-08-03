# Plan — TRI-03 · Score de forme / readiness global

Spec : [tri03-score-readiness.md](../specs/functional/us/tri03-score-readiness.md) ·
branche `feature/tri03-score-readiness` · **aucune ligne roadmap** (US d'analyse, catalogue seul).

✅ Décisions D1-D7 arbitrées par Florian le 03/08/2026 (spec §1) — implémentation ci-dessous conforme
aux recommandations (verdict qualitatif, énergie+stress seulement).

## Étape 1 — La fonction de composition pure, testée d'abord *(≈ 2 h)*

`packages/shared/src/readiness.ts` (nouveau fichier — composition tri-brique, pas une extension de
`training-time.ts` qui reste dédié aux calculs de charge) :

```ts
export type ReadinessComponentState = 'positive' | 'neutral' | 'negative' | 'unavailable';

export type ReadinessVerdict = 'rest' | 'ok' | 'push';

export interface ReadinessComponent {
  state: ReadinessComponentState;
  reason?: 'insufficient-history' | 'insufficient-logged-days' | 'no-recent-checkin';
}

export interface ReadinessResult {
  show: boolean;
  verdict: ReadinessVerdict | null;
  load: ReadinessComponent;
  nutrition: ReadinessComponent;
  wellbeing: ReadinessComponent;
}

const WELLBEING_LOOKBACK_DAYS = 3;               // R3/D5
const WELLBEING_LOW_ENERGY = 2;                  // R3
const WELLBEING_HIGH_STRESS = 4;                 // R3
const WELLBEING_HIGH_ENERGY = 4;                 // R3
const WELLBEING_LOW_STRESS = 2;                  // R3

export function classifyLoadComponent(acwr: AcwrResult | null): ReadinessComponent
export function classifyNutritionComponent(input: {
  loggedDaysCount: number;
  avgKcal: number;
  targetKcal: number;
}): ReadinessComponent
export function classifyWellbeingComponent(averages: {
  energy: { average: number | null; days: number };
  stress: { average: number | null; days: number };
}): ReadinessComponent

export function computeReadiness(input: {
  load: ReadinessComponent;
  nutrition: ReadinessComponent;
  wellbeing: ReadinessComponent;
}): ReadinessResult
```

- `classifyLoadComponent` : `null` → `unavailable/insufficient-history` (R1) ; sinon mappe la
  `zone` de `computeAcwr` (`low`→positive, `safe`→neutral, `risk`→negative). Importe `AcwrResult`
  de `./training-time`, ne redéfinit rien.
- `classifyNutritionComponent` : `loggedDaysCount < MIN_LOGGED_DAYS` (import `./bodyweight`) →
  `unavailable/insufficient-logged-days` (R2). Sinon `(targetKcal - avgKcal) / targetKcal >=
  DEFICIT_ALERT_RATIO` (import `./bodyweight`) → `negative`, sinon `neutral`. `targetKcal <= 0` →
  traiter comme indisponible (pas de division par zéro — même discipline que TRI-12).
- `classifyWellbeingComponent` : les deux `days === 0` → `unavailable/no-recent-checkin` (R3).
  Sinon applique les seuils ci-dessus. **L'appelant** doit passer `wellbeingAverages(rows, 3,
  todayKey)` déjà filtré sur `energy`/`stress` uniquement (D5 exclut `mood` — ne pas le lire).
- `computeReadiness` : si les 3 composantes sont `unavailable` → `{ show: false, verdict: null,
  ... }` (R5). Sinon `show: true`, verdict = `'rest'` si une composante `negative` existe (R4),
  sinon `'push'` si **au moins une** composante non-`unavailable` est `positive` (corrigé le
  03/08/2026 — voir note R4 de la spec : nutrition ne produit jamais `positive`, un « toutes
  positives » aurait rendu `'push'` inatteignable dès que la nutrition est active), sinon `'ok'`.

**Tests, écrits d'abord** (au moins) :
- Les 3 composantes `unavailable` → `show: false`, `verdict: null`.
- Charge `negative`, nutrition `positive`, bien-être `positive` → `'rest'` (un seul signal négatif
  suffit — le test le plus important de cette étape, comme R4/TRI-12).
- Charge `positive`, nutrition `neutral`, bien-être `neutral` → `'push'` (un seul signal positif
  suffit, symétrique du « un seul signal négatif suffit » — test qui aurait échoué avec l'ancienne
  règle « toutes positives »).
- Charge `positive`, nutrition `unavailable`, bien-être `positive` → `'push'` (l'indisponible
  n'entre pas dans le calcul).
- Charge `neutral`, nutrition `positive`, bien-être `unavailable` → `'ok'` (mélange sans négatif,
  mais pas toutes positives).
- `classifyNutritionComponent` avec `loggedDaysCount: 3` (< 4) → `unavailable`, peu importe l'écart.
- `classifyNutritionComponent` avec `targetKcal: 0` → `unavailable`, pas de `NaN`/`Infinity`.
- `classifyWellbeingComponent` avec `energy: { average: null, days: 0 }` et `stress` idem →
  `unavailable`.
- `classifyLoadComponent(null)` → `unavailable`.

## Étape 2 — Le hook + le widget *(≈ 2 h)*

`apps/mobile/src/data/repositories/dashboard-repository.ts` — `useReadiness()`, même patron
d'assemblage que `useOvertrainingGuardAlert` mais **sans gating de piliers en entrée** (D2) :

- `strengthActive`/`runningActive`/`nutritionActive` via `resolveActivePillars` — déterminent
  **quelles données tenter**, pas si le hook retourne `{ show: false }` d'entrée (contrairement à
  `useTrainingLoadAlert`/`useOvertrainingGuardAlert`, qui court-circuitent tout hors gating).
- Charge : si `strengthActive || runningActive`, assembler les séances des piliers actifs
  (`useWorkoutHistory`/`useRunHistory` filtrées par pilier actif), fenêtres 7j/28j
  (`useWindowStartKey`, mêmes constantes que `useTrainingLoadAlert` — vérifier le nom exact
  exporté, potentiellement à exporter de `training-time.ts` s'il ne l'est pas déjà), `computeAcwr`,
  puis `classifyLoadComponent`. Si ni l'un ni l'autre actif → `unavailable/insufficient-history`
  sans appeler `computeAcwr`.
- Nutrition : si `nutritionActive`, `useDailyTotals(useWindowStartKey(7))` + `useNutritionSummary().
  target`, compter les jours loggés, `classifyNutritionComponent`. Sinon `unavailable`.
- Bien-être : toujours tenté (transverse, D2) — `useWellbeingRows(useWindowStartKey(3))`,
  `wellbeingAverages(rows, 3, todayKey)`, `classifyWellbeingComponent`.
- `computeReadiness({ load, nutrition, wellbeing })`.

`apps/mobile/src/components/dashboard/ReadinessCard.tsx` (nouveau) — calque structurel de
`OvertrainingGuardCard.tsx` : `if (!result.show) return null;`, verdict → ton/couleur/icône, 3
formes (small/wide/large), détail dépliable (spec R8) listant les 3 composantes et leur état
(y compris `unavailable` + `reason`), bloc `accessible` unique par forme, clés
`home.readiness.*`.

`packages/shared/src/widgets.ts` :
- `'readiness'` ajouté **en fin** de `HOME_WIDGET_IDS` (16 → 17).
- `WIDGET_REGISTRY.home.pillars['readiness'] = 'always'` (D2 — transverse, comme `wellbeing`).

`apps/mobile/src/components/dashboard/dashboard-widgets.tsx` : entrée `WIDGET_COMPONENTS`.

`apps/mobile/src/i18n/locales/{fr,en}.json` : famille `home.readiness.*` (3 verdicts × libellé +
message, 3 composantes × 4 états + raison d'indisponibilité).

**Tests `widgets.ts` à mettre à jour** (même piège que META-19/TRI-12 : assertions `toHaveLength()`
codées en dur sur `HOME_WIDGET_IDS`, et les scénarios `resolveScreenLayout` qui énumèrent les
widgets `'always'`).

## Étape 3 — Catalogue & solde *(≈ 30 min)*

- `docs/product/analyses-donnees.md` : TRI-03 🆕 → statut réel (livrée/en recette selon l'avancement
  réel au moment du commit) ; **MR-23 marquée absorbée par TRI-03** (D3), sur le modèle de la
  mention existante « MR-10, absorbée par doublon » dans `tri12-garde-fou-global.md`.
- **Pas de ligne roadmap** (front-matter `roadmap: []`).
- CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/readiness.ts` (nouveau, + `.test.ts`) | `classifyLoadComponent`, `classifyNutritionComponent`, `classifyWellbeingComponent`, `computeReadiness` |
| `apps/mobile/src/data/repositories/dashboard-repository.ts` | `useReadiness` |
| `apps/mobile/src/components/dashboard/ReadinessCard.tsx` (nouveau) | widget transverse, 3 formes, détail dépliable |
| `apps/mobile/src/components/dashboard/__tests__/ReadinessCard.test.tsx` (nouveau) | smoke test — ajouté après revue de code (pas de couverture initiale, comme `TrainingLoadAlertCard`/`OvertrainingGuardCard`, mais ce widget transverse suit plutôt le précédent `WellbeingCard`/`ReviewCard`, testés) |
| `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` | enregistrement `WIDGET_COMPONENTS` |
| `packages/shared/src/widgets.ts` (+ `.test.ts`) | `'readiness'` dans `HOME_WIDGET_IDS`/`WIDGET_REGISTRY` (`'always'`) |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `home.readiness.*` |
| `docs/product/analyses-donnees.md` | TRI-03 statut réel, MR-23 marquée absorbée |

## Migration / sync rules

**Aucune.** Données déjà en base (`workouts`, `runs`, `food_entries`, `daily_wellbeing`), calcul
pur en lecture seule.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟠 **Empilement avec `wellbeing`/`review`/`training-load`/`overtraining-guard`** : jusqu'à 4
  widgets transverses ou conditionnels peuvent apparaître ensemble sur le dashboard. Assumé comme
  TRI-12 §1 (pas de mécanisme de priorité en V1), mais à surveiller — c'est le 4ᵉ widget de cette
  famille, le point de saturation Tier 0 évoqué par ADR-007 se rapproche.
- 🟠 **`classifyWellbeingComponent` ignore `mood`** (D5) : vérifier que le détail dépliable
  n'affiche jamais l'humeur comme si elle avait contribué — un utilisateur qui a renseigné
  l'humeur seule doit voir la composante bien-être comme `unavailable`, pas silencieusement ignorée.
- 🟢 **Aucun risque de ricochet sur META-19/RUN-18/TRI-12** : `computeAcwr`/`sessionLoad` ne sont
  pas modifiées, seule leur sortie est consommée en lecture.
- 🟠 **Nom exact des constantes de fenêtre ACWR** (`ACUTE_WINDOW_DAYS`/`CHRONIC_WINDOW_DAYS`) à
  vérifier — non confirmées exportées de `training-time.ts` à ce stade de la recherche ; à exporter
  si nécessaire plutôt que dupliquer les valeurs (7/28) en dur dans `dashboard-repository.ts`.
