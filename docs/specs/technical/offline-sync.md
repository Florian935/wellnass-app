# Offline-first & Synchronisation — PowerSync

> Spec dédiée à l'offline-first. L'app doit **fonctionner à 100 % sans réseau** (réalité terrain : réseau souvent absent en salle) et se synchroniser en arrière-plan au retour de la connexion, avec **gestion des conflits**.
> Décision actée B (04/07/2026) : le moteur de synchro est **PowerSync**. **Ceci remplace la synchro maison last-write-wins** du cadrage Dams.
> Réf. : [ADR-001 — Moteur de synchronisation offline-first](../../adr/ADR-001-moteur-sync-offline.md) · Spike de validation : [spike-001-powersync.md](./spike-001-powersync.md).

---

## 1. Pourquoi PowerSync (et pas une synchro maison)

Supabase n'offre pas de solution offline native. Il faut donc : (1) une base locale SQLite, (2) une couche de synchro bidirectionnelle local ↔ Postgres, (3) une résolution de conflits. Écrire cette couche à la main est **le plus gros risque technique du projet** pour une équipe de 2 personnes (risque R2).

**PowerSync** est un service managé conçu pour l'offline-first sur Postgres/Supabase : il fournit le SQLite local, la synchro bidirectionnelle automatique et la résolution de conflits. On **n'écrit pas le protocole de synchro** — c'est le cœur de la décision B.

- **Statut** : retenu, **conditionnel à un spike de validation** réussi (voir §7).
- **Repli** documenté en cas d'échec du spike : Legend-State (option C), puis WatermelonDB (option B) — voir [ADR-001](../../adr/ADR-001-moteur-sync-offline.md).

---

## 2. Principe de fonctionnement

```
[ App mobile ]                                  [ Supabase ]
  UI (Zustand)                                     Postgres  (source de vérité)
     │                                                 ▲
  Repository ── écrit/lit ──> SQLite local             │ réplication logique
                                 │                      │  (publication "powersync")
                                 └── PowerSync SDK ─────┘
                                       ▲   │
                            synchro descendante │ synchro montante
                             (sync rules)       │ (connecteur d'upload)
```

- **Écriture** : l'app écrit **toujours d'abord dans le SQLite local** (via un repository). L'écriture est instantanée à l'écran (optimistic UI, jamais de spinner pour une action offline).
- **Lecture** : l'app lit **toujours depuis le SQLite local** — donc tout marche hors-ligne, y compris logging, historique et consultation.
- **Synchro montante** : au retour du réseau, PowerSync remonte automatiquement les écritures locales vers Postgres via un **connecteur d'upload** (qui applique les insert/update/delete en respectant la RLS Supabase).
- **Synchro descendante** : les modifications côté serveur (autre appareil, back-office) **redescendent** automatiquement dans le SQLite local selon les **sync rules**.

---

## 3. Sync rules — un périmètre de données par utilisateur

PowerSync réplique vers l'appareil uniquement les données que l'utilisateur a le droit de voir, découpées en **buckets** paramétrés par l'identité JWT Supabase. Exemple de forme (à affiner par entité lors du build) :

```yaml
bucket_definitions:
  user_data:
    # un bucket de données par utilisateur connecté (JWT Supabase)
    parameters: select request.user_id() as user_id
    data:
      - select * from workouts        where user_id = bucket.user_id and deleted_at is null
      - select * from sets            where user_id = bucket.user_id and deleted_at is null
      - select * from food_logs       where user_id = bucket.user_id and deleted_at is null
      - select * from body_weight_entries where user_id = bucket.user_id and deleted_at is null
      # ... les autres entités utilisateur

  shared_content:
    # contenu global lisible par tous (exercices, programmes éditoriaux, aliments) — lecture seule côté app
    data:
      - select * from exercises where deleted_at is null
      - select * from exercise_translations
      - select * from programs  where status = 'published' and deleted_at is null
      - select * from foods     where deleted_at is null
```

