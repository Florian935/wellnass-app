# Plan d'implémentation — REPAS-01

> Spec : [repas01-planning-repas-liste-courses.md](../specs/functional/us/repas01-planning-repas-liste-courses.md)
> Branche : `feature/repas01-planning-repas-liste-courses` · Créée depuis `origin/dev` le 04/08/2026.

## 0. Principes de ce découpage

- **TDD systématique** : chaque lot commence par ses tests. La logique métier va dans
  `packages/shared` (couverture exigée **100 %**), le SQL dans un repository testé au **harness
  SQLite en mémoire** ([strategie-tests.md §3](../specs/technical/strategie-tests.md)), niveau 2.
- **Ordre imposé par les dépendances** : rien de la liste de courses ne peut être testé avant que le
  planning sache stocker une entrée. Les lots 1 → 4 livrent 4.27, les lots 5 → 7 livrent 4.28 puis 4.29.
- **Chaque lot est commitable seul** et laisse l'app fonctionnelle. Le lot 3 est le premier
  visible à l'écran ; les lots 1-2 sont invisibles mais testés.
- **Un incrément ne se déclare pas fini sans `npm run typecheck && npm run lint && npm run test`
  verts, code de sortie lu sans pipe** (un `| tail` renvoie 0 même sur échec — piège documenté).

