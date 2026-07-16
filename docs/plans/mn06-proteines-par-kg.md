# US MN-06 — Apport protéique par kg — Plan d'implémentation

> **Pour l'exécutant :** tâche par tâche (cases `- [ ]`), TDD, commits fréquents.
> Spec : [mn06-proteines-par-kg.md](../specs/functional/us/mn06-proteines-par-kg.md).
> Sous-skill : `superpowers:subagent-driven-development`.

**Goal :** afficher sur **Nutrition → Stats** les protéines **g/kg de poids de corps** (moyenne 7 j/30 j)
comparées à une **fourchette cible selon l'objectif**, avec un statut insuffisant/OK/élevé.

**Architecture :** constante `PROTEIN_TARGETS_G_PER_KG` + fonction pure `computeProteinPerKg` dans
`@wellness/shared` (testée Vitest) ; hook `useProteinPerKg(window)` (mobile, lecture seule, réutilise
`useDailyTotals`/`averageIntake`/`useLatestWeight`/`useProfile`/`useNutritionProfile`) ; composant
`ProteinPerKgCard` (bascule 7 j/30 j, valeur + chip de statut + cible) câblé dans `nutrition-stats.tsx`.
**100 % client, offline — aucune migration, aucune dépendance native, pas de checkpoint 🔴.**

**Tech Stack :** TypeScript, React Native/Expo, PowerSync (`useQuery` indirect via hooks existants),
Vitest, i18next.

---

## Structure des fichiers

- **Créer** `packages/shared/src/protein-target.ts` — `PROTEIN_TARGETS_G_PER_KG`, types, `computeProteinPerKg`.
- **Créer** `packages/shared/src/protein-target.test.ts` — tests Vitest.
- **Modifier** `packages/shared/src/index.ts` — `export * from './protein-target';`.
- **Modifier** `apps/mobile/src/data/repositories/nutrition-repository.ts` — hook `useProteinPerKg`.
- **Créer** `apps/mobile/src/components/ProteinPerKgCard.tsx` — carte présentiel.
- **Modifier** `apps/mobile/src/app/nutrition-stats.tsx` — insérer `<ProteinPerKgCard />` après « Apports moyens ».
- **Modifier** `apps/mobile/src/i18n/locales/fr.json` + `en.json` — `stats.protein.*`.
- **Modifier** `docs/product/analyses-donnees.md` — MN-06 🆕 → ✅ (clôture).

---

## Task 1 : logique pure `computeProteinPerKg` (TDD)

**Files:** Create `packages/shared/src/protein-target.ts` + `protein-target.test.ts` ; Modify `index.ts`.

Implémentation cible :
```ts
// protein-target.ts
import type { NutritionObjective } from './nutrition';

export type ProteinTarget = { min: number; max: number }; // g/kg

/** Fourchettes cibles de protéines (g/kg PdC) par objectif — heuristiques, ajustables. */
export const PROTEIN_TARGETS_G_PER_KG: Record<NutritionObjective, ProteinTarget> = {
  bulk:       { min: 1.6, max: 2.2 },
  maintain:   { min: 1.6, max: 2.0 },
  cut:        { min: 1.8, max: 2.4 },
  weightloss: { min: 1.8, max: 2.2 },
};

export type ProteinPerKgStatus = 'low' | 'in' | 'high';
export type ProteinPerKg = { gPerKg: number; target: ProteinTarget; status: ProteinPerKgStatus };

/**
 * Ratio protéines/poids et statut vs la cible de l'objectif (déterministe, pur, sans I/O ni Date).
 * `null` si données insuffisantes (pas de poids valide, ou pas de protéines moyennes = 0 jour loggé).
 * Bornes INCLUSES → `in`.
 */
export function computeProteinPerKg(params: {
  avgProteinG: number | null;
  weightKg: number | null;
  objective: NutritionObjective;
}): ProteinPerKg | null {
  const { avgProteinG, weightKg, objective } = params;
  if (avgProteinG == null || weightKg == null || weightKg <= 0) return null;
  const gPerKg = Math.round((avgProteinG / weightKg) * 10) / 10; // 1 décimale
  const target = PROTEIN_TARGETS_G_PER_KG[objective];
  const status: ProteinPerKgStatus =
    gPerKg < target.min ? 'low' : gPerKg > target.max ? 'high' : 'in';
  return { gPerKg, target, status };
}
```

- [ ] **Step 1 — Test qui échoue** (`protein-target.test.ts`) :

