# Plan d'implémentation — APPORT-01

> Spec : [apport01-manger-comme-on-sentraine.md](../specs/functional/us/apport01-manger-comme-on-sentraine.md)
> Branche : `feature/apport01-manger-comme-on-sentraine` · Créée depuis `origin/dev` le 08/08/2026
> Lot de **4 analyses** du catalogue (MN-20, MN-16, MN-15, MN-10).

## 0. Ce que ce plan garantit d'emblée

| Question | Réponse |
|---|---|
| Migration base ? | ✅ **Non** — colonnes existantes uniquement (spec §5) |
| Sync rule / schéma local ? | ✅ **Non** |
| Dépendance native neuve ? | ✅ **Non** → **recettable sur l'APK existant** |
| Réseau / écriture ? | ✅ **Aucun** — lecture seule |
| Nombres inventés ? | **Un seul** : le facteur de « gros volume » (D3). Tous les autres calibrages sont **réutilisés** |

⚠️ **`nvm use 24`** avant toute commande de test. **`packages/shared` est à 100 %** : TDD strict.

**Ce lot ne réinvente presque rien, et c'est sa force.** `isTrainingDay`, `computeGoalAdherence`,
`computeCaloricBalance`, `resolveMealSplit` et `computeVolume` sont livrés. L'essentiel du travail est
**d'assembler correctement**, et l'essentiel du risque est d'**assembler en redéfinissant** au lieu de
réutiliser.

## 1. Ordre de build

**L'assemblage des jours d'abord** : les quatre analyses partent du même tableau « un jour = un
apport + un contexte d'entraînement ». Si cette structure est fausse, les quatre le sont.

```
Lot 1   Le type « jour croisé » + son assemblage    shared    la structure commune, D1 vit ici
Lot 2   MN-20 bilan énergétique séance vs repos     shared
Lot 3   MN-16 adhérence séance vs repos             shared    D2 — la marge de l'utilisateur
Lot 4   MN-15 disponibilité énergétique             shared    D3 — le seul nombre libre
Lot 5   MN-10 protéines fractionnées                shared    réutilise le groupement de NUTR-16
Lot 6   Les requêtes + le hook                      mobile
Lot 7   La section d'écran Nutrition                mobile
Lot 8   i18n FR + EN
Lot 9   Vérification + suivi
```

---

## Lot 1 — La structure commune

**Fichier neuf** : `packages/shared/src/training-nutrition-cross.ts` + test.

```ts
/** Un jour, vu des deux piliers à la fois. */
export type CrossDay = {
  dayKey: string;
  /** `null` = jour NON journalisé — distinct d'un jour à 0 kcal (spec R4). */
  kcal: number | null;
  proteinG: number | null;
  /** Cible effective du jour (bonus des jours de séance déjà appliqué par l'appelant). */
  effectiveTarget: number | null;
  /** 🔴 Vient de `isTrainingDay`, jamais recalculé ici (spec D1). */
  isTrainingDay: boolean;
  /** Volume muscu du jour (kg·reps), `0` s'il n'y a pas eu de séance de muscu. */
  strengthVolume: number;
};
```

🔴 **Le piège de conception du lot est ici** : `isTrainingDay` est un **booléen fourni**, pas quelque
chose que ce module dérive. Sa règle est non triviale (« séance terminée, OU planifiée si le jour est
aujourd'hui ou futur — le passé n'est jamais anticipé »), et la réécrire naïvement ferait diverger ce
lot de l'accueil et du calcul de cible. **Deux écrans diraient des choses contradictoires sur la même
journée**, chacun ayant l'air juste.

⚠️ **`kcal: null` ≠ `kcal: 0`.** Un jour sans entrée n'est pas un jour à zéro calorie. Un test le fige
sur chacun des quatre moteurs, parce que c'est l'erreur qui fausse tous les dénominateurs à la fois.

---

## Lot 2 — MN-20, bilan énergétique séance vs repos

```ts
export const MIN_DAYS_PER_GROUP = 3;

export type EnergyByDayType = {
  trainingAvgKcal: number;
  restAvgKcal: number;
  /** Écart signé : positif = on mange plus les jours de séance. */
  deltaKcal: number;
  trainingDays: number;
  restDays: number;
} | null;
```

