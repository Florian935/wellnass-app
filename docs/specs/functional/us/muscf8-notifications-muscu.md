---
id: MUSC-F8
titre: "Notifications muscu — push de record agrégé, célébration animée, rappel de séance"
roadmap: [3.42, 2.7, 2.4]
catalogue: [META-07]
etape: recette
branche: feature/muscf8-notifications-muscu
maj: 30/07/2026
---
# US MUSC-F8 — Notifications muscu

> Trois capacités : un **push « nouveau record »** agrégé (3.42 + 2.7), la **célébration animée** au
> résumé de séance (l'autre moitié de 3.42), et un **rappel de séance planifiée** (2.4) — recadré,
> parce que la formulation de la roadmap décrit quelque chose que le modèle de données ne permet pas.
> Au passage, cette US **rouvre et solde la décision D3** de NUTR-F1 : le plafond quotidien devient
> réel, parce que le push de record est le premier type capable de partir plusieurs fois par jour.
> Branche : `feature/muscf8-notifications-muscu` · 30/07/2026 · **Statut : à valider (pas de code
> avant validation).**

## 0. Contexte (exploration du code réel)

**Ce qui joue en notre faveur.**

- **La détection de record a un point d'appel unique et synchrone.**
  [workout.tsx:442](../../../../apps/mobile/src/app/workout.tsx#L442) : `doFinish` enchaîne
  `finishWorkout`, puis `await evaluateWorkoutRecords(workoutId)` **dans un `try/catch`
  best-effort**, puis `router.replace('/workout-summary')` **hors du `try`**. Cette structure est
  l'invariant à préserver : l'évaluation peut échouer, la navigation jamais.
  `evaluateWorkoutRecords` renvoie déjà un `BeatenRecord[]` avec le **nom d'exercice résolu FR/EN**
  ([records-repository.ts:407](../../../../apps/mobile/src/data/repositories/records-repository.ts#L407)),
  et cette valeur de retour est aujourd'hui **jetée**. Il n'y a donc rien à recalculer.
- **L'infra de notifications a été étendue ce matin** (NUTR-F1) et se réutilise : `clampOutOfDnd`,
  `decideProgrammedReminder`, `REMINDER_MIN_LEAD_MINUTES`, `percentileHour`,
  `LEARNED_HOUR_MIN_SAMPLES`, `LEARNED_HOUR_WINDOW_DAYS`, `scheduleDatedReminder` / `cancelReminder`,
  et la primitive réactive `useTodayKey` / `useTodayDate` / `useWindowStartUtc` du correctif
  `e3fe754`. **Aucune de ces briques n'est à reconcevoir.**
- **Un conteneur animé existe déjà — côté course.** `CelebrationBanner` dans
  [run/summary.tsx:147](../../../../apps/mobile/src/app/run/summary.tsx#L147) : `Animated.timing`,
  fondu + zoom 0,96 → 1, 320 ms, `useNativeDriver`, **zéro dépendance native**.
  ⚠️ **Ce n'est pas transposable tel quel** : son contenu est intégralement running (props
  `distances: RecordDistanceKey[]`, `RECORD_ORDER`, clés `running.records.*`, styles dans la
  `StyleSheet` de l'écran). Seul le **conteneur animé** — une quinzaine de lignes — est partageable.
- **`workouts.started_at` et `finished_at` sont des `timestamptz`** répliqués en local
  ([powersync/schema.ts:222](../../../../apps/mobile/src/powersync/schema.ts#L222)) — donc l'heure
  d'entraînement est apprenable, comme l'heure de repas l'était. C'est bien `finished_at` qu'il
  faut apprendre, voir D12.

**Ce qui bloque, et qu'il faut trancher.**

- 🔴 **La roadmap 2.4 décrit l'impossible.** « Push 30 min avant une séance planifiée » :
  `planned_sessions.scheduled_date` est un **`date`**, jour seul
  ([migration](../../../../supabase/migrations/20260712110000_planned_sessions.sql)), et il n'existe
  **aucune heure de séance** dans le projet — ni colonne, ni préférence utilisateur. Il n'y a rien à
  quoi soustraire 30 minutes. Même formulation reprise dans
  [navigation-ux.md:116](../navigation-ux.md).
- 🔴 **Un record est pluriel.** `computeWorkoutRecords` émet jusqu'à **3 candidats par exercice**, et
  sur un exercice jamais travaillé `best === null` donc les 3 sont battus : une première séance de
  5 exercices produit **15 records en un seul appel**.
- 🔴 **Aucune notification immédiate n'existe.** Les deux seuls `scheduleNotificationAsync` du code
  utilisent un trigger `DATE` ou `WEEKLY`. `presentNotificationAsync` **n'existe plus** en SDK 57 ;
  la forme immédiate passe par `trigger: { channelId }` (`ChannelAwareTriggerInput`).
- 🔴 **`maxPerDay` n'est appliqué nulle part** et le hint des réglages promet, depuis ce matin, « au
  plus un rappel par type et par jour ». Un push de record casse cette promesse frontalement.
- **Les records de course sont un mécanisme entièrement séparé** (`running_pace_records`, mise à jour
  en place, détection au montage de l'écran résumé) — et son chemin de détection est **aussi** celui
  de `backfillRunningRecords`, qui rejoue tout l'historique.
- 🔴 **`useHasPlannedSession` ne peut PAS servir de condition d'envoi.** Deux raisons, chacune
  suffisante ([planned-session-repository.ts:246](../../../../apps/mobile/src/data/repositories/planned-session-repository.ts#L246)) :
  son `WHERE` accepte `status IN ('planned','done')`, donc il répond `true` pour une séance **déjà
  faite** ; et il n'a **aucun filtre de pilier** — `planned_sessions` est pilier-agnostique par
  conception, le pilier vivant sur `programs.pillar`. Une **course** planifiée déclencherait donc le
  rappel de séance muscu. Il faut une requête dédiée à deux jointures.
- 🔴 **Rien n'est lisible hors React.** Le push part depuis un callback, pas depuis un rendu : il lui
  faut les préférences et le système d'unités **hors hook**. Or `useNotificationPrefs` est un hook et
  il n'existe aucun `getNotificationPrefs()` ni `getUnitSystem()` — seuls `getAnalyticsEnabled` et
  `getHealthConnectEnabled` existent sur ce patron. Deux accesseurs à ajouter.

## 1. Périmètre à livrer

1. **Push « nouveau record » agrégé** (3.42 partie push, 2.7) — **un seul** push par séance, quel que
   soit le nombre de records battus. **Muscu uniquement.**
2. **Célébration animée** au résumé de séance (3.42 partie animation) — transposition de
   `CelebrationBanner`.
3. **Rappel de séance planifiée** (2.4) — à l'**échéance apprise**, faute d'heure de séance en base.
4. **Plafond quotidien réellement appliqué** — solde la dette laissée par D3.

**Hors périmètre, explicitement :**

- **Le push de record côté course.** Deux raisons cumulées : aucune abstraction commune n'existe (ce
  serait deux intégrations distinctes), et surtout le chemin de détection est **aussi** celui du
  backfill de tout l'historique — un push branché là partirait en rafale au premier passage.
  L'idempotence de `detectAndStoreRunRecords` protège les rejeux **ultérieurs**, pas le premier.
- **Ajouter une heure aux séances planifiées** (migration + UI de saisie + génération). C'est une US à
  part entière, et c'est le seul chemin vers un vrai « 30 min avant » (§2.3, D12).
- **Le registre générique des types de notification.** NUTR-F1 le prévoyait « quand MUSC-F8 portera le
  total à 6 types ». Reporté : cette US en ajoute 2, la duplication devient réelle, mais la refondre
  ici mélangerait un refactor transverse avec trois fonctionnalités. Voir §9.
- **Exposition UI de `maxPerDay`** — le plafond s'applique, il ne se règle pas.
- **iOS**, **push distantes** (tout reste local).

## 2. Règles métier

### 2.1 Push de record — un seul par séance (D10)

**Un push, pas quinze.** L'agrégation n'est pas une optimisation, c'est la condition pour que la
fonctionnalité soit supportable : sans elle, une première séance déclencherait 15 notifications.

**On compte des exercices, et on le dit.** Le décompte porte sur les **exercices** sur lesquels un
record est tombé, jamais sur le nombre de lignes de record — parce que 3 types battus sur un seul
exercice donneraient « 3 records battus ! » pour un seul mouvement travaillé, ce qui est perçu comme
gonflé. Et l'inverse serait tout aussi faux : annoncer « 2 records » quand 2 exercices ont chacun
battu 3 types sous-vend la séance. **On lève l'ambiguïté dans le texte** plutôt que de choisir un
mensonge :

| Exercices concernés | Titre | Corps |
|---|---|---|
| 1 | 🏆 Nouveau record ! | Développé couché — 82,5 kg |
| 2 à 3 | 🏆 Records battus sur 3 exercices ! | Développé couché, Squat, Soulevé de terre |
| 4 et + | 🏆 Records battus sur 7 exercices ! | Développé couché, Squat, Soulevé de terre et 4 autres |

On nomme jusqu'à **3 exercices** puis on compte le reste : au-delà, le corps est tronqué par le
système, et une liste illisible ne célèbre rien.

**Deux dédoublonnages distincts, et il faut les deux** (sinon les chiffres et la liste divergent) :
- le **décompte** dédoublonne sur `exerciseId` ;
- la **liste de noms** dédoublonne sur le **libellé**. Deux `exerciseId` différents peuvent porter le
  même nom — exercice custom dupliqué, ou archivé puis recréé, cas d'autant plus probable que la
  résolution de nom ne filtre pas `deleted_at`. Sans ça : « Records battus sur 2 exercices ! Squat,
  Squat ».

**Nom vide** : `exerciseName` n'est jamais `null` mais peut être `''` (exercice custom sans traduction
ni repli `fr`). Un nom vide est **exclu de la liste** — sinon on afficherait « , Squat » — mais
**compté** dans le décompte : le record existe, il a juste perdu son libellé.

**Identifiant unique par séance** : `record-push-<workoutId>`. **Ce point a changé en revue.** Un
identifiant *stable* aurait fait remplacer la notification de la première séance par celle de la
seconde — donc effacer une trace, ce qui **détruit la valeur même invoquée par D11**. Les traces
doivent coexister. Conséquence directe : l'invariant « au plus un en attente par type » **ne tient pas
pour ce type**, et c'est précisément pourquoi le plafond de D14 est nécessaire.

### 2.2 Le push part même si l'app est au premier plan (D11) — et pourquoi c'est discutable

**Il faut le dire franchement : ce push double l'écran de résumé.** `doFinish` navigue vers
`/workout-summary` immédiatement après la détection, et cet écran **affiche déjà les records**
(`RecordsSection`). Le handler affichant les bannières au premier plan, l'utilisateur reçoit donc une
notification lui annonçant ce qu'il a sous les yeux. C'est très exactement l'absurdité que la
décision D8 de NUTR-F1 a servi à éliminer ce matin, dans sa variante « le geste est en cours ».

Quatre options ont été pesées, dont une **ajoutée en revue** :

- **supprimer le push au premier plan** → comme la détection est *toujours* au premier plan, le push
  ne partirait jamais : fonctionnalité morte ;
- **le retarder et l'annuler si le résumé s'affiche** → élégant, mais le résumé s'affiche
  systématiquement (`router.replace` dans la même fonction) : même résultat. Et **aucun signal
  « le résumé a été vu » n'existe** dans le dépôt — ni flag, ni analytics ;
- 🔬 **un handler par notification** — `setNotificationHandler`
  ([notifications.ts:66](../../../../apps/mobile/src/lib/notifications.ts#L66)) **ignore aujourd'hui son
  argument** et renvoie `shouldShowBanner: true` en dur. Un handler qui teste
  `notification.request.identifier` pourrait **supprimer la bannière tout en gardant la trace**, ce qui
  ferait disparaître l'objection entière. ⚠️ **À vérifier sur device avant de s'y fier** : sur Android
  l'entrée du volet *est* la présentation, donc supprimer la bannière supprime probablement aussi la
  trace (`shouldShowList` est une notion iOS). **C'est le premier essai à faire en recette** — si ça
  marche, on retient cette option et D11 devient sans objet ;
- **l'envoyer tel quel** — retenu **par défaut**, en attendant ce test.

À noter : `shouldPlaySound: false` est déjà global, donc le doublon est **visuel seulement**, pas sonore.

**L'argument qui le justifie** : la valeur du push n'est pas l'information (elle est à l'écran) mais
la **trace dans le tiroir de notifications**. Un record est un jalon ; le retrouver sur son écran
verrouillé le soir, ou le montrer, a une valeur propre que l'écran de résumé — consulté une fois puis
quitté — n'a pas.

**Ce que ça impose** : le push est **désactivable** (`recordPush`, §2.5) et **par défaut activé**.
C'est le seul type de cette app qui **célèbre** au lieu de réclamer : la logique d'opt-in retenue pour
les rappels de NUTR-F1 (ne pas augmenter le volume de sollicitations sans consentement) ne s'applique
pas à une notification que l'utilisateur est content de recevoir. À réévaluer si la recette montre
l'inverse.

### 2.3 Rappel de séance planifiée — une échéance, pas « 30 min avant » (D12)

« 30 min avant » est **incalculable** (§0). Deux issues possibles : ajouter une heure aux séances
planifiées (migration + saisie + génération — une US à part), ou apprendre l'heure. **On apprend.**

**Ce qu'on apprend** : le **p90 de l'heure de `workouts.finished_at`**, une valeur par jour, sur
14 jours glissants, seuil de 5 jours — exactement les constantes de NUTR-F1. Seules les séances
**terminées** comptent : `finished_at IS NOT NULL AND deleted_at IS NULL` (une séance annulée est
soft-deleted, une séance en cours a `finished_at = null`).

> 🔴 **`finished_at` et non `started_at` — corrigé en revue, et c'est la même erreur que D1 sous une
> autre forme.** La première rédaction apprenait l'heure de **début**. Or la sémantique voulue est
> « l'heure après laquelle, 9 fois sur 10, c'est **déjà fait** » : au p90 des heures de *début*, la
> séance commence à peine. Quelqu'un qui démarre habituellement à 18 h aurait reçu « ta séance
> t'attend » à 18 h, **pendant son échauffement** — exactement le défaut que D1 a corrigé ce matin
> pour le journal alimentaire.
>
> Aggravant qui achève de trancher : `usableDailyHours` retient la **plus ancienne** entrée retenue du
> jour, donc deux séances dans une journée auraient tiré l'échéance encore plus tôt. Avec
> `finished_at`, « la plus ancienne » signifie « la fin de la première séance », ce qui reste un bord
> cohérent.

**Et c'est bien une échéance, pas un horaire de convocation.** Le message n'est pas « ta séance
commence » (on ne sait pas quand) mais « **la journée avance et ta séance planifiée n'est pas
faite** ». Le p90 est donc le bon bord : l'heure après laquelle, 9 fois sur 10, l'utilisateur s'est
déjà entraîné. C'est ce qui rend le rappel rare pour quelqu'un de régulier — même raisonnement que
D1, même conclusion.

> ⚠️ **Ne pas se tromper de bord.** Un rappel « ta séance va commencer » aurait voulu le bord
> **précoce** de la distribution, donc un p10, pas un p90. C'est la sémantique du message qui décide,
> et elle est fixée ici : *échéance*, pas *convocation*. Si on ajoute un jour une vraie heure de
> séance, ce rappel changera de nature et cette règle devra être rediscutée.

**Le filtre anti-rétroactif de NUTR-F1 est un no-op ici**, et c'est normal : `workouts` n'a pas de
`log_date`, et `finished_at` **est** l'instant du geste — une séance ne se saisit pas rétroactivement.
On passe donc `logDate = localDayKey(finished_at)`, ce qui fait passer 100 % des lignes. Dit
explicitement pour que personne ne croie plus tard que le filtre protège quelque chose ici.

**Conditions d'envoi** (mêmes que NUTR-F1, §2.4 de sa spec) : rappel activé · **une occurrence
`planned` de pilier `strength` existe pour aujourd'hui** · échéance non dépassée et pas imminente
(marge D8 de 15 min) · hors DND après rabattement si l'heure est apprise · permission accordée.
Annulé dès que la séance est validée ou l'occurrence supprimée.

> ⚠️ **Cette condition demande une requête neuve**, `useHasPlannedStrengthSessionToday`, à deux
> jointures `planned_sessions → sessions → programs`, avec `status = 'planned'` **strictement** et
> `programs.pillar = 'strength'`. `useHasPlannedSession` ne peut pas servir : il accepte `'done'` et
> n'a pas de filtre de pilier (§0). Le statut `'planned'` porte à lui seul le « pas déjà faite » —
> inutile d'une seconde condition.

**Différence notable avec les rappels de NUTR-F1** : celui-ci ne part que s'il y a **quelque chose de
planifié aujourd'hui**. C'est un rappel d'engagement, pas d'habitude — sans séance au planning, il n'y
a rien à rappeler, et notifier quand même serait du harcèlement.

### 2.4 Célébration animée au résumé (D13)

Transposition de `CelebrationBanner` : fondu d'opacité + zoom 0,96 → 1, **320 ms**, `useNativeDriver`,
monté conditionnellement quand `records.length > 0`. Aucune dépendance native, aucun changement de
données.

**a11y** : l'animation est décorative et **ne porte aucune information** — le texte et les valeurs
restent lisibles sans elle. Elle doit respecter `AccessibilityInfo.isReduceMotionEnabled()` : si le
réglage système « réduire les animations » est actif, la bannière s'affiche **directement à son état
final**. Le composant course ne le fait pas aujourd'hui ; on ne recopie pas ce manque.

### 2.5 Le plafond quotidien devient réel — D3 soldée (D14)

**Le raisonnement de D3 était juste, mais il ne couvrait qu'un cas.** D3 refusait le compteur parce
qu'il « ferait perdre des rappels : `apply()` re-tourne à chaque retour au premier plan et un type
déjà compté se verrait refuser sa re-planification, la branche d'annulation supprimant alors le rappel
en attente ». Cette objection ne vaut **que pour les notifications replanifiées**.

**Un push immédiat, lui, est fire-and-forget** : il n'est jamais réévalué, jamais annulé, jamais
replanifié. Un compteur s'y applique donc sans rien perdre. C'est la distinction qui débloque le sujet.

**Règle** : le plafond `maxPerDay` (défaut 3) s'applique **aux seules notifications immédiates**, en
l'occurrence le push de record. Les quatre rappels programmés (streak, bilan, repas, pesée) et le
nouveau rappel de séance en sont **exemptés** — ils sont déjà bornés à un par jour et par type par leur
identifiant stable, et les soumettre au compteur reproduirait exactement le défaut que D3 décrivait.

**Et le plafond borne quelque chose de réel, maintenant que les identifiants sont uniques (D10).**
Avec un identifiant stable, le tiroir n'aurait jamais contenu qu'**une** notification de record : le
plafond aurait alors prétendu borner 3 notifications que l'utilisateur n'aurait jamais vues
ensemble — la revue l'a relevé, et c'est ce qui a fait changer D10. Avec des identifiants uniques par
séance, 3 traces coexistent réellement, et le plafond borne à la fois les **traces** et les
**interruptions**.

**Ce qu'on compte** : les **tentatives d'envoi réussies**, c'est-à-dire celles où l'appel natif n'a pas
levé. Deux précautions, toutes deux issues de la revue :

- `presentNow` doit renvoyer un **booléen** (et non `void`) — sinon le contrat no-throw de la couche
  native rend « effectivement envoyé » **immesurable**, et le compteur s'incrémenterait sur des échecs ;
- la **permission doit être vérifiée en tête**, avant toute consommation de quota. Sans ça, les
  3 unités du jour partiraient en fumée alors qu'aucune notification ne peut s'afficher.

Stocké dans un store Zustand **local à l'appareil**, persisté, de forme `{ dayKey, count }`, remis à
zéro au changement de jour — via `useTodayKey`, donc à l'abri du gel corrigé par `e3fe754`.
Volontairement non synchronisé : un quota de notifications est une propriété de l'appareil, pas du
compte.

**Au-delà du plafond** : le push est **silencieusement abandonné**. Pas de file d'attente, pas de
report — une célébration différée n'en est plus une.

**Conséquence i18n obligatoire** : le hint des réglages, corrigé ce matin en « Au plus un rappel par
type et par jour », redevient faux. Nouvelle formulation : « Au plus un rappel par type et par jour,
plus 3 célébrations de record au maximum. »

> C'est la **deuxième correction de ce texte en une journée**. Le problème n'est pas le texte, c'est
> qu'on lui fait porter une **garantie chiffrée** qui change à chaque US touchant les notifications.
> Candidat à une reformulation qualitative (« Les rappels restent rares et respectent ta plage Ne pas
> déranger ») à la prochaine occasion.

### 2.6 Préférences ajoutées

Trois champs, dans le JSON existant — **aucune migration** :

| Champ | Défaut | Rôle |
|---|---|---|
| `recordPush` | `true` | Push de record activé (célébration → opt-out, §2.2) |
| `sessionReminder` | `false` | Rappel de séance planifiée activé (sollicitation → opt-in) |
| `sessionReminderHour` | `18` | Échéance de repli / manuelle |

**Deux défauts opposés, et c'est délibéré** : le push de record **célèbre** (opt-out), le rappel de
séance **réclame** (opt-in). C'est la ligne posée par NUTR-F1 pour les sollicitations, et elle ne
s'applique pas à une bonne nouvelle.

**Invariant à préserver et à tester** : `18` est hors de la fenêtre DND par défaut `[22, 7)`. Les
**cinq** heures par défaut doivent le vérifier.

## 3. Cas limites

| Situation | Comportement attendu |
|---|---|
| Première séance, 5 exercices, 15 records | **1 seul push**, « Records battus sur **5** exercices ! » — le décompte porte sur les exercices, pas sur les 15 lignes (§2.1). 3 nommés + « et 2 autres ». Compte pour **1** dans le plafond. |
| 3 types battus sur 1 seul exercice | « Nouveau record ! » au **singulier**. |
| 2 exercices, 3 types chacun (6 records) | « Records battus sur **2** exercices ! » — le titre nomme l'unité comptée, donc aucune ambiguïté. |
| 2 `exerciseId` différents, même libellé | Décompte = 2, liste = **un seul** nom (dédoublonnage sur le libellé, §2.1). |
| `exerciseName` vide | Exclu de la liste, **compté** dans le décompte. |
| Aucun record | Aucun push, aucune animation. |
| 2 séances à record le même jour | 2 pushes, **2 traces distinctes** (id unique par séance, §2.1). |
| Permission refusée | Aucun push **et aucune unité de quota consommée** (§2.5). |
| `presentNow` échoue silencieusement | Compteur **non** incrémenté — c'est pourquoi il renvoie un booléen. |
| Une **course** est planifiée aujourd'hui, pas de muscu | **Aucun** rappel de séance : la requête filtre `programs.pillar = 'strength'`. |
| 4ᵉ séance à record du jour | Push abandonné silencieusement (plafond 3, §2.5). |
| `evaluateWorkoutRecords` échoue | Le push n'est pas envoyé. Le contrat best-effort de `doFinish` est préservé : **la navigation vers le résumé ne doit jamais être bloquée**. |
| Permission notifications refusée | Aucun push, aucun crash. L'animation, elle, s'affiche — elle ne dépend d'aucune permission. |
| « Réduire les animations » actif | Bannière à l'état final, sans transition (§2.4). |
| Rappel de séance, rien de planifié aujourd'hui | Aucun rappel. |
| Séance planifiée déjà faite | Rappel annulé. |
| Moins de 5 jours d'historique de séances | Échéance de repli (18 h), et l'UI l'indique — mêmes libellés de provenance que NUTR-F1. |
| Échéance apprise en DND | Rabattue (D5). Heure **manuelle** en DND → non envoyée + avertissement (D6). |
| App non ouverte de la journée | Aucun rappel de séance. Limite assumée, identique aux autres. |
| Changement de jour app ouverte | Compteur de plafond et échéances suivent, via `useTodayKey`. |

## 4. Réglages (UI)

Section « Notifications » existante, **sans nouvel écran** :

- ligne **« Nouveau record »** : switch seul (pas d'heure — c'est un push immédiat), description
  « Une notification quand tu battes un record. » ;
- ligne **« Rappel de séance »** : switch + `HourStepper` + la **provenance de l'heure**, exactement
  comme les deux rappels de NUTR-F1 (composant `ProgrammedReminderRows` déjà en place, à réutiliser).

Le hint de section est réécrit (§2.5).

## 5. i18n (FR + EN, parité stricte)

- **Réglages** — `settings.notifications.` : `recordPush`, `recordPushDesc`, `sessionReminder`,
  `sessionReminderDesc`, `sessionReminderTime`. Et **`hint` modifiée** (§2.5).
- **Contenu** — `notifications.record.` : `titleOne`, `titleMany` (`{{count}}`), `bodyOne`
  (`{{exercise}}`, `{{value}}`), `bodyMany` (`{{names}}`), `bodyManyOverflow` (`{{names}}`,
  `{{rest}}`) · `notifications.sessionReminder.{title,body}`.
- **Animation** — réutilise les clés de célébration existantes si elles sont génériques, sinon
  `workout.summary.celebration.*`.

**Ton** : célébrer sans exagérer. On annonce un fait chiffré, pas une performance héroïque.

| Clé | FR | EN |
|---|---|---|
| `record.titleOne` | 🏆 Nouveau record ! | 🏆 New personal record! |
| `record.titleMany` | 🏆 Records battus sur {{count}} exercices ! | 🏆 Records broken on {{count}} exercises! |
| `record.bodyOne` | {{exercise}} — {{value}} | {{exercise}} — {{value}} |
| `record.bodyMany` | {{names}} | {{names}} |
| `record.bodyManyOverflow` | {{names}} et {{rest}} autres | {{names}} and {{rest}} more |
| `sessionReminder.title` | Ta séance du jour t'attend | Today's session is waiting |
| `sessionReminder.body` | Elle est encore au planning — 40 minutes et c'est fait. | It's still on your plan — 40 minutes and it's done. |

## 6. Offline / a11y / technique

- **Offline-first, intégralement.** Détection locale, agrégation pure, notification locale, préférences
  dans une colonne JSON déjà synchronisée. **Zéro réseau, zéro migration, zéro sync rule, aucune
  dépendance native, aucun nouveau build** — `trigger: { channelId }` n'ajoute rien à installer.
- **Aucune lecture d'horloge dans un composant ou un hook** : tout passe par `useTodayKey` /
  `useTodayDate`. Le fichier touché doit être **ajouté à la liste surveillée** par
  [no-frozen-clock.test.ts](../../../../apps/mobile/src/hooks/__tests__/no-frozen-clock.test.ts).
- **Contrat no-throw** de la couche native préservé ; le push hérite du best-effort de `doFinish`.
- **a11y** : switches étiquetés ; animation respectant « réduire les animations » (§2.4).

## 7. Critères de recette (device)

- [ ] Première séance sur des exercices neufs → **une seule** notification, décompte correct.
- [ ] 3 types battus sur un seul exercice → titre au **singulier**.
- [ ] 4 exercices ou plus → 3 nommés + « et N autres ».
- [ ] La **célébration animée** apparaît au résumé quand il y a un record, pas sinon.
- [ ] Réglage système « réduire les animations » actif → bannière sans transition.
- [ ] `recordPush` désactivé → aucune notification, l'animation reste.
- [ ] 4 séances à record le même jour → **3 notifications**, la 4ᵉ silencieuse.
- [ ] Deux séances à record → la seconde notification **remplace** la première dans le tiroir.
- [ ] Rappel de séance : une occurrence planifiée non faite → notification à l'échéance ; la valider
      **annule** le rappel.
- [ ] Rien de planifié aujourd'hui → **aucun** rappel de séance.
- [ ] Provenance de l'heure affichée (apprise / repli / rabattue), comme pour NUTR-F1.
- [ ] Le hint de section annonce la bonne garantie.
- [ ] Parité FR/EN, contenu des notifications compris.

## 8. Definition of Done

- [ ] Spec + plan + maquette validés par Florian ou Damien.
- [ ] Briques pures **testées** (Vitest) : agrégation du contenu (1 / 2-3 / 4+ records,
      dédoublonnage par exercice, troncature à 3 noms), échéance apprise sur `started_at`, plafond
      (sous / au / au-delà), et le fait que le plafond **ne s'applique pas** aux rappels programmés.
- [ ] Invariant « heures par défaut hors DND » étendu aux **5** heures.
- [ ] Rétrocompatibilité du parse : un JSON d'avant cette US donne `recordPush: true`,
      `sessionReminder: false`.
- [ ] `trigger: { channelId }` ajouté à la couche native, contrat no-throw conservé, mock Jest étendu.
- [ ] Le fichier de détection est ajouté à la liste de `no-frozen-clock.test.ts`.
- [ ] Hint de section corrigé FR/EN ; le commentaire de `notification-repository.ts` renvoyant à D3 est
      mis à jour pour pointer D14.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` verts (**code de sortie lu sans pipe**).
- [ ] Recette device (§7) — **pas de nouveau build nécessaire**.

## 9. Explicitement différé

Push de record **côté course** (backfill = rafale) · **heure réelle de séance planifiée** (migration +
saisie + génération) et donc le vrai « 30 min avant » · **registre générique des types de
notification** — cette US porte le total à **6 types** et quatre planificateurs quasi jumeaux, la
duplication est désormais indéfendable, mais la refondre ici mélangerait un refactor transverse avec
trois fonctionnalités · exposition UI de `maxPerDay` · relocalisation des notifications déjà posées au
changement de langue · iOS.

## Journal des décisions

| # | Décision | Pourquoi |
|---|---|---|
| **D10** | **Un seul push agrégé** par séance · le titre compte les **exercices** et le dit · double dédoublonnage (id pour le compte, libellé pour la liste) · **identifiant unique par séance** *(revu en revue)* | 15 notifications seraient insupportables. Et un identifiant *stable* aurait fait effacer la trace de la séance précédente — donc détruit la valeur invoquée par D11 |
| **D11** | Le push part **même au premier plan**, par défaut — mais un **handler par notification** est à tester en recette et pourrait rendre la décision sans objet *(option ajoutée en revue)* | Supprimer au premier plan = fonctionnalité morte. La valeur retenue est la **trace**, pas l'information. Le handler actuel ignore son argument : le rendre sélectif pourrait supprimer la bannière en gardant la trace |
| **D12** | 2.4 devient une **échéance apprise** (p90 de **`finished_at`**, corrigé en revue), pas « 30 min avant » | `scheduled_date` est un jour seul : la roadmap décrit l'impossible. Et apprendre `started_at` aurait fait partir le rappel **pendant l'échauffement** — la même erreur que D1, déplacée |
| **D13** | Animation **décorative**, respectant « réduire les animations » | Elle ne porte aucune information ; le composant course ne gère pas ce réglage, on ne recopie pas ce manque |
| **D14** | Le plafond `maxPerDay` s'applique aux **notifications immédiates seulement**, et compte les **tentatives réussies** | L'objection de D3 ne vaut que pour les notifications **replanifiées** ; un push fire-and-forget n'est jamais réévalué. Le contrat no-throw imposant un retour booléen et une vérification de permission en amont, sinon le quota brûlerait sur des échecs |
| **D15** | `recordPush` **opt-out**, `sessionReminder` **opt-in** | Une notification qui célèbre n'est pas une sollicitation. La règle d'opt-in de NUTR-F1 protégeait du volume de **réclamations** |
| **D16** | Requête **dédiée** pour « une séance muscu est planifiée aujourd'hui » | `useHasPlannedSession` accepte `status = 'done'` et n'a **aucun filtre de pilier** : une course planifiée aurait déclenché le rappel muscu |

## 10. Ce que cette US doit à celles du jour

L'échéance apprise (`percentileHour`, seuil, fenêtre), le rabattement DND (`clampOutOfDnd`), la marge
d'imminence (`REMINDER_MIN_LEAD_MINUTES`), la décision de planification
(`decideProgrammedReminder`), le composant de réglage `ProgrammedReminderRows` et la primitive
réactive `useTodayKey` sont **tous livrés et testés depuis ce matin** (NUTR-F1 + `e3fe754`). Cette US
n'en réécrit aucun. C'était l'argument de séquencement, et il se vérifie.
