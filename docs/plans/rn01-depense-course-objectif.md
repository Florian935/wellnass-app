# RN-01/RN-02 — Dépense course → objectif du jour · Plan d'implémentation

> **Pour l'exécutant :** exécution en **subagent-driven-development**, une tâche à la fois, TDD,
> commits fréquents. Étapes en `- [ ]`.

**Objectif :** un réglage **Forfait / Auto** dans le profil nutrition ; en Auto, l'objectif
calorique du jour suit la **dépense estimée des courses terminées** (repli forfait pour la muscu),
comportement Forfait inchangé.

**Spec :** [docs/specs/functional/us/rn01-depense-course-objectif.md](../specs/functional/us/rn01-depense-course-objectif.md).

**Architecture :** logique pure et testée dans `@wellness/shared` (`estimateRunCalories` dans
`running.ts` ; `TrainingBonusMode` + `dayCalorieBonus` dans `nutrition.ts`) ; nouvelle colonne
`nutrition_profiles.training_bonus_mode` (défaut `'fixed'`) **câblée manuellement** dans le
repository mobile (le mobile ne parse pas via Zod : conversion snake↔camel à la main dans
`nutrition-repository.ts`) et déclarée dans le **schéma PowerSync local** ; centralisation du calcul
d'objectif effectif dans `useNutritionSummary`, consommé par le dashboard (`NutritionSummaryCard`)
et le journal ; sélecteur `Segment` dans l'écran profil ; badge adaptatif + i18n FR/EN.

**Tech :** TypeScript, Vitest (shared), Expo/RN, Zod, PowerSync/Supabase.

**Ordre & dépendances :**
- Tâches **1→2** (shared, pur) : sans dépendance.
- Tâche **3** (câblage repository + schéma PowerSync local) : **prérequis** de la lecture (T5) et de
  l'écriture (T6) du mode côté mobile. Le repli `'fixed'` est posé ici dans `rowToNutritionProfile`
  (`?? 'fixed'`), **pas** par le `.default('fixed')` Zod (jamais exécuté au runtime mobile — il ne
  couvre que les tests shared). Grâce à ce repli + colonne additive, le code fonctionne **comme
  aujourd'hui** (mode `fixed`) avant même que la migration soit poussée ; seul l'**enregistrement**
  d'un mode `auto` a un effet une fois la colonne présente en base.
- Tâche **4** (migration) = **checkpoint 🔴 Florian** (`db:push` + `db:types`).
- Tâches **5→7** (mobile UI/logique) dépendent de 1+2+3. Tâche **8** = catalogue + clôture.

---

### Task 1 : `estimateRunCalories` (pur, shared)

**Files :**
- Modify : `packages/shared/src/running.ts`
- Test : `packages/shared/src/running.test.ts`

- [ ] **Step 1 — Test qui échoue.** Ajouter dans `running.test.ts` :

```ts
import { estimateRunCalories, NET_KCAL_PER_KG_KM, MAX_INTENSITY_BONUS } from './running';

describe('estimateRunCalories', () => {
  it('0 si distance ou poids manquant/nul', () => {
    expect(estimateRunCalories({ distanceM: null, durationSeconds: 1800, weightKg: 70 })).toBe(0);
    expect(estimateRunCalories({ distanceM: 10000, durationSeconds: 1800, weightKg: null })).toBe(0);
    expect(estimateRunCalories({ distanceM: 0, durationSeconds: 1800, weightKg: 70 })).toBe(0);
    expect(estimateRunCalories({ distanceM: 10000, durationSeconds: 1800, weightKg: 0 })).toBe(0);
  });

  it('base NET = poids × km × 1.0 pour une allure « facile » (≤ 8 km/h → +0 %)', () => {
    // 10 km en 1 h15 = 8 km/h exactement → aucun bonus d'intensité
    expect(estimateRunCalories({ distanceM: 10000, durationSeconds: 4500, weightKg: 70 })).toBe(700);
  });

  it('durée absente → base NET seule (pas de terme d’intensité)', () => {
    expect(estimateRunCalories({ distanceM: 10000, durationSeconds: null, weightKg: 70 })).toBe(700);
  });

  it('allure rapide → bonus d’intensité borné à +10 %', () => {
    // 10 km en 30 min = 20 km/h → (20-8)×0.01 = 0.12 → plafonné à 0.10
    const kcal = estimateRunCalories({ distanceM: 10000, durationSeconds: 1800, weightKg: 70 });
    expect(kcal).toBe(Math.round(700 * (1 + MAX_INTENSITY_BONUS))); // 770
  });

  it('allure intermédiaire → bonus proportionnel non plafonné', () => {
    // 10 km en 50 min = 12 km/h → (12-8)×0.01 = 0.04 → ×1.04
    const kcal = estimateRunCalories({ distanceM: 10000, durationSeconds: 3000, weightKg: 70 });
    expect(kcal).toBe(Math.round(700 * 1.04)); // 728
  });

  it('NET_KCAL_PER_KG_KM vaut 1.0', () => {
    expect(NET_KCAL_PER_KG_KM).toBe(1.0);
  });
});
```