- **Données utilisateur** : synchronisées dans les deux sens (l'app écrit, ça remonte).
- **Contenu partagé** (bibliothèques d'exercices/programmes/aliments alimentées par le back-office) : synchronisé en **lecture seule** vers l'app. Cohérent avec la RLS Postgres.
- Le périmètre des buckets doit rester borné (attention aux **traces GPS volumineuses** — voir §7, point à valider tôt).

---

## 4. Résolution de conflits

La résolution de conflits est **fournie par PowerSync** — on ne code pas de logique de merge maison. Comportement à **confirmer et documenter lors du spike** (critère 5) :

- Par défaut, l'application des opérations distantes suit une logique déterministe de type dernier-écrivain (au niveau opération/ligne), configurable côté connecteur d'upload.
- Les conflits réels (même donnée modifiée hors-ligne sur 2 appareils) sont **rares** dans l'usage (un seul utilisateur, souvent un seul appareil actif à la fois).
- Le comportement exact retenu sera **acté dans l'ADR-001** après le spike (critère « conflit acceptable/configurable »).

> Différence clé avec le cadrage Dams : on ne maintient **plus de queue de synchro idempotente maison** ni de stratégie last-write-wins écrite à la main — PowerSync gère la file d'upload, les retries et l'ordonnancement.

---

## 5. Dev build Expo obligatoire

PowerSync embarque un **module natif** → **Expo Go ne suffit pas**. Dès le départ :

- Utiliser un **dev build Expo** (canal EAS `development`) pour développer et tester.
- Prévoir un environnement Android de dev : émulateur (Android Studio) **ou** téléphone Android physique + Expo Dev Client (débogage USB).
- Conséquence sur la CI/CD : les builds passent par **EAS Build** (voir [architecture.md](./architecture.md) §9).

---

## 6. Bonnes pratiques data (héritées de Dams, compatibles PowerSync)

Ces règles du cadrage Dams restent valables et sont **nécessaires** au bon fonctionnement de PowerSync :

- **UUID générés côté client** : indispensable en offline-first — on crée une entité sans attendre le serveur. PowerSync s'appuie sur ces identifiants stables pour réconcilier local ↔ serveur.
- **Timestamps en UTC partout** (`created_at`, `updated_at`) ; la conversion au fuseau local se fait uniquement à l'affichage et pour le calcul du « jour » (streak, journal alimentaire).
- **Soft delete via `deleted_at`** sur toutes les entités synchronisées : une suppression doit pouvoir **se propager** entre appareils (un delete dur ne se réplique pas proprement). Les lignes soft-deleted sont exclues des sync rules et des lectures applicatives.
- **Toute écriture passe par un repository** — jamais de SQL dans les composants ni les hooks d'écran. Le repository écrit dans le SQLite local géré par PowerSync ; la synchro est transparente pour la couche métier.
- **Migrations versionnées** (numérotées, immuables une fois mergées) côté Postgres, cohérentes avec le schéma local répliqué par PowerSync.

Ce qui **disparaît** par rapport à Dams : la queue de sync maison, la stratégie de conflit last-write-wins écrite à la main, le protocole d'upload/retry — désormais assurés par PowerSync.

---

## 7. Validation par spike (avant de figer le modèle)

La décision B est **conditionnelle** : elle n'est figée qu'après un spike réussi, **avant** de construire le vrai modèle de données. Critères (détail dans [spike-001-powersync.md](./spike-001-powersync.md)) :

1. Build : app Expo (dev build Android) intègre PowerSync sans blocage majeur.
2. Écriture offline : donnée créée/modifiée en mode avion, persistante et lisible immédiatement.
3. Synchro montante : au retour du réseau, la donnée locale remonte automatiquement dans Supabase.
4. Synchro descendante : une donnée modifiée côté Supabase (ou 2ᵉ appareil) redescend dans l'app.
5. Conflit : même donnée modifiée offline sur 2 appareils → comportement de résolution **acceptable/configurable**.
6. DX/effort : intégration **raisonnable pour 2 devs**.

**Point à valider tôt** : comportement de PowerSync sur les **données volumineuses** (traces GPS du pilier running). En cas d'échec d'un critère bloquant (1–4) → repli option C (Legend-State) de l'[ADR-001](../../adr/ADR-001-moteur-sync-offline.md).

Le verdict (✅ figé / ↩️ repli) est reporté dans l'ADR-001.

---

## 8. Compatibilité gamification future

Tout l'historique utilisateur (séances, repas validés, pesées) est **horodaté** et conservé (soft delete uniquement). Cet historique constitue de fait un **journal d'événements** sur lequel une future couche jeu (V3/V4, décision C) pourra se brancher **sans refonte du modèle de synchro** — aucune table de jeu n'est créée en V1. Voir [modele-donnees.md](./modele-donnees.md).
