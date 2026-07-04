# Architecture Technique

> Document à affiner lors de la phase de conception technique. Ce fichier pose les grandes orientations, pas les choix définitifs.
> Les standards d'ingénierie (tests, Git, CI/CD, Definition of Done) sont dans [[Bonnes Pratiques Techniques]].

---

## Plateformes cibles

| Plateforme | V1 | V2 |
|---|---|---|
| iOS | Oui | — |
| Android | Oui | — |
| Web app | Non | Envisageable (stats / historique) |
| Montre connectée | Non | Oui (Apple Watch, Wear OS) |

---

## Stack technique envisagée

### Mobile
- **Framework** : React Native (Expo) — choix cross-platform pour iOS + Android en une seule codebase
  - Alternative : Flutter (Dart) — à ne considérer que si des besoins de rendu avancés apparaissent
- **Navigation** : Expo Router (file-based) ou React Navigation
- **State management** : Zustand ou Redux Toolkit
- **Base locale** : SQLite via Expo SQLite (données offline-first)
- **Internationalisation** : i18next + react-i18next + expo-localization (externalisation dès la V0.1, contenu multilingue en base) — plan détaillé dans [[Internationalisation & Traductions]]

### Backend
- **API** : REST ou GraphQL (à décider selon complexité des requêtes imbriquées)
- **Runtime** : Node.js (Fastify ou NestJS) ou Bun
- **Base de données cloud** : PostgreSQL
- **Auth** : Supabase Auth (ou Auth0) — supporte email + OAuth Google/Apple
- **Synchronisation** : Supabase Realtime ou simple pull-on-open

### Services tiers
| Service | Usage | Alternative |
|---|---|---|
| OpenFoodFacts | Base d'aliments scan (produits industriels) | USDA FoodData Central |
| CIQUAL (ANSES) | Base d'aliments bruts FR (import statique) | — |
| Mapbox / MapLibre | Rendu carte GPS | OpenStreetMap tiles |
| Expo Location | GPS running | — |
| Expo Notifications | Push notifications | — |
| Apple Health / Health Connect | Écriture des séances, lecture du poids | — |
| PostHog (self-hosted) | Analytics produit first-party | Table events custom |

---

## Modèle de données (grandes entités)

```
User
  ├── Profile (poids, taille, objectif…)
  ├── NutritionProfile (macros, restrictions…)
  ├── RunnerProfile (allure ref, niveau…)
  └── Settings (unités, thème, notifications, disposition dashboard)

Program (muscu ou running)
  └── Session[]
        └── ExercisePlan[] (muscu) | SessionBlock[] (running)

Workout (séance réalisée, planifiée ou libre)
  ├── Sets[] (muscu — type : normale / échauffement / superset ;
  │           mesure : charge × reps, durée, ou poids de corps ± lest)
  │   | GPSPoints[] (running)
  └── PersonalRecord[] (records battus lors de la séance)

Exercise (bibliothèque, avec GIF de démonstration)
  └── ExerciseTranslation[] (nom, consignes — par langue)

FoodLog (journal journalier)
  └── Meal[]
        └── FoodEntry[]

Food (aliment)
Recipe (recette)
  └── RecipeIngredient[]
MealTemplate (repas type réutilisable)
MealPlan (planning repas semaine)
  └── ShoppingList (liste de courses générée)

BodyWeightEntry (historique des pesées)
Streak (jours consécutifs actifs, calculé)
```

> **Compatibilité gamification (V3/V4)** : toutes les activités (séance, repas validé, pesée) sont historisées avec horodatage. Une future couche jeu pourra se brancher sur cet historique comme sur un journal d'événements, sans refonte du modèle — aucune table de jeu n'est créée en V1.

---

## Offline-first

L'app doit fonctionner sans connexion internet :
- Toutes les données utilisateur sont écrites localement en priorité (SQLite)
- Synchronisation cloud déclenchée dès que la connexion est disponible
- La base d'aliments (OpenFoodFacts) est partiellement mise en cache local (aliments favoris + récents)
- La carte GPS est rendue depuis les tuiles mises en cache (zone géographique courante)

**Stratégie de conflit** : last-write-wins basé sur le timestamp. Les conflits réels (modification depuis 2 appareils simultanément) sont rares — pas de merge complexe en V1.

---

## Sécurité

- Authentification JWT (access token court + refresh token longue durée)
- Les données utilisateur sont isolées par `userId` côté API (Row Level Security sur Postgres)
- Les données GPS et de santé ne sont pas partagées sans consentement explicite
- Chiffrement au repos sur le device (iOS Keychain / Android Keystore pour les tokens)
- Analytics produit **first-party** : événements anonymisés (activation, rétention, usage par pilier) vers une instance auto-hébergée (PostHog self-hosted ou table events custom) — pas de SDK publicitaire tiers. Indispensable pour arbitrer les évolutions (dont la décision gamification V3/V4). Déclaré dans la politique de confidentialité.

---

## Performance

| Contrainte | Cible |
|---|---|
| Démarrage à froid | < 2 s |
| Écran suivi muscu (séance active) | Pas de jank — 60 fps |
| Calcul TDEE / macros | Instantané (calcul local) |
| Sync cloud après séance | < 3 s sur connexion 4G |
| Rendu carte GPS (100 km de points) | < 500 ms |

---

## Déploiement & Releases

- CI/CD : GitHub Actions
- Distribution : App Store + Play Store via Expo EAS Build
- Versioning : SemVer (MAJOR.MINOR.PATCH)
- Beta testing : TestFlight (iOS) + Google Play Internal Track
- Monitoring erreurs : Sentry

---

## Points ouverts / Décisions à prendre

- [ ] React Native vs Flutter — à trancher avant le démarrage du développement
- [ ] Supabase vs backend custom — Supabase accélère la V1 mais peut limiter la V2
- [ ] Monétisation : freemium / abonnement / one-time purchase — impact sur l'architecture (feature flags)
- [ ] Stockage des GIF de démonstration : bundlés dans l'app (poids initial élevé) ou téléchargés à la demande avec cache local (recommandé) ?
- [ ] Source de la base d'exercices : exercises-dataset (433, FR) vs ExerciseDB self-hosted (11 000)
- [ ] RGPD : DPA à signer avec chaque service tiers (Supabase, Sentry, OpenFoodFacts)
- [ ] i18n : table de traductions liée vs colonnes par langue, outil de gestion (Weblate vs PR JSON), traduction EN de CIQUAL — voir [[Internationalisation & Traductions]] §9
