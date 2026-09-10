# Audit d'ergonomie — pilier Course

> **Date** : 09/09/2026 · **Auteur** : Claude (lecture de code) · **Demandeur** : Florian
> **Périmètre** : la totalité du pilier Course — 6 687 lignes sur 18 fichiers, plus le tracker,
> le repository, le planning et l'import Health Connect.
> **Nature** : audit amont. **Aucune ligne de code applicatif n'a été écrite** — conformément au
> workflow obligatoire, ce document est l'entrée du couple `spec → plan → design → validation`.
> **État du dépôt au moment de l'audit** : `npm run test` **vert** (exit 0). Les défauts décrits
> ci-dessous ne sont donc **pas** des régressions : ce sont des trous de conception et de surface.

---

## 0. En une page

Le pilier Course est **riche en calcul et pauvre en surface**. Presque tout ce qu'un plan
d'entraînement exige est calculable (allures dérivées, segments typés, rampes progressives, ACWR,
polarisation, Riegel, plan de passage, adaptation selon les signaux du jour), mais trois choses
manquent au même endroit, et ce sont exactement les trois que l'utilisateur voit :

1. **Ce qui est calculé n'est pas montré au bon moment.** Le meilleur exemple : une séance de
   fractionné structurée est pilotée à la voix, et **rien à l'écran** ne dit dans quel segment on
   est. L'app sait, le coureur non.
2. **Ce qui est saisi coûte trop cher.** Écrire « 6×400 m / 200 m récup » demande de remplir
   **42 contrôles** sur 3 segments — 70 sur une séance à cinq — dont un champ « Groupe » qui est une clé de
   base de données déguisée en champ texte.
3. **Ce qui est fait ne se referme pas.** Terminer une course rattachée à une séance planifiée ne
   marque **pas** la séance comme faite : le hub continue de proposer de la refaire.

À quoi s'ajoutent **deux défauts qui trompent l'utilisateur sur ses propres données** : le chrono
affiché pendant la course n'est pas celui qui sera enregistré, et une course en mode sans GPS
(le tapis) **n'enregistre aucune durée** — donc aucune allure.

**40 constats**, dont **5 bloquants**, **13 structurants** et **22 de finition**.
Chacun est ancré sur un fichier et une ligne.

| Sévérité | Nombre | Ce que ça produit chez l'utilisateur |
|---|---:|---|
| 🔴 **Bloquant** | 5 | Il perd des données, ou l'app lui affiche un chiffre faux |
| 🟠 **Structurant** | 13 | Il se perd, ou il abandonne devant la quantité de saisie |
| 🟡 **Finition** | 22 | Il y arrive, mais l'app ne l'aide pas |

---

## 1. Méthode et périmètre

### 1.1 Ce qui a été lu

| Fichier | Lignes | Rôle |
|---|---:|---|
| [apps/mobile/src/app/(tabs)/running.tsx](../../apps/mobile/src/app/(tabs)/running.tsx) | 176 | Hub du pilier |
| [apps/mobile/src/app/run/index.tsx](../../apps/mobile/src/app/run/index.tsx) | 224 | Écran de départ |
| [apps/mobile/src/app/run/active.tsx](../../apps/mobile/src/app/run/active.tsx) | 554 | Suivi en course |
| [apps/mobile/src/app/run/summary.tsx](../../apps/mobile/src/app/run/summary.tsx) | 939 | Résumé post-course |
| [apps/mobile/src/app/running-history/index.tsx](../../apps/mobile/src/app/running-history/index.tsx) | 740 | Historique + 8 analyses |
| [apps/mobile/src/app/running-programs/](../../apps/mobile/src/app/running-programs/) | 1 401 | Liste, détail, édition |
| [apps/mobile/src/app/running-profile.tsx](../../apps/mobile/src/app/running-profile.tsx) | 369 | Profil coureur |
| [apps/mobile/src/components/running/](../../apps/mobile/src/components/running/) | 1 802 | Éditeurs, carte, adaptation |
| [apps/mobile/src/running/](../../apps/mobile/src/running/) | 1 285 | Tracker GPS, guidage, annonces |
| [apps/mobile/src/data/repositories/run-repository.ts](../../apps/mobile/src/data/repositories/run-repository.ts) | — | Écritures et lectures |
| [apps/mobile/src/app/planning/](../../apps/mobile/src/app/planning/) | 1 332 | Calendrier, planification |
| [apps/mobile/src/lib/health-connect.ts](../../apps/mobile/src/lib/health-connect.ts) | — | Périmètre d'import/export |

### 1.2 Les six flux parcourus

1. **Découvrir** — premier lancement, activation du pilier, premier réglage.
2. **Partir** — du hub au chrono qui tourne.
3. **Courir** — les 20 à 90 minutes où l'app est seule à l'écran.
4. **Clore** — le résumé, le ressenti, la validation.
5. **Relire** — l'historique, la progression, les records.
6. **Préparer** — le programme, la séance, le planning.

### 1.3 Ce que l'audit ne couvre pas

- **Aucune vérification sur device.** Tout vient de la lecture du code. Les défauts de rendu
  (chevauchement, troncature) sont donc **déduits des styles**, pas observés — ils sont signalés
  comme tels.
- **Le contenu éditorial** (les 3 programmes publiés) n'est pas jugé ici.
- **La météo** (RUN-F3b) est hors sujet : elle est bloquée par un arbitrage de confidentialité
  documenté ailleurs.

---

## 2. Les quatre coureurs

Ces quatre parcours sont écrits **au présent de ce que fait le code aujourd'hui**, pas de ce que
la spec voulait. Les renvois `→ Fxx` pointent vers le constat correspondant.

### 2.1 Léa — débutante · court depuis 3 semaines · veut « tenir 30 minutes »

> J'active le pilier Course. J'arrive sur un écran avec un bouton « Démarrer une course » et
> quatre tuiles vides — Historique, Programmes, Planning, Temps d'entraînement. Je vais dans
> Programmes, onglet Bibliothèque, je prends « Reprise en douceur ». Ça me le duplique. J'ouvre
> le programme : chaque séance dit **« Renseigne ton profil »**. Je cherche où. Ce n'est pas dans
> le pilier — il n'y a aucun lien. Je finis par le trouver dans les **Réglages de l'application**
> `→ F1`. On me demande mon **« allure actuelle sur 5 km »**. Je n'ai jamais couru 5 km. Il n'y a
> ni « je ne sais pas », ni test proposé, ni estimation possible `→ F2`. Je laisse vide.
>
> Résultat : toutes mes séances resteront sans allure cible, et l'app ne me le dira jamais
> autrement que par cette phrase que je ne sais pas résoudre.
>
> Je pars courir quand même. Trois gestes : bouton du hub, écran de choix GPS/manuel, bouton
> Démarrer `→ F4`. Le chrono part immédiatement, téléphone encore en main, et le GPS cherche
> encore `→ F5, F6`. À un feu rouge, l'auto-pause se déclenche — mais **le chrono continue de
> défiler à l'écran** `→ F9`. J'arrive chez moi : 32:10 à l'écran. Je tape Stop, sans
> confirmation `→ F11`. Le résumé affiche **29:45**. Je ne comprends pas où sont passées mes
> 2 minutes.
>
> Le résumé fait douze sections. Je descends pour trouver « Terminé » et je traverse au passage
> une « polarisation », un « indice de dégradation », un « ACWR » `→ F17, F22`. Je n'ose plus
> rien toucher.

