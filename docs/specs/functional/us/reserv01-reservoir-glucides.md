---
id: RESERV-01
titre: "Le Réservoir — la jauge de glucides de la journée"
roadmap: [4.45]
catalogue: [RN-07, RN-08]
etape: spec
branche: dev
maj: 15/09/2026
---

# US RESERV-01 — Le Réservoir

> Issue de la salve « carnet d'innovation » du 13/09/2026, idée **(23)**, lot 1 —
> [analyse](../../../product/analyse-innovation-2026-09.md) §5. **Périmètre tranché par Florian le
> 15/09/2026 : glucides seulement.** L'extension aux protéines et aux lipides a été étudiée puis
> abandonnée — les protéines ne se stockent pas et les réserves de lipides sont quasi illimitées à
> l'échelle d'une journée : une jauge qui se vide y serait fausse.
>
> ⚠️ **Travail directement sur `dev`** (décision Florian, 15/09/2026).

## 1. Le problème

Le pilier nutrition sait dire ce qui a été mangé **depuis minuit** et ce qu'il reste **jusqu'à
minuit**. Il ne sait pas dire ce qui compte quand on s'entraîne le soir : **est-ce que j'ai de quoi
tenir ma séance de 18 h 30 ?** Un total journalier atteint à 22 h ne sert à rien à 18 h.

Les briques existent séparément — cible glucidique (MN-04, FUEL-01), dépense d'une séance
(DEPENSE-01), repas horodatés par `meal_type` — mais **rien ne les met sur une même ligne de temps**.

## 2. Ce que fait la fonctionnalité

Une carte, dans le pilier Nutrition : une **jauge de glucides disponibles** estimée pour l'instant
présent, la **courbe de la journée** (les repas remplissent, les séances vident), la **projection**
jusqu'à la prochaine séance, et **une action** quand la projection passe sous la zone basse.

**Hors périmètre, explicitement :**

- **protéines et lipides** (décision ci-dessus) ;
- le **glycogène réel** : on estime un stock, on ne le mesure pas — aucune allégation physiologique ;
- la **nutrition intra-effort** (RN-07 complet : boisson, gels pendant la sortie) ;
- l'**heure réelle** des repas : `food_entries` ne porte pas de `consumed_at`, on travaille par repas
  (R3) ;
- toute **modification des cibles du journal** : MN-04 reste la seule autorité sur les grammes cibles,
  comme FUEL-01 l'a déjà acté.

## 3. Surfaçage (ADR-007)

| Surface | Ce qui apparaît |
|---|---|
| Pilier Nutrition | La carte « Réservoir » : jauge, courbe du jour, action éventuelle, bouton « Pourquoi ? » |
| Accueil | **Rien** — plafond atteint (ADR-007), et la carte n'a de sens que dans la journée nutrition |
| Écran de départ de course | **Rien en V1** (candidat lot 2) |

La carte n'apparaît que si le pilier Nutrition est actif **et** qu'un poids est connu (R9).

## 4. Décisions de cadrage

| # | Question | Décision |
|---|---|---|
| **D1** | Quelle capacité de stock ? | `capacité = poids × 5 g/kg`, constante exportée et nommée (`GLYCOGEN_G_PER_KG`). Ordre de grandeur de la littérature, pas une mesure. |
| **D2** | Où commence la journée ? | À **70 % de la capacité** au réveil (`START_OF_DAY_SHARE`), sans report du jour précédent : reporter un solde estimé d'un jour sur l'autre accumulerait l'erreur en silence. |
| **D3** | Quelle heure pour un repas ? | Une **heure conventionnelle par type** : petit-déjeuner 8 h, déjeuner 12 h 30, collation 16 h 30, dîner 20 h. Exportées, ajustables ; l'heure réelle viendra avec `consumed_at` (lot ultérieur). |
| **D4** | D'où vient la dépense d'une séance ? | Du **moteur DEPENSE-01** (`energy.ts`), converti en grammes de glucides par une part d'oxydation qui dépend de l'intensité (R4). On ne recalcule pas une dépense parallèle. |
| **D5** | Que projette-t-on ? | Les **séances planifiées** du reste de la journée et la vidange de repos. **Aucun repas futur n'est supposé** — sauf la collation que l'app propose, montrée comme une seconde courbe. |
| **D6** | Ton | Descriptif. « Ton fractionné démarrerait à 24 % » et non « tu dois manger ». Même règle que FUEL-01 (R4). |

