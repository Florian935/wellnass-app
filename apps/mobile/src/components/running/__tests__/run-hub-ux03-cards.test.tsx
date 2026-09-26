/**
 * US CARDIO-UX03 — deux cartes de Courir, testées à part : « Ton programme » (D8, R11, Q9) et
 * « La dernière fois » quand la séance n'a pas de fractions (§4.2.1).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { RunProgramCard } from '../RunProgramCard';
import { RunLastTime } from '../RunLastTime';
import { useRunIntervals } from '@/data/repositories/run-repository';

jest.mock('@/data/repositories/run-repository', () => ({
  useRunIntervals: jest.fn(() => ({ intervals: [], isLoading: false })),
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
      track: '#eadcc6',
      accent: '#2a64ad',
      accentText: '#ffffff',
    },
  }),
}));

const mockIntervals = useRunIntervals as jest.Mock;

const REC_5K = { distanceKey: '5k' as const, bestTimeSeconds: 1420 };
const PROGRES = { week: 3, totalWeeks: 8, done: 9, total: 32, ratio: 9 / 32 };

describe('Ton programme (D8, R11, Q9)', () => {
  const carte = async (race: unknown, records = [REC_5K]) =>
    render(
      <RunProgramCard
        programName="10 km en 8 semaines"
        data={{ progress: PROGRES, race: race as never }}
        records={records}
        todayKey="2026-09-25"
        onPress={jest.fn()}
      />,
    );

  it('sans échéance : l’avancement seul, ni compte à rebours ni objectif', async () => {
    await carte(null);

    expect(screen.getByText('runningHub.program.progress:{"week":3,"total":8,"done":9,"count":32}')).toBeTruthy();
    expect(screen.queryByTestId('run-program-countdown')).toBeNull();
    expect(screen.queryByTestId('run-program-objective')).toBeNull();
  });

  it('🔴 sans record à la distance : l’objectif face à l’ESTIMATION du jour, sans couleur d’alerte', async () => {
    await carte({ targetDate: '2026-11-08', targetTimeSeconds: 2940, eventName: 'Les 10 km du lac', raceDistanceM: 10000 });

    expect(screen.getByText('running.prepa.countdown:{"count":44}')).toBeTruthy();
    expect(screen.getByText('Les 10 km du lac · 08/11')).toBeTruthy();
    expect(screen.getByText('runningHub.program.estimate')).toBeTruthy();
    expect(screen.getByText('49:00')).toBeTruthy();
  });

  it('une échéance sans objectif chrono : le compte à rebours seul', async () => {
    await carte({ targetDate: '2026-11-08', targetTimeSeconds: null, eventName: null, raceDistanceM: 10000 });

    expect(screen.getByTestId('run-program-countdown')).toBeTruthy();
    expect(screen.queryByTestId('run-program-objective')).toBeNull();
  });

  it('🔴 une course passée : « Course passée », et plus d’objectif face à l’estimation', async () => {
    await carte({ targetDate: '2026-09-20', targetTimeSeconds: 2940, eventName: null, raceDistanceM: 10000 });

    expect(screen.getByText('running.prepa.past')).toBeTruthy();
    expect(screen.queryByTestId('run-program-objective')).toBeNull();
  });
});

describe('La dernière fois, sans fraction (§4.2.1)', () => {
  it('une sortie longue se dit en « distance · durée · allure · ressenti »', async () => {
    mockIntervals.mockReturnValue({ intervals: [], isLoading: false });

    await render(
      <RunLastTime
        run={{
          id: 'r-sl',
          source: 'gps',
          startedAt: '2026-09-20T09:15:00',
          finishedAt: '2026-09-20T10:22:30',
          durationSeconds: 4050,
          distanceM: 11400,
          avgPaceSPerKm: 355,
          rpe: 6,
          notes: null,
          elevationGainM: null,
          elevationLossM: null,
          terrain: 'trail',
          plannedSessionId: 'ps-sl',
          sessionId: 's-sl',
          sessionType: 'sortie_longue',
        }}
        match="type"
        onOpen={jest.fn()}
      />,
    );

    expect(screen.getByText('runningHub.lastTime.sameType')).toBeTruthy();
    expect(screen.getByText('11.4 km · 1 h 7 min 30 s · 355 s/km · workout.summary.feeling.solid')).toBeTruthy();
    expect(screen.queryByTestId('last-time-rep-1')).toBeNull();
  });
});
