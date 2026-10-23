/**
 * US CARDIO-02 (R10) — le test de 12 minutes pendant la course : deux annonces, une interruption.
 *
 *  - 11:00 et 12:00, une fois chacune, voix ET vibration — même annonces coupées (D2) ;
 *  - rien au montage (revenir sur l'écran ne rejoue rien), rien pour une autre course ;
 *  - une pause avant 12:00 interrompt le test, et plus rien ne parle ; après 12:00, elle est sans effet.
 */
import { renderHook } from '@testing-library/react-native';
import { Vibration } from 'react-native';
import * as Speech from 'expo-speech';

import { useCooperGuidance } from '../cooper-guidance';
import { useCooperTest } from '@/stores/cooper-test-store';

jest.mock('expo-speech', () => ({ speak: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/running/cooper-measure', () => ({
  useCooperMarker: () => require('@/stores/cooper-test-store').useCooperTest((s: { marker: unknown }) => s.marker),
}));

const speak = Speech.speak as jest.Mock;
let vibrate: jest.SpyInstance;

type Props = { runId: string | null; netSeconds: number; paused: boolean };
const monter = (props: Props) =>
  renderHook((p: Props) => useCooperGuidance(p), { initialProps: props });

beforeEach(() => {
  jest.clearAllMocks();
  vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
  useCooperTest.setState({ marker: { runId: 'r1', interrupted: false }, hydrated: true });
});

afterEach(() => vibrate.mockRestore());

it('rien pour une course qui n’est pas celle du test', async () => {
  const { result } = await monter({ runId: 'autre', netSeconds: 700, paused: false });
  expect(result.current).toEqual({ active: false });
});

it('🔴 annonce 11:00 puis 12:00, une seule fois chacune, voix et vibration', async () => {
  const { result, rerender } = await monter({ runId: 'r1', netSeconds: 462, paused: false });
  expect(result.current).toEqual({ active: true, phase: 'running', remainingS: 258 });
  expect(speak).not.toHaveBeenCalled();

  await rerender({ runId: 'r1', netSeconds: 660, paused: false });
  await rerender({ runId: 'r1', netSeconds: 661, paused: false });
  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak).toHaveBeenLastCalledWith('running.cooper.voice.lastMinute');

  await rerender({ runId: 'r1', netSeconds: 720, paused: false });
  await rerender({ runId: 'r1', netSeconds: 760, paused: false });
  expect(speak).toHaveBeenCalledTimes(2);
  expect(speak).toHaveBeenLastCalledWith('running.cooper.voice.done');
  expect(vibrate).toHaveBeenCalledTimes(2);
});

it('🔴 au montage, on adopte l’état sans parler', async () => {
  await monter({ runId: 'r1', netSeconds: 700, paused: false });
  expect(speak).not.toHaveBeenCalled();
  expect(vibrate).not.toHaveBeenCalled();
});

it('un saut direct au-delà de 12:00 ne dit que « terminé »', async () => {
  const { rerender } = await monter({ runId: 'r1', netSeconds: 500, paused: false });
  await rerender({ runId: 'r1', netSeconds: 800, paused: false });
  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak).toHaveBeenCalledWith('running.cooper.voice.done');
});

it('🔴 une pause avant 12:00 interrompt le test, et plus rien ne parle', async () => {
  const { result, rerender } = await monter({ runId: 'r1', netSeconds: 300, paused: false });
  await rerender({ runId: 'r1', netSeconds: 300, paused: true });
  expect(useCooperTest.getState().marker).toEqual({ runId: 'r1', interrupted: true });

  await rerender({ runId: 'r1', netSeconds: 760, paused: false });
  expect(result.current).toMatchObject({ active: true, phase: 'interrupted' });
  expect(speak).not.toHaveBeenCalled();
});

it('une pause après 12:00 ne change rien au test', async () => {
  const { rerender } = await monter({ runId: 'r1', netSeconds: 740, paused: false });
  await rerender({ runId: 'r1', netSeconds: 740, paused: true });
  expect(useCooperTest.getState().marker?.interrupted).toBe(false);
});
