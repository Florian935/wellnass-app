# Audit du pilier Nutrition — ergonomie, visuel, flux

> Analyse commandée par Florian le **09/09/2026**. Porte sur le **code réellement livré**
> (11 écrans, 8 composants, 4 repositories, la base d'aliments et les briques `shared`),
> confronté à la [spec fonctionnelle](../specs/functional/alimentation.md), à la
> [maquette de refonte du 30/07/2026](../../design/FitTrio%20-%20Nutrition.README.md),
> au [catalogue d'analyses](./analyses-donnees.md) et à l'[ADR-007](../adr/ADR-007-surfacage-analyses.md).
>
> **Aucune ligne de code n'a été modifiée.** Ce document est l'étape amont du
> [workflow obligatoire](../../CLAUDE.md#workflow-obligatoire-par-fonctionnalité) : il alimente les
> specs des US à ouvrir, une fois les arbitrages du §8 tranchés.

---

## 1. Verdict

Le pilier est **complet sur le papier et solide en dessous** : le calcul du TDEE, la mise à
l'échelle des quantités, les 33 micronutriments avec leurs VNR, l'apprentissage de l'heure de
rappel, le croisement avec l'entraînement — tout cela existe, est testé, et vaut mieux que ce
qu'on trouve dans la plupart des apps gratuites.

**Et il est aujourd'hui inutilisable au quotidien pour une raison unique et massive : la
bibliothèque compte 80 aliments.** Pas 3 200 (CIQUAL complet), pas 800 : quatre-vingts. Il n'y a
ni yaourt nature, ni œuf dur, ni steak haché, ni camembert, ni pâtes complètes. Un utilisateur
français tape dans le mur à son **deuxième repas**, et le seul repli est OpenFoodFacts —
c'est-à-dire le réseau, dans une app qui promet l'offline, et une base de **produits industriels**
qui ne remplace pas les aliments bruts.

Tout le reste de cet audit compte moins que ce chiffre. Une app de nutrition dont la base est vide
n'a pas un problème d'ergonomie, elle a un problème d'existence.

Vient ensuite un défaut d'une autre nature, et il est grave : **l'objectif calorique lui-même peut
être faux.** L'onboarding ne demande jamais le niveau d'activité, et le code retombe partout sur
« modérément actif » (×1,55). Pour un utilisateur réellement sédentaire (×1,2), l'objectif est
**surestimé de ~600 kcal par jour** — de quoi annuler tout un déficit de sèche, sans qu'aucun écran
ne le signale. Détail et chiffres en §3.2.

Troisième constat, moins visible mais structurant : **le pilier a été construit
fonction par fonction, jamais autour du geste.** Chaque fonctionnalité demandée est présente —
scan, texte libre, quick add, recettes, repas types, planning, liste de courses, micros, stats —
mais elles sont posées côte à côte, au même poids visuel, sans hiérarchie d'usage. Résultat : le
geste que l'utilisateur fera **cinq fois par jour, mille fois par an** (ajouter un aliment qu'il
mange déjà) coûte autant de taps que celui qu'il fera trois fois dans sa vie (créer une recette).

Quatrième constat, un différenciateur gâché : **les micronutriments sont désactivés par
défaut** (`tracked: []`). Vous avez 33 micros CIQUAL, les VNR européennes et des anneaux de
couverture — l'app est meilleure que MyFitnessPal gratuit sur ce terrain — et personne ne le verra,
parce qu'il faut aller cocher dans un mur de 33 pastilles au fond d'un écran de réglages.

Enfin, un écart de méthode à corriger : **la maquette validée du 30/07/2026 n'a pas été suivie sur
le point qu'elle avait précisément tranché.** Elle décidait « un sheet exposant les 3 modes
(Rechercher · Scanner · Texte libre) », argument écrit à l'appui. Le code livré présente 5 onglets
et 4 boutons de pied de page, soit **9 entrées plates**.

**Ce qui est bon et ne doit pas bouger** : la carte « Bilan du jour » (anneau + détail + badge
séance), la grille de micronutriments à couverture, la liste de courses par rayons, le
« copier hier » par repas, la brique d'heure apprise des rappels, le refus assumé de traiter le
dépassement calorique comme une faute.

---

## 2. Le geste quotidien, chiffré

Un utilisateur qui journalise sérieusement fait **4 à 6 ajouts par jour**. C'est la seule métrique
qui décide de la rétention du pilier. Voici ce que chaque parcours coûte aujourd'hui.

| Parcours | Fréquence réelle | Taps aujourd'hui | Cible | Où ça coince |
|---|---|:--:|:--:|---|
| Ajouter un aliment **déjà mangé cette semaine** | 🔥 plusieurs fois/jour | **6** + clavier | 3 | L'écran ouvre sur « Tous » (base alphabétique), pas sur les récents |
| Ajouter un aliment **nouveau** | 1×/jour | **6** + clavier | 4 | Recherche sans classement par pertinence ni tolérance aux fautes |
| **Scanner** un produit | 1×/jour | **6** | 2 | Le scan est au 4ᵉ niveau, derrière un bouton de pied de page |
| Répéter **le même petit-déj** qu'hier | ~1×/jour | **3** | 2 | ✅ Correct (menu ⋯ du repas → « Copier hier ») |
| Corriger une quantité | souvent | **4** | 3 | ✅ Acceptable |
| Saisir **un repas entier** au texte | occasionnel | **4** + rédaction | 4 | Les lignes non reconnues sont des culs-de-sac |
| Voir ses **micronutriments** | découverte | **5** + savoir que ça existe | 0 | Désactivé par défaut, caché derrière 33 pastilles |
| Consulter un jour **d'il y a 15 jours** | hebdo | **15** | 3 | Aucun calendrier — un tap par jour sur ◀ |
| **Planifier** un repas (1ʳᵉ fois) | découverte | **~20** | 4 | Le planning n'accepte ni aliment simple ni quick add |

Le tableau se lit en une phrase : **les gestes fréquents coûtent autant que les gestes rares.**

### 2.1 Où partent les taps du geste n°1

```
Journal ─┬─ scroll jusqu'au repas
         └─ tap « + Ajouter un aliment »
              ↓  (écran plein — le budget calorique disparaît de l'écran)
        Sélecteur ─┬─ onglet actif = « Tous » → 80 aliments par ordre alphabétique
                   ├─ tap dans le champ de recherche
                   ├─ frappe du nom
                   ├─ tap sur l'aliment
                   │    ↓
                   ├─ Panneau quantité ─┬─ tap chip de portion (écrase les grammes)
                   │                    └─ tap « Ajouter »
                   └─ tap « Terminé » sur la bannière de confirmation
```

Trois taps sur six ne produisent aucune information : **atteindre l'écran, y chercher ce que l'app
sait déjà, en sortir.**

---

## 3. Les six défauts structurants

Classés par impact sur la rétention, pas par coût de correction.

### 3.1 🔴 La bibliothèque est vide (80 aliments)

`supabase/migrations/20260714120000_seed_library_foods_ciqual.sql` — 80 lignes, réparties en
18 fruits · 17 légumes · 11 féculents · 7 viandes · 7 poissons · 6 laitiers · 6 autres ·
5 oléagineux · 3 boissons.

Conséquences en chaîne :

- l'utilisateur ne trouve pas, donc il passe par OpenFoodFacts (**réseau requis** — la promesse
  offline tombe au moment précis où elle compte), ou il crée un aliment perso à la main ;
- **50 des 80 aliments n'avaient aucune portion usuelle** jusqu'à la migration corrective du
  01/08/2026, et le symptôme relevé alors — toutes les suggestions sortaient à 200 g — dit bien
  que la maigreur de la base contamine les fonctions qui s'appuient dessus ;
- les analyses de qualité (diversité, couverture micro, score alimentaire) sont calculables mais
  n'auront jamais de matière.

Le chemin d'alimentation existe déjà : `apps/admin` a un **écran d'import CSV d'aliments**
(`FoodImportScreen`) et le générateur `supabase/scripts/enrich-ciqual/generate.py`. Ce n'est donc
**pas un chantier de développement, c'est un chantier de contenu** — et c'est le seul point de cet
audit qui bloque tout le reste.

### 3.2 🔴 Le chiffre central du pilier peut être faux, en silence

Ce défaut n'est pas ergonomique : il porte sur la **justesse** de l'objectif calorique, dont tout
le reste dépend — l'anneau, les macros, l'adhérence, le bilan hebdo, les analyses croisées.

**L'onboarding ne demande jamais le niveau d'activité.** Ses cinq étapes sont : intro → infos
(prénom, date de naissance, sexe, poids, taille) → objectif principal → piliers → niveau
d'affichage → récapitulatif. Aucune ne mentionne l'activité, et **aucun `nutrition_profile` n'est
créé** à la sortie de l'onboarding (0 appel à `upsertNutritionProfile` hors des deux écrans de
réglage).

