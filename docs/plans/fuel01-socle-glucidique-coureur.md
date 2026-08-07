# Plan d'implémentation — FUEL-01 (socle glucidique du coureur)

Catalogue **RN-05** + **RN-06** · Branche `feature/fuel01-socle-glucidique-coureur` · ~5 h estimées
Spec : [fuel01-socle-glucidique-coureur.md](../specs/functional/us/fuel01-socle-glucidique-coureur.md)

> **Aucune migration, aucune sync rule, aucune dépendance native, aucune table ni colonne neuve.**
> Vérifié le 07/08/2026 : toutes les données lues existent déjà en base et sont déjà synchronisées
> (`runs`, `planned_sessions`, `food_entries`, `body_weight_entries`, `nutrition_profiles`, `profiles`).
> → **Rien à pousser sur le cloud, rien à coller dans le dashboard PowerSync, recettable sur l'APK
> existant.** C'est la conséquence directe de la décision D1 (indicateur descriptif) : une US qui ne
> fait que lire ne touche pas au schéma.

## 0. Ordre de build, et pourquoi celui-là

Le lot 1 (briques pures) est **entièrement indépendant** de l'UI et se teste sans monter un écran.
Le lot 4 (l'extension de carte) est le seul qui touche du code **appartenant à une US en recette**
(MN-06) : il passe en dernier, quand tout le reste est vert, pour limiter la fenêtre de régression.

| Lot | Contenu | Dépend de |
|---|---|---|
| 1 | Briques pures `packages/shared` | — |
| 2 | Classement de journée (RN-06) | 1 (types partagés) |
| 3 | Hook de lecture | 1, 2 |
| 4 | Carte + i18n | 3 |
| 5 | Garde-fou de non-régression MN-04 | 1 |

## 1. Lot 1 — briques pures (TDD, `packages/shared/src/carb-target.ts`)

Nouveau fichier, **calqué sur [protein-target.ts](../../packages/shared/src/protein-target.ts)**
(40 lignes) : même forme de constante, même signature de fonction, mêmes bornes incluses, même statut
3 états. On ne réinvente pas un patron validé.

```ts
export type CarbLoadLevel = 'light' | 'moderate' | 'high';
export type CarbTarget = { min: number; max: number };          // g/kg

export const CARB_LOAD_THRESHOLDS_H = { moderate: 3, high: 6 }; // R2 — bornes basses INCLUSES
export const CARB_TARGETS_G_PER_KG: Record<CarbLoadLevel, CarbTarget> = {
  light:    { min: 3, max: 5 },
  moderate: { min: 5, max: 7 },
  high:     { min: 7, max: 10 },
};

export function computeCarbLoadLevel(totalRunDurationSeconds: number): CarbLoadLevel | null;
export function computeCarbsPerKg(params: {
  avgCarbsG: number | null;
  weightKg: number | null;
  level: CarbLoadLevel;
}): CarbsPerKg | null;   // { gPerKg, target, status: 'low' | 'in' | 'high' }
```

**Décision de conception** : `CARB_LOAD_THRESHOLDS_H` et `CARB_TARGETS_G_PER_KG` sont **exportées et
nommées**, pas enfouies dans une condition — c'est ce qui rend le critère de recette 9 (relecture par
un pratiquant) praticable, et ce qui permettra d'ajuster un seuil sans relire la logique. Même
intention que `OVERTRAINING_LOAD_STREAK_DAYS` ou le seuil de 8 séries de COLLIS-01.

**Tests (attendus ~14)** — écrits **avant** :
- les 3 niveaux, et les **deux bornes exactes** (3 h → `moderate`, 6 h → `high`) ;
- `0` seconde → `null` (pas de niveau `rest` affichable, §2 condition 3) ;
- durée négative ou `NaN` → `null` (défensif, jamais un niveau au hasard) ;
- statut : sous la borne min → `low`, sur la borne min → `in`, sur la borne max → `in`, au-dessus →
  `high` (les 4 cas, bornes incluses — c'est là que `computeProteinPerKg` a ses tests, on les
  reproduit) ;
- `weightKg` `null`, `0` ou négatif → `null` ; `avgCarbsG` `null` → `null` ;
- arrondi à 1 décimale.

