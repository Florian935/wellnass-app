# US MN-06 — Apport protéique par kg de poids de corps (vs cible par objectif)

_Spec fonctionnelle. Statut : à valider (brainstorming du 16/07/2026, Florian). Branche :
`feature/mn06-proteines-par-kg` (depuis `dev`). Stat inter-piliers muscu↔nutrition (MN-06) du
[catalogue d'analyses](../../../product/analyses-donnees.md) — **déterministe, gratuite, offline, sans IA**._

## 1. Contexte & objectif

Le repère le plus parlant pour le pratiquant de musculation n'est pas les grammes bruts de protéines,
mais les **protéines rapportées au poids de corps (g/kg)**, comparées à une **fourchette cible selon
l'objectif**. Cette US répond à « **est-ce que je mange assez de protéines pour construire/préserver du
muscle, vu mon objectif ?** » — une lecture nutritionnelle simple et actionnable qui prolonge le socle
apports moyens (NUTR-05) et complète la vue croisée MN-03.

Version **volontairement simplifiée** vs le catalogue (qui évoque une cible dépendant du volume) : la
cible dépend **de l'objectif** (bulk/cut/maintain/weightloss), pas du volume muscu — plus simple, robuste
et suffisant. Aucune brique de cible protéique g/kg n'existe aujourd'hui : c'est le cœur à créer.

## 2. Périmètre

- **Inclus** : constante `PROTEIN_TARGETS_G_PER_KG` (fourchette g/kg par objectif) + fonction pure
  `computeProteinPerKg` dans `@wellness/shared` (testée) ; hook `useProteinPerKg(window)` (mobile,
  lecture seule) ; composant `ProteinPerKgCard` (valeur + statut + cible, bascule 7 j / 30 j) ; câblage
  dans [nutrition-stats.tsx](../../../apps/mobile/src/app/nutrition-stats.tsx) ; i18n FR/EN ; mise à jour
  du catalogue (MN-06 🆕 → ✅).
- **Exclu (YAGNI)** : lien au **volume muscu** (cible = objectif seul) ; **widget dashboard** ;
  **historique/courbe** g/kg dans le temps (→ future US) ; couche IA ; réglage manuel des fourchettes ;
  macros G/L (protéines seules).
- **Maquette** : **écartée** (carte simple réutilisant `Card` + `Segment`, précédents MN-03/4.32/8.5).
  À confirmer à la validation.

## 3. Règles métier

- **Surface** : section « Apport protéique / poids » sur **Nutrition → Stats**, sous les apports moyens.
  Pas de gating inter-piliers : l'écran est déjà propre au pilier Nutrition (onglet masqué si nutrition
  inactive) ; MN-06 n'utilise **pas** de données muscu.
- **Fenêtre** : bascule **7 j / 30 j** (même `Segment`/patron que les apports moyens `INTAKE_RANGES`).
- **Calcul** : `gPerKg = protéines moyennes/jour ÷ poids_kg`.
  - **Protéines moy/jour** = `averageIntake(totals).proteinG` sur les **jours loggés** de la fenêtre
    (jamais dilué par les jours vides) ; **`null` si 0 jour loggé**.
  - **Poids** = **dernière pesée** (`useLatestWeight`) → repli **`profiles.weight_kg`** → si aucun des
    deux : **empty state** (« ajoute une pesée pour voir ton ratio protéines/poids »).
- **Objectif** : `nutrition_profiles.objective` → repli `objectiveFromGoal(profiles.main_goal)` → défaut
  `maintain` (`objectiveFromGoal` renvoie toujours une valeur).
- **Fourchettes cibles** (`PROTEIN_TARGETS_G_PER_KG`, heuristiques documentées/ajustables) :

  | Objectif (`NutritionObjective`) | min | max |
  |---|---|---|
  | `bulk` (prise de masse) | 1,6 | 2,2 |
  | `maintain` (maintien) | 1,6 | 2,0 |
  | `cut` (sèche) | 1,8 | 2,4 |
  | `weightloss` (perte de poids) | 1,8 | 2,2 |

