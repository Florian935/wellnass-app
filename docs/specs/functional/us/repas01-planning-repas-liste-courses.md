---
id: REPAS-01
titre: "Planning repas à la semaine, liste de courses générée et partage"
roadmap: [4.27, 4.28, 4.29]
catalogue: []
etape: recette
branche: feature/repas01-planning-repas-liste-courses
maj: 04/08/2026
recette: RECETTES.md §28
---

# REPAS-01 — Planning repas à la semaine, liste de courses générée et partage

> **Origine** : roadmap **4.27** (planning repas), **4.28** (liste de courses générée), **4.29**
> (export / partage). Cadrage d'origine dans
> [alimentation.md §6](../alimentation.md#6-planning-repas). Les trois lignes étaient rangées en
> **V1.1 post-lancement** ; **remontées dans le périmètre courant le 04/08/2026 (arbitrage
> Florian)** — le code est en avance sur le cahier des charges et les prérequis de publication sont
> à délai externe. **Aucune incidence sur le chemin critique du lancement** : pas de dépendance
> Play, pas de donnée de santé nouvelle, pas de service tiers.

## 0. Point de départ — ce qui existe déjà

Ce lot ne part pas de zéro. Inventaire fait le 04/08/2026 **dans le code et la base réels**, pas
d'après la doc :

| Brique | État | Conséquence pour cette US |
|---|---|---|
| `recipes` + `recipe_ingredients` | ✅ en base, repository complet | Source des ingrédients de la liste de courses. |
| `meal_templates` + `meal_template_items` | ✅ en base, repository complet | 2ᵉ source planifiable. |
| `applyTemplate(templateId, date, meal)` | ✅ livré | « Consommer » un repas planifié réutilise cet appel **tel quel**. |
| `foods.category` (9 valeurs) | ✅ `meat` `fish` `starchy` `vegetables` `fruits` `dairy` `nuts` `drinks` `other` | Le regroupement par rayon est **gratuit**, aucune taxonomie à inventer. |
| `food.categories.*` (i18n FR+EN) | ✅ livré | Libellés de rayons déjà traduits. |
| `resolveMealConfig()` / `DEFAULT_MEAL_CONFIG` | ✅ livré (US 4.15) | Les repas sont **personnalisables** par utilisateur. |
| `trainingDayCalories()` / `trainingDayBonus` | ✅ livré | Objectif adapté les jours d'entraînement (§6.2) = branchement. |
| `useWeekPlan(weekStartDate)` (muscu) | ✅ livré | Idiome de vue semaine à copier, dates construites composant par composant. |
| Table de planning repas | ❌ **absente** | Le seul modèle de données à créer. |

⚠️ **Deux corrections au cadrage d'origine** :

1. **[alimentation.md §6.1](../alimentation.md#61-création-du-planning) est périmé** : il annonce
   « 4 cases par jour ». Depuis l'US 4.15, les repas sont **configurables** (`nutrition_profiles.meals`,
   JSON) — renommables, ajoutables, supprimables. Le planning doit lire `resolveMealConfig()`, pas
   quatre cases en dur. Écrire 4 en dur ferait régresser une fonctionnalité livrée.
2. **§6.3 annonce un export « texte ou PDF »**, la roadmap 4.29 « message, email ou texte brut ».
   Tranché ci-dessous (**D8**) : **texte brut uniquement**. Le PDF imposerait `expo-print`, donc une
   dépendance native, donc **un nouveau build** avant toute recette — pour un gain nul sur une liste
   de courses qu'on lit dans un magasin.

## 1. Périmètre

**Ce que l'utilisateur peut faire**, en trois blocs qui se livrent dans cet ordre :

**A. Planifier (4.27)** — une vue semaine, un bloc par jour, une case par repas **configuré**. On y
dépose une **recette** (avec un nombre de portions) ou un **repas type**. Chaque jour affiche son
total calorique planifié face à l'objectif du jour, l'objectif tenant compte du bonus des jours
d'entraînement quand les piliers concernés sont actifs. Navigation ◀ ▶ de semaine en semaine.

**B. Générer la liste de courses (4.28)** — depuis une semaine planifiée, un bouton produit la
liste des ingrédients agrégés, regroupés par rayon, avec cases à cocher qui survivent à la
fermeture de l'app.

**C. Partager (4.29)** — la liste part en texte brut via la feuille de partage Android (message,
e-mail, notes, n'importe quelle app).

**Hors périmètre**, explicitement :

- **Aucune génération IA** de plan de repas. L'idée existe ([IDEAS.md 16/07/2026](../../../../IDEAS.md))
  et reste non cadrée : elle suppose un arbitrage coût/modèle et une US IA qui n'existe pas. Ici, tout
  est **saisi par l'utilisateur**.
- **Aucun garde-manger / stock** (idée du 16/07 également) : la liste ne déduit pas ce qu'on a déjà.
- **Aucune unité autre que le gramme.** `quantity_g` est ce que la base sait manipuler. « 2 oignons »
  reste un ingrédient sans quantité (**R7**), pas une unité à inventer.
- **Aucun prix, aucun magasin, aucune commande.**
- **Aucune notification.**

## 2. Modèle de données

### 2.1 `meal_plan_entries` — une case remplie du planning

```sql
create table public.meal_plan_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_date date not null,
  meal_key text not null,                 -- clé libre : config repas de l'utilisateur
  order_index integer not null default 0, -- plusieurs entrées possibles dans un même repas
  source_type text not null check (source_type in ('recipe','template')),
  recipe_id uuid references public.recipes (id),
  template_id uuid references public.meal_templates (id),
  servings numeric not null default 1 check (servings > 0),
  label text not null,                    -- snapshot du nom, survit à la suppression de la source
  kcal integer not null default 0,        -- snapshot des macros à la planification
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  consumed_at timestamptz,                -- null = pas encore porté au journal
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

- `meal_key` est **libre** (pas de `CHECK`), exactement comme `food_entries.meal_type` depuis l'US
  4.15. Une clé qui ne correspond plus à aucun repas configuré est traitée comme **orpheline** (R10),
  jamais perdue.
- **Snapshot des macros et du label** : le planning affiché ne bouge pas quand une recette est
  modifiée derrière. Même principe que `food_entries` et que les repas types (règle métier existante :
  « un repas template peut être modifié sans affecter les journaux passés »).
- **Les ingrédients, eux, sont lus en direct** au moment de générer la liste de courses (**R6**) — on
  achète ce qu'on va réellement cuisiner, pas une photo de la recette d'il y a trois semaines.
- `consumed_at` marque qu'une entrée a été portée au journal. Il **n'existe pas** de statut « sauté » :
  ne pas manger un repas planifié, c'est ne rien faire.

### 2.2 `shopping_lists` + `shopping_list_items` — la liste matérialisée

```sql
create table public.shopping_lists (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start_date date not null,          -- lundi ISO de la semaine couverte
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.shopping_list_items (
  id uuid primary key,
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id),   -- null = ingrédient libre
  name text not null,                          -- snapshot du libellé affiché
  category text not null default 'other',      -- snapshot du rayon
  quantity_g numeric,                          -- null = quantité non précisée
  unquantified_count integer not null default 0, -- nb de contributeurs sans quantité
  checked boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

**Pourquoi une liste matérialisée et non dérivée à la volée (D5).** Une liste de courses est un
objet qu'on emporte. Si elle était recalculée en continu depuis le planning, modifier une recette
un samedi matin ferait **bouger les lignes et les quantités pendant qu'on est au rayon**, et perdrait
les cases cochées. On la **fige à la génération** ; elle se régénère sur geste explicite.

⚠️ **Pas de contrainte `unique (user_id, week_start_date)`** — délibérément. En offline-first, deux
appareils peuvent générer la liste de la même semaine hors réseau ; à la synchro, une violation
d'unicité **fait échouer l'upload PowerSync** et bloque la file d'écriture. La liste **active** d'une
semaine est donc simplement **la plus récente par `generated_at`** ; régénérer soft-delete les
précédentes. Une contrainte d'unicité sur une table synchronisée est un piège, pas une garantie.

## 3. Règles métier

- **R1 — Le planning n'est jamais le journal.** Planifier n'écrit **rien** dans `food_entries`. Les
  totaux du jour, l'adhérence, le bilan hebdo, le streak et toutes les analyses continuent de ne
  voir que le **réellement consommé**. C'est le garde-fou central de cette US : un planning qui
  compterait comme des calories mangées corromprait silencieusement tout le pilier nutrition et
  plusieurs analyses inter-piliers.
- **R2 — Porter au journal est un geste explicite**, case par case (« J'ai mangé ça »). Il crée les
  `food_entries` du jour et du repas visés via `applyTemplate` (repas type) ou l'équivalent recette,
  puis horodate `consumed_at`.
- **R3 — Idempotence du portage.** Une entrée déjà portée (`consumed_at` non nul) ne peut pas l'être
  deux fois ; l'action est remplacée par un état « porté au journal ». Annuler est possible et
  **supprime les lignes créées** : le lien est conservé le temps de la journée par les identifiants
  des entrées créées.
- **R4 — Les cases d'un jour respectent la config de repas** de l'utilisateur (`resolveMealConfig`),
  dans son ordre, avec ses libellés.
- **R5 — Objectif du jour.** Chaque jour affiche `objectif` = cible calorique du profil, augmentée du
  **bonus jour d'entraînement** (`trainingDayCalories`) si une séance est planifiée ce jour-là **et**
  que le pilier correspondant est actif (décision H). Aucun pilier actif hors nutrition → aucun bonus
  affiché, aucune mention d'entraînement.
- **R6 — La liste de courses lit les ingrédients vivants**, pas les snapshots : `recipe_ingredients`
  et `meal_template_items` au moment de la génération.
- **R7 — Une quantité absente n'est jamais zéro.** `quantity_g` est nullable dans les deux tables
  sources. Un ingrédient sans quantité **n'est pas ignoré et n'est pas compté 0** : sa ligne porte la
  somme des contributions quantifiées **et** un compteur de contributions non précisées, restitué
  en clair (« + 2 sans quantité »). Additionner des `null` en silence produirait une liste fausse
  dans le sens le plus dangereux : trop peu.
- **R8 — Facteur de portion.** Les `recipe_ingredients` portent la quantité **totale de la recette**
  (la portion vaut `total / servings`). Planifier `P` portions d'une recette qui en produit `S`
  applique donc le facteur **`P / S`** à chaque ingrédient. Un repas type n'a pas de portions : son
  facteur est `servings` tel quel (1 par défaut).
- **R9 — Agrégation déterministe.** Clé d'agrégat = `food_id` s'il existe, sinon le **nom normalisé**
  (minuscules, accents retirés, espaces compactés). Aucun stemming, aucun pluriel deviné : « tomate »
  et « tomates » restent deux lignes — mieux vaut deux lignes justes qu'une fusion fausse.
- **R10 — Repas orphelin.** Une entrée dont la `meal_key` n'existe plus dans la config est regroupée
  sous le bucket « Autre » (`OTHER_MEAL_KEY`, déjà utilisé par NUTR-16), jamais masquée.
- **R11 — Source supprimée.** Si la recette ou le repas type d'une entrée est archivé, l'entrée de
  planning **reste visible** avec son `label` et ses macros snapshotées, mais **ne contribue plus
  aucun ingrédient** à la liste. La liste le signale (R12) au lieu de sous-estimer les courses en
  silence.
- **R12 — La liste dit ce qu'elle ne sait pas.** En tête : nombre de repas planifiés couverts,
  et le cas échéant le nombre d'entrées sans ingrédient exploitable (source supprimée, repas type
  vide).
- **R13 — Tri par rayon**, dans un ordre fixe de parcours de magasin : `vegetables`, `fruits`,
  `meat`, `fish`, `dairy`, `starchy`, `nuts`, `drinks`, `other` ; puis alphabétique dans chaque
  rayon, casse et accents ignorés. Déterministe, donc testable.
- **R14 — Cocher est purement local à la liste** : aucun effet sur le planning, le journal ou les
  stocks.
- **R15 — Le module est optionnel** et n'est atteint que volontairement, depuis le hub Nutrition.
  **Aucun réglage d'activation supplémentaire, aucun widget d'accueil** : un écran qu'on ouvre
  exprès n'a pas besoin d'un interrupteur, et le planning repas n'a pas sa place sur un tableau de
  bord quotidien.
- **R16 — Le passé est modifiable.** Cohérent avec la règle du journal (« le journal d'un jour passé
  est modifiable, pas de verrouillage »). Aucune borne de rétroactivité.

## 4. Décisions

| # | Question | Décision | Motif |
|---|---|---|---|
| **D1** | Que peut-on planifier ? | **Recette ou repas type.** Pas d'aliment simple seul. | Conforme au cadrage §6.1. Un aliment isolé se note en 5 s dans le journal ; l'intérêt du planning est la composition réutilisable. Ajoutable plus tard sans migration (`source_type` est une clé). |
| **D2** | Combien de cases par jour ? | **La config de repas de l'utilisateur.** | 4 en dur ferait régresser l'US 4.15. |
| **D3** | Le planning écrit-il dans le journal ? | **Non, jamais automatiquement** (R1/R2). | Un planning compté comme consommé fausserait totaux, adhérence, bilan hebdo, streak et analyses croisées. Non négociable. |
| **D4** | Statut « sauté » ? | **Non.** Seulement porté / pas porté. | Un troisième état demande une saisie que personne ne fera, et fabrique une fausse adhérence nutritionnelle. |
| **D5** | Liste figée ou dérivée ? | **Figée à la génération**, régénération explicite. | Une liste qui bouge au rayon, et des cases cochées perdues à chaque édition de recette. |
| **D6** | Unicité de la liste par semaine ? | **Aucune contrainte SQL** ; la plus récente gagne. | Une violation d'unicité bloque la file d'upload PowerSync en offline multi-appareils. |
| **D7** | Ingrédients snapshotés ou vivants ? | **Vivants** (R6), macros snapshotées. | On achète ce qu'on va cuisiner ; mais l'affichage du planning doit rester stable. |
| **D8** | Format d'export ? | **Texte brut** via `Share.share()` (React Native, déjà disponible). | Zéro dépendance native → **aucun nouveau build requis**, contrairement à PARTAGE-01 / RUN-F2a / MUSC-F9. Le PDF (`expo-print`) n'apporte rien à une liste lue en magasin. |
| **D9** | Quantité manquante ? | **Ligne conservée + compteur explicite** (R7). | Ni silence, ni zéro : les deux mènent à des courses incomplètes. |
| **D10** | Regroupement par rayon ? | **`foods.category` existante**, ordre de parcours fixe (R13). | Aucune taxonomie à créer, libellés déjà bilingues. |
| **D11** | Horizon planifiable ? | **Illimité** dans les deux sens, navigation semaine par semaine. | Cohérent avec la navigation du journal ; aucune raison de brider. |
| **D12** | Copier une semaine sur la suivante ? | **Oui, inclus** — « Dupliquer la semaine précédente ». **L'action n'est proposée que si la semaine source a du contenu** ; sinon le bouton est remplacé par une explication (tranché par Florian le 04/08/2026, après revue). | Sans ça, le planning est un travail de saisie que personne ne refait chaque dimanche. `duplicateDay`/`copyMeal` du journal donnent déjà l'idiome. Un bouton actif sur une semaine source vide « réussissait » sans rien copier et **sans aucun retour visuel** — le pire des trois cas possibles (agir, expliquer, mentir). |

**Tranchés par Florian le 04/08/2026** (les deux points ouverts à la rédaction) :

- **P1 → carte dédiée sur le hub Nutrition.** Le module demande un investissement de saisie avant de
  rendre sa valeur : caché, il ne serait jamais adopté. Il prend donc une carte visible sur l'onglet,
  au prix d'une place sur un hub déjà chargé.
- **P2 → cochage par rayon accepté**, avec le garde-fou ci-dessous (**D13**).

| # | Question | Décision | Motif |
|---|---|---|---|
| **D13** | Cocher un rayon entier d'un geste ? | **Oui** : tap sur l'en-tête de rayon. **Cocher ne demande rien** ; **dé-cocher un rayon entièrement coché demande confirmation**. | L'action utile (« j'ai déjà tout ce rayon ») doit rester à un tap. Le geste **destructeur** est celui qui efface un travail de magasin qu'on ne peut pas reconstituer de mémoire — lui seul est confirmé. Confirmer les deux sens aurait rendu la fonctionnalité plus lente que les taps qu'elle remplace. |

**Comportement précis de D13** — l'en-tête de rayon est un bouton à trois états :

| État du rayon | Tap | Confirmation |
|---|---|---|
| Aucun article coché | coche tout le rayon | non |
| Partiellement coché | coche **le reste** (jamais de dé-cochage implicite) | non |
| Entièrement coché | dé-coche tout le rayon | **oui** — « Décocher les N articles de {rayon} ? » |

Accessibilité : `accessibilityRole="button"`, libellé annonçant le rayon **et** son décompte
(« Légumes, 3 sur 5 cochés »), plus l'action à venir. Le cochage article par article reste
évidemment disponible — D13 est un raccourci, jamais le seul chemin.

## 5. Cas limites

| Situation | Comportement attendu |
|---|---|
| Semaine entièrement vide | Vue semaine avec ses cases vides + invitation à planifier. **Le bouton « générer la liste » est absent**, pas grisé sans explication. |
| **Semaine précédente vide** (source de duplication) | Le bouton « Dupliquer la semaine précédente » est **remplacé par un message** l'expliquant (« Rien à dupliquer : la semaine précédente est vide »). Jamais un bouton actif qui ne copie rien en silence — D12. Vrai aussi en reculant dans le passé, où les semaines antérieures sont vides. |
| Génération d'une liste sur une semaine vide | Impossible (bouton absent). Aucune liste vide n'est créée en base. |
| Recette sans aucun ingrédient | Planifiable (elle a des macros à 0). Compte dans les « entrées sans ingrédient exploitable » de R12. |
| Recette supprimée après planification | R11 : entrée conservée avec label et macros, exclue de la liste, signalée. |
| Repas renommé dans la config | La clé ne change pas → l'entrée suit le nouveau libellé. |
| Repas supprimé de la config | R10 : bucket « Autre ». |
| Ingrédient sans `food_id` (libre) | Agrégé par nom normalisé (R9), rayon `other`. |
| Deux recettes partageant un ingrédient | Une seule ligne, quantités sommées (R9). |
| `servings` non entier (1,5 portion) | Autorisé (`numeric`, `> 0`). Quantités arrondies **à l'affichage seulement**, jamais en base. |
| Liste régénérée alors que des cases étaient cochées | Nouvelle liste, **cases toutes décochées**, l'ancienne archivée. Annoncé avant confirmation. |
| Portage au journal d'une entrée d'un jour futur | Autorisé — R16, pas de verrouillage. C'est l'utilisateur qui sait. |
| Deux appareils génèrent la même semaine hors réseau | Deux listes ; la plus récente devient l'active (D6). Aucun échec de synchro. |
| Profil nutritionnel absent | Le planning fonctionne (composition et courses n'exigent pas de TDEE) ; **la ligne d'objectif est masquée**, pas affichée à 0. |

## 6. i18n (FR + EN)

Nouveau namespace **`mealPlan.*`** dans [fr.json](../../../../apps/mobile/src/i18n/locales/fr.json)
et [en.json](../../../../apps/mobile/src/i18n/locales/en.json) — les deux fichiers restent
**strictement de même longueur** (2 380 lignes aujourd'hui).

- `mealPlan.title`, `mealPlan.empty.*`, `mealPlan.week.*` (navigation, « Cette semaine »),
  `mealPlan.day.target` / `.plannedTotal` / `.trainingBonus`,
  `mealPlan.add.*` (choix recette / repas type, portions), `mealPlan.entry.consume`,
  `.consumed`, `.undo`, `.remove`, `mealPlan.duplicateWeek.*` (action + confirmation).
- `mealPlan.shopping.title`, `.generate`, `.regenerate.*` (dont l'avertissement de perte des cases
  cochées), `.summary` (repas couverts), `.unresolved` (entrées sans ingrédient — R12),
  `.unquantified` (« + {{count}} sans quantité » — R7, **pluralisable**), `.share`, `.empty`.
- **Rayons** : réutiliser `food.categories.*` **existantes**. Aucune clé de catégorie à créer.
- **Texte partagé** : traduit dans la langue **active** de l'app, en-tête daté (JJ/MM/AAAA en FR),
  une ligne par ingrédient précédée du rayon. Aucun émoji, aucun lien, aucune mention de l'app :
  un texte collable partout.

## 7. Comportement offline

Offline-first strict (décision B, [ADR-001](../../../adr/ADR-001-strategie-synchronisation.md)) :

- Les **trois tables sont locales d'abord** : planifier, générer, cocher, partager fonctionnent en
  mode avion. Aucun écran n'attend le réseau ; `isLoading` ne dépend que de la requête SQLite.
- UUID côté client, timestamps UTC, **soft delete**, écriture exclusivement via repository
  (`insertWithSyncFields` / `patch` / `softDelete`).
- Dates construites **composant par composant** depuis `AAAA-MM-JJ` — jamais `new Date('AAAA-MM-JJ')`,
  interprété UTC et donc décalé d'un jour selon le fuseau. Même précaution que `useWeekPlan`.
- ⚠️ **3 tables neuves ⇒ sync rules PowerSync à déployer à la main** sur le dashboard après la
  migration ([powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml)). **Étape
  manuelle déjà oubliée deux fois** sur ce projet (RUN-F2c, BIEN-01) : sans elle, un planning saisi
  ne survit pas à une resynchro.
- Les trois tables entrent dans l'**export RGPD** ([data-export.ts](../../../../apps/mobile/src/lib/data-export.ts)) —
  l'oubli de `session_intervals` le 03/08/2026 est le précédent à ne pas répéter.

## 8. Critères de recette

À vérifier sur device, par Florian ou Damien. **Aucun nouveau build n'est nécessaire** (D8 : aucune
dépendance native).

1. Le planning s'ouvre depuis le hub Nutrition et affiche la semaine courante, lundi en premier.
2. Les cases de chaque jour correspondent **exactement** aux repas configurés (en tester une config
   personnalisée : un repas renommé, un ajouté, un supprimé).
3. Déposer une recette en choisissant 2 portions : le total du jour augmente des macros de 2 portions.
4. Déposer un repas type : total cohérent avec le template.
5. Un jour avec séance muscu planifiée affiche un objectif **supérieur** à un jour de repos ; en
   désactivant les piliers muscu et course, la mention d'entraînement disparaît.
6. ◀ ▶ naviguent de semaine en semaine sans décalage de date (vérifier autour d'un changement de mois).
7. « Dupliquer la semaine précédente » recopie toutes les entrées, et **rien** dans le journal.
7 bis. Sur une semaine dont la **précédente est vide**, le bouton de duplication est **absent** et
    remplacé par « Rien à dupliquer… ». Il **réapparaît** dès qu'on planifie quelque chose la
    semaine d'avant (à vérifier sans quitter l'écran : la requête est réactive).
8. **Le journal du jour reste inchangé** après avoir planifié : totaux, barres de macros, streak.
9. « J'ai mangé ça » crée les lignes dans le bon repas du bon jour ; le total du journal bouge alors.
10. La même entrée ne peut pas être portée deux fois ; annuler retire bien les lignes créées.
11. Générer la liste : les ingrédients de deux recettes partageant un aliment sont **sur une seule
    ligne**, quantité sommée.
12. Une recette de 4 portions planifiée pour 2 contribue **la moitié** de ses ingrédients (R8) —
    à vérifier au gramme sur un cas préparé.
13. Un ingrédient sans quantité produit une ligne avec la mention « sans quantité », **et n'est pas
    compté 0**.
14. Les lignes sont groupées par rayon dans l'ordre de R13, alphabétique à l'intérieur.
15. Cocher, fermer l'app complètement, rouvrir : les cases restent cochées.
16. Régénérer avertit de la perte des cases cochées, et l'annulation ne régénère rien.
17. Partager ouvre la feuille Android ; le texte collé dans une note est lisible et complet.
18. **Mode avion** : planifier, générer, cocher, partager — tout fonctionne ; retour en ligne, tout
    remonte (vérifier sur le second appareil).
19. Basculer FR → EN : tous les libellés, y compris les rayons et le texte partagé, changent de langue.
20. Police système à 1,5× : aucune troncature ni chevauchement sur la vue semaine (l'écran le plus dense).
21. TalkBack : les cases du planning et les cases à cocher sont annoncées avec leur état.
22. Export RGPD : le fichier contient bien les entrées de planning et la liste de courses.
23. La **carte « Planning repas » est visible sur l'onglet Nutrition** (P1) et y mène en un tap.
24. **D13** : tap sur un en-tête de rayon partiellement coché → coche le reste **sans confirmation** ;
    re-tap sur le rayon désormais complet → **demande confirmation** avant de dé-cocher ; annuler ne
    dé-coche rien. TalkBack annonce le rayon avec son décompte.

## 9. Ce que cette US ne fait pas

- Génération IA du plan · garde-mangers / stocks · unités non pondérales · prix · courses en ligne ·
  notifications · partage social · PDF · planning des repas **d'autres personnes** (foyer).
- Elle **ne touche à aucune analyse existante** : `food_entries` reste la seule source du consommé.