**Ce que Léa retient** : l'app est pour les gens sérieux, et elle affiche des chiffres qui ne
sont pas les bons.

### 2.2 Marc — intermédiaire · 3 sorties/semaine · prépare un 10 km

> Je veux suivre mon plan. Je crée un programme et j'ajoute ma séance du mardi :
> **2 km d'échauffement, 6×400 m à allure 5 km, 200 m de récup en trottinant, 1 km de retour au
> calme**. Trois segments. Pour chacun : nature (5 puces), répétitions, un basculement
> distance/durée puis un champ, un %VMA, deux champs d'allure, une bascule « progressive », deux
> champs de chrono cible, une nature de récupération (4 puces), un **« Groupe »** avec une clé
> texte libre, puis un troisième basculement pour la récupération et son champ.
> **Quatorze contrôles par segment** `→ F27`. Je ne comprends pas le champ Groupe : il faut taper
> la même chaîne dans deux segments pour les lier `→ F28`. Ma récup de 45 secondes, je dois
> l'écrire **« 0.75 »** minute `→ F30`.
>
> Il y a aussi trois façons de dire la même intensité — %VMA, allure, chrono cible — toutes les
> trois affichées, sans que rien ne dise laquelle gagne `→ F29`.
>
> Vingt minutes plus tard, ma séance est saisie. Je la planifie : on me demande un jour de la
> semaine par séance et un nombre de semaines. **Les huit semaines seront identiques** `→ F35`.
> Or mon plan fait grandir la sortie longue de 8 à 14 km. Je devrai donc rouvrir cet éditeur
> chaque semaine.
>
> Mardi, je pars. Le hub m'affiche la cible et la consigne — bien. Je tape « Démarrer la
> séance » : l'écran suivant **n'en montre plus rien** `→ F7`. En course, l'écran affiche
> distance, chrono, allure moyenne, allure instantanée, allure cible. **Nulle part le segment
> en cours.** Pas de « fraction 3 sur 6 », pas de « 250 m restants », pas de « récup ». Tout est
> à la voix — et j'ai enlevé mes écouteurs au troisième 400 `→ F10`. Je cours au hasard.
>
> Le lendemain, le hub me propose **de refaire la séance de mardi** `→ F20`. Je vais dans le
> planning la cocher à la main.

**Ce que Marc retient** : l'app sait tout faire, mais c'est lui qui fait le travail.

### 2.3 Sofia — confirmée · 5 sorties/semaine · montre GPS au poignet

> Je cours avec ma montre. Elle mesure mieux, elle me donne ma fréquence cardiaque, et je n'ai
> pas envie de courir avec mon téléphone. J'active Health Connect dans les Réglages, en me
> disant que mes sorties vont remonter.
>
> Elles ne remontent pas. L'app **écrit** dans Health Connect (`ExerciseSession`, `Distance`)
> mais ne **lit** que le poids, les pas et le cycle `→ F25`. Il n'y a pas non plus d'import GPX
> ou FIT — l'export existe, pas l'entrée.
>
> Alors je saisis à la main. Sauf qu'il n'y a **aucune saisie rétroactive** `→ F26` : la seule
> façon de créer une course est de la démarrer en temps réel depuis l'app. Je ne peux pas
> journaliser la sortie d'hier, ni mon dossard de dimanche.
>
> J'essaie le mode « sans GPS » pour au moins consigner mes 45 minutes. Je regarde le chrono
> pendant 45 minutes. Je tape Stop. Le résumé m'affiche **« Durée — »** et **« Allure — »**, et
> me demande seulement une distance `→ F15`. Les 45 minutes ne sont **nulle part**. Ma course
> compte pour zéro seconde dans mes statistiques.
>
> Sur le tapis en hiver, ce sera pareil.

**Ce que Sofia retient** : l'app ne peut pas être son journal d'entraînement.

### 2.4 Thomas — avancé · entraîneur amateur · 6 séances/semaine, plan sur 16 semaines

> Ce qui m'intéresse, c'est la structure. Et sur le papier elle y est : segments typés,
> échauffement, gammes, rampes d'allure, groupes imbriqués, plan de passage par km, compte à
> rebours de course, adaptation selon la douleur et l'énergie du jour. C'est du bon travail.
>
> Mais je ne peux pas construire un plan de 16 semaines : le modèle ne porte **qu'une semaine
> répétée** `→ F35`. Je ne peux pas réutiliser une séance : il n'y a pas de bibliothèque de
> séances, pas de duplication de séance ni de segment, pas de modèle « 6×400 » `→ F34`. Chaque
> séance se resaisit intégralement.
>
> La carte « séance du jour » me dit **« retire 25 % des répétitions »**, puis précise qu'elle
> n'a rien modifié `→ F36`. Elle a raison de le préciser, mais alors je dois refaire le calcul
> moi-même, dans l'éditeur à 70 contrôles, un mardi matin à 6 h.
>
> Mon historique : 400 courses, toutes rendues d'un coup dans un `ScrollView` non virtualisé
> `→ F23`. Aucun filtre, aucun regroupement par mois, aucune recherche, et une ligne ne dit même
> pas de **quel type** était la séance `→ F24`. Retrouver « mon dernier 10×400 » est impossible.
>
> Et je ne peux **supprimer aucune course** `→ F18`. Le jour où le GPS a déliré et m'a décerné
> un record du 1 km à 2:41, ce record est là pour toujours — et il fausse mon allure de
> référence, donc **toutes** mes allures cibles.

**Ce que Thomas retient** : de très bonnes fondations qu'il ne peut ni alimenter, ni corriger,
ni faire grandir.

---

## 3. 🔴 Les cinq défauts bloquants

### F15 — Le mode sans GPS n'enregistre aucune durée · **le plus grave**

**Ce que voit l'utilisateur.** Il choisit « sans GPS », regarde un chrono pendant 45 minutes,
tape Stop, et le résumé affiche `Durée : —` et `Allure : —`. Il ne lui est proposé qu'un champ
**distance**. Sa séance compte pour **zéro seconde** dans ses statistiques de temps.

**La chaîne de cause, vérifiée.**

