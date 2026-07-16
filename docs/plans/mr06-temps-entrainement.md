# US MR-06 — Widget « Temps d'entraînement » — Plan d'implémentation

> **Pour l'exécutant :** tâche par tâche, étapes cochables. TDD sur `packages/shared` (Vitest).
> Mobile : `typecheck` + `lint` + `test` verts ; rendu vérifié en recette. Commits FR.

**Objectif :** widget dashboard inter-piliers affichant le temps total d'entraînement (muscu + course)
de la semaine ISO courante + ventilation par pilier.

**Architecture :** logique pure `@wellness/shared` (`computeTrainingTime`, `formatHoursMinutes`) ;
widget ajouté au registre `dashboard.ts` (gating transverse `['strength','running']`) ; hook
`useTrainingTime` composant `useRunStats('week')` (course) + `useWorkoutHistory` filtré semaine (muscu) ;
composant `TrainingTimeCard` (full + compact) branché via `WIDGET_COMPONENTS`.

**Tech Stack :** React Native/Expo, PowerSync (`useQuery` via hooks existants), i18next FR/EN, Vitest.

**Spec :** [docs/specs/functional/us/mr06-temps-entrainement.md](../specs/functional/us/mr06-temps-entrainement.md)

**Fichiers touchés :**
- Créer : `packages/shared/src/training-time.ts` (+ `training-time.test.ts`) ; export dans `packages/shared/src/index.ts`
- Modifier : `packages/shared/src/dashboard.ts` (+ `dashboard.test.ts`)
- Modifier : `apps/mobile/src/data/repositories/dashboard-repository.ts` (hook)
- Créer : `apps/mobile/src/components/dashboard/TrainingTimeCard.tsx`
- Modifier : `apps/mobile/src/components/dashboard/dashboard-widgets.tsx` (WIDGET_COMPONENTS)
- Modifier : i18n mobile `fr.json` + `en.json`

**100 % client, offline, aucune migration, aucun checkpoint 🔴.**

---

## Task 1 : Logique pure `training-time.ts` (TDD)

**Files :** Create `packages/shared/src/training-time.ts`, `packages/shared/src/training-time.test.ts` ; Modify `packages/shared/src/index.ts`

- [ ] **Step 1 : Écrire les tests d'abord**

```ts
import { describe, expect, it } from 'vitest';
import { computeTrainingTime, formatHoursMinutes } from './training-time';

describe('computeTrainingTime', () => {
  it('somme muscu + course', () => {
    expect(computeTrainingTime({ strengthSeconds: 7800, runningSeconds: 8400 }))
      .toEqual({ totalSeconds: 16200, strengthSeconds: 7800, runningSeconds: 8400 });
  });
  it('clamp les valeurs négatives / non finies à 0', () => {
    expect(computeTrainingTime({ strengthSeconds: -10, runningSeconds: Number.NaN }))
      .toEqual({ totalSeconds: 0, strengthSeconds: 0, runningSeconds: 0 });
  });
  it('tout à zéro', () => {
    expect(computeTrainingTime({ strengthSeconds: 0, runningSeconds: 0 }))
      .toEqual({ totalSeconds: 0, strengthSeconds: 0, runningSeconds: 0 });
  });
});

describe('formatHoursMinutes', () => {
  it('formate Xh YY (minutes zéro-paddées, arrondi minute inférieure)', () => {
    expect(formatHoursMinutes(16200)).toBe('4h 30');
    expect(formatHoursMinutes(16259)).toBe('4h 30'); // 59 s résiduelles ignorées
    expect(formatHoursMinutes(0)).toBe('0h 00');
    expect(formatHoursMinutes(300)).toBe('0h 05');
    expect(formatHoursMinutes(3600)).toBe('1h 00');
  });
  it('robuste aux valeurs invalides', () => {
    expect(formatHoursMinutes(-5)).toBe('0h 00');
    expect(formatHoursMinutes(Number.NaN)).toBe('0h 00');
  });
});
```

