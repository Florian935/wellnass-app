---
id: MUSCU-UX01
titre: "Refonte UX du pilier Musculation — hub, séance, après-séance, entrée programme"
roadmap: [3.59]
catalogue: []
etape: recette
branche: feature/muscu-refonte-ux
maj: 12/09/2026
---
# US MUSCU-UX01 — Refonte UX du pilier Musculation

> **Audit + maquettes validés par Florian le 10/09/2026** (compte rendu PDF + canvas 19 planches).
> Traité en **un seul lot** sur décision de Florian, là où l'audit proposait six.
> Diagnostic : [audit-ux-2026-09.md](../../../refonte-muscu/audit-ux-2026-09.md) ·
> Maquettes : [design/refonte-muscu-2026-09/](../../../../design/refonte-muscu-2026-09/).
> Branche : `feature/muscu-refonte-ux`, créée depuis `dev` dans un **worktree isolé** (une autre
> session travaille en parallèle sur `feature/accueil-refonte`). **Aucune migration.**

## 0. Contexte

L'audit de flux du 18/07/2026 portait sur des **trous de conception** (planning et logging qui ne se
parlaient pas, absence de flux guidé) ; ils ont été bouchés par les US Refonte-A à D. Ce qui reste
tient à **l'accumulation** : deux mois de fonctionnalités livrées correctement, ajoutées une à une
sur des écrans jamais rehiérarchisés. Le défaut n'est plus l'absence, c'est la densité et l'ordre.

Dix-sept constats vérifiés dans le code. Le mécanisme est le même partout : **ce qui compte le plus
a été poussé vers le bas par ce qui compte moins.**

Arbitrages tranchés par Florian avant maquettage (09/09/2026) :
- **Ampleur** : tout le pilier, Progression et Historique compris.
- **Carte de série** : barre d'action **collante** en bas, plutôt qu'un tiroir ou un pavé maison.
- **Niveaux d'affichage** : les trois sont **conservés**, mais exposés depuis la séance.
- **Widgets du hub** : **plafond testé** + masquage des tuiles vides.

## 1. Périmètre à livrer

### R1 — Correctifs isolés
- Les quatre états vides de `/progress` proposent « Démarrer une séance » et poussent vers
  `/workout`, qui affiche « Aucune séance en cours » : le CTA ne démarre rien. Il doit mener au
  hub muscu.
- L'historique n'affiche pas le tonnage alors que `volumeKg` est déjà dans `WorkoutHistoryItem`.
- « Mettre en pause » nomme un état qui n'existe pas (MUSC-F6 : la séance reste `active`).
- `RestOverlay` peint en bordeaux `#6b0028` codé en dur, hors thème, seul écran du pilier dans ce cas.

### R2 — Entrée dans un programme
- Fiche programme : **un seul bouton** « Suivre ce programme ». La duplication d'un programme
  éditorial devient **implicite** (contrainte de modèle, pas décision d'utilisateur) et est annoncée
  après coup.
- Assistant : date de début par défaut = **aujourd'hui** (aujourd'hui / lundi prochain / autre) ;
  jours **pré-affectés** par espacement automatique selon le nombre de séances ; `canPlan` vrai dès
  l'ouverture.
- Après planification : atterrissage sur le **hub**, plus sur le calendrier.

### R3 — Hub muscu
- Zone **Agir** épinglée hors grille, à **quatre états exclusifs** : séance en cours (A) → séance du
  jour (B) → jour de repos (C) → aucun programme (D). Un seul affiché, dans cet ordre de priorité.
