---
id: FUEL-01
titre: "Socle glucidique du coureur — besoin g/kg selon la charge et périodisation jours durs / faciles"
roadmap: []
catalogue: [RN-05, RN-06]
etape: validation
branche: feature/fuel01-socle-glucidique-coureur
maj: 07/08/2026
---

# US FUEL-01 — Socle glucidique du coureur

> **Spec fonctionnelle — en attente de validation (Florian ou Damien).** Aucune ligne de code
> applicatif n'est écrite avant validation des 3 livrables (spec + plan + maquette).
>
> **Premier lot du chantier « Nutrition du coureur »** (catalogue RN-05 → RN-21, 9 analyses non
> cadrées). Ce lot livre **le socle** : la cible glucidique en g/kg de poids de corps. Tout le reste du
> module en dépend — un plan de fueling de sortie longue (RN-07) ou une recharge post-effort (RN-08)
> n'ont aucun sens sans une cible de référence.
>
> **Aucune ligne de roadmap** : US d'analyse, suivie au
> [catalogue](../../product/analyses-donnees.md) qui en est la source de vérité (règle posée le
> 02/08/2026, respectée depuis META-19).

## 0. Ce que la lecture du code a trouvé, et qui commande toute la spec

**Il existe déjà une cible glucidique, et elle n'est pas en g/kg.** MN-04 (livrée le 04/08/2026, en
recette) a introduit `trainingDayMacroGrams` ([nutrition.ts:371](../../../packages/shared/src/nutrition.ts)) :

```
base   = macroGramsFromCalories(targetBase, defaultMacroRatios(objective))   // glucides = % des kcal
bonus  = (effectiveTarget − targetBase) kcal → 100 % en glucides            // décision D1 de MN-04
```

La cible glucides du jour est donc **un pourcentage des calories** (45 % en `bulk`, 50 % en
`maintain`, 35 % en `cut`/`weightloss`) **plus** le bonus d'entraînement converti en glucides.

RN-05, tel que le catalogue le décrit, propose une cible **en g/kg de poids de corps** (repos ~3-5,
modéré ~5-7, gros volume ~7-10). **Les deux méthodes ne donnent pas le même nombre**, et l'écart
grandit précisément là où la fonctionnalité est censée servir. Chiffré, pour un coureur de 70 kg,
objectif `maintain`, TDEE 2 600 kcal :

| Situation | Cible MN-04 (livrée) | Cible RN-05 (g/kg) | Écart |
|---|---|---|---|
| Jour de repos | 50 % × 2 600 = **325 g** (4,6 g/kg) | 3-5 g/kg = **210-350 g** | compatible |
| Semaine à gros volume | 325 g + bonus ~400 kcal = **425 g** (6,1 g/kg) | 7-10 g/kg = **490-700 g** | **+65 à +275 g** |

🔴 **C'est exactement le schéma qui a coûté l'US GARDE-01** : TRI-12 et MR-14 avaient été validées à
deux jours d'écart en se contredisant sur le fond, et le code appliquait les deux règles opposées en
même temps. Ici la contradiction serait pire, parce qu'elle porterait sur **un chiffre affiché** :
l'utilisateur verrait deux cibles glucides différentes selon l'écran.

Et il y a un second effet, plus insidieux : **MN-04 est en recette, et son critère 5 est
« les 3 barres macro totalisent l'objectif calorique affiché en haut de l'écran »**
([RECETTES.md §42](../../../RECETTES.md)). Une cible glucides pilotée par le poids de corps, donc
indépendante des calories, **casse cette égalité** — on ferait régresser une US en cours de recette.

**Conséquence pour cette spec** : la question n'est pas « comment calculer 7 g/kg », elle est
**« RN-05 remplace-t-il la cible, ou la décrit-il ? »**. C'est la décision D1, et tout le reste en
découle.

## 1. Décisions de cadrage — À ARBITRER

