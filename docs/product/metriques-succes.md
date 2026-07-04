# Métriques de succès

> Comment on mesure que la V1 réussit. Étendu depuis le §10 du PRD muscu de Flo aux **trois piliers** (musculation, running, nutrition).
> Voir aussi : [prd.md](./prd.md) · [vision.md](./vision.md).
> Statut : Brouillon issu de la fusion · Date : 04/07/2026.

> **Note importante sur la monétisation.** L'app est **entièrement gratuite en V1** (RevenueCat câblé mais inactif — voir [prd.md](./prd.md) §Monétisation). Les métriques de **conversion / revenus** sont donc classées **« post-V1 (à activer avec la monétisation) »** : on ne les suit pas au lancement, mais l'instrumentation doit être prête pour ne pas repartir de zéro le jour où la monétisation est activée.

---

## 1. Activation

Mesure : l'utilisateur atteint-il rapidement le premier moment de valeur, pilier par pilier ?

- **Muscu** : % de nouveaux utilisateurs qui **loggent une 1ʳᵉ séance** (< 24 h après l'inscription).
- **Running** : % qui **enregistrent une 1ʳᵉ sortie** (GPS ou manuelle) (< 7 jours).
- **Nutrition** : % qui **remplissent un 1ᵉʳ journal** (au moins un repas saisi) (< 24 h).
- **Global** : % d'utilisateurs ayant activé **au moins un pilier** dans les 24 h ; répartition du nombre de piliers activés (1 / 2 / 3) → mesure directe de l'attrait de l'intégration.

---

## 2. Rétention

Mesure : les utilisateurs reviennent-ils ?

- **Rétention W1** : % d'utilisateurs actifs 7 jours après l'inscription.
- **Rétention W4** : % d'utilisateurs actifs 28 jours après l'inscription.
- **Courbe de rétention** par nombre de piliers activés → hypothèse à valider : **plus de piliers activés = meilleure rétention** (c'est le pari de l'intégration).

---

## 3. Engagement

Mesure : à quelle fréquence et avec quelle profondeur l'app est-elle utilisée ?

- **Muscu** : nombre de **séances loggées / semaine** par utilisateur actif.
- **Running** : nombre de **sorties / semaine** ; distance hebdomadaire moyenne.
- **Nutrition** : nombre de **jours de journal complétés / semaine** (objectif atteint = 90-110 % des calories cibles).
- **Motivation** :
  - % d'utilisateurs avec un **streak actif** (et durée moyenne des streaks) ;
  - nombre de **records personnels** détectés (muscu + running) par utilisateur ;
  - taux d'ouverture / réaction aux **notifications de célébration**.
- **Intégration (opt-in)** : % d'utilisateurs qui consultent au moins une **vue croisée** (calories ↔ entraînement, planning unifié).

---

## 4. Fiabilité de la synchro (métrique produit critique)

Mesure : l'offline-first tient-il sa promesse ? C'est la métrique de confiance du persona assidu.

- **Taux de données synchronisées sans perte** : séances muscu, sorties running (traces GPS incluses) et repas créés hors-ligne puis correctement remontés au cloud.
- **Taux de conflits de synchro** résolus sans intervention / perte de données.
- **Zéro perte de données rapportée** (incidents utilisateur, tickets support).
- **Latence de synchro** au retour du réseau (temps entre reconnexion et données à jour côté cloud).

---

## 5. Qualité perçue & bugs

- **Taux de crash** (via Sentry) et sessions sans crash.
- **Note store** (Play Store) et thèmes récurrents des avis.
- **Temps de saisie d'une série** (proxy de la fluidité en séance — cible : instantané, aucune latence bloquante).

---

## 6. Post-V1 — à activer avec la monétisation

> Non suivies au lancement (app gratuite). Instrumentation à prévoir, activation le jour où la monétisation est mise en place.

- **Taux de conversion** gratuit → payant (par palier, une fois les paliers définis).
- **Part d'abonnements annuels** vs mensuels.
- **Revenu par utilisateur** (ARPU) et revenu récurrent (MRR).
- **Taux de résiliation** (churn) des abonnements.
- **Impact des offres de lancement** (early-bird / founder) sur l'amorçage de la base payante.
