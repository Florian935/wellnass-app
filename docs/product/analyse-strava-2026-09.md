# Strava : ce qu'ils font, ce qu'on a déjà, et ce qu'on prend

Date : 20/09/2026. Statut : **proposition de cadrage — révisée sur captures.** Ce document n'est ni
une spécification validée ni une fonctionnalité livrée. **Aucune ligne de code applicatif n'a été
écrite**, et aucune ne doit l'être avant le parcours spec → plan → design → validation
([CLAUDE.md](../../CLAUDE.md)).

**Demande (Florian, 20/09/2026)** : « reprendre pas mal d'idées qu'ils ont sur Strava et les
intégrer dans l'application, comme font un peu toutes les applications du marché ».

**Historique de ce document**
- *Premier jet (20/09, matin)* — écrit de mémoire, connaissance du produit arrêtée à mai 2026, avec
  les trous assumés et marqués.
- *Révision 1 (20/09, matin)* — **12 captures d'écran fournies par Florian**, compte réel **gratuit**
  (0 activité). Elles ont **confirmé** l'essentiel et **corrigé quinze points** (**O1 → O15**), dont
  deux qui changent une recommandation : la **nature du streak** (O1) et la **frontière gratuit /
  payant** (§4).
- *Révision 2 (20/09, après-midi)* — **10 captures de plus**, cette fois avec des activités
  enregistrées : détail d'une sortie, enregistrement en cours, ajout d'amis, notifications, partage
  (**O16 → O25**). Elles ont surtout rempli le **module Course**, qui devient la **§7** — nouvelle
  section écrite à la demande de Florian (20/09) : *« ce que je veux maquetter, c'est tout ce qui
  manque dans le module cardio »*.
- *Cadrage social* — Florian a tranché le 20/09 : **publication par geste explicite**, **amis
  réciproques**, et **on ne l'implémente pas encore** — d'abord le cadrage. Décisions actées dans
  [ADR-009](../adr/ADR-009-couche-sociale.md).

> ⚠️ **Ce qui n'a toujours pas pu être vu**, et pourquoi : ni **page de segment**, ni **page
> Matériel**, ni **Statistiques** — le compte n'a pas assez d'historique pour les remplir ; ni le
> **journal d'entraînement en plein écran** ni le **prix de l'abonnement**, qui sont derrière le
> paywall. Le détail est en **§14**. Les points encore incertains restent marqués **📷**.
>
> 📌 **Une absence qui est une information** : il **n'existe pas d'écran « publier »** chez Strava.
> L'écran « Partager l'activité » (O21) est du partage **externe** — vers Instagram, WhatsApp, un
> lien. Dans le fil, la publication est **automatique**. Le **geste explicite** retenu par Florian
> n'a donc **aucun modèle chez Strava** : on l'invente, et c'est justement ce qui nous en
> distingue.

---

## 1. En bref

- **Strava n'est pas une application de course qui a une couche sociale. C'est un réseau social qui
  se trouve enregistrer des courses.** Les captures le confirment sans ambiguïté : sur cinq onglets
  de navigation, **deux sont purement sociaux** (Accueil = le fil, Groupes = clubs et défis), et
  l'onboarding **impose** de s'abonner à trois personnes comme étape 2 sur 4 (O8). Reprendre les
  fonctionnalités sans reprendre le moteur, c'est prendre la carrosserie.

- **🔴 La découverte qui change une recommandation : le streak de Strava se compte en SEMAINES,
  pas en jours** (O1). « 0 Semaines », « Lindsay a réalisé une série d'activités de 2 semaines ! ».
  Le nôtre est **quotidien** — et on a dû construire **deux mécanismes correctifs** pour le rendre
  supportable : le **joker** (STREAK-01) et les **jours en pause** (VIE-01). Strava n'a pas de
  pansement : il a choisi une **unité qui ne blesse pas**. C'est le meilleur rapport
  impact / coût de tout ce document, et ce n'était pas dans mon premier jet.

- **🔴 La seconde découverte, stratégique : tout ce que Strava fait payer, nous le donnons
  gratuitement** (§4). Derrière le paywall, sur le compte de Florian : **prédictions de chronos**,
  **objectifs**, **effort relatif**, **journal d'entraînement**. Chez nous, trois de ces quatre
  briques sont **déjà livrées et gratuites** (Riegel 5.34, OBJ-01, META-19/GARDE-01). Ce que ça
  dit : après quinze ans de mesure, Strava a conclu que **la valeur qui se vend est l'analyse de sa
  propre progression** — pas l'enregistrement, pas le social. Le social acquiert et retient ;
  l'analyse monétise. C'est directement utile à [ADR-003](../adr/ADR-003-monetisation.md).

- **On a déjà une bonne partie de la couche solo.** 8 des 14 signatures Strava ont un équivalent
  livré chez nous — splits, records toutes distances, carte, dénivelé, export GPX, carte de partage,
  prédiction de chrono, et surtout le **Fantôme** (FANT-01), qui est déjà la moitié d'un segment
  personnel. Détail vérifié dans le code en **§6**.

- **Sur le module Course précisément** (§7, écran par écran) : nos écrans **ne sont pas en retard —
  ils font souvent plus**. Notre écran de course pilote des séances structurées que Strava ne connaît
  pas ; nos trois lectures de la courbe d'allure (ALLURE-01) sont plus intelligentes que leur graphe.
  **Les vrais manques sont ailleurs, et ils sont peu chers** : les **médailles posées sur la carte à
  l'endroit de l'effort** (O17), les **meilleurs efforts de la sortie avec leur rang** (O19 — une
  sortie qui ne bat aucun record ne raconte rien chez nous), le **glisser du doigt sur le graphe**
  (O20), la **variante de partage transparente** (O21) et les **marqueurs départ / arrivée**, que
  notre carte n'a pas du tout.

- **Ce qui manque tient en 13 candidats** (§8). Les quatre à démarrer sont peu chers, utiles seuls,
  sans dépendance sociale : **le streak en semaines** (S13), le **matériel** (S2), le **journal
  d'entraînement** (S5) et les **objectifs récurrents** (S7) — ces deux derniers étant précisément
  ce que Strava fait payer, avec le mode d'emploi maintenant sous les yeux (O3, O4).

- **Le morceau noble reste le « parcours »** (segment personnel, sans classement), à notre portée
  sans réseau parce que FANT-01 a résolu l'appariement. Mais les captures le **relativisent** :
  chez Strava même, Segments et Matériel sont rangés dans un **sous-menu « Plus »** (O6). Ce n'est
  pas une fonction de premier plan. Ça ne mérite pas un onglet chez nous non plus.

- **La couche sociale reste renvoyée en V2**, et les captures **renforcent** l'argument plutôt
  qu'elles ne l'affaiblissent (§9) : même Strava, avec sa densité, doit **pousser activement**
  à suivre trois personnes dès le premier jour (O8). Et notre obstacle d'architecture est intact :
  **chaque table** porte une RLS `user_id = auth.uid()`.

- **Rien de tout ça n'est P0.** 3 candidats P0 avant publication ([BACKLOG.md](../../BACKLOG.md)),
  80 US en attente de recette ([RECETTES.md](../../RECETTES.md)). Ce chantier se place **après
  LANCE-01**.

---

## 2. Ce qu'est vraiment Strava

### 2.1 Ce n'est pas un enregistreur, c'est un agrégateur

Le réflexe naturel est de regarder Strava comme « une app de course avec un bon tracker ». C'est
faux, et c'est le genre d'erreur qui fait copier la mauvaise moitié.

**La majorité des activités qui arrivent sur Strava n'ont pas été enregistrées par Strava** : elles
viennent d'une montre Garmin, d'une Apple Watch, d'un Wahoo, d'un Zwift, et se synchronisent
automatiquement. Les captures le confirment deux fois : l'étape d'onboarding « **Connectez votre
appareil Garmin** » est la seule déjà cochée du parcours (O8), et **chaque activité affiche sa
source** — « 13 septembre 2026 à 11:08 · **Strava App** » (O11). On n'affiche la provenance que
quand elle varie.

**Conséquence pour nous** : notre tracker GPS — la partie du pilier Course qui a coûté le plus cher,
le risque technique majeur assumé par [ADR-002](../adr/ADR-002-perimetre-v1.md) — est précisément
celle dont il y a le moins à prendre. Ce qu'il y aurait à prendre, c'est la **place d'agrégateur** :
[IMPORT-01](../specs/functional/us/import01-import-donnees-externes.md) (en pause) et la sync
continue Garmin, déjà rangée en post-V1 par [prd.md](./prd.md). La brique existe à moitié chez nous
via **Health Connect** ([health-connect.ts](../../apps/mobile/src/lib/health-connect.ts)), qui est le
point d'entrée Android de toutes les montres.

