---
id: NUTRI-UX01
titre: "Refonte UX du pilier Nutrition — objectif juste, geste de saisie, journal, suivi, planning"
roadmap: [4.41]
catalogue: [NUTR-12, NUTR-15, NUTR-17, NUTR-21]
etape: recette
branche: feature/nutri-refonte-ux
maj: 13/09/2026
---
# US NUTRI-UX01 — Refonte UX du pilier Nutrition

> **Audit + maquettes validés par Florian le 10/09/2026** (compte rendu PDF 13 pages + canvas
> 7 planches). Traité en **un seul lot** sur décision de Florian, là où l'audit proposait sept.
> Diagnostic : [audit-nutrition-2026-09.md](../../../product/audit-nutrition-2026-09.md) ·
> Maquettes : [design/nutrition-refonte-2026-09/](../../../../design/nutrition-refonte-2026-09/).
> Branche : `feature/nutri-refonte-ux`, créée depuis `dev` dans un **worktree isolé** (deux autres
> sessions travaillent en parallèle sur `feature/cardio-refonte-ux` et `feature/muscu-refonte-ux`).
> **Une migration** (hydratation) → **sync rules PowerSync à déployer**.

## 0. Contexte

Le pilier est complet et testé en dessous — TDEE, mise à l'échelle, 33 micronutriments avec VNR,
heure de rappel apprise, croisements avec l'entraînement. Le défaut n'est pas l'absence : c'est que
**le pilier a été construit fonction par fonction, jamais autour du geste**. Les fonctionnalités
sont posées côte à côte, au même poids visuel, si bien que le geste fait cinq fois par jour coûte
autant que celui fait trois fois dans une vie.

S'y ajoute un défaut d'une autre nature, trouvé en seconde passe d'audit : **l'objectif calorique
lui-même peut être faux de ~600 kcal**, parce que l'onboarding ne demande jamais le niveau
d'activité.

Vingt-six constats vérifiés dans le code (audit §3 à §6).

### Arbitrages tranchés par Florian (10/09/2026)

- **Ampleur** : tout le pilier, planning et statistiques compris. Un seul lot.
- **Hydratation** : ouverte en V1 (l'audit la remettait sur la table contre la spec §8 « reporté
  V2 »). Elle sort donc du report : voir §5.
- **Sélecteur d'aliment** : on suit la maquette du 30/07/2026 — sheet à 3 modes.
- **Écran Suivi** : sous-onglets (et non repli de sections), conformément à l'option laissée
  ouverte par l'ADR-007 §2.

### D1 — Le remplissage de la bibliothèque — ✅ **fait le 13/09/2026**

> **Mise à jour du 13/09/2026.** Ce qui suit décrit la situation à la livraison du 10/09, et > reste vrai comme trace de décision. Le CSV CIQUAL a depuis été récupéré sur l'entrepôt
> recherche.data.gouv.fr et l'import a été joué : **la bibliothèque compte 3 244 aliments**.
> La procédure telle qu'elle a été exécutée, et ce qu'elle a révélé, sont en §9.

L'audit classait « remplir la bibliothèque » (80 → 800-1 200 aliments) en **lot 1, avant tout le
reste**. Ce lot **n'est pas dans cette US**, et ce n'est pas un arbitrage de périmètre : c'est une
impossibilité matérielle.

Le générateur `supabase/scripts/enrich-ciqual/generate.py` tire **toute** la nutrition du fichier
CIQUAL de l'ANSES (`ciqual2025.csv`), explicitement **non versionné** (`.gitignore`, licence
Etalab, volumineux). Ce fichier n'est **pas** sur la machine — vérifié. Sans lui, produire
700 fiches nutritionnelles reviendrait à **fabriquer des données de santé**, que l'app utiliserait
ensuite pour calculer des apports réels. C'est le seul endroit de cet audit où « faire quand même »
serait pire que ne rien faire.

**Ce que cette US livre à la place** : l'outillage qui rend le remplissage trivial une fois le
fichier obtenu — `generate.py` gagne un **mode d'import massif** (`--bulk`) qui construit les
entrées du catalogue directement depuis le CSV CIQUAL, au lieu de les saisir une par une. La
procédure complète est en §9. Le travail restant pour Florian : télécharger le fichier, choisir les
familles à importer, lancer une commande.

## 1. R1 — L'objectif calorique devient juste

