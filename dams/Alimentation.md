# Alimentation

## Profil nutritionnel

Configuré lors de l'onboarding, modifiable à tout moment. Sert de référence pour tous les calculs de l'app.

### Objectif nutritionnel
| Valeur | Description |
|---|---|
| Prise de masse | Surplus calorique (+200 à +400 kcal/jour) |
| Sèche | Déficit calorique (−300 à −500 kcal/jour) |
| Maintien | Apport = dépense estimée |
| Perte de poids progressive | Déficit modéré (−250 kcal/jour) |

### Calcul du besoin calorique (TDEE)
- Formule de base : **Mifflin-St Jeor** (métabolisme de base)
  - Homme : `10 × poids (kg) + 6,25 × taille (cm) − 5 × âge + 5`
  - Femme : `10 × poids (kg) + 6,25 × taille (cm) − 5 × âge − 161`
  - Si le sexe n'est pas renseigné : moyenne des deux formules
- Facteur d'activité :
  - Sédentaire (×1,2)
  - Légèrement actif 1-2j/sem (×1,375)
  - Modérément actif 3-5j/sem (×1,55)
  - Très actif 6-7j/sem (×1,725)
  - Extrêmement actif (×1,9)
- Ajustement automatique selon le planning d'entraînement (jours muscu/running → facteur plus élevé)
- Ajustement manuel possible : l'utilisateur peut fixer un objectif calorique différent du calcul

### Répartition des macros
- Répartition par défaut selon l'objectif :
  - Prise de masse : P 30 % / G 45 % / L 25 %
  - Sèche : P 40 % / G 35 % / L 25 %
  - Maintien : P 25 % / G 50 % / L 25 %
- Modifiable manuellement (en grammes ou en pourcentage)
- L'app recalcule automatiquement les deux vues (% ↔ grammes)

