---
id: ACCUEIL-08
titre: "Ta journée — les trois cadrans, le fil du jour, la semaine, Du nouveau, Tes repères et le « + »"
roadmap: [7.45]
catalogue: []
etape: close
branche: feature/accueil08-ta-journee
maj: 26/10/2026
---

# US ACCUEIL-08 — Ta journée

> Deuxième lot de la refonte de l'accueil, décisions D1-D6 de Florian du 25/10/2026. Brief :
> [design/accueil-2026-10/README.md](../../../../design/accueil-2026-10/README.md) §3, toile et
> `<script>` de `Phone.dc.html` comme référence de comportement. Premier lot :
> [ACCUEIL-07](accueil07-accueil-dit-vrai.md). Dev direct, spec écrite avec le code.

## 1. Ce que l'US change

L'accueil empilait douze blocs (~2,4 écrans) qui redisaient la série, la semaine, la forme et
l'assiette, sans répondre d'un coup d'œil à « où j'en suis aujourd'hui ? ». Il répond désormais à
trois questions, dans cet ordre — où j'en suis, qu'est-ce que je fais maintenant, qu'est-ce qui a
bougé :

| Zone | Contenu | Composant |
|---|---|---|
| 0 · Le ciel | date, salutation, phrase du jour ; « Écouter mon brief » avant 11 h ; bandeau de la séance en cours ; puis **les trois cadrans** — ou la carte « retour », ou « Premiers pas » le tout premier jour | `HomeStage`, `HomeSky`, `HomeDials` |
| 1 · Ta journée | le fil horodaté des gestes du jour, l'action du moment dépliée en carte sombre | `HomeDayTimeline`, `NowCard` |
| 2 · Ta semaine | sept colonnes, une pastille par pilier actif, la série en pastille, le Bilan ; les offres de la série (joker, bascule en semaines) | `WeekStrip`, `StreakOffers` |
| 3 · Du nouveau | deux cartes au plus | `HomeNews` |
| 4 · Tes repères | l'ancienne grille, en tuiles compactes (D5) | `WidgetGrid` |
| 5 · Le pied | « Semaine chargée ? Allège-la » (ou la carte de la période en cours) et « Personnaliser l'accueil » | — |
| + | le bouton flottant et sa feuille « Noter » (D4) | `AddSheet` |

**Retirés de l'accueil** (fichiers supprimés) : « Demande-moi » (`AskCard`, `useAskQuestions`, D3),
la barre d'actions rapides (`QuickActions`), « La suite » (`UpNext`), la carte du brief
(`MorningBrief`, `MorningBriefCard`), le bilan du lundi (`WeeklyStoryCard`), la Régularité
(`StreakCard`), le résumé nutrition (`NutritionSummaryCard`), les anneaux (`BreathRings`,
`useWeekRings`), et les moments propres à la scène (check-in, série en jeu, anneaux).

## 2. Règles métier

### 2.1 Le fil — `buildDayTimeline` (`packages/shared/src/day-timeline.ts`, brique pure testée)

- **Les gestes** : check-in du matin (7 h 30) et point du soir (21 h 30) **seulement à qui pratique
  le bien-être** (une entrée sur 30 jours) ; la pesée **seulement à qui se pèse** (ACCUEIL-07) ; un
  repas par créneau, à son heure apprise ; chaque séance prévue à son heure (18 h faute d'heure,
  affichée « — » et « sans heure ») ; chaque séance, sortie ou activité **terminée** aujourd'hui, à
  son heure de fin ou de début ; la marche suggérée.
