---
id: MUSCU-UX07
titre: "Hub Musculation en trois onglets — S'entraîner, Historique, Progrès"
roadmap: [3.65]
catalogue: []
etape: code
branche: feature/muscu-ux07-hub-trois-onglets
maj: 25/09/2026
---

# US MUSCU-UX07 — Hub Musculation en trois onglets

> Née d'un test utilisateur le 23/09/2026. Analyse et trois propositions sur la toile d'exploration
> **Muscu — l'essentiel d'abord** (https://claude.ai/artifact/5sSWjgmMMoqJBAsExRLTtg).
> **Proposition B validée par Florian le 24/09/2026**, « avec quelques éléments de A si c'est
> nécessaire ».
>
> - Maquette : toile **MUSCU-UX07 · Hub en trois onglets** (https://claude.ai/artifact/1i8j8mqA3SipkuKzTUYSAU),
>   versée dans [design/muscu-ux07-hub-trois-onglets/](../../../../design/muscu-ux07-hub-trois-onglets/).
> - Plan : [docs/plans/muscu-ux07-hub-trois-onglets.md](../../../plans/muscu-ux07-hub-trois-onglets.md).
> - Relue par un agent de revue le 24/09/2026 : 24 constats, tous intégrés ou arbitrés ci-dessous.
> - **Spec, plan et maquette validés par Florian le 25/09/2026** (« complètement validé »), y compris
>   les décisions D4 et D5 qu'il avait laissées à l'agent.

## 1. Le problème

Le frère de Florian, en ouvrant le pilier Musculation : « ce que tu veux tout de suite, c'est
démarrer ta séance, ou revoir tes séances et en reprendre une pour savoir ce que tu as fait la
dernière fois. Là, l'info principale n'est pas en haut. » Florian ajoute : « même sur le dashboard,
j'arrive même pas à retrouver l'historique de mes séances ».

Un pratiquant ouvre l'onglet avec l'une de quatre questions en tête :

| Question | Fréquence | Réponse du hub avant cette US |
|---|---|---|
| « Je fais quoi aujourd'hui ? » | chaque séance | bien servie : la scène et Démarrer |
| « J'avais mis combien la dernière fois ? » | chaque exercice | invisible avant de lancer la séance |
| « Je refais ma séance de mardi » | souvent | introuvable |
| « Est-ce que je progresse ? » | une fois par semaine | six cartes, l'essentiel de l'écran |

**Le hub était un écran de canapé** : il répondait très bien à la question qu'on se pose une fois
par semaine, et mal à celles qu'on se pose à chaque séance.

### Ce que dit le code (vérifié le 24/09/2026, puis par la relecture)

- **a.** `app/history` existe (refondu par MUSCU-UX01) mais **aucun bouton du hub n'y mène**. Seul
  lien dans l'app : la carte d'activation du 6ᵉ jour (`ActivationPathCard.tsx:39`). La scène Course,
  elle, a son bouton Historique (`running.tsx:393`).
- **b.** « Voir le détail », bouton secondaire de la séance du jour, **ouvre le planning**
  (`strength.tsx:294-301`).
- **c.** « Refaire une séance » (`FreeSessionSheet`) n'est atteignable que les jours de repos et
  **sans programme actif** (états `rest` et `onboarding`). Le détail d'une séance passée n'a pas de
  bouton Refaire.
- **d.** Les séries de la dernière fois (`useLastPerformance`) et la suggestion
  (`computeProgressionSuggestion`, MUSC-F7) ne s'affichent que **dans** la séance
  (`workout.tsx:411, 598`).
- **e.** Sur l'accueil, la carte du moment (`NowCard`) propose déjà Démarrer ou Reprendre la muscu en
  un geste. Il n'y a pas d'autre accès à la muscu : pas d'historique, pas de « Refaire ». La rangée
  d'actions rapides est pleine (quatre pastilles au maximum, choix d'accessibilité d'ACCUEIL-03).
  *Rectifie le compte rendu d'exploration, qui disait « rien pour la muscu ».*

Les données et les écrans existent. Il manquait l'ordre, et deux accès : l'historique et « Refaire ».

## 2. Les décisions de Florian (24/09/2026)

| # | Question posée | Décision |
|---|---|---|
| Q1 | A, B ou C ? | **B, trois onglets** — « ultra clair ». Éléments de A repris si nécessaire (D1). |
| Q2 | Les cartes d'analyse qui quittent le haut du hub | Vont dans **Progrès**. |
| Q3 | La silhouette de la scène | **Pas nécessaire.** Retirée du hub (D6). |
| Q4 | L'emplacement du choix Classique · Immersif | Laissé à l'agent → **D4**. |
| Q5 | L'action rapide de l'accueil | Laissée à l'agent → **D5**. |

## 3. Les décisions de conception (à valider avec les livrables)

- **D1 — Ce qui est repris de A.** Quatre éléments, parce qu'ils répondent à des questions que B
  laissait à deux gestes :
  1. **« La dernière fois » dans la carte du jour.** Sans elle, la question n° 2 reste sans réponse
     avant le départ, quelle que soit la navigation.
  2. **Les trois dernières séances visibles sans geste**, chacune avec Refaire. Dans B, il fallait
     déplier « Refaire une séance » : 2 gestes au lieu d'1.
  3. **L'onglet « Par exercice » de l'historique** : « la dernière fois » pour qui s'entraîne sans
     programme.
  4. **« Refaire cette séance » sur le détail** d'une séance passée.
- **D2 — Le sélecteur d'onglets n'est pas collé en haut de l'écran.** Il défile avec la page. Le
  23/09, Florian a fait retirer sur les quatre piliers le bandeau opaque qui restait en haut au
  défilement (« super moche, garder la transparence en plein écran », `StageScrollView`).
  Pour remonter : **un nouvel appui sur l'onglet Muscu de la barre du bas ramène en haut du hub**.
  Ce geste n'existe nulle part dans l'app aujourd'hui : il est ajouté ici, au hub muscu seulement.
- **D3 — L'onglet affiché**, dans cet ordre de priorité :
  1. un paramètre de route `section` (lien entrant, redirection `/history`), **lu une seule fois
     puis effacé** — sinon il s'appliquerait de nouveau à chaque retour sur l'onglet ;
  2. sinon, le dernier onglet choisi pendant la vie de l'app (store en mémoire, non persisté) ;
  3. sinon **S'entraîner** (démarrage à froid).

  **Rien ne change d'onglet de force.** Pendant une séance, Historique et Progrès portent en tête une
  ligne « Séance en cours · Reprendre » : « Reprendre » n'est jamais caché, et l'on n'est pas renvoyé
  sur S'entraîner en revenant d'un détail consulté entre deux séries.
- **D4 — Classique · Immersif : une ligne sous Démarrer.** « Mode classique · Changer » ouvre
  `SessionModeSheet` dans une **variante « changer »** : mode courant présélectionné, bouton
  « Valider » (et non « Commencer en … », puisque rien ne démarre), pas de case « retenir ». Changer
  de mode depuis le hub, c'est changer **le** mode : `setMode` persiste déjà dans tous les cas.
  Les règles de MUSCU-UX03 sont gardées :
  - **R-MO-2** : on choisit au moment de partir ;
  - **R-MO-3** : la question du tout premier démarrage ne change pas.

  Seul l'encombrement change : un sélecteur à deux boutons au-dessus de Démarrer devient une ligne
  dessous. La place au-dessus du bouton revient à « la dernière fois », qu'on lit à chaque séance. La
  ligne n'est affichée que dans l'état « séance du jour », comme aujourd'hui.
- **D5 — L'accueil ne change pas.** Trois raisons :
  - la carte du moment porte déjà Démarrer et Reprendre (constat e) ;
  - la rangée d'actions rapides est plafonnée à quatre pour l'accessibilité : y ajouter la muscu ferait
    disparaître « Bien-être » chez qui a les trois piliers ;
  - l'accès manquant était **dans** le pilier. Avec les onglets, les trois dernières séances sont
    visibles à l'ouverture de Muscu, et l'historique complet est à un geste. « Le dashboard » de la
    remarque de Florian désigne très probablement le hub muscu, qu'il appelle ainsi depuis
    MUSCU-UX05. **S'il visait l'accueil, D5 est à rouvrir.**

  Écartés : une action rapide « Séance » (retire Bien-être), une carte « Ta dernière séance » (le
  registre de l'accueil est plafonné par `MAX_HOME_WIDGETS`), « Refaire » en un geste depuis l'accueil
  (un appui malheureux crée une séance).
- **D6 — Plus de silhouette dans le hub (Q3).** `StrengthStage` est remplacé par un en-tête compact.
  `ImpactSilhouette` n'a plus d'appelant et est supprimé. `silhouette-paths.ts` reste (utilisé par
  `BodyBalanceCard`).
- **D7 — `/history` devient une redirection** vers Muscu › Historique, pour ne casser aucun lien
  existant (carte d'activation). `/history/[id]` (le détail) reste un écran, et « retour » depuis le
  détail revient là d'où l'on venait, jamais sur la redirection.
- **D8 — Le doublon avec l'écran Progression est assumé.** L'onglet Progrès est la **synthèse** (les
  cartes de MUSCU-UX05). `/progress` reste le **détail**, avec ses trois onglets dont un « par
  exercice » à courbes, qui recoupe en partie l'historique par exercice (celui-ci dit la dernière
  fois, celui-là la tendance). Fusion hors périmètre.
- **D9 — Une séance libre se reconnaît à ses exercices.** Une séance refaite est **libre** : sans
  programme ni séance d'origine, pour ne compter ni dans l'exécution du programme ni dans les
  analyses qui filtrent sur `session_id` (`records-repository.ts:1181`). Elle s'affiche donc
  « Séance libre », comme toute séance libre. Pour qu'on la reconnaisse, ses lignes (Refaire,
  historique, calendrier) portent ses **deux premiers exercices** : « Squat, Presse à cuisses… ».
  Garder le nom d'origine demanderait une colonne en base : hors périmètre.
- **D10 — Ce que l'historique perd, et où c'est passé.** Les filtres 7 / 30 / 90 jours sont remplacés
  par la navigation de mois en mois. Le total de tous les temps est dans Progrès (`LifetimeLine`).

## 4. Le nouvel écran

### 4.1 L'en-tête

Bandeau compact au dégradé rouge fonte (`stageTheme('strength')`), coins bas arrondis, **sans
matière** (D6) :
- ligne 1 : « Muscu » (titre), puis les icônes Planning et Bibliothèque (`DirectorySheet`), inchangées ;
- ligne 2 : le sélecteur **S'entraîner · Historique · Progrès** ; le segment actif est plein (blanc,
  texte rouge fonte), les autres transparents sur verre.

La teinte de la scène coule toujours sous la page (`StageScrollView`, MUSCU-UX04).

### 4.2 S'entraîner

De haut en bas :

1. **La carte du moment.** Un état parmi cinq, **dans l'ordre de priorité actuel du code** :
   en cours > séance du jour > séance faite aujourd'hui > repos > premiers pas
   (`resolveHubState`, puis « faite aujourd'hui » seulement hors séance du jour, `strength.tsx:233`).
   Une séance libre faite le matin d'un jour de séance prévue affiche donc « Démarrer », comme
   aujourd'hui.

   Ce qui change, état par état :

   | État | Avant (scène) | Après (carte) |
   |---|---|---|
   | En cours | Reprendre · Voir le planning | nom de la séance (séance d'origine, sinon « Séance libre »), « 14 séries sur 22 », barre d'avancement · **Reprendre** seul (le planning est dans l'en-tête) |
   | Séance du jour | nom, méta, 3 noms d'exercices, record à portée, sélecteur de mode · Démarrer · Voir le détail (→ planning) | semaine du programme, nom, « N exercices · ~X min », **la dernière fois** (§4.2.1), « Voir les N exercices » (§4.5), ligne de mode (D4) · **Démarrer** |
   | Faite aujourd'hui | tonnage, nom, exercices, records · Voir le bilan · Ma semaine | identique · Voir le bilan · **Partager** (même carte à partager que le bilan, `ShareCardSheet`) — la semaine est juste en dessous |
   | Repos | « Repos aujourd'hui », prochaine séance · Séance libre · Voir le planning | identique (libellés `strengthHub.rest.*`, « Aucune séance à venir dans ton programme » si le programme est fini) · **Voir le planning** — Refaire et Séance libre sont juste en dessous |
   | Premiers pas | « Choisis un programme… » · Voir les programmes · Séance libre | identique · **Voir les programmes** — Séance libre est juste en dessous |

   Ce qui quitte la carte : la ligne « record à portée » va dans Progrès (`NearRecordsCard`) ;
   « semaine 3 sur 8 » va dans l'en-tête de la carte et dans « Ton programme ».

2. **Refaire une séance** (D1-2) : les trois dernières séances terminées ayant au moins un exercice
   travaillé.
   - Chaque ligne : pavé date (jour abrégé + numéro), nom de la séance (D9 pour les libres),
     « durée · tonnage », pastille records.
   - Appui sur la ligne → détail. Bouton **Refaire** → R4.
   - Pied : « Tout l'historique » → onglet Historique.
   - **Masqué** pendant une séance en cours, et quand il n'y a aucune séance.
3. **Autre chose** : deux tuiles.
   - **Séance libre** : composer, écran existant. La question du premier mode (R-MO-3) s'y applique,
     comme aujourd'hui.
   - **Mes templates** : la liste `/templates`. Un modèle se lance désormais depuis sa fiche, soit un
     geste de plus qu'avec la feuille. C'est assumé : les modèles restent rares, et la feuille à
     trois entrées disparaît puisque chacune a maintenant sa place.
   - Bloc masqué pendant une séance en cours.
4. **Ton programme** (programme actif seulement) : la semaine (`StrengthWeekCard`) et l'avancement
   (`ProgramProgressBar`) dans une même carte. Sans programme : les programmes suggérés
   (`SuggestedPrograms`, parcours GUID-01 inchangé), **sauf pendant une séance**.

#### 4.2.1 « La dernière fois »

Dans la carte « Séance du jour », les **trois premiers exercices** de la séance, dans l'ordre du
plan. Pour chacun :
- le nom ;
- ses séries de la dernière séance terminée où il a été fait (R3) ;
- une **pastille de suggestion**, calculée comme dans la séance pour la **première série** (R11) et
  dite en **libellé court** (« 82,5 kg ou 9 reps », « vise 9 reps », « reste à 50 kg »,
  « allège à 72,5 kg », « vise 0:50 »). Pas de pastille quand le moteur ne propose rien, ou
  « Première fois » si l'exercice n'a jamais été fait.

En-tête : « LA DERNIÈRE FOIS · JEU. 17/09 » quand les trois viennent de la même séance ; sinon
chaque ligne porte sa date.

### 4.3 Historique

1. Pendant une séance : la ligne « Séance en cours · Reprendre » (D3).
2. **Le calendrier du mois**, repris de B :
   - grille lundi → dimanche en jours locaux ; les jours des mois voisins sont laissés vides ;
   - titre du mois, flèches mois précédent / suivant ;
   - résumé en deux lignes : « 10 séances · 77,1 t » puis « 3 records » ;
   - légende : séance, séance avec record, prévue.
3. **Séances · Par exercice** (sélecteur, D1-3) :
   - **Séances** : les séances du mois affiché, de la plus récente à la plus ancienne. Même ligne que
     §4.2-2, avec Refaire. Appui long : suppression après confirmation (existant) ; le calendrier, la
     liste Refaire et « Par exercice » se mettent à jour.
   - **Par exercice** : un champ de recherche, puis chaque exercice déjà pratiqué avec sa dernière
     fois (R7). Appui → fiche de l'exercice.

### 4.4 Progrès

1. Pendant une séance : la ligne « Séance en cours · Reprendre » (D3).
2. Dans l'ordre :
   - le fil du jour (`DayThread`) ;
   - Tes charges (`LoadProgressCard`) ;
   - À ta portée (`NearRecordsCard`) ;
   - Ton corps (`BodyBalanceCard`) ;
   - Le mur (`RecordWall`) ;
   - le cumul (`LifetimeLine`) ;
   - enfin **« Toute ta progression »** → `/progress`.

Les cartes gardent leur règle de silence (MUSCU-UX05 R1). Compte sans aucune séance : un seul
message, « Ta progression démarre à ta première séance », et un bouton « Commencer » → S'entraîner.

### 4.5 Aperçu de la séance du jour (nouvel écran)

Ouvert par « Voir les N exercices ». Il liste **exactement ce que Démarrer créera** : tous les
exercices planifiés de la séance (`exercise_plans` non supprimés, ordre du plan), y compris un
exercice archivé du catalogue depuis (nom conservé).
- En-tête : nom, « Aujourd'hui · N exercices · ~X min ».
- Par exercice :
  - numéro et nom ;
  - **l'objectif** : `target_sets × target_reps` tel qu'écrit (« 4 × 8-12 », « 3 × AMRAP ») ;
    « 1 série » quand `target_sets` est vide (c'est ce que le démarrage crée) ; une charge prévue par
    le programme s'ajoute : « · 80 kg prévus » ;
  - la dernière fois, en pastilles de série (R3) ;
  - la suggestion en **libellé long, identique à la séance** (`workout.suggestion.*`), ou
    « Première fois ».
- Bouton collé en bas : **Démarrer**, même chemin que depuis le hub (question du mode R-MO-3, brief
  immersif, verrou anti-double-appui). En mode immersif, Démarrer ouvre le brief, qui annonce à
  nouveau la séance. C'est assumé : le brief fait partie du rituel immersif et lance le chrono.

Pas de bandeau « charges pré-remplies » : ce serait faux dès que le programme fixe une charge.
`startWorkoutFromSession` écrit alors la charge prévue, que la séance préfère à la dernière fois.

### 4.6 Détail d'une séance passée

`/history/[id]` gagne un bouton collé en bas **« Refaire cette séance »**, sous-titré « mêmes
exercices, mêmes charges au départ » (R4). Absent pour une séance sans exercice travaillé.

### 4.7 Accueil

Inchangé (D5).

## 5. Règles métier

- **R1.** Trois onglets, dans cet ordre. Sélection selon D3.
- **R2.** La carte du moment suit l'ordre de priorité actuel (§4.2-1). `resolveHubState` ne change pas.
- **R3. Format d'une « dernière fois ».** Séries validées, hors échauffement, de la dernière séance
  terminée contenant l'exercice (`useLastPerformance`). Les dropsets et les séries à l'échec en font
  partie.
  - Les charges passent par `useUnits` (kg ou lb) sans décimale inutile : « 80 », « 77,5 ».
  - Une seule charge sur toutes les séries : « 80 kg × 8 · 8 · 7 · 6 ».
  - Des charges différentes : « 80 × 8 · 77,5 × 8 · 75 × 9 kg » (unité une fois, en fin).
  - Poids du corps : « PdC × 12 · 10 » ; lesté : « +10 kg × 10 · 9 · 8 » ; assisté (charge
    négative) : « −20 kg × 8 · 8 ».
  - Types différents dans le même exercice : chaque série en entier (« PdC × 10 · +10 kg × 8 »).
  - Série sans charge : « × 8 » ; série sans répétitions : sa charge seule.
  - Exercice en durée : « 0:45 · 0:40 », en `m:ss` comme dans la séance ; lesté :
    « +10 kg · 0:45 · 0:40 ».
  - Au-delà de cinq séries : les cinq premières, puis « +N ».
  - Jamais fait : « Première fois ».
- **R4. Refaire.** `startWorkoutFromWorkout`, inchangée :
  - mêmes exercices, même ordre, mêmes types de séries, charges et répétitions en valeur de départ,
    échauffements et séries non validées compris ;
  - les liaisons superset ne sont pas recopiées (existant, hors périmètre) ;
  - la séance créée est **libre** (D9) : refaire la séance prévue du jour ne coche pas le planning,
    et le hub continue de proposer Démarrer. C'est voulu : pour suivre le programme, c'est Démarrer.

  **Si une séance est déjà en cours**, aucune seconde séance n'est créée. Une alerte « Une séance est
  en cours » propose **Reprendre** ou **Annuler**. Aujourd'hui, la fonction renvoie en silence la
  séance en cours. Le défaut est latent tant que Refaire n'existe qu'en repos ou premiers pas ; il
  deviendrait réel avec l'historique et le détail.
- **R5. Le calendrier.**
  - Un jour est « séance » s'il porte au moins une séance terminée. La date d'une séance est
    `finishedAt`, sinon son début, en jour local : c'est la règle `dateOf` de la liste actuelle.
  - Un jour est « record » si l'une de ses séances a battu un record.
  - Un jour est « prévu » s'il porte une occurrence muscu de statut `planned`, aujourd'hui ou plus
    tard. Les occurrences `skipped` et celles des jours passés ne sont pas affichées.
  - Aujourd'hui est cerclé.
  - Appui sur un jour :
    - avec une séance → son détail ;
    - avec plusieurs séances → la liste se restreint à ce jour, avec une puce « Tout le mois » ;
    - jour vide ou prévu → rien (ce ne sont pas des boutons).
  - Navigation : du mois de la première séance jusqu'au mois courant ; le mois courant seul s'il n'y a
    aucune séance. Mois affiché au départ : le mois courant. Mois sans séance : « Aucune séance ce
    mois-ci. »
  - Le titre du détail garde l'heure de **début**. Une séance à cheval sur minuit est donc rangée au
    jour de fin mais titrée du jour de début. Cas rare, accepté.
  - Un changement de fuseau peut décaler un jour passé : accepté (jours locaux, comme partout).
- **R6.** Le résumé du mois compte ses séances, leur tonnage en **tonnes métriques** et ses records.
  Le tonnage n'est pas converti en livres, comme `LifetimeLine`.
- **R7. Par exercice.**
  - Chaque exercice avec au moins une série validée hors échauffement, trié par date de dernière
    pratique décroissante.
  - Ligne : nom, puis « date · séance », puis la dernière fois (R3), puis le record de charge s'il
    existe.
  - Nom dans la langue courante, sinon en français, sinon dans n'importe quelle langue disponible (un
    exercice perso créé dans l'autre langue).
  - Un exercice archivé reste listé. Son appui ouvre la fiche, qui gère déjà « introuvable ».
  - Recherche insensible à la casse et aux accents, sur le nom affiché.
- **R8.** Pendant une séance en cours, S'entraîner masque « Refaire une séance », « Autre chose » et
  les programmes suggérés. Historique et Progrès montrent la ligne « Reprendre » (D3). Refaire
  applique R4 partout.
- **R9. La séance du jour** est la **première** occurrence `planned` du jour (ordre de la séance
  dans le programme). S'il y en a deux, seule la première est montrée et comptée : le nombre
  d'exercices, la dernière fois et l'aperçu portent sur elle seule. Aujourd'hui, les exercices des
  deux séances sont additionnés, ce qui est corrigé ici.
- **R10. Accessibilité.**
  - Sélecteurs d'onglets en `tablist` / `tab`, avec l'état sélectionné.
  - Jours du calendrier nommés en entier (« mardi 22 septembre : Legs, 2 records ») ; flèches
    nommées (« Mois précédent », « Mois suivant »).
  - Boutons Refaire nommés (« Refaire Legs du 22/09 », date au format de la langue).
  - Cibles tactiles ≥ 44 px. Les contrastes restent ceux des jetons existants (AA, tests-gardes).
- **R11. La suggestion du hub.**
  - Entrées, calculées exactement comme dans la séance pour la série de rang 0 :
    - les séries de la dernière fois ;
    - `usePreviousStruggled` (avant-dernière séance difficile) ;
    - `usePriorWeekAdherence` avec le programme et la **semaine de l'occurrence du jour** ;
    - l'arrondi de charge `proposeLoad` (équipement, barre, unités).
  - Le calcul est **extrait** de `workout.tsx` pour être partagé, pas recopié.
  - La carte le dit en libellé court (nouvelles clés), l'aperçu en libellé long (clés de la séance).

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Compte neuf (ni programme ni séance) | Premiers pas ; pas de « Refaire » ; Autre chose visible ; Historique : mois courant vide ; Progrès : un seul message |
| Séances libres seulement, sans programme | Premiers pas + Refaire (les trois dernières) + Autre chose + programmes suggérés |
| Programme actif, aucune séance faite | Calendrier limité au mois courant, avec ses jours prévus |
| Programme terminé | Carte repos : « Aucune séance à venir dans ton programme » (existant) |
| Séance prévue un jour passé, jamais faite | Le hub dit « repos » et le calendrier ne l'affiche pas (existant, hors périmètre) |
| Deux séances muscu prévues le même jour | La première seulement (R9) |
| Exercice de la séance du jour jamais fait | « Première fois » (R3) ; les autres s'affichent normalement |
| Exercice du plan archivé du catalogue | Présent dans l'aperçu, avec son nom, puisque Démarrer le créera |
| Séance du jour à 1 ou 2 exercices | « La dernière fois » en montre 1 ou 2 ; « Voir l'exercice » / « Voir les 2 exercices » |
| Plan sans répétitions cibles, ou « AMRAP » | Objectif affiché tel quel (« 3 séries », « 3 × AMRAP ») |
| Charge prévue par le programme | « · 80 kg prévus » dans l'aperçu ; la séance démarre sur cette charge |
| Moteur sans suggestion (séance précédente difficile, données absentes) | Pas de pastille |
| Deux séances le même jour | Calendrier : appui → liste du jour (R5) |
| Séance à cheval sur minuit | Rangée au jour de fin, titrée du jour de début (R5) |
| Séance supprimée depuis l'historique | Disparaît du calendrier, des listes, de « Refaire » et de « Par exercice » (soft delete) |
| Refaire pendant une séance en cours | Alerte R4, aucune séance créée |
| Refaire la séance prévue du jour | Séance libre créée ; le planning n'est pas coché ; Démarrer reste proposé (R4) |
| Séance refaite | Affichée « Séance libre » avec ses deux premiers exercices (D9) |
| Pendant une séance, sans programme | Pas de programmes suggérés (R8) |
| Unités en livres | Charges converties ; tonnage en tonnes métriques (R6) |
| Langue anglaise | Mois, jours et libellés en anglais (Intl + i18n) |
| Pilier muscu désactivé | Onglet masqué (existant) |
| Lien `/history` (carte d'activation, liens externes) | Redirigé vers Muscu › Historique (D7) |
| Historique très long (plusieurs centaines de séances) | Liste limitée au mois affiché ; « Par exercice » agrège en SQL. Virtualisation hors périmètre |

## 7. i18n — FR + EN

Toutes les chaînes nouvelles vont dans `fr.json` et `en.json` (test de parité existant). Pluriels en
`_one` / `_other`. Une clé ne porte qu'un seul compteur.

| Clé | FR | EN |
|---|---|---|
| `strengthHub.sections.train` / `.history` / `.progress` | S'entraîner / Historique / Progrès | Train / History / Progress |
| `strengthHub.resumeLine.title` / `.action` | Séance en cours / Reprendre | Workout in progress / Resume |
| `strengthHub.lastTime.title` | La dernière fois | Last time |
| `strengthHub.lastTime.titleOn` | La dernière fois · {{date}} | Last time · {{date}} |
| `strengthHub.lastTime.firstTime` | Première fois | First time |
| `strengthHub.lastTime.seeAll_one` / `_other` | Voir l'exercice / Voir les {{count}} exercices | See the exercise / See all {{count}} exercises |
| `strengthHub.lastTime.tip.weightOrReps` | {{weight}} ou {{reps}} reps | {{weight}} or {{reps}} reps |
| `strengthHub.lastTime.tip.reps` | vise {{reps}} reps | aim for {{reps}} reps |
| `strengthHub.lastTime.tip.weightHold` | reste à {{weight}} | stay at {{weight}} |
| `strengthHub.lastTime.tip.deload` | allège à {{weight}} | drop to {{weight}} |
| `strengthHub.lastTime.tip.duration` | vise {{duration}} | aim for {{duration}} |
| `strengthHub.lastTime.bodyweight` | PdC | BW |
| `strengthHub.redo.title` | Refaire une séance | Repeat a workout |
| `strengthHub.redo.action` | Refaire | Repeat |
| `strengthHub.redo.a11y` | Refaire {{name}} du {{date}} | Repeat {{name}} from {{date}} |
| `strengthHub.redo.allHistory` | Tout l'historique | Full history |
| `strengthHub.redo.freeExercises` | {{first}}, {{second}}… | {{first}}, {{second}}… |
| `strengthHub.redo.busyTitle` | Une séance est en cours | A workout is in progress |
| `strengthHub.redo.busyMessage` | Termine-la ou reprends-la avant d'en commencer une autre. | Finish or resume it before starting another. |
| `strengthHub.other.title` / `.free` / `.templates` | Autre chose / Séance libre / Mes templates | Something else / Free workout / My templates |
| `strengthHub.mode.classic` / `.immersive` / `.change` | Mode classique / Mode immersif / Changer | Classic mode / Immersive mode / Change |
| `strengthHub.progressLink` | Toute ta progression | All your progress |
| `strengthHub.progressEmpty.title` / `.body` / `.cta` | Ta progression démarre à ta première séance. / Charges, records, équilibre du corps : tout s'affichera ici. / Commencer | Your progress starts with your first workout. / Loads, records, body balance: it will all show up here. / Start |
| `workoutMode.changeCta` | Valider | Confirm |
| `sessionPreview.subtitle_one` / `_other` | Aujourd'hui · {{count}} exercice · ~{{minutes}} min / Aujourd'hui · {{count}} exercices · ~{{minutes}} min | Today · {{count}} exercise · ~{{minutes}} min / Today · {{count}} exercises · ~{{minutes}} min |
| `sessionPreview.target` | {{sets}} × {{reps}} | {{sets}} × {{reps}} |
| `sessionPreview.targetSets_one` / `_other` | {{count}} série / {{count}} séries | {{count}} set / {{count}} sets |
| `sessionPreview.plannedLoad` | {{weight}} prévus | {{weight}} planned |
| `history.calendar.previous` / `.next` | Mois précédent / Mois suivant | Previous month / Next month |
| `history.calendar.workouts_one` / `_other` | {{count}} séance / {{count}} séances | {{count}} workout / {{count}} workouts |
| `history.calendar.tonnage` | {{tonnes}} t | {{tonnes}} t |
| `history.calendar.records_one` / `_other` | {{count}} record / {{count}} records | {{count}} PR / {{count}} PRs |
| `history.calendar.legend.done` / `.record` / `.planned` | séance / avec record / prévue | workout / with PR / planned |
| `history.calendar.dayA11y` | {{date}} : {{sessions}} | {{date}}: {{sessions}} |
| `history.calendar.empty` | Aucune séance ce mois-ci. | No workouts this month. |
| `history.calendar.wholeMonth` | Tout le mois | Whole month |
| `history.tabs.sessions` / `.byExercise` | Séances / Par exercice | Workouts / By exercise |
| `history.byExercise.search` | Chercher un exercice | Search an exercise |
| `history.byExercise.when` | {{date}} · {{session}} | {{date}} · {{session}} |
| `history.byExercise.record` | Record : {{value}} | PR: {{value}} |
| `history.byExercise.none` | Aucun exercice ne correspond. | No matching exercise. |
| `history.detail.redo` / `.redoHint` | Refaire cette séance / mêmes exercices, mêmes charges au départ | Repeat this workout / same exercises, same starting loads |

Réutilisées telles quelles : `strengthHub.rest.*`, `home.today.next`, `workout.suggestion.*` (libellés
longs de l'aperçu), `history.freeSession`, `workoutMode.*` (titre et descriptions de la feuille de mode).

## 8. Comportement offline

- **Tout est local** : lectures PowerSync (SQLite) exclusivement. Aucun appel réseau ajouté.
- **Écritures** : uniquement par les fonctions de dépôt existantes (`startWorkoutFromWorkout`,
  `startWorkoutFromSession`, `startWorkoutFromTemplate`, `deleteWorkout`, `setMode`). UUID client,
  horodatage UTC et soft delete déjà en place.
- **Aucune migration, aucune table, aucune sync rule** à redéployer.
- L'onglet sélectionné vit dans un store Zustand en mémoire. Rien n'est persisté ni synchronisé.

## 9. Hors périmètre

- L'historique de la Course (CARDIO-04, BACKLOG) et l'alignement de la Course sur trois onglets.
- La fusion de l'onglet Progrès et de l'écran `/progress` (D8).
- Garder le nom de la séance d'origine sur une séance refaite : il faudrait une colonne (D9).
- La recopie des liaisons superset par Refaire (R4).
- Les séances prévues des jours passés et jamais faites (§6).
- La virtualisation des listes d'historique.
- Une silhouette dans l'état « séance faite » (Q3 : « ou pas »).
- Le « retour en haut » par nouvel appui sur l'onglet, pour les autres piliers (D2).
- Un événement d'analytics sur le choix d'onglet, à discuter si l'on veut mesurer l'usage de
  l'historique.

## 10. Critères de recette

Sur le téléphone de recette de Florian, taille de police système par défaut, thème clair puis
sombre.

**S'entraîner**
- [ ] Un jour de séance prévue, on lit **sans défiler** : le nom de la séance, trois lignes « la
      dernière fois » et le bouton Démarrer.
- [ ] Les pastilles de la carte donnent la même charge et les mêmes répétitions que la suggestion de
      la première série une fois la séance lancée.
- [ ] Un exercice jamais fait affiche « Première fois » ; sans suggestion possible, pas de pastille.
- [ ] Une séance libre faite le matin d'un jour de séance prévue laisse la carte sur « Démarrer ».
- [ ] « Refaire » sur une des trois dernières séances lance une séance libre pré-remplie avec ses
      exercices et ses charges ; le planning n'est pas coché.
- [ ] Une séance refaite apparaît « Séance libre » avec ses deux premiers exercices.
- [ ] Pendant une séance : S'entraîner ne montre que « Reprendre » (ni Refaire, ni Autre chose, ni
      programmes suggérés).
- [ ] « Mode classique · Changer » ouvre le choix, mode courant présélectionné, bouton « Valider » ;
      le Démarrer suivant utilise le nouveau mode.
- [ ] « Séance libre » pose la question du mode à un compte qui n'a jamais rien fait.
- [ ] Le hub n'a plus de silhouette ni de « Voir le détail ».

**Aperçu**
- [ ] « Voir les N exercices » liste tous les exercices du plan, leur objectif (« 4 × 8-12 »,
      « 3 × AMRAP », « 1 série »), la charge prévue s'il y en a une, la dernière fois et la suggestion
      en toutes lettres.
- [ ] Démarrer depuis l'aperçu lance la séance (en immersif : via le brief).
- [ ] Avec deux séances prévues le même jour, la carte et l'aperçu ne parlent que de la première.

**Historique**
- [ ] Le calendrier marque les jours de séance, de record, les séances prévues à venir et
      aujourd'hui ; les jours des mois voisins sont vides.
- [ ] Les flèches s'arrêtent au mois de la première séance et au mois courant ; un mois vide dit
      « Aucune séance ce mois-ci. »
- [ ] Le résumé du mois est juste (séances, tonnes, records) et correctement accordé au singulier.
- [ ] Un jour à une séance ouvre son détail ; un jour à deux séances restreint la liste, et « Tout le
      mois » la rétablit.
- [ ] « Par exercice » est trié du plus récent au plus ancien ; « couche » trouve « Développé
      couché » ; chaque ligne montre la dernière fois, sa date et le record s'il existe.
- [ ] Supprimer une séance (appui long) la retire du calendrier, de la liste, de « Refaire » et de
      « Par exercice ».
- [ ] Le détail d'une séance passée propose « Refaire cette séance ».
- [ ] « Refaire », dans l'historique ou le détail pendant une séance, affiche l'alerte et ne crée
      rien ; « Reprendre » rouvre la séance.
- [ ] La carte d'activation du 6ᵉ jour mène à Muscu › Historique ; « retour » depuis un détail revient
      à l'écran d'où l'on venait.

**Progrès**
- [ ] Les cartes d'analyse s'y trouvent, et « Toute ta progression » ouvre l'écran Progression.
- [ ] Un compte sans séance voit un seul message et « Commencer ».

**Navigation**
- [ ] Les trois onglets changent le contenu sans changer d'écran, et ne restent pas collés en haut au
      défilement.
- [ ] Un nouvel appui sur l'onglet Muscu de la barre du bas ramène en haut du hub.
- [ ] Revenir sur Muscu depuis un autre pilier rouvre le dernier onglet choisi ; relancer l'app
      rouvre S'entraîner.
- [ ] Pendant une séance, Historique et Progrès affichent « Séance en cours · Reprendre » en tête ;
      revenir d'un détail ne change pas d'onglet.

**Transverse**
- [ ] L'accueil est inchangé (carte du moment, quatre actions rapides).
- [ ] Tout fonctionne en mode avion.
- [ ] En anglais, aucun libellé français ne subsiste ; en livres, toutes les charges sont converties
      (le tonnage reste en tonnes).
- [ ] TalkBack annonce les onglets et leur état, les jours du calendrier, les flèches de mois et les
      boutons Refaire.
- [ ] Toutes les cibles font au moins 44 px ; les tests-gardes de contraste passent.
