# PRD — MVP1 : Module Musculation

> **Product Requirements Document** du premier incrément livrable (MVP1).
> Décrit **quoi** on construit et **pourquoi**. Le **comment** (schéma de données, contrats d'API, archi technique) fera l'objet des specs techniques (`/docs/specs/technical`).
> Sources : [cadrage.md](./cadrage.md) · [CONTEXTE_PROJET.md](../../CONTEXTE_PROJET.md).
> Statut : **Brouillon à valider** · Date : 2026-06-30.

---

## 1. Résumé exécutif

Le MVP1 est un **tracker de musculation puissant et autonome**, fonctionnant **hors-ligne**, conçu pour le **pratiquant assidu** (intermédiaire à avancé) tout en restant **accessible au débutant**. Il embarque une **graine de gamification** (streaks, jalons, records) pour ancrer dès le départ la différenciation par la rétention.

C'est la **porte d'entrée** d'un écosystème bien-être plus large (course, nutrition, lifestyle) dont la valeur ultime sera **l'intégration** — mais chaque module reste utile **seul, sans imposition**. Le MVP1 doit donc être **excellent en tant que tracker autonome**, indépendamment du reste de l'écosystème à venir.

---

## 2. Problème & opportunité

**Problème utilisateur.** Le pratiquant de musculation jongle aujourd'hui avec des apps cloisonnées : un tracker de séances (Hevy, Strong…), une app nutrition (MyFitnessPal…), une app course (Strava…), une app sommeil/pas. Ces silos ne communiquent pas → aucune vue d'ensemble, aucune optimisation croisée, friction et lassitude.

**Opportunité.** Construire le **hub unique** où tous ces piliers vivent au même endroit et se parlent. Le MVP1 ne livre que la muscu, mais pose les fondations (technique **et** produit) de cette intégration future.

**Réalité concurrentielle assumée.** Le créneau « tracker muscu » est saturé. Le MVP1 ne gagne donc **pas** sur « être le seul » mais sur **la qualité du tracker** + **la graine de gamification** + **la promesse crédible d'un futur hub intégré**. ⚠️ Risque à surveiller : ne pas livrer « juste un Hevy de plus ».

---

## 3. Personas

### Persona principal (cible de conception) — « L'assidu »
- Intermédiaire à avancé, s'entraîne 3–6×/semaine, connaît le training.
- **Veut** : un suivi puissant et fiable (historique détaillé, volume, records, surcharge progressive), qui marche **même sans réseau à la salle**.
- **Craint** : perdre ses données, une app lente/bancale pendant la séance, un outil trop simpliste.
- **Prêt à payer** pour la profondeur et la fiabilité.

### Persona secondaire (capté de facto) — « Le débutant motivé »
- Débute ou reprend, suit un programme, veut surtout **enregistrer simplement** et **voir qu'il progresse**.
- **Veut** : simplicité, encouragement, cadre.
- L'app le sert sans le noyer : l'avancé est disponible mais jamais imposé. La gamification l'aide à tenir.

---

## 4. Proposition de valeur & différenciation

> **« Tout au même endroit, interconnecté — sans jamais rien t'imposer. »**

- **Valeur n°1 (vision)** : l'intégration future de tous les piliers bien-être.
- **Principe directeur** : *intégration sans imposition* — chaque module est utile seul ; l'intégration est une couche **opt-in** par-dessus.
- **Différenciation au lancement** : profondeur du tracker + graine de gamification + promesse d'écosystème.

---

## 5. Périmètre du MVP1

### ✅ Dans le périmètre
Module **Musculation** uniquement, avec toutes les fonctionnalités listées en §6.

### ❌ Hors périmètre (roadmap future, voir §12)
- Module **Course / GPS**.
- Module **Nutrition** (macros/calories).
- Module **Lifestyle** (sommeil, stress, pas / Health Connect).
- **Couche sociale** (feed, follows, kudos).
- **Boucle de gamification complète** façon Walkr (énergie → exploration → déblocage).
- **Fonctionnalités IA** (programmes/plans assistés).
- **iOS** (Android d'abord).

---

## 6. Fonctionnalités (Epics)

> Détaillées ici au niveau produit. Chaque epic sera ensuite éclaté en user stories avec critères d'acceptation (`/docs/stories`).

### E1 — Compte & synchronisation
- Création de compte / connexion via **Supabase Auth** (email + mot de passe ; **connexion Google** souhaitée).
- Données rattachées au compte, **synchronisées multi-appareils**.
- Déconnexion, réinitialisation de mot de passe.
- **Offline-first** : l'app est utilisable **avant même** d'avoir du réseau (cf. §8).

### E2 — Onboarding minimal
- Après inscription, **entrée directe** dans l'app.
- Config (objectif, niveau, fréquence, unités) **optionnelle et différable** ; proposée mais jamais bloquante.
- Choix des **unités** (kg par défaut / lb) et de la **langue** (FR/EN) accessibles dès les réglages.

### E3 — Bibliothèque d'exercices
- **Catalogue préchargé** d'exercices muscu courants, catégorisés par **groupe musculaire** et **équipement**.
- Chaque exercice porte ses **groupes musculaires** (primaire/secondaires) → alimente les graphiques de volume (E8).
- Création / édition d'**exercices custom**.
- Recherche et filtrage.

### E4 — Séances & templates (routines)
- Création de **templates de séances** réutilisables (liste ordonnée d'exercices, séries cibles).
- Démarrage d'une séance **depuis un template** ou **à blanc**.
- Édition / duplication / suppression des templates.
- (Optionnel) quelques **templates de démarrage** fournis pour le débutant.

### E5 — Logging de séance en live
- Enregistrement série par série : **poids + reps + RPE optionnel**.
- **Types de séries** : normale, échauffement, dropset, échec.
- **Timer de repos** : démarrage (auto après une série / manuel), configurable, notification de fin.
- Ajout/suppression d'exercices et de séries en cours de séance.
- Reprise d'une séance interrompue.
- **Fonctionne intégralement hors-ligne.**

### E6 — Historique
- Liste chronologique des séances passées.
- Consultation du détail d'une séance.
- **Édition / suppression** d'une séance passée.
- Accessible **hors-ligne**.

### E7 — Progression & records
- **Records personnels (PR) auto-détectés** par exercice (ex. meilleur poids, meilleur 1RM estimé, meilleur volume, PR par plage de reps).
- **Courbes d'évolution** par exercice (charge, volume) dans le temps.
- **Surcharge progressive assistée** : suggestion de la **prochaine charge / prochaines reps** à partir des dernières performances (et du RPE si renseigné).

### E8 — Mesures corporelles & photos
- Suivi du **poids de corps** (a minima) + **mesures optionnelles** (tour de bras, taille, etc.).
- **Photos de progression** (galerie privée).
- Courbe d'évolution du poids de corps.

### E9 — Graphiques avancés
- **Volume par groupe musculaire** (semaine / mois).
- Répartition de l'entraînement (groupes travaillés, fréquence).
- Vue de synthèse de l'activité.

### E10 — Graine de gamification
- **Streaks** d'assiduité (jours / semaines d'entraînement).
- **Jalons & badges** simples (1ʳᵉ séance, 10ᵉ séance, premier PR…).
- **Feedback de progression valorisant** (célébration d'un PR, d'un palier).
- ⚠️ Doit valoriser **sans faire « gadget »**.

### E11 — Monétisation (freemium)
- **Gratuit** : logging, historique, templates, progression de base.
- **Premium** (RevenueCat) : graphiques avancés, surcharge progressive assistée, historique illimité, photos illimitées.
- **Entitlements multi-paliers câblés dès le départ** (un seul palier payant lancé), pour ajouter « Écosystème » puis « IA » plus tard sans refonte.

---

## 7. Parcours utilisateur clés (happy paths)

1. **Première séance (nouvel utilisateur)** : inscription → entrée directe → démarrage d'une séance à blanc → ajout d'exercices depuis la bibliothèque → log des séries → fin de séance → célébration (1ʳᵉ séance).
2. **Séance récurrente** : ouverture → démarrage depuis un template → log série par série avec timer de repos → PR détecté & célébré → synchro au retour du réseau.
3. **Suivi de progression** : ouverture de l'historique / d'un exercice → consultation des courbes et PR → suggestion de surcharge progressive pour la prochaine fois.
4. **Conversion Premium** : tentative d'accès à un graphique avancé → présentation du paywall → abonnement via RevenueCat → déblocage.

---

## 8. Exigences non-fonctionnelles

- **Offline-first complet** : logging, historique, templates et consultation **fonctionnent sans réseau** ; synchro Supabase **en arrière-plan** au retour du réseau, avec **gestion de conflits**. C'est une exigence **structurante** du modèle de données.
- **Performance** : l'app doit rester **fluide pendant la séance** (saisie rapide, pas de latence réseau bloquante).
- **Fiabilité des données** : aucune perte de séance ; écriture locale immédiate.
- **Internationalisation** : **FR + EN dès le MVP1** → i18n câblé dès le départ.
- **Plateforme** : **Android d'abord** (iOS plus tard ; éviter tout choix qui bloquerait iOS).
- **Stack imposée** : React Native + Expo + TypeScript · Supabase (Postgres, Auth, Realtime, Storage, RLS) · RevenueCat · monorepo modulaire.
- **Sécurité / privacy** : données personnelles (poids, photos) protégées par **Row-Level Security** ; photos en **Storage privé**.

---

## 9. Monétisation (détail)

| Palier | Statut MVP1 | Contenu | Prix de référence (ajustable) |
|---|---|---|---|
| **Gratuit** | Lancé | Tracker complet de base (logging, historique, templates, progression de base) | 0 € |
| **Premium muscu** | Lancé | Graphiques avancés, surcharge progressive assistée, historique & photos illimités | **~4,99 €/mois** · **~29,99 €/an** |
| **Écosystème / Pro** | Câblé, non lancé | (futur) course + nutrition + analyses croisées | ~9,99 €/mois |
| **IA / Coach** | Câblé, non lancé | (futur) programmes & plans assistés par IA | ~14,99–19,99 €/mois |

- **Offre « founder »** de lancement recommandée (annuel remisé / early-bird).

---

## 10. Métriques de succès

- **Activation** : % de nouveaux utilisateurs qui **loggent une 1ʳᵉ séance** (< 24 h).
- **Rétention** : rétention **W1 / W4** ; **nombre de séances loggées / semaine** par utilisateur actif.
- **Engagement gamification** : % d'utilisateurs avec un **streak actif** ; jalons débloqués.
- **Monétisation** : taux de conversion **gratuit → Premium** ; part d'abonnements **annuels**.
- **Fiabilité** : taux de séances **synchronisées sans conflit** ; zéro perte de données rapportée.

---

## 11. Hypothèses & risques

| # | Hypothèse / Risque | Mitigation |
|---|---|---|
| R1 | Marché saturé → « encore un tracker » | Miser sur profondeur + gamification + promesse d'écosystème ; soigner l'UX |
| R2 | Offline/synchro = complexité technique sous-estimée | Concevoir le modèle de données offline-first **dès le départ** ; tests de conflits |
| R3 | Gamification perçue comme « gadget » | Rester sobre (streaks/PR), valoriser le réel progrès, pas de bruit |
| R4 | Adoption faible si paywall trop tôt | Freemium **généreux**, paywall sur la profondeur, pas l'accès de base |
| R5 | i18n rajouté trop tard | Câbler i18n FR/EN dès le MVP1 |

---

## 12. Roadmap post-MVP1 (hors périmètre, pour mémoire)

1. **Module Course / GPS** (background-geolocation + cartes).
2. **Module Nutrition** (macros / calories).
3. **Module Lifestyle** (sommeil, stress, pas — Health Connect).
4. **Analyses croisées inter-modules** (le cœur de la valeur « intégration » → palier Écosystème).
5. **Couche sociale** (feed, follows, kudos — scopée force/course).
6. **Boucle de gamification complète** façon Walkr.
7. **Fonctionnalités IA** (programmes/plans assistés → palier IA).
8. **iOS**.

---

## 13. Questions ouvertes

- 🔶 **Nom du produit** (candidats : Atlas, Orbit…) — non bloquant pour le build.
- 🔶 Détails d'UX fins (à préciser en specs fonctionnelles) : ergonomie exacte de l'écran de logging, comportement précis du timer, liste initiale d'exercices préchargés, contenu exact du paywall.
