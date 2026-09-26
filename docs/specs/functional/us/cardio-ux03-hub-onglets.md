---
id: CARDIO-UX03
titre: "Hub Course en trois onglets — Courir, Historique, Progrès"
roadmap: [5.44]
catalogue: []
etape: recette
branche: feature/cardio-ux03-hub-onglets
maj: 26/09/2026
---

# US CARDIO-UX03 — Hub Course en trois onglets

> Même chantier que [MUSCU-UX07](muscu-ux07-hub-trois-onglets.md), transposé au pilier Course.
> Analyse et trois propositions sur la toile d'exploration **Course — partir d'abord**
> (https://claude.ai/artifact/PxNU7GfyTcEZz1Ba7t9RhD). **Proposition A validée par Florian le
> 25/09/2026**, avec ses réponses aux questions Q1 à Q10 (§2).
>
> - Maquette : toile **CARDIO-UX03 · Hub en trois onglets**, versée dans
>   [design/cardio-ux03-hub-onglets/](../../../../design/cardio-ux03-hub-onglets/).
> - Plan : [docs/plans/cardio-ux03-hub-onglets.md](../../../plans/cardio-ux03-hub-onglets.md).
> - ⚠️ **Lot en une seule vague, à la demande de Florian** (« tout d'une seule vague, tu me dis quand
>   tu as TOUT terminé ») : la spec, le plan et la maquette ont été écrits **avant** le code, mais
>   n'ont pas été relus par lui séparément. Ce qu'il a validé, c'est la proposition A et les dix
>   réponses ; les retours sur le reste se font à la recette (§87 de RECETTES.md).
> - **Relue par un agent de revue le 25/09/2026** : vingt constats, intégrés (R4, R5, R8, R11, D4, D7,
>   §6, §7) ou notés au §11.
> - Session parallèle : NUTRI-UX03 fait le même chemin sur la Nutrition. Aucun fichier de la muscu ni
>   de la nutrition n'est modifié ici (voir §11 pour la factorisation à venir).

## 1. Le problème

Un coureur ouvre l'onglet à trois moments : **juste avant de partir**, **juste après être rentré**,
et **entre deux sorties**. Le hub de CARDIO-UX02 (19/09) répond très bien à la question du dimanche
soir, « est-ce que je cours plus vite ? », et mal aux autres :

| Question | Quand | Réponse du hub avant cette US |
|---|---|---|
| « Je cours quoi aujourd'hui, et à quelle allure ? » | avant chaque sortie | bien servie par la scène, mais « Démarrer » ouvre un écran titré « Course libre » |
| « Mes 400 de vendredi dernier, en combien ? » | avant chaque séance structurée | invisible : les fractions sont enregistrées, rien ne les remonte |
| « Ma sortie de ce soir, elle donne quoi ? » | juste après | bien servie (l'arrivée), mais « Ma semaine » ouvre l'historique |
| « C'était quand, ma dernière sortie ? » | entre deux sorties | un geste, puis défiler sous deux sections de statistiques |
| « Qu'est-ce qu'il me reste cette semaine ? » | plusieurs fois par semaine | « Ma semaine », au 5ᵉ bloc |
| « Je refais ma boucle de dimanche, contre moi » | souvent sans programme | caché sur l'écran de départ, et seulement si la sortie est partie d'ici |
| « J-combien avant ma course ? » | chaque semaine, en prépa | trois gestes : annuaire, Programmes, le programme |
| « Est-ce que je cours plus vite ? » | une fois par semaine | sept cartes sur le hub ; l'historique en répète cinq |

### Ce que dit le code (vérifié le 25/09/2026)

- **a.** « Démarrer » la séance du jour ouvre `run/index.tsx`, titré « Course libre », bouton
  « Démarrer une course libre », sans rien de la séance. Le mode GPS n'est pas retenu (CARDIO-UX01
  F4, resté au backlog sous CARDIO-03).
- **b.** « Voir le détail » (séance du jour) ouvre le planning ; « Ma semaine » (après une sortie)
  ouvre l'historique (`running.tsx:360-373`).
- **c.** `/running-history` empile sept sections ; la liste des courses est la troisième, plate, sans
  type de séance, alors que `SELECT_HISTORY` remonte le type et le terrain (F24 jamais branché).
- **d.** Une course de l'historique ouvre `run/summary.tsx`, l'écran **d'arrivée** (« C'est fait »,
  « Enregistrer » qui renvoie au hub). Le vrai détail, `run/analysis.tsx`, est un geste plus loin.
- **e.** « La dernière fois » est calculable sans rien ajouter : chaque course porte sa séance
  planifiée (`planned_session_id` → `session_id`), chaque fraction son réalisé (`run_intervals`,
  `summarizeIntervalSeries`). Un programme de course est aujourd'hui une semaine type répétée — non par
  choix de modèle (CARDIO-UX01 R9 a posé `sessions.week_index` pour des semaines progressives), mais
  parce que `generatePlannedSessions` ignore encore cette colonne (CARDIO-06, backlog) : la même
  séance revient donc chaque semaine. Quand CARDIO-06 arrivera, le repli « même type » (R3) prendra
  le relais.
