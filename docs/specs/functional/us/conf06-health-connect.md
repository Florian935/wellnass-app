---
id: CONF-06
titre: "Health Connect — écriture des séances, lecture du poids (Android)"
roadmap: [9.9]
catalogue: []
etape: recette
branche: feature/conf06-health-connect
maj: 27/07/2026
---
# US CONF-06 — Health Connect (écriture des séances, lecture du poids)

> Brancher l'app sur **Health Connect** (Android) : **écrire** les séances de musculation et les
> courses terminées dans le hub santé du téléphone, et **lire** le poids corporel mesuré par une
> balance connectée pour alimenter le suivi de poids. Roadmap
> [9.9](../../../roadmap/roadmap.md) (V0.8, **P0 bloquant lancement**).
> Branche : `feature/conf06-health-connect` · Validée le 27/07/2026 ·
> **Statut : code livré, en attente de recette device** (`etape: recette`).
> **1 migration** (1 colonne de réglage, poussée le 27/07/2026) · **1 module natif** → **dev build**
> obligatoire pour recetter ·
> ⚠️ **déclaration Google Play préalable** avec délai de review (voir §9) — impacte LANCE-01.

## 0. Contexte

Aucune brique santé n'existe aujourd'hui (vérifié : zéro occurrence de Health Connect dans
`apps/`). L'app est le seul endroit où vivent les séances : elles n'apparaissent ni dans Google
Fit, ni dans Samsung Health, ni dans les apps tierces qui lisent Health Connect. Symétriquement, le
poids se saisit **à la main** (`body_weight_entries`, une pesée par jour) alors que la plupart des
utilisateurs possédant une balance connectée l'ont déjà dans Health Connect.

**Health Connect** est le hub santé d'Android : une base de données locale à l'appareil, exposée par
une API de permissions granulaires. Intégré au système depuis **Android 14** ; sur Android 8→13 c'est
une application à installer depuis le Play Store. Aucune donnée ne transite par nos serveurs : tout
est **local à l'appareil**.

Contexte technique (vérifié dans le dépôt) :
- `apps/mobile/android/` **n'est pas versionné** (CNG / prebuild) → **toute configuration native doit
  passer par un config plugin Expo**. Une édition manuelle de `AndroidManifest.xml` ou de
  `MainActivity.kt` serait écrasée au prochain `expo prebuild`.
