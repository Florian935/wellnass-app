---
id: CARDIO-02
titre: "Les quatre portes vers l'allure de référence, et l'accueil du pilier Course"
roadmap: [5.40, 5.45]
catalogue: []
etape: code
branche: feature/cardio02-allure-reference
maj: 23/10/2026
---

# US CARDIO-02 — Les quatre portes vers l'allure de référence, et l'accueil du pilier Course

> Candidat du [BACKLOG](../../../../BACKLOG.md) (P1), issu de l'audit du pilier Course
> ([audit-ergonomie-pilier-course.md](../../../product/audit-ergonomie-pilier-course.md), constats
> **F2**, **F3** et **F39**) et de la section R2 de [CARDIO-UX01](cardio-ux01-refonte-pilier-course.md),
> restée ouverte (roadmap 5.40 🟡).
>
> - Plan : [docs/plans/cardio02-allure-reference.md](../../../plans/cardio02-allure-reference.md).
> - Maquette : toile **CARDIO-02 · Allure de référence**, versée dans
>   [design/cardio02-allure-reference/](../../../../design/cardio02-allure-reference/).
> - Roadmap : **5.40** (R2b et R2c de CARDIO-UX01) et ligne neuve **5.45** (hors cadrage).
> - **Relue par un agent de revue le 23/10/2026** : quinze constats, dont deux bloquants (la mesure
>   du test, l'accueil sur un second téléphone), tous intégrés.
> - ✅ **Validée par Florian le 23/10/2026** : les décisions D1 à D8 telles que proposées.
> - Sessions parallèles du 23/10/2026 (ACCES-IA, IDENT-01, CIBLE-04, CARDIO-08) : cette US ne touche
>   ni `run/analysis.tsx` ni `summarizeIntervalSeries` (CARDIO-08), ni les écrans Muscu et
>   Nutrition, ni Prisme, ni `lab-repository.ts` (CIBLE-04).

## 1. Le problème

L'allure de référence est **le** réglage du pilier Course : elle produit les allures cibles de toutes
les séances (endurance, sortie longue, récupération, fractionné), la VMA estimée pendant la course,
les zones d'allure et la polarisation. Sans elle, le pilier tourne en mode dégradé **sans le dire** :
les séances n'ont pas d'allure cible, et seuls quelques écrans écrivent « Renseigne ton allure de
référence », sans lien.

Or on ne peut la donner que d'une façon : taper « ton allure actuelle sur 5 km » dans le profil
coureur. Léa, la débutante de l'audit, n'a jamais couru 5 km : elle laisse vide (F2). Rien ne
l'accueille quand elle active le pilier (F3). Et le profil où vit ce champ a un bouton « Retour » en
pied, en plus de la flèche de l'en-tête (F39).

Les calculs des autres portes sont écrits et testés depuis CARDIO-UX01 (`referencePaceFromRaceTime`,
Riegel inversé, et `referencePaceFromCooperTest`, dans `packages/shared/src/running-hub.ts`) :
**aucun écran ne les appelle**.

### Ce que dit le code (vérifié le 23/10/2026)

- **a. Où elle vit.** Une colonne : `running_profiles.ref_5k_pace_s_per_km` (secondes par km,
  `numeric`, nullable), une ligne par compte (`user_id` unique), synchronisée (`select *`). Noryn la
  lit aussi, par son nom (`packages/shared/src/noryn/source.ts`).
- **b. Qui l'écrit, aujourd'hui.** Trois chemins :
  1. le champ du profil coureur, **à chaque frappe lisible**, sans aperçu de ce que la valeur
     produit (`running-profile.tsx`, `onPaceChange`) ;
  2. `detectAndStoreRunRecords`, quand un record 5 km est **inséré ou battu**
     (`running-record-repository.ts`) — à la fin d'une course, mais aussi via
     `backfillRunningRecords`, que lancent `deleteRun` et l'ouverture de « Toutes tes stats » ;
  3. `deleteRun`, qui l'efface si elle valait exactement le record supprimé ÷ 5 et qu'aucun 5 km ne
     reste (`run-repository.ts`).
- **c. 🔴 Un défaut latent, que les quatre portes rendraient fréquent.** Le chemin b2 écrase **sans
  condition** toute valeur donnée par l'utilisateur, dès la première sortie GPS qui contient 5 km,
  **même plus lente**. Exemple : un 10 km en 52:30 donne 5:02 /km ; la première sortie de 5 km se
  fait en footing, à 6:30 ; l'allure de référence passe à 6:30 et la bande d'endurance à 7:30–8:00,
  plus lente que le footing lui-même. Rien ne le signale. Le défaut est invisible aujourd'hui parce
  que presque personne ne remplit le champ ; c'est justement ce que cette US change.
- **d. Les entrées.** La carte « Premiers pas » du hub (CARDIO-UX03) porte « Ton allure de référence ·
  La donner », qui ouvre le profil coureur ; elle n'existe que **sans programme**. La carte de la
  séance du jour, elle, n'affiche **rien** quand l'allure manque (`sessionPaceLabel` rend `null`).
  Trois écrans de liste écrivent « Renseigne ton allure de référence » **dans chaque ligne**, sans
  lien : le planning (`planning/index.tsx`, dont les lignes sont déjà touchables), le plan
  (`planning/plan.tsx`) et le détail d'un programme (`running-programs/[id].tsx`) ; l'éditeur de
  séance (`RunningSessionEditor.tsx`) l'écrit une fois. La carte des zones d'allure
  (`PaceCurveCards.tsx`) renvoie au profil.
- **e. Le profil coureur** est une modale avec un en-tête titré et une flèche de retour, plus un
  bouton « Retour » en pied (F39). Il porte aussi le **niveau** (débutant, régulier, confirmé), qui
  n'est lu nulle part ailleurs, et les **deux réglages de voix**, coupés par défaut. Le second
  (« guidage fractionné ») commande aussi les **alertes d'allure** de toute séance (`active.tsx`).
- **f. Aucun accueil de pilier n'existe.** L'onboarding de l'app (`app/(onboarding)/`) demande les
  piliers et le régime de guidage, rien sur la course.

## 2. Décisions proposées — à valider

| # | Question | Proposition | Alternative écartée, et pourquoi |
|---|---|---|---|
| D1 | Où vivent les quatre portes ? | Un écran **« Ton allure de référence »** (`/running-pace`), le même composant servant de question 2 à l'accueil. Rien n'est écrit avant « Retenir cette allure ». | Les portes dans le profil : un écran déjà long, et on y arriverait en deux gestes. |
| D2 | Le test de 12 minutes est-il guidé ? | **Oui.** « Le faire maintenant » lance une course GPS titrée « Test de 12 minutes », **sans auto-pause** ; l'app prévient à 11:00 et à 12:00 (voix et vibration, **même si les annonces vocales sont coupées** : le coureur a demandé un test guidé) ; à l'arrivée, elle mesure la distance à 12:00 sur la trace et propose l'allure. On peut aussi saisir la distance d'un test déjà fait. ⚠️ Comme toutes les annonces de course, elles partent de l'écran de course : **écran éteint, pas d'annonce** (la mesure, elle, reste juste). | La saisie seule : personne ne connaît sa distance à 12:00 sans qu'on la lui mesure. La porte serait vide pour Léa. |
| D3 | Les trois questions de l'accueil | **1. Ce que tu vises** (objectif et sorties par semaine) · **2. Ton allure de référence** · **3. La voix pendant la course**. Chacune a « Plus tard », et « Passer » sort de tout. | « Tu cours plutôt : libre, avec un plan, pour une course » (audit §7.1) : aucun champ ne le porte et rien ne le lirait. Le **niveau** non plus : il n'est lu nulle part (même travers que F40). L'objectif et la fréquence, eux, sont lus (conflits d'objectifs, « Ta semaine », accueil, Labo). |
| D4 | Quand l'accueil s'ouvre-t-il ? | À l'ouverture de l'onglet Course, **une seule fois**, pour un compte **sans profil coureur** (aucune ligne `running_profiles`), **en ligne, après une synchronisation terminée pendant ce lancement**, hors course en cours. La ligne de profil est créée à l'ouverture de l'accueil : c'est le marqueur, synchronisé, sans colonne neuve. | Un drapeau local : l'accueil reviendrait après une réinstallation. Une colonne : une migration pour un booléen. Se fier au seul `hasSynced` : un second téléphone hors ligne créerait une seconde ligne, refusée par l'unicité de `user_id`, et **bloquerait toute sa synchronisation**. |
| D5 | Comment l'allure bouge ensuite ? | Un record 5 km **de fin de course** ne la remplace que s'il est **plus rapide**, ou s'il n'y en a pas (corrige le défaut c). Le recalcul des records ne touche plus jamais au profil. Si la course du record est supprimée et que l'allure venait d'elle, l'allure **suit le record suivant**, ou s'efface. | Garder « tout record l'écrase » : chaque footing de 5 km ruinerait une allure donnée. Ne plus jamais la mettre à jour : on perdrait le progrès mesuré. |
| D6 | Faut-il stocker la provenance ? | **Non, aucune migration.** Elle se déduit : l'allure vaut exactement le record 5 km ÷ 5 → « D'après ton record sur 5 km du 12/10 » ; sinon → « Donnée par toi ». C'est la règle que `deleteRun` applique déjà. | Deux colonnes (source, date) : une migration à pousser avant tout le reste, pour afficher une ligne de texte. |
| D7 | Où mènent les entrées ? | **Directement aux quatre portes** : « La donner » de la carte Premiers pas, une ligne « La donner » ajoutée à la carte de la **séance du jour** quand elle n'a pas d'allure cible faute d'allure de référence, **un seul bandeau** en tête des trois listes (planning, plan, programme), le message de l'éditeur de séance, les zones d'allure, la carte du profil. | Vers le profil : un geste de plus, et l'écran du profil ne répond pas à la question posée. Un lien dans chaque ligne de liste : des cibles imbriquées, répétées autant de fois qu'il y a de séances. |
| D8 | Le profil coureur | La carte **« Ton allure de référence »** monte juste sous le guidage : la valeur, sa provenance, les quatre allures qu'elle produit, et « Changer ». Le bouton « Retour » du pied disparaît (F39). Le reste ne bouge pas. | Refondre tout le profil : hors du problème posé. |

