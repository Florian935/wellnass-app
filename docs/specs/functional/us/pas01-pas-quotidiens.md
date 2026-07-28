---
id: PAS-01
titre: "Pas quotidiens — lecture Health Connect, objectif et streak"
roadmap: [9.15]
catalogue: []
etape: close
branche: feature/pas01-pas-quotidiens
maj: 28/07/2026
---
# US PAS-01 — Pas quotidiens (lecture Health Connect)

> Lire le **total de pas par jour** depuis Health Connect, le stocker comme une donnée du compte
> (**synchronisée**), l'afficher (widget + historique), permettre de fixer un **objectif quotidien**,
> et faire **compter les pas dans le streak**. Roadmap
> [9.15](../../../roadmap/roadmap.md#v09--enrichissements-avant-lancement) (V0.9).
> Branche : `feature/pas01-pas-quotidiens` · Spec, plan et maquette validés par Florian le
> 28/07/2026 · **Statut : ✅ clôturée — recette device validée par Florian le 28/07/2026**
> (`etape: close`), sur APK release local (révision de service `r4`). La relecture croisée n'était
> pas requise (voir [CLAUDE.md](../../../../CLAUDE.md)).
> Extension de [CONF-06](conf06-health-connect.md) : le module natif, le plugin Expo maison et
> l'opt-in existaient déjà. **2 migrations** (table + colonne, puis publication `powersync`) ·
> **sync rule `daily_steps`** à déployer dans le dashboard PowerSync — prérequis des critères
> multi-appareils et réinstallation de la recette · reste **hors périmètre de l'US** : la
> **déclaration Google Play** étendue à `READ_STEPS` (§9), prérequis de la *publication* et non du
> fonctionnement.

## 0. Contexte

Le pilier Running couvre la **séance** de course : on démarre un tracker, on enregistre une sortie.
Rien ne couvre l'**activité de fond**. Or le cas d'usage qui a fait naître l'idée est précisément
celui-là : marcher sur un **tapis de marche** pendant le travail. Le GPS ne bouge pas — donc pas de
distance, pas d'allure, rien — alors que le compteur de pas d'Android, qui s'appuie sur
l'**accéléromètre** (capteur matériel `TYPE_STEP_COUNTER`), compte correctement. Démarrer une séance
de running pour compter ses pas de la journée n'a aucun sens : ce n'est pas une séance.

Depuis CONF-06, tout le socle technique est en place et **recetté sur device** :
- module natif `react-native-health-connect` v3, plugin Expo maison `plugins/withHealthConnect.js`,
  `minSdkVersion: 26`, dev build fonctionnel ;
- opt-in synchronisé `user_settings.health_connect_enabled` (défaut **OFF**) et accesseur hors React
  `getHealthConnectEnabled()` ;
- adaptateur [`apps/mobile/src/lib/health-connect.ts`](../../../../apps/mobile/src/lib/health-connect.ts)
  qui **ne jette jamais**, no-op hors Android, avec sa garde commune `ready()` (plateforme → opt-in →
  disponibilité → `initialize()` → permissions) et son **compte rendu de dernière tentative**
  (`SyncReport`) affiché dans les Réglages ;
- un précédent de lecture complet : l'import du poids (fenêtre glissante 30 j, throttle 6 h au
  premier plan, briques pures testées dans `packages/shared`).

Le coût de PAS-01 est donc **marginal côté natif** : une permission de plus et une fonction de
lecture. L'essentiel du travail est **au-dessus** : une table synchronisée, le streak, l'objectif,
l'affichage — et la mise en conformité Play/RGPD, qui change de nature (§7).

### Décisions de cadrage (arbitrées par Florian le 28/07/2026)

