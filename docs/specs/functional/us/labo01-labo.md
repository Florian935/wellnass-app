---
id: LABO-01
titre: "Le Labo — là où tes piliers se croisent"
roadmap: [7.30]
catalogue: []
etape: recette
branche: dev
maj: 15/09/2026
---
# US LABO-01 — Le Labo

> **Raccourci de parcours assumé.** Le [workflow](../../../../CLAUDE.md#workflow-obligatoire-par-fonctionnalité)
> impose spec → plan → design → validation → code. Ici l'ordre a été **inversé sur demande explicite
> de Florian** (15/09/2026 : « On va tout coder ICI d'un seul coup sec, d'une seule vague et avant le
> Play Store »), après quatre allers-retours de design validés à l'écran : v1 « chimie » rejetée,
> v2 figurative validée (14 écrans), direction « les disques » choisie, puis **prototype jouable en
> 3D réaliste validé le 15/09** (« c'est super beau », « c'est vraiment une aide à la planification »).
> La maquette existe donc, et elle est **jouable** : c'est elle qui a servi de spécification visuelle.
> Cette spec et le [plan](../../../plans/labo01-labo.md) sont écrits **avec** le code, pas avant.
> Même exception que DASH-01 (7.29), pour la même raison : une recette finale unique.

## 0. Contexte

Trois piliers, trois scènes, trois jeux de réglages — et **87 analyses entre piliers** au
[catalogue](../../../product/analyses-donnees.md), dont 28 livrées, éparpillées en bandeaux et en
cartes. Elles n'ont pas de maison. L'écran **Insights** raconte ce qui mérite d'être vu ; il ne
laisse rien **faire**.

Le Labo est l'endroit actif : on y règle ses doses **de tous les piliers à la fois**, on y voit ce
qui se gêne, on y pose une question quand une courbe cale, et on y garde ce qu'on a appris de soi.

L'exploration produit est dans [analyse-labo-2026-09.md](../../../product/analyse-labo-2026-09.md) ;
les maquettes et le prototype jouable dans [design/labo-2026-09/](../../../../design/labo-2026-09/).

### Le risque qu'on écarte

Florian, 15/09/2026 : « il faut qu'il y ait un intérêt à venir dans le labo », « pas que ce soit
uniquement un joujou ». Une belle scène 3D sans usage se visite une fois. **Tout ce que le Labo
affiche part donc du réel de la semaine en cours et se termine par un geste qui écrit dans le plan.**

## 1. Ce que l'US livre

Un **onglet dédié** (décision de Florian le 15/09 : ni un widget d'accueil, ni un écran caché dans
les réglages), avec une **scène 3D dès le premier écran**, et quatre onglets sous elle.

| Onglet | Ce qu'on y fait | Moteur |
|---|---|---|
| **Semaine** | ce que le Labo voit de ta semaine réelle, jour par jour, et **ce qu'il propose** — un geste par point | `lab-week.ts` |
| **Composer** | doser les leviers de tous les piliers ensemble, avec l'effet chiffré et les croisements | `lab-composer.ts` |
| **Pourquoi ?** | quand une courbe cale, les causes classées **dans tes données**, et l'expérience qui tranche | `lab-investigations.ts` |
| **Acquis** | ce que le Labo a appris de toi, sa source, son nombre de cas, et **à quoi ça sert** | `lab-experiments.ts` |

## 2. Règles

### R1 — Aucun chiffre ne sort d'ailleurs que d'un calcul testé

Le prototype affichait « 10 km −25 s » : ce chiffre venait d'un coefficient inventé. **Il n'est pas
livré.** L'écran n'affiche que ce qu'un moteur déjà recetté produit :

| Chiffre affiché | D'où il vient |
|---|---|
| Projection de force à 8 semaines | `projectSbd` + `projectWhatIf` (DASH-01 « Et si… », MUSCPWR-01) |
| Ratio de charge aigu/chronique | `computeAcwr` (META-19) |
| Cible calorique et variation de poids | `objectiveCalorieDelta` + TDEE du profil |
| Protéines (g/jour, g/kg) | `PROTEIN_TARGETS_G_PER_KG` (MN-06) |
| Fourchette de glucides | `CARB_TARGETS_G_PER_KG` + `computeCarbLoadLevel` (FUEL-01) |
| Garde-fous | `computeOvertrainingGuard` (GARDE-01), `computeDeficitVolumeAlert` (MN-02), `findSessionConflicts` (COLLIS-01) |

**Aucune projection d'allure ni de chrono n'est affichée**, et l'écran le dit en toutes lettres
(`lab.composer.honest`) : aucun calcul validé de l'app ne relie une dose à un temps de course.

### R2 — Le Labo part du réel, jamais d'un exemple

L'onglet Semaine lit la semaine **en cours** (lundi → dimanche) : séances planifiées et faites,
kilomètres, protéines par kilo des jours saisis, nuits notées. Un jour sans donnée est un **trou**,
jamais un zéro — même règle que le journal de bien-être.

### R3 — Chaque proposition porte son chiffre et un geste

Sept familles, dans cet ordre de priorité (les garde-fous ne sont jamais masqués ni relégués) :
`overtraining`, `loadRisk`, `deficitVolume`, `collision`, `shortNight`, `protein`, `carbs`.
Au plus **5** propositions affichées (`LAB_MAX_PROPOSALS`) : au-delà, la liste cesse d'être une liste
de choses à faire.

### R4 — Rien ne s'écrit sans la feuille « ce qui change dans ton plan »

C'est la règle qui décide de la confiance dans cet écran. Un appui sur une proposition la met
**« prête »** ; la feuille montre **ce qui change, dans quel pilier, et sur quels écrans ça se
verra** ; seule sa validation écrit. Une proposition qui **n'écrit rien** (elle ouvre un écran) part
au contraire tout de suite : lui imposer une feuille de confirmation apprendrait à confirmer sans
lire.

Trois écritures possibles, toutes déjà existantes :
- `reschedulePlannedSession` — déplacer une séance (collision) ;
- `applyAdaptationForToday` — alléger la séance du jour de 25 % de répétitions (`REPS_REDUCTION_PCT`,
  CARDIO-UX01), **aujourd'hui seulement** ;
- `upsertRunnerProfile` / `upsertNutritionProfile` — les leviers de l'onglet Composer.

### R5 — Le Labo ne règle que ce qui a un réglage

`LAB_WRITABLE_LEVERS = ['runningFrequency', 'proteinGPerKg', 'objective']`. Les **séances de
musculation** se dosent dans le composeur (pour en voir l'effet) mais **ne s'écrivent pas** : elles
viennent du programme, et les écrire ici les ferait diverger en silence de la séance réellement
proposée chaque jour. L'écran le dit (`lab.composer.notWritable`).

La cible de protéines est stockée en **grammes par jour** : sans poids connu, elle n'est **pas**
écrite — convertir des g/kg sans poids reviendrait à inventer le poids.

### R6 — Une association n'est pas une preuve, et l'expérience est scellée

L'onglet « Pourquoi ? » classe des suspects par écart mesuré sur les **21 derniers jours** contre les
21 précédents (`LAB_WINDOW_DAYS`). Il l'écrit : « des associations trouvées dans tes données, pas des
preuves ».

Une **expérience** dure 4 semaines, dont l'ordre (`test` / `usual`) est **tiré au sort à l'écriture,
une seule fois**, et enregistré. Trois statuts, et ils ne disent pas la même chose : `running` (les
semaines courent), `finished` (elles sont passées, le verdict est rendu), `stopped` (arrêtée en
route, pas de verdict). 🔴 **`finished` est écrit par l'app**, alors que la fin est calculable par
date : c'est l'index unique de la base (`where status = 'running'`) qui a besoin de le savoir, sans
quoi une expérience terminée garderait son modèle réservé **à vie**. Son verdict reste **scellé** jusqu'à la fin : voir un résultat
partiel changerait le comportement pendant la mesure. L'adhérence est mesurée **sans saisie
supplémentaire** (jambes la veille, glucides des jours durs, nuits de la semaine).

⚠️ **Aucune expérience sur les calories.** Quand le poids stagne, le Labo propose de **mesurer**
(saisir aussi les week-ends) — jamais de restreindre.

### R7 — Le sommeil est saisi, pas capté

Health Connect « sommeil » avait été écarté (une déclaration Play de plus, pour une donnée que peu de
gens mesurent la nuit). La nuit est donc une **note facultative dans le check-in de bien-être**
(BIEN-01) : une colonne `sleep_minutes` nullable, un pas d'un quart d'heure, bornée à 14 h. Le premier
appui sur « + » pose **7 h** — monter de 0 à 7 h par quarts d'heure demanderait 28 appuis, et la
feuille ne serait jamais remplie. **Aucun changement de déclaration Play Store.**

### R7 bis — Rien ne s'écrit avant que la migration soit sur le cloud

`LAB_WRITE_READY` (patron `ADAPTATION_WRITE_READY` de CARDIO-UX01) vaut `false` tant que les deux
migrations ne sont pas poussées : le champ « Nuit » n'est pas rendu et aucune expérience ne peut
être lancée. Ce n'est pas de la prudence décorative — écrire une colonne que le serveur ne connaît
pas met en file une opération que le cloud **rejette**, et PowerSync **sérialise** la file : c'est
la remontée de **toutes** les tables qui se fige. Le risque est ici plus large que le Labo, la note
de nuit vivant dans le check-in de bien-être, un écran **partagé**.

✅ **Levé le 16/09/2026**, dans le même geste que le push des deux migrations et le déploiement de
la sync rule.

### R7 ter — Le moteur de la scène est du JavaScript, mais il reste linté

Le moteur est porté du prototype en ES5, d'où un `eslint-disable` — mais **ciblé sur `no-var` seul**.
Une désactivation **globale** y a coûté cher le 16/09 : `pillarsOn`, introduit au portage sans
déclaration, levait un `ReferenceError` au premier tour de la boucle d'animation et tuait la scène,
sans message. `no-undef` l'aurait signalé immédiatement. La leçon : un fichier « porté à
l'identique » cesse de l'être dès qu'on y ajoute de la logique, et c'est précisément là que les
garde-fous servent.

### R8 — La 3D ne doit jamais bloquer l'écran

La scène décide elle-même de son repli : si WebGL manque, si le contexte est perdu ou si la
bibliothèque échoue, elle dit `ok: false` et l'écran bascule sur les **mêmes disques en 2D**
(`react-native-svg`).

🔴 **Et le silence compte comme un échec** (ajouté le 16/09, après le premier APK). Ces trois cas ont
un point commun : la scène **parle**. Le cas où elle ne dit rien — WebView qui ne monte pas, bundle
DOM introuvable, canvas de taille nulle sur lequel WebGL tourne très bien — laissait le statut
optimiste et la zone vide **indéfiniment**, sans même le message de repli. Deux filets : la page
revérifie la taille de son canvas 800 ms après création, et `LabStage` replie en 2D si aucun statut
n'arrive en 5 s. Elle est de **hauteur fixe** : une WebView imbriquée dans une liste qui défile
se dispute les gestes avec elle, et c'est l'utilisateur qui perd. **Mouvement réduit** respecté : les
transitions deviennent instantanées.

### R9 — Piliers désactivés, décision H

Un pilier non activé n'a ni disque allumé, ni levier, ni proposition. L'onglet du Labo suit la même
règle que les autres : il n'apparaît que si au moins un pilier est actif.

### R10 — Offline-first et i18n

Tout est lu depuis SQLite local et écrit par les repositories (UUID client, soft delete, sync
PowerSync). Toutes les chaînes sont dans `lab.*` (FR + EN) ; aucun texte en dur, y compris ceux
dessinés **dans** la scène 3D (`setLabels`).

## 3. Données

### Migration `20260915151307_labo01_sommeil_et_experiences.sql`
- `daily_wellbeing.sleep_minutes smallint` (`check 0..840`), nullable ;
- table `lab_experiments` (`kind` contraint aux 3 modèles, `start_date`, `schedule jsonb`,
  `status`), RLS par `user_id`, soft delete, **index unique partiel** : une seule expérience en
  cours par modèle.

### Migration `20260915151316_labo01_lab_experiments_publication.sql`
Ajoute `lab_experiments` à la publication `powersync`.

✅ **Sync rules déployées le 16/09/2026** :
[powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml) collé dans le dashboard
PowerSync (table neuve — sans ce geste, une expérience lancée n'aurait pas survécu à une resynchro). `daily_wellbeing` est lue en `select *` : **rien à changer** pour
la colonne de sommeil.

## 4. Écrans et navigation

- Onglet **Labo** (icône `aperture`), accent `pillarLab` (`#7a5714` clair / `#e0b155` sombre), scène
  `LAB` dans `theme/stage.ts`, halo d'accent et réglage de menu comme les autres piliers.
- La scène 3D est un **composant DOM Expo** (`'use dom'`) — voir
  [ADR-008](../../../adr/ADR-008-scene-3d-composant-dom.md).
- Depuis les propositions : `/planning`, `/nutrition`, `/nutrition-profile`, `/nutrition-stats`.

## 4 bis. Constats de revue laissés ouverts

La revue de code d'avant commit a sorti 3 bloquants et 8 importants ; les bloquants et cinq
importants sont corrigés (détail au [CHANGELOG](../../../../CHANGELOG.md)). Restent, à traiter
après la recette :

1. 🔴 **Un acquis peut se désapprendre.** Le verdict d'une expérience est recalculé à chaque rendu
   depuis une fenêtre **glissante** de 56 jours ; une expérience en dure 28, donc 28 jours après son
   verdict ses premières semaines sortent de la fenêtre et « vérifié » redevient « pas assez de
   mesures ». Le corriger demande de **figer le verdict à la clôture** — ça touche le modèle.
2. `useLabHistory()` est monté **deux fois** (questions + acquis) : ~24 abonnements SQL live au lieu
   de ~12, sur l'écran qui porte aussi la WebView.
3. Sans protéines saisies, l'assiette de la scène est servie **à 100 %** : « aucune donnée » et
   « cible atteinte » donnent la même image.
4. L'allègement du Labo **écrase** un ralentissement d'allure déjà posé par CARDIO-UX01, sans que la
   feuille l'annonce.
5. La famille `loadRisk` est **morte pour un mono-pilier** : sa source n'émet un ratio que si muscu
   **et** course sont actifs, alors que R3 la présente comme générale.

## 5. Ce que l'US ne livre pas

- Pas de projection d'allure ni de chrono (R1).
- Pas de « Croiser » libre (poser deux leviers face à face au choix) : l'onglet « Pourquoi ? » couvre
  le besoin en partant d'une question réelle plutôt que d'un tableau vide.
- Pas de bilan de cycle, pas de partage, pas de widget d'accueil.
- Pas d'écriture des séances de musculation (R5).

## 6. Critères de recette

Ils vivent dans [RECETTES.md](../../../../RECETTES.md) — la recette sur device est la seule étape
qu'un agent ne peut pas franchir.
