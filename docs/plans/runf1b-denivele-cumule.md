# Plan — RUN-F1b · Dénivelé cumulé (roadmap 5.32)

Spec : [runf1b-denivele-cumule.md](../specs/functional/us/runf1b-denivele-cumule.md) ·
branche `feature/runf1b-denivele-cumule` · roadmap **5.32**.

⚠️ **Zone la plus sensible du projet** (tâche de fond GPS). Chaque étape ci-dessous précise
explicitement ce qui NE change PAS, pour limiter le rayon d'effet.

## Étape 1 — Migration + schéma local *(≈ 20 min)*

`npm run db:new runf1b_elevation` puis :

```sql
alter table public.runs
  add column elevation_gain_m numeric,
  add column elevation_loss_m numeric;
```

`npm run db:push:dry` → `npm run db:push` → `npm run db:types` → cocher dans
`supabase/MIGRATIONS.md`. **Aucune sync rule à redéployer** : `docs/specs/technical/powersync-sync-rules.yaml`
a déjà `select * from runs` (wildcard, vérifié) — les nouvelles colonnes sont couvertes
automatiquement dès que le schéma local les déclare (étape suivante).

`apps/mobile/src/powersync/schema.ts`, table `runs` :

```ts
const runs = new Table({
  ...
  terrain: column.text,
  // US RUN-F1b (5.32) : scalaires cumulés en direct par le tracker, comme distance_m/
  // duration_seconds — jamais recalculés depuis gps_track. `null` = donnée absente (course
  // manuelle, ou course enregistrée avant cette US), jamais 0 (spec R5/§0).
  elevation_gain_m: column.real,
  elevation_loss_m: column.real,
  created_at: column.text,
  ...
});
```

## Étape 2 — Le tracker, testé d'abord *(≈ 2 h — étape la plus délicate)*

`apps/mobile/src/running/tracker-task.ts` :

**a) `TrackerState`** gagne 4 champs (2 flushés, 2 internes) :

```ts
export interface TrackerState {
  ...
  cumulativeDistanceM: number;
  /** US RUN-F1b : cumuls dénivelé, mêmes garanties que cumulativeDistanceM (source de vérité). */
  cumulativeElevationGainM: number;
  cumulativeElevationLossM: number;
  /** Solde d'altitude en attente de validation par le seuil de bruit (spec R3), jamais flushé. */
  pendingElevationDeltaM: number;
  /** Dernière altitude connue (spec R2/R4) — suit exactement le sort de lastPoint/lastPointT. */
  lastAltitudeM: number | null;
  ...
}
```

`initialTrackerState()` : les 4 nouveaux champs à `0`/`0`/`0`/`null`.

**b) Appariement point↔altitude (spec R1 bis) — remplace `toGpsPoints`.** Type interne (pas
`GpsPoint`, qui reste `{lat,lng,t}` — §0 de la spec) :

```ts
interface GpsPointWithAltitude {
  point: GpsPoint;
  /** null = absente, OU altitudeAccuracy > ALTITUDE_ACCURACY_MAX_M (spec R1). */
  altitudeM: number | null;
}

const ALTITUDE_ACCURACY_MAX_M = 30; // spec R7 — à ajuster après recette terrain

function toGpsPointsWithAltitude(
  locations: LocationObject[],
  startedAtMs: number,
): GpsPointWithAltitude[] {
  const result: GpsPointWithAltitude[] = [];
  for (const loc of locations) {
    if (!isValidFix({ lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy })) {
      continue; // inchangé — un fix horizontalement invalide n'entre nulle part, altitude comprise
    }
    const { altitude, altitudeAccuracy } = loc.coords;
    const altitudeM =
      altitude != null && (altitudeAccuracy == null || altitudeAccuracy <= ALTITUDE_ACCURACY_MAX_M)
        ? altitude
        : null;
    result.push({
      point: { lat: loc.coords.latitude, lng: loc.coords.longitude, t: (loc.timestamp - startedAtMs) / 1000 },
      altitudeM,
    });
  }
  return result;
}
```

Une seule boucle, un seul filtre de validité horizontale — l'altitude est un champ de plus sur la
**même** structure, jamais une seconde passe (spec R1 bis, point relevé en relecture).

**c) `handleLocationBatch`** — boucle existante étendue (pas réécrite) :

