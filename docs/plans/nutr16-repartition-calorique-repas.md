# Plan — NUTR-16 · Répartition calorique par repas

Spec : [nutr16-repartition-calorique-repas.md](../specs/functional/us/nutr16-repartition-calorique-repas.md) ·
branche `feature/nutr16-repartition-repas` · roadmap **4.38**.

## Étape 1 — La requête et le calcul, purs et testés *(≈ 1 h)*

`apps/mobile/src/data/repositories/journal-repository.ts` — nouvelle requête sur le modèle exact de
`SELECT_DAILY_TOTALS` :

```sql
SELECT meal_type, SUM(kcal) AS kcal
FROM food_entries
WHERE deleted_at IS NULL AND log_date >= ?
GROUP BY meal_type
```

Plus le nombre de jours renseignés dans la fenêtre (réutilise `useDailyTotals(sinceDate).totals.length`
côté appelant — **pas une 2ᵉ requête**, l'écran a déjà cette donnée pour la carte « Apports moyens »).

`packages/shared/src/nutrition.ts` (même fichier que `resolveMealConfig`/`averageIntake` — même
famille de calcul) :

```ts
resolveMealSplit(
  mealTotals: { mealKey: string; kcal: number }[],
  configuredMeals: MealConfigItem[],
  loggedDays: number,
): { mealKey: string; label: string | null; pct: number; avgKcalPerDay: number }[]
```

- Distribue chaque `mealTotals` vers son repas configuré, ou vers un bucket `'other'` (spec R3) s'il
  n'a pas de correspondance dans `configuredMeals`.
- `label: null` pour les repas configurés (résolu côté UI comme aujourd'hui, `resolveMealConfig` +
  repli « Repas N ») ; `label` figé à la clé i18n `other` pour le bucket orphelin.
- `pct` arrondi, `avgKcalPerDay` arrondi.
- Ordre de sortie = ordre de `configuredMeals`, bucket `other` **en dernier** s'il existe (R4).
- `loggedDays === 0` ou aucun total → `[]` (R5, état vide géré côté UI).

**Tests, écrits d'abord** :
- 4 repas par défaut, totaux égaux → 4 lignes à 25 % chacune, somme des `pct` = 100 (à l'arrondi).
- Un repas configuré sans aucune entrée dans la fenêtre → **absent** du résultat (pas une ligne à
  0 %, qui alourdirait l'écran sans rien apporter — à confirmer en recette si Florian préfère
  l'inverse, cf. Risques).
- Des totaux existent sous une clé absente de `configuredMeals` → bucket `other`, **en dernier**,
  jamais mélangé aux repas configurés (R3/R4 — le test le plus important de cette étape).
- `loggedDays = 0` → `[]`, pas de division par zéro (R5).
- Repas personnalisé avec `label` non nul dans `configuredMeals` → propagé tel quel (pas de
  résolution i18n à ce niveau, c'est le rôle de l'UI comme aujourd'hui).

## Étape 2 — L'affichage *(≈ 1 h)*

- Nouvelle section « Répartition par repas » sur
  [nutrition-stats.tsx](../../apps/mobile/src/app/nutrition-stats.tsx), **sous** la carte « Apports
  moyens » existante — même `intakeRange` (7 j/30 j), pas un 2ᵉ toggle.
- Une ligne par repas : libellé (même résolution que le journal, `resolveMealConfig` + repli
  « Repas N » / `journal.meals.other` pour le bucket) + phrase `stats.mealSplit.row` (part % + kcal
  moyen/jour, R1).
- Bloc `accessible` unique par ligne (spec §6).
- État vide : réutilise `stats.intake.empty` si `totals.length === 0` (déjà calculé par l'écran pour
  la carte au-dessus — pas de nouvelle condition à dupliquer).

## Étape 3 — Solde *(≈ 20 min)*

Roadmap **4.38 → ✅**. CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `apps/mobile/src/data/repositories/journal-repository.ts` | `SELECT_MEAL_TOTALS` + `useMealTotals` |
| `packages/shared/src/nutrition.ts` (+ `.test.ts`) | `resolveMealSplit` |
| `apps/mobile/src/app/nutrition-stats.tsx` | nouvelle section |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | 2 clés `stats.mealSplit.*` |

## Migration / sync rules

**Aucune.** `food_entries`/`nutrition_profiles` déjà en base et synchronisés.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟠 **Le choix « repas sans entrée = absent, pas 0 % »** (étape 1) est un choix produit implicite,
  pas neutre — à confirmer explicitement en recette : un utilisateur qui saute toujours le
  petit-déjeuner pourrait vouloir le **voir à 0 %** plutôt que disparaître, pour visualiser l'écart.
- 🟢 **Aucun risque de ricochet** : lecture pure, aucune écriture, réutilise `resolveMealConfig` et
  le bucket « Autres » déjà éprouvés par le journal (pas une 2ᵉ implémentation qui pourrait diverger).
- 🟢 Le point dur de la spec (§0, `meal_type` n'est plus un enum fixe) est **résolu par construction**
  en groupant sur la valeur réelle plutôt que sur `MEAL_TYPES` — pas un risque résiduel une fois R2
  respectée.
