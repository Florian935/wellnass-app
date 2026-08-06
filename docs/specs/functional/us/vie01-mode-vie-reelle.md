---
id: VIE-01
titre: "Mode « vie réelle » — dégradation gracieuse des objectifs"
roadmap: [1.28]
catalogue: []
etape: recette
branche: feature/vie01-mode-vie-reelle
maj: 06/08/2026
---

# VIE-01 — Mode « vie réelle »

> **Quatre arbitrages tranchés par Florian le 05/08/2026**, avant rédaction (§3, D1 → D4). Ils sont
> **acquis** : ils ne se rouvrent pas en codant. Deux décisions supplémentaires (D5, D6) sont prises
> par le cadrage et **signalées comme telles** — elles attendent un accord à la validation.
>
> Idée promue depuis [IDEAS.md](../../../../IDEAS.md) (25/07/2026), où elle est portée par **3 modèles
> sur 4** du benchmark et désignée **cause n°1 d'abandon à 3-6 semaines**. La fiche d'origine
> annonçait « cadrage US **après** le détecteur de collisions — les deux partagent le même moteur de
> règles » : COLLIS-01 a été livrée le 05/08/2026, c'est donc le tour de celle-ci.

## 0. Ce que ça résout

Une semaine de vacances, de maladie ou de déplacement sans salle produit aujourd'hui, dans l'app,
une cascade de reproches — tous mécaniquement corrects, tous à côté de la plaque :

