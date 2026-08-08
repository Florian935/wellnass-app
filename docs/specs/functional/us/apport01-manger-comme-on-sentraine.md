---
id: APPORT-01
titre: "Manges-tu comme tu t'entraînes ? — lot d'analyses croisées muscu × nutrition"
roadmap: [4.40]
catalogue: [MN-20, MN-16, MN-15, MN-10]
etape: recette
branche: feature/apport01-manger-comme-on-sentraine
maj: 08/08/2026
---

# APPORT-01 — Manges-tu comme tu t'entraînes ?

> **Troisième lot d'analyses du catalogue**, après EXEC-01 (muscu) et ALLURE-01 (running).
> Demandé par Florian : un gros lot qui en livre plusieurs d'un coup.
>
> **Et cette fois c'est le croisé.** Les deux premiers lots regardaient un pilier à la fois. Celui-ci
> met **la nutrition en face de l'entraînement** — c'est-à-dire le différenciateur que
> [la vision](../../../product/vision.md) revendique, et ce qu'aucune des trois apps qu'on remplace
> ne sait faire.
>
> ⚠️ **Coût connu, accepté deux fois déjà** : +1 US dans une file de recette à **52**.

## 0. Ce que ça résout

L'app sait dire ce que tu manges. Elle sait dire comment tu t'entraînes. Elle ne dit **jamais si l'un
va avec l'autre**.

Or c'est là que vivent les questions qu'un pratiquant se pose vraiment :

- Est-ce que je mange **plus les jours où je m'entraîne**, ou est-ce que je mange pareil tous les
  jours en croyant le contraire ?
- Est-ce que je tiens mes macros **le jour de la séance**, ou seulement les jours faciles ?
- Est-ce que mes **grosses séances** tombent sur des journées où j'ai à peine mangé ?
- Est-ce que mes protéines sont **réparties**, ou tassées sur le dîner ?

Aucune de ces quatre questions n'a de réponse dans l'app aujourd'hui.

## 1. Le lot — 4 analyses, un même croisement

| Réf | Analyse | Ce qu'elle dit | Vérifié le 08/08/2026 |
|---|---|---|---|
| **MN-20** | Bilan énergétique jour de séance vs repos | Kcal réelles des jours d'entraînement vs jours de repos, face à leurs cibles respectives | 🆕 rien dans `packages/shared` |
| **MN-16** | Adhérence macros séance vs repos | Taux d'atteinte de la cible, comparé entre les deux types de jours | 🆕 rien |
| **MN-15** | Disponibilité énergétique les jours de gros volume | Journées de volume muscu élevé où l'apport est resté bas | 🆕 rien |
| **MN-10** | Protéines fractionnées sur la journée | Répartition des protéines entre les repas, et nombre de prises « utiles » | 🆕 rien |

### 1.1 🟢 Tout le socle existe — et surtout, **les calibrages aussi**

C'est le point qui rend ce lot peu risqué. Vérifié dans le code, pas déduit du catalogue :

| Brique | État | Ce qu'elle m'évite d'inventer |
|---|---|---|
| `isTrainingDay` (`training-day.ts`) | ✅ livré | **La définition d'un jour d'entraînement.** Voir D1 — c'est le piège n° 1 de ce lot. |
| `targetCalories` + `trainingDayCalories` | ✅ livrés | Les cibles, y compris le **bonus des jours de séance** (MN-04, 04/08/2026) |
| `computeCaloricBalance` | ✅ livré | L'écart aux cibles et le décompte au-dessus / en dessous |
| `computeGoalAdherence(perDay, marginPct)` | ✅ livré | Le calcul d'adhérence **et sa marge** |
| 🔴 `nutritionProfile.adherenceMarginPct` | ✅ **réglage utilisateur**, défaut 10 | **La tolérance.** Voir D2 — inventer un ±10 % en dur serait une faute. |
| `resolveMealSplit` + `OTHER_MEAL_KEY` (NUTR-16) | ✅ livré | Le **groupement par repas** et l'ordre d'affichage |
| `computeVolume` (`workout.ts`) | ✅ livré | Le volume d'une séance |
| `body_weight_entries` | ✅ existe | Le poids, nécessaire aux g/kg de MN-10 |