- `runs.duration_seconds` n'est écrit que par `flushTrack`
  ([run-repository.ts:838](../../apps/mobile/src/data/repositories/run-repository.ts#L838)).
- `flushTrack` n'est appelé que par le tracker
  ([tracker-task.ts:359](../../apps/mobile/src/running/tracker-task.ts#L359),
  [tracker.ts:208](../../apps/mobile/src/running/tracker.ts#L208)).
- `startTracking` n'est appelé qu'**en mode GPS** :
  [run/index.tsx:60-62](../../apps/mobile/src/app/run/index.tsx#L60-L62) → `if (source === 'gps')`.
- `finishRun` se contente de relire la colonne :
  `const durationSeconds = row?.duration_seconds ?? null`
  ([run-repository.ts:921](../../apps/mobile/src/data/repositories/run-repository.ts#L921)).
- `setManualRunDistance` ne peut donc pas calculer d'allure
  ([run-repository.ts:1013](../../apps/mobile/src/data/repositories/run-repository.ts#L1013)).
- Le résumé n'offre **aucun champ de durée** — seulement la distance
  ([summary.tsx](../../apps/mobile/src/app/run/summary.tsx), section `manualDistance`).

**Pourquoi les tests ne l'ont pas vu.** Le test du chemin manuel **simule le tracker à la main** :

```ts
// run-sql.test.ts:270-278
const id = await startRun('manual');
// La durée d'une course manuelle est posée par le tracker avant la clôture ; la distance,
// elle, reste à saisir à la main.
await flushTrack(id, { ...segment('a'), durationSeconds: 1800 });
```

Le commentaire énonce une hypothèse **fausse en production** : en mode manuel, aucun tracker ne
tourne. Le test passe, la fonctionnalité est cassée. C'est le cas d'école du test qui valide sa
propre mise en scène.

**Ce que ça contredit.** La roadmap ligne 5.21 est marquée **✅** :
« *Mode sans GPS — Suivi à la durée seule (streak + historique, exclu des records). **Couvre aussi
le tapis.*** » La durée seule est précisément ce qui n'est pas suivi. Et `RUN_TERRAINS` contient
`treadmill` : le tapis est un usage revendiqué.

**Correctif.** Deux options, non exclusives :
1. **Minimal** — à la clôture d'une course manuelle, écrire `duration_seconds` depuis
   `now − started_at` moins les pauses locales.
2. **Juste** — faire du mode manuel un vrai mode : chrono local avec pause réelle, champ durée
   **et** distance éditables sur le résumé (et sur l'écran actif). C'est aussi ce qui débloque la
   saisie rétroactive (`→ F26`) : une course manuelle sans chrono, c'est une saisie d'après-coup.

---

### F9 — Le chrono affiché n'est pas le chrono enregistré

**Ce que voit l'utilisateur.** L'écran de course affiche **32:10**. Le résumé affiche **29:45**.
Et pendant une pause — manuelle ou automatique — le chrono **continue de défiler**, ce qui donne
l'impression que le bouton Pause ne fait rien.

**La cause.** Deux horloges, dont une seule est persistée.

- Affichage : `useElapsedSeconds(active?.startedAt)` = `now − startedAt`, **horloge murale**,
  pauses incluses
  ([active.tsx:43-52](../../apps/mobile/src/app/run/active.tsx#L43-L52), rendu
  [active.tsx:254-256](../../apps/mobile/src/app/run/active.tsx#L254-L256)).
- Persistance : `netDurationS += dt` **seulement hors pause**
  ([tracker-task.ts:305-330](../../apps/mobile/src/running/tracker-task.ts#L305-L330)).

L'incohérence est même visible **dans le même écran** : l'allure moyenne, elle, utilise la durée
nette (`durationForPace = active?.durationSeconds ?? elapsedSeconds`,
[active.tsx:124](../../apps/mobile/src/app/run/active.tsx#L124)). Le chrono est le seul chiffre
resté sur l'horloge murale.

**Aggravant (F16).** `netDurationS` n'avance que sur un segment GPS jugé fiable. Sous un tunnel,
en forêt dense, entre deux immeubles, **la durée nette n'avance pas non plus** — alors que le
coureur court. L'écart affiché/enregistré se creuse encore.

**Correctif.** Le chrono affiché doit être la **durée nette** : `durationSeconds` du dernier flush
+ le delta local depuis ce flush **si non en pause**. Et la pause doit se voir : chrono figé,
bandeau explicite, teinte différente. Traiter `F16` séparément (avancer la durée sur l'horloge dès
qu'on n'est pas en pause, indépendamment de la qualité du fix).

---

### F20 — Terminer une course ne clôt pas la séance planifiée

**Ce que voit l'utilisateur.** Il court sa séance du mardi. Le résumé lui dit « objectif
atteint ». Le mercredi, **le hub lui propose de démarrer la séance de mardi**. Il doit aller
dans le planning la cocher à la main.

**La cause.** `markPlannedSessionDone` existe
([planned-session-repository.ts:621](../../apps/mobile/src/data/repositories/planned-session-repository.ts#L621))
et n'est appelé **que** depuis un bouton du calendrier
([planning/index.tsx:251](../../apps/mobile/src/app/planning/index.tsx#L251)).
Ni `finishRun` ni le résumé ne l'appellent. Or le hub filtre sur `ps.status = 'planned'`
([run-repository.ts:382](../../apps/mobile/src/data/repositories/run-repository.ts#L382)) : la
séance réapparaît donc tant que personne n'a coché.

**Portée.** Ce n'est pas qu'un affichage. Tout ce qui compte les séances faites est faux :
progression du bloc dans `RaceCountdownCard`, adhérence de la semaine précédente
(`usePriorWeekAdherence`, garde de progression), et le sentiment général que l'app ne suit pas.

**Correctif.** `finishRun` d'une course portant un `planned_session_id` marque la séance `done`
(idempotent, offline-first). Et le résumé affiche la confirmation — « Séance du mardi validée » —
avec la possibilité de la dé-valider si le rattachement était faux.

---

### F11 — Le bouton Stop termine la course sans confirmation ni retour

**Ce que voit l'utilisateur.** Un appui — un frottement dans la poche, une main mouillée — et la
course est **arrêtée, clôturée et quittée**. Aucune confirmation, aucun « reprendre », aucune
annulation.

**La cause.** `onStop` enchaîne `stopTracking()` → `finishRun(runId)` →
`router.replace('/run/summary')`
([active.tsx:296-315](../../apps/mobile/src/app/run/active.tsx#L296-L315)). Il n'y a **qu'un seul
bouton plein** en pied d'écran, et `useKeepAwake` maintient l'écran allumé et donc tactile
pendant toute la course.

**Correctif.**
- Stop en **deux temps** : appui → l'écran passe en pause et propose *Reprendre* / *Terminer* /
  *Supprimer*. C'est le patron de toutes les apps de course, et il règle en même temps `F18`
  (supprimer) et `F14` (pause en mode manuel).
- Ou **appui long** avec anneau de progression.
- Et un **verrouillage d'écran** (`F12`) : la course s'affiche, les gestes sont inertes jusqu'à
  déverrouillage.

---

### F18 — Aucune course ne peut être supprimée

**Ce que voit l'utilisateur.** Une course démarrée par erreur, une trace GPS délirante, 200 m
dans le salon : c'est dans l'historique **pour toujours**.

**La cause.** `cancelRun` (soft delete) existe
([run-repository.ts:966](../../apps/mobile/src/data/repositories/run-repository.ts#L966)) mais
n'est appelé **que** dans le flux de permission refusée
([run/index.tsx:90 et 99](../../apps/mobile/src/app/run/index.tsx#L90-L99)). Aucun écran ne
propose la suppression : ni le résumé, ni la ligne d'historique (pas de balayage), ni l'écran
actif.

**Portée — c'est ce qui rend le défaut bloquant.** Une course fantôme :
- gonfle les statistiques de distance et de temps ;
- entre dans l'**ACWR** (donc dans le signal de risque de blessure) ;
- entre dans la **polarisation** ;
- peut **décerner un record** — et un record 5 km met à jour l'**allure de référence**
  ([running-record-repository.ts:149](../../apps/mobile/src/data/repositories/running-record-repository.ts#L149)),
  qui pilote **toutes** les allures cibles de **toutes** les séances.

Un seul fix GPS aberrant peut donc dérégler tout le système d'allures, **sans recours**.

**Correctif.** Supprimer depuis le résumé et depuis l'historique (balayage), avec confirmation et
recalcul des records. Et, tant qu'on y est, `F19` : pouvoir **corriger** une distance ou un type.

---

## 4. 🟠 Les treize défauts structurants

### F10 — La séance structurée est invisible pendant la course

Le guidage de segment est **uniquement sonore** (`useIntervalGuidance`, voix + vibration,
[active.tsx:134-158](../../apps/mobile/src/app/run/active.tsx#L134-L158)). L'écran affiche
distance, chrono, allure moyenne, allure instantanée, allure cible — et **jamais** :

- dans quel segment on est (échauffement / gammes / fraction / récup / retour au calme) ;
- quelle répétition (« 3 sur 6 ») ;
- ce qui reste dans le segment (250 m, ou 0:40) ;
- ce qui vient après.

Le seul indice visuel est l'allure cible qui **change silencieusement** de valeur quand le
segment tourne (`segmentPace`,
[active.tsx:167-197](../../apps/mobile/src/app/run/active.tsx#L167-L197)).

**Pourquoi c'est structurant.** RUN-F4 a été l'US la plus lourde du pilier — segments typés,
rampes, groupes, curseur de phase persisté. Toute cette machinerie n'a **aucune surface visuelle
en course**. Écouteurs retirés, musique forte, annonce manquée, casque déconnecté : le coureur est
aveugle au milieu de sa propre séance. C'est le défaut qui coûte le plus de valeur par rapport au
travail déjà payé.

**Correctif.** Un bandeau de segment permanent en haut de l'écran de course : nature, répétition
`3/6`, décompte restant, allure cible du segment, et le segment suivant en petit. Et une barre de
progression de la séance entière.

### F27 — Jusqu'à 14 contrôles par segment, 80 par séance

Inventaire réel d'**un** segment
([IntervalBlockEditor.tsx](../../apps/mobile/src/components/running/IntervalBlockEditor.tsx)) :

| # | Contrôle | Type |
|---:|---|---|
| 1 | Nature du segment | 5 puces |
| 2 | Répétitions | champ |
| 3 | Phase rapide : distance / durée | bascule |
| 4 | Valeur de la phase | champ |
| 5 | % VMA | champ |
| 6-7 | Allure de la fraction min – max | 2 champs `m:ss` |
| 8 | Allure progressive | bascule |
| 9-10 | Chrono cible min – max | 2 champs `m:ss` |
| 11 | Nature de la récupération | 4 puces |
| 12-13 | Groupe : clé + répétitions | 2 champs |
| 14 | Récupération : aucune / distance / durée + valeur | bascule + champ |

**Tous dépliés en permanence**, sans regroupement, sans repli, sans mode simplifié. Une séance de
fractionné réaliste (échauffement + gammes + corps + récup + retour au calme) = **5 segments**,
soit **70 contrôles** pour une séance que Marc décrirait à l'oral en huit mots.

`CollapsibleCard` existe déjà dans le dépôt
([components/CollapsibleCard.tsx](../../apps/mobile/src/components/CollapsibleCard.tsx), utilisé
par le détail de programme) et n'est **pas** employé ici.

**Correctif.** Trois niveaux de dévoilement :
1. **Ligne compacte repliée** : `Corps · 6 × 400 m @ 4:05 · R 200 m` — lecture immédiate, aucune
   saisie visible.
2. **Dépli essentiel** : nature, répétitions, étendue, allure. Quatre contrôles.
3. **Dépli avancé** (« Réglages fins ») : %VMA, chrono cible, rampe, nature de récup, groupe.

### F28 — Le champ « Groupe » expose une clé de base de données

Pour écrire `3 × (800 m + 400 m)`, l'utilisateur doit **taper la même chaîne de caractères
arbitraire** dans le champ « Groupe » de deux segments consécutifs, puis un nombre de répétitions
([IntervalBlockEditor.tsx:476-508](../../apps/mobile/src/components/running/IntervalBlockEditor.tsx#L476-L508)).
Le texte d'aide l'explique, mais aucun utilisateur ne devinera ni ne retiendra ce mécanisme.

**Correctif.** Sélectionner deux segments contigus → *Répéter la sélection* → un pas numérique. La
clé reste en base, invisible.

### F1 — Le profil coureur est hors du pilier

`/running-profile` n'est atteignable que depuis :
- les **Réglages de l'application**
  ([settings.tsx:322](../../apps/mobile/src/app/settings.tsx#L322)) ;
- un lien enfoui dans une carte d'analyse d'allure
  ([PaceCurveCards.tsx:166](../../apps/mobile/src/components/run/PaceCurveCards.tsx#L166)).

Le hub course n'y mène **pas** : ses widgets sont `running-history`, `running-programs`,
`running-planning`, `running-training-time`
([widgets.ts:93-100](../../packages/shared/src/widgets.ts#L93-L100)).

Or ce profil porte :
- l'**allure de référence 5 km**, qui pilote toutes les allures cibles dérivées, les zones
  d'allure, la polarisation et les prédictions Riegel ;
- les **deux réglages audio** (annonces périodiques, guidage de segment), tous deux **désactivés
  par défaut**.

**Conséquence directe.** Les fonctionnalités audio livrées par RUN-F2a et RUN-F2d sont éteintes au
départ et leur interrupteur est **hors du pilier**. Un utilisateur qui ne fouille pas les Réglages
ne saura jamais qu'elles existent. Et les écrans qui affichent « Renseigne ton profil »
(`running.program.noProfileHint`) ne proposent **aucun lien** pour y aller.

**Correctif.** Le profil coureur devient une entrée de premier rang du hub (et un widget), et
chaque message « Renseigne ton profil » devient **tappable**.

### F2 — L'allure de référence est une question impossible pour un débutant

Le champ demande « **ton allure actuelle sur 5 km** »
(`running.profile.ref5kHint`). Aucun repli : pas de VMA, pas de test guidé (6 min / 12 min /
Cooper), pas d'estimation depuis une course récente, pas d'option « je ne sais pas ».

L'allure se remplit **automatiquement** — mais seulement le jour où un record 5 km tombe
([running-record-repository.ts](../../apps/mobile/src/data/repositories/running-record-repository.ts)).
D'ici là, le pilier fonctionne **en mode dégradé silencieux** : aucune allure cible dérivée,
aucune zone d'allure, aucune polarisation, aucune prédiction.

**Correctif.** Trois portes d'entrée équivalentes : *je connais mon allure* / *j'ai un chrono sur
une distance* (10 km, semi… → Riegel inversé, le code existe déjà) / *je fais le test* (test
guidé). Plus une quatrième : *estime depuis mes courses* dès qu'il y a assez d'historique.

### F17 — Le résumé est un formulaire de douze sections, action principale en bas

Ordre actuel de [summary.tsx](../../apps/mobile/src/app/run/summary.tsx) : célébration de record →
métriques → comparaison à l'objectif → distance manuelle → carte → splits par km → fraction par
fraction → **3 cartes d'analyse de courbe d'allure** → export GPX → partage → RPE → terrain →
notes → **Terminé**.

Le geste attendu trente secondes après l'effort — noter son ressenti et fermer — exige de
traverser **toute l'analyse**. Et le champ RPE, qui est la seule donnée que seul l'utilisateur peut
fournir, est **en onzième position**.

**Correctif.** Deux temps.
1. **« C'est fait »** : les 4 chiffres clés, la validation de séance (`→ F20`), le RPE, un bouton
   *Enregistrer*. Un écran, aucun défilement.
2. **« Analyser »** : tout le reste, à la demande.

### F22 — L'historique est un mur de huit analyses sans hiérarchie

[running-history/index.tsx](../../apps/mobile/src/app/running-history/index.tsx) empile dans un
seul défilement : statistiques par période, courbe d'allure, liste des courses, records,
prédictions Riegel, charge d'entraînement **ACWR**, **polarisation** face au repère 80/20, et les
lectures de courbe d'allure.

Léa, avec trois courses au compteur, tombe sur l'ACWR et la polarisation. Thomas, lui, ne trouve
pas ce qu'il cherche parce que tout est au même rang.

**Correctif.** Trois onglets — **Journal** (la liste, filtrable) · **Progression** (courbes,
volumes, charge) · **Records** (records, prédictions) — et un dévoilement progressif : les
analyses qui exigent un socle de données restent **absentes** jusqu'à ce qu'elles aient quelque
chose à dire (le patron existe déjà : `PolarisationSection` rend `null`, c'est la bonne idée à
généraliser).

### F23 — La liste des courses n'est ni virtualisée, ni filtrable, ni groupée

`runs.map(...)` dans un `ScrollView`
([running-history/index.tsx:418-450](../../apps/mobile/src/app/running-history/index.tsx#L418-L450)) :
**toutes** les courses de l'historique sont montées d'un coup. Aucun filtre (type, période,
terrain, planifiée/libre), aucun regroupement par mois, aucune recherche, aucune pagination.

Deux problèmes en un : **on ne trouve rien**, et **ça ralentit continûment** avec l'usage.

**Correctif.** `FlatList`/`FlashList`, en-têtes de section par mois avec total de la période, et
une barre de filtres.

### F24 — Une ligne d'historique ne dit pas ce qu'était la course

Elle affiche date · distance · durée · allure. Pas de type de séance, pas de nom, pas de mention
« séance planifiée », pas de RPE, pas d'heure, pas de terrain, pas de dénivelé.

Impossible de distinguer d'un coup d'œil un footing de récupération d'un 10×400. Ce défaut et le
précédent se renforcent : sans badge **et** sans filtre, l'historique est une liste de nombres.

*Note* : `runs` ne porte **pas** de `session_type` (verrou documenté dans ALLURE-01 et qui laisse
RUN-07 en attente). Le badge peut néanmoins être dérivé par le lien `planned_session_id` pour les
séances planifiées, et resterait vide pour les courses libres — ce qui est déjà une information.

### F4 — Trois gestes pour partir, et un choix de mode redemandé chaque fois

Hub → *Démarrer une course* → écran `/run` → (choix GPS/manuel) → *Démarrer*. Le mode est
réinitialisé à `'gps'` à chaque ouverture
([run/index.tsx:38](../../apps/mobile/src/app/run/index.tsx#L38)) et n'est jamais mémorisé, alors
qu'il ne change quasiment jamais pour un utilisateur donné.

La roadmap 5.13 promet « GPS + chronomètre **d'un tap** » et est marquée ✅.

**Correctif.** Le bouton du hub démarre **directement** avec le dernier mode utilisé. Le choix de
mode devient un appui long, ou une ligne discrète sur l'écran de préparation.

### F26 — Aucune saisie rétroactive

`startRun` n'est appelable que depuis `/run`, en temps réel
([run/index.tsx:58 et 100](../../apps/mobile/src/app/run/index.tsx#L58-L100)). Il est donc
**impossible** de journaliser :

- la course d'hier faite sans téléphone ;
- un dossard ;
- une sortie enregistrée par la montre (`→ F25`) ;
- une séance de tapis notée après coup.

C'est le complément indispensable de `F25` : sans import **et** sans saisie rétroactive, l'app ne
peut pas être le journal d'entraînement de quelqu'un qui ne court pas téléphone en main.

**Correctif.** « Ajouter une course » : date, heure, durée, distance, type, ressenti — et
rattachement optionnel à une séance planifiée passée.

### F32 — L'éditeur de séance étale onze champs à plat

[RunningSessionEditor.tsx](../../apps/mobile/src/components/running/RunningSessionEditor.tsx) rend,
dans une seule carte et sans repli : type (6 puces) · bascule cible · champ cible · allure
calculée · allure cible min–max · chrono cible · **RPE cible** · **consigne** ·
**critère d'adaptation** · plan de passage · liste de segments.

Deux de ces champs sont des concepts d'entraîneur offerts au même rang que « Distance » :
**« critère d'adaptation »**, champ texte libre sans mode d'emploi (`→ F33`), et le RPE cible.

**Correctif.** Même dévoilement progressif que `F27` : *Essentiel* (type, cible, allure) /
*Consignes* (texte, RPE, adaptation) / *Structure* (segments) / *Course* (chrono, plan de passage).

### F34 — Aucun modèle, aucune réutilisation de séance

Il existe une bibliothèque de **programmes** (3 publiés). Il n'existe **rien** au niveau de la
séance : pas de bibliothèque de séances types, pas de duplication de séance, pas de duplication de
segment, pas de saisie abrégée.

Conséquence : chaque `6×400 m` du monde se resaisit à la main, 42 contrôles à la fois.

**Correctif** (par ordre de rapport valeur/effort) :
1. **Dupliquer un segment** — un bouton, un jour de travail, supprime la moitié de la saisie
   répétitive.
2. **Dupliquer une séance** dans un programme.
3. **Modèles de séance** — un petit catalogue (`6×400`, `10×400`, `3×1000`, `2×(3×300)`, `pyramide
   200-400-600-400-200`, `tempo 20 min`) qui pré-remplit les segments.
4. **Saisie en une ligne** — `2km éch + 6x400/200 + 1km rac` interprété en segments. C'est ce que
   demanderait Thomas, et ce qui rendrait le pilier réellement rapide.

---

## 5. 🟡 Les vingt-deux frictions de finition

| # | Constat | Où | Effet |
|---|---|---|---|
| **F3** | Aucun accueil du pilier au premier lancement : un bouton et quatre tuiles vides | hub | Le débutant ne sait pas par où commencer |
| **F5** | Aucun compte à rebours au départ — pourtant spécifié roadmap 5.13 et marqué ✅ | `run/index.tsx` | Le chrono part téléphone en main |
| **F6** | Aucune attente de fix GPS : la course est créée et le chrono lancé avant le premier point | `run/index.tsx:56-72` | Premiers hectomètres perdus, allure moyenne absurde au départ |
| **F7** | Le contexte de la séance planifiée disparaît sur l'écran de départ (`plannedSessionId` ne sert qu'à `startRun`) | `run/index.tsx` | La consigne qu'on vient de lire s'évapore |
| **F8** | Permission refusée : la course est créée, annulée, puis recréée | `run/index.tsx:87-104` | Course fantôme + boîte de dialogue évitable |
| **F12** | Aucun verrouillage d'écran, alors que `useKeepAwake` garde l'écran tactile toute la course | `active.tsx:70` | Appuis involontaires (aggrave F11) |
| **F13** | Écran de course figé et non paramétrable : distance toujours en 72 px | `active.tsx` | Celui qui court à la durée ou en fractionné n'a pas son chiffre en héros. Le hub est personnalisable, l'écran de course non |
| **F14** | Mode manuel : pas de bouton pause, aucun champ | `active.tsx:520` | Le mode manuel n'est pas un mode, c'est une absence |
| **F16** | La durée nette n'avance pas quand le GPS décroche (`netDurationS` dans la branche « segment fiable ») | `tracker-task.ts:328` | Durée sous-comptée en tunnel/forêt (aggrave F9) |
| **F19** | Aucune correction possible d'une course (distance, type, date). Seuls RPE, notes, terrain sont éditables | `summary.tsx` | Une donnée fausse est définitive |
| **F21** | Tableau « fraction par fraction » : colonne de libellé figée à 52 px, et le prévu n'affiche qu'**une** borne (`range.min ?? range.max`) | `summary.tsx` | « Récupération » tronqué ; la plage cible illisible *(déduit du style, à confirmer sur device)* |
| **F25** | Health Connect : `ExerciseSession` et `Distance` en **écriture seule** ; seuls poids, pas et cycle sont importés | `health-connect.ts:108-109`, `useHealthConnectImports.ts:33-35` | Une sortie enregistrée à la montre n'entre jamais. Ni import GPX/FIT (l'export existe) |
| **F29** | Trois expressions concurrentes de l'intensité affichées ensemble (%VMA, allure, chrono cible), priorité invisible | `IntervalBlockEditor.tsx` | On ne sait pas lequel gagne |
| **F30** | Les durées courtes se saisissent en **minutes décimales** : 45 s s'affiche « 0.75 » | `IntervalBlockEditor.tsx:64-66` | Saisie contre-intuitive sur le champ le plus fréquent d'un fractionné |
| **F31** | Distance de séance en unités d'affichage, distance de segment en **mètres bruts** non convertis | `IntervalBlockEditor.tsx:38-40` | L'utilisateur impérial voit des mètres au milieu de miles |
| **F33** | « Critère d'adaptation » : champ texte libre, concept d'entraîneur, même rang que « Distance » | `RunningSessionEditor.tsx` | Champ ignoré ou mal rempli |
| **F35** | **Aucune progression d'une semaine à l'autre** : `sessions` n'a pas de `week_index`, `planProgram` répète le même patron hebdo | `planned-session-repository.ts:493-540` | Un « 10 km en 8 semaines » ne peut pas faire grandir sa sortie longue. **Structurel** — voir §6.4 |
| **F36** | La carte d'adaptation propose « retire 25 % des répétitions » et n'agit pas, sans bouton d'application | `SessionAdaptationCard.tsx` | L'app calcule, l'utilisateur exécute à la main |
| **F37** | Le hub ne montre qu'une action et rien de la semaine (pas de « 3 prévues, 1 faite », pas de prochaine séance si elle n'est pas aujourd'hui) | `(tabs)/running.tsx` | Aucune vue d'ensemble |
| **F38** | Le détail d'un programme éditorial n'offre ni *Planifier* ni *Modifier*, seulement *Dupliquer* — sans dire pourquoi | `running-programs/[id].tsx:200-233` | L'utilisateur croit à un bug |
| **F39** | Profil coureur : pas de `ScreenHeader`, bouton « Retour » en pied **en plus** de la flèche d'en-tête | `running-profile.tsx:272` | Redondance et écran sans titre |
| **F40** | « Fréquence hebdo visée » est saisie et **n'est lue nulle part** | `running-profile.tsx:118-124` | Question posée sans effet — aucun rapprochement prévu/réalisé |

---

## 6. Les quatre causes racines

Les 40 constats ne sont pas 40 problèmes indépendants. Ils se ramènent à quatre.

### 6.1 La surface n'a pas suivi le calcul

C'est la cause dominante. Le pilier a accumulé un moteur remarquable — `resolveSessionPace`,
`expandIntervalPhases`, `progressivePaceTarget`, `computeKmSplits`, `computeAcwr`,
`resolveRacePredictions`, `evenPacingPlan`, `session-adaptation` — et chaque US a ajouté **une
ligne de texte** dans un écran existant plutôt qu'un endroit à elle.

D'où : la séance structurée pilotée à la voix sans écran (`F10`), l'adaptation qui conseille sans
agir (`F36`), le résumé à douze sections (`F17`), l'historique à huit analyses (`F22`).

**Le principe à poser** : une fonctionnalité n'est pas livrée quand son calcul est juste et testé ;
elle est livrée quand **l'utilisateur peut la voir et l'utiliser au moment où elle sert**.

### 6.2 Aucun dévoilement progressif

Le pilier a **un seul niveau de lecture**, calé sur l'utilisateur le plus expert. Tout est affiché
tout le temps : 14 contrôles par segment, 11 champs par séance, 8 analyses par historique, 12
sections par résumé.

Or `CollapsibleCard` existe, et `PolarisationSection` sait déjà se taire quand elle n'a rien à
dire. Les briques sont là ; c'est le **principe** qui n'est pas posé.

**Le principe à poser** : trois niveaux — *ce que tout le monde voit* / *ce qu'on déplie* /
*ce qu'on active*. Et une règle déjà appliquée par endroits, à généraliser : **rien à dire, rien à
l'écran**.

### 6.3 Les boucles ne se referment pas

Le pilier ouvre des boucles qu'il ne ferme pas :

- prévu → réalisé → **coché** : la dernière étape est manuelle et ailleurs (`F20`) ;
- démarrer → courir → **corriger/supprimer** : impossible (`F18`, `F19`) ;
- conseiller → **appliquer** : impossible (`F36`) ;
- courir dehors → **entrer dans l'app** : impossible (`F25`, `F26`) ;
- afficher un chrono → **l'enregistrer** : cassé (`F9`, `F15`).

**Le principe à poser** : toute donnée affichée doit être **corrigeable**, tout conseil doit être
**applicable**, toute intention doit être **clôturable** là où l'utilisateur se trouve.

### 6.4 Le modèle de programme ne porte qu'une semaine

`sessions` n'a pas de `week_index`
([migration 20260706130000](../../supabase/migrations/20260706130000_programmes_tables.sql)) et
`planProgram` répète le patron hebdomadaire pendant N semaines. Un programme est donc **une semaine
type répétée**, jamais un plan progressif.

C'est la seule cause racine qui touche le **modèle de données** et non la surface. Elle explique
pourquoi Marc et Thomas devront de toute façon rééditer à la main — et donc pourquoi le coût de
saisie (`F27`, `F34`) est encore plus lourd qu'il n'y paraît.

**À trancher explicitement.** Trois options :
1. **Assumer** : les programmes restent des semaines types ; la progression se fait en dupliquant
   et en éditant. Coût nul, promesse revue à la baisse (« 10 km en 8 semaines » devient trompeur).
2. **`week_index` sur `sessions`** : une séance appartient à une semaine du programme. Migration
   additive, `planProgram` et l'éditeur à revoir. C'est la vraie réponse.
3. **Règles de progression** : `+10 %/semaine` sur la sortie longue, semaine de décharge toutes
   les 4. Plus élégant, moins expressif, et ça n'exprime pas un plan réel.

Ma recommandation : **option 2**, mais **après** les P0 et le lot d'ergonomie — c'est un chantier
de modèle, pas une amélioration d'ergonomie, et il ne bloque pas le lancement.

---

## 7. Le pilier refondu — les écrans cibles

Les maquettes correspondantes sont dans [design/audit-course/](../../design/audit-course/).

### 7.1 Découvrir — trois questions, pas un formulaire

```
Activation du pilier Course
        │
        ├─ « Tu cours plutôt … »   → libre / je suis un plan / je prépare une course
        ├─ « Ton allure de réf. »  → je la connais · j'ai un chrono · je fais un test · plus tard
        └─ « La voix pendant la course ? » → oui / non   ← les 2 réglages audio, ici et pas
                                                            dans les Réglages de l'app
        ▼
   Hub course, déjà utile
```

Trois écrans, trois questions, et la possibilité de répondre « plus tard » à chacune. Règle le
`F1`, le `F2` et le `F3` d'un coup, et **allume les fonctionnalités audio déjà payées**.

### 7.2 Le hub — l'action, la semaine, l'accès

```
┌──────────────────────────────────────────┐
│  COURSE                          ⚙ Profil│  ← F1
├──────────────────────────────────────────┤
│  ▶  MARDI — 6×400 m                      │
│     Allure 4:05–4:10 · 8,2 km            │
│     « ne pas accélérer le 1er 1000 m »   │
│     ┌────────────────┐ ┌───────────────┐ │
│     │  DÉMARRER      │ │ Voir la séance│ │  ← F4 : part directement
│     └────────────────┘ └───────────────┘ │
├──────────────────────────────────────────┤
│  MA SEMAINE     ●●○  2 faites / 3        │  ← F37
│  18,4 km · 1 h 42                        │
├──────────────────────────────────────────┤
│  ⚠ Séance du jour : jambes lourdes       │
│     Retirer 25 % des répétitions ?       │
│     [ Appliquer aujourd'hui ]  [ Ignorer]│  ← F36 : la carte agit
├──────────────────────────────────────────┤
│  Historique │ Programmes │ Planning │ …  │
└──────────────────────────────────────────┘
```

### 7.3 Partir — préparer, puis partir

```
[DÉMARRER] du hub
     │
     ▼
┌────────────────────────────────┐
│  MARDI — 6×400 m               │  ← F7 : la consigne reste visible
│  2 km éch · 6×400 @4:05 · 1 km │
│  ────────────────────────────  │
│  ● GPS prêt — précision 4 m    │  ← F6 : on attend le fix
│  ⌚ 22 min estimées             │
│  ────────────────────────────  │
│  Mode : GPS ▾   (mémorisé)     │  ← F4
│  Départ dans : 3 s ▾           │  ← F5 : le compte à rebours promis
│  ┌──────────────────────────┐  │
│  │        C'EST PARTI       │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

Et en mode manuel, le même écran propose *Chronométrer maintenant* **ou** *Saisir une course
passée* — ce qui règle `F26` sans écran supplémentaire.

### 7.4 Courir — le segment d'abord

```
┌────────────────────────────────────────┐
│ ● GPS 4 m                        ⟳ sync│
├────────────────────────────────────────┤
│  FRACTION 3/6            reste 250 m   │  ← F10 : le bandeau qui manque
│  Cible 4:05–4:10    ██████░░░░░░       │
│  Puis : récup 200 m trot               │
├────────────────────────────────────────┤
│                                        │
│            4:07  /km                   │  ← le chiffre utile du moment
│                                        │
│   3,42 km        12:48 net             │  ← F9 : durée NETTE, et « net » écrit
│                                        │
├────────────────────────────────────────┤
│  [ carte ]                             │
├────────────────────────────────────────┤
│  🔒 Verrouiller   ⏸ Pause    ■ Arrêter │  ← F12 · F11 en 2 temps
└────────────────────────────────────────┘
        │ appui sur Arrêter
        ▼
   ⏸ EN PAUSE — chrono figé
   [ Reprendre ]  [ Terminer ]  [ Supprimer ]   ← F11 · F18
```

Deux points structurants :
- **le chiffre en héros change selon la séance** (`F13`) : allure en fractionné, distance en
  sortie longue, chrono en course à la durée — avec un réglage pour l'imposer ;
- **« net »** est écrit à côté du chrono. C'est un mot, et il supprime la surprise du résumé.

### 7.5 Clore — c'est fait, puis analyser

```
┌────────────────────────────────┐        ┌──────────────────────────┐
│  🏅 Record 5 km !              │        │  ANALYSER                │
│  ──────────────────────────    │        │  Splits par km           │
│  8,21 km   42:18   5:09/km     │        │  Fraction par fraction   │
│  ──────────────────────────    │  ───▶  │  Courbe d'allure         │
│  ✓ Séance de mardi validée     │← F20   │  Carte · Dénivelé        │
│  ──────────────────────────    │        │  Zones d'allure          │
│  Ressenti  ① ② ③ ④ ⑤ ⑥ ⑦ ⑧ ⑨ ⑩ │        │  Export GPX · Partager   │
│  ┌──────────┐  ┌────────────┐  │        │  Corriger · Supprimer    │← F18·F19
│  │ ENREGISTRER│ │  Analyser  │  │        └──────────────────────────┘
│  └──────────┘  └────────────┘  │
└────────────────────────────────┘
   un écran, zéro défilement                tout le reste, à la demande
```

### 7.6 Préparer — la séance en une ligne, les réglages fins au dépli

```
SÉANCE — Mardi                                        [ Modèles ▾ ]  ← F34
┌────────────────────────────────────────────────────────────────┐
│ ≡  Échauffement · 2 km · souple                          ⌄  ⧉  │  ← replié : lisible
│ ≡  Gammes · 4 × 30 s                                     ⌄  ⧉  │     ⧉ = dupliquer
│ ≡  Corps · 6 × 400 m @ 4:05  ·  R 200 m trot             ⌃  ⧉  │
│    ┌──────────────────────────────────────────────────┐        │
│    │ Nature   [Corps ▾]      Répétitions  [ 6 ]       │        │  ← essentiel : 4
│    │ Étendue  [ 400 ] m      Allure  [4:05]–[4:10]    │        │
│    │ Récup    [ 200 ] m      [trot ▾]                 │        │
│    │ ▸ Réglages fins  (%VMA, chrono cible, rampe)     │        │  ← F27·F29 replié
│    └──────────────────────────────────────────────────┘        │
│ ≡  Retour au calme · 1 km                                ⌄  ⧉  │
├────────────────────────────────────────────────────────────────┤
│  [ + Segment ]   [ ⧉ Répéter la sélection ]                    │  ← F28 : plus de clé
├────────────────────────────────────────────────────────────────┤
│  Écrire en une ligne :  2km éch + 6x400/200 + 1km rac      [→] │  ← F34
└────────────────────────────────────────────────────────────────┘
```

---

## 8. Plan de travail proposé

Découpage en **US candidates**, prêtes à entrer dans le pipeline `/us`. L'ordre est celui que je
recommande : les défauts qui **trompent l'utilisateur** d'abord, ceux qui le **perdent** ensuite,
le **modèle** en dernier.

### Lot 0 — P0, corriger ce qui est faux *(à faire avant toute recette de course)*

| US | Titre | Constats | Charge |
|---|---|---|---|
| **CARDIO-01** | Le chrono affiché est le chrono enregistré | F9, F16 | S |
| **CARDIO-02** | Le mode sans GPS enregistre sa durée | F15, F14 | M |
| **CARDIO-03** | Terminer une course clôt la séance planifiée | F20 | S |
| **CARDIO-04** | Arrêt en deux temps + supprimer une course | F11, F12, F18, F19 | M |

> Ces quatre-là ne sont pas de l'ergonomie, c'est de la **justesse**. `CARDIO-02` remet aussi en
> cause le statut ✅ de la roadmap 5.21 — à reprendre dans la réconciliation.

### Lot 1 — P1, rendre le pilier lisible

| US | Titre | Constats | Charge |
|---|---|---|---|
| **CARDIO-05** | Bandeau de segment en course + héros adaptatif | F10, F13 | M |
| **CARDIO-06** | Éditeur de segment à trois niveaux + répéter une sélection | F27, F28, F29, F30, F31 | L |
| **CARDIO-07** | Le profil coureur entre dans le pilier + accueil en 3 questions | F1, F2, F3, F39, F40 | M |
| **CARDIO-08** | Résumé en deux temps | F17, F21 | M |
| **CARDIO-09** | Historique en trois onglets, liste virtualisée et filtrable | F22, F23, F24 | L |
| **CARDIO-10** | Partir en un geste : mode mémorisé, fix GPS, compte à rebours, contexte de séance | F4, F5, F6, F7, F8 | M |
| **CARDIO-11** | Ajouter une course passée | F26 | M |
| **CARDIO-12** | Éditeur de séance replié + modèles de séance | F32, F33, F34 | L |

### Lot 2 — P2, finir

| US | Titre | Constats | Charge |
|---|---|---|---|
| **CARDIO-13** | Le hub montre la semaine | F37 | S |
| **CARDIO-14** | La carte d'adaptation s'applique | F36 | M |
| **CARDIO-15** | Programme éditorial : dire pourquoi il faut dupliquer | F38 | S |
| **CARDIO-16** | Import des séances depuis Health Connect (+ GPX) | F25 | L |

### Lot 3 — Modèle *(après le lancement)*

| US | Titre | Constats | Charge |
|---|---|---|---|
| **CARDIO-17** | Un programme porte des semaines qui progressent | F35 | XL |

### Ce que je recommande de faire tout de suite

Si un seul lot doit partir, c'est **le lot 0** : quatre US, dont deux petites, et il supprime les
deux cas où l'app **affiche à l'utilisateur un chiffre qui n'est pas le sien**. Aucune des 49
recettes en attente ne devrait être passée sur le pilier Course avant `CARDIO-01` et `CARDIO-02` —
un recetteur qui compare son chrono à son résumé va signaler le défaut, et il aura raison.

Ensuite, par rapport valeur/effort, du plus rentable au moins : **CARDIO-05** (le bandeau de segment débloque
toute la valeur de RUN-F4, déjà payée), **CARDIO-07** (allume les fonctions audio déjà livrées),
**CARDIO-06** (supprime la première cause d'abandon).

---

## 9. Ce que je n'ai pas pu vérifier

Par honnêteté sur la portée de cet audit :

- **Rien n'a été observé sur device.** Les défauts de rendu (`F21` notamment) sont **déduits des
  feuilles de style**. Ils doivent être confirmés.
- **La qualité réelle du GPS** (seuils `isValidFix` à 30 m, bruit vertical à 3 m,
  `PACE_TOLERANCE_S_PER_KM = 5`) n'est pas jugeable en lecture. Ces trois nombres sont documentés
  comme non validés terrain.
- **Le ressenti sonore** (voix qui coupe la musique, latence de l'annonce à un changement de
  phase) exige une sortie réelle.
- **Les temps de rendu** de `F23` sont un raisonnement (`ScrollView` non virtualisé), pas une
  mesure.
- **Le contenu des 3 programmes publiés** n'a pas été relu du point de vue de l'entraînement.

---

*Ce document est un livrable d'audit. Il ne modifie aucun code, ne crée aucune US et ne change
aucun statut de roadmap. Les US proposées au §8 doivent passer par `/us`
(spec → plan → maquette → validation par Florian ou Damien) avant toute implémentation.*