⚠️ **Aucun `Date.now()`, aucun `new Date()` sans argument** dans ce fichier : `packages/shared` est
pur et le cliquet de couverture y est à 100 % instructions/fonctions/lignes.

## 2. Lot 2 — classement de journée (RN-06)

Même fichier ou `running-paces.ts` selon où le type de séance est déjà manipulé — **à trancher au
code**, la règle étant de ne pas créer un 3ᵉ endroit qui connaît `SESSION_TYPES`.

```ts
export type RunningDayKind = 'hard' | 'easy' | 'rest' | 'unavailable';
export function classifyRunningDay(plannedSessionTypes: ReadonlyArray<SessionType>): RunningDayKind;
```

Règle (spec R5) : `fractionne` | `sortie_longue` → `hard` · `endurance` | `recuperation` → `easy` ·
tableau vide → `rest` · `course_libre` présent → `unavailable`.

**Tests (~8)** : les 4 types de programme, le tableau vide, `course_libre` seul, et surtout
**`['fractionne', 'endurance']` → `hard`** (le plus exigeant gagne, spec §9) et
**`['course_libre', 'endurance']` → `unavailable`** (l'inconnu contamine : on ne peut pas affirmer
« journée facile » quand une des deux séances est de type inconnu).

## 3. Lot 3 — hook `useCarbsPerKg` (`nutrition-repository.ts`)

Cloné sur `useProteinPerKg`, **au même endroit** (le fichier porte déjà les hooks de cet écran).

Reprend **verbatim** l'accès au poids de MN-06 :
`const weightKg = latest?.weightKg ?? profile?.weightKg ?? null` — ne pas réinventer le repli, il est
déjà arbitré.

À assembler :
1. `resolveActivePillars` → `running` **et** `nutrition` actifs, sinon retour masqué (jamais de calcul
   inutile) ;
2. fenêtre **7 jours glissants** `[todayKey − 6 ; todayKey]` en `localDayKey` (R6). ⚠️ **Ne pas
   utiliser `aggregateRunStats(period:'week')`** : elle est **calendaire** (lundi→dimanche,
   [run-stats.ts:33](../../packages/shared/src/run-stats.ts)) et ferait chuter la charge chaque lundi.
   Filtrer les `runs` sur `finished_at` dans la fenêtre, sommer `duration_seconds` (`null` → 0) ;
3. `averageIntake` sur les `food_entries` de la fenêtre → `carbsG` moyen des **jours loggés** (R7) ;
4. `classifyRunningDay` sur les `planned_sessions` **du jour** ;
5. `computeCarbLoadLevel` → `computeCarbsPerKg`.

Retour : `{ result, level, dayKind, hasWeight, isLoading }` — même forme que `useProteinPerKg`, pour
que la carte consomme les deux identiquement.

**Tests (~6)**, patron des tests de repository existants (SQL en mémoire) : gating 2 piliers, fenêtre
glissante (une course à J-6 compte, une à J-7 non — **le test qui protège R6**), poids absent, aucun
jour loggé, course sans durée.

## 4. Lot 4 — carte « Macros par kg » + i18n

[ProteinPerKgCard.tsx](../../apps/mobile/src/components/ProteinPerKgCard.tsx) → titre « Macros par
kg », **ligne protéines strictement inchangée**, ligne glucides ajoutée en dessous, rendue seulement
si `result != null` (les 4 conditions du §2 de la spec sont déjà résolues par le hook).

⚠️ **Ce composant appartient à MN-06, qui est en recette** ([RECETTES.md](../../RECETTES.md) — MN-06
est `close`, mais la carte est aussi lue par les critères de NUTR-10/NUTR-18 sur le même écran).
Règle : **ne toucher à la ligne protéines ni à ses clés i18n sous aucun prétexte** ; on ajoute, on ne
réorganise pas. Un renommage de clé ferait échouer une recette en attente pour une raison étrangère à
son code — la panne exacte que RECETTES.md documente déjà 8 fois.

Le fichier n'étant pas renommé, **aucun import à mettre à jour** (le nom de composant reste
`ProteinPerKgCard` ; seul le libellé affiché change). Un renommage de fichier serait du bruit de diff
sur une US en recette.

