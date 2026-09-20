# Plan d'implémentation — US NUTRI-UX02

> Spec : [nutri-ux02-refonte-pilier-nutrition.md](../specs/functional/us/nutri-ux02-refonte-pilier-nutrition.md)
> Livré le 20/09/2026, directement sur `dev`, en un seul lot (demande de Florian).

## Ordre de build, et pourquoi celui-là

L'ordre suit le **risque croissant**, et non l'importance : chaque étape est vérifiable seule, et
une étape tardive qui dérape ne remet pas en cause les précédentes.

| # | Étape | Pourquoi à cette place |
|---|---|---|
| 1 | La couleur | Borné, mesurable, aucun changement de comportement. Le test-garde écrit ici sert de filet à tout le reste de la passe. |
| 2 | La recherche | Un hook neuf + une ligne changée dans l'écran. Testable sur du vrai SQLite, sans monter d'écran. |
| 3 | Les micronutriments | Une brique pure + une condition d'affichage. |
| 4 | Le bord sous la barre | Purement visuel, un composant partagé — donc à faire avant que d'autres écrans ne bougent. |
| 5 | L'onglet « La semaine » | Le plus gros gain perçu, mais il ne fait que **remonter** l'existant : aucun calcul neuf hors du verdict. |
| 6 | La carte « Ta journée » | Le plus risqué : il touche au swipe, aux menus et aux entrées orphelines. Fait en dernier, quand le reste est vert. |
| 7 | Le bandeau d'énergie | Deux lignes, dépendant du chiffre affiché par l'étape 6. |

## Étape 1 — La couleur (4 valeurs + 5 sur la scène)

Fichiers : `theme/pillar.ts`, `theme/colors.ts`, `theme/stage.ts`, `stores/menu-accent-store.ts`,
`components/lab/scene/LabScene2D.tsx`.

1. Mesurer avant de choisir — la chroma des cinq teintes source, puis le balayage de gain sur la
   teinte actuelle. C'est cette mesure qui montre qu'un gain seul ne suffit pas (plafond à 22).
2. Extraire `chroma()` dans `packages/shared/src/contrast.ts`, à côté de `tintPreservingLuminance`.
   🔴 La nommer **avant** de s'en servir : le dépôt avait déjà diagnostiqué ce défaut deux fois à la
   main, dans deux commentaires.
3. Poser les quatre valeurs, puis les cinq de la scène.
4. Écrire le test-garde. **Sans seuil arbitraire** : comparaison à la palette neutre.

⚠️ Ne PAS toucher `success` ni `chartGreen`, qui partagent l'ancienne valeur : rôles sémantiques
distincts.

## Étape 2 — La recherche

Fichiers : `data/repositories/food-repository.ts`, `app/food-picker.tsx`,
`components/nutrition/AddFoodSheet.tsx`, `components/nutrition/LibraryNotice.tsx`.

1. **Test d'abord** (`food-search-sql.test.ts`), sur le harnais SQLite réel : « saumon », le
   bornage, les débuts de nom avant la coupe, et le comptage `owner_id is null`.
2. Exporter la requête (`selectFoodSearch`) plutôt que seulement le hook — c'est le patron déjà en
   place pour `selectDenseFoods`, et c'est ce qui rend le SQL testable.
3. `useFoodSearch` rend le **même type** que `useFoods` : l'écran ne change que d'une ligne et garde
   ses favoris, ses badges et son menu d'édition.
4. `useLibraryPresence` + `LibraryNotice`, branchés sur **les deux** portes d'entrée.

⚠️ Piège rencontré : `COALESCE(tl.name, tfr.name)` et non l'alias `name` dans le `WHERE` — les deux
jointures de traduction portent une colonne `name`, SQLite refuse l'ambiguïté.

## Étape 3 — Les micronutriments

`countReportedMicros` dans `packages/shared/src/food.ts`, puis la condition dans
`TrackedMicrosRecap`. Compter, et non tester « l'agrégat est vide » : un zéro n'est trompeur que
lorsqu'il l'est partout.

## Étape 4 — Le bord sous la barre

`StageScrollView` : un `Animated.View` de 20 px sous la barre, partageant `headerStyle`. Opacité de
départ à 85 % pour ne pas remplir les coins arrondis — la raison est déjà documentée sur `spill`.

## Étape 5 — L'onglet « La semaine »

1. `week-verdict.ts` (brique pure) + ses 14 tests. Elle rend des **faits typés**, pas des phrases :
   l'écran traduit.
2. 🔴 Réutiliser `MIN_LOGGED_DAYS` de `bodyweight.ts`. Le dépôt en a déjà deux copies ; une
   troisième aurait garanti que deux écrans répondent un jour différemment à « ai-je assez de
   données ? ».
3. `WeekVerdictCard`, puis l'état d'onglet dans l'écran et les quatre cartes montées telles quelles.

## Étape 6 — La carte « Ta journée »

1. Prop `dense` sur `MealSection` : retire le cadre et le bouton texte, garde l'en-tête, le menu et
   **tout** le comportement des lignes.
2. Ajouter la barre de part (`dayKcal`).
3. Envelopper dans la carte, y compris la section « Autres ».

⚠️ Deux tests existants tombent **et c'est le signal attendu** : l'un comptait tous les libellés
« ajouter » de l'écran (trop large), l'autre validait une grille de micros sur un fixture vide.

## Étape 7 — Le bandeau d'énergie

Condition `items.length > 0` + variante chiffrée avec `trainingBonus`.

## Vérification

`npm run typecheck`, `npm run lint`, `npm run test` — ce dernier **sans pipe**, pour lire le vrai
code de sortie (le piège documenté dans CLAUDE.md).

## Hors-code, à faire par un humain

Vérifier et redéployer les sync rules PowerSync. Tout le constat 0 en dépend, et aucune ligne de
code ne peut s'y substituer.