- [ ] **Step 2 — Vérifier l'échec.** `npm run test -w @wellness/shared` → FAIL (`estimateRunCalories` non défini).

- [ ] **Step 3 — Implémenter** dans `running.ts` (suivre le style du fichier, JSDoc FR) :

```ts
/** Coût énergétique net de la course à plat (kcal par kg et par km), heuristique ajustable. */
export const NET_KCAL_PER_KG_KM = 1.0;
/** Allure « facile » (km/h) en dessous de laquelle aucun surcoût d'intensité. */
export const EASY_KMH = 8;
/** Surcoût d'intensité par km/h au-dessus de EASY_KMH. */
export const PER_KMH_BONUS = 0.01;
/** Plafond du surcoût d'intensité (EPOC). */
export const MAX_INTENSITY_BONUS = 0.10;

/**
 * Estime la dépense calorique NET d'une course (énergie au-dessus du repos, déjà compté
 * dans le TDEE). Base ≈ poids × distance ; petit terme d'intensité borné pour les allures
 * rapides (EPOC). Renvoie 0 si distance ou poids manquant/nul.
 */
export function estimateRunCalories(params: {
  distanceM: number | null;
  durationSeconds: number | null;
  weightKg: number | null;
}): number {
  const { distanceM, durationSeconds, weightKg } = params;
  if (!distanceM || distanceM <= 0 || !weightKg || weightKg <= 0) return 0;
  const distanceKm = distanceM / 1000;
  const base = weightKg * distanceKm * NET_KCAL_PER_KG_KM;
  let intensityBonus = 0;
  if (durationSeconds && durationSeconds > 0) {
    const speedKmh = distanceKm / (durationSeconds / 3600);
    intensityBonus = Math.min(
      MAX_INTENSITY_BONUS,
      Math.max(0, (speedKmh - EASY_KMH) * PER_KMH_BONUS),
    );
  }
  return Math.round(base * (1 + intensityBonus));
}
```

- [ ] **Step 4 — Vérifier le succès.** `npm run test -w @wellness/shared` → PASS.
- [ ] **Step 5 — Commit.** `feat(running): estimateRunCalories — dépense NET + intensité bornée (RN-01)`

---

### Task 2 : `TrainingBonusMode` + `dayCalorieBonus` + schéma Zod (pur, shared)

**Files :**
- Modify : `packages/shared/src/nutrition.ts`
- Test : `packages/shared/src/nutrition.test.ts`

- [ ] **Step 1 — Test qui échoue.** Ajouter dans `nutrition.test.ts`. Pour les tests du schéma,
  réutiliser l'objet `base` déjà présent dans le fichier (`{ id, userId, createdAt, updatedAt,
  deletedAt: null }` — tous les autres champs ont un `.default()`) :

```ts
import { dayCalorieBonus, nutritionProfileRowSchema } from './nutrition';

