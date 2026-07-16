# US NUTR-10 — Adhérence à l'objectif — Plan d'implémentation

> **Pour l'exécutant :** tâche par tâche, étapes cochables. TDD sur `packages/shared` (Vitest).
> Mobile : `typecheck` + `lint` + `test` verts ; rendu vérifié en recette. Commits FR.

**Objectif :** carte « Adhérence à l'objectif » (part % + N/M jours dans la cible) sur Stats nutrition,
avec marge configurable (%) synchronisée et objectif effectif par jour.

**Architecture :** logique pure `@wellness/shared` (`computeEffectiveTargetForDay`, `computeGoalAdherence`) ;
colonne `adherence_margin_pct` (migration + schéma PowerSync client + schéma shared + repo) ; hook
`useGoalAdherence` (dashboard-repository, compose totaux/objectif/bonus/marge) ; carte + réglage profil.

**Spec :** [docs/specs/functional/us/nutr10-adherence-objectif.md](../specs/functional/us/nutr10-adherence-objectif.md)

**⚠️ Ordres imposés :**
- Migration cloud (Task 2) **avant** `db:types` ; la **colonne PowerSync client** (Task 4) doit être
  déclarée **après** que la colonne existe côté cloud.
- Ajout du champ au **schéma shared** + **repo** + **PowerSync** = **un seul commit** (Task 4) : ajouter
  `adherenceMarginPct` au `nutritionProfileRowSchema` rend `NutritionProfileRow` incomplet pour le
  repo tant que le mapping n'est pas complété → typecheck rouge sinon.

**Fichiers touchés :**
- Créer : `supabase/migrations/<ts>_nutrition_adherence_margin.sql` ; Modifier : `supabase/MIGRATIONS.md`, `packages/shared/src/database.types.ts` (régénéré)
- Modifier : `packages/shared/src/nutrition.ts` (+ `nutrition.test.ts`)
- Modifier : `apps/mobile/src/powersync/schema.ts`, `apps/mobile/src/data/repositories/nutrition-repository.ts`
- Modifier : `apps/mobile/src/data/repositories/dashboard-repository.ts` (hook)
- Modifier : `apps/mobile/src/app/nutrition-stats.tsx`, `apps/mobile/src/app/nutrition-profile.tsx`, i18n `fr.json`+`en.json`

---

## Task 1 : Migration SQL — colonne `adherence_margin_pct`

**Files :** Create `supabase/migrations/<timestamp>_nutrition_adherence_margin.sql` (`npm run db:new nutrition_adherence_margin`)

- [ ] **Step 1 : Générer** — `npm run db:new nutrition_adherence_margin`.
- [ ] **Step 2 : SQL** (patron `training_bonus_mode`, additif, sync rule `select *` inchangée) :

```sql
-- US NUTR-10 — marge d'adhérence configurable (% de l'objectif) sur le profil nutritionnel.
-- Sync rule PowerSync = "select * from nutrition_profiles" => la colonne descend au client sans modif.
alter table public.nutrition_profiles
  add column if not exists adherence_margin_pct integer not null default 10
    check (adherence_margin_pct between 1 and 50);
```

