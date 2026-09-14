# CORPS-03 — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Confirmer des priorités issues de la silhouette et comprendre leur présence dans le programme.
**Architecture:** Document personnel distinct, fonctions pures de correspondance et comptage,
repositories locaux, écran à confirmation explicite et lecture factuelle du programme.
**Tech Stack:** Expo 57 / React Native, SVG, PowerSync, Supabase, Zod existants.
**Spec:** docs/specs/functional/us/corps03-priorites-entrainement.md

## Global Constraints

- Worktree existant `.claude/worktrees/mon-corps`, branche `feature/corps03-priorites-entrainement`,
  créée depuis origin/dev puis avance rapide vers `6449901b` (CORPS-01/02 validés).
- Autorisation de poursuivre donnée par Florian ; préparation spec/plan/design avant code.
- 1..3 priorités uniques, aucun dosage/entraînement généré, aucune écriture dans un programme.
- FR/EN, clair/sombre, offline, cibles ≥44, retour protégé et CAS des deux JSON.
- Aucun push ni merge dans dev. Migration additive nécessaire appliquée selon CLAUDE.md.
- Workers : pas de commit ni de changement de branche pendant l'intégration ; coordinateur
  rassemble les commits avec CHANGELOG/état. Rapports dans le workspace privé du plan.

## Task 1 — Métier, stockage et lecture du programme

**Files:** créer `packages/shared/src/body-training.ts`, `body-training.test.ts`, exports index ;
`apps/mobile/src/data/repositories/body-training-repository.ts`, `body-training-program-repository.ts`,
tests `__tests__/body-training-write.test.ts`, `body-training-program-sql.test.ts` ; modifier schema.ts,
connector.ts et son test JSON. Créer migration additive avec `npm run db:new corps03_body_training_state`.
Ne pas modifier database.types.ts/registre : application cloud par le coordinateur.

**Interfaces:** toutes les signatures et types du §Contrats métier et §Stockage de la spec,
sans modification. Exporter le SQL de lecture du programme pour les tests SQLite réels.

- [x] Tests rouges métier : suggestion positive stable limitée à trois, zéro sans suggestion,
  doublons/limites rejetés, source copiée et données futures bloquées, changement de goal détecté.

```ts
const savedGoal = { ...createBodyVisualGoal(createBodyVisualDocument()), savedAt: '2026-09-13T12:00:00Z' };
const preferences = createBodyTrainingDocument(['arms'], savedGoal, '2026-09-13T12:01:00Z');
savedGoal.emphasis.arms = 4;
expect(preferences.sourceGoal.emphasis.arms).toBe(0);
expect(bodyTrainingNeedsReview(preferences, savedGoal)).toBe(true);
```

- [x] Implémenter schéma et helpers après rouge. Tests de couverture : biceps+triceps=une ligne
  bras, legs général jamais compté comme séries glutes fines, tags fins bloquent le repli, warmup
  exclu, bodyweight inclus, séries nulles distinctes de zéro, aucun input muté.

```ts
expect(analyseBodyTrainingProgram(program, ['arms'])[0]).toMatchObject({ exactSets: 3 });
expect(analyseBodyTrainingProgram(generalLegsProgram, ['glutes'])[0])
  .toMatchObject({ exactSets: 0, generalPlans: 1 });
```

- [x] Tests SQLite rouges puis repository : save/reread, effacement, refus CAS training/visual,
  compte absent/étranger/supprimé, goal absent, JSON futur/invalid, aucune autre colonne modifiée.
  Lecture programme local : actif strength uniquement, programme vide, ownership, soft deletes,
  traduction EN→FR, séance traduite→name, exercice manquant non associé.
- [x] Ajouter colonne locale/JSON et migration objet nullable, tester upload décodé.
- [x] Exécuter shared ciblé, Jest SQLite/connector ciblés et contrôles de types/lint des fichiers.
  Rapport avec commandes, codes de sortie et cycles rouge/vert, revue de tâche.

## Task 2 — Écran, navigation et rendu

**Files:** créer `apps/mobile/src/app/body-training.tsx`, `components/body/BodyTrainingEditor.tsx`,
`BodyTrainingProgramCard.tsx`, `app/__tests__/body-training-screen.test.tsx` ; modifier `body.tsx`,
`BodyShapeEditor.tsx`, `_layout.tsx`, i18n fr.json/en.json et tests d'entrée existants si nécessaire.
Design : `design/mon-corps-2026-09/training-priorities.html` (maquette), rendu QA issu du vrai JSX.

