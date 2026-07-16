# US NUTR-11 — Progression vers l'objectif de poids — Plan d'implémentation

> **Pour l'exécutant :** tâche par tâche (cases `- [ ]`), TDD, commits fréquents.
> Spec : [nutr11-progression-poids.md](../specs/functional/us/nutr11-progression-poids.md).
> Sous-skill : `superpowers:subagent-driven-development`.

**Goal :** afficher sur **Nutrition → Stats** (section Poids) une carte **« Progression vers l'objectif
de poids »** — un % (et les kg) du chemin parcouru entre un **poids de départ figé** et un **poids cible**
saisi dans le Profil, valable pour une perte comme pour une prise.

**Architecture :** fonction pure `computeWeightGoalProgress` dans `@wellness/shared` (testée Vitest) ;
**migration** de 2 colonnes sur `profiles` (`target_weight_kg`, `start_weight_kg`) répercutée dans le
schéma PowerSync + le schéma Zod partagé + le repository ; write path `setWeightTarget` (fige le départ) ;
hook `useWeightGoalProgress` (lecture seule) ; champ « Poids cible » dans `profile.tsx` ; composant
`WeightGoalCard` câblé dans `nutrition-stats.tsx`. **1 seule migration (checkpoint 🔴) ; le reste 100 %
client / offline.**

**Tech Stack :** TypeScript, React Native/Expo, Supabase CLI (migration cloud), PowerSync (`useQuery`),
Vitest, i18next.

---

## Structure des fichiers

- **Créer** `packages/shared/src/weight-goal.ts` — `computeWeightGoalProgress` + types.
- **Créer** `packages/shared/src/weight-goal.test.ts` — tests Vitest.
- **Modifier** `packages/shared/src/index.ts` — `export * from './weight-goal';`.
- **Modifier** `packages/shared/src/profile.ts` — 2 champs `targetWeightKg` / `startWeightKg`.
- **Créer** `supabase/migrations/<ts>_profiles_weight_goal.sql` — les 2 colonnes.
- **Modifier** `packages/shared/src/database.types.ts` — régénéré par `db:types`.
- **Modifier** `apps/mobile/src/powersync/schema.ts` — 2 colonnes sur `profiles`.
- **Modifier** `apps/mobile/src/data/repositories/profile-repository.ts` — mapping (4 points) +
  `setWeightTarget` + hook `useWeightGoalProgress`.
- **Modifier** `apps/mobile/src/data/repositories/bodyweight-repository.ts` — `getLatestWeightKg()` (non-hook).
- **Modifier** `apps/mobile/src/app/profile.tsx` — champ « Poids cible » + appel `setWeightTarget`.
- **Créer** `apps/mobile/src/components/WeightGoalCard.tsx` — carte présentiel.
- **Modifier** `apps/mobile/src/app/nutrition-stats.tsx` — insérer `<WeightGoalCard />` (section Poids).
- **Modifier** `apps/mobile/src/i18n/locales/fr.json` + `en.json` — `stats.weightGoal.*` + `profile.targetWeight`.
- **Modifier** `supabase/MIGRATIONS.md` — cocher la migration.
- **Modifier** `docs/product/analyses-donnees.md` — NUTR-11 ⏳ → ✅.

---

## Task 1 : logique pure `computeWeightGoalProgress` (TDD)

**Files:** Create `packages/shared/src/weight-goal.ts` + `weight-goal.test.ts` ; Modify `index.ts`.

Implémentation cible :
```ts
// weight-goal.ts
export type WeightGoalProgress = {
  pct: number;          // 0..100, arrondi entier
  reached: boolean;     // cible atteinte ou dépassée
  startKg: number;
  targetKg: number;
  currentKg: number;
  totalKg: number;      // |départ - cible|
  doneKg: number;       // parcouru, borné [0, totalKg]
  remainingKg: number;  // totalKg - doneKg
};

/**
 * Progression vers l'objectif de poids (pur, sans I/O ni Date).
 * `null` si une donnée manque OU si départ = cible (rien à mesurer, div/0 évitée).
 * Formule bornée [0,1] : marche pour une perte (départ>cible) comme une prise (départ<cible).
 */
export function computeWeightGoalProgress(params: {
  startKg: number | null;
  targetKg: number | null;
  currentKg: number | null;
}): WeightGoalProgress | null {
  const { startKg, targetKg, currentKg } = params;
  if (startKg == null || targetKg == null || currentKg == null) return null;
  if (startKg === targetKg) return null;

  const progressRaw = (startKg - currentKg) / (startKg - targetKg);
  const ratio = Math.min(1, Math.max(0, progressRaw));
  const totalKg = Math.abs(startKg - targetKg);
  const doneKg = ratio * totalKg;

  return {
    pct: Math.round(ratio * 100),
    reached: progressRaw >= 1,
    startKg,
    targetKg,
    currentKg,
    totalKg,
    doneKg,
    remainingKg: totalKg - doneKg,
  };
}
```

