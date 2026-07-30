# Plan d'implémentation — MUSC-F8 · Notifications muscu

> Spec : [muscf8-notifications-muscu.md](../specs/functional/us/muscf8-notifications-muscu.md) ·
> Branche : `feature/muscf8-notifications-muscu` · 30/07/2026
>
> **Révisé après relecture critique** : erreur d'horodatage corrigée (`finished_at`, pas
> `started_at` — D12), identifiant de push rendu unique par séance (D10), deux accesseurs hors-hook
> ajoutés (B2), contrat `presentNow` rendu booléen avec permission vérifiée en tête (B3), requête
> dédiée pour « séance muscu planifiée aujourd'hui » (D16), extraction correcte du conteneur animé
> (S2), position de la bannière corrigée (S3), étape de généralisation du percentile **supprimée**
> (YAGNI — S7, la spec diffère explicitement tout rappel de type « convocation »).

## Résumé technique

| | |
|---|---|
| **Migration DB** | ❌ **aucune** — 3 préférences dans `user_settings.notifications` (JSON déjà synchronisé) |
| **Sync rules** | ❌ aucune à redéployer |
| **Dépendance native** | ❌ aucune — `trigger: { channelId }` est du SDK 57 déjà installé |
| **Nouveau build** | ❌ non requis |
| **Réseau** | ❌ aucun appel |

Trois capacités. **L'ordre de build les sépare volontairement** : l'animation ne dépend de rien, le
plafond doit exister avant le push, le rappel de séance dépend de l'apprentissage. Chaque étape est
commitable seule.

## Ordre de build

### Étape 1 — Animation de célébration (indépendante, 1,5 h)

La seule capacité qui ne touche pas aux notifications : à faire en premier, pour livrer de la valeur
même si le reste dérape.