- la **série tombe à zéro** au deuxième jour manqué (`computeStreakWithJokers`, règle 1 : un joker ne
  couvre qu'un jour **isolé**) — donc le joker de STREAK-01 ne protège, par construction, **rien** sur
  une semaine ;
- le **déficit calorique continue de courir** comme si de rien n'était : `targetCalories` applique le
  delta de l'objectif sans jamais savoir que la semaine n'est pas une semaine normale ;
- les cartes d'insight annoncent « ton tonnage a chuté de 40 % », « ta distance a chuté de 60 % »,
  « tu délaisses le dos » (`tonnage_change`, `distance_change`, `muscle_neglected`) ;
- et la suggestion de niveau d'activité (`activity_level`) propose de **baisser le réglage** en
  apprenant d'une fenêtre atypique — soit un réglage à refaire au retour.

Vérifié dans le code le 05/08/2026 : **aucune notion de période dégradée n'existe**, ni dans
`packages/shared/src`, ni dans `apps/mobile/src`. Les seules occurrences du mot « dégradé » portent
sur la précision GPS (`running/tracker-task.ts`) et sur des couleurs (`theme/color-utils.ts`).

Le geste que cette US ajoute est **un tap** : « je suis en vie réelle jusqu'à telle date ». À partir de
là l'app **abaisse ce qu'elle demande**, se tait sur ce qu'elle reprochait, et reprend le plan normal
toute seule — **sans reset**.

## 1. Périmètre

### 1.1 Dans le périmètre

- Une **table de périodes** (`real_life_periods`), avec historique : c'est lui qui permet d'annoter
  les analyses passées (D2).
- Un **moteur pur** (`packages/shared/src/real-life.ts`) : reçoit les périodes et un jour, dit si le
  jour est en période, et calcule l'**objectif de semaine minimal**.
- **Quatre effets**, et seulement quatre : cibles de semaine abaissées (R3), déficit suspendu (R4),
  série mise en pause (R5), signaux de reproche muets (R6) — côté insights **et** côté bilan hebdo (R7).
- Une **carte d'accueil** pendant la période, et le **point d'entrée** pour la déclarer.
- L'**annotation** de la période dans le bilan hebdomadaire (R7).
- i18n **FR + EN**.
- Comportement **hors ligne complet**.

### 1.2 Hors périmètre

- **La réécriture du programme.** Aucune séance n'est allégée, remplacée ni supprimée en base —
  arbitrage D1. Générer une « version courte » d'une séance exigerait un contenu de coach que nous
  n'avons pas (même blocage que CONTENU-01).
- **La variante « voyage »** (exercices au poids du corps, conseils resto/aéroport) : sous-lot séparé,
  bloqué sur le même contenu. Tranché par le cadrage, voir §9.
- **Toute notification** — ni à l'entrée, ni pendant, ni à la sortie (R9).
- **Toute exclusion de données des analyses** — arbitrage D2. Rien n'est retiré des moyennes, des
  tendances ni de l'ACWR.
- **Toute IA.** Règles déterministes, 100 % hors ligne.
- **Tout effet sur les objectifs à échéance** d'OBJ-01 (D6, motivé au §3).
- **Toute rétro-déclaration au-delà de 7 jours** (D5).

## 2. Le modèle — une période, quatre effets

Une **période** est un intervalle de jours `[started_on, ends_on]`, bornes **incluses**. Elle porte
son intervalle et rien d'autre : ni statut, ni compteur, ni bilan. Tout le reste est **dérivé**, à
chaque affichage — c'est le patron d'OBJ-01 (D5 de sa spec : « aucun travail de fond, un verdict
stable, ça marche hors ligne »).

```
                         période déclarée [J, J+6]
                    ┌───────────────────────────────┐
cibles de semaine   │  2 séances · 1 sortie · prot.  │  ← R3 : abaissées
objectif calorique  │  maintien (delta neutralisé)   │  ← R4 : déficit suspendu
série               │  jours inactifs transparents   │  ← R5 : ni cassée, ni allongée
insights            │  signaux de reproche muets     │  ← R6 : garde-fous TOUJOURS armés
analyses            │  intactes, et annotées         │  ← R7 : la donnée reste vraie
                    └───────────────────────────────┘
                              sortie automatique, silencieuse
```

**Ce qui ne bouge pas** : le programme, le planning, les séances, les records, le TDEE, le niveau
d'activité, le bonus des jours d'entraînement, et **tout ce qui a réellement été fait**. La période
abaisse ce qui est **demandé** ; elle n'efface pas ce qui est **accompli**.

## 3. Les décisions

| # | Décision | Motif | Statut |
|---|---|---|---|
| **D1** | **Les cibles, pas le programme.** L'app affiche un objectif de semaine minimal, suspend le déficit et fait taire les signaux de reproche. Le programme planifié reste intact ; sauter une séance ne pénalise plus. | On change ce qui est **demandé**, pas ce qui est **planifié**. Même parti pris que COLLIS-01, où la séance de muscu est l'ancre qui ne bouge jamais. Réécrire le programme demanderait un générateur de séance dégradée, donc du contenu de coach. | ✅ Florian, 05/08/2026 |
| **D2** | **Les analyses restent vraies, et sont annotées.** Les jours restent dans les moyennes, les tendances et l'ACWR ; la période est **marquée** dans le bilan hebdo. | C'est la règle que STREAK-01 s'est imposée sur le joker (sa décision D3) : « un joker n'affecte QUE la série… **falsifier la donnée pour sauver un affichage serait le pire des choix** ». Exclure les jours serait exactement la falsification que le joker a refusée. | ✅ Florian, 05/08/2026 |
| **D3** | **Durée choisie à l'activation, prolongeable.** 3 / 7 / 14 jours, sortie **automatique** à l'échéance, prolongation en un tap, arrêt anticipé possible. | Aucun mode oublié ne peut suspendre le déficit et la série pendant des mois. Et une fenêtre `[début, fin]` **calculée** ne demande ni cron, ni job de démarrage, ni personne à réveiller — patron OBJ-01. | ✅ Florian, 05/08/2026 |
| **D4** | **La série est mise en pause : ni cassée, ni allongée.** Un jour **inactif** en période est **transparent** ; un jour **actif** en période compte normalement. | La série continue de ne compter que des jours réellement actifs — donc elle reste crédible — mais la période ne la détruit pas. Faire compter les jours vides comme actifs aurait produit exactement ce que les 3 règles de STREAK-01 ont été écrites pour éviter : un compteur qui ne mesure plus rien. | ✅ Florian, 05/08/2026 |
| **D5** | **Rétro-déclaration bornée à 7 jours.** On peut déclarer une période qui a commencé jusqu'à **7 jours** dans le passé, pas au-delà. | **Le moment du retour est le moment critique** : quelqu'un qui a été malade n'a pas ouvert l'app, et découvre sa série morte en revenant. Sans rétro-déclaration, la fonctionnalité ne sert que ceux qui ont pensé à l'activer **avant** — c'est-à-dire pas ceux qu'elle doit sauver. La borne est `JOKER_MAX_AGE_DAYS` (7), **déjà arbitrée** en D5 de STREAK-01 pour exactement la même question (« ressusciter une série morte depuis deux semaines n'aurait aucun sens ») : on réutilise la borne, on n'en invente pas une seconde. | 🟠 **cadrage — à confirmer** |
| **D6** | **Aucun effet sur les objectifs à échéance (OBJ-01).** Une période ne décale pas une deadline. | OBJ-01 a construit tout son fichier autour d'un **verdict stable** (sa D5) : « un record battu deux mois plus tard ne peut pas réussir rétroactivement un objectif passé ». Décaler une échéance parce qu'une période a été déclarée rendrait le verdict **manipulable** — il suffirait de déclarer une période pour gagner du temps. L'utilisateur garde la main : OBJ-01 permet déjà de modifier une échéance explicitement. | 🟠 **cadrage — à confirmer** |