- [ ] **Step 1 — Test qui échoue** (`weight-goal.test.ts`) :

```ts
import { describe, it, expect } from 'vitest';
import { computeWeightGoalProgress } from './weight-goal';

describe('computeWeightGoalProgress', () => {
  it('null si une donnée manque', () => {
    expect(computeWeightGoalProgress({ startKg: null, targetKg: 75, currentKg: 80 })).toBeNull();
    expect(computeWeightGoalProgress({ startKg: 85, targetKg: null, currentKg: 80 })).toBeNull();
    expect(computeWeightGoalProgress({ startKg: 85, targetKg: 75, currentKg: null })).toBeNull();
  });

  it('null si départ = cible (rien à mesurer)', () => {
    expect(computeWeightGoalProgress({ startKg: 75, targetKg: 75, currentKg: 75 })).toBeNull();
  });

  it('perte : mi-chemin = 50 %', () => {
    const r = computeWeightGoalProgress({ startKg: 85, targetKg: 75, currentKg: 80 })!;
    expect(r.pct).toBe(50);
    expect(r.reached).toBe(false);
    expect(r.doneKg).toBeCloseTo(5);
    expect(r.remainingKg).toBeCloseTo(5);
  });

  it('prise : mi-chemin = 50 % (signe s’annule)', () => {
    const r = computeWeightGoalProgress({ startKg: 70, targetKg: 80, currentKg: 75 })!;
    expect(r.pct).toBe(50);
    expect(r.totalKg).toBeCloseTo(10);
  });

  it('atteint exact = 100 %, reached', () => {
    const r = computeWeightGoalProgress({ startKg: 85, targetKg: 75, currentKg: 75 })!;
    expect(r.pct).toBe(100);
    expect(r.reached).toBe(true);
    expect(r.remainingKg).toBeCloseTo(0);
  });

  it('dépassement plafonné à 100 %', () => {
    const r = computeWeightGoalProgress({ startKg: 85, targetKg: 75, currentKg: 73 })!;
    expect(r.pct).toBe(100);
    expect(r.reached).toBe(true);
    expect(r.doneKg).toBeCloseTo(10); // borné à totalKg
  });

  it('recul planché à 0 %', () => {
    const r = computeWeightGoalProgress({ startKg: 85, targetKg: 75, currentKg: 88 })!;
    expect(r.pct).toBe(0);
    expect(r.reached).toBe(false);
    expect(r.doneKg).toBe(0);
    expect(r.remainingKg).toBeCloseTo(10);
  });

  it('doneKg + remainingKg = totalKg', () => {
    const r = computeWeightGoalProgress({ startKg: 90, targetKg: 78, currentKg: 84 })!;
    expect(r.doneKg + r.remainingKg).toBeCloseTo(r.totalKg);
  });
});
```

- [ ] **Step 2 — Lancer, échec** : `npx vitest run packages/shared/src/weight-goal.test.ts` → FAIL (module absent).
- [ ] **Step 3 — Implémenter** `weight-goal.ts` (code ci-dessus) + `export * from './weight-goal';` dans `index.ts`.
- [ ] **Step 4 — Lancer, succès** : même commande → PASS ; puis `npm run test --workspace @wellness/shared`.
- [ ] **Step 5 — Commit** : `git commit -m "feat(shared): computeWeightGoalProgress (NUTR-11, TDD)"`.

---

## Task 2 : migration + schémas (colonnes `target_weight_kg` / `start_weight_kg`) — checkpoint 🔴

**Files:** Create `supabase/migrations/<ts>_profiles_weight_goal.sql` ; Modify `powersync/schema.ts`,
`packages/shared/src/profile.ts`, `profile-repository.ts` (mapping), `database.types.ts` (généré),
`supabase/MIGRATIONS.md`.