describe('dayCalorieBonus', () => {
  it('fixed : forfait les jours de séance, 0 sinon', () => {
    expect(dayCalorieBonus({ mode: 'fixed', isTrainingDay: true, fixedBonus: 300, runCaloriesToday: 999 })).toBe(300);
    expect(dayCalorieBonus({ mode: 'fixed', isTrainingDay: false, fixedBonus: 300, runCaloriesToday: 999 })).toBe(0);
    expect(dayCalorieBonus({ mode: 'fixed', isTrainingDay: true, fixedBonus: 0, runCaloriesToday: 999 })).toBe(0);
  });
  it('auto : dépense course si course terminée', () => {
    expect(dayCalorieBonus({ mode: 'auto', isTrainingDay: true, fixedBonus: 300, runCaloriesToday: 450 })).toBe(450);
  });
  it('auto : repli forfait si jour de séance sans course', () => {
    expect(dayCalorieBonus({ mode: 'auto', isTrainingDay: true, fixedBonus: 300, runCaloriesToday: 0 })).toBe(300);
  });
  it('auto : 0 si aucune activité', () => {
    expect(dayCalorieBonus({ mode: 'auto', isTrainingDay: false, fixedBonus: 300, runCaloriesToday: 0 })).toBe(0);
  });
});

describe('nutritionProfileRowSchema.trainingBonusMode', () => {
  it('défaut fixed', () => {
    expect(nutritionProfileRowSchema.parse(base).trainingBonusMode).toBe('fixed');
  });
  it('accepte auto', () => {
    expect(nutritionProfileRowSchema.parse({ ...base, trainingBonusMode: 'auto' }).trainingBonusMode).toBe('auto');
  });
});
```

- [ ] **Step 2 — Vérifier l'échec.** `npm run test -w @wellness/shared` → FAIL.

- [ ] **Step 3 — Implémenter** dans `nutrition.ts` (près de `trainingDayCalories`) :

```ts
export type TrainingBonusMode = 'fixed' | 'auto';

/** Bonus calorique du jour à ajouter à la cible de base, selon le mode. */
export function dayCalorieBonus(params: {
  mode: TrainingBonusMode;
  isTrainingDay: boolean;
  fixedBonus: number;
  runCaloriesToday: number;
}): number {
  const { mode, isTrainingDay, fixedBonus, runCaloriesToday } = params;
  const forfait = isTrainingDay && fixedBonus > 0 ? fixedBonus : 0;
  if (mode === 'fixed') return forfait;
  if (runCaloriesToday > 0) return runCaloriesToday;
  return forfait;
}
```

Ajouter au `nutritionProfileRowSchema` (les champs y sont **déjà en camelCase**, pas de
`.transform` : ajouter simplement la ligne) :
`trainingBonusMode: z.enum(['fixed', 'auto']).default('fixed'),`

- [ ] **Step 4 — Vérifier le succès.** `npm run test -w @wellness/shared` → PASS.
- [ ] **Step 5 — Typecheck.** `npm run typecheck`.
- [ ] **Step 6 — Commit.** `feat(nutrition): dayCalorieBonus + mode forfait/auto (schéma Zod) (RN-02)`

---

### Task 3 : Câblage repository mobile + schéma PowerSync local

> Le mobile **ne parse pas** via Zod : `nutrition-repository.ts` convertit snake↔camel à la main.
> C'est ici qu'on rend `trainingBonusMode` lisible/écrivable et qu'on pose le repli `'fixed'`.

**Files :**
- Modify : `apps/mobile/src/data/repositories/nutrition-repository.ts`
- Modify : `apps/mobile/src/powersync/schema.ts`

- [ ] **Step 1 — `powersync/schema.ts`** (~l. 55-70, table `nutrition_profiles`) : ajouter
  `training_bonus_mode: column.text` pour que la colonne descende dans le SQLite local (sinon
  `select *` ne la renvoie jamais).
- [ ] **Step 2 — `nutrition-repository.ts`**, quatre points (motif identique à `training_day_bonus`) :
  - `NutritionDbRow` (~l. 48-64) : ajouter `training_bonus_mode: string | null`.
  - `rowToNutritionProfile` (~l. 74-92) : ajouter
    `trainingBonusMode: (row.training_bonus_mode as 'fixed' | 'auto' | null) ?? 'fixed'`. **← repli sûr.**
  - `NutritionProfileInput` (~l. 33-45, le `Pick`) : autoriser `trainingBonusMode`.
  - `inputToColumns` (~l. 95-108, écriture) :
    `if ('trainingBonusMode' in input) columns['training_bonus_mode'] = input.trainingBonusMode`.
- [ ] **Step 3 — Typecheck + lint.** `npm run typecheck && npm run lint`.
- [ ] **Step 4 — Commit.** `feat(nutrition): câblage repository + schéma PowerSync du mode bonus (RN-02)`

---

### Task 4 : Migration `nutrition_profiles.training_bonus_mode` (checkpoint 🔴 Florian)

**Files :**
- Create : `supabase/migrations/<horodaté>_nutrition_training_bonus_mode.sql`
- Modify : `supabase/MIGRATIONS.md`

- [ ] **Step 1 — Créer la migration.** `npm run db:new nutrition_training_bonus_mode`, puis écrire :

```sql
alter table public.nutrition_profiles
  add column if not exists training_bonus_mode text not null default 'fixed'
    check (training_bonus_mode in ('fixed', 'auto'));
