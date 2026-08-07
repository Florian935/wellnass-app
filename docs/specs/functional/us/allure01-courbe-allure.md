---
id: ALLURE-01
titre: "La courbe d'allure — ce que ta façon de courir dit"
roadmap: [5.35]
catalogue: [RUN-11, RUN-20, RUN-17, RUN-08]
etape: recette
branche: feature/allure01-courbe-allure
maj: 07/08/2026
---

# ALLURE-01 — La courbe d'allure

> **Deuxième lot d'analyses du catalogue**, sur le modèle d'EXEC-01 (07/08/2026) : plusieurs items
> regroupés parce qu'ils lisent **la même donnée** et se livrent en un seul chantier.
>
> **Demandé par Florian le 07/08/2026** : « un gros lot de dev qui en fait plusieurs dans le même lot
> d'implémentation ». Choix du **running** pour équilibrer — EXEC-01 était muscu.
>
> ⚠️ **Coût connu et déjà accepté une fois** : +1 US dans une file de recette à **51**.

## 0. Ce que ça résout

L'app enregistre une trace GPS, en tire une distance, une durée, une allure moyenne et des splits par
kilomètre. Elle ne dit **rien de la forme de la courbe** — or c'est là que vit tout ce qu'un coureur
veut savoir sur sa gestion d'effort :

- Est-ce que j'ai accéléré ou explosé sur la fin ?
- Est-ce que je m'écroule sur mes sorties longues ?
- Est-ce que je passe mon temps dans la « zone grise », ni assez lent pour récupérer ni assez rapide
  pour progresser ?

Aujourd'hui l'écran de résumé affiche les splits **en liste** et désigne le km le plus rapide. C'est
une donnée brute, pas une lecture.

## 1. Le lot — 4 analyses, une seule donnée

**Un décodage, un modèle de zones, quatre lectures.** C'est ce qui justifie le regroupement : les
quatre partent du **même tableau de splits**, déjà calculé.

| Réf | Analyse | Ce qu'elle dit | Vérifié le 07/08/2026 |
|---|---|---|---|
| **RUN-11** | Negative split | Allure de la 2ᵉ moitié vs la 1ʳᵉ : negative / even / positive | 🆕 rien dans `packages/shared` |
| **RUN-20** | Indice de dégradation (fade) | Perte d'allure du 1ᵉʳ au dernier quart sur une sortie assez longue | 🆕 rien |
| **RUN-17** | Distribution par zone d'allure | Part des kilomètres passés en récup / endurance / tempo / seuil-VMA | 🆕 rien |
| **RUN-08** | Polarisation de l'entraînement | Part du volume en faible vs haute intensité sur 4 semaines, face au repère ~80/20 | 🆕 rien |

### 1.1 🟢 Le socle existe déjà, et c'est le cœur de l'argument

Vérifié dans le code, pas déduit du catalogue :

| Brique | État | Conséquence |
|---|---|---|
| `computeKmSplits(points)` (`running.ts`) | ✅ livré | Rend `{ km, seconds }[]`. **Toute l'entrée des 4 analyses.** Rien à écrire. |
| `decodeTrack(run.gpsTrack)` | ✅ livré | La trace se relit déjà. |
| 🟢 **`run/summary.tsx` décode et splitte DÉJÀ** (l.225, l.238) | ✅ | Les 3 lectures intra-sortie se branchent **sans un octet de décodage en plus**. |
| `sessionTargetPace(type, ref5k)` (`running-paces.ts`) | ✅ livré | Donne des **bandes d'allure calibrées** depuis l'allure de réf 5 km — voir D1. |
| `derivedVmaPace(ref5k)` + `VMA_COEFFICIENT` | ✅ livré | L'allure à 100 % VMA, déjà dérivée. |
| `running_profiles.ref_5k_pace_s_per_km` | ✅ existe, **nullable** | Sans elle, **aucune zone n'est calculable** → RUN-17 et RUN-08 se taisent (R4). |
| `runs.session_type` | ❌ **n'existe pas** | 🔴 Point dur — voir D2. |

### 1.2 Hors périmètre

- **La fréquence cardiaque.** RUN-23 (cadence) et la dérive cardiaque sont **V2 (wearables)** : la FC
  n'est pas dans le modèle de données. La « dérive cardio-mécanique » du catalogue est donc approchée
  par la **seule allure**, et la spec le dit au lieu de le laisser croire.