## 4. Règles

### R1 — La période

- Champs : `started_on`, `ends_on` (dates locales `AAAA-MM-JJ`), bornes **incluses**.
- Durées proposées à l'activation : **3, 7, 14 jours**. La date de fin reste modifiable.
- **Prolonger** = mettre à jour `ends_on`. **Arrêter maintenant** = poser `ends_on = aujourd'hui`.
- `ends_on < started_on` est **refusé** à la création.
- Une seule période **active** à la fois. Si deux périodes se chevauchent malgré tout (deux appareils
  hors réseau), la lecture prend l'**union des jours** : aucune erreur, aucun blocage.

> ⚠️ **Aucune contrainte d'exclusion de plages en base**, et c'est délibéré. C'est la leçon de
> REPAS-01 (sa décision D6) : « deux appareils hors réseau peuvent générer la même semaine, et une
> **violation d'unicité bloquerait la file d'upload** ». Un mode dont l'activation casse la synchro
> serait pire que le problème qu'il résout. L'app prévient le chevauchement ; la base l'absorbe.

### R2 — Pas d'interrupteur dans les réglages

Contrairement à COLLIS-01, **aucune colonne d'opt-in** n'est ajoutée à `user_settings`. Il n'y a rien
à activer : **déclarer une période EST le consentement**, et sans période déclarée le dispositif est
strictement inerte. Un interrupteur en plus du geste serait une friction sans objet.

### R3 — L'objectif de semaine minimal

Pendant la période, l'app affiche une cible de semaine réduite, **dérivée du plan habituel** — jamais
un chiffre inventé :

| Pilier | Cible dégradée | Règle |
|---|---|---|
| Musculation | **`max(1, floor(séances habituelles / 2))` séances** | La moitié du plan, plancher à 1. Quelqu'un qui fait 2 séances/semaine se voit demander 1, pas 2. |
| Course | **1 sortie, libre** | Ni cible d'allure, ni cible de distance : sur une semaine dégradée, seule la sortie compte. |
| Nutrition | **protéines tenues** | La cible **protéines** est conservée telle quelle ; la cible **calorique** passe en maintien (R4). En période dégradée, protéger la masse maigre compte plus que tenir un déficit. |

**Seuls les piliers actifs produisent une ligne** (décision H). Un pilier inactif n'apparaît pas.

### R4 — Le déficit est suspendu

L'objectif nutritionnel effectif devient **`maintain`** pendant la période : le delta calorique de
l'objectif (`objectiveCalorieDelta`) est neutralisé.

- **Dans les deux sens.** Un `cut` ne creuse plus, **et un `bulk` ne charge plus** — un surplus pris
  sans s'entraîner n'est pas une prise de masse.
- **Un `manualOverride` prime toujours**, comme aujourd'hui (`targetCalories`, spec nutrition §2.2 /
  4.3). Quelqu'un qui a posé sa cible à la main garde sa cible : ce n'est pas à nous de la corriger.