### 1.2 Ce qui n'est PAS un doublon, et pourquoi je l'ai vérifié

Deux items sentaient le déjà-livré. Ils ne le sont pas — mais il fallait regarder :

- **MN-04** (« macros ajustées jours muscu », en recette) a corrigé **la cible** des jours de séance.
  **MN-20 mesure le réalisé** face à cette cible. L'un règle le thermostat, l'autre lit le
  thermomètre : sans MN-04 la cible serait fausse, sans MN-20 personne ne saurait si elle est tenue.
- **NUTR-16** (« répartition calorique par repas », livrée le 02/08) rend des **kcal** par repas.
  **MN-10 parle de protéines**, et les rapporte au **poids de corps**. On **réutilise son groupement
  de repas** (`resolveMealSplit`, `OTHER_MEAL_KEY`, ordre suivant les repas configurés) plutôt que
  d'en écrire un second — deux conventions de repas dans la même app divergeraient.

> ⚠️ **Le catalogue n'est pas une source de vérité sur ce qui est livré** (deux réconciliations,
> 8 lignes corrigées). Les 4 analyses ont été vérifiées **dans le code** avant d'entrer ici — comme
> pour EXEC-01, où cette vérification avait fait tomber un item et demi.

### 1.3 Hors périmètre

- **Toute affirmation de causalité.** MN-07, MN-08, MN-11, MN-17, MN-18, MN-23 du catalogue veulent
  corréler l'apport à la **progression de force**. C'est le « moteur de corrélations »
  ([IDEAS.md](../../../../IDEAS.md), 13/07) — un autre chantier, avec un autre niveau d'exigence
  statistique. Ce lot **met deux chiffres côte à côte** ; il ne dit jamais que l'un cause l'autre.
- **Toute prescription.** « Mange plus les jours de séance » est un conseil de coach. On montre
  l'écart, on nomme le repère quand il existe, on s'arrête là. Ton de GARDE-01, DOUL-01, EXEC-01 et
  ALLURE-01 — quatre fois validé.
- **Les micronutriments.** Hors sujet ici.
- **Le simulateur what-if** (MN-24) : post-V1, il demande un modèle de projection.

## 2. Les décisions

| # | Décision | Motif |
|---|---|---|
| D1 | « Jour d'entraînement » = **`isTrainingDay`**, sans redéfinition | §2.1 |
| D2 | La marge d'adhérence est **celle de l'utilisateur**, jamais une constante | §2.2 |
| D3 | « Gros volume » se mesure **contre soi-même**, pas contre une norme | §2.3 |
| D4 | MN-10 se tait **sans poids de corps** | §2.4 |
| D5 | Surface = l'écran **Nutrition**, en une section repliée | §2.5 |

### 2.1 D1 — 🔴 On ne redéfinit pas « jour d'entraînement »

`isTrainingDay` existe et porte une règle **non triviale** : un jour compte s'il porte une séance
**terminée** (rétroactif, n'importe quel jour) **ou** une séance **planifiée** à condition que le jour
soit aujourd'hui ou futur — *« le passé n'est jamais anticipé »*.

Réécrire une définition naïve (« il y a un workout ce jour-là ») donnerait des jours classés
différemment de l'accueil et du calcul de cible. **Deux endroits de l'app diraient des choses
contradictoires sur la même journée** — et le pire est que chacun aurait l'air juste.

⚠️ **Conséquence assumée** : une **course** compte comme jour d'entraînement (`isTrainingDay` ne
distingue pas les piliers). C'est **voulu pour MN-20 et MN-16**, parce que la cible calorique elle
aussi s'applique aux jours de course. MN-15, en revanche, parle explicitement de **volume muscu** :
elle utilise `computeVolume`, pas `isTrainingDay`. Cette asymétrie est **délibérée** et écrite ici
pour qu'on ne la « corrige » pas par symétrie apparente.