Le code retombe donc partout sur la même valeur par défaut — `?? 'moderate'`, sur **six sites
d'appel** (`(tabs)/nutrition.tsx:122`, `meal-plan/index.tsx:112`, `nutrition-profile.tsx:71`,
`dashboard-repository.ts:419` et `:1468`, `home-widget-data.ts:246`). Or ce paramètre est le
multiplicateur du TDEE :

| Niveau | Facteur | TDEE d'un homme de 35 ans, 80 kg, 180 cm |
|---|:--:|--:|
| Sédentaire | ×1,2 | 2 106 kcal |
| Légèrement actif | ×1,375 | 2 413 kcal |
| **Modérément actif — le défaut appliqué** | **×1,55** | **2 720 kcal** |
| Très actif | ×1,725 | 3 028 kcal |
| Extrêmement actif | ×1,9 | 3 335 kcal |

Un utilisateur sédentaire se voit donc attribuer un objectif **surestimé de ~614 kcal par jour**
(469 kcal pour une femme de 30 ans, 62 kg, 165 cm). En sèche, cela suffit à **annuler tout le
déficit** : il mange à son maintien, ne perd rien, et rien dans l'app ne lui dit pourquoi. Le
symptôme sera « votre app ne marche pas », et il aura raison.

Deux aggravations :

