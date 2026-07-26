# US CONF-06 — Health Connect — Plan d'implémentation

> ⚠️ **Workflow projet** : ne PAS exécuter avant validation des 3 livrables (spec + plan + maquette).
> ⚠️ **Migration cloud** (`db:push`) et **dev build** = étapes de déploiement **contrôlées** (Task 1 et
> Task 8), jamais lancées à l'aveugle.
> ⚠️ **Déclaration Google Play** (Task 0) : à lancer **dès la validation**, en parallèle du code — le
> délai (~2 semaines cumulées) est sur le chemin critique de LANCE-01, pas sur celui du dev.

**Goal :** écrire les séances et les courses terminées dans Health Connect, lire le poids d'une balance
connectée, sous consentement opt-in — sans jamais bloquer ni faire échouer un parcours existant.

**Architecture :** déclaration Play (hors code, en parallèle) → dépendances + config plugin + dev build →
migration (1 colonne) + type partagé + schéma PowerSync → **briques pures testées** dans
`packages/shared` → service adaptateur `health-connect.ts` (I/O, no-op hors Android) → section Réglages
+ i18n → câblage clôture séance/course + import de poids → recette device.

**Tech stack :** `react-native-health-connect` **3.5.3** (TurboModule, `codegenConfig`
`RNHealthConnectSpec` ; peer deps sans plancher RN ; minSdk 26) + config plugin `expo-health-connect`
**0.1.1** (⚠️ dernière publication le 31/07/2024) + `expo-build-properties` ; Expo SDK 57 / RN 0.86 ;
PowerSync ; Zod (`@wellness/shared`) ; Vitest (shared) + jest-expo (mobile) ; `expo-secure-store`
(déjà installé) pour l'horodatage du dernier import.

**Spec :** [docs/specs/functional/us/conf06-health-connect.md](../specs/functional/us/conf06-health-connect.md)

---

## Décisions d'implémentation (dérivées du code réel)

- **Configuration native = `app.json` + plugin, jamais de fichier natif édité.** `apps/mobile/android/`
  **n'est pas versionné** (vérifié : `git ls-files apps/mobile/android` est vide) → l'app est en CNG.
  Éditer `AndroidManifest.xml` ou `MainActivity.kt` à la main serait **écrasé** au prochain
  `expo prebuild`.
- **Qui pose quoi (vérifié dans les paquets publiés, pas supposé) :**
  | Élément | Posé par |
  |---|---|
  | 3 permissions `android.permission.health.*` | **nous**, dans `app.json` → `android.permissions` — **aucun plugin ne le fait** |
  | intent-filter `ACTION_SHOW_PERMISSIONS_RATIONALE` + `activity-alias ViewPermissionUsageActivity` | notre plugin `plugins/withHealthConnect.js` |
  | balise `queries` vers `com.google.android.apps.healthdata` | manifest de la bibliothèque, **fusionné automatiquement** |
  | délégué de permissions (`setPermissionDelegate`) | notre plugin, inséré dans `MainActivity.onCreate` |
- **Plugin maison plutôt que `expo-health-connect`** (décision du 27/07/2026, cf. spec §1) : la
  dépendance n'apportait que 20 lignes de Kotlin + 2 entrées de manifest, sans publication depuis
  juillet 2024. Reproduites dans `plugins/withHealthConnect.js`, idempotent et bruyant en cas de
  motif `MainActivity` introuvable. La dépendance a été **désinstallée**.
- **`insertRecords` n'accepte qu'un type de record par appel** et **jette sur une liste vide**
  (v3.5.3 : « All records must have the same type » / « You must provide at least one record »).
  Conséquence structurante : **un appel par `recordType`**, chacun précédé d'une garde
  `records.length > 0`. Une course = **2 appels** ; un rattrapage = jusqu'à **2 lots** (les
  `ExerciseSession` muscu + course ensemble, les `Distance` à part).
- **`initialize()` doit être appelé avant tout accès** — sinon tous les appels échouent. Il fait partie
  de la garde `ready()`, pas d'un appel isolé au démarrage.
- **Formes de données de l'API** : `Distance.distance` est un `Length` `{ unit: 'meters', value }`
  (pas un nombre) ; en lecture, `Weight.weight` est multi-unités → lire **`inKilograms`**, aucune
  conversion à écrire.
