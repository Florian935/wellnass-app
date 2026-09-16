# Carnet d'innovation — idéation et tri

Date : 13/09/2026. Statut : **idéation triée**, à discuter. Ce document n'est ni une spécification
validée ni une fonctionnalité livrée. Aucune ligne de code applicatif n'a été écrite.

Demande (Florian, 12-13/09/2026) : chercher des fonctionnalités **vraiment innovantes**, qui
démarquent l'app du marché — IA de pointe, visualisations, 3D, « des trucs presque inimaginables » —
et en faire un compte rendu avec maquettes.

- **Planche** (compte rendu + 10 écrans maquettés) : sources dans
  [design/innovation-2026-09/](../../design/innovation-2026-09/). Publiée le 13/09/2026 ; l'hébergement
  des pages s'est montré instable ce jour-là (deux liens supprimés puis réapparus), **les fichiers
  `.dc.html` font foi**.
- **Tri** : Florian a retiré 16 idées sur 38 le 13/09/2026 (§2). Ce document ne garde que les 22
  retenues, plus deux approfondissements : **le Réservoir** (§5), limité aux glucides par décision du
  13/09/2026, et **la vitesse de barre à la caméra** (§6), **retenue** le même jour et passée au
  [BACKLOG](../../BACKLOG.md) sous **VBT-01**.

---

## 1. Le constat qui cadre tout

**Le coach IA conversationnel est devenu un standard du marché en 2026** : MyFitnessPal (AI Coach,
été 2026), Fitbit (coach Gemini), Oura (Advisor), Whoop (Coach), Strava (Athlete Intelligence, et un
connecteur MCP vers Claude depuis juin 2026, en lecture seule). La photo d'assiette est banalisée
(Cal AI, MacroFactor qui ajoute la dictée et un TDEE recalé chaque semaine). Fitbod colore les muscles
selon leur récupération — en musculation seule.

→ **Un chatbot de plus ne nous démarquerait pas.** L'avantage réel de FitTrio est ailleurs : aucun de
ces acteurs ne voit, dans une même base locale, la barre, le bitume, l'assiette, le sommeil, le cycle
et les douleurs. Les idées retenues exploitent ce fait.

**Trois règles** proposées pour toute future US « intelligente » (décision D2, §9) :

1. **Les piliers se parlent, à voix haute** — une idée croise au moins deux piliers, ou le socle
   (sommeil, cycle, douleurs). Une idée mono-pilier, un concurrent spécialisé la fera mieux.
2. **Le moteur calcule, l'IA raconte** — les chiffres sortent d'un calcul local et testé ; le modèle
   lit, choisit et rédige. Déjà posé dans [IDEAS.md](../../IDEAS.md) le 25/07/2026, ici généralisé.
3. **La preuve avant la promesse** — fourchettes, niveau de confiance, pistes écartées affichées,
   « d'où vient ce chiffre ». L'honnêteté devient une fonctionnalité.

Les garde-fous du cadrage tiennent : hors ligne d'abord (B), intégration opt-in (H), pas de boucle de
jeu en V1 (C). **Rien de ceci ne passe avant LANCE-00 / LANCE-01.**

---

## 2. Le tri du 13/09/2026

**Retirées par Florian (16)** — sans motif détaillé, archivées dans IDEAS.md :

| # | Idée | # | Idée |
|---|---|---|---|
| 12 | Colle ton plan (import par capture / PDF) | 25 | La fenêtre d'avant-course |
| 13 | Le menu du resto | 26 | Le frigo décide du dîner |
| 14 | Assiette avant / après | 28 | Le saut du matin |
| 16 | Mémoire des machines | 30 | La respiration haptique |
| 20 | Le parcours qui épouse la séance | 32 | La semaine qui se replie |
| 21 | Duo à distance | 33 | Séance sous contraintes |
| 22 | Le plan jusque dans la montre | 37 | Le lien kiné |
| 24 | La recette élastique | 38 | Les programmes vivants |

**Retenues (22)** : détaillées au §3. Les numéros sont ceux de la planche, conservés pour la
traçabilité.

