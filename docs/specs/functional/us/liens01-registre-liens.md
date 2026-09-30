---
id: LIENS-01
titre: "Le registre des liens — un lien, une question, un calcul, une phrase"
roadmap: [7.37]
catalogue: [MR-17, MR-18, MN-18, META-11, META-12]
etape: recette
branche: feature/labo-carrefour
maj: 30/09/2026
---
# US LIENS-01 — Le registre des liens

> **Raccourci de parcours assumé.** Le [workflow](../../../../CLAUDE.md#workflow-obligatoire-par-fonctionnalité)
> impose spec → plan → design → validation → code. Ici, la **maquette et la validation précèdent le
> code**, mais la spec et le [plan](../../../plans/liens01-registre-liens.md) sont écrits **avec** lui,
> sur demande explicite de Florian le 30/09/2026 : « GO tu fais TOUT d'une seule vague
> d'implémentation ». La toile d'exploration (trois tours d'itération, un prototype jouable, la
> doctrine en sept règles) est dans [design/labo-carrefour-2026-09/](../../../../design/labo-carrefour-2026-09/)
> (toile en ligne https://claude.ai/artifact/JGyxPAdghwAxwHTyBZWwgz) ; Florian y a tranché les huit
> décisions **Q1 à Q8** le 30/09/2026. Même exception que LABO-01 et DASH-01 : une recette finale
> unique, pour les cinq US du chantier (RECETTES §89).
>
> Les cinq US du chantier « le Labo, carrefour des piliers » :
> **LIENS-01** (ce registre) · [LABO-02](labo02-croiser.md) (l'onglet Croiser) ·
> [LABO-03](labo03-fiche-lien.md) (la fiche d'un lien) · [ECHO-01](echo01-echos-liens.md) (les échos) ·
> [LABO-04](labo04-apprendre.md) (Apprendre et le verdict figé).

## 0. Contexte

Idée de Florian, 26/09/2026 : « on a des données qui se croisent quand on va sur le pilier muscu […]
ça serait intéressant d'avoir un endroit dans l'application où on a le visuel de toutes les données
croisées, à un seul endroit. Et peut-être que le labo, il serait propice. »

Le constat dressé sur la toile (planche `Constat`) :

- les croisements vivaient sur **une vingtaine d'écrans** (Insights, Stats nutrition, planning, séance
  du jour, accueil, cycle, Labo…), chacun avec **sa propre table d'ordre** ;
- **six seuils différents** disaient « déficit + entraînement » ; le Labo jugeait les protéines dès
  **2 jours** saisis quand le verdict de la semaine en exigeait **4** ;
- **deux remèdes opposés** répondaient aux jambes lourdes : décaler la séance (planning, Labo) ou
  ralentir la sortie (Course › Courir), sans que l'un sache l'autre ;
- personne ne tenait la **liste** des croisements : une analyse livrée pouvait ne vivre nulle part
  (les cartes « Et si… » et « Balance du jour » étaient codées et montées **nulle part**).

## 1. Ce que l'US livre

Un **registre unique**, pur et testé, dans `packages/shared/src/cross-links.ts`. Il ne calcule rien de
neuf : il **appelle les moteurs existants**, tranche une fois pour toutes les seuils en double, et rend,
pour chaque lien, tout ce dont un écran a besoin pour en parler.

### Les neuf liens

| Id | La question (FR) | Présent si… | Zone | Échos | Analyses qui y entrent |
|---|---|---|---|---|---|
| `sports` | Tes deux sports se gênent-ils ? | muscu **et** course | mc | planning, Course › Courir, muscu › Progrès | COLLIS-01, MR-01/02/06/08/17/18 |
| `fuelStrength` | Manges-tu assez pour ta muscu ? | muscu **et** nutrition | mn | muscu › Progrès, Nutrition › Aujourd'hui, Stats nutrition | MN-01/02/03/04/06/10/15/16/18/20 |
| `fuelRunning` | Ton carburant suit-il tes kilomètres ? | course **et** nutrition | cn | Course › Courir, Nutrition › Aujourd'hui, Stats nutrition | RN-01 à 06, RN-16, RESERV-01 |
| `recovery` | Récupères-tu assez ? | muscu **ou** course | centre | Course › Courir, muscu › Progrès | META-19, GARDE-01, MR-09, MR-14, TRI-03, TRI-12 |
| `weight` | Ton poids suit-il ton assiette ? | nutrition | centre | Nutrition › Aujourd'hui | DEPENSE-00, TRI-06, NUTR-19 |
| `goals` | Tes objectifs tirent-ils dans le même sens ? | 2 piliers ou plus | centre | — | GUID-01, CONS-01 |
| `rhythm` | Tiens-tu le rythme partout ? | 2 piliers ou plus | centre | — | TRI-01/02, BILAN-01, MR-22 |
| `strengthWeight` | Ta force suit-elle ton poids ? | muscu | centre | — (jamais à régler) | MUSC-27 |
| `cycle` | Ton cycle et tes piliers | suivi du cycle activé | centre | écran Cycle | CYCLE-01 |

`recovery`, `weight` et `strengthWeight` ne demandent qu'**un** pilier : ils croisent ce pilier avec le
**bien-être** (nuits, poids du corps), qui n'est pas un pilier activable. `analyses` liste les analyses
du catalogue **livrées ou à venir** : c'est la traçabilité catalogue ↔ fiche (ADR-007, niveau Labo).

### Ce que rend chaque lien (`CrossLink`)

`state` (l'un des quatre états), `verdict` et `short` (clés + valeurs brutes), au plus **deux chiffres**
(`figures`, un par côté du lien), les **mesures croisées** (`rows`, chacune avec son propre état ou
aucun), les **gestes** (`actions` : une proposition du Labo, l'ouverture d'un écran, ou le Conseil des
trois), ce qui **manque** pour un lien à découvrir (`missing`, avec `have` / `need`), un **graphique**
sur huit semaines ou rien (`chart`), sa **source** et ses **échos**.

## 2. Règles

### R1 — Quatre états, et l'ordre est une priorité

`guard` (garde-fou) · `adjust` (à régler) · `holds` (ça tient) · `discover` (à découvrir). La liste est
**triée** par état dans cet ordre, puis dans l'ordre du registre. Un état se dit **toujours par un point
et un mot**, jamais par la couleur seule.

### R2 — Décision H : un pilier désactivé ne produit rien

`available()` décide de la présence d'un lien. Un lien absent n'est ni « à découvrir » ni « en
attente » : il **n'existe pas**. Aucun reproche, aucune invitation dans la liste — la seule concession
est une ligne discrète et masquable (LABO-02, Q4).

### R3 — Un seuil par question, le plus prudent

| Seuil | Valeur | Emprunté à | Avant |
|---|---|---|---|
| Jours saisis pour juger les protéines | `MIN_LOGGED_DAYS` (4) | MN-02 | le Labo jugeait dès 2 |
| Semaines où les deux sports ont été pratiqués | 2 | — | — |
| Pesées pour parler d'une tendance | 3 | — | — |
| Points pour tracer un graphique | 3 | — | — |
| Cycles observés (fiche cycle) | 3 (`MIN_CYCLES_FOR_INSIGHTS`) | CYCLE-01 | — |

Le déficit × volume, l'ACWR, le garde-fou de surentraînement, la forme du jour, l'interférence, le
niveau d'activité et les conflits d'objectifs gardent **le seuil de leur moteur** : le registre les lit,
il ne les recalcule pas.

### R4 — Un seul remède aux jambes lourdes

Une collision (COLLIS-01) sur une séance **d'aujourd'hui** ouvre **Course › Courir**, là où vit
l'adaptation de la séance du jour (RUN-F4 : décaler ou ralentir) ; une collision **à venir** se règle en
**décalant** la séance (proposition du Labo, feuille « ce qui change »). Une séance **déjà adaptée**
n'est plus proposée à l'allègement (`adapted` dans `lab-week.ts`) : on ne l'allège pas deux fois.

### R5 — Mesurer, pas restreindre (LABO-01 R6)

Quand le poids stagne (`weightPlateau`), le seul geste est **compléter le journal** (Nutrition ›
Historique). Aucun geste ni aucune expérience ne propose de manger moins.

### R6 — La vie réelle fait taire ce qu'elle fait taire ailleurs

Pendant une période « vie réelle » (VIE-01), le déficit × volume et le niveau d'activité ne sont **pas**
signalés — même règle que `REAL_LIFE_MUTED_INSIGHTS`.

### R7 — Un trou n'est jamais un zéro

Une semaine sans donnée vaut `null` dans les séries ; un graphique n'est tracé qu'à partir de trois
points ; un lien sans assez de données est « à découvrir » et dit **ce qui lui manque** (« 2 jours
saisis sur 4 »), jamais un chiffre à zéro.

### R8 — Le registre ne formule rien

Il rend des **clés** et des **valeurs brutes** ; `link-format.ts` (mobile) les met en mots, dans la
langue courante, **en un seul endroit** — la carte, la fiche, l'écho et le widget disent exactement la
même phrase. 🔴 Une clé de jour (`…DayKey`) devient **toujours** un jour en toutes lettres : avant
LIENS-01, la feuille de la collision affichait « Séance déplacée au 2026-09-27 ».

### R9 — L'histoire d'un lien est figée (décision Q5)

Chaque semaine, l'état de chaque lien est écrit dans `cross_link_weeks`, **pour la semaine en cours
seulement et seulement s'il a changé** (`crossLinkWeekWrites`). Une semaine passée n'est **jamais
réécrite** : elle se referme avec le dernier état observé pendant qu'elle courait. Recalculer l'histoire
à chaque ouverture la réécrirait avec les données d'aujourd'hui — le même défaut que le verdict des
expériences (LABO-04).

🔴 L'identifiant d'une ligne est un **UUID déterministe** (`stableUuid(userId|lundi|lien)`, v8) : deux
appareils qui écrivent la même semaine produisent **la même ligne**, et le PUT de PowerSync (un upsert)
la remplace au lieu d'en créer une seconde. C'est pourquoi la table n'a **ni index unique ni CHECK** :
un rejet à l'upload figerait toute la file de synchronisation.

## 3. Données

Migration `20260930135304_labo_carrefour_liens.sql`, **poussée le 30/09/2026** :

- table **`cross_link_weeks`** (`id`, `user_id`, `link_id`, `week_start`, `state`, `created_at`,
  `updated_at`, `deleted_at`), RLS « le propriétaire seulement », publiée pour PowerSync ;
- colonne **`lab_experiments.verdict jsonb`** (LABO-04).

Schéma local PowerSync (`schema.ts`), sync rule (`powersync-sync-rules.yaml`, **à déployer à la main**
dans le dashboard PowerSync) et export RGPD (`data-export.ts`) mis à jour.

## 4. Offline

Tout se calcule **sur l'appareil** à partir de la base locale : aucun lien ne dépend du réseau.
L'écriture de l'histoire passe par PowerSync (upsert) et part à la reconnexion.

## 5. i18n

Toutes les phrases vivent sous `lab.links.*` (questions, paires, états, verdicts, phrases courtes,
chiffres, mesures croisées, ce qui manque, sources, surfaces d'écho), **FR et EN**, vérifiées par le
test de parité des langues.

## 6. Tests

`cross-links.test.ts` (Vitest) : présence selon les piliers (décision H), chaque état de chaque lien,
seuils uniques, vie réelle, niveau d'activité, conseil, plateau de poids → journal, liens à découvrir et
ce qui leur manque, graphiques et trous, zones, échos, lien pressant, histoire figée et écritures de la
semaine, UUID déterministe, séries sur huit semaines. `lab-week.test.ts` : collision du jour → Course,
séance adaptée non ré-allégée, glucides → Nutrition › Aujourd'hui.

## 7. Écarts assumés et ce qui n'est pas fait

- **« Prévu vs fait » de la semaine passée** (`lastWeekPlanned`) n'est pas calculé : la fiche du rythme
  ne dit que les jours actifs et la série. La structure l'accueille le jour où le planning le fournit.
- **RN-17** (volume de course croisé au déficit) reste non construit : la fiche des objectifs ne voit
  que les contradictions **déclarées** (GUID-01).
- **Aucune notification** ne lit encore le registre (la notification du lundi garde son propre texte).
- Les analyses « à venir » listées dans `analyses` n'ont **pas** été calculées : elles disent seulement
  où elles iront.

## 8. Revue de code du 30/09/2026 — ce qu'elle a changé

Revue complète du diff avant commit (workflow `/commit`, étape 5) : **1 bloquant, 14 importants,
12 mineurs**. Tous les bloquants et importants sont corrigés et figés par un test ; le détail est au
[CHANGELOG](../../../../CHANGELOG.md).

- 🔴 **Bloquant — colonnes jsonb envoyées en chaînes.** `lab_experiments.verdict` (neuve), et quatre
  colonnes existantes (`lab_experiments.schedule`, `sessions.pacing_plan`, `user_settings.sbd_lifts`,
  `meal_plan_entries.consumed_entry_ids`), manquaient à `JSON_COLUMNS` du connecteur PowerSync :
  Postgres stockait des jsonb de type `string`. Connecteur corrigé (+ tests) et migration de réparation
  `20260930201419_reparer_jsonb_en_chaine` poussée — **1 ligne réelle réparée** (`sbd_lifts`).
- **R10 — Les écritures de fond ont trois gardes** (`useCrossLinksWrites`) : rien avant la première
  synchro (`hasSynced`, sinon un appareil neuf écraserait l'état réel avec des « à découvrir ») ; rien
  tant que toutes les lectures qui décident d'un état n'ont pas répondu et que les réglages n'existent
  pas (`writeReady`) ; et **écriture par front** — une ligne n'est réécrite que si le calcul **de cet
  appareil** a changé (`crossLinkWeekWrites(…, previous)`), sinon deux appareils qui calculent
  différemment (une règle rejetée sur un seul) se renvoyaient la ligne à l'infini. La ligne existante
  d'un lien pour la semaine est mise à jour **quel que soit son identifiant**, jamais doublée. Un échec
  est tracé (`console.warn`), jamais avalé.
- **R11 — Le registre lit toutes les propositions.** `LabWeek.allProposals` (non plafonnée) : plafonnée
  à cinq, une semaine chargée perdait sa proposition « glucides » et le lien du carburant affirmait
  qu'il ne restait « rien de dur cette semaine ».
- **Forme du jour « repos conseillé »** : « Récupères-tu assez ? » passe **à régler** (gestes :
  planning, check-in). Partie d'Insights, l'alerte ne remontait plus nulle part.
- **Écart DOTS** (`dotsEightWeekDelta`) : un record entre J−70 et J−56 et une pesée à 15 jours près,
  sinon un **trou** (`…NoDelta`) — plus jamais « 0 en huit semaines » ni un calcul au poids du jour.
- **Décision H** sur « Tes objectifs… » : l'objectif d'un pilier désactivé, resté dans son profil, ne
  se reproche plus (ici et sur la carte de l'accueil).
- **Un trou n'est pas « ça tient »** : pas de « tes deux sports évoluent ensemble » avec un seul ratio ;
  pas de ligne « 0 + 0 min » ; sans ratio de charge (un seul sport), la phrase ne dit plus « charge
  saine ».
- **Échos réels** : « Récupères-tu assez ? » fait écho dans le hub Musculation (le garde-fou de
  surentraînement ne demande pas la course) et plus dans le planning, où aucun écho générique n'est
  monté ; « Ta force suit-elle ton poids ? », jamais à régler, ne déclare plus d'écho.
- **Test-garde des textes** (`link-texts-coverage.test.ts`) : chaque clé que le registre peut produire
  existe en FR et EN.

**Restent ouverts, assumés** (à mesurer en recette, §89) : le fournisseur de liens est monté à la
racine et se recalcule à chaque donnée saisie, **séance comprise** — la latence d'une série est à
vérifier sur téléphone ; un changement de compte **sans purge** de la base locale peut faire calculer
un premier état sur les données du compte précédent (défaut antérieur, réduit par `hasSynced` et
`writeReady`) ; le graphique « jambes → allure » reste en min/km, comme le reste du Labo.
