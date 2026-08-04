# Spécification fonctionnelle — Alimentation

> Base documentaire unifiée · Pilier Alimentation.
> Source : cadrage de Damien (fusionné dans cette base).
> Décisions actées appliquées ici : **A** (nutrition dans le périmètre V1), **G** (FR + EN — base CIQUAL FR à traduire), **H** (module utile seul, intégration opt-in).
> Statut : à jour · Date : 04/07/2026.

---

## 1. Objectif du document

Décrire le pilier Alimentation : profil nutritionnel et calcul du besoin calorique (TDEE), base d'aliments (CIQUAL + OpenFoodFacts), journal alimentaire, recettes et repas types, planning des repas, suivi et progression. Ce pilier est dans le périmètre V1 (décision A) et reste **utile seul** ; son intégration avec l'entraînement (adaptation calorique les jours de séance) est une couche **opt-in** (décision H).

**Point d'attention V1 (décision G) :** la base d'aliments de référence **CIQUAL est en français** → une **traduction EN est requise** pour le lancement bilingue (UI **et** contenu de base). À intégrer dans la charge de la version, pas en fin de projet.

---

## 2. Profil nutritionnel

Configuré lors de l'onboarding, modifiable à tout moment. Sert de référence à tous les calculs de l'app.

### 2.1 Objectif nutritionnel

| Valeur | Description |
|---|---|
| Prise de masse | Surplus calorique (+200 à +400 kcal/jour) |
| Sèche | Déficit calorique (−300 à −500 kcal/jour) |
| Maintien | Apport = dépense estimée |
| Perte de poids progressive | Déficit modéré (−250 kcal/jour) |

### 2.2 Calcul du besoin calorique (TDEE)

- Formule de base : **Mifflin-St Jeor** (métabolisme de base) :
  - Homme : `10 × poids (kg) + 6,25 × taille (cm) − 5 × âge + 5`
  - Femme : `10 × poids (kg) + 6,25 × taille (cm) − 5 × âge − 161`
  - Si le sexe n'est pas renseigné : **moyenne des deux formules**.
- **Facteur d'activité** :
  - Sédentaire (×1,2)
  - Légèrement actif 1-2 j/sem (×1,375)
  - Modérément actif 3-5 j/sem (×1,55)
  - Très actif 6-7 j/sem (×1,725)
  - Extrêmement actif (×1,9)
- **Ajustement automatique** selon le planning d'entraînement (jours muscu/running → facteur plus élevé) — intégration opt-in avec les autres piliers (décision H).
- **Ajustement manuel** possible : l'utilisateur peut fixer un objectif calorique différent du calcul.

### 2.3 Répartition des macros

- Répartition par défaut selon l'objectif :
  - Prise de masse : P 30 % / G 45 % / L 25 %
  - Sèche : P 40 % / G 35 % / L 25 %
  - Maintien : P 25 % / G 50 % / L 25 %
- **Modifiable** manuellement (en grammes ou en pourcentage).
- L'app recalcule automatiquement les deux vues (% ↔ grammes).

### 2.4 Restrictions / Préférences