| # | Sujet | Décision | Alternative écartée |
|---|---|---|---|
| 1 | Sommeil | **Hors périmètre.** Seuls les **pas** sont lus | Lire aussi le sommeil : aucune valeur produit avant les analyses croisées (post-V1), alors qu'il alourdit la déclaration Play. **Coût accepté** : l'ajouter plus tard imposera une **re-déclaration** (~2 semaines) |
| 2 | Destination des données | **Synchronisées dans le cloud** (table PowerSync possédée par l'utilisateur) | Rester local à l'appareil : les pas disparaîtraient à la réinstallation et seraient absents du 2ᵉ appareil, du dashboard historique et de l'export RGPD |
| 3 | Streak | **Les pas comptent** dans la série | Streak réservé aux 3 piliers |
| 4 | Ce qui « compte » exactement | **Atteindre l'objectif du jour** rend le jour actif | « Au moins un pas » : le téléphone marche dans la poche, la série deviendrait **automatique et donc vide de sens** (voir §2.5) |
| 5 | Source de vérité du total | **API d'agrégation** de Health Connect (`aggregateGroupByPeriod`, bucket `DAYS`) | Somme des records bruts : Health Connect reçoit des pas de **plusieurs sources** (téléphone, Google Fit, montre) sur des plages qui se **chevauchent** → sommer **gonfle le total**. L'agrégation, elle, déduplique |
| 6 | Écriture vers Health Connect | **Aucune** : l'app est **consommatrice** sur ce type | `WRITE_STEPS` : on ne produit pas de pas, ce serait une permission injustifiable |
| 7 | Conflit entre deux appareils | On garde le **plus grand** total pour un jour donné | « Dernière écriture gagne » : une tablette peu portée (300 pas) écraserait le vrai total du téléphone (9 000) |
| 8 | Lecture en arrière-plan | **Non** : lecture au premier plan uniquement | `READ_HEALTH_DATA_IN_BACKGROUND` + WorkManager : permission supplémentaire à justifier et tâche de fond à écrire, pour un gain de fraîcheur — voir la limite assumée du §2.6 |
| 9 | Fenêtre de rattrapage | **30 jours**, comme le poids | Plus long : Health Connect ne garantit pas la profondeur d'historique, et la valeur décroît vite |

## 1. Périmètre à livrer

- **1 permission de plus** : `android.permission.health.READ_STEPS` dans `android.permissions`
  d'`app.json` (le tableau existe déjà, CONF-06) et dans la constante `PERMISSIONS` de l'adaptateur.
- **Migration** : table `daily_steps` (une ligne par utilisateur × jour) + colonne
  `profiles.daily_step_goal`.
- **Sync rule PowerSync** : nouvelle table → **ajout obligatoire** dans
  [powersync-sync-rules.yaml](../../technical/powersync-sync-rules.yaml) **et déploiement manuel dans
  le dashboard PowerSync**. ⚠️ Étape déjà oubliée une fois sur ce projet.
- **Lecture** `importSteps(days)` dans l'adaptateur Health Connect, sur le modèle exact de
  `importWeight()` : garde `ready()`, ne jette jamais, `SyncReport` renseigné (`kind: 'steps'`).
- **Briques pures testées** (`packages/shared`) : agrégation → lignes journalières, fusion avec
  l'existant (règle du max), décision de throttle, et calcul « objectif atteint ».
- **Repository** `daily-steps-repository.ts` : upsert par jour, hooks de lecture (jour courant,
  fenêtre d'historique).
- **Objectif quotidien** : réglable, **défaut 8 000** (§2.3), stocké sur `profiles`.
- **Affichage** : widget `steps` sur le hub d'accueil (3 formes) + **écran d'historique** avec
  l'histogramme des 30 derniers jours et la moyenne.
- **Streak** : les pas deviennent une **4ᵉ dimension** de `DayActivity`, active **si l'objectif est
  atteint** (§2.5).
- **Réglages** : la section Health Connect existante gagne l'état « pas » (dernier import, bouton
  d'import manuel) — pas de nouvelle section.
- **i18n FR + EN** complet.
- **Conformité** : politique de confidentialité **corrigée** (§7), documentation de la déclaration
  Play mise à jour (§9), texte de suppression de compte vérifié.

**Hors périmètre (à ne pas implémenter ici) :**
- **Sommeil**, fréquence cardiaque, calories, distance de marche, étages montés (décision 1).
- **Écriture** de pas vers Health Connect (décision 6).
- **Lecture en arrière-plan** / WorkManager (décision 8).
- **Podomètre maison** sur l'accéléromètre (`expo-sensors`) : redondant avec Health Connect, coûteux
  en batterie, et non disponible quand l'app est fermée. Écarté — seule la lecture du compteur
  système est retenue. Conséquence assumée : **sans Health Connect, pas de comptage de pas**.
- **Objectif de pas dans un défi / une gamification** (arbitrage C).
- **Pas dans les analyses croisées** (corrélation pas ↔ récup ↔ perfs) : post-V1, cette US se limite
  à capter la donnée proprement et à l'afficher.
- **Apple Health** : arrive avec le portage iOS (9.1).

## 2. Comportement attendu

### 2.1 Lecture des pas

- Déclenchement, identique au poids : à l'**activation** de l'opt-in, à l'**ouverture de l'app**
  (throttlé, premier plan), et sur **bouton explicite** dans les Réglages.
- Throttle **plus court que pour le poids** : **1 h** au lieu de 6 h. Une pesée est un événement
  quotidien, un compteur de pas **évolue toute la journée** — un widget qui affiche 2 000 pas alors
  que le téléphone en compte 7 000 est perçu comme faux. La constante reste distincte de celle du
  poids (`STEPS_IMPORT_THROTTLE_HOURS`).
- Requête : `aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter: { operator: 'between',
  startTime, endTime }, timeRangeSlicer: { period: 'DAYS', length: 1 } })` → un élément par jour,
  `result.COUNT_TOTAL` = total dédoublonné du jour, `startTime` = début du bucket.
- La **date locale** (`AAAA-MM-JJ`) se dérive du `startTime` du bucket, pas du fuseau courant.
- Fenêtre : **30 derniers jours**, jour courant **inclus**.
- Les buckets à `0` ne créent **aucune ligne** (voir §2.2) : un jour sans donnée et un jour à zéro pas
  ne se distinguent pas côté Health Connect, et matérialiser des zéros polluerait l'historique et le
  calcul de moyenne.

### 2.2 Stockage

Table `daily_steps`, **une ligne par (utilisateur, jour)** :

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | UUID **client** (convention offline-first) |
| `user_id` | uuid | Propriétaire, FK `auth.users` on delete cascade |
| `log_date` | date | Jour local `AAAA-MM-JJ` |
| `steps` | integer | Total du jour, `check (steps >= 0)` |
| `source` | text | `'health_connect'` (ouvre la porte à une saisie manuelle plus tard, sans migration) |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | Champs de synchro habituels |

- **Unicité** : index unique sur `(user_id, log_date)` **partiel** (`where deleted_at is null`),
  comme les autres tables « une ligne par jour ».
- **Upsert par jour** : si la ligne existe, on met à jour `steps` ; sinon on insère.
- **Règle du max (décision 7)** : à l'import, `steps = max(valeur lue, valeur déjà stockée)`. Le
  compteur d'un jour est **monotone croissant** (on ne « dé-marche » pas), donc le max est cohérent
  dans le cas normal (plusieurs imports du même jour) **et** protège du cas à deux appareils.
- Les jours **antérieurs** ne changent quasiment jamais ; seul le **jour courant** est réécrit à
  chaque import. C'est ce qui rend la charge de synchro négligeable (≈ 1 écriture/heure d'usage).

### 2.3 Objectif quotidien

- `profiles.daily_step_goal integer`, **défaut 8 000**, réglable de **1 000 à 50 000** par pas de 500.
- Pourquoi 8 000 et non 10 000 : le « 10 000 pas » est un **argument publicitaire** d'un podomètre
  japonais des années 1960, pas un seuil de santé. Les travaux récents situent l'essentiel du
  bénéfice **avant** ce chiffre. Surtout, produit : un objectif par défaut hors d'atteinte pour un
  utilisateur sédentaire produit un échec quotidien — l'inverse de l'effet recherché, **d'autant que
  l'objectif conditionne le streak** (§2.5). Réglable dans les deux sens de toute façon.
- Modifiable depuis l'écran d'historique des pas et depuis le profil.
- `NULL` (comptes antérieurs à la migration) est **coercé à 8 000 côté application**, comme
  `workout_display_level` (précédent MUSC-F13).

### 2.4 Affichage

**Widget `steps`** (hub accueil, ajouté au registre `HOME_WIDGET_IDS`) :
- garde pilier : **`'always'`** — la marche n'appartient à aucun des 3 piliers, et un utilisateur
  « nutrition seule » a autant de raisons de la suivre. Même traitement que `streak` ;
- `small` : nombre de pas + anneau de progression vers l'objectif ;
- `wide` (forme par défaut) : pas du jour + objectif + barre de progression + pastilles des 7 derniers
  jours ;
- `large` : ajoute l'histogramme de la semaine ;
- tap → écran d'historique.
- Un widget ajouté au registre **apparaît automatiquement** chez les utilisateurs existants :
  `resolveScreenLayout()` complète le layout stocké avec les IDs manquants du registre — aucune
  migration de `dashboard_layout` à écrire (vérifié).

**Écran d'historique** (`/steps`) : histogramme 30 jours (barres colorées selon objectif atteint ou
non), moyenne de la période, meilleur jour, nombre de jours d'objectif atteint, et le réglage de
l'objectif. Réutilise les composants de graphique existants — donc **l'infobulle au tap** d'UX-01 est
acquise gratuitement.