### Restrictions / Préférences
- Cases à cocher : végétarien / végétalien / sans gluten / sans lactose / halal / casher
- Allergènes : liste libre + sélection dans une liste prédéfinie (arachides, fruits à coque, etc.)
- Influence les suggestions de recettes (V2) mais pas le journal (l'utilisateur reste libre)

---

## Base d'aliments

Référentiel utilisé pour composer les repas et calculer les apports.

### Structure d'un aliment
| Champ | Description |
|---|---|
| Nom | Ex. "Blanc de poulet cuit" |
| Valeurs pour 100 g | Calories, protéines, glucides (dont sucres), lipides (dont saturés), fibres |
| Catégorie | Viandes / Poissons / Féculents / Légumes / Fruits / Produits laitiers / Oléagineux / Boissons / Autre |
| Code-barres | Si disponible (pour la recherche par scan) |
| Source | App (vérifiée) / Utilisateur (custom) / OpenFoodFacts (importée) |

### Recherche d'aliment
- Recherche par nom (avec suggestions en temps réel)
- Scan du code-barres (caméra) → correspondance dans la base ou import depuis OpenFoodFacts
- Historique des aliments récemment utilisés
- Liste des aliments favoris (étoile)

### Aliments personnalisés
- L'utilisateur peut créer un aliment avec ses propres valeurs nutritionnelles
- Champs obligatoires : nom + calories pour 100 g
- Champs facultatifs : macros détaillées
- Flaggés "personnalisé" dans la liste

---

## Journal alimentaire

Vue principale du pilier alimentation. Représente une journée.

### Structure de la journée
- 4 repas par défaut : Petit-déjeuner / Déjeuner / Dîner / Collation
- Repas supplémentaires ajoutables (ex. "Pré-workout", "Post-workout")
- Renommage libre de chaque repas

### Ajout d'un aliment à un repas
1. Sélectionner le repas cible
2. Rechercher l'aliment (texte ou scan)
3. Saisir la quantité (portion usuelle proposée par défaut, grammes toujours disponibles)
4. L'aliment apparaît dans le repas avec ses valeurs calculées
5. Modification / suppression possible à tout moment

### Portions usuelles
- Chaque aliment peut définir une ou plusieurs portions ("1 œuf = 60 g", "1 tranche = 25 g", "1 cuillère à soupe = 15 g")
- La saisie propose la portion par défaut de l'aliment ; la bascule vers les grammes reste à un tap
- Les portions des aliments OpenFoodFacts sont importées quand elles existent

### Saisie rapide
- **Saisie par liste (langage naturel)** : écrire ou dicter tout un repas en une phrase, l'app retrouve les ingrédients un à un (voir ci-dessous)
- **Copier un repas** : dupliquer un repas d'un jour précédent ("même petit-déj qu'hier") en 2 taps
- **Dupliquer une journée** : recopier le journal complet d'un jour passé sur le jour courant
- **Quick add** : ajout direct de calories (+ macros optionnelles) sans recherche d'aliment — pour les repas au restaurant ou estimés

### Saisie par liste (langage naturel)

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
4. Chaque nom est recherché dans la **base d'aliments** (recherche floue, tolérante aux fautes et au pluriel), en s'appuyant sur les **portions usuelles** (« tranche », « cuillère à soupe »…).
5. Un **écran de revue** affiche les ingrédients reconnus, un par ligne, **avant validation**.

**Écran de revue**
- Chaque ligne : aliment reconnu + quantité/portion interprétée, **modifiables** (ajuster la quantité, changer de portion, remplacer par un autre aliment si le bon match n'est pas retenu).
- Item **non reconnu** ou ambigu : proposition des meilleures correspondances, ou bouton **rechercher / créer l'aliment**.
- Ajout / suppression d'une ligne à la main possible.
- **Rien n'est ajouté au journal tant que l'utilisateur n'a pas confirmé.**

**Disponibilité**
- Le découpage et l'extraction fonctionnent **hors-ligne** (analyse locale de la phrase + recherche dans la base en cache).
- Une amélioration de l'interprétation via service en ligne (meilleure désambiguïsation) est une **option à trancher** — voir [[Architecture Technique]] (pas de dépendance obligatoire au réseau pour la saisie de base).

### Total du jour
- Affichage permanent en haut de la vue journal :
  - Calories consommées / objectif (ex. 1 840 / 2 500 kcal)
  - Calories restantes (ou dépassement en rouge)
  - Barres de progression par macro (P / G / L) avec valeurs en grammes et %

### Navigation temporelle
- Boutons "◀ Hier / Aujourd'hui / Demain ▶" pour naviguer entre les jours
- Calendrier accessible via icône (vue mensuelle, jours avec journal complété surlignés)
- Pas de limite de rétroactivité (on peut saisir un repas d'il y a 2 semaines)

---

## Recettes & Repas types

Permet de composer un "plat" à partir de plusieurs aliments, puis de le réutiliser en un seul ajout.

### Création d'une recette
- Nom de la recette
- Ajout des ingrédients (aliments + quantités)
- Nombre de portions (calcule les valeurs par portion)
- Valeurs nutritionnelles calculées automatiquement et affichées

### Utilisation d'une recette
- Apparaît dans la recherche d'aliments au même titre qu'un aliment simple
- On choisit le nombre de portions à ajouter
- Les détails des ingrédients sont conservés pour consultation

### Repas types ("templates")
- Possibilité d'enregistrer un repas entier (composition d'un repas du journal) comme template
- Réutilisable en 1 tap : "Ajouter mon petit-déj habituel" → pré-remplit tout le repas

---

## Planning repas

Module optionnel. Permet de planifier les repas de la semaine à l'avance.

### Création du planning
- Vue calendrier semaine avec 4 cases par jour (repas)
- Remplir chaque case avec une recette ou un repas type
- Les valeurs nutritionnelles de la journée sont calculées en temps réel

### Lien avec le planning d'entraînement
- Les jours d'entraînement (muscu ou running) affichent un objectif calorique adapté (+100 à +300 kcal selon intensité)
- Les jours de repos affichent l'objectif standard
- Visualisation claire de l'adaptation jour d'entraînement vs repos

### Liste de courses générée
- À partir du planning de la semaine, génère la liste de tous les ingrédients nécessaires
- Regroupés par catégorie (légumes, féculents, protéines…)
- Cases à cocher pour faire les courses
- Exportable / partageable (texte ou PDF)

---

## Suivi & Progression

### Poids corporel
- Saisie du poids depuis ce module ou depuis le profil utilisateur
- Courbe d'évolution sur 4 sem / 3 mois / 1 an
- Affichage de la tendance (prise / perte / stable)
- Objectif de poids optionnel → progression affichée en %

### Évolution des apports
- Calories moyennes sur les 7 / 30 derniers jours
- Moyenne par macro
- Jours avec objectif atteint (≥ 90 % et ≤ 110 % des calories cibles)

### Corrélation avec la musculation
- Vue croisée : séances muscu vs apports caloriques de la même semaine
- Alerte si déficit calorique important sur une semaine à fort volume d'entraînement

---

## Règles métier

- Le journal d'un jour passé est modifiable (pas de verrouillage).
- La saisie par liste ne modifie jamais le journal sans confirmation : les ingrédients reconnus sont toujours proposés en revue, jamais ajoutés automatiquement. Un item non reconnu n'est pas ignoré silencieusement (proposition de recherche ou de création).
- Un aliment scanné non trouvé dans la base peut être créé manuellement par l'utilisateur.
- Si l'utilisateur change son objectif nutritionnel, l'historique passé n'est pas recalculé.
- Les macros en grammes priment sur les pourcentages en cas d'incohérence de saisie.
- Un repas template peut être modifié sans affecter les journaux passés où il a été utilisé (snapshot au moment de l'ajout).
- Les valeurs nutritionnelles s'entendent pour le poids indiqué de l'aliment (cru pour les aliments bruts). Une mention "cru / cuit" est affichée sur les aliments concernés (riz, pâtes, viandes) pour limiter les erreurs de saisie.
- Le suivi de l'hydratation n'est pas en V1 (reporté V2).
