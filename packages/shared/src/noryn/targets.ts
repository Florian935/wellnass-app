/**
 * US NORYN-02 — les cibles du jour et le verdict de forme, servis à Noryn **par les mêmes compositions
 * que l'app** (`composeDayCalorieTarget`, `dayMacroTargets`, `composeReadiness`…). Ce module ne calcule
 * rien : il décode l'instantané, appelle les compositions, borne au contrat.
 *
 * 🔴 **R1 — aucune formule ici.** Un test-garde fixe la liste des imports permis à ce fichier : les
 * compositions de `day-energy`, `day-target` et `readiness`, les décodeurs de `snapshot`, les dates de
 * Paris. Toute brique de calcul (`tdee`, `computeAge`, `weightAtDate`, `computeAcwr`…) importée ici
 * serait le début d'une seconde définition de la cible.
 *
 * Le serveur tourne en UTC : le jour d'un instant se prend **à Paris** (`parisDayKey`), et l'âge à
 * midi UTC d'**aujourd'hui** à Paris, quelle que soit la date demandée — l'app prend l'âge du jour pour
 * toute date (spec D7, DD6). Sur un serveur en UTC, les accesseurs locaux de `computeAge` y lisent la
 * date de Paris.
 */

import { dayEnergyTotals, energyItemsByDay } from '../day-energy';
import { composeDayCalorieTarget, dayMacroTargets, trainedOnDay } from '../day-target';
import { composeReadiness, type ReadinessVerdict } from '../readiness';
import { parisDayKey } from './paris-date';
import {
  activePillarsOf,
  bonusModeOf,
  boundedInt,
  decodeActivities,
  decodeActivityLoad,
  decodeCompletedRuns,
  decodeDailyKcal,
  decodeEnergyWorkouts,
  decodeFinishedRuns,
  decodeLoad,
  decodePeriods,
  decodeReadinessWellbeing,
  decodeTargetNutrition,
  decodeTargetProfile,
  decodeWeights,
  hasPlannedOn,
  type OwnerSnapshot,
  type TargetRows,
} from './snapshot';

/** Le jour **à Paris** d'un instant ISO. */
export const parisDayKeyOf = (instant: string): string => parisDayKey(new Date(instant));

/** L'instant de l'âge : midi UTC du jour de Paris (voir l'en-tête). */
export const ageInstantOf = (todayKey: string): Date => new Date(`${todayKey}T12:00:00Z`);

export type NorynTargets = { energyTargetKcal: number | null; proteinTargetG: number | null };

const NO_TARGETS: NorynTargets = { energyTargetKcal: null, proteinTargetG: null };

/** La cible de base et la cible effective de `date`, ou `null` si les entrées sont invalides (DD4). */
function dayTargetOf(snapshot: OwnerSnapshot, rows: TargetRows, date: string, today: string) {
  const profile = decodeTargetProfile(rows.profile);
  const nutritionProfile = decodeTargetNutrition(rows.nutritionProfile);
  const activities = decodeActivities(rows.activities);
  if (profile === 'invalid' || nutritionProfile === 'invalid' || activities === 'invalid') return null;

  const at = ageInstantOf(today);
  const workouts = decodeEnergyWorkouts(rows.workouts, rows.workoutSets);
  const completedRuns = decodeCompletedRuns(rows.runs);
  // La dépense n'entre qu'en mode `activities` (`dayCalorieBonus` l'ignore ailleurs) : ses séries et
  // ses pesées ne sont d'ailleurs lues que dans ce mode.
  const energyKcal =
    bonusModeOf(rows.nutritionProfile) === 'activities'
      ? dayEnergyTotals(
          energyItemsByDay({
            profile,
            weightEntries: decodeWeights([rows.weightAtDate, rows.oldestWeight]),
            workouts,
            finishedRuns: decodeFinishedRuns(rows.runs),
            activities,
            dayKeyOf: parisDayKeyOf,
            at,
          }).get(date) ?? [],
        ).targetKcal
      : 0;

  const dayTarget = composeDayCalorieTarget({
    dayKey: date,
    profile,
    nutritionProfile,
    latestWeightKg: rows.latestWeight?.weight_kg ?? null,
    activePillars: activePillarsOf(snapshot.settings),
    realLifePeriods: decodePeriods(rows.periods),
    trainedThatDay: trainedOnDay({
      dayKey: date,
      todayKey: today,
      workouts,
      completedRuns,
      activities,
      hasPlanned: hasPlannedOn(snapshot.planned, date),
      dayKeyOf: parisDayKeyOf,
    }),
    completedRuns,
    energyKcal,
    dayKeyOf: parisDayKeyOf,
    at,
  });
  return { profile, nutritionProfile, dayTarget };
}

/**
 * `energy_target_kcal` et `protein_target_g` de `date` : la cible **effective** du jour (celle de
 * l'onglet Nutrition et de « Ta journée en énergie ») et la cible de protéines de la règle unique
 * (`dayMacroTargets`, D1-A), bornées au contrat — hors bornes, `null`, jamais rognée (DD1).
 */
export function norynTargets(snapshot: OwnerSnapshot, query: { date: string; today: string }): NorynTargets {
  const rows = snapshot.targets;
  if (!rows) return NO_TARGETS;
  const computed = dayTargetOf(snapshot, rows, query.date, query.today);
  if (computed === null) return NO_TARGETS;
  const { profile, nutritionProfile, dayTarget } = computed;
  return {
    energyTargetKcal: boundedInt(dayTarget.effectiveTarget, 1, 20_000),
    proteinTargetG: boundedInt(dayMacroTargets({ profile, nutritionProfile, dayTarget })?.protein, 1, 2_000),
  };
}

/**
 * `readiness` d'aujourd'hui : le verdict **si l'app le montre** (`show`), sinon `null` (D4). La cible
 * de base vient de la même composition que l'onglet Nutrition ; pilier Nutrition éteint, elle est
 * absente et la composante nutrition indisponible, comme dans l'app.
 */
export function norynReadiness(snapshot: OwnerSnapshot, query: { today: string }): ReadinessVerdict | null {
  const rows = snapshot.readiness;
  if (!rows) return null;
  const { today } = query;
  // La cible de base d'aujourd'hui, seulement si les entrées ont été lues **pour aujourd'hui** (périodes
  // couvrant ce jour) : sinon, ce serait la cible d'un autre jour.
  const targets = snapshot.targets?.date === today ? snapshot.targets : null;
  const base = targets ? dayTargetOf(snapshot, targets, today, today) : null;
  const activities = decodeActivityLoad(rows.activities);

  const result = composeReadiness({
    todayKey: today,
    activePillars: activePillarsOf(snapshot.settings),
    wellbeingPillarEnabled: snapshot.settings?.wellbeing_pillar_enabled === true,
    workouts: decodeLoad(rows.workouts),
    completedRuns: decodeLoad(rows.runs),
    activities,
    dailyKcal: decodeDailyKcal(rows.food),
    baseTargetKcal: base?.dayTarget.target ?? null,
    wellbeingRows: decodeReadinessWellbeing(rows.wellbeing),
    dayKeyOf: parisDayKeyOf,
  });
  return result.show ? result.verdict : null;
}
