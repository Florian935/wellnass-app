/**
 * US NORYN-02 — la **journée en énergie**, composée une seule fois pour l'app et pour la fonction
 * `noryn-context` : quelles séances, courses et activités appartiennent à quel jour, au poids de quel
 * jour, et ce que la cible calorique en retient.
 *
 * Sortie **sans changement de calcul** de `useEnergyItemsByDay` et `useRestingMetabolismAt`
 * (`apps/mobile/src/data/repositories/energy-repository.ts`, US DEPENSE-01 / DEPENSE-00), qui n'y
 * gardent que leurs lectures. Les formules restent dans `energy.ts`.
 *
 * ⚠️ **Aucune horloge, aucun fuseau ici.** Le rattachement d'un instant à un jour (`dayKeyOf`) et
 * l'instant de l'âge (`at`) sont passés : l'app donne le jour local du téléphone et la date du jour ;
 * le serveur, qui tourne en UTC, donne le jour à Paris.
 */

import type { Activity } from './activity';
import { computeAge } from './age';
import { weightAtDate } from './bodyweight';
import {
  estimateActivityEnergy,
  estimateRunEnergy,
  estimateStrengthEnergy,
  restingMetabolism,
  sumEnergyForTarget,
  type EnergyEstimate,
  type RestingMetabolism,
} from './energy';
import type { Sex } from './profile';

/** Rattache un instant ISO à son jour `AAAA-MM-JJ`. */
export type DayKeyOf = (instant: string) => string;

/** Ce que la dépense lit du profil (le poids n'est qu'un repli, faute de pesée). */
export type EnergyProfile = {
  sex?: Sex | null;
  heightCm?: number | null;
  birthDate?: string | null;
  weightKg?: number | null;
};

/** Une pesée. */
export type WeightPoint = { logDate: string; weightKg: number };

/** Une séance de musculation **terminée** (`SELECT_WORKOUTS`), avec ses séries validées. */
export type EnergyWorkout = {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number | null;
  rpe: number | null;
  /** Séries `done`, non supprimées, **échauffements compris**. */
  totalSets: number;
};

/** Une course **finie**, tout statut (`SELECT_RUNS`). */
export type EnergyRun = {
  id: string;
  finishedAt: string;
  distanceM: number | null;
  durationSeconds: number | null;
  elevationGainM: number | null;
  rpe: number | null;
};

/** Une autre activité, sans ses notes (jamais lues pour un calcul). */
export type EnergyActivity = Omit<Activity, 'notes'>;

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

function ageOf(birthDate: string | null | undefined, at: Date): number | null {
  return birthDate ? computeAge(new Date(birthDate), at) : null;
}

/**
 * Le métabolisme de repos **tel qu'il était à `dayKey`** : poids de la pesée la plus récente au plus
 * tard ce jour-là (sinon la plus ancienne, sinon le profil), âge à `at`. `resting` vaut `null` sans
 * aucun poids. L'unique copie de cette règle (elle était écrite deux fois dans le mobile).
 */
export function restingMetabolismOn(input: {
  profile: EnergyProfile | null;
  weightEntries: ReadonlyArray<WeightPoint>;
  dayKey: string;
  at: Date;
}): { resting: RestingMetabolism | null; weightKg: number | null } {
  const { profile, weightEntries, dayKey, at } = input;
  const weightKg = weightAtDate(weightEntries, dayKey) ?? profile?.weightKg ?? null;
  return {
    weightKg,
    resting: restingMetabolism({
      sex: profile?.sex ?? null,
      weightKg,
      heightCm: profile?.heightCm ?? null,
      age: ageOf(profile?.birthDate, at),
    }),
  };
}

/**
 * La dépense de **chaque** journée, source par source, indexée par jour.
 *
 * 🔴 Le métabolisme de repos est recalculé **pour chaque jour** avec le poids de ce jour-là (constat
 * C6 de DEPENSE-01) — pas une seule fois avec la dernière pesée. Une séance appartient au jour de sa
 * **fin**, une course aussi, une activité au jour de son **début**. Chaque journée est triée par début.
 */
export function energyItemsByDay(input: {
  profile: EnergyProfile | null;
  weightEntries: ReadonlyArray<WeightPoint>;
  workouts: ReadonlyArray<EnergyWorkout>;
  finishedRuns: ReadonlyArray<EnergyRun>;
  activities: ReadonlyArray<EnergyActivity>;
  dayKeyOf: DayKeyOf;
  at: Date;
}): Map<string, DayEnergyItem[]> {
  const { profile, weightEntries, workouts, finishedRuns, activities, dayKeyOf, at } = input;
  const map = new Map<string, DayEnergyItem[]>();
  const restingCache = new Map<string, { resting: RestingMetabolism | null; weightKg: number | null }>();

  const restingFor = (dayKey: string) => {
    const cached = restingCache.get(dayKey);
    if (cached) return cached;
    const value = restingMetabolismOn({ profile, weightEntries, dayKey, at });
    restingCache.set(dayKey, value);
    return value;
  };

  const push = (dayKey: string, item: DayEnergyItem) => {
    const list = map.get(dayKey);
    if (list) list.push(item);
    else map.set(dayKey, [item]);
  };

  for (const w of workouts) {
    const dayKey = dayKeyOf(w.finishedAt);
    const estimate = estimateStrengthEnergy({
      durationSeconds: w.durationSeconds,
      totalSets: w.totalSets,
      rpe: w.rpe,
      resting: restingFor(dayKey).resting,
    });
    if (estimate) {
      push(dayKey, {
        id: w.id,
        kind: 'strength',
        activityType: null,
        // Une séance n'a pas de titre propre en base (il vient de la séance planifiée) : la carte
        // affiche donc le libellé générique « Musculation ».
        title: null,
        startedAt: w.startedAt,
        durationSeconds: w.durationSeconds,
        estimate,
      });
    }
  }

  for (const r of finishedRuns) {
    const dayKey = dayKeyOf(r.finishedAt);
    const { resting, weightKg } = restingFor(dayKey);
    const estimate = estimateRunEnergy({
      distanceM: r.distanceM,
      durationSeconds: r.durationSeconds,
      elevationGainM: r.elevationGainM,
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
        startedAt: r.finishedAt,
        durationSeconds: r.durationSeconds,
        estimate,
      });
    }
  }

  for (const a of activities) {
    const dayKey = dayKeyOf(a.startedAt);
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
}

/**
 * Les deux totaux d'une journée : `totalKcal`, la somme des estimations centrales (ce qui s'affiche) ;
 * `targetKcal`, la somme des **bas de fourchette** (ce que la cible calorique retient, décision D2).
 */
export function dayEnergyTotals(items: ReadonlyArray<DayEnergyItem>): { totalKcal: number; targetKcal: number } {
  return {
    totalKcal: items.reduce((sum, i) => sum + i.estimate.kcal, 0),
    targetKcal: sumEnergyForTarget(items.map((i) => i.estimate)),
  };
}