- **La météo.** RUN-22 croise l'allure avec la météo : elle n'existe pas (RUN-F3b non livrée). Le
  `terrain`, lui, existe — mais croiser 4 analyses × terrain doublerait le périmètre pour un gain non
  démontré. Hors lot, à ressortir si la recette le réclame.
- **Toute prescription.** « Tu devrais courir plus lentement » est un conseil de coach. On affiche la
  répartition et **on nomme le repère**, on ne dit pas quoi faire. Ton de GARDE-01 et DOUL-01.
- **Le dernier kilomètre partiel.** `computeKmSplits` l'ignore par conception ; on ne le rattrape pas.
  Conséquence assumée : une sortie de 5,8 km est analysée sur 5 km.

## 2. Les décisions

| # | Décision | Motif |
|---|---|---|
| D1 | Les zones d'allure sont **dérivées des bandes existantes**, pas inventées | §2.1 |
| D2 | « Assez longue » se mesure en **distance**, pas en type de séance | §2.2 |
| D3 | 3 analyses sur le **résumé de course**, 1 sur l'**historique** | §2.3 |
| D4 | Le negative split a une **tolérance** — sinon tout le monde est « positive » | §2.4 |
| D5 | Le 80/20 est un **repère nommé**, pas un objectif | §2.5 |

### 2.1 D1 — Les zones sortent de `sessionTargetPace`, on n'invente pas de nombres

`sessionTargetPace` définit déjà, **depuis l'allure de référence 5 km**, quatre bandes calibrées :

```
recuperation   ref+90 .. ref+120
endurance      ref+60 .. ref+90
sortie_longue  ref+30 .. ref+60
fractionne     vma    .. ref        (vma = ref × 0,95)
```

C'est un cadeau : **les bornes sont déjà dans le produit et déjà défendues.** Mais ⚠️ **ce ne sont pas
des zones** — ce sont des cibles par type de séance, et **elles laissent des trous** : rien entre
`ref` et `ref+30`, rien au-delà de `ref+120`, rien sous `vma`.

On en dérive donc une **partition** en réutilisant **exactement** ces bornes, sans en ajouter :

| Zone | Bornes (s/km) | Origine de la borne |
|---|---|---|
| `vma` | plus rapide que `vma` | borne basse de `fractionne` |
| `seuil` | `vma` .. `ref` | bande `fractionne` |
| `tempo` | `ref` .. `ref+60` | comble le trou, borne haute de `sortie_longue` |
| `endurance` | `ref+60` .. `ref+90` | bande `endurance` |
| `recuperation` | plus lent que `ref+90` | borne basse de `recuperation` |

**Aucun nombre neuf.** Les cinq zones ferment les trous en prolongeant les bandes existantes, et un
changement de `sessionTargetPace` se répercute mécaniquement. Le seul choix est celui de la
partition — il est écrit ici, et il se rediscute d'une ligne.

### 2.2 D2 — 🔴 `runs` n'a pas de type de séance : le fade se borne en distance

Vérifié : les colonnes de `runs` sont `avg_pace_s_per_km`, `distance_m`, `duration_seconds`,
`elevation_*`, `gps_track`, `planned_session_id`, `rpe`, `source`, `terrain`… — **pas de
`session_type`**. Le type n'existe que sur une séance **planifiée**, par jointure.

C'est le même mur que RUN-07, resté ⏳ au catalogue pour cette raison exacte : **les courses libres
n'ont aucun type**, et elles sont majoritaires chez qui ne suit pas de programme.

Filtrer le fade sur `session_type = 'sortie_longue'` rendrait donc l'analyse **muette pour la
majorité** — et muette précisément pour les gens qui courent sans plan, ceux à qui elle sert le plus.

**On borne donc en distance** : le fade se calcule dès qu'une sortie dépasse
`FADE_MIN_DISTANCE_KM` kilomètres pleins. C'est physiologiquement défendable — la dérive ne veut rien
dire sur 3 km — et ça marche pour tout le monde.

⚠️ **C'est le seul nombre inventé du lot.** Constante exportée et nommée, à calibrer en recette, même
statut que `LEG_SETS_CONFLICT_THRESHOLD` (COLLIS-01) et `NEGLECTED_AFTER_WEEKS` (EXEC-01).

### 2.3 D3 — Trois lectures sur le résumé, une sur l'historique

| Analyse | Surface | Pourquoi |
|---|---|---|
| RUN-11 negative split | **résumé de course** | Se lit une fois, juste après la course. Rien à en dire une semaine plus tard. |
| RUN-20 fade | **résumé de course** | Idem — c'est un fait de cette sortie. |
| RUN-17 zones | **résumé de course** | La répartition **de cette course**. |
| RUN-08 polarisation | **historique** | N'a de sens que sur **plusieurs semaines** : une course ne se « polarise » pas. |