> 🔴 **Affiné en implémentant le 08/08/2026 — et c'est mieux que ce que la spec prescrivait.**
> Le calcul de la cible effective, dans `dashboard-repository.ts`, groupe déjà les jours avec un
> `trainedDays` bâti des séances **terminées** (muscu + course), **pas** avec `isTrainingDay`.
>
> Or sur une fenêtre **passée** les deux coïncident : `isTrainingDay` vaut
> `retroactiveDone || (hasPlanned && dayKey >= todayKey)`, et sa branche d'anticipation ne peut pas se
> déclencher sur un jour révolu.
>
> **On reprend donc `trainedDays`**, ce qui garantit que le groupement colle **exactement** à la cible
> qui a servi à juger chaque jour. Importer `isTrainingDay` séparément aurait ouvert la porte à un
> jour classé « séance » dont la cible aurait été calculée en jour de repos — une incohérence interne
> invisible, et impossible à débusquer en recette.
>
> L'intention de D1 est donc **tenue et renforcée** : on ne redéfinit rien, et on s'aligne sur la
> source qui compte.

### 2.2 D2 — 🔴 La tolérance appartient à l'utilisateur

Vérifié : l'adhérence de l'accueil utilise `nutritionProfile.adherenceMarginPct ?? 10`. **C'est un
réglage**, pas une constante.

Écrire un ±10 % en dur dans ce lot produirait **deux taux d'adhérence différents dans la même app**
pour quelqu'un qui a réglé sa marge à 5 %. L'un sur l'accueil, l'autre ici, tous les deux crédibles,
et aucun moyen de savoir lequel croire.

**On lit donc sa marge**, et la carte **dit laquelle** elle a utilisée.

### 2.3 D3 — « Gros volume » se mesure contre soi-même

MN-15 parle de « jours de très fort volume ». Il n'existe aucun seuil universel : 15 000 kg·reps est
énorme pour un débutant et ordinaire pour un pratiquant confirmé.

Le seuil est donc **la médiane de l'utilisateur** sur la fenêtre — un jour est « à fort volume » s'il
dépasse sa propre médiane d'un facteur nommé. Médiane et non moyenne, pour la raison déjà rencontrée
sur `computeSessionDuration` (EXEC-01) : une séance exceptionnelle tirerait la moyenne et rendrait
toutes les autres « faibles ».

**Aucun nombre absolu inventé** ; reste le facteur, qui est le seul choix libre du lot.

### 2.4 D4 — Sans poids de corps, MN-10 se tait

Les protéines par prise se jugent en **g/kg de poids de corps**. Sans pesée, il n'existe **aucune
valeur neutre** : prendre 70 kg par défaut produirait une répartition fausse et parfaitement crédible.

Même traitement que l'allure de référence d'ALLURE-01 : la carte **reste affichée**, dit son
indisponibilité **et son remède** (« ajoute une pesée »), avec l'accès pour le faire. Jamais un « — »,
et surtout **pas une carte masquée** — masquer, c'est laisser l'utilisateur ignorer à jamais qu'il lui
manque une donnée.

### 2.5 D5 — Une section repliée sur l'écran Nutrition

Ces quatre analyses parlent d'alimentation ; leur place est l'écran **Nutrition**, pas l'accueil.

⚠️ **Ni carte d'insight, ni widget d'accueil**, pour la raison désormais établie deux fois :
`MAX_INSIGHTS = 3` pour 13 candidats, et ADR-007 plafonne le Tier 0 (dégonflé de 21 à 7 par
INSIGHTS-02). Une analyse qu'on ne voit pas n'a pas été livrée ; une analyse qui pousse une autre
dehors est pire.

La section est **conditionnelle et repliée par défaut**, patron de `StrengthSection` (MUSCPWR-01) et
d'`ExecutionSection` (EXEC-01) : elle rend `null` quand ses quatre analyses se taisent, donc **elle ne
coûte rien à un compte neuf**.

## 3. Les règles

### R1 — Quatre moteurs purs, zéro React, zéro base, zéro horloge

`packages/shared`, `todayKey` en paramètre. Discipline tenue par les neuf moteurs des deux lots
précédents.

### R2 — Aucune analyse ne s'affiche sans son chiffre