- **f.** Le fantôme (FANT-01) ne se choisit que sur l'écran de départ ; le compte à rebours de la
  course (`RaceCountdownCard`) n'est rendu que dans la fiche du programme.

## 2. Les décisions de Florian (25/09/2026)

| # | Question | Décision |
|---|---|---|
| Q1 | A, B ou C ? | **A**, « Partir, puis se souvenir » |
| Q2 | Nom du premier onglet | **Courir** (EN : Run) |
| Q3 | La trace animée de la scène | **Gardée**, en filigrane dans l'en-tête compact |
| Q4 | « Recourir » = repartir avec une sortie en fantôme, même partie d'ailleurs | **Oui** |
| Q5 | Écran de départ gardé, retitré, qui retient le dernier mode | **Oui** |
| Q6 | Écran de saisie d'une sortie passée dans cette US | **Non** (reste CARDIO-03) |
| Q7 | Tuile « Autre activité » dans le pilier | **Non, pas ici** (« on verra plus tard ») |
| Q8 | `/running-history` → redirection, analyses → « Toutes tes stats » | **Oui** |
| Q9 | Objectif chrono face à l'estimation du jour | **Oui, sans alerte** |
| Q10 | Critères « hub » de §59 et §79 remplacés par §87 | **Oui** |

## 3. Les décisions de conception

- **D1 — Le patron de MUSCU-UX07, à la lettre.** Trois onglets **Courir · Historique · Progrès** ;
  en-tête compact à la couleur du pilier ; sélecteur qui **défile avec la page** ; un nouvel appui
  sur l'onglet Course de la barre du bas **remonte en haut** (`useScrollToTop`) ; onglet affiché =
  paramètre `section` lu une fois puis effacé, sinon le dernier choisi (store en mémoire, non
  persisté), sinon Courir. **Rien ne change d'onglet de force.**
- **D2 — La trace en filigrane (Q3).** `FlowTrace` reste la matière de l'en-tête, à opacité réduite,
  avec la même règle d'animation que la scène (onglet au premier plan, app active, mouvement permis).
- **D3 — « La dernière fois ».** Pour la séance du jour : la dernière course terminée rattachée à
  **la même séance de programme** ; à défaut, au **même type de séance**. Elle se dit en fractions
  quand la course en a (temps de chaque répétition, et combien dans la plage), sinon en « distance ·
  durée · allure · ressenti ». Rien ne correspond : « Première fois ».
- **D4 — Recourir (Q4).** Sur toute sortie qui peut servir de fantôme (GPS, au moins 500 m : le
  seuil de FANT-01, `GHOST_MIN_DISTANCE_M`), un bouton ouvre l'écran de départ en **course libre,
  cette sortie présélectionnée en fantôme**, même si elle est partie d'ailleurs. ⚠️ **Q4 assouplit
  FANT-01 (D3, R2)**, qui ne proposait que des sorties parties d'ici : la règle de proximité reste
  celle des **propositions** de l'écran de départ, mais un choix explicite depuis une sortie passée
  l'emporte. Si la trace de la sortie ne donne pas de profil de fantôme (illisible, trop courte),
  l'écran de départ retombe sur une course libre sans fantôme, sans rien promettre. Recourir **ne
  recopie pas** la structure d'une séance. Pendant une course en
  cours, l'écran de départ propose de la reprendre (comportement existant) : aucune seconde course.
- **D5 — L'écran de départ (Q5).** Il porte le nom de ce qu'on lance (le type de la séance, « Course
  libre », ou « Recourir ta sortie du … »), rappelle la structure d'une séance, et **retient le
  dernier mode utilisé** (GPS ou sans), comme préférence **locale** (`secureStorage`, aucune colonne,
  comme le mode de séance muscu). Le décompte et l'attente du fix GPS (F5, F6) restent dans CARDIO-03.
- **D6 — Le vrai détail d'une sortie.** Toucher une sortie, où qu'elle soit (Courir, Historique,
  calendrier, « la dernière fois »), ouvre `/run/analysis`. L'analyse gagne en tête ce qui lui
  manquait pour servir de détail : le type de la séance, la date, le terrain, les quatre chiffres,
  et **« Recourir cette sortie »**. `/run/summary` reste l'écran d'arrivée, juste après une course.
- **D7 — `/running-history` devient une redirection (Q8)** vers Course › Historique. Ses analyses
  détaillées (statistiques par période, courbe 30/90 j, records, objectifs estimés, charge,
  polarisation) passent **telles quelles** dans un écran **« Toutes tes stats »** (`/running-stats`),
  ouvert depuis Progrès — comme `/progress` pour la muscu. La liste des courses, elle, disparaît de
  cet écran : elle vit dans l'onglet Historique. Les cartes de Progrès, qui ouvraient
  `/running-history`, ouvrent désormais « Toutes tes stats ». Les deux autres liens vers l'ancien
  écran suivent : la carte de record récent de l'accueil (un record de course ouvre « Toutes tes
  stats », comme un record de muscu ouvre `/progress` — rien ne change à l'écran d'accueil) et la
  destination du widget « Ma semaine » retiré de l'accueil (`widget-destinations.ts`).
  `backfillRunningRecords`, déclenché par la section des records, part avec elle.