Le résumé **décode déjà la trace et calcule déjà les splits** : les trois premières coûtent donc du
calcul pur sur un tableau déjà en mémoire, pas une requête.

⚠️ **Pas de cartes d'insight**, pour la raison établie par EXEC-01 : `MAX_INSIGHTS = 3` pour 13
candidats. Et **rien sur l'accueil** : ADR-007 plafonne le Tier 0, dégonflé de 21 à 7 par INSIGHTS-02.

### 2.4 D4 — Le negative split a besoin d'une tolérance

Comparer deux moyennes au centième ferait de **toute** course un « positive » ou un « negative
split » : personne ne court deux moitiés exactement égales. Sans zone morte, l'analyse dirait quelque
chose de faux à chaque sortie.

Trois verdicts, avec une bande d'égalité en pourcentage de la 1ʳᵉ moitié
(`EVEN_SPLIT_TOLERANCE_PCT`) :

- **negative** — 2ᵉ moitié plus rapide au-delà de la tolérance (le bon signe) ;
- **even** — dans la tolérance ;
- **positive** — 2ᵉ moitié plus lente au-delà de la tolérance.

### 2.5 D5 — Le 80/20 se nomme, il ne se prescrit pas

La littérature parle d'environ **80 % faible intensité / 20 % haute**. On affiche la répartition
réelle **et** on nomme le repère, sans jamais dire « tu es hors norme ». Deux raisons :

1. Le repère vaut pour un coureur **qui s'entraîne pour performer**, pas pour quelqu'un qui court
   trois fois par semaine pour se sentir bien. Le présenter comme un objectif serait faux pour une
   partie des utilisateurs.
2. C'est la règle de ton du produit, déjà validée trois fois : **on constate, on ne prescrit pas.**

## 3. Les règles

### R1 — Quatre moteurs purs, zéro React, zéro base, zéro horloge

Tout vit dans `packages/shared`. Discipline de `selectInsights`, `findSessionConflicts` et des quatre
moteurs d'EXEC-01.

### R2 — Aucune analyse ne s'affiche sans son chiffre

« Tu t'écroules en fin de sortie » ne vaut rien sans « −8 % sur le dernier quart ». Contrainte
d'`InsightCandidate` (INSIGHTS-01 R1) et de `ReviewDecision` (BILAN-01), tenue une 3ᵉ fois.

### R3 — Sous le seuil de données, l'analyse se tait

Un negative split sur 2 km n'est pas une gestion d'effort, c'est du bruit. Chaque moteur a son
minimum de kilomètres ou de courses, et rend `null` en dessous.

### R4 — 🔴 Sans allure de référence, pas de zones — et on le dit

`ref_5k_pace_s_per_km` est **nullable**. Sans elle, RUN-17 et RUN-08 ne sont **pas calculables** : il
n'existe aucune valeur neutre pour la remplacer, et en inventer une produirait une répartition
fausse et crédible.

L'écran affiche donc **l'indisponibilité et son remède** (« renseigne ton allure de référence »),
comme `StrengthSection` le fait pour le DOTS sans sexe déclaré (MUSCPWR-01 R6). Jamais un « — ».

### R5 — Les deux lectures intra-sortie ignorent le dernier km partiel

Conséquence directe de `computeKmSplits`, qui ne rend que les kilomètres **pleins**. Une sortie de
5,8 km est lue sur 5 km. On l'assume et on ne bricole pas d'extrapolation : un dernier km incomplet
a une allure mécaniquement bruitée (arrêt, montre coupée), et l'inclure fausserait le fade.

### R6 — Le fade se lit sur des **quarts**, pas sur des kilomètres

Comparer le 1ᵉʳ km au dernier km serait sensible au feu rouge du 12ᵉ. On compare la **moyenne du
premier quart** à celle du **dernier quart** des splits, ce qui lisse l'accident local tout en
gardant la tendance.

### R7 — Une course sans trace GPS ne produit rien, et ce n'est pas une erreur

Une course saisie à la main (`source = 'manual'`) n'a pas de `gps_track`. Les trois analyses de
résumé se taisent alors, sans message d'erreur : il n'y a rien à analyser, ce n'est pas un défaut.

### R8 — Les zones sont contiguës et couvrent tout