- **rien ne signale que la valeur n'a pas été choisie.** L'écran de réglage affiche « Modérément
  actif » comme une sélection radio, exactement comme si l'utilisateur l'avait cochée ;
- **le seul correctif automatique ne couvre presque personne.** `useActivityLevelSuggestion`
  (RN-03) déduit un palier de la fréquence de course sur 14 jours — donc uniquement pour les
  coureurs, et seulement en suggestion sur l'écran Insights. Un pratiquant de musculation seul,
  ou un utilisateur nutrition-seule, ne verra jamais rien.

Le correctif est petit et sans risque : une **étape d'onboarding** (ou un premier passage obligé
dans le profil nutritionnel), et une **mention explicite** tant que la valeur est un défaut non
choisi. Il n'a pas sa place dans un arbitrage : c'est un bug de justesse.

### 3.3 🔴 L'ajout n'est pas conçu pour l'usage réel

Quatre défauts qui se cumulent sur le même écran.

**a) Le défaut d'onglet est le mauvais.** `food-picker.tsx:60` → `useState('all')`. Le premier
écran de la saisie est la base entière, triée par ordre alphabétique. Or la loi de l'usage en
nutrition est connue et brutale : **80 % des ajouts portent sur une vingtaine d'aliments** que la
personne mange toutes les semaines. L'app possède déjà cette liste (`useRecentFoods`) et la range
dans le 3ᵉ onglet.

**b) On ne peut pas chercher hors de « Tous ».** Le champ de recherche est conditionné à
`tab === 'all'` (`food-picker.tsx:167`), et `useFoods(tab === 'all' ? search : undefined)` ne
balaye que la bibliothèque. Impossible de chercher dans ses **favoris**, ses **récents**, ses
**recettes** ou ses **repas types**. La spec §5.2 exige pourtant qu'une recette « apparaisse dans
la recherche d'aliments au même titre qu'un aliment simple » — **écart de spec**.

**c) La recherche ne classe pas.** `matchesSearch` (`packages/shared/src/search.ts:26`) est un
`includes` sur chaîne normalisée, et le tri reste `ORDER BY name`. Donc :

