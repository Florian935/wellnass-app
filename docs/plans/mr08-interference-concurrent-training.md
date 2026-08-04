# Plan — MR-08 · Interférence concurrent training

Spec : [mr08-interference-concurrent-training.md](../specs/functional/us/mr08-interference-concurrent-training.md) ·
branche `feature/mr08-interference-concurrent-training` · **aucune ligne roadmap** (US d'analyse,
catalogue seul).

✅ Décision D1 arbitrée par Florian le 04/08/2026 (seuils ACWR 1,3/0,8 réutilisés tels quels) —
implémentation ci-dessous conforme.

## Étape 1 — La fonction pure, testée d'abord *(≈ 1 h)*

`packages/shared/src/training-time.ts` — juste après `computeAcwr` (§1), même fichier : réutilise
directement les constantes de module déjà présentes (`ACUTE_WINDOW_DAYS`, `CHRONIC_WINDOW_DAYS`,
`ACWR_RISK_THRESHOLD`, `ACWR_LOW_THRESHOLD`), aucune nouvelle constante.

```ts
export type ConcurrentTrainingInterferenceDirection =
  | 'runningUpStrengthDown'
  | 'strengthUpRunningDown';

export type ConcurrentTrainingInterference = {
  show: boolean;
  direction: ConcurrentTrainingInterferenceDirection | null;
};

/**
 * Divergence muscu/course (US MR-08, spec R1/R2) : deux ratios aigu(7j)/chronique(28j) calculés
 * séparément par pilier, dans leur unité native (`volumeKg` muscu, `distanceM` course) — pas la
 * charge sRPE combinée de `computeAcwr` (ça, c'est déjà META-19, spec §1). Réutilise les mêmes
 * seuils 1,3/0,8 (spec D1), pas un nouveau chiffre.
 */
export function computeConcurrentTrainingInterference(input: {
  acuteRunDistanceM: number;
  chronicRunDistanceM: number;
  acuteStrengthVolumeKg: number;
  chronicStrengthVolumeKg: number;
}): ConcurrentTrainingInterference {
  const runRatio = ratioOrNull(input.acuteRunDistanceM, input.chronicRunDistanceM);
  const strengthRatio = ratioOrNull(input.acuteStrengthVolumeKg, input.chronicStrengthVolumeKg);

  if (runRatio === null || strengthRatio === null) {
    return { show: false, direction: null }; // R3 — historique insuffisant d'un des deux côtés
  }
  if (runRatio > ACWR_RISK_THRESHOLD && strengthRatio < ACWR_LOW_THRESHOLD) {
    return { show: true, direction: 'runningUpStrengthDown' };
  }
  if (strengthRatio > ACWR_RISK_THRESHOLD && runRatio < ACWR_LOW_THRESHOLD) {
    return { show: true, direction: 'strengthUpRunningDown' };
  }
  return { show: false, direction: null };
}

function ratioOrNull(acuteTotal: number, chronicTotal: number): number | null {
  if (chronicTotal <= 0) return null; // même garde que computeAcwr
  const acuteAvg = acuteTotal / ACUTE_WINDOW_DAYS;
  const chronicAvg = chronicTotal / CHRONIC_WINDOW_DAYS;
  return acuteAvg / chronicAvg;
}
```

**Tests, écrits d'abord** :
- Course en forte hausse (ratio > 1,3) + muscu en forte baisse (ratio < 0,8) →
  `{ show: true, direction: 'runningUpStrengthDown' }`.
- Muscu en forte hausse + course en forte baisse → `{ show: true, direction: 'strengthUpRunningDown' }`.
- Les deux ratios > 1,3 (montent ensemble) → `{ show: false, direction: null }` (R2 — pas de divergence).
- Les deux ratios < 0,8 (baissent ensemble) → `{ show: false, direction: null }`.
- Un ratio > 1,3, l'autre en zone saine (ex. 1,0, ni haut ni bas) → `{ show: false, direction: null }`
  (pas une vraie chute).
- `chronicRunDistanceM = 0` (aucune course sur 28 j), muscu par ailleurs en divergence → `{ show: false }`
  (R3, historique insuffisant côté course).
- `chronicStrengthVolumeKg = 0` → symétrique, `{ show: false }` (R3 côté muscu).
- Ratios pile aux bornes (1,3 exact, 0,8 exact) → comparaison strictement `>`/`<` (spec R2), donc
  `{ show: false }` — test explicite de la borne, même piège que `computeAcwr`.

## Étape 2 — Le hook + le widget *(≈ 1 h 30)*

`apps/mobile/src/data/repositories/dashboard-repository.ts` — `useConcurrentTrainingInterference()`,
juste après `useTrainingLoadAlert`/`useOvertrainingGuardAlert` (même famille de widgets Tier 2) :

- Gating `['strength', 'running']` — retour anticipé `{ show: false, direction: null }` hors
  gating, hooks sous-jacents appelés inconditionnellement (règle des hooks React), même patron que
  `useTrainingLoadAlert`.
