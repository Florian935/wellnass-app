# Plan d'implémentation — Panel nutritionnel étendu

> **Statut :** ✅ **plan validé par Florian (14/07/2026)** — **maquette écartée** (UI mineure, précédents
> 1.15 / 4.7-4.18). Exécution **subagent-driven**.
> **Pour l'exécution :** plan par tâches TDD, à jouer sur la branche `feature/panel-nutritionnel-etendu`.
> Cases `- [ ]` pour le suivi. Spec de référence :
> [panel-nutritionnel-etendu.md](../specs/functional/us/panel-nutritionnel-etendu.md) (validée 14/07/2026).

**Objectif :** étendre le panel micronutriments de **10 → 31** nutriments (AG détaillés + oméga +
vitamines/minéraux complets), captés depuis OpenFoodFacts et affichés *present-only*, sans migration.

**Architecture :** tout part de `MICRONUTRIENT_KEYS` (source unique dans `@wellness/shared`). L'ajout
de clés propage **automatiquement** le schéma Zod, `scaleMicronutrients`/`sumMicronutrients`, l'import
CSV, la validation du formulaire admin et les chips « micros suivis ». Restent des ajouts **manuels** :
le mapping OFF (`MICRO_MAP`), les groupes d'affichage (`MicronutrientDetails.GROUPS`) et les libellés
i18n (mobile FR/EN + admin FR). Stockage inchangé : colonne JSON `micronutrients` → **aucune migration**.

**Tech :** TypeScript, Zod, Vitest (`packages/shared`), jest-expo (`apps/mobile`), React (admin).

---

## Décisions verrouillées (impacts de la propagation)

