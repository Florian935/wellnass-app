# MUSC-05 — Équilibre musculaire par groupe (14 j) · Plan

> **Pour l'exécutant :** subagent-driven-development, une tâche à la fois, TDD, commits fréquents.

**Goal :** section « Équilibre musculaire (14 j) » dans `/progress` : barres par **séries** colorées
selon le classement (délaissé / équilibré / sur-représenté) + alerte douce listant les groupes
délaissés. Section volume hebdo existante inchangée.

**Spec :** [docs/specs/functional/us/musc05-equilibre-groupes.md](../specs/functional/us/musc05-equilibre-groupes.md).

**Architecture :** logique pure `computeMuscleBalance` (shared, testée) → `MuscleVolumeBarChart` étendu
(couleur par barre, rétrocompatible) → hook `useMuscleBalance()` (14 j, `COUNT`+`SUM` par groupe) →
nouvelle section UI + alerte. Aucune migration, 100 % offline.

**Tech :** TypeScript, Vitest (shared), Expo/RN, PowerSync (`useQuery`).

**Palette de classement** (charte) : délaissé → doré `#c9a96e` ; équilibré → `colors.accent` ;
sur-représenté → `colors.textMuted`. (Pas de token `warning` dans le thème.)

**Ordre :** 1 (shared) → 2 (chart) → 3 (hook) → 4 (UI + i18n) → 5 (catalogue + clôture).

---

### Task 1 : Logique pure `computeMuscleBalance` (shared)

**Files :**
- Create : `packages/shared/src/muscle-balance.ts`
- Create : `packages/shared/src/muscle-balance.test.ts`
- Modify : `packages/shared/src/index.ts` (`export * from './muscle-balance';`)

- [ ] **Step 1 — Tests qui échouent.** Couvrir : normalisation des **6 groupes** (groupe absent →
  `sets:0`) ; `totalSets` ; `hasEnoughData` (< 12 → `false`, tous `'balanced'`, `neglected` vide) ;
  `share` (total 0 → 0, pas de division par zéro) ; classement avec seuils (neglected `sets===0` et
  `share < 1/6*0.5` ; over `share > 1/6*2` ; sinon balanced) ; un seul groupe travaillé (≥12 séries →
  les 5 autres `neglected`, le groupe `over`) ; ordre de `neglected` = ordre `MUSCLE_GROUPS`.

```ts
import { describe, it, expect } from 'vitest';
import { computeMuscleBalance, MIN_SETS_FOR_BALANCE } from './muscle-balance';

describe('computeMuscleBalance', () => {
  it('normalise les 6 groupes (absent → 0 série)', () => {
    const b = computeMuscleBalance([{ muscle: 'chest', sets: 20 }]);
    expect(b.groups).toHaveLength(6);
    expect(b.groups.find((g) => g.muscle === 'back')!.sets).toBe(0);
  });
  it('historique maigre (< 12) → hasEnoughData false, aucun neglected', () => {
    const b = computeMuscleBalance([{ muscle: 'chest', sets: 5 }]);
    expect(b.hasEnoughData).toBe(false);
    expect(b.neglected).toEqual([]);
    expect(b.groups.every((g) => g.status === 'balanced')).toBe(true);
  });
  it('un seul groupe (≥12) → les autres neglected, lui over', () => {
    const b = computeMuscleBalance([{ muscle: 'chest', sets: 24 }]);
    expect(b.hasEnoughData).toBe(true);
    expect(b.groups.find((g) => g.muscle === 'chest')!.status).toBe('over');
    expect(b.neglected).toEqual(['back', 'legs', 'shoulders', 'arms', 'core']);
  });
  it('réparti équitablement → tous balanced', () => {
    const even = ['chest','back','legs','shoulders','arms','core'].map((m) => ({ muscle: m as any, sets: 4 }));
    const b = computeMuscleBalance(even);
    expect(b.neglected).toEqual([]);
    expect(b.groups.every((g) => g.status === 'balanced')).toBe(true);
  });
  it('total 0 → pas de division par zéro', () => {
    const b = computeMuscleBalance([]);
    expect(b.totalSets).toBe(0);
    expect(b.groups.every((g) => g.share === 0)).toBe(true);
  });
});
```

- [ ] **Step 2 — Échec.** `npm run test -w @wellness/shared` → FAIL.
- [ ] **Step 3 — Implémenter** `muscle-balance.ts` (importer `MUSCLE_GROUPS`/`MuscleGroup` de
  `./exercise` ; constantes `EVEN_SHARE=1/6`, `NEGLECTED_SHARE_RATIO=0.5`, `OVER_SHARE_RATIO=2`,
  `MIN_SETS_FOR_BALANCE=12` ; types `MuscleBalanceStatus`/`MuscleGroupBalance`/`MuscleBalance` ;
  fonction conforme à la spec §5). JSDoc FR, convention d'accents du repo.
- [ ] **Step 4 — Succès.** tests PASS + `npm run typecheck`.
- [ ] **Step 5 — Commit.** `feat(shared): computeMuscleBalance — équilibre par groupe (MUSC-05)`

---

### Task 2 : Extension `MuscleVolumeBarChart` (couleur par barre)

**Files :**
- Modify : `apps/mobile/src/components/charts/MuscleVolumeBarChart.tsx`