- **D8 — « Ton programme » (Q9).** Le nom, « semaine X sur N », les séances faites, et, quand le
  programme a une échéance : le compte à rebours (J-44), l'objectif chrono et, en face, **ton record
  sur cette distance, sinon l'estimation du jour** tirée de ton record 5 km (Riegel, même règle que
  « Si tu courais demain » : une vraie performance prime sur une estimation). Aucune couleur, aucun
  commentaire.
- **D9 — L'arrivée** (sortie finie aujourd'hui) : distance, « durée · allure », la séance validée
  quand la course en réalise une, le compte des fractions dans la plage, l'estimation 10 km ; gestes
  **Voir l'analyse** et **Partager**. « Ma semaine » disparaît : la semaine est juste en dessous.
- **D10 — Autre chose (Q6, Q7).** Une seule ligne, **Course libre**, affichée les jours de séance et
  après une sortie. Les jours de repos et en premiers pas, la carte du moment la propose déjà.
- **D11 — L'accueil ne change pas.** Sa carte du moment porte déjà Démarrer et Reprendre ; l'action
  rapide Course existe.
- **D12 — Supprimés** : `RunStage` (la scène) et `RunDirectorySheet` (l'annuaire, dont les quatre
  destinations sont désormais l'onglet Historique et les trois icônes de l'en-tête), avec les clés
  i18n qu'ils étaient seuls à lire.

## 4. Le nouvel écran

### 4.1 L'en-tête

Bandeau compact au dégradé bleu du pilier (`PillarStage`, `stageTheme('running')`), la trace en
filigrane (D2) :
- ligne 1 : « Course », puis trois icônes : **Planning**, **Profil coureur** (CARDIO-UX01 R2a : il
  porte l'allure de référence), **Programmes** ;
- ligne 2 : **Courir · Historique · Progrès**, le segment actif plein (blanc, texte bleu).

### 4.2 Courir

1. **La carte du moment**, un état parmi cinq, dans l'ordre de priorité du code : en cours > séance
   du jour > sortie finie aujourd'hui > repos > premiers pas (`resolveRunHubState`, puis l'arrivée
   hors séance du jour, comme la scène).

   | État | Contenu | Gestes |
   |---|---|---|
   | En cours | type de la séance ou « Course libre », distance, « {{durée}} déjà courues » | **Reprendre** |
   | Séance du jour | « Aujourd'hui · 18:30 · semaine 3 sur 8 », type, décompte d'heure, structure, volume · durée · allure cible, consigne, **la dernière fois** (§4.2.1) | **Partir** |
   | Sortie finie | type, distance, « durée · allure », séance validée, fractions dans la plage, 10 km estimé | **Voir l'analyse** · Partager |
   | Repos | « Rien de prévu aujourd'hui » ou « Séance du jour faite », prochaine séance | **Course libre** · Planning |
   | Premiers pas | « Par où commencer ? », et « Ton allure de référence » tant qu'elle manque | **Choisir un programme** · Course libre |

2. **La carte d'adaptation** (F36), juste dessous, inchangée : elle se tait sans signal.
3. **Tes dernières sorties** : les trois plus récentes. Pavé date, type de la séance (ou « Course
   libre »), pastille des records qu'elle détient, « distance · durée · allure », « terrain ·
   ressenti ». Appui → détail. **Recourir** sur les sorties GPS. Pied : « Tout l'historique » →
   onglet Historique. Masqué pendant une course et sans aucune sortie.
4. **Autre chose** : Course libre (D10).
5. **Ta semaine** (`RunWeekCard`, inchangée).
6. **Ton programme** (D8), programme actif seulement.

Pendant une course, Courir ne montre que la carte « Reprendre » (comme MUSCU-UX07 R8).

#### 4.2.1 « La dernière fois »

En-tête « LA DERNIÈRE FOIS · VEN. 18/09 », et « même séance » ou « même type ». Puis :
- **avec des fractions** : une pastille par répétition rapide, dans l'ordre. Une répétition bornée en
  distance se dit en **temps** (« 1:34 ») ; bornée en durée, en **allure** (« 3:58/km »). Pleine si
  l'allure tombe dans la plage prévue, contour si elle en sort, neutre sans plage. Sous les pastilles
  : « 5 sur 6 dans la plage ». Au-delà de 12 répétitions : les 12 premières puis « +N » ;
- **sans fractions** : « 8,1 km · 46:12 · 5:42/km · facile » (les parties absentes sont omises) ;
- un lien **« Revoir cette sortie »** → son détail.

Aucune course ne correspond : « Première fois pour cette séance. »

### 4.3 Historique

1. Pendant une course : la ligne « Course en cours · Reprendre ».
2. **Le calendrier du mois** : grille lundi → dimanche en jours locaux, jours de sortie pleins, un
   repère pour les sorties qui détiennent encore un record, les séances de course **prévues à venir**
   en pointillé, aujourd'hui cerclé. Titre du mois, flèches ; résumé « 13 sorties · 99,9 km · 9 h 44 »
   et, s'il y en a, « 1 record ». Un jour à une sortie ouvre son détail ; à plusieurs, il restreint
   la liste, avec « Tout le mois ».