**Interfaces:** consomme exactement useBodyTraining/saveBodyTraining/useBodyTrainingProgram de
Task 1, useBodyVisual existant, BODY_TRAINING_MUSCLES/analyseBodyTrainingProgram et BodyShapeFigure.
UI seule, pas de SQL ni de nouveau champ de stockage. Tous les types métier définis dans la spec.

- [x] Tests d'écran rouges : état sans objectif, suggestion sans écriture, choix limité, confirmation
  explicite, erreur/conflit conserve le brouillon, objectif changé signalé, Annuler/retour protégés,
  effacement confirmé, écho local ancien sans réapparition, erreurs futures, programme absent.

```ts
fireEvent.press(screen.getByLabelText('bodyTraining.confirm'));
await waitFor(() => expect(saveBodyTraining).toHaveBeenCalledWith(['shoulders'], null, visualRaw));
expect(screen.getByText('bodyTraining.confirmed')).toBeTruthy();
```

- [x] Implémenter écran gardé par userId, éditeur avec snapshots/echo/CAS, boutons lisibles,
  une action principale et illustration compacte. Lecture du programme après confirmation, compte
  exact/général nommé et détail par séance, liens existants. Pas de notification toast obligatoire.
- [x] Intégrer les deux entrées : lien Ma silhouette uniquement avec saved goal, brouillon propre
  et état non bloqué ; aucune navigation qui perd un brouillon. Route Stack header masqué.
- [x] Tests d'intégration : programme inchangé, activation inexistante, liens de chaque sous-muscle,
  statut sans programme/erreur distinct, requête/programme chargé du compte courant.
- [x] Tests ciblés, typecheck/lint. Produire quatre captures du JSX : choix FR, confirmé avec
  programme FR, sombre, EN320px. Inspecter overflow/grandes polices ; revue de tâche.

## Task 3 — Migration et clôture technique

**Files:** database.types.ts, supabase/MIGRATIONS.md, spec/plan, roadmap (nouvelle ligne 6.6),
RECETTES.md (nouvelle section), CHANGELOG.md, ETAT.md, README design/analyse de progression.

- [x] Vérifier listes cloud/local ; dry-run ne proposant que la migration CORPS-03, application
  cloud puis génération de types et registre. Aucun changement de sync rules.
- [x] Revue globale du lot ; corrections ciblées et nouveau contrôle couvrant les corrections.
- [x] `npm run test`, `npm run lint`, `npm run typecheck`, build Android release dans le worktree,
  signature et présence du nouvel écran dans le bundle ; recette fonctionnelle laissée à Florian.
- [x] Actualiser suivi et compteurs selon le livré, `node scripts/etat.mjs`, `git diff --check`,
  commit local et arbre propre. Conserver l'APK au chemin habituel pour la validation téléphone.

## Résultats d'exécution — 14/09/2026

- Task 1 déléguée, reprise après quota puis revue sans point restant. Les tests métier/SQLite
  passent ; le rouge initial métier n'a pas pu être observé pendant cette reprise.
- Task 2 réalisée par le coordinateur après arrêt du worker sur quota : rouge d'écran observé
  avant création de la route. Revue UI indépendante ; encodage corrigé et rappel de référence
  visuelle adapté à la révision. Le test dédié échoue avec l'ancien rappel puis passe avec
  la correction. Écho local, conflits des deux documents, compte, rechargement et entrées testés.
- `npm run test` : **6 267** tests, dont admin **587**, mobile **2 981**, shared **2 699**.
  `npm run lint` et `npm run typecheck` : codes de sortie **0**.
- Cinq états visuels issus du JSX inspectés via RN Web : quatre scénarios FR/EN, clair/sombre,
  puis petit écran et texte ×1,6. Les gestes natifs et TalkBack restent dans la recette §64.
- Migration CORPS-03 appliquée seule après alignement des trois fichiers SQL historiques avec
  `origin/dev` (`1869dffa`), copies identiques. Types cloud régénérés, second dry-run à jour.
- Build final `assembleRelease` : **1 min 31 s**, code **0**, quatre ABI. Signature v2 valide ;
  bundle empaqueté identique au bundle produit, route et dernier correctif présents.
  APK : `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (**199 913 915 octets**).
  SHA-256 : `37adf83d7c027f749955fe7295e124a017e8d240c614ac53dd02883b2e16188e`.
- CORPS-03 en recette, 6.6 livrée ; adaptation automatique ultérieure. Branche locale et
  worktree conservés pour le test téléphone, sans push ni intégration dans dev.
