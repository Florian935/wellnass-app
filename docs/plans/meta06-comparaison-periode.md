# META-06 — Comparaison période N vs N-1 · Plan d'implémentation

> **Pour l'exécutant :** subagent-driven-development, une tâche à la fois, TDD, commits fréquents.

**Goal :** afficher, à côté des agrégats de 3 écrans de stats (running / nutrition / muscu), un écart
« vs période précédente » (flèche + %, ton neutre), via une brique pure mutualisée + un composant
`DeltaBadge`.

**Spec :** [docs/specs/functional/us/meta06-comparaison-periode.md](../specs/functional/us/meta06-comparaison-periode.md).

**Architecture :** `comparison.ts` (shared, pur, testé : `percentChange`, `previousPeriodTodayKey`)
→ `DeltaBadge` (mobile, mutualisé) → branchement sur 3 surfaces, chacune rappelant un agrégat existant
sur la fenêtre précédente. Aucune migration, 100 % offline.

**Tech :** TypeScript, Vitest (shared), Expo/RN, PowerSync (`useQuery`).

**Ordre & dépendances :** 1 (shared) → 2 (DeltaBadge + i18n socle) → 3/4/5 (3 surfaces, dépendent de
1+2, indépendantes entre elles) → 6 (catalogue + clôture).

---

### Task 1 : Brique de comparaison (shared, pur)

**Files :**
- Create : `packages/shared/src/comparison.ts`
- Create : `packages/shared/src/comparison.test.ts`
- Modify : `packages/shared/src/index.ts` (ajouter `export * from './comparison';`)

- [ ] **Step 1 — Tests qui échouent** (`comparison.test.ts`) :

```ts
import { describe, it, expect } from 'vitest';
import { percentChange, previousPeriodTodayKey } from './comparison';

describe('percentChange', () => {
  it('hausse', () => expect(percentChange(112, 100)).toEqual({ pct: 12, direction: 'up' }));
  it('baisse', () => expect(percentChange(80, 100)).toEqual({ pct: -20, direction: 'down' }));
  it('égalité', () => expect(percentChange(100, 100)).toEqual({ pct: 0, direction: 'flat' }));
  it('previous = 0 → pct null, direction up si current>0', () =>
    expect(percentChange(50, 0)).toEqual({ pct: null, direction: 'up' }));
  it('0 vs 0 → null + flat', () =>
    expect(percentChange(0, 0)).toEqual({ pct: null, direction: 'flat' }));
  it('arrondi entier', () => expect(percentChange(103, 90).pct).toBe(Math.round((13 / 90) * 100)));
});

describe('previousPeriodTodayKey', () => {
  it('week → -7 j', () => expect(previousPeriodTodayKey('2026-07-15', 'week')).toBe('2026-07-08'));
  it('week passage de mois', () =>
    expect(previousPeriodTodayKey('2026-07-03', 'week')).toBe('2026-06-26'));
  it('month → dernier jour du mois précédent', () =>
    expect(previousPeriodTodayKey('2026-07-15', 'month')).toBe('2026-06-30'));
  it('month passage d’année', () =>
    expect(previousPeriodTodayKey('2026-01-10', 'month')).toBe('2025-12-31'));
  it('all → null', () => expect(previousPeriodTodayKey('2026-07-15', 'all')).toBeNull());
});
```
> Vérifier/ajuster les dates attendues au comportement réel de `addDays`/`localDayKey` (fuseau :
> parser la clé en `Date` local, cf. `run-stats.ts:16-17`).

- [ ] **Step 2 — Échec.** `npm run test -w @wellness/shared` → FAIL.