```

> Additive, rétrocompatible. Sync rule `nutrition_profiles` = `select *` → **rien à changer** dans
> [powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml).

- [ ] **Step 2 — Prévisualiser (dev).** `npm run db:push:dry` (montrer la sortie ; **ne pas** lancer
  `db:push`).
- [ ] **Step 3 — Ajouter la ligne** dans `supabase/MIGRATIONS.md` (non cochée jusqu'à application).
- [ ] **Step 4 — 🔴 Handoff Florian :** `npm run db:push`, cocher [MIGRATIONS.md](../../supabase/MIGRATIONS.md)
  (case + date), `npm run db:types`.
- [ ] **Step 5 — Commit.** `feat(db): colonne training_bonus_mode sur nutrition_profiles (RN-02)`

---

### Task 5 : Centraliser le calcul d'objectif effectif (mobile)

**Files :**
- Modify : `apps/mobile/src/data/repositories/dashboard-repository.ts`
- Modify : `apps/mobile/src/app/(tabs)/nutrition.tsx`

**But :** un seul endroit calcule `effectiveTarget` + l'origine du bonus (course vs forfait), pour le
dashboard **et** le journal (aujourd'hui dupliqué).

- [ ] **Step 1 — Étendre `useNutritionSummary`** (~l. 200-246) pour lire aussi :
  - `mode = nutritionProfile.trainingBonusMode` ; `fixedBonus = nutritionProfile.trainingDayBonus ?? 0` ;
  - **poids** : `useLatestWeight().latest?.weightKg ?? profile?.weightKg ?? null`
    (le poids vient du **profil général** via `useProfile` — `NutritionProfileRow` n'a pas de `weightKg`) ;
  - **piliers actifs** : ajouter `useSettings()` (pas encore lu par ce hook) →
    `const runningActive = (settings?.activePillars ?? [...PILLARS]).includes('running')`
    (motif identique à `dashboard-repository.ts:445-447`) ;
  - **courses terminées du jour** : `useRunHistory()` filtré en mémoire
    `runs.filter(r => r.finishedAt && localDayKey(new Date(r.finishedAt)) === dayKey)`
    (`localDayKey` attend un `Date`) ; `dayKey` = aujourd'hui ;
  - `runCaloriesToday = runningActive ? Σ estimateRunCalories({distanceM,durationSeconds,weightKg}) : 0` ;
  - `bonus = dayCalorieBonus({ mode, isTrainingDay, fixedBonus, runCaloriesToday })` ;
  - `effectiveTarget = target != null ? trainingDayCalories(target, bonus) : target`.
  Exposer dans `NutritionSummary` : `bonusSource: 'run' | 'forfait' | 'none'`
  (`run` si `mode==='auto' && runCaloriesToday>0` ; sinon `forfait` si `bonus>0` ; sinon `none`) et
  garder `trainingBonus = bonus`.
- [ ] **Step 2 — Journal consomme le hook.** Dans `nutrition.tsx`, **supprimer** le recalcul local
  (~l. 97-100) et lire `effectiveTarget` + `bonusSource` + `trainingBonus` depuis `useNutritionSummary`.
- [ ] **Step 3 — Typecheck + lint.** `npm run typecheck && npm run lint`.
- [ ] **Step 4 — Commit.** `refactor(nutrition): objectif effectif centralisé (mode + dépense course) (RN-02)`

---

### Task 6 : Sélecteur Forfait / Auto (écran profil)

**Files :**
- Modify : `apps/mobile/src/app/nutrition-profile.tsx`
- Modify : `apps/mobile/src/i18n/locales/fr.json` + `en.json`

- [ ] **Step 1 — `Segment`** (`apps/mobile/src/components/Segment.tsx`) « Forfait / Auto » au-dessus
  du champ `trainingDayBonus` (~l. 184), lié à `nutritionProfile.trainingBonusMode`, écrit via
  `upsertNutritionProfile({ trainingBonusMode: value })` (le champ est désormais accepté grâce à T3).
- [ ] **Step 2 — Aide/label.** Ajuster `nutrition.calories.trainingBonus` / `trainingBonusHint`
  (fr.json:126-127) pour préciser : forfait (mode Forfait) **et** repli des jours muscu (mode Auto).
- [ ] **Step 3 — i18n FR + EN** à parité (libellés du segment + aide). Aucune chaîne en dur.
- [ ] **Step 4 — Typecheck + lint.**
- [ ] **Step 5 — Commit.** `feat(nutrition): sélecteur forfait/auto dans le profil (RN-02)`

---

### Task 7 : Badge adaptatif (journal + carte dashboard) + i18n

**Files :**
- Modify : `apps/mobile/src/app/(tabs)/nutrition.tsx` (badge journal, clé `journal.trainingDayBadge`)
- Modify : `apps/mobile/src/components/dashboard/NutritionSummaryCard.tsx` (clé `home.nutrition.trainingDayBadge`)
- Modify : `apps/mobile/src/i18n/locales/fr.json` + `en.json`

- [ ] **Step 1 — `NutritionSummaryCard`** : consommer `bonusSource` (déjà exposé T5 ; la carte reçoit
  aujourd'hui `effectiveTarget`/`isTrainingDay`/`trainingBonus` mais pas `bonusSource`).
- [ ] **Step 2 — Adapter les DEUX badges** selon `bonusSource` :
  - `run` → nouvelle clé « +{{kcal}} kcal · course » ;
  - `forfait` → texte actuel « +{{kcal}} kcal · jour de séance » ;
  - `none` → pas de badge.
- [ ] **Step 3 — i18n FR + EN** : décliner la variante « · course » sur **`journal.trainingDayBadge`
  ET `home.nutrition.trainingDayBadge`** (ex. clés `*.runDayBadge`), parité FR/EN.
- [ ] **Step 4 — Typecheck + lint** (+ build web si applicable).
- [ ] **Step 5 — Commit.** `feat(nutrition): badge « · course » quand l'objectif suit la dépense (RN-02)`

---

### Task 8 : Catalogue + clôture

**Files :**
- Modify : `docs/product/analyses-donnees.md`

- [ ] **Step 1 — Basculer RN-01 et RN-02 en ✅** dans le catalogue (statut + note : livrées via
  `feature/rn01-depense-course-objectif`, `estimateRunCalories`/`dayCalorieBonus`, mode forfait/auto).
- [ ] **Step 2 — Revue finale** (subagent code-reviewer sur l'ensemble du diff de la branche).
- [ ] **Step 3 — Clôture** via `finishing-a-development-branch` + `/commit` (CHANGELOG + TODO :
  ajouter la ligne de recette 🔴 RN-01/RN-02, cocher les tâches livrées).

---

## Definition of Done (rappel spec §11)

Réglage Forfait/Auto opérationnel ; Auto ⇒ objectif du jour = dépense estimée des courses terminées
(badge « · course »), repli forfait muscu ; Forfait strictement inchangé ; calcul centralisé ;
logique pure testée ; typecheck/lint/tests/build verts ; i18n FR/EN à parité ; catalogue RN-01/RN-02
✅. Reste 🔴 Florian : `db:push` + `db:types` + recette device.