> L'idée 25 (fenêtre d'avant-course) reste dehors. La question de la réintroduire dans une lecture
> « lipides » du Réservoir ne se pose plus depuis que celui-ci est limité aux glucides (§5). Son sujet
> survit au [catalogue](analyses-donnees.md) sous **RN-21**.

---

## 3. Les 22 idées retenues

Horizons : **H1** = sans réseau ni IA, faisable dans l'architecture actuelle · **H2** = après la
première US IA (proxy Edge Function, consentement IA séparé, plafonds de coût, inférence en UE) ou
après quelques semaines d'historique · **H3** = paris, qui commencent par un essai technique jetable.
Effort : **S** quelques jours · **M** 1 à 3 semaines · **L** 1 à 2 mois (estimations, à réévaluer au
cadrage).

### A. Le corps, rendu visible

| # | Idée | Ce que ça fait | Piliers | Techno | Effort | H | Recoupe |
|---|---|---|---|---|---|---|---|
| 1 | **Carte de fatigue croisée** | Les muscles « chauffent » avec la muscu **et** la course (quadriceps, mollets, fessiers), puis refroidissent selon un modèle de récupération que l'apport protéique module. Estimation affichée comme telle. | Muscu · Course · Alim | local | M | H2 | [analyse Mon corps](analyse-mon-corps-2026-09.md) ; Fitbod ne le fait qu'en muscu |
| 2 | **Survol 3D de la sortie** ★ | Replay cinématique en relief, ruban coloré par l'allure, fractions et « où tu as lâché » posés sur le terrain. | Course | MapLibre (déjà installé) + tuiles de relief | M | H3 | — |
| 3 | **Le curseur du temps** | Un doigt glisse sur l'année : poids, charges, allures et silhouette bougent ensemble. | 3 piliers | local | M | H2 | — |
| 4 | **Sculpture de saison** | L'année en objet 3D génératif (anneau = semaine, épaisseur = charge, couleur = pilier), partageable, exportable pour impression 3D. | 3 piliers | 3D | L | H3 | Wrapped (IDEAS 13/07) |

### B. L'intelligence qui enquête

| # | Idée | Ce que ça fait | Piliers | Techno | Effort | H | Recoupe |
|---|---|---|---|---|---|---|---|
| 5 | **L'Enquête** ★ | « Pourquoi je stagne ? » Un agent utilise le catalogue d'analyses comme outils et rend un dossier : pistes classées par force, **pistes écartées affichées**, une expérience à tenter. Les chiffres viennent du moteur local ; le modèle ne reçoit que des agrégats. | 3 piliers + bien-être | IA avec outils | M | H2 | [ia-integration-analyse.md](ia-integration-analyse.md) usage 1 |
| 6 | **Le Conseil des trois** ★ | Quand les objectifs se contredisent, trois voix (Muscu, Course, Assiette) plaident chiffres à l'appui ; le moteur chiffre deux compromis avec fourchettes ; l'utilisateur tranche ou répond « cette règle ne me correspond pas ». | 3 piliers | moteur + IA pour la narration | M | H2 | Objectif hybride (IDEAS 25/07), contradictions de l'[analyse guidage](analyse-objectif-guidage-2026-09.md) §6 |
| 7 | **Labo N=1** ★ | Expériences protocolées sur soi : alternance tirée au sort, à l'aveugle quand c'est possible (déca préparé par un proche), verdict avec intervalle d'incertitude et effets de bord. Caféine, créatine, heure de séance, glucides la veille… | 3 piliers | local (statistiques) | M | H2 | — |
| 8 | **Carte des leviers** ★ | Graphe personnel de corrélations : épaisseur = force, pointillé = incertain ; un appui envoie le lien au Labo pour le tester. « Corrélation, pas encore cause » affiché. | socle | local | L | H3 | Moteur de corrélations (IDEAS 13/07) |
| 9 | **D'où vient ce chiffre ?** | Appui long sur n'importe quel nombre : sa chaîne de calcul (TDEE ← 14 pesées ← apports) et sa fiabilité. | socle | local | M | H1 | Principe « explicable et contestable » (IDEAS 25/07) |
| 10 | **La mémoire visible** | Ce que l'IA a retenu de l'utilisateur, en phrases claires, modifiable et supprimable ligne à ligne. | socle | IA | S | H2 | — |
| 11 | **L'app qui s'efface** | Elle mesure l'autonomie et propose de retirer du guidage à mesure que l'utilisateur apprend (Guidé → Accompagné → Autonome). | socle | local | S | H2 | [analyse guidage](analyse-objectif-guidage-2026-09.md) §4.4 |