- **Toute la logique métier va dans `packages/shared`**, testée avec Vitest, **sans importer le module
  natif**. Le fichier mobile n'est qu'un adaptateur d'I/O. C'est ce qui rend l'US testable sans device
  (le module natif n'existe pas sous Jest/Node).
- **Import paresseux du module natif** (`await import('react-native-health-connect')` derrière la garde
  `Platform.OS === 'android'`) : évite de casser le bundle web (`npx expo export --platform web`, utilisé
  comme smoke-test de bundling) et les tests Jest.
- **`health_connect_enabled` en `integer` (0/1)** côté PowerSync (convention booléens du schéma),
  `boolean` côté Postgres et côté domaine. Mapping `null → false` (opt-in : l'absence de valeur ne vaut
  jamais consentement).
- **Pas de nouvelle sync rule** : `user_settings` est déjà couvert par
  `select * from user_settings where user_id = bucket.user_id and deleted_at is null`
  ([powersync-sync-rules.yaml:20](../specs/technical/powersync-sync-rules.yaml#L20)).
  L'ajout au **schéma client** reste obligatoire. À vérifier en recette (Task 9, critère 8) : si la
  colonne ne remonte pas, redéployer les sync rules pour forcer une re-synchro.
- **`clientRecordVersion` dérivé de `updated_at`** (millisecondes epoch) : croissant par construction,
  donc une réécriture ultérieure d'une même activité gagne toujours sur la précédente.
- **Aucune suppression de record** (spec §2.6) : pas de point d'ancrage — l'app ne supprime pas d'activité
  terminée. Ne pas inventer de câblage sur `cancelWorkout`/`cancelRun` (activité active, jamais écrite).
- **Titre de séance : jointure obligatoire.** `workouts` n'a **pas** de colonne `name` (vérifié dans
  [schema.ts](../../apps/mobile/src/powersync/schema.ts)) — le nom vient de `sessions.name` via
  `workouts.session_id`, absent pour une séance libre ou issue d'un template. La requête de
  `pushWorkout` fait donc un `LEFT JOIN sessions`, avec fallback i18n.
- **`notes` jamais exporté** : décision de minimisation de la spec §2.3 — vérifié par un test.

## Structure des fichiers

**Créer :**
- `packages/shared/src/health-connect.ts` (+ `health-connect.test.ts`) — briques **pures** :
  `buildWorkoutSessionRecord`, `buildRunRecords`, `selectWeightEntriesToImport`, `shouldImportWeight`.
- `apps/mobile/src/lib/health-connect.ts` — adaptateur d'I/O (import natif paresseux, no-op sûr).
- `apps/mobile/src/hooks/useHealthConnectWeightImport.ts` — import throttlé au premier plan
  (calque de `useAppOpenedAnalytics.ts`).
- `apps/mobile/src/components/HealthConnectSection.tsx` — section Réglages (5 états).
- `supabase/migrations/<horodaté>_health_connect_enabled.sql` — 1 colonne.
- `docs/specs/technical/health-connect-play-declaration.md` — procédure Play (Task 0).
- éventuellement `apps/mobile/plugins/withHealthConnectRationale.js` — complément de plugin si
  `expo-health-connect` ne pose pas l'`activity-alias` de justification (Task 2, Step 4).

**Modifier :**
- `apps/mobile/package.json` — 3 dépendances.
- `apps/mobile/app.json` — plugins `expo-health-connect` + `expo-build-properties` (minSdk 26).
- `packages/shared/src/settings.ts` — `healthConnectEnabled: z.boolean().default(false)`.
- `packages/shared/src/index.ts` — exports des briques pures.
- `apps/mobile/src/powersync/schema.ts` — colonne `health_connect_enabled` sur `user_settings`.
- `apps/mobile/src/data/repositories/settings-repository.ts` — mapping + `getHealthConnectEnabled()`.
- `apps/mobile/src/data/repositories/workout-repository.ts` — `finishWorkout` (§2.3).
- `apps/mobile/src/data/repositories/run-repository.ts` — `finishRun` (§2.4).
- `apps/mobile/src/app/settings.tsx` — insertion de la section.
- `apps/mobile/src/app/_layout.tsx` — montage du hook d'import.
- `apps/mobile/src/i18n/locales/{fr,en}.json` — `settings.healthConnect.*` + `legal.privacy.body`
  + mention dans le texte de suppression de compte.
- `supabase/MIGRATIONS.md`, `packages/shared/src/database.types.ts` (régénéré) — Task 8.
- `BACKLOG.md` — prérequis Play ajouté à LANCE-01 ; `docs/roadmap/roadmap.md` — statut 9.9 (via `/commit`).

---

## Task 0 — Déclaration Google Play (hors code, à lancer dès la validation)

**Files:** `docs/specs/technical/health-connect-play-declaration.md`

- [ ] **Step 1** : rédiger la procédure : formulaire « Health apps » (catégorie Health & Fitness →
      Activité), justification des 3 types (`WRITE_EXERCISE`, `WRITE_DISTANCE`, `READ_WEIGHT`), politique
      de confidentialité publiée, écran de justification des permissions, section « Sécurité des données ».
- [ ] **Step 2** : ajouter la dépendance dans `BACKLOG.md` sous les prérequis hors-code de LANCE-01,
      avec le délai (~7 j formulaire + 5-7 j ouvrés de propagation).
- [ ] **Step 3** : Florian soumet le formulaire dans la Play Console (**action humaine**, non automatisable).

> Ne bloque **pas** les tâches suivantes : une build de développement accède à Health Connect sans
> déclaration validée. Seule la **publication** est bloquée.

## Task 1 — Migration (fichier SQL, sans push)

**Files:** `supabase/migrations/<horodaté>_health_connect_enabled.sql`

- [ ] **Step 1** : `npm run db:new health_connect_enabled`.
- [ ] **Step 2** : écrire le SQL :

```sql
-- US CONF-06 — consentement Health Connect (opt-in : donnée de santé → jamais activé par défaut).
alter table public.user_settings
  add column health_connect_enabled boolean not null default false;
```

- [ ] **Step 3** : ne **pas** pousser ici — le push est groupé en Task 8 (étape contrôlée).

## Task 2 — Dépendances natives & configuration (aboutit à un dev build)

**Files:** `apps/mobile/package.json`, `apps/mobile/app.json`, éventuellement `apps/mobile/plugins/`

- [ ] **Step 1** : `npx expo install react-native-health-connect expo-health-connect expo-build-properties`
      (via `expo install` pour l'alignement SDK 57 ; vérifier ensuite `npx expo install --check`).
- [ ] **Step 2** : `app.json` → deux modifications distinctes :
      - `plugins` : `["expo-build-properties", { "android": { "minSdkVersion": 26 } }]` puis
        `"expo-health-connect"`. ⚠️ **Contrôler l'effet réel** sur le minSdk : Expo SDK 57 a son propre
        défaut, et Health Connect exige **26**.
      - `android.permissions` : ajouter `"android.permission.health.WRITE_EXERCISE"`,
        `"android.permission.health.WRITE_DISTANCE"`, `"android.permission.health.READ_WEIGHT"` aux deux
        entrées existantes. **Aucun plugin ne les déclare** — c'est la pièce qu'on oublie.
- [ ] **Step 3** : `npx expo prebuild --clean --platform android` puis **inspecter le résultat généré** :
      - `android/app/src/main/AndroidManifest.xml` : les **3 permissions** (venues du Step 2), la balise
        `queries` vers `com.google.android.apps.healthdata` (fusionnée depuis la bibliothèque),
        l'intent-filter `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` sur `MainActivity` et
        l'`activity-alias ViewPermissionUsageActivity` (tous deux posés par le plugin).
      - **Ne pas** chercher `setPermissionDelegate` dans `MainActivity.kt` : le délégué est posé **à
        l'exécution** par le module natif d'`expo-health-connect`. `MainActivity` vierge = normal.
        Contrôler plutôt que le module Expo est bien présent dans `node_modules` et lié au build.
- [ ] **Step 4** : **si** l'intent-filter ou l'`activity-alias` manque — cas plausible : le plugin n'a pas
      été republié depuis le 31/07/2024 et peut ne pas suivre le SDK 57 — écrire le plugin maison
      `plugins/withHealthConnectRationale.js` (`withAndroidManifest` uniquement, **pas** de
      `withMainActivity`) et le référencer dans `app.json`. Ne **jamais** éditer les fichiers natifs générés.
- [ ] **Step 5** : l'intent de justification doit atterrir sur l'écran **politique de confidentialité**
      existant (`/(auth)/privacy`). Câbler via le deep link `wellness://privacy` (scheme déjà déclaré).
- [ ] **Step 6** : produire le **dev build** (`npm run build:dev`, ou build local Android si le quota EAS
      est épuisé — voir [dev-build-android-local.md](../specs/technical/dev-build-android-local.md)) et
      l'installer sur un device réel.
- [ ] **Step 7** : smoke-test : l'app démarre, `getSdkStatus()` renvoie une valeur cohérente, aucune
      régression sur PowerSync/MapLibre (les deux modules natifs déjà en place).

**Tests :** aucun test automatisé possible ici (configuration native) — la validation est le smoke-test
device du Step 7.

## Task 3 — Briques pures (TDD, `packages/shared`)

**Files:** `packages/shared/src/health-connect.ts`, `packages/shared/src/health-connect.test.ts`,
`packages/shared/src/index.ts`

- [ ] **Step 1 (tests d'abord)** : écrire `health-connect.test.ts` :
      - `buildWorkoutSessionRecord` : type d'exercice musculation, `startTime`/`endTime` = `started_at`/
        `finished_at`, `title` par défaut si nom absent, `clientRecordId` = UUID de la séance,
        `clientRecordVersion` croissant avec `updated_at`, **`notes` absent du record** (test explicite de
        la décision de minimisation), `null` si `finished_at` manquant, `null` si durée ≤ 0.
      - `buildRunRecords` : renvoie **deux lots séparés par type** (`{ sessions, distances }`, pas un
        tableau mélangé — `insertRecords` refuse l'hétérogène) ; `distance` sous forme
        `{ unit: 'meters', value }` ; `distances` **vide** si `distance_m` est `null` ou `0` ;
        `clientRecordId` préfixés (`run-…` / `run-dist-…`) ; `null` si durée ≤ 0 ;
        `recordingMethod` = `MANUAL_ENTRY` si `source = 'manual'`.
      - `selectWeightEntriesToImport` : une pesée par jour (**la plus récente** du jour gagne) ; exclusion
        des jours déjà présents localement ; exclusion des poids ≤ 0 et > 500 kg ; poids lu dans
        `weight.inKilograms` ; date `AAAA-MM-JJ` dérivée du **`zoneOffset` du record** (pas du fuseau
        courant — sinon décalage d'un jour en voyage) ; exclusion des records dont
        `metadata.dataOrigin` est notre propre package ; liste vide en entrée → liste vide.
      - `shouldImportWeight` : `true` si jamais importé, `true` au-delà du seuil, `false` en dessous,
        robuste à un horodatage invalide.
- [ ] **Step 2** : implémenter jusqu'au vert. **Aucun** import de `react-native-health-connect` ici (les
      constantes de type d'exercice sont recopiées en constantes locales documentées, pour garder le
      paquet pur — à croiser avec la bibliothèque au Step 3).
- [ ] **Step 3** : vérifier les constantes contre la version **installée** (`node_modules`), pas contre la
      mémoire. Valeurs relevées en 3.5.3 : `ExerciseType.STRENGTH_TRAINING = 70`,
      `ExerciseType.RUNNING = 56`. ⚠️ **Piège** : le même fichier définit `ExerciseSegmentType` avec
      `RUNNING = 46` et `WEIGHTLIFTING = 65` — ce n'est **pas** la même énumération.
- [ ] **Step 4** : exporter depuis `packages/shared/src/index.ts`.

**Tests :** `npm run test -w packages/shared` (Vitest) — vert, code de sortie lu **sans pipe**.

## Task 4 — Réglage : migration côté client (colonne, type, mapping)

**Files:** `packages/shared/src/settings.ts`, `apps/mobile/src/powersync/schema.ts`,
`apps/mobile/src/data/repositories/settings-repository.ts`

- [ ] **Step 1** : `userSettingsRowSchema` → `healthConnectEnabled: z.boolean().default(false)`
      (commentaire « opt-in — donnée de santé »).
- [ ] **Step 2** : `schema.ts` → `health_connect_enabled: column.integer` sur la table `user_settings`.
- [ ] **Step 3** : `settings-repository.ts` → mapping lecture (`null → false`), prise en charge dans
      `updateSettings`, et accesseur `getHealthConnectEnabled()` utilisable **hors React** (calque exact de
      `getAnalyticsEnabled()`).
- [ ] **Step 4** : test du mapping `null → false` (jest-expo, à côté des tests de repository existants).

## Task 5 — Service adaptateur `health-connect.ts`

**Files:** `apps/mobile/src/lib/health-connect.ts`

- [ ] **Step 1** : `getAvailability()` → `'unsupported' | 'provider_missing' | 'provider_update_required' |
      'available'`, à partir de `Platform.OS` puis `getSdkStatus()`. **Niveau 1** de l'état de la spec
      §2.1 ; le niveau 2 (`off` / `permissions_missing` / `ready`) se compose dans l'UI à partir de
      `getAvailability()` + réglage + `hasPermissions()`. Exposer un `getSectionState()` qui fait cette
      composition, pour que la spec §2.1 et le code n'aient qu'**une** représentation de l'état.
- [ ] **Step 2** : `hasPermissions()` (`getGrantedPermissions`) et `requestPermissions()`
      (`requestPermission` sur les 3 permissions) — `requestPermissions` est le **seul** point qui
      déclenche une demande système.
- [ ] **Step 3** : garde commune privée `ready()` : Android + **`initialize()`** + provider disponible +
      réglage ON + permissions accordées. Toute fonction d'écriture/lecture commence par elle. Sans
      `initialize()`, tous les appels échouent — c'est l'oubli classique.
- [ ] **Step 4** : `pushWorkout(id)` / `pushRun(id)` : lecture de la ligne locale (PowerSync, avec
      `LEFT JOIN sessions` pour le titre côté muscu), appel de la brique pure, puis **un `insertRecords`
      par type de record**, chacun gardé par `length > 0`. `try/catch` + `console.warn`, **jamais de throw**.
- [ ] **Step 5** : `pushRecent(days = 30)` : sélection des `workouts` + `runs` `status='completed'` et
      `deleted_at IS NULL` des N derniers jours → **deux lots homogènes** (`ExerciseSession` puis
      `Distance`), chacun gardé par `length > 0` → renvoie le compte écrit. `recordingMethod` =
      `MANUAL_ENTRY` pour ces activités passées.
- [ ] **Step 6** : `importWeight(days = 30)` : `readRecords('Weight', { timeRangeFilter: between })`
      (⚠️ le résultat est `{ records, pageToken }` — ne pas supposer le tableau exhaustif, même si 30
      jours de pesées tiennent en une page) → dates déjà présentes
      (`SELECT log_date FROM body_weight_entries` **sans filtre `deleted_at`** : sinon une pesée
      supprimée serait ressuscitée à chaque import) → `selectWeightEntriesToImport` → `logWeight()` par
      jour retenu → renvoie le compte importé ; persiste l'horodatage du dernier import
      (`expo-secure-store`).
- [ ] **Step 7** : `openSettings()` (réglages Health Connect) et `openProviderInstall()` (fiche Play Store
      de `com.google.android.apps.healthdata`).
- [ ] **Step 8** : vérifier que **rien** de ce module ne charge le natif à l'import du fichier (import
      dynamique dans les fonctions) → contrôle : `npx expo export --platform web` passe toujours.

**Tests :** pas de test unitaire du natif ; la logique est déjà couverte en Task 3. Un test léger vérifie
que les fonctions renvoient un no-op sans throw quand `Platform.OS !== 'android'`.

## Task 6 — Section Réglages + i18n

**Files:** `apps/mobile/src/components/HealthConnectSection.tsx`, `apps/mobile/src/app/settings.tsx`,
`apps/mobile/src/i18n/locales/{fr,en}.json`

- [ ] **Step 1** : clés `settings.healthConnect.*` en FR et EN — **table du §4 de la spec, mot pour mot**
      (parité stricte, aucune chaîne en dur).
- [ ] **Step 2** : `HealthConnectSection` : rend l'un des **6** états du §2.1 (dont `off`, le cas par
      défaut de tout compte neuf), style repris des sections
      existantes de `settings.tsx` (`styles.card` / `styles.row` / `styles.hint`), interrupteur `Switch` +
      `Button variant="ghost"`, libellés d'accessibilité sur chaque contrôle.
- [ ] **Step 3** : activation → `requestPermissions()` → si accordées : `updateSettings({
      healthConnectEnabled: true })` puis `pushRecent(30)` et `importWeight(30)`, retour chiffré en
      **message inline dans la section** (pas d'`Alert` modale — la spec §2.4 dit « sans écran
      bloquant ») ; si refusées : réglage laissé OFF + message `denied`.
- [ ] **Step 4** : insertion dans `settings.tsx` **avant** la section « Statistiques d'usage » ; masquée
      hors Android (`getAvailability() === 'unsupported'`).
- [ ] **Step 5** : paragraphe Health Connect dans `legal.privacy.body` (FR/EN, tableau de chaînes lu via
      `returnObjects`) + mention dans l'écran de suppression de compte
      (`apps/mobile/src/app/account-delete.tsx`) : les données envoyées à Health Connect y restent.
- [ ] **Step 6** : re-vérifier la **parité FR/EN** (même ensemble de clés des deux côtés).

## Task 7 — Câblage

**Files:** `apps/mobile/src/data/repositories/workout-repository.ts`,
`apps/mobile/src/data/repositories/run-repository.ts`, `apps/mobile/src/hooks/useHealthConnectWeightImport.ts`,
`apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1** : `finishWorkout` — après le `patch('workouts', …)` et à côté du `void track(...)`
      existant : `void pushWorkout(id)`. **Fire-and-forget**, jamais `await` dans le chemin de clôture.
- [ ] **Step 2** : `finishRun` — idem avec `void pushRun(runId)` après le `patch('runs', …)`.
- [ ] **Step 3** : vérifier que les tests existants de clôture (muscu + course) restent verts — le module
      natif ne doit pas être chargé sous Jest (conséquence de la Task 5 Step 8). Ajouter un mock si besoin.
- [ ] **Step 4** : `useHealthConnectWeightImport` : au montage et au retour au premier plan, si
      `shouldImportWeight(lastImportAt, now, 6h)` → `void importWeight(30)`. Calque de
      `useAppOpenedAnalytics.ts` **pour la gestion d'`AppState` uniquement**. Deux différences à ne pas
      manquer : le throttle d'`app_opened` vit dans une **variable module** (perdue au démarrage à froid),
      alors qu'ici l'horodatage est **persisté** (`expo-secure-store`) — parce que la section Réglages
      affiche « Dernier import : … » ; et cette lecture est **asynchrone**, donc l'effet doit `await` le
      curseur avant de décider (pas de comparaison synchrone comme dans le modèle).
- [ ] **Step 5** : monter le hook dans `_layout.tsx` à côté de `useAppOpenedAnalytics()`. ⚠️ Un hook
      s'appelle **inconditionnellement** : la précaution « après `hasSynced` » ne peut pas être un montage
      conditionnel. Signature `useHealthConnectWeightImport(enabled: boolean)` avec
      `enabled = !!session && syncStatus.hasSynced`, et la garde **à l'intérieur** de l'effet — c'est ainsi
      qu'`autoCloseStaleWorkout` est protégé (`useEffect` gardé, `_layout.tsx` L146-151), alors
      qu'`useAppOpenedAnalytics()` est appelé sans condition (L169).

## Task 8 — Déploiement (étapes contrôlées)

- [ ] **Step 1** : `npm run db:push:dry` → contrôler que **seule** la migration CONF-06 partira.
- [ ] **Step 2** : `npm run db:push`.
- [ ] **Step 3** : `npm run db:types` (régénère `packages/shared/src/database.types.ts`).
- [ ] **Step 4** : cocher la migration dans [supabase/MIGRATIONS.md](../../supabase/MIGRATIONS.md) (case + date).
- [ ] **Step 5** : **sync rules** — pas de mise à jour attendue (`select *`). Si la recette montre que la
      colonne ne remonte pas, coller [powersync-sync-rules.yaml](../specs/technical/powersync-sync-rules.yaml)
      dans le dashboard PowerSync et déployer.
- [ ] **Step 6** : `npm run typecheck`, `npm run lint`, `npm run test` — **lire le code de sortie sans pipe**.
- [ ] **Step 7** : nouveau dev build si la config native a changé depuis la Task 2.

## Task 9 — Recette device (Android réel — obligatoire)

- [ ] Dérouler les **14 critères** du §11 de la spec sur un device réel, dont : opt-in par défaut,
      écriture séance/course, **absence de doublon** au second rattrapage, import de poids,
      **non-écrasement** d'une saisie de l'app, permissions révoquées, provider absent, hors-ligne,
      annulation, désactivation, i18n EN.
- [ ] Vérifier les données côté Health Connect (app système) : type, horaires, durée, distance, **absence
      des notes de séance**.
- [ ] Consigner les écarts ; corriger avant de passer `etape: recette` → `close` via `/commit`.
- [ ] **Réajuster l'estimation de la roadmap** : l'item 9.9 est chiffré **6 h**, ce qui ne couvre ni le
      module natif, ni le dev build, ni la déclaration Play. À corriger au passage de `/commit`.

---

## Ordre de build & jalons

1. **Task 0** (déclaration Play) démarre **en parallèle** de tout le reste — délai externe.
2. **Task 1 + 2** : socle natif. Jalon = **dev build installé qui démarre**. Sans ce jalon, rien n'est
   vérifiable → ne pas empiler du code par-dessus.
3. **Task 3** : briques pures. Jalon = tests Vitest verts (le gros de la logique est acquis ici, sans device).
4. **Task 4 → 5** : réglage puis service.
5. **Task 6** : UI + i18n, conformément à la maquette
   [design/conf06-health-connect/](../../design/conf06-health-connect/conf06-health-connect.html) — validée
   **avant** la Task 1, comme tout le reste (règle CLAUDE.md : aucun code avant validation des 3 livrables).
6. **Task 7** : câblage — dernier, pour ne toucher aux chemins critiques (clôture de séance) qu'une fois
   tout le reste sûr.
7. **Task 8 → 9** : déploiement puis recette device.

## Risques

| Risque | Probabilité | Parade |
|---|---|---|
| ~~`expo-health-connect` non maintenu~~ — **écarté** : remplacé par `plugins/withHealthConnect.js`, la dépendance est désinstallée | — | Risque supprimé à la racine (27/07/2026) |
| Le plugin maison édite `MainActivity.kt` par motif texte : une montée d'Expo peut changer ce fichier | Faible-moyenne | Le plugin **jette** si `super.onCreate(...)` est introuvable → `prebuild` rouge, jamais une build silencieusement cassée. Idempotence vérifiée (prebuild rejoué sans `--clean`) |
| Incompatibilité de `react-native-health-connect` 3.5.3 (TurboModule) avec RN 0.86 | Faible — pas de plancher RN déclaré, architecture moderne | Détectée dès la Task 2 (smoke-test), avant tout autre développement |
| Permissions santé oubliées dans `app.json` (aucun plugin ne les pose) | **Forte si on suit une doc générique** | Explicité en décision d'implémentation + Task 2 Step 2 ; symptôme = demande de permissions vide |
| `insertRecords` appelé avec un lot hétérogène ou vide → exception | Forte si on l'ignore | Découpage par `recordType` + garde `length > 0`, imposés dès la brique pure (Task 3) |
| `minSdkVersion` non relevé à 26 par `expo-build-properties` | Faible | Contrôlé explicitement au Step 2/3 ; build en échec = signal immédiat |
| Déclaration Play refusée / justification jugée insuffisante | Moyenne | Task 0 lancée tôt, périmètre volontairement minimal (3 permissions) |
| Le module natif casse les tests Jest ou le bundle web | Moyenne | Import dynamique derrière garde (Task 5 Step 8) + contrôle `expo export` |
| Doublons dans Health Connect | Faible | `clientRecordId` (mécanisme natif) + critère de recette 5 |
| Écrasement d'un poids saisi dans l'app | Faible | Règle « l'app gagne » testée en pur (Task 3) + critère de recette 7 |