🔴 **Le seuil porte sur CHAQUE groupe, pas sur le total** (spec R3) : 12 jours de repos et 1 de séance
ne font pas une comparaison. Un test l'exige explicitement — c'est l'erreur naturelle quand on écrit
`if (days.length < MIN)`.

| # | Cas | Attendu |
|---|---|---|
| 1 | Aucun jour | `null` |
| 2 | 3 séance / 2 repos | `null` — le seuil est **par groupe** |
| 3 | 3 / 3 | calculé |
| 4 | Plus mangé les jours de séance | `deltaKcal` **positif** |
| 5 | Moins mangé | `deltaKcal` **négatif**, jamais plafonné |
| 6 | Jours non journalisés (`kcal: null`) | exclus des deux moyennes **et** des compteurs |
| 7 | Tous non journalisés | `null` |

---

## Lot 3 — MN-16, adhérence séance vs repos

🔴 **La marge vient de l'appelant** (spec D2). Signature :

```ts
export function computeAdherenceByDayType(
  days: ReadonlyArray<CrossDay>,
  marginPct: number,   // ← `nutritionProfile.adherenceMarginPct ?? 10`, JAMAIS une constante d'ici
): { trainingPct: number; restPct: number; marginPct: number; ... } | null;
```

**Réutiliser `computeGoalAdherence`** sur chaque groupe plutôt que de refaire le calcul : c'est lui qui
définit « dans la cible », et deux définitions divergeraient au premier ajustement.

| # | Cas | Attendu |
|---|---|---|
| 1 | Marge 10 % vs marge 5 % sur les **mêmes** jours | taux **différents** — le test de D2 |
| 2 | La marge utilisée est **rendue** | la carte doit pouvoir l'afficher (R2) |
| 3 | Cible absente sur un jour | jour écarté, comme `computeGoalAdherence` |
| 4 | Seuil par groupe | `null` sous 3 de chaque |

---

## Lot 4 — MN-15, disponibilité énergétique

```ts
/** Facteur au-delà de la médiane personnelle qui fait un « gros volume ». SEUL nombre libre du lot. */
export const HIGH_VOLUME_MEDIAN_FACTOR = 1.25;
```

**Médiane et non moyenne** — raison déjà rencontrée sur `computeSessionDuration` (EXEC-01) : une
séance exceptionnelle tirerait la moyenne et rendrait toutes les autres « faibles ».

🔴 **MN-15 lit `strengthVolume`, PAS `isTrainingDay`** (spec D1). L'asymétrie avec les lots 2-3 est
délibérée : une course est un jour d'entraînement pour la cible calorique, mais elle ne produit aucun
volume muscu. Un test la fige — sinon une relecture « corrigera » par symétrie apparente.

| # | Cas | Attendu |
|---|---|---|
| 1 | Volume identique tous les jours | aucun jour au-dessus → `null`, pas un défaut |
| 2 | Un jour à 2× la médiane, apport bas | signalé, **avec son volume et son apport** |
| 3 | Un jour à 2× la médiane, apport correct | **non** signalé |
| 4 | 🔴 Jour de course sans muscu | `strengthVolume = 0` → jamais un « gros volume » |
| 5 | Jour de gros volume **non journalisé** | pas signalé — on ne sait pas ce qui a été mangé |

---

## Lot 5 — MN-10, protéines fractionnées

⚠️ **Réutiliser `resolveMealSplit`** (NUTR-16) pour le groupement et l'ordre : mêmes clés, même
`OTHER_MEAL_KEY` en dernier. Écrire un second groupement de repas ferait diverger deux écrans qui
parlent des mêmes repas.

```ts
/** Repère de littérature, AFFICHÉ et jamais prescrit (spec R7). Borne basse volontairement. */
export const PROTEIN_PER_SERVING_G_PER_KG = 0.3;
```

| # | Cas | Attendu |
|---|---|---|
| 1 | Aucune pesée (`bodyWeightKg` null) | `null` → l'écran affiche le **remède** (D4) |
| 2 | 140 g en 1 repas vs 4 repas | **nombre de prises** différent |
| 3 | Prise juste au repère | comptée (borne inclusive) |
| 4 | Repas hors configuration | rangé en `OTHER_MEAL_KEY`, **en dernier** |
| 5 | Un seul repas configuré | une prise — trivial mais valide |