- Points d'ancrage existants : `finishWorkout()` ([workout-repository.ts:623](../../../../apps/mobile/src/data/repositories/workout-repository.ts#L623))
  et `finishRun()` ([run-repository.ts:524](../../../../apps/mobile/src/data/repositories/run-repository.ts#L524)),
  tous deux **idempotents** (garde « déjà terminée → no-op ») et déjà porteurs d'un effet de bord
  best-effort en fin de fonction : `void track(...)` dans les deux, plus le marquage de l'occurrence
  planifiée dans `finishWorkout` seulement.
- Le poids s'écrit via `logWeight(date, weightKg)` ([bodyweight-repository.ts](../../../../apps/mobile/src/data/repositories/bodyweight-repository.ts)),
  déjà en **upsert par jour**.
- `user_settings` est couvert par `select *` dans les [sync rules](../../technical/powersync-sync-rules.yaml)
  → **aucune nouvelle table**, donc **pas de redéploiement de sync rules attendu** (à confirmer en recette).
- Modèle de référence pour un réglage de confidentialité + service non bloquant : **US 9.10**
  ([spec](9.10-analytics-produit.md)).

### Décisions de cadrage retenues (à confirmer à la validation)

| # | Sujet | Décision retenue | Alternative écartée |
|---|---|---|---|
| 1 | Sens de la synchro | **Écriture** séances/courses · **lecture** poids seulement | Lecture des séances tierces (doublons, dédoublonnage non trivial) → hors périmètre |
| 2 | Consentement | **Opt-in** explicite (réglage OFF par défaut) + permission système demandée **uniquement** sur action dans les Réglages | Opt-out : inacceptable pour de la donnée de santé |
| 3 | Idempotence | **`clientRecordId` = UUID de la séance/course** (mécanisme natif Health Connect : re-insertion = mise à jour) | Table de suivi des exports maison (état à maintenir, dérive possible) |
| 4 | Rattrapage | À l'activation, **push des 30 derniers jours** (sûr car idempotent) | Aucun rattrapage : l'activation semblerait sans effet |
| 5 | Curseur de lecture poids | **Aucun** : fenêtre glissante de **30 jours** relue, seuls les jours **absents** localement sont créés | Curseur persisté : état local supplémentaire, faux sur un 2ᵉ appareil |
| 6 | Conflit de poids | La saisie de l'app **gagne toujours** : l'import ne crée jamais par écrasement | « Le plus récent gagne » : nécessite de comparer des horodatages hétérogènes |
| 7 | Permissions demandées | `WRITE_EXERCISE`, `WRITE_DISTANCE`, `READ_WEIGHT` | `READ_EXERCISE`, `WRITE_WEIGHT`, calories, fréquence cardiaque → chaque type ajouté doit être justifié à Google (§9) |

## 1. Périmètre à livrer

- **Dépendances natives** : `react-native-health-connect` (v3) + `expo-build-properties`
  (minSdk 26). → **nouveau dev build** requis.
- **Configuration native**, répartie en trois endroits distincts :
  - les **3 permissions santé** → tableau `android.permissions` d'`app.json` (aucun plugin ne les
    déclare, ni celui de la bibliothèque ni `expo-health-connect`) ;
  - l'**écran de justification des permissions** (exigence Google, §9 : intent-filter
    `ACTION_SHOW_PERMISSIONS_RATIONALE` + `activity-alias ViewPermissionUsageActivity`) → posé par
    notre **plugin maison** `plugins/withHealthConnect.js` ;
  - le **délégué de permissions** (`setPermissionDelegate`, à enregistrer avant que l'activité
    passe à RESUMED) → inséré dans `MainActivity.onCreate` par le même plugin.
  La balise `queries` vers `com.google.android.apps.healthdata` vient du manifest de la
  bibliothèque et est fusionnée automatiquement — rien à faire.

> **Décision (27/07/2026) : plugin maison plutôt que `expo-health-connect`.** Cette dépendance
> n'apportait que 20 lignes de Kotlin (le délégué) et deux entrées de manifest, sans publication
> depuis le 31/07/2024, avec un `build.gradle` figeant un `compileSdkVersion` de repli à 34 et une
> version dynamique de `react-native`. On reproduit ses trois effets dans un plugin versionné et
> lisible ; la dépendance est supprimée. Le module natif `react-native-health-connect` (3.5.3,
> maintenu, TurboModule) reste, lui, une dépendance normale.
- **Migration** : `user_settings.health_connect_enabled boolean not null default false` (opt-in).
- **Service `apps/mobile/src/lib/health-connect.ts`** : disponibilité, permissions, écriture des
  séances/courses, lecture du poids. **Ne jette jamais**, no-op hors Android.
- **Briques pures testées** (`packages/shared`) : conversion séance → record Health Connect,
  conversion course → records, et sélection des pesées à importer (diff local ↔ Health Connect).
- **Écran de réglages** : section « Health Connect » (état, interrupteur, bouton de permission,
  bouton d'import du poids, lien vers les réglages Health Connect du système).
- **Câblage** : écriture à la clôture d'une séance / d'une course (best-effort, non bloquante).
- **Import du poids** : à l'activation, puis à chaque ouverture de l'app (throttlé), puis à la demande.
- **i18n FR + EN** complet + **mention Health Connect** dans la politique de confidentialité.
- **Documentation** : procédure de **déclaration Google Play** (§9) dans
  [docs/specs/technical/](../../technical/) — c'est un prérequis de LANCE-01, avec un délai.

**Hors périmètre (à ne pas implémenter ici) :**
- **Lecture des séances / courses** enregistrées par d'autres applications (import d'activités) —
  demanderait un dédoublonnage fin ; à cadrer séparément si le besoin apparaît.
