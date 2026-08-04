---
id: TRI-12
titre: "Détection de surcharge / sous-récupération globale"
roadmap: []
catalogue: [TRI-12]
etape: close
branche: feature/tri12-garde-fou-global
maj: 04/08/2026
---

# US TRI-12 — Détection de surcharge / sous-récupération globale

> ## 🔀 Comportement repris par [GARDE-01](garde01-fusion-garde-fou-charge-repos.md) le 04/08/2026
>
> **Clôturée sans recette device propre.** Son widget a été **fusionné** avec celui de
> [MR-14](mr14-jours-consecutifs-sans-repos.md) : les deux se contredisaient (R4 ci-dessous disait
> « un seul signal ne suffit jamais », MR-14 affirmait l'inverse — les deux positions ont été
> validées à deux jours d'écart). Voir [GARDE-01 §0](garde01-fusion-garde-fou-charge-repos.md) pour
> l'analyse complète.
>
> **Ce qui survit** : le diagnostic composite (charge sans repos **+** déficit persistant) est
> devenu le **niveau de sévérité `streakAndDeficit`** du garde-fou unifié. Ses règles R1 et R3
> (jour à charge, déficit persistant sur fenêtre fixe) et ses trois textes sont conservés **mot pour
> mot**.
>
> **Ce qui change** : R4 (« les deux signaux, jamais un seul ») est remplacée par le seuil de streak
> seul, et R5 (gating tri-pilier, « pas de dégradation partielle ») par un gating à 2 piliers avec
> la nutrition en dégradation par composante.
>
> **Les règles ci-dessous sont conservées comme trace de la décision d'origine** — elles ne
> décrivent plus le comportement courant. Critères de recette : voir
> [GARDE-01 §11](garde01-fusion-garde-fou-charge-repos.md) (liste consolidée).
>
> **US d'analyse — aucune ligne roadmap.** Comme [META-19](meta19-acwr-garde-fou.md) et
> [RUN-18](run18-acwr-running.md), cette US vit **uniquement** dans le
> [catalogue d'analyses](../../product/analyses-donnees.md).

## 0. Pourquoi celle-ci, et pas un doublon d'ACWR

Dernière déclinaison ouverte de la famille garde-fou identifiée par META-19 (avec RUN-18, livrée, et
MR-10, absorbée par doublon). **TRI-12 n'est pas un doublon** : c'est la seule des trois qui combine
**deux signaux de nature différente** — charge d'entraînement **et** déficit nutritionnel — au lieu
de décliner la même formule ACWR sur un périmètre différent. Description catalogue : « Enchaînement
de jours à forte charge sans repos + déficit persistant → alerte ».

## 1. Surfaçage (ADR-007, obligatoire pour toute US d'analyse)

**Tier 2 — Alerte contextuelle, conditionnelle.** Widget dashboard, rendu `null` hors de la
condition — même patron que `DeficitVolumeAlertCard` (MN-02) et `TrainingLoadAlertCard` (META-19).
Contrairement à RUN-18 (Tier 1, écran de stats), ce signal combine 3 piliers : il n'a pas de home
naturel dans un écran de pilier unique, et c'est un signal de sécurité composite qui doit pouvoir
interrompre — la définition même du Tier 2.

**Condition d'affichage** : uniquement quand **les deux** signaux (R2 + R3 ci-dessous) sont vrais
simultanément — jamais l'un sans l'autre (spec catalogue : « + », pas « ou »).

**Coexistence avec `DeficitVolumeAlertCard` (MN-02) et `TrainingLoadAlertCard` (META-19)** : les
trois widgets peuvent techniquement s'afficher en même temps si les trois piliers sont actifs et
que la situation est mauvaise sur plusieurs fronts à la fois. Ce n'est **pas traité comme un défaut
à supprimer** : chacun répond à une question distincte et sur une fenêtre différente (MN-02 :
moyenne hebdo déficit+volume muscu ; META-19 : ratio ACWR 7 j/28 j ; TRI-12 : série sans repos +
persistance du déficit) — les faire disparaître l'un l'autre masquerait un vrai signal composite.
Pas de mécanisme de priorité entre eux en V1 ; à revisiter si la coexistence s'avère fréquente en
usage réel plutôt que théorique.

## 2. Ce qui existe déjà

- `sessionLoad` (`@wellness/shared`, posé par META-19) : charge d'une séance, RPE × durée. Réutilisée
  ici uniquement pour déterminer si un jour a une charge **non nulle**, pas pour un ratio.
- `computeStreak` (`@wellness/shared`, `streak.ts`) : compte une série de jours consécutifs à partir
  d'un `Set<string>` de clés de jour + la clé du jour courant. Générique — déjà utilisé pour le
  streak d'activité (TRI-01), réutilisable tel quel sur **n'importe quel** ensemble de jours, y
  compris un ensemble "jour à charge" construit spécifiquement pour cette US.
- `DEFICIT_ALERT_RATIO` (`@wellness/shared`, `bodyweight.ts`, posé par MN-02) : **seule** la
  constante (15 % sous l'objectif) est réutilisée telle quelle. `computeDeficitVolumeAlert`/
  `shouldAlertDeficitVolume` (MN-02) ne le sont **pas** : ce sont des fonctions de moyenne
  **hebdomadaire** combinée à un seuil de volume muscu (`HIGH_VOLUME_THRESHOLD`), sans rapport avec
  la vérification **jour par jour** dont R3 a besoin. Le comptage par jour (R3) est une **fonction
  neuve**, listée en §4.
- `useWorkoutHistory()` / `useRunHistory()` / `useDailyTotals()` / `useNutritionSummary()` : déjà
  chargées ailleurs sur le dashboard, aucune nouvelle requête.

⚠️ `bodyweight.ts` définit déjà `MIN_LOGGED_DAYS = 4` (taille d'échantillon minimale pour fiabiliser
la moyenne hebdo de MN-02) — **valeur numérique identique** à celle utilisée par R3 ci-dessous, mais
**sémantique différente** (échantillon minimal vs compte de jours en déficit). La fonction neuve de
TRI-12 introduit sa propre constante nommée distinctement (`OVERTRAINING_DEFICIT_DAYS_REQUIRED`,
étape plan) pour ne pas laisser croire à un partage de constante qui n'existe pas.

**Aucune donnée nouvelle, aucune migration.**

## 3. Les règles

**R1 — « Jour à charge » = un jour avec au moins une séance dont `sessionLoad` > 0 (muscu OU
course).** Pas un seuil de charge « forte » inventé : le catalogue ne sourcé aucun chiffre pour
« forte », et en inventer un serait moins défendable que de réutiliser un concept déjà tranché —
celui de **jour d'entraînement** (même famille que MR-13/MR-14). Un jour sans RPE ni durée sur
aucune séance contribue une charge nulle (`sessionLoad` existant, R1 de META-19), donc n'est pas un
jour à charge — pas une entorse à la règle, une conséquence directe de la réutiliser telle quelle.

**R2 — « Enchaînement sans repos » = ≥ 6 jours à charge consécutifs.** Réutilise `computeStreak` sur
l'ensemble des « jours à charge » (R1) — pas une nouvelle logique de comptage. Seuil aligné sur la
fourchette **déjà proposée par le catalogue lui-même pour MR-14** (« 6-7 j »), borne basse retenue
(alerte plus tôt plutôt que plus tard, cohérent avec un garde-fou de sécurité).

**R3 — « Déficit persistant » = au moins 4 jours sur les 7 derniers jours *calendaires* sont à la
fois loggés ET en déficit ≥ 15 %, pas un streak strict.** Fenêtre **fixe** de 7 jours calendaires
(pas glissante sur les seuls jours loggés) : un jour non loggé ne compte simplement pas dans les 4
requis, il ne les remplace pas non plus par un jour supplémentaire ailleurs — ce n'est **pas** une
proportion/majorité des jours loggés (avec 5 jours loggés sur 7, 3 jours en déficit ne suffisent pas :
il faut toujours 4 en valeur absolue, sur la fenêtre de 7). Différence assumée avec R2 : la nutrition
est **déclarative** (un jour non loggé n'est pas un choix de repos, contrairement à un jour sans
séance) — exiger une consécutivité stricte casserait le signal sur un simple oubli de saisie ponctuel.
Seuil du déficit (15 %) réutilise `DEFICIT_ALERT_RATIO` (MN-02) tel quel — objectif de base (hors
bonus jour d'entraînement), même convention que `DeficitVolumeAlertCard`.

**Limite connue, acceptée (héritée de MN-02)** : un repas oublié dans le journal fait apparaître un
total du jour artificiellement bas, indiscernable d'un vrai déficit à partir des seules données
loggées. `DeficitVolumeAlertCard` a déjà ce même angle mort et il est accepté depuis sa livraison —
distinguer sous-saisie et sous-alimentation demanderait une donnée qu'on n'a pas (ex. rappel de
complétude du journal), hors périmètre de cette US.

**R4 — L'alerte ne s'affiche que si R2 **et** R3 sont vrais en même temps.** Une charge sans repos
seule n'est pas cette US (c'est MR-14, candidat distinct, non cadré) ; un déficit seul sans charge
soutenue n'est pas non plus ce garde-fou (c'est déjà couvert par `DeficitVolumeAlertCard`, MN-02,
qui combine déficit + volume muscu hebdo sans notion de série). TRI-12 est spécifiquement
l'**intersection** des deux qui manquait.

**R5 — Gating tri-pilier : `strength`, `running` **et** `nutrition` tous actifs.** Contrairement à
META-19 (2 piliers), ce garde-fou a besoin des trois données à la fois — sans nutrition active, R3
ne peut jamais être vrai ; sans muscu ni course, R2 non plus. Pas de dégradation partielle : afficher
un signal basé sur 2 piliers sur 3 dénaturerait le diagnostic (ce n'est plus « global »).

**R6 — Ton factuel, suggestion non impérative.** Même exigence que META-19 §7 / MUSC-07/08 : pas de
mot alarmiste, une recommandation (repos + réajustement nutritionnel), jamais une action imposée.

**R7 — Aucune action automatique.** Ni report de séance, ni notification push, ni verrouillage d'une
fonctionnalité — affichage informatif seul, même limite que META-19/RUN-14/RUN-18.

## 4. Périmètre

**Dans le périmètre** :
- Fonction pure **neuve** `countDeficitDaysInWindow` (ou nom équivalent tranché à l'étape plan) :
  reçoit les totaux kcal des jours loggés + la cible, applique R3 (fenêtre fixe de 7 jours
  calendaires, seuil 15 %), retourne le compte de jours qualifiants. L'appelant (le hook mobile)
  lui fournit des jours déjà découpés par jour calendaire — cette fonction ne connaît aucune notion
  de date au-delà de compter, même discipline que `computeAcwr`/`computeTrainingTime`.
- Fonction pure `computeOvertrainingGuard` (packages/shared, même fichier que `sessionLoad`) :
  reçoit le résultat de `computeStreak` (R2, jours à charge) et le compte de R3, applique R4,
  retourne `{ show: boolean }`.
- Widget dashboard conditionnel (Tier 2), gating `['strength', 'running', 'nutrition']`.

**Hors périmètre** :
- MR-14 (jours consécutifs sans repos, sans le volet nutrition) — candidat distinct, non cadré ;
  cette US ne le construit pas séparément, seulement la version combinée.
- TRI-15 (modèle forme-fatigue CTL/ATL/TSB, Banister) et TRI-16 (monotonie/strain, Foster) — méthodes
  plus avancées, catalogue les distingue explicitement de l'ACWR/ce garde-fou simple.
- Historique/journal des blessures (`journal-blessures`, IDEAS) — hors périmètre, mentionné comme
  recoupement futur possible, pas une dépendance de cette US.
- Réglage du seuil par l'utilisateur — seuils fixes (R2/R3), pas de préférence configurable en V1.

## 5. i18n

Nouvelle famille `home.overtrainingGuard.*`, FR + EN :
- `eyebrow` — « Charge & récupération » / « Load & recovery ».
- `title` — « Signal de surcharge » / « Overload signal ».
- `message` — « Tu enchaînes les séances sans repos depuis plusieurs jours, avec des apports
  régulièrement sous ta cible. » / « You've been training without rest for several days, with
  intake regularly below your target. »
- `recommend` — « Un jour de repos et un repas plus complet peuvent t'aider à repartir du bon
  pied. » / « A rest day and a more complete meal can help you bounce back. »

## 6. Comportement offline

**Total.** Lecture PowerSync locale (`workouts`/`workout_sets`/`runs`/`food_entries`, déjà
synchronisées), agrégation pure. Aucun réseau.

## 7. Accessibilité

Bloc `accessible` unique par forme de widget (titre + message + recommandation), même patron que
`TrainingLoadAlertCard` (META-19 §7) — pas des `Text` disjoints. Ton factuel, jamais alarmiste (R6).

## 8. Critères de recette — ⚠️ REMPLACÉS

**Ne pas recetter depuis cette liste** : elle décrit deux widgets distincts et une règle « les deux
signaux, jamais un seul » qui n'existent plus depuis la fusion du 04/08/2026. Ses critères 2, 3 et 4
attendent explicitement l'inverse du comportement livré.

👉 **Liste consolidée : [GARDE-01 §11](garde01-fusion-garde-fou-charge-repos.md)** — elle couvre les
deux niveaux de sévérité et reprend les critères de R1/R3 encore valables (les points 5 et 6
ci-dessous, devenus les points 8 et 9 de la nouvelle liste).