### C. Saisir sans saisir

| # | Idée | Ce que ça fait | Piliers | Techno | Effort | H | Recoupe |
|---|---|---|---|---|---|---|---|
| 15 | **Dicter sa série** | « 80, 8, RPE 8 » : reconnaissance vocale Android sur l'appareil, grammaire fermée — ni IA, ni réseau. | Muscu | local | M | H1 | Commandes vocales en séance (IDEAS 13/07) |
| 17 | **Carnet vocal d'après-séance** | Vingt secondes de ressenti dictées, transcrites sur l'appareil, qui nourrissent le check-in (BIEN-01) et l'Enquête. | socle | local (+ IA) | S | H2 | — |

### D. Le terrain devient partenaire

| # | Idée | Ce que ça fait | Piliers | Techno | Effort | H | Recoupe |
|---|---|---|---|---|---|---|---|
| 18 | **Le Fantôme** ★ | Courir contre soi-même d'il y a N semaines sur le même parcours : l'écart en mètres et en secondes, à l'écran et à la voix. Tout existe déjà (trace GPS, annonces RUN-F2a, suivi de cible RUN-F2b). | Course | local | M | H1 | — |
| 19 | **Le fantôme en son spatial** | Dans le casque, on l'entend derrière soi, sur la gauche, qui revient. | Course | audio | L | H3 | — |

### E. L'assiette branchée sur l'effort

| # | Idée | Ce que ça fait | Piliers | Techno | Effort | H | Recoupe |
|---|---|---|---|---|---|---|---|
| 23 | **Le Réservoir** ★ | Jauge de glycogène estimée sur la journée : elle se vide aux séances, se remplit aux glucides, et prévient avant le fractionné. **Glucides seulement** (décision du 13/09/2026) — **voir §5**. | Alim · Course · Muscu | local | M | H1 | FUEL-01, MN-04, RN-07/08, NUTR-F2 |

### F. Les sens du téléphone

| # | Idée | Ce que ça fait | Piliers | Techno | Effort | H | Recoupe |
|---|---|---|---|---|---|---|---|
| 27 | **Vitesse de barre à la caméra** ★ | Téléphone posé de profil : la vitesse de chaque répétition est mesurée, et sa chute dit quand arrêter la série. ✅ **Retenue le 13/09/2026 → BACKLOG VBT-01.** Questions pratiques : §6. | Muscu | vision par ordinateur sur l'appareil | L | H3 | Module force MUSCPWR-01, RPE/RIR (UX-05) |
| 29 | **Le pouls au doigt** | Doigt sur la caméra et le flash : pouls de repos du matin, sans montre, versé au score de forme (TRI-03). Aucune allégation médicale. | socle | caméra | M | H3 | Readiness sans wearable (IDEAS 13/07) |

### G. Se projeter

