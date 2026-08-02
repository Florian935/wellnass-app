# Plan — RUN-F2b · Prolonger ou raccourcir — cible en direct (roadmap 5.23)

Spec : [runf2b-cible-en-direct.md](../specs/functional/us/runf2b-cible-en-direct.md) ·
branche `feature/runf2b-cible-en-direct` · roadmap **5.23**.

## Étape 1 — Exposer `plannedSessionId` sur `ActiveRun` *(≈ 15 min)*

`apps/mobile/src/data/repositories/run-repository.ts` :

```ts
export type ActiveRun = {
  id: string;
  source: RunSource;
  startedAt: string;
  distanceM: number | null;
  durationSeconds: number | null;
  gpsTrack: string | null;
  /** US RUN-F2b : occurrence planifiée d'origine, `null` pour une course libre. */
  plannedSessionId: string | null;
};

type ActiveRunDbRow = {
  id: string;
  source: string;
  started_at: string;
  duration_seconds: number | null;
  distance_m: number | null;
  gps_track: string | null;
  planned_session_id: string | null;
};

const SELECT_ACTIVE_RUN = `
  SELECT id, source, started_at, duration_seconds, distance_m, gps_track, planned_session_id
  FROM runs
  WHERE status = 'active' AND deleted_at IS NULL
  LIMIT 1
`;
```

`rowToActiveRun` : `plannedSessionId: row.planned_session_id`. Aucune migration (colonne déjà en
base depuis RUN-F3), aucun test dédié nécessaire (mapping trivial, même patron que
`RunDetailDbRow`/`rowToRunDetail` déjà couvert).

## Étape 2 — La carte objectif dans `run/active.tsx` *(≈ 45 min)*

Imports supplémentaires : `useRunTarget` (déjà exporté par `run-repository.ts`), `compareToTarget`
(`@wellness/shared`), `Card`/`StatRow`-équivalent (réutiliser les composants déjà importés par
`summary.tsx` si `active.tsx` ne les a pas encore — vérifier à l'implémentation).

```ts
const target = useRunTarget(active?.plannedSessionId ?? null);
const comparison = useMemo(
  () =>
    compareToTarget(
      {
        distanceM: isGps ? distanceM : null,
        // R1 bis : jamais elapsedSeconds en repli pour cet axe (inclurait les pauses).
        durationS: active?.durationSeconds ?? null,
      },
      {
        targetDistanceM: target?.targetDistanceM ?? null,
        targetDurationS: target?.targetDurationSeconds ?? null,
      },
    ),
  [isGps, distanceM, active?.durationSeconds, target],
);

const distanceTargetLabel = comparison.distance
  ? t(`running.target.distance${comparison.distance.status === 'reached' ? 'Reached' : comparison.distance.status === 'over' ? 'Over' : 'Under'}`, {
      done: units.formatDistance(comparison.distance.doneValue / 1000),
      target: units.formatDistance(comparison.distance.targetValue / 1000),
      diff: units.formatDistance(Math.abs(comparison.distance.diff) / 1000),
    })
  : null;
const durationTargetLabel = comparison.duration
  ? t(`running.target.duration${comparison.duration.status === 'reached' ? 'Reached' : comparison.duration.status === 'over' ? 'Over' : 'Under'}`, {
      done: formatDuration(comparison.duration.doneValue),
      target: formatDuration(comparison.duration.targetValue),
      diff: formatDuration(Math.abs(comparison.duration.diff)),
    })
  : null;
const hasTarget = distanceTargetLabel !== null || durationTargetLabel !== null;
```

**Duplication volontaire avec `summary.tsx`** (spec périmètre) : même logique de construction de
libellé, copiée plutôt que partagée — RUN-F3 (dont `summary.tsx` fait partie) est encore en recette,
un refactor à cheval sur les deux écrans ajouterait un risque de régression sur du code pas encore
validé par un humain pour gagner ~15 lignes. Un futur nettoyage (post-clôture RUN-F3) pourra
factoriser `distanceTargetLabel`/`durationTargetLabel` dans un helper partagé
(`apps/mobile/src/running/target-labels.ts` ou similaire) réutilisé par les deux écrans.

Rendu — nouvelle `Card` sous la section `paces` (avant la carte cartographique), montée seulement
si `hasTarget` :
```tsx
{hasTarget ? (
  <Card>
    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('running.target.title')}</Text>
    {distanceTargetLabel ? (
      <Text style={[styles.targetText, { color: comparison.distance!.status === 'under' ? colors.textMuted : colors.success }]}>
        {distanceTargetLabel}
      </Text>
    ) : null}
    {durationTargetLabel ? (
      <Text style={[styles.targetText, { color: comparison.duration!.status === 'under' ? colors.textMuted : colors.success }]}>
        {durationTargetLabel}
      </Text>
    ) : null}
  </Card>
) : null}
```
Couleurs : même règle que `summary.tsx` (R4) — `under` en `textMuted`, `reached`/`over` en
`success`, jamais une teinte d'alerte.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `apps/mobile/src/data/repositories/run-repository.ts` | `ActiveRun`/`ActiveRunDbRow`/`SELECT_ACTIVE_RUN`/`rowToActiveRun` étendus |
| `apps/mobile/src/app/run/active.tsx` | carte objectif, calcul de comparaison live |

**Aucun fichier i18n touché** (spec R2, clés `running.target.*` déjà là). **Aucun fichier
`packages/shared` touché** (spec R1, `compareToTarget` déjà générique).

## Migration / sync rules

**Aucune.** `runs.planned_session_id` existe déjà en base et est déjà synchronisé.

## Dépendances

Aucun paquet nouveau → **recettable sur l'APK existant** (contrairement à RUN-F2a).

## Risques

- 🟢 **Aucun risque sur le tracker/la tâche de fond** : lecture seule, aucune modification de
  `tracker-task.ts`/`tracker.ts`.
- 🟢 **Aucun risque sur `compareToTarget`/RUN-F3** : fonction non modifiée, seulement un nouveau
  point d'appel.
- 🟠 **R1 bis à ne pas oublier en implémentation** : le piège relevé en relecture de spec (repli
  `elapsedSeconds` incluant les pauses) est facile à réintroduire par erreur si on copie la
  variable `durationForPace` existante (qui, elle, a ce repli intentionnellement pour l'affichage
  du chrono) au lieu d'utiliser `active?.durationSeconds` directement pour la comparaison.