| # | Question | Recommandation | Pourquoi |
|---|---|---|---|
| **D1** | RN-05 **remplace-t-il** la cible glucides du jour, ou est-il un **indicateur descriptif** ? | 🟢 **Indicateur descriptif.** On affiche les **g/kg atteints** et la **fourchette de référence** correspondant à la charge de course, sans jamais toucher `trainingDayMacroGrams` ni la cible affichée sur le journal | C'est **exactement** ce que fait MN-06 pour les protéines, livré et validé : g/kg + fourchette par objectif + statut `low`/`in`/`high`, purement descriptif, la cible du journal reste inchangée. Zéro collision avec MN-04, **critère 5 de sa recette préservé**, et le patron est déjà écrit ([protein-target.ts](../../../packages/shared/src/protein-target.ts)) — **33 lignes** à cloner. L'alternative (piloter la cible) exigerait de rouvrir MN-04, de casser l'égalité macros↔calories et de re-recetter deux US. **Le glucide devient le frère du protéique, pas son concurrent** |
| **D2** | Où ça vit ? L'écran Stats nutrition a déjà **8 blocs**, ADR-007 §2 dit « au-delà de ~4-5 sections → repliable ou sous-onglets » | 🟢 **Dans la carte `ProteinPerKgCard` existante**, renommée « Macros par kg », qui porte les protéines (toujours) **et** les glucides (conditionnel). **Zéro bloc ajouté** | Le précédent a 3 jours et vient du **même écran** : NUTR-18 s'est **fondue dans la carte Adhérence** de NUTR-10 au lieu d'ajouter un 9ᵉ bloc, précisément pour cette raison. Ajouter une 9ᵉ carte doublerait le plafond ADR-007 juste après qu'INSIGHTS-02 ait dépensé une US entière à dégonfler l'accueil. Et ADR-007 §3 demande de **mutualiser une brique « jauge valeur vs cible »** : deux macros dans une carte, c'est cette brique |
| **D3** | La charge de course se mesure en **km/semaine** ou en **heures/semaine** ? | 🟢 **Durée (h/semaine)** | Le projet a déjà tranché ce même arbitrage : RUN-02 existe « pour compléter la distance (séances au temps/sans GPS) ». Un tapis, une sortie saisie à la main ou une course sans trace GPS ont une **durée** mais pas toujours une distance fiable. Choisir les km rendrait la cible fausse pour ces séances, silencieusement. La littérature raisonne d'ailleurs en **heures d'entraînement/jour**, pas en km |
| **D4** | RN-06 (jours durs / faciles) : que fait-on d'un jour de **course libre**, qui n'a pas de type ? | 🟢 **« Indisponible », jamais une supposition** | `course_libre` n'a structurellement pas de `session_type` — c'est **la raison pour laquelle RUN-07 est encore ⏳** au catalogue. Deviner « c'est sûrement de l'endurance » serait inventer une donnée. Précédent exact et validé : MUSC-20 critère 2 — l'utilisateur sans planning voit ses métriques marquées **indisponibles**, « jamais un chiffre inventé » |
| **D5** | On énonce des **fourchettes sourcées** (3-5 / 5-7 / 7-10 g/kg) alors que le projet s'interdit le conseil de santé inventé ? | 🟢 **Oui, comme constante exportée et documentée, jamais formulée en prescription** — plus une relecture par un pratiquant avant clôture | La ligne est **déjà franchie et assumée** : `PROTEIN_TARGETS_G_PER_KG` est en production, commentée « heuristiques, ajustables ». Ce qui a été refusé ailleurs, c'est autre chose : MUSC-F14 refusait de **suggérer un remplacement d'exercice** sur une zone douloureuse (une action, sans donnée articulaire), DOUL-01 refusait d'**expliquer** une douleur. Afficher « tu es à 4,2 g/kg, la fourchette de référence pour ce volume est 5-7 » est un **fait plus un repère**, pas une ordonnance. ⚠️ Mais MUSCPWR-01 a montré le vrai risque : un chiffre faux produit un résultat **plausible donc invisible en recette** (critère 21 sur les coefficients DOTS). D'où un critère de recette dédié |
| **D6** | Fenêtre de la charge : **glissante** ou semaine calendaire ? | 🟢 **7 jours glissants** | `aggregateRunStats(period:'week')` est **calendaire** (lundi→dimanche, [run-stats.ts:33](../../../packages/shared/src/run-stats.ts)) : un lundi matin, la charge repartirait à zéro et la cible chuterait de « gros volume » à « repos » du jour au lendemain, sans qu'aucun entraînement n'ait changé. Toutes les analyses de charge du projet sont glissantes (ACWR 7/28 j, MN-02 7 j, MN-03 8 sem) |
| **D7** | Statut affiché : 3 états (`low`/`in`/`high`) comme les protéines ? | 🟢 **Oui, à l'identique** | Cohérence de lecture dans une carte qui porte les deux macros. Réutilise le type `ProteinPerKgStatus` généralisé |