Toute allure tombe dans **exactement une** zone (D1). Les parts somment à 100, reliquat d'arrondi
compris — même règle que `computeSetTypeMix` (EXEC-01), et pour la même raison : une barre qui
n'atteint pas son bord fait douter de tout l'écran.

### R9 — La polarisation agrège des **kilomètres**, pas des courses

Une sortie longue de 20 km pèse plus qu'un fractionné de 5 km dans la répartition du volume. Compter
par course donnerait à chaque sortie le même poids et rendrait le 80/20 ininterprétable.

## 4. Cas limites

| Cas | Comportement |
|---|---|
| Course saisie à la main (sans trace) | Les 3 analyses de résumé se taisent (R7) |
| Trace de moins de 2 km pleins | Negative split impossible → se tait (R3) |
| Trace de moins de `FADE_MIN_DISTANCE_KM` | Fade se tait ; negative split et zones restent |
| Nombre **impair** de kilomètres pleins | Le km central va à la **1ʳᵉ** moitié — arbitraire mais figé et documenté |
| Deux moitiés à allure quasi identique | Verdict **even** (D4), jamais un faux « positive » |
| Allure de référence non renseignée | RUN-17 et RUN-08 affichent leur **indisponibilité et son remède** (R4) |
| Allure plus rapide que la VMA dérivée | Zone `vma` — on ne plafonne pas : un record se voit |
| Course marchée (allure très lente) | Zone `recuperation` — pas un cas d'erreur |
| Trace avec un glitch GPS | Déjà filtré par `computeKmSplits` (`MAX_PLAUSIBLE_SPEED_MS`) |
| Aucune course sur 4 semaines | Polarisation se tait |
| Une seule course sur 4 semaines | Polarisation se tait (R3) — une course n'est pas une répartition |
| Pilier running non actif | Rien nulle part (décision H) |
| Mode avion | Identique — tout est local |

## 5. Données

**Aucune migration. Aucune sync rule. Aucun schéma PowerSync local. Aucune dépendance native. Aucune
écriture.** Le lot lit exclusivement des colonnes existantes, vérifiées le 07/08/2026 :

| Table | Colonnes |
|---|---|
| `runs` | `gps_track`, `distance_m`, `started_at`, `status`, `deleted_at` |
| `running_profiles` | `ref_5k_pace_s_per_km` |

→ **Recettable sur l'APK existant.** Comme pour EXEC-01, c'est un critère de choix du lot.

## 6. i18n — FR + EN

```
run.summary.split.title / .negative / .even / .positive / .detail
run.summary.fade.title / .value / .stable / .tooShort
run.summary.zones.title / .zone.<vma|seuil|tempo|endurance|recuperation>
run.summary.zones.needsRef            // R4 — l'indisponibilité ET son remède
running.history.polarisation.title / .low / .high / .reference / .empty
```

Nombres **formatés avant** `t()`. Les allures réutilisent le formateur d'unités existant
(`useUnits().formatPace`) — jamais un second jeu de formatage.

## 7. Comportement offline

**Intégralement local et en lecture seule.** Aucun appel réseau, aucune écriture, aucune dépendance
native. Le calcul part d'une trace déjà en base.

## 8. À trancher à la validation

1. **`FADE_MIN_DISTANCE_KM`** — 8, 10 ou 12 km ? Proposition : **10**. Seul nombre inventé du lot.
2. **`EVEN_SPLIT_TOLERANCE_PCT`** — 1, 2 ou 3 % ? Proposition : **2 %**.
3. **La fenêtre de polarisation** — 4 semaines (comme le catalogue) ou 8 ? Proposition : **4**.
4. **La partition de zones du §2.1** — le seul vrai choix de conception. Elle ne crée aucun nombre,
   mais elle décide où tombe la frontière `tempo`.

## 9. Critères de recette

1. Course **saisie à la main** → aucune des 3 analyses de résumé n'apparaît, **aucune erreur**.
2. Course GPS de **moins de 2 km** → pas de negative split.
3. Course GPS de 4-5 km → negative split **présent**, fade **absent** (sous le seuil).
4. Course de plus de 10 km en **accélérant** sur la fin → verdict **negative**, avec l'écart chiffré.
5. Même distance en **ralentissant** → verdict **positive**.
6. Course courue à allure **très régulière** → verdict **even**, pas un faux « positive ».
7. Fade : sortie longue avec fin nettement plus lente → **dégradation chiffrée en %**.
8. 🔴 **Allure de référence non renseignée** → la carte des zones affiche **l'indisponibilité et le
   chemin pour y remédier**, jamais un « — » ni une zone vide.
