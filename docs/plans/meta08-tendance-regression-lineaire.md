# META-08 — Tendance générique par régression linéaire · Plan d'implémentation

> **Pour l'exécutant :** SOUS-SKILL REQUISE — `superpowers:subagent-driven-development` (recommandée)
> ou `superpowers:executing-plans`, une tâche à la fois, **TDD**, commits fréquents. Étapes en
> cases à cocher (`- [ ]`).

**Goal :** introduire un moteur unique de régression linéaire (pente/intercept/R²) et rebrancher
`weightTrend` et `paceTrend` dessus, à comportement visible inchangé.

**Spec :** [docs/specs/functional/us/meta08-tendance-regression-lineaire.md](../specs/functional/us/meta08-tendance-regression-lineaire.md).

**Architecture :** `regression.ts` (shared, pur : `linearRegression`) + `daysBetween` (dans
`date.ts`) → adaptateurs `weightTrend` (bodyweight.ts) et `paceTrend` (run-stats.ts) réécrits sur le
moteur (X = jours écoulés ; verdict = `pente × span` vs seuils actuels) → mise à jour des 2 appelants
de `weightTrend`. Golden test de non-régression ancien↔nouveau. Aucune surface, aucune migration,
100 % offline.

**Tech :** TypeScript, Vitest (`packages/shared`), Expo/RN. **Aucun** i18n, **aucune** migration,
**aucun** checkpoint 🔴.

**Ordre & dépendances :** 1 (moteur) et 2 (`daysBetween`) indépendantes → 3 (`weightTrend`) et 4
(`paceTrend`) dépendent de 1+2, indépendantes entre elles → 5 (catalogue + clôture).

---

### Task 1 : Moteur `linearRegression` (shared, pur)

**Files :**
- Create : `packages/shared/src/regression.ts`
- Create : `packages/shared/src/regression.test.ts`
- Modify : `packages/shared/src/index.ts` (ajouter `export * from './regression';`, ordre alphabétique
  approx. — après `./recipe`/avant `./records` ou en fin de bloc, peu importe)

- [ ] **Step 1 — Tests qui échouent** (`regression.test.ts`) :

```ts
import { describe, it, expect } from 'vitest';
import { linearRegression } from './regression';

describe('linearRegression', () => {
  it('droite parfaite croissante → pente exacte, r2 = 1', () => {
    // y = 2x + 1
    const fit = linearRegression([
      { x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 },
    ]);
    expect(fit).not.toBeNull();
    expect(fit!.slope).toBeCloseTo(2, 10);
    expect(fit!.intercept).toBeCloseTo(1, 10);
    expect(fit!.r2).toBeCloseTo(1, 10);
    expect(fit!.n).toBe(4);
  });

  it('série bruitée → pente approchée, 0 < r2 < 1', () => {
    const fit = linearRegression([
      { x: 0, y: 1 }, { x: 1, y: 2.2 }, { x: 2, y: 4.5 }, { x: 3, y: 6.8 },
    ]);
    expect(fit!.slope).toBeGreaterThan(1.5);
    expect(fit!.r2).toBeGreaterThan(0.9);
    expect(fit!.r2).toBeLessThan(1);
  });

  it('série constante en y → pente 0, r2 = 1', () => {
    const fit = linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }]);
    expect(fit!.slope).toBe(0);
    expect(fit!.r2).toBe(1);
  });

  it('moins de 2 points → null', () => {
    expect(linearRegression([])).toBeNull();
    expect(linearRegression([{ x: 3, y: 9 }])).toBeNull();
  });

  it('tous les x identiques (variance x nulle) → null', () => {
    expect(linearRegression([{ x: 2, y: 1 }, { x: 2, y: 5 }, { x: 2, y: 9 }])).toBeNull();
  });

  it('points non triés en x → même résultat que triés', () => {
    const a = linearRegression([{ x: 3, y: 7 }, { x: 0, y: 1 }, { x: 2, y: 5 }, { x: 1, y: 3 }]);
    expect(a!.slope).toBeCloseTo(2, 10);
    expect(a!.intercept).toBeCloseTo(1, 10);
  });

  it('espacement x irrégulier pris en compte (pente par unité de x)', () => {
    // y = 3x : points à x = 0, 1, 10
    const fit = linearRegression([{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 10, y: 30 }]);
    expect(fit!.slope).toBeCloseTo(3, 10);
    expect(fit!.r2).toBeCloseTo(1, 10);
  });
});
```

- [ ] **Step 2 — Échec.** `npm run test -w @wellness/shared` → FAIL (module introuvable).

