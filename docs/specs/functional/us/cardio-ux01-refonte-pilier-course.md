---
id: CARDIO-UX01
titre: "Refonte UX du pilier Course — justesse, hub, course, après-course, préparation"
roadmap: [5.40]
catalogue: []
etape: recette
branche: feature/cardio-refonte-ux
maj: 10/09/2026
---
# US CARDIO-UX01 — Refonte UX du pilier Course

> **Audit + maquettes validés par Florian le 10/09/2026** (compte rendu PDF 22 pages + canvas
> 11 planches, dont 2 relevés de l'existant).
> Traité en **un seul lot** sur décision de Florian, là où l'audit proposait dix-sept US.
> Diagnostic : [audit-ergonomie-pilier-course.md](../../../product/audit-ergonomie-pilier-course.md) ·
> Maquettes : [design/audit-course/](../../../../design/audit-course/).
> Branche : `feature/cardio-refonte-ux`, créée depuis `dev`. Même patron que
> [MUSCU-UX01](muscu-ux01-refonte-pilier-musculation.md), livrée la veille sur le pilier voisin.

## 0. Contexte

Le pilier Course est **riche en calcul et pauvre en surface**. Le moteur est là — `resolveSessionPace`,
`expandIntervalPhases`, `progressivePaceTarget`, `computeKmSplits`, `computeAcwr`,
`resolveRacePredictions`, `evenPacingPlan`, `session-adaptation`. Ce qui manque tient en trois
phrases, et ce sont les trois que l'utilisateur voit :

1. **Ce qui est calculé n'est pas montré au bon moment** — une séance structurée est pilotée à la
   voix, rien à l'écran ne dit dans quel segment on est.
2. **Ce qui est saisi coûte trop cher** — 14 contrôles par segment, 42 pour une séance à trois
   segments, 70 pour une séance à cinq.
3. **Ce qui est fait ne se referme pas** — terminer une course ne coche pas la séance planifiée.

À quoi s'ajoutent **deux défauts qui trompent l'utilisateur sur ses propres données** : le chrono
affiché n'est pas celui qui sera enregistré, et une course sans GPS n'enregistre aucune durée.

**40 constats vérifiés dans le code** (F1 → F40), dont 5 bloquants. Le mécanisme est différent de
celui de la muscu : là-bas, ce qui compte avait été poussé vers le bas ; ici, **ce qui est calculé
n'a jamais reçu de surface**, parce que chaque US a ajouté une ligne de texte à un écran existant
plutôt qu'un endroit à elle.

Arbitrages tranchés par Florian le 10/09/2026 :
- **Ampleur** : tout le pilier, y compris le modèle de programme (F35) et l'import (F25).
- **Traitement** : un seul lot, une seule US, une seule branche.
- **Ordre** : la justesse d'abord (R1), le reste ensuite.

## 1. Périmètre à livrer

### R1 — Justesse : les cinq bloquants

Ces cinq points ne relèvent pas de l'ergonomie. L'app perd une donnée, ou affiche un chiffre qui
n'est pas celui de l'utilisateur.

- **R1a — Le chrono affiché est le chrono enregistré** (F9, F16). `run/active.tsx` affiche
  `now − startedAt` (horloge murale) alors que `runs.duration_seconds` porte la durée **nette**
  hors pauses. Le chrono doit afficher la durée nette, et la pause doit se voir (chrono figé,
  bandeau explicite). Corollaire F16 : `netDurationS` n'avançait que sur un segment GPS jugé
  fiable — il doit avancer dès que la course n'est pas en pause, indépendamment de la qualité du fix.
- **R1b — Le mode sans GPS enregistre sa durée** (F15, F14). `duration_seconds` n'est écrit que par
  `flushTrack`, appelé seulement par le tracker, lancé seulement en mode GPS : une course manuelle
  finit à `Durée —` / `Allure —`, et le résumé n'offre aucun champ de durée. Le mode manuel devient
  un vrai mode : chrono local avec pause réelle, durée persistée à la clôture, durée **et** distance
  éditables au résumé.
- **R1c — Terminer une course clôt la séance planifiée** (F20). `markPlannedSessionDone` existe et
  n'est appelée que depuis le calendrier. `finishRun` doit la clôturer quand la course porte un
  `planned_session_id`, et le résumé doit l'annoncer avec la possibilité de dé-valider.
- **R1d — Arrêt en deux temps, suppression, correction** (F11, F12, F18, F19). Un appui sur Stop
  clôture et quitte, sans confirmation ni retour. Il doit mettre en **pause** et proposer trois
  issues : Reprendre · Terminer · Supprimer. Plus un **verrou d'écran** pendant la course, et la
  suppression / correction d'une course depuis le résumé et l'historique.

### R2 — Entrée dans le pilier

- **R2a — Le profil coureur entre dans le pilier** (F1, F39, F40). `/running-profile` n'est
  atteignable que depuis les Réglages de l'application et un lien enfoui dans `PaceCurveCards`. Il
  porte l'allure de référence — qui pilote **toutes** les allures cibles — et les deux réglages
  audio, désactivés par défaut. Entrée d'en-tête sur le hub, `ScreenHeader` posé, bouton « Retour »
  redondant retiré, et la **fréquence hebdo visée** sert enfin (comparée au réalisé de la semaine).
- **R2b — Quatre portes vers l'allure de référence** (F2). « Ton allure actuelle sur 5 km » est une
  question impossible pour un débutant, sans repli. Quatre portes équivalentes : *je connais mon
  allure* · *j'ai un chrono sur une distance* (Riegel inversé — `predictRaceTime` existe) · *je fais
  le test de 12 minutes* · *je ne sais pas encore*. Les allures déduites s'affichent **avant** de
  valider.
- **R2c — Accueil du pilier** (F3). Trois questions à l'activation : comment tu cours · ton allure
  de référence · la voix pendant la course. Chacune peut être remise à plus tard.

### R3 — Hub course

- **Zone Agir** épinglée hors grille, à **quatre états exclusifs** (même patron que
  `strength-hub.ts`) : course en cours (A) → séance du jour (B) → repos / course libre (C) →
  aucun programme (D).
- L'état B porte le **contenu** de la séance : structure des segments, allure cible, consigne
  rédigée, volume et durée estimée.
- **Ma semaine** (F37) : séances faites sur prévues, distance, temps, dénivelé, et la fréquence
  visée du profil en repère.
- **La carte d'adaptation agit** (F36) : « Appliquer aujourd'hui » écrit une variante de la séance
  du jour sans toucher au programme.
- **Widgets** : plafond `MAX_RUNNING_WIDGETS` appliqué par un test, et prédicat `isActive` passé à
  la grille pour qu'une tuile vide n'occupe pas de case.

### R4 — Partir

- **F4** — Le bouton du hub démarre directement, avec le **dernier mode utilisé** (persisté dans les
  réglages). La roadmap 5.13 promettait « d'un tap » depuis le départ.
- **F5** — **Compte à rebours** au départ (3 s par défaut, réglable, désactivable) — spécifié
  roadmap 5.13, jamais implémenté.
- **F6** — **Attente du fix GPS** : précision affichée, bouton armé quand le fix est exploitable,
  départ possible malgré un fix dégradé mais annoncé.
- **F7** — Le **contexte de la séance** reste visible sur l'écran de départ (structure + consigne).
- **F8** — La permission est demandée **avant** `startRun` : plus de course fantôme créée puis
  annulée puis recréée.
- **F26** — **Saisie rétroactive** : ajouter une course déjà faite (date, heure, durée, distance,
  type, ressenti), rattachable à une séance planifiée passée.

### R5 — Courir

- **F10** — **Bandeau de segment** permanent : nature du segment, répétition (`3/6`), décompte
  restant, allure cible du segment, segment suivant, et progression de la séance entière. C'est le
  mur principal : toute la machinerie de RUN-F4 n'avait aucune surface visuelle.
- **F13** — **Héros adaptatif** : le chiffre en grand dépend de la séance — allure sur un
  fractionné, distance sur une sortie longue, chrono sur une séance à la durée. Réglable, avec un
  défaut dérivé du type de séance.
- Jauge d'écart à l'allure cible, sur l'échelle de la plage, jamais en rouge d'alerte.

### R6 — Clore, puis analyser

- **F17** — Le résumé passe en **deux temps**. Écran 1 « C'est fait » : quatre chiffres, la séance
  validée (R1c), le ressenti, *Enregistrer* — sans défilement. Écran 2 « Analyser » : splits,
  fractions, courbes, carte, export, partage, corriger, supprimer.
- **Ressenti nommé** sur cinq niveaux, réutilisant `workout-feeling.ts` de MUSCU-UX01 : même
  question, même échelle des deux côtés de l'app.
- **F21** — Tableau fraction par fraction lisible : plus de colonne figée à 52 px, et la **plage
  complète** du prévu, pas une seule borne.
- L'écart entre temps écoulé et temps net est **expliqué**, pas laissé inexpliqué.

### R7 — Historique

- **F22** — **Trois onglets** : Journal · Progression · Records, à la place de huit sections
  empilées.
- **F23** — Liste **virtualisée** (`FlatList`), **filtrable** (type, période) et **groupée par
  mois** avec cumul de période.
- **F24** — Ligne enrichie : type de séance, terrain, planifiée ou libre, RPE, dénivelé.
- Suppression et correction par balayage (R1d).

### R8 — Préparer

- **F27** — Éditeur de segment à **trois niveaux** : ligne compacte repliée
  (`Corps · 6 × 400 m @ 4:05 · R 200 m`) → dépli essentiel (nature, répétitions, étendue, allure,
  récupération) → dépli avancé (« Réglages fins » : %VMA, chrono cible, rampe).
- **F28** — « **Répéter la sélection** » remplace la clé texte du champ « Groupe ». La clé reste en
  base, invisible.
- **F30** — Les **durées courtes se saisissent en secondes** : une récup de 45 s ne s'écrit plus
  « 0.75 » minute.
- **F31** — Unités cohérentes : la distance de segment respecte le système d'affichage.
- **F32, F33** — L'éditeur de séance se replie par sections (Essentiel · Consignes · Structure ·
  Course). Le « critère d'adaptation » quitte le premier rang.
