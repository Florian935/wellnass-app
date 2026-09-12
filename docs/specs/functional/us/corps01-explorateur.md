---
id: CORPS-01
titre: "Carte anatomique et explorateur Mon corps"
roadmap: [6.2]
catalogue: []
etape: recette
branche: feature/corps01-explorateur
maj: 12/09/2026
---

# CORPS-01 — Carte anatomique et explorateur Mon corps

## Validation et périmètre

Florian a validé l'analyse et les deux planches le 12/09/2026 (« je valide tout ») et autorisé le démarrage du développement. Cette spécification détaille le premier lot de cette direction : [analyse](../../../product/analyse-mon-corps-2026-09.md), [maquettes](../../../../design/mon-corps-2026-09/README.md).

Livrer une vraie carte anatomique locale, sélectionnable, un écran d'exploration, des liens vers les exercices, et un accès explicite dans Musculation. Les proportions humaines et la couleur suivent la maquette ; un rendu vectoriel anatomique ombré remplace les rectangles au premier lot. Le maillage 3D avec déformations appartient au lot suivant : les images ImageGen ne sont pas un maillage disponible.

## Règles

1. Conserver les 10 identifiants `FineMuscle` et les correspondances existantes ; ne pas modifier les scores de bilan / récupération. Dessiner les sous-parties nécessaires pour donner une forme anatomique crédible sans les transformer en nouveaux groupes en base.
2. Une figure neutre avec tête, cou, torse, bras / avant-bras / mains, bassin, cuisses / genoux / mollets / pieds, proportions cohérentes de face et dos. Volumes crème, contours et ombres discrets, surbrillance terracotta thémée. Les groupes sélectionnés sont distingués aussi par un contour.
3. La carte compacte conserve `full` / `reduced` et les labels face / dos. Une action explicite « Explorer les muscles » ouvre `/body`, depuis les fiches d'exercices, séances de programme et bilan ; les groupes du contexte sont transmis dans des paramètres validés. Sans contexte, aucune coloration d'activité.
4. L'écran `/body` offre une bascule face / dos, une figure de grande taille, sélection tactile et liste complète de boutons nommés. Choisir un groupe absent de la vue actuelle bascule vers sa vue automatiquement. Une sélection d'épaules conserve la vue courante.
5. Zoom au pincement et boutons agrandir / réduire, recentrage, limites 1–2,5, déplacement borné. Les boutons restent une alternative complète aux gestes. Changer de vue / muscle recentre sur la figure ou le groupe pour éviter un écran vide. Les gestes de caméra n'écrivent aucune donnée.
6. La fiche du groupe sélectionné affiche son nom usuel et son nom anatomique utile, puis les exercices locaux associés. La sélection fine explicite est prioritaire ; sinon utiliser le repli large déjà défini. Signaler discrètement une « association par groupe » au lieu de prétendre connaître un rôle principal fin. Aucune prédiction de croissance ou de récupération.
7. La liste d'exercices est filtrable par nom, favoris triés en tête parmi les correspondances de même précision. Ouvrir un exercice consulte sa fiche et n'ajoute rien à une séance en cours. Un catalogue vide, une recherche vide et une erreur de lecture ont des messages distincts. La figure et les noms restent utilisables pendant une erreur de données.
8. Les réglages de l'explorateur sont éphémères pour ce lot. Pas de nouvelle table ni migration. Lecture depuis PowerSync, toutes les ressources de dessin embarquées. Pas d'appel distant nécessaire.
9. L'entrée « Mon corps » apparaît dans « Suivre » du hub Musculation, même sans séance. Une entrée est également ajoutée dans l'onglet Mon corps de Progression et sur l'écran des mensurations. Aucun nouvel onglet principal.
10. Le journal sensible réutilise le dessin mais garde ses couleurs, sa sélection et sa liste accessible. Les articulations sont recalées avec la même géométrie ; garder les identifiants et la sélection symétrique actuels.
11. FR et EN complets, thème clair / sombre, grandes polices, zones de contrôle d'au moins 44 unités, rôles et états accessibles. La liste de muscles offre une alternative à chaque zone du SVG. Une seule région sélectionnée à la fois, sans masquer les données de l'écran appelant.
12. Toute source graphique tierce embarquée conserve sa licence et sa provenance avec une révision figée. Ne pas ajouter de moteur 3D ou une dépendance applicative pour ce premier lot.

