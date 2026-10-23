/**
 * US CARDIO-02 (R8, R11) — la mesure du test, lue depuis la course marquée.
 *
 * Le marqueur est local et peut survivre à sa course : une course supprimée ou introuvable est
 * ignorée **à la lecture** (`useRun` ne rend pas une course supprimée), sans nettoyage ailleurs.
 */
import { renderHook } from '@testing-library/react-native';
import { appendToTrack, encodeSegment, type GpsPoint } from '@wellness/shared';

import { useCooperMeasure, usePendingCooperTest } from '../cooper-measure';
import { useRun } from '@/data/repositories/run-repository';
import { useCooperTest } from '@/stores/cooper-test-store';

jest.mock('@/data/repositories/run-repository', () => ({ useRun: jest.fn() }));
jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockUseRun = useRun as jest.Mock;

/** 15 minutes à 2 400 m / 12 min, un point toutes les 5 s, vers le nord. */
function trace(): string {
  const points: GpsPoint[] = [];
  for (let t = 0; t <= 900; t += 5) points.push({ lat: 45 + (t * (2400 / 720)) / 111_195, lng: 5, t });
  return appendToTrack('', encodeSegment(points));
}

const course = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  status: 'completed',
  gpsTrack: trace(),
  startedAt: '2026-10-23T08:00:00Z',
  finishedAt: '2026-10-23T08:15:00Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  useCooperTest.setState({ marker: { runId: 'r1', interrupted: false }, hydrated: true });
  mockUseRun.mockImplementation((id?: string) => ({ run: id === 'r1' ? course() : null, isLoading: false }));
});

it('mesure la course du test sur sa trace', async () => {
  const { result } = await renderHook(() => useCooperMeasure('r1'));
  expect(result.current.measure).toMatchObject({ status: 'ok', sPerKm: 314 });
});

it('ne lit pas une autre course', async () => {
  const { result } = await renderHook(() => useCooperMeasure('autre'));
  expect(result.current).toEqual({ run: null, measure: null });
});

it('une course pas encore close n’est pas mesurée', async () => {
  mockUseRun.mockReturnValue({ run: course({ status: 'active' }), isLoading: false });
  const { result } = await renderHook(() => useCooperMeasure('r1'));
  expect(result.current.measure).toBeNull();
});

it('🔴 le marqueur interrompu se lit dans la mesure', async () => {
  useCooperTest.setState({ marker: { runId: 'r1', interrupted: true }, hydrated: true });
  const { result } = await renderHook(() => useCooperMeasure('r1'));
  expect(result.current.measure).toEqual({ status: 'interrupted' });
});

it('usePendingCooperTest : la mesure et sa date, pour pré-remplir la porte', async () => {
  const { result } = await renderHook(() => usePendingCooperTest());
  expect(result.current?.date).toBe('2026-10-23T08:15:00Z');
  expect(Math.abs((result.current?.distanceM ?? 0) - 2400)).toBeLessThanOrEqual(2);
});

it('🔴 usePendingCooperTest : rien si la course a été supprimée', async () => {
  mockUseRun.mockReturnValue({ run: null, isLoading: false });
  const { result } = await renderHook(() => usePendingCooperTest());
  expect(result.current).toBeNull();
});
