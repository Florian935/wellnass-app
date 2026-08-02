---
id: NUTR-16
titre: "Répartition calorique par repas"
roadmap: [4.38]
catalogue: [NUTR-16]
etape: validation
branche: feature/nutr16-repartition-repas
maj: 02/08/2026
---

# US NUTR-16 — Répartition calorique par repas

> **Candidat du catalogue, jamais cadré.** `docs/product/analyses-donnees.md` le décrit en une
> ligne : « Part kcal/macros par repas », sur `food_entries` groupé par `mealType`. Cette spec pose
> ce qui manquait — en particulier un point technique qui invalide une lecture rapide du code
> (§0), et le choix entre « part en % » et « moyenne absolue » (les deux sont utiles, §2).

## 0. Un piège de lecture : `meal_type` n'est plus un enum fixe

`packages/shared/src/food.ts` définit `MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']` — **ce
n'est plus la contrainte réelle de la base.** La migration
[20260707140000_nutrition_meals.sql](../../../../supabase/migrations/20260707140000_nutrition_meals.sql)
a **retiré le `CHECK`** sur `food_entries.meal_type` pour permettre les repas personnalisés (item
4.15, `nutrition_profiles.meals` — renommer/ajouter/supprimer des repas, clé libre). `MEAL_TYPES`
reste correct comme liste des **4 clés par défaut**, mais **grouper par cette liste fixe ignorerait
les repas personnalisés** d'un utilisateur qui en a ajouté ou renommé.

**Conséquence directe** : cette US groupe par la **valeur réelle** de `meal_type` en base, puis
résout son libellé via `resolveMealConfig(nutritionProfile?.meals)` — exactement le mécanisme déjà
utilisé par le journal ([(tabs)/nutrition.tsx](../../../../apps/mobile/src/app/(tabs)/nutrition.tsx),
`mealList`/`orphanEntries`). **Aucune nouvelle logique de résolution de libellé à inventer.**

## 1. Ce qui existe déjà