« Tu manges moins les jours de séance » ne vaut rien sans « −320 kcal en moyenne, sur 14 jours de
séance ». Contrainte d'`InsightCandidate` (INSIGHTS-01) et de `ReviewDecision` (BILAN-01), tenue une
cinquième fois.

### R3 — Sous le seuil de données, l'analyse se tait

Comparer un jour de séance à un jour de repos n'est pas une comparaison. Chaque moteur exige un
**minimum de jours dans chacun des deux groupes** — pas un total, ce qui laisserait passer 12 jours
de repos et 1 de séance.

### R4 — Seuls les jours **renseignés** comptent

Un jour sans aucune entrée alimentaire n'est pas un jour à zéro calorie : c'est un jour non journalisé.
Même filtre que `computeGoalAdherence` et `computeCaloricBalance` — **on ne crée pas une seconde
convention** de « jour exploitable ».

⚠️ Conséquence à afficher : la carte dit **sur combien de jours** elle se prononce.

### R5 — On met côte à côte, on ne conclut pas

Le lot rapproche deux chiffres. Il ne dit jamais « ton déficit explique ta stagnation » : ce serait de
la causalité, et il n'y a ni contrôle ni puissance statistique pour la soutenir. La formulation reste
descriptive, et l'écart est **toujours** signé et chiffré.

### R6 — Les protéines se jugent par prise, pas seulement en total

MN-10 n'a d'intérêt que si elle distingue « 140 g en un repas » de « 140 g en quatre prises ». Elle
rend donc la **répartition par repas** *et* le **nombre de prises atteignant le repère par kg**.

### R7 — Le repère protéique est nommé, jamais prescrit

L'ordre de grandeur de la littérature (~0,3-0,4 g/kg par prise) est **affiché comme repère**. On ne
dit pas « tu n'en fais pas assez » : même règle que le 80/20 d'ALLURE-01, pour la même raison — le
repère vaut pour un objectif de prise de masse, pas pour tout le monde.

### R8 — Aucune écriture, aucune migration

Le lot est en **lecture seule** sur des colonnes existantes.

## 4. Cas limites

| Cas | Comportement |
|---|---|
| Aucun jour journalisé | Les quatre se taisent |
| Que des jours de repos journalisés | MN-20 et MN-16 se taisent (R3) — un seul groupe n'est pas une comparaison |
| Que des jours de séance | Idem |
| Journal partiel (1 aliment le matin) | Compte comme jour renseigné — même convention que l'existant (R4) |
| Aucune séance de muscu, que des courses | MN-15 se tait (elle lit le **volume muscu**) ; MN-20 et MN-16 fonctionnent (D1) |
| Aucune pesée | MN-10 affiche **l'indisponibilité et son remède** (D4) |
| Pesée très ancienne | Utilisée quand même — c'est la dernière connue, et l'inverse serait de refuser de calculer faute de fraîcheur |
| Cible calorique absente (profil incomplet) | Jours écartés, comme `computeGoalAdherence` le fait déjà |
| Volume identique tous les jours | Aucun jour au-dessus de la médiane → MN-15 se tait, ce n'est pas un défaut |
| Un seul repas configuré | MN-10 rend une prise — la répartition existe, elle est juste triviale |
| Repas hors configuration | Rejoint `OTHER_MEAL_KEY`, **en dernier** — convention de NUTR-16, pas une nouvelle |
| Pilier nutrition ou muscu inactif | Aucune section (décision H) |
| Mode avion | Identique — tout est local |

## 5. Données

**Aucune migration, aucune sync rule, aucun schéma PowerSync local, aucune dépendance native, aucune
écriture.** Colonnes existantes uniquement :

| Table | Colonnes |
|---|---|
| `food_entries` | kcal, protéines, `meal_key`, jour |
| `workouts` / `workout_sets` | pour `computeVolume` et la présence d'une séance terminée |
| `planned_sessions` | pour `isTrainingDay` (branche « planifié ») |
| `body_weight_entries` | dernière pesée connue |
| `nutrition_profiles` | cible, objectif, bonus jours de séance, **`adherence_margin_pct`** |

→ **Recettable sur l'APK existant**, comme les deux lots précédents. Critère de choix, pas hasard.

