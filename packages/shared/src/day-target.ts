/**
 * US NORYN-02 — la **cible du jour**, composée une seule fois pour l'app et pour la fonction
 * `noryn-context` : jour d'entraînement, socle selon le mode, objectif (vie réelle du jour),
 * surcharge, bonus, cible effective, macros.
 *
 * Sortie **sans changement de calcul** de `useIsTrainingDay`, `useDayCalorieTarget`
 * (`apps/mobile/src/data/repositories/dashboard-repository.ts`) et `useDayNutritionTargets`
 * (`apps/mobile/src/hooks/useDayNutritionTargets.ts`), qui n'y gardent que leurs lectures. Les
 * formules restent dans `nutrition.ts` et `running.ts`.
 *
 * Les **replis** que les hooks et les lecteurs de lignes répétaient (`trainingBonusMode ?? 'fixed'`,
 * `trainingDayBonus ?? 0`, niveau d'activité `?? 'moderate'`, socle hors sport `?? 'standing'`,
 * objectif repli sur le but principal) vivent **ici**, une fois (spec NORYN-02 D8).
 *
 * ⚠️ Aucune horloge, aucun fuseau : `dayKeyOf` et `at` sont passés (voir `day-energy.ts`).
 */

import { computeAge } from './age';
import type { DayKeyOf } from './day-energy';
import {
  DEFAULT_SPORT_FREE_LEVEL,
  dayCalorieBonus,
  effectiveActivityLevel,
  effectiveNutritionObjective,
  objectiveFromGoal,
  sportFreeTdee,
  targetCalories,
  tdee,
  trainingDayCalories,
  trainingDayMacroGrams,
  type ActivityLevel,
  type MacroGrams,
  type NutritionObjective,
  type SportFreeLevel,
  type TrainingBonusMode,
} from './nutrition';
import { resolveActivePillars, type Pillar } from './pillar';
import type { Goal, Sex } from './profile';
import { isRealLifeDay, type RealLifePeriod } from './real-life';
import { estimateRunCalories } from './running';
import { isTrainingDay } from './training-day';

/** Ce que la cible lit du profil. */
export type TargetProfile = {
  sex?: Sex | null;
  weightKg?: number | null;
  heightCm?: number | null;
  birthDate?: string | null;
  mainGoal?: Goal | null;
};

/** Ce que la cible lit du profil nutritionnel ; un champ absent prend le repli de l'app. */
export type TargetNutritionProfile = {
  objective?: NutritionObjective | null;
  activityLevel?: ActivityLevel | null;
  manualCalories?: number | null;
  manualProteinG?: number | null;
  manualCarbsG?: number | null;
  manualFatG?: number | null;
  trainingDayBonus?: number | null;
  trainingBonusMode?: TrainingBonusMode | null;
  sportFreeLevel?: SportFreeLevel | null;
};

export type RealLifeSpan = Pick<RealLifePeriod, 'startedOn' | 'endsOn'>;

/** Origine du bonus appliqué (RN-02, DEPENSE-00). */
export type BonusSource = 'run' | 'forfait' | 'activities' | 'none';

/** La cible calorique d'un jour, et ce qui la compose. */
export type DayCalorieTargetResult = {
  /**
   * Le socle de la cible : `tdee` (facteur d'activité, sport compris) ou socle **hors sport** en mode
   * `activities`. Rendu pour que personne ne le recalcule à côté — la cause même de l'écart E4.
   */
  socle: number | null;
  socleKind: 'tdee' | 'sportFree';
  /** Objectif de **base** (socle + objectif du jour, ou surcharge), hors bonus. */
  target: number | null;
  /** Cible **effective** : base + bonus du jour. */
  effectiveTarget: number | null;
  trainingBonus: number;
  bonusSource: BonusSource;
  /** Jour d'entraînement **et** bonus appliqué (en mode `activities` : dépense > 0). */
  isTrainingDay: boolean;
};

function ageOf(birthDate: string | null | undefined, at: Date): number | undefined {
  return birthDate ? computeAge(new Date(birthDate), at) : undefined;
}

/** L'objectif nutritionnel appliqué : le choix, sinon celui du but principal. */
export function appliedObjective(
  nutritionProfile: TargetNutritionProfile | null,
  profile: TargetProfile | null,
): NutritionObjective {
  return nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
}