- [ ] **Step 3 : Prévisualiser** — `npm run db:push:dry` (la migration figure dans la liste).
- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/
git commit -m "feat(nutrition): migration adherence_margin_pct (US NUTR-10)"
```

---

## Task 2 : [CHECKPOINT 🔴 — apply cloud] db:push + db:types + registre

> Étape humaine / contrôleur (dev sur cloud). Additive, pas de sync rule à redéployer.

- [ ] **Step 1** — `npm run db:push`.
- [ ] **Step 2** — `npm run db:types` (régénère `database.types.ts`).
- [ ] **Step 3** — vérif : `select adherence_margin_pct from nutrition_profiles limit 1;` renvoie 10 par défaut.
- [ ] **Step 4** — cocher dans [supabase/MIGRATIONS.md](../../supabase/MIGRATIONS.md).
- [ ] **Step 5 : Commit**

```bash
git add packages/shared/src/database.types.ts supabase/MIGRATIONS.md
git commit -m "chore(db): apply adherence_margin_pct + db:types (US NUTR-10)"
```

---

## Task 3 : Logique pure (TDD) — `computeEffectiveTargetForDay` + `computeGoalAdherence`

**Files :** Modify `packages/shared/src/nutrition.ts`, `packages/shared/src/nutrition.test.ts`

> Indépendante du schéma/DB. `dayCalorieBonus` (nutrition.ts:151) et `trainingDayCalories`
> (nutrition.ts:138) existent déjà.

- [ ] **Step 1 : Tests d'abord** (dans `nutrition.test.ts`) — compléter l'`import … from './nutrition'`
  avec `computeEffectiveTargetForDay, computeGoalAdherence`. _(Le test du **schéma** — défaut 10 + borne —
  est en Task 4, quand le champ est ajouté ; ici uniquement les 2 fonctions pures.)_

```ts
describe('computeEffectiveTargetForDay', () => {
  it('base seule hors jour de séance', () => {
    expect(computeEffectiveTargetForDay({ targetBase: 2000, mode: 'fixed', fixedBonus: 300, isTrainingDay: false, runCaloriesToday: 0 })).toBe(2000);
  });
  it('base + forfait un jour de séance (mode fixed)', () => {
    expect(computeEffectiveTargetForDay({ targetBase: 2000, mode: 'fixed', fixedBonus: 300, isTrainingDay: true, runCaloriesToday: 0 })).toBe(2300);
  });
  it('base + dépense course (mode auto)', () => {
    expect(computeEffectiveTargetForDay({ targetBase: 2000, mode: 'auto', fixedBonus: 300, isTrainingDay: true, runCaloriesToday: 450 })).toBe(2450);
  });
});

describe('computeGoalAdherence', () => {
  const M = 10; // marge %
  it('compte les jours dans la fourchette ±marge', () => {
    const r = computeGoalAdherence([
      { kcal: 2000, effectiveTarget: 2000 }, // exact → in
      { kcal: 2180, effectiveTarget: 2000 }, // +9% → in
      { kcal: 2300, effectiveTarget: 2000 }, // +15% → out
    ], M);
    expect(r).toEqual({ loggedDays: 3, daysInTarget: 2, pct: 67 });
  });
  it('ignore les jours effectiveTarget null (profil incomplet)', () => {
    const r = computeGoalAdherence([
      { kcal: 2000, effectiveTarget: null },
      { kcal: 2000, effectiveTarget: 2000 },
    ], M);
    expect(r).toEqual({ loggedDays: 1, daysInTarget: 1, pct: 100 });
  });
  it('aucun jour loggé → pct 0 sans division par zéro', () => {
    expect(computeGoalAdherence([], M)).toEqual({ loggedDays: 0, daysInTarget: 0, pct: 0 });
  });
});
```

- [ ] **Step 2 : Vérifier l'échec** — `npm run test` → FAIL.

- [ ] **Step 3 : Implémenter** (dans `nutrition.ts`, réutiliser les briques existantes)

```ts
/** Objectif calorique effectif d'un jour = base + bonus (forfait ou dépense course auto). */
export function computeEffectiveTargetForDay(params: {
  targetBase: number;
  mode: TrainingBonusMode;
  fixedBonus: number;
  isTrainingDay: boolean;
  runCaloriesToday: number;
}): number {
  const bonus = dayCalorieBonus({
    mode: params.mode,
    isTrainingDay: params.isTrainingDay,
    fixedBonus: params.fixedBonus,
    runCaloriesToday: params.runCaloriesToday,
  });
  return trainingDayCalories(params.targetBase, bonus);
}

/**
 * Adhérence calorique : part des jours loggés dont les kcal tombent dans la fourchette
 * ±marge% de l'objectif effectif du jour. Les jours sans objectif (`effectiveTarget` null)
 * sont ignorés (non comptés au dénominateur).
 */
