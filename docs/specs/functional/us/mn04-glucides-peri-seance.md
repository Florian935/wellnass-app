---
id: MN-04
titre: "Macros ajustées jours muscu (glucides péri-séance)"
roadmap: []
catalogue: [MN-04]
etape: recette
branche: feature/mn04-glucides-peri-seance
maj: 04/08/2026
---

# US MN-04 — Macros ajustées jours muscu (glucides péri-séance)

> **Spec fonctionnelle — ✅ validée par Florian le 04/08/2026** (spec + plan + maquette, décision
> D1 arbitrée conformément à la recommandation — 100 % du bonus vers les glucides). **Code livré le
> 04/08/2026** (TDD, `trainingDayMacroGrams` + 2 écrans corrigés) — reste la recette device (§9).
>
> **US d'analyse — aucune ligne roadmap.** Comme [TRI-12](tri12-garde-fou-global.md)/
> [RN-03](rn03-tdee-ajuste-course.md), cette US vit **uniquement** dans le
> [catalogue d'analyses](../../product/analyses-donnees.md).
>
> **Pas de nouveau widget.** Contrairement à TRI-03/RN-03, cette US ne surface rien de neuf : elle
> corrige et complète le calcul des cibles macro de **deux écrans déjà existants**
> (`NutritionSummaryCard`, écran Nutrition). Aucune décision de surfaçage ADR-007 à prendre.

## 0. Le trou : le bonus calorique du jour n'est jamais ventilé en macros

Déjà documenté **dans le code lui-même** ([nutrition.tsx:123-127](../../../../apps/mobile/src/app/(tabs)/nutrition.tsx#L123)) :
> « Les macros cibles restent calées sur l'objectif de base (bonus non ventilé). »

Concrètement : `useDayCalorieTarget`/`useNutritionSummary` calculent bien un **`effectiveTarget`**
(objectif de base + bonus jour d'entraînement, MN-01/RN-02) pour l'anneau de calories — mais les
**cibles macro en grammes**, affichées juste en dessous sur les deux mêmes écrans, sont calculées
depuis le `target` **de base** (`macroGramsFromCalories(target, defaultMacroRatios(objective))`,
[NutritionSummaryCard.tsx:109-110](../../../../apps/mobile/src/components/dashboard/NutritionSummaryCard.tsx#L109),
[nutrition.tsx:146-147](../../../../apps/mobile/src/app/(tabs)/nutrition.tsx#L146)). **Les 3 barres
macro ne totalisent donc jamais l'objectif calorique affiché juste au-dessus**, un jour de séance —
le bonus existe dans le budget calorique mais n'apparaît nulle part dans le détail protéines/
glucides/lipides.

**MN-04 comble précisément ce trou**, sans inventer de nouveau seuil : le bonus déjà calculé
(MN-01/RN-02) est simplement **redirigé vers les glucides** plutôt que de rester invisible —
correspondant exactement à l'intention du catalogue (« glucides plus hauts les jours de séance »)
et à la pratique nutritionnelle courante (les calories additionnelles autour de l'effort servent
d'abord à reconstituer le glycogène, pas la masse grasse).

**Pas un doublon de MN-01/RN-02/RN-03** : MN-01 calcule le bonus (kcal), RN-02 en détermine la
source (forfait fixe ou dépense de course auto), RN-03 ajuste le **facteur d'activité** en amont du
calcul du TDEE. MN-04 ne recalcule **aucun** de ces trois — elle consomme le résultat déjà produit
(`effectiveTarget - target`) et décide seulement **où** ces grammes-là atterrissent dans la
répartition macro. Purement en aval, aucun risque de double-comptage calorique (le total en grammes
reste égal à `effectiveTarget`, à l'arrondi près).

## 1. Décision de cadrage — ✅ TRANCHÉE par Florian le 04/08/2026

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | Le bonus va-t-il **entièrement** aux glucides, ou une partie aux protéines (synthèse protéique post-effort) ? | **100 % glucides** | Le catalogue est explicite (« glucides plus hauts »), et MN-06 (livrée) couvre déjà une cible protéines **indépendante**, en g/kg par objectif — y ajouter une part du bonus créerait une deuxième règle protéines concurrente de MN-06, sans seuil sourcé pour la répartir. Scinder le bonus (ex. 70/30 glucides/protéines) serait un chiffre inventé ; l'envoyer entièrement aux glucides ne l'est pas — c'est la totalité d'un montant déjà justifié ailleurs, simplement réorientée |

## 2. Ce qui existe déjà et qu'on réutilise

| Brique | Où | Usage ici |
|---|---|---|
| `macroGramsFromCalories`, `defaultMacroRatios`, `CARBS_KCAL_PER_G` | `packages/shared/src/nutrition.ts` (§2.3) | Base du calcul — **non modifiées** |
| `useDayCalorieTarget(dayKey)` → `target`, `effectiveTarget` | `dashboard-repository.ts` (RN-02) | Le bonus est déjà `effectiveTarget - target`, jamais recalculé ici |
| `nutrition_profiles.manual{Protein,Carbs,Fat}G` | table existante | **Inchangé** — le mode manuel garde la priorité absolue (§4) |
| `NutritionSummaryCard.tsx`, `(tabs)/nutrition.tsx` | écrans existants | Les deux call sites à corriger — même logique dupliquée dans les deux aujourd'hui |

**Aucune donnée nouvelle, aucune migration, aucun widget nouveau.**

## 3. Les règles

**R1 — Fonction pure `trainingDayMacroGrams`.** Reçoit `targetBase`, `effectiveTarget`,
`objective` ; calcule `macroGramsFromCalories(targetBase, defaultMacroRatios(objective))` puis
ajoute `round(max(0, effectiveTarget - targetBase) / CARBS_KCAL_PER_G)` aux glucides **seulement**
(D1). Protéines et lipides restent ceux du calcul de base, inchangés.

**R2 — S'applique uniquement quand `manualSet` est faux.** Le mode manuel
(`manualProteinG`/`manualCarbsG`/`manualFatG`) garde une priorité absolue et n'est **jamais**
recombiné avec le bonus — même règle que l'existant (`manualSet` court-circuite déjà tout calcul
automatique dans les deux écrans, comportement inchangé).

**R3 — Agnostique de l'origine du bonus.** Que le bonus vienne d'un forfait fixe (jour de muscu
sans course) ou de la dépense réelle d'une course (mode auto, RN-02), la règle R1 s'applique de la
même façon — aucune distinction par pilier, le mécanisme de bonus est déjà pilier-agnostique en
amont (MN-01/RN-02), MN-04 ne fait qu'en disposer.

**R4 — Aucun jour sans bonus n'est affecté.** `effectiveTarget === targetBase` (jour de repos, ou
bonus nul) → `trainingDayMacroGrams` retourne exactement le même résultat que
`macroGramsFromCalories(targetBase, defaultMacroRatios(objective))` aujourd'hui. Comportement
inchangé hors jour de séance.

## 4. Périmètre

**Dans le périmètre :**
1. Fonction pure `trainingDayMacroGrams` (packages/shared).
2. `NutritionSummaryCard.tsx` et `(tabs)/nutrition.tsx` appellent cette fonction au lieu de
   `macroGramsFromCalories(target, ...)` directement, quand `!manualSet`.

**Hors périmètre, explicitement :**
- Répartition du bonus entre plusieurs macros (D1 — 100 % glucides seulement).
- Déduplication de la logique `manualSet` répétée dans les deux écrans — préexistante, pas
  spécifique à cette US ; un refactor distinct, pas un blocage ici.
- Toute action sur `dayCalorieBonus`/`trainingBonusMode`/`activityLevel` (MN-01/RN-02/RN-03) —
  aucune de ces briques n'est modifiée (§0).
- Écran Planning repas (roadmap 4.27, non livré — V1.1) : le catalogue citait `alimentation.md §6.2`
  qui décrit ce module optionnel, **pas encore construit**. MN-04 s'applique aux cibles macro déjà
  affichées aujourd'hui (résumé nutrition + écran Nutrition), pas à un module qui n'existe pas.

## 5. i18n

**Aucune nouvelle chaîne.** Les libellés des 3 barres macro (`nutrition.macros.protein/carbs/fat`)
existent déjà sur les deux écrans ; seule la **valeur numérique** de la cible glucides change un
jour de séance.

## 6. Comportement offline

**Total.** Calcul pur en aval de données déjà chargées localement (`nutrition_profiles`, cible du
jour déjà résolue par `useDayCalorieTarget`, lui-même 100 % local). Aucun réseau, aucune écriture.

## 7. Cas limites

| Situation | Comportement attendu |
|---|---|
| Jour de repos (pas de bonus) | Cibles macro identiques à aujourd'hui (R4) |
| Jour de séance, mode manuel actif | Cibles = valeurs manuelles telles quelles, bonus ignoré (R2) |
| Jour de séance, bonus forfait fixe | Glucides = base + bonus/4 (arrondi), protéines/lipides inchangés |
| Jour de séance, bonus auto (dépense de course) | Même règle, peu importe l'origine du bonus (R3) |
| `effectiveTarget` absent (profil incomplet) | Cibles macro `null`, comme aujourd'hui — pas de calcul sur donnée absente |
| Bonus très élevé (grosse dépense de course) | Aucun plafond ajouté ici — reflète simplement un `effectiveTarget` déjà élevé, cohérent avec l'anneau de calories affiché juste au-dessus |

## 8. Definition of Done

- [x] D1 arbitrée par Florian le 04/08/2026.
- [x] `trainingDayMacroGrams` pure et testée dans `packages/shared` (5 tests : jour de repos =
      inchangé R4, bonus pair +100g, bonus impair sans NaN, garde défensive, total kcal cohérent).
- [x] Les deux écrans (`NutritionSummaryCard`, `(tabs)/nutrition.tsx`) utilisent la nouvelle
      fonction ; la somme des 3 macros affichées correspond à `effectiveTarget` un jour de séance
      (à l'arrondi près) — vérifié en revue de code, à confirmer visuellement en recette.
- [x] `npm run lint`, `npm run typecheck`, `npm run test` verts (1468 tests shared + 655 tests
      mobile, 04/08/2026).
- [x] Aucune ligne roadmap à toucher (US d'analyse, catalogue seul).
- [ ] Recette device (Florian ou Damien) — critères §9.

## 9. Critères d'acceptation (recette device)

1. Jour de repos : cibles macro identiques à avant cette US.
2. Jour de séance muscu (bonus forfait) : la cible glucides augmente visiblement ; protéines et
   lipides ne bougent pas.
3. Jour de course (bonus auto) : même effet, cohérent avec la dépense réelle de la course.
4. Macros manuelles actives : aucun changement, quel que soit le bonus du jour.
5. Les 3 barres macro (grammes cibles) totalisent l'objectif calorique affiché en haut de l'écran,
   un jour de séance — ce qui n'était pas le cas avant cette US.
6. Mode avion : fonctionne normalement (calcul local).
7. Cohérent entre le widget dashboard et l'écran Nutrition (même cible affichée aux deux endroits).