## 6. i18n — FR + EN

```
nutrition.crossTraining.title / .subtitle
nutrition.crossTraining.energy.title / .trainingDay / .restDay / .delta / .basis
nutrition.crossTraining.adherence.title / .trainingDay / .restDay / .margin
nutrition.crossTraining.lowFuel.title / .count / .detail / .none
nutrition.crossTraining.protein.title / .perMeal / .servings / .reference / .needsWeight
```

Nombres **formatés avant** `t()`. Les kcal et les grammes passent par les formateurs existants —
aucun second jeu.

## 7. Comportement offline

**Intégralement local, en lecture seule.** Aucun réseau, aucune écriture, aucune dépendance native.

## 8. À trancher à la validation

1. **Le facteur de « gros volume »** (D3) — 1,25× ou 1,5× la médiane ? Proposition : **1,25**. Seul
   choix libre du lot.
2. **Le minimum de jours par groupe** (R3) — 3 ou 5 de chaque ? Proposition : **3**.
3. **La fenêtre d'analyse** — 4 ou 8 semaines ? Proposition : **4**, cohérente avec la polarisation
   d'ALLURE-01 et assez courte pour rester actionnable.
4. **Le repère protéique par prise** (R7) — 0,3 ou 0,4 g/kg comme borne affichée ? Proposition :
   **0,3**, la borne basse : afficher la haute ferait passer beaucoup de monde pour insuffisant.

## 9. Critères de recette

1. Compte neuf → **aucune section** « croisement entraînement » sur l'écran Nutrition.
2. Journaliser uniquement des jours de repos → MN-20 et MN-16 restent muettes (une comparaison exige
   les deux groupes).
3. Après ≥ 3 jours de séance et 3 de repos journalisés : le bilan énergétique apparaît, **avec l'écart
   signé et le nombre de jours de chaque côté**.
4. 🔴 Manger **plus** les jours de séance → écart **positif** ; manger **moins** → écart **négatif**,
   affiché tel quel, **sans commentaire ni reproche**.
5. Adhérence : la carte **dit quelle marge** elle utilise. Changer `adherenceMarginPct` dans le profil
   → le taux **bouge**, et il reste **cohérent avec celui de l'accueil**. C'est le critère qui prouve
   qu'on n'a pas inventé une seconde tolérance.
6. 🔴 Faire une **course** (sans muscu) un jour journalisé → ce jour compte comme **jour
   d'entraînement** dans MN-20 et MN-16 (D1), mais **pas** dans MN-15, qui lit le volume muscu.
7. Volume : faire une séance nettement plus grosse que d'habitude avec un apport bas → elle apparaît
   dans « disponibilité énergétique ». Volume régulier → la carte se tait.
8. 🔴 **Aucune pesée** → la carte protéines **reste affichée** et propose d'en ajouter une, avec
   l'accès. **Jamais un « — »**, jamais une carte disparue.
9. Ajouter une pesée → les g/kg apparaissent **sans redémarrer l'app**.
10. Protéines : tout manger au dîner vs répartir sur 4 repas → **le nombre de prises change**, et la
    répartition le montre.
11. Un repas hors configuration → rangé en **« Autre », en dernier** (convention NUTR-16).
12. Les jours **non journalisés** ne comptent pas comme des jours à zéro (vérifier le dénominateur).
13. Désactiver le pilier **nutrition** ou **muscu** → aucune section.
14. FR ⇄ EN → aucune chaîne brute ; kcal et grammes formatés selon la locale.
15. Police **1,5×** et thème **sombre** → lisible, non tronqué, contrastes AA.
16. **TalkBack** → chaque analyse annoncée avec son chiffre et sa base.
17. Mode avion → identique.
18. **L'écran Insights, l'accueil et l'écran Nutrition existant n'ont pas changé** par ailleurs.
19. 🔴 **Calibrage**, jugement de pratiquant : **1,25× la médiane** est-il le bon seuil de « gros
    volume » ? **3 jours** par groupe suffisent-ils ? Et **0,3 g/kg par prise** est-il le bon repère à
    afficher ?

