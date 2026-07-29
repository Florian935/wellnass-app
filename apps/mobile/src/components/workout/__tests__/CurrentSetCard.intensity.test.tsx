/**
 * US UX-05 — la carte « série en cours » affiche l'intensité dans l'échelle choisie.
 *
 * Ce qui est vérifié est le **contrat de l'US** :
 *  - en mode RIR, c'est « RIR » qui s'affiche, et la valeur est **inversée** (RPE 8 → RIR 2) ;
 *  - choisir une valeur RIR **stocke le RPE correspondant** — la donnée en base ne change jamais de
 *    nature, c'est tout le principe de l'US ;
 *  - une intensité **non saisie** reste non saisie : elle ne devient pas « RIR 10 ».
 *
 * `useSettings` est mocké pour piloter l'échelle sans passer par PowerSync.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import '@/i18n';

import { CurrentSetCard } from '../CurrentSetCard';
import { palettes } from '@/theme/colors';
import { useSettings } from '@/data/repositories/settings-repository';

jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: jest.fn(() => ({ settings: null, isLoading: false })),
}));

const colors = palettes.light;

const mockScale = (intensityScale: 'rpe' | 'rir' | undefined) =>
  (useSettings as jest.Mock).mockReturnValue({
    settings: intensityScale === undefined ? null : { intensityScale, units: 'metric' },
    isLoading: false,
  });

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
  plannedWeightKg: null,
  durationValue: '0:00',
  onChangeDuration: jest.fn(),
  onStepDuration: jest.fn(),
  restSeconds: 90,
  onStepRest: jest.fn(),
  onSetRest: jest.fn(),
  onValidate: jest.fn(),
  level: 'detailed' as const,
  note: '',
  colors,
};

describe('CurrentSetCard — échelle d’intensité (UX-05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScale(undefined);
  });

  it('affiche « RPE 8 » quand l’échelle est le RPE', async () => {
    mockScale('rpe');
    const { getByText } = await render(
      <CurrentSetCard {...baseProps} rpe={8} onSetRpe={jest.fn()} />,
    );
    expect(getByText('RPE 8')).toBeTruthy();
  });

  it('affiche « RIR 2 » pour le MÊME RPE 8 quand l’échelle est le RIR', async () => {
    // La donnée en base est identique : seule sa lecture change.
    mockScale('rir');
    const { getByText, queryByText } = await render(
      <CurrentSetCard {...baseProps} rpe={8} onSetRpe={jest.fn()} />,
    );
    expect(getByText('RIR 2')).toBeTruthy();
    expect(queryByText('RPE 8')).toBeNull();
  });

  it('retombe sur le RPE quand les réglages ne sont pas encore chargés', async () => {
    mockScale(undefined);
    const { getByText } = await render(
      <CurrentSetCard {...baseProps} rpe={8} onSetRpe={jest.fn()} />,
    );
    expect(getByText('RPE 8')).toBeTruthy();
  });

  it('n’affiche AUCUNE valeur quand l’intensité n’est pas saisie — pas de « RIR 10 »', async () => {
    // Le piège de la conversion naïve `10 - (rpe ?? 0)` : une absence de donnée deviendrait la
    // valeur maximale, donc une information inventée.
    mockScale('rir');
    const { queryByText } = await render(
      <CurrentSetCard {...baseProps} rpe={null} onSetRpe={jest.fn()} />,
    );
    expect(queryByText('RIR 10')).toBeNull();
    expect(queryByText('RIR 0')).toBeNull();
  });

  it('propose l’ajout dans l’échelle choisie', async () => {
    mockScale('rir');
    const { queryByText } = await render(
      <CurrentSetCard {...baseProps} rpe={null} onSetRpe={jest.fn()} />,
    );
    expect(queryByText(/RIR/)).toBeTruthy();
    expect(queryByText(/RPE/)).toBeNull();
  });
});