- **Le TDEE, le niveau d'activité et le bonus des jours d'entraînement sont inchangés.** Le mode ne
  touche qu'un delta d'objectif, jamais une dépense mesurée.
- 🔴 **L'écran de réglage de l'objectif nutritionnel est exclu de cette règle.** Il affiche la cible de
  l'objectif **réellement configuré** (`cut`, `bulk`…), période ou pas. Y afficher « maintien » pendant
  une période ferait croire que le réglage n'a pas pris. La règle est donc : **un écran qui montre la
  cible du jour applique R4 ; l'écran où l'on configure l'objectif ne l'applique pas.**

### R5 — La série est mise en pause

`computeStreakWithJokers` reçoit un troisième ensemble : les **jours en période**. La règle du
parcours arrière devient :

| Jour | En période | Actif | Effet sur le comptage |
|---|:---:|:---:|---|
| A | non | oui | compte (`+1`) — inchangé |
| B | non | non | **rompt** la série — inchangé |
| C | oui | oui | **compte (`+1`)** : c'est un vrai jour actif, la période ne l'efface pas |
| D | oui | non | **transparent** : le parcours continue, le compteur n'avance pas |

C'est le cas **D** qui est neuf, et il donne exactement « ni cassée, ni allongée » (D4).

**Un jour en période ne consomme jamais de joker.** `findRestorableGap` doit ignorer ces jours :
proposer de brûler le joker du mois sur un jour de vacances déjà couvert le gaspillerait.

### R6 — Les signaux de reproche se taisent, les garde-fous restent armés

`selectInsights` écarte, pendant une période, un sous-ensemble **nommé** de candidats :

| Muet pendant la période | Pourquoi |
|---|---|
| `tonnage_change`, `distance_change` — **uniquement à la baisse** | « ton tonnage a chuté de 40 % » est le reproche type. Une variation **à la hausse** reste affichée : c'est une vraie bonne nouvelle. |
| `muscle_neglected` | « tu délaisses le dos » sur une semaine assumée comme dégradée. |
| `activity_level` | La suggestion apprendrait d'une fenêtre atypique et proposerait un réglage à refaire au retour. |
| `deficit_volume` | Naturellement silencieux (le déficit est suspendu, R4), mais coupé **explicitement** plutôt que par effet de bord. |

| **Toujours armés, sans exception** | Pourquoi |
|---|---|
| `overtraining_guard`, `training_load`, `readiness`, `concurrent_interference` | [IDEAS.md](../../../../IDEAS.md) (25/07/2026) le pose comme principe transverse : « **ne pas laisser désactiver les garde-fous de sécurité** (surentraînement, blessure) ». Et ils se déclenchent sur l'**excès** : les couper serait à la fois inutile et dangereux — précisément le cas de quelqu'un qui « rattrape » trop fort au retour. |
| `record_recent`, `goal_achieved` | Ce sont des accomplissements. Rien à taire. |
| `weekly_decision` | Reste armé **parce que sa source est filtrée en amont** (R7) : il transporte la décision de `decide()`, qui ne produira plus de reproche pendant la période. Le filtrer ici **en plus** masquerait aussi les décisions légitimes. |

### R7 — L'annotation, et le bilan hebdo qui cesse de faire des reproches

Deux effets sur BILAN-01, et le second **n'était pas prévu au cadrage initial** : il a été trouvé en
relisant `SIGNAL_ORDER`.

**1. L'annotation.** Le bilan porte, pour chaque semaine touchée, le **nombre de jours en période**.
Une période à cheval sur deux semaines calendaires annote **les deux**, chacune avec son décompte.

**2. `decide()` saute les signaux de reproche.** Les six natures de décision de BILAN-01 sont
`goal_behind`, `consistency_drop`, `muscle_imbalance`, `volume_drop`, `nutrition_drift`, `all_good` —
autrement dit **cinq reproches et une bonne nouvelle**. Sans filtrage, une semaine déclarée dégradée
produirait « ton volume a chuté de 40 % » **en titre du bilan**, ce qui viderait tout le reste de
l'US de son sens. Pendant une période, `decide()` écarte donc :