---

## Lot 6 — Requêtes et hook

**Fichier modifié** : `journal-repository.ts` ou `dashboard-repository.ts` — 🔴 **à trancher en
ouvrant le code** : `dashboard-repository.ts` porte déjà `useIsTrainingDay`, `computeGoalAdherence` et
le calcul de cible effective. **Y brancher le lot évite de recâbler la cible une seconde fois** ; c'est
probablement le bon endroit, mais ça se vérifie avant d'écrire, pas après.

⚠️ **Ne pas recalculer la cible effective.** `dashboard-repository.ts:459` fait déjà
`trainingDayCalories(target, bonus)`. La refaire ici, c'est risquer qu'elle diverge le jour où le
bonus change de mode (`fixed` / `auto`, RN-02).

---

## Lot 7 — La section d'écran

**Fichier modifié** : `apps/mobile/src/app/nutrition-stats.tsx` (à confirmer — l'écran Nutrition
pertinent est à identifier avant d'écrire).

Section **conditionnelle et repliée**, patron d'`ExecutionSection` (EXEC-01) et de `StrengthSection` :
rend `null` quand les quatre se taisent → **un compte neuf ne voit rien de plus qu'avant**.

⚠️ **La carte protéines survit à l'absence de pesée** et affiche son **remède** avec l'accès pour
l'ajouter (D4). Ne pas se contenter de la masquer : ce serait laisser l'utilisateur ignorer à jamais
qu'il lui manque une donnée. Quatre tests l'ont exigé sur ALLURE-01 ; même exigence ici.

---

## Lot 8 — i18n

Clés du §6, FR + EN symétriques. Nombres formatés **avant** `t()`, via les formateurs existants.

## Lot 9 — Vérification

```bash
nvm use 24
npm run typecheck && npm run lint && npm run test:coverage
```

Codes de sortie **sans pipe**, **3 workspaces séparément**.

⚠️ **Relire la DoD item par item avant de la cocher.** Sur EXEC-01, cette relecture a trouvé un item
non tenu ; sur ALLURE-01, elle en a fait ajouter deux. Cocher sans relire, c'est transformer la DoD en
formalité.

Puis : catalogue (MN-20, MN-16, MN-15, MN-10 → ✅), CHANGELOG, front-matter, roadmap **4.40**,
RECETTES.md, ETAT.

## 2. Fichiers touchés

**Neufs** : `training-nutrition-cross.ts` (+ test) · le composant de section (+ test) · 1 test SQL

**Modifiés** : `packages/shared/src/index.ts` · un repository nutrition/dashboard (+ test) · l'écran
Nutrition · `i18n/locales/*.json` · catalogue · roadmap

**Non touchés, et c'est un résultat** : `insights.ts`, `insights-repository.ts`, le registre
d'accueil, `powersync/schema.ts`, `supabase/migrations/`, ADR-007.

## 3. Risques

| Risque | Parade |
|---|---|
| 🔴 **Redéfinir « jour d'entraînement »** au lieu d'utiliser `isTrainingDay` | Le booléen entre par le type ; test de l'asymétrie course / volume (lot 4, cas 4) |
| 🔴 **Inventer une marge ±10 %** au lieu de lire celle de l'utilisateur | Test du lot 3 cas 1 : deux marges, deux taux ; critère de recette 5 (cohérence avec l'accueil) |
| 🔴 **`kcal: 0` confondu avec « non journalisé »** → tous les dénominateurs faux | Type `number \| null` + un test sur chacun des 4 moteurs |
| **Seuil sur le total au lieu de par groupe** | Test du lot 2 cas 2, écrit pour échouer sur cette erreur |
| Recalculer la cible effective (divergence sur le bonus `auto`) | Réutiliser le calcul de `dashboard-repository.ts:459` |
| Second groupement de repas divergeant de NUTR-16 | Réutiliser `resolveMealSplit` et `OTHER_MEAL_KEY` |
| Carte protéines masquée sans le remède | D4 + critère de recette 8 |
| Affirmer une causalité (« ton déficit explique… ») | R5 : formulation descriptive, écart signé et chiffré |
| Conflit de merge sur l'écran Nutrition | Vérifier `git log` sur le fichier avant le lot 7 — Damien travaille sur les écrans à état |
