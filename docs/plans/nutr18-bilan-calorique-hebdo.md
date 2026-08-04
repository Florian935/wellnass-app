# Plan — NUTR-18 · Bilan calorique hebdomadaire

Spec : [nutr18-bilan-calorique-hebdo.md](../specs/functional/us/nutr18-bilan-calorique-hebdo.md) ·
branche `feature/nutr18-bilan-calorique-hebdo` · **aucune ligne roadmap** (US d'analyse, catalogue
seul).

✅ Décision D1 arbitrée par Florian le 04/08/2026 (spec §1) — suit le sélecteur 7j/30j existant,
implémentation ci-dessous conforme.

**Regroupement dans une carte existante (NUTR-10), pas une nouvelle carte** — réponse directe au
point de vigilance ADR-007 déjà noté pour cet écran. Périmètre comparable à MN-04/MUSC-12.

## Étape 1 — La fonction pure, testée d'abord *(≈ 30 min)*

`packages/shared/src/nutrition.ts` — juste après `computeGoalAdherence` (même voisinage, même
entrée `perDay`) :

```ts
/**
 * Bilan calorique cumulé (US NUTR-18, spec R1/R2) : somme signée des écarts (kcal − objectif
 * effectif) sur les jours loggés avec un objectif valide, + décompte binaire au-dessus/en dessous
 * (distinct de la marge de tolérance de `computeGoalAdherence`). Même filtre de jours exploitables
 * que `computeGoalAdherence` — pas de nouvelle convention.
 */
export function computeCaloricBalance(
  perDay: { kcal: number; effectiveTarget: number | null }[],
): { balanceKcal: number; daysAbove: number; daysBelow: number } {
  const days = perDay.filter(
    (d): d is { kcal: number; effectiveTarget: number } =>
      d.effectiveTarget != null && d.effectiveTarget > 0,
  );
  const balanceKcal = Math.round(
    days.reduce((sum, d) => sum + (d.kcal - d.effectiveTarget), 0),
  );
  const daysAbove = days.filter((d) => d.kcal > d.effectiveTarget).length;
  const daysBelow = days.filter((d) => d.kcal < d.effectiveTarget).length;
  return { balanceKcal, daysAbove, daysBelow };
}
```

**Tests, écrits d'abord** :
- Jours en surplus (`[{kcal:2200, effectiveTarget:2000}, {kcal:2100, effectiveTarget:2000}]`) →
  `balanceKcal: 300`, `daysAbove: 2`, `daysBelow: 0`.
- Jours en déficit → `balanceKcal` négatif, `daysBelow` > 0.
- Bilan exactement nul (`kcal === effectiveTarget` sur tous les jours) → `balanceKcal: 0`,
  `daysAbove: 0`, `daysBelow: 0` (égalité exacte ne compte ni dans l'un ni dans l'autre, spec R2 —
  le test qui aurait pu être oublié).
- Aucun jour avec `effectiveTarget` valide (`null` ou `<= 0`) → `{ balanceKcal: 0, daysAbove: 0,
  daysBelow: 0 }`.
- Mélange surplus/déficit → bilan net correct, `daysAbove` + `daysBelow` ≤ `perDay.length`.

## Étape 2 — Extension du hook + de la carte *(≈ 45 min)*

`apps/mobile/src/data/repositories/dashboard-repository.ts` — `useGoalAdherenceForRange` :
- `GoalAdherence` (type) : ajoute `balanceKcal: number`, `daysAbove: number`, `daysBelow: number`
  — purement additif, aucun champ existant retiré ni renommé.
- Corps de la fonction : `const { balanceKcal, daysAbove, daysBelow } =
  computeCaloricBalance(perDay);` juste après l'appel à `computeGoalAdherence` (même `perDay`,
  aucune requête supplémentaire), ajoutés à l'objet retourné.
- **Vérifier après coup** (typecheck + lecture) que `weekly-review-repository.ts` (2ᵉ consommateur,
  BILAN-01) compile sans changement de comportement — champs additifs, non consommés par ce
  fichier aujourd'hui.

`apps/mobile/src/app/nutrition-stats.tsx` — carte Adhérence (ligne ~205-225) : 2 `Text`
supplémentaires après la ligne `stats.adherence.margin` existante, dans la même branche
`adherence.loggedDays > 0` (spec R4 — pas de condition séparée, les mêmes garde-fous déjà en
place suffisent).

`apps/mobile/src/i18n/locales/{fr,en}.json` : 2 clés `stats.adherence.balance`/`.aboveBelow`.

**Pas de test de composant nouveau** : logique dans la fonction pure de l'étape 1 ; l'écran
assemble un résultat déjà correct, même discipline que MN-04/MUSC-12.

## Étape 3 — Catalogue & solde *(≈ 15 min)*

- `docs/product/analyses-donnees.md` : NUTR-18 🆕 → statut réel.
- **Pas de ligne roadmap** (front-matter `roadmap: []`).
- CHANGELOG + `etat.mjs` via `/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/nutrition.ts` (+ `.test.ts`) | `computeCaloricBalance` |
| `apps/mobile/src/data/repositories/dashboard-repository.ts` | `GoalAdherence` étendu |
| `apps/mobile/src/app/nutrition-stats.tsx` | 2 lignes ajoutées à la carte Adhérence |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | 2 clés `stats.adherence.*` |
| `docs/product/analyses-donnees.md` | NUTR-18 🆕 → statut réel |

## Migration / sync rules

**Aucune.** Calcul pur sur des données déjà chargées (`perDay`, existant).

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant**.

## Risques

- 🟠 **D1 non arbitrée** change potentiellement le comportement (fenêtre fixe vs sélecteur) — ne
  pas coder avant l'arbitrage.
- 🟢 **`GoalAdherence` étendu, pas modifié** : vérifier par typecheck que `weekly-review-repository.ts`
  (BILAN-01) compile sans changement — champs additifs uniquement, risque de régression minimal
  mais à confirmer explicitement (pas supposé).
- 🟢 **Aucun risque de ricochet sur `computeGoalAdherence`** : fonction existante non modifiée,
  seulement appelée à côté d'une nouvelle fonction sur le même `perDay`.