| Je tape | Ce que j'obtiens | Ce que j'attends |
|---|---|---|
| `pain` | par ordre alphabétique, « Chapelure de pain » possiblement avant « Pain » | « Pain » d'abord, préfixes ensuite |
| `poulet` | tout ce qui contient la chaîne, alphabétiquement | le blanc de poulet, que je prends 3× par semaine |
| `poullet` | **rien** | le poulet |

La brique de correspondance floue **existe déjà** (`bestMatchIndex`) — elle n'est branchée que sur
la saisie texte libre, jamais sur la recherche manuelle.

**d) Neuf entrées de même poids.** 5 onglets (`Tous · Favoris · Récents · Recettes · Repas types`)
+ 4 boutons `ghost` en pied (`Scanner · Liste rapide · Ajout rapide · Créer un aliment`) qui
passent à la ligne. Rien ne hiérarchise. **La maquette du 30/07 avait tranché l'inverse** :

> « Affordance retenue (une seule, argumentée) : chaque en-tête de repas porte un « + Ajouter un
> aliment » qui ouvre le bottom sheet de sélection ; ce sheet expose les **3 modes** en haut
> (Rechercher · Scanner · Texte libre). »
> — `design/FitTrio - Nutrition.README.md`

### 3.4 🟠 L'utilisateur pilote à l'aveugle pendant la saisie

Le journal affiche un anneau parfait : « 480 kcal restantes ». On touche « + Ajouter » — et **cette
information disparaît de l'écran** pour toute la durée de la saisie. Le sélecteur ne la montre pas.
Le panneau de quantité, où se décide le seul nombre qui compte, ne la montre pas non plus : il
affiche les kcal de l'aliment, pas leur effet sur la journée.

S'y ajoute l'absence de deux raccourcis qui font tout le confort des apps concurrentes :

- **pas de multiplicateur de portion.** Les chips **écrasent** la valeur en grammes : « 1 banane
  (120 g) » puis « j'en ai mangé deux » = calcul mental, puis clavier. Aucun `×2`, aucun `½`,
  aucun stepper (`QuantityPanel.tsx:78-84`) ;
- **pas de mémoire de quantité.** Chaque ajout repart de la portion de référence ou de 100 g,
  alors que `food_entries.quantity_g` contient l'historique complet. « La dernière fois : 45 g »
  est le raccourci le plus rentable de la catégorie.

Enfin, le repas cible est deviné, jamais déduit : le widget nutrition du dashboard ouvre
**toujours** `meal=breakfast` (`NutritionSummaryCard.tsx:68`). Un tap à 20 h journalise au
petit-déjeuner. L'app sait pourtant apprendre les heures de repas — `learned-hour.ts` le fait déjà
pour les rappels.

### 3.5 🟠 On ne peut pas se déplacer dans le temps

Le journal se navigue **un jour à la fois** (`nutrition.tsx:286-311`). Corriger un oubli de la
semaine dernière : 7 taps. D'il y a quinze jours : 15 taps. La spec §4.7 prévoit noir sur blanc
« Calendrier accessible via icône (**vue mensuelle, jours complétés surlignés**) » — **non livré**.

Et rien n'indique quels jours sont remplis, alors que l'app calcule déjà le taux de complétion
(`useJournalCompletion`) et que le **widget Android affiche déjà une trame de jours**. Le journal
est le seul endroit aveugle à sa propre régularité — c'est-à-dire à ce qui motive.

### 3.6 🟠 Les écrans ne se donnent aucune hiérarchie

**Le hub** enchaîne 10 blocs dans un scroll unique : en-tête, navigation de jour, bilan, macros,
micros (masqués), 3 à 6 cartes de repas, carte de suggestion, section « Autres », carte planning,
et pour finir un lien texte « Gérer mes repas » — soit un **réglage rangé sous le contenu du
jour**, atteint en scrollant tout le journal.

**L'écran Stats** aligne **8 sections permanentes** (poids, courbe, objectif de poids, apports
moyens, répartition par repas, adhérence, régularité, protéines/kg) **plus 4 cartes
auto-portantes**. C'est une non-conformité à votre propre doctrine :

