# Plan — RUN-F2a · Annonces audio périodiques (roadmap 5.19)

Spec : [runf2a-annonces-audio.md](../specs/functional/us/runf2a-annonces-audio.md) ·
branche `feature/runf2a-annonces-audio` · roadmap **5.19**.

## Étape 0 — Dépendance native *(≈ 15 min)*

```
cd apps/mobile && npx expo install expo-speech
```

⚠️ **Dépendance native neuve** (comme `expo-haptics`/MUSC-F9) → **nouveau dev build EAS requis**
avant toute recette device (`npm run build:dev`). Non recettable sur l'APK existant.

Mock Jest (`apps/mobile/jest.setup.ts`, même patron que `expo-notifications`) :
```ts
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));
```

## Étape 1 — La fonction pure, testée d'abord *(≈ 20 min)*

`packages/shared/src/running.ts` (même fichier que `haversineMeters`/`totalDistance`) :

```ts
/**
 * Prochain seuil d'annonce franchi (US RUN-F2a), ou `null` si aucun nouveau seuil depuis
 * `lastAnnouncedIndex`. Ne connaît aucune notion de temps/audio — l'appelant décide de la
 * distance déjà connue (spec R2) et déclenche l'effet de bord (Speech.speak).
 */
export function nextAnnouncementThreshold(
  distanceM: number,
  intervalM: number,
  lastAnnouncedIndex: number,
): { index: number; thresholdM: number } | null {
  if (intervalM <= 0) return null;
  const currentIndex = Math.floor(distanceM / intervalM);
  if (currentIndex <= lastAnnouncedIndex) return null;
  return { index: currentIndex, thresholdM: currentIndex * intervalM };
}
```

**Tests, écrits d'abord** :
- `distanceM=2500, intervalM=1000, lastAnnouncedIndex=1` → `{ index: 2, thresholdM: 2000 }`.
- Même distance rejouée (`lastAnnouncedIndex=2`) → `null` (jamais deux fois le même seuil, spec R2).
- `distanceM=1400, intervalM=500, lastAnnouncedIndex=1` → `{ index: 2, thresholdM: 1000 }` (seuil
  de 500 m franchi une seconde fois : 1000 m).