3. **Sorties · Par type** :
   - **Sorties** : celles du mois (ou du jour choisi), de la plus récente à la plus ancienne, même
     ligne qu'au §4.2-3, Recourir en icône ;
   - **Par type** : chaque type de séance déjà couru (course libre comprise), du plus récemment couru
     au plus ancien : nom, nombre de sorties, « La dernière : ven. 18/09 · 7,4 km à 5:58/km ». Appui →
     l'onglet Sorties filtré sur ce type, **sur tout l'historique**, avec une puce pour retirer le
     filtre.

### 4.4 Progrès

1. Pendant une course : la ligne « Course en cours · Reprendre ».
2. Les cartes de CARDIO-UX02, **déplacées telles quelles**, dans leur ordre : le fil du jour, Ton
   allure, Si tu courais demain, Ton moteur, Tes records, Ta charge, Km par km, le cumul ; puis
   **« Toutes tes stats »** → `/running-stats`.
3. Compte sans aucune sortie : un seul message, « Ta progression démarre à ta première sortie », et
   « Commencer » → Courir.

### 4.5 L'écran de départ

- Titre : le type de la séance du jour ; « Recourir ta sortie du ven. 18/09 » ; sinon « Course
  libre ». Sous-titre : « Séance du jour », « 11,4 km en 1:07:30 », ou l'actuel.
- Séance du jour : ses segments en pastilles, puis « volume · allure cible ».
- Mode : **présélectionné sur le dernier mode utilisé** (GPS par défaut). Recourir ouvre en GPS.
- Fantôme : la sortie à recourir est **présélectionnée et listée en tête**, même si elle ne fait pas
  partie des sorties parties d'ici.
- Bouton : « Démarrer la séance », « Démarrer contre ton fantôme » ou « Démarrer une course libre ».

### 4.6 Le détail d'une sortie (`/run/analysis`)

En tête : le type de la séance (ou « Course libre »), la date, l'heure et le terrain ; quatre
chiffres (distance, durée, allure, ressenti) ; puis **« Recourir cette sortie »** (sorties GPS). Le
reste de l'écran est inchangé. Avec `share=1`, la carte à partager s'ouvre une fois la course chargée.

### 4.7 Toutes tes stats (`/running-stats`)

Le contenu de l'ancien `/running-history` moins la liste : statistiques par période, courbe
d'allure, records d'allure, objectifs estimés, charge, polarisation. Un record ouvre son détail
(`/run/analysis`, et non plus l'écran d'arrivée).

## 5. Règles métier

- **R1.** Trois onglets, dans cet ordre. Sélection selon D1.
- **R2.** Carte du moment : `resolveRunHubState` ne change pas ; l'arrivée s'applique hors séance du
  jour et hors course en cours, comme dans `RunStage`.
- **R3. La dernière fois** (`pickRunLastTime`) : parmi les courses **terminées**, la plus récente dont
  la séance est la séance du jour ; sinon la plus récente du même type de séance (type non nul) ;
  sinon aucune. Une course libre n'a pas de type : elle ne sert jamais de « dernière fois » à une
  séance.
- **R4. Les pastilles de fractions** (`lastTimeReps`) : les répétitions du **corps de séance**
  seulement — phases rapides de segment `work`. Les récupérations mélangeraient deux populations, et
  l'échauffement, les éducatifs et le retour au calme sont eux aussi développés en phases « rapides »
  (`running-intervals.ts`) : les compter ferait lire un échauffement comme une fraction ratée. Le
  « X sur Y dans la plage » de la dernière fois **et** de l'arrivée se calcule sur ces pastilles, pas
  sur `summarizeIntervalSeries` (qui compte tout). Une répétition sans réalisé mesurable (rattrapage
  silencieux, RUN-F2d R8 bis) est affichée « — ».
- **R5. Recourir** : proposé si la course est GPS et fait au moins 500 m (`GHOST_MIN_DISTANCE_M`).
  Ouvre `/run?ghostRunId=…`. Aucune écriture avant « Démarrer » ; le fantôme est posé sur la course au
  départ (FANT-01, R8), **en mode GPS seulement** : l'écran de départ posait jusqu'ici le fantôme
  choisi quel que soit le mode — corrigé, une course sans GPS n'a pas de fantôme. Si le profil du
  fantôme ne se construit pas (`useRunGhost` rend `null`), l'écran retombe sur « Course libre ».
- **R6. Mode retenu** : le mode **effectivement démarré** est retenu (y compris le repli sur « sans
  GPS » après un refus de permission). Lecture au montage de l'écran de départ ; GPS par défaut.
- **R7. Records d'une sortie** : nombre de records d'allure qu'elle **détient encore**
  (`running_pace_records.run_id`). Il n'y a pas d'historique des records (palmarès, EFFORT-01) : une
  sortie dont le record a été battu depuis n'est plus marquée. Assumé.
