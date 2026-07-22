import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { CreateExerciseModal } from '../CreateExerciseModal';
import { addCustomExercise } from '@/data/repositories/exercise-repository';

jest.mock('@/data/repositories/exercise-repository', () => ({
  addCustomExercise: jest.fn(() => Promise.resolve('new-id')),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#000', textMuted: '#888', background: '#fff', surface: '#f5f5f5',
      border: '#ddd', accent: '#6b0028', accentText: '#fff',
    },
  })),
}));

describe('CreateExerciseModal — smoke', () => {
  it('affiche le titre et le bouton Ajouter', async () => {
    const { getByText } = await render(<CreateExerciseModal visible onClose={jest.fn()} />);
    expect(getByText('Créer un exercice')).toBeTruthy();
    expect(getByText('Ajouter')).toBeTruthy();
  });

  it('crée l’exercice puis ferme quand un nom est saisi', async () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <CreateExerciseModal visible onClose={onClose} />,
    );
    await fireEvent.changeText(getByPlaceholderText('Ex. Développé couché'), 'Mon exo');
    await fireEvent.press(getByText('Ajouter'));
    expect(addCustomExercise).toHaveBeenCalledWith('Mon exo', 'chest');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
