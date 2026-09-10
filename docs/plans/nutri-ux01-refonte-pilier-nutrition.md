# Plan d'implémentation — NUTRI-UX01

> Spec : [nutri-ux01-refonte-pilier-nutrition.md](../specs/functional/us/nutri-ux01-refonte-pilier-nutrition.md)
> Branche : `feature/nutri-refonte-ux` (worktree `.claude/worktrees/nutri-refonte`).
> **Une migration** (hydratation) → sync rules PowerSync à déployer à la main.

## Principe d'ordonnancement

Le socle pur d'abord (`packages/shared`, testé sous Vitest), la base ensuite, les écrans enfin.
Deux raisons : les briques de recherche, de quantité et de qualité sont réutilisées par trois
écrans chacune, et une brique pure se teste sans device — c'est ce qui permet de livrer un lot de
cette taille sans recette intermédiaire.

**R6.2 (pagination) est traité avec R2.3 (recherche)** : ce sont deux faces de la même requête.

---

## Étape 1 — Socle `packages/shared` (pur, testé)

| Fichier | Contenu | Tests |
|---|---|---|
| `food-search.ts` *(nouveau)* | `rankFoodMatches()` — score préfixe > début de mot > sous-chaîne, bonus « récent », repli flou via `bestMatchIndex`. Type `SearchableItem` couvrant aliment / recette / repas type. | pertinence, accents, fautes, ex æquo, casse |
| `portions.ts` *(nouveau)* | `portionMultiples()` — ½ / 1 / 2 d'une portion, arrondis entiers ; `stepGrams()` — pas adaptatif (1 g sous 20 g, 5 g sous 100, 10 au-delà). | bornes, arrondis, portion absente |
| `hydration.ts` *(nouveau)* | `hydrationProgress()` — verres, ml, ratio borné ; `DEFAULT_GLASS_ML`, `DEFAULT_WATER_TARGET_ML`. | objectif nul, dépassement, arrondis |
| `diet-quality.ts` *(nouveau)* | `qualityTargets(targetKcal)` — fibres 25-30 g fixes, sucres et AGS à 10 % de la cible ; `qualityStatus()` → `under` / `ok` / `over`. | cible nulle, proportionnalité, seuils |
| `journal-regularity.ts` *(nouveau)* | `buildHeatmap()` (30 cases), `currentStreak()`, `bestStreak()`, `emptyDays()`. | trous, série en cours = aujourd'hui, série max |
| `nutrition.ts` *(existant)* | `ACTIVITY_LEVEL_ORDER` déjà là ; ajouter `hasChosenActivityLevel()`. | — |
| `index.ts` | exports | — |

## Étape 2 — Base de données (hydratation)

1. `npm run db:new water_entries`
2. Table `water_entries` : `id uuid pk`, `owner_id`, `log_date date`, `volume_ml int`,
   `created_at`, `updated_at`, `deleted_at` — RLS calquée sur `body_weight_entries`.
3. `npm run db:push:dry` → `npm run db:push` → `npm run db:types` → cocher `supabase/MIGRATIONS.md`.
4. `docs/specs/technical/powersync-sync-rules.yaml` : ajouter la table. **Déploiement manuel** →
   critère de recette.
5. `apps/mobile/src/data/repositories/water-repository.ts` : `useDayWater(day)`, `addWater()`,
   `removeLastWater()` — écriture par `insertWithSyncFields` / `softDelete`.

## Étape 3 — R1, l'objectif juste

- `apps/mobile/src/app/(onboarding)/activity.tsx` *(nouveau)* — 5 niveaux + descriptions.
- `OnboardingScaffold.tsx` — prop `total` (défaut 4).
- `(onboarding)/displayLevel.tsx` — `NEXT` dynamique : `activity` si nutrition active, sinon
  `summary`.
- `(onboarding)/summary.tsx` — rappelle le niveau choisi.
- `nutrition-profile.tsx` — bandeau « valeur par défaut » tant que `activity_level` est `null` ;
  explication du TDEE ; vocabulaire (R1.4).
- `nutrition-repository.ts` — `activityLevel` accepte `null` ; les lecteurs gardent `?? 'moderate'`.

## Étape 4 — R2, le geste de saisie

- `components/nutrition/AddFoodSheet.tsx` *(nouveau)* — sheet à 3 modes, bandeau de budget,
  liste unifiée. Remplace l'écran `food-picker` comme point d'entrée ; l'écran reste pour les
  liens directs et le mode recette.