> « **Tier 1 — Écran Stats/Progression du pilier.** […] Dès qu'un écran dépasse **~4-5 sections**,
> il passe en repliable ou sous-onglets. »
> — ADR-007 §2, qui cite précisément cet écran comme le cas déjà limite

Trois défauts d'affichage s'y ajoutent :

- la carte **Adhérence** empile **quatre phrases en texte mono** (`78 %`, puis « N jours dans la
  cible », « marge ±10 % », « bilan +1 240 kcal », « X au-dessus / Y en dessous ») là où un seul
  visuel dirait tout ;
- la **régularité** est un pourcentage nu — c'est exactement le cas d'usage d'une **heatmap de
  calendrier**, et c'est la donnée la plus motivante du pilier ;
- l'écran **mélange saisie et lecture** : la pesée du jour (champ + bouton Enregistrer) est le
  premier bloc d'un écran de consultation.

---

## 4. Ce qui manque

| # | Manque | Pourquoi ça compte | État actuel |
|---|---|---|---|
| M1 | **Hydratation** | Le seul geste de nutrition qui coûte **un tap**, sans base de données, sans pesée, sans calcul. Moteur de retour quotidien, présent chez tous les concurrents. | Écarté par la spec §8 (« reporté V2 ») · catalogue NUTR-12 ⏳ — **à réexaminer, voir §8** |
| M2 | **Micros visibles par défaut** | 33 micros CIQUAL + VNR + anneaux de couverture = un différenciateur réel. `tracked: []` le rend invisible. | `stores/tracked-micros.ts:40` — à pré-remplir (fer, calcium, vit. D, magnésium, potassium, vit. C) |
| M3 | **Portions sur les aliments perso et scannés** | Ce sont ceux qu'on mange le plus. Sans portion, saisie en grammes **à vie**. | 0 occurrence de « portion » dans `food-custom.tsx` ; imports OFF forcés à `portions: []` |
| M4 | **Mention cru / cuit** | Riz cru vs cuit = facteur 3 sur les calories. Première source d'erreur de saisie de la catégorie. | Exigé par la règle métier §8 — **0 occurrence dans le code** |
| M5 | **Repères de qualité** (sucres, fibres, AGS) | Les colonnes sont **stockées et affichées**, jamais rapportées à un repère. « Fibres 12 g » ne dit rien ; « 12 g / 25-30 » dit tout. | Catalogue NUTR-15, non fait |
| M6 | **Cible et heure par repas** | Vous mesurez la répartition observée (NUTR-16) sans permettre de déclarer une intention. Et l'heure de repas est déjà apprise pour les rappels. | `nutrition-meals.tsx` : libellé + ordre seulement |
| M7 | **Aliment simple au planning** | Le planning n'accepte **que** recettes et repas types → il faut créer une recette avant de pouvoir planifier quoi que ce soit. | `meal-plan/index.tsx`, `AddEntrySheet` |
| M8 | **Recettes éditables** | Ni renommage, ni suppression de recette, ni modification de la quantité d'un ingrédient (appui long → supprimer, seulement). Pas d'étapes, pas de photo. | `recipe-edit.tsx` |
| M9 | **Sortie de secours du texte libre** | Une ligne non reconnue est un cul-de-sac rouge. La spec §4.5 exige « meilleures correspondances, ou bouton rechercher / créer » **et** l'ajout manuel d'une ligne. La **dictée au micro** annoncée par la même section n'existe pas. | `meal-quick-entry.tsx:171-176` |

---

## 5. Écarts de conformité

Faits vérifiables, indépendants de tout jugement esthétique.

### 5.1 Spec fonctionnelle → code

| Spec | Exigence | Réalité |
|---|---|---|
| §4.7 | « Calendrier accessible via icône (vue mensuelle, jours complétés surlignés) » | Absent — navigation ◀▶ uniquement |
| §4.5 | Item non reconnu → « proposition des meilleures correspondances, ou bouton rechercher / créer l'aliment » | Ligne rouge inerte |
| §4.5 | « Ajout / suppression d'une ligne à la main possible » | Suppression seule |
| §4.5 | « écrire (ou **dicter** au micro) » | Pas de dictée |
| §5.2 | Une recette « apparaît dans la recherche d'aliments au même titre qu'un aliment simple » | Recettes isolées dans un onglet, hors recherche |
| §2.4 | Allergènes : « liste libre **+ sélection dans une liste prédéfinie** » | Champ texte libre séparé par virgules |
| §8 | « Une mention **cru / cuit** est affichée sur les aliments concernés » | Absente |
| §4.3 | « Chaque aliment peut définir une ou plusieurs portions » | Impossible sur un aliment perso ou scanné |