- [ ] **Step 1** — Étendre `DataPoint` en `{ label; value; color? : string }`. Dans le `map`,
  `frontColor: point.color ?? colors.accent`. **Rétrocompatible** : les usages existants (dashboard,
  volume hebdo) qui ne passent pas `color` gardent `colors.accent`.
- [ ] **Step 2 — Vérifs.** `npm run typecheck` + `npm run lint` verts (les consommateurs existants
  compilent sans changement).
- [ ] **Step 3 — Commit.** `feat(charts): MuscleVolumeBarChart — couleur par barre optionnelle (MUSC-05)`

---

### Task 3 : Hook `useMuscleBalance()` (14 j)

**Files :**
- Modify : `apps/mobile/src/data/repositories/records-repository.ts`

- [ ] **Step 1 — Hook exporté** `useMuscleBalance()` → `{ balance: MuscleBalance; volumes: { muscle:
  MuscleGroup; sets: number; tonnage: number }[]; isLoading }` :
  - Borne basse = **aujourd'hui − 14 j** en ISO UTC (motif `periodLowerBound` : `new Date(Date.now() -
    14*24*3600*1000).toISOString()` — fenêtre glissante, PAS `startOfWeekLocalUtc`).
  - SQL : `SELECT e.muscle_primary AS muscle, COUNT(*) AS sets, SUM(s.reps * s.weight_kg) AS tonnage`
    + JOIN `workouts w` (completed, deleted_at null) + JOIN `exercises e` (deleted_at null), filtres
    `s.deleted_at IS NULL AND s.done=1 AND s.set_type <> 'warmup' AND s.reps IS NOT NULL AND
    s.weight_kg IS NOT NULL AND w.finished_at >= ?`, `GROUP BY e.muscle_primary`. Param `[borne]`.
  - `volumes = rows.map(r => ({ muscle: r.muscle as MuscleGroup, sets: r.sets ?? 0, tonnage: r.tonnage ?? 0 }))`.
  - `balance = computeMuscleBalance(volumes.map(v => ({ muscle: v.muscle, sets: v.sets })))` (import shared).
  - `useQuery` inconditionnel (règles des hooks).
- [ ] **Step 2 — Vérifs.** `npm run typecheck` + `npm run lint`.
- [ ] **Step 3 — Commit.** `feat(muscu): hook useMuscleBalance (séries/tonnage par groupe, 14 j) (MUSC-05)`

---

### Task 4 : Section UI « Équilibre musculaire (14 j) » + i18n

**Files :**
- Modify : `apps/mobile/src/app/progress/index.tsx`
- Modify : `apps/mobile/src/i18n/locales/fr.json` + `en.json`

- [ ] **Step 1 — i18n** (namespace `progress.balance`, parité FR/EN) : `title` (« Équilibre musculaire »),
  `subtitle` (« sur 14 jours »), `alert` message paramétré listant les groupes (ex. « Groupes peu
  travaillés : {{groups}} » / « Under-worked muscle groups: {{groups}} »), légende éventuelle
  (`neglected`/`balanced`/`over`), a11y. Réutiliser `muscle.*` pour les noms de groupes.
- [ ] **Step 2 — Nouvelle section** dans `ProgressScreen` (sous `WeeklyVolumeSection`, qui reste
  **inchangée**) : composant `MuscleBalanceSection` consommant `useMuscleBalance()`.
  - `isLoading` → spinner ; `totalSets === 0` → `EmptyState` (CTA démarrer une séance).
  - Barres par **séries** : `MuscleVolumeBarChart` avec `data = balance.groups.map(g => ({ label:
    t('muscle.'+g.muscle), value: g.sets, color: colorFor(g.status) }))` où `colorFor` :
    `neglected → '#c9a96e'`, `over → colors.textMuted`, `balanced → colors.accent`.
  - **Alerte douce** (style `DeficitVolumeAlertCard` — carte icône `warning-outline` + message, sans
    dismiss) affichée seulement si `balance.hasEnoughData && balance.neglected.length > 0` :
    `t('progress.balance.alert', { groups: balance.neglected.map(m => t('muscle.'+m)).join(', ') })`.
- [ ] **Step 3 — Vérifs.** `npm run typecheck` + `npm run lint`.
- [ ] **Step 4 — Commit.** `feat(muscu): section équilibre musculaire 14 j + alerte groupes délaissés (MUSC-05)`

---

### Task 5 : Catalogue + clôture

**Files :**
- Modify : `docs/product/analyses-donnees.md`

- [ ] **Step 1 — MUSC-05 → ✅** (note : équilibre par séries sur 14 j, barres colorées + alerte groupes
  délaissés, `computeMuscleBalance` + `useMuscleBalance`, ratio push/pull reporté à MUSC-11).
- [ ] **Step 2 — Revue finale** (subagent code-reviewer sur le diff de la branche).
- [ ] **Step 3 — Clôture** via `finishing-a-development-branch` + `/commit` (CHANGELOG + TODO : ligne
  recette 🔴 MUSC-05).

---

## Definition of Done (rappel spec §12)

Section « Équilibre musculaire (14 j) » : barres par séries colorées (délaissé/équilibré/
sur-représenté) + alerte douce des groupes délaissés (si historique suffisant) ; section volume hebdo
inchangée. `computeMuscleBalance` pure testée ; `MuscleVolumeBarChart` étendu rétrocompatible ; i18n
FR/EN ; typecheck/lint/tests verts ; pas de migration ; catalogue MUSC-05 ✅. Reste recette device.
