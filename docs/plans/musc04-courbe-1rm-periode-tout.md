# MUSC-04 (clôture) — Métrique 1RM estimé + période « tout » · Plan

> **Pour l'exécutant :** subagent-driven-development, une tâche à la fois, TDD, commits fréquents.

**Goal :** ajouter à la courbe `/progress` la métrique « 1RM estimé (meilleur par séance) » et la
période « tout », en réutilisant la fonction pure `estimate1RM` (pas d'Epley en SQL).

**Spec :** [docs/specs/functional/us/musc04-courbe-1rm-periode-tout.md](../specs/functional/us/musc04-courbe-1rm-periode-tout.md).

**Architecture :** helper pur `sessionBestEstimated1RM` (shared, testé) → branche `estimated_1rm` de
`useExerciseProgression` (fetch des séries qualifiantes + agrégation JS par séance) → 2 options de
toggle en plus dans `/progress` + i18n. Aucune migration, 100 % offline.

**Tech :** TypeScript, Vitest (shared), Expo/RN, PowerSync (`useQuery` SQLite).

**Ordre :** 1 (shared) → 2 (repository) → 3 (UI + i18n) → 4 (catalogue + clôture).

---

### Task 1 : Helper pur `sessionBestEstimated1RM` (shared)

**Files :**
- Modify : `packages/shared/src/records.ts`
- Test : `packages/shared/src/records.test.ts`

- [ ] **Step 1 — Test qui échoue.** Ajouter dans `records.test.ts` (réutiliser l'import existant de
  `./records`) :

```ts
describe('sessionBestEstimated1RM', () => {
  it('max des 1RM estimés des séries valides d’une séance', () => {
    // estimate1RM(100,5)=116.67 ; estimate1RM(90,10)=120 → max 120
    expect(
      sessionBestEstimated1RM([
        { reps: 5, weightKg: 100 },
        { reps: 10, weightKg: 90 },
      ]),
    ).toBe(120);
  });
  it('ignore les séries à reps/poids manquant', () => {
    expect(
      sessionBestEstimated1RM([
        { reps: null, weightKg: 100 },
        { reps: 8, weightKg: 80 },
        { reps: 5, weightKg: null },
      ]),
    ).toBe(estimate1RM(80, 8));
  });
  it('0 si aucune série qualifiante', () => {
    expect(sessionBestEstimated1RM([])).toBe(0);
    expect(sessionBestEstimated1RM([{ reps: null, weightKg: null }])).toBe(0);
  });
  it('reps ≤ 1 → renvoie le poids (pas de bonus Epley)', () => {
    expect(sessionBestEstimated1RM([{ reps: 1, weightKg: 120 }])).toBe(120);
  });
});
```
> Vérifier la valeur exacte de `estimate1RM(90,10)` (Epley `90×(1+10/30)=120`) et l'arrondi 2
> décimales de `estimate1RM` ; ajuster les attendus au comportement réel de la fonction.

- [ ] **Step 2 — Échec.** `npm run test -w @wellness/shared` → FAIL.

- [ ] **Step 3 — Implémenter** dans `records.ts` (près de `estimate1RM`, JSDoc FR, style du fichier —
  sans accents dans les commentaires si la convention du fichier l'exige) :

```ts
/**
 * Meilleur 1RM estime d'une seance : max de estimate1RM sur les series ayant
 * reps ET poids renseignes. Renvoie 0 si aucune serie qualifiante.
 */
export function sessionBestEstimated1RM(
  sets: ReadonlyArray<{ reps: number | null; weightKg: number | null }>,
): number {
  let best = 0;
  for (const s of sets) {
    if (s.reps == null || s.weightKg == null) continue;
    const oneRm = estimate1RM(s.weightKg, s.reps);
    if (oneRm > best) best = oneRm;
  }
  return best;
}
```

- [ ] **Step 4 — Succès.** `npm run test -w @wellness/shared` → PASS. Puis `npm run typecheck`.
- [ ] **Step 5 — Commit.** `feat(records): sessionBestEstimated1RM — meilleur 1RM estimé d'une séance (MUSC-04)`

---

### Task 2 : Métrique `estimated_1rm` + période `all` (repository)

**Files :**
- Modify : `apps/mobile/src/data/repositories/records-repository.ts`

- [ ] **Step 1 — Types** :
  - `ProgressionMetric` → `'max_weight' | 'volume' | 'estimated_1rm'`.
  - `ProgressionPeriod` → `'30d' | '90d' | '1y' | 'all'`.
- [ ] **Step 2 — Borne `all`** : adapter `periodLowerBound` pour renvoyer une date très ancienne pour
  `'all'` (ex. `new Date(0).toISOString()`), sans lire `PERIOD_DAYS['all']` (qui n'existe pas). Laisser
  `PERIOD_DAYS` typé sur les 3 périodes bornées (ex. `Record<Exclude<ProgressionPeriod,'all'>, number>`).
- [ ] **Step 3 — Branche `estimated_1rm` dans `useExerciseProgression`** : ajouter un 3ᵉ SQL qui remonte
  les **séries qualifiantes** (mêmes filtres que `volumeSql` : séance `completed`, `done=1`,
  `set_type <> 'warmup'`, `reps`/`weight_kg` non nuls, `finished_at >= ?`), colonnes
  `w.id AS workout_id, w.finished_at AS date, s.reps, s.weight_kg` (ordre `w.finished_at`).
  Puis, **en JS** : regrouper par `workout_id`, calculer `sessionBestEstimated1RM(setsDuGroupe)` (import
  depuis `@wellness/shared`), produire `ProgressionPoint { date: finished_at, value }` (exclure `value<=0`),
  trier par date.
  - Sélectionner le SQL selon la métrique (`volume` / `max_weight` / `estimated_1rm`). Garder les deux
    branches existantes **strictement inchangées**.
  - Attention `useQuery` : les hooks/règles React — un seul `useQuery` avec le SQL choisi (comme
    aujourd'hui `sql = isVolume ? volumeSql : maxWeightSql`), généralisé à 3 cas. Le mapping des `data`
    diffère selon la métrique (agrégation JS pour `estimated_1rm`, sinon `{date,value}` direct).
- [ ] **Step 4 — Vérifs.** `npm run typecheck` + `npm run lint` verts.
- [ ] **Step 5 — Commit.** `feat(progress): métrique 1RM estimé (par séance) + période « tout » (MUSC-04)`

---

### Task 3 : Toggles UI + i18n

**Files :**
- Modify : `apps/mobile/src/app/progress/index.tsx`
- Modify : `apps/mobile/src/i18n/locales/fr.json` + `en.json`

- [ ] **Step 1 — Options** : `METRIC_OPTIONS = ['max_weight', 'volume', 'estimated_1rm']` ;
  `PERIOD_OPTIONS = ['30d', '90d', '1y', 'all']`. Vérifier que le `Segment` (3 options) et la rangée
  de `periodChip` (4 puces, `flex:1`) restent lisibles ; ajuster un style seulement si débordement.
- [ ] **Step 2 — i18n FR + EN** (parité, namespace `progress.curve`) :
  - `metric.estimated_1rm` : « 1RM estimé » / « Est. 1RM »
  - `metricLabel.estimated_1rm` : « 1RM estimé » / « Estimated 1RM »
  - `period.all` : « Tout » / « All »
  Aucune chaîne en dur. Vérifier JSON valide des deux fichiers.
- [ ] **Step 3 — Vérifs.** `npm run typecheck` + `npm run lint` verts.
- [ ] **Step 4 — Commit.** `feat(progress): toggles 1RM estimé + « tout » dans la courbe (MUSC-04)`

---

### Task 4 : Catalogue + clôture

**Files :**
- Modify : `docs/product/analyses-donnees.md`

- [ ] **Step 1 — MUSC-04 → ✅** dans le catalogue (statut corrigé depuis ⏳ ; note : courbe
  charge max / volume / 1RM estimé par séance + périodes 30j/90j/1an/tout sur `/progress`).
- [ ] **Step 2 — Revue finale** (subagent code-reviewer sur le diff de la branche).
- [ ] **Step 3 — Clôture** via `finishing-a-development-branch` + `/commit` (CHANGELOG + TODO : ligne
  recette 🔴 MUSC-04).

---

## Definition of Done (rappel spec §9)

Courbe `/progress` : 3 métriques (charge max / volume / 1RM estimé par séance) × 4 périodes
(30 j / 90 j / 1 an / tout) ; `max_weight`/`volume` inchangées ; 1RM réutilise `estimate1RM` (pas
d'Epley SQL) ; i18n FR/EN ; typecheck/lint/tests verts ; pas de migration ; catalogue MUSC-04 ✅.
Reste recette device (Florian).