**Ce qui est réellement partageable — pas tout `CelebrationBanner`.** Le composant de
[run/summary.tsx:147](../../apps/mobile/src/app/run/summary.tsx#L147) est intégralement running :
props `distances: RecordDistanceKey[]`, `RECORD_ORDER`, clés `running.records.*`, et ses styles
vivent dans la `StyleSheet` de l'écran. Seul le **conteneur animé** — l'`Animated.Value`, le
`timing` 320 ms, l'interpolation d'échelle — est commun.

**Fichiers créés**
- `apps/mobile/src/components/CelebrationCard.tsx` — le conteneur seul :
  ```tsx
  export function CelebrationCard({ children }: { children: React.ReactNode }) {
    const scale = useRef(new Animated.Value(0.96)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
      AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
      const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
      return () => sub.remove();
    }, []);

    useEffect(() => {
      if (reduceMotion) { scale.setValue(1); opacity.setValue(1); return; }
      Animated.timing(/* … 320ms, comme l'existant … */).start();
    }, [reduceMotion]);

    return <Animated.View style={{ opacity, transform: [{ scale }] }}>{children}</Animated.View>;
  }
  ```
  Le respect de « réduire les animations » (D13) est **nouveau** : le composant course ne le fait pas
  aujourd'hui. On ne recopie pas ce manque.

**Fichiers modifiés**
- `apps/mobile/src/app/run/summary.tsx` — son propre contenu (trophée, distances) enveloppé dans
  `CelebrationCard`. Gagne au passage le respect de « réduire les animations ». ⚠️ Vérifié en revue :
  `ShareCard` capture son **propre** `cardRef` et ne photographie pas l'écran — aucun risque sur la
  carte partageable.
- `apps/mobile/src/app/workout-summary.tsx` — nouveau contenu muscu (trophée + décompte, §2.1),
  enveloppé dans `CelebrationCard`, monté **juste après `ScreenHeader`** (≈ ligne 270-271, avant les
  métriques). **Pas** au-dessus de `RecordsSection` (≈ ligne 333) : l'animation démarre au montage,
  et une soixantaine de lignes de JSX séparent le header de `RecordsSection` — montée trop bas,
  l'utilisateur découvrirait la bannière déjà à l'état final, l'animation ayant joué hors écran.

**Tests (Jest)** : rendu avec/sans records ; état final immédiat quand
`AccessibilityInfo.isReduceMotionEnabled` renvoie `true` (mock à ajouter à `jest.setup.ts` si absent).

---

### Étape 2 — Deux accesseurs hors-hook + plafond quotidien (1,5 h)

**Ce que le push exige et qui n'existe pas** : `maybePushRecords` (étape 4) s'exécute dans un
**callback d'événement** (`doFinish`), pas dans un rendu. Il lui faut les préférences et le système
d'unités **sans hook**. Aujourd'hui, seuls `getAnalyticsEnabled` / `getHealthConnectEnabled`
([settings-repository.ts:204](../../apps/mobile/src/data/repositories/settings-repository.ts#L204))
suivent ce patron.

**Fichiers modifiés**
- `apps/mobile/src/data/repositories/settings-repository.ts` — deux accesseurs de plus, même patron
  (lecture directe PowerSync, pas de hook) :
  ```ts
  export async function getNotificationPrefs(): Promise<NotificationPrefs>;
  export async function getUnitSystem(): Promise<UnitSystem>;
  ```

**Fichiers créés**
- `apps/mobile/src/stores/notification-quota-store.ts` — Zustand + persistance AsyncStorage, patron
  `menu-accent-store` (`hydrated` + `hydrate()` idempotent, écriture best-effort en `try/catch`
  silencieux) :
  ```ts
  type NotificationQuotaState = {
    dayKey: string | null;
    count: number;
    hydrated: boolean;
    hydrate: () => Promise<void>;
    /** Incrémente pour `dayKey`, en réinitialisant si le jour a changé. N'appeler QUE sur un envoi réussi. */
    recordSuccess: (dayKey: string) => void;
    /** Nombre de tentatives réussies pour `dayKey` (0 si autre jour). */
    countFor: (dayKey: string) => number;
  };
  ```
  Le nom `recordSuccess` (et non `record`) porte la règle dans la signature : **on n'incrémente que
  sur un envoi qui n'a pas levé** (D14, corrigé en revue — l'appelant ne doit pas pouvoir se tromper).

**Fichiers modifiés**
- `apps/mobile/src/data/repositories/notification-repository.ts` — le commentaire des lignes 144-148
  renvoie à **D14** ; préciser que l'exemption des 5 rappels programmés est **volontaire**.

**Tests (Jest)** : `recordSuccess` incrémente, réinitialise au changement de jour, `countFor` d'un
autre jour → 0 ; `canScheduleMore` respecté aux bornes (2/3 oui, 3/3 non) ; persistance mockée.

---

### Étape 3 — Contenu du push, en brique pure (2 h)

Nouveau **`packages/shared/src/record-notification.ts`** + test. Aucune dépendance native, aucune
traduction : la brique rend des **clés i18n et des paramètres** (patron `intensityLabelKey`).

```ts
export interface BeatenRecordSummary {
  exerciseId: string;
  /** Peut être '' (exercice custom sans traduction ni repli fr) — voir la règle de filtrage. */
  exerciseName: string;
  /** Valeur déjà formatée par l'appelant (unités, décimales). */
  formattedValue: string;
}

/** Nombre maximal d'exercices nommés dans le corps de la notification. */
export const RECORD_PUSH_MAX_NAMED = 3;

export type RecordPushContent = {
  titleKey: 'notifications.record.titleOne' | 'notifications.record.titleMany';
  titleParams: { count: number };
  bodyKey:
    | 'notifications.record.bodyOne'
    | 'notifications.record.bodyMany'
    | 'notifications.record.bodyManyOverflow';
  bodyParams: { exercise?: string; value?: string; names?: string; rest?: number };
} | null;

/**
 * `null` si aucun record — l'appelant n'envoie alors rien.
 *
 * DEUX dédoublonnages distincts, à ne pas fusionner :
 *  - le DÉCOMPTE (`count`, et le choix titleOne/titleMany) dédoublonne sur `exerciseId` ;
 *  - la LISTE de noms dédoublonne sur le libellé (deux exerciseId peuvent partager un nom :
 *    exercice custom dupliqué, ou archivé puis recréé).
 * Un nom vide ('') est exclu de la liste mais reste compté dans `count`.
 */
export function buildRecordPushContent(records: BeatenRecordSummary[]): RecordPushContent;
```

**Tests (Vitest)** — c'est là que vivent les règles de D10 :
- tableau vide → `null` ;
- 1 exercice, 1 type battu → `titleOne` + `bodyOne` ;
- **3 types sur 1 seul `exerciseId` → `titleOne`**, count = 1 (le test qui verrouille le
  dédoublonnage par id, et qui échouerait sur un simple `records.length`) ;
- **2 exercices, 3 types chacun (6 lignes) → `titleMany`, count = 2**, pas 6 (le test qui verrouille
  que le compte porte sur les exercices, pas les lignes — c'est le bug B1 trouvé en revue) ;
- 2 `exerciseId` différents, même `exerciseName` → liste avec **un seul** nom, mais `count = 2` ;
- `exerciseName` vide sur l'un des records → absent de `names`, présent dans `count` ;
- 4 exercices → `bodyManyOverflow`, `names` = 3 premiers, `rest` = 1 ;
- 15 records sur 5 exercices → `count: 5`, `rest: 2` (le cas de la spec, maintenant cohérent avec le
  code) ;
- ordre d'entrée non significatif ; tableau d'entrée non muté.

---

### Étape 4 — Notification immédiate + branchement du push (2 h)

**Couche native** — `apps/mobile/src/lib/notifications.ts` :
```ts
export const RECORD_PUSH_PREFIX = 'record-push-';

/**
 * Envoie une notification **immédiatement**, sous un identifiant fourni par l'appelant (pas
 * stable : un push de record veut un identifiant PAR SÉANCE, voir D10).
 * `trigger: { channelId }` est la forme `ChannelAwareTriggerInput` du SDK 57 : pas de
 * planification, mais un routage sur le canal Android (obligatoire, tout passe par
 * `REMINDERS_CHANNEL_ID`). ⚠️ `presentNotificationAsync` n'existe plus en 57.
 *
 * @returns `true` si l'appel natif n'a pas levé — **et seulement dans ce cas** l'appelant doit
 * consommer une unité de quota (D14). `false` en cas d'erreur, jamais de throw.
 */
export async function presentNow(id: string, content: ReminderContent): Promise<boolean> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: content.title, body: content.body },
      trigger: { channelId: REMINDERS_CHANNEL_ID },
    });
    return true;
  } catch {
    return false;
  }
}
```

**Branchement** — `apps/mobile/src/app/workout.tsx`, dans `doFinish` (≈ ligne 442). **La structure
existante est intouchable** : `evaluateWorkoutRecords` reste dans le `try`, `router.replace` reste
**hors** du `try`.
```ts
const doFinish = async () => {
  await finishWorkout(workoutId);
  try {
    const beaten = await evaluateWorkoutRecords(workoutId);
    await maybePushRecords(workoutId, beaten);   // nouveau, best-effort, jamais bloquant
  } catch (error) { console.warn('Échec du calcul des records (ignoré, best-effort) :', error); }
  router.replace({ pathname: '/workout-summary', params: { id: workoutId } });
};
```

`maybePushRecords(workoutId, beaten)` — **fonction de module** dans `notification-repository.ts`,
pas un hook :
1. si `beaten.length === 0` → sortir ;
2. `await getNotificationPrefs()` ; si `!prefs.recordPush` → sortir ;
3. `await ensurePermissionAndChannel()` ; si refusé → sortir **avant toute consommation de quota**
   (c'est le point que B3 a trouvé cassé) ;
4. `await notificationQuotaStore.getState().hydrate()` puis vérifier
   `canScheduleMore(countFor(todayKey), prefs)` ; si non → sortir ;
5. `await getUnitSystem()`, formater chaque valeur, construire les `BeatenRecordSummary`, appeler
   `buildRecordPushContent` ;
6. traduire via `i18n.t(...)` (import direct de `@/i18n`, pas `useTranslation`) ;
7. `const sent = await presentNow(RECORD_PUSH_PREFIX + workoutId, content)` ;
8. **si et seulement si `sent === true`** → `recordSuccess(todayKey)`.

**`localDayKey(new Date())` est correct ici**, et c'est le seul endroit de cette US où il l'est : on
est dans un callback d'événement, jamais mémoïsé par React Compiler (donc jamais dans un bloc
`memo_cache_sentinel`), pas dans un corps de rendu. Le garde-fou `no-frozen-clock` ne le signale pas
parce que `maybePushRecords` n'est **jamais mémoïsée** — pas parce qu'il « ignore les closures ».

**Mock Jest** : `jest.setup.ts` n'expose que `SchedulableTriggerInputTypes: { DATE, WEEKLY }` ;
`trigger: { channelId }` n'introduit pas de nouveau type de trigger à mocker, mais vérifier que
`scheduleNotificationAsync` est appelable sur ce chemin dans les tests existants.

**Tests (Jest)** : `recordPush: false` → aucun envoi ; permission refusée → aucun envoi **et quota
inchangé** ; au plafond → aucun envoi ; `presentNow` renvoyant `false` → quota **non** incrémenté ;
sous le plafond avec succès → 1 envoi + quota incrémenté ; tableau vide → sortie immédiate, aucun
appel aux étapes suivantes.

---

### Étape 5 — Rappel de séance planifiée (2,5 h)

**Apprentissage** — `apps/mobile/src/data/repositories/reminder-habits-repository.ts` (fichier
existant) :
```sql
SELECT started_at AS created_at, started_at   -- utilisé pour dériver logDate = localDayKey(finished_at)
FROM workouts
WHERE deleted_at IS NULL AND finished_at IS NOT NULL AND finished_at >= ?
ORDER BY finished_at
```
⚠️ **C'est `finished_at` qu'on apprend, pas `started_at`** (D12, corrigé en revue) : le p90 des
heures de *début* ferait partir le rappel pendant l'échauffement. La requête sélectionne donc
`finished_at` comme `LogSample.createdAt`, et `logDate = localDayKey(finished_at)` — le filtre
anti-rétroactif de `usableDailyHours` devient un no-op ici (une séance ne se saisit pas
rétroactivement), à documenter dans le fichier pour que personne ne croie plus tard qu'il protège
quelque chose.

Borne = `useWindowStartUtc(LEARNED_HOUR_WINDOW_DAYS)` — réutiliser le hook existant, **pas** la
fonction locale `windowStartUtcFrom` déjà présente dans ce fichier : les deux calculent la même
chose par deux chemins différents, ne pas en ajouter un troisième.

Nouveau hook `useSessionDeadline(prefs)`, sur le modèle exact de `useMealDeadline`.

**Condition « séance muscu planifiée aujourd'hui » (D16)** — requête **dédiée**, nouvelle, dans
`planned-session-repository.ts`. `useHasPlannedSession` ne convient pas : son `WHERE` accepte
`status IN ('planned', 'done')` (donc répond `true` pour une séance déjà faite) et n'a aucun filtre
de pilier (`planned_sessions` est pilier-agnostique par conception, le pilier vit sur
`programs.pillar`).
```ts
export function useHasPlannedStrengthSessionToday(): { hasPlanned: boolean; isLoading: boolean } {
  const todayKey = useTodayKey();
  const { data, isLoading } = useQuery<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM planned_sessions ps
     JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
     JOIN programs p ON p.id = ps.program_id AND p.deleted_at IS NULL
     WHERE ps.owner_id = ? AND ps.deleted_at IS NULL
       AND ps.status = 'planned' AND ps.scheduled_date = ? AND p.pillar = 'strength'`,
    [userId, todayKey],
  );
  return { hasPlanned: (data[0]?.n ?? 0) > 0, isLoading };
}
```
`status = 'planned'` **strictement** porte à lui seul le « pas déjà faite » — inutile d'une seconde
condition.

**Planificateur** — étendre `useProgrammedRemindersScheduler` : le tableau `plan` gagne une
**troisième entrée**, gardée par `hasPlanned`. La structure `for...of` + jeton de génération
l'accueille sans changement.

**Réglages** — `settings.tsx` : une ligne `ProgrammedReminderRows` de plus (composant déjà en place)
+ un switch simple pour `recordPush` (pas de stepper — c'est un push immédiat).

**Prefs** — 3 champs dans `notifications.ts` (`recordPush: true`, `sessionReminder: false`,
`sessionReminderHour: 18`), parse tolérant, invariant DND étendu aux **5** heures, test de
rétrocompatibilité.

---

### Étape 6 — i18n, garde-fou, vérification (1 h)

- 5 clés `settings.notifications.*` + `hint` **modifiée** ; clés `notifications.record.*` (titre au
  pluriel reformulé en « Records battus sur {{count}} exercices ! », voir spec §2.1) +
  `notifications.sessionReminder.*`. **FR et EN**, parité vérifiée par comptage.
- `notification-repository.ts` est **déjà** dans `WATCHED` de
  [no-frozen-clock.test.ts](../../apps/mobile/src/hooks/__tests__/no-frozen-clock.test.ts) — rien à
  ajouter pour ce fichier. `workout.tsx` peut y être ajouté par prudence mais ne protège rien
  (`maybePushRecords` n'est jamais mémoïsée, cf. étape 4).
- `npm run typecheck`, `npm run lint`, `npm run test` — **codes de sortie lus sans pipe**.
- `node scripts/etat.mjs`, puis `/commit`.

## Fichiers touchés — récapitulatif

**Créés (4)**
- `packages/shared/src/record-notification.ts` + test
- `apps/mobile/src/stores/notification-quota-store.ts` + test
- `apps/mobile/src/components/CelebrationCard.tsx` + test
- `design/muscf8-notifications-muscu/muscf8-notifications-muscu.html`

**Modifiés (12)**
- `packages/shared/src/notifications.ts` + test · `index.ts`
- `apps/mobile/src/lib/notifications.ts`
- `apps/mobile/src/data/repositories/settings-repository.ts` (2 accesseurs)
- `apps/mobile/src/data/repositories/notification-repository.ts`
- `apps/mobile/src/data/repositories/reminder-habits-repository.ts`
- `apps/mobile/src/data/repositories/planned-session-repository.ts` (nouvelle requête)
- `apps/mobile/src/app/workout.tsx` · `workout-summary.tsx` · `run/summary.tsx` · `settings.tsx`
- `apps/mobile/src/i18n/locales/fr.json` + `en.json`
- `apps/mobile/jest.setup.ts` (mock `AccessibilityInfo` si absent)

## Risques et parades

| Risque | Parade |
|---|---|
| **Rafale de notifications** sur une première séance | Agrégation en 1 push (D10) + plafond réel (D14). Test dédié à 15 records / 5 exercices. |
| **Le push double l'écran de résumé** | Assumé (D11), opt-out activé par défaut. **Premier essai en recette** : un handler par notification pourrait rendre la décision sans objet — à tester avant de considérer D11 comme définitive. |
| **Régression sur `doFinish`** (code livré, chemin critique) | `router.replace` reste **hors** du `try`. Test : `presentNow` qui renvoie `false` ne doit pas empêcher la navigation. |
| **Régression sur le résumé de course** en extrayant le conteneur | Confirmé en revue : `ShareCard` capture son propre `cardRef`, aucune dépendance à la position du banner. |
| **Rappel de séance sur une course planifiée** | Requête dédiée avec `p.pillar = 'strength'` (D16) — `useHasPlannedSession` était impropre à cet usage. |
| **Rappel parti pendant l'échauffement** | Apprentissage sur `finished_at`, pas `started_at` (D12, corrigé en revue). |
| **Quota consommé sur des envois qui ont échoué** | `presentNow` retourne un booléen ; `recordSuccess` n'est appelé que sur `true` ; permission vérifiée **avant** toute consommation (D14). |
| **Le hint corrigé deux fois en un jour** | Signalé comme tel dans la spec : candidat à une reformulation qualitative plutôt que chiffrée. |

## Estimation

| Étape | Charge |
|---|---|
| 1 — animation (conteneur + a11y) | 1,5 h |
| 2 — accesseurs hors-hook + plafond | 1,5 h |
| 3 — contenu du push (pur + tests) | 2 h |
| 4 — notification immédiate + branchement | 2 h |
| 5 — rappel de séance | 2,5 h |
| 6 — i18n, garde-fou, vérification | 1 h |
| **Total** | **≈ 10,5 h** |

La roadmap estimait 2 h + 1 h + 3 h = 6 h. L'écart tient à l'agrégation, au plafond (dette de D3
soldée ici), au recadrage de 2.4 en échéance apprise, et aux deux accesseurs hors-hook qui
manquaient. La relecture critique a ajouté ~2 h par rapport à la première version du plan — presque
tout sur l'étape 5 (requête dédiée) et l'étape 4 (contrat booléen).

**Point de coupe propre** : l'étape 1 seule (**1,5 h**) livre l'animation, c'est-à-dire la moitié la
moins contestable de 3.42, sans toucher aux notifications. Si le push de record déplaît en recette
(D11), c'est ce qui reste.