## 3. Ce que voit l'utilisateur

### 3.1 « Ton allure de référence » — les quatre portes

Écran modal (route `/running-pace`), en-tête titré « Ton allure de référence » avec sa flèche de
retour. Sous le titre : « Elle règle toutes tes allures cibles. Choisis ce que tu sais. » Puis quatre
cartes à choix unique (boutons radio), dans cet ordre ; la carte choisie se déplie.

1. **J'ai un chrono récent** — « Sur n'importe quelle distance : on en déduit le reste. »
   - **Tes meilleurs temps enregistrés** (s'il y en a sur 5 km, 10 km, semi ou marathon) : des
     pastilles « 10 km · 54:12 · 03/10 » qui remplissent la porte d'un geste. Ce sont des segments de
     sorties, pas des courses officielles : le libellé le dit.
   - Distance en pastilles : **5 km · 10 km · Semi · Marathon · Autre**. « Autre » ouvre un champ de
     distance dans l'unité d'affichage.
   - Temps : un champ dont l'exemple suit la distance (« 25:00 », « 52:30 », « 1:45:00 »,
     « 3:45:00 ») et dont le libellé dit « m:ss ou h:mm:ss ».
2. **Le test de 12 minutes** — « Tu cours 12 minutes le plus loin possible, l'app mesure. »
   - **Je l'ai déjà fait** : la distance couverte (mètres en métrique, miles à deux décimales en
     impérial). Pré-remplie avec la mesure d'un test guidé dont l'allure n'a pas encore été retenue
     (R8).
   - **Le faire maintenant** (écran `/running-pace` seulement) : le protocole (échauffe-toi
     10 minutes **avant** de lancer ; sur du plat, le plus loin possible, régulier plutôt
     qu'explosif ; garde l'écran allumé, c'est lui qui te prévient ; une pause arrête le test), puis
     « Lancer le test » (§3.2).
3. **Je connais mon allure sur 5 km** — « Ton allure quand tu cours 5 km le plus vite possible, pas
   celle de ton footing. » Un champ `m:ss` par km (ou par mile).
4. **Je ne sais pas encore** — affichée seulement s'il n'y a pas d'allure. « Cours à la sensation :
   tu dois pouvoir parler en courant. On la déduira de ta première sortie GPS de 5 km, ou du test de
   12 minutes quand tu voudras. » N'écrit rien.

**L'aperçu**, dès qu'une porte donne une allure valide, sous les cartes, annoncé au lecteur d'écran :
« Ton allure de référence **5:02 /km** · ≈ 25:10 sur 5 km », puis les quatre allures qu'elle produit
— Endurance fondamentale 6:02–6:32, Sortie longue 5:32–6:02, Récupération active 6:32–7:02,
Fractionné (VMA) 4:47–5:02 (pour un 10 km en 52:30) — et, si une allure existait, « Avant : 5:20 /km ».
Rien n'est écrit tant que le coureur n'a pas appuyé sur **Retenir cette allure** ; l'écran se ferme
alors.

### 3.2 Le test de 12 minutes guidé

1. **Le départ** : l'écran de départ existant (`/run?test=cooper`), titré « Test de 12 minutes »,
   sous-titre « Échauffé ? Cours 12 minutes le plus loin possible. », le protocole en trois lignes et
   « Suivi GPS » sans bascule. Le bouton dit « Lancer le test ».
2. **Pendant** : un bandeau « Test de 12 minutes · reste 7:42 », sur le chrono de l'écran (sans
   auto-pause et sans pause, le chrono net est le temps écoulé depuis le départ). À 11:00 : « Plus
   qu'une minute. » À 12:00 : « Douze minutes, test terminé. Tu peux ralentir. », et le bandeau dit
   « Test terminé · Tu peux ralentir. Termine la course quand tu veux : ta distance t'attend à
   l'arrivée. » Voix et vibration pour ces deux moments. La course continue jusqu'à Stop : le retour
   au calme se fait sans rien relancer. Une **pause avant 12:00** interrompt le test (« Test
   interrompu par la pause »), la course continue normalement.