```ts
import { describe, it, expect } from 'vitest';
import { computeProteinPerKg, PROTEIN_TARGETS_G_PER_KG } from './protein-target';

describe('computeProteinPerKg', () => {
  it('null si poids manquant/≤0 ou protéines nulles', () => {
    expect(computeProteinPerKg({ avgProteinG: 150, weightKg: null, objective: 'bulk' })).toBeNull();
    expect(computeProteinPerKg({ avgProteinG: 150, weightKg: 0, objective: 'bulk' })).toBeNull();
    expect(computeProteinPerKg({ avgProteinG: null, weightKg: 75, objective: 'bulk' })).toBeNull();
  });

  it('gPerKg = protéines ÷ poids, arrondi 1 décimale', () => {
    expect(computeProteinPerKg({ avgProteinG: 149, weightKg: 75, objective: 'bulk' })!.gPerKg).toBe(2.0);
    expect(computeProteinPerKg({ avgProteinG: 150, weightKg: 80, objective: 'bulk' })!.gPerKg).toBe(1.9);
  });

  it('statut low/in/high (bulk 1,6–2,2), bornes incluses = in', () => {
    expect(computeProteinPerKg({ avgProteinG: 105, weightKg: 75, objective: 'bulk' })!.status).toBe('low');  // 1.4
    expect(computeProteinPerKg({ avgProteinG: 120, weightKg: 75, objective: 'bulk' })!.status).toBe('in');   // 1.6 (=min)
    expect(computeProteinPerKg({ avgProteinG: 165, weightKg: 75, objective: 'bulk' })!.status).toBe('in');   // 2.2 (=max)
    expect(computeProteinPerKg({ avgProteinG: 180, weightKg: 75, objective: 'bulk' })!.status).toBe('high'); // 2.4
  });

  it('cut a une borne basse plus haute (1,8)', () => {
    expect(computeProteinPerKg({ avgProteinG: 120, weightKg: 75, objective: 'cut' })!.status).toBe('low');   // 1.6 < 1.8
    expect(computeProteinPerKg({ avgProteinG: 135, weightKg: 75, objective: 'cut' })!.status).toBe('in');    // 1.8 (=min)
  });

  it('weightloss mappé sur 1,8–2,2 (pas de défaut silencieux)', () => {
    expect(PROTEIN_TARGETS_G_PER_KG.weightloss).toEqual({ min: 1.8, max: 2.2 });
    const r = computeProteinPerKg({ avgProteinG: 150, weightKg: 75, objective: 'weightloss' })!;
    expect(r.gPerKg).toBe(2.0);
    expect(r.status).toBe('in');
    expect(r.target).toEqual({ min: 1.8, max: 2.2 });
  });
});
```

- [ ] **Step 2 — Lancer, échec** : `npx vitest run packages/shared/src/protein-target.test.ts` → FAIL (module absent).
- [ ] **Step 3 — Implémenter** `protein-target.ts` (code ci-dessus) + `export * from './protein-target';` dans `index.ts` (avec les autres `export * from './...'`).
- [ ] **Step 4 — Lancer, succès** : même commande → PASS ; puis `npm run test --workspace @wellness/shared` + `npm run typecheck --workspace @wellness/shared`.
- [ ] **Step 5 — Commit** : `git commit -m "feat(shared): computeProteinPerKg + PROTEIN_TARGETS_G_PER_KG (TDD)"`.

---

## Task 2 : hook `useProteinPerKg` (mobile)

**Files:** Modify `apps/mobile/src/data/repositories/nutrition-repository.ts`.