**Le défaut.** Les cinq étapes de l'onboarding ne demandent jamais le niveau d'activité, et aucun
`nutrition_profile` n'est créé à sa sortie. Six sites de code retombent sur `?? 'moderate'`
(×1,55). Un sédentaire (×1,2) reçoit un objectif surestimé de ~614 kcal/jour ; en sèche, tout le
déficit est annulé, sans qu'aucun écran ne le signale.

- **R1.1** — Une étape d'onboarding « À quel point bouges-tu ? » propose les 5 niveaux, avec pour
  chacun une **description concrète** (« Sédentaire — travail assis, peu de marche ») et non le
  seul facteur multiplicateur. Elle écrit `nutrition_profiles.activity_level`.
- **R1.2** — Cette étape n'apparaît **que si le pilier nutrition est actif** (décision H : ne rien
  imposer). Elle se place après `displayLevel`, en dernière position avant le récapitulatif, pour
  que le numéro des étapes précédentes ne bouge pas. `OnboardingScaffold` accepte un `total`
  variable (4 ou 5).
- **R1.3** — Tant que le niveau n'a **jamais été choisi**, le profil nutritionnel l'affiche comme
  un **défaut assumé**, pas comme une sélection : mention « valeur par défaut, non choisie » +
  invitation à trancher. Techniquement : `activity_level` reste `null` en base tant que
  l'utilisateur n'a pas répondu, et les lecteurs conservent leur repli `'moderate'` — le repli
  devient *visible*, il ne disparaît pas.
