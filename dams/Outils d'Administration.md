# Outils d'Administration

Interface back-office web (séparée de l'app mobile) permettant à l'équipe de gérer le contenu de la plateforme : exercices, programmes, aliments.

Accessible uniquement par des comptes avec un rôle admin (`super_admin`, `content_editor` ou `moderator` — voir Rôles & Permissions).

---

## Architecture de l'admin

- **Type** : Application web (pas mobile)
- **Stack suggérée** : React + Vite, ou Next.js (admin interne, pas besoin d'optimisation SEO)
- **Auth** : Même système que l'app (JWT) avec vérification du rôle admin côté API
- **URL** : Sous-domaine dédié (ex. `admin.appfitness.com`)

---

## Module — Gestion des Exercices

Le module le plus riche de l'admin : chaque exercice embarque sa fiche complète et sa démonstration animée (GIF).

### Liste des exercices
- Tableau paginé avec colonnes : Nom / Groupe musculaire / Matériel / Difficulté / Statut (publié / brouillon)
- Filtres : groupe musculaire, matériel, difficulté, statut
- Recherche par nom
- Actions rapides : dupliquer, archiver, changer de statut

### Formulaire exercice (création / édition)

**Onglet Informations**
| Champ | Type | Obligatoire |
|---|---|---|
| Nom | Texte | Oui |
| Muscles ciblés (principal) | Sélecteur (liste fixe) | Oui |
| Muscles ciblés (secondaires) | Multi-sélecteur | Non |
| Matériel requis | Multi-sélecteur | Oui |
| Difficulté | 1 à 5 étoiles | Oui |
| Type de mouvement | Enum (Poussée / Tirage / Squat / Charnière / Gainage / Isolation) | Oui |
| Consignes techniques | Éditeur de texte riche (markdown) | Non |
| Variantes liées | Sélecteur multi (autres exercices) | Non |
| Statut | Brouillon / Publié | Oui |

**Onglet Média**
- Upload du GIF de démonstration (boucle du mouvement) — source : base open source importée ou upload manuel (voir [[Musculation]] § Source des démonstrations)
- Upload image de couverture (thumbnail dans les listes)
- Prévisualisation inline
- Import en masse : lors de l'import initial de la base d'exercices (JSON + GIF), les fiches sont créées en statut brouillon puis publiées après relecture

### Gestion des muscles
- Référentiel fixe des groupes musculaires : Pectoraux / Dos / Épaules / Biceps / Triceps / Abdominaux / Fessiers / Quadriceps / Ischio-jambiers / Mollets
- Sous-groupes modifiables par un super-admin uniquement

---

## Module — Gestion des Programmes

### Liste des programmes
- Tableau : Nom / Pilier (muscu ou running) / Niveau / Durée / Statut
- Filtre par pilier, niveau, statut

### Formulaire programme

**Métadonnées**
- Nom, résumé, objectif, niveau, durée (semaines), fréquence hebdo, créateur (texte), image de couverture

**Constructeur de séances**
- Vue semaine type : cases par jour (lundi → dimanche)
- Drag & drop des types de séance dans les cases
- Pour chaque séance : ajout d'exercices depuis la bibliothèque, définition séries/reps/charge/repos
- Aperçu de la progression semaine par semaine (vue condensée)

**Publication**
- Brouillon → Publié (avec confirmation)
- Un programme publié est visible dans l'app pour tous les utilisateurs
- Modification d'un programme publié crée automatiquement une version brouillon (les utilisateurs actifs sur l'ancienne version ne sont pas affectés)

---

## Module — Base d'Aliments

### Liste des aliments
- Tableau : Nom / Catégorie / Calories / Protéines / Source / Statut
- Filtres : catégorie, source (app / importé / utilisateur), statut
- Recherche par nom ou code-barres

### Formulaire aliment

| Champ | Type | Obligatoire |
|---|---|---|
| Nom | Texte | Oui |
| Catégorie | Enum | Oui |
| Code-barres | Texte (EAN-13) | Non |
| Calories (pour 100 g) | Nombre | Oui |
| Protéines (g) | Nombre | Oui |
| Glucides (g) | Nombre | Oui |
| Dont sucres (g) | Nombre | Non |
| Lipides (g) | Nombre | Oui |
| Dont saturés (g) | Nombre | Non |
| Fibres (g) | Nombre | Non |
| Source | App / Importé (OpenFoodFacts) / Utilisateur | Auto |
| Statut | Brouillon / Publié / Archivé | Oui |

### Import en masse
- Upload CSV (format documenté) pour ajouter plusieurs aliments d'un coup
- Validation ligne par ligne avec rapport d'erreurs avant import définitif
- Import depuis OpenFoodFacts via code-barres (recherche API, pré-remplit le formulaire)

### Signalements utilisateurs
- Liste des aliments créés par des utilisateurs signalés comme incorrects
- Actions : valider / corriger / supprimer

---

## Module — Utilisateurs (lecture seule en V1)

- Tableau paginé des comptes utilisateurs
- Colonnes : email / date d'inscription / piliers actifs / dernière activité / statut (actif / banni)
- Recherche par email
- Action : bannir un compte (avec motif), débannir
- Vue du profil d'un utilisateur (lecture seule — pas d'édition des données personnelles depuis l'admin)

---

## Rôles & Permissions

| Rôle | Exercices | Programmes | Aliments | Utilisateurs |
|---|---|---|---|---|
| `super_admin` | CRUD | CRUD | CRUD | CRUD |
| `content_editor` | CRUD | CRUD | CRUD | Aucun |
| `moderator` | Lecture | Lecture | Lecture/Signalements | Bannir/Débannir |

---

## Règles métier

- Toute suppression d'un contenu publié est un archivage (soft delete) — jamais de suppression définitive sauf action super_admin explicite.
- Les modifications d'un programme publié ne sont pas propagées aux utilisateurs qui ont déjà démarré ce programme.
- Un log d'audit est conservé pour toute action admin (qui / quoi / quand), non modifiable et non supprimable.
