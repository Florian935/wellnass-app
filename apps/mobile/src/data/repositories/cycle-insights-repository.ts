/**
 * US CYCLE-01 (roadmap 1.26) — croisement « phase du cycle × données déjà collectées ».
 *
 * ⚠️ **Aucune collecte nouvelle** (R15). Ce module ne fait que **relire** ce que l'app enregistre
 * déjà — bien-être déclaré, tonnage des séances, apport calorique et allure de course — et
 * l'étiqueter par phase de cycle.
 *
 * ── kcal et allure : la lecture existait déjà, contrairement à ce qu'affirmait le CHANGELOG de la
 *    nuit du 30 au 31/07 ─────────────────────────────────────────────────────────────────────────
 * L'affirmation « nutrition-repository n'expose ni totaux ni kcal par jour » ne portait que sur
 * `nutrition-repository.ts` (profil, cibles) : `journal-repository.ts` expose depuis longtemps
 * `useDailyTotals(sinceDate)`, un agrégat quotidien de `food_entries` (US 7.2). Et `run-repository.ts`
 * calcule déjà `avgPaceSPerKm` par course. Les deux métriques manquantes n'avaient donc besoin
 * d'aucun nouvel agrégat — seulement d'être branchées ici, comme `wellbeing` et `workouts` le sont
 * déjà. Passer `'1970-01-01'` à `useDailyTotals` (au lieu d'une fenêtre récente) reprend la
 * convention « depuis toujours » déjà utilisée pour la période `'all'` de `records-repository.ts`.
 *
 * ⚠️ **Le calcul ne produit que des moyennes et des effectifs.** Aucune causalité, aucun conseil :
 * « ton énergie baisse **à cause de** ta phase lutéale » ou « **évite** les séances lourdes » sont
 * hors de portée du calcul comme de l'affichage (R14). Les libellés vivent en i18n.
 *
 * ⚠️ **Le seuil est vérifié métrique par métrique** (R13) : l'énergie peut être exploitable quand
 * la performance ne l'est pas encore. C'est un appel de `crossPhaseAverages` par métrique, jamais
 * un verdict global.
 */

import { useMemo } from 'react';
import {
  cycleLengths,
  crossPhaseAverages,
  localDayKey,
  phaseForDate,
  usableCycleLengths,
  type CrossPhaseResult,
  type MenstrualPeriod,
  type PhaseSample,
} from '@wellness/shared';

import { useMenstrualPeriods } from './menstrual-cycle-repository';
import { useWellbeingRows } from './daily-wellbeing-repository';
import { useWorkoutHistory } from './workout-repository';
import { useDailyTotals } from './journal-repository';
import { useRunHistory } from './run-repository';

/** Borne « depuis toujours » — même convention que la période `'all'` de `records-repository.ts`. */
const EPOCH_DATE = '1970-01-01';

/** Métriques croisées. Liste fermée : chacune doit avoir un sens comparé entre phases. */
export const CYCLE_INSIGHT_METRICS = ['energy', 'mood', 'stress', 'tonnage', 'calories', 'pace'] as const;
export type CycleInsightMetric = (typeof CYCLE_INSIGHT_METRICS)[number];

export type CycleInsights = {
  byMetric: Record<CycleInsightMetric, CrossPhaseResult>;
  cyclesObserved: number;
  isLoading: boolean;
};

/** Longueur moyenne exploitable, ou `null` — sans elle, `phaseForDate` ne situe pas l'ovulation. */
function averageLengthOf(periods: readonly MenstrualPeriod[]): number | null {
  const { usable } = usableCycleLengths(cycleLengths(periods));
  if (usable.length === 0) return null;
  return Math.round(usable.reduce((a, c) => a + c.length, 0) / usable.length);
}

export function useCycleInsights(): CycleInsights {
  const { periods, isLoading: periodsLoading } = useMenstrualPeriods();
  const { rows: wellbeing, isLoading: wellbeingLoading } = useWellbeingRows();
  const { workouts, isLoading: workoutsLoading } = useWorkoutHistory();
  const { totals: dailyTotals, isLoading: totalsLoading } = useDailyTotals(EPOCH_DATE);
  const { runs, isLoading: runsLoading } = useRunHistory();

  return useMemo(() => {
    const averageLength = averageLengthOf(periods);
    const cyclesObserved = usableCycleLengths(cycleLengths(periods)).usable.length;

    /** Étiquette une valeur datée par sa phase ; les jours sans phase sont **écartés**. */
    const label = (dayKey: string, value: number | null | undefined): PhaseSample[] => {
      if (value === null || value === undefined) return [];
      const phase = phaseForDate(dayKey, periods, averageLength);
      return phase === null ? [] : [{ phase, value }];
    };

    const energy = wellbeing.flatMap((r) => label(r.logDate, r.energy));
    const mood = wellbeing.flatMap((r) => label(r.logDate, r.mood));
    const stress = wellbeing.flatMap((r) => label(r.logDate, r.stress));
    // Une séance sans tonnage (0 kg : cardio, poids du corps non chiffré) n'est pas une séance
    // « faible » — c'est une séance non mesurable sur cet axe. On l'écarte plutôt que de tirer
    // la moyenne vers le bas avec un zéro qui ne veut rien dire.
    const tonnage = workouts.flatMap((w) =>
      w.volumeKg > 0 ? label(localDayKey(new Date(w.startedAt)), w.volumeKg) : [],
    );
    // Apport calorique quotidien — `useDailyTotals` n'émet une ligne que pour un jour qui a au
    // moins une entrée alimentaire (GROUP BY côté SQL), donc pas de faux zéro à écarter ici,
    // contrairement au tonnage.
    const calories = dailyTotals.flatMap((d) => label(d.logDate, d.kcal));
    // Allure de course : `avgPaceSPerKm` est `null` pour une course manuelle sans distance/durée
    // exploitable — `label()` l'écarte déjà comme toute valeur nulle.
    const pace = runs.flatMap((r) => label(localDayKey(new Date(r.startedAt)), r.avgPaceSPerKm));

    return {
      byMetric: {
        energy: crossPhaseAverages(energy, cyclesObserved),
        mood: crossPhaseAverages(mood, cyclesObserved),
        stress: crossPhaseAverages(stress, cyclesObserved),
        tonnage: crossPhaseAverages(tonnage, cyclesObserved),
        calories: crossPhaseAverages(calories, cyclesObserved),
        pace: crossPhaseAverages(pace, cyclesObserved),
      },
      cyclesObserved,
      isLoading:
        periodsLoading || wellbeingLoading || workoutsLoading || totalsLoading || runsLoading,
    };
  }, [
    periods,
    wellbeing,
    workouts,
    dailyTotals,
    runs,
    periodsLoading,
    wellbeingLoading,
    workoutsLoading,
    totalsLoading,
    runsLoading,
  ]);
}