- **R1.4** — Le TDEE est **expliqué en une phrase** à côté du chiffre (« ce que ton corps dépense
  en une journée, au repos et en activité — estimé d'après ton poids, ta taille, ton âge et ton
  niveau d'activité »), et le vocabulaire de l'écran est repris : « bonus jour d'entraînement »,
  « marge d'adhérence » (E3).

## 2. R2 — Le geste de trois secondes

**Le défaut.** Ajouter un aliment déjà mangé cette semaine coûte 6 taps ; scanner, 6 ; et trois
taps sur six ne produisent aucune information.

- **R2.1 — Sheet à 3 modes.** Le sélecteur cesse d'être un écran plein à 5 onglets + 4 boutons de
  pied (9 entrées de même poids). Il devient un **bottom sheet** dont l'en-tête expose
  `Rechercher · Scanner · Texte libre`, exactement l'arbitrage écrit dans la maquette du
  30/07/2026 et jamais posé dans le code. Les deux actions rares (calories sans aliment, créer un
  aliment) descendent en pied.
- **R2.2 — Le défaut d'ouverture, c'est l'habitude.** À l'ouverture, la liste montre **les
  récents et les favoris fusionnés**, dédupliqués, favoris d'abord à fréquence égale. La
  bibliothèque complète reste accessible d'un tap (« Toute la base »). Aujourd'hui l'écran ouvre
  sur la base entière triée par ordre alphabétique.
- **R2.3 — Une seule recherche, classée.** La recherche balaye **aliments + recettes + repas
  types** dans une liste unique (spec §5.2, jamais respectée), et **classe par pertinence** :
  préfixe exact > début de mot > sous-chaîne, les récents départageant les ex æquo. Elle tolère
  les fautes via `bestMatchIndex`, brique déjà présente mais branchée nulle part sur la recherche
  manuelle. Aujourd'hui : `includes` + tri alphabétique, et pas de champ de recherche hors de
  l'onglet « Tous ».
- **R2.4 — Le budget ne quitte plus l'écran.** Un bandeau « il te reste N kcal · P g de
  protéines » est présent dans le sheet **et** dans le panneau de quantité, où il montre en plus
  **la projection après ajout**. Aujourd'hui l'information disparaît au moment précis où la
  décision se prend.
- **R2.5 — La quantité en un tap.** Les portions deviennent **multipliables** (`½ · 1 · 2`) au
  lieu d'écraser la valeur en grammes, un **stepper** encadre la saisie, et la **dernière quantité
  utilisée pour cet aliment** est rappelée et pré-remplie — la donnée est en base
  (`food_entries.quantity_g`) et n'était pas lue.
- **R2.6 — Le repas se déduit de l'heure.** `mealForHour` (livrée par ACCUEIL-02) est appliquée
  aux trois écrans qui gardent `'breakfast'` en dur comme repli : `food-picker`, `food-scan`,
  `meal-quick-entry`.
- **R2.7 — Le scan à un tap du journal.** Une action de scan rejoint l'en-tête du journal. Il est
  aujourd'hui au 4ᵉ niveau, derrière un bouton `ghost` de pied de page.

## 3. R3 — Un journal qui se pilote

- **R3.1 — Calendrier mensuel**, ouvert depuis le libellé du jour (chevron = affordance), avec
  **les jours renseignés surlignés** — complet, partiel, vide. Exigé par la spec §4.7, jamais
  livré : corriger un oubli d'il y a quinze jours coûte aujourd'hui 15 taps sur ◀.
- **R3.2 — Une trame de la semaine** dans la barre de jour : sept pastilles, la donnée existe déjà
  (`useJournalCompletion`) et n'était affichée nulle part d'utile.
- **R3.3 — Les micronutriments sont suivis par défaut.** `tracked: []` rend aujourd'hui invisible
  le seul vrai différenciateur du pilier. Défaut : **fer, calcium, magnésium, vitamine D,
  vitamine C, potassium** — six clés à VNR, couvrant les carences les plus fréquentes. Le choix
  parmi les 33 reste un réglage.
- **R3.4 — Les micros passent sous les repas.** Placés en haut, ils repoussaient le premier repas
  hors de l'écran : un journal alimentaire dont aucun repas n'est visible sans scroller.
- **R3.5 — Repères de qualité** (catalogue NUTR-15) : fibres, sucres et acides gras saturés
  rapportés à un repère plutôt qu'affichés nus. Voir §6 pour les seuils.

## 4. R4 — Un suivi qui se lit

- **R4.1 — Sous-onglets** `Régularité · Apports · Poids · Qualité`. L'écran empile aujourd'hui
  **8 sections permanentes + 4 cartes** là où l'ADR-007 §2 plafonne le Tier 1 à 4-5 sections — et
  l'ADR nommait déjà cet écran comme le point de saturation à surveiller.
- **R4.2 — La régularité devient une heatmap** de 30 jours, avec série en cours, meilleure série
  et nombre de jours vides. C'est un pourcentage nu aujourd'hui, alors que c'est la donnée la plus
  motivante du pilier.
- **R4.3 — L'adhérence devient un graphe à zone-cible** : un trait par jour, sous / dans /
  au-dessus. Elle est aujourd'hui **quatre phrases en texte mono** empilées.
- **R4.4 — La pesée sort de l'écran de consultation** : la saisie du poids n'a rien à faire en
  premier bloc d'un écran de lecture. Elle rejoint l'onglet Poids, en action secondaire.

## 5. R5 — Hydratation (ouverte par arbitrage)

La spec §8 la reportait en V2 et le catalogue la range en NUTR-12 ⏳. **Florian l'ouvre en V1** :
c'est le seul geste du pilier qui coûte **un tap**, sans base de données à interroger, sans pesée,
sans calcul — et un motif de retour quotidien.

- **R5.1** — Nouvelle table `water_entries` (offline-first : UUID client, timestamps UTC, soft
  delete, écriture par repository). Une ligne = un ajout, pour que le retrait défasse le dernier
  geste plutôt qu'un total.
- **R5.2** — Carte au journal : objectif du jour, verres consommés, **un bouton d'ajout**. Le
  volume du verre et l'objectif journalier sont réglables (défauts : 250 ml, 2 000 ml).
- **R5.3** — Aucune notification, aucun rappel : hors périmètre de cette US.
- **R5.4** — ⚠️ **Sync rules PowerSync à déployer manuellement** après la migration (étape déjà
  oubliée une fois dans ce projet) — voir RECETTES.md.

## 6. R6 — Dette et finitions

- **R6.1** — Le profil nutritionnel **cesse d'écrire en base à chaque frappe** (objectif manuel,
  3 macros, bonus séance, allergènes). Formulaire local + enregistrement explicite : taper
  « 2500 » produit aujourd'hui quatre écritures, et effacer un champ macro écrit un **0 affirmé**.
- **R6.2** — La recherche d'aliments est **paginée et *debouncée***. Toute la table est aujourd'hui
  chargée en mémoire puis filtrée en JS ; indolore à 80 aliments, intenable à 1 000 — donc
  **prérequis du remplissage de la base** (D1).
- **R6.3** — Les actions cachées derrière un **appui long** (supprimer un ingrédient de recette,
  modifier un aliment) reçoivent une affordance visible.
- **R6.4** — Le détail d'une entrée **replie** les micronutriments : jusqu'à 33 lignes s'ouvraient
  avant les boutons Modifier / Supprimer.
- **R6.5** — La saisie texte libre cesse d'être un cul-de-sac : une ligne non reconnue propose
  **les meilleures correspondances**, un bouton **rechercher / créer**, et l'**ajout manuel d'une
  ligne** — les trois sont exigés par la spec §4.5 et aucun n'existe.
