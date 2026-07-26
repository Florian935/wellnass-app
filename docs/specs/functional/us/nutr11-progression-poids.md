---
id: NUTR-11
titre: "Progression vers l'objectif de poids"
roadmap: []
catalogue: [NUTR-11]
etape: close
branche: feature/nutr11-progression-poids
maj: 16/07/2026
---
# US NUTR-11 — Progression vers l'objectif de poids

_Spec fonctionnelle. Statut : en validation (brainstorming Florian, 16/07/2026). Branche :
`feature/nutr11-progression-poids` (depuis `dev`). Analyse **NUTR-11** du
[catalogue](../../product/analyses-donnees.md), Phase A._

## 1. Contexte & objectif

L'écran **Stats nutrition** montre déjà, dans sa **section Poids**, la **dernière pesée + tendance**
(NUTR-06) et la **courbe de poids** (4.30) sur 4 sem / 3 mois / 1 an. Ces éléments décrivent la
trajectoire, mais **ne disent pas où on en est par rapport au but** : « combien du chemin ai-je
parcouru ? ».

NUTR-11 ajoute une carte **« Progression vers l'objectif de poids »** : un **pourcentage** (et les kg)
du chemin parcouru entre un **poids de départ figé** et un **poids cible** défini par l'utilisateur.
Objectif : donner un **cap chiffré et motivant**, valable aussi bien pour une **perte** que pour une
**prise** de poids.

## 2. Décisions de cadrage (Florian, 16/07/2026)
- **Poids de départ = poids au moment où l'objectif est défini** (on **fige** `start_weight_kg` en même
  temps que la cible) → % stable, indépendant de l'ajout de pesées antérieures. _(option A validée)_
- **Formule** : `progression = (départ − actuel) / (départ − cible)`, **bornée [0, 1]**, × 100. Le signe
  s'annule → marche identiquement pour perte (départ > cible) et prise (départ < cible).