| Signal | Pendant une période | Pourquoi |
|---|---|---|
| `consistency_drop` | **écarté** | La baisse de régularité est le fait déclaré, pas une découverte. |
| `volume_drop` | **écarté** | Idem — c'est le principe même de la semaine. |
| `muscle_imbalance` | **écarté** | Un déséquilibre mesuré sur 2 séances n'est pas un déséquilibre. |
| `nutrition_drift` | **écarté** | La cible a changé (R4) : la comparer à l'ancienne n'a pas de sens. |
| `goal_behind` | 🔴 **CONSERVÉ** | **Conséquence directe de D6.** On a décidé qu'une période ne décale **pas** une échéance : masquer qu'un objectif décroche serait alors un piège — l'utilisateur découvrirait l'échec à la deadline. Puisqu'on ne protège pas les objectifs, on ne cache pas qu'ils glissent. |
| `all_good` | conservé | C'est là que la semaine atterrit naturellement, et c'est le bon message : la semaine allégée s'est passée comme prévu. |

⚠️ **Ce point corrige une affirmation de la première rédaction de cette spec**, qui annonçait que
`decide()` ne serait pas retouché. C'était faux : sans le toucher, R6 aurait fait taire les cartes
d'insight pendant que l'écran de bilan continuait le reproche.

### R8 — Aucune notification, et une reprise silencieuse

Ni à l'entrée, ni pendant, ni à la sortie. La fin de période se **constate** à l'ouverture de l'app ;
elle ne se pousse pas. Aucun écran de bilan de fin, aucun « tu as manqué 4 séances » : le mode se
termine comme il a commencé, en un tap ou tout seul.

Cohérent avec CYCLE-01, qui a tranché « **aucune notification, jamais** » (sa R11) sur les sujets à
charge émotionnelle — une période de maladie ou de galère en est un.

### R9 — Le ton

Aucune formulation de reproche. Bannis dans les libellés : « seulement », « manqué », « raté »,
« échec », tout compteur d'écart négatif. Le nom affiché de la période est neutre et factuel.

## 5. Cas limites

| Cas | Comportement attendu |
|---|---|
| L'utilisateur s'entraîne normalement pendant la période | Tout compte : série (R5, cas C), records, tonnage, analyses. La période n'efface rien de ce qui est fait. |
| Période à cheval sur deux semaines | Chaque semaine est annotée avec son propre décompte de jours (R7). |
| Période à cheval sur deux mois | Sans effet particulier : les jokers se comptent par mois calendaire, la période ne les consomme pas (R5). |
| Deux périodes qui se chevauchent | Union des jours. Aucune erreur, aucun blocage de la file d'upload (R1). |
| Période déclarée alors qu'une autre court | L'UI propose de **prolonger** celle en cours, pas d'en créer une seconde. |
| `ends_on` dans le passé (période échue) | Historique : elle continue d'annoter les analyses, elle n'a plus aucun effet actif. |
| Profil incomplet, TDEE non calculable | La nutrition n'affiche pas de cible, exactement comme aujourd'hui. Le mode n'invente rien. |
| Pilier désactivé pendant la période | Sa ligne disparaît de l'objectif minimal, sans recalcul des autres. |
| Programme sans séance planifiée | La cible muscu tombe à son plancher : **1 séance**. |
| Rétro-déclaration au-delà de 7 jours | Refusée (D5). Le sélecteur de date ne descend pas plus bas. |
| Changement d'heure (DST) / fuseau | Clés `AAAA-MM-JJ` locales et arithmétique via `Date.UTC`, patron `prevKey` de `streak.ts`. Aucune `Date` construite dans le moteur. |
| Aucune lecture d'horloge dans le moteur | `todayKey` entre **par paramètre**, comme `selectInsights` et `findSessionConflicts`. Lire l'heure dans un hook la ferait geler par React Compiler dans un slot mount-only. |

## 6. i18n (FR + EN)

Toutes les chaînes sous `realLife.*`. Aucune chaîne en dur, aucune phrase construite par
concaténation — les nombres sont interpolés dans la clé.