3. **À l'arrivée** (« C'est fait ») : une carte **« Ton test de 12 minutes »** en tête — « 2 400 m en
   12 minutes, mesurés sur ta trace », l'allure (5:14 /km · ≈ 26:10 sur 5 km) et les quatre allures,
   puis **Retenir cette allure** et **Pas cette fois**. Retenue, la carte confirme « Allure retenue :
   5:14 /km. Tes allures cibles suivent. » Test arrêté avant 12:00 : « Test incomplet : arrêté à 9:40
   sur 12:00. Il faut aller au bout pour en tirer une allure. », sans bouton.

### 3.3 L'accueil du pilier — trois questions

Route `/running-welcome`, plein écran, une question par page, barre de progression en trois traits
(« question 1 sur 3 » pour le lecteur d'écran), « Passer » en haut à droite, **Plus tard** et
**Continuer** en pied.

1. **Ce que tu vises** — « Pour régler ta semaine et tes conseils. » L'objectif (5 km, 10 km,
   semi-marathon, marathon, perte de poids, endurance générale) et « Combien de sorties par
   semaine ? » (1 à 7).
2. **À quelle vitesse cours-tu ?** — les quatre portes de §3.1, sans « Le faire maintenant » : la
   porte du test propose la saisie d'un test déjà fait et dit « Pas encore fait ? Tu le lanceras
   depuis ton profil coureur, quand tu voudras. » Ici « Je ne sais pas encore » et « Plus tard » font
   la même chose : la porte est gardée pour ce qu'elle explique.