- Cases à cocher : végétarien / végétalien / sans gluten / sans lactose / halal / casher.
- **Allergènes** : liste libre + sélection dans une liste prédéfinie (arachides, fruits à coque, etc.).
- Influence les suggestions de recettes (V2) mais **pas le journal** (l'utilisateur reste libre).

---

## 3. Base d'aliments

Référentiel utilisé pour composer les repas et calculer les apports. Sources combinées : **CIQUAL** (base officielle française — nécessite traduction EN, décision G) + **OpenFoodFacts** (import par code-barres) + aliments custom + aliments vérifiés par l'app.

### 3.1 Structure d'un aliment

| Champ | Description |
|---|---|
| Nom | Ex. « Blanc de poulet cuit » |
| Valeurs pour 100 g | Calories, protéines, glucides (dont sucres), lipides (dont saturés), fibres |
| Catégorie | Viandes / Poissons / Féculents / Légumes / Fruits / Produits laitiers / Oléagineux / Boissons / Autre |
| Code-barres | Si disponible (recherche par scan) |
| Source | App (vérifiée) / Utilisateur (custom) / OpenFoodFacts (importée) / CIQUAL (base FR) |

### 3.2 Recherche d'aliment

- Recherche par **nom** (suggestions en temps réel).
- **Scan du code-barres** (caméra) → correspondance dans la base ou import depuis OpenFoodFacts.
- **Historique** des aliments récemment utilisés.
- **Favoris** (étoile).

### 3.3 Aliments personnalisés

- L'utilisateur peut créer un aliment avec ses propres valeurs.
- Champs obligatoires : **nom + calories pour 100 g**.
- Champs facultatifs : macros détaillées.
- Flaggés « personnalisé » dans la liste.

---

## 4. Journal alimentaire

Vue principale du pilier. Représente une journée.

### 4.1 Structure de la journée
- **4 repas par défaut** : Petit-déjeuner / Déjeuner / Dîner / Collation.
- Repas supplémentaires ajoutables (ex. « Pré-workout », « Post-workout »).
- Renommage libre de chaque repas.

### 4.2 Ajout d'un aliment à un repas
1. Sélectionner le repas cible.
2. Rechercher l'aliment (texte ou scan).
3. Saisir la quantité (portion usuelle par défaut, grammes toujours disponibles).
4. L'aliment apparaît dans le repas avec ses valeurs calculées.
5. Modification / suppression possible à tout moment.

### 4.3 Portions usuelles
- Chaque aliment peut définir une ou plusieurs portions (« 1 œuf = 60 g », « 1 tranche = 25 g », « 1 c. à soupe = 15 g »).
- La saisie propose la portion par défaut de l'aliment ; bascule vers les grammes en un tap.
- Les portions des aliments OpenFoodFacts sont importées quand elles existent.

### 4.4 Saisie rapide
- **Saisie par liste (langage naturel)** : écrire ou dicter tout un repas en une phrase, l'app retrouve les ingrédients un à un (§ 4.5).
- **Copier un repas** : dupliquer un repas d'un jour précédent (« même petit-déj qu'hier ») en 2 taps.
- **Dupliquer une journée** : recopier le journal complet d'un jour passé sur le jour courant.
- **Quick add** : ajout direct de calories (+ macros optionnelles) sans recherche d'aliment (restaurant, repas estimé).

### 4.5 Saisie par liste (langage naturel)

Permet de saisir un repas entier en **une seule phrase en texte libre**, au lieu d'ajouter les aliments un par un. L'app découpe la phrase et **retrouve chaque ingrédient** dans la base.

**Exemple**
> Saisie : *« 1 banane avec 4 tranches de pain de mie et du beurre de cacahuète »*
>
> Résultat proposé :
> | Quantité | Aliment reconnu | Statut |
> |---|---|---|
> | 1 portion (≈ 120 g) | Banane | ✅ trouvé |
> | 4 tranches (≈ 100 g) | Pain de mie | ✅ trouvé |
> | 1 portion (≈ 15 g) | Beurre de cacahuète | ✅ trouvé |

**Fonctionnement**
1. L'utilisateur écrit (ou **dicte** au micro) la liste des aliments d'un repas.
2. L'app **segmente** la phrase (séparateurs : « et », « avec », virgules, retours à la ligne) en items distincts.
3. Pour chaque item, elle **extrait** la quantité + l'unité/portion (« 4 tranches », « 1 », « du » → quantité par défaut) et le **nom de l'aliment**.
4. Chaque nom est recherché dans la **base d'aliments** (recherche floue, tolérante aux fautes et au pluriel), en s'appuyant sur les **portions usuelles**.
5. Un **écran de revue** affiche les ingrédients reconnus, un par ligne, **avant validation**.