- **Statut** : `gPerKg < min` → **`low`** « insuffisant » (doré `#c9a96e`) · `min ≤ gPerKg ≤ max` →
  **`in`** « dans la cible » (accent thème) · `gPerKg > max` → **`high`** « élevé » (grisé `textMuted`).
  Mêmes couleurs neutres que l'équilibre muscu MN-05 ; **ton non-prescriptif** (décision H).
- **Arrondi** : `gPerKg` affiché à **1 décimale** (ex. « 1,8 g/kg »).

## 4. Logique partagée — `@wellness/shared` (pure, testée)

**Réutilise** : `NutritionObjective` (nutrition.ts). Nouveau fichier `protein-target.ts` (ou ajout à
`nutrition.ts` — à trancher au plan) :

```ts
export type ProteinTarget = { min: number; max: number }; // g/kg
export const PROTEIN_TARGETS_G_PER_KG: Record<NutritionObjective, ProteinTarget> = {
  bulk:       { min: 1.6, max: 2.2 },
  maintain:   { min: 1.6, max: 2.0 },
  cut:        { min: 1.8, max: 2.4 },
  weightloss: { min: 1.8, max: 2.2 },
};

export type ProteinPerKg = {
  gPerKg: number;            // arrondi 1 décimale
  target: ProteinTarget;
  status: 'low' | 'in' | 'high';
};

/**
 * Ratio protéines/poids et statut vs la cible de l'objectif (déterministe, pur).
 * Renvoie `null` si données insuffisantes (pas de poids, ou pas de protéines moyennes = 0 jour loggé).
 */
export function computeProteinPerKg(params: {
  avgProteinG: number | null;   // moyenne/jour loggé (null si 0 jour)
  weightKg: number | null;      // dernière pesée ou poids profil
  objective: NutritionObjective;
}): ProteinPerKg | null;
```

Règles internes : si `avgProteinG == null` **ou** `weightKg == null` **ou** `weightKg <= 0` → `null` ;
sinon `gPerKg = round(avgProteinG / weightKg, 1)`, `target = PROTEIN_TARGETS_G_PER_KG[objective]`,
`status = gPerKg < target.min ? 'low' : gPerKg > target.max ? 'high' : 'in'`. **Aucune I/O, aucun `Date`.**

> _Note précision : `averageIntake` arrondit déjà `proteinG` à l'entier (bodyweight.ts) — `avgProteinG`
> entrant est donc un entier. Acceptable et cohérent avec l'affichage existant de l'écran ; on ne
> recalcule pas depuis les grammes bruts._

## 5. Câblage — hook `useProteinPerKg` (mobile)

Repository : `nutrition-repository` ou `bodyweight-repository` (à trancher au plan). Lecture seule,
réactif. Tous les hooks appelés **inconditionnellement**.

- Fenêtre : `window: '7d' | '30d'` → `sinceKey = localDayKey(now − N j)` (patron `daysAgo` déjà présent
  dans `nutrition-stats.tsx` — à mutualiser).
- **Protéines** : `useDailyTotals(sinceKey)` → `totals: DailyTotal[]` (jours loggés) ;
  `avgProteinG = totals.length > 0 ? averageIntake(totals).proteinG : null` (`DailyTotal` porte
  `kcal/proteinG/carbsG/fatG`, compatible `Nutrients`).
- **Poids** : `useLatestWeight()` → `latest?.weightKg` ; repli `profile?.weightKg` (hook profil existant) ;
  sinon `null`.
- **Objectif** : `nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null)`
  (déjà fait ainsi dans `dashboard-repository.ts` — réutiliser le même patron).