| # | Idée | Ce que ça fait | Piliers | Techno | Effort | H | Recoupe |
|---|---|---|---|---|---|---|---|
| 31 | **Météo intérieure** ★ | Prévisions de forme à 7 jours, fourchette comprise (qui s'élargit avec le temps), depuis la charge prévue, le sommeil, le cycle et les apports planifiés ; « fenêtre record » et « pourquoi mercredi est gris ». | 3 piliers | local | M | H2 | TRI-03, GARDE-01, COLLIS-01 |
| 34 | **Lettre à ton futur toi** | Enregistrée en fixant un objectif, rejouée à l'échéance… ou le jour où l'on décroche. | socle | local | S | H1 | OBJ-01, win-back (IDEAS 13/07) |
| 35 | **Le film de ta saison** | Une story verticale générée sur l'appareil : survols, records, courbes qui s'animent. | 3 piliers | local | M | H3 | Wrapped (IDEAS 13/07), PARTAGE-01 |

### H. Un écosystème ouvert

| # | Idée | Ce que ça fait | Piliers | Techno | Effort | H | Recoupe |
|---|---|---|---|---|---|---|---|
| 36 | **Apporte ton IA** | Exposer ses données, pilier par pilier et avec consentement, à l'assistant de son choix (Claude, ChatGPT…) via MCP, en lecture seule d'abord. Strava l'a fait pour un pilier ; notre coût d'IA serait nul. | 3 piliers | serveur | M | H2 | Coach IA (IDEAS 13/07) — alternative sans coût d'inférence |

★ = maquetté sur la planche.

---

## 4. Quel modèle pour quoi

Tarifs de la documentation Anthropic (cache du 24/06/2026) — **à revérifier** avant tout engagement.

| Usage | Modèle | Entrée / sortie · 1 M tokens |
|---|---|---|
| Classer une demande, router | Haiku 4.5 | 1 $ / 5 $ |
| Rédiger l'Enquête et les voix du Conseil | Sonnet 5 | 2 $ / 10 $ au tarif de lancement ; 3 $ / 15 $ annoncés après le 31/08/2026 ([ia-integration-analyse.md](ia-integration-analyse.md)) |
| Enquête difficile à plusieurs outils | Opus 5 | 5 $ / 25 $ |
| Hors production : auditer le catalogue, écrire et relire les règles, préparer du contenu validé par un coach | Fable 5.1 | 10 $ / 50 $ |

- **Fable 5.1 fabrique, l'app exécute** : ses tours longs et son prix le réservent à l'atelier ; ce
  qu'il produit (règles, contenu) tourne ensuite en local.
- **La voix ne part pas au modèle** : Claude ne traite pas l'audio. La dictée passe par la
  reconnaissance vocale d'Android sur l'appareil, seul le texte sort.
- **Le fournisseur reste interchangeable** grâce au proxy serveur et au moteur local.

---

## 5. Le Réservoir — glucides seulement

> **Décision de Florian (13/09/2026)** : le Réservoir reste sur les **glucides**. Une extension aux
> protéines et aux lipides a été étudiée le même jour puis **abandonnée**.

### 5.1 Pourquoi les glucides

La métaphore du réservoir est physiologiquement juste pour les glucides : le glycogène est un **stock
limité** (muscles et foie), qui se vide à l'effort et se remplit avec les glucides ingérés. C'est ce
qui permet de répondre à une question concrète et quotidienne : « vais-je avoir de quoi tenir mon
fractionné de 18 h 30 ? ». Les protéines, elles, ne se stockent pas, et les réserves de lipides sont
quasi illimitées à l'échelle d'une journée : une jauge qui se vide n'aurait pas eu de sens pour elles.

### 5.2 Ce que montre l'écran

Maquette : [Reservoir.dc.html](../../design/innovation-2026-09/Reservoir.dc.html).

- le **niveau estimé maintenant**, en % et en grammes, étiqueté « estimation, pas une mesure » ;
- la **courbe de la journée** : repas qui remplissent, séances qui vident, zone de panne ;
- la **projection** jusqu'à la prochaine séance, avec et sans collation ;
- **une action** : « ajoute ~60 g de glucides avant 16 h 30 », avec des collations qui tiennent les
  macros du jour ;
- **« d'où vient ce chiffre ? »** : poids, séances du jour, repas saisis.

### 5.3 Ce qui existe déjà

L'essentiel du calcul est livré ou catalogué : le Réservoir est surtout une **surface**.

| Brique | État | Rôle dans le Réservoir |
|---|---|---|
| **FUEL-01** — cible glucidique en g/kg selon la charge de course | en recette | Besoin de fond et capacité de référence |
| **MN-04** — glucides péri-séance les jours de muscu | en recette | Moments de remplissage autour des séances |
| **NUTR-16** — répartition calorique par repas | en recette | Découpage de la journée en repas |
| **NUTR-F2** — suggestion d'aliments pour combler un macro | en recette | Les collations proposées par l'action |
| **RN-07** — fueling de la sortie longue | 🆕 catalogue | Projection de la jauge sur une longue |
| **RN-08** — recharge glycogène après la course | 🆕 catalogue | Remontée de la jauge après la séance |

### 5.4 Points durs

1. **Une estimation, affichée comme telle** : capacité déduite du poids, dépense selon la durée et
   l'intensité de la séance, vitesse de recharge plafonnée. La provenance consultable (idée 9) n'est pas
   optionnelle.
2. **L'heure des repas** : le rattachement au repas existe (NUTR-16) ; l'heure réelle de consommation est
   plus fragile (FUEL-01 §5 fait d'exploiter `consumed_at` un lot à part). Commencer par le repas.
3. **Aucune injonction** — même règle que FUEL-01 : un chiffre et une référence, jamais « tu dois manger
   plus ».
4. **Opt-in** (décision H) : sans pilier Course ni Muscu actif, il n'y a pas de séance pour vider la
   jauge ; l'écran doit le dire plutôt que d'afficher une courbe plate.

---

## 6. Vitesse de barre à la caméra — les questions pratiques

> ✅ **Retenue par Florian le 13/09/2026** → candidate **VBT-01** au [BACKLOG](../../BACKLOG.md).
> La première étape reste l'essai technique jetable (§6.4) : il décide de la faisabilité avant toute
> spec.

> Questions de Florian (13/09/2026) : faut-il coller une pastille et filmer sous un angle précis ?
> Faut-il stocker les vidéos (S3), donc payer ?

### 6.1 La mise en place concrète

**Le principe** : le téléphone filme la barre de profil. À chaque image, l'app repère la position du
disque ; la suite des positions donne le déplacement vertical, donc la vitesse de montée de chaque
répétition. La référence d'échelle (pixels → mètres) est **le diamètre du disque** : un disque
olympique standard fait 45 cm.

**Deux manières de repérer le disque :**

| | Avec pastille | Sans pastille |
|---|---|---|
| **Geste utilisateur** | Coller une pastille très contrastée (fluo, quelques cm) au centre du disque ou sur l'extrémité de la barre | Rien : l'app reconnaît le disque (un cercle très reconnaissable) |
| **Difficulté technique** | Faible : suivre une tache de couleur est un calcul simple et peu gourmand | Élevée : détection de cercle ou modèle de reconnaissance embarqué |
| **Robustesse** | Très bonne, même avec un éclairage moyen | Plus fragile : disques non standard (petits disques, dont le diamètre fausse l'échelle), barre masquée par le corps |
| **Friction** | Réelle : disques partagés en salle, pastille à recoller | Nulle |

Les applications du marché qui ont été évaluées (Qwik VBT, Metric VBT, MyLift) travaillent **sans
pastille**, en s'appuyant sur le diamètre standard du disque.
**Recommandation** : l'essai technique commence **avec pastille** (valider la chaîne mesure → vitesse
→ décision au moindre coût), puis teste la version sans pastille. Si la seconde tient sur un Android
moyen, elle devient le défaut et la pastille le repli.

**Le positionnement du téléphone :**

- **Fixe**, jamais tenu à la main : support, sol, banc, bouteille — tout ce qui ne bouge pas.
- **De profil**, objectif face à l'extrémité de la barre, **perpendiculaire** au plan du mouvement :
  un angle oblique fausse la distance parcourue (erreur de perspective).
- **À 1-3 m**, vers la mi-hauteur du trajet, tout le mouvement dans le cadre. Dans l'étude de
  validation citée plus bas : support à 1 m de haut, 3 m sur le côté, vidéo à 60 images/s.
- Valable pour squat, développé couché et soulevé de terre ; un écran d'installation avec une ligne
  guide (« aligne la barre ici ») limite les erreurs de placement.

**Ce que ça vaut** : une étude publiée en 2024 (PLOS One, 20 powerlifters, 589 répétitions comparées à
une capture de mouvement de référence Vicon) conclut que des apps sur smartphone **peuvent être aussi
valides qu'un capteur linéaire** pour la vitesse moyenne de montée — la meilleure affichait une erreur
de l'ordre de 0,01 à 0,04 m/s. Mais la qualité **varie énormément** d'une implémentation à l'autre :
deux des trois apps ont raté 52 et 175 répétitions sur 589. C'est exactement ce que l'essai doit
mesurer avant tout engagement.

### 6.2 Stockage et frais : non, aucune vidéo à stocker

**La vidéo n'est jamais enregistrée.** Les images sont analysées **une par une sur le téléphone, en
direct**, puis jetées. Seuls les **résultats** sont conservés : une vitesse par répétition, quelques
octets, dans une table synchronisée par PowerSync comme le sont déjà les séries. Donc :

- **pas de stockage de fichiers**, ni S3 ni Supabase Storage (le projet est sur Supabase, dont le
  stockage est compatible S3) ;
- **pas d'appel à une API d'IA** : c'est de la vision par ordinateur déterministe, pas un modèle
  génératif — elle ne contredit donc pas la règle « IA = backend » notée dans IDEAS le 25/07/2026 ;
- **pas de donnée d'image personnelle** qui quitte l'appareil — ni la personne, ni les autres membres
  de la salle filmés en arrière-plan. C'est aussi un argument RGPD.

**Les vrais coûts sont ailleurs** : le temps de développement, la recette sur plusieurs Android, la
batterie et la chauffe du téléphone pendant une séance.

**Si un jour on veut « revoir sa série en vidéo »** : la garder **sur le téléphone** (galerie ou
stockage de l'app) ne coûte rien côté serveur. L'envoyer au serveur (partage à un coach, par exemple)
ouvrirait une facturation au volume stocké et transféré, plus un sujet de consentement sur l'image —
**à chiffrer et à arbitrer séparément**, pas nécessaire au principe.

### 6.3 Ce que ça demande techniquement

- **Changer de brique caméra pour cet écran** : `expo-camera`, déjà utilisé pour le code-barres, ne
  sert pas à analyser des images à 30-60 i/s. La voie documentée est **react-native-vision-camera**
  (CameraX sur Android) avec des **frame processors** — le projet a déjà `react-native-worklets` et
  Reanimated, sur lesquels ils s'appuient.
- **Un traitement natif** branché sur ces frame processors (suivi de couleur ou détection de cercle,
  par exemple via OpenCV ou ML Kit). Sous Expo, écrire ce plugin est **la friction connue** — mais le
  dépôt a déjà écrit des modules natifs maison (Health Connect, widget Android).
- **Le dev build** est déjà en place (PowerSync l'impose).
- **Distinction avec une idée écartée** : IDEAS a écarté le 25/07/2026 la « correction de forme par
  caméra en temps réel » (estimation de pose, squelette entier). Ici on suit **un seul point** : c'est
  un ordre de difficulté bien inférieur.

### 6.4 L'essai technique proposé (2-3 jours, jetable, hors pipeline)

Un écran de test isolé : VisionCamera + frame processor + pastille ; tracé de la position verticale ;
vitesse moyenne de montée par répétition ; comparaison à une référence (comptage manuel d'images sur
une vidéo à 60 i/s, ou un capteur de vitesse du commerce si l'un de vous y a accès).

**Critères de sortie proposés** — si l'un échoue, on ne cadre pas d'US :

- au moins **95 % des répétitions détectées** sur squat, développé couché et soulevé de terre ;
- écart **≤ 0,05 m/s** avec la référence ;
- traitement tenu à **≥ 30 i/s** sur un Android milieu de gamme ;
- **pas de chauffe gênante** sur 5 séries enchaînées.

---

## 7. Risques transverses

- **La promesse santé** — vitesse de barre, pouls, réservoir : ce sont des estimations. Aucune
  allégation médicale, des fourchettes, et la déclaration Play « Health apps » à relire avant chaque
  capteur ajouté.
- **La santé chez un tiers** (idées H2) — consentement IA séparé, minimisation (agrégats), inférence
  en UE, et une politique de confidentialité à réécrire : celle préparée pour LANCE-00 affirme
  qu'aucune donnée n'est partagée.
- **Le gadget 3D** — une vue 3D doit répondre à une question qu'un graphe 2D pose mal (« où ai-je
  lâché dans la côte ? »). Même règle que le mouvement : elle ne porte jamais seule l'information.
- **Le démarrage à froid** — Météo, Leviers, Labo, Enquête et Fatigue croisée ont besoin de semaines
  d'historique : l'état « pas encore assez de données » se dessine dès la maquette.
- **La file de recette** — 58 US attendaient une recette sur appareil au 12/09/2026. Empiler du code
  avant de la vider, c'est empiler du non-validé.

---

## 8. Recommandation

Si trois idées seulement devaient passer en `/us` après le lancement :

1. **Le Fantôme (18)** — le plus rentable : tout existe déjà, sans réseau ni IA.
2. **L'Enquête (5)** — la meilleure première US IA : elle consomme le catalogue d'analyses, pose le
   socle IA pour les autres et réveille SOCLE-01 (RevenueCat), qui attend « la première US IA » pour
   avoir quelque chose à ouvrir.
3. **Le Réservoir (23)** — la plus belle démonstration du différenciateur, et surtout une **surface**
   sur des calculs déjà livrés ou catalogués (§5.3).

Hors de ce classement, **la vitesse de barre (27) est déjà retenue** (BACKLOG VBT-01) : elle commence
par son essai technique de 2-3 jours.

---

## 9. Décisions demandées

| # | Question | Recommandation |
|---|---|---|
| **D1** | Quelles idées passent en `/us`, et quand ? | Trois au plus (§8), **après LANCE-01** |
| **D2** | Inscrit-on les trois règles du §1 dans [bonnes-pratiques.md](../specs/technical/bonnes-pratiques.md) ? | Oui, au moment de la première US « intelligente » |
| **D3** | Quelle est la première US IA ? | L'Enquête |
| **D4** | La vitesse de barre est-elle retenue ? | ✅ **Tranchée le 13/09/2026 : oui** → BACKLOG VBT-01. L'essai technique (§6.4) reste la première étape |
| **D5** | Le Réservoir s'étend-il aux protéines et aux lipides ? | ✅ **Tranchée le 13/09/2026 : non**, glucides seulement (§5) |

---

## 10. Sources

- Marché : [MyFitnessPal — Summer 2026](https://blog.myfitnesspal.com/summer-2026-release/) ·
  [Strava — connecteur MCP](https://press.strava.com/articles/strava-launches-mcp-connector) ·
  [Oura Advisor](https://ouraring.com/blog/oura-advisor/) ·
  [MacroFactor vs Cal AI](https://macrofactor.com/macrofactor-vs-cal-ai/) ·
  [Fitbod — Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery) ·
  [Android — Health Connect](https://developer.android.com/health-and-fitness/health-connect)
- Vitesse de barre : [Concurrent validity of novel smartphone-based apps monitoring barbell velocity
  in powerlifting exercises (PLOS One, 2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11575817/) ·
  [VisionCamera](https://visioncamera.margelo.com/docs) ·
  [Frame processors sous Expo (discussion)](https://github.com/mrousavy/react-native-vision-camera/issues/2077)
- Dépôt : [IDEAS.md](../../IDEAS.md), [catalogue d'analyses](analyses-donnees.md),
  [FUEL-01](../specs/functional/us/fuel01-socle-glucidique-coureur.md),
  [analyse Mon corps](analyse-mon-corps-2026-09.md),
  [analyse objectif & guidage](analyse-objectif-guidage-2026-09.md),
  [ia-integration-analyse.md](ia-integration-analyse.md).

**Périmètre** : idéation et tri. Aucune spécification d'US, aucun plan, aucune ligne de code, aucune
migration. Les efforts et positions sont des estimations. Les maquettes utilisent des données fictives.