- **R6.6** — Les aliments **perso et scannés acceptent des portions** (`food-custom`) : ce sont
  ceux qu'on mange le plus, et ils se saisissent aujourd'hui en grammes à vie.
- **R6.7** — Mention **cru / cuit** sur les aliments concernés, exigée par la règle métier §8 et
  absente du code. Riz cru contre riz cuit : facteur 3 sur les calories.
- **R6.8** — Les **allergènes** gagnent une liste prédéfinie à cocher à côté de la saisie libre
  (spec §2.4).
- **R6.9** — Les **tailles de police sous 11 px** (17 occurrences) remontent à 11 px minimum (E9).

## 6 bis. R7 — Le planning repas devient adoptable

**Le défaut.** Le planning n'accepte **que** des recettes et des repas types. Un utilisateur qui
l'ouvre pour la première fois lit « Aucune recette », doit sortir, créer une recette, revenir :
~20 taps pour planifier un seul repas. Ce n'est pas son ergonomie interne qui le condamne, c'est
cette porte fermée.

- **R7.1** — La feuille d'ajout accepte un **aliment simple** (avec quantité) et un **ajout
  rapide en calories**, à côté des recettes et des repas types. Même liste unifiée et même
  classement que R2.3.
- **R7.2** — Une **vue grille semaine** compacte (7 colonnes × repas) s'ajoute à la pile de sept
  cartes, et devient la vue par défaut : la pile impose aujourd'hui un scroll de 35 zones
  « + Ajouter ».
- **R7.3** — Une entrée planifiée se **déplace d'un jour à l'autre** sans être supprimée puis
  recréée (le patron existe côté musculation, MUSC-F9).
- **R7.4** — Les **recettes deviennent éditables** : renommer, supprimer la recette, modifier la
  quantité d'un ingrédient. Aujourd'hui seul un appui long caché permet de retirer un ingrédient.
- **R7.5** — Ce que le planning **ne fait toujours pas** : écrire dans le journal. La règle R1 de
  REPAS-01 tient — le planning est une intention, « J'ai mangé ça » reste le seul geste qui crée
  des `food_entries`, et il reste réversible.

### Hors périmètre, assumé

- La **dictée au micro** de la saisie texte (spec §4.5) : dépendance native supplémentaire, donc
  nouveau build avant toute recette, pour un gain qui ne conditionne aucun autre point. Le bouton
  n'est pas maquetté en leurre : il n'apparaît pas.
- L'**unification des trois affichages P/G/L** (E6) : cosmétique, sans effet sur un parcours.

## 7. Règles transverses

- **i18n FR + EN** : aucune chaîne en dur, y compris les libellés de niveaux d'activité, les
  repères de qualité et les unités d'hydratation.
- **Offline-first** : toute écriture passe par un repository ; UUID côté client ; `updated_at` en
  UTC ; suppression douce.
- **Décision H** : rien de ce qui touche l'entraînement n'apparaît si les piliers concernés sont
  inactifs ; l'étape d'activité ne s'affiche pas sans le pilier nutrition.
- **ADR-007** : aucune carte permanente n'est ajoutée à l'accueil. Les repères de qualité vivent
  dans un sous-onglet, pas en Tier 0.
- **Aucun recalcul rétroactif** : changer son niveau d'activité ne réécrit pas les journées
  passées (règle métier §8).

## 8. Seuils et références (R3.5)

| Repère | Seuil retenu | Source |
|---|---|---|
| Fibres | 25–30 g/jour | Références nutritionnelles ANSES adultes |
| Sucres libres | ≤ 10 % de l'**objectif calorique du jour** | OMS — proportionnel, jamais un chiffre fixe |
| Acides gras saturés | ≤ 10 % de l'**objectif calorique du jour** | OMS / ANSES |
| Protéines par kg | fourchette déjà en place (`PROTEIN_TARGETS_G_PER_KG`) | MN-06, livrée |

Les deux seuils proportionnels sont **dérivés de la cible du jour**, pas d'une valeur figée à
2 000 kcal : un objectif à 2 800 kcal et un objectif à 1 600 kcal n'ont pas le même plafond d'AGS.
Un dépassement se lit, il ne se dramatise pas — cohérent avec le traitement déjà retenu pour le
dépassement calorique.

## 9. Remplissage de la bibliothèque — exécuté le 13/09/2026 (suite de D1)