- **Écriture du poids** vers Health Connect (l'app est consommatrice sur ce type, pas productrice).
- **Pas, sommeil, fréquence cardiaque, calories, VO2max** — chaque type de donnée alourdit la
  déclaration Play ; voir [IDEAS.md](../../../../IDEAS.md) (données sommeil / pas).
- **Apple Health** (iOS) — arrive avec le portage iOS, item 9.1 de la roadmap.
- **Trace GPS** dans le record (`exerciseRoute`) — dépend de RUN-F1b (altitude absente de la trace).
- **Synchro en arrière-plan** (WorkManager / tâche périodique) : tout se déclenche au premier plan.

## 2. Comportement attendu

### 2.1 États de la section

L'état affiché se calcule sur **deux niveaux**, dans cet ordre : d'abord la **disponibilité** du
fournisseur (`unsupported` / `provider_missing` / `provider_update_required` / `available`), puis, si
`available`, le **croisement réglage × permissions**.

| État | Condition | Ce que voit l'utilisateur (Réglages) |
|---|---|---|
| `unsupported` | Plateforme ≠ Android | La section **n'est pas affichée** |
| `provider_missing` | Health Connect absent (Android ≤ 13 sans l'app) | Message + bouton « Installer Health Connect » (ouvre la fiche Play Store) |
| `provider_update_required` | Health Connect présent mais trop ancien | Message + bouton « Mettre à jour Health Connect » |
| `off` | Disponible, **réglage OFF** — cas par défaut de tout compte neuf | Section affichée, interrupteur **OFF**, texte d'explication, aucune permission demandée |
| `permissions_missing` | Disponible, réglage ON, permissions non accordées | Bandeau + bouton « Autoriser l'accès » |
| `ready` | Disponible, réglage ON + permissions accordées | Interrupteur ON, date du dernier import de poids, bouton « Importer le poids maintenant » |

Règle : **l'app ne demande jamais les permissions Health Connect d'elle-même.** Elles sont
demandées uniquement sur un tap explicite dans les Réglages. Si l'utilisateur les refuse, le réglage
retombe à OFF avec un message expliquant comment les accorder plus tard.

### 2.2 Réglage (opt-in)

- Colonne `user_settings.health_connect_enabled`, **défaut `false`**, synchronisée entre appareils.
- Section « Health Connect » dans les Réglages, placée avant « Statistiques d'usage ».
- Activer → demande de permissions → si accordées : réglage ON + **rattrapage 30 jours** (§2.4) +
  **import du poids** (§2.5). Si refusées : réglage reste OFF.
- Désactiver → aucune écriture ni lecture ultérieure. **Les records déjà écrits dans Health Connect
  ne sont pas supprimés** (ils appartiennent à l'utilisateur, qui les gère depuis Health Connect) ;
  le message d'aide le dit explicitement et propose le lien vers les réglages Health Connect.
- Le réglage exprime une **intention synchronisée** ; les permissions sont **locales à l'appareil**.
  Sur un 2ᵉ appareil, réglage ON mais permissions absentes → état `permissions_missing`, aucune
  écriture, aucune demande intempestive.

### 2.3 Écriture d'une séance de musculation

Déclenchée en fin de `finishWorkout()`, **après** le `patch('workouts', …)`, en fire-and-forget
(`void`), comme l'appel `track()` existant. Un échec n'empêche jamais la clôture.

Record `ExerciseSession` :

| Champ | Valeur |
|---|---|
| `exerciseType` | `ExerciseType.STRENGTH_TRAINING` (= 70). ⚠️ Ne pas confondre avec `ExerciseSegmentType`, dont les valeurs diffèrent |
| `startTime` / `endTime` | `started_at` / `finished_at` de la séance (ISO UTC) |
| `title` | Nom de la séance **si résolvable**, sinon libellé i18n « Séance de musculation ». `workouts` n'a **pas** de colonne `name` : le nom vient de `sessions.name` par jointure sur `workouts.session_id` — une séance libre ou issue d'un template n'a pas de `session_id`, donc **pas de nom** → fallback i18n |
| `notes` | **Jamais renseigné** (les notes de séance sont du texte libre personnel — on ne l'exporte pas) |
| `metadata.clientRecordId` | `workout-<uuid de la séance>` (préfixé, comme pour la course : cohérence de lecture et suppression future non ambiguë) |
| `metadata.clientRecordVersion` | Compteur croissant dérivé de `updated_at` (millisecondes) |
| `metadata.recordingMethod` | `ACTIVELY_RECORDED` quand la séance est écrite **à sa clôture** ; `MANUAL_ENTRY` lors du **rattrapage** d'activités passées (§2.4) — dire la vérité sur la provenance |

Conséquence du `clientRecordId` : réécrire la même séance **met à jour** le record au lieu de le
dupliquer. C'est ce qui rend le rattrapage et les retentatives sûrs, sans état à conserver.

### 2.4 Écriture d'une course

Déclenchée en fin de `finishRun()`, mêmes garanties. **Deux records**, `clientRecordId` préfixé par
type (`run-<uuid>` / `run-dist-<uuid>`) :
- `ExerciseSession` avec `exerciseType` = `ExerciseType.RUNNING` (= 56), `startTime`/`endTime`,
  `title` par défaut « Course ».
- `Distance` avec `distance` = `{ unit: 'meters', value: distance_m }` (l'API attend un objet
  `Length`, pas un nombre), même intervalle de temps — **omis si `distance_m` est nul** (course sans
  distance : GPS refusé, saisie manuelle sans distance).
- `recordingMethod` = `MANUAL_ENTRY` si `source = 'manual'`, `ACTIVELY_RECORDED` sinon.

> ⚠️ **`insertRecords` n'accepte qu'un seul type de record par appel** et **jette sur une liste vide**
> (vérifié dans la v3 : « All records must have the same type » / « You must provide at least one
> record »). Une course produit donc **deux appels** — un par type — et chaque appel est précédé d'une
> garde sur la liste vide. Ce n'est pas un détail d'implémentation : c'est ce qui dicte le découpage.

**Rattrapage à l'activation** : les séances et courses **terminées** (`status = 'completed'`,
`deleted_at is null`) des **30 derniers jours** sont écrites **par lots homogènes** (les
`ExerciseSession` muscu + course ensemble, les `Distance` à part). Borné, idempotent, **sans écran
bloquant** : le résultat s'affiche en message **inline** dans la section Réglages
(« N activités synchronisées »), pas en boîte de dialogue modale.

### 2.5 Lecture du poids

- Lit les records `Weight` de la **fenêtre glissante des 30 derniers jours**.
- Chaque record est ramené à une **date locale** + un poids en **kg**. Deux précisions issues de
  l'API : le poids se lit dans `weight.inKilograms` (l'API renvoie un objet multi-unités → **aucune
  conversion à écrire**), et la date `AAAA-MM-JJ` se dérive du `zoneOffset` **du record**, pas du
  fuseau courant de l'appareil — sinon une pesée bascule d'un jour quand l'utilisateur voyage.
- Si plusieurs pesées le même jour : on garde **la plus récente** de la journée (cohérent avec
  « une pesée par jour »).
- Pour chaque jour retenu : **crée** l'entrée locale via `logWeight()` **seulement si aucune entrée
  n'existe déjà pour ce jour** (décision 6 : l'app gagne toujours, jamais d'écrasement).
- Déclenchement : à l'activation du réglage, à l'ouverture de l'app (**throttlé ≥ 6 h**, au premier
  plan, best-effort), et sur le bouton « Importer le poids maintenant ».
- Les records écrits **par nous** sont ignorés : filtrage **côté client** sur
  `metadata.dataOrigin !== 'com.wellness.app'` — l'API ne propose qu'un filtre d'origine *inclusif*
  (allowlist), pas d'exclusion. L'app n'écrit pas de poids aujourd'hui, mais la garde évite tout
  aller-retour si cela change.

### 2.6 Suppression — point ouvert assumé

**Aucune suppression de record Health Connect n'est livrée ici, faute de point d'ancrage :** l'app ne
permet pas aujourd'hui de supprimer une séance ou une course **terminée**. Les seules suppressions
existantes sont `cancelWorkout()` / `cancelRun()`, qui portent sur une activité **active** — jamais
écrite dans Health Connect (l'écriture n'a lieu qu'à la clôture).

Conséquence à assumer et à écrire dans l'aide : **une activité envoyée à Health Connect s'y supprime
depuis Health Connect**, pas depuis l'app. Le jour où l'historique devient supprimable (US future), il
faudra ajouter `deleteActivityRecord(kind, id)` : l'API le permet directement par `clientRecordId`
(`deleteRecordsByUuids(recordType, [], [clientRecordIds])`, vérifié), donc **aucun état supplémentaire
à prévoir** — c'est le bénéfice de la décision 3.

## 3. Architecture

- **`apps/mobile/src/lib/health-connect.ts`** — seule frontière avec le module natif :
  `getAvailability()`, `hasPermissions()`, `requestPermissions()`, `pushWorkout(id)`,
  `pushRun(id)`, `pushRecent(days)`, `importWeight(days)`, `openSettings()`.
  **Toutes** ces fonctions : `try/catch` interne, **ne jettent jamais**,
  **no-op immédiat** si `Platform.OS !== 'android'` ou réglage OFF ou permissions absentes.
  Une garde interne commune (`ready()`) appelle **`initialize()`** avant tout accès — sans lui, tous
  les appels échouent.
- **`packages/shared/src/health-connect.ts`** — briques **pures et testées**, sans dépendance native :
  - `buildWorkoutSessionRecord(input)` / `buildRunRecords(input)` : construction des records
    (types, horodatages, `clientRecordId`, `clientRecordVersion`) ;
  - `selectWeightEntriesToImport(remote, localDates)` : réduction des records à **une pesée par
    jour** + exclusion des jours déjà présents localement ;
  - `shouldImportWeight(lastImportAt, now, throttleHours)` : décision de throttle.
  C'est là que vit la logique métier ; le service mobile n'est plus qu'un adaptateur d'I/O.
- **Migration** `supabase/migrations/<horodaté>_health_connect_enabled.sql` : une colonne sur
  `user_settings`. Poussée via `db:push`, types régénérés (`db:types`), cochée dans
  [MIGRATIONS.md](../../../../supabase/MIGRATIONS.md).
- **PowerSync** : colonne `health_connect_enabled` (`integer` 0/1) ajoutée au **schéma client**.
  `user_settings` étant déjà couvert par `select *`, **aucune nouvelle sync rule** n'est attendue —
  à vérifier en recette (§10.8).
- **Type partagé** : `healthConnectEnabled: z.boolean().default(false)` dans `userSettingsRowSchema`
  + mapping dans `settings-repository` + accesseur hors React (comme `getAnalyticsEnabled()`).
- **Config plugin** : `./plugins/withHealthConnect` dans `app.json` (manifest + délégué),
  `expo-build-properties` pour `minSdkVersion: 26`, et les **3 permissions santé** dans
  `android.permissions` (cf. §1). Le plugin est **idempotent** (vérifié : un prebuild rejoué sans
  `--clean` ne duplique ni l'intent-filter, ni l'alias, ni l'appel au délégué) et **échoue
  bruyamment** si `MainActivity` ne présente plus le motif attendu après une montée d'Expo — un
  prebuild rouge vaut mieux qu'une build où la demande de permissions plante en recette.
- **Câblage** : `finishWorkout` / `finishRun` (écriture), `_layout` racine (import de poids throttlé
  au premier plan, sur le modèle de `useAppOpenedAnalytics`), `settings.tsx` (section dédiée).
- **Curseur de throttle** : horodatage du dernier import stocké **localement à l'appareil**
  (`expo-secure-store`, déjà installé) — jamais synchronisé, puisque Health Connect est local.

## 4. i18n (FR + EN)

Aucune chaîne en dur, parité stricte. Clés sous `settings.healthConnect.*` :

| Clé | FR | EN |
|---|---|---|
| `title` | Health Connect | Health Connect |
| `toggle` | Synchroniser avec Health Connect | Sync with Health Connect |
| `subtitle` | Tes séances et tes courses sont ajoutées au hub santé d'Android ; ton poids y est relu. Tout reste sur ton téléphone. | Your workouts and runs are added to Android's health hub, and your weight is read back from it. Everything stays on your phone. |
| `providerMissing` | Health Connect n'est pas installé sur cet appareil. | Health Connect isn't installed on this device. |
| `install` | Installer Health Connect | Install Health Connect |
| `updateRequired` | Health Connect doit être mis à jour. | Health Connect needs an update. |
| `permissionsMissing` | Autorise l'accès pour lancer la synchronisation. | Allow access to start syncing. |
| `grant` | Autoriser l'accès | Allow access |
| `denied` | Accès refusé. Tu peux l'autoriser à tout moment depuis les réglages de Health Connect. | Access denied. You can allow it any time from Health Connect settings. |
| `importWeight` | Importer le poids maintenant | Import weight now |
| `imported` | {{count}} pesée(s) importée(s) | {{count}} weight entries imported |
| `pushed` | {{count}} activité(s) synchronisée(s) | {{count}} activities synced |
| `lastImport` | Dernier import : {{date}} | Last import: {{date}} |
| `openSettings` | Ouvrir les réglages Health Connect | Open Health Connect settings |
| `disableHint` | Désactiver arrête la synchronisation. Les données déjà envoyées restent dans Health Connect ; supprime-les depuis Health Connect si tu le souhaites. | Turning this off stops syncing. Data already sent stays in Health Connect — delete it there if you want. |
| `defaultWorkoutTitle` | Séance de musculation | Strength workout |
| `defaultRunTitle` | Course | Run |

+ un paragraphe dans `legal.privacy.body` (FR/EN) : données de santé échangées **localement** avec
Health Connect, jamais transmises à nos serveurs, désactivable dans les Réglages, révocable depuis
Health Connect.

## 5. Offline

Health Connect est une **base locale** : tout fonctionne **hors-ligne**, sans exception.
- Écriture d'une séance/course hors-ligne → record écrit immédiatement dans Health Connect ;
  la synchro PowerSync du même enregistrement suit son propre chemin, indépendamment.
- Import du poids hors-ligne → fonctionne ; les entrées créées sont synchronisées plus tard par
  PowerSync comme toute saisie locale.
- Le réglage lui-même est une donnée PowerSync : basculé hors-ligne, il s'applique tout de suite.

## 6. Accessibilité

Interrupteur et boutons étiquetés (`accessibilityLabel`, `accessibilityRole`), messages d'état
annoncés comme du texte (pas seulement une couleur), cible tactile ≥ 44 px. À contrôler dans la
passe globale **CONF-07** (9.11/9.12), qui reste l'US de référence pour l'accessibilité.

## 7. Sécurité & RGPD

- **Donnée de santé = catégorie sensible.** Base légale = **consentement explicite** → opt-in,
  jamais activé par défaut, révocable en un tap (app) et depuis Health Connect (système).
- **Aucune donnée de santé ne transite par nos serveurs du fait de cette US** : l'échange est
  local, appareil ↔ Health Connect. Le seul champ qui part vers Supabase est le booléen de réglage.
- **Minimisation** : 3 permissions seulement (§décision 7), aucun texte libre exporté (les `notes`
  de séance ne partent pas), pas de trace GPS.
- **Transparence** : mention dans la politique de confidentialité + écran de justification des
  permissions (exigé par Google, §9) qui pointe cette politique.
- **Suppression du compte (CONF-02)** : la purge Supabase ne touche pas Health Connect (données
  hors de notre périmètre). Le texte de suppression de compte doit le **dire** : les données
  envoyées à Health Connect restent dans Health Connect, à supprimer depuis Health Connect.
- **Export (CONF-01)** : inchangé — les entrées de poids importées sont des `body_weight_entries`
  ordinaires, donc déjà exportées.

## 8. Cas limites

| Situation | Comportement |
|---|---|
| Plateforme non Android | Section masquée, service entièrement no-op (aucun import du module natif au chargement) |
| Health Connect absent / trop ancien | État explicite + bouton d'action ; aucune écriture tentée |
| Réglage ON mais permissions révoquées depuis le système | Détecté au prochain appel → état `permissions_missing`, aucune écriture, aucune demande automatique |
| Permissions partielles (écriture accordée, lecture refusée) | Chaque sens fonctionne indépendamment : les séances partent, l'import de poids est simplement sauté |
| Double clôture d'une séance | `finishWorkout` est déjà no-op au 2ᵉ appel → aucune double écriture ; et même en cas de réécriture, `clientRecordId` déduplique |
| Séance sans `finished_at` (impossible après clôture) | Record non construit (garde), log, aucun crash |
| Course sans distance (`distance_m` nul) | `ExerciseSession` seul, **aucun appel** pour le lot `Distance` (l'API jette sur une liste vide) |
| Rattrapage sans aucune activité sur 30 jours | Aucun appel d'écriture, message « 0 activité synchronisée » |
| Séance de durée nulle ou négative | Écartée par la brique pure (Health Connect refuse `endTime <= startTime`) |
| Pesée Health Connect un jour déjà saisi dans l'app | **Non importée** (l'app gagne, décision 6) |
| Plusieurs pesées le même jour dans Health Connect | La plus récente du jour est retenue |
| Poids hors bornes plausibles (≤ 0 ou > 500 kg) | Écarté par la brique pure (`weight_kg > 0` en base) |
| Health Connect indisponible au moment de la clôture | Échec silencieux (log) ; rattrapé au prochain rattrapage 30 jours si l'utilisateur relance depuis les Réglages |
| Activité de plus de 30 jours | Hors fenêtre de rattrapage — assumé (borne explicite, annoncée dans l'aide) |
| 2ᵉ appareil | Réglage ON hérité, permissions à accorder localement ; les activités déjà dans Health Connect de l'appareil A n'y sont pas dupliquées |

## 9. Prérequis Google Play (⚠️ délai — impacte LANCE-01)

Utiliser Health Connect en production **n'est pas seulement technique** : Google exige, **avant**
publication, que l'app soit déclarée et autorisée. À lancer **dès la validation de cette US**, sans
attendre la fin du code, car les délais s'additionnent (~7 jours pour le formulaire, puis 5 à 7
jours ouvrés de propagation).

1. **Formulaire de déclaration « Health apps »** dans la Play Console : catégorie *Health & Fitness*
   (Activité), puis **justification de chaque type de données** demandé (`WRITE_EXERCISE`,
   `WRITE_DISTANCE`, `READ_WEIGHT`) — justification claire, accès minimal, aucune demande « au cas où ».
2. **Politique de confidentialité publiée** (URL accessible depuis la fiche Play **et** depuis
   Health Connect) — dépend de la rédaction juridique déjà listée comme prérequis de LANCE-01.
3. **Écran de justification des permissions** : l'app doit répondre à l'intent
   `ACTION_SHOW_PERMISSIONS_RATIONALE` et afficher pourquoi elle demande ces données (renvoi vers
   l'écran politique de confidentialité existant).
4. **Section « Sécurité des données »** de la fiche Play mise à jour (collecte / partage).
5. **Re-déclaration** obligatoire si l'on ajoute un type de données plus tard (pas, sommeil…).

> **Sans déclaration validée**, l'utilisateur d'une build de production voit « cette app ne peut pas
> accéder à Health Connect » et le lien échoue. Une build **de dev** fonctionne, elle : le
> développement et la recette ne sont pas bloqués par ce délai — seule la publication l'est.
> Cette procédure doit être **documentée** dans `docs/specs/technical/` et ajoutée aux prérequis
> hors-code de LANCE-01 dans [BACKLOG.md](../../../../BACKLOG.md).

## 10. Definition of Done

1. Dépendances installées, `app.json` configuré (plugin + `minSdkVersion: 26`), **dev build produit
   et installé** — sans quoi rien n'est testable.
2. Migration appliquée sur le cloud (`db:push`) + types régénérés (`db:types`) + cochée dans
   `MIGRATIONS.md`.
3. `health_connect_enabled` : colonne, schéma PowerSync, type partagé, mapping repository, accesseur
   (`getHealthConnectEnabled()`, calque de `getAnalyticsEnabled()` — dont la requête est un `SELECT *`,
   donc rien à modifier côté lecture).
4. Briques pures de `packages/shared` **testées** (records séance/course, sélection des pesées,
   throttle) — cas limites du §8 couverts.
5. Service `health-connect.ts` : no-op hors Android, ne jette jamais, respecte réglage + permissions.
6. Section Réglages complète (5 états du §2.1) + i18n FR/EN + mention politique de confidentialité
   + mention dans le texte de suppression de compte.
7. Écriture câblée sur `finishWorkout` / `finishRun` + rattrapage 30 jours + import de poids
   (activation / ouverture throttlée / bouton).
8. `npm run typecheck`, `npm run lint`, `npm run test` verts (code de sortie lu **sans pipe**).
9. Procédure de déclaration Google Play documentée dans `docs/specs/technical/` et prérequis ajouté
   à LANCE-01.
10. Maquette `design/conf06-health-connect/` validée Florian/Damien **avant** le code.

## 11. Critères d'acceptation (recette — device Android réel obligatoire)

1. **Réglage OFF par défaut** sur un compte neuf (état `off`) : section affichée avec l'interrupteur
   **OFF**, aucune permission demandée au lancement, et **aucun** record écrit après une séance
   terminée (vérifié dans l'app Health Connect).
2. **Activation** : tap sur l'interrupteur → écran de permissions Health Connect → accepter →
   interrupteur ON, message « N activités synchronisées ».
3. **Écriture d'une séance** : terminer une séance de musculation → elle apparaît dans Health
   Connect (app système) avec le bon type, les bons horaires, la bonne durée, **sans les notes**.
4. **Écriture d'une course** : terminer une course avec distance → session + distance correctes dans
   Health Connect. Terminer une course sans distance → session seule, aucun plantage.
5. **Idempotence** : relancer le rattrapage 30 jours → **aucun doublon** dans Health Connect.
6. **Lecture du poids** : créer une pesée dans Health Connect pour hier → « Importer le poids
   maintenant » → l'entrée apparaît dans le suivi de poids de l'app à la bonne date et au bon poids.
7. **Non-écrasement** : saisir un poids dans l'app pour aujourd'hui, créer une pesée différente dans
   Health Connect pour aujourd'hui, importer → la valeur de l'app est **conservée**.
8. **Synchro du réglage** : basculer le réglage, vérifier qu'il remonte sur le cloud et redescend sur
   un 2ᵉ appareil / après réinstallation (contrôle du point d'attention sync rules du §3).
9. **Permissions révoquées** : révoquer l'accès dans Health Connect → l'app affiche
   « Autoriser l'accès », ne plante pas, ne redemande rien d'elle-même ; terminer une séance
   fonctionne normalement côté app.
10. **Health Connect absent** (appareil Android ≤ 13 sans l'app, ou app désinstallée) → message
    « non installé » + bouton Play Store ; le reste de l'app est intact.
11. **Hors-ligne** (mode avion) : terminer une séance → le record est bien dans Health Connect ;
    importer un poids → l'entrée est créée localement puis synchronisée à la reconnexion.
12. **Annulation** : annuler une séance en cours → aucun record n'apparaît dans Health Connect
    (l'écriture n'a lieu qu'à la clôture — cf. §2.6).
13. **Désactivation** : couper le réglage → une nouvelle séance n'est plus écrite ; les anciens
    records restent (comportement annoncé par le texte d'aide).
14. **i18n** : passer l'app en anglais → toute la section, y compris les messages d'erreur et les
    titres par défaut des activités, est traduite.