- [ ] **Step 1 — Créer la migration** : `npm run db:new profiles_weight_goal`, puis écrire dans le fichier :

```sql
alter table public.profiles
  add column if not exists target_weight_kg numeric check (target_weight_kg > 0),
  add column if not exists start_weight_kg  numeric check (start_weight_kg  > 0);
```

- [ ] **Step 2 — Prévisualiser puis pousser** : `npm run db:push:dry` (vérifier que seule cette migration
  part) → `npm run db:push`. _(Dev directement sur le cloud, pas de Docker — voir CLAUDE.md.)_
- [ ] **Step 3 — Régénérer les types** : `npm run db:types` (met à jour `packages/shared/src/database.types.ts` :
  `profiles.target_weight_kg` + `start_weight_kg` dans Row/Insert/Update).
- [ ] **Step 4 — Cocher** la migration dans `supabase/MIGRATIONS.md` (case + date).
- [ ] **Step 5 — Schéma client PowerSync** : dans `apps/mobile/src/powersync/schema.ts`, ajouter au
  `const profiles = new Table({ ... })` (⚠️ colonne non déclarée = ignorée localement) :

```ts
  target_weight_kg: column.real,
  start_weight_kg: column.real,
```

- [ ] **Step 6 — Schéma Zod partagé** : dans `packages/shared/src/profile.ts`, étendre `profileRowSchema` :

```ts
  /** Poids cible en kg (null = aucun objectif de poids). */
  targetWeightKg: z.number().positive().nullable().default(null),

  /** Poids de départ figé au moment où la cible est définie (kg). */
  startWeightKg: z.number().positive().nullable().default(null),
```

- [ ] **Step 7 — Repository mapping (4 points)** dans `profile-repository.ts` :
  1. `type ProfileDbRow` → ajouter `target_weight_kg: number | null;` + `start_weight_kg: number | null;`
  2. `rowToProfile` → `targetWeightKg: row.target_weight_kg,` + `startWeightKg: row.start_weight_kg,`
  3. `inputToColumns` → `if ('targetWeightKg' in input) columns['target_weight_kg'] = input.targetWeightKg;`
     + idem `startWeightKg` → `start_weight_kg`
  4. `type ProfileInput` (le `Pick`) → ajouter `'targetWeightKg' | 'startWeightKg'`
- [ ] **Step 8 — Vérifier** : `npm run typecheck` + `npm run test --workspace @wellness/shared` → verts
  (le schéma étendu ne casse rien : champs nullable + défaut).
- [ ] **Step 9 — Commit** : `git commit -m "feat(shared): colonnes target/start_weight_kg + schéma PowerSync/profil (NUTR-11)"`.

---

## Task 3 : write path `setWeightTarget` + getter poids + hook `useWeightGoalProgress`

**Files:** Modify `bodyweight-repository.ts`, `profile-repository.ts`.

- [ ] **Step 1 — Getter non-hook** dans `bodyweight-repository.ts` (pour figer le départ hors contexte réactif) :

```ts
/** Dernière pesée en kg (ou null) — hors contexte hook. */
export async function getLatestWeightKg(): Promise<number | null> {
  const row = await powerSync.getOptional<{ weight_kg: number }>(
    `SELECT weight_kg FROM body_weight_entries WHERE deleted_at IS NULL ORDER BY log_date DESC LIMIT 1`,
  );
  return row?.weight_kg ?? null;
}
```

- [ ] **Step 2 — `setWeightTarget`** dans `profile-repository.ts` (importer `getLatestWeightKg`) :

```ts
/**
 * Définit / modifie / efface le poids cible. Fige le poids de départ (start_weight_kg)
 * sur le poids actuel quand la cible est créée ou modifiée (règle NUTR-11 §5.3).
 */
export async function setWeightTarget(targetKg: number | null): Promise<void> {
  const existing = await getCurrentRow();
  const currentTarget = existing?.target_weight_kg ?? null;

  if (targetKg == null) {
    await upsertProfile({ targetWeightKg: null, startWeightKg: null });
    return;
  }
  if (targetKg === currentTarget) return; // inchangé → ne pas ré-ancrer le départ

  const startKg = (await getLatestWeightKg()) ?? existing?.weight_kg ?? null;
  await upsertProfile({ targetWeightKg: targetKg, startWeightKg: startKg });
}
```
_(⚠️ `getCurrentRow` est déjà défini dans le repository ; réutiliser tel quel.)_