- **R8. Le calendrier** : réutilise `buildMonthGrid`, `monthRange` de `history-calendar.ts` (fonctions
  pures, non modifiées). Le jour d'une sortie est sa fin, sinon son début, **en jour local**
  (`runDayKey`) — y compris pour « Ta semaine » et l'arrivée, qui découpaient jusqu'ici la date ISO
  **en UTC** (`slice(0, 10)`) : une sortie finie entre minuit et deux heures tombait la veille dans
  la semaine et le jour même dans le calendrier. Corrigé. Un jour « prévu » porte une occurrence de
  course `planned`, aujourd'hui ou plus tard. Navigation du mois de la première sortie au mois
  courant.
- **R9. Résumé du mois** : nombre de sorties, distance (dans l'unité d'affichage), durée totale,
  records détenus.
- **R10. Par type** : clé = type de la séance réalisée, « Course libre » pour une course sans séance.
- **R11. Ton programme** : avancement par `resolveProgramProgress` (fonction pure de `strength-hub.ts`,
  réutilisée sans modification, déjà agnostique du pilier) sur les occurrences du programme ; échéance
  par `raceCountdown` ; objectif face au chrono (`raceObjective`) : la distance de course est la
  `target_distance_m` de la séance de type « course » du programme (s'il y en a plusieurs : celle de
  la semaine la plus tardive, puis la dernière dans l'ordre) ; record exact à cette distance s'il
  existe — à un mètre près, `target_distance_m` étant un entier et le semi valant 21 097,5 m —, sinon
  Riegel depuis le record 5 km, sinon rien (l'objectif seul).
- **R12. Accessibilité** : onglets en `tablist` / `tab` avec leur état ; jours du calendrier nommés en
  entier ; flèches nommées ; Recourir nommé (« Recourir ta sortie du 18/09 ») ; cibles ≥ 44 px.

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Compte neuf | Premiers pas, allure de référence à donner ; ni dernières sorties ni programme ; Historique : mois courant vide ; Progrès : un seul message |
| Courses libres seulement | Premiers pas (sans programme) + dernières sorties + la semaine |
| Séance du jour jamais courue, aucun type identique | « Première fois pour cette séance. » |
| Même type couru, jamais cette séance | La dernière du même type, marquée « même type » |
| Dernière fois sans fraction (sortie longue, endurance) | « distance · durée · allure · ressenti » |
| Dernière fois dont une répétition n'a pas de réalisé | Pastille « — » |
| Course sans GPS (tapis, manuelle) | Pas de Recourir ; le détail le dit déjà (pas de carte ni de km par km) |
| Recourir une sortie partie d'une autre ville | Autorisé (Q4), présélectionnée en tête de liste |
| Recourir pendant une course en cours | L'écran de départ propose de reprendre la course en cours ; rien n'est créé |
| Recourir puis choisir « Sans GPS » | Le fantôme n'est pas posé (le mode sans GPS n'a pas de fantôme) |
| Refus de la permission GPS au départ | Repli existant sur « sans GPS » ; c'est ce mode qui est retenu |
| Programme sans échéance | « Ton programme » sans compte à rebours ni objectif |
| Échéance sans objectif chrono | J-N seul |
| Objectif sans record 5 km ni record à la distance | L'objectif seul |
| Course passée (J négatif) | « Course passée », sans objectif face à l'estimation |
| Deux sorties le même jour | Calendrier : appui → liste du jour |
| Deux séances de course prévues le même jour | La première, puis la seconde une fois la première faite : la séance du jour prime alors sur l'arrivée (existant, `useTodayRunSession` en `LIMIT 1`) |
| Course sans GPS en cours | La carte dit la durée courue, pas « 0,00 km » |
| Programme sans durée en semaines | Ni « semaine X sur N » dans la carte, ni barre d'avancement (`resolveProgramProgress` rend `null`) |
| Plusieurs séances « course » dans le programme | La distance de la plus tardive (R11) |
| Course objectif de moins de 5 km | Estimation Riegel extrapolée vers le bas depuis le 5 km : acceptée, c'est la formule de RUN-14 |
| Sortie à recourir dont la trace ne donne pas de profil | L'écran de départ retombe sur « Course libre », sans fantôme (R5) |
| Filtre « Par type » sur un historique de plusieurs centaines de sorties | Liste non virtualisée (CARDIO-04, backlog) : à observer sur le compte le plus chargé |
| Sortie à cheval sur minuit | Rangée au jour de fin |
| Sortie supprimée (depuis le détail) | Disparaît du calendrier, des listes, de « la dernière fois » (soft delete) |
| Lien `/running-history` (liens entrants) | Redirigé vers Course › Historique |
| Unités impériales | Distances et allures converties (`useUnits`) |
| Langue anglaise | Mois, jours et libellés en anglais |
| Pilier course désactivé | Onglet masqué (existant) |

## 7. i18n — FR + EN

Toutes les chaînes nouvelles dans `fr.json` et `en.json` (parité vérifiée par
`scripts/check-i18n-parity.mjs`), sous `runningHub.*`, `runningStats.*` et `running.start.*` /
`running.analysis.*`. Pluriels en `_one` / `_other`.

| Clé | FR | EN |
|---|---|---|
| `runningHub.sections.run` / `.history` / `.progress` | Courir / Historique / Progrès | Run / History / Progress |
| `runningHub.resumeLine.title` / `.action` | Course en cours / Reprendre | Run in progress / Resume |
| `runningHub.moment.eyebrow.*` | Course en cours / Aujourd'hui / Sortie terminée / Repos / Ton pilier course | Run in progress / Today / Run finished / Rest / Your running pillar |
| `runningHub.moment.primary.*` | Reprendre / Partir / Voir l'analyse / Course libre / Choisir un programme | Resume / Go / See the analysis / Free run / Choose a program |
| `runningHub.moment.share` / `.planning` / `.freeRun` | Partager / Planning / Course libre | Share / Planning / Free run |
| `runningHub.moment.week` | semaine {{week}} sur {{total}} | week {{week}} of {{total}} |
| `runningHub.moment.validated` | Séance validée dans ton programme | Session checked off in your program |
| `runningHub.moment.inRange` | Fractions : {{done}} sur {{total}} dans la plage | Reps: {{done}} of {{total}} in range |
| `runningHub.moment.refPace.title` / `.body` / `.cta` | Ton allure de référence / Pas encore donnée : sans elle, aucune allure cible. / La donner | Your reference pace / Not set yet: without it, no target pace. / Set it |
| `runningHub.lastTime.title` / `.titleOn` | La dernière fois / La dernière fois · {{date}} | Last time / Last time · {{date}} |
| `runningHub.lastTime.sameSession` / `.sameType` | même séance / même type | same session / same type |
| `runningHub.lastTime.firstTime` | Première fois pour cette séance. | First time for this session. |
| `runningHub.lastTime.inRange` | {{done}} sur {{total}} dans la plage | {{done}} of {{total}} in range |
| `runningHub.lastTime.more` | +{{count}} | +{{count}} |
| `runningHub.lastTime.open` | Revoir cette sortie | See that run again |
| `runningHub.lastTime.repA11y` | Répétition {{rep}} : {{value}}, {{state}} | Rep {{rep}}: {{value}}, {{state}} |
| `runningHub.lastTime.state.in` / `.out` / `.none` | dans la plage / hors plage / sans plage | in range / out of range / no range |
| `runningHub.recent.title` / `.allHistory` | Tes dernières sorties / Tout l'historique | Your latest runs / Full history |
| `runningHub.recent.again` / `.againA11y` | Recourir / Recourir ta sortie du {{date}} | Run again / Run again against your run of {{date}} |
| `runningHub.other.title` | Autre chose | Something else |
| `runningHub.other.freeHint` | sans séance, tout est enregistré | no session, everything is recorded |
| `runningHub.program.title` / `.progress` | Ton programme / Semaine {{week}} sur {{total}} · {{done}} séances sur {{count}} | Your program / Week {{week}} of {{total}} · {{done}} of {{count}} sessions |
| `runningHub.program.objective` / `.estimate` / `.record` | Objectif / Estimé aujourd'hui / Ton record | Target / Estimated today / Your record |
| `runningHub.history.*` | calendrier, résumé, onglets Sorties · Par type, puces (voir le fichier) | idem |
| `runningHub.progressLink` | Toutes tes stats | All your stats |
| `runningHub.progressEmpty.title` / `.body` / `.cta` | Ta progression démarre à ta première sortie. / Allure, records, estimations de chrono : tout s'affichera ici. / Commencer | Your progress starts with your first run. / Pace, records, race estimates: it will all show up here. / Start |
| `runningStats.title` | Toutes tes stats | All your stats |
| `running.start.sessionSubtitle` / `.ghostTitle` / `.ghostSubtitle` | Séance du jour / Recourir ta sortie du {{date}} / {{distance}} en {{duration}} | Today's session / Run again: your run of {{date}} / {{distance}} in {{duration}} |
| `running.start.startSessionCta` / `.startGhostCta` | Démarrer la séance / Démarrer contre ton fantôme | Start the session / Start against your ghost |
| `running.analysis.again` / `.againHint` | Recourir cette sortie / elle court à côté de toi, en fantôme | Run this again / it runs beside you, as a ghost |

Réutilisées telles quelles : `running.sessionType.*`, `running.hub.*` (titres de repos, prochaine
séance, premiers pas, volume, durée estimée), `running.paceGuidance.targetLabel`,
`stage.running.inProgress`, `stage.running.prediction*`, `stage.running.countdown*`,
`stage.running.arrivalMeta`, `stage.running.arrivalA11y`, `running.prepa.*` (compte à rebours,
jour de course, course passée : pas de doublon sous `runningHub.program.*`),
`workout.summary.feeling.*`, `running.terrain.*`, `running.week.count`, `runningHub.week.*`. Les
cartes de Progrès lisent toujours `stage.running.splits.*`, `.predictions.*` et `.load.*` : ces clés
restent. Seules partent celles que `RunStage` et `RunDirectorySheet` étaient **seuls** à lire,
vérifiées une à une par recherche dans `apps/` et `packages/`.

## 8. Comportement offline

- **Tout est local** : lectures PowerSync (SQLite). Trois requêtes neuves, locales : les jours de
  course prévus d'un mois, l'avancement du programme de course (même forme que celle de la muscu)
  et son échéance avec la distance de course. La sortie à recourir se lit par son identifiant
  (`useRun`, `useRunGhost`, existants).
  `SELECT_HISTORY` gagne une colonne, `ps.session_id` (jointure existante ; toujours **sans**
  `gps_track`, le test-garde le vérifie).
- **Écritures** : aucune nouvelle. Le départ passe par `startRun` / `setRunGhost` existants.
- **Préférence locale** : le dernier mode de départ, dans `secureStorage` (comme `session-mode-store`).
- **Aucune migration, aucune table, aucune sync rule** à redéployer.

## 9. Hors périmètre

- La saisie d'une sortie passée (CARDIO-03, Q6) ; le décompte et l'attente du fix GPS (F5, F6).
- Les autres activités dans le pilier (Q7, « on verra plus tard »).
- La comparaison de l'arrivée avec la dernière fois (« vendredi dernier, 5 sur 6 ») : montrée sur la
  toile d'exploration, non retenue pour garder la carte d'arrivée courte.
- Recopier la structure d'une séance en la recourant.
- Un historique des records (palmarès seulement, R7).
- Les types de séance des courses libres (RUN-07) ; les quatre portes vers l'allure de référence
  (CARDIO-02) : la carte premiers pas renvoie au profil.
- La suppression par appui long dans la liste : elle reste dans le détail.
- La factorisation des onglets entre piliers (§11).

## 10. Critères de recette

Téléphone de recette de Florian, taille de police système par défaut, thème clair puis sombre.
Compte avec un programme de course actif (idéalement avec une date de course et un objectif chrono),
au moins une séance de fractionné déjà courue, une sortie GPS et une sortie sans GPS.

**Courir**
- [ ] Un jour de séance prévue, on lit sans défiler : le type, la structure, l'allure cible, « la
      dernière fois » de la même séance, et **Partir**.
- [ ] Un fractionné déjà couru montre une pastille par répétition, pleine dans la plage, contour
      hors plage, et « X sur Y dans la plage » ; une sortie longue, « distance · durée · allure ».
- [ ] Une séance jamais courue dit « Première fois pour cette séance. »
- [ ] « Revoir cette sortie » ouvre le détail de cette sortie-là.
- [ ] Partir ouvre l'écran de départ **titré du type de la séance**, avec ses segments.
- [ ] Après une sortie : distance, durée, allure, « Séance validée », fractions dans la plage ;
      « Voir l'analyse » et « Partager » (la carte à partager s'ouvre).
