import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { EditExerciseModal } from '../EditExerciseModal';
import { updateCustomExercise } from '@/data/repositories/exercise-repository';

jest.mock('@/data/repositories/exercise-repository', () => ({
  updateCustomExercise: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#000', textMuted: '#888', background: '#fff', surface: '#f5f5f5',
      surfaceAlt: '#eee', border: '#ddd', accent: '#6b0028', accentText: '#fff',
    },
  })),
}));

const exercise = {
  id: 'exo-1',
  name: 'Mon exo',
  muscle: 'chest' as const,
  source: 'custom' as const,
  equipment: null,
  mediaUrl: null,
  isFavorite: false,
  instructions: 'Notes',
  musclesSecondary: ['arms' as const],
};

describe('EditExerciseModal — smoke', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pré-remplit le nom et enregistre', async () => {
    const onClose = jest.fn();
    const { getByText, getByDisplayValue } = await render(
      <EditExerciseModal visible exercise={exercise} onClose={onClose} />,
    );
    expect(getByDisplayValue('Mon exo')).toBeTruthy();
    await fireEvent.press(getByText('Enregistrer'));
    expect(updateCustomExercise).toHaveBeenCalledWith(
      'exo-1',
      expect.objectContaining({ name: 'Mon exo', muscle: 'chest' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('Annuler réinitialise le formulaire (les saisies abandonnées ne persistent pas)', async () => {
    const onClose = jest.fn();
    const { getByText, getByDisplayValue, queryByDisplayValue } = await render(
      <EditExerciseModal visible exercise={exercise} onClose={onClose} />,
    );
    await fireEvent.changeText(getByDisplayValue('Mon exo'), 'Brouillon abandonné');
    await fireEvent.press(getByText('Annuler'));
    expect(onClose).toHaveBeenCalled();
    // La modale reste montée : l'état doit être revenu à la valeur d'origine.
    expect(queryByDisplayValue('Brouillon abandonné')).toBeNull();
    expect(getByDisplayValue('Mon exo')).toBeTruthy();
    expect(updateCustomExercise).not.toHaveBeenCalled();
  });
});