3. **La voix pendant la course** — « Elle peut couper ta musique un instant. » Trois choix :
   « Oui, guide-moi » (distance et allure régulièrement, chaque fraction et les alertes d'allure) ·
   « Seulement les fractions et les alertes d'allure » · « Non, en silence ». Le dernier bouton dit
   **Terminer**.

### 3.4 Le profil coureur

La carte **Ton allure de référence** remplace le champ de saisie, juste sous le guidage : la valeur
en grand (« 5:20 /km »), sa provenance (« D'après ton record sur 5 km : 26:40, le 12/10/2026 » ou
« Donnée par toi »), les quatre allures qu'elle produit (la section « Mes allures d'entraînement »
s'y fond), et **Changer**. Sans allure : « Pas encore d'allure de référence », « Sans elle, tes
séances n'ont pas d'allure cible », et **La donner**. Le bouton « Retour » du pied disparaît.

### 3.5 Les autres portes d'entrée

- **Carte Premiers pas** (hub, sans programme) : « Ton allure de référence · La donner » ouvre
  `/running-pace` (au lieu du profil).
- **Carte de la séance du jour** : quand la séance devrait avoir une allure dérivée (endurance, sortie
  longue, récupération, fractionné), qu'elle n'en porte pas d'explicite et que l'allure de référence
  manque, la carte gagne la même ligne « Ton allure de référence · La donner ».
- **Planning, plan, détail d'un programme** : un bandeau unique en tête de la liste, « Sans allure
  de référence, tes séances n'ont pas d'allure cible · La donner », dès qu'au moins une séance de la
  liste est concernée. Le message de chaque ligne reste, non touchable.
- **Éditeur de séance** et **zones d'allure** : le message devient touchable.

## 4. Règles métier

### Les portes

- **R1 — Une seule formule.** Le chrono et le test passent par Riegel inversé
  (`referencePaceFromRaceTime`) ; l'allure connue est lue en `m:ss`. La valeur est **arrondie à la
  seconde à l'enregistrement**, quelle que soit la porte — changement assumé : en impérial, le champ
  actuel stockait 8:00 /mi comme 298,26 s/km.
- **R2 — Distances du chrono.** Pastilles 5 km, 10 km, semi (21,0975 km), marathon (42,195 km) ;
  « Autre » accepte de **1 000 à 42 195 m** (0,63 à 26,2 mi). En dehors : « Entre 1 km et la distance
  d'un marathon. »
- **R3 — Temps.** Lu par `parseMmSs` : `m:ss`, `h:mm:ss`, ou un nombre nu compté en **minutes**.
  L'exemple du champ suit la distance (§3.1), pour qu'un semi s'écrive `1:45:00` et non `1:45`.
  Illisible ou nul : pas d'aperçu, bouton inactif.
- **R4 — Plausibilité, une seule borne pour toutes les portes** : de **2:30 à 12:00 /km**, les bornes
  déjà appliquées par `parsePaceToSPerKm`, extraites en une constante partagée et appliquées à la
  **valeur brute** de chaque porte (une saisie lisible hors bornes n'est jamais confondue avec une
  saisie illisible ; un test sous ~1 100 m est « trop lent », pas « vide »). Messages : porte 1 et
  test, « Plus rapide que 2:30 /km : vérifie la distance et le temps (h:mm:ss au-delà de l'heure). »
  / « Plus lent que 12:00 /km : vérifie la distance et le temps. » ; porte 3, « … : vérifie ton
  allure. » Pas d'aperçu, bouton inactif.
- **R5 — L'aperçu calcule, n'écrit pas.** Bandes de `sessionTargetPace`, exactement celles du profil
  et des séances. « ≈ x sur 5 km » = allure × 5.
- **R6 — Retenir écrit une fois.** `upsertRunnerProfile({ ref5kPaceSPerKm })` au seul appui sur
  « Retenir cette allure ». Plus d'écriture à la frappe.
- **R7 — « Je ne sais pas encore »** n'existe que sans allure, et n'écrit rien. Avec une allure, les
  trois autres portes servent à la **changer**, dans les deux sens.

### Le test guidé

- **R8 — Marqueur.** Au lancement, `{ runId }` est gardé dans une préférence locale (`secureStorage`,
  comme le dernier mode de départ) : il survit à un redémarrage de l'app. Il ne s'efface **qu'au
  choix** (« Retenir » ou « Pas cette fois ») ou au lancement d'un nouveau test. À la lecture, un
  marqueur qui désigne une course supprimée, annulée ou introuvable est ignoré. Tant qu'il désigne un
  test mesuré sans choix, la porte « Le test de 12 minutes » de `/running-pace` pré-remplit sa
  distance (« Mesuré lors de ton test du 23/10 ») : quitter l'arrivée sans choisir ne perd pas le
  résultat.
- **R9 — GPS obligatoire, sans auto-pause.** Le suivi est lancé avec `autoPause: false`. Pas de
  bascule « sans GPS ». Permission refusée : « Le test a besoin du GPS pour mesurer la distance. », la
  course est annulée (`cancelRun`, chemin existant), sans repli. Le mode retenu de l'écran de départ
  (CARDIO-UX03) n'est ni lu ni modifié.
- **R10 — Les deux annonces** tombent sur le chrono de l'écran : 11:00 et 12:00. Voix et vibration,
  même annonces coupées (D2). Revenir sur l'écran de course adopte l'état courant **sans parler**
  (règle du fantôme, FANT-01 R7) : aucune annonce rejouée ; un saut direct au-delà de 12:00 (app
  revenue au premier plan après 12:00) ne dit que « test terminé ». Une **pause avant 12:00** (y
  compris celle que pose « Terminer », l'arrêt étant en deux temps depuis CARDIO-UX01) marque le test
  « interrompu » dans le marqueur : le bandeau dit « Test interrompu par la pause » et plus aucune
  annonce ne part. Après 12:00, une pause est sans effet sur le test.
- **R11 — La mesure** se fait à l'arrivée, sur la trace : distance cumulée **filtrée**
  (`cumulativeDistances`, le filtre de vitesse des records), interpolée à **720 s** sur l'horodatage
  des points (`t`, secondes depuis le départ). Elle ne dépend ni du moment du Stop, ni de l'écran
  resté allumé. Un trou GPS compte son temps et sa distance en ligne droite (les virages y sont
  sous-estimés). Le décalage du premier fix GPS (quelques secondes, F6 reste à CARDIO-03) est
  assumé.
- **R12 — Pas d'allure**, dans cet ordre : moins de deux points valides (« Pas assez de points GPS
  pour mesurer le test. ») ; trace qui s'arrête avant 720 s (« Test incomplet : arrêté à 9:40 sur
  12:00 », le cas d'un « Terminer » avant 12:00) ; test interrompu par une pause puis repris (« Test
  interrompu par la pause ») ; allure hors bornes (R4).
- **R13 — Une course de test reste une course** : elle compte dans l'historique, la semaine, les
  records et la charge, comme toute sortie. Elle n'est rattachée à aucune séance.

### L'accueil

- **R14 — Condition d'ouverture** (D4), évaluée à l'affichage du hub Course : appareil **en ligne**,
  une synchronisation **terminée pendant ce lancement** (`lastSyncedAt` postérieur au démarrage de
  l'app), profil chargé, **aucune ligne** `running_profiles`, aucune course en cours. Ouverture **une
  fois par lancement** au plus (garde en mémoire). Hors ligne, l'accueil attend : rien n'est écrit.
- **R15 — Marqueur.** À l'ouverture, une ligne de profil vide est écrite (`upsertRunnerProfile({})`,
  qui insère le seul `user_id`). C'est une **route** (`/running-welcome`), pas une `Modal` : le retour
  Android ferme l'écran comme « Passer ». Quitter de n'importe quelle façon ne la fait pas revenir.
- **R16 — Chaque question écrit ce qui est choisi, au « Continuer »** de sa page, et rien d'autre :
  objectif et fréquence indépendamment ; l'allure si une porte est valide (R6) ; la voix selon le
  choix (oui → annonces **et** guidage ; fractions et alertes → guidage seul ; non → les deux
  coupés). L'intervalle d'annonce garde son défaut (1 km). **Plus tard** n'écrit rien.
- **R17 — Fin.** « Terminer » ou « Passer » ferme l'accueil et rend le hub tel qu'il était. La
  carte Premiers pas y montre « Ton allure de référence » tant qu'elle manque (CARDIO-UX03).

### La mise à jour, ensuite

- **R18 — À la fin d'une course, un record plus rapide seulement** (D5). Quand
  `detectAndStoreRunRecords` insère ou bat le record 5 km d'une course qui vient de se terminer, il met
  à jour l'allure si `round(temps ÷ 5) < allure actuelle`, ou s'il n'y a pas d'allure. Sinon, rien.
  Le record, lui, est enregistré comme avant.
- **R19 — Le recalcul des records ne touche plus au profil.** `backfillRunningRecords` (suppression
  d'une course, ouverture de « Toutes tes stats ») recalcule les records sans jamais écrire l'allure.
  Un appel pendant un recalcul en cours **attend** la fin de celui-ci puis recalcule à son tour (au
  lieu de rendre la main tout de suite).
- **R20 — Suppression.** `deleteRun` lit l'allure **avant** de recalculer. Si elle valait exactement
  le record 5 km supprimé ÷ 5, elle prend, après le recalcul, la valeur du nouveau record 5 km ÷ 5, ou
  s'efface s'il n'en reste aucun. Sinon, elle n'est pas touchée — même si le record restant est plus
  rapide.
- **R21 — Provenance, affichée et jamais stockée** (D6) : « D'après ton record sur 5 km : {temps},
  le {date} » si l'allure vaut `round(record ÷ 5)` ; « Donnée par toi » sinon ; rien sans allure.

## 5. Cas limites

- Allure donnée par une porte, première sortie de 5 km plus lente → l'allure ne bouge pas (R18) ; la
  provenance reste « Donnée par toi ».
- Allure donnée, puis un 5 km plus rapide → l'allure suit le record ; la provenance devient
  « D'après ton record sur 5 km ».
- Une allure donnée qui tombe pile sur record ÷ 5 → affichée « D'après ton record » : sans gravité,
  c'est la même valeur.
- Unités impériales : saisie et aperçu en /mi et en miles ; stockage en s/km arrondi (R1), bornes R4
  converties.
- Chrono « 52 » → 52:00 (nombre nu = minutes) ; « 0:00 » → refusé ; semi « 1:45 » → lu 1 min 45 s,
  donc « plus rapide que 2:30 /km », et le message rappelle h:mm:ss.
- Test : écran éteint ou app au fond pendant le test → pas d'annonce (limite de toutes les annonces
  de course), la mesure reste juste ; app tuée → le suivi s'arrête comme pour toute course : test
  incomplet si c'était avant 12:00.
- Test lancé alors qu'une course est en cours → l'écran de départ propose de la reprendre
  (comportement existant) ; aucun test ne démarre.
- Test arrêté à 30 minutes → la mesure se fait quand même à 12:00.
- Test suivi d'un retour au calme qui atteint 5 km, sans allure préalable → le record 5 km pose une
  allure à l'arrivée (R18), puis la carte du test propose la sienne ; « Retenir » la remplace.
- Accueil : profil déjà créé par un autre chemin (Labo, conflit d'objectifs, record) → pas d'accueil.
  Compte déjà actif sur un autre téléphone → la ligne descend à la synchronisation, pas d'accueil ;
  second téléphone hors ligne → pas d'accueil tant qu'il n'a pas synchronisé (R14).
- Suppression de la course du record alors que l'allure avait été **donnée** → l'allure ne bouge pas
  (R20), même si le record restant est plus rapide qu'elle.
- Suppression pendant que « Toutes tes stats » recalcule déjà → le recalcul de `deleteRun` attend
  puis repasse (R19) : R20 voit bien le record restant.

## 6. i18n — FR + EN

Toutes les chaînes neuves en FR et EN, sous `running.*`, parité vérifiée par
`scripts/check-i18n-parity.mjs`. Les clés remplacées sont retirées (`running.profile.ref5k`,
`ref5kHint`, les deux placeholders et `running.profile.pacesEmpty` si plus aucun écran ne les lit).
Principales chaînes :

| Clé (indicative) | FR | EN |
|---|---|---|
| `running.refPace.title` | Ton allure de référence | Your reference pace |
| `running.refPace.subtitle` | Elle règle toutes tes allures cibles. Choisis ce que tu sais. | It sets all your target paces. Pick what you know. |
| `running.refPace.door.race` | J'ai un chrono récent | I have a recent race time |
| `running.refPace.door.test` | Le test de 12 minutes | The 12-minute test |
| `running.refPace.door.known` | Je connais mon allure sur 5 km | I know my 5K pace |
| `running.refPace.door.unknown` | Je ne sais pas encore | I don't know yet |
| `running.refPace.records` | Tes meilleurs temps enregistrés | Your best recorded times |
| `running.refPace.knownHint` | Ton allure quand tu cours 5 km le plus vite possible, pas celle de ton footing. | Your pace when you run 5K as fast as you can, not your easy pace. |
| `running.refPace.preview` | Ton allure de référence {{pace}} · ≈ {{time}} sur 5 km | Your reference pace {{pace}} · ≈ {{time}} for 5K |
| `running.refPace.before` | Avant : {{pace}} | Before: {{pace}} |
| `running.refPace.save` | Retenir cette allure | Use this pace |
| `running.refPace.tooFast` | Plus rapide que {{min}} : vérifie la distance et le temps (h:mm:ss au-delà de l'heure). | Faster than {{min}}: check the distance and the time (h:mm:ss past one hour). |
| `running.refPace.tooSlow` | Plus lent que {{max}} : vérifie la distance et le temps. | Slower than {{max}}: check the distance and the time. |
| `running.refPace.origin.record` | D'après ton record sur 5 km : {{time}}, le {{date}} | From your 5K record: {{time}}, on {{date}} |
| `running.refPace.origin.declared` | Donnée par toi | Set by you |
| `running.refPace.missingBanner` | Sans allure de référence, tes séances n'ont pas d'allure cible. | Without a reference pace, your sessions have no target pace. |
| `running.cooper.startTitle` | Test de 12 minutes | 12-minute test |
| `running.cooper.remaining` | reste {{time}} | {{time}} left |
| `running.cooper.voice.lastMinute` | Plus qu'une minute. | One minute to go. |
| `running.cooper.voice.done` | Douze minutes, test terminé. Tu peux ralentir. | Twelve minutes, test complete. You can ease off. |
| `running.cooper.result` | {{distance}} en 12 minutes, mesurés sur ta trace | {{distance}} in 12 minutes, measured on your track |
| `running.cooper.incomplete` | Test incomplet : arrêté à {{time}} sur 12:00. Il faut aller au bout pour en tirer une allure. | Test incomplete: stopped at {{time}} of 12:00. Run the full 12 minutes to get a pace. |
| `running.cooper.interrupted` | Test interrompu par la pause. | Test interrupted by the pause. |
| `running.welcome.goal.title` | Ce que tu vises | What you're aiming for |
| `running.welcome.pace.title` | À quelle vitesse cours-tu ? | How fast do you run? |
| `running.welcome.voice.title` | La voix pendant la course | Voice while you run |
| `running.welcome.voice.all` | Oui, guide-moi | Yes, guide me |
| `running.welcome.voice.intervals` | Seulement les fractions et les alertes d'allure | Only intervals and pace alerts |
| `running.welcome.voice.none` | Non, en silence | No, silent |

Les deux annonces vocales du test sont dites dans la langue de l'app, comme les autres annonces de
course. « Semi » / « Half » et « Marathon » reprennent les libellés de distance existants
(`RECORD_DISTANCE_I18N_KEY`).

## 7. Comportement offline

- Toutes les écritures passent par `upsertRunnerProfile`, qui écrit en local d'abord (PowerSync) :
  les portes et le test marchent sans réseau. La synchronisation suit.
- Tous les calculs sont purs et locaux : Riegel, bandes, provenance, mesure du test sur la trace.
- Le test de 12 minutes est une course GPS ordinaire : il marche hors ligne comme toute course.
- Le marqueur du test est local à l'appareil (on lance et on finit un test sur le même téléphone) ;
  celui de l'accueil est la ligne de profil, synchronisée.
- **Seule exigence de réseau : l'accueil** ne s'ouvre qu'en ligne, après une synchronisation de ce
  lancement (R14) — sans quoi un second téléphone créerait une seconde ligne de profil et bloquerait
  sa propre synchronisation (contrainte d'unicité de `user_id`). Hors ligne, on peut toujours donner
  son allure depuis la carte Premiers pas ou le profil.
- **Aucune migration, aucune sync rule à redéployer, aucune dépendance native neuve** (`expo-speech`
  et la vibration servent déjà au guidage de course). Noryn lit la même colonne, dans la même unité :
  rien ne change pour lui.

## 8. Hors périmètre

- `run/analysis.tsx` et `summarizeIntervalSeries` (CARDIO-08), les écrans Muscu et Nutrition, Prisme.
- Le départ en un geste, le décompte et l'attente du fix GPS (CARDIO-03) : le test passe par l'écran
  de départ tel qu'il est.
- Les annonces écran éteint : limite partagée par toutes les annonces de course (RUN-F2a, RUN-F2d,
  FANT-01).
- Une porte « je connais ma VMA » : non demandée. La VMA reste **déduite** de l'allure.
- Estimer l'allure depuis les sorties courtes (meilleur 1 km, meilleur mile) quand aucun 5 km n'existe :
  une sortie quelconque n'est pas un effort maximal, l'estimation serait fausse dans un sens inconnu.
- Annoncer à l'arrivée « ton allure de référence passe de 5:02 à 4:55 » après un record : utile, mais
  c'est l'écran d'arrivée de CARDIO-UX03 ; à porter au BACKLOG si on le veut.
- La question du **niveau** dans l'accueil (lu nulle part) et sa présence dans le profil.
- Stocker la provenance ou la date de l'allure (D6).

## 9. Critères d'acceptation — ce que les tests devront prouver

**Briques pures (Vitest, `packages/shared`)**
1. Un 10 km en 52:30 donne 302 s/km ; un test de 2 400 m, 314 ; un 5 km en 25:00, 300 (valeurs de la
   maquette) ; les bandes de 302 sont 6:02–6:32, 5:32–6:02, 6:32–7:02, 4:47–5:02.
2. Les bornes de plausibilité sont **les mêmes** que celles de `parsePaceToSPerKm` (test de garde).
3. Chaque porte rend « valide », « vide », « illisible », « distance hors bornes », « trop rapide »
   ou « trop lent », jamais une allure hors bornes ; « Autre » refuse 999 m et 42 196 m ; un test de
   300 m est « trop lent ».
4. La règle de fin de course : sans allure → appliquée ; plus rapide → appliquée ; égale ou plus
   lente → ignorée.
5. La provenance : égalité avec `round(record ÷ 5)` → record ; sinon → donnée ; sans allure → rien.
6. La mesure du test : 720 s sur une trace régulière ; un trou GPS au milieu ; un point aberrant
   filtré ; trace de 9:40 → incomplet ; moins de deux points → inexploitable.
7. Les annonces du test : 11:00 et 12:00 une seule fois, aucune au montage, saut direct au-delà de
   12:00 → « terminé » seul.
8. La condition d'accueil : vraie seulement pour en ligne + synchronisé pendant ce lancement + chargé
   + aucun profil + aucune course en cours + pas encore ouvert.
9. Les trois choix de voix produisent les trois couples (annonces, guidage) de R16.

**Données (Jest, harnais SQLite)**
10. Un premier record 5 km **plus lent** qu'une allure donnée ne la touche pas ; un record plus rapide
    la remplace (défaut c, test vu rouge avant le correctif).
11. Le recalcul des records n'écrit jamais l'allure.
12. Supprimer la course du record dont venait l'allure → l'allure prend le record suivant ; sans 5 km
    restant → effacée ; allure donnée par l'utilisateur → intacte, même face à un record plus rapide.
13. Deux recalculs simultanés : le second attend le premier puis repasse.

**Écrans (Jest)**
14. `/running-pace` : rien n'est écrit avant « Retenir », une seule écriture, arrondie ; l'aperçu
    affiche les quatre allures et « Avant » quand une allure existait ; « Je ne sais pas encore »
    absent avec une allure ; les meilleurs temps remplissent la porte ; la distance d'un test mesuré
    non retenu est pré-remplie.
15. L'accueil : s'ouvre une fois sur un compte sans profil (en ligne, synchronisé), écrit le marqueur
    à l'ouverture, écrit chaque réponse à son « Continuer », rien sur « Plus tard » ni « Passer ».
16. Le départ en mode test : titré, GPS imposé, suivi sans auto-pause, sans fantôme, mode retenu ni lu
    ni écrit, marqueur posé ; refus de permission → course annulée, message.
17. En course : bandeau présent pour la course du marqueur seulement ; pause avant 12:00 → test
    interrompu.
18. L'arrivée d'un test : carte avec la distance mesurée et l'aperçu ; « Retenir » écrit 314 pour
    2 400 m et efface le marqueur ; test incomplet ou interrompu → aucun bouton.
19. « La donner » (Premiers pas, séance du jour), le bandeau des trois listes, l'éditeur de séance et
    les zones d'allure ouvrent `/running-pace`.
20. Le profil : carte en tête avec provenance ; plus de bouton « Retour » (F39).
21. **Accessibilité** : portes et choix en boutons radio (`accessibilityRole="radio"`, état
    sélectionné), aperçu annoncé (`accessibilityLiveRegion`), progression « question N sur 3 », cibles
    de 44 px au moins.
22. Les gardes passent avec les nouveaux écrans : identité du pilier (`pillar-identity`, les deux
    écrans ajoutés à sa liste), déclaration des routes, couverture clavier (CLAV-01 : les deux écrans
    en `self`, le composant des portes couvert par ses deux importeurs exacts), parité i18n.

**Tests existants remplacés** (pas supprimés sans remplaçant) : dans `running-screen.test.tsx`,
l'attente `/running-profile` de la carte Premiers pas devient `/running-pace`, et la condition
d'accueil est isolée dans un hook mocké (le mock global du profil est `null` : sans cela, l'accueil
s'ouvrirait dans tous les tests du hub) ; dans `running-profile-screen.test.tsx`, les tests du champ de
saisie deviennent des tests de la carte, et celui du bouton « Retour » vérifie son absence.

## 10. Articulation avec CARDIO-UX03 et les chantiers parallèles

- **CARDIO-UX03** (hub en trois onglets, clôturée le 23/10/2026) : la carte Premiers pas garde son
  contenu et ses deux boutons ; seule change la destination de « La donner » (D7), du profil vers les
  portes — comportement verrouillé aujourd'hui par `running-screen.test.tsx`, mis à jour (§9). La
  carte de la séance du jour gagne une ligne, seulement quand l'allure manque. L'icône Profil de
  l'en-tête ouvre toujours le profil. L'accueil s'ouvre **par-dessus** le hub et le rend intact.
- **CARDIO-08** touche `run/analysis.tsx` ; cette US touche `run/index.tsx`, `run/active.tsx` et
  `run/summary.tsx` (le test), jamais l'analyse.
- **IDENT-01** peut toucher `planning/` (identité des écrans) : le bandeau ajouté ici est un bloc en
  tête de liste, sans effet sur la couleur de l'écran.
- **CARDIO-03** (départ en un geste) reprendra `run/index.tsx` après cette US ; le paramètre `test` est
  additif et ne change aucun autre chemin de départ.