- Renvoie `{ result: ProteinPerKg | null; hasWeight: boolean; isLoading: boolean }` (le `hasWeight`
  permet au composant de distinguer « pas de pesée » de « pas de repas loggés » pour l'empty state).

## 6. UI — `ProteinPerKgCard` (présentiel)

- `isLoading` → `ActivityIndicator`.
- Bascule **7 j / 30 j** (`Segment`, état local `window`).
- **Pas de poids** (`!hasWeight`) → empty state texte : `t('stats.protein.noWeight')` + éventuel CTA
  vers la pesée (réutiliser le champ pesée déjà présent sur l'écran).
- **Poids OK mais `result == null`** (0 jour loggé sur la fenêtre) → texte « — » / `t('stats.protein.noData')`.
- **Sinon** : valeur **« {gPerKg} g/kg »** en avant + **chip de statut** coloré
  (`low` doré / `in` accent / `high` grisé) avec libellé `t('stats.protein.status.<status>')` +
  sous-titre `t('stats.protein.target', { min, max, objective })` (ex. « cible 1,6–2,2 · prise de masse »).
- **Optionnel** (si simple) : petite barre horizontale avec la **zone cible surlignée** et un repère à
  `gPerKg` ; sinon s'en tenir à valeur + chip + sous-titre.
- **Couleurs de statut** : doré = **littéral `#c9a96e`** (repris tel quel de MN-05 `colorFor`,
  `progress/index.tsx` — la palette n'a pas de rôle « warning »/doré) ; `in` = `colors.accent`,
  `high` = `colors.textMuted` (via `useTheme`). Libellés d'objectif traduits ; aucune autre chaîne d'UI
  en dur (hors « — » et « g/kg »).
- S'insère dans `nutrition-stats.tsx` après la carte « Apports moyens » (et avant/après MN-03 — au choix,
  cohérence visuelle).

## 7. i18n (FR + EN, parité)

Namespace `stats.protein.*` : `title`, `perKgUnit` (« g/kg »), `target` (paramétré `{min}`/`{max}`/
`{objective}`), `status.low`/`status.in`/`status.high`, `noWeight`, `noData`, et libellés d'objectif
`objective.bulk`/`cut`/`maintain`/`weightloss` (FR : prise de masse / sèche / maintien / perte de poids).
Parité FR/EN vérifiée (diff manuel — pas de test de parité automatisé dans le repo).

## 8. Cas limites

- **Aucune pesée ni poids profil** → empty state « ajoute une pesée » (`result` non calculé).
- **Poids présent, 0 jour loggé** sur la fenêtre → `result == null` → « — »/message.
- **Objectif absent** → repli `objectiveFromGoal(mainGoal)` → défaut `maintain`.
- **`weightloss`** géré explicitement dans la table (ne pas retomber sur un défaut).
- **g/kg exactement sur une borne** → `in` (bornes incluses).
- **Offline** : 100 % local, réactif à toute nouvelle pesée ou saisie de repas.

## 9. Tests

- **Shared (Vitest)** `protein-target.test.ts` — `computeProteinPerKg` :
  - `null` si `weightKg` null/≤0, ou `avgProteinG` null ;
  - `gPerKg` = protéines ÷ poids, arrondi 1 décimale ;
  - statut `low`/`in`/`high` selon la fourchette de l'objectif (tester bulk **et** cut pour couvrir des
    bornes différentes ; bornes incluses = `in`) ;
  - `weightloss` mappé sur `{1.8, 2.2}` (pas de défaut silencieux).
- **Mobile** : `typecheck` + `lint` + `build` verts (hook I/O + rendu vérifiés à la recette device).

## 10. Definition of Done

- Section « Apport protéique / poids » sur Nutrition → Stats : g/kg (7 j/30 j) + statut coloré + cible
  par objectif ; empty states (pas de pesée / pas de repas) ; ton neutre.
- Logique pure testée dans `@wellness/shared` (constante + `computeProteinPerKg`) ;
  typecheck/lint/(build)/tests verts ; parité i18n FR/EN.
- Catalogue [analyses-donnees.md](../../../product/analyses-donnees.md) : MN-06 🆕 → ✅.
- **100 % client, offline — aucune migration, aucun cloud, aucune dépendance native (pas de checkpoint
  🔴).** Reste : **recette device** (g/kg cohérent, statut selon objectif, bascule 7 j/30 j, empty states
  pas de pesée / pas de repas) + relecture Damien.