export function computeGoalAdherence(
  perDay: { kcal: number; effectiveTarget: number | null }[],
  marginPct: number,
): { loggedDays: number; daysInTarget: number; pct: number } {
  const days = perDay.filter((d) => d.effectiveTarget != null && d.effectiveTarget > 0);
  const loggedDays = days.length;
  const daysInTarget = days.filter(
    (d) => Math.abs(d.kcal - d.effectiveTarget!) <= d.effectiveTarget! * (marginPct / 100),
  ).length;
  const pct = loggedDays > 0 ? Math.round((daysInTarget / loggedDays) * 100) : 0;
  return { loggedDays, daysInTarget, pct };
}
```

- [ ] **Step 4 : Vérifier** — `npm run test` → PASS ; `npm run typecheck` → PASS. Commit :

```bash
git add packages/shared/src/nutrition.ts packages/shared/src/nutrition.test.ts
git commit -m "feat(shared): computeEffectiveTargetForDay + computeGoalAdherence (NUTR-10)"
```

---

## Task 4 : Champ `adherenceMarginPct` — schéma shared + PowerSync + repository (un commit)

**Files :** Modify `packages/shared/src/nutrition.ts`, `apps/mobile/src/powersync/schema.ts`, `apps/mobile/src/data/repositories/nutrition-repository.ts`

> ⚠️ **Un seul commit** (sinon typecheck rouge entre les étapes). Prérequis : Task 2 (colonne cloud + db:types).

- [ ] **Step 1 : Schéma shared** — dans `nutritionProfileRowSchema` (nutrition.ts:257), ajouter (près de `trainingBonusMode`) :
  `adherenceMarginPct: z.number().int().min(1).max(50).default(10),`
- [ ] **Step 2 : Schéma PowerSync client** — dans `nutrition_profiles` (`powersync/schema.ts:55`), ajouter :
  `adherence_margin_pct: column.integer,`
- [ ] **Step 3 : Repository** (`nutrition-repository.ts`) — 4 points :
  1. `NutritionProfileInput` (Pick l.49-62) : ajouter `| 'adherenceMarginPct'`.
  2. `NutritionDbRow` (l.65-82) : ajouter `adherence_margin_pct: number | null;`.
  3. `rowToNutritionProfile` (l.92-111) : ajouter `adherenceMarginPct: row.adherence_margin_pct ?? 10,`.
  4. `inputToColumns` (l.114-128) : ajouter `if ('adherenceMarginPct' in input) columns['adherence_margin_pct'] = input.adherenceMarginPct;`.
- [ ] **Step 4 : Test de schéma** (dans `nutrition.test.ts`, `describe('nutritionProfileRowSchema')`) :
  `expect(nutritionProfileRowSchema.parse(base).adherenceMarginPct).toBe(10)` (défaut) +
  `expect(nutritionProfileRowSchema.safeParse({ ...base, adherenceMarginPct: 0 }).success).toBe(false)` (borne).
- [ ] **Step 5 : Vérifier** — `npm run typecheck && npm run test` → PASS. Commit :

```bash
git add packages/shared/src/nutrition.ts packages/shared/src/nutrition.test.ts apps/mobile/src/powersync/schema.ts apps/mobile/src/data/repositories/nutrition-repository.ts
git commit -m "feat(nutrition): champ adherenceMarginPct (schéma shared + PowerSync + repo)"
```

---

## Task 5 : Hook `useGoalAdherence(windowDays)`

**Files :** Modify `apps/mobile/src/data/repositories/dashboard-repository.ts`

> Emplacement : dashboard-repository (tous les hooks nécessaires y sont déjà importés ; y vivent
> `useDayCalorieTarget`/`useDeficitVolumeAlert`). Réutilise le calcul de l'objectif de base de
> `useDayCalorieTarget` (mêmes `tdee`/`targetCalories`/`objectiveFromGoal`, déjà importés).

- [ ] **Step 1 : Importer** `computeEffectiveTargetForDay`, `computeGoalAdherence` depuis `@wellness/shared` (imports existants).
- [ ] **Step 2 : Écrire le hook**

```ts
export type GoalAdherence = {
  loggedDays: number;
  daysInTarget: number;
  pct: number;
  marginPct: number;
  hasTarget: boolean;
  isLoading: boolean;
};