- [ ] **Step 2 : Vérifier l'échec** — `npm run test` → FAIL (module absent).

- [ ] **Step 3 : Implémenter**

```ts
/**
 * MR-06 — temps d'entraînement (inter-piliers muscu + course). Logique pure.
 */

/** Normalise une durée en secondes ≥ 0 (NaN/négatif/∞ → 0). */
function safeSeconds(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Agrège les durées muscu + course en total + ventilation (toutes ≥ 0). */
export function computeTrainingTime(input: {
  strengthSeconds: number;
  runningSeconds: number;
}): { totalSeconds: number; strengthSeconds: number; runningSeconds: number } {
  const strengthSeconds = safeSeconds(input.strengthSeconds);
  const runningSeconds = safeSeconds(input.runningSeconds);
  return { totalSeconds: strengthSeconds + runningSeconds, strengthSeconds, runningSeconds };
}

/** Formate des secondes en « Xh YY » (minutes plancher, zéro-paddées). */
export function formatHoursMinutes(totalSeconds: number): string {
  const s = safeSeconds(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}`;
}
```

- [ ] **Step 4 : Exporter** — ajouter `export * from './training-time';` dans `packages/shared/src/index.ts` (suivre le style des exports existants).

- [ ] **Step 5 : Vérifier** — `npm run test` → PASS ; `npm run typecheck` → PASS.

- [ ] **Step 6 : Commit**

```bash
git add packages/shared/src/training-time.ts packages/shared/src/training-time.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): computeTrainingTime + formatHoursMinutes (MR-06)"
```

---

## Task 2 : Hook `useTrainingTime`

**Files :** Modify `apps/mobile/src/data/repositories/dashboard-repository.ts`

> ⚠️ **Ordre voulu** : le hook vient AVANT l'ajout au registre. Ajouter `'training-time'` à
> `DASHBOARD_WIDGET_IDS` (Task 4) rend `WIDGET_COMPONENTS` (typé `Record<DashboardWidgetId,…>`)
> incomplet → typecheck mobile rouge tant que le composant n'y est pas branché. On regroupe donc
> registre + branchement dans **un seul commit** (Task 4), après avoir créé hook (Task 2) et composant
> (Task 3). Chaque commit reste vert.
>
> Composition (pas de SQL brut) : `useRunStats('week')` → `stats.totalDurationS` (semaine ISO, borné
> `finishedAtDayKey`) ; `useWorkoutHistory()` → `{ workouts }` (`finishedAt`, `durationSeconds`) filtré
> sur la même semaine. Gating au retour (hooks appelés inconditionnellement).

- [ ] **Step 1 : Imports** — dans `dashboard-repository.ts` : `useSettings`, `PILLARS`, `localDayKey`
  sont **déjà importés** ; `useWorkoutHistory` est **déjà importé** (`./workout-repository`). **Ajouter** :
  `useRunStats` à l'import existant de `./run-repository` ; `startOfWeek` et `computeTrainingTime` à
  l'import `@wellness/shared`.
  > Vérifié : `useWorkoutHistory()` renvoie **`{ workouts, isLoading }`** (`WorkoutHistoryItem[]`, déjà
  > filtrés `status='completed'`, avec `finishedAt: string|null` + `durationSeconds: number|null`) —
  > pas de filtre statut à ajouter. `useRunStats('week')` renvoie `{ stats: { totalDurationS }, isLoading }`.

- [ ] **Step 2 : Écrire le hook**

```ts
export type TrainingTime = {
  totalSeconds: number;
  strengthSeconds: number;
  runningSeconds: number;
  strengthActive: boolean;
  runningActive: boolean;
  isLoading: boolean;
};

