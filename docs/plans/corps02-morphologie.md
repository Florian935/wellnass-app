# CORPS-02 — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Permettre de personnaliser une silhouette, comparer une intention et sauvegarder les deux hors-ligne.
**Architecture:** Document métier pur partagé, colonne JSON personnelle existante via repository dédié, renderer paramétrique pur, écran à brouillon local.
**Tech Stack:** Expo57 / React Native, SVG, PowerSync, Supabase, Zod, Gesture Handler / Reanimated existants.
**Spec:** docs/specs/functional/us/corps02-morphologie.md

## Global Constraints

- FR/EN, clair/sombre, Android, hors-ligne. Cibles ≥44, alternative aux gestes, données réelles seulement comme repères datés.
- Départ [-2,2] par 0,25 ; objectif [0,4] entier. Symétrie et continuité. Aucune unité physique sur les curseurs, aucune prédiction.
- Copie indépendante du départ dans l'objectif ; une édition du départ ne rebase jamais un objectif existant.
- Une seule sauvegarde atomique de document versionné ; refus d'écrasement local concurrent et de document futur/illisible.
- Pas de nouveau moteur natif, pas de migration des historiques de mesures, pas de push / merge vers dev ni déploiement d'application. Migration additive nécessaire appliquée selon les règles autorisées du dépôt après tests et dry-run.
- Worktree `.claude/worktrees/mon-corps`, branche `feature/corps02-morphologie` créée depuis origin/dev et intégrant CORPS-01. Ne pas modifier le dossier principal.
- Workers ne committent pas pendant les edits parallèles ; le coordinateur groupe le lot après revue.

## Task 1 — Document et persistance

**Files:** packages/shared/src/body-visual.ts, body-visual.test.ts, index.ts ; apps/mobile/src/data/repositories/body-visual-repository.ts, __tests__/body-visual-write.test.ts ; powersync/schema.ts, connector.ts et __tests__/connector-json-columns.test.ts ; migration additive SQL. Ne pas modifier database.types.ts : le coordinateur la régénère après application.
**Interfaces:** Tous les types/fonctions métier et `useBodyVisual` / `saveBodyVisual` sont définis exactement dans la spec. Le renderer et l'écran les consomment.

- [x] Écrire tests rouges : schémas rejettent valeurs hors bornes/non finies, données futures non éditables, formes indépendantes, ordre des clés sans effet, snapshot objectif conservé et dates mises à jour seulement quand nécessaire.

```ts
const doc = createBodyVisualDocument();
const goal = createBodyVisualGoal(doc);
doc.baseline.proportions.arms = 2;
expect(goal.baseline.proportions.arms).toBe(0);
expect(parseBodyVisualDocument({version: 99}).status).toBe('unsupported');
```

- [x] Observer rouge puis implémenter les fonctions pures, exports et tests verts.
- [x] Tests SQLite réels : sauvegarde/relecture, transaction refusée si raw concurrent, auth/possession, row absente, aucun champ de réglage ou mesure écrasé ; JSON déballe réellement pour l'upload.

```ts
expect(decodeJsonColumns('user_settings', {body_visual_state:'{"version":1}'}))
  .toEqual({body_visual_state:{version:1}});
```

- [x] Ajouter la colonne locale et sa conversion connecteur, repository et migration : `alter table public.user_settings add column if not exists body_visual_state jsonb;` avec contrainte document objet ou null et commentaire. L'application cloud appartient au coordinateur.
- [x] Exécuter shared, SQL, connecteur et typecheck/lint ciblés ; rapport et revue de tâche.

## Task 2 — Silhouette modulable

**Files:** apps/mobile/src/components/body/BodyShapeFigure.tsx, body-shape-geometry.ts, __tests__/body-shape.test.tsx ; design/mon-corps-2026-09/render-morphology-qa.cjs et sorties QA.
**Consumes:** BodyShape, BodyEmphasis, BodyVisualZone, palette. **Produces:** BodyShapeFigure selon spec et fonctions de géométrie pures testables. Ne pas modifier AnatomyFigure/BodyMap/PainBodyMap.

