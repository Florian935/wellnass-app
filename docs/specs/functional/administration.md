# Spécification fonctionnelle — Outils d'Administration (back-office)

> Base documentaire unifiée · Pilier Administration.
> Source : cadrage de Damien (fusionné dans cette base).
> Décisions actées appliquées ici : **H** (back-office repris de Dams + « intégration sans imposition »), **G** (contenu bilingue FR + EN à gérer côté admin), **D** (aucune monétisation en V1 → pas de gestion d'abonnements dans l'admin).
> Statut : à jour · Date : 04/07/2026.

---

## 1. Objectif du document

Décrire le **back-office web** (séparé de l'app mobile) permettant à l'équipe de gérer le contenu de la plateforme : exercices, programmes, aliments. Accessible uniquement par des comptes dotés d'un rôle admin (`super_admin`, `content_editor` ou `moderator` — voir § 7).

Ce back-office est **repris du cadrage Dams** (décision H) : c'est l'outil qui alimente en contenu les trois piliers. Le contenu géré ici doit être **bilingue FR + EN** (décision G) pour couvrir le lancement.

---

## 2. Architecture de l'admin

- **Type** : application **web** (pas mobile).
- **Stack suggérée** : React + Vite, ou Next.js (admin interne, pas de contrainte SEO).
- **Auth** : même système que l'app (Supabase / JWT) avec **vérification du rôle admin côté API**.
- **URL** : sous-domaine dédié (ex. `admin.<domaine>`).
- **Isolation** : les endpoints admin vérifient le rôle à chaque requête ; RLS côté base garantit qu'un compte non-admin ne peut pas accéder aux opérations d'administration.

---

## 3. Module — Gestion des Exercices

Le module le plus riche : chaque exercice embarque sa fiche complète et sa démonstration animée (GIF).

### 3.1 Liste des exercices
- Tableau paginé : Nom / Groupe musculaire / Matériel / Difficulté / Statut (publié / brouillon).
- Filtres : groupe musculaire, matériel, difficulté, statut.
- Recherche par nom.
- Actions rapides : dupliquer, archiver, changer de statut.

### 3.2 Formulaire exercice (création / édition)

**Onglet Informations**

| Champ | Type | Obligatoire |
|---|---|---|
| Nom (FR et EN) | Texte | Oui |
| Muscles ciblés (principal) | Sélecteur (liste fixe) | Oui |
| Muscles ciblés (secondaires) | Multi-sélecteur | Non |
| Matériel requis | Multi-sélecteur | Oui |
| Difficulté | 1 à 5 étoiles | Oui |
| Type de mouvement | Enum (Poussée / Tirage / Squat / Charnière / Gainage / Isolation) | Oui |
| Consignes techniques (FR et EN) | Éditeur de texte riche (markdown) | Non |
| Variantes liées | Sélecteur multi (autres exercices) | Non |
| Statut | Brouillon / Publié | Oui |

> **Bilingue (décision G)** : les champs éditoriaux (nom, consignes) sont saisis en **FR et EN**. Un contenu ne peut être publié que si ses deux versions linguistiques sont renseignées (règle métier § 8).

**Onglet Média**
- Upload du **GIF de démonstration** — source : base open source importée ou upload manuel (voir [musculation.md](./musculation.md) § Source des démonstrations).
- Upload **image de couverture** (thumbnail dans les listes).
- Prévisualisation inline.
- **Import en masse** : lors de l'import initial de la base d'exercices (JSON + GIF), les fiches sont créées en statut **brouillon** puis publiées après relecture.

### 3.3 Gestion des muscles
- Référentiel fixe des groupes musculaires : Pectoraux / Dos / Épaules / Biceps / Triceps / Abdominaux / Fessiers / Quadriceps / Ischio-jambiers / Mollets.
- Sous-groupes modifiables par un **super-admin uniquement**.

> **Implémenté le 01/08/2026** (US MUSC-F1b, roadmap 6.2) — ce référentiel à 10 muscles est repris
> tel quel comme anatomie fine (`musclesFine`), **additive** aux 6 groupes larges existants. Voir
> [muscf1b-schema-muscles.md](us/muscf1b-schema-muscles.md).

---

## 4. Module — Gestion des Programmes

### 4.1 Liste des programmes
- Tableau : Nom / Pilier (muscu ou running) / Niveau / Durée / Statut.
- Filtre par pilier, niveau, statut.

### 4.2 Formulaire programme

**Métadonnées**
- Nom, résumé, objectif, niveau, durée (semaines), fréquence hebdo, créateur (texte), image de couverture — champs éditoriaux en **FR et EN** (décision G).

**Constructeur de séances**
- Vue semaine type : cases par jour (lundi → dimanche).
- Drag & drop des types de séance dans les cases.
- Pour chaque séance : ajout d'exercices depuis la bibliothèque, définition séries/reps/charge/repos.
- Aperçu de la progression semaine par semaine (vue condensée).

**Publication**
- Brouillon → Publié (avec confirmation).
- Un programme publié est visible dans l'app pour tous les utilisateurs.
- **Modification d'un programme publié → crée automatiquement une version brouillon** (les utilisateurs actifs sur l'ancienne version ne sont pas affectés).