/**
 * Le jour est-il un **jour d'entraînement** (`useIsTrainingDay`) : séance de muscu ou course terminée
 * ce jour-là (jour de la fin), autre activité ce jour-là (jour du début, AUTRE-01), ou séance planifiée
 * `planned`/`done` aujourd'hui ou après (anticipation, 4.7b).
 */
export function trainedOnDay(input: {
  dayKey: string;
  todayKey: string;
  workouts: ReadonlyArray<{ finishedAt: string | null }>;
  completedRuns: ReadonlyArray<{ finishedAt: string | null }>;
  activities: ReadonlyArray<{ startedAt: string }>;
  hasPlanned: boolean;
  dayKeyOf: DayKeyOf;
}): boolean {
  const { dayKey, todayKey, workouts, completedRuns, activities, hasPlanned, dayKeyOf } = input;
  const doneOnDay = (arr: ReadonlyArray<{ finishedAt: string | null }>) =>
    arr.some((x) => x.finishedAt != null && dayKeyOf(x.finishedAt) === dayKey);
  const retroactiveDone =
    doneOnDay(workouts) || doneOnDay(completedRuns) || activities.some((a) => dayKeyOf(a.startedAt) === dayKey);
  return isTrainingDay({ retroactiveDone, hasPlanned, dayKey, todayKey });
}

/**
 * La cible calorique d'un jour (`useDayCalorieTarget`).
 *
 * - **Socle** : `tdee` (niveau d'activité, repli « modéré ») ; en mode `activities`, le socle **hors
 *   sport** (DEPENSE-00 R1), sans quoi le sport compterait deux fois.
 * - **Base** : socle + objectif, ramené au maintien si une période « vie réelle » couvre **ce jour**
 *   (VIE-01 R4) ; une surcharge manuelle prime sur tout cela.
 * - **Bonus** : forfait les jours d'entraînement (`fixed`), dépense des courses du jour au poids de la
 *   **dernière pesée** — pilier course actif — sinon forfait (`auto`), dépense réelle retenue du jour
 *   (`activities`, aucun repli).
 */
export function composeDayCalorieTarget(input: {
  dayKey: string;
  profile: TargetProfile | null;
  nutritionProfile: TargetNutritionProfile | null;
  /** Dernière pesée (`ORDER BY log_date DESC LIMIT 1`), sans borne de date. */
  latestWeightKg: number | null;
  activePillars: readonly Pillar[] | null | undefined;
  realLifePeriods: ReadonlyArray<RealLifeSpan>;
  /** Résultat de `trainedOnDay` pour ce jour. */
  trainedThatDay: boolean;
  /** Courses **terminées** (`status = 'completed'`). */
  completedRuns: ReadonlyArray<{ finishedAt: string | null; distanceM: number | null; durationSeconds: number | null }>;
  /** Dépense réelle retenue ce jour (bas des fourchettes, `dayEnergyTotals().targetKcal`). */
  energyKcal: number;
  dayKeyOf: DayKeyOf;
  at: Date;
}): DayCalorieTargetResult {
  const { dayKey, profile, nutritionProfile, at } = input;

  const objective = appliedObjective(nutritionProfile, profile);
  const age = ageOf(profile?.birthDate, at);
  const usesRealEnergy = (nutritionProfile?.trainingBonusMode ?? 'fixed') === 'activities';
  const socle = usesRealEnergy
    ? sportFreeTdee({
        sex: profile?.sex ?? 'unspecified',
        weightKg: profile?.weightKg ?? undefined,
        heightCm: profile?.heightCm ?? undefined,
        age,
        sportFreeLevel: nutritionProfile?.sportFreeLevel ?? DEFAULT_SPORT_FREE_LEVEL,
      })
    : tdee({
        sex: profile?.sex ?? 'unspecified',
        weightKg: profile?.weightKg ?? undefined,
        heightCm: profile?.heightCm ?? undefined,
        age,
        activityLevel: nutritionProfile?.activityLevel ?? 'moderate',
      });
  const inRealLifePeriod = isRealLifeDay(input.realLifePeriods, dayKey);
  const target =
    socle != null && objective != null
      ? targetCalories(
          socle,
          effectiveNutritionObjective(objective, inRealLifePeriod),
          nutritionProfile?.manualCalories ?? null,
        )
      : null;

  const mode: TrainingBonusMode = nutritionProfile?.trainingBonusMode ?? 'fixed';
  const fixedBonus = nutritionProfile?.trainingDayBonus ?? 0;
  const weightKg = input.latestWeightKg ?? profile?.weightKg ?? null;
  const runningActive = resolveActivePillars(input.activePillars).includes('running');

  const runCaloriesOnDay = runningActive
    ? input.completedRuns
        .filter((r) => r.finishedAt && input.dayKeyOf(r.finishedAt) === dayKey)
        .reduce(
          (sum, r) =>
            sum + estimateRunCalories({ distanceM: r.distanceM, durationSeconds: r.durationSeconds, weightKg }),
          0,
        )
    : 0;

  const bonus = dayCalorieBonus({
    mode,
    isTrainingDay: input.trainedThatDay,
    fixedBonus,
    runCaloriesToday: runCaloriesOnDay,
    energyKcalToday: input.energyKcal,
  });

  // En mode `activities`, le bonus ne dépend PAS du statut « jour d'entraînement » : une sortie vélo
  // un jour sans séance planifiée compte, et un jour de séance sans rien de saisi ne compte pas.
  const isTrainingDayFlag =
    (mode === 'activities' ? bonus > 0 : input.trainedThatDay && bonus > 0) && target != null;
  const effectiveTarget = target != null ? trainingDayCalories(target, bonus) : target;

  const bonusSource: BonusSource =
    mode === 'activities'
      ? bonus > 0
        ? 'activities'
        : 'none'
      : mode === 'auto' && runCaloriesOnDay > 0
        ? 'run'
        : bonus > 0
          ? 'forfait'
          : 'none';

  return {
    socle,
    socleKind: usesRealEnergy ? 'sportFree' : 'tdee',
    target,
    effectiveTarget,
    trainingBonus: bonus,
    bonusSource,
    isTrainingDay: isTrainingDayFlag,
  };
}

