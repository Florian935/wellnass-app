/**
 * US CYCLE-01 — smoke test du widget de suivi de cycle (3 formes).
 *
 * Même stratégie de mock que `StreakCard.test.tsx` : repository, i18n, thème et navigation
 * isolés pour ne dépendre ni de PowerSync ni du natif.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { CycleCard } from '../CycleCard';
import {
  useMenstrualDailyLogs,
  useMenstrualPeriods,
  useOpenPeriod,
} from '@/data/repositories/menstrual-cycle-repository';

jest.mock('@/data/repositories/menstrual-cycle-repository', () => ({
  useMenstrualPeriods: jest.fn(() => ({ periods: [], isLoading: false })),
  useOpenPeriod: jest.fn(() => ({ period: null, isLoading: false })),
  useMenstrualDailyLogs: jest.fn(() => ({ logs: [], isLoading: false })),
}));

jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-07-31' }));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      accent: '#c0562f',
      accentText: '#ffffff',
      border: '#ece0cd',
      surfaceAlt: '#f3ddd0',
    },
  }),
}));

const mockUseMenstrualPeriods = useMenstrualPeriods as jest.Mock;
const mockUseOpenPeriod = useOpenPeriod as jest.Mock;
const mockUseMenstrualDailyLogs = useMenstrualDailyLogs as jest.Mock;

describe('CycleCard', () => {
  beforeEach(() => {
    mockUseMenstrualPeriods.mockReturnValue({ periods: [], isLoading: false });
    mockUseOpenPeriod.mockReturnValue({ period: null, isLoading: false });
    mockUseMenstrualDailyLogs.mockReturnValue({ logs: [], isLoading: false });
  });

  it('aucune donnée → invitation à démarrer, pas une carte morte', async () => {
    const { getByText } = await render(<CycleCard size="wide" />);
    expect(getByText('cycle.widget.emptyPrompt')).toBeTruthy();
  });

  it('avec un cycle en cours (small) → affiche le jour du cycle', async () => {
    mockUseMenstrualPeriods.mockReturnValue({
      periods: [{ id: 'p1', startedOn: '2026-07-28', endedOn: null }],
      isLoading: false,
    });
    const { getByText } = await render(<CycleCard size="small" />);
    // t est un passthrough avec params → la clé + le jour calculé sont visibles dans le libellé.
    expect(getByText(/cycle\.widget\.dayOfCycle/)).toBeTruthy();
  });

  it('forme large, sans période ouverte → pas de bande de jours, juste le CTA', async () => {
    mockUseMenstrualPeriods.mockReturnValue({
      periods: [{ id: 'p1', startedOn: '2026-06-01', endedOn: '2026-06-05' }],
      isLoading: false,
    });
    const { getByText, queryByLabelText } = await render(<CycleCard size="large" />);
    expect(getByText('cycle.widget.logToday')).toBeTruthy();
    expect(queryByLabelText('cycle.widget.periodStripA11y')).toBeNull();
  });

  it('forme large, avec une période ouverte → la bande de jours est rendue', async () => {
    mockUseMenstrualPeriods.mockReturnValue({
      periods: [{ id: 'p1', startedOn: '2026-07-29', endedOn: null }],
      isLoading: false,
    });
    mockUseOpenPeriod.mockReturnValue({
      period: { id: 'p1', startedOn: '2026-07-29', endedOn: null },
      isLoading: false,
    });
    const { getByLabelText } = await render(<CycleCard size="large" />);
    expect(getByLabelText('cycle.widget.periodStripA11y')).toBeTruthy();
  });

  it('isLoading → ne rend rien (pas de flash de contenu vide)', async () => {
    mockUseMenstrualPeriods.mockReturnValue({ periods: [], isLoading: true });
    const { toJSON } = await render(<CycleCard size="wide" />);
    expect(toJSON()).toBeNull();
  });
});
