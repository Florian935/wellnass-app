# Plan — MUSC-F1b · Muscles ciblés sur schéma corporel (Voie B, anatomie fine)

Spec : [muscf1b-schema-muscles.md](../specs/functional/us/muscf1b-schema-muscles.md) · branche
`feature/muscf1b-schema-muscles` · roadmap **6.2**.

> ⛔ **Ne rien démarrer avant validation de la maquette** (spec §5, critère de recette 12) — les 11
> tracés doivent d'abord passer la relecture anatomique, sur le dessin, pas dans l'app codée.
> ✅ **Additif** : les 6 groupes larges (`musclePrimary`/`musclesSecondary`) ne bougent pas. Aucun des
> 18 fichiers qui les consomment aujourd'hui n'est touché (spec §0).

## Ordre de build

### Étape 1 — La colonne, la fonction pure, testées seules *(≈ 2 h)*

`packages/shared/src/exercise.ts` :
- `FINE_MUSCLES` (10 clés, spec §1), `fineMuscleSchema`, type `FineMuscle`.
- `exerciseRowSchema` gagne `musclesFine: z.array(fineMuscleSchema).default([])`.
- `normalizeFineMuscles(input)` — même patron que `normalizeSecondaryMuscles`, mais **sans**
  invariant d'exclusion du primaire (les muscles fins ne « contiennent » pas le primaire large, ce
  sont deux espaces distincts).
- `BROAD_TO_FINE: Record<MuscleGroup, FineMuscle[]>` (spec §2) — table de correspondance, exportée.
- `FINE_MUSCLE_VIEWS: Record<FineMuscle, ('front' | 'back')[]>` (spec §1) — pour que `BodyMap` sache
  quoi dessiner sur quelle vue.
- `resolveFineMuscles(exercise)` (spec §2) : signature exacte de la spec, `{ full, reduced }`.

**Tests** (`exercise.test.ts` ou nouveau `body-map.test.ts`, à décider en écrivant) :
- Exercice tagué fin → `full` = exactement `musclesFine`, `reduced` = `[]`.
- Exercice non tagué, primaire seul → `full` = l'expansion du primaire, `reduced` = `[]`.
- Exercice non tagué, primaire + secondaires → `reduced` = l'union des expansions des secondaires.
- `arms` → `full` contient **biceps et triceps** (le défaut assumé, spec §2) tant que non tagué.
- `legs` → `full` contient quadriceps, ischio-jambiers **et** mollets.
- Muscle fin invalide dans l'entrée brute → ignoré, pas d'exception (`normalizeFineMuscles`).

### Étape 2 — Migration + admin *(≈ 2 h)*

- `npm run db:new muscf1b_exercises_muscles_fine` → `alter table public.exercises add column
  muscles_fine jsonb not null default '[]'::jsonb` (symétrique à la migration
  `20260722140518_muscf10c1_exercises_muscles_secondary.sql`). `npm run db:push` puis coché dans
  [MIGRATIONS.md](../../supabase/MIGRATIONS.md). **Aucune sync rule à redéployer** — `exercises` est
  en `select *` (spec §3.1).
- `npm run db:types` — régénère `database.types.ts`.
- `apps/mobile/src/powersync/schema.ts` — déclare `muscles_fine: column.text` sur `exercises`
  (**leçon du 01/08/2026** : c'est exactement l'oubli qui a rendu le suivi du cycle inactivable —
  toute colonne absente ici échoue silencieusement à l'écriture).
- `apps/admin/src/screens/ExerciseEditScreen.tsx` — section « Muscles fins (optionnel) », 10
  checkboxes **groupées** par région (Haut du corps / Bas du corps / Tronc, spec §3.2) — copier le
  patron des checkboxes de muscles secondaires existant, adapté au groupement.
- `apps/admin/src/data/exercises.ts` — ré-exporte `FINE_MUSCLES`/`FineMuscle`, ajoute
  `muscles_fine` au payload de sauvegarde.
- `docs/specs/functional/administration.md` §3.3 — ne change pas de contenu (la taxonomie qu'il
  décrit est enfin implémentée), mais gagne une note pointant vers cette US.

### Étape 3 — `<BodyMap />`, les 11 tracés *(≈ 3-4 h)*

`apps/mobile/src/components/body/BodyMap.tsx` — composant **muet** :
`<BodyMap full={FineMuscle[]} reduced={FineMuscle[]} />`. Aucun accès repository.

- Deux `viewBox`, face et dos (R4), coordonnées reprises et affinées de la maquette
  (`design/muscf1b-schema-muscles/muscf1b-schema-muscles.html`) — **pas redessinées de zéro**, le
  travail de calage a déjà été fait et validé en maquette.
- 11 `<Path>` au total (5 face, 6 dos, spec §1 — épaules sur les deux).
- Développer avec une page de démo qui allume chaque muscle un par un, **puis** rejoue les 3 cas de
  la maquette (curl tagué / curl non tagué / bilan hebdo) pour comparer pixel-à-pixel avec le HTML
  validé.
- `accessibilityLabel` = `bodyMap.a11yLabel` (liste les muscles en toutes lettres) sur le SVG,
  `accessible={false}` sur les tracés internes.

### Étape 4 — Les trois points de montage *(≈ 2-3 h)*

Fiche d'exercice → aperçu de séance → bilan hebdomadaire, dans cet ordre (le premier valide le
composant seul avant de le brancher sur un agrégat).