## 5. Règles métier

**R1 — Capacité et niveau.** `capacitéG = poidsKg × GLYCOGEN_G_PER_KG` (5 g/kg). Le niveau est
exprimé en grammes **et** en pourcentage de la capacité, arrondi à l'unité. Il est **borné** à
`[0, capacité]` : ni réservoir négatif, ni sur-remplissage.

**R2 — Départ de journée.** `niveau(00:00) = capacité × START_OF_DAY_SHARE` (0,7).

**R3 — Remplissage.** Chaque entrée du journal apporte ses `carbs_g` à l'heure conventionnelle de son
repas (D3). L'absorption est **plafonnée** à `ABSORPTION_G_PER_H = 60` : un repas de 150 g de glucides
se déverse sur 2 h 30, pas d'un coup. Plusieurs collations le même jour partagent la même heure
conventionnelle — connu, documenté, sans conséquence sur le total.

**R4 — Vidange par la séance.** Pour chaque séance **réalisée ou planifiée** de la journée :
`grammes = kcal × partGlucidique ÷ 4`, où `kcal` vient de `energy.ts` (DEPENSE-01) et
`partGlucidique` vaut **0,5** (intensité faible), **0,65** (modérée) et **0,8** (élevée). Ces trois
nombres sont des **heuristiques exportées**, relisibles par un praticien. La vidange est répartie
linéairement sur la durée de la séance.

**R5 — Vidange de repos.** En dehors des séances, `REST_DRAIN_G_PER_H = 4` (cerveau et foie).
Pendant le sommeil (00 h–6 h), la même valeur s'applique : c'est ce qui justifie D2 plutôt qu'un
report.

**R6 — Projection.** De l'instant présent à minuit, on applique R4 (séances planifiées) et R5 (repos)
**sans supposer aucun repas**. Deux courbes sont tracées : « sans rien » et « avec la collation
proposée » quand une action est affichée (R7).

**R7 — Action.** Si la projection passe sous `LOW_ZONE_SHARE = 30 %` **avant ou pendant** une séance
planifiée, la carte propose une quantité de glucides : le **plus petit multiple de 10 g** qui fait
terminer la séance au-dessus du seuil, plafonné à 120 g. L'action renvoie vers la suggestion
d'aliments existante (NUTR-F2) filtrée sur les glucides. Sans séance planifiée, **aucune action** :
une jauge basse un soir de repos n'est pas un problème.

**R8 — Honnêteté.** La carte porte en permanence la mention « estimation » et expose le bouton
**« Pourquoi ? »** (composant `ExplainButton` livré par DASH-01) : une fonction `explainGlycogen`
donne les étapes — capacité, départ, apports, séances, vidange de repos — et un niveau de confiance.
La confiance est **basse** si le poids date de plus de 30 jours ou si moins de deux repas sont saisis,
**moyenne** avec une séance non horodatée, **haute** sinon.

**R9 — Données manquantes.** Sans poids connu, la carte **ne s'affiche pas** (même règle que MN-06 et
FUEL-01 : un g/kg sans poids n'existe pas). Sans aucun repas saisi du jour, la carte s'affiche avec
la seule vidange et le dit (« aucun repas saisi »).

**R10 — Jour affiché.** La carte suit la **date sélectionnée** dans le pilier nutrition. Sur un jour
passé, la projection disparaît : on ne projette pas le passé, on montre la courbe réalisée.

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Aucun poids | Carte masquée (R9) |
| Poids ancien (> 30 j) | Carte affichée, confiance basse (R8) |
| Aucun repas saisi | Courbe en descente seule + mention explicite |
| Séance sans durée (manuelle) | Vidange appliquée sur une durée par défaut du moteur DEPENSE-01 ; confiance moyenne |
| Séance en cours | Vidange appliquée au prorata du temps écoulé |
| Deux séances qui se chevauchent | Les vidanges s'additionnent, le niveau reste borné à 0 (R1) |
| Apport massif (recharge 400 g) | Plafonné par l'absorption (R3) ; le surplus au-delà de la capacité est perdu, jamais reporté |
| Jour futur (planning) | Courbe entièrement projetée, action possible, aucune donnée réelle |
| Pilier nutrition inactif | Aucune carte (décision H) |
| Piliers muscu et course inactifs | Jauge sans séance : courbe plate décroissante, aucune action (R7) |

