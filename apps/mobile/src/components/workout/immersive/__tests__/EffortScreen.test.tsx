/**
 * La série en cours — repensée par MUSCU-FIX02, passe 2 (recette du 23/09/2026).
 *
 * L'écran demandait de « toucher à chaque répétition » : impossible en soulevant. Il devient un
 * écran à regarder — objectif, disques par côté, chrono, la dernière fois, la consigne — avec un
 * seul geste, à la fin.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { EffortScreen } from '../EffortScreen';
import { makeRuntime, seedEntry, type RuntimeOverrides } from '@/test-utils/immersive-runtime';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}|${JSON.stringify(vars)}` : key,
    i18n: { language: 'fr' },
  }),
}));

const monter = async (over: RuntimeOverrides = {}, props: { startedAt?: number; onDone?: () => void } = {}) =>
  render(
    <EffortScreen
      runtime={makeRuntime(over)}
      startedAt={props.startedAt ?? Date.now()}
      onDone={props.onDone ?? jest.fn()}
    />,
  );

describe('la série en cours', () => {
  it('🔴 ne demande plus de toucher à chaque répétition', async () => {
    await monter();

    expect(screen.queryByText(/immersive\.effort\.hint/)).toBeNull();
    expect(screen.queryByText(/countA11y/)).toBeNull();
  });

  it('affiche l’objectif en grand : la charge × les répétitions', async () => {
    await monter({ displayWeightKg: 82.5, displayReps: '8' });

    expect(screen.getByTestId('effort-target').props.children).toBe(
      'immersive.effort.target|{"weight":"82.5 kg","reps":8}',
    );
  });

  it('rappelle les disques par côté sur un exercice à la barre', async () => {
    await monter({ showBarbell: true, displayWeightKg: 100, prefs: { barKg: 20 } });

    expect(screen.getByText(/immersive\.bar\.perSide/)).toBeTruthy();
    expect(screen.getByText(/"plates":"25 \+ 15"/)).toBeTruthy();
  });

  it('ne parle pas de disques hors barre', async () => {
    await monter({ showBarbell: false, displayWeightKg: 100 });

    expect(screen.queryByText(/immersive\.bar\./)).toBeNull();
  });

  it('montre la même série, la dernière fois — ce qu’il faut battre', async () => {
    const entries = [seedEntry('ex-1', 'Squat', [{}, {}])];
    await monter({
      entries,
      current: { entry: entries[0]!, rang: 1, set: entries[0]!.sets[1]! },
      references: {
        'ex-1': {
          finishedAt: '2026-09-20T10:00:00.000Z',
          sets: [
            { setType: 'normal', reps: 10, weightKg: 55, durationSeconds: null },
            { setType: 'normal', reps: 8, weightKg: 57.5, durationSeconds: null },
          ],
        },
      },
    });

    expect(screen.getByText('immersive.effort.last|{"value":"57.5 kg × 8"}')).toBeTruthy();
  });

  it('fait courir le chrono de la série', async () => {
    await monter({}, { startedAt: Date.now() - 65_000 });

    expect(screen.getByTestId('effort-clock').props.children).toMatch(/^1:0[5-6]$/);
  });

  it('un seul geste, à la fin : « Série terminée »', async () => {
    const onDone = jest.fn();
    await monter({}, { onDone });

    await act(async () => fireEvent.press(screen.getByTestId('effort-done')));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('série à la durée : compte à rebours, et le cadran s’ouvre tout seul à zéro', async () => {
    const onDone = jest.fn();
    await monter(
      { currentSetType: 'duration', displayDurationSeconds: 30, durationValue: '0:30' },
      { startedAt: Date.now() - 31_000, onDone },
    );

    expect(screen.getByTestId('effort-clock').props.children).toBe('0:00');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