- [ ] Tes dernières sorties : les trois plus récentes, avec type, terrain, ressenti ; Recourir sur
      les sorties GPS seulement ; « Tout l'historique » ouvre l'onglet Historique.
- [ ] Recourir ouvre l'écran de départ « Recourir ta sortie du … », en GPS, le fantôme présélectionné,
      même pour une sortie partie d'ailleurs ; la course lancée affiche l'écart au fantôme.
- [ ] Le mode (GPS ou sans) choisi au départ est **retenu** au départ suivant, y compris après avoir
      relancé l'app.
- [ ] Ton programme : semaine X sur N, séances faites, J-N, objectif et estimation (ou record) sans
      couleur d'alerte ; sans échéance, rien de tout cela.
- [ ] Pendant une course, Courir ne montre que **Reprendre**.
- [ ] Le hub n'a plus de scène haute, ni « Voir le détail », ni « Ma semaine » sous l'arrivée, ni
      d'annuaire.

**Historique**
- [ ] Le calendrier marque les jours de sortie, les records encore détenus, les séances prévues à
      venir et aujourd'hui ; les flèches s'arrêtent au mois de la première sortie et au mois courant.
- [ ] Le résumé du mois est juste (sorties, distance, durée, records) et bien accordé au singulier.
- [ ] Un jour à une sortie ouvre son détail ; à deux, restreint la liste, et « Tout le mois » la
      rétablit.