### 2.2 Le moteur, ce sont deux boucles de regard

| Boucle | Le geste | Ce qui la fait tourner |
|---|---|---|
| **Le fil** | Je poste, on me donne des kudos, j'en donne | Des gens qu'on suit, qui postent aussi |
| **Le classement** | Je refais une portion, je monte dans le tableau | Des gens qui ont couru la **même** portion |

Les deux exigent d'autres utilisateurs, socialement liés ou physiquement proches. Aucune ne
fonctionne à un seul utilisateur.

**Et les captures montrent une troisième boucle que je n'avais pas vue** : le **streak est
lui-même social**. Quand Lindsay atteint deux semaines, ça génère une carte dans le fil des autres —
« *Lindsay a réalisé une série d'activités de 2 semaines ! Envoyez-lui vos félicitations pour cet
accomplissement.* » (O1). La régularité n'est pas un compteur privé : c'est un prétexte à kudos.
C'est astucieux, et c'est **exactement la partie qu'on ne peut pas reprendre**.

### 2.3 Mais une couche de mémoire personnelle existe, et elle marche seule

Sous les boucles sociales : la carte de chaleur de ses propres sorties, le kilométrage de ses
chaussures, le journal d'entraînement, les meilleurs efforts, la comparaison à ses propres passages.
**C'est là qu'est tout ce qu'on peut prendre.** Et c'est cohérent avec notre positionnement
([vision.md](./vision.md)) : l'intégration des trois piliers, pas le fil d'actualité.

---

## 3. Ce que les captures ont appris — vingt-cinq observations

> *Observations faites le 20/09/2026 sur 12 captures d'un compte **gratuit** sans activité.
> Elles priment sur ma mémoire partout où les deux divergent.*

**O1 — 🔴 Le streak se compte en SEMAINES, et il est social.**
« Votre série d'activités » en tête du fil, flamme, « **0 Semaines** ». Et dans le fil des autres :
« Lindsay a réalisé une série d'activités de **2 semaines** ! Envoyez-lui vos félicitations ».
Un lien « **Voir le calendrier** » et, sur le profil, une **grille de points mensuelle**.
**C'est l'observation la plus utile des douze** — voir S13.

**O2 — 🔴 Le paywall porte exactement sur l'analyse de sa progression.** Écran « Vous → Progrès »,
bloc verrouillé 🔒 « **Libérez tout votre potentiel** » : **prédictions de chronos**, **objectifs**,
**effort relatif**, **journal d'entraînement**. Traité en §4.

**O3 — Le journal d'entraînement est en TEMPS, pas en distance.** Une semaine (l m m j v s d), des
**bulles proportionnelles** avec la durée écrite dedans (« 0 h 10 min », « 2 h 12 min »), un petit
point pour une séance courte, et le **total de la semaine** en haut à droite (« 4 h 9 min »).
Le choix du temps plutôt que de la distance est ce qui le rend **multi-sport** — une bulle de
natation et une bulle de course sont comparables en minutes, pas en kilomètres. Précieux pour S5,
qu'on veut tri-piliers.

**O4 — L'objectif hebdomadaire est en NOMBRE D'ACTIVITÉS.** « Objectif hebdomadaire — **1 activité
/ 4** », anneau de progression vert. Pas en kilomètres. C'est un objectif d'**habitude**, pas de
performance — beaucoup plus atteignable, et cohérent avec un streak hebdomadaire (O1).

**O5 — L'écran d'enregistrement EST la carte.** Pas d'écran dédié : la **carte de chaleur** occupe
tout l'écran, un panneau bas affiche Temps / Temps intermédiaire moyen / Distance à zéro, avec le
gros bouton ▶️ orange au centre, le **sport** à gauche et « **Ajouter un itinéraire** » à droite.
Boutons flottants : **calques (2)**, **3D**, recentrage. Très différent de chez nous.

**O6 — Segments et Matériel sont rangés dans un sous-menu.** Onglet « Vous » → « **Plus** » →
une liste sobre : **Statistiques**, **Segments**, **Matériel**. La signature historique de Strava
n'est pas mise en avant dans la navigation. **Ça relativise S1** : le parcours mérite une entrée,
pas un onglet.

**O7 — Les photos servent à photographier l'écran de la machine.** L'activité « Tapiiiiiiis » de
Lindsay porte un carrousel **photos + vidéo (0:04, muette, autoplay)** montrant… **l'écran du tapis
Life Fitness** avec ses mesures. C'est un usage réel, observé : quand l'app ne peut pas capter la
donnée, l'utilisateur la **photographie**. Argument direct pour S4, et il se branche sur notre mode
sans GPS / tapis (roadmap 5.21).

**O8 — L'onboarding social est forcé et persistant.** Carte « **Continuez sur votre lancée !** »
avec jauge **2/4**, plantée dans le fil : « Chargez votre première activité », « **Abonnez-vous à
trois personnes (1/3)** », « Connectez votre appareil Garmin » (✅). Strava **sait** que sans graphe
social il n'y a pas de rétention, et le pousse au jour 1. **C'est la preuve directe de l'obstacle
« démarrage à froid »** de la §8.

**O9 — Les défis sponsorisés sont injectés dans le fil, avec preuve sociale.** Carte « Challenges
suggérés » entre deux activités : **Abbott Miles to Majors**, « Plus de **165 000 athlètes** se sont
déjà inscrits », badge « Récompense », bouton « Participer au challenge ».

**O10 — La gamification d'activation existe, et elle est assumée.** « **Collection de trophées** » :
hexagones verrouillés **Première activité · Troisième activité · Cinquième activité · 10e activité**.
Ce n'est pas la boucle de jeu écartée par [ADR-005](../adr/ADR-005-gamification.md) — c'est de
l'**activation**, le même rôle que notre **ACTIV-01** (« 7 jours pour démarrer », en recette).
La frontière est plus fine que « gamification oui/non ».

**O11 — La source et le lieu sont affichés.** « 13 septembre 2026 à 11:08 · **Strava App** », et le
lieu au niveau de la commune : « **Prémilhat, Allier** », « **Limoges, Haute-Vienne** ».
Publier une activité, c'est publier où quelqu'un court et à quelle heure — §8, obstacle 4.

**O12 — Les titres sont automatiques et horaires.** « Course à pied **du midi** », « Course à pied
**le soir** ». Gratuit à produire, et ça évite l'écran vide du champ « titre ».

**O13 — Le sélecteur de sport a une recherche et des catégories.** Feuille « Filtrer par sport » :
un champ **Rechercher**, une section « **Vos sports les plus pratiqués** », puis des catégories
(« Sports à pied » : Course à pied, Trail, Marche, Randonnée, **Course en fauteuil**). Nos 22 types
([activity.ts](../../packages/shared/src/activity.ts)) sont une grille plate de 8 + « Tout voir » —
le patron de Strava est meilleur à cette échelle, et **il inclut l'accessibilité**.

**O14 — Les records incluent le mile, et chaque activité porte un compteur de « Performances ».**
« Lindsay a réalisé son meilleur temps sur **un mile** ! » sur une sortie de 1,66 km, et en en-tête
« **Performances** 🥇🥈 **18** ». Nos records couvrent 1/5/10 km, semi, marathon — **pas le mile**.
Détail, mais il coûte une ligne.

**O15 — Cinq onglets, dont deux purement sociaux.** **Accueil** (le fil) · **Cartes** ·
**Enregistrer** (au centre) · **Groupes** · **Vous**. Le premier écran de l'app, c'est le fil des
autres — pas ses propres données.

### Seconde salve — 10 captures du 20/09/2026 (après-midi), compte avec activités

*Elles couvrent ce qui manquait : le détail d'une activité, l'enregistrement en cours, l'ajout
d'amis, les notifications, et le partage.*

**O16 — Le détail d'une activité : la carte occupe tout le haut, le reste est une feuille
glissante.** Carte plein écran avec **départ en point vert**, **arrivée en damier**, **flèche de sens**
sur le tracé ; puis une feuille qu'on remonte, portant l'auteur, la date + heure + **commune**, le
titre, les chiffres, et les actions. Deux boutons flottent sur la carte : **marque-page** et
**menu ⋮**.

**O17 — 🔴 Les médailles sont posées SUR la carte, à l'endroit où l'effort a eu lieu.**
« 2ᵉ meilleur temps sur un demi-mile — Meilleure perf de tous les temps » et « 2ᵉ meilleur temps sur
1 km », chacune plantée au bon endroit du tracé. On ne lit pas seulement *qu'on* a bien couru, on
voit **où**. C'est la meilleure idée des dix captures.

