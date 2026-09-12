# CORPS-01 — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Livrer la carte anatomique et le parcours Mon corps du premier lot validé.
**Architecture:** SVG local partagé par cartes et journal sensible ; écran séparé ; filtre métier pur et repository de lecture.
**Tech Stack:** Expo 57, React Native, TypeScript, react-native-svg, Gesture Handler / Reanimated existants, PowerSync.
**Spec:** docs/specs/functional/us/corps01-explorateur.md

## Global Constraints

- FR + EN ; hors-ligne ; pas de migration, pas de dépendance applicative ajoutée.
- Préserver les 10 FineMuscle, les calculs actuels et les données existantes.
- Ne pas toucher aux modifications non committées du dossier principal.
- Direction et démarrage validés par Florian le 12/09/2026 ; pas de nouvelle demande de validation pour ces détails d'exécution.
- Aucun merge / push sur dev ou déploiement dans ce travail.
- Lire les docs Expo 57 avant le code (effectué).

## Task 1 — Géométrie et rendu partagés

**Files:** components/body/anatomy-geometry.ts, AnatomyFigure.tsx, BodyMap.tsx, PainBodyMap.tsx, __tests__/anatomy.test.tsx ; notice tiers si source externe. Tous sous apps/mobile/src sauf la notice dans design/mon-corps-2026-09.

**Consumes:** FineMuscle, FINE_MUSCLE_VIEWS, palette et polices existantes.
**Produces:** AnatomyFigure conforme à la spec ; BodyMap compatible ; journal sensible sur la même géométrie.

- [x] Écrire un test de comportement : toucher la zone biceps appelle `onSelect('biceps')` ; toucher une articulation garde `onSelect('knee')`. Vérifier les deux vues et la distinction full/reduced.
- [x] Exécuter ce test et constater l'échec avant le changement.
- [x] Construire les courbes anatomiques et le renderer avec tracés séparés, remplissages ombrés et contour de sélection ; adapter les pastilles articulaires.
- [x] Exécuter les tests, produire un rendu de contrôle clair / sombre à partir du même SVG, inspecter visuellement.

Interface attendue :
```ts
export type AnatomyFigureProps = {
  side: 'front' | 'back'; height?: number; full?: FineMuscle[]; reduced?: FineMuscle[];
  selected?: FineMuscle | null; onSelect?: (muscle: FineMuscle) => void;
  muscleColors?: Partial<Record<FineMuscle,string>>; children?: ReactNode; testID?: string;
};
```

## Task 2 — Exercices associés et lecture locale

**Files:** packages/shared/src/body-explorer.ts, body-explorer.test.ts, index.ts ; apps/mobile/src/data/repositories/body-explorer-repository.ts et __tests__/body-explorer-sql.test.ts.

**Consumes:** resolveFineMuscles, normalisation existante, tables exercices / traductions / favoris.
**Produces:** findBodyExercises, parseBodyMuscle, bodySideForMuscle et useBodyExercises selon spec.

- [x] Test métier : un curl fin biceps est exclu du triceps ; un curl sans marquage fin appartient au repli triceps avec inferred=true ; query insensible aux accents / casse ; favoris et précision ; paramètre invalide null.
- [x] Exécuter `npm run test --workspace @wellness/shared -- src/body-explorer.test.ts` et observer l'échec.
- [x] Implémenter les fonctions pures, puis export.
- [x] Tester la requête de production sur le sqlite-harness : suppression, traduction EN puis FR, favoris, JSON absent / invalide ; aucun accès réseau.
- [x] Implémenter le hook, exécuter tests métier et repository.

Exemples de contrats :
```ts
expect(parseBodyMuscle('unknown')).toBeNull();
expect(bodySideForMuscle('triceps', 'front')).toBe('back');
expect(bodySideForMuscle('shoulders', 'back')).toBe('back');
// curl : muscle:'arms', musclesFine:['biceps'], musclesSecondary:[]
expect(findBodyExercises([curl], 'triceps')).toEqual([]);
expect(findBodyExercises([curl], 'biceps')[0]?.inferred).toBe(false);
```

## Task 3 — Écran, gestes et accessibilité

**Files:** apps/mobile/src/app/body.tsx ; components/body/BodyExplorerCanvas.tsx, BodyMusclePicker.tsx, BodyMuscleDetail.tsx ; app/__tests__/body-screen.test.tsx ; locales/fr.json et en.json.

**Consumes:** AnatomyFigure, useBodyExercises, parseBodyMuscle, bodySideForMuscle.
**Produces:** route /body ; sélection, recherche, exercices consultables, zoom et recentrage.

- [x] Tests écran : état neutre, sélection dans la liste, auto-vue dos, paramètres invalides, ouverture exercice sans action de séance, états vide / erreur, boutons zoom et reset.
- [x] Lancer les tests et voir les échecs attendus.
- [x] Implémenter les composants, mots FR/EN, état éphémère. La liste de muscles et les boutons de zoom sont de vrais contrôles accessibles.
- [x] Gestes : pinch et pan simultanés dans une zone de dessin isolée ; valeurs de scale bornées [1,2.5], recentrage à chaque vue / nouvelle sélection ; pas de mutation métier.
- [x] Réexécuter les tests, typecheck mobile et lint ciblé ; vérifier un rendu réel de l'écran si l'environnement le permet.

## Task 4 — Accès, régressions et livraison

**Files:** components/body/BodyExplorerLink.tsx ; app/(tabs)/strength.tsx ; app/progress/index.tsx ; app/measurements.tsx ; app/exercises/[id].tsx ; app/programs/[id].tsx ; app/review.tsx ; tests des écrans concernés ; docs et suivi.

**Consumes:** /body avec `muscle`, `full`, `reduced` et `context` optionnels, validés à la lecture.
**Produces:** accès explicite depuis les six destinations ; contexte lisible.

- [x] Ajouter aux tests hub le parcours vers /body sur compte sans historique ; tester le lien et son payload full/reduced.
- [x] Implémenter le composant de lien et les points d'entrée sans modifier les comportements existants.
- [x] Exécuter tests nouveaux et régressions ; typecheck, lint ciblé, shared complet ; revue indépendante du diff.
- [x] Consigner les limites de recette device, mettre à jour spec / plan / journal et générer ETAT.
- [x] Conserver la branche de travail et communiquer les commandes / fichiers utiles ; aucune publication implicite.

## Vérification de départ

Base : origin/dev 448df97. Installation npm ci dans le worktree. Tests de référence : exercise.test.ts (57 tests) ; détail exercice, programme, hub musculation et repository douleur. Résultats complétés au fil de l'exécution.

## Résultat — 12/09/2026

Les quatre tâches sont implémentées. TDD observé sur renderer, données et écran ; contrôles supplémentaires après revue pour contexte, déplacement accessible et reprise de paramètres. Le Stack racine déclare `/body`.

`npm run test` : 6 016 tests passent ; `npm run lint` et `npm run typecheck` passent. Export Android Metro / Hermes réussi. Le contrôle visuel porte sur le renderer réel exporté en SVG DOM ; aucune capture d'exécution Android n'est revendiquée. La recette humaine reste ouverte dans RECETTES.md §62, avec la branche locale conservée.

Revue indépendante favorable après correction de la coloration contextuelle, ajout de quatre boutons de déplacement borné et annonce des associations générales dans les libellés d'exercices. L'état route est réinitialisé par clé de contexte ; les contrôles Reanimated utilisent `get`/`set` sur le thread UI. Le test Health Connect intermittent existant a rougi dans une passe, puis 32/32 en isolation et suite complète verte sans changement de ce domaine.
