# Spec — Panel nutritionnel étendu (AG détaillés + vitamines/minéraux complets)

> **Statut** : ✅ **spec validée par Florian (14/07/2026)** — reste **plan → maquette → validation → code**.
> Prolonge l'US 4.33 (« panel étendu » explicitement différé).
> **Décisions produit actées (14/07/2026, Florian)** : (1) périmètre **complet** — acides gras
> détaillés + oméga + **toutes** les vitamines/minéraux ; (2) **pas de 2ᵉ source** (USDA/CIQUAL par
> nom) pour l'instant — on s'appuie sur ce qu'OpenFoodFacts fournit + la base brute CIQUAL (seed).

## 1. Problème / valeur

Au scan d'un produit, on n'affiche aujourd'hui que **kcal + 10 micronutriments** (socle 4.33) et,
depuis la finition scan, **P/G/L + sucres/AG saturés/fibres**. Or beaucoup d'aliments (surtout les
**bruts** CIQUAL, et certains produits OFF bien renseignés) portent un profil bien plus riche :
acides gras détaillés (mono/poly/trans, oméga-3/6/9), vitamines A/E/K/B1→B12, minéraux
(zinc, phosphore, cuivre, manganèse, sélénium, iode…).

**Objectif** : afficher **un maximum d'information nutritionnelle**, en **present-only** (on ne montre
que ce qui est renseigné, jamais de 0 par défaut — règle 4.33 conservée).

### Réalité de la donnée (à assumer)
- **Produits scannés (industriels)** : le plus souvent limités aux champs de l'**étiquette UE**
  (énergie, matières grasses, dont saturés, glucides, dont sucres, protéines, sel). Le détail AG /
  vitamines / minéraux est **généralement absent** — *aucune* API ne le fera apparaître si le
  fabricant ne l'a pas publié (vérifié sur le Nutella : 0 vitamine, 0 oméga sur OFF).
- **Aliments bruts** (base **CIQUAL**) : profils complets disponibles → c'est là que le panel étendu
  prend toute sa valeur. La donnée y sera intégrée **au seed** (US CIQUAL), pas inventée.

## 2. Périmètre

