/**
 * CurrentSetCard.level.test.tsx — Smoke tests MUSC-F13 : la carte « série en
 * cours » adapte ses éléments supplémentaires (RPE, note, chips de type,
 * échauffement, suggestion, delta, superset) au niveau d'affichage
 * (`simplified` / `normal` / `detailed`), tout en gardant les champs cœur
 * (dont la consigne « planifié ») visibles à tous les niveaux.
 *
 * Reproduit le patron de `edit-exercise-modal-smoke.test.tsx` : import de
 * `@/i18n` (vraies traductions FR, pas de mock i18n) + `colors` passé en prop
 * (composant présentational, pas de mock `useTheme` nécessaire ici).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import '@/i18n';
import { CurrentSetCard } from './CurrentSetCard';
import { palettes } from '@/theme/colors';
import fr from '@/i18n/locales/fr.json';

const colors = palettes.light;

const baseProps = {
  exerciseName: 'Développé couché',
  currentIndex: 1,
  totalSets: 3,
  lastPerfLabel: null,
  setType: 'normal' as const,
  onSetType: jest.fn(),
  repsValue: '10',
  onChangeReps: jest.fn(),
  weightValue: '60',
  weightSymbol: 'kg',
  weightPlaceholder: '0',
  onChangeWeight: jest.fn(),
  onStepWeight: jest.fn(),
  plannedWeightKg: 50,
  durationValue: '0:00',
  onChangeDuration: jest.fn(),
  onStepDuration: jest.fn(),
  rpe: null,
  onSetRpe: jest.fn(),
  restSeconds: 90,
  onStepRest: jest.fn(),
  onSetRest: jest.fn(),
  onValidate: jest.fn(),
  colors,
};

describe('CurrentSetCard — niveaux d’affichage (MUSC-F13)', () => {
  it('simplified : aucun supplément, mais la consigne « planifié » reste visible', async () => {
    const { queryByText, getByText, queryByPlaceholderText } = await render(
      <CurrentSetCard
        {...baseProps}
        level="simplified"
        note=""
        suggestionLabel="xyz"
        supersetLink={{ status: 'linkable' }}
      />,
    );

    // Consigne planifiée : toujours visible.
    expect(getByText(fr.workout.plannedWeight.replace('{{weight}}', '50 kg'))).toBeTruthy();

    // Suppléments absents.
    expect(queryByText(fr.workout.rpeAdd)).toBeNull();
    expect(queryByPlaceholderText(fr.workout.exerciseNote.placeholder)).toBeNull();
    expect(queryByText(fr.workout.setType.dropset)).toBeNull();
    expect(queryByText(`🔥 ${fr.workout.warmupToggle}`)).toBeNull();
    expect(queryByText(`💡 xyz`)).toBeNull();
    expect(queryByText(/▲/)).toBeNull();
    expect(queryByText(fr.workout.superset.link)).toBeNull();
  });

  it('normal : échauffement + suggestion + delta visibles, mais pas RPE/note/chips/superset', async () => {
    const { queryByText, queryByPlaceholderText } = await render(
      <CurrentSetCard
        {...baseProps}
        level="normal"
        note=""
        suggestionLabel="xyz"
        supersetLink={{ status: 'linkable' }}
      />,
    );

    expect(queryByText(`🔥 ${fr.workout.warmupToggle}`)).toBeTruthy();
    expect(queryByText(`💡 xyz`)).toBeTruthy();
    expect(queryByText(/▲/)).toBeTruthy();

    expect(queryByText(fr.workout.rpeAdd)).toBeNull();
    expect(queryByPlaceholderText(fr.workout.exerciseNote.placeholder)).toBeNull();
    expect(queryByText(fr.workout.setType.dropset)).toBeNull();
    expect(queryByText(fr.workout.superset.link)).toBeNull();
  });

  it('detailed : tout visible (RPE, note, chips, échauffement, suggestion, delta, superset)', async () => {
    const { queryByText, queryByPlaceholderText } = await render(
      <CurrentSetCard
        {...baseProps}
        level="detailed"
        note=""
        suggestionLabel="xyz"
        supersetLink={{ status: 'linkable' }}
      />,
    );

    // Le libellé RPE est suivi d'un <Text> imbriqué « (option.) » : match par
    // motif plutôt qu'égalité stricte pour ne pas dépendre de la composition interne.
    expect(queryByText(new RegExp(fr.workout.rpeAdd))).toBeTruthy();
    expect(queryByPlaceholderText(fr.workout.exerciseNote.placeholder)).toBeTruthy();
    expect(queryByText(fr.workout.setType.dropset)).toBeTruthy();
    expect(queryByText(`🔥 ${fr.workout.warmupToggle}`)).toBeTruthy();
    expect(queryByText(`💡 xyz`)).toBeTruthy();
    expect(queryByText(/▲/)).toBeTruthy();
    expect(queryByText(new RegExp(fr.workout.superset.link))).toBeTruthy();
  });
});
