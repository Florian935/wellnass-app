# Plan d'implémentation — US NUTR-F2 (suggestion d'aliments pour combler un macro)

Spec : [nutrf2-substitution-aliments.md](../specs/functional/us/nutrf2-substitution-aliments.md) ·
Roadmap **4.37** · Branche `feature/nutrf2-substitution-aliments` · ~4 h.

> **Aucune migration, aucune sync rule, aucune table.** Tout est du calcul local sur des données déjà
> répliquées. C'est l'US la moins risquée du lot restant — le risque est dans la **qualité du score**,
> pas dans la plomberie.

## Fichiers touchés

**Créés**

| Fichier | Rôle |
|---|---|
| `packages/shared/src/macro-suggestion.ts` | Écart par macro, score, quantité — **pur** |
| `packages/shared/src/macro-suggestion.test.ts` | Tests, dont tous les cas d'écartement |
| `apps/mobile/src/components/nutrition/MacroSuggestionCard.tsx` | Carte conditionnelle |

**Modifiés**

| Fichier | Modification |
|---|---|
| `apps/mobile/src/app/(tabs)/nutrition.tsx` | Monter la carte sous le journal du jour |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | Namespace `suggestion` |
| `docs/roadmap/roadmap.md` | 4.37 |

**Volontairement non touchés** : le modèle de données, les sync rules, `nutrition_profiles`.

---

### Tâche 1 — Le score (TDD, c'est le cœur de l'US)

Tests d'abord. Tout est pur : des nombres en entrée, des suggestions en sortie.

1. `macroGaps(totals, targets)` → écart **absolu et relatif** par macro (protéines, glucides, lipides).
2. `pickMacroToFill(gaps)` → le macro au plus grand écart **relatif** (D1), ou `null` si aucun n'atteint
   le seuil de 10 % (D6).
3. `suggestFoodsForMacro({ macro, gapG, kcalBudget, candidates, recentIds })` → jusqu'à **3**
   suggestions, chacune `{ foodId, quantityG, kcal, macroG }`.

Règles à encoder — et ce sont elles qui font la différence entre un conseil et un gadget :

- **Score = densité du macro pour 100 kcal.** Trier sur les g/100 g désignerait les aliments les plus
  caloriques ; c'est l'efficacité qu'on cherche.
- **Quantité** = celle qui comble l'écart, **arrondie à 5 g**, **bornée 10–400 g**. Hors bornes →
  l'aliment est **écarté**, pas tronqué (D3).
- **Écarter** aussi tout aliment dont l'apport calorique à cette quantité **dépasse le budget restant**.
- **Départage** : à densité proche (< 10 % d'écart de score), l'aliment **récemment consommé** passe
  devant (D4).
- Valeur du macro `null` → candidat écarté (on ne score pas une donnée absente).

Cas de test : écart nul, budget négatif, vivier vide, aliment trop pauvre (quantité > 400 g), aliment
trop riche (quantité < 10 g), aliment hors budget calorique, égalité de score avec et sans récence,
plafond de 3 respecté.

### Tâche 2 — La carte

Conditionnelle selon D6 (objectif défini · écart ≥ 10 % · budget calorique positif). Affiche le manque,
jusqu'à 3 suggestions avec **quantité et coût calorique**, un sélecteur de macro, et la mention
« ne tient pas compte du régime déclaré » — une limite qu'il faut dire plutôt que laisser découvrir.

Tap → `addFoodEntry` au repas courant, à la quantité proposée.

### Tâche 3 — i18n

Namespace `suggestion` FR + EN. Aucune chaîne en dur, pluriels gérés.

---

## Ordre de build

1. **Tâche 1** — le score se teste sans écran, et c'est là qu'est toute la valeur.
2. **Tâche 3** avant la **2** : la carte consomme les clés.
3. **Tâche 2** en dernier.

## Tests prévus

| Niveau | Quoi |
|---|---|
| Vitest (`shared`) | `macroGaps`, `pickMacroToFill` (seuil, écart **relatif** et non absolu), `suggestFoodsForMacro` (tous les cas d'écartement, départage par récence, plafond de 3) |
| Jest (mobile) | Smoke de la carte : présente avec un manque, **absente** en dépassement calorique, absente sous le seuil |
| Recette device | Les 10 critères de la spec §9 |

## Risques

| Risque | Parade |
|---|---|
| **Quantités absurdes** (« 900 g de brocoli ») — le risque n°1, nommé par le backlog | Bornes 10–400 g **et écartement** plutôt que troncature (D3), testé aux deux bornes |
| Suggestions caloriquement contre-productives | Score en **g/100 kcal** + écartement si l'apport dépasse le budget restant |
| Toujours les glucides suggérés | Écart **relatif**, pas absolu (D1) — testé |
| Conseils théoriques (aliments jamais mangés) | Récents en tête de vivier (D4) |
| Carte affichée à contretemps (jour déjà dépassé) | D6 en trois conditions, testé côté carte |
| Faux service sur le régime déclaré | Aucun aliment n'est étiqueté en base → limite **affichée**, pas masquée |