## 2. Surfaçage (ADR-007 §5 — obligatoire)

- **Tier 1** — écran Stats nutrition, dans une carte existante (D2).
- **Condition d'affichage** : **conditionnelle** (le défaut exigé par ADR-007 §5). La ligne glucides
  n'apparaît que si **les 4 conditions** sont réunies :
  1. piliers `running` **et** `nutrition` actifs (décision H, via `resolveActivePillars`) ;
  2. un poids de corps connu (dernière pesée, ou `profiles.weight_kg` en repli) ;
  3. au moins **une course terminée** dans la fenêtre de 7 jours glissants ;
  4. au moins **un jour de journal alimentaire renseigné** dans la fenêtre.
- Sinon : la ligne n'est **pas rendue** (la carte garde ses protéines, elle ne montre pas un état vide
  glucidique). **Aucun widget dashboard** — le Tier 0 est plafonné et appliqué par test
  (`MAX_HOME_WIDGETS`), et cette analyse n'est pas du live actionnable du jour.
- **Critère d'entrée en UI** (ADR-007 §4) : satisfait sur deux des trois motifs —
  **différenciateur inter-piliers** (course ↔ nutrition, la paire la plus pauvre du produit : 3 items
  livrés sur 21) et **action concrète** (« mange plus de glucides ce soir » est actionnable le jour même).

## 3. Ce qui existe déjà, et ce que cette US ajoute

| Brique existante | Rôle ici |
|---|---|
| `computeProteinPerKg` + `PROTEIN_TARGETS_G_PER_KG` ([protein-target.ts](../../../packages/shared/src/protein-target.ts)) | **Patron cloné** : même signature, même logique de bornes incluses, même statut 3 états |
| `useProteinPerKg` (nutrition-repository) | **Patron cloné** pour la lecture ; son accès au poids (`useLatestWeight()` → `latest?.weightKg ?? profile?.weightKg ?? null`) est repris **verbatim** |
| `ProteinPerKgCard` | **Étendue** (D2), pas dupliquée : devient « Macros par kg », 1 ligne protéines + 1 ligne glucides conditionnelle |
| `averageIntake` (nutrition.ts) | Moyenne des glucides sur les jours **loggés** de la fenêtre — jours vides exclus, comme partout |
| `SESSION_TYPES` / `PROGRAM_SESSION_TYPES` ([running-paces.ts:23](../../../packages/shared/src/running-paces.ts)) | Classement dur / facile de RN-06 |
| `resolveActivePillars` (REFACTO-01) | Gating 2 piliers, point de décision unique |
| `runs.duration_seconds`, `planned_sessions.target_*`, `body_weight_entries`, `food_entries.carbs_g` | Données, **toutes déjà en base et déjà synchronisées** |

**Ce que cette US ajoute** : deux fonctions pures (`computeCarbLoadLevel`, `computeCarbsPerKg`), une
table de fourchettes (`CARB_TARGETS_G_PER_KG`), un classement de journée (`classifyRunningDay`), un
hook, et une ligne dans une carte existante.

**Aucune migration, aucune sync rule, aucune dépendance native, aucune nouvelle table.**

## 4. Les règles