export function useTrainingTime(): TrainingTime {
  const { settings } = useSettings();
  const activePillars = settings?.activePillars ?? [...PILLARS];
  const strengthActive = activePillars.includes('strength');
  const runningActive = activePillars.includes('running');

  const { stats, isLoading: runLoading } = useRunStats('week');
  const { workouts, isLoading: workoutLoading } = useWorkoutHistory();

  // Muscu : durées des séances terminées de la semaine ISO courante (borne finished_at),
  // même découpage que useRunStats('week').
  const weekStartKey = localDayKey(startOfWeek(new Date()));
  const strengthSecondsRaw = workouts.reduce((sum, w) => {
    if (w.durationSeconds == null || w.finishedAt == null) return sum;
    const dayKey = localDayKey(new Date(w.finishedAt));
    return dayKey >= weekStartKey ? sum + w.durationSeconds : sum;
  }, 0);

  const agg = computeTrainingTime({
    strengthSeconds: strengthActive ? strengthSecondsRaw : 0,
    runningSeconds: runningActive ? stats.totalDurationS : 0,
  });

  return { ...agg, strengthActive, runningActive, isLoading: runLoading || workoutLoading };
}
```

- [ ] **Step 3 : Vérifier** — `npm run typecheck` → PASS (hook autonome, pas encore branché au registre). Commit :

```bash
git add apps/mobile/src/data/repositories/dashboard-repository.ts
git commit -m "feat(dashboard): hook useTrainingTime (semaine muscu + course, gating)"
```

---

## Task 3 : i18n + composant `TrainingTimeCard` (non encore branché)

**Files :** Create `apps/mobile/src/components/dashboard/TrainingTimeCard.tsx` ; Modify `apps/mobile/src/i18n/locales/fr.json` + `en.json`

- [ ] **Step 1 : i18n** — ajouter le sous-objet `trainingTime` dans le namespace `home` de **fr.json** et **en.json** (parité) :
  - FR : `title`: « Temps d'entraînement », `breakdownStrength`: « muscu », `breakdownRunning`: « course », `empty`: « Aucune séance cette semaine ».
  - EN : `title`: « Training time », `breakdownStrength`: « strength », `breakdownRunning`: « running », `empty`: « No session this week ».
  > ⚠️ **Aucun test de parité i18n automatisé** dans le repo — vérifier **manuellement** que les 4 clés
  > existent des deux côtés (diff fr/en). Le total « Xh YY » est composé par `formatHoursMinutes` (pas de clé i18n).

- [ ] **Step 2 : `TrainingTimeCard.tsx`** — calqué sur [RunningWeekCard.tsx](../../apps/mobile/src/components/dashboard/RunningWeekCard.tsx). `DashboardCard` (`{ icon, title, children }`, depuis `@/components/DashboardCard`) / `DashboardCardCompact` (`{ icon, title, value }`, depuis `@/components/dashboard/DashboardCardCompact`). Gating loading → `return null`. Icône `time-outline`.
  - `const tt = useTrainingTime(); if (tt.isLoading) return null;`
  - **Ventilation** (piliers actifs seulement) :
    ```tsx
    const parts: string[] = [];
    if (tt.strengthActive) parts.push(`${t('home.trainingTime.breakdownStrength')} ${formatHoursMinutes(tt.strengthSeconds)}`);
    if (tt.runningActive) parts.push(`${t('home.trainingTime.breakdownRunning')} ${formatHoursMinutes(tt.runningSeconds)}`);
    const breakdown = parts.join(' · ');
    ```
  - **Compact** : `value = tt.totalSeconds === 0 ? t('home.trainingTime.empty') : formatHoursMinutes(tt.totalSeconds)`.
  - **Full** : `tt.totalSeconds === 0` → empty state (`home.trainingTime.empty`) ; sinon total en grand (`formatHoursMinutes(tt.totalSeconds)`) + `breakdown` en sous-ligne. Styles repris de RunningWeekCard.
  - Le composant compile isolément (il n'est pas encore référencé par `WIDGET_COMPONENTS`).

- [ ] **Step 3 : Vérifier** — `npm run typecheck && npm run lint` → PASS. Commit :

```bash
git add apps/mobile/src/components/dashboard/TrainingTimeCard.tsx apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "feat(dashboard): composant TrainingTimeCard + i18n (non branché)"
```

---

## Task 4 : Brancher le widget — registre + WIDGET_COMPONENTS (un seul commit)

**Files :** Modify `packages/shared/src/dashboard.ts`, `packages/shared/src/dashboard.test.ts`, `apps/mobile/src/components/dashboard/dashboard-widgets.tsx`

> Tout dans **un commit** : l'ID au registre shared **et** l'entrée `WIDGET_COMPONENTS` mobile arrivent
> ensemble → jamais d'état où `WIDGET_COMPONENTS` est incomplet (typecheck mobile toujours vert).

- [ ] **Step 1 : Registre shared** — dans `dashboard.ts` : ajouter `'training-time'` **en fin** de
  `DASHBOARD_WIDGET_IDS` (forward-compat) ; ajouter `'training-time': ['strength', 'running']` à
  `WIDGET_PILLARS` (OU géré par `isWidgetAllowed`).
- [ ] **Step 2 : `dashboard.test.ts`** — passer les comptes de **8 → 9** :
  - liste attendue `toEqual([...])` + libellés « 8/9 widgets » (l.~16-26, l.45) ;
  - `toHaveLength(8)` → `9` aux lignes **45/47, 98, 133, 149, et 204 (`moveWidget`)** ;
  - séquences d'`order` `[0..7]` → `[0..8]` (cas b l.104, `moveWidget` l.203) ;
  - **ajouter** `expect(WIDGET_PILLARS['training-time']).toEqual(['strength','running'])` (vers l.37) ;
  - (cosmétique : commentaire « 6 nouveaux » → « 7 nouveaux » si présent l.~96).
- [ ] **Step 3 : Brancher le composant** — dans `dashboard-widgets.tsx`, importer `TrainingTimeCard` et
  ajouter `'training-time': TrainingTimeCard` à `WIDGET_COMPONENTS` (le `Record<DashboardWidgetId,…>`
  l'impose désormais).
- [ ] **Step 4 : Vérifier** — `npm run typecheck && npm run lint && npm run test` → **tous verts** (shared + mobile). Commit :

```bash
git add packages/shared/src/dashboard.ts packages/shared/src/dashboard.test.ts apps/mobile/src/components/dashboard/dashboard-widgets.tsx
git commit -m "feat(dashboard): activer le widget training-time (registre + WIDGET_COMPONENTS)"
```

---

## Task 5 : Vérification finale & recette

- [ ] **Step 1 : Suite verte** — `npm run typecheck && npm run lint && npm run test`.
- [ ] **Step 2 : Suivi & commit final** — CHANGELOG + TODO (MR-06 livrée, reste recette + relecture Damien ; catalogue MR-06 → ✅), push `dev` via `/commit`.
- [ ] **Step 3 : Recette device (Florian)** :
  - Faire ≥1 séance muscu **et** ≥1 course cette semaine → widget « Temps d'entraînement » : total = somme, ventilation « muscu Xh YY · course Xh YY ».
  - Les chiffres **coïncident** avec « Volume muscu semaine » (mêmes séances) et « Résumé running semaine » (même durée/nb).
  - **Gating** : désactiver la course → widget visible, ventilation muscu seule ; désactiver muscu **et** course (nutrition seule) → widget **absent**.
  - **Empty** : aucune séance/course cette semaine → « 0h 00 » / « Aucune séance cette semaine ».
  - **Compact** : passer le widget en compact (mode édition dashboard) → une ligne cohérente.
  - i18n FR/EN.

---

## Notes

- **100 % client, offline, aucune migration.** Données déjà présentes (`workouts`/`runs` `duration_seconds`).
- **Fenêtre = semaine ISO lundi→dim** (borne `finished_at`), alignée sur `muscle-volume`/`running-week`
  pour que les chiffres se réconcilient — **pas** 7 j glissants.
- Gating transverse géré nativement par le registre (`pillars.some`).