- [x] Tests rouges : de vraies coordonnées changent pour bras/cuisses/épaules ; symétrie ; absence de valeurs non finies et de coupe aux bornes ; chaque zone appelle le bon identifiant et l'outline ne capte pas les appuis.
- [x] Implémenter une silhouette humaine lisse originale, tête/cou/torse/bras/mains/bassin/jambes/pieds, avec géométrie de jonction commune. Des courbes contiguës et des dégradés sobres donnent le volume. Le mode goal transforme seulement le volume des sept zones et conserve la pose/longueurs.
- [x] Produire les planches issues du vrai renderer : trois bases, face/dos, thèmes, extrêmes combinés, départ/objectif superposés ; inspecter et corriger si membre coupé, trou ou contour décalé.
- [x] Exécuter tests et typecheck/lint ciblés ; rapport et revue de tâche.

## Task 3 — Éditeur et intégration

**Files:** apps/mobile/src/app/body-shape.tsx, app/_layout.tsx, app/body.tsx ; components/body/BodyShapeEditor.tsx, BodyShapeControl.tsx, BodyMeasurementReferences.tsx ; app/__tests__/body-shape-screen.test.tsx ; i18n/locales/fr.json/en.json.
**Consumes:** useBodyVisual/saveBodyVisual, document helpers, BodyShapeFigure, useLatestMeasurements. **Produces:** navigation complète et brouillon non destructif.

- [x] Tests rouges écran : état vide, ouvrir objectif crée une copie, édition/annulation, sauvegarde réussie ou refusée préserve brouillon, modèle futur bloqué, comparaison et message départ ancien, retour sale protégé.
- [x] Entrée `/body` et Stack. Écran racine charge état et repères ; ne monte un éditeur qu'après lecture. Le brouillon est initialisé une fois, conserve ses changements lors des mises à jour du hook ; nouvelle donnée propre rechargée explicitement via clé.
- [x] Trois modes et deux vues, presets, sept zones, contrôle ajustable + boutons, reset d'une zone ; création/recréation d'objectif explicite. Le compare dessine deux rendus alignés et la liste des intentions.
- [x] Sauvegarde via repository avec verrou anti-double-appui et message de succès/erreur ; annuler et retour avec confirmation si sale, via mécanisme de navigation du dépôt ; pas d'écriture pendant un déplacement du curseur.
- [x] Tests écran/routing/explorateur, typecheck et lint. Revue indépendante du lot complet après toutes les tâches.

## Task 4 — Migration et validation finale

**Files:** packages/shared/src/database.types.ts, supabase/MIGRATIONS.md, docs/specs/functional/us/corps02-morphologie.md, docs/roadmap/roadmap.md, RECETTES.md, CHANGELOG.md, ETAT.md, ce plan.

- [x] Copier uniquement la configuration locale ignorée de liaison Supabase du dépôt principal vers le worktree, sans l'imprimer ; comparer listes de migrations cloud/local. Tests précédents et inspection de l'unique migration additive.
- [x] `npx supabase db push --dry-run`, puis `npx supabase db push` si seule cette migration est planifiée ; ne pas pousser d'autres migrations. `npx supabase gen types typescript --linked` vers le fichier généré, contrôles de schéma et registre.
- [x] Revue globale : source de comparaison, conservation du brouillon, JSON upload, versions, contiguïté et bornes. Corriger les problèmes concrets puis contrôles appropriés.
- [x] `npm run test`, `npm run typecheck`, `npm run lint`, export Android. Planche QA depuis vrais composants, aucune validation device revendiquée.
- [x] Passer spec à recette, ajouter ligne6.5 et section63 après vérification des numéros, compteurs et changelog ; régénérer ETAT. Commit local et branche conservée, pas de push ou déploiement d'app.
