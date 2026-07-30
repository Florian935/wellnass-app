---
id: NUTR-F1
titre: "Rappels programmés nutrition — repas et pesée, à l'échéance apprise"
roadmap: [1.14, 2.5]
catalogue: [META-07]
etape: recette
branche: feature/nutrf1-rappels-nutrition
maj: 30/07/2026
---
# US NUTR-F1 — Rappels programmés nutrition (repas + pesée)

> Deux nouveaux rappels locaux — **journal alimentaire** (2.5) et **pesée** (1.14) — déclenchés non
> pas à heure fixe mais à une **échéance apprise** du comportement : l'heure après laquelle
> l'utilisateur a, d'habitude, déjà fait le geste.
> Branche : `feature/nutrf1-rappels-nutrition` · 30/07/2026 · **Statut : à valider (pas de code
> avant validation).**

## 0. Contexte (exploration du code réel)

Ce qui existe déjà et qu'on **réutilise sans le refaire** :

- **Couche native** [notifications.ts](../../../../apps/mobile/src/lib/notifications.ts) :
  `expo-notifications` (~57.0.3) **déjà installé**, permission `POST_NOTIFICATIONS` déclarée
  ([app.json:24](../../../../apps/mobile/app.json#L24)), canal Android unique `reminders` créé.
  ⇒ **aucune nouvelle dépendance native, aucun nouveau build requis.**
- **Règles pures** [packages/shared/src/notifications.ts](../../../../packages/shared/src/notifications.ts) :
  `NotificationPrefs`, `parseNotificationPrefs` (parse **tolérant**), `isWithinDnd`. 310 lignes de
  tests Vitest en face.
- **Persistance** : colonne `user_settings.notifications` (JSON TEXT, déjà synchronisée PowerSync).
  Le parse tolérant permet d'ajouter des champs **sans migration**. Attention : le chemin de lecture
  runtime passe par `parseNotificationPrefs`
  ([settings-repository.ts:122](../../../../apps/mobile/src/data/repositories/settings-repository.ts#L122)),
  **pas** par Zod — la dérive du §0 ci-dessous est donc latente, pas un bug en production.
- **Écran de réglages** [settings.tsx](../../../../apps/mobile/src/app/settings.tsx) : section
  « Notifications » + composant local `HourStepper` (± 1 h, 0-23) déjà en place, réutilisable tel
  quel (cibles tactiles déjà ≥ 48 dp via `hitSlop`).
- **Données horaires** : `food_entries.created_at` et `body_weight_entries.created_at`
  (`timestamptz`, répliqués en local en TEXT ISO UTC —
  [powersync/schema.ts:146](../../../../apps/mobile/src/powersync/schema.ts#L146) et
  [:438](../../../../apps/mobile/src/powersync/schema.ts#L438)). Le patron de conversion jour local
  ↔ bornes UTC existe déjà : `utcBounds()` dans
  [weekly-review-repository.ts:47](../../../../apps/mobile/src/data/repositories/weekly-review-repository.ts#L47).
- **`logWeight` fait un `patch`** quand la pesée du jour existe déjà : `created_at` conserve donc
  l'heure de la **première** pesée du jour — exactement celle qu'on veut apprendre.

Ce qui **manque** et que cette US doit produire :

- Aucune brique de calcul d'**heure de la journée** dans `packages/shared` (`training-time.ts` est
  un faux ami : c'est une *durée*).
- **Dérive Zod** : `notificationPrefsSchema`
  ([settings.ts:15-22](../../../../packages/shared/src/settings.ts#L15-L22)) ne déclare que **6**
  des 8 champs de `NotificationPrefs` — `weeklyReview` et `weeklyReviewHour` manquent depuis
  BILAN-01. `z.object` étant strippant, tout futur passage par ce schéma les perdrait. À corriger
  avant d'en ajouter 5 autres.
- Le hint des réglages **promet ce que le code ne tient pas** (§2.5).

## 1. Périmètre à livrer

1. **Rappel de journal alimentaire (2.5)** — au plus un par jour, si le journal du jour est
   **encore vide** à l'échéance.
2. **Rappel de pesée (1.14)** — au plus un par jour, si aucune pesée n'est enregistrée pour le jour.
3. **Échéance apprise** — l'heure de déclenchement est déduite des habitudes de saisie
   (14 jours, **100 % local**), avec repli sur une heure réglable manuellement.
4. **Correction du hint « max 3 notifications par jour »**, qui est faux depuis V0.6 (§2.5).

**Hors périmètre, explicitement :**

- **Un rappel par type de repas** (petit-déj / déjeuner / dîner). La config
  `nutrition_profiles.meals` ne porte **aucune heure** par repas : il n'y a rien à apprendre par
  repas. Un rappel de journal, un seul.
- **NUTR-25 « Il te manque un repas » (nudge de complétude)** — détecter un journal *partiel* est un
  autre sujet, avec ses propres règles de bienveillance. Reste au catalogue.
- **Cadence de pesée hebdomadaire.** Aucune notion de cadence n'existe en base ni en réglage ; le
  rappel est quotidien et s'auto-supprime dès que la pesée du jour est saisie.
- **Compteur de quota quotidien.** Décision D3 (§2.5) : inutile dans cette architecture, et le
  besoin est couvert plus solidement autrement.
- **Toute modification des planificateurs existants** (`useStreakReminderScheduler`,
  `useWeeklyReviewScheduler`). Rendue inutile par D3 : leur comportement est inchangé.
- **Job d'arrière-plan.** Comme pour le streak, la planification a lieu à l'ouverture / au retour au
  premier plan. Sans ouverture de l'app dans la journée, pas de rappel. Limite assumée, identique à
  V0.6.
- **Gestion explicite des fuseaux horaires** — aucune n'existe dans le projet, on n'en introduit pas.
- **iOS** (Android d'abord), **push distantes** (tout est local).

## 2. Règles métier

### 2.1 Ce qu'on apprend : une échéance, pas une habitude

**D1 — la grandeur apprise est un percentile haut, pas une médiane.** C'est l'arbitrage central de
cette US, et la première version de la spec s'était trompée.

Le rappel dit « tu n'as pas encore fait le geste ». Il doit donc partir à une heure où
l'utilisateur a **d'habitude déjà fini**. Si on apprenait l'heure *habituelle* (médiane), on
enverrait le rappel pile au moment du geste : un utilisateur régulier qui logge son petit-déjeuner à
8 h aurait reçu « ton journal est vide aujourd'hui » à 8 h, **un jour sur deux, pendant qu'il le
remplit**. La notification ne peut plus être annulée à ce stade — la (re)planification n'a lieu qu'à
l'ouverture de l'app, et le handler affiche la bannière même au premier plan.

On apprend donc le **9ᵉ décile (p90) de l'heure du geste** : l'heure avant laquelle, 9 jours sur 10,
c'est déjà fait. Un utilisateur régulier ne reçoit presque jamais le rappel — c'est le
comportement voulu : **ce rappel doit être rare.**

| Rappel | Échantillon = une valeur par jour retenu | Fenêtre |
|---|---|---|
| Journal alimentaire | heure de la **première entrée retenue** du jour | 14 jours glissants |
| Pesée | heure de la **pesée** du jour (il y en a au plus une) | 14 jours glissants |

**D2 — percentile par rang, sans interpolation.** `p90 = trié[ceil(0,9 × n) − 1]`. Le résultat est
toujours une heure entière effectivement observée, la règle est définie pour **tout** `n ≥ 1`, et
elle évite deux pièges de la médiane :

- **pas d'ambiguïté sur les échantillons pairs** — avec une fenêtre de 14 jours et un seuil de 5,
  les tailles paires sont le cas majoritaire, et « la moyenne des deux valeurs centrales » aurait
  été une règle à inventer ;
- **le problème circulaire est neutralisé dans le sens utile.** Une moyenne d'heures est
  mathématiquement fausse près de minuit (moyenne de 23 h et 1 h = 12 h) et **la médiane ne le
  répare pas** : sur `{23, 0, 23, 0, 23, 0}` elle renvoie 11 h 30, soit le point antipodal de
  l'habitude réelle. Le p90 renvoie 23 — le bord tardif, qui est précisément ce qu'on cherche.

Exemple : échantillon `{8, 8, 9, 8, 9, 8, 10}` → n = 7 → `ceil(6,3) − 1 = 6` → **10 h**. Le rappel
part à 10 h, uniquement les jours où rien n'est encore noté.

**Échantillons rejetés — D4.** Une entrée n'est retenue que si le **jour local de son `created_at`
correspond à son `log_date`**. Cela écarte la **saisie rétroactive** : logger hier soir ce matin
donne un `created_at` de ce matin, qui n'apprend rien sur l'heure du repas.

> ⚠️ **Ce filtre n'attrape PAS les copies du jour même.** `copyMeal`, `duplicateDay` et les repas
> types passent par `addFoodEntry` avec `created_at = maintenant` et `log_date` = le jour affiché,
> qui est presque toujours **aujourd'hui**
> ([nutrition.tsx:187](../../../../apps/mobile/src/app/(tabs)/nutrition.tsx#L187),
> [:773](../../../../apps/mobile/src/app/(tabs)/nutrition.tsx#L773)). Quelqu'un qui duplique la
> veille chaque matin à 10 h apprendra donc « 10 h ». **C'est assumé** : sous D1, une contamination
> qui repousse l'échéance **plus tard** va dans le sens sûr — elle rend le rappel plus rare, jamais
> plus intrusif. Distinguer une copie d'une saisie exigerait une colonne `source`, donc une
> migration, pour un gain nul dans la direction qui compte.

**Si la première entrée d'un jour est rejetée**, on prend **la plus ancienne entrée retenue** de ce
jour ; si aucune ne l'est, le jour est écarté de l'échantillon. Règle explicite, sinon deux
implémentations divergentes seraient conformes.

**Échantillon insuffisant.** En dessous de **5 jours** retenus, on n'apprend pas et on utilise
l'**heure de repli** réglée par l'utilisateur. L'UI dit toujours laquelle des deux s'applique (§4) :
une heure qui bouge sans explication est un bug perçu.

### 2.2 Rabattement hors « Ne pas déranger » — uniquement pour l'heure apprise

Une échéance apprise peut tomber dans la fenêtre DND (quelqu'un qui logge son dîner à 23 h). La
supprimer purement — ce que fait le rappel streak — désactiverait silencieusement la fonctionnalité
pour tous les couche-tard.

**D5 — on rabat l'heure apprise sur le bord le plus proche, hors de la fenêtre DND** : soit
`dndEndHour` (l'heure où le DND se lève), soit `dndStartHour − 1` (la dernière heure avant qu'il
commence), au plus proche en distance circulaire. **Égalité → vers l'arrière** (`dndStartHour − 1`) :
mieux vaut rappeler un peu tôt le soir même que le lendemain matin, quand le geste n'a plus de sens.

Exemples avec DND `[22, 7)` : 23 h → **21 h** · 0 h → **21 h** · 5 h → **7 h** · 8 h → **8 h**
(inchangée). Fenêtre vide (`dndStartHour === dndEndHour`) ou DND désactivé : inchangée.

**D6 — le rabattement ne s'applique JAMAIS à une heure réglée à la main.** Réécrire en douce le 23 h
qu'un utilisateur a composé au stepper, c'est reproduire le « pourquoi cette heure-là ? » que §4
cherche à éliminer. Une heure manuelle en pleine fenêtre DND est donc **supprimée**, comme pour le
rappel streak — mais l'écran de réglages **le dit** (§4). Ainsi l'app n'a qu'une politique DND pour
les heures choisies par l'humain (suppression) et une seule pour les heures qu'elle a choisies
elle-même (rabattement).

### 2.3 bis Marge d'imminence — 15 min (D8, ajoutée en revue)

Symétrique de §2.3, et trouvée en revue de code avant livraison : D7 supprimait le rattrapage
**après** l'échéance, mais rien ne protégeait **juste avant**. Ouvrir l'app à 12 h 59 avec une
échéance à 13 h aurait fait arriver « ton journal est encore vide » **60 secondes plus tard, pendant
que l'utilisateur le remplit** — exactement le scénario que D7 invoque pour se justifier.

**Règle** : on ne planifie que s'il reste au moins **15 minutes** avant l'échéance. Le refus est
distingué du dépassement (`imminent` vs `passed`) : en recette, l'un veut dire « trop tard »,
l'autre « tu es déjà là ».

### 2.3 Pas de fenêtre de rattrapage — et pourquoi

Le backlog prévoyait « une fenêtre de repli de ~30 min pour le doze mode ». **On la retire**, et
c'est une décision, pas un oubli.

Elle consistait à planifier immédiatement quand l'échéance venait d'être dépassée. Or l'évaluation
a lieu **précisément à l'ouverture de l'app**, donc l'app est au premier plan, et le handler affiche
la bannière au premier plan : l'utilisateur qui ouvre l'app à 13 h 15 pour noter son déjeuner
recevrait « ton journal est vide » 60 secondes plus tard, pendant qu'il le remplit. Exactement le
défaut que D1 corrige.

Et le rattrapage ne sert à rien : si l'échéance est passée, c'est que l'utilisateur **a ouvert
l'app** — il n'a pas besoin d'une notification pour être invité à ouvrir l'app. **Règle : échéance
dépassée = pas de rappel aujourd'hui.** Le retard que Doze peut infliger à une notification déjà
posée reste géré par l'OS, hors de notre portée.

### 2.4 Conditions d'envoi, et d'annulation

Un rappel n'est planifié que si **toutes** ces conditions tiennent :

- le type est **activé** dans les réglages ;
- le geste **n'est pas déjà fait aujourd'hui** (≥ 1 entrée alimentaire non supprimée pour le jour
  local / ≥ 1 pesée pour le jour local) ;
- l'heure effective **n'est pas dépassée** (§2.3) ;
- cette heure n'est pas en DND — après rabattement si elle est apprise (§2.2) ;
- la permission notifications est accordée.

Dès qu'une condition tombe — typiquement l'utilisateur logge son repas — le rappel en attente est
**annulé**. L'identifiant est stable par type : il y a **au plus un rappel en attente par type**, et
re-planifier remplace. Cet invariant est ce qui rend le §2.5 possible.

### 2.5 Le volume de notifications : une garantie structurelle, pas un compteur

**Le problème réel.** Le hint des réglages affiche depuis V0.6 « Max 3 notifications par jour »
alors que **le code ne l'applique nulle part** — aveu explicite en commentaire dans
[notification-repository.ts:144](../../../../apps/mobile/src/data/repositories/notification-repository.ts#L144).
`canScheduleMore` existe, testé, et n'est appelé par personne.

**D3 — on corrige le hint, on n'ajoute pas de compteur.** Un compteur quotidien a été spécifié puis
abandonné, pour trois raisons qui se cumulent :

1. **Il ne protège de rien.** Chaque type de rappel est déjà borné à **un par jour** par son
   identifiant stable (§2.4). Après cette US, le maximum structurel est de **4 notifications par
   jour** (pesée, repas, streak, et le bilan le lundi), et le cas courant est de 0 à 2. Un plafond
   à 3 sur des types déjà idempotents ne fait qu'ajouter un état à maintenir.
2. **Il perd des rappels.** Le compteur devrait compter les types planifiés dans la journée, mais
   les planificateurs re-tournent à chaque retour au premier plan : sans court-circuit explicite,
   un type déjà compté se verrait refuser sa re-planification, et la branche d'annulation
   **supprimerait le rappel** à la deuxième ouverture de l'app.
3. **L'ordre de priorité n'est pas tenable.** Les conditions évoluent dans la journée : le streak
   consomme un créneau à 8 h puis est annulé à 18 h quand l'utilisateur s'entraîne — le créneau
   reste pris pour rien. Tout ordre de priorité déclaré serait démenti par le déroulé réel.

**La vraie protection contre le spam**, celle qu'on livre : les deux rappels sont **opt-in**, bornés
à un par jour et par type, **auto-supprimés dès que le geste est fait**, calés sur un **p90** (donc
rares pour un utilisateur régulier) et soumis au DND.

**Conséquence i18n obligatoire** : le hint est réécrit pour dire la vérité — « Au plus un rappel par
type et par jour. » `maxPerDay` et `canScheduleMore` restent en place, inutilisés, en attendant un
type de notification qui pourrait se déclencher plusieurs fois par jour. Le commentaire d'aveu de
`notification-repository.ts` est mis à jour pour renvoyer à cette décision au lieu de promettre une
implémentation à venir.

### 2.6 Préférences ajoutées

Cinq champs, dans le JSON existant — **aucune migration, aucune sync rule** :

| Champ | Défaut | Rôle |
|---|---|---|
| `mealReminder` | `false` | Rappel de journal alimentaire activé |
| `mealReminderHour` | `13` | Échéance de repli / manuelle |
| `weighInReminder` | `false` | Rappel de pesée activé |
| `weighInReminderHour` | `10` | Échéance de repli / manuelle |
| `learnedHour` | `true` | Caler les rappels sur les habitudes (global à la section) |

Ce sont bien des **échéances** et non des heures de geste : 13 h = « midi passé, rien de noté »,
10 h = « la matinée est bien avancée, pas de pesée ». Cohérent avec D1, et sans discontinuité
choquante quand l'apprentissage prend le relais au 5ᵉ jour.

**Pourquoi les deux rappels sont désactivés par défaut.** L'app envoie aujourd'hui environ une
notification par jour. Les activer silencieusement pour les utilisateurs existants en triplerait le
volume sans qu'ils l'aient demandé — c'est exactement le genre de mise à jour qui fait couper les
notifications au niveau système, et on perdrait alors *aussi* le rappel streak. Opt-in.

**Invariant à préserver et à tester** : `13` et `10` sont tous deux **hors** de la fenêtre DND par
défaut `[22, 7)`. L'invariant existe déjà pour `reminderHour` et `weeklyReviewHour` et il est testé
— on l'étend aux 4 heures.

## 3. Cas limites

| Situation | Comportement attendu |
|---|---|
| Nouvel utilisateur, 0 historique | Échéance de repli (13 h / 10 h). L'UI indique « pas encore assez d'historique ». |
| 4 jours retenus | Toujours le repli (seuil = 5). |
| Exactement 5 jours retenus | `p90 = trié[ceil(4,5) − 1] = trié[4]` = le **maximum** de l'échantillon. Volontairement conservateur : au seuil, on préfère une échéance tardive à un faux positif. |
| Journal rempli tous les jours | Le rappel n'est presque jamais envoyé, et c'est le but : le p90 le rend rare par construction. |
| Utilisateur loggeant à 23 h / 0 h 30 | p90 = 23 (le bord tardif, la bonne réponse), puis rabattu à 21 h par le DND par défaut. |
| Heure **apprise** en DND | Rabattue sur le bord le plus proche. Jamais supprimée. |
| Heure **manuelle** en DND | Rappel **non envoyé**, et l'écran de réglages l'annonce explicitement (§4). |
| Échéance déjà dépassée à l'ouverture | Aucun rappel aujourd'hui (§2.3). |
| Copie de la veille chaque matin | Apprise comme une saisie. Assumé : biaise l'échéance vers plus tard, donc vers moins de rappels (§2.1, D4). |
| Permission refusée | Aucune planification, aucun crash, bandeau déjà présent dans les réglages. |
| App non ouverte de la journée | Aucun rappel. Limite assumée (pas de job d'arrière-plan). |
| Changement de fuseau / voyage | Tout repose sur l'heure locale du terminal ; l'échéance se recale en quelques jours. |
| Entrées supprimées (`deleted_at`) | Exclues de l'apprentissage **et** du « déjà fait aujourd'hui ». |
| `learnedHour` passe à off | L'heure du stepper s'applique immédiatement, re-planification dans la seconde. |
| Pesée modifiée dans la journée | `logWeight` fait un `patch` : `created_at` garde l'heure de la **première** pesée du jour — celle qu'on veut apprendre. |
| Langue changée | Le contenu est résolu par `t()` **au moment de la planification** : un rappel déjà posé garde la langue d'alors. Limite déjà vraie pour le streak, non traitée ici. |

## 4. Réglages (UI)

La section « Notifications » de [settings.tsx](../../../../apps/mobile/src/app/settings.tsx)
s'enrichit, **sans nouvel écran** :

- un switch **« Caler sur mes habitudes »** (`learnedHour`), en tête de section ;
- une ligne **« Rappel de repas »** : switch + `HourStepper` ;
- une ligne **« Rappel de pesée »** : switch + `HourStepper`.

**Quand `learnedHour` est actif**, les deux steppers sont **désactivés visuellement** (valeur de
repli toujours lisible) et la ligne affiche l'heure effective avec sa provenance :

- assez d'historique → « D'après tes habitudes : 10 h » ;
- pas assez → « Pas encore assez d'historique — 10 h en attendant » ;
- heure apprise rabattue par le DND → « D'après tes habitudes : 21 h (décalé avant ta plage Ne pas
  déranger) ». Le rabattement doit être **visible**, sinon il produit le ticket de support qu'on
  cherche à éviter.

**Quand `learnedHour` est inactif** et que l'heure réglée tombe dans la fenêtre DND, la ligne
affiche un **avertissement** : « Cette heure est dans ta plage Ne pas déranger — le rappel ne sera
pas envoyé. » C'est la contrepartie de D6 : on respecte le choix de l'utilisateur, mais on ne le
laisse pas dans le noir.

`maxPerDay` reste **non exposé**, et le hint de section est réécrit (§2.5).

## 5. i18n (FR + EN, parité stricte)

Aucune chaîne en dur. Clés ajoutées ou modifiées :

- **Réglages** — `settings.notifications.` : `learnedHour`, `learnedHourDesc`, `mealReminder`,
  `mealReminderDesc`, `mealReminderTime`, `weighInReminder`, `weighInReminderDesc`,
  `weighInReminderTime`, `learnedHourValue` (`{{hour}}`), `learnedHourPending` (`{{hour}}`),
  `learnedHourShifted` (`{{hour}}`), `manualHourInDnd`.
- **Modifiée** — `settings.notifications.hint` : la mention « Max 3 notifications par jour »
  devient « Au plus un rappel par type et par jour. » (§2.5). FR **et** EN.
- **Contenu des notifications** — `notifications.mealReminder.{title,body}` et
  `notifications.weighInReminder.{title,body}`.

**Ton : jamais punitif** — c'est la décision D4 de BILAN-01, qui s'applique ici aussi. Une
notification qui dit « tu n'as rien fait » fait désinstaller.

| Clé | FR | EN |
|---|---|---|
| `mealReminder.title` | Ton journal est encore vide | Your log is still empty |
| `mealReminder.body` | Note ce que tu as mangé, ça prend 30 secondes. | Jot down what you ate — it takes 30 seconds. |
| `weighInReminder.title` | Pas encore de pesée aujourd'hui | No weigh-in yet today |
| `weighInReminder.body` | Un point de plus pour suivre ta tendance. | One more point to track your trend. |

## 6. Offline / a11y / technique

- **Offline-first, intégralement.** L'apprentissage lit le **SQLite local** (PowerSync), le calcul
  est pur, la planification est locale à l'OS, les préférences vivent dans une colonne JSON déjà
  synchronisée. **Zéro appel réseau, zéro migration, zéro sync rule à redéployer, aucun nouveau
  build.**
- **`created_at` est stocké en UTC.** La conversion en heure locale se fait **en JS**
  (`new Date(createdAt).getHours()`), jamais en SQL — un `strftime('%H', created_at)` renverrait
  l'heure UTC et décalerait tout l'apprentissage de 1 à 2 h selon la saison.
- **Ordre d'application** : apprentissage → rabattement DND → test de dépassement. Dans cet ordre,
  sinon une échéance de 23 h rabattue à 21 h serait testée contre la mauvaise borne.
- **a11y** : `accessibilityLabel` sur les 3 switches, `accessibilityState={{ disabled }}` sur les
  steppers inertes — sinon un lecteur d'écran annonce un contrôle actionnable qui ne fait rien. Les
  cibles des steppers sont déjà ≥ 48 dp effectifs (`hitSlop`), rien à corriger de ce côté.
- **React Compiler** : hooks inconditionnels, effets de planification idempotents.
- **Erreurs natives** : le contrat de la couche native reste le **no-op silencieux** (jamais de
  `throw`).

## 7. Critères de recette (device)

- [ ] Les deux rappels sont **désactivés** à l'installation ; les activer les fait apparaître.
- [ ] Journal vide + rappel de repas actif → notification reçue à l'échéance attendue.
- [ ] Logger un repas **annule** le rappel en attente (vérifiable en rouvrant l'app).
- [ ] Pesée saisie → rappel de pesée annulé pour la journée.
- [ ] 🔴 **Le rappel repart bien le lendemain** (D9) : logger un repas le soir, laisser l'app en
      arrière-plan **sans la tuer**, revenir le lendemain matin → le rappel doit se reprogrammer.
      C'est le critère du bug bloquant trouvé en revue, et il n'est observable qu'en **build
      release** (en dev, le cache de React Compiler est réinitialisé à chaque sauvegarde).
- [ ] **Ouvrir l'app moins de 15 min avant l'échéance ne déclenche rien** (§2.3 bis, D8).
- [ ] **Ouvrir l'app après l'échéance ne déclenche aucune notification** (§2.3) — le test qui
      vérifie qu'on ne notifie pas quelqu'un qui est déjà dans l'app.
- [ ] `learnedHour` actif : la ligne affiche l'heure et sa provenance ; les steppers sont inertes.
- [ ] `learnedHour` inactif : le stepper pilote l'heure, effet immédiat.
- [ ] Heure **apprise** tombant en DND → rappel reçu à l'heure **rabattue**, et l'écran l'indique.
- [ ] Heure **manuelle** réglée en pleine fenêtre DND → aucun rappel, **et l'avertissement est
      affiché**.
- [ ] Le hint de section ne promet plus « max 3 par jour ».
- [ ] Permission notifications refusée → aucun crash, bandeau affiché.
- [ ] Parité FR/EN sur toutes les nouvelles chaînes, contenu des notifications compris.

## 8. Definition of Done

- [ ] Spec + plan + maquette validés par Florian ou Damien.
- [ ] Briques pures **testées** (Vitest) : percentile par rang (n = 1, 5, 6, 7, 14 ; cas
      `{23,0,23,0,23,0}` → 23), rejet des saisies rétroactives, repli sur la plus ancienne entrée
      retenue, seuil de 5, rabattement DND (fenêtre simple, enjambant minuit, vide, égalité,
      `start = 0`) avec **assertion de propriété** `!isWithinDnd(résultat)` sur les 24 heures,
      décision de planification et chacun de ses motifs de refus.
- [ ] Invariant « heures par défaut hors DND » étendu aux **4** heures, testé.
- [ ] **Dérive Zod corrigée** : `notificationPrefsSchema` déclare les 8 champs existants + les 5
      nouveaux ; `settings.test.ts` mis à jour (le test actuel entérine la dérive).
- [ ] Rétrocompatibilité : un JSON d'avant cette US se parse avec les 5 nouveaux champs à leurs
      défauts, **rappels éteints**.
- [ ] Réglages : 3 nouveaux contrôles, persistance + re-planification immédiate, provenance de
      l'heure et avertissement DND affichés.
- [ ] Hint de section corrigé FR/EN ; commentaire d'aveu de `notification-repository.ts` mis à jour
      pour renvoyer à D3.
- [ ] i18n FR/EN à parité, ton non punitif.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` verts (**code de sortie lu sans pipe**).
- [ ] Recette device (§7) — **pas de nouveau build nécessaire**.

## 9. Explicitement différé

Un rappel par type de repas · nudge de complétude NUTR-25 · cadence de pesée hebdomadaire · job
d'arrière-plan garanti · plafond réel de notifications par jour (rouvrir le sujet le jour où un type
peut se déclencher plusieurs fois par jour) · unification des planificateurs en un registre
générique de types (à faire quand MUSC-F8 portera le total à 6 types) · exposition UI de
`maxPerDay` · relocalisation des rappels déjà posés au changement de langue · gestion explicite des
fuseaux horaires · iOS.

## 10. Ce que cette US pose pour MUSC-F8

MUSC-F8 (P1 : push nouveau record + rappel de séance planifiée) réutilisera **tel quel** le calcul
d'échéance apprise et le rabattement DND. C'est la raison de faire NUTR-F1 en premier : concevoir
deux fois le même mécanisme d'apprentissage aurait donné deux mécanismes divergents — et deux fois
la même erreur de conception que D1 corrige ici.

## Journal des décisions

| # | Décision | Pourquoi |
|---|---|---|
| **D1** | On apprend le **p90** de l'heure du geste, pas la médiane | La médiane fait partir le rappel pendant que l'utilisateur fait le geste, un jour sur deux |
| **D2** | Percentile **par rang**, sans interpolation | Défini pour tout `n`, pas d'ambiguïté sur les échantillons pairs, neutralise le problème circulaire dans le sens utile |
| **D3** | **Pas de compteur** de quota quotidien ; on corrige le hint mensonger | Les types sont déjà bornés à 1/jour ; un compteur perdrait des rappels et son ordre de priorité serait démenti par le déroulé réel |
| **D4** | Filtre anti-rétroactif assumé **incomplet** (les copies du jour passent) | Sous D1, la contamination repousse l'échéance plus tard — direction sûre. La corriger exigerait une migration |
| **D5** | Heure **apprise** en DND → **rabattue**, pas supprimée | Sinon la fonctionnalité est morte pour les couche-tard |
| **D6** | Heure **manuelle** en DND → **supprimée**, avec avertissement à l'écran | On ne réécrit pas en douce un choix de l'utilisateur ; une seule politique par origine de l'heure |
| **D7** | **Pas de fenêtre de rattrapage** de 30 min (idée du backlog écartée) | Elle notifierait l'utilisateur pendant qu'il est dans l'app ; et si l'échéance est passée, c'est qu'il a ouvert l'app |
| **D8** | **Marge d'imminence de 15 min** avant l'échéance *(ajoutée en revue)* | D7 protégeait après l'échéance, rien ne protégeait juste avant : ouvrir l'app à 12 h 59 pour une échéance à 13 h notifiait 60 s plus tard |
| **D9** | La clé du jour est un **état réactif**, pas un `new Date()` inline *(ajoutée en revue)* | `reactCompiler` gèle un paramètre de requête non réactif dans un slot mount-only : le « déjà fait aujourd'hui ? » répondait éternellement sur le jour du montage, **en build release uniquement** |