| Clé | FR | EN |
|---|---|---|
| `realLife.title` | Mode vie réelle | Real-life mode |
| `realLife.cta` | Ça se complique ? Allège la semaine | Life getting in the way? Ease the week |
| `realLife.duration.3` / `.7` / `.14` | 3 jours / 7 jours / 14 jours | 3 days / 7 days / 14 days |
| `realLife.active.until` | Semaine allégée jusqu'au {{date}} | Eased week until {{date}} |
| `realLife.active.remaining` | Encore {{count}} jour · Encore {{count}} jours | {{count}} day left · {{count}} days left |
| `realLife.target.strength` | {{count}} séance cette semaine · {{count}} séances cette semaine | {{count}} session this week · {{count}} sessions this week |
| `realLife.target.running` | 1 sortie, comme tu veux | 1 run, however you like |
| `realLife.target.nutrition` | Protéines tenues : {{grams}} g | Protein on track: {{grams}} g |
| `realLife.calories.maintain` | Objectif au maintien pendant cette période | Target set to maintenance for this period |
| `realLife.streak.paused` | Série en pause | Streak paused |
| `realLife.extend` | Prolonger | Extend |
| `realLife.stop` | Reprendre le plan normal | Back to the normal plan |
| `realLife.retro.hint` | Tu peux déclarer une période commencée il y a jusqu'à 7 jours | You can declare a period that started up to 7 days ago |
| `realLife.review.annotation` | {{count}} jour en mode vie réelle · {{count}} jours en mode vie réelle | {{count}} day in real-life mode · {{count}} days in real-life mode |

**Pluriels** : `realLife.active.remaining`, `realLife.target.strength` et `realLife.review.annotation`
portent un pluriel i18next (`_one` / `_other`) — pas de « 1 jours ».

## 7. Comportement hors ligne

- Table **locale PowerSync**, écriture par **repository**, **UUID côté client**, timestamps **UTC**,
  **soft delete** — conventions [offline-sync](../../technical/offline-sync.md).
- **Tout le calcul est pur et local** : appartenance d'un jour à une période, cible minimale, série,
  filtrage des insights, annotation. Aucune dépendance réseau.
- Déclarer une période, la prolonger et l'arrêter **fonctionnent en mode avion**. La synchro rattrape
  au retour du réseau.
- **Aucune dépendance native nouvelle** → **recettable sur l'APK existant**, contrairement à
  PARTAGE-01, RUN-F2a, MUSC-F9, RUN-F2c et LAUNCHER-01.

## 8. Données

- **1 table** : `real_life_periods (id, user_id, started_on, ends_on, created_at, updated_at, deleted_at)`.
  Index `(user_id, started_on desc)`. RLS sur `user_id = auth.uid()`, politiques `select` / `insert` /
  `update`, **pas de `delete`** (soft delete, patron `streak_jokers`).
- **2 migrations** : la table, puis sa **publication** (réplication logique) — patron
  `streak01_jokers` + `streak01_jokers_publication`.
- 🔴 **1 sync rule à ajouter** dans
  [powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml) **et à redéployer à la main**
  sur le dashboard PowerSync. Étape manuelle, **déjà oubliée deux fois** (BIEN-01, puis RUN-F2c qui
  reste bloquée avant recette pour cette raison).
- 🔴 **La table DOIT être déclarée dans `apps/mobile/src/powersync/schema.ts`.** Ce qui n'est pas dans
  le schéma **local** n'existe pas dans la base SQLite embarquée : l'écriture échoue et l'erreur est
  avalée. C'est la panne exacte de CYCLE-01, constatée en recette device le 31/07/2026 — le suivi
  était **impossible à activer**, sans le moindre message.
- **Export RGPD** : ajouter la table à `apps/mobile/src/lib/data-export.ts`. Le test de complétude de
  CONF-01 l'exigera — c'est lui qui a trouvé `session_intervals` manquante le 03/08/2026.
- **Aucune donnée de santé nouvelle.** La période ne porte **pas de motif** : ni « malade », ni
  « blessé », rien. C'est un choix de cadrage — voir §9.