### 5.2 Maquette validée → code

| Maquette 30/07/2026 | Code livré |
|---|---|
| Sheet d'ajout exposant **3 modes** (Rechercher · Scanner · Texte libre) | Écran plein, **5 onglets + 4 boutons de pied** |
| « Pas de FAB », ajout **contextuel** par en-tête de repas | ✅ Respecté |
| Bilan du jour à l'anneau | ✅ Respecté (variante « chiffres » écartée, motif écrit) |
| Grille micro à couverture | ✅ Respectée — mais **désactivée par défaut** |

### 5.3 ADR-007 → code

L'écran Stats nutrition porte **8 sections permanentes + 4 cartes**, là où le Tier 1 plafonne à
« ~4-5 sections » avant repli ou sous-onglets. L'ADR nommait déjà cet écran comme le point de
saturation à surveiller ; le seuil est franchi.

---

## 6. Ergonomie fine et dette visible à l'usage

| # | Constat | Localisation |
|---|---|---|
| E1 | **Le profil nutritionnel écrit en base à chaque frappe.** `onChangeText` appelle directement `upsertNutritionProfile` pour l'objectif manuel, les 3 macros, le bonus séance et les allergènes. Taper « 2500 » = 4 écritures. Effacer un champ macro écrit un **0 affirmé**. Le champ est en plus contrôlé par la valeur relue. | `nutrition-profile.tsx:126-136, 201-210, 245-255, 330-340` |
| E2 | **Toute la table `foods` est chargée en mémoire puis filtrée en JS**, sans pagination ni debounce. Indolore à 80 aliments ; la saisie texte libre mappe en plus **tous** les noms à chaque frappe. Le jour où la base atteint la taille qu'elle devrait avoir (§3.1), l'écran devient lent. | `food-repository.ts:109-113` · `meal-quick-entry.tsx:71` |
| E3 | **Jargon non expliqué** : « TDEE » (chiffre nu, aucune explication), « bonus jour d'entraînement · forfait / auto », « marge d'adhérence 5/10/15 % », « objectif : sèche / prise de masse ». | `nutrition-profile.tsx` |
| E4 | **Aucune iconographie de contenu.** 4 emojis de repas (🥐🍽️🍲🍎) avec repli 🍽️ → deux repas sur cinq portent la même assiette. Les listes d'aliments n'ont ni vignette, ni couleur de catégorie : 80 lignes de texte identiques. | `nutrition.tsx:72-77` · `food-picker.tsx` `FoodRow` |
| E5 | **Actions cachées derrière un appui long, sans affordance** : supprimer un ingrédient de recette, modifier/supprimer un aliment de la bibliothèque. | `recipe-edit.tsx` · `food-picker.tsx:onFoodLongPress` |
| E6 | **Trois représentations du même triplet P/G/L** : colonnes + barres bornées (journal), lignes label/valeur + barres (widget dashboard), barres + champs texte (profil). | `MacroTriple` · `NutritionSummaryCard/MacroBar` · `nutrition-profile.tsx` |
| E7 | **Un tap administratif après chaque ajout** : la bannière « N aliments ajoutés · Terminé » pousse le contenu et n'est jamais rapprochée du budget restant. | `food-picker.tsx:184-196` |
| E8 | Le **détail d'une entrée** ouvre les micronutriments dépliés (`defaultOpen`) — jusqu'à 33 lignes — avant les actions Modifier / Supprimer, qui se retrouvent sous un long scroll. | `nutrition.tsx:739-744` |
| E9 | **17 tailles de police sous 11 px** dans les écrans et composants (dix à `10`, cinq à `10.5`, une à `9.5`, une à `9`) — dont le pourcentage au centre des anneaux de micronutriments et l'unité « kcal » des en-têtes de repas. WCAG n'impose pas de plancher, mais les recommandations Android en posent un à 12 sp. À verser à la recette de CONF-07, qui porte précisément l'accessibilité. | 17 occurrences dans `components/` et `app/` |