- [ ] **Step 3 — Implémenter** `regression.ts` (JSDoc FR, style du repo) :

```ts
/**
 * Régression linéaire générique (moindres carrés ordinaires). Brique socle (META-08) :
 * généralise les heuristiques de tendance et débloque les projections (META-14/15/16).
 */

export type RegressionPoint = { x: number; y: number };
export type LinearFit = {
  /** Pente : unité de y par unité de x. */
  slope: number;
  /** Ordonnée à l'origine (y estimé en x = 0). */
  intercept: number;
  /** Qualité d'ajustement (coefficient de détermination), borné [0, 1]. */
  r2: number;
  /** Nombre de points utilisés. */
  n: number;
};

/**
 * Ajuste une droite par moindres carrés. Retourne `null` quand le fit n'a pas de sens :
 * moins de 2 points, ou variance de x nulle (tous les points au même x → pente indéfinie).
 * Série constante en y → droite plate parfaite (`slope 0`, `r2 1`).
 */
export function linearRegression(points: ReadonlyArray<RegressionPoint>): LinearFit | null {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let ssXX = 0; // Σ(x - x̄)²
  let ssXY = 0; // Σ(x - x̄)(y - ȳ)
  let ssYY = 0; // Σ(y - ȳ)²
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    ssXX += dx * dx;
    ssXY += dx * dy;
    ssYY += dy * dy;
  }

  if (ssXX === 0) return null; // variance de x nulle → pente indéfinie

  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  // r2 = corrélation² ; ssYY === 0 (y constant) → droite plate parfaite par convention.
  const r2 = ssYY === 0 ? 1 : Math.max(0, Math.min(1, (ssXY * ssXY) / (ssXX * ssYY)));

  return { slope, intercept, r2, n };
}
```

- [ ] **Step 4 — Succès.** `npm run test -w @wellness/shared` → PASS. Puis `npm run typecheck`.
- [ ] **Step 5 — Commit.** `feat(shared): moteur linearRegression (pente/intercept/R²) — META-08`

---

### Task 2 : Helper `daysBetween` (shared, pur)

**Files :**
- Modify : `packages/shared/src/date.ts` (ajouter `daysBetween`)
- Modify : `packages/shared/src/date.test.ts` (**existe déjà** — ajouter un `describe`, ne pas le recréer)