**Résultat : 80 → 3 244 aliments.** Migration `20260913182920_seed_library_foods_ciqual_v2`, poussée sur le cloud, cochée au registre.

La procédure, telle qu'elle a tourné — elle est rejouable à l'identique à chaque nouvelle
édition de la table CIQUAL :

1. Télécharger `Table Ciqual 2025_FR_2025_11_03.xlsx` (1,5 Mo) sur l'entrepôt
   <https://entrepot.recherche.data.gouv.fr> (doi:10.57745/RPWYZD) — ANSES, **Licence
   Ouverte / Etalab**, redistribution autorisée avec attribution. Le fichier reste
   **non versionné**.
2. Le convertir en CSV — script `openpyxl` dans
   [enrich-ciqual/README.md](../../../../supabase/scripts/enrich-ciqual/README.md).
3. `python supabase/scripts/enrich-ciqual/generate.py ciqual2025.csv --bulk --limit 4000`
   → complète `foods-catalog.json` puis produit `migration.sql`.
4. Copier `migration.sql` dans une migration versionnée (`npm run db:new`), puis
   `npm run db:push:dry`, `npm run db:push`, `npm run db:types`, cocher
   `supabase/MIGRATIONS.md`.
5. Sync rules PowerSync : **rien à faire** — `foods` et `food_translations` sont déjà dans
   le bucket de référence.

### Ce que le fichier réel a révélé

Le mode `--bulk` avait été écrit et testé le 10/09 contre un CSV **synthétique**, faute de
mieux. Confronté à la vraie table, il portait trois défauts qu'aucun test ne pouvait voir :

- 🔴 **Les libellés de groupes CIQUAL étaient faux.** La table écrit `viandes, oeufs,
  poissons` (sans ligature), `produits laitiers`, `eaux et autres boissons`. Un groupe non
  reconnu étant **ignoré en silence**, viandes, poissons, laitages et boissons ne seraient
  **jamais entrés** dans l'import — et rien ne l'aurait signalé.
- 🔴 **Les id de traduction étaient positionnels** (`d2000{n:03d}`) : au-delà de 999
  aliments, un premier bloc à 9 caractères, donc un UUID invalide et la migration rejetée.
  Ils dérivent maintenant de l'id de l'aliment, et le `on conflict` vise `(food_id, lang)`,
  la vraie contrainte unique de la table.
- ⚠️ **`--limit` coupait dans l'ordre du fichier**, trié par code de groupe : il remplissait
  la base de salades appertisées avant d'atteindre le premier légume. L'import est désormais
  trié par priorité de catégorie (légumes, fruits, viandes, poissons, laitages, féculents,
  oléagineux, boissons, puis le reste).

**Gain non prévu** : CIQUAL **déclare** la cuisson dans son sous-groupe (« viandes cuites »,
« poissons crus »…). R6.7 s'appuyait jusque-là sur la lecture du nom ; `preparation_state` est
désormais **renseigné pour 498 aliments** (286 crus, 212 cuits), le nom ne servant plus que
de repli.

### Conséquence sur R6.2 — le plafond de balayage

R6.2 était annoncé ici comme un prérequis « sans pagination, 900 aliments rendent le
sélecteur lent ». Le problème réel n'est pas la lenteur, c'est la **coupe** : le pré-filtre
SQL bornait les candidats à 400 lignes **avant** le classement. À deux lettres, la base en
rend bien plus (« po » : 582, « bo » : 453), et l'ordre de coupe ignorait la pertinence —
« pomme » pouvait disparaître à « po » pour revenir à « pom ». Une liste qui rétrécit quand
on **précise** sa recherche donne l'impression d'un moteur cassé. Corrigé en deux temps :
les correspondances par **début de nom** passent devant toutes les autres dans le tri SQL, et
le plafond monte de **400 à 800**.

### Ce qui reste ouvert

- **La traduction EN de 3 164 noms.** CIQUAL est monolingue : les entrées importées portent
  `nameEn = nameFr` et un marqueur `needsTranslation`, que le script compte à chaque
  exécution. Dette **tracée** plutôt qu'oubli silencieux (décision G).
- **Les portions usuelles.** Absentes de CIQUAL : pour ces aliments la saisie s'ouvre sur
  100 g. Patron de complétion dans `…nutrf2_portions_reference_aliments.sql`.

## 10. Recette

Les critères cochables vivent dans [RECETTES.md](../../../../RECETTES.md) §58. Deux prérequis
humains y sont rappelés : le **déploiement des sync rules PowerSync** (R5.4) et un **build**
incluant la migration d'hydratation.