**États explicites** (aucun écran muet) :

| Situation | Ce que voit l'utilisateur |
|---|---|
| Health Connect indisponible / plateforme ≠ Android | Widget **masqué**, écran non accessible |
| Opt-in Health Connect OFF | Widget affiché avec un appel à l'action « Activer pour compter tes pas » → Réglages |
| Opt-in ON, permission `READ_STEPS` refusée | « Autoriser l'accès aux pas » → demande de permission |
| Permission accordée, aucune donnée sur 30 j | « Aucun pas enregistré pour l'instant » + explication (le téléphone doit être porté / une source doit alimenter Health Connect) |
| Données présentes | Affichage normal |

### 2.5 Pas et streak

Le streak est aujourd'hui **calculé à la volée** (aucune table) : `activeDayKeys()` marque un jour
actif si `strength || running || nutrition`
([streak.ts](../../../../packages/shared/src/streak.ts)), et `useStreakData()` alimente ça depuis
l'historique des séances, des courses et des totaux nutritionnels.

- `DayActivity` gagne un champ **`steps: boolean`** et `activeDayKeys()` devient
  `strength || running || nutrition || steps`.
- **`steps` est vrai seulement si l'objectif du jour est atteint** (décision 4). C'est le point de
  conception qui décide de tout : avec « au moins un pas », n'importe quelle journée où le téléphone
  est dans la poche devient active, la série ne se casse plus jamais et **le streak perd toute
  signification**. Avec l'objectif, marcher reste un vrai moyen de tenir sa série un jour sans
  entraînement — ce qui est exactement l'intention.
