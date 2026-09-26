# Plan d'implémentation — NUTRI-UX03 (hub Nutrition en trois onglets)

Spec : [docs/specs/functional/us/nutri-ux03-hub-onglets.md](../specs/functional/us/nutri-ux03-hub-onglets.md) ·
Maquette : [design/nutri-ux03-hub-onglets/](../../design/nutri-ux03-hub-onglets/) ·
Branche : `feature/nutri-ux03-hub-onglets`, dans le worktree `.expo/claude-worktrees/nutri-ux03`
(la session Course travaille en parallèle sur CARDIO-UX03).

Ce que le plan ne touche pas :
- **aucune migration, aucune table, aucune sync rule PowerSync, aucune dépendance native** ;
- **aucun fichier de la muscu ni de la course** (`components/strength/`, `strength-section-store.ts`,
  `hub-section.ts`, `history-calendar.ts` est seulement **importé** pour `shiftMonth`,
  `compareMonths`, `monthRange`) ;
- la feuille d'ajout, le scanner, le planning repas, l'écran Statistiques (hors son paramètre `tab`).

Ce qu'il ajoute : deux requêtes SQL de lecture, une route (`/nutrition-day`), des chaînes i18n FR et
EN (test de parité existant).

Chaque étape se termine au vert : `npm run lint`, `npm run typecheck`, `npm run test`,
`npm run agents:check`, code de sortie lu **sans pipe**. TDD : le test d'abord, rouge, puis le code.
Références `R*` et `D*` : la spec. Un `/commit` par étape (avant chaque push : `git fetch origin`,
`git rebase origin/dev`, push en avance rapide sur `dev`).

## Étape 1 — Briques pures (`packages/shared`, Vitest)

