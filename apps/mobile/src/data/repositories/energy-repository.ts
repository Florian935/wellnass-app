/**
 * Repository de la **dépense énergétique** (US DEPENSE-01 / DEPENSE-02 / DEPENSE-00).
 *
 * Il ne calcule rien lui-même : tout le moteur est dans `@wellness/shared` (`energy.ts`), pur et
 * testé. Ici on assemble — profil, poids à la date, séances, courses et activités d'une journée.
 *
 * ── 🔴 Le poids retenu est celui de la DATE, pas le dernier connu ────────────────────────────────
 * Constat C6 de l'analyse : jusqu'ici la dépense des courses passées était recalculée avec la
 * dernière pesée. Quelqu'un qui perd 6 kg voyait ses sorties d'il y a deux mois réévaluées, et son
 * adhérence calorique passée changer après coup. `weightAtDate` répare ça pour les trois sources.
 *
 * ── Ce que la cible retient (décision D2) ────────────────────────────────────────────────────────
 * `sumEnergyForTarget` additionne les **bas de fourchette**, jamais les estimations centrales. Le
 * chiffre montré à l'utilisateur reste l'estimation centrale : deux nombres différents, deux rôles
 * différents, et c'est volontaire.
 */

import { useMemo } from 'react';

import { useQuery } from '@powersync/react';
import {
  computeAge,
  estimateActivityEnergy,
  estimateRunEnergy,
  estimateStrengthEnergy,
  localDayKey,
  restingMetabolism,
  sumEnergyForTarget,
  weightAtDate,
  type Activity,
  type EnergyEstimate,
  type RestingMetabolism,
} from '@wellness/shared';

import { useActivities } from './activity-repository';
import { useWeightEntries } from './bodyweight-repository';
import { useProfile } from './profile-repository';

// ---------------------------------------------------------------------------
// Métabolisme de repos
// ---------------------------------------------------------------------------

/**
 * Le métabolisme de repos horaire **tel qu'il était à `dayKey`** (le poids change, pas la taille).
 *
 * Rend `null` sans poids du tout : aucune valeur neutre n'existe, et l'écran affiche le remède
 * (« ajoute ton poids ») plutôt qu'un chiffre inventé.
 */
export function useRestingMetabolismAt(dayKey: string): {
  resting: RestingMetabolism | null;
  weightKg: number | null;
  isLoading: boolean;
} {
  const { profile, isLoading: profileLoading } = useProfile();
  const { entries, isLoading: weightLoading } = useWeightEntries();

  // Valeurs extraites AVANT les mémos : le compilateur React refuse une dépendance en
  // `profile?.x` dont le corps lit `profile.x` — deux expressions différentes à ses yeux.
  const sex = profile?.sex ?? null;
  const heightCm = profile?.heightCm ?? null;
  const birthDate = profile?.birthDate ?? null;
  const profileWeightKg = profile?.weightKg ?? null;

  const weightKg = useMemo(
    () => weightAtDate(entries, dayKey) ?? profileWeightKg,
    [entries, dayKey, profileWeightKg],
  );

  const resting = useMemo(
    () =>
      restingMetabolism({
        sex,
        weightKg,
        heightCm,
        age: birthDate ? computeAge(new Date(birthDate)) : null,
      }),
    [sex, heightCm, birthDate, weightKg],
  );

  return { resting, weightKg, isLoading: profileLoading || weightLoading };
}

// ---------------------------------------------------------------------------
// La journée
// ---------------------------------------------------------------------------

/** Une ligne de la journée en énergie : d'où vient la dépense, et combien. */
export type DayEnergyItem = {
  id: string;
  kind: 'strength' | 'run' | 'activity';
  /** Clé du catalogue pour une activité ; `null` pour une séance ou une course. */
  activityType: string | null;
  /** Titre libre d'une séance de muscu (`null` = séance sans nom). */
  title: string | null;
  startedAt: string;
  durationSeconds: number | null;
  estimate: EnergyEstimate;
};

type WorkoutRow = {
  id: string;
  started_at: string;
  finished_at: string;
  duration_seconds: number | null;
  rpe: number | null;
  total_sets: number;
};