- **F34** — **Modèles de séance** (catalogue court) + **duplication** d'un segment et d'une séance +
  **saisie en une ligne** (`2km éch + 6x400/200 + 1km rac`).
- **F38** — Un programme éditorial dit **pourquoi** il faut le suivre pour le modifier : un seul
  bouton « Suivre ce programme », duplication implicite annoncée après coup (patron R2-2 de
  MUSCU-UX01).

### R9 — Le modèle porte des semaines qui progressent (F35)

`sessions` n'a pas de `week_index` et `planProgram` répète le même patron hebdomadaire pendant
N semaines : un programme est **une semaine type répétée**, jamais un plan progressif. Un
« 10 km en 8 semaines » ne peut pas faire grandir sa sortie longue.

- Colonne `week_index integer` **additive et nullable** sur `sessions` (migration).
- `null` = séance de la semaine type, **répétée chaque semaine** — c'est le comportement actuel, et
  tous les programmes existants restent valides sans reprise.
- Renseignée = séance d'**une semaine précise** du programme.
- `planProgram` génère les deux : les séances sans `week_index` chaque semaine, celles qui en ont
  une seulement à leur semaine.
- L'éditeur de programme gagne une vue par semaine et une action « Dupliquer la semaine ».

> 🔴 **La migration n'est pas poussée par cette US.** Le fichier est écrit et coché à `[ ]` dans
> [MIGRATIONS.md](../../../../supabase/MIGRATIONS.md) ; `npm run db:push` vise la base **cloud** de
> production et reste une décision de Florian ou Damien. Tant qu'elle n'est pas poussée, la lecture
> de `week_index` est tolérante (colonne absente = `null` partout) et le pilier fonctionne comme
> avant.