9. Renseigner l'allure de référence → les zones apparaissent **sans recharger l'app**.
10. Les parts de zones **somment à 100 %**.
11. Une course entièrement marchée → tout en `recuperation`, sans erreur.
12. Un fractionné rapide → des kilomètres en `seuil` ou `vma`.
13. Polarisation : après ≥ 2 courses sur 4 semaines, la part faible/haute intensité apparaît **avec le
    repère 80/20 nommé**, et **sans reproche**.
14. Aucune course sur 4 semaines → la polarisation se tait.
15. La polarisation pèse les **kilomètres** : une sortie longue de 20 km doit peser plus qu'un 5 km.
16. Désactiver le pilier **running** → rien nulle part.
17. FR ⇄ EN → aucune chaîne brute ; allures et pourcentages formatés selon la locale.
18. Police **1,5×** et thème **sombre** → lisible, non tronqué, contrastes AA.
19. **TalkBack** → chaque analyse annoncée avec son chiffre.
20. Mode avion → identique.
21. **L'écran Insights et l'accueil n'ont pas changé.**
22. 🔴 **Calibrage** — jugement de pratiquant : 10 km est-il le bon seuil de fade ? 2 % la bonne
    tolérance d'égalité ? Et **la frontière `tempo` du §2.1 correspond-elle à ton ressenti** ?

## 10. Definition of Done

Cochée le 07/08/2026, **item par item, sur des faits vérifiés** — pas de case cochée par ressenti
(leçon d'EXEC-01, où la relecture avait trouvé un item non tenu).

- [x] `typecheck` **0**, `lint` **0 erreur**, `test:coverage` **0**, **3 427 tests verts**.
- [x] 5 moteurs **purs**, tous à **100 % sur les quatre métriques**, branches comprises.
- [x] Chaque moteur rend `null` sous son seuil, et un test le fige (R3).
- [x] Les **3 seuils** sont exportés et nommés, chacun assis par un test :
      `FADE_MIN_DISTANCE_KM`, `EVEN_SPLIT_TOLERANCE_PCT`, `MIN_RUNS_FOR_POLARISATION`.
- [x] Les zones sont **dérivées de `sessionTargetPace`** : un test change la référence et vérifie que
      **toutes** les bornes suivent (D1).
- [x] Un test fige que les parts de zones **somment à 100** malgré les arrondis (R8).
- [x] Un test fige que la polarisation pèse les **kilomètres** et non les courses, avec un
      `not.toBe(50)` explicite (R9).
- [x] Un test fige que le km central d'un nombre impair va à la **1ʳᵉ** moitié (§4).
- [x] `run/summary.tsx` **ne décode pas la trace une seconde fois** — `splits` arrive en **prop**.
- [x] Aucune migration, aucune sync rule, aucun ajout à `powersync/schema.ts`, aucune écriture.
- [x] `MAX_INSIGHTS`, `INSIGHT_ORDER`, `selectInsights` et le registre d'accueil **non modifiés** —
      vérifié par `git diff` : **vide** sur `insights.ts` et `insights-repository.ts`.
- [x] FR + EN symétriques (**2 069 clés** chacun) ; pourcentages arrondis **avant** `t()`, allures via
      `useUnits().formatPace` — aucun second formateur.
- [x] Catalogue : RUN-11, RUN-20, RUN-17, RUN-08 → ✅.
- [x] CHANGELOG, front-matter, roadmap 5.35, RECETTES.md §52, ETAT.

### Deux items ajoutés en cours de route, parce que l'implémentation les a réclamés

- [x] 🔴 **`SELECT_HISTORY` ne gagne pas `gps_track`** — un test garde cette porte fermée. Cette
      requête n'a **aucune borne de date** et alimente les statistiques, la tendance d'allure et
      l'accueil : y ajouter la trace ferait charger **toutes** les traces GPS de l'utilisateur pour
      chacun de ces consommateurs. La régression serait invisible en recette et s'aggraverait avec
      l'historique.
- [x] **La carte des zones survit à l'absence d'allure de référence** et affiche son **remède** — un
      test l'exige, parce que la pente naturelle est de masquer la carte, ce qui laisserait
      l'utilisateur ignorer à jamais qu'il lui manque un réglage.

> **Le code est complet ; l'US ne l'est pas.** Restent les **22 critères de recette device**
> ([RECETTES.md](../../../../RECETTES.md) §52), dont le calibrage des trois seuils et la frontière
> `tempo` — la seule étape qu'un agent ne peut pas franchir.