**R1 — La cible glucides du journal n'est jamais modifiée.** `trainingDayMacroGrams` (MN-04) reste
la seule autorité sur la cible affichée dans le journal, l'accueil et l'écran Nutrition. FUEL-01
**lit** et **compare**, il ne **prescrit** pas. Une assertion de test dédiée le garantit (patron de la
règle R1 de REPAS-01, qui interdit d'écrire dans `food_entries`).

**R2 — Trois niveaux de charge, sur la durée de course des 7 jours glissants** (D3, D6) :

| Niveau | Durée de course / 7 j | Fourchette glucides | Motif du seuil |
|---|---|---|---|
| `rest` | 0 (aucune course terminée) | *ligne masquée* (§2, condition 3) | Sans course, l'analyse n'a pas de sujet — ce n'est pas un « niveau repos » à afficher |
| `light` | > 0 et < 3 h | **3-5 g/kg** | Charge d'entretien |
| `moderate` | 3 h à < 6 h | **5-7 g/kg** | ~1 h/jour d'entraînement |
| `high` | ≥ 6 h | **7-10 g/kg** | Volume de préparation longue distance |

⚠️ **Les bornes 3 h et 6 h sont un choix de cadrage, pas une mesure.** Elles traduisent en durée les
paliers « modéré » / « gros volume » du catalogue, qui ne les chiffrait pas. Constantes exportées et
nommées, **à juger en recette par un pratiquant** (critère 9).

**R3 — Le statut compare le réalisé à la fourchette, bornes incluses.** `gPerKg < min` → `low`,
`> max` → `high`, sinon `in`. Une décimale, comme les protéines. Identique à `computeProteinPerKg`
pour que les deux lignes de la carte se lisent de la même façon.

**R4 — Ton factuel, aucune injonction.** La carte énonce un fait et un repère : « Glucides
4,2 g/kg · référence 5-7 pour ce volume ». Jamais « tu dois manger plus », jamais « insuffisant » en
jugement de valeur, jamais de rouge alarmiste — le vocabulaire des trois statuts reste celui des
protéines, déjà validé.

**R5 — RN-06 classe la journée, il ne recalcule pas la cible.** Le type de séance **planifiée du jour**
donne un qualificatif de journée :

| Type de séance planifiée | Journée | Effet |
|---|---|---|
| `fractionne`, `sortie_longue` | **dure** | Mention « journée dure — haut de la fourchette » |
| `endurance`, `recuperation` | **facile** | Mention « journée facile — bas de la fourchette » |
| aucune séance planifiée | **repos** | Mention « journée sans course planifiée » |
| `course_libre`, ou course faite hors planning | **indisponible** (D4) | **Aucune mention** — pas de supposition |

La mention **oriente dans la fourchette de R2** ; elle ne produit pas un second nombre. Deux cibles
concurrentes dans la même carte reproduiraient à l'échelle de la carte le défaut du §0.

**R6 — Fenêtre glissante de 7 jours, bornes locales.** Fenêtre `[aujourd'hui − 6 j ; aujourd'hui]` en
jours locaux (`localDayKey`), cohérente avec ACWR et MN-02. Aucune dépendance à `Date.now()` dans les
briques pures : la date du jour est **injectée** (`todayKey`), comme dans tout `packages/shared`.

**R7 — Les jours non loggés sont exclus, jamais comptés à zéro.** Réutilise `averageIntake`, qui
applique déjà cette règle. Un jour sans journal ne fait pas chuter la moyenne — sinon la carte
punirait l'oubli de saisie au lieu de mesurer l'alimentation.

**R8 — Poids absent = ligne masquée.** Aucun repli sur un poids moyen ou une valeur par défaut : sans
poids, un g/kg n'existe pas. Même position que MN-06 (`hasWeight`) et que MUSC-27, qui n'affiche
**rien** sans sexe renseigné plutôt qu'une valeur neutre.

## 5. Périmètre

**Dans le périmètre :**
1. `CARB_TARGETS_G_PER_KG` + `computeCarbLoadLevel` (durée 7 j → niveau) + `computeCarbsPerKg`
   (g/kg + fourchette + statut), purs et testés.
2. `classifyRunningDay` (type de séance planifiée → dure / facile / repos / indisponible).
3. Hook `useCarbsPerKg`, patron de `useProteinPerKg`.
4. `ProteinPerKgCard` → « Macros par kg » : ligne protéines inchangée + ligne glucides conditionnelle.
5. i18n FR + EN.
6. Catalogue : RN-05 et RN-06 passent 🆕 → ✅ à la livraison.

**Hors périmètre, explicitement :**
- **Toute modification de la cible du journal** (R1) — c'est le cœur de D1.
- **Les 4 lots suivants du chantier** : RN-07/08/09/21 (autour de la sortie : plan de fueling,
  recharge glycogène, protéines de récup, timing du dernier repas), RN-15/16/19/20 (sodium,
  coût du fractionné, carburant embarqué, affûtage). Ils ont besoin de ce socle, pas l'inverse.
- **Le glucide péri-séance intra-journée** (RN-14 au catalogue, distinct) : il faudrait exploiter
  `food_entries.consumed_at` et les repas pré/post ; c'est le lot 2.
- **Un widget dashboard** (§2).
- **La cadence, la FC, l'hydratation** : hors V1 (V2 wearables / table dédiée).

## 6. i18n (FR + EN)

Famille `stats.macrosPerKg.*` — la famille protéines existante est **conservée telle quelle** (aucune
clé renommée : la carte change de titre, pas ses lignes).

| Clé | FR | EN |
|---|---|---|
| `title` | « Macros par kg » | « Macros per kg » |
| `carbs.label` | « Glucides » | « Carbs » |
| `carbs.value` | « {{gPerKg}} g/kg » | « {{gPerKg}} g/kg » |
| `carbs.reference` | « référence {{min}}-{{max}} g/kg » | « reference {{min}}-{{max}} g/kg » |
| `load.light` / `moderate` / `high` | « volume léger » / « volume modéré » / « gros volume » | « light volume » / « moderate volume » / « high volume » |
| `day.hard` | « journée dure — haut de la fourchette » | « hard day — upper end of the range » |
| `day.easy` | « journée facile — bas de la fourchette » | « easy day — lower end of the range » |
| `day.rest` | « aucune course planifiée aujourd'hui » | « no run planned today » |
| `status.low` / `in` / `high` | réutilise les clés de statut des protéines | idem |

⚠️ **`g/kg` n'est pas traduit** et c'est volontaire : c'est une unité, pas un mot. Idem pour le
séparateur décimal, géré par le formateur de langue existant.

## 7. Comportement offline

**Total.** Lecture PowerSync locale (`runs`, `planned_sessions`, `food_entries`,
`body_weight_entries`, `nutrition_profiles`), calcul **pur** côté client, aucun appel réseau, aucune
écriture. La carte fonctionne identiquement en mode avion. Aucune sync rule (aucune table neuve,
aucune colonne neuve).

## 8. Accessibilité

La ligne glucides est un **bloc `accessible` unique** (label composé : macro + valeur + unité +
fourchette + statut), pas quatre fragments lus séparément — patron déjà appliqué à la ligne
protéines. Contrastes : réutilise les couleurs de statut de la palette, **déjà mises en conformité AA
par CONF-07** (`success` 4,53 · `warnText` 4,52) ; aucune nouvelle paire de couleurs n'est introduite,
donc rien à ajouter au test de contraste.

## 9. Cas limites

| Situation | Comportement attendu |
|---|---|
| Aucune course terminée sur 7 j | Ligne glucides **masquée** (§2 condition 3) — la carte garde les protéines |
| Pilier `running` inactif | Ligne masquée, quelles que soient les données |
| Pilier `nutrition` inactif | La carte entière ne s'affiche pas (comportement MN-06 existant, inchangé) |
| Aucun poids connu | Ligne masquée (R8) |
| Aucun jour de journal loggé sur 7 j | Ligne masquée (§2 condition 4) — pas un 0 g/kg |
| Course de 20 min unique dans la semaine | Niveau `light` (> 0 h et < 3 h), fourchette 3-5 |
| Exactement 3 h de course | Niveau `moderate` — **bornes basses incluses**, comme les fourchettes de statut |
| Course avec `duration_seconds` à `null` | Contribue **zéro** à la charge, n'est pas retirée du décompte (même règle que le RPE absent dans `sessionLoad`) |
| Deux séances planifiées le même jour, une dure et une facile | Journée **dure** — la plus exigeante gagne. Le cas existe (MR-01 badge « deux séances le même jour ») |
| Séance planifiée `course_libre` | Journée **indisponible**, aucune mention (D4) |
| Course faite sans être planifiée | Journée **indisponible** — elle compte dans la **charge** (R2, elle a une durée) mais pas dans le **classement** (R5) |
| Macros manuelles actives (`manualCalories`) | **Aucun effet** : FUEL-01 mesure le réalisé et un repère, il ne lit pas la cible. Contraste volontaire avec MN-04, dont le critère 4 dit « aucun changement si macros manuelles » |
| Période « vie réelle » active (VIE-01) | Ligne affichée **normalement**. Ce n'est ni un reproche ni un objectif : c'est un fait mesuré et un repère physiologique. `REAL_LIFE_MUTED_INSIGHTS` ne concerne que les signaux qui reprochent d'avoir fait moins |
| Poids affiché en livres (unités impériales) | Le g/kg est calculé **en kg** et l'unité affichée reste `g/kg` : la colonne `body_weight_entries.weight_kg` **stocke toujours des kilogrammes**, l'US 1.15 ne change que l'affichage. Un « g/lb » n'existe pas dans la littérature |
| Mode avion | Fonctionne normalement |

## 10. Definition of Done

- [ ] D1 → D7 arbitrées par Florian ou Damien.
- [ ] `computeCarbLoadLevel`, `computeCarbsPerKg`, `classifyRunningDay` pures, sans `Date.now()`,
      couvertes à 100 % instructions/fonctions/lignes (cliquet en place sur `packages/shared`).
- [ ] Test d'assertion R1 : `trainingDayMacroGrams` et la cible du journal sont **inchangés** par
      cette US (le test échoue si un jour on branche FUEL-01 sur la cible).
- [ ] Les 4 conditions d'affichage testées, y compris les deux qui masquent (poids absent, 0 course).
- [ ] i18n FR + EN complète, aucune chaîne en dur.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` verts (codes de sortie lus **sans pipe**).
- [ ] Catalogue : RN-05 et RN-06 → ✅ avec renvoi vers cette US.
- [ ] `RECETTES.md` : section créée (la §50), critères ci-dessous.
- [ ] **Aucune ligne de roadmap créée** (US d'analyse — règle du 02/08/2026).

## 11. Critères d'acceptation (recette device)

1. Coureur ~70 kg, **2 h de course** sur les 7 derniers jours, journal renseigné → la carte
   « Macros par kg » affiche une ligne **Glucides** avec la référence **3-5 g/kg** (volume léger).
2. Même compte, **7 h de course** sur 7 jours → la référence passe à **7-10 g/kg** (gros volume).
   *C'est le test qui prouve que les paliers de durée fonctionnent.*
3. **Aucune course** sur 7 jours → la ligne Glucides **disparaît**, la ligne Protéines **reste**.
   Pas de « 0 g/kg », pas de carte vide.
4. **Poids de corps absent** du profil et aucune pesée → ligne Glucides masquée (R8).
5. **Pilier course désactivé** → ligne Glucides masquée, quelles que soient les données.
6. 🔴 **La cible glucides du journal n'a pas bougé** : ouvrir l'onglet Nutrition avant et après cette
   US affiche **exactement les mêmes grammes cibles**, et les 3 barres macro totalisent toujours
   l'objectif calorique. *C'est le critère central — celui qui vérifie D1 et protège la recette de
   MN-04 (§42 critère 5).*
7. Journée avec un **fractionné planifié** → mention « journée dure ». Avec une **endurance** →
   « journée facile ». **Sans séance planifiée** → « aucune course planifiée aujourd'hui ».
8. Journée avec une **course libre** → **aucune mention** de journée (ni dure, ni facile, ni repos).
   ⚠️ **Ce n'est pas un oubli d'affichage** (D4) : on ne connaît pas le type d'une course libre.
9. 🔴 **Relecture par un pratiquant d'endurance** : les 3 fourchettes (3-5 / 5-7 / 7-10 g/kg) **et**
   les 2 seuils de durée (3 h, 6 h) sont-ils crédibles ? ⚠️ **Critère de jugement, pas de
   manipulation** — un seuil faux produit un chiffre plausible, donc invisible en recette
   fonctionnelle (leçon des coefficients DOTS, MUSCPWR-01 critère 21).
10. Un jour de journal **non renseigné** dans la fenêtre ne fait pas chuter les g/kg affichés (R7).
11. **Mode avion** : la carte s'affiche et se calcule normalement.
12. En **EN** : les 3 libellés de volume, les 3 de journée et la référence sont grammaticaux ; le
    séparateur décimal suit la langue.
13. TalkBack énonce la ligne Glucides comme **un seul bloc cohérent** (macro + valeur + référence +
    statut), pas des fragments disjoints.
14. **Période « vie réelle » active** → la ligne reste affichée normalement (§9). Ce n'est pas un
    reproche, c'est un repère physiologique.
