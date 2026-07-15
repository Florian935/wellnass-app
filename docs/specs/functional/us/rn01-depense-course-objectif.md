# US RN-01/RN-02 — Dépense calorique d'une course → objectif calorique du jour

_Spec fonctionnelle. Statut : validée (brainstorming du 15/07/2026, Florian). Branche :
`feature/rn01-depense-course-objectif` (depuis `dev`). Catalogue d'analyses : **RN-01** (dépense) +
**RN-02** (objectif ajusté) — croisement **Running ↔ Nutrition**, Phase A (déterministe, offline)._

## 1. Contexte & objectif

Aujourd'hui, l'objectif calorique d'un « jour d'entraînement » reçoit un **bonus forfaitaire fixe**
(`nutrition_profiles.trainingDayBonus`, saisi par l'utilisateur, tout-ou-rien, déclenché par une
séance muscu **ou** une course — via `trainingDayCalories(target, bonus)`). Ce forfait est **déconnecté
de la dépense réelle** d'une course (cf. catalogue RN-02).

**Objectif** : estimer la **dépense calorique d'une course** (RN-01) et permettre à l'objectif du jour
de **suivre cette dépense réelle** (RN-02), via un **réglage de mode** dans le profil nutritionnel :
- **« Forfait »** (défaut) : comportement **actuel inchangé** (bonus fixe).
- **« Auto »** : dynamique — un jour avec course(s) utilise la **dépense estimée** ; un jour muscu-seul
  retombe sur le **forfait** (repli) ; jour mixte = dépense course.

C'est le 2ᵉ croisement inter-piliers livré (après muscu↔nutrition / US 4.32), sur la paire
**running↔nutrition**. **100 % client, offline, gratuit.**

## 2. Périmètre

- **Inclus** : fonction pure `estimateRunCalories` (`@wellness/shared`, testée) ; helper pur de calcul
  du **bonus effectif du jour** selon le mode ; **migration** `nutrition_profiles.training_bonus_mode`
  (+ sync rule + `db:types`) ; **centralisation** du calcul de l'objectif effectif (aujourd'hui
  dupliqué) ; câblage du hook lecture (mode + poids + courses du jour) ; **sélecteur Forfait/Auto** dans
  l'écran profil nutritionnel ; adaptation du **badge** journal ; i18n FR/EN ; gating piliers.