### R10 — Faire entrer les courses de l'extérieur (F25)

Health Connect déclare `ExerciseSession` et `Distance` en **écriture seule** ; seuls poids, pas et
cycle sont importés. Une sortie enregistrée à la montre n'entre jamais.

- **Import GPX** : parseur pur dans `packages/shared`, écran d'import, création d'une course
  `source: 'import'` avec sa trace, sa distance et sa durée.
- **Import Health Connect** : lecture des `ExerciseSession` de type course, dédoublonnage sur
  l'horodatage de début.

> 🔴 **La lecture Health Connect ajoute deux permissions** (`read ExerciseSession`,
> `read Distance`), ce qui **change la déclaration « Health apps » du Play Store** — laquelle est
> le chemin critique de la publication (9.2, seul P0 restant). L'import GPX, lui, n'ajoute aucune
> permission. Les deux sont livrés derrière un **réglage désactivé par défaut**, et la déclaration
> Play doit être mise à jour **avant** d'activer la lecture Health Connect en production.

## 2. Règles métier

- **R1a-1** — Durée affichée en course = `runs.duration_seconds` (dernier flush) + le delta écoulé
  depuis ce flush **si et seulement si** la course n'est pas en pause. En pause, le chrono est figé
  sur la dernière valeur nette connue.