- `useWorkoutHistory()` + `useRunHistory()` (déjà chargées ailleurs sur le dashboard, aucune
  nouvelle requête) + `useWindowStartKey(ACUTE_WINDOW_DAYS)` / `useWindowStartKey(CHRONIC_WINDOW_DAYS)`
  (constantes déjà définies dans ce fichier pour `useTrainingLoadAlert`, réutilisées à l'identique).
- Sommes filtrées par `finishedAt` ≥ borne (même style inline que le `byWindow` de
  `useTrainingLoadAlert`, pas de nouvel helper générique) :
  - `acuteRunDistanceM`/`chronicRunDistanceM` = Σ `runs[].distanceM ?? 0`.
  - `acuteStrengthVolumeKg`/`chronicStrengthVolumeKg` = Σ `workouts[].volumeKg`.
- Délégation à `computeConcurrentTrainingInterference`.

`apps/mobile/src/components/dashboard/ConcurrentTrainingInterferenceCard.tsx` (nouveau) — calque
structurel de `ActivityLevelSuggestionCard.tsx` (`tone="card"`, pas `"warn"`) :
- `if (!interference.show) return null;`
- `up`/`down` résolus côté composant : `direction === 'runningUpStrengthDown' ? { up: t('...runningLabel'), down: t('...strengthLabel') } : { up: t('...strengthLabel'), down: t('...runningLabel') }`.
- Message : `t('home.concurrentTrainingInterference.message', { up, down })`.
- Emoji ⚖️. 3 formes (small/wide/large), bloc `accessible` unique par forme.

`packages/shared/src/widgets.ts` :
- `'concurrent-training-interference'` ajouté **en fin** de `HOME_WIDGET_IDS` (19 → 20), avec le
  même commentaire de type que `training-load`/`activity-level-suggestion` (widget conditionnel
  Tier 2, gardé par pilier).
- `WIDGET_REGISTRY.home.pillars['concurrent-training-interference'] = ['strength', 'running']`.

`apps/mobile/src/components/dashboard/dashboard-widgets.tsx` : entrée `WIDGET_COMPONENTS`.

`apps/mobile/src/app/(tabs)/index.tsx` : `isWidgetActive` — ajouter
`concurrentTrainingInterferenceActive = useConcurrentTrainingInterference().show` et la branche
correspondante, **dans ce même incrément** (spec DoD, pas laissé à la revue — défaut déjà rencontré
3 fois cette semaine).

`apps/mobile/src/i18n/locales/{fr,en}.json` : famille `home.concurrentTrainingInterference.*`
(eyebrow, title, runningLabel, strengthLabel, message, hint — 6 clés).

**Tests `widgets.test.ts` à mettre à jour** (même piège que RN-03/TRI-03/META-19/TRI-12) :
`HOME_WIDGET_IDS` → 20, `defaultScreenLayout('home')` → 20, scénarios `resolveScreenLayout` avec
`strength`+`running` actifs → +1. Gardé **par pilier** (pas `'always'`) — pas d'ajout au scénario
« nutrition seule ».

**Smoke test du widget** (`ConcurrentTrainingInterferenceCard.test.tsx`, nouveau, écrit dès
l'implémentation — pas après-coup) : `show: false` → `null` rendu ; `show: true` avec chaque
direction → titre + message présents, pas de crash.

## Étape 3 — Catalogue & solde *(≈ 20 min)*

- `docs/product/analyses-donnees.md` : MR-08 🆕 → statut réel selon l'avancement au moment du commit.
- **Pas de ligne roadmap** (front-matter `roadmap: []`).
- CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/training-time.ts` (+ `.test.ts`) | `computeConcurrentTrainingInterference` |
| `apps/mobile/src/data/repositories/dashboard-repository.ts` | `useConcurrentTrainingInterference` |
| `apps/mobile/src/components/dashboard/ConcurrentTrainingInterferenceCard.tsx` (nouveau) | widget conditionnel Tier 2 |
| `apps/mobile/src/components/dashboard/__tests__/ConcurrentTrainingInterferenceCard.test.tsx` (nouveau) | smoke test |
| `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` | enregistrement `WIDGET_COMPONENTS` |
| `apps/mobile/src/app/(tabs)/index.tsx` | `isWidgetActive` — nouvelle branche |
| `packages/shared/src/widgets.ts` (+ `.test.ts`) | `'concurrent-training-interference'` dans `HOME_WIDGET_IDS`/`WIDGET_REGISTRY` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | famille `home.concurrentTrainingInterference.*` (6 clés) |
| `docs/product/analyses-donnees.md` | MR-08 🆕 → statut réel |

## Migration / sync rules

**Aucune.** Données déjà en base (`workouts`, `runs`), calcul pur en lecture seule.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🔴 **D1 non arbitrée change le comportement** : le seuil (1,3/0,8 vs un autre chiffre) détermine
  directement la fréquence de déclenchement — ne pas coder avant l'arbitrage.
- 🟠 **Confusion avec META-19 (charge combinée sRPE)** : cette US ne touche jamais
  `computeAcwr`/`sessionLoad` — compare deux séries distinctes dans leurs unités natives. À
  vérifier explicitement en revue (risque de fusion involontaire des deux logiques, déjà écarté
  au cadrage §1 de la spec).
- 🟠 **`isWidgetActive` oublié** : risque déjà matérialisé 3 fois cette session (`readiness`,
  `activity-level-suggestion`, et rétroactivement à nouveau pour `readiness`) — traité dans
  l'étape 2 elle-même, pas laissé à la revue cette fois.
- 🟢 **Aucun risque de ricochet sur `computeAcwr`/`useTrainingLoadAlert`** : fonctions/hooks
  neufs, aucune signature existante modifiée, mêmes constantes lues en lecture seule.
