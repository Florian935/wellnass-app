# Architecture Technique

> Spec technique de la base documentaire unifiée. Fusion de « Architecture Technique » (cadrage Dams) et des décisions actées dans [SYNTHESE-CADRAGE](../../../SYNTHESE-CADRAGE.md) (arbitrages A→H du 04/07/2026).
> Ce document pose les grandes orientations techniques. Les standards d'ingénierie (tests, Git, CI/CD, Definition of Done) sont dans [bonnes-pratiques.md](./bonnes-pratiques.md). Le détail offline-first est dans [offline-sync.md](./offline-sync.md), le modèle dans [modele-donnees.md](./modele-donnees.md), l'i18n dans [i18n.md](./i18n.md).

---

## 1. Périmètre technique de la V1

- **3 piliers** (décision A) : musculation + running + nutrition, plus les fonctionnalités transverses (streak, records, TDEE adaptatif, calendrier unifié).
- **Back-office web** repris de Dams (décision H) pour la gestion de contenu (exercices, programmes, aliments).
- **Aucune monétisation en V1** (décision D) : RevenueCat est câblé mais aucun paywall/palier payant n'est activé.

---

## 2. Plateformes cibles

| Plateforme | V1 (lancement) | Plus tard |
|---|---|---|
| **Android** | ✅ Oui — plateforme de lancement (décision E) | — |
| **iOS** | ❌ Non | Oui, après stabilisation (rester cross-platform, ne rien fermer) |
| **Web app** | ❌ Non (sauf back-office) | V2 envisageable (stats / historique) |
| **Back-office web** | ✅ Oui (équipe, sous-domaine `admin.*`) | — |
| **Montre connectée** | ❌ Non | Ultérieur (Wear OS puis Apple Watch) |

**Conséquences de « Android d'abord » (décision E)** :
- Pas de compte Apple Developer requis au lancement ; pas de publication App Store ni d'OAuth Apple en V1.
- **Contrainte impérative** : ne jamais faire de choix technique qui fermerait la porte à iOS. Toutes les libs retenues doivent rester **cross-platform** (React Native, Expo, PowerSync, Mapbox/MapLibre, RevenueCat).

---

## 3. Stack mobile