- **Fiche** : `resolveFineMuscles(exercise)` directement.
- **Aperçu de séance** : union sur tous les exercices de la séance — `full` si présent dans le
  `full` d'au moins un exercice, sinon `reduced` si présent dans un `reduced`. Pas de somme.
- **Bilan hebdo** : remplace le calcul actuel (implicite, à vérifier en l'écrivant — la v1 de cette
  US n'avait jamais été codée) par une agrégation de tonnage **par muscle fin** (chaque exercice
  contribue son tonnage à tous les muscles de son `full ∪ reduced`), puis normalisation relative au
  maximum de la semaine (R3, inchangé en esprit).
- La **liste textuelle des muscles reste affichée** partout (R5) — jamais remplacée par le seul
  schéma.

### Étape 5 — Solde *(≈ 30 min)*

Roadmap 6.2 → ✅ (ou 🟡 si le tagging des 16 exercices n'a pas encore eu lieu — le code, lui, est
complet et fonctionne en repli, spec §10) · retrait du BACKLOG · CHANGELOG + `etat.mjs` via
`/commit`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `packages/shared/src/exercise.ts` (+ `.test.ts`) | `FINE_MUSCLES`, `resolveFineMuscles`, etc. |
| `supabase/migrations/<horodatage>_muscf1b_exercises_muscles_fine.sql` | **nouveau**, additif |
| `apps/mobile/src/powersync/schema.ts` | + colonne `muscles_fine` |
| `apps/admin/src/screens/ExerciseEditScreen.tsx` + `apps/admin/src/data/exercises.ts` | UI de saisie |
| `apps/mobile/src/components/body/BodyMap.tsx` | **nouveau** — les 11 tracés |
| fiche d'exercice · aperçu de séance · bilan hebdo | 3 points de montage |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `muscleFine.*` (10) + `bodyMap.*` (2) |

## Migration / sync rules

**Une migration additive** (colonne `jsonb`, défaut `'[]'`) — **aucune sync rule à redéployer**
(`exercises` est en `select *`). Contrairement à ce qu'annonçait la v1 de cette spec pour la voie B
(« nouvelle table + sync rules »), le design additif de ce recadrage évite les deux.

## Dépendances

`react-native-svg` **déjà présent**. Aucun paquet nouveau → **recettable sur l'APK existant**, une
fois la migration poussée.

## Hors plan — travail de coach

Le tagging des 16 exercices existants (`musclesFine` sur chacun) est **hors dev**, à faire par
Florian/Damien depuis l'écran admin une fois l'étape 2 livrée. Ne bloque ni le code, ni la recette
des critères 1/2 (spec §9-10).

## Risques

- 🔴 **La justesse anatomique des 11 tracés** (spec §5, critère 12) — atténué par la maquette
  produite et à valider **avant** cette étape de build, pas après.
- 🟠 **Contraste** du remplissage sur la silhouette (3:1, non textuel) — à vérifier contre la
  palette **issue de CONF-07** (D1/D2 de cette US, validées le 01/08/2026), pas l'ancienne.
- 🟢 Aucun risque de ricochet sur le code existant (§0) : additif, 6 groupes larges inchangés.
- 🟢 Aucun risque de données : le repli garantit un affichage sensé même à `musclesFine: []`.
