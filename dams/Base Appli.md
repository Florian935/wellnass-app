# Cahier des Charges — Application Fitness

Application mobile de suivi fitness tout-en-un : musculation, running, alimentation. Les trois piliers partagent un planning, des statistiques et des données croisées.

> ⏳ La couche gamification (mini-jeu RPG) et les animations 3D d'exercices ont été retirées du périmètre le 2026-07-03 — réévaluation en V3/V4 si besoin.

---

## Documents

### Vision & Cadrage
- [[Vision & Contexte]] — Concept, positionnement, utilisateur cible, périmètre V1
- [[Compte & Profil Utilisateur]] — Authentification, onboarding, profil, paramètres

### UX & Navigation
- [[Navigation & UX Globale]] — Structure de l'app, tableau de bord, principes UX, notifications
- [[Architecture Applicative]] — Vue transversale : arborescence des écrans, descriptif de chaque page et de toutes les fonctionnalités

### Piliers fonctionnels
- [[Musculation]] — Programmes, bibliothèque d'exercices, suivi de séance, historique & progression
- [[Running]] — Profil coureur, programmes, types de séance, suivi GPS, historique & progression
- [[Alimentation]] — Profil nutritionnel, base d'aliments, journal alimentaire, recettes, planning repas

### Administration & Contenu
- [[Outils d'Administration]] — Back-office web, gestion exercices / programmes / aliments, rôles

### Technique
- [[Architecture Technique]] — Stack, modèle de données, offline-first, sécurité, déploiement
- [[Bonnes Pratiques Techniques]] — Standards d'ingénierie pour tous les développements : tests, Git, sync, sécurité, CI/CD, Definition of Done, skills Claude Code
- [[Internationalisation & Traductions]] — Plan de traduction : langues cibles, i18n UI, contenu multilingue, formats locaux, roadmap

### Validation & Roadmap
- [[Validation Fonctionnalités]] — Les 179 fonctionnalités ordonnées par version de développement (V0.1 socle → V1.1 post-lancement), avec statut (✅ / ❌ / 🔄 / ⏳) et remarques

---

## Résumé des grandes fonctionnalités V1

| Fonctionnalité | Pilier | Priorité |
|---|---|---|
| Suivi de séance muscu — planifiée ou libre (séries / reps / charge) | Musculation | P0 |
| Création et suivi d'un programme muscu | Musculation | P0 |
| Journal alimentaire quotidien (portions usuelles, copie de repas, quick add) | Alimentation | P0 |
| Calcul TDEE & macros | Alimentation | P0 |
| Suivi GPS running en temps réel (auto-pause, écran verrouillé) | Running | P0 |
| Records personnels & courbes d'évolution | Muscu + Running | P1 |
| Streak de régularité | Transverse | P1 |
| Bibliothèque de programmes (muscu + running) | Muscu + Running | P1 |
| Apple Health / Health Connect + import GPX/CSV | Transverse | P1 |
| Planning repas à la semaine | Alimentation | P1 |
| Liste de courses générée | Alimentation | P2 |
| Défis entre amis / social | Transverse | V2 |
| Synchronisation wearables + zones cardio FC | Transverse | V2 |
| Suivi hydratation | Alimentation | V2 |
| Gamification / mini-jeu | Transverse | V3-V4 |

---

## Statut du document

- Démarré : 2026-06-26
- Statut : Brouillon v0.3 — périmètre resserré (gamification et 3D retirées) puis complété (20 fonctionnalités ajoutées suite à la revue des manques) le 2026-07-03
- Prochaines étapes : choisir la stack technique, valider la source de la base d'exercices (GIF) et de la base d'aliments (CIQUAL + OpenFoodFacts), rédiger les CGU / politique de confidentialité, créer le contenu éditorial (programmes muscu + running) avant lancement