**Écran de revue**
- Chaque ligne : aliment reconnu + quantité/portion interprétée, **modifiables**.
- Item **non reconnu** ou ambigu : proposition des meilleures correspondances, ou bouton **rechercher / créer l'aliment**.
- Ajout / suppression d'une ligne à la main possible.
- **Rien n'est ajouté au journal tant que l'utilisateur n'a pas confirmé.**

**Disponibilité**
- Le découpage et l'extraction fonctionnent **hors-ligne** (analyse locale + recherche dans la base en cache).
- Une amélioration de l'interprétation via service en ligne (meilleure désambiguïsation) est une **option à trancher** — pas de dépendance obligatoire au réseau pour la saisie de base.
- La segmentation doit fonctionner en **FR et EN** (décision G).

### 4.6 Total du jour
- Affiché en permanence en haut du journal :
  - Calories consommées / objectif (ex. 1 840 / 2 500 kcal).
  - Calories restantes (ou dépassement en rouge).
  - Barres de progression par macro (P / G / L) avec valeurs en grammes et %.

### 4.7 Navigation temporelle
- Boutons « ◀ Hier / Aujourd'hui / Demain ▶ ».
- Calendrier accessible via icône (vue mensuelle, jours complétés surlignés).
- Pas de limite de rétroactivité (saisie d'un repas d'il y a 2 semaines possible).

---

## 5. Recettes & Repas types

Permet de composer un « plat » à partir de plusieurs aliments, puis de le réutiliser en un seul ajout.

### 5.1 Création d'une recette
- Nom de la recette.
- Ajout des ingrédients (aliments + quantités).
- Nombre de portions (calcule les valeurs par portion).
- Valeurs nutritionnelles calculées automatiquement.

### 5.2 Utilisation d'une recette
- Apparaît dans la recherche d'aliments au même titre qu'un aliment simple.
- Choix du nombre de portions à ajouter.
- Détails des ingrédients conservés pour consultation.