- **Dû / manqué** : un geste est dû quand son heure est passée et qu'il n'est pas fait. Le check-in
  est **manqué** après 11 h (« ton énergie ce matin » n'a plus de sens) ; un repas ou la pesée
  trois heures après leur heure (la fenêtre « dû » d'ACCUEIL-07). Un geste manqué reste visible,
  n'est jamais l'action du moment.
- **L'action du moment** : une séance ou une course **en cours** d'abord ; sinon **le premier geste
  non fait, dans l'ordre des heures** — les suggestions (marche) seulement dans leur fenêtre ; sinon
  le rattrapage d'un repas manqué ; sinon « journée faite » ; sinon le repli « rien de prévu ».
- **Journée faite** : la séance ou sortie prévue faite (ou rien de prévu), chaque repas dont l'heure
  apprise est passée noté, et au moins une trace dans la journée.
- **La marche suggérée** : seulement si les pas se comptent (une journée de pas sur sept) et qu'aucune
  séance n'est prévue ; idée de 16 h à 20 h 30, posée à 17 h 30, avec les pas qui manquent ; faite
  quand l'objectif est atteint.
- **Check-in du matin ≠ point du soir** : l'énergie notée le matin fait le check-in ; humeur ou
  stress font le point du soir. Une ligne de bien-être ne fait plus les deux.

### 2.2 La mise en page du fil — `HomeDayTimeline`

- Ce qui est fait se **replie dès deux gestes** (« 3 gestes déjà faits · check-in · pesée ·
  petit-déjeuner »), touchable pour déplier ; chaque ligne faite dit ce qu'elle a donné (énergie,
  poids, kcal et protéines du repas, durée et distance d'une séance).
- La carte du moment se pose **à la place du geste qu'elle porte** ; sans geste porté (journée
  faite, repli), en bout de fil ; **en tête de la suite** quand la série est en jeu le soir.
- La suite tient en **trois lignes**, puis « n plus tard », qui se déplie.
- Un repas ou une pesée à venir porte un « + » (noter tout de suite) ; une séance non : elle se
  démarre de la carte.
- « x/y faits » ouvre le planning ; les suggestions ne comptent que faites.

### 2.3 La carte du moment — `NowCard`

- Le sur-titre dit **quand** : « À 18:30 · dans 5 h 20 », « Maintenant » à moins d'un quart d'heure,
  « Aujourd'hui » pour une séance sans heure (jamais un horaire inventé).
- Trois gestes que seul le fil connaît : le **check-in** (les cinq visages, dans la carte), la
  **marche** (les pas qui manquent, ouvre leur suivi), la **série en jeu** le soir (les vraies sorties
  d'ACCUEIL-07 : marcher, noter une activité, le joker confirmé).
- **L'astuce croisée** (`crossTip`, brique pure testée) : sur un repas seulement, une seule, quand
  deux faits réels se croisent — une séance plus tard dans la journée (« Jambes ce soir : un bon
  féculent à ce repas »), une course plus tard (manger léger avant), la séance faite qui a ouvert des
  kcal (« ton entraînement t'a fait gagner 250 kcal »), ou un écart de protéines d'au moins 30 g.
  Jamais pendant la série en jeu.

### 2.4 Les cadrans — `buildDayDials` (`home-sections.ts`, D2)

- **Bouger** : musculation ou course actives et au moins une séance cette semaine ; un segment par
  séance (faite = couleur du pilier, celle du jour à faire = pâle, les autres éteintes) ; « 2/4
  séances · cette semaine » ou « repos aujourd'hui ». Ouvre le planning.
- **Manger** : nutrition active ; kcal **restantes** (« +150 kcal au-delà » si dépassée, jamais un
  reste négatif ; « kcal notées » sans cible) et protéines sur leur cible. Ouvre la nutrition.
- **Marcher** : nutrition seule et pas suivis, à la place de Bouger. Ouvre les pas.
- **Récupérer** : un pilier d'entraînement actif **et** le verdict TRI-03 calculable — ou le check-in
  du matin attendu (« ? », « check-in à faire »). Ouvre le « Pourquoi ? » du verdict.
- Un pilier désactivé ne compte ni dans la bande de la semaine ni dans Bouger (`useHomeWeek`).

### 2.5 Ta semaine — `buildWeekStrip`

Lundi → dimanche, aujourd'hui encadré, les jours d'une période « vie réelle » grisés ; par pilier
actif : plein = fait, pointillé = prévu, pâle = repas noté hors cible. « 2 séances sur 4 · 3 jours
dans ta cible » (la cible effective du jour et la marge de l'adhérence, NUTR-10), ou « Ta semaine
commence » ; « Ton bilan » ouvre le Bilan. La **série en pastille** : en semaines si c'est l'unité
choisie (SERIE-01), « en jeu » le soir, « Ta série commence » à zéro (jamais « 0 jour »). Le joker
d'un jour manqué et la bascule en semaines, qui vivaient dans la Régularité, s'y posent
(`StreakOffers`, une seule offre à la fois, rien quand il n'y a rien à proposer).

### 2.6 Du nouveau — `selectHomeNews`

Deux cartes au plus (`HOME_NEWS_MAX`), dans cet ordre : conflit d'objectifs → parcours des premiers
jours (du jour 2 au jour 7 : le jour 1 est dans le ciel) → record battu (le jour même et le
lendemain) → depuis ta dernière visite → record à portée (un jour de séance de musculation
seulement) → lien du Labo → objectif le plus proche. Chaque carte garde son composant d'origine ;
le record battu et le record à portée ont une carte neuve. Rien de neuf : la section se tait.

### 2.7 Tes repères (D5) et le pied

- La grille personnalisable reste la **seule zone faite de widgets**, plafond de 8 inchangé
  (amendement d'ADR-007 du 25/10/2026). Registre de l'accueil : `steps`, `weight`, **`sleep`** (neuf,
  gardé par le pilier Bien-être), **`water`** (neuf, gardé par la nutrition, un appui = un verre),
  `cycle`. Les ids retirés (`streak`, `nutrition-summary`, `insights`, `activation-path`,
  `real-life`) deviennent `home-pinned` dans la table des destinations ; une disposition stockée qui
  les cite reste lisible.
- Le pied : « Semaine chargée ? Allège-la » ouvre la feuille « vie réelle » ; pendant une période,
  sa carte en grand (ses deux boutons atteignables) ; « Personnaliser l'accueil » entre en édition.
- Le mode édition masque tout sauf la grille et ses consignes (ni ciel, ni fil, ni « + »).

### 2.8 Le « + » (D4)

Sur l'accueil seulement, au-dessus de la barre d'onglets. La feuille « Noter » : le repas **de
l'heure passée par l'écran**, scanner, pesée, check-in, un verre d'eau (écrit sur place), activité,
course libre, séance libre (le hub muscu) — filtrés par piliers actifs (décision H).

### 2.9 Une seule décision, une seule horloge

`useNowAction` calcule la décision **une fois** et la rend avec le fil, l'heure, les totaux par repas
et l'énergie du check-in ; la scène, la phrase du jour, le fil, la carte et le « + » la reçoivent par
props. L'heure est **décimale au pas de 5 minutes** (`useCurrentClock`, minuteur + retour au premier
plan) : aucun composant ne lit `new Date()` au rendu, et la garde `no-frozen-clock.test.ts` surveille
désormais les fichiers de l'accueil.

## 3. Cas limites

- Compte neuf : « Premiers pas » à la place des cadrans le tout premier jour ; le fil montre les
  repas par défaut ; « Du nouveau » se tait.
- Nutrition seule : Manger (+ Marcher si les pas se comptent), pas de Bouger ni de Récupérer ; pas de
  « course » ni de « séance » dans la feuille « Noter ».
- Musculation seule : ni repas, ni scan, ni eau dans la feuille ; pas de Manger.
- Séance planifiée sans heure : rangée à 18 h, affichée « — », sur-titre « Aujourd'hui ».
- Séance terminée à 23 h 30 : comptée le jour local de sa fin (fil et semaine).
- Une séance prévue marquée faite **et** terminée le même jour ne compte qu'une fois au cadran ; une
  sortie faite hors plan compte aussi ; une séance sautée n'est plus prévue.
- Pas de nuit notée ce matin : le repère Sommeil affiche « — », jamais la nuit d'avant-hier.
- Cible kcal dépassée : « +n kcal au-delà ». Pas de cible : « kcal notées », « pas de cible ».
- Série en jeu le soir : la carte passe en tête du fil et propose les sorties ; la pastille dit « en
  jeu » ; l'astuce croisée se tait.

## 4. i18n (FR + EN)

Nouvelles clés : `home.dials.*`, `home.fil.*`, `home.week.*`, `home.news.*`, `home.reperes.*`,
`home.footer.*`, `home.add.*`, `home.sky.*`, `home.now.{when, checkin, walk, rescue}.*`,
`home.now.session.kind.*`, `home.now.weighIn.kind`, `home.now.wellbeing.{kind, meta}`,
`home.tips.*` (+ `tag.*`), `home.sentence.{checkin, walk, rescue}`. Pluriels en `_one`/`_other`.
Retirées avec les composants supprimés (vérifié par un balayage du code, mobile et `shared`) :
l'espace `ask`, `brief.{title, listen}`, `home.checkin.hint`, les libellés de la Régularité
(`home.streak.{title, suffix, empty, …}` — les offres gardent les leurs), du résumé nutrition
(`home.nutrition.*` qui ne servaient qu'à lui), `home.quick.{run, wellbeing}`, `home.upNext`,
`stage.home.{ring, timeLeft, weeklyStory}`. Kcal et pas mis en forme par la langue. Parité vérifiée
par `locale-parity.test.ts`.

## 5. Offline

Tout est local. Une seule requête change : `SELECT_MEALS_LOGGED_ON` totalise désormais kcal et
protéines par repas (`GROUP BY meal_type`, harnais SQLite, `accueil07-habits-sql.test.ts`). Le reste
réutilise des lectures existantes (plan de la semaine, historiques, cibles du jour, pas, bien-être,
eau, activités). Écritures existantes : `addWater`, `saveWellbeing`, `consumeJoker`,
`updateSettings`, `startRealLifePeriod`. **Aucune migration, aucune sync rule, aucun appel réseau.**

## 6. Décisions prises en route

- **D-a** — Le fil prime sur la priorité « séance d'abord » de `resolveNowAction` pour l'action du
  moment (la toile l'a validé : à 12 h 40, le déjeuner passe avant la séance de 18 h). La table de
  `resolveNowAction` reste la source des états « en cours », du rattrapage et du repli.
- **D-b** — Check-in du matin (énergie) et point du soir (humeur, stress) sont deux gestes : la règle
  « une ligne de bien-être aujourd'hui » d'ACCUEIL-07 ne disait pas lequel était fait.
- **D-c** — Les offres de la série (joker STREAK-01, bascule SERIE-01) n'ont pas disparu avec la
  Régularité : elles vivent dans « Ta semaine », alimentées par `useHomeScene` (un appel de moins à
  `useStreakData`, constat 16).
- **D-d** — Le repère Sommeil est gardé par le **pilier** Bien-être (réglage), pas par l'usage : un
  repère est un choix d'affichage, pas une invitation.
- **D-e** — « Écouter mon brief » lit la salutation et la phrase du jour **puis** le brief existant
  (`buildMorningBrief`) : le bouton remplace la carte, le contenu ne change pas.
- **D-f** — La carte du soir de PRISME-01 (`EveningCard`) reste sous le fil après 18 h : ACCUEIL-09 la
  pose au bout du fil. La retirer ici aurait fait disparaître « Prisme raconte ma journée » entre les
  deux lots.
- **D-g** — Le bilan du lundi (`WeeklyStoryCard`) est retiré comme le brief le demande : « Ton bilan »,
  dans « Ta semaine », y mène tous les jours. La brique `buildWeeklyStory` reste dans `shared`.
- **D-h** — Un pilier désactivé ne compte pas au cadran Bouger, même pour une séance faite : la
  couleur d'un pilier masqué ne doit pas apparaître sur l'accueil (décision H).

## 7. Ce qui n'est pas fait (ici)

- Les lueurs qui respirent et suivent l'heure, les six animations (cadrans à l'arrivée, ligne cochée
  et anneau qui suit, carte qui entre, visages, feuille « Noter », souffle), le toast du verre d'eau,
  les astuces croisées enrichies (progression « Squat : tente 102,5 kg »), la carte record
  partageable, Prisme du soir au bout du fil : **ACCUEIL-09**.
- `useStreakData` reste appelé par `useHomeScene` et `useNowAction` (et `useMorningBriefFacts` le
  matin) : les réunir demanderait de fusionner deux hooks, sans gain mesuré.
- La brique `buildWeeklyStory` n'a plus d'appelant mobile : à réutiliser pour le Bilan ou à retirer.
- « Depuis ta dernière visite » pose son nouvel instantané même quand deux cartes plus prioritaires
  l'écartent de « Du nouveau » (comportement de la carte d'origine, qui se posait toujours) : l'écart
  n'est alors pas montré. Rare (il faut deux des trois : conflit d'objectifs, parcours des premiers
  jours, record battu la veille ou le jour même) ; à revoir si la recette le remarque.