- [ ] **Step 3 — Hook `useWeightGoalProgress`** dans `profile-repository.ts` (importer `useLatestWeight`
  depuis `bodyweight-repository` + `computeWeightGoalProgress`, type `WeightGoalProgress` depuis `@wellness/shared`) :

```ts
export function useWeightGoalProgress(): {
  progress: WeightGoalProgress | null;
  hasTarget: boolean;
  isLoading: boolean;
} {
  const { profile, isLoading: pLoading } = useProfile();
  const { latest, isLoading: wLoading } = useLatestWeight();

  const currentKg = latest?.weightKg ?? profile?.weightKg ?? null;
  const progress = computeWeightGoalProgress({
    startKg: profile?.startWeightKg ?? null,
    targetKg: profile?.targetWeightKg ?? null,
    currentKg,
  });

  return { progress, hasTarget: profile?.targetWeightKg != null, isLoading: pLoading || wLoading };
}
```
_(Hooks inconditionnels ; aucun cycle : `bodyweight-repository` ne dépend pas de `profile-repository`.)_

- [ ] **Step 4 — Vérifier** : `npm run typecheck` → vert.
- [ ] **Step 5 — Commit** : `git commit -m "feat(mobile): setWeightTarget (fige le départ) + hook useWeightGoalProgress (NUTR-11)"`.

---

## Task 4 : champ « Poids cible » dans l'écran Profil

**Files:** Modify `apps/mobile/src/app/profile.tsx`.

S'aligner sur le champ **poids** existant (patron anti-drift `ref`, `units.weightInputValue` /
`units.parseWeightToKg`, symbole `units.weightSymbol`).

- [ ] **Step 1** — État local : `const target0 = units.weightInputValue(profile?.targetWeightKg);`
  `const [targetWeight, setTargetWeight] = useState(target0);`
  `const initialTargetRef = useRef(target0);`
- [ ] **Step 2** — Champ UI (près du poids/objectif) :
  `<TextField label={`${t('profile.targetWeight')} (${units.weightSymbol})`} value={targetWeight}
  onChangeText={setTargetWeight} keyboardType="decimal-pad" />`
- [ ] **Step 3** — À l'enregistrement (fonction de save existante) : si le champ a changé
  (`targetWeight !== initialTargetRef.current`), appeler
  `await setWeightTarget(targetWeight.trim() === '' ? null : units.parseWeightToKg(targetWeight));`
  **après** l'`upsertProfile` des autres champs (le figeage lit le poids courant qui vient d'être
  éventuellement mis à jour). ⚠️ **Ne pas** router `targetWeightKg`/`startWeightKg` via l'`upsertProfile`
  générique de l'écran — passer **uniquement** par `setWeightTarget` (sinon le figeage du départ est court-circuité).
- [ ] **Step 4 — Vérifier** : `npm run typecheck` → vert.
- [ ] **Step 5 — Commit** : `git commit -m "feat(mobile): champ Poids cible dans le Profil (NUTR-11)"`.

---

## Task 5 : composant `WeightGoalCard` + câblage Stats

**Files:** Create `apps/mobile/src/components/WeightGoalCard.tsx` ; Modify `nutrition-stats.tsx`.

S'aligner sur `Card` + styles de `nutrition-stats.tsx` (cf. cartes NUTR-10 / NUTR-17) ; unités via `units`.

- [ ] **Step 1 — Composant** :
  - `const { progress, hasTarget, isLoading } = useWeightGoalProgress();`
  - `isLoading` → `ActivityIndicator`.
  - `progress == null && !hasTarget` → **état vide** : titre + `t('stats.weightGoal.empty')` (invite, pas de graphe).
  - `progress == null && hasTarget` → **retourner `null`** (carte masquée : départ = cible / données incomplètes).
  - Sinon : titre `t('stats.weightGoal.title')` ; **`{progress.pct} %`** en valeur forte ; **barre de
    progression** (`progress.pct/100`, largeur `%`, couleur `colors.accent`, piste `colors.border`/muted) ;
    sous-texte
    `t('stats.weightGoal.progress', { done: units.formatWeight(progress.doneKg), total: units.formatWeight(progress.totalKg) })`
    + ` · ` + `t('stats.weightGoal.remaining', { remaining: units.formatWeight(progress.remainingKg) })` ;
    si `progress.reached` → badge `t('stats.weightGoal.reached')`.
  - Couleurs via `useTheme` ; `StyleSheet.create` ; aucune chaîne d'UI en dur.