## 9. Hors périmètre, et pourquoi

**Le motif de la période.** Tentant (« vacances », « malade », « déplacement ») et sans valeur
fonctionnelle : D1 rend le fléchissement **identique quelle que soit la cause**. En revanche, stocker
« malade » ferait entrer une **donnée de santé** de plus, ce qui rouvre la politique de
confidentialité **et** la déclaration Google Play « Health apps » — que CYCLE-01 a déjà fait passer à
6 types de données, allongeant le chemin critique du lancement de ~3 à ~5 semaines. On n'y touche pas
pour un champ décoratif.

**La variante « voyage »** (exercices au poids du corps, conseils resto/aéroport) : demande du
**contenu de coach**, exactement le blocage de CONTENU-01 (« c'est du travail de coach, pas de dev »).
Sous-lot séparé.

**La réécriture du programme** : écartée par D1.

**Le « réparateur de planning »** (reconstruire la suite après 2 séances manquées) : famille voisine,
à cadrer à part.

**Les notifications de reprise / win-back** : idée distincte d'IDEAS (13/07/2026), et R8 ferme la
porte aux notifications ici.

## 10. Critères de recette

| # | Critère |
|---|---|
| 1 | Déclarer une période de 7 jours en **un tap** depuis l'accueil ; la carte de période apparaît. |
| 2 | La carte affiche la date de fin et le nombre de jours restants, avec le **bon pluriel** à 1 jour. |
| 3 | L'objectif de semaine minimal n'affiche **que les piliers actifs**. |
| 4 | Cible muscu = moitié du plan habituel, **plancher à 1** (vérifier avec un plan à 2 séances). |
| 5 | Objectif calorique passé **au maintien** ; vérifier sur un profil en `cut` **et** sur un `bulk`. |
| 6 | Un `manualOverride` de calories **n'est pas modifié** par la période. |
| 6b | **Accueil, onglet Nutrition, planning repas et widget launcher affichent tous le MÊME chiffre** en période. C'est le critère qui attrape un appelant oublié — le défaut serait très visible. |
| 6c | L'écran de **réglage de l'objectif nutritionnel** continue d'afficher la cible du `cut`, **pas** le maintien (R4, exclusion volontaire). |
| 7 | Deux jours inactifs consécutifs en période : la série **ne tombe pas** et **n'augmente pas**. |
| 8 | Une séance faite pendant la période : la série **augmente** de 1 (cas C de R5). |
| 9 | Aucun joker n'est proposé sur un jour couvert par une période. |
| 10 | Une chute de tonnage ≥ 15 % en période **n'affiche aucune carte** ; une hausse ≥ 15 % **l'affiche**. |
| 11 | `overtraining_guard` et `training_load` **s'affichent quand même** en période (les armer en forçant la donnée). |
| 12 | Le bilan hebdo porte la mention « N jours en mode vie réelle », avec le bon décompte sur une période à cheval sur deux semaines. |
| 12b | Le bilan hebdo d'une semaine en période **n'affiche aucun** `volume_drop` / `consistency_drop` / `muscle_imbalance` / `nutrition_drift` (R7). Le vérifier sur une semaine qui, hors période, les déclencherait. |
| 12c | En revanche, un objectif OBJ-01 qui décroche **s'affiche toujours** (`goal_behind`) — c'est la contrepartie de D6, et elle doit être visible. |
| 13 | À l'échéance, la sortie est **automatique** : cibles et signaux reviennent à la normale, **sans notification et sans écran de bilan**. |
| 14 | « Prolonger » et « Reprendre le plan normal » fonctionnent, y compris **en mode avion**. |
| 15 | Rétro-déclaration à J-7 acceptée, J-8 **refusée** par le sélecteur. |
| 16 | Les moyennes, tendances et ACWR **contiennent toujours** les jours de la période (D2 — vérifier qu'aucune valeur n'a été retirée). |
| 17 | Relecture du ton FR **et** EN : aucun « seulement », « manqué », « raté » nulle part. |
| 18 | Export RGPD : la table `real_life_periods` est présente dans l'archive. |