- [ ] **Step 1 — Tests qui échouent** : dans `date.test.ts`, **ajouter `daysBetween`** à l'import
  existant `from './date'` (l.2), puis **ajouter** ce bloc (ne PAS redéclarer l'import vitest de la l.1) :

```ts
// import à compléter (l.2) : import { addDays, weekdayIndex, startOfWeek, localDayKey, daysBetween } from './date';

describe('daysBetween', () => {
  it('même jour → 0', () => expect(daysBetween('2026-07-18', '2026-07-18')).toBe(0));
  it('jours consécutifs → 1', () => expect(daysBetween('2026-07-18', '2026-07-19')).toBe(1));
  it('sens inverse → négatif', () => expect(daysBetween('2026-07-19', '2026-07-18')).toBe(-1));
  it('passage de mois', () => expect(daysBetween('2026-06-28', '2026-07-01')).toBe(3));
  it('passage d’année', () => expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1));
  it('fenêtre de 30 jours', () => expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30));
  it('année bissextile (fév. 2028)', () =>
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2));
});
```

- [ ] **Step 2 — Échec.** `npm run test -w @wellness/shared` → FAIL.

- [ ] **Step 3 — Implémenter** dans `date.ts` (à la suite des helpers existants) :

```ts
/**
 * Nombre de jours calendaires de `fromKey` à `toKey` (clés locales AAAA-MM-JJ).
 * Calcul via midi UTC → insensible aux transitions d'heure d'été (DST-safe).
 */
export function daysBetween(fromKey: string, toKey: string): number {
  const toMs = (key: string): number => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!, 12);
  };
  return Math.round((toMs(toKey) - toMs(fromKey)) / 86_400_000);
}
```
> `date.ts` est déjà exporté par `index.ts` (`export * from './date';`) — rien à ajouter à l'index.

- [ ] **Step 4 — Succès.** `npm run test -w @wellness/shared` → PASS. Puis `npm run typecheck`.
- [ ] **Step 5 — Commit.** `feat(shared): daysBetween (diff calendaire DST-safe) — META-08`

---

### Task 3 : Refacto `weightTrend` sur le moteur + golden test + appelants

**Files :**
- Modify : `packages/shared/src/bodyweight.ts` (`weightTrend`)
- Modify : `packages/shared/src/bodyweight.test.ts` (**existe déjà** — ajouter le golden ; ne pas recréer)
- Modify : `apps/mobile/src/app/nutrition-stats.tsx:60`
- Modify : `apps/mobile/src/components/dashboard/WeightCard.tsx:78`

- [ ] **Step 1 — Golden test qui échoue** : dans `bodyweight.test.ts`, **ajouter `weightTrend`** à
  l'import existant `from './bodyweight'` (l.2 : `import { computeDeficitVolumeAlert, weightTrend } from
  './bodyweight';`), **ne pas** redéclarer l'import vitest (l.1). Inscrire l'**ancienne logique comme
  oracle** et vérifier la concordance sur des séries datées à jours consécutifs (pour une série
  linéaire, `pente × span = dernier − premier`, donc concordance exacte attendue). Ajouter :

```ts
// Oracle = ancienne implémentation (delta premier↔dernier, seuil ±0,3 kg).
function oldWeightTrend(weights: readonly number[]): 'up' | 'down' | 'stable' {
  if (weights.length < 2) return 'stable';
  const delta = weights[weights.length - 1]! - weights[0]!;
  if (delta > 0.3) return 'up';
  if (delta < -0.3) return 'down';
  return 'stable';
}

// Construit des entrées datées à jours consécutifs à partir d'un tableau de poids.
function dated(weights: readonly number[]): { logDate: string; weightKg: number }[] {
  return weights.map((weightKg, i) => ({
    logDate: `2026-07-${String(i + 1).padStart(2, '0')}`,
    weightKg,
  }));
}

describe('weightTrend (refacto régression, iso-comportement)', () => {
  const series: readonly number[][] = [
    [80, 79.5, 79, 78.4],   // monotone ↓
    [70, 70.4, 71, 71.6],   // monotone ↑
    [75, 75.1, 74.9, 75],   // plat (bruit < seuil)
    [82, 81.8, 81.9, 81.5], // quasi-linéaire ↓
    [68],                   // < 2 points
  ];
  for (const s of series) {
    it(`concorde avec l'oracle : [${s.join(', ')}]`, () => {
      expect(weightTrend(dated(s))).toBe(oldWeightTrend(s));
    });
  }

  it('série vide → stable', () => expect(weightTrend([])).toBe('stable'));

  it('un seul jour (variance x nulle possible) → stable', () =>
    expect(weightTrend([{ logDate: '2026-07-01', weightKg: 80 }])).toBe('stable'));
});
```
> ⚠️ **Découverte des divergences (spec §6/§8)** : lancer d'abord. Si une série **non monotone**
> diverge, la sortir dans un cas dédié commenté `// divergence attendue : non-monotonie` (asserter la
> valeur réelle observée), **ne pas** modifier le moteur pour la forcer.

- [ ] **Step 2 — Échec.** `npm run test -w @wellness/shared` → FAIL (signature `weightTrend` incompatible
  / import). *(La cible actuelle prend `number[]` ; le test passe des objets datés.)*

- [ ] **Step 3 — Réécrire `weightTrend`** dans `bodyweight.ts` (remplacer les lignes 17-24) :

```ts
import { daysBetween } from './date';
import { linearRegression } from './regression';

/**
 * Tendance de poids sur une série datée (seuil ±0,3 kg sur la fenêtre observée).
 * Adossée à la régression linéaire (META-08), X = jours écoulés depuis la 1ʳᵉ pesée.
 */
export function weightTrend(
  entries: ReadonlyArray<{ logDate: string; weightKg: number }>,
): 'up' | 'down' | 'stable' {
  if (entries.length < 2) return 'stable';
  const base = entries.reduce((min, e) => (e.logDate < min ? e.logDate : min), entries[0]!.logDate);
  const last = entries.reduce((max, e) => (e.logDate > max ? e.logDate : max), entries[0]!.logDate);
  const fit = linearRegression(entries.map((e) => ({ x: daysBetween(base, e.logDate), y: e.weightKg })));
  if (fit === null) return 'stable';
  const change = fit.slope * daysBetween(base, last); // kg sur la fenêtre
  if (change > 0.3) return 'up';
  if (change < -0.3) return 'down';
  return 'stable';
}
```
> Placer les `import` en tête de fichier (avec les imports existants `./sync`, `./food`). Pas de
> cycle : `regression.ts` et `date.ts` n'importent rien de `bodyweight.ts`.