- **Poids « actuel »** = **dernière pesée** `body_weight_entries` (repli `profiles.weight_kg`).
- **Dépassement** (au-delà de la cible) → **100 %** plafonné + **badge « 🎯 Objectif atteint »**.
- **Recul** (on s'éloigne du départ) → **plancher 0 %** (jamais de % négatif).
- **Pas de carte** si : **aucune cible** définie **ou** **départ = cible** (division par zéro — pas de
  progression à mesurer). _Note : les objectifs sont `muscle / weightloss / performance / health` — il
  n'existe pas d'objectif « maintenir » ; la carte ne dépend donc pas de `main_goal`, uniquement de la
  présence d'une cible ≠ départ._

## 3. Périmètre

- **Inclus** :
  - Migration : colonnes `profiles.target_weight_kg` + `profiles.start_weight_kg` (numeric, nullable).
    **Pas de sync rule à redéployer** (règle `select * from profiles` → les colonnes descendent au client).
  - Schéma client PowerSync (`profiles`) étendu des 2 colonnes.
  - Schéma `@wellness/shared` (`profile.ts`) + repository (`profile-repository.ts`) étendus.
  - Logique pure `computeWeightGoalProgress({ startKg, targetKg, currentKg })` (testée).
  - Hook `useWeightGoalProgress()` : compose profil (cible + départ) + dernière pesée.
  - **Écriture de la cible** : helper `setWeightTarget(targetKg | null)` qui **fige le départ** (§5.3).
  - Champ **« Poids cible »** dans l'écran **Profil** ([profile.tsx](../../../apps/mobile/src/app/profile.tsx)).
  - Carte **« Progression vers l'objectif de poids »** dans
    [nutrition-stats.tsx](../../../apps/mobile/src/app/nutrition-stats.tsx) (section Poids, après la courbe).
  - i18n FR + EN (parité).
- **Exclu (YAGNI)** :
  - **Widget dashboard** de la progression — carte Stats uniquement.
  - **Historique du %** dans le temps (courbe de progression) — une valeur instantanée.
  - **Projection de date d'atteinte** (ETA selon la tendance) — candidat futur.
  - **Cible en % de masse grasse** ou autre métrique — poids corporel (kg) seulement.
  - **Alerte / notification** sur atteinte de l'objectif — simple badge visuel.
- **Maquette** : écartée (carte alignée sur l'existant de Stats nutrition : valeur forte + barre de
  progression + sous-texte, comme les cartes NUTR-10 / NUTR-17). À confirmer à la validation.

## 4. Modèle de données

### 4.1 Migration `profiles.target_weight_kg` + `start_weight_kg`
```sql
alter table public.profiles
  add column if not exists target_weight_kg numeric check (target_weight_kg > 0),
  add column if not exists start_weight_kg  numeric check (start_weight_kg  > 0);
```
- Les deux **nullable, sans défaut** (un profil sans objectif de poids = les deux `null`).
- Garde-fou `> 0` (cohérent avec `weight_kg`).
- **Sync rule inchangée** (`select *`). `db:types` à régénérer. Checkpoint 🔴 (migration cloud).

### 4.2 Schéma client PowerSync (⚠️ étape critique — ne pas oublier)
`apps/mobile/src/powersync/schema.ts` déclare **chaque colonne explicitement** : une colonne
synchronisée mais **non déclarée** est téléchargée puis **ignorée** (le `select *` du repo ne la voit
pas). **Ajouter** au `Table profiles` :
```ts
target_weight_kg: column.real,
start_weight_kg: column.real,
```

### 4.3 Schéma partagé + repository
- `@wellness/shared` `profile.ts` : ajouter au `profileRowSchema` :
  - `targetWeightKg: z.number().positive().nullable().default(null)`
  - `startWeightKg: z.number().positive().nullable().default(null)`
- `profile-repository.ts` — mapping **manuel colonne par colonne**, 4 points à toucher :
  1. type `ProfileDbRow` (`target_weight_kg`, `start_weight_kg`) ;
  2. `rowToProfile` (`targetWeightKg: row.target_weight_kg`, idem start) ;
  3. `inputToColumns` (`target_weight_kg`, `start_weight_kg`) ;
  4. le `Pick` de `ProfileInput` (ajouter `targetWeightKg`, `startWeightKg`).

## 5. Calcul (logique)

### 5.1 `computeWeightGoalProgress` (fonction pure, testée) — dans `@wellness/shared`
Entrée : `{ startKg: number | null; targetKg: number | null; currentKg: number | null }`.
- Si `startKg`, `targetKg` **ou** `currentKg` est `null` → retourne **`null`** (rien à afficher).
- Si `startKg === targetKg` → retourne **`null`** (pas de progression mesurable, div/0 évitée).
- Sinon :
  - `progressRaw = (startKg − currentKg) / (startKg − targetKg)`
  - `ratio = clamp(progressRaw, 0, 1)` ; `pct = round(ratio × 100)`
  - `reached = progressRaw >= 1`
  - `totalKg = abs(startKg − targetKg)` ; `doneKg = ratio × totalKg` ; `remainingKg = totalKg − doneKg`
- Sortie : `{ pct, reached, startKg, targetKg, currentKg, totalKg, doneKg, remainingKg }`.

### 5.2 Hook `useWeightGoalProgress()` — dans `profile-repository.ts`
Compose (hooks **inconditionnels**) :
- `useProfile()` → `targetWeightKg`, `startWeightKg`, repli `weightKg` ;
- `useLatestWeight()` (bodyweight-repository) → `currentKg = latest?.weightKg ?? profile.weightKg`.
Puis délègue à `computeWeightGoalProgress`. Renvoie `{ progress: <résultat> | null, isLoading }`.
_(Emplacement `profile-repository.ts` : la donnée maîtresse est le profil ; l'import de
`useLatestWeight` ne crée pas de cycle — bodyweight-repository ne dépend pas du profil.)_

### 5.3 Figeage du départ — `setWeightTarget(targetKg: number | null)` (profile-repository)
Encapsule la règle de départ figé, appelé à l'enregistrement du champ « Poids cible » :
- Lit la cible actuelle (`profile.targetWeightKg`) et le **poids actuel** via un getter non-hook
  `getLatestWeightKg()` (à ajouter à bodyweight-repository : `powerSync.getOptional` de la dernière
  pesée ; repli `profile.weightKg`).
- **`targetKg === null`** → `upsertProfile({ targetWeightKg: null, startWeightKg: null })` (efface l'objectif).
- **cible nouvelle ou modifiée** (`targetKg !== profile.targetWeightKg`) →
  `upsertProfile({ targetWeightKg: targetKg, startWeightKg: poids_actuel })` (**ré-ancre le départ**).
- **cible inchangée** → **no-op** (ne pas ré-ancrer le départ pour un simple ré-enregistrement).

## 6. UI

### 6.1 Champ « Poids cible » (écran Profil)
- Dans [profile.tsx](../../../apps/mobile/src/app/profile.tsx), à côté du poids et de l'objectif : un
  `TextField` numérique « Poids cible » (unités respectées via `units`, métrique/impérial, même patron
  anti-drift `ref` que le champ poids existant).
- À l'enregistrement du profil, appeler `setWeightTarget(...)` (§5.3) avec la valeur parsée en kg
  (`units.parseWeightToKg`), ou `null` si le champ est vidé.

### 6.2 Carte « Progression vers l'objectif de poids » (Stats nutrition)
- Placée dans la **section Poids** de [nutrition-stats.tsx](../../../apps/mobile/src/app/nutrition-stats.tsx),
  **après la courbe de poids** (NUTR-06 / 4.30) et **avant** la section apports.
- Affiche : **`pct %`** en valeur forte + **barre de progression** ; sous-texte
  **« {done} sur {total} · reste {remaining} »** (kg formatés via `units.formatWeight`) ; **badge
  « 🎯 Objectif atteint »** si `reached`.
- **États** :
  - `progress === null` **et** aucune cible définie → **état vide** discret « Définis un objectif de
    poids » (invite, pas de graphe — principe 2.10) ;
  - `progress === null` pour une autre raison (départ = cible, données incomplètes) → **carte masquée**.
- Pas de graphique (barre de progression uniquement).

## 7. i18n (FR + EN, parité)
Namespace `stats.weightGoal.*` :
- `title` : « Progression vers l'objectif » / « Weight goal progress » ;
- `progress` : « {{done}} sur {{total}} » / « {{done}} of {{total}} » (valeurs déjà formatées avec unité) ;
- `remaining` : « reste {{remaining}} » / « {{remaining}} to go » ;
- `reached` : « 🎯 Objectif atteint » / « 🎯 Goal reached » ;
- `empty` : « Définis un objectif de poids » / « Set a weight goal ».
Champ profil : `profile.targetWeight` (« Poids cible » / « Target weight »).
Parité FR/EN vérifiée (0 clé orpheline ; double accolade i18next).

## 8. Cas limites
- **Aucune cible** → état vide « Définis un objectif de poids ».
- **Départ = cible** → carte masquée (pas de progression, pas de div/0).
- **Aucune pesée** (mais cible définie) → repli `currentKg = profile.weightKg` ; si lui-même `null`,
  `progress === null` → carte masquée.
- **Dépassement** (`progressRaw ≥ 1`) → 100 % + badge « Objectif atteint », `remainingKg = 0`.
- **Recul** (`progressRaw < 0`) → 0 %, `doneKg = 0`, `remainingKg = totalKg`.
- **Modification de la cible** → ré-ancre le départ sur le poids actuel (§5.3) → % repart de ~0.
- **Unités impériales** → tous les kg passent par `units.formatWeight` / `units.parseWeightToKg`.
- **Offline** : lecture/écriture 100 % locales (`useQuery` / `upsertProfile`) ; la cible se synchronise
  ensuite (colonnes descendues par le `select *`).

## 9. Tests
- **Shared (Vitest)** : `computeWeightGoalProgress` — perte (départ > cible), prise (départ < cible),
  à mi-chemin (50 %), atteint exact (100 %, `reached`), dépassement (plafond 100 %), recul (plancher 0 %),
  départ = cible → `null`, une des trois valeurs `null` → `null`, cohérence `doneKg + remainingKg = totalKg`.
- **Shared** : schéma `profileRowSchema` accepte / rejette (positif, nullable, défaut null) les 2 champs.
- **Mobile** : `typecheck` + `lint` verts ; rendu + figeage du départ vérifiés en recette device.

## 10. Definition of Done
- Migration `target_weight_kg` + `start_weight_kg` appliquée cloud + `db:types` (checkpoint 🔴, pas de
  sync rule) ; **colonnes déclarées dans `powersync/schema.ts`** ; schéma shared + repository (4 points)
  étendus.
- `computeWeightGoalProgress` (testée) + `useWeightGoalProgress` + `setWeightTarget` (figeage du départ) ;
  champ « Poids cible » dans le Profil ; carte Progression dans Stats nutrition (section Poids) ; i18n FR/EN.
- typecheck/lint/tests verts. **100 % client hormis la migration.**
- Catalogue NUTR-11 → ✅. Reste : recette device + relecture Damien.
