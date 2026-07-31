/**
 * US CYCLE-01 — smoke test de l'écran de détail (`app/cycle/index.tsx`).
 *
 * Ce qui compte ici, précisément parce que c'est une donnée de santé sensible (spec §0) :
 *  1. Le bandeau d'avertissement est TOUJOURS rendu, quel que soit l'état des données.
 *  2. L'écran ne plante pas, avec ou sans historique.
 * Le calendrier et la feuille de saisie sont testés séparément (`CycleMonthCalendar.test.tsx`) :
 * ils sont stubbés ici pour isoler ce que cet écran ajoute par-dessus (bandeau, actions, historique).
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import CycleScreen from '../index';
import {
  useMenstrualPeriods,
  useOpenPeriod,
  useTodayMenstrualLog,
} from '@/data/repositories/menstrual-cycle-repository';

jest.mock('@/data/repositories/menstrual-cycle-repository', () => ({
  useMenstrualPeriods: jest.fn(() => ({ periods: [], isLoading: false })),
  useOpenPeriod: jest.fn(() => ({ period: null, isLoading: false })),
  useTodayMenstrualLog: jest.fn(() => ({ log: null, isLoading: false })),
  useMenstrualDailyLogs: jest.fn(() => ({ logs: [], isLoading: false })),
  autoCloseStalePeriods: jest.fn().mockResolvedValue(0),
  startPeriod: jest.fn(),
  endPeriod: jest.fn(),
  getMenstrualLogForDay: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/components/cycle/CycleDaySheet', () => ({ CycleDaySheet: () => null }));
jest.mock('@/components/cycle/CycleMonthCalendar', () => ({ CycleMonthCalendar: () => null }));

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
      border: '#ece0cd',
      warn: '#fbf1dd',
      warnBorder: '#b5761f',
      warnText: '#b5761f',
      surface: '#fffaf2',
    },
  }),
}));

const mockUseMenstrualPeriods = useMenstrualPeriods as jest.Mock;
const mockUseOpenPeriod = useOpenPeriod as jest.Mock;
const mockUseTodayMenstrualLog = useTodayMenstrualLog as jest.Mock;

describe('CycleScreen — smoke', () => {
  beforeEach(() => {
    mockUseMenstrualPeriods.mockReturnValue({ periods: [], isLoading: false });
    mockUseOpenPeriod.mockReturnValue({ period: null, isLoading: false });
    mockUseTodayMenstrualLog.mockReturnValue({ log: null, isLoading: false });
  });

  it("le bandeau d'avertissement est rendu même sans aucune donnée (§0, critère 14)", async () => {
    const { getByText } = await render(<CycleScreen />);
    expect(getByText('cycle.disclaimer')).toBeTruthy();
  });

  it("le bandeau d'avertissement est rendu aussi avec un historique chargé", async () => {
    mockUseMenstrualPeriods.mockReturnValue({
      periods: [
        { id: 'p1', startedOn: '2026-05-01', endedOn: '2026-05-04' },
        { id: 'p2', startedOn: '2026-06-01', endedOn: '2026-06-05' },
      ],
      isLoading: false,
    });
    const { getByText } = await render(<CycleScreen />);
    expect(getByText('cycle.disclaimer')).toBeTruthy();
  });

  it('aucune période enregistrée → état vide explicite, pas un écran silencieux', async () => {
    const { getByText } = await render(<CycleScreen />);
    expect(getByText('cycle.history.empty')).toBeTruthy();
  });

  it('isLoading → ne rend rien (pas de flash), aucun crash', async () => {
    mockUseMenstrualPeriods.mockReturnValue({ periods: [], isLoading: true });
    const { toJSON } = await render(<CycleScreen />);
    expect(toJSON()).toBeNull();
  });
});
