/**
 * L'onglet Historique du hub Course (`RunHistorySection`) — US CARDIO-UX03, §4.3, R8 à R10.
 *
 * Il remplace la liste de l'ancien écran « Historique & progression » : ses tests ont déménagé ici.
 * Ce qui est vérifié : le calendrier et son résumé, la navigation bornée de mois en mois, un jour à
 * une ou deux sorties, « par type » sur tout l'historique, et une date manquante qui ne plante pas.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { RunHistorySection } from '../sections/RunHistorySection';
import { usePlannedRunningDays } from '@/data/repositories/planned-session-repository';
import type { RunHistoryItem } from '@/data/repositories/run-repository';

jest.mock('@/data/repositories/planned-session-repository', () => ({
  usePlannedRunningDays: jest.fn(() => []),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    i18n: { language: 'fr' },
  }),
}));
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatDistance: (km: number | null) => (km == null ? '—' : `${km.toFixed(1)} km`),
    formatPace: (s: number | null) => (s == null ? '—' : `${s} s/km`),
  }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      surface: '#fffaf2',
      surfaceAlt: '#e1eaf6',
      border: '#ece0cd',
      borderStrong: '#90897d',
      accent: '#2a64ad',
      accentText: '#ffffff',
      warn: '#f5e6c4',
      warnText: '#6b4c0f',
      amber: '#e0a526',
    },
  }),
}));

const mockPlanned = usePlannedRunningDays as jest.Mock;

const sortie = (id: string, finishedAt: string, over: Record<string, unknown> = {}): RunHistoryItem =>
  ({
  id,
  source: 'gps',
  startedAt: finishedAt,
  finishedAt,
  durationSeconds: 2700,
  distanceM: 8000,
  avgPaceSPerKm: 338,
  rpe: null,
  notes: null,
  elevationGainM: null,
  elevationLossM: null,
  terrain: null,
  plannedSessionId: null,
  sessionId: null,
  sessionType: null,
  ...over,
  }) as RunHistoryItem;

// De la plus récente à la plus ancienne, comme `useRunHistory`.
const RUNS = [
  sortie('sep-23a', '2026-09-23T07:40:00', { sessionType: 'endurance' }),
  sortie('sep-23b', '2026-09-23T19:10:00', { sessionType: 'endurance' }),
  sortie('sep-18', '2026-09-18T19:14:00', { sessionType: 'fractionne' }),
  sortie('sep-16', '2026-09-16T12:45:00', { distanceM: 5000, durationSeconds: 1420 }),
  sortie('aug-30', '2026-08-30T10:00:00', { sessionType: 'fractionne' }),
];

const onOpenRun = jest.fn();
const onAgain = jest.fn();

const afficher = async (props: Partial<React.ComponentProps<typeof RunHistorySection>> = {}) => {
  await render(
    <RunHistorySection
      runs={RUNS}
      todayKey="2026-09-25"
      recordCounts={new Map([['sep-16', 1]])}
      resumeDetail={null}
      onResume={jest.fn()}
      onOpenRun={onOpenRun}
      onAgain={onAgain}
      {...props}
    />,
  );
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPlanned.mockReturnValue(['2026-09-27']);
});

describe('le calendrier du mois (R8, R9)', () => {
  it('résume le mois : sorties, distance, durée, records détenus', async () => {
    await afficher();

    expect(screen.getByTestId('run-calendar-summary').props.children).toBe(
      'runningHub.history.runs:{"count":4} · 29.0 km · 2h 38',
    );
    expect(screen.getByText('runningHub.history.records:{"count":1}')).toBeTruthy();
  });

  it('les jours de sortie sont des boutons ; un jour à UNE sortie ouvre son détail', async () => {
    await afficher();

    await taper(screen.getByTestId('run-calendar-day-2026-09-18'));
    expect(onOpenRun).toHaveBeenCalledWith('sep-18');
  });

  it('🔴 un jour à DEUX sorties restreint la liste, et « Tout le mois » la rétablit', async () => {
    await afficher();

    await taper(screen.getByTestId('run-calendar-day-2026-09-23'));
    expect(onOpenRun).not.toHaveBeenCalled();
    expect(screen.getByTestId('run-row-sep-23a')).toBeTruthy();
    expect(screen.queryByTestId('run-row-sep-18')).toBeNull();

    await taper(screen.getByTestId('run-history-whole-month'));
    expect(screen.getByTestId('run-row-sep-18')).toBeTruthy();
  });

  it('les flèches s’arrêtent au mois de la première sortie et au mois courant', async () => {
    await afficher();

    expect(screen.getByTestId('run-calendar-next').props.accessibilityState).toMatchObject({ disabled: true });
    await taper(screen.getByTestId('run-calendar-prev'));
    expect(screen.getByTestId('run-row-aug-30')).toBeTruthy();
    expect(screen.getByTestId('run-calendar-prev').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('un mois sans sortie le dit', async () => {
    await afficher({ runs: [] });

    expect(screen.getAllByText('runningHub.history.emptyMonth').length).toBeGreaterThan(0);
  });

  it('les séances prévues à venir sont demandées à partir d’aujourd’hui', async () => {
    await afficher();

    expect(mockPlanned).toHaveBeenCalledWith('2026-09-25', '2026-09-30');
  });
});

describe('les sorties', () => {
  it('une ligne ouvre le détail ; Recourir repart contre elle', async () => {
    await afficher();

    await taper(screen.getByTestId('run-row-sep-18'));
    expect(onOpenRun).toHaveBeenCalledWith('sep-18');

    await taper(screen.getByTestId('run-again-sep-18'));
    expect(onAgain).toHaveBeenCalledWith('sep-18');
  });

  it('🔴 une course sans date de fin se range à son début, sans « Invalid Date »', async () => {
    await afficher({ runs: [sortie('sans-fin', '2026-09-20T09:00:00', { finishedAt: null })] });

    expect(screen.getByTestId('run-row-sans-fin')).toBeTruthy();
    expect(screen.queryByText(/Invalid/)).toBeNull();
  });
});

describe('par type (R10)', () => {
  it('🔴 chaque type couru, du plus récent au plus ancien ; un appui filtre sur TOUT l’historique', async () => {
    await afficher();

    await taper(screen.getByTestId('run-history-tab-byType'));
    const rows = screen.getAllByTestId(/^run-history-type-/);
    expect(rows.map((r) => r.props.testID)).toEqual([
      'run-history-type-endurance',
      'run-history-type-fractionne',
      'run-history-type-free',
    ]);

    await taper(screen.getByTestId('run-history-type-fractionne'));
    // Août compris : le filtre porte sur tout l'historique, pas sur le mois affiché.
    expect(screen.getByTestId('run-row-sep-18')).toBeTruthy();
    expect(screen.getByTestId('run-row-aug-30')).toBeTruthy();
    expect(screen.queryByTestId('run-row-sep-23a')).toBeNull();

    await taper(screen.getByTestId('run-history-clear-type'));
    expect(screen.getByTestId('run-row-sep-23a')).toBeTruthy();
  });
});

describe('pendant une course', () => {
  it('porte la ligne « Reprendre »', async () => {
    const onResume = jest.fn();
    await afficher({ resumeDetail: '3,4 km', onResume });

    await taper(screen.getByTestId('run-resume-line'));
    expect(onResume).toHaveBeenCalled();
  });
});