- `food_entries.meal_type` (clé libre, voir §0), déjà indexé par jour.
- `resolveMealConfig` + le repli de libellé « repas custom sans nom → *Repas N*, pas sa clé
  technique » (déjà écrit, [(tabs)/nutrition.tsx:207-220](../../../../apps/mobile/src/app/(tabs)/nutrition.tsx#L207-L220)).
- Le bucket **« Autres »** (`journal.meals.other`) pour les entrées « orphelines » — un repas
  supprimé ou renommé après coup n'efface pas ses entrées passées, il les regroupe (même
  [(tabs)/nutrition.tsx:222-224](../../../../apps/mobile/src/app/(tabs)/nutrition.tsx#L222-L224)).
- L'écran [nutrition-stats.tsx](../../../../apps/mobile/src/app/nutrition-stats.tsx) — c'est là que
  ce bloc se monte, sous « Apports moyens » (4.31, même toggle 7 j / 30 j déjà en place).
- `useDailyTotals(sinceDate)` (journal-repository.ts) — modèle exact de la requête à écrire pour
  cette US, en remplaçant `GROUP BY log_date` par `GROUP BY meal_type`.

**Rien ne manque côté donnée. Aucune migration.**

## 2. Deux métriques, pas une — et pourquoi les deux

Le catalogue dit « Part kcal/macros par repas ». « Part » appelle un **pourcentage** (répartition de
l'apport total) ; mais un pourcentage seul ne dit pas si un dîner est *objectivement* trop lourd —
35 % d'une journée légère n'est pas le même problème que 35 % d'une journée déjà excessive.

**R1 — Chaque repas affiche sa part (%) ET sa moyenne absolue (kcal/jour).** Les deux se calculent
sur la même fenêtre (7 j ou 30 j, toggle déjà existant de l'écran).
- **Part (%)** = Σ kcal du repas sur la fenêtre / Σ kcal total sur la fenêtre × 100.
- **Moyenne (kcal/jour)** = Σ kcal du repas sur la fenêtre / nombre de **jours renseignés** dans la
  fenêtre (même diviseur que `averageIntake`, pas la longueur calendaire de la fenêtre — un jour non
  journalisé ne doit pas diluer la moyenne, convention déjà posée ailleurs sur cet écran).

**R2 — Grouper par la clé réelle, résoudre le libellé, jamais l'inverse (§0).** Ne pas grouper par
`MEAL_TYPES` (obsolète comme liste exhaustive).

**R3 — Les entrées orphelines (repas supprimé/renommé) rejoignent le bucket « Autres ».** Même
convention que le journal — pas une nouvelle règle, la même déjà appliquée à l'affichage jour par
jour.

**R4 — Ordre d'affichage = ordre de `resolveMealConfig`, pas un tri par part décroissante.** Un
utilisateur reconnaît « Petit-déjeuner, Déjeuner, Dîner, Collation » dans son ordre habituel ; un tri
par pourcentage réordonnerait la liste à chaque changement de fenêtre, ce qui rendrait la comparaison
7 j vs 30 j illisible.

**R5 — Aucune entrée dans la fenêtre → état vide**, pas un graphique à zéro ni une division par
zéro. Réutilise le texte déjà établi (`stats.intake.empty`) si le vide couvre toute la fenêtre.

## 3. Périmètre

**Dans le périmètre** :
- Nouvelle requête `SELECT_MEAL_TOTALS` (journal-repository.ts), sur le modèle de
  `SELECT_DAILY_TOTALS` : `GROUP BY meal_type` au lieu de `GROUP BY log_date`, même borne
  `log_date >= ?`.
- Fonction pure de résolution part/moyenne (packages/shared) : distribue les totaux par repas sur
  les repas configurés + le bucket Autres (R3), calcule % et moyenne (R1).
- Un bloc sur [nutrition-stats.tsx](../../../../apps/mobile/src/app/nutrition-stats.tsx), sous
  « Apports moyens », réutilisant le même toggle 7 j / 30 j déjà présent (pas un 2ᵉ sélecteur).

**Hors périmètre** :
- Les **macros par repas** (le catalogue les mentionne, « kcal/macros ») — **kcal seul dans cette
  US**. Ajouter protéines/glucides/lipides par repas triple le nombre de barres à afficher pour un
  gain de lecture incertain sur un premier jet ; à réévaluer une fois le bloc kcal validé en recette.
- Toute alerte automatique (« ton dîner est trop lourd ») — affichage informatif seulement, pas de
  seuil ni de jugement, même principe que RUN-14 (R6).

## 4. i18n

Nouvelle famille `stats.mealSplit.*`, FR + EN :
- `title` — « Répartition par repas » / « Meal breakdown ».
- `row` — phrase à variables : « {{pct}} % · {{kcal}} kcal/jour » (pas de concaténation, ordre des
  mots différent en EN : « {{kcal}} kcal/day · {{pct}}% »).
- `empty` — réutilise `stats.intake.empty` (aucune nouvelle clé si le texte convient tel quel).

Les libellés de repas eux-mêmes ne sont **pas** dupliqués : `journal.meals.*` (+ `meals.mealN`,
`journal.meals.other`) existent déjà et sont réutilisés tels quels (§0).

## 5. Comportement offline

**Total.** Lecture PowerSync locale, agrégation pure. Aucun réseau.

## 6. Accessibilité

Chaque ligne « repas » est un bloc `accessible` unique (libellé + part + moyenne) — pas trois
`Text` disjoints. Si un graphique en barres est retenu pour la forme visuelle (R1), chaque barre
porte le même contenu en `accessibilityLabel` : le graphique ne doit pas être le seul porteur de
l'information (même principe que le schéma corporel de MUSC-F1b, R5 de cette US-là).

## 7. Critères de recette

- [ ] 1. Journal avec les 4 repas par défaut renseignés → 4 lignes, part (%) + moyenne (kcal/j),
      dans l'ordre petit-déj/déjeuner/dîner/collation.
- [ ] 2. Un repas personnalisé renommé (ex. « Brunch ») → sa ligne affiche le libellé personnalisé,
      pas sa clé technique.
- [ ] 3. Des entrées existent sous un repas depuis supprimé de la config → elles apparaissent sous
      « Autres », pas perdues, pas sous leur ancienne clé technique (R3).
- [ ] 4. La somme des parts (%) des repas affichés ≈ 100 % (à l'arrondi près).
- [ ] 5. Bascule 7 j ↔ 30 j (toggle existant) → les deux métriques se recalculent pour chaque repas.
- [ ] 6. Aucune entrée dans la fenêtre → état vide, pas de graphique à zéro ni d'erreur.
- [ ] 7. **Mode avion** : le bloc s'affiche normalement (aucun réseau requis).
- [ ] 8. En **EN** : la phrase part/moyenne est grammaticale dans l'ordre anglais.
- [ ] 9. TalkBack énonce chaque ligne (ou barre) comme un bloc cohérent, pas des fragments disjoints.
