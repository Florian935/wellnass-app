# Modèle de données

> Grandes entités du domaine, reprises de « Architecture Technique » (cadrage Dams) et adaptées aux contraintes de synchronisation **PowerSync** (décision B, 04/07/2026) et au périmètre 3 piliers (décision A).
> Réf. : [architecture.md](./architecture.md) · [offline-sync.md](./offline-sync.md) · [i18n.md](./i18n.md).
> Ce document décrit le **modèle logique** (entités, relations). Le schéma SQL détaillé (Postgres + local) sera figé **après le spike PowerSync** ([spike-001-powersync.md](./spike-001-powersync.md)).

---

## 1. Champs de synchro transverses (toutes les entités)

Toute entité synchronisée porte les colonnes suivantes, imposées par l'offline-first + PowerSync (voir [offline-sync.md](./offline-sync.md) §6) :

| Champ | Type | Rôle |
|---|---|---|
| `id` | UUID | **Généré côté client** (pas d'attente serveur en offline). Clé stable de réconciliation local ↔ serveur. |
| `user_id` | UUID | Propriétaire (entités utilisateur). Base de la RLS et des **sync rules** PowerSync (un bucket par utilisateur). Absent des tables de contenu global. |
| `created_at` | timestamptz (UTC) | Horodatage de création. Conversion locale **uniquement à l'affichage**. |
| `updated_at` | timestamptz (UTC) | Dernière modification. Support de la réconciliation. |
| `deleted_at` | timestamptz (UTC), nullable | **Soft delete** : une suppression doit se propager entre appareils. Les lignes non nulles sont exclues des sync rules et des lectures applicatives. |

> **Contrainte PowerSync** : identifiants UUID stables, timestamps UTC, soft delete plutôt que suppression dure (un delete dur ne se réplique pas proprement). Contenu de la bibliothèque (exercices, programmes publiés, aliments) répliqué en **lecture seule** vers l'app.

---

## 2. Arbre des entités

```
User
  ├── Profile (poids, taille, objectif, prénom, date de naissance, sexe…)
  ├── NutritionProfile (objectif calorique, macros, restrictions/allergènes, TDEE)
  ├── RunnerProfile (allure de référence, niveau, FCmax [préparé V2]…)
  └── Settings (unités métrique/impérial, thème, langue, notifications, disposition dashboard)

Program (muscu ou running)          [contenu éditorial OU custom utilisateur]
  └── Session[]                     (séance type dans le programme)
        └── ExercisePlan[]  (muscu : exercice + séries/reps/repos prévus)
          | SessionBlock[]  (running : bloc endurance / fractionné / récup…)
  └── ProgramTranslation[]          (nom, résumé, description — par langue)

Workout (séance RÉALISÉE : planifiée ou libre)
  ├── Set[]          (muscu — type : normale / échauffement / superset / durée / poids de corps ± lest ;
  │                    mesure : charge × reps, ou durée, ou reps + lest/assistance)
  │   | GPSPoint[]   (running — trace GPS ; volumineux, à valider avec PowerSync)
  ├── PersonalRecord[]  (records battus lors de la séance)
  └── ressenti global (RPE / étoiles), notes, durée, conditions (running)

Exercise (bibliothèque : app OU perso ; avec GIF de démonstration)
  └── ExerciseTranslation[] (name, instructions — par langue ; voir i18n)

FoodLog (journal alimentaire d'une journée)
  └── Meal[]                 (petit-déj / déjeuner / dîner / collation, renommables)
        └── FoodEntry[]      (aliment + quantité → valeurs calculées, snapshot des valeurs)

Food (aliment : app vérifié / OpenFoodFacts / perso utilisateur)
  └── FoodTranslation[]      (name — par langue ; valeurs nutritionnelles = numériques, universelles)
Recipe (recette réutilisable)
  └── RecipeIngredient[]
MealTemplate (repas type réutilisable — snapshot à l'ajout)
MealPlan (planning repas de la semaine)
  └── ShoppingList (liste de courses générée)

BodyWeightEntry (historique des pesées ; alimente le TDEE)
Streak (jours consécutifs actifs — calculé, dérivable de l'historique)
```

---

## 3. Notes par groupe d'entités

### 3.1 Utilisateur & profils
- `User` provient de Supabase Auth (`auth.users`). Les tables `Profile` / `NutritionProfile` / `RunnerProfile` / `Settings` sont propres à l'app, liées par `user_id`, synchronisées bidirectionnellement.
- `Settings.language` est **synchronisé** (cohérence entre appareils + rendu des notifications serveur, voir [i18n.md](./i18n.md) §7).
- **Langue ≠ unités ≠ région** : trois axes indépendants (ne jamais coupler `lang === 'en'` avec `units === 'imperial'`).

### 3.2 Programmes & séances
- `Program` : un seul **actif par pilier** par utilisateur ; en changer désactive le précédent **sans perdre l'historique**. Les programmes éditoriaux (back-office) sont en lecture seule dans l'app ; « dupliquer pour personnaliser » crée un `Program` custom appartenant à l'utilisateur.
- Distinction structurante : `Program/Session/ExercisePlan|SessionBlock` = le **plan** (prévu) ; `Workout/Set|GPSPoint` = le **réalisé** (historique). Une séance libre crée un `Workout` sans `Session` de rattachement.

### 3.3 Muscu — sets & records
- `Set.type` : normale / échauffement (exclue du volume, records, progression) / superset / durée / poids de corps.
- `PersonalRecord` : charge max, 1RM estimé (**Epley** `charge × (1 + reps/30)`), meilleur reps×charge. Calculés automatiquement.

### 3.4 Running — trace GPS
- `GPSPoint[]` peut être **volumineux** (100 km de points). Comportement PowerSync sur ce volume = **point de validation prioritaire du spike** ([offline-sync.md](./offline-sync.md) §7). Downsampling Douglas-Peucker à l'affichage (on stocke tout, on n'affiche pas tout).
- Records running (1/5/10 km, semi, marathon) calculés depuis la trace (meilleur segment glissant).

### 3.5 Nutrition
- `FoodEntry` et `MealTemplate` stockent un **snapshot** des valeurs au moment de l'ajout (l'historique n'est pas recalculé si l'aliment ou l'objectif change ultérieurement).
- `Food.source` : app vérifié / OpenFoodFacts / perso utilisateur. Les aliments **persos ne sont jamais traduits** (langue de saisie).

### 3.6 Contenu multilingue
- `ExerciseTranslation`, `ProgramTranslation`, `FoodTranslation` : **table de traductions liée** (une ligne par langue) plutôt que colonnes `name_fr`/`name_en` — extensible sans migration à chaque langue. Fallback FR si traduction manquante. **FR + EN remplis dès le lancement** (décision G). Détail dans [i18n.md](./i18n.md) §4.
- Les enums (muscles, matériel, catégories d'aliments, types de séance) ne sont **pas** traduits en base : dictionnaire i18n côté UI.

---

## 4. Compatibilité gamification future (V3/V4)

Toutes les activités (`Workout`, `Meal`/`FoodLog` validé, `BodyWeightEntry`) sont **historisées avec horodatage** et jamais supprimées durement (soft delete). Cet historique constitue un **journal d'événements horodaté** sur lequel une future couche jeu (décision C, reportée V3/V4) pourra se brancher **sans refonte du modèle** — aucune table de jeu n'est créée en V1. `Streak` et `PersonalRecord` sont conservés en V1 (classés « motivation », pas « jeu »).