- [ ] **Step 3 — Implémenter** `comparison.ts` (JSDoc FR, convention d'accents du repo) :

```ts
import { addDays, localDayKey } from './date';
import type { StatPeriod } from './run-stats';

export type DeltaDirection = 'up' | 'down' | 'flat';
export type PercentChange = { pct: number | null; direction: DeltaDirection };

export function percentChange(current: number, previous: number): PercentChange {
  const direction: DeltaDirection =
    current > previous ? 'up' : current < previous ? 'down' : 'flat';
  const pct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  return { pct, direction };
}

/** Parse une cle 'AAAA-MM-JJ' en Date locale (minuit local). */
function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function previousPeriodTodayKey(todayKey: string, period: StatPeriod): string | null {
  if (period === 'all') return null;
  const d = parseDayKey(todayKey);
  if (period === 'week') return localDayKey(addDays(d, -7));
  // month : veille du 1er du mois courant => dernier jour du mois precedent
  const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  return localDayKey(addDays(firstOfMonth, -1));
}
```
> Confirmer la signature réelle de `addDays`/`localDayKey`/`StatPeriod` avant d'écrire.

- [ ] **Step 4 — Succès.** `npm run test -w @wellness/shared` → PASS. Puis `npm run typecheck`.
- [ ] **Step 5 — Commit.** `feat(shared): percentChange + previousPeriodTodayKey (META-06)`

---

### Task 2 : Composant `DeltaBadge` + i18n socle

**Files :**
- Create : `apps/mobile/src/components/DeltaBadge.tsx`
- Modify : `apps/mobile/src/i18n/locales/fr.json` + `en.json`

- [ ] **Step 1 — i18n** (namespace `stats.delta`, parité FR/EN) :
  - `new` : FR « nouveau » / EN « new »
  - `a11y.up`/`a11y.down`/`a11y.flat` : libellés d'accessibilité (« en hausse de {{pct}} % », etc.).
- [ ] **Step 2 — Composant** : props `{ change: PercentChange; a11yContext?: string }`.
  - Icône Ionicons : `arrow-up` / `arrow-down` / `remove` (flat), couleur `colors.accent`.
  - Libellé : `change.pct != null` → `` `${pct > 0 ? '+' : ''}${pct} %` `` ; sinon `t('stats.delta.new')`.
  - `accessibilityRole="text"` + `accessibilityLabel` construit via i18n (direction + pct).
  - Style léger (row, gap, petite taille) cohérent avec les chips existants (s'inspirer de
    `WeightCard.tsx:78` pour la flèche). Aucune chaîne en dur.
- [ ] **Step 3 — Vérifs.** `npm run typecheck` + `npm run lint` verts.
- [ ] **Step 4 — Commit.** `feat(stats): composant DeltaBadge + i18n (META-06)`

---

### Task 3 : Surface running (`useRunStatsAt` + `StatsSection`)

**Files :**
- Modify : `apps/mobile/src/data/repositories/run-repository.ts`
- Modify : `apps/mobile/src/app/running-history/index.tsx`

- [ ] **Step 1 — Hook `useRunStatsAt(period, todayKey)`** dans run-repository : réutilise
  `useRunHistory()` + le mapping `toStatRun` (déjà présent, privé au module) + `aggregateRunStats(runs,
  period, todayKey)`. Retourne `{ stats, isLoading }`. (Garder `useRunStats` existant intact ; il peut
  être réécrit pour déléguer à `useRunStatsAt(period, localDayKey(new Date()))` si trivial.)
- [ ] **Step 2 — `StatsSection`** : calculer `todayKey = localDayKey(new Date())`,
  `prevKey = previousPeriodTodayKey(todayKey, period)`. Stats courantes via hook courant ; si
  `prevKey != null`, stats précédentes via `useRunStatsAt(period, prevKey)` (hook appelé
  inconditionnellement — passer une clé « neutre » si `prevKey === null`, et ne PAS monter le badge
  dans ce cas). Sous chaque chip, `DeltaBadge` avec `percentChange(courant, précédent)` pour distance /
  temps / nb. Ne rien afficher si `prevKey === null` (période `all`) ou si les deux hooks chargent.
- [ ] **Step 3 — i18n** (si un libellé « vs période précédente » est ajouté) FR/EN.
- [ ] **Step 4 — Vérifs.** `npm run typecheck` + `npm run lint`.
- [ ] **Step 5 — Commit.** `feat(running): delta vs période précédente sur les stats (META-06)`

---

### Task 4 : Surface nutrition (`nutrition-stats.tsx`)

**Files :**
- Modify : `apps/mobile/src/app/nutrition-stats.tsx`

- [ ] **Step 1 — Fenêtre doublée** : récupérer `useDailyTotals(daysAgo(2N))` (N = 7 ou 30 selon
  `INTAKE_RANGES[range]`). Couper par `logDate` : `courant` = N derniers jours (`logDate >= daysAgo(N)`),
  `précédent` = les N jours d'avant (`daysAgo(2N) <= logDate < daysAgo(N)`).
- [ ] **Step 2 — Delta kcal** : `averageIntake(courant).kcal` vs `averageIntake(précédent).kcal` →
  `percentChange`. `DeltaBadge` dans `avgRow`, sous/à côté du gros chiffre kcal.
- [ ] **Step 3 — Cas limites** : moitié précédente vide → `kcal = 0` → badge « nouveau ». `isLoading`
  géré. Non-régression de l'affichage courant (kcal + macros inchangés).
- [ ] **Step 4 — Vérifs.** `npm run typecheck` + `npm run lint`.
- [ ] **Step 5 — Commit.** `feat(nutrition): delta kcal vs période précédente (META-06)`

---

### Task 5 : Surface muscu (`useWeeklyVolumeComparison` + `WeeklyVolumeSection`)

**Files :**
- Modify : `apps/mobile/src/data/repositories/records-repository.ts`
- Modify : `apps/mobile/src/app/progress/index.tsx`

- [ ] **Step 1 — Hook `useWeeklyVolumeComparison()`** dans records-repository → `{ current, previous,
  isLoading }` (volumes totaux, kg) :
  - `débutSemaine = startOfWeekLocalUtc()` (privé, string ISO — le hook vit dans ce fichier).
  - `débutSemaine-7j` : dériver un `Date` depuis la string (motif `periodLowerBound`), `addDays(-7)`,
    `toISOString()`.
  - `currentSql` : `SELECT SUM(s.reps*s.weight_kg) AS v` avec les filtres existants de
    `useMuscleVolumeThisWeek` (completed, done=1, non-warmup, reps/weight non nuls) + `finished_at >= ?`.
  - `previousSql` : idem + **borne haute** `AND finished_at < ?` sur `[débutSemaine-7j, débutSemaine)`.
  - Deux `useQuery` (appels inconditionnels), `current/previous = row.v ?? 0`.
- [ ] **Step 2 — `WeeklyVolumeSection`** : afficher le **total courant** (kg, via `units`) + un
  `DeltaBadge` « vs semaine précédente » (`percentChange(current, previous)`). Conserver l'histogramme
  par muscle existant. `isLoading` géré.
- [ ] **Step 3 — i18n** (libellé total + « vs semaine précédente ») FR/EN.
- [ ] **Step 4 — Vérifs.** `npm run typecheck` + `npm run lint`.
- [ ] **Step 5 — Commit.** `feat(muscu): volume total + delta vs semaine précédente (META-06)`

---

### Task 6 : Catalogue + clôture

**Files :**
- Modify : `docs/product/analyses-donnees.md`

- [ ] **Step 1 — META-06 → ✅** dans le catalogue (note : delta N vs N-1 sur running/nutrition/muscu,
  brique `percentChange`/`previousPeriodTodayKey`, `DeltaBadge`).
- [ ] **Step 2 — Revue finale** (subagent code-reviewer sur le diff de la branche).
- [ ] **Step 3 — Clôture** via `finishing-a-development-branch` + `/commit` (CHANGELOG + TODO : ligne
  recette 🔴 META-06).

---

## Definition of Done (rappel spec §10)

Delta « vs période précédente » (neutre, flèche + %) sur les 3 surfaces ; « nouveau » sans base ; pas
de badge sur `all` (running). Briques pures testées ; `DeltaBadge` mutualisé ; i18n FR/EN ;
typecheck/lint/tests verts ; pas de migration ; catalogue META-06 ✅. Reste recette device.