type RunRow = {
  id: string;
  finished_at: string;
  distance_m: number | null;
  duration_seconds: number | null;
  elevation_gain_m: number | null;
  rpe: number | null;
};

/**
 * Séances terminées, avec leur **nombre total de séries** (échauffements compris : ils coûtent du
 * temps et de l'énergie, même s'ils sont exclus du volume).
 *
 * Les séries non validées sont écartées : une séance interrompue garde ses séries prévues, et les
 * compter ferait payer un travail qui n'a pas eu lieu.
 */
const SELECT_WORKOUTS = `
  SELECT w.id, w.started_at, w.finished_at, w.duration_seconds, w.rpe,
         COUNT(s.id) AS total_sets
  FROM workouts w
  LEFT JOIN workout_sets s ON s.workout_id = w.id AND s.deleted_at IS NULL AND s.done = 1
  WHERE w.deleted_at IS NULL AND w.status = 'completed' AND w.finished_at IS NOT NULL
  GROUP BY w.id
  ORDER BY w.finished_at DESC
`;

const SELECT_RUNS = `
  SELECT id, finished_at, distance_m, duration_seconds, elevation_gain_m, rpe
  FROM runs
  WHERE deleted_at IS NULL AND finished_at IS NOT NULL
  ORDER BY finished_at DESC
`;

/**
 * La dépense de **chaque** journée, source par source, indexée par clé de jour locale.
 *
 * Un seul hook pour les deux usages (la journée affichée, et l'adhérence rétroactive sur 7/30 j) :
 * deux calculs séparés divergeraient au premier ajustement, et la carte « Ta journée en énergie »
 * ne justifierait plus la cible qu'elle prétend expliquer.
 *
 * 🔴 Le rattachement au jour se fait sur la **clé locale** de `finished_at` / `started_at`, comme
 * partout ailleurs (`useDayCalorieTarget`, la série) : une séance finie à 23 h 30 appartient à ce
 * jour-là. Filtrer en SQL sur une colonne UTC déplacerait des séances d'un jour à l'autre selon le
 * fuseau.
 *
 * 🔴 Le métabolisme de repos est recalculé **pour chaque jour** avec le poids de ce jour-là
 * (constat C6) — pas une seule fois avec la dernière pesée.
 */