**O18 — 🔴 Un bouton ▶️ rejoue le parcours**, en animant le tracé sur la carte.

**O19 — 🔴 Les meilleurs efforts sont listés PAR SORTIE, avec un rang et un écart.**
« Meilleurs efforts **4** / Performances **8** », puis `🥈2 · 1 mile · 9:04 · 5:38/km`,
`🥈2 · 1 KM · 5:31`, `🥈2 · 1/2 mile · 4:26`, et « Afficher tous les résultats ». Le bandeau donne
l'écart au record : « **▼ 57 s** ». **Une sortie qui ne bat aucun record raconte quand même quelque
chose** — c'est ce que notre app ne sait pas faire (§7.4).

**O20 — Le graphe d'allure se parcourt au doigt**, et c'est marqué « **NOUVEAU** » dans l'app :
« Appuyez sur le graphique et faites glisser votre doigt pour voir vos statistiques à n'importe quel
moment de votre activité. » Les **temps intermédiaires** sont un tableau Km / Allure / barre bleue
proportionnelle / Élévation.

**O21 — Sept variantes de partage, dont une PNG transparente.** Carrousel de 7 formats : carte +
tracé + chiffres, **version transparente** (chiffres et tracé sur fond alpha, à coller sur sa propre
photo en story), et des destinations explicites — Stories, WhatsApp, Messages, **Copier**,
**Télécharger**, **Lien**.

**O22 — L'ajout d'ami passe par trois portes : Suggestion · Contacts · QR code.** 🔴 **Le QR code est
la porte à reprendre** : on se met côte à côte, on scanne, c'est fait. Aucun annuaire public, aucune
recherche de personnes, aucune permission de répertoire — **exactement ce qu'il faut à un modèle
d'amis réciproques**. Les « suggestions » (des inconnus populaires, 309 131 abonnés) et l'accès aux
**contacts du téléphone** sont, eux, à écarter : annuaire public et permission lourde.