/** Une macro manuelle au moins est-elle posée ? Elles priment alors toutes (les absentes à 0). */
export function hasManualMacros(nutritionProfile: TargetNutritionProfile | null): boolean {
  return (
    nutritionProfile?.manualProteinG != null ||
    nutritionProfile?.manualCarbsG != null ||
    nutritionProfile?.manualFatG != null
  );
}

/**
 * Les cibles de l'onglet Nutrition (`useDayNutritionTargets`) : la base, les macros, et si le profil
 * permet un calcul personnel.
 *
 * Macros : manuelles si une macro manuelle est posée, sinon `trainingDayMacroGrams` — le bonus du jour
 * redirigé vers les glucides (MN-04).
 *
 * ⚠️ Recopie fidèle de l'existant : la base est recalculée ici sur `tdee` **quel que soit le mode**,
 * alors que la cible calorique prend le socle hors sport en mode `activities` (écart E4).
 */
export function composeDayNutritionTargets(input: {
  dayKey: string;
  profile: TargetProfile | null;
  nutritionProfile: TargetNutritionProfile | null;
  realLifePeriods: ReadonlyArray<RealLifeSpan>;
  dayTarget: { effectiveTarget: number | null };
  at: Date;
}): { tdeeValue: number | null; target: number | null; targetMacros: MacroGrams | null; profileComplete: boolean } {
  const { dayKey, profile, nutritionProfile, at } = input;
  const objective = appliedObjective(nutritionProfile, profile);
  const age = ageOf(profile?.birthDate, at) ?? null;
  const tdeeValue = tdee({
    sex: profile?.sex ?? 'unspecified',
    weightKg: profile?.weightKg ?? undefined,
    heightCm: profile?.heightCm ?? undefined,
    age: age ?? undefined,
    activityLevel: effectiveActivityLevel({ activityLevel: nutritionProfile?.activityLevel ?? null }),
  });
  const target =
    tdeeValue != null
      ? targetCalories(
          tdeeValue,
          effectiveNutritionObjective(objective, isRealLifeDay(input.realLifePeriods, dayKey)),
          nutritionProfile?.manualCalories ?? null,
        )
      : null;

  const effectiveTarget = input.dayTarget.effectiveTarget;
  const targetMacros: MacroGrams | null = hasManualMacros(nutritionProfile)
    ? {
        protein: nutritionProfile?.manualProteinG ?? 0,
        carbs: nutritionProfile?.manualCarbsG ?? 0,
        fat: nutritionProfile?.manualFatG ?? 0,
      }
    : target != null && effectiveTarget != null
      ? trainingDayMacroGrams({ targetBase: target, effectiveTarget, objective })
      : null;

  return {
    tdeeValue,
    target,
    targetMacros,
    profileComplete: profile?.weightKg != null && profile?.heightCm != null && age != null,
  };
}
