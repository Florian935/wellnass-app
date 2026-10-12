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
  dayEnergyTotals,
  energyItemsByDay,
  estimateActivityEnergy,
  localDayKey,
  localDayKeyOf,
  restingMetabolismOn,
  sumEnergyForTarget,
  type Activity,
  type DayEnergyItem,
  type EnergyEstimate,
  type RestingMetabolism,
} from '@wellness/shared';

import { useTodayDate } from '@/hooks/useTodayKey';

import { useActivities } from './activity-repository';
import { useWeightEntries } from './bodyweight-repository';
import { useProfile } from './profile-repository';

export type { DayEnergyItem };

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
  // L'âge se prend à la date du jour (réactive) : `computeAge` ne compare que des dates, le résultat
  // est celui de `new Date()`, sans horloge lue dans le corps du hook (US NORYN-02).
  const today = useTodayDate();

  // Valeurs extraites AVANT les mémos : le compilateur React refuse une dépendance en
  // `profile?.x` dont le corps lit `profile.x` — deux expressions différentes à ses yeux.
  const sex = profile?.sex ?? null;
  const heightCm = profile?.heightCm ?? null;
  const birthDate = profile?.birthDate ?? null;
  const profileWeightKg = profile?.weightKg ?? null;

  // US NORYN-02 — la règle vit dans `restingMetabolismOn` (@wellness/shared), une seule fois.
  const { resting, weightKg } = useMemo(
    () =>
      restingMetabolismOn({
        profile: { sex, heightCm, birthDate, weightKg: profileWeightKg },
        weightEntries: entries,
        dayKey,
        at: today,
      }),
    [sex, heightCm, birthDate, profileWeightKg, entries, dayKey, today],
  );

  return { resting, weightKg, isLoading: profileLoading || weightLoading };
}

// ---------------------------------------------------------------------------
// La journée
// ---------------------------------------------------------------------------

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
// Exportée pour le test de parité de NORYN-02 (`noryn02-parity-sql.test.ts`) : la fonction `noryn-context`
// doit retenir exactement les mêmes lignes que cette requête.
export const SELECT_WORKOUTS = `
  SELECT w.id, w.started_at, w.finished_at, w.duration_seconds, w.rpe,
         COUNT(s.id) AS total_sets
  FROM workouts w
  LEFT JOIN workout_sets s ON s.workout_id = w.id AND s.deleted_at IS NULL AND s.done = 1
  WHERE w.deleted_at IS NULL AND w.status = 'completed' AND w.finished_at IS NOT NULL
  GROUP BY w.id
  ORDER BY w.finished_at DESC
`;

// Exportée pour le test de parité de NORYN-02 (`noryn02-parity-sql.test.ts`) : la fonction `noryn-context`
// doit retenir exactement les mêmes lignes que cette requête.
export const SELECT_RUNS = `
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

  const today = useTodayDate();

  // Mêmes extractions que ci-dessus, pour la même raison (compilateur React).
  const sex = profile?.sex ?? null;
  const heightCm = profile?.heightCm ?? null;
  const birthDate = profile?.birthDate ?? null;
  const profileWeightKg = profile?.weightKg ?? null;

  // US NORYN-02 — la composition vit dans `energyItemsByDay` (@wellness/shared) : la fonction
  // `noryn-context` l'appelle aussi. Ici, la lecture et le passage des lignes aux entrées.
  const byDay = useMemo(
    () =>
      energyItemsByDay({
        profile: { sex, heightCm, birthDate, weightKg: profileWeightKg },
        weightEntries: entries,
        workouts: workouts.map((w) => ({
          id: w.id,
          startedAt: w.started_at,
          finishedAt: w.finished_at,
          durationSeconds: w.duration_seconds,
          rpe: w.rpe,
          totalSets: w.total_sets,
        })),
        finishedRuns: runs.map((r) => ({
          id: r.id,
          finishedAt: r.finished_at,
          distanceM: r.distance_m,
          durationSeconds: r.duration_seconds,
          elevationGainM: r.elevation_gain_m,
          rpe: r.rpe,
        })),
        activities,
        dayKeyOf: localDayKeyOf,
        at: today,
      }),
    [workouts, runs, activities, entries, sex, heightCm, birthDate, profileWeightKg, today],
  );

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
  const { totalKcal, targetKcal } = dayEnergyTotals(items);

  return { items, totalKcal, targetKcal, isLoading };
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