---

## 7. Plan proposé — 7 lots

Ordonnés par **valeur pour l'utilisateur ÷ coût**. Les lots 1 à 3 valent, à eux seuls, plus que
les quatre autres réunis.

### Lot 1 — 🔴 Remplir la bibliothèque *(contenu, pas de code)*

Passer de 80 à **800-1 200 aliments** couvrant le quotidien français : produits laitiers, œufs,
charcuterie, fromages, pains et viennoiseries, plats composés courants, légumineuses, boissons,
sucreries. Chaque aliment avec **au moins une portion usuelle** et, pour les aliments concernés,
la mention **cru / cuit** (M4).

L'outillage existe : `enrich-ciqual/generate.py` + `FoodImportScreen` (import CSV du back-office).
Décision à prendre : cible de volume, et **qui produit la liste** (travail de coach, comme
CONTENU-01).

### Lot 2 — 🔴 Rendre l'objectif juste *(petit, sans risque, à faire en premier)*

1. **Demander le niveau d'activité à l'onboarding** — une étape de cinq choix, ou un premier passage
   obligé dans le profil nutritionnel avant que l'anneau n'affiche un objectif.
2. **Signaler la valeur non choisie** tant qu'elle est un défaut : le réglage affiche aujourd'hui
   « Modérément actif » comme si l'utilisateur l'avait cochée.
3. **Créer le `nutrition_profile` à la sortie de l'onboarding**, au lieu de laisser six sites de
   code retomber sur le même `?? 'moderate'`.
4. **Expliquer le TDEE en une phrase** à côté du chiffre (E3) — c'est le même écran.

C'est le lot le moins coûteux de la liste, et il conditionne la crédibilité de tout le reste :
aucune analyse, aucun bilan, aucune adhérence n'a de sens face à un objectif faux de 600 kcal.

### Lot 3 — 🔴 Le geste de trois secondes *(refonte du sélecteur)*

1. **Sheet d'ajout à 3 modes**, comme la maquette validée l'avait tranché : `Rechercher · Scanner ·
   Texte libre` en tête, remplaçant les 9 entrées plates.
2. **Défaut = récents + favoris fusionnés**, la base ne venant qu'en second rideau.
3. **Recherche unifiée et classée** : une seule requête sur aliments + recettes + repas types,
   triée par pertinence (préfixe > mot entier > sous-chaîne, récents en avant), branchée sur
   `bestMatchIndex` pour tolérer les fautes.
4. **Budget visible en permanence** : bandeau « il te reste N kcal » dans le sheet **et** dans le
   panneau de quantité, avec la projection après ajout.
5. **Quantité en un tap** : chips de portion **multipliables** (`×1 ×2 ×½`), stepper, et rappel de
   la **dernière quantité utilisée** pour cet aliment.