| Brique | Choix | Rôle / notes |
|---|---|---|
| **Framework** | React Native + Expo + TypeScript | Cross-platform, une seule codebase Android/iOS |
| **Build** | **Dev build Expo obligatoire** (EAS) | Expo Go **insuffisant** : PowerSync embarque un module natif (décision B) |
| **Navigation** | **Expo Router** (file-based) | Navigation par fichiers, deep-linking natif |
| **State management** | **Zustand** | Stores fins, sélecteurs pour maîtriser les re-renders |
| **Base locale** | **SQLite via PowerSync** | Persistance offline-first + synchro bidirectionnelle managée avec Supabase (voir [offline-sync.md](./offline-sync.md)) |
| **Internationalisation** | **i18next + react-i18next + expo-localization** | UI externalisée dès le début, **FR + EN dès le lancement** (décision G, voir [i18n.md](./i18n.md)) |
| **Format des messages** | ICU MessageFormat | Pluriels, genre, interpolation typée |
| **Listes** | FlashList | Perf sur listes longues (historique, base d'aliments) |
| **Cartographie** | Mapbox ou MapLibre (**à trancher**, point ouvert) | Rendu carte GPS running, rendu côté app (pas de dépendance Google Maps runtime) |

> **TypeScript strict** partout (`strict: true`), types générés depuis le schéma DB (pas de duplication manuelle) — voir [bonnes-pratiques.md](./bonnes-pratiques.md).

---

## 4. Backend — Supabase

| Composant Supabase | Usage |
|---|---|
| **Auth** | Email + mot de passe (OAuth Google possible ; **OAuth Apple hors V1**, décision E). Vérification email obligatoire. Session persistante. |
| **Postgres** | Base de données cloud source de vérité, répliquée vers le SQLite local par PowerSync |
| **Storage** | Médias : GIF d'exercices, photos d'aliments/exercices persos, images de progression |
| **RLS (Row Level Security)** | Isolation stricte par utilisateur : un utilisateur A ne peut jamais lire les données d'un utilisateur B (testé, voir bonnes-pratiques) |
| **Réplication logique** | Publication Postgres lue par PowerSync pour la synchro descendante |

- **Synchro** : assurée par **PowerSync** au-dessus de Supabase (SQLite local ↔ Postgres, conflits gérés par l'outil). **Ceci remplace la synchro maison last-write-wins du cadrage Dams** (décision B).
- **Types partagés** : les types TypeScript sont générés depuis le schéma Supabase et partagés front / back / back-office via `packages/shared`.

---

## 5. RevenueCat (câblé, inactif en V1)

- **Retenu** comme solution de monétisation (décision D).
- Les *entitlements* sont **câblés tôt** (peu coûteux, évite une refonte ultérieure) mais **aucun paywall ni palier payant n'est activé en V1** : l'app est entièrement gratuite au lancement.
- Rester cross-platform : la config RevenueCat prépare Android (Play Billing) sans fermer iOS (App Store) ultérieur.
- La grille de prix et les paliers seront rediscutés le moment venu, bien après le lancement.

---

## 6. Services tiers

| Service | Usage | Statut V1 | Alternative / note |
|---|---|---|---|
| **PowerSync** | Synchro offline-first managée (SQLite ↔ Supabase) | V1 (à confirmer par spike) | Repli : Legend-State, puis WatermelonDB (voir [ADR-001](../../adr/ADR-001-moteur-sync-offline.md)) |
| **OpenFoodFacts** | Base d'aliments scan (produits industriels), déjà multilingue | V1 | USDA FoodData Central |
| **CIQUAL (ANSES)** | Base d'aliments bruts FR (import statique) — **traduction EN à produire** (décision G) | V1 | Mapping USDA pour les noms EN |
| **Mapbox / MapLibre** | Rendu carte GPS running | V1 (fournisseur **à trancher**) | Tuiles OpenStreetMap |
| **Expo Location** | GPS running (traces, allure) | V1 | — |
| **Expo Notifications** | Notifications push (rappels, records, streak en danger) | V1 | — |
| **Health Connect** (Android) | Écriture des séances, lecture du poids | V1 (Apple Health = iOS, plus tard) | — |
| **Sentry** | Crashs + erreurs JS/natives, release tracking (source maps CI) | V1 | — |
| **PostHog** (self-hosted) | Analytics produit first-party (activation, rétention, usage par pilier) | V1 | Table events custom |
| **RevenueCat** | Monétisation (entitlements câblés, inactifs) | Câblé en V1, non commercialisé | — |

---

## 7. Sécurité

- **Authentification** : JWT Supabase (access token court + refresh token longue durée). PowerSync fait confiance aux JWT Supabase pour autoriser la synchro.
- **Isolation par utilisateur** : Row Level Security sur Postgres — un utilisateur ne voit que ses données. Les **sync rules PowerSync** répliquent uniquement les buckets de l'utilisateur connecté (voir [offline-sync.md](./offline-sync.md)).
- **Données GPS et santé** : jamais partagées sans consentement explicite.
- **Chiffrement au repos** sur l'appareil (Android Keystore pour les tokens ; iOS Keychain le moment venu).
- **Secrets** : jamais dans le repo (variables d'environnement + EAS Secrets). Le mot de passe DB et la `service_role` key restent hors Git.
- **Validation** : schémas Zod partagés client/serveur (le client valide pour l'UX, le serveur valide pour la sécurité).
- **Analytics first-party** : événements anonymisés vers PostHog auto-hébergé, pas de SDK publicitaire tiers ; déclaré dans la politique de confidentialité.
- **Rôles back-office** (moindre privilège) : `super_admin` / `content_editor` / `moderator` — `content_editor` ne touche jamais aux utilisateurs. Log d'audit immuable de toute action admin.

---

## 8. Budgets de performance

| Contrainte | Cible |
|---|---|
| Démarrage à froid | < 2 s |
| Écran suivi muscu (séance active) | Pas de jank — 60 fps |
| Calcul TDEE / macros | Instantané (calcul local) |
| Sync cloud après séance | < 3 s sur connexion 4G |
| Rendu carte GPS (100 km de points) | < 500 ms (downsampling Douglas-Peucker à l'affichage) |

Application pratique (voir [bonnes-pratiques.md](./bonnes-pratiques.md) §7) : FlashList pour les listes longues, downsampling GPS pour la carte, GIF téléchargés à la demande + cache disque (jamais bundlés), sélecteurs Zustand fins, aucune écriture DB bloquante sur le fil UI de l'écran de séance.

---

## 9. Déploiement & releases

- **CI/CD** : GitHub Actions (typecheck + lint + tests sur chaque PR, < 10 min).
- **Build** : Expo **EAS Build** par canal — `development` (dev client, requis pour PowerSync) / `preview` (bêta interne) / `production`.
- **Distribution de lancement** : **Play Store uniquement** (décision E). Bêta via **Google Play Internal Track**.
- **iOS plus tard** : TestFlight + App Store viendront après stabilisation (rester cross-platform pour ne rien avoir à refondre).
- **OTA** : EAS Update pour les correctifs JS entre deux releases store — **réservé aux fixes, jamais aux features**.
- **Versioning** : SemVer (MAJOR.MINOR.PATCH) + changelog généré depuis les conventional commits.
- **Jalons** : chaque fin de version de la roadmap = un tag + un build `preview` installable (le jalon est testable, pas théorique).
- **Monitoring** : Sentry (erreurs) + PostHog (produit).

---

## 10. Points ouverts / décisions à trancher

Contrairement au cadrage initial, les grands arbitrages (stack mobile, Supabase, PowerSync, plateforme, langues, monétisation) sont **actés** (voir SYNTHESE-CADRAGE §4). Restent ouverts :

- [ ] **Source des GIF de démonstration** d'exercices : bundlés (poids initial élevé) vs téléchargés à la demande + cache local (recommandé). Source candidate : `exercises-dataset` (433, FR+EN), `free-exercise-db`, `ExerciseDB` (~11 000). — *décision humaine (contenu).*
- [ ] **Source de la base d'aliments** : combinaison CIQUAL (bruts FR) + OpenFoodFacts (industriels, scan) — arbitrer la stratégie d'import et la traduction EN de CIQUAL. — *décision humaine (contenu).*
- [ ] **Fournisseur de cartes** : Mapbox (managé, quota) vs MapLibre + tuiles OpenStreetMap (auto-hébergé). — ADR à rédiger.
- [ ] **Confirmation PowerSync** : dépend du **spike** (voir [spike-001-powersync.md](./spike-001-powersync.md)) ; repli C (Legend-State) puis B (WatermelonDB) documenté dans [ADR-001](../../adr/ADR-001-moteur-sync-offline.md).
- [ ] **Outil de gestion des traductions UI** : Weblate self-hosted vs PR JSON (voir [i18n.md](./i18n.md)).
- [ ] **RGPD** : DPA à signer avec chaque service tiers (Supabase, PowerSync, Sentry, PostHog, OpenFoodFacts).