export function useEnergyItemsByDay(): {
  byDay: Map<string, DayEnergyItem[]>;
  isLoading: boolean;
} {
  const { profile, isLoading: profileLoading } = useProfile();
  const { entries, isLoading: weightLoading } = useWeightEntries();
  const { data: workouts, isLoading: workoutsLoading } = useQuery<WorkoutRow>(SELECT_WORKOUTS);
  const { data: runs, isLoading: runsLoading } = useQuery<RunRow>(SELECT_RUNS);
  const { activities, isLoading: activitiesLoading } = useActivities();

  // Mêmes extractions que ci-dessus, pour la même raison (compilateur React).
  const sex = profile?.sex ?? null;
  const heightCm = profile?.heightCm ?? null;
  const birthDate = profile?.birthDate ?? null;
  const profileWeightKg = profile?.weightKg ?? null;

  const byDay = useMemo(() => {
    const map = new Map<string, DayEnergyItem[]>();
    const age = birthDate ? computeAge(new Date(birthDate)) : null;
    const restingCache = new Map<string, { resting: RestingMetabolism | null; weightKg: number | null }>();

    const restingFor = (dayKey: string) => {
      const cached = restingCache.get(dayKey);
      if (cached) return cached;
      const weightKg = weightAtDate(entries, dayKey) ?? profileWeightKg;
      const value = {
        weightKg,
        resting: restingMetabolism({ sex, weightKg, heightCm, age }),
      };
      restingCache.set(dayKey, value);
      return value;
    };

    const push = (dayKey: string, item: DayEnergyItem) => {
      const list = map.get(dayKey);
      if (list) list.push(item);
      else map.set(dayKey, [item]);
    };

    for (const w of workouts) {
      const dayKey = localDayKey(new Date(w.finished_at));
      const estimate = estimateStrengthEnergy({
        durationSeconds: w.duration_seconds,
        totalSets: w.total_sets,
        rpe: w.rpe,
        resting: restingFor(dayKey).resting,
      });
      if (estimate) {
        push(dayKey, {
          id: w.id,
          kind: 'strength',
          activityType: null,
          // Une séance n'a pas de titre propre en base (il vient de la séance planifiée) : la carte
          // affiche donc le libellé générique « Musculation ». Aller le chercher demanderait une
          // jointure sur `sessions` + `session_translations` pour une ligne de liste.
          title: null,
          startedAt: w.started_at,
          durationSeconds: w.duration_seconds,
          estimate,
        });
      }
    }

    for (const r of runs) {
      const dayKey = localDayKey(new Date(r.finished_at));
      const { resting, weightKg } = restingFor(dayKey);
      const estimate = estimateRunEnergy({
        distanceM: r.distance_m,
        durationSeconds: r.duration_seconds,
        elevationGainM: r.elevation_gain_m,
        rpe: r.rpe,
        weightKg,
        resting,
      });
      if (estimate) {
        push(dayKey, {
          id: r.id,
          kind: 'run',
          activityType: null,
          title: null,
          startedAt: r.finished_at,
          durationSeconds: r.duration_seconds,
          estimate,
        });
      }
    }

    for (const a of activities) {
      const dayKey = localDayKey(new Date(a.startedAt));
      const estimate = estimateActivityEnergy({
        activityType: a.activityType,
        intensity: a.intensity,
        durationSeconds: a.durationSeconds,
        distanceM: a.distanceM,
        deviceKcal: a.deviceKcal,
        resting: restingFor(dayKey).resting,
      });
      if (estimate) {
        push(dayKey, {
          id: a.id,
          kind: 'activity',
          activityType: a.activityType,
          title: null,
          startedAt: a.startedAt,
          durationSeconds: a.durationSeconds,
          estimate,
        });
      }
    }

    for (const list of map.values()) list.sort((x, y) => x.startedAt.localeCompare(y.startedAt));
    return map;
  }, [workouts, runs, activities, entries, sex, heightCm, birthDate, profileWeightKg]);

  return {
    byDay,
    isLoading: profileLoading || weightLoading || workoutsLoading || runsLoading || activitiesLoading,
  };
}

/** Ce que la cible calorique retient par jour (somme des **bas de fourchette**, décision D2). */
export function useEnergyTargetByDay(): { byDay: Map<string, number>; isLoading: boolean } {
  const { byDay, isLoading } = useEnergyItemsByDay();
  return {
    byDay: useMemo(() => {
      const out = new Map<string, number>();
      for (const [dayKey, items] of byDay) {
        out.set(dayKey, sumEnergyForTarget(items.map((i) => i.estimate)));
      }
      return out;
    }, [byDay]),
    isLoading,
  };
}

/** La dépense d'une journée, source par source. */
export function useDayEnergy(dayKey: string): {
  items: DayEnergyItem[];
  /** Somme des estimations centrales — ce qui s'affiche. */
  totalKcal: number;
  /** Somme des **bas de fourchette** — ce que la cible calorique retient (D2). */
  targetKcal: number;
  isLoading: boolean;
} {
  const { byDay, isLoading } = useEnergyItemsByDay();
  const items = useMemo(() => byDay.get(dayKey) ?? [], [byDay, dayKey]);

  return {
    items,
    totalKcal: items.reduce((sum, i) => sum + i.estimate.kcal, 0),
    targetKcal: sumEnergyForTarget(items.map((i) => i.estimate)),
    isLoading,
  };
}

/**
 * La dépense d'une **activité** précise, recalculée avec le poids de sa date.
 * Utilisée par l'historique et l'écran de confirmation.
 */
export function useActivityEnergy(activity: Activity | null): EnergyEstimate | null {
  const dayKey = activity ? localDayKey(new Date(activity.startedAt)) : '1970-01-01';
  const { resting } = useRestingMetabolismAt(dayKey);

  return useMemo(() => {
    if (!activity) return null;
    return estimateActivityEnergy({
      activityType: activity.activityType,
      intensity: activity.intensity,
      durationSeconds: activity.durationSeconds,
      distanceM: activity.distanceM,
      deviceKcal: activity.deviceKcal,
      resting,
    });
  }, [activity, resting]);
}