### 5.3 Repas types (« templates »)
- Enregistrer un repas entier (composition d'un repas du journal) comme template.
- Réutilisable en 1 tap : « Ajouter mon petit-déj habituel » → pré-remplit tout le repas.

---

## 6. Planning repas

Module **optionnel**. Permet de planifier les repas de la semaine à l'avance.

> **Livré par l'US REPAS-01 le 04/08/2026** (roadmap 4.27 / 4.28 / 4.29) →
> [spec](./us/repas01-planning-repas-liste-courses.md). Deux points de cette section, écrits au
> cadrage initial, étaient **périmés** et ont été corrigés ci-dessous : le nombre de repas et le
> format d'export.

### 6.1 Création du planning
- Vue calendrier semaine, une case par **repas configuré par l'utilisateur**.
  ⚠️ Et non « 4 cases par jour » comme annoncé jusqu'au 04/08/2026 : depuis l'**US 4.15**, les repas
  sont **personnalisables** (`nutrition_profiles.meals`) — renommables, ajoutables, supprimables.
  Coder quatre cases en dur ferait régresser une fonctionnalité livrée.
- Remplir chaque case avec une recette (avec un nombre de portions) ou un repas type.
- Valeurs nutritionnelles de la journée calculées en temps réel.
- 🔴 **Le planning n'écrit jamais dans le journal.** C'est une intention : les totaux du jour,
  l'adhérence, le streak, le bilan hebdo et les analyses inter-piliers ne voient que le consommé
  réel. Porter un repas planifié au journal est un **geste explicite** et réversible
  (REPAS-01, règles R1 à R3).

### 6.2 Lien avec le planning d'entraînement (intégration opt-in, décision H)
- Les jours d'entraînement (muscu ou running) affichent un objectif calorique adapté.
- Les jours de repos affichent l'objectif standard.
- Visualisation claire de l'adaptation jour d'entraînement vs repos.
- Le bonus appliqué est le **forfait fixe** du profil (`trainingDayBonus`), pas le mode `auto` de
  RN-02 : celui-ci dérive le bonus de la dépense d'une course **déjà enregistrée**, notion qui n'a
  pas de sens pour un jour futur — c'est-à-dire pour tout planning.
- Aucun pilier d'entraînement actif → aucune mention d'entraînement (décision H).

### 6.3 Liste de courses générée
- À partir du planning de la semaine, génère la liste de tous les ingrédients nécessaires.
- Regroupés par **rayon**, dans un ordre de parcours de magasin — les 9 catégories de
  `foods.category`, déjà bilingues.
- Cases à cocher pour faire les courses, persistées. Un tap sur un en-tête de rayon coche tout le
  rayon ; le dé-cocher entièrement demande confirmation (REPAS-01, décision D13).
- Exportable / partageable en **texte brut** via la feuille de partage du système.
  ⚠️ Et non « texte ou PDF » : un PDF imposerait `expo-print`, donc une dépendance native, donc un
  nouveau build avant toute recette — pour un gain nul sur une liste lue dans un magasin
  (REPAS-01, décision D8).
- Une quantité manquante n'est **jamais comptée 0** : elle est signalée en clair, sans quoi la liste
  serait incomplète sans le dire (règle R7).

---

## 7. Suivi & Progression

### 7.1 Poids corporel
- Saisie du poids depuis ce module ou depuis le profil (voir [compte-profil-onboarding.md](./compte-profil-onboarding.md)).
- Courbe d'évolution sur 4 sem / 3 mois / 1 an.
- Tendance (prise / perte / stable).
- Objectif de poids optionnel → progression affichée en %.

### 7.2 Évolution des apports
- Calories moyennes sur 7 / 30 derniers jours.
- Moyenne par macro.
- Jours avec objectif atteint (≥ 90 % et ≤ 110 % des calories cibles).

### 7.3 Corrélation avec la musculation (intégration opt-in, décision H)
- Vue croisée : séances muscu vs apports caloriques de la même semaine.
- Alerte si déficit calorique important sur une semaine à fort volume d'entraînement.

---

## 8. Règles métier

- Le journal d'un jour passé est **modifiable** (pas de verrouillage).
- La **saisie par liste ne modifie jamais le journal sans confirmation** : les ingrédients reconnus sont proposés en revue, jamais ajoutés automatiquement. Un item non reconnu n'est pas ignoré silencieusement (proposition de recherche ou de création).
- Un aliment **scanné non trouvé** peut être créé manuellement.
- Si l'utilisateur change son objectif nutritionnel, **l'historique passé n'est pas recalculé**.
- Les **macros en grammes priment** sur les pourcentages en cas d'incohérence de saisie.
- Un **repas template** peut être modifié sans affecter les journaux passés (snapshot au moment de l'ajout).
- Les valeurs s'entendent pour le poids indiqué de l'aliment (cru pour les aliments bruts). Une mention **« cru / cuit »** est affichée sur les aliments concernés (riz, pâtes, viandes).
- Le **suivi de l'hydratation n'est pas en V1** (reporté V2).
- **Poids et taille obligatoires** pour activer le suivi alimentaire (calcul TDEE — voir [compte-profil-onboarding.md](./compte-profil-onboarding.md)).

---

## 9. Adaptations liées aux décisions actées

- **Décision A** : nutrition maintenue dans le périmètre V1.
- **Décision G (FR + EN)** : la base **CIQUAL (FR)** doit être **traduite en EN** pour le lancement bilingue ; la saisie langage naturel doit fonctionner en FR et EN ; UI et libellés bilingues.
- **Décision H (sans imposition)** : les intégrations (ajustement calorique jours d'entraînement, corrélation muscu, restrictions) sont **opt-in** et n'imposent rien au journal ; le module reste utile seul.