```ts
const ELEVATION_NOISE_THRESHOLD_M = 3; // spec R3/R7 — à ajuster après recette terrain

export function handleLocationBatch(locations: LocationObject[]): Promise<void> {
  const s = trackerState;
  if (s.runId === null || locations.length === 0) return Promise.resolve();

  const withAltitude = toGpsPointsWithAltitude(locations, s.startedAtMs);
  const kept: GpsPoint[] = [];

  for (const { point: p, altitudeM } of withAltitude) {
    if (s.autoPause) evaluateAutoPause(p);

    if (s.paused) {
      s.lastPoint = p;
      s.lastPointT = p.t;
      s.lastAltitudeM = altitudeM ?? s.lastAltitudeM; // spec R2/R4 : suit lastPoint, jamais écrasé par un null
      continue;
    }

    if (s.lastPoint !== null && s.lastPointT !== null) {
      const dt = p.t - s.lastPointT;
      if (dt > 0) {
        const dist = haversineMeters(s.lastPoint, p);
        const speed = dist / dt;
        if (speed <= MAX_PLAUSIBLE_SPEED_MS) {
          s.cumulativeDistanceM += dist;
          s.netDurationS += dt;
          // Dénivelé : accumulé UNIQUEMENT sur un segment déjà jugé fiable pour la distance (R2).
          if (altitudeM != null && s.lastAltitudeM != null) {
            s.pendingElevationDeltaM += altitudeM - s.lastAltitudeM;
            if (s.pendingElevationDeltaM >= ELEVATION_NOISE_THRESHOLD_M) {
              s.cumulativeElevationGainM += s.pendingElevationDeltaM;
              s.pendingElevationDeltaM = 0;
            } else if (s.pendingElevationDeltaM <= -ELEVATION_NOISE_THRESHOLD_M) {
              s.cumulativeElevationLossM += -s.pendingElevationDeltaM;
              s.pendingElevationDeltaM = 0;
            }
          }
        }
      }
    }

    s.lastPoint = p;
    s.lastPointT = p.t;
    s.lastAltitudeM = altitudeM ?? s.lastAltitudeM; // même règle que lastPoint : mise à jour même si le segment a été rejeté (R2)
    kept.push(p);
  }

  if (kept.length === 0) return Promise.resolve();

  const segmentEncoded = encodeSegment(kept); // INCHANGÉ — kept ne contient toujours que {lat,lng,t}
  const p = flushTrack(s.runId, {
    segmentEncoded,
    distanceM: s.cumulativeDistanceM,
    durationSeconds: Math.round(s.netDurationS),
    elevationGainM: Math.round(s.cumulativeElevationGainM),
    elevationLossM: Math.round(s.cumulativeElevationLossM),
  });
  setLastFlushPromise(p.catch(() => {}));
  return p;
}
```

**Tests, écrits d'abord** (`tracker-task.test.ts`, aux côtés des tests auto-pause existants) :
- Montée régulière d'altitude au-delà du seuil (ex. +5 m sur un segment) → `cumulativeElevationGainM`
  augmente de 5, `pendingElevationDeltaM` retombe à 0.
- Bruit sous le seuil (ex. +1 m puis −1 m sur deux segments successifs) → **aucun** cumul, le solde
  oscille mais ne franchit jamais 3 m (le test qui vérifie R3 concrètement, pas seulement en théorie).
- `altitude: null` sur un point → aucun crash, aucun cumul dénivelé, distance/durée inchangées
  (non-régression explicite).
- `altitudeAccuracy: 50` (> 30) → traité comme absent, même effet que `altitude: null`.
- Segment rejeté par le filtre vitesse (glitch) → `lastAltitudeM` est quand même mis à jour (comme
  `lastPoint`), le test vérifie ce comportement exact, contre-intuitif mais volontaire (spec R2).
- Pause puis reprise avec une altitude différente au moment de la reprise → aucun gain/perte compté
  pendant la pause, la reprise repart de la nouvelle base sans saut (spec R4).

## Étape 3 — Repository + agrégation par période *(≈ 1 h)*

**a) `run-repository.ts`** :
- `FlushInput` gagne `elevationGainM: number; elevationLossM: number` (pas optionnels — le tracker
  les fournit toujours, initialisés à 0 comme `cumulativeDistanceM`).
- `flushTrack` : `patch` inclut `elevation_gain_m: input.elevationGainM, elevation_loss_m: input.elevationLossM`.
- `RunHistoryItem`/`RunDetail` gagnent `elevationGainM: number | null; elevationLossM: number | null`
  (nullable ici — contrairement à `FlushInput`, une ligne lue peut être une ancienne course, spec §0).
- `RunHistoryDbRow`/`RunDetailDbRow` + `SELECT_HISTORY`/`SELECT_RUN_DETAIL` : colonnes ajoutées,
  mapping snake→camel ajouté.
- `toStatRun` (mapping vers `StatRun`, §3 spec) : ajoute `elevationGainM: item.elevationGainM,
  elevationLossM: item.elevationLossM`.

**b) `packages/shared/src/run-stats.ts`** :

```ts
export interface StatRun {
  finishedAtDayKey: string;
  distanceM: number | null;
  durationS: number | null;
  paceSPerKm: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
}
export interface RunStats {
  totalDistanceM: number;
  totalDurationS: number;
  count: number;
  totalElevationGainM: number;
  totalElevationLossM: number;
}
```