- [ ] Par type : chaque type couru, du plus récent au plus ancien ; un appui filtre les sorties sur
      tout l'historique ; la puce retire le filtre.
- [ ] Le détail d'une sortie s'ouvre sur l'**analyse** (type, date, terrain, quatre chiffres,
      Recourir), plus jamais sur « C'est fait ».
- [ ] Supprimer une sortie depuis son détail la retire du calendrier, des listes et de « la dernière
      fois ».

**Progrès**
- [ ] Les huit cartes de CARDIO-UX02 s'y trouvent, dans leur ordre ; « Toutes tes stats » ouvre
      l'écran des analyses détaillées, sans la liste des courses.
- [ ] Les cartes qui menaient à l'ancien historique mènent à « Toutes tes stats » ; un record y
      ouvre le détail de sa sortie.
- [ ] Un compte sans sortie voit un seul message et « Commencer ».

**Navigation**
- [ ] Les trois onglets changent le contenu sans changer d'écran, et ne restent pas collés en haut
      au défilement ; la trace défile en filigrane dans l'en-tête.
- [ ] Un nouvel appui sur l'onglet Course de la barre du bas ramène en haut du hub.
- [ ] Revenir sur Course depuis un autre pilier rouvre le dernier onglet ; relancer l'app rouvre
      Courir.
