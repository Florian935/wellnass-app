/**
 * US DASH-01 (§4.3) — les trois cartes que le hub course gagne : km par km, chronos prédits, charge.
 *
 * Ce qui est vérifié est la **règle de silence** de chacune (une carte qui n'a rien à dire ne se
 * rend pas) et le seul geste qu'elles offrent. Les calculs eux-mêmes sont testés dans
 * `@wellness/shared` — on ne les reteste pas ici.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { appendToTrack, encodeSegment, type GpsPoint } from '@wellness/shared';
import { RunSplitsCard } from '../RunSplitsCard';
import { RunPredictionsCard } from '../RunPredictionsCard';
import { RunLoadCard } from '../RunLoadCard';
import { useRun, useRunHistory, useRunTarget } from '@/data/repositories/run-repository';
import { useRunningRecords } from '@/data/repositories/running-record-repository';

jest.mock('@/data/repositories/run-repository', () => ({
  useRun: jest.fn(() => ({ run: null, isLoading: false })),
  useRunTarget: jest.fn(() => null),
  useRunHistory: jest.fn(() => ({ runs: [], isLoading: false })),
}));
jest.mock('@/data/repositories/running-record-repository', () => ({
  useRunningRecords: jest.fn(() => ({ records: [], isLoading: false })),
}));
jest.mock('@/hooks/useTodayKey', () => ({
  useWindowStartKey: jest.fn((days: number) => (days === 7 ? '2026-08-06' : '2026-07-16')),
  // La confiance d'une prédiction dépend de l'âge du record : l'horloge est figée ici.
  useTodayDate: () => new Date(2026, 7, 12),
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      track: '#ece0cd',
      accent: '#c0562f',
      success: '#4c7a3f',
      warnText: '#8a4b12',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatPace: (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`),
    formatDistance: (km: number) => `${km} km`,
    distanceSymbol: 'km',
  }),
}));

const mockRun = useRun as jest.Mock;
const mockTarget = useRunTarget as jest.Mock;
const mockHistory = useRunHistory as jest.Mock;
const mockRecords = useRunningRecords as jest.Mock;

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/**
 * Une trace droite de `km` kilomètres, à `paceSPerKm` par kilomètre — de quoi produire des splits
 * réels plutôt que de simuler `computeKmSplits` (la brique est la vraie, comme sur device).
 */
function trackOf(km: number, paceSPerKm: number): string {
  const points: GpsPoint[] = [];
  // `GpsPoint.t` est en **secondes depuis le départ** (pas un timestamp) — cf. `running.ts`.
  const metersPerDegree = 111_320;
  for (let meter = 0; meter <= km * 1000; meter += 100) {
    points.push({
      lat: 45 + meter / metersPerDegree,
      lng: 3,
      t: (meter / 1000) * paceSPerKm,
    });
  }
  return appendToTrack('', encodeSegment(points));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRun.mockReturnValue({ run: null, isLoading: false });
  mockTarget.mockReturnValue(null);
  mockHistory.mockReturnValue({ runs: [], isLoading: false });
  mockRecords.mockReturnValue({ records: [], isLoading: false });
});

describe('Km par km', () => {
  it('🔴 se tait sans trace GPS exploitable', async () => {
    await render(<RunSplitsCard runId={null} plannedSessionId={null} onOpen={jest.fn()} />);

    expect(screen.queryByTestId('run-splits-card')).toBeNull();
  });

  it('un kilomètre par barre, et un tap dit son écart', async () => {
    // 3,4 km parcourus : trois kilomètres PLEINS (le dernier tronçon partiel n'en est pas un).
    mockRun.mockReturnValue({ run: { id: 'r-1', gpsTrack: trackOf(3.4, 300) }, isLoading: false });
    await render(<RunSplitsCard runId="r-1" plannedSessionId={null} onOpen={jest.fn()} />);

    expect(screen.getByTestId('run-splits-card')).toBeTruthy();
    expect(screen.getAllByLabelText(/stage\.running\.splits\.kmA11y/)).toHaveLength(3);

    await taper(screen.getAllByLabelText(/stage\.running\.splits\.kmA11y/)[0]!);
    expect(screen.getByText(/stage\.running\.splits\.(onPace|faster|slower)/)).toBeTruthy();
  });

  it('la référence est la plage visée quand la séance en avait une', async () => {
    mockRun.mockReturnValue({ run: { id: 'r-1', gpsTrack: trackOf(3.4, 300) }, isLoading: false });
    mockTarget.mockReturnValue({
      targetDistanceM: 3000,
      targetDurationSeconds: null,
      targetPaceMinSPerKm: 280,
      targetPaceMaxSPerKm: 300,
      targetTimeSeconds: null,
    });
    await render(<RunSplitsCard runId="r-1" plannedSessionId="ps-1" onOpen={jest.fn()} />);

    // Sans sélection, la carte dit à quoi elle compare — ici l'allure demandée, pas la moyenne.
    expect(screen.getByText(/stage\.running\.splits\.hintTarget/)).toBeTruthy();
  });
});

describe('Chronos prédits', () => {
  it('🔴 se tait sans record de 5 km', async () => {
    await render(<RunPredictionsCard onOpen={jest.fn()} />);

    expect(screen.queryByTestId('run-predictions-card')).toBeNull();
  });

  it('projette les distances non encore courues', async () => {
    mockRecords.mockReturnValue({
      records: [{ distanceKey: '5k', bestTimeSeconds: 1320, runId: 'r-1', achievedAt: '2026-08-01T10:00:00.000Z' }],
      isLoading: false,
    });
    const onOpen = jest.fn();
    await render(<RunPredictionsCard onOpen={onOpen} />);

    expect(screen.getByLabelText(/running\.records\.distance10k/)).toBeTruthy();
    await taper(screen.getByTestId('run-predictions-card'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('Charge', () => {
  it('🔴 se tait sans charge chronique — quatre semaines sont le minimum du calcul', async () => {
    await render(<RunLoadCard onOpen={jest.fn()} />);

    expect(screen.queryByTestId('run-load-card')).toBeNull();
  });

  it('situe le ratio et nomme sa zone', async () => {
    // Quatre sorties identiques sur 28 jours, dont une dans les 7 derniers : charge stable.
    mockHistory.mockReturnValue({
      runs: [
        { finishedAt: '2026-08-10T10:00:00.000Z', rpe: 6, durationSeconds: 3600 },
        { finishedAt: '2026-08-01T10:00:00.000Z', rpe: 6, durationSeconds: 3600 },
        { finishedAt: '2026-07-25T10:00:00.000Z', rpe: 6, durationSeconds: 3600 },
        { finishedAt: '2026-07-18T10:00:00.000Z', rpe: 6, durationSeconds: 3600 },
      ],
      isLoading: false,
    });
    await render(<RunLoadCard onOpen={jest.fn()} />);

    expect(screen.getByTestId('run-load-card')).toBeTruthy();
    expect(screen.getByLabelText(/stage\.running\.load\.a11y/)).toBeTruthy();
  });
});