---

## 5. Module — Base d'Aliments

### 5.1 Liste des aliments
- Tableau : Nom / Catégorie / Calories / Protéines / Source / Statut.
- Filtres : catégorie, source (app / importé / utilisateur / CIQUAL), statut.
- Recherche par nom ou code-barres.

### 5.2 Formulaire aliment

| Champ | Type | Obligatoire |
|---|---|---|
| Nom (FR et EN) | Texte | Oui |
| Catégorie | Enum | Oui |
| Code-barres | Texte (EAN-13) | Non |
| Calories (pour 100 g) | Nombre | Oui |
| Protéines (g) | Nombre | Oui |
| Glucides (g) | Nombre | Oui |
| Dont sucres (g) | Nombre | Non |
| Lipides (g) | Nombre | Oui |
| Dont saturés (g) | Nombre | Non |
| Fibres (g) | Nombre | Non |
| Source | App / Importé (OpenFoodFacts) / CIQUAL / Utilisateur | Auto |
| Statut | Brouillon / Publié / Archivé | Oui |

> **Bilingue (décision G)** : la base **CIQUAL est en français** → l'admin doit gérer la **traduction EN** des noms d'aliments (champ Nom FR + EN). Un outil d'import/traduction en masse facilite cette reprise.

### 5.3 Import en masse
- Upload **CSV** (format documenté) pour ajouter plusieurs aliments d'un coup.
- Validation ligne par ligne avec **rapport d'erreurs** avant import définitif.
- Import depuis **OpenFoodFacts** via code-barres (recherche API, pré-remplit le formulaire).
- Import initial **CIQUAL** (base FR) → à compléter par la traduction EN.

### 5.4 Signalements utilisateurs
- Liste des aliments créés par des utilisateurs signalés comme incorrects.
- Actions : valider / corriger / supprimer.

---

## 6. Module — Utilisateurs (lecture seule en V1)

- Tableau paginé des comptes utilisateurs.
- Colonnes : email / date d'inscription / piliers actifs / dernière activité / statut (actif / banni).
- Recherche par email.
- Action : **bannir** un compte (avec motif), **débannir**.
- Vue du profil d'un utilisateur (**lecture seule** — pas d'édition des données personnelles depuis l'admin).

> **Décision D** : aucune gestion d'abonnements / paliers payants dans l'admin en V1 (RevenueCat câblé mais aucune monétisation active). À ajouter le moment venu.

---

## 7. Rôles & Permissions

| Rôle | Exercices | Programmes | Aliments | Utilisateurs |
|---|---|---|---|---|
| `super_admin` | CRUD | CRUD | CRUD | CRUD |
| `content_editor` | CRUD | CRUD | CRUD | Aucun |
| `moderator` | Lecture | Lecture | Lecture / Signalements | Bannir / Débannir |

---

## 8. Règles métier

- Toute **suppression d'un contenu publié** est un **archivage (soft delete)** — jamais de suppression définitive, sauf action **super_admin** explicite.
- Les **modifications d'un programme publié ne sont pas propagées** aux utilisateurs ayant déjà démarré ce programme.
- Un **log d'audit** est conservé pour **toute action admin** (qui / quoi / quand), **non modifiable et non supprimable**.
- Un contenu ne peut passer au statut **Publié** que si ses versions **FR et EN** sont renseignées (décision G).

---

## 9. Adaptations liées aux décisions actées

- **Décision H** : back-office repris intégralement de Dams ; principe « intégration sans imposition » rappelé (le contenu géré ici alimente des modules autonomes).
- **Décision G (FR + EN)** : champs éditoriaux bilingues (exercices, programmes, aliments) ; gestion de la **traduction EN de CIQUAL** ; publication conditionnée aux deux langues.
- **Décision D (RevenueCat sans paywall)** : aucun module de gestion d'abonnements / prix dans l'admin en V1.