i18n : famille `stats.macrosPerKg.*` (tableau §6 de la spec) dans
`apps/mobile/src/i18n/locales/{fr,en}.json`. **Les clés protéines existantes ne bougent pas.**

**Tests (~4)** : ligne glucides rendue quand le hook renvoie un résultat, **absente** quand il renvoie
`null`, ligne protéines toujours rendue dans les deux cas (**test de non-régression MN-06**), et label
d'accessibilité composé en un seul bloc.

## 5. Lot 5 — garde-fou de non-régression MN-04 (spec R1)

Un test dédié, dans les tests de `nutrition.ts` :

> `trainingDayMacroGrams` produit exactement les mêmes grammes avant et après FUEL-01, et aucun module
> de `carb-target.ts` n'est importé par `nutrition.ts`.

Patron : l'assertion de CI de REPAS-01 qui interdit au planning d'écrire dans `food_entries` (règle
R1 de sa spec). **Cette assertion est le livrable le plus important du lot** : elle transforme la
décision D1 en contrainte de code. Si un jour quelqu'un branche la cible glucides sur le g/kg, le test
tombe et rappelle pourquoi c'est interdit — au lieu de laisser deux cibles concurrentes s'installer
comme dans le §0 de la spec.

## 6. Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/carb-target.ts` (+ `.test.ts`) | **neuf** — briques pures |
| `packages/shared/src/index.ts` | +1 ligne `export * from './carb-target'` |
| `packages/shared/src/running-paces.ts` (+ test) | `classifyRunningDay` (si c'est là qu'il atterrit) |
| `packages/shared/src/nutrition.test.ts` | +1 test de non-régression (lot 5) |
| `apps/mobile/src/data/repositories/nutrition-repository.ts` (+ test) | `useCarbsPerKg` |
| `apps/mobile/src/components/ProteinPerKgCard.tsx` (+ test) | ligne glucides, titre |
| `apps/mobile/src/i18n/locales/fr.json`, `en.json` | famille `stats.macrosPerKg.*` |
| `docs/product/analyses-donnees.md` | RN-05 + RN-06 🆕 → ✅ |
| `RECETTES.md` | section §50 (14 critères de la spec §11) |
| `CHANGELOG.md`, `ETAT.md` | tenus par `/commit` |

**Ne sont PAS touchés, et c'est le cœur du contrat** : `nutrition.ts` (`trainingDayMacroGrams`,
`macroGramsFromCalories`, `defaultMacroRatios`), `(tabs)/nutrition.tsx`, `NutritionSummaryCard.tsx`,
`useDayCalorieTarget`. Aucune cible affichée ne change.

## 7. Risques identifiés

| Risque | Parade |
|---|---|
| 🔴 **Deux cibles glucides concurrentes** (le défaut du §0 de la spec) | D1 + R1 + l'assertion du lot 5. C'est la raison d'être de ce découpage |
| 🔴 **Casser la recette de MN-04** (critère 5 : les 3 barres totalisent les kcal) | On ne touche pas à la cible ; critère de recette 6 dédié, en rouge |
| 🟠 Faire régresser la ligne protéines de MN-06 en éditant sa carte | Test de non-régression au lot 4 ; aucune clé i18n existante renommée |
| 🟠 Fenêtre calendaire prise par erreur pour glissante | Test « J-6 compte, J-7 non » au lot 3 ; commentaire sur place citant `run-stats.ts:33` |
| 🟠 **Seuils faux mais plausibles** (leçon DOTS) | Constantes exportées et nommées + critère de recette 9 (relecture par un pratiquant) |
| 🟢 Écran Stats nutrition déjà à 8 blocs | D2 : zéro bloc ajouté, on étend une carte (précédent NUTR-18) |

## 8. Vérifications avant `/commit`

- `npm run lint`, `npm run typecheck`, `npm run test` — **codes de sortie lus sans pipe** (un `tail`
  en aval renvoie 0 même sur un test rouge).
- Couverture `packages/shared` : le cliquet est à **100 %** instructions/fonctions/lignes et 97 %
  branches — un fichier neuf non couvert **fait échouer la CI**.
- Catalogue mis à jour (RN-05, RN-06), **aucune ligne de roadmap créée** (US d'analyse).
- Section §50 ajoutée à `RECETTES.md`.