- [ ] **Step 2 — Câblage** : dans `nutrition-stats.tsx`, importer et insérer `<WeightGoalCard />` dans la
  **section Poids**, **après** le bloc courbe de poids (autour de la ligne ~103, avant la section apports).
- [ ] **Step 3 — Vérifier** : `npm run typecheck` + `npm run lint` → verts.
- [ ] **Step 4 — Commit** : `git commit -m "feat(mobile): WeightGoalCard sur Nutrition -> Stats (NUTR-11)"`.

---

## Task 6 : i18n (FR + EN, parité)

**Files:** Modify `apps/mobile/src/i18n/locales/fr.json` + `en.json`.

- [ ] **Step 1 — `stats.weightGoal`** (mêmes sous-clés des deux côtés) :
  - FR : `title` = « Progression vers l'objectif » ; `progress` = « {{done}} sur {{total}} » ;
    `remaining` = « reste {{remaining}} » ; `reached` = « 🎯 Objectif atteint » ;
    `empty` = « Définis un objectif de poids dans ton profil. »
  - EN : `title` = « Weight goal progress » ; `progress` = « {{done}} of {{total}} » ;
    `remaining` = « {{remaining}} to go » ; `reached` = « 🎯 Goal reached » ;
    `empty` = « Set a weight goal in your profile. »
  - ⚠️ `done`/`total`/`remaining` sont passés **déjà formatés** (`units.formatWeight`, unité incluse) →
    pas de nombre brut dans i18next.
- [ ] **Step 2 — `profile.targetWeight`** : FR « Poids cible » / EN « Target weight ».
- [ ] **Step 3 — Vérifier parité** (diff manuel) : `stats.weightGoal.*` + `profile.targetWeight` identiques FR/EN.
- [ ] **Step 4 — Commit** : `git commit -m "i18n: stats.weightGoal + profile.targetWeight (FR/EN) — NUTR-11"`.

---

## Task 7 : clôture (catalogue + vérifs)

**Files:** Modify `docs/product/analyses-donnees.md`.

- [ ] **Step 1** — NUTR-11 : ⏳ → ✅ ; description « (livrée) ».
- [ ] **Step 2 — Vérifs globales** : `npm run test --workspace @wellness/shared` (⚠️ **pas** `npm run test`
  racine — jest mobile non câblé) ; `npm run typecheck` ; `npm run lint` — verts.
- [ ] **Step 3 — Relire le diff** : `progress == null` géré (masqué vs état vide) ; plafond 100 / plancher 0 ;
  figeage du départ passe **uniquement** par `setWeightTarget` ; unités impériales via `units` ; parité i18n ;
  hooks inconditionnels ; colonnes déclarées dans `powersync/schema.ts` ; migration cochée dans `MIGRATIONS.md`.
- [ ] **Step 4 — Commit** : `git commit -m "docs(nutr11): catalogue NUTR-11 livrée + clôture"`.

---

## Notes

- **Gate CLAUDE.md** : spec validée (Florian, 16/07/2026) ; plan à valider. **Maquette écartée** (carte
  simple `Card` + barre de progression, alignée sur NUTR-10/17). Code autorisé **après validation**.
- **Checkpoint 🔴 (Task 2)** : migration cloud + `db:types` — à faire **avant** que les hooks lisent les
  colonnes. Sync rule inchangée (`select * from profiles`).
- **Ordre** : Task 1 (pure, sans dépendance) → Task 2 (schémas) → Task 3 (write + hook) → Task 4 (profil)
  → Task 5 (carte) → Task 6 (i18n) → Task 7 (clôture).
- **Pièges** : (1) colonne PowerSync non déclarée = ignorée ; (2) figeage du départ court-circuité si on
  écrit `targetWeightKg` via l'`upsertProfile` générique de l'écran → **toujours** passer par
  `setWeightTarget` ; (3) `done`/`total`/`remaining` passés déjà formatés à i18next.
- **Reste checkpoint recette (Florian)** : % cohérent (perte + prise), dépassement (100 % + badge), recul
  (0 %), modification de cible qui ré-ancre le départ, état vide sans cible, unités métrique/impérial, i18n.
- **YAGNI** : pas de widget dashboard, pas de courbe historique du %, pas d'ETA d'atteinte, pas de notif.