- [ ] **Step 4 — Mettre à jour les 2 appelants** (passer l'entrée entière) :
  - `nutrition-stats.tsx:60` : `const trend = weightTrend(weightEntries);` (retirer le `.map(...)`).
  - `WeightCard.tsx:78` : `const trend = weightTrend(entries);` (retirer le `.map(...)`).
  - Vérifier que `weightEntries`/`entries` ont bien `{ logDate, weightKg }` (type `WeightEntry`,
    [bodyweight-repository.ts](../../apps/mobile/src/data/repositories/bodyweight-repository.ts)) — un
    champ `id` en trop ne gêne pas (structurellement compatible).

- [ ] **Step 5 — Succès.** `npm run test -w @wellness/shared` → PASS. Puis `npm run typecheck` (racine,
  couvre le mobile) + `npm run lint`.
- [ ] **Step 6 — Commit.** `refactor(shared): weightTrend via régression + appelants datés — META-08`

---

### Task 4 : Refacto `paceTrend` sur le moteur + golden test

**Files :**
- Modify : `packages/shared/src/run-stats.ts` (`paceTrend`, lignes 51-62)
- Modify : `packages/shared/src/run-stats.test.ts` (golden de non-régression)

- [ ] **Step 1 — Corriger les tests `paceTrend` existants (⚠️ non-régression obligatoire).** Les cas
  existants de `run-stats.test.ts` (l. 33-36) passent des `dayKey` **non datés** (`'a'`, `'b'`, `'c'`,
  `'d'`) — ils ne « marchaient » que parce que l'ancien `paceTrend` **ignorait** la valeur des `dayKey`.
  Le nouveau `paceTrend` fait `daysBetween(base, dayKey)` → `NaN` sur ces clés → `slope = NaN` → verdict
  `'stable'`, ce qui **casse** `.toBe('improving')` (l.33) et `.toBe('declining')` (l.34). **Remplacer**
  les clés bidons par de **vraies dates consécutives** (verdicts inchangés) :
  - l.33 : `dayKey:'a'/'b'/'c'/'d'` → `'2026-07-01'/'02'/'03'/'04'` (allure 360→320, toujours `improving`).
  - l.34 : idem dates → `'declining'` (320→360).
  - l.35 : idem dates → `'stable'` (350/351/349/350).
  - l.36 : `dayKey:'a'` → `'2026-07-01'` (1 point → `'stable'`).
  Les tests `aggregateRunStats`/`paceTrendPoints` (déjà en `AAAA-MM-JJ`) sont **inchangés**.

- [ ] **Step 2 — Golden de caractérisation** (`run-stats.test.ts`) : oracle = ancienne logique (ratio
  des moitiés, seuil ±2 %), points datés à jours consécutifs. Dans l'import de la l.2, `paceTrend` est
  déjà présent → **ajouter `type PaceTrendPoint`** au même import ; ne PAS redéclarer l'import vitest
  (l.1). Ajouter :

```ts
// Oracle = ancien paceTrend (moyenne 2e moitié vs 1re moitié, diviseur m1, seuil ±2 %).
function oldPaceTrend(points: PaceTrendPoint[]): 'improving' | 'declining' | 'stable' {
  if (points.length < 2) return 'stable';
  const n = points.length;
  const firstHalf = points.slice(0, Math.floor(n / 2));
  const secondHalf = points.slice(Math.ceil(n / 2));
  const avg = (xs: PaceTrendPoint[]) => xs.reduce((s, p) => s + p.paceSPerKm, 0) / xs.length;
  const m1 = avg(firstHalf), m2 = avg(secondHalf);
  const ratio = (m2 - m1) / m1;
  if (ratio < -0.02) return 'improving';
  if (ratio > 0.02) return 'declining';
  return 'stable';
}

function paces(values: readonly number[]): PaceTrendPoint[] {
  return values.map((paceSPerKm, i) => ({
    dayKey: `2026-07-${String(i + 1).padStart(2, '0')}`,
    paceSPerKm,
  }));
}

describe('paceTrend (refacto régression, iso-comportement)', () => {
  const series: readonly number[][] = [
    [360, 350, 345, 338], // s'améliore (allure ↓)
    [330, 335, 340, 348], // régresse (allure ↑)
    [350, 351, 349, 350], // stable
    [400, 380, 360, 340], // forte amélioration linéaire
  ];
  for (const s of series) {
    it(`concorde avec l'oracle : [${s.join(', ')}]`, () => {
      expect(paceTrend(paces(s))).toBe(oldPaceTrend(paces(s)));
    });
  }
  it('moins de 2 points → stable', () => expect(paceTrend(paces([345]))).toBe('stable'));
});
```
> ⚠️ **Divergences attendues (spec §5.2/§6)** : le diviseur passe de `m1` à la **moyenne de série** ;
> une série **monotone proche du seuil ±2 %** peut basculer. Lancer d'abord ; si un cas diverge,
> l'extraire en cas dédié `// divergence attendue : diviseur m1→moyenne` (asserter la valeur réelle),
> ne **pas** modifier le moteur.