- **R1a-2** — `netDurationS` avance sur le temps écoulé entre deux points **retenus**, que le
  segment soit exploitable pour la distance ou non. La distance garde son filtre de vitesse ; la
  durée ne le partage plus.
- **R1b-1** — Une course manuelle persiste sa durée nette à la clôture, calculée par le même
  compteur local que l'affichage (pauses exclues). Sa distance reste saisie à la main.
- **R1b-2** — Une course manuelle sans distance saisie reste valide : durée et ressenti suffisent.
  Elle est exclue des records (comportement existant) et de la polarisation (pas de trace).
- **R1c-1** — `finishRun` marque `done` la séance planifiée liée, **idempotent** : une course déjà
  clôturée ne re-stampe rien, et une séance déjà `done` n'est pas retouchée.
- **R1c-2** — Dé-valider depuis le résumé remet la séance en `planned` et détache le lien.
- **R1d-1** — Supprimer une course est un **soft delete** qui retire aussi ses records, recalcule
  l'allure de référence si le record 5 km tombait, et remet en `planned` la séance liée.
- **R3-1** — Priorité de la zone Agir : A (course active) > B (occurrence `planned` aujourd'hui) >
  C (programme actif, rien aujourd'hui) > D (aucun programme). Jamais deux cartes.
- **R3-2** — Plafond du hub course : **4 widgets déclarés**, appliqué par un test
  (`MAX_RUNNING_WIDGETS`).
- **R3-3** — « Appliquer aujourd'hui » écrit une **variante datée** de la séance, jamais le
  template : le programme des semaines suivantes est intact.
- **R5-1** — Le bandeau de segment se reconstruit depuis le curseur déjà persisté par RUN-F2d
  (`intervalPhaseIndex`, `intervalPhaseStartDistanceM`, `intervalPhaseStartDurationS`). **Aucune
  seconde source de vérité** sur « où en est la séance ».
- **R5-2** — Héros par défaut selon le type : `fractionne` et `test` → allure ·
  `sortie_longue` et `course` → distance · séance bornée en durée → chrono · course libre →
  distance. Réglage utilisateur prioritaire sur ce défaut.
- **R8-1** — Saisie en une ligne : grammaire `<n>km|<n>m [éch|rac|calme]`, `<r>x<d>[/<récup>]`,
  `<n>min`, séparées par `+`. Une ligne non reconnue **n'écrit rien** et le dit ; elle ne produit
  jamais une structure partielle.
- **R8-2** — « Répéter la sélection » exige **deux segments contigus ou plus** ; elle leur pose une
  clé de groupe générée et le nombre de répétitions.
- **R9-1** — `week_index` `null` = séance répétée toutes les semaines. Une séance avec
  `week_index = k` n'est générée qu'à la semaine `k` (0-based).
- **R10-1** — Dédoublonnage d'import : une course importée dont l'horodatage de début tombe à moins
  de 60 s d'une course existante n'est pas recréée.

## 3. Cas limites

- Course active sans aucun point GPS retenu → durée nette 0, chrono à `0:00`, pas de `NaN`.
- Pause déclenchée avant le premier flush → chrono figé à `0:00`, pas de repli sur l'horloge murale.
- Séance structurée dont le curseur de phase est `null` (course libre, ou séance sans structure) →
  bandeau de segment **absent**, pas vide.
- Dernier segment franchi → le bandeau annonce la fin de séance, pas un segment `7/6`.
- Course manuelle terminée sans distance → historique affiche la durée seule, allure `—`.
- Suppression de la course qui portait le record 5 km → l'allure de référence est recalculée depuis
  le record suivant, ou effacée s'il n'y en a pas.
- Séance planifiée supprimée après la course → le résumé n'affiche pas la validation, la course
  reste valide.
- Import GPX d'un fichier sans point valide → refus explicite, aucune course créée.
- Import GPX d'une trace sans horodatage → durée non calculable, course créée en `manual` avec
  distance seule.
- Programme avec `week_index` renseigné mais migration non poussée → colonne absente, lecture
  tolérante, comportement d'avant.
- Saisie en une ligne d'une séance déjà structurée → **remplace** la structure, après confirmation.

## 4. Offline

Toutes les mutations passent par les repositories existants, qui écrivent en local d'abord :
`startRun`, `finishRun`, `flushTrack`, `setRunFeedback`, `cancelRun`, `updateRunningSession`,
`updateIntervalBlock`, `markPlannedSessionDone`, `planProgram`. Trois fonctions neuves suivent le
même patron (`setManualRunDuration`, `deleteRun`, `createPastRun`).

**Une migration** (R9, `sessions.week_index`), additive et nullable, **non poussée par cette US**.
Aucune table nouvelle, donc **aucune sync rule PowerSync à redéployer** — `sessions` est déjà
publiée en `select *`.

## 5. i18n

Parité FR + EN sur toutes les chaînes nouvelles ou modifiées, vérifiée par
`scripts/check-i18n-parity.mjs` (livré par MUSCU-UX01). Les clés retirées sont remplacées, pas
laissées orphelines.

## 6. Definition of Done

- `npm run typecheck`, `npm run lint`, `npm run test` verts.
- Parité FR/EN vérifiée par `scripts/check-i18n-parity.mjs`.
- Plafond du hub course appliqué par un test qui échoue si le registre grossit.
- Règles pures couvertes par des tests Vitest dans `packages/shared` : durée nette affichée,
  priorité de la zone Agir, héros par défaut, grammaire de la saisie en une ligne, génération avec
  `week_index`, parseur GPX, dédoublonnage d'import.
- Migration écrite et **cochée à `[ ]`** dans `supabase/MIGRATIONS.md`.
- Section de recette ajoutée à [RECETTES.md](../../../../RECETTES.md).

## 7. Hors périmètre

- Le back-office (les champs de consigne y sont déjà posés par RUN-F4).
- La météo de course (RUN-F3b) — bloquée par un arbitrage de confidentialité.
- La fréquence cardiaque et les capteurs — V2 wearables.
- L'import FIT (binaire, propriétaire) — seul le GPX est livré.
- Le recalcul du record précédent au-delà du 5 km après suppression.
- `npm run db:push` de la migration R9 et la mise à jour de la déclaration Play pour R10 : deux
  décisions de Florian ou Damien, hors du code.
