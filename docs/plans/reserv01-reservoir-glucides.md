# Plan — RESERV-01 · Le Réservoir

Spec : [reserv01-reservoir-glucides.md](../specs/functional/us/reserv01-reservoir-glucides.md) ·
18/09/2026 · travail direct sur `dev` (décision Florian).

## Ce qui existe déjà et qu'on ne réécrit pas

| Brique | Ce qu'elle donne | Où |
|---|---|---|
| `useEnergyItemsByDay()` (DEPENSE-01) | Les séances de chaque jour avec `startedAt`, `durationSeconds` et un `EnergyEstimate` (kcal **et MET**) | `energy-repository.ts` |
| `useDayEntries(date)` | Les entrées du journal d'un jour, avec `mealType` et `carbsG` | `journal-repository.ts` |
| `weightAtDate` (DEPENSE-01) | Le poids **à la date**, pas la dernière pesée | `packages/shared/src/bodyweight.ts` |
| `ExplainButton` / `ExplainSheet` (DASH-01) | La feuille « Pourquoi ? » et son niveau de confiance | `components/explain/` |

🔴 **Aucune dépense n'est recalculée.** Le Réservoir convertit en grammes ce que le moteur DEPENSE-01
a déjà estimé (spec D4). Deux estimations concurrentes de la même séance, c'est le défaut qui a coûté
l'US GARDE-01.

## Ordre de build

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | **Moteur pur** : capacité, courbe de la journée, projection, conseil de collation | `packages/shared/src/fuel-tank.ts` (+ `index.ts`) | `fuel-tank.test.ts` (Vitest) |
| 2 | **Explication** : `explainGlycogen` sur le patron de `explainEnergy` | `packages/shared/src/explain.ts` | cas dans `explain.test.ts` |
| 3 | **Assemblage** : repas + séances + poids → courbe du jour | `apps/mobile/src/data/repositories/fuel-repository.ts` | tests d'assemblage |
| 4 | **Carte** : jauge, courbe, action, « Pourquoi ? » | `components/nutrition/FuelTankCard.tsx`, branchée dans le pilier Nutrition | test de composant |
| 5 | **i18n FR + EN**, RECETTES §, front-matter, CHANGELOG, roadmap | — | parité i18n |

## Étape 1 — le moteur (TDD)

Simulation par pas de **5 minutes** sur 24 h (288 points) : assez fin pour placer un repas et une
séance, assez grossier pour coûter zéro. Pas de dépendance au temps réel — l'heure courante est une
**entrée**, jamais `Date.now()` (règle des modules purs du dépôt).

```ts
export const GLYCOGEN_G_PER_KG = 5;        // D1
export const START_OF_DAY_SHARE = 0.7;     // D2
export const ABSORPTION_G_PER_H = 60;      // R3
export const REST_DRAIN_G_PER_H = 4;       // R5
export const LOW_ZONE_SHARE = 0.3;         // R7
export const MEAL_HOURS = { breakfast: 8, lunch: 12.5, snack: 16.5, dinner: 20 };  // D3
export const CARB_SHARE_BY_MET = { low: 0.5, moderate: 0.65, high: 0.8 };          // R4

export function capacityG(weightKg: number | null): number | null;
export function carbShareForMet(met: number | null): number;
export function sessionCarbCostG(input: { kcal: number; met: number | null }): number;
export function simulateDay(input: { capacityG; meals; sessions; stepMin? }): FuelPoint[];
export function levelAt(curve: FuelPoint[], hour: number): number;
export function lowestBetween(curve, fromHour, toHour): FuelPoint;
export function snackAdviceG(input: { capacityG; meals; sessions; nextSession; atHour }): number | null;
```

Cas de test prévus : capacité `null` sans poids · seuils de part glucidique aux bornes MET · un repas
de 150 g s'étale (R3) · le niveau ne dépasse jamais la capacité et ne descend jamais sous 0 (R1) ·
une séance vide proportionnellement à sa durée · deux séances qui se chevauchent s'additionnent ·
la vidange de repos seule sur une journée sans rien · conseil de collation : multiple de 10, plafonné
à 120, `null` sans séance à venir, `null` si la projection reste au-dessus du seuil.

## Étape 3 — assemblage

`useFuelTank(dayKey)` : capacité (poids à la date), repas convertis en `(heure conventionnelle,
grammes)`, séances converties en `(heure de début, durée, kcal, MET)`, séances **planifiées** du
reste de la journée pour la projection. Rend `null` sans poids (R9) — la carte ne s'affiche pas.

## Étape 4 — carte

Jauge (pourcentage + grammes + mention « estimation »), courbe du jour avec la zone basse, action
quand la projection passe dessous, bouton « Pourquoi ? ». Équivalent textuel de la courbe pour
TalkBack (spec §9).

## Ce que le plan ne fait pas

Protéines et lipides (tranché le 15/09), nutrition intra-effort, heure réelle des repas
(`consumed_at` n'existe pas), et aucune modification des cibles du journal (MN-04 reste l'autorité).