### Dans le périmètre
1. **Étendre le modèle de micronutriments** (`packages/shared`) avec les nutriments ci-dessous.
2. **Capter** ces nutriments depuis OpenFoodFacts (mapping + conversion d'unité) au scan et à la
   recherche texte.
3. **Afficher** present-only dans le panneau « Valeurs détaillées » (`MicronutrientDetails`),
   regroupés (Lipides détaillés / Minéraux / Vitamines).
4. **i18n FR + EN** à parité pour tous les nouveaux libellés.

### Hors périmètre (différé, cohérent avec 4.33)
- **Objectifs / RDA** (apports recommandés, jauges de couverture).
- **2ᵉ source** (USDA FoodData Central / CIQUAL par appariement de nom) — risque de mauvaise
  correspondance ; à cadrer séparément si un jour souhaité.
- **Édition admin** du set étendu (formulaire 8.5) — **phase 2** ; en attendant, le formulaire admin
  continue d'éditer le socle 10 sans régression.
- **Micros des recettes / repas types** (agrégation) — déjà différé en 4.33.
- **Enrichissement du seed CIQUAL** avec ces colonnes — dépend de l'US base CIQUAL (ne rien inventer).

## 3. Set de nutriments (proposition à valider)

Clés ajoutées à `MICRONUTRIENT_KEYS` (suffixe = unité d'affichage). Stockées dans la **colonne JSON
`micronutrients`** (foods + snapshot food_entries) → **aucune migration** (JSON flexible ; le schéma
Zod est côté code). Facteur = conversion depuis les `*_100g` OFF (exprimés en **grammes**).

### Lipides détaillés (déjà : `cholesterol_mg`)
| Clé | Unité | Champ OFF | Facteur (g→unité) |
|---|---|---|---|
| `monounsaturated_fat_g` | g | `monounsaturated-fat_100g` | ×1 |
| `polyunsaturated_fat_g` | g | `polyunsaturated-fat_100g` | ×1 |
| `trans_fat_g` | g | `trans-fat_100g` | ×1 |
| `omega_3_g` | g | `omega-3-fat_100g` | ×1 |
| `omega_6_g` | g | `omega-6-fat_100g` | ×1 |
| `omega_9_g` | g | `omega-9-fat_100g` | ×1 |

> _Note :_ AG **saturés**, sucres, fibres restent des **colonnes** `foods` (déjà affichées dans
> `QuantityPanel`). On ne les déplace pas ; le groupe « Lipides détaillés » complète sans doublonner.

### Minéraux (déjà : sodium, magnésium, potassium, calcium, fer)
| Clé | Unité | Champ OFF | Facteur |
|---|---|---|---|
| `zinc_mg` | mg | `zinc_100g` | ×1000 |
| `phosphorus_mg` | mg | `phosphorus_100g` | ×1000 |
| `copper_mg` | mg | `copper_100g` | ×1000 |
| `manganese_mg` | mg | `manganese_100g` | ×1000 |
| `selenium_ug` | µg | `selenium_100g` | ×1e6 |
| `iodine_ug` | µg | `iodine_100g` | ×1e6 |

### Vitamines (déjà : C, D, B9, B12)
| Clé | Unité | Champ OFF | Facteur |
|---|---|---|---|
| `vitamin_a_ug` | µg | `vitamin-a_100g` | ×1e6 |
| `vitamin_e_mg` | mg | `vitamin-e_100g` | ×1000 |
| `vitamin_k_ug` | µg | `vitamin-k_100g` | ×1e6 |
| `vitamin_b1_mg` | mg | `vitamin-b1_100g` | ×1000 |
| `vitamin_b2_mg` | mg | `vitamin-b2_100g` | ×1000 |
| `vitamin_b3_mg` | mg | `vitamin-pp_100g` (niacine) | ×1000 |
| `vitamin_b5_mg` | mg | `pantothenic-acid_100g` | ×1000 |
| `vitamin_b6_mg` | mg | `vitamin-b6_100g` | ×1000 |
| `vitamin_b7_ug` | µg | `biotin_100g` | ×1e6 |

**Total : +21 nutriments** (10 socle → 31). Chaque champ OFF peut lister des alias (ex. `folates`
déjà géré pour B9) — à confirmer à l'implémentation.

### Points d'attention unités
- **Vitamine A** : OFF renseigne parfois en **UI (IU)** et non en grammes → conversion non fiable.
  À traiter : ne mapper que si le champ est en g (ou champ `-unit` = g) ; sinon **omettre** plutôt
  qu'afficher une valeur fausse. À vérifier sur données réelles.
- Valeurs `≤ 0` ou non finies → **omises** (règle 4.33 inchangée).

## 4. Règles métier

- **Present-only** : un nutriment n'apparaît que s'il est renseigné (> 0). Aucun 0 par défaut.
- **Mise à l'échelle** : `scaleMicronutrients` (existant) itère `MICRONUTRIENT_KEYS` → automatique
  pour les nouvelles clés. Idem `sumMicronutrients`.
- **Snapshot journal** : à l'ajout, le snapshot `food_entries.micronutrients` fige les nouvelles
  clés comme les anciennes (comportement 4.33 inchangé).
- **Rétrocompat** : `parseMicronutrients` tolérant conservé ; les anciens aliments (10 clés) restent
  valides, les nouvelles clés absentes = simplement non affichées.

## 5. Affichage (`MicronutrientDetails`)

- Ajouter l'unité **`g`** au type `Unit` (`'mg' | 'ug' | 'g'`).
- Étendre `GROUPS` :
  - **Lipides détaillés** : cholestérol (existant) + mono/poly/trans/oméga-3/6/9.
  - **Minéraux** : + zinc, phosphore, cuivre, manganèse, sélénium, iode.
  - **Vitamines** : + A, E, K, B1, B2, B3, B5, B6, B7.
- Ordre d'affichage **stable** (celui du tableau §3), lisibilité inchangée (valeur mise à l'échelle +
  « pour 100 g » en secondaire). Sel dérivé sous le sodium : conservé.
- **Aucune régression** : produit ne portant que le socle → rendu identique à aujourd'hui.

## 6. i18n (FR + EN, parité obligatoire)

- +21 libellés `nutrition.micros.labels.<clé>` × 2 langues (FR/EN).
- Groupes `nutrition.micros.groups.{lipids,minerals,vitamins}` : déjà présents (libellé « Lipides
  détaillés » à ajuster si besoin).
- Unité `g` : `nutrition.micros.units.g` déjà présent (utilisé pour le sel).

## 7. Impacts fichiers (pré-cadrage, à préciser au plan)

- `packages/shared/src/food.ts` — `MICRONUTRIENT_KEYS` (+21) ; schéma/scale/sum inchangés (dérivés).
- `apps/mobile/src/lib/openfoodfacts.ts` — `MICRO_MAP` (+21 entrées, facteurs/alias) ; garde vit A.
- `apps/mobile/src/components/MicronutrientDetails.tsx` — `Unit += 'g'`, `GROUPS` étendus.
- `apps/mobile/src/i18n/locales/{fr,en}.json` — +21 labels.
- Tests `packages/shared` + `apps/mobile` (map OFF) — cas de conversion mg/µg/g + omission vit A en IU.
- **Pas de migration** (colonne JSON). **Pas de dépendance native.** **Pas de checkpoint 🔴 cloud.**

## 8. Definition of Done

- typecheck / lint / tests verts ; parité i18n.
- Present-only vérifié (produit socle → rendu inchangé ; produit riche → nouveaux groupes).
- Recette device : scanner/afficher un aliment **riche** (ex. un aliment CIQUAL du seed portant AG +
  vitamines) → tous les groupes s'affichent, mis à l'échelle ; un produit pauvre (Nutella) → inchangé.
- Vit A en IU **non affichée** (pas de valeur fausse).

## 9. Risques / questions ouvertes

- **Unités OFF hétérogènes** (vit A IU, parfois champs `-unit`) → prévoir un garde-fou de conversion
  au plan (mapper seulement si unité g/normalisée).
- **Densité d'affichage** : jusqu'à 31 lignes possibles → l'accordéon reste replié par défaut ; ordre
  et groupes gèrent la lisibilité. À confirmer en maquette.
- **Seed CIQUAL** : la vraie valeur du panel dépend de l'enrichissement du seed (US séparée) — sans
  lui, l'effet reste limité aux rares produits OFP complets.