Réutiliser (vérifier les noms/champs réels avant d'écrire) :
- `useDailyTotals(sinceDate)` (`journal-repository`) → `{ totals: DailyTotal[] }` ; `averageIntake` (`@wellness/shared`).
- `useLatestWeight()` (`bodyweight-repository`) → `{ latest: { weightKg } | null }`.
- `useProfile()` (`profile-repository`) → `{ profile: { weightKg, mainGoal } | null }`.
- `useNutritionProfile()` (repo nutrition — nom à confirmer) → profil avec `objective`.
- `objectiveFromGoal`, `localDayKey`, `averageIntake`, type `ProteinPerKg` (`@wellness/shared`).

Imports à ajouter (adapter à l'existant ; confirmer que `objectiveFromGoal`/`averageIntake`/`computeProteinPerKg`/`localDayKey`/type `ProteinPerKg` viennent bien de `@wellness/shared`).

```ts
export type ProteinWindow = '7d' | '30d';
const WINDOW_DAYS: Record<ProteinWindow, number> = { '7d': 7, '30d': 30 };

/** `AAAA-MM-JJ` local d'il y a `n` jours (borne basse pour useDailyTotals). */
function sinceDayKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDayKey(d);
}

/**
 * Apport protéique g/kg (moyenne sur la fenêtre) vs cible de l'objectif (MN-06), réactif, lecture seule.
 * Tous les hooks sont appelés inconditionnellement. `hasWeight` distingue « pas de pesée » de « pas de repas ».
 */
export function useProteinPerKg(window: ProteinWindow): {
  result: ProteinPerKg | null;
  hasWeight: boolean;
  isLoading: boolean;
} {
  const { totals, isLoading: tLoading } = useDailyTotals(sinceDayKey(WINDOW_DAYS[window]));
  const { latest, isLoading: wLoading } = useLatestWeight();
  const { profile, isLoading: pLoading } = useProfile();
  const { nutritionProfile, isLoading: nLoading } = useNutritionProfile(); // clé = `nutritionProfile`

  const weightKg = latest?.weightKg ?? profile?.weightKg ?? null;
  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const avgProteinG = totals.length > 0 ? averageIntake(totals).proteinG : null;

  const result = computeProteinPerKg({ avgProteinG, weightKg, objective });
  const isLoading = tLoading || wLoading || pLoading || nLoading;

  return { result, hasWeight: weightKg != null, isLoading };
}
```

✅ Confirmé par la revue : `useNutritionProfile()` renvoie **`{ nutritionProfile, isLoading }`** (clé
`nutritionProfile`, **pas** `profile`) ; `nutritionProfile.objective` est déjà typé
`NutritionObjective | null` → **aucun cast** nécessaire (même patron que `dashboard-repository.ts:260-261`).
`useProfile().profile.weightKg`/`.mainGoal` et `useLatestWeight().latest.weightKg` confirmés. Ne jamais
`return` avant les appels de hooks.

- [ ] **Step 1** — Écrire le hook (ci-dessus), en alignant sur les vrais noms.
- [ ] **Step 2 — Vérifier** : `npm run typecheck --workspace @wellness/mobile` → vert.
- [ ] **Step 3 — Commit** : `git commit -m "feat(mobile): hook useProteinPerKg (g/kg vs cible objectif)"`.

---

## Task 3 : composant `ProteinPerKgCard`

**Files:** Create `apps/mobile/src/components/ProteinPerKgCard.tsx`.

Aligne-toi sur `nutrition-stats.tsx` (Segment, Card, styles) et sur MN-05 `progress/index.tsx`
`colorFor()` pour le doré.

Comportement :
- État local `window: ProteinWindow` (défaut `'7d'`), `Segment` options `['7d','30d']`, libellés
  `t('stats.ranges.7d'|'30d')` (déjà existants).
- `const { result, hasWeight, isLoading } = useProteinPerKg(window);`
- `isLoading` → `ActivityIndicator`.
- `!hasWeight` → empty state texte `t('stats.protein.noWeight')`.
- `result == null` (poids OK mais 0 jour loggé) → texte `t('stats.protein.noData')` / « — ».
- Sinon : titre section `t('stats.protein.title')` ; **valeur** `{result.gPerKg} {t('stats.protein.perKgUnit')}`
  (ex. « 1,8 g/kg ») en avant ; **chip de statut** coloré :
  - `low` → doré **littéral `#c9a96e`** (comme MN-05, pas de couleur de palette) ;
  - `in` → `colors.accent` ; `high` → `colors.textMuted` ;
  - libellé `t('stats.protein.status.' + result.status)`.
  - sous-titre `t('stats.protein.target', { min: result.target.min, max: result.target.max, objective: t('stats.protein.objective.' + <objectif courant>) })`.
    ⚠️ Le composant a besoin de l'**objectif courant** pour le libellé : soit le hook le renvoie en plus
    (préférable — ajouter `objective` au retour du hook), soit le composant le relit. **Décision : ajouter
    `objective: NutritionObjective` au retour de `useProteinPerKg`** (Task 2) pour que le sous-titre soit
    exact sans relecture. (Ajuster Task 2 en conséquence.)
- Nombre affiché avec **virgule décimale** en FR : utiliser le formatage existant du repo si présent,
  sinon `String(gPerKg).replace('.', ',')` (simple, cohérent avec l'affichage FR). À confirmer avec le
  patron des autres écrans (beaucoup affichent des entiers ; ici 1 décimale).
- Couleurs via `useTheme` (hors doré littéral) ; `StyleSheet.create` ; pas de chaîne d'UI en dur (hors
  « — »).

- [ ] **Step 1** — Écrire le composant (+ ajuster Task 2 pour renvoyer `objective`).
- [ ] **Step 2 — Vérifier** : `npm run typecheck --workspace @wellness/mobile` → vert.
- [ ] **Step 3 — Commit** : `git commit -m "feat(mobile): ProteinPerKgCard (g/kg + statut + cible)"`.

---

## Task 4 : câblage dans `nutrition-stats.tsx`

**Files:** Modify `apps/mobile/src/app/nutrition-stats.tsx`.

- [ ] **Step 1** — Importer `ProteinPerKgCard` et l'insérer **après la carte « Apports moyens »**
  (au choix, avant ou après `TrainingNutritionCrossCard` — regrouper les analyses). Auto-portant.
- [ ] **Step 2 — Vérifier** : `npm run typecheck --workspace @wellness/mobile` + `npm run lint` → vert.
- [ ] **Step 3 — Commit** : `git commit -m "feat(mobile): section protéines/kg sur Nutrition -> Stats (MN-06)"`.

---

## Task 5 : i18n (FR + EN, parité)

**Files:** Modify `apps/mobile/src/i18n/locales/fr.json` + `en.json`.

- [ ] **Step 1** — Ajouter `stats.protein` (mêmes sous-clés des deux côtés) :
  - FR : `title` = « Apport protéique / poids » ; `perKgUnit` = « g/kg » ;
    `target` = « cible {{min}}–{{max}} · {{objective}} » ;
    `status`: `low` = « insuffisant », `in` = « dans la cible », `high` = « élevé » ;
    `noWeight` = « Ajoute une pesée pour voir ton ratio protéines/poids. » ;
    `noData` = « Pas encore de repas enregistrés sur la période. » ;
    `objective`: `bulk` = « prise de masse », `cut` = « sèche », `maintain` = « maintien »,
    `weightloss` = « perte de poids ».
  - EN (miroir) : `title` = « Protein / body weight » ; `perKgUnit` = « g/kg » ;
    `target` = « target {{min}}–{{max}} · {{objective}} » ;
    `status`: `low` = « too low », `in` = « on target », `high` = « high » ;
    `noWeight` = « Log your weight to see your protein-to-weight ratio. » ;
    `noData` = « No meals logged in this period yet. » ;
    `objective`: `bulk` = « bulk », `cut` = « cut », `maintain` = « maintain », `weightloss` = « weight loss ».
  - ⚠️ Décimales : `{{min}}`/`{{max}}` sont des nombres (1.6…) → i18next les affichera « 1.6 ». Si tu
    veux la virgule FR, passe des **chaînes déjà formatées** au composant (`min.toLocaleString('fr')`
    ou `.replace('.', ',')`) plutôt que des nombres bruts. À trancher à l'implémentation (cohérence FR).
- [ ] **Step 2 — Vérifier parité** (diff manuel, pas de test auto) : `stats.protein.*` identiques FR/EN.
- [ ] **Step 3 — Commit** : `git commit -m "i18n: stats.protein (FR/EN) — MN-06"`.

---

## Task 6 : clôture (catalogue + vérifs)

**Files:** Modify `docs/product/analyses-donnees.md`.

- [ ] **Step 1** — MN-06 : 🆕 → ✅ ; description « (livrée) ».
- [ ] **Step 2 — Vérifs globales** : `npm run test --workspace @wellness/shared` (⚠️ **pas** `npm run
  test` racine — jest mobile non câblé → faux échec) ; `npm run typecheck` ; `npm run lint` — verts.
- [ ] **Step 3 — Relire le diff** : `result == null` gérés (pas de pesée / pas de repas) ; statut/couleurs
  (doré littéral) ; bornes incluses = `in` ; parité i18n ; aucune chaîne en dur ; hooks inconditionnels.
- [ ] **Step 4 — Commit** : `git commit -m "docs(mn06): catalogue MN-06 livrée + clôture"`.

---

## Notes

- **Gate CLAUDE.md** : spec validée ; plan à valider. **Maquette écartée** (carte simple `Card`+`Segment`).
  Code autorisé après validation.
- **Décision hook** : dans `nutrition-repository.ts`. Le hook **renvoie aussi `objective`** (ajout Task 2/3)
  pour le libellé de cible.
- **Pièges (revue de spec)** : doré = **littéral `#c9a96e`** (pas de rôle palette) ; `averageIntake`
  pré-arrondit `proteinG` (accepté) ; renommer `sinceKey`→`sinceDate` côté `useDailyTotals`.
- **Reste checkpoint recette (Florian)** : g/kg cohérent, statut selon objectif, bascule 7 j/30 j, empty
  states (pas de pesée / pas de repas). **Pas de checkpoint 🔴.**
- **YAGNI** : pas de lien volume muscu, pas de widget dashboard, pas de courbe historique, pas d'IA.