export function useGoalAdherence(windowDays: number): GoalAdherence {
  const { nutritionProfile, isLoading: nutriLoading } = useNutritionProfile();
  const { profile, isLoading: profileLoading } = useProfile();
  const { latest, isLoading: weightLoading } = useLatestWeight();
  const { settings } = useSettings();
  const { totals, isLoading: totalsLoading } = useDailyTotals(daysAgo(windowDays));
  const { workouts, isLoading: wLoading } = useWorkoutHistory();
  const { runs, isLoading: rLoading } = useRunHistory();

  const isLoading = nutriLoading || profileLoading || weightLoading || totalsLoading || wLoading || rLoading;

  // Objectif de base (indépendant du jour), même logique que useDayCalorieTarget.
  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const age = profile?.birthDate ? computeAge(new Date(profile.birthDate)) : undefined;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age,
    activityLevel: nutritionProfile?.activityLevel ?? 'moderate',
  });
  const targetBase =
    tdeeValue != null && objective != null
      ? targetCalories(tdeeValue, objective, nutritionProfile?.manualCalories ?? null)
      : null;

  const mode: TrainingBonusMode = nutritionProfile?.trainingBonusMode ?? 'fixed';
  const fixedBonus = nutritionProfile?.trainingDayBonus ?? 0;
  const marginPct = nutritionProfile?.adherenceMarginPct ?? 10;
  const weightKg = latest?.weightKg ?? profile?.weightKg ?? null;
  const runningActive = (settings?.activePillars ?? [...PILLARS]).includes('running');

  // Jours d'entraînement (muscu/course terminés) + dépense course, par jour.
  const trainedDays = new Set<string>();
  for (const w of workouts) if (w.finishedAt) trainedDays.add(localDayKey(new Date(w.finishedAt)));
  for (const r of runs) if (r.finishedAt) trainedDays.add(localDayKey(new Date(r.finishedAt)));
  const runCaloriesByDay = new Map<string, number>();
  if (runningActive) {
    for (const r of runs) {
      if (!r.finishedAt) continue;
      const k = localDayKey(new Date(r.finishedAt));
      runCaloriesByDay.set(
        k,
        (runCaloriesByDay.get(k) ?? 0) +
          estimateRunCalories({ distanceM: r.distanceM, durationSeconds: r.durationSeconds, weightKg }),
      );
    }
  }

  const perDay = totals.map((d) => ({
    kcal: d.kcal,
    effectiveTarget:
      targetBase == null
        ? null
        : computeEffectiveTargetForDay({
            targetBase,
            mode,
            fixedBonus,
            isTrainingDay: trainedDays.has(d.logDate),
            runCaloriesToday: runCaloriesByDay.get(d.logDate) ?? 0,
          }),
  }));

  const { loggedDays, daysInTarget, pct } = computeGoalAdherence(perDay, marginPct);
  return { loggedDays, daysInTarget, pct, marginPct, hasTarget: targetBase != null, isLoading };
}
```

> ⚠️ Vérifier que `DailyTotal.logDate` est bien une clé `AAAA-MM-JJ` comparable à `localKey(finishedAt)`
> (les deux en jour local). `useDailyTotals` exclut déjà les jours vides (GROUP BY).

- [ ] **Step 3 : Vérifier** — `npm run typecheck` → PASS. Commit :

```bash
git add apps/mobile/src/data/repositories/dashboard-repository.ts
git commit -m "feat(nutrition): hook useGoalAdherence (objectif effectif par jour, marge)"
```

---

## Task 6 : UI — carte Adhérence (Stats) + réglage marge (profil) + i18n

**Files :** Modify `apps/mobile/src/app/nutrition-stats.tsx`, `apps/mobile/src/app/nutrition-profile.tsx`, `apps/mobile/src/i18n/locales/fr.json`+`en.json`

- [ ] **Step 1 : i18n** — `stats.adherence` (FR/EN parité) : `title`, `inTarget_one`/`inTarget_other`
  (« {{count}} / {{total}} jour(s) dans la cible »), `margin` (« ±{{pct}} % de l'objectif »), `empty`
  (« Aucun jour renseigné »), `noTarget` (« Définis ton objectif calorique »). `nutrition.adherenceMargin`
  (« Marge d'adhérence »). Patron pluriel = `home.runningWeek.sessions_one/_other`.
- [ ] **Step 2 : Carte Adhérence** dans `nutrition-stats.tsx`, **section apports** (sous la carte apports
  moyens, même `intakeRange`). Appeler `useGoalAdherence(intakeWindowDays)`. Rendu :
  - `!hasTarget` → message `stats.adherence.noTarget` (lien profil) ;
  - `loggedDays === 0` → `stats.adherence.empty` ;
  - sinon : `pct %` en valeur forte + `t('stats.adherence.inTarget', { count: daysInTarget, total: loggedDays })` + `t('stats.adherence.margin', { pct: marginPct })`.
  - Style : réutiliser `Card` + styles de section existants (pas de graphe).
- [ ] **Step 3 : Réglage marge** dans `nutrition-profile.tsx` : un `Segment` options `['5','10','15']`,
  valeur `String(nutritionProfile?.adherenceMarginPct ?? 10)`,
  `onChange={(v) => void upsertNutritionProfile({ adherenceMarginPct: parseInt(v, 10) })}`, et ⚠️ **prop
  `label` OBLIGATOIRE** (`SegmentProps.label` non-optionnel) : `label={(v) => \`${v} %\`}`. Titre de
  section via `nutrition.adherenceMargin`. Placer près du réglage bonus jour de séance (`Segment` mode,
  l.~190). ⚠️ **Note (M4)** : cet emplacement est dans la branche « profil complet » (`tdee/target != null`)
  → la marge n'apparaît **pas** si le profil est incomplet. Assumé (la marge n'a de sens qu'avec un
  objectif ; la carte Adhérence renvoie de toute façon vers le profil via l'état `noTarget`).
- [ ] **Step 4 : Vérifier** — `npm run typecheck && npm run lint && npm run test` verts ; parité i18n (diff fr/en). Commit :

```bash
git add apps/mobile/src/app/nutrition-stats.tsx apps/mobile/src/app/nutrition-profile.tsx apps/mobile/src/i18n/locales/fr.json apps/mobile/src/i18n/locales/en.json
git commit -m "feat(nutrition): carte Adhérence (Stats) + réglage marge (profil) + i18n"
```

---

## Task 7 : Vérification finale & recette

- [ ] **Step 1 : Suite verte** — `npm run typecheck && npm run lint && npm run test`.
- [ ] **Step 2 : Suivi & commit final** — CHANGELOG + TODO (NUTR-10 livrée, reste recette + relecture ; catalogue NUTR-10 → ✅), push `dev` via `/commit`.
- [ ] **Step 3 : Recette device (Florian)** :
  - Logger plusieurs jours (certains dans la cible, d'autres non) → carte : `pct %` + « N/M jours dans la cible » cohérents avec la marge.
  - Changer la **marge** (5/10/15 %) dans le profil → la carte se recalcule immédiatement.
  - **Jour de séance** : l'objectif de référence = base + bonus (pas la base) — vérifier qu'un jour de séance « bien mangé » compte comme dans la cible.
  - **7 j ↔ 30 j** : le sélecteur pilote apports + adhérence.
  - Profil sans objectif → « Définis ton objectif » ; fenêtre sans jour loggé → « Aucun jour renseigné ».
  - i18n FR/EN.

---

## Notes

- **Checkpoint 🔴** = Task 2 (migration cloud). Sync rule inchangée (`select *`).
- **Ordre critique** : Task 2 (db:types) avant Task 4 ; schéma shared+repo+PowerSync groupés (Task 4) ;
  logique pure (Task 3) indépendante.
- **100 % client** hormis la migration. Objectif effectif par jour = calcul en mémoire (données déjà
  chargées), mode Auto inclus.