- Saut de plusieurs seuils d'un coup (ex. `distanceM=3200, intervalM=1000, lastAnnouncedIndex=0`) →
  annonce **seulement le dernier** (`index: 3`), pas un rattrapage des seuils intermédiaires —
  comportement assumé, à documenter dans le test (aucune queue d'annonces en retard).
- `intervalM <= 0` → `null` (garde-fou).

## Étape 2 — Réglage utilisateur (`running_profiles`) *(≈ 45 min)*

Migration (`npm run db:new runf2a_voice_announcements`) :
```sql
alter table public.running_profiles
  add column voice_announcements_enabled boolean not null default false,
  add column voice_announcement_interval_m integer not null default 1000;
```
`db:push:dry` → `db:push` → `db:types` → cocher `MIGRATIONS.md`. **Aucune sync rule à
redéployer** (à vérifier que `running_profiles` est bien en `select *`, comme `runs`).

`apps/mobile/src/powersync/schema.ts`, table `running_profiles` : 2 colonnes
(`column.integer` pour le booléen SQLite-style comme ailleurs dans le projet, `column.integer`
pour l'intervalle).

`apps/mobile/src/data/repositories/running-profile-repository.ts` :
- `RunnerProfile`/`RunnerProfileInput` gagnent `voiceAnnouncementsEnabled: boolean` et
  `voiceAnnouncementIntervalM: number`.
- Mapping snake↔camel dans `useRunnerProfile`/`upsertRunnerProfile`, même patron que
  `ref5kPaceSPerKm`/`weeklyFrequency` (colonnes scalaires, pas de JSON).

`apps/mobile/src/app/running-profile.tsx` :
- Un `Switch` (RN, même patron que `CycleTrackingSection.tsx`) — `announcementsToggle`.
- Un choix d'intervalle (500 m / 1 km / 2 km), affiché **seulement si le switch est activé** —
  probablement un `Segment` (déjà utilisé pour les toggles à choix multiples ailleurs, ex.
  `PERIOD_OPTIONS`).

## Étape 3 — Composition de la phrase (i18n) *(≈ 30 min)*

`apps/mobile/src/running/announcements.ts` (nouveau fichier, mobile — dépend de `i18next`, donc
hors `packages/shared`) :

```ts
export function buildAnnouncementPhrase(
  t: TFunction,
  thresholdM: number,
  elapsedSeconds: number,
  avgPaceSPerKm: number | null,
  units: Units,
): string {
  const distancePart =
    thresholdM % 1000 === 0
      ? t('running.announcement.distanceKm', { count: thresholdM / 1000 })
      : t('running.announcement.distanceM', { count: thresholdM });
  const minutes = Math.round(elapsedSeconds / 60);
  const timePart = t('running.announcement.minutes', { count: minutes });
  const pacePart = t('running.announcement.pacePart', { pace: units.formatPace(avgPaceSPerKm) });
  return t('running.announcement.template', { distance: distancePart, time: timePart, pace: pacePart });
}
```

i18n (`running.announcement.*`, spec §4) : `distanceKm_one`/`distanceKm_other`,
`distanceM_other`, `minutes_one`/`minutes_other`, `pacePart`, `template` — FR + EN.

## Étape 4 — Le hook + câblage dans `run/active.tsx` *(≈ 45 min)*

Même fichier `announcements.ts` :

```ts
export function useDistanceAnnouncements(input: {
  enabled: boolean;
  intervalM: number;
  distanceM: number;
  elapsedSeconds: number;
  avgPaceSPerKm: number | null;
}): void {
  const { t } = useTranslation();
  const units = useUnits();
  // Initialisé depuis la distance courante (pas 0) au premier rendu — spec R2 : rouvrir l'écran
  // via "Reprendre" après avoir changé d'onglet ne doit pas rattraper les seuils déjà passés.
  const lastAnnouncedIndexRef = useRef<number | null>(null);
  if (lastAnnouncedIndexRef.current === null) {
    lastAnnouncedIndexRef.current = Math.floor(input.distanceM / Math.max(input.intervalM, 1));
  }

  useEffect(() => {
    if (!input.enabled) return;
    const next = nextAnnouncementThreshold(
      input.distanceM,
      input.intervalM,
      lastAnnouncedIndexRef.current ?? 0,
    );
    if (!next) return;
    lastAnnouncedIndexRef.current = next.index;
    Speech.speak(buildAnnouncementPhrase(t, next.thresholdM, input.elapsedSeconds, input.avgPaceSPerKm, units));
  }, [input.enabled, input.distanceM, input.intervalM]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

Câblage dans `apps/mobile/src/app/run/active.tsx` :
```ts
const { profile } = useRunnerProfile();
useDistanceAnnouncements({
  enabled: isGps && profile?.voiceAnnouncementsEnabled === true, // spec R4 : GPS uniquement
  intervalM: profile?.voiceAnnouncementIntervalM ?? 1000,
  distanceM,
  elapsedSeconds,
  avgPaceSPerKm: avgPaceValue,
});
```
Hook appelé **inconditionnellement** (règle des hooks) — le gating (`enabled`) est interne au hook,
comme les autres hooks conditionnels du projet (`useTrainingLoadAlert`, etc.).

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `apps/mobile/package.json` | + `expo-speech` |
| `apps/mobile/jest.setup.ts` | mock `expo-speech` |
| `supabase/migrations/<horodatage>_runf2a_voice_announcements.sql` (+ `MIGRATIONS.md`) | 2 colonnes `running_profiles` |
| `apps/mobile/src/powersync/schema.ts` | table `running_profiles` étendue |
| `apps/mobile/src/data/repositories/running-profile-repository.ts` | `RunnerProfile`/`RunnerProfileInput` étendus |
| `apps/mobile/src/app/running-profile.tsx` | réglage (`Switch` + intervalle) |
| `packages/shared/src/running.ts` (+ `.test.ts`) | `nextAnnouncementThreshold` |
| `apps/mobile/src/running/announcements.ts` (nouveau) | `buildAnnouncementPhrase`, `useDistanceAnnouncements` |
| `apps/mobile/src/app/run/active.tsx` | câblage du hook |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `running.announcement.*` (6 clés + pluriels) |

## Migration / sync rules

**1 migration** (2 colonnes `running_profiles`, additives). Vérifier que la sync rule existante pour
`running_profiles` est bien `select *` avant de conclure qu'aucun redéploiement n'est nécessaire
(à confirmer à l'étape 2, pas supposé).

## Dépendances

**`expo-speech` neuf → nouveau dev build EAS requis** pour la recette (non recettable sur l'APK
existant).

## Risques

- 🟠 **Limite déjà documentée en spec (§1)** : aucune annonce si `run/active.tsx` n'est pas monté
  (changement d'onglet, verrouillage) — comportement assumé, pas un bug à corriger dans ce plan.
- 🟢 **Aucun risque sur le tracker/la tâche de fond** : le hook est monté côté écran React, aucune
  modification de `tracker-task.ts`/`tracker.ts`/le codec de trace.
- 🟠 **Pluriels i18next** (spec R3) : tester explicitement le cas `count: 1` (1 kilomètre, 1 minute)
  en plus du cas général — c'est l'erreur la plus facile à laisser passer inaperçue en dev (on teste
  souvent avec des distances rondes qui tombent rarement sur exactement 1).
- 🟢 **Aucun risque de ricochet** sur les écrans existants : `running_profiles` gagne 2 colonnes à
  valeur par défaut, aucun champ existant n'est modifié.