- `components/QuantityPanel.tsx` — portions multipliables, stepper, dernière quantité, projection.
- `data/repositories/food-repository.ts` — `useSearchCatalog(term, limit)` : requête paginée
  (LIMIT/OFFSET) + `rankFoodMatches`, fusion récents/favoris ; `useLastQuantityFor(foodId)`.
- `hooks/useDebounced.ts` *(nouveau)* — 200 ms.
- `food-picker.tsx`, `food-scan.tsx`, `meal-quick-entry.tsx` — repli `mealForHour(hour)`.
- `(tabs)/nutrition.tsx` — action scan dans l'en-tête.

## Étape 5 — R3, le journal

- `components/nutrition/DayCalendarSheet.tsx` *(nouveau)* — mois, pastilles, raccourcis.
- `components/nutrition/WeekStrip.tsx` *(nouveau)* — 7 pastilles dans la barre de jour.
- `components/nutrition/HydrationCard.tsx` *(nouveau)*.
- `components/nutrition/QualityCard.tsx` *(nouveau)* — 3 repères + protéines/kg.
- `stores/tracked-micros.ts` — défaut à 6 clés, en distinguant « jamais choisi » de « vidé ».
- `(tabs)/nutrition.tsx` — ordre des blocs : micros **sous** les repas.
- `journal-repository.ts` — `useMonthCompletion(month)`.

## Étape 6 — R4, le suivi

- `app/nutrition-stats.tsx` — sous-onglets `Régularité · Apports · Poids · Qualité`.
- `components/nutrition/RegularityCard.tsx` *(nouveau)* — heatmap + séries.
- `components/nutrition/AdherenceChart.tsx` *(nouveau)* — zone-cible.
- La pesée descend dans l'onglet Poids.

## Étape 7 — R7, le planning

- `meal-plan/index.tsx` — `AddEntrySheet` accepte aliment simple et ajout rapide ; bascule
  **grille / liste**, grille par défaut.
- `components/nutrition/MealPlanWeekGrid.tsx` *(nouveau)*.
- `meal-plan-repository.ts` — `planFood()`, `planQuickAdd()`, `movePlannedEntry(id, dayKey)`.
- Migration : `planned_meal_entries` doit accepter `source_type = 'food' | 'quick'` →
  **incluse dans la migration de l'étape 2** (une seule migration pour l'US).
- `recipe-edit.tsx` — renommer, supprimer, éditer la quantité d'un ingrédient.

## Étape 8 — R6, la dette

`nutrition-profile.tsx` (formulaire local), `food-custom.tsx` (portions + cru/cuit + allergènes
prédéfinis), `recipe-edit.tsx` (affordances), détail d'entrée (micros repliés), `meal-quick-entry`
(propositions + créer + ajouter une ligne), polices ≥ 11 px.

## Étape 9 — i18n, tests, vérifications

- `fr.json` / `en.json` : toutes les clés nouvelles, **aucune chaîne en dur**.
- `npm run typecheck`, `npm run lint`, `npm run test` — **lire le code de sortie sans pipe**.
- Tests d'écran (Jest) pour les composants neufs à état : sheet, calendrier, hydratation.

## Étape 10 — Outillage et suivi

- `generate.py --bulk` (D1) + mise à jour du README d'`enrich-ciqual`.
- `RECETTES.md` §58, roadmap 4.41, `CHANGELOG.md`, `node scripts/etat.mjs`.

---

## Risques identifiés

| Risque | Parade |
|---|---|
| La migration touche deux sujets (eau + planning) | Une seule migration, deux blocs commentés — le CLI ne joue que les manquantes, et scinder imposerait deux `db:push` pour une même US. |
| Les sync rules PowerSync sont manuelles | Critère de recette explicite, en tête de la section §58. |
| Le sheet remplace un écran référencé par des liens directs | `food-picker` **reste** une route (liens `wellness://`, mode recette) ; le sheet est le chemin depuis le journal. |
| Trois sessions en parallèle sur le dépôt | Worktree isolé, aucune modification hors périmètre nutrition, `RECETTES.md` en fin de course pour limiter le conflit. |
| Base à 900 aliments après D1 | Pagination livrée ici (R6.2), donc le remplissage ne dégradera pas le sélecteur. |