- L'objectif comparé est celui **en vigueur au moment du calcul**, pas celui du jour concerné (on ne
  stocke pas d'historique d'objectif). Conséquence assumée : **baisser son objectif peut rallumer des
  jours passés** et rallonger la série. C'est indolore et va dans le sens de l'utilisateur ; l'inverse
  (l'augmenter éteint des jours passés) est le cas gênant, mais il reste cohérent — l'app n'invente
  aucun jour actif, elle applique la règle courante.
- Les **pastilles de la semaine** du widget streak deviennent actives sur un jour « objectif atteint »
  : le contrat visuel ne change pas, seule la source d'activité s'élargit.

**Effet sur le rappel « série en danger » (2.6/2.8)** — limite à assumer : le rappel est planifié
localement à l'heure choisie (20 h par défaut) à partir de ce que l'app **sait au moment où elle
planifie**. Les pas n'étant lus qu'au premier plan (décision 8), un utilisateur qui a atteint son
objectif **sans ouvrir l'app** recevra quand même « ta série est en danger ». Ce n'est pas un bug
qu'on peut corriger sans lecture en arrière-plan (une US à part entière). Deux mitigations retenues,
sans nouvelle permission :
1. **réévaluer à chaque passage au premier plan** : l'import des pas précède le calcul du streak, donc
   ouvrir l'app annule un rappel devenu inutile ;
2. **formuler le rappel sans affirmer** : « tu n'as rien enregistré aujourd'hui » plutôt que « ta
   série est perdue » — vrai dans tous les cas, puisque l'app ne sait effectivement rien encore.

Le streak, lui, se **répare rétroactivement** au premier import suivant : le jour redevient actif et
la série reprend sa valeur réelle. Aucune donnée n'est perdue, seul l'affichage est en retard.

### 2.6 Fraîcheur — limite assumée

Aucune lecture en arrière-plan : le total affiché est celui du **dernier import**, donc au plus 1 h
d'ancienneté **en usage actif**, et arbitrairement ancien si l'app n'est pas ouverte. L'heure du
dernier import est affichée dans la **section Réglages** (« Dernier import des pas : … »).

> **Décision d'implémentation (28/07/2026)** : le cadrage prévoyait aussi d'afficher cet horodatage
> **sur le widget** au-delà de 2 h. Écarté : le curseur vit dans `expo-secure-store` (lecture
> **asynchrone**), l'afficher obligerait chaque widget à porter un état de chargement pour une
> information de diagnostic. Elle reste disponible, à un endroit, dans les Réglages.

Passer au temps réel demanderait `READ_HEALTH_DATA_IN_BACKGROUND` + WorkManager → **US séparée**, à
ne pas glisser ici.

## 3. Architecture

- **`apps/mobile/src/lib/health-connect.ts`** — ajout de `importSteps(days = 30)` et
  `importStepsIfDue()`, calqués sur `importWeight()` / `importWeightIfDue()` : garde `ready()`,
  `try/catch` global, `report('steps', n, error|null)`, no-op hors Android. `PERMISSIONS` passe de 3
  à 4 entrées → **`hasPermissions()` devient plus strict**, donc un utilisateur CONF-06 déjà autorisé
  repasse en état `permissions_missing` jusqu'à ce qu'il accorde `READ_STEPS` (§8, cas limite à
  recetter en premier).
- **`packages/shared/src/steps.ts`** (pur, Vitest) :
  - `toDailySteps(buckets)` → `{ logDate, steps }[]` : dérive la date locale du `startTime` du
    bucket, ignore les totaux nuls, arrondit à l'entier ;
  - `mergeDailySteps(remote, local)` → lignes à créer / à mettre à jour, **règle du max** ;
  - `isGoalReached(steps, goal)` et `stepsActiveDays(rows, goal)` → alimente le streak ;
  - `shouldImportSteps(lastImportAt, now, throttleHours)` (calque de `shouldImportWeight`).
- **`packages/shared/src/streak.ts`** — `DayActivity` gagne `steps: boolean` ; `activeDayKeys()`
  l'intègre. ⚠️ **Changement d'un type partagé** : mettre à jour les appelants
  (`dashboard-repository.useStreakData`) et les tests existants de `streak.test.ts`.
- **`apps/mobile/src/data/repositories/daily-steps-repository.ts`** — `upsertDailySteps(rows)`,
  `useTodaySteps()`, `useDailySteps(sinceDate)`, `getStepsGoal()` ; écritures via
  `insertWithSyncFields` / `patch` (jamais de SQL direct).
- **Migration** `supabase/migrations/<horodaté>_pas01_daily_steps.sql` : table + index unique partiel
  + RLS (`user_id = auth.uid()` en select/insert/update, calque de `body_weight_entries`) + colonne
  `profiles.daily_step_goal`.
- **PowerSync** : table `daily_steps` ajoutée au **schéma client** (`schema.ts`) **et** aux
  **sync rules** (`select * from daily_steps where user_id = bucket.user_id and deleted_at is null`,
  bucket `user_data`) → **déploiement manuel dans le dashboard**, sinon les pas n'arrivent jamais sur
  l'appareil et le bug est silencieux.
- **Widget** : `'steps'` ajouté à `HOME_WIDGET_IDS`, `pillars: 'always'`, `defaultSize: 'wide'`,
  + composant `StepsWidget` (3 formes) + entrée dans le rendu du hub accueil.
- **Écran** `apps/mobile/src/app/steps.tsx` (Expo Router).
- **Câblage de l'import** : dans le même effet de premier plan que `importWeightIfDue()`
  (`_layout` racine) — un seul point d'entrée, deux appels indépendants.

## 4. i18n (FR + EN)

Aucune chaîne en dur, parité stricte. Nouvelles clés `steps.*` :

| Clé | FR | EN |
|---|---|---|
| `title` | Pas | Steps |
| `today` | Pas aujourd'hui | Steps today |
| `goal` | Objectif | Goal |
| `goalReached` | Objectif atteint | Goal reached |
| `goalProgress` | {{steps}} / {{goal}} pas | {{steps}} / {{goal}} steps |
| `setGoal` | Modifier l'objectif | Change goal |
| `average` | Moyenne sur la période | Average for the period |
| `bestDay` | Meilleur jour | Best day |
| `daysReached` | {{count}} jour(s) d'objectif atteint | {{count}} days goal reached |
| `history` | Historique des pas | Step history |
| `empty` | Aucun pas enregistré pour l'instant. Porte ton téléphone sur toi, ou connecte une montre à Health Connect. | No steps recorded yet. Carry your phone with you, or connect a watch to Health Connect. |
| `enableCta` | Activer Health Connect pour compter tes pas | Turn on Health Connect to count your steps |
| `permissionCta` | Autoriser l'accès aux pas | Allow access to steps |
| `lastImport` | Mis à jour à {{time}} | Updated at {{time}} |
| `unsupported` | Le comptage des pas nécessite Health Connect. | Step counting requires Health Connect. |
| `countsForStreak` | Atteindre ton objectif de pas garde ta série active. | Reaching your step goal keeps your streak alive. |

+ clés Réglages `settings.healthConnect.importSteps` / `stepsImported`, et **révision** de
`settings.healthConnect.subtitle` (§7) et de `legal.privacy.body`.

## 5. Offline

- La **lecture** Health Connect est locale à l'appareil : elle fonctionne **hors-ligne**, sans
  exception.
- L'**écriture** dans `daily_steps` est une écriture PowerSync locale ordinaire : disponible
  immédiatement, synchronisée plus tard. Un utilisateur hors-ligne voit ses pas, son objectif, son
  streak et son historique **sans réseau**.
- L'**objectif** (`profiles`) est déjà une donnée synchronisée : modifiable hors-ligne, appliqué
  aussitôt.
- Le curseur de throttle est **local à l'appareil** (`expo-secure-store`), jamais synchronisé — même
  raison que pour le poids : Health Connect est propre à l'appareil, un curseur partagé serait faux.

## 6. Accessibilité

- Anneau et barre de progression : valeur **textuelle** systématiquement présente
  (`accessibilityLabel` « 6 200 pas sur 8 000, objectif non atteint ») — la progression ne doit jamais
  reposer sur la seule couleur ou le seul remplissage.
- Barres de l'histogramme : `accessibilityRole` + libellé date + valeur, et **motif ou intensité**
  distinguant « objectif atteint » au-delà de la teinte.
- Cibles tactiles ≥ 44 px sur le sélecteur d'objectif.
- Contrôle final dans la passe **CONF-07** (9.11/9.12), qui reste l'US de référence.

## 7. Sécurité & RGPD — ⚠️ ce que la décision « cloud » change

C'est le point le plus sensible de cette US, et il ne se voit pas dans le code.

CONF-06 pouvait affirmer que **« aucune donnée de santé ne transite par nos serveurs »** : l'échange
était local, appareil ↔ Health Connect, et seul un booléen partait vers Supabase. **Ce n'est plus
vrai** : les pas quotidiens sont, par décision 2, **stockés sur nos serveurs**.

Conséquences obligatoires, toutes dans le périmètre de cette US :

1. **La phrase d'accroche de la section Réglages est à réécrire.** La clé
   `settings.healthConnect.subtitle` dit aujourd'hui « **Tout reste sur ton téléphone.** » — faux dès
   que les pas montent dans le cloud. Nouveau texte : les séances et le poids restent locaux,
   **les pas sont enregistrés sur ton compte pour te suivre d'un appareil à l'autre**.
2. **Politique de confidentialité** (`legal.privacy.body`, FR + EN) : nommer explicitement les pas
   comme donnée de santé **collectée et conservée** sur nos serveurs, sa finalité (suivi, objectif,
   série), sa durée de conservation et le fait qu'elle est supprimée avec le compte.
3. **Base légale : consentement explicite.** Il existe déjà (opt-in Health Connect OFF par défaut),
   mais son **périmètre change** : l'écran de demande doit dire que ces données seront **synchronisées**,
   pas seulement lues. Un consentement obtenu pour « lecture locale » ne couvre pas un transfert.
4. **Suppression du compte (CONF-02)** : `daily_steps` porte `user_id` avec FK
   `on delete cascade` → purgée automatiquement. À **vérifier** dans le test de purge, pas à supposer.
5. **Export RGPD (CONF-01)** : l'export énumère les tables possédées → **ajouter `daily_steps`**,
   sinon l'export devient incomplet le jour où la table existe.
6. **Minimisation** : on stocke un **total par jour**, jamais les records bruts ni les horodatages
   intra-journée. Un total quotidien ne permet pas de reconstituer des déplacements ; une série de
   records de pas horodatés, si.
7. **Politique Health Connect de Google** : le transfert de données Health Connect hors de l'appareil
   est encadré (divulgation explicite obligatoire, revente et partage à des tiers interdits). Notre
   usage — stockage sur notre propre backend, pour l'utilisateur lui-même, sans partage — est *a
   priori* conforme **sous réserve de divulgation**, mais ⚠️ **à confirmer sur la page de politique en
   vigueur avant de déposer la déclaration** (§9) : c'est un motif de refus classique, et je ne peux
   pas garantir ici l'état courant du texte de Google.

## 8. Cas limites

| Situation | Comportement |
|---|---|
| **Utilisateur CONF-06 déjà autorisé** | `PERMISSIONS` passe à 4 → `hasPermissions()` renvoie `false` → état `permissions_missing`, bandeau « Autoriser l'accès aux pas ». **Les écritures de séances continuent de fonctionner** (permissions indépendantes côté système). À recetter **en premier** : c'est le cas de 100 % des utilisateurs existants |
| Permission `READ_STEPS` refusée seule | Séances/courses/poids inchangés ; import de pas simplement sauté, widget en état « autoriser » |
| Plateforme ≠ Android | Widget masqué, écran inaccessible, `importSteps` no-op immédiat |
| Health Connect absent ou trop ancien | États existants de CONF-06 (installer / mettre à jour) ; aucun appel de lecture |
| Aucune source de pas sur l'appareil (capteur absent) | Aucun bucket → aucune ligne → état vide explicite, aucun zéro fabriqué |
| Jour sans donnée vs jour à 0 pas | **Indistinguables** côté Health Connect → aucune ligne créée dans les deux cas (choix §2.1) |
| Plusieurs sources qui se chevauchent (téléphone + montre) | Total **dédoublonné par l'API d'agrégation** (décision 5) — c'est précisément pourquoi on n'additionne pas les records |
| Import multiple le même jour | Upsert + **max** → le total ne redescend jamais en cours de journée |
| 2 appareils, totaux différents pour le même jour | Le plus grand gagne (décision 7) ; aucune duplication de ligne (index unique) |
| Changement de fuseau horaire / voyage | La date vient du `startTime` **du bucket**, pas du fuseau courant → une journée ne bascule pas rétroactivement |
| Changement d'heure (DST) | Les buckets `DAYS` de Health Connect sont calendaires ; le calcul de série utilise déjà `prevKey()` **DST-safe** (via `Date.UTC`) |
| Objectif atteint sans ouvrir l'app | Le jour est marqué actif **au prochain import** ; le streak se répare rétroactivement, mais le rappel de 20 h a pu partir pour rien (§2.5) |
| Objectif modifié à la baisse | Peut **rallumer** des jours passés dans la série (§2.5) — assumé |
| Objectif modifié à la hausse | Peut **éteindre** des jours passés. Assumé et cohérent, mais à surveiller en recette : c'est le seul cas où la série **recule** sans que l'utilisateur ait rien perdu |
| Valeur aberrante (> 200 000 pas/jour) | Écartée par la brique pure (record corrompu d'une source tierce ; le record du monde journalier est très en dessous) |
| Total non entier renvoyé par l'API | Arrondi à l'entier par la brique pure (`steps` est `integer` en base) |
| Réinstallation de l'app | L'historique **redescend du cloud** (bénéfice direct de la décision 2) ; le curseur de throttle local repart à zéro → un import a lieu au premier lancement |
| Opt-in Health Connect coupé | Aucune lecture ; les lignes déjà stockées **restent** (données du compte) et le widget continue d'afficher l'historique, avec l'appel à l'action de réactivation |

## 9. Prérequis Google Play — impact sur LANCE-00

Cette US **modifie le dossier de déclaration** de CONF-06. À intégrer **avant** son dépôt, sinon
seconde instruction (~2 semaines).

1. **4ᵉ type de données** : `READ_STEPS`, à justifier dans le formulaire « Health apps ».
   Justification à retenir : *« L'application affiche à l'utilisateur son nombre de pas quotidien et
   un objectif de pas. Elle lit le total déjà mesuré par l'appareil ou la montre de l'utilisateur
   plutôt que de le recalculer, afin de ne pas dupliquer un capteur ni consommer de batterie. »*
2. **Section « Sécurité des données » à revoir** : CONF-06 déclarait des données de santé
   **non transmises hors de l'appareil**. Avec les pas synchronisés, il faut désormais déclarer
   **collecte + transmission** de données de santé (chiffrées en transit), avec finalité
   « fonctionnalité de l'app » et **sans partage à des tiers**. Une déclaration inexacte ici est un
   motif de rejet — et une déclaration *trop* prudente n'est pas un problème.
3. **Politique de confidentialité publiée** : le paragraphe santé doit couvrir les pas (§7).
4. Mettre à jour
   [health-connect-play-declaration.md](../../technical/health-connect-play-declaration.md) : tableau
   des permissions (3 → 4), §2 « ne pas demander » (retirer les pas, garder le sommeil), §4
   « Sécurité des données », §5 (liste des permissions du manifest à vérifier après `prebuild`).
   > Au passage, corriger une **scorie** repérée au cadrage : le §3.3 de ce document attribue encore
   > l'intent-filter à `expo-health-connect`, dépendance **supprimée** par CONF-06 au profit du plugin
   > maison — le §5 du même document, lui, est correct.

## 10. Definition of Done

1. `READ_STEPS` dans `app.json` + `PERMISSIONS` ; **nouveau dev build** produit et installé (une
   permission de manifest ne s'ajoute pas à chaud).
2. Migration appliquée sur le cloud (`db:push`), types régénérés (`db:types`), **cochée** dans
   [MIGRATIONS.md](../../../../supabase/MIGRATIONS.md).
3. **Sync rule `daily_steps` ajoutée au YAML *et* déployée dans le dashboard PowerSync**, vérifiée
   par une descente réelle sur un 2ᵉ appareil / une réinstallation.
4. Briques pures de `packages/shared` testées : agrégation → jours, fusion max, objectif atteint,
   throttle, valeurs aberrantes, fuseau/DST.
5. `streak.ts` étendu (`steps` dans `DayActivity`) **et tests existants mis à jour** — aucun appelant
   oublié (`useStreakData`).
6. `importSteps` : no-op hors Android, ne jette jamais, `SyncReport` renseigné y compris sur abandon
   silencieux.
7. Widget 3 formes + écran d'historique + réglage d'objectif, avec les **5 états** du §2.4.
8. i18n FR/EN complet, **`subtitle` Health Connect corrigé** et politique de confidentialité mise à
   jour (§7).
9. `daily_steps` ajoutée à l'**export RGPD** (CONF-01) et purge de compte (CONF-02) **vérifiée**.
10. `npm run typecheck`, `npm run lint`, `npm run test` verts — code de sortie lu **sans pipe**.
11. Documentation de la déclaration Play mise à jour (§9).
12. Maquette `design/pas01-pas-quotidiens/` validée par Florian ou Damien **avant** le code.

## 11. Critères d'acceptation (recette — device Android réel obligatoire)

1. **Utilisateur existant** (CONF-06 déjà autorisé, mise à jour de l'app) : la section Réglages passe
   en « Autoriser l'accès aux pas », **les séances continuent de partir** dans Health Connect, et
   accorder la permission suffit à débloquer les pas.
2. **Compte neuf, opt-in OFF** : widget affiché avec l'appel à l'action, **aucune** permission
   demandée au lancement, aucune ligne `daily_steps` créée.
3. **Activation** : accorder les 4 permissions → les pas des jours passés (jusqu'à 30 j) apparaissent
   dans l'historique, avec les bons totaux (comparaison directe avec l'app Health Connect).
4. **Total du jour** : marcher ~200 pas, rouvrir l'app après le throttle → le widget augmente.
5. **Tapis de marche** (le cas d'usage d'origine) : marcher sur un tapis, téléphone en poche, **sans
   démarrer de séance** → les pas sont comptés.
6. **Cohérence avec Health Connect** : le total affiché est **identique** à celui de l'app Health
   Connect pour le même jour, y compris avec **deux sources** actives (téléphone + montre ou Google
   Fit) — c'est le test qui valide l'absence de double comptage.
7. **Objectif** : régler 3 000, atteindre 3 000 → « objectif atteint » ; passer l'objectif à 20 000 →
   l'état repasse à « non atteint ».
8. **Streak** : sur une journée **sans séance ni repas loggé**, atteindre l'objectif de pas → le jour
   est **actif**, la pastille du jour s'allume, la série incrémente. Le même jour sans atteindre
   l'objectif → jour **inactif**.
9. **Réparation rétroactive** : atteindre l'objectif sans ouvrir l'app, ouvrir le lendemain → le jour
   précédent apparaît actif et la série est correcte.
10. **Hors-ligne** (mode avion) : les pas s'importent et s'affichent ; à la reconnexion, ils
    remontent dans Supabase (vérifié en base).
11. **Multi-appareils** : après synchro, l'historique des pas est visible sur un 2ᵉ appareil ; un
    total plus faible venant du 2ᵉ appareil **n'écrase pas** le plus élevé.
12. **Réinstallation** : l'historique des pas revient du cloud.
13. **Permission révoquée** depuis Health Connect → état « autoriser », aucun plantage, l'historique
    déjà stocké reste consultable.
14. **Opt-in coupé** → plus aucun import ; l'historique reste affiché avec l'appel à la réactivation.
15. **Export RGPD** : l'export JSON contient bien les lignes `daily_steps`.
16. **Suppression du compte** : après purge, plus aucune ligne `daily_steps` (vérification en base).
17. **i18n** : app en anglais → widget, écran, états vides et réglage entièrement traduits.
18. **Accessibilité** : lecteur d'écran sur le widget → pas, objectif et atteinte annoncés en texte.
