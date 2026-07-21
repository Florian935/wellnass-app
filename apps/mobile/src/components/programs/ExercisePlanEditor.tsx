import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  removeExercisePlan,
  updateExercisePlan,
  type PlanItem,
} from '@/data/repositories/program-repository';
import { useUnits } from '@/hooks/useUnits';
import {
  ExerciseTargetsFields,
  numToStr,
  toNonNegativeInt,
  toPositiveInt,
} from '@/components/exercise/ExerciseTargetsFields';

type ExercisePlanEditorProps = {
  plan: PlanItem;
};

/**
 * Ligne d'édition d'un plan d'exercice au sein d'une séance : nom + 4 champs de
 * cibles (séries, répétitions, charge, repos) édités en local et persistés au blur
 * via `updateExercisePlan`, plus une action de suppression (`removeExercisePlan`).
 *
 * Les champs sont maintenus en état local pour une saisie fluide ; la lecture
 * réactive (`useProgramDetail`) rafraîchit la vue parente après écriture. Wrapper
 * fin autour de `ExerciseTargetsFields` (présentation pure) : ce composant ne
 * porte que l'état local et la persistance.
 */
export function ExercisePlanEditor({ plan }: ExercisePlanEditorProps) {
  const { t } = useTranslation();
  const units = useUnits();

  const [sets, setSets] = useState(numToStr(plan.targetSets));
  const [reps, setReps] = useState(plan.targetReps ?? '');
  const weight0 = units.weightInputValue(plan.targetWeightKg);
  const [weight, setWeight] = useState(weight0);
  const initialWeightRef = useRef(weight0);
  const [rest, setRest] = useState(numToStr(plan.restSeconds));

  const commitSets = () => {
    void updateExercisePlan(plan.id, { targetSets: toPositiveInt(sets) });
  };
  const commitReps = () => {
    const trimmed = reps.trim();
    void updateExercisePlan(plan.id, { targetReps: trimmed === '' ? null : trimmed });
  };
  const commitWeight = () => {
    const next =
      weight === initialWeightRef.current
        ? (plan.targetWeightKg ?? null)
        : units.parseWeightToKg(weight);
    void updateExercisePlan(plan.id, { targetWeightKg: next });
  };
  const commitRest = () => {
    void updateExercisePlan(plan.id, { restSeconds: toNonNegativeInt(rest) });
  };

  const onRemove = () => {
    void removeExercisePlan(plan.id);
  };

  return (
    <ExerciseTargetsFields
      exerciseName={plan.exerciseName}
      sets={sets}
      onChangeSets={setSets}
      onBlurSets={commitSets}
      reps={reps}
      onChangeReps={setReps}
      onBlurReps={commitReps}
      weight={weight}
      onChangeWeight={setWeight}
      onBlurWeight={commitWeight}
      weightSymbol={units.weightSymbol}
      weightPlaceholder={t(
        units.system === 'imperial'
          ? 'programs.edit.targets.weightPlaceholderImperial'
          : 'programs.edit.targets.weightPlaceholderMetric',
      )}
      rest={rest}
      onChangeRest={setRest}
      onBlurRest={commitRest}
      onRemove={onRemove}
      removeA11yLabel={t('programs.edit.removeExerciseA11y', { name: plan.exerciseName })}
    />
  );
}