- [ ] **Step 3 — État de référence.** `npm run test -w @wellness/shared` → **PASS**.
  > ⚠️ **Nature du test** : `paceTrend` gardant sa **signature**, le golden (Step 2) est un test de
  > **caractérisation**, pas du rouge-vert : tant que `paceTrend` **est** encore l'ancien code, il
  > concorde trivialement avec l'oracle (code identique). Sa **vraie valeur** est à l'étape 5 : prouver
  > que le verdict reste iso **après** rebranchement. Les cas l.33-36 (dates corrigées au Step 1)
  > doivent aussi être verts ici.

- [ ] **Step 4 — Réécrire `paceTrend`** dans `run-stats.ts` (remplacer lignes 51-62) :

```ts
import { daysBetween } from './date';
import { linearRegression } from './regression';

export function paceTrend(points: PaceTrendPoint[]): PaceTrendKind {
  if (points.length < 2) return 'stable';
  const base = points.reduce((min, p) => (p.dayKey < min ? p.dayKey : min), points[0]!.dayKey);
  const last = points.reduce((max, p) => (p.dayKey > max ? p.dayKey : max), points[0]!.dayKey);
  const fit = linearRegression(points.map((p) => ({ x: daysBetween(base, p.dayKey), y: p.paceSPerKm })));
  if (fit === null) return 'stable';
  const meanPace = points.reduce((s, p) => s + p.paceSPerKm, 0) / points.length;
  if (meanPace === 0) return 'stable';
  const ratio = (fit.slope * daysBetween(base, last)) / meanPace; // changement relatif sur la fenêtre
  if (ratio < -0.02) return 'improving';
  if (ratio > 0.02) return 'declining';
  return 'stable';
}
```
> `run-stats.ts` importe déjà `localDayKey`/`addDays` de `./date` — ajouter `daysBetween` au même
> import. Ajouter l'import de `./regression`.

- [ ] **Step 5 — Succès (iso prouvé).** `npm run test -w @wellness/shared` → **PASS** : le golden
  concorde toujours avec l'oracle **après** rebranchement (iso-comportement), et les cas l.33-36 restent
  verts. Toute divergence découverte est **figée** en cas dédié commenté (spec §6), pas masquée. Puis
  `npm run typecheck` + `npm run lint`.
- [ ] **Step 6 — Commit.** `refactor(shared): paceTrend via régression (diviseur moyenne série) — META-08`

---

### Task 5 : Catalogue + clôture

**Files :**
- Modify : `docs/product/analyses-donnees.md` (ligne META-08)

- [ ] **Step 1 — META-08 → ✅** dans le catalogue : statut `🆕` → `✅`, mention « moteur
  `linearRegression` (shared) + `daysBetween` ; `weightTrend`/`paceTrend` rebranchés, iso-comportement ;
  débloque projections META-14/15/16 ». Barrer la piste 7 dans « Pistes de priorisation ».
- [ ] **Step 2 — Vérifs globales.** À la racine : `npm run typecheck` + `npm run lint` + `npm run test`
  (tous workspaces) verts.
- [ ] **Step 3 — Revue finale** : sous-agent `superpowers:code-reviewer` (ou `/code-review`) sur le diff
  de la branche `feature/meta08-tendance-regression-lineaire` vs `dev` — cibler : exactitude
  mathématique, non-régression des verdicts, absence de cycle d'import, cas dégénérés.
- [ ] **Step 4 — Clôture** via `superpowers:finishing-a-development-branch` + `/commit`
  (CHANGELOG + TODO : ajouter la ligne recette 🔴 META-08 « non-régression device : verdict/flèche de
  tendance poids [dashboard + Stats nutrition] et allure [Stats running] cohérents avec avant »).

---

## Definition of Done (rappel spec §9)

- `linearRegression` (pente/intercept/R²/n, `null` sur cas dégénéré) et `daysBetween` purs et testés,
  exportés depuis `@wellness/shared`.
- `weightTrend` (signature datée) et `paceTrend` rebranchés sur le moteur, **verdicts iso** (golden
  vert, divergences documentées) ; les 2 appelants de `weightTrend` mis à jour.
- **Aucune** surface UI, **aucune** chaîne i18n, **aucune** migration, **pas de checkpoint 🔴**
  (100 % client, offline → reload Metro).
- typecheck / lint / tests verts sur tous les workspaces ; catalogue **META-08 → ✅**. Reste **recette
  device** (non-régression des tendances poids + allure).