## 7. i18n (FR + EN)

Espace de clés `nutrition.fuelTank.*` — aucune chaîne en dur, nombres formatés avant `t()`.

| Clé | FR | EN |
|---|---|---|
| `fuelTank.title` | « Réservoir » | “Fuel tank” |
| `fuelTank.subtitle` | « Glucides disponibles, estimés » | “Estimated carbs available” |
| `fuelTank.level` | « ≈ {{percent}} % » | “≈ {{percent}}%” |
| `fuelTank.grams` | « ≈ {{grams}} g sur ~{{capacity}} g » | “≈ {{grams}} g of ~{{capacity}} g” |
| `fuelTank.estimate` | « Estimation, pas une mesure » | “An estimate, not a measurement” |
| `fuelTank.lowZone` | « Zone basse · {{percent}} % » | “Low zone · {{percent}}%” |
| `fuelTank.noMeal` | « Aucun repas saisi aujourd'hui » | “No meal logged today” |
| `fuelTank.projection.without` | « Sans rien » | “As is” |
| `fuelTank.projection.with` | « Avec la collation » | “With the snack” |
| `fuelTank.action.title` | « Ajoute ~{{grams}} g de glucides avant {{time}} » | “Add ~{{grams}} g of carbs before {{time}}” |
| `fuelTank.action.body` | « Sans ça, ta séance de {{time}} finirait vers {{percent}} %. » | “Without it, your {{time}} session would end near {{percent}}%.” |
| `fuelTank.action.cta` | « Voir des idées de collation » | “See snack ideas” |
| `fuelTank.legend.meals` | « Repas saisis » | “Logged meals” |
| `fuelTank.legend.sessions` | « Séances » | “Sessions” |

Les explications (`explain.glycogen.*`) suivent le patron de `explain.energy.*` livré par DEPENSE-01.

## 8. Comportement offline

**Tout est local** : repas, séances, poids et planning viennent de SQLite ; le calcul est pur. Aucune
table nouvelle, **aucune migration**, donc **aucune sync rule PowerSync à redéployer**.

## 9. Accessibilité

- La jauge n'est jamais lue par la seule couleur : le pourcentage et les grammes sont écrits, et la
  zone basse est nommée.
- La courbe a un **équivalent textuel** annoncé par TalkBack : niveau maintenant, minimum projeté,
  heure de ce minimum.
- Contraste ≥ 3:1 pour le remplissage et la ligne de seuil (tokens existants), ≥ 4,5:1 pour les
  textes. Test à 1,5× de police : la carte grandit, rien n'est coupé.

## 10. Critères de recette (device)

1. Sans poids renseigné, la carte n'apparaît pas ; en renseignant un poids, elle apparaît.
2. Ajouter un repas riche en glucides fait **monter** la courbe à l'heure du repas, pas avant.
3. Un repas de 150 g ne remonte pas la jauge d'un coup : la montée s'étale (R3).
4. Terminer une séance de musculation fait **descendre** la jauge, d'autant plus que la séance est
   longue et intense.
5. Une séance planifiée le soir apparaît dans la projection **avant** d'avoir eu lieu.
6. Quand la projection passe sous la zone basse, l'action propose une quantité **ronde** et cohérente
   (plus la séance est grosse, plus la quantité est grande).
7. Suivre l'action (ajouter les glucides) fait disparaître l'action et remonter la projection.
8. Sans séance planifiée, aucune action n'apparaît même avec une jauge basse.
9. « Pourquoi ? » ouvre la feuille d'explication avec les étapes et un niveau de confiance ; le niveau
   baisse quand le poids est ancien.
10. Sur une date passée, aucune projection n'est tracée.
11. Mode avion : identique.
12. TalkBack lit l'équivalent textuel de la courbe ; à 1,5× de police, rien n'est coupé.
13. La carte ne contredit jamais la cible du journal : les grammes cibles affichés ailleurs (MN-04)
    sont inchangés.