- [ ] Pendant une course, Historique et Progrès affichent « Course en cours · Reprendre » en tête.
- [ ] Un lien vers l'ancien historique (`/running-history`) mène à Course › Historique ; le record
      de course récent de l'accueil ouvre « Toutes tes stats ».
- [ ] Les icônes de l'en-tête ouvrent le planning, le profil coureur et les programmes.

**Transverse**
- [ ] L'accueil est inchangé.
- [ ] Tout fonctionne en mode avion.
- [ ] En anglais, aucun libellé français ; en unités impériales, distances et allures converties.
- [ ] TalkBack annonce les onglets et leur état, les jours du calendrier, les flèches, les pastilles
      de fractions et les boutons Recourir ; toutes les cibles font au moins 44 px.

## 11. Notes d'implémentation et suite

- **Factorisation entre piliers, à faire quand NUTRI-UX03 aura atterri.** Trois hubs auront le même
  squelette : en-tête à onglets (`StrengthHeader`, `RunHeader`, celui de la nutrition), choix de
  l'onglet (`hub-section.ts`, `run-hub-section.ts`), store en mémoire (`strength-section-store`,
  `run-section-store`), ligne « Reprendre », calendrier du mois (`HistoryCalendar`,
  `RunHistoryCalendar`). Ici, ils sont **dupliqués exprès** pour ne toucher aucun fichier des deux
  autres chantiers. Les fonctions pures de `history-calendar.ts` et `resolveProgramProgress` sont,
  elles, **réutilisées sans modification** : elles étaient déjà agnostiques du pilier.
- **Livrée les 25 et 26/09/2026 en quatre commits** : cadrage (`a941cd2a`), socle (`fb4946d8`),
  départ et détail (`daef357b`), hub (26/09, rebasé sur le socle de NUTRI-UX03). En recette : [RECETTES.md](../../../../RECETTES.md) §87 (35 critères).

### Notes d'implémentation (25/09/2026)

Écarts et précisions par rapport au texte ci-dessus, pour la recette et la maintenance :

- **La carte d'arrivée** dit sa durée avec `formatDurationHms` (« 43 min 52 s »), comme les listes ;
  la scène disait « 0h 43 ». « Partager » ouvre l'analyse avec `share=1`, qui ouvre la carte à
  partager une fois la course chargée : la carte n'est pas reconstruite dans le hub (même choix que
  MUSCU-UX07).
- **« X sur Y dans la plage »** (dernière fois et arrivée) se calcule sur `lastTimeReps` (segment
  `work` seul). Le tableau « fraction par fraction » de l'analyse, lui, garde
  `summarizeIntervalSeries`, qui compte aussi l'échauffement : écart **connu, non corrigé** ici
  (l'analyse n'est pas dans le périmètre), à porter au backlog.
- **Une séance du jour sans type** (programme ancien) prend son **nom** comme titre, à défaut « Course
  libre » ; l'écran de départ dit alors « Séance du jour ».
- **Suppressions** : `RunStage` (+ test, 13 tests), `RunDirectorySheet`, et les clés i18n qu'ils étaient
  seuls à lire — `stage.running.{eyebrow,primary,secondary,weekLine,arrivalA11y}`,
  `runningHub.{directory,directorySheet}`, `runningHub.week.program`,
  `running.history.{title,empty,runsSectionTitle}` —, chacune vérifiée par recherche dans `apps/` et
  `packages/`. Restent, parce que lues ailleurs : `stage.running.{inProgress,arrivalMeta,prediction*,countdown*,splits,predictions,load}`.
- **Déplacé** : `app/running-history/index.tsx` → `app/running-stats/index.tsx` (`git mv`, sans la
  liste), son test avec lui ; les quatre tests de la liste ont rejoint `RunHistorySection.test.tsx`.
- **`components/Button.tsx`** gagne un `testID` facultatif (le bouton de départ change de libellé
  selon le contexte : les tests le trouvent par repère).
- **Non fait, signalé** : les écrans empilés `run/active` et `run/summary` n'ont pas été retouchés ;
  la comparaison de l'arrivée avec la dernière fois (§9) ; la virtualisation de l'historique filtré.

### Retours de recette

- **26/09/2026 — « Choisir un programme » sur deux lignes** (premiers pas, capture de Florian). Les
  deux boutons de la carte du moment se partageaient la largeur à parts égales, en police 17, sans
  limite de lignes : le libellé principal revenait à la ligne, collé à gauche. Réaligné sur la
  maquette (`Main.dc.html`) : le secondaire prend la place de son libellé (police 14,5, marge 16),
  le principal tout le reste (police 16) ; les deux libellés tiennent sur **une ligne**, et le
  principal resserre sa police sur un écran très étroit plutôt que de couper. Vaut pour les cinq
  états de la carte. Garde : `run-hub-ux03-cards.test.tsx`.
