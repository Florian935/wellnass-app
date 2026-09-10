/**
 * US UX-05 — la carte « série en cours » affiche l'intensité dans l'échelle choisie.
 *
 * Ce qui est vérifié est le **contrat de l'US** :
 *  - en mode RIR, c'est « RIR » qui s'affiche, et les valeurs proposées sont celles de l'échelle ;
 *  - choisir une valeur RIR **stocke le RPE correspondant** — la donnée en base ne change jamais de
 *    nature, c'est tout le principe de l'US ;
 *  - une intensité **non saisie** reste non saisie : elle ne devient pas « RIR 10 ».
 *
 * ── Adapté le 10/09/2026 (US MUSCU-UX01) ────────────────────────────────────────────────────────
 * Le sélecteur d'intensité vit désormais dans le **repli des suppléments**, avec le type de série,
 * la note et le superset : ils servent à quelques séries par séance, pas à toutes. Les tests
 * ouvrent donc le repli avant de vérifier. Le contrat de l'US UX-05, lui, est inchangé.
 *
 * `useSettings` est mocké pour piloter l'échelle sans passer par PowerSync.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import '@/i18n';

import { CurrentSetCard } from '../CurrentSetCard';
import { palettes } from '@/theme/colors';
import { useSettings } from '@/data/repositories/settings-repository';
import fr from '@/i18n/locales/fr.json';

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
  sets: [
    { id: 's1', done: false, label: null },
    { id: 's2', done: false, label: null },
    { id: 's3', done: false, label: null },
  ],
  currentRang: 0,
  restSeconds: 90,
  lastPerfLabel: null,
  setType: 'normal' as const,
  onSetType: jest.fn(),
  onAddSet: jest.fn(),
  level: 'detailed' as const,
  note: '',
  colors,
};

/** Rend la carte et ouvre le repli des suppléments, où vit le sélecteur d'intensité. */
const renderOuvert = async (props: Partial<React.ComponentProps<typeof CurrentSetCard>> = {}) => {
  const vue = await render(
    <CurrentSetCard {...baseProps} rpe={null} onSetRpe={jest.fn()} {...props} />,
  );
  // `act` : sans lui, le `setState` du repli n'est pas appliqué avant l'assertion suivante.
  await act(async () => {
    fireEvent.press(vue.getByText(fr.workout.extras.title));
  });
  return vue;
};

describe('CurrentSetCard — échelle d’intensité (UX-05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScale(undefined);
  });

  it('annonce l’échelle RPE quand c’est celle qui est choisie', async () => {
    mockScale('rpe');
    const { getByText } = await renderOuvert({ rpe: 8 });

    expect(getByText('RPE série')).toBeTruthy();
  });

  it('annonce l’échelle RIR quand c’est celle qui est choisie', async () => {
    mockScale('rir');
    const { getByText } = await renderOuvert({ rpe: 8 });

    expect(getByText('RIR série')).toBeTruthy();
  });

  it('🔴 en RIR, sélectionner « 2 » stocke le RPE 8 — la base ne change pas de nature', async () => {
    mockScale('rir');
    const onSetRpe = jest.fn();
    const { getByLabelText } = await renderOuvert({ rpe: null, onSetRpe });

    fireEvent.press(getByLabelText('RIR 2'));

    // C'est tout le principe de l'US : le RIR n'est jamais stocké, seulement affiché.
    expect(onSetRpe).toHaveBeenCalledWith(8);
  });

  it('en RPE, sélectionner « 8 » stocke 8', async () => {
    mockScale('rpe');
    const onSetRpe = jest.fn();
    const { getByLabelText } = await renderOuvert({ rpe: null, onSetRpe });

    fireEvent.press(getByLabelText('RPE 8'));

    expect(onSetRpe).toHaveBeenCalledWith(8);
  });

  it('retombe sur le RPE quand les réglages ne sont pas encore chargés', async () => {
    mockScale(undefined);
    const { getByText } = await renderOuvert({ rpe: 8 });

    expect(getByText('RPE série')).toBeTruthy();
  });

  it('🔴 une intensité NON saisie n’est marquée nulle part — pas de « RIR 10 » fantôme', async () => {
    // Le piège de la conversion naïve `10 - (rpe ?? 0)` : une absence de donnée deviendrait la
    // valeur maximale de l'échelle.
    mockScale('rir');
    const { getByLabelText } = await renderOuvert({ rpe: null });

    for (const value of [0, 2, 9]) {
      expect(getByLabelText(`RIR ${value}`).props.accessibilityState?.selected).toBe(
        false,
      );
    }
  });

  it('retaper la valeur déjà posée l’efface', async () => {
    // Sans cela, il faudrait un bouton « effacer » de plus dans un repli déjà dense.
    mockScale('rpe');
    const onSetRpe = jest.fn();
    const { getByLabelText } = await renderOuvert({ rpe: 8, onSetRpe });

    fireEvent.press(getByLabelText('RPE 8'));

    expect(onSetRpe).toHaveBeenCalledWith(null);
  });
});