- L'état B porte le **contenu** de la séance (3 premiers exercices, durée estimée).
- L'état D propose **trois programmes** de la bibliothèque, triés par pertinence.
  ⚠️ **Correction du 10/09/2026** : la première rédaction annonçait un filtrage « sur le niveau et
  la fréquence déclarés à l'onboarding ». Vérification faite, le profil ne stocke **ni l'un ni
  l'autre** — l'onboarding demande un objectif (`mainGoal`) et un niveau d'**affichage de séance**
  (`workoutDisplayLevel`), pas une expérience ni une disponibilité. Le tri retenu utilise donc ce
  qui existe vraiment : le niveau d'affichage comme proxy assumé de l'expérience (« Simplifiée —
  idéal pour débuter » le dit explicitement), à défaut les programmes débutants d'abord.
  Demander la fréquence à l'onboarding serait une US à part.
- Barre de **progression du programme** (« semaine 3 sur 8 · 14/24 séances ») — MUSC-F15 la calcule
  déjà mais ne l'affiche nulle part.
- Zone **Suivre** : registre ramené de 7 à 3 widgets, **plafond appliqué par un test**, et prédicat
  `isActive` passé à la grille pour qu'une tuile vide n'occupe pas de case.
- `strength-records` et `strength-training-time` déménagent vers `/progress` ;
  `strength-programs` et `strength-templates` sont retirés (leurs entrées subsistent : la barre de
  progression pour l'un, la ligne d'annuaire pour l'autre).

### R4 — Séance en cours
- **Barre d'action collante** en bas : nom de l'exercice + rang, reps et charge avec steppers,
  « Valider la série ». Elle ne bouge jamais, **quel que soit le niveau d'affichage**.
- Les **unités des deux champs dépendent de `setType`** : reps × kg (normal, dropset, échec,
  échauffement), durée × lest (duration), reps × lest (bodyweight). Le second champ devient
  **facultatif** pour `duration` et `bodyweight`.
- **Retour haptique** à la validation (spec navigation-ux §4.2, jamais implémentée côté muscu).
- Barre haute : avancement réel de la séance (`7/18 séries`).
- Le **réglage de repos quitte la carte de série** : il se pose depuis le menu de séance ou depuis
  l'écran de repos (« toujours 2:00 sur cet exercice »).
- Écran de repos : annonce la **série suivante** et sa charge.
- **Fin de séance** : quand tout est validé, la barre collante devient « Terminer la séance ».
- Liste d'exercices : **tap dissocié** — le nom donne le focus, le chevron déplie.
- **Menu de séance** (⋮) : niveau d'affichage, repos par exercice, réorganiser, ajouter un exercice,
  « Quitter et reprendre plus tard », abandonner.

### R5 — Résumé de séance
- **Détail par exercice** avec écart depuis la dernière fois, **avant** les agrégats.
- Les cinq statistiques tiennent en une bande.
- Ressenti sur **cinq niveaux nommés** (Facile → Max) au lieu de cinq étoiles sans échelle.

### R6 — Historique
- Ligne enrichie : **nom de séance**, tonnage, nombre d'exercices, pastille de record.
- Regroupement **par mois** avec cumul.
- Filtres **par programme** et **par groupe musculaire** (spec §6.1, jamais implémentés).
- **Suppression** d'une séance passée (spec §6.1, aucune fonction au repository).

### R7 — Progression
- **Trois onglets** : Vue d'ensemble · Par exercice · Mon corps, à la place de huit sections empilées.
- Vue d'ensemble : volume, régularité, adhérence, équilibre musculaire (en **alerte** lisible),
  exécution du programme, tonnage cumulé, records récents.
- Par exercice : sélecteur, courbe, records, PR par plage de reps.
- Mon corps : mensurations, module force (%1RM, DOTS, total SBD).

## 2. Règles métier

- **R2-1** — Espacement automatique des jours : pour `n` séances par semaine, répartir sur 7 jours en
  maximisant l'écart minimal, en commençant au lundi. `n=1 → [L]` · `2 → [L,J]` · `3 → [L,M,V]` ·
  `4 → [L,M,J,V]` · `5 → [L,M,M,J,V]` · `6 → [L,M,M,J,V,S]` · `7 → tous`. Au-delà de 7, on retombe
  sur 7 (une séance par jour) et les surnuméraires reprennent au lundi.
- **R2-2** — Duplication implicite : « Suivre ce programme » sur un programme non possédé duplique
  puis planifie **la copie**. L'utilisateur est informé **après** (« Copie personnelle créée »), pas
  avant : c'est une conséquence, pas un choix.
- **R3-1** — Priorité de la zone Agir : A (séance active) > B (occurrence `planned` aujourd'hui) >
  C (programme actif, pas d'occurrence aujourd'hui) > D. Jamais deux cartes.
- **R3-2** — Plafond du hub muscu : **3 widgets déclarés**, appliqué par un test
  (`MAX_STRENGTH_WIDGETS`), sur le modèle de `MAX_HOME_WIDGETS`.
- **R4-1** — Le niveau d'affichage ne pilote **que** la zone scrollable. La barre collante est
  identique aux trois niveaux : c'est ce qui rend le changement de niveau sans risque.
- **R4-2** — Superset : à la validation, la bascule vers le partenaire ne déclenche pas de repos et
  change le libellé de la barre. Le bouton annonce ce qui suit (« Valider — puis repos »).
- **R5-1** — Écart par exercice : comparé à la **dernière séance terminée contenant cet exercice**.
  Absent si aucune. Comparaison sur la charge de travail maximale hors échauffement, puis sur les
  reps à charge égale.
- **R6-1** — Supprimer une séance est un **soft delete** qui doit aussi retirer ses records et
  détacher l'occurrence de planning liée (retour en `planned`). Confirmation obligatoire.

## 3. Cas limites

- Séance libre sans nom → « Séance libre » dans l'historique, badge `LIBRE`.
- Exercice sans dernière performance → pas de ligne « Dernière fois », pas d'écart au résumé.
- Programme sans séance → « Suivre ce programme » désactivé (rien à planifier).
- Programme à plus de 7 séances/semaine → R2-1 retombe à 7 jours, surnuméraires au lundi.
- Séance du jour **déjà faite** → état C (repos) avec la mention « Séance du jour faite ».
- Plusieurs occurrences le même jour → l'état B montre la première non faite.
- Suppression de la **seule** séance portant un record → le record disparaît, pas de recalcul du
  précédent (hors périmètre, comportement existant de `evaluateWorkoutRecords`).
- Historique vide après filtrage → état vide avec action de réinitialisation des filtres.

## 4. Offline

Aucune écriture nouvelle hors des repositories existants ; toutes les mutations passent par les
fonctions déjà en place (`updateSet`, `planProgram`, `duplicateProgram`…) qui écrivent en local
d'abord. La suppression de séance suit le même patron (soft delete local, synchro en arrière-plan).
Aucune migration, aucune table nouvelle, **aucune mise à jour des sync rules PowerSync**.

## 5. i18n

Parité FR + EN sur toutes les chaînes nouvelles ou modifiées. Les libellés retirés
(`workout.leave.pause`, `progress.cta.startWorkout`…) sont remplacés, pas laissés orphelins.

## 6. Definition of Done

- `npm run typecheck`, `npm run lint`, `npm run test` verts.
- Parité FR/EN vérifiée par le test d'i18n existant.
- Plafond du hub muscu appliqué par un test qui échoue si le registre grossit.
- Règles pures (espacement des jours, écart par exercice, priorité de la zone Agir) couvertes par
  des tests Vitest dans `packages/shared`.
- Section de recette ajoutée à [RECETTES.md](../../../../RECETTES.md).

## 7. Hors périmètre

- Le back-office.
- Les écrans partagés avec le running (`/planning` reste pilier-agnostique : seul l'assistant
  `plan.tsx` est touché, et la non-régression course doit être vérifiée).
- La révélation progressive des options (arbitrage : les trois niveaux sont conservés).
- L'édition d'une séance passée (seule la **suppression** est livrée ; l'édition demande un cadrage
  propre sur les records et le volume).
- Le recalcul du record précédent après suppression.