| Fichier | Contenu | Tests |
|---|---|---|
| `src/nutrition-section.ts` | `NUTRITION_SECTIONS` (`today`, `history`, `progress`), `isNutritionSection`, `resolveNutritionSection({ param, remembered })` (D3). `NUTRITION_STATS_TABS` + `resolveStatsTab(param)` (R12). | Chaque priorité ; paramètre invalide, tableau, absent ; onglet de stats inconnu → `regularity`. |
| `src/meal-history.ts` | `foodIdentity(entry)` (`food_id`, sinon nom normalisé : minuscules, sans accents, espaces réduits) ; `groupMealOccurrences(rows)` → occurrences `{ dayKey, mealKey, items }` ; `mealSignature(items)` ; `recentDistinctMeals(occ, mealKey, { limit })` (R3) ; `habitualMeals(occ, mealKey, { minCount, limit })` (R9) ; `summarizeDayFoods(items, mealOrder, perMeal)` (R8). | Mêmes aliments dans un autre ordre = même repas ; quantités différentes = même repas ; texte libre par nom normalisé (« Crème » = « creme ») ; entrée isolée non habituelle ; tri par nombre puis par date ; limite ; repas vide ignoré ; résumé multi-repas, repas inconnu en dernier. |
| `src/nutrition-calendar.ts` | `dayTargetStatus(kcal, target, marginPct)` (R7) ; `dayFillRatio(kcal, target)` ; `buildNutritionMonthGrid({ year, month, days, todayKey, marginPct })` → semaines × 7 cases `{ dayKey, day, kind: 'blank' \| 'past' \| 'today' \| 'future', kcal, fill, status }` ; `nutritionMonthSummary(days, todayKey, marginPct)` ; `historyListDayKeys({ year, month, loggedDayKeys, todayKey })` (R8 : jours notés du mois + jours vides des 6 jours précédant aujourd'hui). | Mois qui commence un lundi / un dimanche, février bissextile, bornes de la marge incluses, au-dessus / en dessous, sans cible (moitié, pas de statut), aujourd'hui exclu du résumé, futur, liste avec trous récents. |

Exports dans `src/index.ts`.

## Étape 2 — Données (`apps/mobile/src/data/repositories`)

| Fichier | Changement | Tests |
|---|---|---|
| `journal-repository.ts` | `SELECT_ENTRIES_BETWEEN` + `useEntriesBetween(fromKey, toKey)` : `log_date`, `meal_type`, `food_id`, `name`, `kcal`, `order_index`, bornes incluses, `deleted_at IS NULL`, trié jour décroissant puis repas puis ordre. `useFirstLogDate()` sur `SELECT_FIRST_LOG_DATE` (existant). | `__tests__/nutri-ux03-sql.test.ts` (SQLite réel) : bornes, suppression douce, ordre. |

Réutilisés sans changement : `copyMeal`, `duplicateDay`, `useMonthTotals`, `useDayMealPlan`,
`consumePlannedEntry`, `saveMealAsTemplate`, `useDailyCalorieTargets` (cible effective par jour et
`marginPct`).

## Étape 3 — Le journal sort de l'écran (refactor, aucun changement de comportement)

`app/(tabs)/nutrition.tsx` fait ~1 500 lignes ; la page d'un jour a besoin du même journal. Cette
étape passe **seule** dans un commit, tests de l'écran au vert, avant toute modification visible.

| Fichier (nouveau) | Contenu déplacé |
|---|---|
| `components/nutrition/journal/MealSection.tsx` | `MealSection` (mode dense seulement : le mode carte n'avait plus d'appelant). |
| `components/nutrition/journal/EntryDetailModal.tsx` | `EntryDetailModal` + `EntryDetailContent`. |
| `components/nutrition/journal/TrackedMicrosRecap.tsx` | `TrackedMicrosRecap`, `DayQualitySection`. |
| `hooks/useDayNutritionTargets.ts` | Objectif, TDEE, cible effective du jour, macros cibles (manuelles ou `trainingDayMacroGrams`), bonus. |

## Étape 4 — Composants et écrans

| Fichier | Rôle |
|---|---|
| `stores/nutrition-section-store.ts` | Onglet en mémoire (D3), jamais persisté. |
| `components/nutrition/NutritionHeader.tsx` | `PillarStage` : « Alimentation », icônes Planning / Bibliothèque / Réglages, onglets (`tablist`), et en enfant le remplissage sur Aujourd'hui (matière `FillLevel`). Remplace `NutritionStage.tsx` (supprimé avec son test). |
| `components/nutrition/NutritionLevel.tsx` | Le remplissage d'aujourd'hui (R2) : en-tête du jour, ligne du jour manquant, chiffre, statut, détail, « Pourquoi ? », tiges, ajouts rapides, « Chercher un aliment » + Scanner. |
| `components/nutrition/RepeatMealCard.tsx` | R3. |
| `components/nutrition/journal/DayJournal.tsx` | « Ta journée » pour aujourd'hui et pour un jour passé : sections, Autres, Comme hier (R4), repas prévus (R6), copie de la veille, eau, reprise d'un repas sur aujourd'hui (R10) ; détail d'entrée, suppression, réaffectation ; feuille de repas type (R5). |
| `components/nutrition/SaveTemplateSheet.tsx` | Nom obligatoire (R5). |
| `components/nutrition/LibrarySheet.tsx` | La Bibliothèque (§4.6). |
| `components/nutrition/NutritionCalendar.tsx` | R7 : verres par jour, flèches bornées, résumé, légende, TalkBack. |
| `components/nutrition/sections/TodaySection.tsx` · `HistorySection.tsx` · `ProgressSection.tsx` | Les trois onglets. |
| `app/(tabs)/nutrition.tsx` | L'écran réduit à l'assemblage : onglet (D3), `useScrollToTop` (D2), feuilles. |
| `app/nutrition-day.tsx` + `_layout.tsx` | La page d'un jour (R10), déclarée dans la pile (test `route-declarations`). |
| `app/nutrition-stats.tsx` | Paramètre `tab` (R12). |
| `app/food-picker.tsx` | Paramètre `tab` pour ouvrir Recettes / Repas types / Favoris depuis la Bibliothèque. |
| `components/dashboard/QuickActions.tsx` · `NowCard.tsx` · `WeightCard.tsx` | « Me peser » → `/nutrition-stats?tab=weight` (D13). |
| `components/nutrition/DayCalendarSheet.tsx` | **Supprimé** (plus d'appelant, D4). |

Tests Jest :

| Test | Vérifie |
|---|---|
| `app/(tabs)/__tests__/nutrition-screen.test.tsx` (réécrit) | Trois onglets, D3 (paramètre lu une fois, mémoire), `useScrollToTop` ; Aujourd'hui toujours aujourd'hui (plus de flèches) ; Reprendre (visible, masqué quand le repas est rempli, copie) ; Comme hier ; repas prévus et « J'ai mangé ça » ; menu ⋯ sans « Copier d'hier » ; nom de repas type obligatoire ; journal : suppression, détail, édition, réaffectation, orphelines, micros (tests existants conservés). |
| `components/nutrition/__tests__/NutritionCalendar.test.tsx` | Verres, statuts nommés, bornes des flèches, appui sur un jour. |
| `components/nutrition/__tests__/nutrition-history-section.test.tsx` | Liste des jours, repas habituels, Reprendre → « Ajouté ». |
| `components/nutrition/__tests__/nutrition-progress-section.test.tsx` | Cartes dans l'ordre, compte neuf. |
| `app/__tests__/nutrition-day.test.tsx` | Résumé, ajout sur ce jour, « Aujourd'hui » par repas, « Reprendre toute la journée » avec et sans alerte, date ≥ aujourd'hui renvoyée. |
| `components/nutrition/__tests__/SaveTemplateSheet.test.tsx` | Enregistrer inactif sans nom, nom rogné transmis. |
| `app/__tests__/nutrition-stats-tab.test.tsx` | `tab=weight` ouvre Poids. |
| Tests des portes « Me peser » | Paramètre `tab=weight`. |

## Étape 5 — Nettoyage et suivi

- Clés i18n devenues orphelines retirées (vérifiées par recherche) : `nutrition.week.tabToday` /
  `tabWeek`, `stage.nutrition.backToToday`, `journal.calendar.*`, `journal.copyYesterday`,
  `journal.nothingYesterday`, `journal.nothingYesterdayFull` — seulement si plus aucun lecteur.
- RECETTES §88, spec `etape: recette` et §11, roadmap 4.47, CHANGELOG, ETAT.
- Suppression du worktree une fois tout poussé.

## Ordre des commits

1. `docs(nutrition)` — cadrage : spec, plan, maquette, roadmap 4.47 (⬜).
2. `feat(nutrition)` — le socle : briques pures, requêtes, store, **et** le journal sorti de l'écran
   (étapes 1 à 3 en un commit ; l'extraction vérifiée par les tests existants, inchangés). 4.47 → 🟡.
3. `feat(nutrition)` — les trois onglets, la page d'un jour, la Bibliothèque, « Me peser » ; RECETTES
   §88 ; `etape: recette` ; roadmap 4.47 ✅.