**O23 — Les notifications confirment le streak hebdomadaire — et une bonne partie sonne creux.**
Confirmation formelle de O1 : « *Faites preuve de régularité en enregistrant une activité **une fois
par semaine*** ». Mais à côté des vraies notifications (kudos reçus, commentaire reçu), on trouve
« Wahou ! Bien joué, Florian », « Bravo Florian 👏 — kudos pour votre nouvelle activité
enregistrée », « Une activité de plus 🙌 — vous avez bien bougé » : **l'app se félicite elle-même**,
en trois messages pour la même course. **À ne pas reprendre** — c'est du réengagement industriel, et
c'est l'inverse exact de notre ligne (NARR-01 : l'IA ne peut pas inventer un chiffre).

**O24 — L'écran d'enregistrement est d'une sobriété extrême.** Fond noir, chrono géant, **deux**
métriques (temps intermédiaire moyen, distance), une rangée de barres « temps intermédiaires /km »
en bas, un seul bouton « Mettre en pause ». Pas de carte pendant l'effort.

**O25 — La source matérielle est affichée en pied d'activité** : « **Garmin Forerunner 45** » avec
une icône d'appareil, ou « Strava App ». Troisième confirmation de §2.1. À noter aussi : « *Vous
étiez avec quelqu'un qui n'a pas enregistré l'activité ?* → **Ajouter d'autres amis** » — ils
récupèrent du graphe social jusque dans l'écran de détail.

---

## 4. Le paywall de Strava, et ce qu'il nous dit

C'est l'apprentissage le plus stratégique des captures, et il ne concerne pas une fonctionnalité
mais notre positionnement.

**Ce qui est verrouillé** (compte gratuit, 0 activité, bandeau 🔒 « Libérez tout votre potentiel » et
bouton « Commencer l'essai gratuit ») :

| Verrouillé chez Strava | Chez nous |
|---|---|
| **Prédictions de chronos** (5 km 28:26, 10 km 1:00:04, avec l'écart attendu) | ✅ **livré et gratuit** — Riegel, roadmap 5.34 |
| **Objectifs** (dont l'objectif hebdomadaire) | ✅ **livré et gratuit** — OBJ-01 *(mais à échéance, pas récurrent → S7)* |
| **Effort relatif** (79 cette semaine, 12 la précédente) | ✅ **livré et gratuit** — ACWR, META-19 / GARDE-01 |
| **Journal d'entraînement** | ⬜ **pas encore fait** → candidat **S5** |
| **Challenges de groupe entre amis** | ❌ social, V2 |
| **« Essayez un entraînement — Aperçu limité »** *(plans structurés)* | ✅ bibliothèque de programmes, gratuite (5.2, CONTENU-01) |

**Ce qui est gratuit** : le fil, les kudos, les commentaires, les photos et vidéos, la carte de
l'activité, distance / allure / temps, les **records personnels** et le compteur de performances,
la **série** et son calendrier, les **clubs**, les **défis sponsorisés**, l'**enregistrement**, et la
**carte de chaleur** en consultation. Segments et Matériel sont accessibles depuis le menu — leur
contenu n'a pas pu être vérifié, le compte étant vide 📷.

**Les trois conclusions**

1. **Strava ne fait pas payer l'enregistrement, ni le social.** L'enregistrement est une commodité ;
   le social est le moteur d'acquisition et de rétention — le faire payer le tuerait. Ce qui se vend,
   c'est **l'analyse de sa propre progression dans le temps**. Après quinze ans de mesure sur des
   dizaines de millions d'utilisateurs, c'est une donnée, pas une opinion.

2. **Nous donnons gratuitement trois des quatre briques qu'ils vendent.** Ce n'est pas un problème —
   [ADR-003](../adr/ADR-003-monetisation.md) acte que l'app est **entièrement gratuite au lancement**
   et que la monétisation, le jour venu, fera payer « la profondeur et l'intégration, jamais l'accès
   de base ». Les captures **confirment que cette frontière est la bonne** : c'est exactement celle
   que Strava a trouvée. À verser au dossier quand la grille de prix sera rediscutée.

3. **Le journal d'entraînement (S5) monte en priorité.** C'est la seule des quatre qu'on n'a pas,
   c'est payant chez eux, et on a maintenant son mode d'emploi précis (O3). Et notre version serait
   **tri-piliers**, ce que la leur ne peut pas être.

---

## 5. La carte complète de Strava — neuf couches

> **Accès** : ✅ gratuit *(observé)* · 🔒 payant *(observé)* · 📷 non vérifiable sur un compte vide.
> **Nous** : ✅ livré · 🟡 partiel · ⬜ absent · ❌ écarté par une décision.

### Couche A — Enregistrement

| Fonctionnalité | Ce que c'est | Accès | Nous |
|---|---|:---:|:---:|
| Multi-sport avec catégories et recherche | Sections, favoris, jusqu'à la course en fauteuil (O13) | ✅ | 🟡 22 types en saisie manuelle, **2 avec tracker**, grille plate |
| L'enregistrement sur fond de carte de chaleur | Play central, sport à gauche, itinéraire à droite (O5) | ✅ | ⬜ écran dédié chez nous |
| GPS + auto-pause | | ✅ | ✅ |
| Tours / fractions | | ✅ | ✅ RUN-F4 |
| Annonces audio | | ✅ | ✅ RUN-F2a |
| Écran verrouillé | | ✅ | ✅ |
| Ajouter un itinéraire avant de partir | | 📷 | ⬜ → **S9** |
| Segments en direct | | 📷 | ⬜ → **S1** |
| Beacon | Suivi en direct par un proche | 📷 | ⬜ → **S8** |

### Couche B — L'activité, après coup

| Fonctionnalité | Ce que c'est | Accès | Nous |
|---|---|:---:|:---:|
| Titre automatique horaire | « du midi », « le soir » (O12) | ✅ | ⬜ **une ligne de code** |
| Description libre | | ✅ | ✅ `notes` |
| **Photos et vidéos** | Carrousel, vidéo muette en autoplay (O7) | ✅ | ⬜ → **S4** |
| Carte du parcours | Tracé orange, fond OpenStreetMap | ✅ | ✅ `RouteMap.tsx` |
| Trois métriques en en-tête | Distance · Allure · Temps | ✅ | ✅ |
| Lieu au niveau commune | « Prémilhat, Allier » (O11) | ✅ | ⬜ |
| Source de l'activité | « Strava App » (O11) | ✅ | ⬜ *(utile le jour d'IMPORT-01)* |
| Compteur de « Performances » | 🥇🥈 18 par activité (O14) | ✅ | 🟡 records sans compteur |
| Bandeau de record | « meilleur temps sur 5 km », médaille PR | ✅ | ✅ |
| Splits par km | | 📷 | ✅ |
| Courbes FC / cadence / puissance | | 📷 | ❌ pas de FC en V1 |
| Résumé IA de l'activité | | 📷 | ✅ **NARR-01** (19/09) |
| Matériel associé | | ✅ | ⬜ → **S2** |

### Couche C — Segments

| Fonctionnalité | Ce que c'est | Accès | Nous |
|---|---|:---:|:---:|
| Entrée « Segments » | Dans le menu « Plus », pas en avant (O6) | ✅ | ⬜ |
| Créer un segment, appariement automatique | | 📷 | ⬜ → **S1** |
| Historique d'efforts, record personnel | | 📷 | ⬜ → **cœur de S1** |
| Classements publics (KOM/QOM/CR), Local Legend | | 📷 | ❌ social |

### Couche D — Social

| Fonctionnalité | Accès | Nous |
|---|:---:|:---:|
| Fil d'actualité — **le premier écran de l'app** (O15) | ✅ | ❌ V2 |
| Kudos 👍 et commentaires 💬 | ✅ | ❌ V2 |
| Partage d'une activité 🔗 | ✅ | ✅ **PARTAGE-01** *(image, sans réseau)* |
| Abonnés / abonnements, profil public, « Partager le profil » | ✅ | ❌ V2 |
| Messagerie (icône bulle en en-tête) | ✅ | ❌ V2 |
| **Le streak comme objet social** (O1) | ✅ | ❌ — notre streak est privé |
| Onboarding qui impose 3 abonnements (O8) | ✅ | ❌ |

### Couche E — Clubs et défis *(onglet « Groupes »)*

| Fonctionnalité | Accès | Nous |
|---|:---:|:---:|
| Trois sous-onglets : Challenges · Clubs · Événements | ✅ | ❌ V2 |
| Défis sponsorisés, filtrés par sport, dans le fil (O9) | ✅ | ❌ — et sponsors hors sujet |
| **Défis de groupe entre amis** | 🔒 | ❌ V2 |
| Créer et gérer un club depuis l'app *(« Nouveau ! »)* | ✅ | ❌ V2 |
| **Collection de trophées** d'activation (O10) | ✅ | 🟡 **ACTIV-01** joue ce rôle autrement |

### Couche F — Cartes et exploration

| Fonctionnalité | Accès | Nous |
|---|:---:|:---:|
| **Carte de chaleur globale** — plein écran, calques, 3D | ✅ *(consultation)* | ❌ impossible sans masse |
| Carte de chaleur **personnelle** | 📷 | ⬜ → **S3** |
| Itinéraires : construire, enregistrer, suivre | 📷 | ⬜ → **S9** |

### Couche G — Entraînement et progression *(onglet « Vous » → Progrès)*

| Fonctionnalité | Ce que c'est | Accès | Nous |
|---|---|:---:|:---:|
| « Cette semaine » | Distance · Temps · Dénivelé | ✅ | ✅ `RunWeekCard` |
| **12 dernières semaines** | Courbe de volume par semaine | ✅ | 🟡 30/90 j par type |
| **Série** + calendrier en points (O1) | **En semaines** | ✅ | 🟡 **en jours** → **S13** |
| **Prédictions de chronos** | 5 et 10 km, avec l'écart attendu | 🔒 | ✅ **gratuit** (5.34) |
| **Objectifs** | Hebdomadaire, en **activités** (O4) | 🔒 | 🟡 OBJ-01 à échéance → **S7** |
| **Effort relatif** | Score hebdo, deux semaines comparées | 🔒 | ✅ ACWR **gratuit** |
| **Journal d'entraînement** | Bulles en **temps**, total hebdo (O3) | 🔒 | ⬜ → **S5** |
| Plans d'entraînement | « Aperçu limité » | 🔒 | ✅ programmes **gratuits** |
| Statistiques | Menu « Plus » | 📷 | ✅ `StatsSection` |

### Couche H — Matériel et confort

| Fonctionnalité | Accès | Nous |
|---|:---:|:---:|
| **Matériel** (chaussures, vélo, kilométrage) — menu « Plus » | ✅ | ⬜ → **S2** |
| Zones de confidentialité | 📷 | ⬜ — inutile aujourd'hui, **obligatoire si on partage** (§8) |
| Modifier / partager le profil | ✅ | 🟡 |

### Couche I — Écosystème

| Fonctionnalité | Accès | Nous |
|---|:---:|:---:|
| Sync Garmin / Apple / Wahoo — poussée dès l'onboarding (O8) | ✅ | 🟡 **Health Connect** |
| Export GPX | ✅ | ✅ [gpx-export.ts](../../apps/mobile/src/lib/gpx-export.ts) |
| Partage d'image vers les réseaux | ✅ | ✅ **PARTAGE-01** |
| API publique | ✅ | ⬜ |

---

## 6. Ce qu'on a déjà — dix constats vérifiés dans le code

*Chaque affirmation renvoie au fichier qui la porte. Cette section ne dépend d'aucune capture :
elle est vraie indépendamment de ce que fait Strava.*

**C1 — Le Fantôme a déjà résolu la moitié difficile d'un segment.**
[`run-ghost.ts`](../../packages/shared/src/run-ghost.ts) sait **apparier deux courses** par
proximité de départ (`GHOST_MAX_START_DISTANCE_M = 300`), **construire un profil temps → distance**
(`buildGhostProfile`), **interpoler la position du fantôme** (`ghostDistanceAt`) et **neutraliser les
pauses** (`GHOST_PAUSE_GAP_S = 60`, pour ne pas comparer du temps net à du temps d'horloge). C'est la
mécanique d'un effort de segment. Manque : savoir comparer une **portion** plutôt qu'une course
entière. Spec : [fant01-fantome-course.md](../specs/functional/us/fant01-fantome-course.md).

**C2 — La trace est stockée en un seul bloc sur la ligne de course.**
[`runs.gps_track text`](../../supabase/migrations/20260707120000_running_runs.sql) — pas de table de
points ; `appendToTrack` / `decodeTrack` encodent et décodent. Le tracker échantillonne à
**1 point/seconde ou tous les 5 mètres** (`TIME_INTERVAL_MS`, `DISTANCE_INTERVAL_M` dans
`running/tracker.ts`). **Fait technique le plus structurant du document** : il conditionne la
faisabilité de S1 et S3.

**C3 — La carte existe, avec simplification à l'affichage.**
`RouteMap.tsx`, MapLibre + MapTiler ([ADR-006](../adr/ADR-006-cartographie.md)), `simplifyTrack`
(Douglas-Peucker) au rendu.

**C4 — Le partage en image existe déjà, et il est abouti.**
[`share-card-export.ts`](../../apps/mobile/src/lib/share-card-export.ts) +
`components/share/ShareCard.tsx` : capture PNG → feuille de partage OS, 100 % local, aucun réseau.
Branché sur `run/analysis.tsx` **et** `workout-summary.tsx`.

**C5 — Les records couvrent presque toutes les distances de Strava.**
`pace-records.ts`, `records.ts`, `live-records.ts`, `near-record.ts` : meilleur segment glissant sur
1 / 5 / 10 km, semi, marathon (roadmap 5.30), avec mise à jour de l'allure de référence (5.31).
**Manque le mile** (O14).

**C6 — Splits, dénivelé, terrain et prédiction de chrono sont livrés.**
`computeKmSplits`, `elevation_gain_m` / `elevation_loss_m` (RUN-F1b),
`terrain in ('road','trail','track','treadmill')` (RUN-F3), Riegel (5.34).

**C7 — Les objectifs existent, mais d'une autre nature que ceux de Strava.**
[`goals.ts`](../../packages/shared/src/goals.ts) : `GOAL_KINDS = ['run_distance', 'exercise_1rm']`,
**à échéance**, avec verdict conservé, 3 actifs maximum (OBJ-01). Strava propose du **récurrent**,
**en nombre d'activités** (O4) — pas la même boucle. → **S7**.

**C8 — 🔴 Notre streak est quotidien, et on l'a patché deux fois.**
[`streak.ts`](../../packages/shared/src/streak.ts) : `computeStreak` compte des **jours consécutifs**.
Pour le rendre supportable, deux mécanismes ont été construits par-dessus —
[`streak-joker.ts`](../../packages/shared/src/streak-joker.ts) (STREAK-01 : un joker gèle **un jour
isolé**, avec trois règles de crédibilité) et **VIE-01** (les jours « en pause », un troisième état
de jour, « ni cassé ni allongé »). Deux US, un troisième état dans le modèle, et le problème reste
un problème. **Strava n'a rien de tout ça : il compte en semaines** (O1). → **S13**.

**C9 — « Segment » est déjà pris, et veut dire autre chose.**
`SegmentBanner.tsx` (CARDIO-UX01), `session_intervals`, `run_intervals` : chez nous un segment est une
**phase d'une séance structurée** — échauffement, fraction 3/6, récup (RUN-F4). Reprendre le mot de
Strava créerait une ambiguïté permanente.

**C10 — Tout le modèle de données est strictement mono-utilisateur.**
Vérifié sur les migrations : **chaque** table porte les trois mêmes politiques RLS —
`select` / `insert` / `update` avec `user_id = auth.uid()` — et les règles PowerSync bucketisent par
utilisateur ([powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml)). Aucune notion
de « visible par quelqu'un d'autre ». **Cœur de la §8.**

---

## 7. Le module Course, écran par écran — ce qui manque

> *Ajouté le 20/09/2026 à la demande de Florian : « ce que je veux maquetter, c'est tout ce qui
> manque dans le module cardio qu'on a dans l'application, vis-à-vis de ce qu'eux ils ont en plus et
> qu'on n'a pas ». Chaque écran est comparé à **ce que notre code affiche réellement aujourd'hui**,
> vérifié fichier par fichier — pas à ce que la roadmap prétend.*

### 7.1 L'écran d'enregistrement, pendant la course

**Strava** (O24) : fond noir, **chrono géant** en haut, deux métriques seulement (temps intermédiaire
moyen, distance), une **rangée de barres « temps intermédiaires /km »** en bas — le km en cours en
bleu souligné d'orange, les suivants en gris — et un seul bouton pleine largeur « Mettre en pause ».
Rien d'autre. Pas de carte pendant l'effort.

**Nous** : [run/active.tsx](../../apps/mobile/src/app/run/active.tsx) après CARDIO-UX01 — hero
distance, allure instantanée et moyenne, bande de cible, et le `SegmentBanner` qui dit dans quelle
fraction on est.

**Le jugement honnête : notre écran n'est pas en retard, il fait plus.** Strava n'a pas de séances
structurées à piloter ; nous si (RUN-F4). Il n'y a **rien à reprendre sur le fond**. La seule idée
qui vaut : **la rangée de barres des km**, qui donne d'un coup d'œil le km en cours *et* ceux déjà
faits, sans rien lire. → **candidat de finition, pas de refonte.**

### 7.2 La carte de la sortie

**Strava** : départ **point vert**, arrivée **damier**, **flèche de sens** sur le tracé, et surtout
deux choses qu'on n'a pas du tout —
- 🔴 **les médailles posées sur la carte, à l'endroit exact où l'effort a eu lieu** (« 2ᵉ meilleur
  temps sur 1 km » planté au bon endroit du tracé). On voit *où* on a fait son meilleur kilomètre ;
- 🔴 **un bouton ▶️ qui rejoue le parcours** en animant le tracé ;
- une **vignette photo** incrustée dans un coin de la carte ;
- le **lieu** en clair sous le nom (« Clermont-Ferrand, Puy-de-Dôme »).

**Nous** : [RouteMap.tsx](../../apps/mobile/src/components/running/RouteMap.tsx) dessine **un tracé
nu** — aucun marqueur de départ ni d'arrivée, aucune annotation, aucun sens.

**C'est le plus gros écart visuel du module**, et le moins cher à combler pour les quatre premiers
points. Le rejeu animé est le seul qui demande un vrai travail.

### 7.3 Les chiffres de la sortie

**Strava** : grille **2 × 3**, uniforme, lisible — Distance · Allure moyenne · **Durée de
déplacement** · Dénivelé positif · **Calories** · **Cadence moy. (ppm)**, et sur une autre sortie
**Altitude max** · **Pas**. Plus, en pied de page, **la source matérielle** : « Garmin Forerunner 45 »
ou « Strava App », avec une icône d'appareil.

**Nous** : [run/summary.tsx](../../apps/mobile/src/app/run/summary.tsx) et
[run/analysis.tsx](../../apps/mobile/src/app/run/analysis.tsx) couvrent distance, allure, durée,
dénivelé, terrain, ressenti, et les calories via `RunEnergySection` (DEPENSE-01).

**Manquent** : **cadence**, **altitude max**, **pas pendant la course**, **la source**.
⚠️ **Nuance technique** : cadence et pas **ne viennent pas du GPS** — ils viennent d'un capteur de
montre. Chez nous, la porte d'entrée est **Health Connect**
([health-connect.ts](../../apps/mobile/src/lib/health-connect.ts)), pas le tracker. Ce n'est donc pas
un travail d'affichage : c'est une extension de la lecture Health Connect, avec une **permission
supplémentaire à déclarer** — et la déclaration Play ne se dépose qu'une fois (LANCE-00). L'altitude
max, elle, est gratuite : on a déjà la trace et l'élévation.

### 7.4 Les meilleurs efforts **de cette sortie** 🔴

**Strava** : un bloc « **Meilleurs efforts 4** / Performances 8 » qui liste, **pour cette sortie-là**,
chaque distance atteinte avec son temps, son allure, et **son rang en médaille** :
`🥈2 · 1 mile · 9:04 · 5:38/km` · `🥈2 · 1 KM · 5:31` · `🥈2 · 1/2 mile · 4:26`. Et le bandeau en
tête donne **l'écart au record** : « deuxième meilleur temps sur un mile — **▼ 57 s** ».

**Nous** : on a les records **globaux** ([pace-records.ts](../../packages/shared/src/pace-records.ts),
`records.ts`, `live-records.ts`) et une célébration **quand un record tombe** (`CelebrationCard`).
Mais **rien qui dise, sortie par sortie, « voici tes meilleurs efforts d'aujourd'hui et où ils se
placent »**. Une sortie qui n'a battu aucun record ne raconte rien — alors qu'un 2ᵉ ou 3ᵉ meilleur
temps est une information *motivante* et qu'on a déjà tout le calcul pour la produire.

**C'est le manque fonctionnel le plus net du module**, et il est **peu cher** : le meilleur segment
glissant est déjà calculé, il ne manque que le **classement** (rang + écart) et l'écran.
⚠️ Et il faut **ajouter le mile et le demi-mile** à `RUNNING_RECORD_DISTANCES` (O14) : ce sont des
repères que les coureurs utilisent, et l'app ne les connaît pas.

### 7.5 Le graphe d'allure

**Strava** : un graphe d'aire, avec — marqué « **NOUVEAU** » dans l'app — **le glisser du doigt sur
le graphe** pour lire ses statistiques à n'importe quel instant de l'activité.

**Nous** : [PaceCurveCards.tsx](../../apps/mobile/src/components/run/PaceCurveCards.tsx) (ALLURE-01)
donne **trois lectures** — dérive d'allure, mélange de zones, équilibre des moitiés — plus le tableau
des splits par km avec le plus rapide en accent.

**Là encore, honnêtement : notre analyse est plus intelligente que la leur.** Un graphe brut ne dit
pas si on a fini plus vite qu'on a commencé ; `computePaceFade` le dit. **Ce qui manque n'est pas
l'analyse, c'est le geste** : pouvoir poser le doigt et lire. → **candidat d'interaction, à faible
coût, fort effet.**

### 7.6 Le partage

**Strava** : **sept variantes** dans un carrousel, dont — et c'est la bonne idée — une version
**PNG transparente** : chiffres et tracé sur fond transparent, à coller par-dessus sa propre photo
dans une story. Plus « Copier », « Télécharger », « Lien ».

**Nous** : **PARTAGE-01** est livré et solide
([share-card-export.ts](../../apps/mobile/src/lib/share-card-export.ts),
[ShareCard.tsx](../../apps/mobile/src/components/share/ShareCard.tsx)) — mais **une seule variante**,
carrée, à fond opaque.

**La variante transparente est quasi gratuite** : même composant, fond retiré, `captureRef` sait
produire du PNG à canal alpha. C'est le meilleur rapport effet / effort de toute la §7.

### 7.7 Ce qui est absent du module, purement et simplement

| Manque | Candidat | Coût |
|---|---|---|
| Le **parcours** (segment personnel, sans classement) | **S1** | élevé |
| Les **chaussures** et leur kilométrage | **S2** | faible |
| La **carte de chaleur personnelle** | **S3** | moyen |
| Les **photos** d'une sortie | **S4** | faible à moyen |
| Le **marque-page** (mettre une sortie de côté) | — | très faible |
| Le **titre automatique horaire** (« Course du matin ») | **S10** | très faible |

---

## 8. Les treize candidats

*Chacun : ce que c'est, ce que ça donnerait chez nous, le point dur, ce dont il dépend. Les coûts
sont des ordres de grandeur destinés à prioriser, pas à planifier.*

### S13 — La **série en semaines** ⭐ *(nouveau, issu des captures)*

**Chez Strava** (O1) : la série se compte en **semaines actives**. Une semaine où l'on a bougé au
moins une fois maintient la flamme. Un lien « Voir le calendrier », une grille de points mensuelle,
et un post automatique dans le fil des autres aux paliers.

**Chez nous** : notre série est **quotidienne** (C8), donc fragile par construction — rater un
mardi la casse. On a répondu par deux US et un troisième état de jour dans le modèle (joker
STREAK-01, jours en pause VIE-01). **Strava a répondu en changeant l'unité.** Une semaine
laisse sept occasions de la sauver ; elle tolère une grippe, un déplacement, un jour de repos —
qui est *recommandé* dans tout plan d'entraînement sérieux. Notre streak quotidien est, littéralement,
en contradiction avec nos propres programmes.

**Ce que je propose** : pas de remplacement brutal. Une **série hebdomadaire affichée à côté** de la
quotidienne, ou un **choix d'unité** dans les réglages, puis on regarde les analytics. Le compteur
quotidien a ses partisans ; l'erreur serait de trancher sans mesurer.

**Point dur** : trois systèmes disent déjà à l'utilisateur ce qu'il doit faire cette semaine —
la série, **GUID-01** (régime de guidage) et les objectifs. En ajouter un quatrième sans les
articuler ajouterait du bruit. À cadrer avec **S7**, dans la même US.
**Coût** : faible — `computeStreak` est un module pur et testé, une variante hebdomadaire est courte.
**Dépend de** : rien. **C'est mon premier choix, devant S2.**

### S1 — Le **parcours** : courir contre ses propres passages ⭐

**Chez Strava** : une portion de route ; chaque passage crée un « effort » ; record personnel,
progression, et classement public.

**Chez nous** : tout sauf le classement. Je découpe une portion depuis une de mes traces — « la
montée du parc », « la ligne droite du canal ». Chaque course qui passe dessus crée un passage.
J'ai mon record, mes dix derniers passages, ma progression sur six mois. C'est le Fantôme (C1),
mais sur une portion et **en rétrospective** au lieu d'en direct.

**Ce que les captures changent** : **rien sur le fond, beaucoup sur la place.** O6 montre que
Segments vit dans un sous-menu « Plus », à côté de Statistiques et Matériel. Ce n'est pas un onglet,
ce n'est pas sur l'accueil. Ça cadre bien avec [ADR-007](../adr/ADR-007-surfacage-analyses.md).

**Point dur n° 1 — ne jamais recalculer à l'affichage.** Avec `gps_track` en un bloc par course (C2),
chercher « les passages sur ce parcours » signifierait décoder **tout l'historique** à chaque
ouverture d'écran. Une heure de course ≈ 3 000 points ; 200 courses, c'est des dizaines de Mo.
**Il faut matérialiser** : une table de passages, alimentée **une fois, à la fin de chaque course**,
plus un rattrapage à la création d'un parcours. Précédent dans le dépôt :
[IMPORT-01](../specs/functional/us/import01-import-donnees-externes.md) a découvert que
`personal_records` n'est **pas** dérivée, et qu'un historique importé sans appel explicite n'aurait
aucun record. Même piège, même remède.

**Point dur n° 2 — l'appariement géométrique.** Le GPS dérive de 5 à 15 m : couloir de tolérance,
pré-filtre par boîte englobante, règle pour le sens de parcours (aller ≠ retour) et pour les passages
partiels. `isGhostCandidate` en fait une version simplifiée sur les départs.

**Point dur n° 3 — inutile sur tapis, trompeur en forêt dense.** Message honnête quand la trace n'est
pas fiable.

**Coût** : le plus gros du lot, à découper en 4 lots. **Dépend de** : rien — intégralement hors-ligne,
exactement l'esprit de la décision B.

### S2 — Le **matériel** : mes chaussures et leur kilométrage

**Chez Strava** : on déclare ses chaussures, on les associe aux sorties, le kilométrage se cumule,
un rappel prévient de l'usure. Rangé dans « Plus » (O6).

**Chez nous** : identique, avec un seuil réglable (600–900 km). Et un prolongement que Strava ne fait
pas : croiser l'usure avec le **journal des zones douloureuses** (DOUL-01, livré) — « tes douleurs au
genou ont commencé vers 700 km sur cette paire ». C'est notre différenciateur, pas le sien.

**Point dur** : quasi aucun. Petite table, association par défaut, cumul. L'attribution rétroactive
demande un choix (par défaut : futures sorties seulement).
**Coût** : faible. **Dépend de** : rien.

### S5 — Le **journal d'entraînement** ⭐

**Chez Strava** (O3) : une semaine, une bulle par séance dont la **taille dit la durée**, la durée
écrite dedans, le **total de la semaine** en haut à droite. **Payant.**

**Chez nous** : la même chose, **avec les trois piliers sur la même grille**. Strava ne peut pas le
faire ; nous oui. Et le choix du **temps plutôt que de la distance** (O3) est précisément ce qui rend
la comparaison possible entre une séance de muscu, une course et une sortie vélo — une observation
qu'on n'aurait pas faite sans la capture.

**Ce que les captures changent** : c'est passé de « bonne idée » à **priorité**. C'est la seule des
quatre briques payantes de Strava qu'on n'a pas (§4), et on a maintenant son mode d'emploi.

**Point dur** : le surfaçage. [ADR-007](../adr/ADR-007-surfacage-analyses.md) est explicite — on ne
peut pas continuer d'empiler des sections permanentes. Ce calendrier doit **remplacer** quelque
chose ou vivre dans « Insights » (INSIGHTS-01). Et le planning existe déjà
([planning/index.tsx](../../apps/mobile/src/app/planning/index.tsx)) : il montre le **prévu**, pas le
**réalisé** — les deux doivent se parler, pas se dupliquer.
**Coût** : moyen. **Dépend de** : rien.

### S7 — Les **objectifs récurrents**

**Chez Strava** (O4) : « Objectif hebdomadaire — **1 activité / 4** », anneau de progression.
En **nombre d'activités**, pas en kilomètres. **Payant.**

**Chez nous** : OBJ-01 ne connaît que deux types, **à échéance** (C7). Il manque le **récurrent**,
qui est une boucle différente : il se réarme seul, chaque semaine. Et le choix de Strava — compter
des **activités** plutôt que des kilomètres — en fait un objectif d'**habitude**, atteignable par
un débutant, cohérent avec un streak hebdomadaire.

**Point dur** : l'articulation avec la série (S13) et **GUID-01**. Trois systèmes qui disent « voilà
ce que tu dois faire cette semaine » peuvent se contredire. **À cadrer dans la même US que S13.**
**Coût** : faible à moyen.

### S4 — Les **photos** d'une sortie

**Chez Strava** (O7) : carrousel photos + vidéos, autoplay muet. Usage réel observé :
**photographier l'écran du tapis** pour récupérer ce que l'app ne capte pas.

**Chez nous** : une à trois photos sur une course ou une séance. Sans fil d'actualité, ça reste un
carnet. Ça alimente la **carte de partage** (C4) et le **récap annuel** (S6). Et le cas du tapis se
branche directement sur notre **mode sans GPS** (roadmap 5.21) : l'utilisateur qui court sur tapis
n'a ni carte ni trace — une photo de l'écran de la machine est exactement ce qui manque.

**Point dur** : le stockage. **Première donnée lourde du projet**, qui change la nature du coût
d'hébergement. Deux options : **(a)** photos **locales seulement**, jamais synchronisées — gratuit,
perdues au changement de téléphone ; **(b)** Supabase Storage avec quota et compression. Voir **D5**.
**Coût** : faible si (a), moyen si (b).

### S3 — La **carte de chaleur personnelle**

**Chez Strava** : la globale est spectaculaire et sert d'écran d'enregistrement (O5) ; la
personnelle superpose ses propres traces.

**Chez nous** : la globale est hors d'atteinte — elle *est* la masse d'utilisateurs. La personnelle
est à notre portée, sur MapLibre, avec le **même point dur que S1** : il faut une trace **simplifiée
et pré-calculée** par course, stockée à l'enregistrement (on a déjà `simplifyTrack`).

**Point dur secondaire, sérieux** : une carte de chaleur personnelle **montre où on habite**.
Strictement local, sans risque. Mais on a déjà le partage d'image (C4) : le jour où l'une croise
l'autre, il faut les **zones de confidentialité en même temps**, pas après (**D7**).
**Coût** : moyen. **Dépend de** : la même brique que S1 → même lot.

### S6 — Le **récap annuel**

**Chez Strava** : « Year in Sport », en décembre, massivement partagé.

**Chez nous** : on a déjà **BILAN-01** (hebdomadaire) et **NARR-01** (l'IA qui raconte sans pouvoir
inventer un chiffre). Le récap annuel est la même machinerie sur douze mois, avec la carte de partage
en sortie. Peu de travail neuf, effet fort.

**Point dur** : le calendrier, littéralement — ça n'a d'intérêt qu'en décembre, et la première année
l'historique sera maigre. **Coût** : faible. **Dépend de** : S4 pour les photos.

### S9 — Les **itinéraires**

**Chez Strava** : constructeur, suggestions basées sur la popularité réelle, navigation guidée, et
« **Ajouter un itinéraire** » directement à côté du bouton de départ (O5).

**Chez nous** : les **suggestions** sont hors d'atteinte (elles reposent sur la masse de traces).
Reste **« refaire un parcours que j'ai déjà fait »** : enregistrer une de ses traces comme itinéraire
et être guidé dessus — encore une extension de FANT-01 et de S1.

**Point dur** : le turn-by-turn est un métier à part entière. La version honnête est modeste : la
trace sur la carte, et une alerte « tu t'es écarté ». **Coût** : moyen (modeste) à élevé (vraie).

### S8 — Le **partage de position en direct**

Fonction de **sécurité**, pas de social : courir seul, tôt, tard, en forêt.

**Point dur, rédhibitoire à court terme** : ça suppose un **point d'accès public non authentifié**
(le proche n'a pas de compte), donc une table lisible sans `auth.uid()` — la première brèche dans
C10 — plus une politique de rétention. Et c'est une **géolocalisation temps réel transmise hors de
l'appareil**, ce qui **rouvre la déclaration « Sécurité des données » du Play Store**, qui ne se
dépose **qu'une fois** (LANCE-00). **Coût** : élevé. **Hors de question avant publication.**

### S10 — Les **petits manques de la couche records**

Trois lignes, chacune courte, toutes confirmées par les captures :
le **mile** dans les distances de record (O14) · le **compteur de performances** par activité (O14) ·
le **titre automatique horaire** « du midi » / « le soir » (O12), qui évite un champ vide.
**Coût** : très faible. Candidat naturel pour un lot de finition.

### S11 — L'**effort relatif**

**Impossible tel quel** : dépend de la FC, absente en V1 par décision
([running.md](../specs/functional/running.md)). Notre équivalent existe : **META-19 / GARDE-01**
(ACWR). La seule reprise utile est la **présentation** — Strava affiche **deux semaines côte à côte**
avec un code couleur (79 en rouge, 12 en violet) plutôt qu'un chiffre nu. Idée d'UI, pas de
fonctionnalité.

### S12 — La **couche sociale**

Traitée en §8.

---

## 9. La couche sociale — la décision qu'on ne peut pas éviter

C'est le moteur de Strava (§2.2). C'est aussi la chose la plus chère du document, et son coût n'est
pas là où on l'attend.

**Obstacle 1 — L'architecture, et c'est le vrai.** Constat C10 : **chaque table** du schéma a une RLS
`user_id = auth.uid()`, et PowerSync bucketise par utilisateur. Il n'existe **aucune** notion de
donnée visible par un tiers. Partager une seule course, ce n'est pas ajouter un écran : c'est
introduire un **second modèle de droits** (qui voit quoi, sur quel critère, révocable comment) et un
**second type de bucket de synchro**, sur un schéma de 50 tables et 79 migrations. Ce n'est pas une
US, c'est un chantier d'architecture qui mérite son propre ADR.

**Obstacle 2 — Le démarrage à froid, et les captures le prouvent.** Un fil vide est pire que pas de
fil : il annonce que l'app est déserte. **O8 est la preuve directe** — Strava, avec sa densité, plante
dans le fil une checklist d'onboarding « 2/4 » dont l'étape 2 est « **Abonnez-vous à trois
personnes** ». S'ils doivent le forcer, c'est que même chez eux le graphe ne se forme pas tout seul.
Une app à quelques centaines d'utilisateurs répartis dans toute la France n'a, elle, aucune chance
d'avoir deux personnes sur la même portion de route.

**Obstacle 3 — La modération.** Dès qu'il y a du contenu public — titres, commentaires, photos, noms
de segments — il y a obligation de modération et canal de signalement. Pour une équipe de deux, c'est
une charge permanente, pas un développement ponctuel. Et O7 rappelle que les photos publiées peuvent
contenir n'importe quoi, y compris des personnes en arrière-plan.

**Obstacle 4 — La géolocalisation d'un particulier.** O11 : Strava affiche publiquement le **lieu**
(« Prémilhat, Allier »), l'**heure** et la **trace**. Publier ça, c'est publier où quelqu'un habite
et quand il sort. Les zones de confidentialité deviennent **obligatoires et activées par défaut**.
Et ça touche la **déclaration « Sécurité des données »** du Play Store, qui ne se dépose **qu'une
fois** (LANCE-00) — le même piège que celui identifié pour les calories dans
[analyse-depense-activites-2026-09.md](./analyse-depense-activites-2026-09.md).

**Recommandation** : maintenir la décision — social en **V2**, avec son propre ADR. Et si le besoin
réel est « montrer ce que j'ai fait », rappeler qu'on y répond **déjà** sans réseau social : la carte
de partage (C4) envoie l'image où l'utilisateur veut — **y compris sur Strava**. Être un producteur
de contenu pour le réseau des autres coûte zéro et rend le même service. C'est une position
stratégique, pas un repli.

---

## 10. Ce qu'on ne reprend pas, et pourquoi

| Ce qu'on écarte | Pourquoi |
|---|---|
| **Les classements publics (KOM/QOM/CR)** | Sans masse, le tableau est vide ou ridicule (« 1ᵉʳ sur 1 »). Et ils attirent la triche : Strava y consacre des moyens qu'on n'a pas. |
| **Les défis sponsorisés** (O9) | Supposent des partenariats commerciaux. Sans rapport avec notre modèle ([ADR-003](../adr/ADR-003-monetisation.md) : gratuit au lancement). |
| **Le streak comme objet social** (O1) | On prend **l'unité de temps** (S13), pas la mise en scène publique. |
| **L'effort relatif au sens strict** | Dépend de la FC, absente en V1. Notre ACWR joue ce rôle. |
| **La carte de chaleur globale** | Mathématiquement hors d'atteinte : elle *est* la masse d'utilisateurs. |
| **Le fil comme écran d'accueil** (O15) | Notre accueil est cadré par [ADR-007](../adr/ADR-007-surfacage-analyses.md) et INSIGHTS-02 (dégonflage du Tier 0). Y mettre un fil défairait ce travail. |
| **L'interface de Strava** | On reprend des **idées**, pas des écrans. Notre DA (crème / terracotta, accents par pilier, DASH-01, MOTION-01) est un actif ; le noir et orange de Strava n'a rien à faire chez nous. |
| **La collection de trophées** (O10) | Gamification hors V1 ([ADR-005](../adr/ADR-005-gamification.md)). **Nuance** : c'est de l'*activation*, pas une boucle de jeu, et **ACTIV-01** joue déjà ce rôle chez nous. |

---

## 11. Le plan proposé

> Tout ce qui suit est **après LANCE-01**. Aucun lot ne doit précéder la publication.

**Phase 0 — gratuite, tout de suite** *(hors code)*
Trancher le vocabulaire (**D1**). Sans ça, S1 sera spécifié dans l'ambiguïté.

**Phase A — la régularité et le carnet** *(≈ 3 US)*
**S13 + S7 dans la même US** (série hebdomadaire et objectif récurrent : même boucle, à articuler
avec GUID-01 sous peine de se contredire) · **S2** matériel · **S5** journal d'entraînement
tri-piliers. Aucune dépendance entre elles, chacune utile seule, aucune touche à l'architecture.
**C'est le lot à démarrer.**

**Phase B — le parcours** *(1 grosse US, 4 lots)*
**S1**. B1 : la brique de trace simplifiée + matérialisée (sert aussi à S3). B2 : moteur
d'appariement et table des passages. B3 : les écrans (créer, liste, détail). B4 : rattrapage
d'historique.

**Phase C — le territoire et la mémoire** *(≈ 3 US)*
**S3** carte de chaleur personnelle *(réutilise B1)* + **D7** zones de confidentialité ·
**S4** photos · **S6** récap annuel, calé sur décembre · **S9** refaire un parcours, version modeste.

**Phase Z — au fil de l'eau**
**S10** (le mile, le compteur de performances, le titre horaire) : trois lignes à glisser dans
n'importe quel lot de finition du pilier Course.

**Hors plan — décisions, pas développements**
**S8** partage de position et **S12** social : chacun mérite un **ADR** avant toute spec.

---

## 12. Décisions demandées

| # | Décision | Ma recommandation |
|---|---|---|
| **D1** | **Quel mot pour « portion de route » ?** « Segment » est déjà pris (C9). | **« Parcours »** — français, clair, ne heurte rien dans le code. |
| **D2** | **S1 va-t-il jusqu'au classement ?** | **Non, strictement personnel.** Le classement est le morceau qui exige le réseau. |
| **D3** | **Par quoi démarrer ?** | **🔄 Recommandation modifiée par les captures : S13 (la série en semaines), pas S2.** Coût le plus faible, effet le plus large, et ça répond à un problème qu'on a déjà tenté de résoudre deux fois (C8). |
| **D4** | **S13 : on remplace la série quotidienne, ou on ajoute l'hebdomadaire ?** | **On ajoute et on mesure.** Un remplacement brutal casserait les séries en cours de nos bêta-testeurs. Réglage ou double affichage, puis analytics. |
| **D5** | **Le journal d'entraînement (S5) est-il tri-piliers dès le départ ?** | **Oui** — c'est ce qui le distingue de celui de Strava, et **en temps**, pas en distance (O3), sans quoi les piliers ne sont pas comparables. |
| **D6** | **Les photos (S4) : locales seulement, ou synchronisées ?** | **Locales d'abord.** Le Storage est la première donnée lourde ; on peut synchroniser plus tard, l'inverse est plus dur. |
| **D7** | **Zones de confidentialité : quand ?** | **Au moment de S3**, pas avant, pas après. La carte de chaleur est le premier écran qui montre où on habite. |
| **D8** | **Confirme-t-on la couche sociale en V2 ?** | **Oui**, avec un **ADR dédié** avant toute spec. Les captures (O8) renforcent l'argument. |
| **D9** | **Que fait-on de ce que Strava fait payer et qu'on donne (§4) ?** | **Rien maintenant** — l'app est gratuite au lancement (ADR-003). Mais **verser §4 au dossier** de la future grille de prix : Strava nous dit où est la valeur perçue. |
| **D10** | **Verse-t-on les captures au dépôt ?** | **Non.** Elles contiennent le nom, la photo, les lieux et les horaires d'une **tierce personne** (Lindsay Ferrandon). Le document conserve les observations, datées ; les images restent hors du dépôt. |
| **D11** | **Ce chantier passe-t-il avant le Labo et la dépense ?** | **Non.** Tous trois post-LANCE-01 ; celui-ci est le moins avancé des trois. |

---

## 13. Risques

- **Copier la mauvaise moitié.** Risque principal, et sournois : les fonctionnalités les plus
  *visibles* de Strava sont les sociales (deux onglets sur cinq, O15), et ce sont celles qui ne
  peuvent pas marcher chez nous. Un tri fait par enthousiasme aboutirait à un fil vide et à un
  classement à un participant.
- **Ajouter des écrans à une app qui en a déjà trop.** [ADR-007](../adr/ADR-007-surfacage-analyses.md)
  et INSIGHTS-02 existent parce qu'on a déjà empilé. Chaque candidat doit dire **où il se surface et
  ce qu'il remplace**, sinon il est refusé. O6 aide : même Strava range ses signatures dans un
  sous-menu.
- **Le coût caché du décodage des traces** (C2). Si S1 ou S3 partent sur du calcul à l'affichage, ils
  seront lents chez qui a deux ans d'historique — et invisibles en développement, où l'historique est
  vide. **À écrire dans la spec, pas à découvrir en recette.**
- **Multiplier les voix qui disent quoi faire cette semaine.** Série, objectifs, GUID-01, et bientôt
  journal d'entraînement : quatre systèmes sur le même sujet. C'est pourquoi S13 et S7 doivent être
  cadrés ensemble.
- **Repousser encore le lancement.** 3 P0 restants, 80 US en recette. Ce document est une réserve,
  pas une file d'attente.

---

## 14. Ce qui manque encore en captures

*22 captures fournies au total. **Le module Course est couvert** — la §7 peut être maquettée en
l'état. Ce qui reste manquant est listé avec ce que ça empêche de trancher, et **aucun de ces
manques ne bloque les maquettes du module Course**.*

**✅ Obtenu dans la seconde salve** : l'enregistrement en cours (O24), le détail complet d'une
activité (O16→O20), l'ajout d'amis (O22), les notifications (O23), le partage (O21).

| Ce qui manque encore | Ce que ça débloque | Priorité |
|---|---|:---:|
| **Une page de segment** *(menu Plus → Segments, toujours vide)* | Comment historique personnel et classement cohabitent : c'est ce qui dira ce qu'on perd en retirant le classement (**S1**) | 🔴 *pour S1 seulement* |
| **La page Matériel** *(vide : aucune chaussure déclarée)* | Comment ils présentent l'usure et le rappel (**S2**) | 🟠 |
| **Le calendrier de la série** *(lien « Voir le calendrier »)* | La maille exacte de la série hebdomadaire et son affichage (**S13**) — O1 et O23 en donnent déjà le principe | 🟠 |
| **L'écran d'abonnement** *(prix, paliers)* | Compléter §4 : on a le *quoi*, pas le *combien* | 🟠 |
| **Statistiques** *(menu Plus)* | Comparer à notre `StatsSection` | 🟢 |
| **Le journal d'entraînement en plein écran** *(paywall)* | La vue mensuelle / annuelle, si elle existe (**S5**) | 🟢 |

> **Comment obtenir les deux premières** : déclarer une paire de chaussures dans Strava remplit la
> page Matériel en une minute ; créer un segment depuis une sortie existante remplit la page Segment.
> Les deux ne demandent **aucune course supplémentaire**.

**Utilisable en l'état** : tout le reste. Les **§6** (notre code), **§7** (le module Course, comparé
fichier par fichier), **§9** (notre schéma) et **§10** (nos décisions) ne bougeront pas avec de
nouvelles captures.

---

## 15. Ce qui n'a pas été fait

- **Aucune maquette.** Le design vient après la validation de la spec, et aucun candidat n'est encore
  une US.
- **Aucun chiffrage sérieux.** Les « coûts » de la §7 servent à prioriser, pas à planifier.
- **Les captures ne sont pas versionnées** (D10) : elles contiennent les données personnelles d'un
  tiers — nom, photo de profil, communes, horaires de sortie. Les observations O1→O15 les remplacent
  dans le dépôt, datées et attribuées.
- **Aucune vérification juridique** sur ce qu'on peut reprendre d'un concurrent. Les *idées*
  fonctionnelles ne sont pas protégeables ; une interface peut l'être — d'où l'écart explicite en §9.
  À mentionner à la relecture juridique déjà prévue pour LANCE-00.
- **Aucune ligne de roadmap créée**, aucun front-matter touché, aucun statut modifié. Ce document est
  une **analyse**, pas une entrée de pipeline. Le passage en US se fera via
  [`/us`](../../.claude/commands/us.md), candidat par candidat, après arbitrage de la §11.

---

## 16. Sources

- **Strava** : **12 captures d'écran fournies par Florian le 20/09/2026**, compte gratuit sans
  activité — base des observations **O1 → O15**, qui priment sur tout le reste. Complétées par une
  connaissance du produit arrêtée à **mai 2026** pour ce que les captures ne montrent pas ; ces
  points-là restent marqués 📷.
- **Notre code** : constats **C1 → C10** (§6), chacun avec son fichier.
- **Nos décisions** : [ADR-002](../adr/ADR-002-perimetre-v1.md) ·
  [ADR-003](../adr/ADR-003-monetisation.md) · [ADR-005](../adr/ADR-005-gamification.md) ·
  [ADR-006](../adr/ADR-006-cartographie.md) · [ADR-007](../adr/ADR-007-surfacage-analyses.md) ·
  [vision.md](./vision.md) · [prd.md](./prd.md).
- **Analyses sœurs, même format** : [analyse-innovation-2026-09.md](./analyse-innovation-2026-09.md) ·
  [analyse-labo-2026-09.md](./analyse-labo-2026-09.md) ·
  [analyse-depense-activites-2026-09.md](./analyse-depense-activites-2026-09.md).
</content>