- **On embrasse la propagation** : le formulaire admin (`FoodEditScreen`), l'import CSV et les chips
  « micros suivis » (`nutrition-profile`) couvriront naturellement les 31 nutriments. C'est **moins**
  de travail que de filtrer, et cohérent. (La spec parlait d'admin « différé » : en réalité le
  formulaire s'étend tout seul ; seul un éventuel *regroupement visuel* admin reste hors périmètre.)
- **Vitamine A** : OFF la renseigne parfois en **UI (IU)** → conversion non fiable. La clé
  `vitamin_a_ug` **existe** (affichage / admin / futur seed CIQUAL), mais le **mapping OFF est gardé** :
  on ne mappe que si l'unité OFF est une unité de masse ; sinon on **omet** (pas de valeur fausse).
- **Ordre** : `MICRONUTRIENT_KEYS` réordonné en 3 blocs (lipides / minéraux / vitamines) pour un
  formulaire admin + chips lisibles. Sans risque (objet indexé par clé, l'ordre n'affecte pas le stockage).

## Fichiers touchés

| Fichier | Rôle | Nature |
|---|---|---|
| `packages/shared/src/food.ts` | `MICRONUTRIENT_KEYS` (+21, réordonné) | manuel (source) |
| `packages/shared/src/food.test.ts` | fix `toHaveLength(10)` → 31 + cas scale/sum | test |
| `apps/mobile/src/lib/openfoodfacts.ts` | `MICRO_MAP` (+20) + garde vit A | manuel |
| `apps/mobile/src/lib/__tests__/openfoodfacts.test.ts` | conversions + garde vit A IU | test |
| `apps/mobile/src/components/MicronutrientDetails.tsx` | `GROUPS` (+21 items) | manuel |
| `apps/mobile/src/i18n/locales/fr.json` + `en.json` | +21 labels `nutrition.micros.labels.*` | manuel |
| `apps/admin/src/i18n/fr.ts` | `foods.microNames` (+21) | manuel |

**Aucune** migration, **aucune** dépendance native, **pas de checkpoint 🔴**.

## Set final des 31 clés (source de vérité)

```
// Lipides (cholesterol existant + 6)
cholesterol_mg, monounsaturated_fat_g, polyunsaturated_fat_g, trans_fat_g, omega_3_g, omega_6_g, omega_9_g,
// Minéraux (5 existants + 6)
sodium_mg, magnesium_mg, potassium_mg, calcium_mg, iron_mg, zinc_mg, phosphorus_mg, copper_mg, manganese_mg, selenium_ug, iodine_ug,
// Vitamines (4 existantes + 9)
vitamin_a_ug, vitamin_c_mg, vitamin_d_ug, vitamin_e_mg, vitamin_k_ug, vitamin_b1_mg, vitamin_b2_mg, vitamin_b3_mg, vitamin_b5_mg, vitamin_b6_mg, vitamin_b7_ug, vitamin_b9_ug, vitamin_b12_ug
```

Mapping OFF (champ `*_100g` en grammes → unité de la clé) :

| Clé | Champ OFF | Facteur |
|---|---|---|
| monounsaturated_fat_g | `monounsaturated-fat_100g` | ×1 |
| polyunsaturated_fat_g | `polyunsaturated-fat_100g` | ×1 |
| trans_fat_g | `trans-fat_100g` | ×1 |
| omega_3_g | `omega-3-fat_100g` | ×1 |
| omega_6_g | `omega-6-fat_100g` | ×1 |
| omega_9_g | `omega-9-fat_100g` | ×1 |
| zinc_mg | `zinc_100g` | ×1000 |
| phosphorus_mg | `phosphorus_100g` | ×1000 |
| copper_mg | `copper_100g` | ×1000 |
| manganese_mg | `manganese_100g` | ×1000 |
| selenium_ug | `selenium_100g` | ×1e6 |
| iodine_ug | `iodine_100g` | ×1e6 |
| vitamin_a_ug | `vitamin-a_100g` (**gardé**, unité `vitamin-a_unit`) | ×1e6 |
| vitamin_e_mg | `vitamin-e_100g` | ×1000 |
| vitamin_k_ug | `vitamin-k_100g` | ×1e6 |
| vitamin_b1_mg | `vitamin-b1_100g` | ×1000 |
| vitamin_b2_mg | `vitamin-b2_100g` | ×1000 |
| vitamin_b3_mg | `vitamin-pp_100g` | ×1000 |
| vitamin_b5_mg | `pantothenic-acid_100g` | ×1000 |
| vitamin_b6_mg | `vitamin-b6_100g` | ×1000 |
| vitamin_b7_ug | `biotin_100g` | ×1e6 |

---

## Task 1 — Étendre `MICRONUTRIENT_KEYS` (shared)

**Files:**
- Modify: `packages/shared/src/food.ts:57-68`
- Test: `packages/shared/src/food.test.ts:143`

- [ ] **Step 1 — Adapter le test de garde** (`food.test.ts:143`)

```ts
expect(MICRONUTRIENT_KEYS).toHaveLength(31);
expect(MICRONUTRIENT_KEYS).toContain('cholesterol_mg');
expect(MICRONUTRIENT_KEYS).toContain('omega_3_g');
expect(MICRONUTRIENT_KEYS).toContain('vitamin_b7_ug');
```

- [ ] **Step 2 — Ajouter un test scale/sum sur des nouvelles clés** (dans le describe micros)

```ts
it('met à l’échelle et somme les nouvelles clés (oméga-3 en g, zinc en mg)', () => {
  expect(scaleMicronutrients({ omega_3_g: 2, zinc_mg: 5 }, 50)).toEqual({ omega_3_g: 1, zinc_mg: 2.5 });
  expect(sumMicronutrients([{ omega_3_g: 1 }, { omega_3_g: 0.5, zinc_mg: 2 }])).toEqual({ omega_3_g: 1.5, zinc_mg: 2 });
});
```

- [ ] **Step 3 — Lancer les tests → échec attendu** — `npm run test -w @wellness/shared` → FAIL (longueur 10 ≠ 31, clés inconnues).

- [ ] **Step 4 — Étendre `MICRONUTRIENT_KEYS`** (remplacer le tableau, ordre en 3 blocs) :

```ts
export const MICRONUTRIENT_KEYS = [
  // Lipides
  'cholesterol_mg',
  'monounsaturated_fat_g',
  'polyunsaturated_fat_g',
  'trans_fat_g',
  'omega_3_g',
  'omega_6_g',
  'omega_9_g',
  // Minéraux
  'sodium_mg',
  'magnesium_mg',
  'potassium_mg',
  'calcium_mg',
  'iron_mg',
  'zinc_mg',
  'phosphorus_mg',
  'copper_mg',
  'manganese_mg',
  'selenium_ug',
  'iodine_ug',
  // Vitamines
  'vitamin_a_ug',
  'vitamin_c_mg',
  'vitamin_d_ug',
  'vitamin_e_mg',
  'vitamin_k_ug',
  'vitamin_b1_mg',
  'vitamin_b2_mg',
  'vitamin_b3_mg',
  'vitamin_b5_mg',
  'vitamin_b6_mg',
  'vitamin_b7_ug',
  'vitamin_b9_ug',
  'vitamin_b12_ug',
] as const;
```

- [ ] **Step 5 — Tests shared verts** — `npm run test -w @wellness/shared` → PASS. Puis `npm run typecheck` (0) : vérifie que la propagation (schéma/csv/form) compile.

- [ ] **Step 6 — Commit** — `chore(shared): étend le socle micronutriments à 31 (AG détaillés, oméga, vitamines/minéraux)`

---

## Task 2 — Mapping OpenFoodFacts (+ garde vitamine A)

**Files:**
- Modify: `apps/mobile/src/lib/openfoodfacts.ts` (`MICRO_MAP` + `mapOffMicronutrients`)
- Test: `apps/mobile/src/lib/__tests__/openfoodfacts.test.ts`

- [ ] **Step 1 — Tests d'abord** (nouveaux cas dans `describe('mapOffMicronutrients')`)

```ts
it('mappe les nouveaux nutriments (AG en g ×1, minéraux mg ×1000, µg ×1e6)', () => {
  expect(
    mapOffMicronutrients({
      'omega-3-fat_100g': 1.2,
      'saturated-fat_100g': 5, // reste une colonne macro, non mappé ici
      zinc_100g: 0.005,
      selenium_100g: 0.00002,
      'vitamin-b1_100g': 0.0012,
    }),
  ).toEqual({ omega_3_g: 1.2, zinc_mg: 5, selenium_ug: 20, vitamin_b1_mg: 1.2 });
});

it('omet la vitamine A quand OFF la donne en IU (unité non massique)', () => {
  expect(mapOffMicronutrients({ 'vitamin-a_100g': 400, 'vitamin-a_unit': 'IU' })).toEqual({});
});

it('mappe la vitamine A quand l’unité est massique (g → µg)', () => {
  expect(mapOffMicronutrients({ 'vitamin-a_100g': 0.0008, 'vitamin-a_unit': 'µg' })).toEqual({ vitamin_a_ug: 800 });
});
```

- [ ] **Step 2 — Lancer → échec attendu** — `cd apps/mobile && npx jest src/lib/__tests__/openfoodfacts.test.ts` → FAIL.

- [ ] **Step 3 — Étendre `MICRO_MAP`** (ajouter les 20 entrées ; ordre libre) et **garder la vit A** via un champ d'unité optionnel :

```ts
const MASS_UNITS = new Set(['g', 'mg', 'µg', 'ug', 'mcg']);

const MICRO_MAP: { key: MicronutrientKey; fields: string[]; factor: number; unitField?: string }[] = [
  { key: 'cholesterol_mg', fields: ['cholesterol_100g'], factor: 1000 },
  { key: 'monounsaturated_fat_g', fields: ['monounsaturated-fat_100g'], factor: 1 },
  { key: 'polyunsaturated_fat_g', fields: ['polyunsaturated-fat_100g'], factor: 1 },
  { key: 'trans_fat_g', fields: ['trans-fat_100g'], factor: 1 },
  { key: 'omega_3_g', fields: ['omega-3-fat_100g'], factor: 1 },
  { key: 'omega_6_g', fields: ['omega-6-fat_100g'], factor: 1 },
  { key: 'omega_9_g', fields: ['omega-9-fat_100g'], factor: 1 },
  { key: 'sodium_mg', fields: ['sodium_100g'], factor: 1000 },
  { key: 'magnesium_mg', fields: ['magnesium_100g'], factor: 1000 },
  { key: 'potassium_mg', fields: ['potassium_100g'], factor: 1000 },
  { key: 'calcium_mg', fields: ['calcium_100g'], factor: 1000 },
  { key: 'iron_mg', fields: ['iron_100g'], factor: 1000 },
  { key: 'zinc_mg', fields: ['zinc_100g'], factor: 1000 },
  { key: 'phosphorus_mg', fields: ['phosphorus_100g'], factor: 1000 },
  { key: 'copper_mg', fields: ['copper_100g'], factor: 1000 },
  { key: 'manganese_mg', fields: ['manganese_100g'], factor: 1000 },
  { key: 'selenium_ug', fields: ['selenium_100g'], factor: 1_000_000 },
  { key: 'iodine_ug', fields: ['iodine_100g'], factor: 1_000_000 },
  { key: 'vitamin_a_ug', fields: ['vitamin-a_100g'], factor: 1_000_000, unitField: 'vitamin-a_unit' },
  { key: 'vitamin_c_mg', fields: ['vitamin-c_100g'], factor: 1000 },
  { key: 'vitamin_d_ug', fields: ['vitamin-d_100g'], factor: 1_000_000 },
  { key: 'vitamin_e_mg', fields: ['vitamin-e_100g'], factor: 1000 },
  { key: 'vitamin_k_ug', fields: ['vitamin-k_100g'], factor: 1_000_000 },
  { key: 'vitamin_b1_mg', fields: ['vitamin-b1_100g'], factor: 1000 },
  { key: 'vitamin_b2_mg', fields: ['vitamin-b2_100g'], factor: 1000 },
  { key: 'vitamin_b3_mg', fields: ['vitamin-pp_100g', 'vitamin-b3_100g'], factor: 1000 },
  { key: 'vitamin_b5_mg', fields: ['pantothenic-acid_100g'], factor: 1000 },
  { key: 'vitamin_b6_mg', fields: ['vitamin-b6_100g'], factor: 1000 },
  { key: 'vitamin_b7_ug', fields: ['biotin_100g'], factor: 1_000_000 },
  { key: 'vitamin_b9_ug', fields: ['vitamin-b9_100g', 'folates_100g'], factor: 1_000_000 },
  { key: 'vitamin_b12_ug', fields: ['vitamin-b12_100g'], factor: 1_000_000 },
];
```

Dans `mapOffMicronutrients`, avant de retenir une valeur, appliquer la garde d'unité :

```ts
for (const m of MICRO_MAP) {
  if (m.unitField) {
    const u = n[m.unitField];
    if (typeof u === 'string' && !MASS_UNITS.has(u.toLowerCase())) continue; // ex. vit A en IU → on omet
  }
  let raw: number | null = null;
  for (const f of m.fields) { raw = num(n[f]); if (raw != null) break; }
  if (raw != null && raw > 0) out[m.key] = Math.round(raw * m.factor * 10) / 10;
}
```

- [ ] **Step 4 — Tests verts** — `npx jest src/lib/__tests__/openfoodfacts.test.ts` → PASS.

- [ ] **Step 5 — Commit** — `feat(mobile): mappe les nutriments OFF étendus (AG/oméga, minéraux, vitamines) avec garde vit A`

---

## Task 3 — Affichage `MicronutrientDetails` + i18n mobile

**Files:**
- Modify: `apps/mobile/src/components/MicronutrientDetails.tsx:17-38` (`GROUPS`)
- Modify: `apps/mobile/src/i18n/locales/fr.json` + `en.json` (`nutrition.micros.labels.*`)

- [ ] **Step 1 — Étendre `GROUPS`** (ajouter les items ; l'unité `g` existe déjà dans `Unit`) :

```ts
const GROUPS: { key: string; items: { key: MicronutrientKey; unit: Unit }[] }[] = [
  {
    key: 'lipids',
    items: [
      { key: 'cholesterol_mg', unit: 'mg' },
      { key: 'monounsaturated_fat_g', unit: 'g' },
      { key: 'polyunsaturated_fat_g', unit: 'g' },
      { key: 'trans_fat_g', unit: 'g' },
      { key: 'omega_3_g', unit: 'g' },
      { key: 'omega_6_g', unit: 'g' },
      { key: 'omega_9_g', unit: 'g' },
    ],
  },
  {
    key: 'minerals',
    items: [
      { key: 'sodium_mg', unit: 'mg' }, { key: 'magnesium_mg', unit: 'mg' }, { key: 'potassium_mg', unit: 'mg' },
      { key: 'calcium_mg', unit: 'mg' }, { key: 'iron_mg', unit: 'mg' }, { key: 'zinc_mg', unit: 'mg' },
      { key: 'phosphorus_mg', unit: 'mg' }, { key: 'copper_mg', unit: 'mg' }, { key: 'manganese_mg', unit: 'mg' },
      { key: 'selenium_ug', unit: 'ug' }, { key: 'iodine_ug', unit: 'ug' },
    ],
  },
  {
    key: 'vitamins',
    items: [
      { key: 'vitamin_a_ug', unit: 'ug' }, { key: 'vitamin_c_mg', unit: 'mg' }, { key: 'vitamin_d_ug', unit: 'ug' },
      { key: 'vitamin_e_mg', unit: 'mg' }, { key: 'vitamin_k_ug', unit: 'ug' }, { key: 'vitamin_b1_mg', unit: 'mg' },
      { key: 'vitamin_b2_mg', unit: 'mg' }, { key: 'vitamin_b3_mg', unit: 'mg' }, { key: 'vitamin_b5_mg', unit: 'mg' },
      { key: 'vitamin_b6_mg', unit: 'mg' }, { key: 'vitamin_b7_ug', unit: 'ug' }, { key: 'vitamin_b9_ug', unit: 'ug' },
      { key: 'vitamin_b12_ug', unit: 'ug' },
    ],
  },
];
```

> Le rendu reste **present-only** (`items.filter((it) => micronutrients[it.key] != null)`) → un produit
> pauvre est inchangé. Le sel dérivé sous le sodium est conservé.

- [ ] **Step 2 — Ajouter les 21 libellés** sous `nutrition.micros.labels` dans **`fr.json`** :

```json
"monounsaturated_fat_g": "AG monoinsaturés", "polyunsaturated_fat_g": "AG polyinsaturés",
"trans_fat_g": "AG trans", "omega_3_g": "Oméga-3", "omega_6_g": "Oméga-6", "omega_9_g": "Oméga-9",
"zinc_mg": "Zinc", "phosphorus_mg": "Phosphore", "copper_mg": "Cuivre", "manganese_mg": "Manganèse",
"selenium_ug": "Sélénium", "iodine_ug": "Iode",
"vitamin_a_ug": "Vitamine A", "vitamin_e_mg": "Vitamine E", "vitamin_k_ug": "Vitamine K",
"vitamin_b1_mg": "Vitamine B1", "vitamin_b2_mg": "Vitamine B2", "vitamin_b3_mg": "Vitamine B3",
"vitamin_b5_mg": "Vitamine B5", "vitamin_b6_mg": "Vitamine B6", "vitamin_b7_ug": "Vitamine B7"
```

- [ ] **Step 3 — Miroir EN** dans `en.json` (mêmes clés) : `Monounsaturated fat`, `Polyunsaturated fat`,
  `Trans fat`, `Omega-3/6/9`, `Zinc`, `Phosphorus`, `Copper`, `Manganese`, `Selenium`, `Iodine`,
  `Vitamin A/E/K/B1/B2/B3/B5/B6/B7`.

- [ ] **Step 4 — Vérifier parité i18n** (script node du repo) : FR = EN, 0 orphelin, nouvelles clés des deux côtés.

- [ ] **Step 5 — typecheck + lint mobile** — `npm run typecheck` (0), `cd apps/mobile && npx expo lint` (0 erreur).

- [ ] **Step 6 — Commit** — `feat(mobile): affiche le panel nutritionnel étendu (present-only) + i18n FR/EN`

---

## Task 4 — Libellés admin (formulaire s'étend automatiquement)

**Files:**
- Modify: `apps/admin/src/i18n/fr.ts:141` (`foods.microNames`)

- [ ] **Step 1 — Ajouter les 21 libellés** dans `foods.microNames` (mêmes valeurs FR que mobile).
  `FoodEditScreen` mappe déjà `MICRONUTRIENT_KEYS` → les 21 champs apparaissent sans autre changement.

- [ ] **Step 2 — Build admin + typecheck** — `npm run typecheck` (0) ; `npm run build -w @wellness/admin` (OK).

- [ ] **Step 3 — Commit** — `feat(admin): étend le formulaire aliment aux 31 micronutriments (libellés FR)`

---

## Task 5 — Vérification finale + recette

- [ ] **Step 1 — Suite complète** : `npm run typecheck` (0), `npm run lint` (0 erreur), `npm run test`
  (shared) + `cd apps/mobile && npx jest` (vert), parité i18n OK.
- [ ] **Step 2 — Recette device (Florian)** :
  - Scanner / afficher un aliment **riche** (ex. un brut CIQUAL du seed portant AG + vitamines, ou un
    produit OFF bien renseigné) → les 3 groupes s'affichent, valeurs mises à l'échelle avec la quantité.
  - Scanner un produit **pauvre** (Nutella) → rendu **inchangé** (present-only).
  - Vérifier qu'une fiche OFF avec **vit A en IU** n'affiche **pas** de vitamine A (pas de valeur fausse).
  - Formulaire admin : les 31 champs sont présents et éditables ; enregistrer round-trip OK.
- [ ] **Step 3 — `/commit`** final si des ajustements de recette sont nécessaires, puis push `dev`.

## Definition of Done (rappel spec §8)

- typecheck / lint / tests verts ; parité i18n.
- Present-only vérifié (pauvre inchangé, riche complet).
- Vit A en IU non affichée.
- Aucune migration, aucune dépendance native.

## Notes / risques

- **Densité** : jusqu'à 31 lignes + 31 chips « micros suivis » + 31 champs admin. Accordéon replié par
  défaut ; groupes pour la lisibilité. Regroupement visuel avancé de l'admin = hors périmètre (polish futur).
- **Valeur réelle** conditionnée à l'**enrichissement du seed CIQUAL** (US tracée) : sans lui, l'effet
  reste limité aux rares produits OFF complets. Le scan Nutella restera pauvre — c'est attendu.
- **Design/maquette** : changement d'UI **mineur** (mêmes composants/styles, plus de lignes) → maquette
  probablement **écartable** (précédents 1.15, 4.7/4.18). À confirmer par Florian à la validation.