## Interfaces des unités

- `AnatomyFigure` : figure SVG pure, `side: 'front'|'back'`, `height?: number`, `full?: FineMuscle[]`, `reduced?: FineMuscle[]`, `selected?: FineMuscle|null`, `onSelect?: (muscle: FineMuscle) => void`, `muscleColors?: Partial<Record<FineMuscle,string>>`, `children?: ReactNode`, `testID?: string`. La taille est proportionnelle au viewBox, fond transparent. Couleurs thémées en interne.
- `BodyMap` : conserver les props existantes `full`, `reduced`. L'action de navigation est ajoutée par les écrans via un composant `BodyExplorerLink`, pour ne pas coupler le renderer au router.
- `body-explorer.ts` (shared) : types `BodyExercise` (id, name, muscle, musclesSecondary, musclesFine, equipment, isFavorite), `BodyExerciseMatch` (même type + inferred:boolean), fonction `findBodyExercises(exercises, muscle, query?)`, fonction `parseBodyMuscle(value:unknown):FineMuscle|null`, fonction `bodySideForMuscle(muscle,currentSide)`.
- `useBodyExercises(muscle: FineMuscle|null, query?:string)` : `{ exercises:BodyExerciseMatch[], isLoading:boolean, error:unknown }`, requête locale pour les champs nécessaires avec traductions langue courante / français et exclusion des suppressions.

## Idées utiles retenues

Recherche parmi les exercices liés, favoris d'abord, sélection automatique de la bonne vue et distinction entre marquage précis / association générale. Elles rendent le premier parcours plus utile sans introduire un nouveau sous-système.

Idées pour les lots suivants : retrouver la dernière séance d'une zone, observer les priorités sur plusieurs semaines, comparer des snapshots personnels datés, filtrer selon le matériel disponible. Les objectifs visuels et recommandations conservent leur cadrage propre.

## Recette à effectuer sur Android

- [ ] Les dix zones ont des formes identifiables, de face et de dos ; revue anatomique sur les vrais dessins.
- [ ] Musculation → Mon corps fonctionne sur un compte sans séances.
- [ ] Cliquer dos, triceps, fessiers, ischio-jambiers ou mollets dans la liste montre la bonne vue ; épaules fonctionne des deux côtés.
- [ ] Pincement, déplacement, boutons de zoom, recentrage et retour fonctionnent sans conflit avec le scroll.
- [ ] Depuis un exercice / une séance / le bilan, les groupes transmis sont conservés et le retour retrouve l'écran appelant.
- [ ] Recherche d'exercices, favoris, repli français, catalogue vide et erreur fonctionnent.
- [ ] Les articulations du journal sensible suivent la nouvelle silhouette, et la liste textuelle reste complète.
- [ ] Thème sombre, TalkBack, grandes polices et mode avion vérifiés.
- [ ] Aucun ralentissement notable sur l'appareil cible après plusieurs ouvertures / fermetures.

Le passage à `recette` signifie code et contrôles automatiques terminés ; les cases device restent humaines.

## Vérification du code — 12/09/2026

- `npm run test` : **6 016 tests passent** (admin 587, mobile 2 839, shared 2 590), code 0.
- `npm run typecheck` et `npm run lint` : tous les workspaces passent, code 0.
- Export Metro / Hermes Android réussi ; aucun APK installé dans cette passe.
- Dessins réels inspectés en clair / sombre, articulations et sélection avec / sans contexte : voir le dossier design.
- Revue indépendante : conservation des couleurs contextuelles, déplacement par boutons et annonce de l'association générale corrigés. Les contrôles de caméra tournent sur le thread UI ; les tests simulent les primitives natives et ne remplacent pas la recette des gestes.
- Un passage intermédiaire a retrouvé les 16 échecs intermittents déjà documentés dans `health-connect-state.test.ts` ; 32/32 en isolation puis suite complète verte, sans modifier Health Connect.
- Travail isolé sur `feature/corps01-explorateur` dans `.claude/worktrees/mon-corps`, sans merge / push / déploiement. Les règles actuelles de `CLAUDE.md` et les commandes du projet ont été appliquées directement ; l'ancien pont de compatibilité Codex découvert sur une autre branche n'a pas été réintégré.
