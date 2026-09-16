# Le Labo — là où tes piliers se croisent

Date : 14/09/2026. Statut : **exploration, version 2**, à discuter. Ni spécification validée, ni
fonctionnalité livrée. Aucune ligne de code applicatif n'a été écrite.

Demande (Florian, 13/09/2026) : une notion de **labo**, un espace à soi où l'utilisateur compose à
partir des piliers activés, attirant et bon pour la rétention, immersif.

Retour de Florian sur la v1 (14/09/2026) : « le concept est là », mais « labo » était à prendre **au
sens très figuré** — l'endroit où l'utilisateur compose ses variables et **croise les données de tous
ses piliers activés**, analyse, se fait des retours sur lui-même. Les fioles et l'atelier de chimie ne
correspondaient ni à l'application ni à son thème. Il veut un lieu très complet, immersif mais
intuitif, qui donne envie de composer.

- **Toile v2** (compte rendu + 14 écrans, Composer et Croiser cliquables) : sources dans
  [design/labo-2026-09/](../../design/labo-2026-09/). Les fichiers `.dc.html` font foi.
- **Prototype jouable** — les disques v2 en 3D réaliste (15/09, three.js embarqué), sources dans
  [design/labo-2026-09/prototype/](../../design/labo-2026-09/prototype/) : pile de disques de fonte,
  piste d'athlétisme, assiette compartimentée et lampes-nuits sur un podium de salle. Quatre onglets
  qui partent du réel : **Semaine** (ce que le Labo voit, un geste par point, appliquer au plan),
  **Composer** (chaque levier chiffré sur les objectifs), **Pourquoi ?** (enquête quand une courbe
  cale, expérience pour trancher), **Acquis** (ce qu'il a appris, à quoi ça sert) ; si la 3D ne
  démarre pas, les mêmes disques s'affichent en 2D. Personnage et chiffres fictifs.
- **v1 « chimie »** archivée dans [design/labo-2026-09/v1-chimie/](../../design/labo-2026-09/v1-chimie/),
  hors de la toile.
- **Fondations** : le [carnet d'innovation](analyse-innovation-2026-09.md) et son tri du 13/09 (idées
  5, 7, 8, 9, 31, 34, 36 gardées ; 24 et 38 retirées, donc non reprises).

---

## 1. Ce qui change entre la v1 et la v2

| Sujet | v1 | v2 |
|---|---|---|
| Le sens de « labo » | un laboratoire de chimie : paillasse, fioles, alambic | l'espace de l'utilisateur, au sens figuré : là où il compose et croise ses piliers |
| L'image centrale | un ballon rempli de couches colorées | **la triade** : les trois scènes de pilier, en cercles qui se chevauchent |
| L'univers visuel | atelier nocturne, bois, lampe, verre | la DA de l'app : scène en dégradé de pilier en haut, papier crème dessous (DASH-01) |
| Le vocabulaire | éléments, réactions, incuber, distiller | **Composer · Croiser · Tester · Retenir**, formule, cycle, bilan |

**Ce qui ne bouge pas** : la formule qui orchestre les piliers sans les dupliquer, les garde-fous
calculés, l'expérience sur soi, le bilan de cycle, le savoir sur soi qui s'accumule, la vue sobre
toujours disponible.

## 2. Le manque

- **Chaque pilier vit seul.** Musculation, Course et Nutrition ont chacun leur scène et leurs réglages.
  Leurs croisements existent, mais éparpillés : un bandeau ici, une carte là.
- **Le moteur est déjà là.** Le [catalogue d'analyses](analyses-donnees.md) compte **87 analyses entre
  piliers** (Muscu↔Course 23, Muscu↔Nutrition 24, Course↔Nutrition 21, tri-piliers 19), dont **28
  livrées** : interférence (MR-08), périodisation glucidique (FUEL-01), garde-fou unifié (GARDE-01),
  charge combinée (META-19), protéines par kilo (MN-06)… Elles n'ont pas de maison.
- **Insights raconte, le Labo fait faire.** L'écran Insights choisit ce qui mérite d'être vu. Le Labo
  est l'endroit actif : on règle, on pose une question, on teste, on garde.

## 3. Le concept : quatre gestes, une boucle

| Geste | Ce qu'on y fait |
|---|---|
| **Composer** | doser les leviers de tous ses piliers sur un seul écran ; les croisements apparaissent pendant qu'on règle, garde-fous compris |
| **Croiser** | poser deux leviers de piliers différents face à face, sur ses propres données : un lien, ou pas |
| **Tester** | quand un croisement reste une piste, une expérience tirée au sort tranche, sur soi |
| **Retenir** | découvertes, ressenti et bilans de cycle : ce qu'on sait de soi, avec d'où ça vient |

La boucle : on compose une formule, on la vit un cycle de 4 à 12 semaines, on croise ce qui s'est
passé, on teste ce qui reste douteux, on retient ce qui est acquis — et la version suivante part de là.

## 4. La direction artistique : la triade

- **Un cercle par pilier activé**, aux couleurs des scènes de DASH-01 (bordeaux, bleu nuit, vert
  profond). Sa taille dit la part du pilier dans la formule. Chacun garde sa matière : l'onde de choc
  de la muscu, le flux de la course, le niveau qui ondule de la nutrition.
- **Là où deux cercles se touchent, un croisement** : doré quand les piliers s'aident, ambre quand ils
  se gênent, corail quand un garde-fou bloque ; au centre quand les trois sont en jeu. Le chiffre
  compte les croisements de la zone.
- **Le socle autour** (sommeil, énergie, douleurs) : un anneau pointillé qui respire, parce qu'il
  entoure les trois piliers sans en être un.
- **Un pilier non activé** : un cercle vide en pointillé, sans reproche ni incitation appuyée (décision H).
- **La lentille** : deux cercles qui se chevauchent aux couleurs des piliers en jeu — l'icône de tout
  croisement, dans les listes, les découvertes et la carte.
- **Déjà dans le code** : `ImpactSilhouette`, `FlowTrace`, `FillLevel`, `BreathRings` dans
  `apps/mobile/src/components/stage/matter/`. La triade les assemble.

## 5. Les quatorze écrans

| # | Écran | Rôle |
|---|---|---|
| 01 | Le Labo | la triade de ses piliers, ce qui se croise aujourd'hui, les quatre gestes |
| 02 | Composer (cliquable) | quatre leviers de trois piliers : cercles, équilibre et croisements bougent en direct |
| 03 | Un croisement | mécanisme, données personnelles, recherche, trois façons de résoudre |
| 04 | Et si… ? | la projection des trois objectifs à la fois : un pilier ne gagne jamais seul |
| 05 | Un levier | sa dose, la recherche contre ses données, avec quoi il se croise |
| 06 | Croiser (cliquable) | quatre paires de leviers, un nuage de points, une phrase honnête — y compris « pas de lien » |
| 07 | La carte | les 55 paires de leviers d'un coup d'œil : ce qui aide, ce qui freine, ce qui manque |
| 08 | Tester sur moi | protocole tiré au sort, mesures sans saisie, verdict scellé |
| 09 | Le cycle | semaine par semaine, pilier par pilier : chaque case se remplit de ce qui a été fait |
| 10 | Le bilan | la triade au départ et à la fin, ce qui a porté, ce qui a coûté, la v3 |
| 11 | Tes découvertes | le ressenti dicté qui devient une piste, et tout ce qu'on sait de soi |
| 12 | Compose avec moi (IA) | l'objectif dicté devient un brouillon vérifié par le calcul |
| 13 | Partir d'une formule | des formules de coach, avec leur empreinte de piliers |
| 14 | Un seul pilier | le Labo avec la muscu seule : les autres cercles attendent en pointillé |

**Complet sans être touffu — trois profondeurs de lecture** : un coup d'œil (la triade), comprendre
(les croisements listés, puis leur feuille), explorer (Croiser et la carte). Même principe que le
bilan de séance à trois niveaux (MUSCU-UX02) : la complexité est rangée, jamais cachée.

## 6. Banque d'idées (24, en six familles)

- **Composer** — la formule née de l'objectif (GUID-01) · un réglage par semaine · la variante
  (vacances, blessure) · « et si… » sur les trois objectifs à la fois.
- **Croiser** — la carte des paires (une case vide dit quelle donnée manque) · le décalage réglable
  (même jour, lendemain, semaine suivante) · « pas de lien » est un résultat · d'où vient ce
  croisement ? (idée 9).
- **Tester** — une piste devient une expérience · le verdict scellé · mesuré sans saisie · des
  protocoles écrits par un coach dans le back-office.
- **Retenir** — les découvertes et leur source · le ressenti qui devient piste · la triade avant /
  après · le carnet exportable en PDF (TRI-14).
- **Rendre vivant** — la triade qui respire (mouvement réduit respecté) · la triade en 3D · le
  croisement qui s'entend (et se sent en vibration au garde-fou) · la triade miniature sur l'accueil.
- **L'IA à côté** — compose avec moi · explique-moi ce croisement · pourquoi mon cycle a calé ?
  (l'Enquête, idée 5) · Fable 5.1 à l'atelier pour écrire règles et fiches FR/EN.

## 7. Pourquoi on y revient

Une raison à chaque échelle : le **jour** (relevé du matin, ce qui se croise aujourd'hui), la
**semaine** (bilan du lundi, un seul réglage permis), l'**expérience** (deux à quatre semaines avant le
verdict scellé), le **cycle** (le bilan qui clôt, la version suivante).

On tient à ce qu'on a composé soi-même, on revient pour connaître la fin d'une expérience, et ce qu'on
apprend sur soi n'existe dans aucune autre app. **Ni XP, ni niveaux, ni badges** (décision C,
ADR-005) ; aucune semaine ratée ne remet rien à zéro ; aucun chiffre ne sort d'ailleurs que d'un calcul
testé.

## 8. Faisabilité

- **La formule** : une couche au-dessus de l'existant — elle référence programmes, cibles
  nutritionnelles et objectif. « Lancer le cycle » applique un changement vu et validé, qui s'applique
  ou se propose selon le régime de guidage (GUID-01). Tables `lab_formulas`, `lab_formula_doses`,
  `lab_experiments`, `lab_discoveries` ; UUID client, soft delete, **règles de synchro PowerSync à
  redéployer à la main**.
- **Les croisements** : des fonctions pures dans `packages/shared`, testées, qui composent les
  analyses livrées. Croiser ajoute une corrélation décalée, avec son intervalle et un seuil de données
  minimal.
- **La triade** : SVG et Reanimated, déjà installés ; les quatre matières existent. La 3D
  (react-three-fiber) seulement après un essai de trois jours sur un Android moyen.
- **L'IA** : Sonnet 5 pour composer avec l'utilisateur, Opus 5 pour une enquête rare, Haiku 4.5 pour
  router, Fable 5.1 à l'atelier seulement. Proxy serveur, consentement séparé, fournisseur
  interchangeable (un modèle GPT peut prendre la place).
- **FR + EN, hors ligne** : tout le Labo marche sans réseau, sauf « Compose avec moi ». Chaque phrase de
  croisement passe par des clés i18n.

## 9. Ce que ça rouvre

- **Décisions C et D** : le Labo reste du côté motivation. « Compose avec moi », les expériences
  illimitées et les formules de coach forment une piste payante, après la V1.
- **La sécurité** : doses bornées, garde-fous non contournables, aucune expérience de restriction
  calorique ni de complément, rien pour un mineur. Déclaration Play « Health apps » à relire avant tout
  envoi à un modèle.
- **Les corrélations** : sur les données d'un seul utilisateur, elles trompent facilement — seuil de
  données, intervalle affiché, « association, pas preuve » partout, et l'expérience pour trancher.
- **La complexité** : un second chemin vers les réglages de chaque pilier. Les écrans des piliers
  restent ; le Labo est une porte en plus pour ceux qui aiment composer.
- **Le calendrier** : la publication Play Store reste le seul bloquant et des dizaines d'US attendent
  une recette — rien de ceci avant LANCE-01.

## 10. Décisions demandées

| # | Question | Recommandation |
|---|---|---|
| **D1** | Les quatre gestes Composer · Croiser · Tester · Retenir, et le mot « formule » ? | Oui : ils décrivent ce qu'on fait, pas une métaphore à apprendre |
| **D2** | La triade comme image du Labo ? | Oui : elle sort des scènes existantes et dit l'intégration en un dessin |
| **D3** | Où entre-t-on ? | Une triade miniature sur l'accueil d'abord ; un onglet si l'usage le justifie |
| **D4** | Croiser montre-t-il des corrélations sur les données de l'utilisateur ? | Oui, avec seuil de données, intervalle et « pas de lien » comme résultat à part entière |
| **D5** | La 3D ? | Triade 2D animée d'abord ; la 3D après essai, critères de sortie fixés avant |
| **D6** | Quand ouvrir le premier lot (Composer + Croiser) ? | Après LANCE-01, via `/us` |