Dans `aggregateRunStats`, à côté des accumulateurs existants :
```ts
let totalElevationGainM = 0, totalElevationLossM = 0;
...
totalElevationGainM += r.elevationGainM ?? 0;
totalElevationLossM += r.elevationLossM ?? 0;
...
return { totalDistanceM, totalDurationS, count, totalElevationGainM, totalElevationLossM };
```

**Tests à corriger** (`run-stats.test.ts`) : les 4 `toEqual({...})` existants gagnent
`totalElevationGainM`/`totalElevationLossM` dans l'objet attendu (relevé en relecture de spec — pas
une régression à découvrir après coup). **Tests neufs** : période avec un mélange courses
avec/sans dénivelé connu → la somme ignore proprement les `null` (spec R6).

## Étape 4 — Affichage *(≈ 1 h)*

- `apps/mobile/src/app/run/summary.tsx` : ligne « Dénivelé + / − » à côté de distance/durée,
  **montée conditionnellement** (`elevationGainM != null`) — absente sur une course manuelle ou
  antérieure à cette US (spec R5/critère 4-5), jamais un « 0 m » affiché à sa place.
- `apps/mobile/src/app/running-history/index.tsx` (`StatsSection`) : le bloc stats période
  (semaine/mois/depuis le début, déjà alimenté par `useRunStatsAt`) gagne le dénivelé cumulé de la
  période, à côté de distance/durée/nombre de sorties.
- i18n `running.elevation.*` (3 clés, spec §4), FR + EN.

## Étape 5 — Solde *(≈ 20 min)*

Roadmap **5.32 → ✅**. CHANGELOG + `etat.mjs` via `/commit`. BACKLOG.md : retirer la ligne RUN-F1b
(⛔ bloquée) de la table Running — le blocage est levé, l'US a désormais une spec.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `supabase/migrations/<horodatage>_runf1b_elevation.sql` (+ `MIGRATIONS.md`) | 2 colonnes nullable |
| `apps/mobile/src/powersync/schema.ts` | table `runs` étendue |
| `apps/mobile/src/running/tracker-task.ts` (+ `__tests__/tracker-task.test.ts`) | `TrackerState`, `toGpsPointsWithAltitude`, `handleLocationBatch` |
| `apps/mobile/src/data/repositories/run-repository.ts` | `FlushInput`, `RunHistoryItem`, `RunDetail`, requêtes |
| `packages/shared/src/run-stats.ts` (+ `.test.ts`) | `StatRun`, `RunStats`, `aggregateRunStats` |
| `apps/mobile/src/app/run/summary.tsx` | ligne dénivelé par sortie |
| `apps/mobile/src/app/running-history/index.tsx` | dénivelé dans `StatsSection` |
| `apps/mobile/src/i18n/locales/{fr,en}.json` | `running.elevation.*` (3 clés) |

## Migration / sync rules

**1 migration** (2 colonnes nullable, `runs`). **Aucune sync rule à redéployer** (wildcard `select *`
déjà en place, vérifié en relecture de spec).

## Dépendances

Aucun paquet nouveau (`expo-location` expose déjà `altitude`/`altitudeAccuracy`) → **recettable sur
l'APK existant**, pas de nouveau dev build requis pour ce point précis. ⚠️ Contrairement à
MUSC-F9/`expo-haptics`, ceci n'ajoute aucune dépendance native.

## Risques

- 🔴 **Tâche de fond** : toute erreur dans `handleLocationBatch` peut interrompre silencieusement le
  suivi (le `try/catch` de la tâche avale déjà les exceptions, spec/docstring existants) — la
  discipline « étendre la boucle existante, ne pas la réécrire » (étape 2c) minimise ce risque, mais
  **la recette terrain (spec R7, critères 1-3) reste non négociable avant de considérer ceci fiable**,
  exactement comme R1 l'a exigé en son temps (`docs/running-r1-test-terrain.md`).
- 🟠 **Alignement point↔altitude** (relevé en relecture de spec) : le risque n'est pas un crash mais
  une désynchronisation silencieuse — d'où l'appariement dans une seule boucle (étape 2b), pas deux
  passages séparés. Test dédié à ne pas retirer.
- 🟠 **Seuils non validés terrain** (30 m accuracy, 3 m bruit — spec R7) : posés par analogie, pas
  mesurés sur cette stack. À traiter comme des paramètres à ajuster après la première sortie réelle
  de recette, pas des constantes gravées.
- 🟢 **Aucun risque sur le codec de trace, les records d'allure, les splits, l'export GPX, le
  partage** : `GpsPoint`/`encodeSegment`/`decodeTrack` ne changent pas (spec §0) — zéro ricochet sur
  ces fonctions.
- 🟢 **Aucun risque de régression sur `distance_m`/`duration_seconds`** : la boucle existante n'est
  qu'étendue, jamais restructurée ; les branches de calcul distance/durée gardent leur code exact.