⚠️ **Avant de lancer les tests : `nvm use 24`** (`.nvmrc` est passé à Node 24 pour `node:sqlite` ;
sur Node 20 la suite mobile échoue à l'import du harness sans dire pourquoi).

## 1. Lot 0 — Migration, sync rules, types

**Fichiers**
- `supabase/migrations/<horodaté>_meal_plan_shopping_list.sql` — les 3 tables (§2 de la spec),
  triggers `set_updated_at`, index partiels, `alter publication powersync add table`.
- `supabase/migrations/<horodaté>_meal_plan_shopping_list_rls.sql` — RLS `user_id = auth.uid()` en
  select/insert/update/delete sur les 3 tables (le dépôt sépare tables et RLS : voir
  `20260707130000` / `20260707130001`).
- `docs/specs/technical/powersync-sync-rules.yaml` — 3 tables ajoutées au bucket utilisateur.
- `apps/mobile/src/powersync/schema.ts` — schéma local (⚠️ **la panne du 31/07 sur CYCLE-01 venait
  d'une colonne absente ici** : écriture en échec, erreur avalée. Vérifier colonne par colonne.)
- `packages/shared/src/database.types.ts` — régénéré par `npm run db:types`.

**Index** : `meal_plan_entries (user_id, plan_date) where deleted_at is null`,
`shopping_list_items (list_id) where deleted_at is null`,
`shopping_lists (user_id, week_start_date) where deleted_at is null` (**index, pas contrainte
unique** — décision D6).

**Séquence** : `npm run db:new` → écrire le SQL → `npm run db:push:dry` → `npm run db:push` →
`npm run db:types` → cocher dans [supabase/MIGRATIONS.md](../../supabase/MIGRATIONS.md).

⚠️ **Sync rules PowerSync : étape manuelle** — coller le YAML dans le dashboard et déployer. Oubliée
deux fois (BIEN-01, RUN-F2c). **À faire dans le même créneau que la migration**, pas « plus tard » :
sans elle, tout ce qui suit paraît marcher en local et disparaît à la resynchro.

**Tests** : aucun (migration). Vérification = `db:push:dry` propre puis `db:types` sans diff inattendu.

## 2. Lot 1 — Briques pures (`packages/shared`)

Le cœur métier, entièrement testable sans device ni base.

**`packages/shared/src/meal-plan.ts`**

| Fonction | Contrat |
|---|---|
| `portionFactor(sourceType, servings, recipeServings)` | **R8** : `recipe` → `servings / max(1, recipeServings)` ; `template` → `servings`. |
| `sumPlannedDay(entries)` | Totaux kcal/P/G/L d'un jour depuis les snapshots. |
| `dayTargetKcal(profile, hasTrainingSession, pillarsActive)` | **R5** : compose `trainingDayCalories` existant ; renvoie `null` si pas de profil (→ ligne masquée, jamais 0). |
| `groupEntriesByMeal(entries, mealConfig)` | **R4/R10** : buckets dans l'ordre de la config, orphelins vers `OTHER_MEAL_KEY`. |
| `weekDayKeys(weekStartDate)` | 7 clés `AAAA-MM-JJ`, construites composant par composant (jamais `new Date('AAAA-MM-JJ')`). |

**`packages/shared/src/shopping-list.ts`**

| Fonction | Contrat |
|---|---|
| `normalizeIngredientName(name)` | **R9** : minuscules, accents retirés, espaces compactés. **Pas de stemming.** |
| `aggregateShoppingList(contributions)` | **R7/R8/R9** : agrège par `food_id ?? nom normalisé` ; somme les quantités **non nulles** ; compte séparément les contributions sans quantité (`unquantifiedCount`) ; **jamais `null` traité comme 0**. |
| `sortShoppingLines(lines)` | **R13** : ordre de rayon fixe puis alphabétique insensible casse/accents. Déterministe. |
| `formatShoppingListText(lines, opts)` | **D8** : texte brut partageable, en-tête daté, groupé par rayon. Libellés injectés (aucun `i18next` dans `shared`). |

**Tests** (`meal-plan.test.ts`, `shopping-list.test.ts`) — **écrits d'abord**. Cas obligatoires :

- `portionFactor` : recette 4 portions planifiée 2 → **0,5** ; `recipeServings = 0` ou absurde → garde
  à 1 (pas de division par zéro) ; template → `servings` tel quel.
- Agrégation : deux recettes partageant un `food_id` → 1 ligne sommée · même nom à casse/accents
  différents → 1 ligne · « tomate » vs « tomates » → **2 lignes** (R9, non-fusion assumée) ·
  contribution `quantity_g = null` seule → ligne à quantité nulle + `unquantifiedCount = 1` ·
  mélange quantifié + non quantifié → somme partielle **et** compteur ·
  **`null` jamais additionné comme 0** (test dédié, c'est le cas dangereux).
- Tri : les 9 rayons dans l'ordre R13, `other` en dernier ; alphabétique avec accents (`éclair` avant
  `endive`).
- `dayTargetKcal` : sans profil → `null` ; jour de séance piliers actifs → cible + bonus ;
  **piliers muscu et course inactifs → aucun bonus** (décision H).
- `weekDayKeys` : passage de mois, année bissextile, changement d'heure — aucun décalage.
- `formatShoppingListText` : ligne « sans quantité » lisible, aucun rayon vide, ordre stable.

**Sortie du lot** : `npx vitest run --coverage` sur `packages/shared` — **100 % sur les 2 fichiers
neufs** (la règle du paquet ; le cliquet global est déjà posé et la CI l'applique).

## 3. Lot 2 — Repository planning (`meal-plan-repository.ts`)

**Fichier** : `apps/mobile/src/data/repositories/meal-plan-repository.ts`

API, calquée sur `planned-session-repository` et `journal-repository` :

```
useWeekMealPlan(weekStartDate)   → { entries, isLoading }   // 1 requête, fenêtre de 7 jours
useDayMealPlan(dayKey)           → { entries, isLoading }
planRecipe(dayKey, mealKey, recipeId, servings)             // snapshot label + macros à l'écriture
planTemplate(dayKey, mealKey, templateId)
updatePlannedServings(id, servings)
removePlannedEntry(id)                                      // softDelete
duplicateWeek(fromWeekStart, toWeekStart)  → nombre copié   // D12
markPlannedEntryConsumed(id) / undoConsumed(id)             // R2/R3, lot 4
```

- Écritures **exclusivement** via `insertWithSyncFields` / `patch` / `softDelete` (`_sql.ts`).
- `isLoading` ne dépend **que** de la requête locale (offline-first).
- Snapshot des macros calculé à l'écriture depuis la recette/template **vivants**, une seule fois.

**Tests** : `__tests__/meal-plan-sql.test.ts` + `meal-plan-write.test.ts` (harness SQLite, copier
`journal-sql.test.ts`) — fenêtre de 7 jours inclusive aux deux bornes, `deleted_at` respecté,
`duplicateWeek` idempotent sur cible non vide (n'efface pas, ajoute — et le test le fixe),
snapshot bien figé quand la recette change après coup, `order_index` stable.

## 4. Lot 3 — Écran planning semaine (premier lot visible)

**Fichiers**
- `apps/mobile/src/app/meal-plan/_layout.tsx` + `index.tsx`
- `apps/mobile/src/app/_layout.tsx` — ⚠️ **ajouter `<Stack.Screen name="meal-plan" .../>`**. Le
  précédent PAS-01 : une route non déclarée ne casse **ni le typecheck ni les tests**, seul l'œil
  voit l'en-tête absent.
- `apps/mobile/src/app/(tabs)/nutrition.tsx` — **carte dédiée « Planning repas »** (P1 tranché par
  Florian le 04/08/2026 : le module est trop coûteux en saisie pour être caché).
- `apps/mobile/src/components/MealPlanDayCard.tsx` — un jour : repas configurés, entrées, total vs objectif.

Contenu : navigation ◀ ▶ (semaine ISO, lundi premier), 7 cartes, total planifié face à l'objectif du
jour, état vide invitant à planifier, feuille d'ajout (recette avec portions / repas type), action
« Dupliquer la semaine précédente » avec confirmation.

**Tests** : rendu (niveau 3) — semaine vide, semaine remplie, config de repas personnalisée,
profil absent (**ligne d'objectif masquée, pas 0**), entrée orpheline dans « Autre ».
Rendre **dans un `await act`** (idiome §3.6, copier `useAuthDeepLink.test.tsx`) — sinon les effets ne
tournent pas et le test n'assère que du statique.

## 5. Lot 4 — Porter au journal (R1/R2/R3)

Le lot le plus sensible : c'est là qu'on peut corrompre le pilier nutrition.

- Action « J'ai mangé ça » par entrée → crée les `food_entries` du jour/repas visés en réutilisant
  `applyTemplate` (repas type) et son équivalent recette, puis horodate `consumed_at`.
- Entrée déjà portée → état « porté au journal » + « Annuler » qui **supprime les lignes créées**.
- **Aucune écriture implicite** ailleurs.

**Tests** (harness, niveau 2) — les garde-fous, pas le confort :
- planifier **n'écrit rien** dans `food_entries` (assertion sur table vide) ;
- porter écrit dans le **bon jour et le bon repas**, avec les bonnes macros ;
- porter deux fois **ne double pas** les lignes (R3) ;
- annuler retire **exactement** les lignes créées, et rien d'autre du journal du jour ;
- les totaux du jour (`useDailyTotals`) ne bougent **qu'après** portage.

## 6. Lot 5 — Génération de la liste (`shopping-list-repository.ts`)

```
generateShoppingList(weekStartDate) → listId   // lit les ingrédients VIVANTS (R6)
useActiveShoppingList(weekStartDate)           // la plus récente par generated_at (D6)
useShoppingListItems(listId)
toggleShoppingItem(id, checked)
regenerateShoppingList(weekStartDate)          // soft-delete l'ancienne, avertit avant (cas limite)
```

Chaîne de génération : entrées de la semaine → jointure `recipe_ingredients` / `meal_template_items`
→ facteur `portionFactor` (R8) → `aggregateShoppingList` (R7/R9) → `sortShoppingLines` (R13) →
insertion des lignes matérialisées + compteur d'entrées non résolues (R11/R12).

**Tests** (harness) : recette supprimée → entrée comptée « non résolue », **exclue** des lignes ·
semaine vide → **aucune liste créée** · régénération → ancienne soft-deletée, nouvelle décochée ·
deux listes concurrentes → la plus récente est active (D6) · le facteur de portion arrive bien
jusqu'aux grammes en base (test bout-en-bout du calcul, R8).

## 7. Lot 6 — Écran liste de courses

`apps/mobile/src/app/meal-plan/shopping.tsx` + `components/ShoppingListRow.tsx`.

Lignes groupées par rayon (libellés `food.categories.*` **existants**), cases à cocher persistées,
en-tête de synthèse (repas couverts, entrées non résolues — R12), mention « + N sans quantité » (R7,
pluralisable), état vide, bouton « Régénérer » avec avertissement de perte des cases cochées.

**Cochage par rayon (D13, arbitrage Florian du 04/08/2026)** — l'en-tête de rayon devient un bouton :

- brique pure `aisleToggleAction(lines)` dans `shopping-list.ts` → `'check-all' | 'check-rest' | 'uncheck-all'`
  selon l'état du rayon (aucun / partiel / complet). **Testée unitairement**, y compris le rayon à un
  seul article et le rayon vide.
- `toggleAisle(listId, category, nextChecked)` dans le repository, **une seule transaction**.
- **Confirmation uniquement sur `uncheck-all`** (le geste destructeur). `check-rest` ne dé-coche
  jamais rien.
- `accessibilityRole="button"` + libellé « {rayon}, {n} sur {total} cochés » + action à venir.

**Tests** rendu : groupement et ordre, ligne sans quantité, ligne non résolue, état vide,
persistance du coché après remontage, et les **trois** transitions de D13 (dont l'annulation de la
confirmation qui ne dé-coche rien).

## 8. Lot 7 — Partage (4.29)

`Share.share()` de React Native (**aucune dépendance native → aucun nouveau build**, D8), texte
produit par `formatShoppingListText` avec les libellés de la langue active.

**Tests** : `Share.share` mocké — appelé avec le texte attendu ; échec/annulation **ne jette pas**
et ne laisse pas de spinner.

## 9. Lot 8 — Transverse (à faire, pas « si le temps le permet »)

- **i18n** : namespace `mealPlan.*` dans `fr.json` **et** `en.json` — les deux fichiers doivent
  rester de longueur identique. Zéro chaîne en dur (décision G).
- **Export RGPD** : les 3 tables dans `apps/mobile/src/lib/data-export.ts` (+ test de complétude —
  c'est ce test qui a rattrapé l'oubli de `session_intervals` le 03/08).
- **Accessibilité** : `accessibilityRole`/`Label`/`State` sur les cases du planning et les cases à
  cocher ; contrôle à police 1,5× sur la vue semaine (l'écran le plus dense) ; CONF-07 vient d'être
  livrée, ne pas rouvrir une dette juste refermée.
- **Suivi** : front-matter `etape:`, statut roadmap **4.27 / 4.28 / 4.29** (les 3 lignes sont
  aujourd'hui en section V1.1 — **à déplacer** dans le périmètre courant, arbitrage du 04/08/2026),
  CHANGELOG, `RECETTES.md` (les 22 critères), `node scripts/etat.mjs`. Le tout via `/commit`.
- **[alimentation.md §6](../specs/functional/alimentation.md#6-planning-repas)** : corriger les deux
  points périmés relevés au §0 de la spec (4 repas en dur, export PDF).

## 10. Ordre de build et jalons

| Jalon | Lots | Ce qui devient vrai |
|---|---|---|
| **J1** | 0 → 2 | Le planning se stocke et se synchronise. Rien à l'écran. |
| **J2** | 3 → 4 | **4.27 livrée** : planifier une semaine, porter au journal. Recettable. |
| **J3** | 5 → 6 | **4.28 livrée** : liste de courses cochable. |
| **J4** | 7 → 8 | **4.29 livrée** + transverse. US en recette. |

## 11. Risques

| Risque | Parade |
|---|---|
| **Sync rules oubliées** (déjà arrivé 2×) | Faite dans le même créneau que la migration, lot 0. Le planning ne survit pas à une resynchro sans elle. |
| **Colonne absente du schéma PowerSync local** (panne CYCLE-01 du 31/07) | Relecture colonne par colonne au lot 0 + un test d'écriture au harness par table. |
| **Snapshot vs vivant confondu** | Un test dédié par sens : macros figées (lot 2), ingrédients vivants (lot 5). |
| **`null` traité comme 0** dans l'agrégation | Test dédié au lot 1. C'est l'erreur qui produit des courses incomplètes sans le dire. |
| **Facteur de portion oublié** (R8) | Testé deux fois : unitairement (lot 1) et bout-en-bout jusqu'aux grammes en base (lot 5), plus le critère de recette 12. |
| **Écriture accidentelle dans le journal** | Assertion « table vide après planification » au lot 4. |
| Route non déclarée dans `_layout.tsx` | Rappelé au lot 3 ; invisible aux tests, visible à l'œil. |