- **Exclu** : estimation de dépense **muscu** (pas de modèle — la muscu garde le forfait) ; ventilation
  du bonus sur les **macros** (inchangé, comme aujourd'hui) ; RN-04 « calories nettes restantes après
  course » (widget dédié, ultérieur) ; anticipation d'une course **planifiée** (sans distance → pas
  d'estimation ; seules les courses **terminées** comptent) ; dénivelé (absent du modèle de données).
- **Maquette** : **écartée** (sélecteur + champ existant dans l'écran profil ; précédents 1.15, 8.5).
  À confirmer.

## 3. Formule d'estimation — `estimateRunCalories` (pure, testée)

**Modèle : NET + petit terme d'intensité borné** (décision Florian, 15/07/2026).

- **Base NET** ≈ coût énergétique net de la course à plat, ~**indépendant de l'allure** :
  `base = weightKg × distanceKm × NET_KCAL_PER_KG_KM` avec `NET_KCAL_PER_KG_KM = 1.0` (constante
  exportée, heuristique ajustable). « Net » = au-dessus du métabolisme de repos (déjà compté dans le
  TDEE de base — on n'ajoute que le surcoût réel).
- **Terme d'intensité (EPOC, petit et borné)** : les allures rapides coûtent un peu plus (afterburn).
  `intensityBonus = clamp((speedKmh − EASY_KMH) × PER_KMH_BONUS, 0, MAX_INTENSITY_BONUS)` avec
  `EASY_KMH = 8`, `PER_KMH_BONUS = 0.01` (1 %/km·h au-dessus de 8), `MAX_INTENSITY_BONUS = 0.10` (plafond
  +10 %). `speedKmh = distanceKm / (durationSeconds / 3600)`.
- **Résultat** : `kcal = Math.round(base × (1 + intensityBonus))`.

```ts
export const NET_KCAL_PER_KG_KM = 1.0;   // coût net course à plat (heuristique ajustable)
export const EASY_KMH = 8;               // seuil d'allure « facile »
export const PER_KMH_BONUS = 0.01;       // +1 % par km/h au-dessus de EASY_KMH
export const MAX_INTENSITY_BONUS = 0.10; // plafond +10 % (EPOC)

export function estimateRunCalories(params: {
  distanceM: number | null;
  durationSeconds: number | null;
  weightKg: number | null;
}): number;
```

Règles internes : si `distanceM`/`weightKg` manquants ou ≤ 0 → **0**. Si `durationSeconds`
manquant/≤ 0 → pas de terme d'intensité (base seule). Aucune I/O (pur).

> _Note : l'équation NET de course (type ACSM) est mathématiquement ~indépendante de l'allure (≈ 1
> kcal/kg/km) ; le terme d'intensité borné réintroduit volontairement une petite sensibilité à
> l'allure (EPOC), assumée comme heuristique — cf. échange de cadrage._

## 4. Bonus effectif du jour — helper pur

Centraliser la règle (aujourd'hui dupliquée) dans un helper pur testé, ex. dans `nutrition.ts` :

```ts
export type TrainingBonusMode = 'fixed' | 'auto';

/** Bonus calorique du jour à ajouter à la cible de base, selon le mode. */
export function dayCalorieBonus(params: {
  mode: TrainingBonusMode;
  isTrainingDay: boolean;      // séance muscu OU course (planifiée/faite) — logique existante
  fixedBonus: number;          // nutrition_profiles.trainingDayBonus
  runCaloriesToday: number;    // Σ estimateRunCalories des courses TERMINÉES du jour (0 si aucune)
}): number;
```

Règles :
- **`mode = 'fixed'`** : `isTrainingDay && fixedBonus > 0 ? fixedBonus : 0` (**comportement actuel,
  inchangé**).
- **`mode = 'auto'`** :
  - `runCaloriesToday > 0` (au moins une course terminée aujourd'hui) → **`runCaloriesToday`** (dépense
    réelle) ;
  - sinon, jour d'entraînement (muscu) → **`fixedBonus`** (repli) ;
  - sinon → **0**.
- L'objectif effectif reste `trainingDayCalories(baseTarget, bonus)` (fonction existante, `= base +
  max(0, bonus)`).

## 5. Migration (checkpoint 🔴)

- Nouvelle colonne `nutrition_profiles.training_bonus_mode text not null default 'fixed' check (…in
  ('fixed','auto'))`. **Défaut `'fixed'` → aucun changement de comportement pour l'existant.**
- Additive/rétrocompatible. **Vérifier la sync rule** PowerSync de `nutrition_profiles` : si elle
  sélectionne des colonnes explicites, ajouter `training_bonus_mode` (si `SELECT *`, rien à faire) —
  la colonne doit **descendre au client**. Régénérer **`db:types`**. Mettre à jour le schéma PowerSync
  local + le `nutritionProfileRowSchema` Zod (`nutrition.ts`) : `trainingBonusMode: z.enum(['fixed',
  'auto']).default('fixed')`.
- Appliquée par Florian (`db:push` + cocher [MIGRATIONS.md](../../../supabase/MIGRATIONS.md) +
  `db:types`).

## 6. Câblage (mobile) — centralisation

Le calcul de l'objectif effectif est **dupliqué** dans `useNutritionSummary` (dashboard-repository) et
dans l'écran journal (`nutrition.tsx`). **Le centraliser** (un hook/fonction unique) qui :
- lit le **mode** (`nutritionProfile.trainingBonusMode`), le **forfait** (`trainingDayBonus`), la
  cible **de base** (`target`), l'**état jour d'entraînement** (`useIsTrainingDay`), le **poids**
  (`useLatestWeight().latest?.weightKg ?? profile.weightKg` ; `latest` est un `WeightEntry` complet
  `{ id, logDate, weightKg }`), et les **courses terminées du jour**
  (`useRunHistory` filtré `finishedAt` → `localDayKey === dayKey`) ;
- calcule `runCaloriesToday = Σ estimateRunCalories(course)` puis
  `bonus = dayCalorieBonus({ mode, isTrainingDay, fixedBonus, runCaloriesToday })` ;
- expose `effectiveTarget`, `bonus`, et de quoi rendre le badge (mode + origine du bonus : course vs
  forfait). Les deux surfaces (dashboard + journal) consomment ce hook unique.
- **Gating** : la part **course** requiert **running + nutrition** activés ; si running inactif →
  `runCaloriesToday = 0` → en auto on retombe sur le forfait (muscu). Lecture seule.
- **Cas « pas de poids »** : `estimateRunCalories` renvoie 0 → en auto, jour de course sans poids →
  `runCaloriesToday = 0` → repli forfait. (Comportement sûr.)

## 7. UI profil — sélecteur Forfait / Auto

Dans `apps/mobile/src/app/nutrition-profile.tsx` : ajouter un **sélecteur** (composant réutilisable
`Segment`, `apps/mobile/src/components/Segment.tsx`) « Forfait / Auto » pour `trainingBonusMode`,
au-dessus du champ `trainingDayBonus` (~l. 184). Le **champ « bonus forfaitaire »** (`trainingDayBonus`) reste visible
(utilisé en Forfait, et comme **repli muscu** en Auto — libellé/aide à ajuster pour l'expliquer).
Écrit via `upsertNutritionProfile({ trainingBonusMode })`. i18n FR/EN.

## 8. Badge journal (et widget dashboard nutrition)

Adapter le badge « jour de séance » :
- **Auto + course du jour** → « +{kcal} kcal · course » (dépense estimée).
- **Sinon** (forfait / repli muscu) → « +{kcal} kcal · jour de séance » (texte actuel).
Clés i18n dédiées, FR/EN à parité.

## 9. Erreurs & cas limites

- Course sans distance / sans poids → dépense 0 (repli forfait en auto).
- Course sans durée → base NET seule (pas de terme d'intensité).
- Plusieurs courses le même jour → **somme** des dépenses.
- Course **planifiée** (non terminée) → **ignorée** (pas de distance réelle).
- Mode `auto` mais running inactif → repli forfait (muscu).
- Mode `fixed` → strictement le comportement actuel (non-régression à vérifier).
- **Offline** : 100 % local (courses, poids, profil) → fonctionne hors-ligne, réactif.

## 10. Tests

- **Shared (Vitest)** :
  - `estimateRunCalories` : 0 si distance/poids manquants ; base NET correcte (ex. 70 kg × 10 km ×
    1.0 = 700) ; terme d'intensité borné (allure facile → 0 % ; rapide → plafonné à +10 %) ; durée
    absente → base seule.
  - `dayCalorieBonus` : `fixed` = comportement actuel (isTrainingDay + fixedBonus) ; `auto` avec course
    → dépense course ; `auto` muscu-seul → repli forfait ; `auto` sans activité → 0 ; jour mixte →
    dépense course.
- **Mobile** : typecheck/lint/build verts ; hook I/O + rendu vérifiés à la recette device.

## 11. Definition of Done

- Réglage **Forfait/Auto** dans le profil ; en **Auto**, l'objectif du jour reflète la **dépense
  estimée des courses terminées** (badge « · course »), avec repli forfait pour la muscu ; en
  **Forfait**, comportement **inchangé**. Calcul **centralisé** (plus de duplication).
- Logique pure testée (`estimateRunCalories`, `dayCalorieBonus`) ; typecheck/lint/tests/build verts ;
  parité i18n FR/EN. Catalogue : **RN-01 & RN-02 → ✅** (dans cette branche).
- **Reste checkpoint 🔴 Florian** : `db:push` (colonne `training_bonus_mode`) + sync rule + `db:types`,
  puis **recette device** (Forfait = inchangé ; Auto : courir → objectif monte de la dépense estimée,
  badge « · course » ; jour muscu en auto → repli forfait ; plusieurs courses = somme ; sans poids →
  repli).