## 10. Definition of Done

Cochée le 08/08/2026, **item par item, sur des faits vérifiés**. Un item a dû être **réécrit** plutôt
que coché : il annonçait des réutilisations qui n'ont pas eu lieu, et pour de bonnes raisons.

- [x] `typecheck` **0**, `lint` **0 erreur**, `test:coverage` **0**, **3 841 tests verts**.
- [x] 4 moteurs **purs**, module à **100 % sur les quatre métriques**, branches comprises.
- [x] Chaque moteur rend `null` (ou `[]`) sous son seuil, et un test le fige (R3).
- [x] Les 3 seuils sont **exportés et nommés**, chacun assis par un test.
- [x] 🔴 Un test fige que l'adhérence utilise **la marge de l'utilisateur** : mêmes jours, marge 10 %
      → 100 %, marge 5 % → 0 % (D2).
- [x] 🔴 Un test fige qu'un **jour de course** ne produit jamais un « gros volume », là où il compte
      bien comme jour d'entraînement pour MN-20/MN-16 (D1).
- [x] Un test fige que les jours **non journalisés** n'entrent pas au dénominateur — **et** qu'un jour
      à **0 kcal** compte, lui, parce qu'il a été journalisé (R4).
- [x] Aucune migration, aucune sync rule, aucun ajout à `powersync/schema.ts`, aucune écriture.
- [x] `MAX_INSIGHTS`, `INSIGHT_ORDER`, `selectInsights` et le registre d'accueil **non modifiés** —
      `git diff` vide sur `insights.ts` et `insights-repository.ts`.
- [x] FR + EN symétriques (**2 088 clés** chacun), nombres formatés avant interpolation.
- [x] Catalogue : MN-20, MN-16, MN-15, MN-10 → ✅.
- [x] CHANGELOG, front-matter, roadmap 4.40, RECETTES.md §53, ETAT.

### 🔴 L'item réécrit, et pourquoi

La DoD annonçait : *« `isTrainingDay`, `computeGoalAdherence`, `computeCaloricBalance` et
`resolveMealSplit` sont réutilisés, pas réécrits »*. **Deux des quatre ne le sont pas** — et les
cocher aurait été faux :

| Brique | Réalité | Pourquoi |
|---|---|---|
| `computeGoalAdherence` | ✅ **réutilisée** telle quelle, groupe par groupe | C'est elle qui définit « dans la cible » |
| `isTrainingDay` | ❌ **non utilisée** — `trainedDays` l'est à la place | Voir D1 : sur une fenêtre passée les deux coïncident, et `trainedDays` **garantit l'alignement avec la cible**. C'est mieux, pas moins bien |
| `computeCaloricBalance` | ❌ **non utilisée** | Elle rend un solde global ; ce lot compare **deux groupes de jours**. L'appeler n'aurait rien apporté — l'annoncer était une erreur de cadrage, pas une dette |
| `resolveMealSplit` | 🟡 **convention réutilisée, fonction non appelée** | Elle rend des `avgKcalPerDay`, spécifiques aux calories. Ce sont `OTHER_MEAL_KEY` et l'ordre des repas configurés qui sont repris — l'essentiel, mais il fallait le dire exactement |

- [x] **Version exacte de l'item** : `computeGoalAdherence` est réutilisée telle quelle ; la convention
      de repas de NUTR-16 est reprise sans dupliquer sa fonction ; et le groupement des jours
      s'aligne sur `trainedDays`, la même source que la cible.

### ⚠️ Une dette assumée, inscrite au backlog

L'assemblage de `perDay` (cible de base → cible effective) **duplique** celui de
`useGoalAdherenceForRange`. Le factoriser aurait été mieux — mais ce hook **n'a aucun test direct** et
sert **BILAN-01, en recette** : le refactoriser maintenant aurait été un risque mal payé. Les deux
chemins appellent **les mêmes fonctions pures dans le même ordre**, et la dette est écrite.

> **Le code est complet ; l'US ne l'est pas.** Restent les **19 critères de recette device**
> ([RECETTES.md](../../../../RECETTES.md) §53), dont le calibrage des trois seuils.