6. **Repas déduit de l'heure** partout où il est aujourd'hui deviné (`meal=breakfast` en dur).
7. **Scan accessible depuis le journal** en un tap (icône d'en-tête).

### Lot 4 — 🟠 Un journal qui se pilote

1. **Calendrier mensuel** avec jours renseignés surlignés (spec §4.7), plus balayage horizontal
   entre jours.
2. **Micros actifs par défaut** (6 clés utiles), la sélection des 33 devenant un réglage avancé.
3. **Hydratation** si l'arbitrage du §8 le retient : un widget à 3 boutons, une table, un tap.
4. **Repères de qualité** (fibres / sucres / AGS vs seuils) dans la grille de couverture existante,
   sans nouvelle carte.

### Lot 5 — 🟠 Des stats qui se lisent

1. **Sous-onglets** `Aujourd'hui · Poids · Apports · Qualité`, pour rentrer dans l'ADR-007.
2. **Heatmap de régularité** (calendrier 30 jours) à la place du pourcentage nu.
3. **Adhérence en visuel** : une barre à zone-cible plutôt que quatre phrases en mono.
4. **Sortir la pesée** de l'écran de consultation.

### Lot 6 — 🟡 Rendre le planning adoptable

1. **Aliment simple et quick add** acceptés dans une case de planning (M7) — c'est ce qui condamne
   le module aujourd'hui.
2. **Vue grille semaine** compacte, en plus des 7 cartes empilées.
3. **Glisser-déposer** entre jours (le patron existe déjà : `MUSC-F9`).
4. **Recettes éditables** (M8) : renommer, supprimer, changer la quantité d'un ingrédient.

### Lot 7 — 🟢 Dette UX

E1 (écriture par frappe → formulaire local + enregistrement explicite), E3 (expliquer le TDEE et
le vocabulaire), E5 (affordances visibles), E8 (micros repliés dans le détail), E2 (pagination et
debounce — **obligatoire avant le lot 1**, sinon la base enrichie rend l'écran lent), M9 (sortie de
secours du texte libre), et l'unification des trois affichages P/G/L (E6).

---

## 8. Arbitrages à trancher — Florian / Damien

Ces cinq points changent la forme du travail. Je ne les décide pas.

1. **Hydratation : on ouvre en V1 ou on tient la décision V2 ?**
   La spec §8 l'a écartée et le catalogue la range en V2. Je la remets sur la table parce que le
   rapport valeur/coût est le meilleur du pilier : un tap, aucune dépendance, aucune donnée à
   saisir, et c'est un motif de retour quotidien. Coût : une table, un widget.

2. **Volume cible de la bibliothèque, et qui produit la liste ?**
   800 ? 1 200 ? CIQUAL complet (~3 200) avec les problèmes de nommage que ça implique ? C'est du
   travail de contenu, comme CONTENU-01 — donc un arbitrage de coach, pas de dev.

3. **Refonte du sélecteur d'aliments : on suit enfin la maquette du 30/07 ?**
   Elle avait tranché le sheet à 3 modes ; le code a livré 9 entrées. Confirmer la maquette, ou
   acter formellement qu'on s'en écarte et pourquoi.

4. **Stats nutrition : sous-onglets, ou repli des sections ?**
   L'ADR-007 laisse le choix entre les deux. Les sous-onglets coûtent une navigation, le repli
   coûte un tap par section.

5. **Où s'arrête le périmètre avant le lancement ?**
   Le pilier est à 96 % de MVP1 avec 2 P0 hors-code (Play Store). Deux stratégies :
   **(a)** lots 1 à 3 avant lancement — le lot 2 (objectif juste) est de toute façon un correctif,
   et les lots 1 et 3 décident si un utilisateur reste ou part au deuxième repas ;
   **(b)** lots 1 et 2 seuls (contenu + correctif, aucun risque de régression), les lots 3+ en V1.1.
   Ma recommandation : **(a)**, parce qu'une base remplie derrière un sélecteur qui ouvre sur
   l'ordre alphabétique ne se verra qu'à moitié.

---

## 9. Périmètre de l'audit

**Lu** : `(tabs)/nutrition.tsx` (1 126 l.), `food-picker.tsx`, `food-custom.tsx`, `food-scan.tsx`,
`meal-quick-entry.tsx`, `nutrition-meals.tsx`, `nutrition-profile.tsx`, `nutrition-stats.tsx`,
`recipe-edit.tsx`, `meal-plan/index.tsx`, `meal-plan/shopping.tsx`, `QuantityPanel.tsx`,
`DayBalanceCard.tsx`, `MacroTriple.tsx`, `MicroCoverageGrid.tsx`, `MealPlanDayCard.tsx`,
`MacroSuggestionCard.tsx`, `NutritionSummaryCard.tsx`, `food-repository.ts`,
`tracked-micros.ts`, `learned-hour.ts`, `search.ts`, `food.ts`, le seed CIQUAL, le thème,
`alimentation.md`, `analyses-donnees.md` (NUTR/MN/RN), `ADR-007`, `design-system.md`,
`FitTrio - Nutrition.README.md`, `BACKLOG.md`, `ETAT.md`.

**Non couvert** : l'exécution sur device (aucun rendu réel observé — 55 US attendent une recette
humaine), les performances mesurées, le back-office nutrition au-delà de l'inventaire de ses
écrans, la traduction EN des contenus.
