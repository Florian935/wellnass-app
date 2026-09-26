---
id: NUTRI-UX03
titre: "Hub Nutrition en trois onglets — Aujourd'hui, Historique, Progrès"
roadmap: [4.47]
catalogue: []
etape: recette
branche: feature/nutri-ux03-hub-onglets
maj: 26/09/2026
---

# US NUTRI-UX03 — Hub Nutrition en trois onglets

> Suite directe de MUSCU-UX07 (25/09/2026) : Florian veut « le même travail sur le pilier
> Nutrition : plus intuitif, plus logique, avec des onglets cohérents avec ceux de la muscu ».
>
> - Exploration : toile **Nutrition — le hub en onglets**
>   (https://claude.ai/artifact/2nD3MciUjRVAxQX6ud5D3i) — le hub actuel et trois variantes (A, B, C)
>   sur les mêmes données, prototype jouable et compte rendu. Versée dans
>   [design/nutri-ux03-hub-onglets/](../../../../design/nutri-ux03-hub-onglets/).
> - **Variante B choisie par Florian le 25/09/2026** (« clairement B, direct »), avec ses réponses aux
>   questions Q1 à Q8 (§2).
> - Plan : [docs/plans/nutri-ux03-hub-onglets.md](../../../plans/nutri-ux03-hub-onglets.md).
> - ⚠️ **Lot en une vague, sur décision de Florian** (« tu peux tout faire d'une seule vague et tu me
>   dis quand tu as tout terminé ») : spec, plan, maquette et code sont livrés ensemble, sans arrêt à
>   l'étape de validation. Ses réponses du 25/09 valent validation du fond ; la recette sert de filet
>   (§10, RECETTES §88).
> - Travaillée **en parallèle de CARDIO-UX03** (hub Course), dans un worktree dédié. Aucun fichier de
>   la muscu ni de la course n'est modifié : les briques génériques sont dupliquées côté Nutrition et
>   la factorisation est notée au §11.

## 1. Le problème

Quelqu'un qui note ce qu'il mange ouvre le pilier avec l'une de ces questions :

| Question | Fréquence | Réponse du hub avant cette US |
|---|---|---|
| « Je note ce que je viens de manger » | 3 à 6 fois par jour | bien servie : « Chercher un aliment », 3 aliments récents en un geste, + par repas, scan |
| « Il me reste combien ? » | à chaque repas | bien servie : le grand chiffre dit le restant, les tiges P/G/L leurs grammes |
| « Je reprends mon petit-déj habituel, le déjeuner d'hier » | chaque jour | **caché** (constats a et b) |
| « Qu'ai-je mangé hier, mardi ? » | plusieurs fois par semaine | à moitié : un geste, mais tout l'écran bascule sur ce jour (constat c) ; un jour à la fois |
| « J'ai oublié de noter dimanche » | 1 à 2 fois par semaine | bien servie : la trame et sa ligne « dimanche n'a rien de saisi » |
| « Qu'ai-je prévu ce soir ? » | chaque jour, pour qui planifie | **mal servie** (constat d) |
| « Je tiens mon objectif sur la semaine ? » | 1 à 2 fois par semaine | bien servie : l'onglet La semaine, mais ses onglets sont sous la scène, à mi-écran |
| « Mon poids suit ? » | chaque semaine | à moitié : une carte dans La semaine, mais « Me peser » ouvre la mauvaise vue (constat e) |

**Contrairement à la muscu, le haut du hub était juste** : le geste et « il me reste » y étaient déjà.
Ce qui clochait, c'est tout ce qui touche au passé — reprendre, relire, retrouver —, caché ou mêlé à
la saisie, un jour à la fois.

### Ce que dit le code (vérifié le 25/09/2026)

- **a.** « Copier d'hier » vit dans le menu ⋯ d'un repas, et ce menu n'existe **que sur un repas
  rempli** (`MealSection`, mode dense : un repas vide rend une simple ligne « + Ajouter »). Sur un
  repas vide — là où il servirait — il est introuvable ; sur un repas rempli, il le **double**.
- **b.** Un repas type est enregistré **sous le nom du repas** (`saveMealAsTemplate(mealLabel, …)`) :
  deux déjeuners enregistrés s'appellent tous deux « Déjeuner ». Les habitudes de la feuille d'ajout
  (`useHabitFoods`) ne remontent que des aliments : un repas type ne se retrouve qu'en tapant son nom.
- **c.** Consulter un jour passé (flèches, verre de la trame, calendrier) fait basculer **tout** le
  hub : le grand chiffre repasse au consommé (« sur N kcal visées »), les ajouts rapides et la carte
  de décision disparaissent, et « Chercher un aliment » **comme le scan** écrivent sur ce jour-là
  (`AddFoodSheet date={day}`, `food-scan` avec `date: day`). La pastille « Revenir à aujourd'hui »
  (NUTRI-UX02 R20) existe précisément parce que ce mélange égarait.
- **d.** La carte Planning repas est en bas de l'onglet, sous l'énergie, les micros et la qualité ; les
  repas prévus du jour n'apparaissent nulle part dans le journal. `useDayMealPlan` existe mais
  **n'est appelé par aucun écran** (le planning lit `useWeekMealPlan`).
- **e.** « Me peser » (action rapide de l'accueil, carte du moment, carte Poids) ouvre
  `/nutrition-stats`, qui démarre sur l'onglet **Régularité** ; la pesée est dans l'onglet Poids.

## 2. Les décisions de Florian (25/09/2026)

| # | Question posée | Décision |
|---|---|---|
| Q1 | A, B ou C ? | **B** : Aujourd'hui · Historique · Progrès. |
| Q2 | Retirer la navigation par jour de l'écran de saisie ? | **Oui**, mais le calendrier d'Historique doit montrer, **comme les anciens verres**, si l'on était loin de la cible ou pas (D9). |
| Q3 | Planning en icône + repas prévus dans « Ta journée », carte du bas retirée ? | **Oui.** On peut toujours ajouter d'autres aliments à la main à côté des repas prévus (D7). |
| Q4 | Les repas habituels dans cette US ? | **Oui** (D10). |
| Q5 | Revenir sur Aujourd'hui au changement de jour ? | **Non** : on reste sur l'onglet choisi. On change de jour par le calendrier et la liste d'Historique (D3, D11). |
| Q6 | Nom d'un repas type proposé à partir de ses aliments ? | **Non** : l'utilisateur le saisit, **obligatoirement** (D6). |
| Q7 | Titre de l'en-tête ? | **« Alimentation »**. |
| Q8 | Accueil inchangé, sauf « Me peser » vers Stats › Poids ? | **Oui** (D13). |

## 3. Les décisions de conception

- **D1 — Trois onglets, libellés communs aux piliers.** Aujourd'hui · Historique · Progrès.
  « Historique » et « Progrès » sont les mots de la muscu (MUSCU-UX07) et de la course (CARDIO-UX03).
- **D2 — Les onglets sont dans l'en-tête et défilent avec la page**, comme la muscu : pas de bandeau
  collé en haut (retiré sur les quatre piliers le 23/09). **Un nouvel appui sur l'onglet Alim de la
  barre du bas ramène en haut du hub** (`useScrollToTop`), sans changer d'onglet.
- **D3 — L'onglet affiché** : un paramètre de route `section` (lu **une fois**, puis effacé), sinon le
  dernier onglet choisi pendant la vie de l'app (store en mémoire, non persisté), sinon Aujourd'hui.
  **Rien ne change d'onglet de force**, pas même au changement de jour (Q5).
  - NUTRI-UX02 R3.2 (« l'onglet n'est pas persisté : l'app s'ouvre sur saisir ») est **tenue** :
    relancer l'app rouvre Aujourd'hui. Ce qui change : revenir sur Alim depuis un autre pilier rouvre
    le dernier onglet choisi, comme la muscu.
- **D4 — Aujourd'hui est toujours aujourd'hui (Q2).** La navigation par jour quitte l'écran de
  saisie : plus de flèches ◀ ▶, plus de trame des 7 verres, plus de calendrier en feuille, plus de
  pastille « Revenir à aujourd'hui ». On ne peut plus noter par mégarde sur un autre jour.
  - ⚠️ **Renverse** NUTRI-UX01 R3.1 (calendrier ouvert depuis le libellé du jour) et R3.2 (trame de la
    semaine dans la barre du jour), et retire du hub la trame de DASH-01. Leur **fonction** est
    reprise, ailleurs : le calendrier et le remplissage par jour vivent dans Historique (D9), la
    ligne « dimanche 20 n'a rien de noté » reste en tête d'Aujourd'hui et ouvre ce jour-là.
  - NUTRI-UX02 R20 (« Revenir à aujourd'hui ») devient sans objet : il n'y a plus d'autre jour à
    quitter.
- **D5 — « Reprendre » à un geste de la saisie.** En tête d'Aujourd'hui, pour le repas de l'heure
  (`mealForHour`), les trois derniers repas **différents** de ce type, avec un bouton Reprendre
  chacun (R3). C'est l'équivalent de « Refaire une séance » de la muscu.
  **« Comme hier »** s'affiche sur chaque repas **vide** dont la veille a un repas du même nom (R4).
  Le menu ⋯ d'un repas ne garde qu'« Enregistrer comme repas type » : « Copier d'hier » en sort,
  puisqu'il n'y doublait qu'un repas déjà rempli (constat a).
- **D6 — Un repas type porte le nom que l'utilisateur lui donne (Q6).** « Enregistrer comme repas
  type » ouvre une feuille avec un champ **obligatoire** ; « Enregistrer » reste inactif tant qu'il
  est vide.
- **D7 — Les repas prévus du jour vivent dans « Ta journée » (Q3).** Chaque entrée du planning non
  encore portée au journal apparaît sous son repas, « Prévu au planning », avec **« J'ai mangé ça »**
  (`consumePlannedEntry`, inchangée). L'ajout manuel reste là, à côté : le + du repas, la feuille,
  les ajouts rapides.
  - ⚠️ **Renverse** l'arbitrage du 04/08/2026 (REPAS-01, point P1 : « rangé dans un sous-menu, il ne
    serait jamais adopté ») : la carte Planning du bas de l'onglet disparaît, le planning passe en
    **icône d'en-tête**. La compensation est ce qui manquait à la carte : le planning se montre là
    où l'on mange, le jour où il sert.
- **D8 — L'en-tête (Q7).** « Alimentation », puis trois icônes : **Planning repas**, **Bibliothèque**
  (feuille : Recettes, Repas types, Favoris, Repas de la journée) et **Objectif et réglages** (profil
  nutritionnel). Sur l'onglet Aujourd'hui, le remplissage suit (restant, tiges P/G/L, ajouts
  rapides, « Chercher un aliment »), et **Scanner** passe à côté de « Chercher un aliment ». L'icône
  Statistiques quitte l'en-tête : le lien vit en bas de Progrès, comme sur La semaine.
  « Gérer les repas » (bas de l'onglet) rejoint la Bibliothèque.
- **D9 — Le calendrier d'Historique montre le remplissage de chaque jour (Q2).** Chaque jour passé
  est un petit **verre**, rempli à hauteur de ce qui a été mangé **par rapport à la cible de ce
  jour** (cible effective, bonus de séance compris), plein à 100 %. Le statut se lit aussi sans la
  couleur : « + » au-dessus de la cible, « − » en dessous, rien dans la marge (R7). Un jour sans
  rien de noté est en pointillé.
  - **Une seule source de cible** pour le calendrier, la liste des jours et la page d'un jour :
    `useDailyCalorieTargets`, celle de l'adhérence (NUTR-10). Elle compte les séances et courses
    terminées ; elle ne compte **pas** les « autres activités » (AUTRE-01), que le remplissage
    d'aujourd'hui (`useDayCalorieTarget`) compte. La case d'aujourd'hui peut donc différer
    légèrement du remplissage du hub : c'est l'écart existant entre ces deux hooks, pas un effet de
    cette US.
- **D10 — Les repas habituels (Q4).** Un repas habituel, ce sont **les mêmes aliments** notés au
  moins deux fois dans le même repas, sur les 60 derniers jours. Il se reprend avec les quantités de
  la dernière fois (R9).
- **D11 — Chaque jour passé a sa page (Q5).** On y arrive depuis le calendrier, la liste des jours,
  la ligne « … n'a rien de noté » et les lignes de « Reprendre ». On y **complète un oubli** (le +
  de chaque repas), on **reprend un repas** ou **toute la journée** sur aujourd'hui, et on passe au
  jour précédent ou suivant par des flèches.
- **D12 — Progrès = La semaine, renommée.** Contenu inchangé (NUTRI-UX02 R3.3 à R3.5, R16 à R21, et
  R24 : le tableau 8 semaines `TrainingNutritionCrossCard` reste **hors** de l'onglet) : le verdict,
  puis protéines par kilo, poids, régularité, et « Toutes tes statistiques ». Un compte sans aucun
  repas noté **ni aucune pesée** voit un seul message et « Noter un repas » ; une pesée suffit à
  montrer les cartes (l'objectif de poids a alors quelque chose à dire).
- **D13 — « Me peser » ouvre Stats › Poids (Q8).** `/nutrition-stats` accepte un paramètre `tab` ;
  les trois portes de pesée de l'accueil le passent, ainsi que « Voir la courbe de poids » des
  mensurations (`measurements.tsx`) et du bien-être (`wellbeing.tsx`), qui avaient le même défaut. L'accueil ne change pas autrement.
- **D14 — Aucune ancienne route à rediriger.** Aucun écran n'est retiré : `/nutrition-stats` reste le
  détail des analyses (comme `/progress` pour la muscu). Une route s'ajoute : `/nutrition-day`.
  Les **liens entrants faits pour noter un repas** passent `section=today`, sinon la mémoire de D3
  les ferait atterrir sur Historique ou Progrès : la suggestion d'aliment du Labo
  (`lab.tsx`, `foodSuggestion`), la carte d'activation de l'accueil (`ActivationPathCard`) et la
  fin de l'onboarding.
- **D15 — Ce que le hub perd, et où c'est passé.**
  - La navigation par jour (flèches, trame, calendrier en feuille) → Historique et la page d'un jour.
  - La carte Planning repas → l'icône d'en-tête, et les repas prévus du jour dans « Ta journée ».
  - « Gérer les repas » → la Bibliothèque.
  - L'icône Statistiques → le lien en bas de Progrès.
  - « Copier d'hier » dans le ⋯ → « Comme hier » sur le repas vide.
  - Les micronutriments, la qualité et l'énergie **d'un jour passé** → la page de ce jour (§4.5) :
    rien de ce que le hub montrait pour un jour passé ne se perd.
  - Code sans appelant, supprimé : `DayCalendarSheet`, `NutritionStage` (et son test, remplacés par
    l'en-tête et le remplissage) ; les clés i18n qu'ils étaient seuls à lire.

## 4. Le nouvel écran

### 4.1 L'en-tête

Bandeau vert du pilier (`stageTheme('nutrition')`), coins bas arrondis, coulée sous la page
(`StageScrollView`) :
- ligne 1 : « Alimentation », puis les icônes Planning repas, Bibliothèque, Objectif et réglages ;
- ligne 2 : le sélecteur **Aujourd'hui · Historique · Progrès** ; segment actif plein (blanc, texte
  vert), les autres sur verre ;
- sur Aujourd'hui seulement : le **remplissage** (§4.2-1), avec le niveau qui monte derrière le
  texte. Sur Historique et Progrès, l'en-tête reste compact.

### 4.2 Aujourd'hui

1. **Le remplissage**, dans l'en-tête, repris de la scène (NUTRI-UX02 R10, R11) :
   - l'en-tête « AUJOURD'HUI · VEN. 25 SEPT. » (non interactif) ;
   - la ligne « dimanche 20 n'a rien de saisi — … » (si un des 6 jours précédents est vide) → la page
     de ce jour ;
   - le grand chiffre (restant, sinon consommé), le statut, la sous-ligne de détail, « Pourquoi ? » ;
   - les tiges P/G/L avec leurs grammes et leur cible ;
   - les trois ajouts rapides (aliments récents, portion de référence, repas de l'heure) ;
   - **« Chercher un aliment »** (feuille d'ajout, repas de l'heure) et, à côté, **Scanner**.
2. **Reprendre un {repas de l'heure}** (R3) — masqué dès que ce repas a une entrée aujourd'hui.
3. La carte de décision (NUTR-F2) et le Réservoir (RESERV-01), **inchangés**.
4. **Ta journée** : les repas en sections (NUTRI-UX02 R4), avec :
   - « Comme hier » sur un repas vide (R4) ;
   - les repas prévus du jour, « J'ai mangé ça » (R6) ;
   - la section « Autres » (entrées orphelines, sans ajout) ;
   - « Copier toute la journée d'hier » au pied, quand la journée est vide et que la veille ne l'est
     pas ;
   - l'eau, en une ligne.

   **Sur une journée vide, les repas s'affichent** (chacun « + Ajouter », avec « Comme hier » si la
   veille l'a), et l'en-tête « Ta journée » n'a pas de compteur. ⚠️ **Renverse** le choix de
   NUTRI-UX01 (4.18) de masquer les repas d'une journée vide derrière un état plein : ce choix
   datait d'avant « Comme hier » et les repas prévus, qui ont besoin des lignes de repas.
   L'état vide « Journée encore vide » ne reste que quand il n'y a **rien à proposer** : aucune
   entrée aujourd'hui, aucune la veille, aucun repas prévu non porté. Il garde « + Ajouter un
   aliment » **et la ligne d'eau** (on boit avant de manger) ; son bouton « Copier toute la
   journée d'hier » disparaît, il n'y avait rien à copier.
5. L'énergie repliée, les micronutriments suivis, les repères de qualité : **inchangés**.

Retirés de l'onglet : la carte Planning repas et le lien « Gérer les repas » (D7, D8).

### 4.3 Historique

1. **Le calendrier du mois** (D9) :
   - grille lundi → dimanche en jours locaux ; les jours des mois voisins sont vides ;
   - titre du mois, flèches mois précédent / suivant, bornées (R7) ;
   - résumé : « 21 jours notés · 2 305 kcal en moyenne », puis « dans ta cible : 14 · au-dessus : 3 ·
     en dessous : 4 » ;
   - légende : dans ta cible · hors cible · rien de noté ;
   - aujourd'hui cerclé ; appui sur un jour passé → sa page ; sur aujourd'hui → l'onglet Aujourd'hui.
2. **Jours · Repas habituels** (sélecteur) :
   - **Jours** : les jours du mois affiché, du plus récent au plus ancien (R8) ;
   - **Repas habituels** : un sélecteur de repas, puis les compositions habituelles de ce repas,
     chacune avec Reprendre (R9).
3. L'état d'Historique (mois affiché, sous-onglet, repas choisi) est gardé en mémoire le temps de
   la vie de l'app : revenir d'une page de jour, ou d'un autre onglet, retrouve la même vue.

### 4.4 Progrès

Dans l'ordre : le verdict de la semaine, Protéines par kilo (fenêtre 7 jours imposée), l'objectif de
poids, la régularité (7 jours), et « Toutes tes statistiques » → `/nutrition-stats`. Les cartes
gardent leur règle de silence. Compte sans aucune entrée : « Tes progrès démarrent à ton premier
repas noté », et « Noter un repas » → Aujourd'hui.

### 4.5 La page d'un jour (`/nutrition-day?date=AAAA-MM-JJ`)

- En-tête : retour, le jour en toutes lettres (« Jeudi 24 septembre »), flèches jour précédent /
  suivant (la flèche suivante s'arrête à la veille).
- Résumé : « 2 218 kcal · dans ta cible » (ou « 182 kcal en dessous de ta cible », « rien de noté ce
  jour-là »), puis P / G / L en grammes.
- **Le journal du jour**, avec les gestes d'Aujourd'hui : + par repas (feuille d'ajout **sur ce
  jour**, sans bandeau « il te reste »), appui → détail, balayage → modifier / supprimer,
  réaffectation, réordonnancement, ⋯ → « Enregistrer comme repas type » ; la section « Autres » ;
  l'eau de ce jour.
- Sur chaque repas rempli **configuré** : **« Aujourd'hui »** (reprendre ce repas sur aujourd'hui,
  R10). Pas sur « Autres » : la copie irait dans un repas qui n'existe plus.
- Sous le journal, ce que le hub montrait pour ce jour : l'énergie (repliée), les micronutriments
  suivis et les repères de qualité (D15).
- Collé en bas, si le jour a au moins une entrée dans un repas configuré : **« Reprendre toute la
  journée aujourd'hui »**, sous-titré « 4 repas · 2 218 kcal » (R10).
- Une date d'aujourd'hui ou future (lien forgé) renvoie sur l'onglet Aujourd'hui.

### 4.6 La Bibliothèque (feuille)

Recettes · Repas types · Favoris → le sélecteur plein (`/food-picker`) sur l'onglet correspondant ;
Repas de la journée → `/nutrition-meals`. Le sélecteur gagne un paramètre `tab` (`favorites`,
`recipes`, `templates`) pour s'ouvrir sur le bon onglet ; il reste un sélecteur (toucher un élément
l'ajoute au repas de l'heure, comme aujourd'hui). Les libellés sont ceux de ses onglets.

### 4.7 Accueil

Inchangé, sauf les trois portes « Me peser » (action rapide, carte du moment, carte Poids) qui
ouvrent Stats sur l'onglet **Poids** (D13).

## 5. Règles métier

- **R1.** Trois onglets, dans cet ordre, sélection selon D3. `resolveNutritionSection` (paramètre
  valide > mémoire > `today`).
- **R2.** Le remplissage ne porte que sur aujourd'hui : restant si la cible est connue et non
  atteinte, sinon consommé (« Objectif atteint », « N kcal au-dessus ») ; sans cible, « Aucun
  objectif calorique » et le lien de réglage (existant).
- **R3. Reprendre un repas.**
  - Le repas visé est `mealForHour(heure)`. S'il n'est pas dans la configuration des repas de
    l'utilisateur, le bloc est masqué.
  - Candidats : les **occurrences** de ce repas (entrées non supprimées d'un même jour et d'un même
    `meal_type`) sur les **60 jours précédant aujourd'hui** (aujourd'hui exclu).
  - Deux occurrences sont **le même repas** si elles ont le même **ensemble d'aliments** : `food_id`
    quand il existe, sinon le nom (minuscules, sans accents, espaces réduits). Les quantités et
    l'ordre ne comptent pas ; un aliment noté deux fois dans le même repas compte une fois.
  - Le bloc montre les **trois plus récentes occurrences distinctes**, de la plus récente à la plus
    ancienne. Chaque ligne : pavé date, les trois premiers aliments (« … » s'il y en a plus), les
    calories de cette occurrence, et « N fois en 2 mois » (occurrences du même repas dans la fenêtre)
    ou « une seule fois ».
  - Appui sur la ligne → la page de ce jour. **Reprendre** → `copyMeal(jour, repas, aujourd'hui)` :
    les entrées de cette occurrence, avec leurs quantités, leurs macros et leurs micros, sous
    verrou anti-double-appui.
  - Masqué dès que le repas visé a au moins une entrée aujourd'hui, ou s'il n'y a aucun candidat.
  - Pied : « Tous tes repas habituels » → Historique › Repas habituels, repas visé présélectionné
    (par le store de l'onglet, pas par un paramètre de route).
- **R4. Comme hier.** Sur un repas **vide** d'aujourd'hui, si la veille a au moins une entrée dans le
  repas de même clé : « Comme hier » → `copyMeal(hier, repas, aujourd'hui)`, sous verrou. Libellé
  TalkBack sans article (« Comme hier : Déjeuner, 635 kcal ») : le libellé d'un repas est un nom
  propre saisi par l'utilisateur (« Repas 5 », « Midi »), pas un nom commun.
- **R5. Repas type.** « Enregistrer comme repas type » ouvre une feuille : champ « Nom du repas
  type » vide, obligatoire, 60 caractères au plus ; « Enregistrer » inactif tant que le nom (sans
  espaces de bord) est vide. L'enregistrement garde les entrées du repas (`saveMealAsTemplate`,
  inchangée) et confirme avec le nom saisi.
- **R6. Repas prévus.** Les entrées du planning d'aujourd'hui (`useDayMealPlan`) dont `consumedAt`
  est nul s'affichent sous le repas de même clé, qu'il soit vide ou non, **même sur une journée
  vide** : « PRÉVU AU PLANNING », libellé, calories, **« J'ai mangé ça »** →
  `consumePlannedEntry(id)` (verrou). Une fois portée, l'entrée prévue disparaît de la ligne et ses
  aliments apparaissent dans le repas. Une entrée prévue dont le repas n'existe plus dans la
  configuration n'est pas montrée dans le journal (elle reste dans le planning). Le + du repas, la
  feuille et les ajouts rapides restent disponibles à côté (Q3).
- **R7. Le calendrier.**
  - Un jour est **noté** si son total dépasse 0 kcal (la règle de `weekLoggingConfidence`, qui
    pilote déjà la ligne « … n'a rien de saisi »). Même définition pour R8.
  - Son **remplissage** est `min(1, total / cible effective du jour)` ; sans cible calculable, un
    jour noté est dessiné à moitié plein, et la légende le dit (« sans cible »).
  - Son **statut**, trois cas qui s'excluent, jugés avec la marge de l'utilisateur
    (`adherenceMarginPct`, 10 % par défaut), exactement comme `computeGoalAdherence` : « dans ta
    cible » si l'écart est dans la marge (bornes incluses), sinon « au-dessus » (marqué « + ») ou
    « en dessous » (marqué « − »). Sans cible : noté, sans statut.
  - Aujourd'hui est cerclé et rempli à hauteur du moment, sans statut ; les jours futurs ne sont pas
    des boutons.
  - Navigation : du mois de la **première entrée** jusqu'au mois courant (`monthRange`) ; le mois
    courant seul sans aucune entrée. Mois affiché au départ : le mois courant.
  - Résumé : jours notés **avant aujourd'hui** (une journée en cours fausserait la moyenne, règle de
    NUTR-17), leur moyenne en kcal, et la répartition dans / au-dessus / en dessous sur les jours
    qui ont une cible. Mois sans jour noté : « Aucun jour noté ce mois-ci. »
- **R8. La liste des jours.** Les jours notés du mois affiché, **plus** les jours vides des 6 jours
  précédant aujourd'hui **qui tombent dans le mois affiché** (« Rien de noté · Compléter ce jour ») ;
  aujourd'hui en tête s'il est noté. Ligne : pavé date, total, pastille de statut (« dans ta
  cible », « +338 kcal », « −483 kcal », « en cours »), puis les deux premiers aliments de chaque
  repas, repas séparés par « · ». Appui → la page du jour (aujourd'hui → l'onglet Aujourd'hui).
- **R9. Repas habituels.**
  - Sélecteur des repas configurés ; au départ, le repas de l'heure (ou celui transmis par R3).
  - Liste : chaque ensemble d'aliments (R3) noté **au moins deux fois** dans ce repas sur les 60 jours
    précédant aujourd'hui, trié par nombre d'occurrences décroissant, puis par date de dernière
    occurrence ; dix au plus.
  - Ligne : tous les noms, « 467 kcal · 12 fois · dernière : hier » (calories de la dernière
    occurrence). **Reprendre** → `copyMeal(dernier jour, repas, aujourd'hui)`, **en plus** de ce que
    le repas d'aujourd'hui contient déjà, sans alerte ; le bouton passe à « Ajouté » pour cette
    ligne, sans changer d'onglet.
  - Rien d'habituel : « Tes repas habituels apparaîtront ici dès que tu auras noté deux fois le même
    repas. »
- **R10. La page d'un jour.**
  - « Aujourd'hui » sur un repas configuré → `copyMeal(jour, repas, aujourd'hui)`, en plus de ce
    que ce repas contient déjà aujourd'hui, sans alerte ; le bouton passe à « Ajouté ».
  - « Reprendre toute la journée aujourd'hui » : si aujourd'hui a déjà au moins une entrée, une
    alerte « Aujourd'hui n'est pas vide » propose Annuler / Ajouter ; puis `copyMeal` pour **chaque
    repas configuré** de ce jour (les entrées de « Autres » ne sont pas reprises : elles
    deviendraient orphelines aujourd'hui) et retour sur l'onglet Aujourd'hui.
  - Les écritures d'un jour passé (ajout, modification, suppression, eau) portent sur **ce** jour.
- **R11. Progrès** : D12. « Aucun repas noté » se lit par `MIN(log_date)` nul ; « aucune pesée »
  par l'absence de dernière pesée.
- **R12. Stats** : `tab` ∈ `regularity`, `intake`, `weight`, `quality` ; valeur absente ou inconnue →
  Régularité (inchangé). Sélecteur : `tab` ∈ `favorites`, `recipes`, `templates` ; sinon « Tous ».
- **R13. Accessibilité.**
  - Sélecteurs d'onglets (hub, Jours / Repas habituels) en `tablist` / `tab`, état sélectionné
    annoncé ; puces de repas avec leur état sélectionné.
  - Jours du calendrier nommés en entier (« jeudi 24 septembre : 2 218 kcal, dans ta cible ») ;
    flèches nommées. Le statut ne se lit pas qu'à la couleur (« + », « − », hauteur du verre).
  - Boutons Reprendre, Comme hier, J'ai mangé ça et Aujourd'hui nommés avec leur repas et leur date.
  - Cibles tactiles ≥ 44 px ; contrastes des jetons existants (tests-gardes).

## 6. Cas limites

| Cas | Comportement |
|---|---|
| Compte neuf | Aujourd'hui : état vide (+ Ajouter, eau), pas de Reprendre ; Historique : mois courant, aucun jour ; Progrès : un seul message |
| Journée vide, veille remplie | Reprendre (repas de l'heure) + « Comme hier » sur chaque repas + « Copier toute la journée d'hier » |
| Journée vide, veille vide, dîner prévu | Les repas s'affichent, le dîner porte sa ligne prévue et « J'ai mangé ça » |
| Repas de l'heure à la fois prévu, reprenable et « comme hier » | Les trois s'affichent : le bloc Reprendre en tête, la ligne prévue et « Comme hier » sur le repas ; chacun ajoute en plus |
| Repas de l'heure absent de la configuration (repas personnalisés) | Pas de bloc Reprendre ; « Comme hier » reste sur les repas configurés |
| Repas de l'heure déjà rempli | Pas de bloc Reprendre |
| Deux occurrences mêmes aliments, quantités différentes | Même repas ; Reprendre prend les quantités de l'occurrence choisie |
| Entrée en texte libre (sans `food_id`) | Identifiée par son nom normalisé |
| Repas prévu déjà porté au journal | Plus affiché dans « Ta journée » ; l'annulation se fait depuis le planning (existant). Supprimer les aliments portés ne fait pas revenir la ligne prévue (`consumed_at` reste posé, existant) |
| Repas prévu pour un repas supprimé de la configuration | Non affiché dans le journal, reste dans le planning |
| Reprendre (habituels, page d'un jour) sur un repas déjà rempli | Ajout en plus, sans alerte |
| Reprendre toute une journée sur un aujourd'hui entamé | Alerte, puis ajout **en plus** (rien n'est remplacé) |
| « Autres » sur la page d'un jour passé | Visible, modifiable, réaffectable ; ni « Aujourd'hui », ni reprise dans la journée entière |
| Jour sans cible calculable (profil incomplet) | Verre à moitié, sans statut ; résumé sans répartition |
| Jour avec un café à 0 kcal seulement | Non noté (R7) ; sa page montre l'entrée |
| Changement de mois (le 2 du mois) | Les jours vides récents du mois précédent n'apparaissent que dans la liste de ce mois-là |
| Journée à cheval sur un changement de fuseau | Jours locaux (`log_date`), comme partout |
| Date de page d'un jour ≥ aujourd'hui, ou illisible | Retour sur l'onglet Aujourd'hui |
| Double appui sur Reprendre, Comme hier, J'ai mangé ça | Une seule écriture (verrou) |
| Pilier nutrition désactivé | Onglet masqué (existant) |
| Langue anglaise | Mois, jours et libellés en anglais (Intl + i18n) ; nombres groupés selon la langue |
| Retour sur Alim depuis un autre pilier | Dernier onglet choisi ; relancer l'app → Aujourd'hui |
| Retour d'une page de jour, ou d'un autre onglet, vers Historique | Même mois, même sous-onglet, même repas choisi (store en mémoire) |
| Lien « noter un repas » (Labo, carte d'activation, fin d'onboarding) | Ouvre Aujourd'hui, quel que soit le dernier onglet choisi (D14) |

## 7. i18n — FR + EN

Toutes les chaînes nouvelles vont dans `fr.json` et `en.json` (test de parité existant), espace de
noms **`nutritionHub`**. Pluriels en `_one` / `_other` des deux côtés, un seul compteur par clé.
Les nombres passent par le formateur de la langue (séparateur de milliers), jamais bruts dans
l'interpolation (NUTRI-UX02 R17).

| Clé | FR | EN |
|---|---|---|
| `nutritionHub.title` | Alimentation | Nutrition |
| `nutritionHub.sections.today` / `.history` / `.progress` | Aujourd'hui / Historique / Progrès | Today / History / Progress |
| `nutritionHub.icons.planning` / `.library` / `.settings` | Planning repas / Bibliothèque / Objectif et réglages | Meal plan / Library / Target and settings |
| `nutritionHub.eyebrow` | Aujourd'hui · {{date}} | Today · {{date}} |
| `nutritionHub.repeat.title.<repas>` | Reprendre un petit-déjeuner / un déjeuner / un dîner / une collation | Repeat a breakfast / a lunch / a dinner / a snack |
| `nutritionHub.repeat.action` / `.done` | Reprendre / Ajouté | Repeat / Added |
| `nutritionHub.repeat.meta_one` / `_other` | {{kcal}} kcal · une seule fois / {{kcal}} kcal · {{count}} fois en 2 mois | {{kcal}} kcal · once / {{kcal}} kcal · {{count}} times in 2 months |
| `nutritionHub.repeat.a11y` | Reprendre : {{meal}} du {{date}} | Repeat: {{meal}} from {{date}} |
| `nutritionHub.repeat.openA11y` | Voir la journée du {{date}} | Open {{date}} |
| `nutritionHub.repeat.allHabits` | Tous tes repas habituels | All your usual meals |
| `nutritionHub.likeYesterday` / `.likeYesterdayA11y` | Comme hier / Comme hier : {{meal}}, {{kcal}} kcal | Same as yesterday / Same as yesterday: {{meal}}, {{kcal}} kcal |
| `nutritionHub.emptyDay.body` | Note ce que tu manges au fil de la journée. | Log what you eat as the day goes. |
| `nutritionHub.planned.eyebrow` / `.eat` | PRÉVU AU PLANNING / J'ai mangé ça | PLANNED / I ate this |
| `nutritionHub.planned.eatA11y` | J'ai mangé ça : {{name}}, {{meal}} | I ate this: {{name}}, {{meal}} |
| `nutritionHub.template.*` | Nommer ce repas type · Nom du repas type · Ex. : Petit-déj du matin · Tu le retrouveras sous ce nom dans la recherche. | Name this meal template · Template name · e.g. Morning breakfast · You'll find it under this name when searching. |
| `nutritionHub.library.*` | Ta bibliothèque, une ligne d'aide par entrée | Your library, one hint per row |
| `nutritionHub.calendar.*` | Mois précédent / suivant · `loggedDays_one` / `_other` ({{count}} jour noté / jours notés) · {{kcal}} kcal en moyenne · dans ta cible : {{inTarget}} · au-dessus : {{over}} · en dessous : {{under}} · Aucun jour noté ce mois-ci. · légende (dans ta cible, au-dessus, en dessous, sans cible, rien de noté) · statuts TalkBack | the same in English, `_one` / `_other` |
| `nutritionHub.historyTabs.days` / `.habits` | Jours / Repas habituels | Days / Usual meals |
| `nutritionHub.days.*` | dans ta cible · +{{kcal}} kcal · −{{kcal}} kcal · en cours · Rien de noté · Compléter ce jour · AUJ. | on target · +{{kcal}} kcal · −{{kcal}} kcal · in progress · Nothing logged · Fill in this day · TODAY |
| `nutritionHub.habits.meta_one` / `_other` | {{kcal}} kcal · {{count}} fois · dernière : {{date}} | {{kcal}} kcal · once / {{count}} times · last: {{date}} |
| `nutritionHub.habits.empty` / `.note` | message vide, définition | the same in English |
| `nutritionHub.habits.a11y` | Reprendre aujourd'hui, {{meal}} : {{name}} | Add to today, {{meal}}: {{name}} |
| `nutritionHub.day.redoMealA11y` / `.redoneA11y` | Reprendre aujourd'hui : {{meal}} du {{date}} / {{meal}} du {{date}} : ajouté à aujourd'hui | Add to today: {{meal}} from {{date}} / {{meal}} from {{date}}: added to today |
| `nutritionHub.day.*` | statuts du résumé · P {{p}} g · G {{g}} g · L {{l}} g · Aujourd'hui · Reprendre toute la journée aujourd'hui · `redoAllMeta_one` / `_other` ({{count}} repas · {{kcal}} kcal) · Aujourd'hui n'est pas vide · `confirmBody_one` / `_other` (Tu as déjà noté {{count}} aliment(s) aujourd'hui…) · Ajouter · Rien de noté ce jour-là… | the same in English, `_one` / `_other` |
| `nutritionHub.progressEmpty.*` | Tes progrès démarrent à ton premier repas noté. · Cible, protéines, poids, régularité : tout s'affichera ici au fil des jours. · Noter un repas | Your progress starts with your first logged meal. · … · Log a meal |

Réutilisées telles quelles : `stage.nutrition.*` (remplissage), `journal.*` (repas, détail, balayage,
réaffectation, `copyDayYesterday`, `prevDay` / `nextDay`, `emptyDay.title`), `scan.title`,
`nutrition.week.allStats`, `mealPlan.title`, `meals.manage`,
les libellés d'onglets du sélecteur (Favoris, Recettes, Repas types), `common.*`.

## 8. Comportement offline

- **Tout est local** : lectures PowerSync (SQLite) seulement, aucun appel réseau ajouté.
- **Lectures nouvelles** :
  - `useEntriesBetween(from, to)` : jour, repas, `food_id`, nom, kcal, ordre des entrées non
    supprimées d'une fenêtre — 60 jours pour R3 / R9, le mois affiché pour R8 ;
  - `useFirstLogDate()` sur `SELECT_FIRST_LOG_DATE` (jusqu'ici interne à `useJournalCompletion`) ;
  - réutilisées : `useDailyCalorieTargets` (calendrier, liste, page d'un jour), `useDayMealPlan`,
    `useLatestWeight`.
- **Écritures** : uniquement par les fonctions de dépôt existantes — `copyMeal`, `addFoodEntry`,
  `updateEntry`, `removeEntry`, `moveEntry`, `reassignEntryMeal`, `saveMealAsTemplate`,
  `consumePlannedEntry`, `addWater`. UUID client, horodatage UTC, soft delete déjà en place.
- **Aucune migration, aucune table, aucune sync rule** à redéployer.
- L'onglet sélectionné et l'état d'Historique (mois, sous-onglet, repas choisi) vivent dans un store
  Zustand en mémoire, ni persisté ni synchronisé.

## 9. Hors périmètre

- L'accueil, hors les trois portes « Me peser » (D13) et le lien de la carte d'activation (D14).
- La feuille d'ajout, le scanner, le planning repas : inchangés. L'écran Statistiques et le
  sélecteur plein ne gagnent qu'un paramètre `tab` (R12).
- Un écran de gestion des repas types (renommer, supprimer) : la Bibliothèque ouvre le sélecteur
  existant sur son onglet Repas types.
- Porter « J'ai mangé ça » sur un jour passé depuis sa page.
- Aligner `useDailyCalorieTargets` sur `useDayCalorieTarget` (autres activités, séance prévue du
  jour) : écart existant, noté au D9.
- Le « retour en haut » par nouvel appui sur l'onglet, pour la course (sa session le traite).
- La factorisation des briques d'onglets entre piliers (§11).

## 10. Critères de recette

Voir [RECETTES.md](../../../../RECETTES.md) §88. Sur le téléphone de recette, taille de police
système par défaut, thème clair puis sombre, en mode avion pour une passe.

## 11. Notes d'implémentation (26/09/2026)

Livrée en trois commits, poussés sur `dev` : cadrage (`1584e8dd`), socle (`20a4055a` — briques,
requêtes, et le journal sorti de l'écran sans changement visible), écrans. Écarts et précisions par
rapport au texte ci-dessus, pour la recette et la maintenance :

- **Le socle et l'extraction ont partagé un commit** (le plan en prévoyait deux) : l'extraction a été
  vérifiée à part, par les 151 tests du hub et des composants passés **sans modification**.
- **`app/(tabs)/nutrition.tsx`** : 1 533 → 421 lignes. Le journal vit dans
  `components/nutrition/journal/` (`DayJournal`, `MealSection`, `EntryDetailModal`,
  `TrackedMicrosRecap`), commun au hub et à la page d'un jour.
- **L'en-tête** (`NutritionHeader`) porte le remplissage en enfant sur Aujourd'hui, avec sa matière
  (`NutritionLevelMatter`). Le filet de cible reste à 38 % du haut : il passe sous les onglets.
- **Maquette et spec** : la toile ne marque que « + » sur les verres ; la spec (R7) et le code marquent
  aussi « − » en dessous, pour que le statut se lise sans la couleur (constat de la relecture).
- **La page d'un jour** a son propre en-tête (retour, jour précédent / suivant) et se déclare dans la
  pile (`_layout.tsx`, `headerShown: false`), comme le détail d'une séance. Elle appelle
  `useMenuFocus('nutrition')` : c'est le correctif que BACKLOG IDENT-01 demande pour les écrans empilés.
- **« Reprendre toute la journée »** appelle `copyMeal` repas par repas (repas configurés seulement) au
  lieu de `duplicateDay`, qui aurait recopié la section « Autres ».
- **Les « Ajouté »** de la page d'un jour sont gardés par jour (`jour:repas`) : changer de jour avec les
  flèches ne montre pas ceux d'un autre jour.
- **Nombres** : `useKcalFormat` groupe les milliers selon la langue (même source qu'`AnimatedNumber`).
- **Relecture du code (26/09), corrigé avant le commit des écrans** :
  - *Retour au hub* : la page d'un jour revient par `router.dismissTo('/(tabs)/nutrition?section=today')`
    (date invalide ou future, « Aujourd'hui », après « Reprendre toute la journée »). `navigate` et
    `replace` empilaient un second arbre d'onglets ; `dismissTo` revient à l'écran déjà dans la pile.
  - *La liste des jours* ne propose pas de « Compléter » avant le premier repas jamais noté
    (`historyListDayKeys` reçoit `firstLogDayKey`) : un compte neuf n'a aucune ligne vide.
  - *Une seule requête de 60 jours* : le hub la lit une fois et la passe à Historique (repas habituels),
    au lieu de deux requêtes surveillées identiques.
  - *« Ajouté »* des repas habituels est gardé par jour (`jour:repas:signature`) : après minuit, la
    nouvelle journée peut reprendre le même repas.
  - *Cibles tactiles* : « Comme hier », « Aujourd'hui » (page d'un jour) et les puces de repas
    atteignent 44 dp ; les fonds des feuilles sont masqués à TalkBack.
  - *Libellés TalkBack* : « J'ai mangé ça » nomme l'aliment **et** le repas (`planned.eatA11y`, qui
    remplace `mealPlan.entry.consumeA11y`) ; « Reprendre » d'un repas habituel nomme le repas ; un
    repas déjà repris annonce « ajouté à aujourd'hui » (`day.redoneA11y`).
  - *Écritures* : suppression, déplacement et réaffectation depuis le journal ont leur `.catch`, comme
    les copies.
  - *Portes « Me peser »* : un test couvre l'action rapide et la carte Poids de l'accueil
    (`weigh-in-links.test.tsx`), la carte du moment avait déjà le sien.
- **Supprimés** : `NutritionStage` (+ test, remplacé par `NutritionLevel.test.tsx`), `DayCalendarSheet`,
  et les clés qu'ils étaient seuls à lire : `journal.calendar.{title,previousMonth,nextMonth,legend,
  shortcuts,open}`, `journal.today`, `journal.copyYesterday`, `journal.nothingYesterday(Full)`,
  `journal.emptyDay.body`, `stage.nutrition.{backToToday,ofTarget}`, `nutrition.week.{tabToday,tabWeek}`,
  `mealPlan.hubTeaser`.
- **Non touché, signalé** : `WeekStrip.tsx` n'a plus d'appelant depuis avant cette US ; il lit encore
  `journal.calendar.dayA11y`, gardée pour lui. À retirer dans un lot de nettoyage. Les valeurs vides
  `coach.*.verdict.warmup` que signale `scripts/check-i18n-parity.mjs` existent sur `dev` avant cette
  US.

### Factorisation entre piliers — à faire quand muscu, course et nutrition auront atterri

Trois piliers ont désormais leur propre version des mêmes briques, sur décision (sessions
parallèles) :
- **l'onglet affiché** : `hub-section.ts` + `strength-section-store.ts` (muscu),
  `nutrition-section.ts` + `nutrition-section-store.ts` (nutrition), et l'équivalent course ;
- **l'en-tête à onglets** : `StrengthHeader` et `NutritionHeader` ;
- **le calendrier du mois** : `buildMonthGrid` (muscu, états séance/record/prévu) et
  `buildNutritionMonthGrid` (nutrition, remplissage/statut) partagent le squelette (cases vides,
  lundi en premier) ; `shiftMonth`, `compareMonths`, `monthRange` sont déjà **réutilisés tels
  quels** depuis `history-calendar.ts`.

Une US de factorisation pourra en tirer un `resolveSection(sections, …)` générique, un
`PillarTabsHeader` et un squelette de grille commun.
