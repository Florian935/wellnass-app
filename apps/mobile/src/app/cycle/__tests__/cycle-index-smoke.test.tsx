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
  autoCloseStalePeriods,
  useMenstrualPeriods,
  useOpenPeriod,
  useTodayMenstrualLog,
} from '@/data/repositories/menstrual-cycle-repository';
import { useSettings } from '@/data/repositories/settings-repository';
import { Redirect } from 'expo-router';

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

// L'écran appelle `pushCycleData` en fire-and-forget après clôture d'une période (R20/D) : sans ce
// mock, le vrai module remonte jusqu'à `@/i18n` (via settings-repository) et plante hors contexte
// i18next mocké ici — même piège que documenté dans cycle-insights-smoke.test.tsx.
jest.mock('@/lib/health-connect', () => ({ pushCycleData: jest.fn() }));

jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-07-31' }));

// Le garde d'accès (`CycleTrackingGuard`) lit les réglages : on mocke le repository plutôt que le
// garde, pour que le **vrai** garde s'exécute et que les tests ci-dessous le couvrent.
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: jest.fn(() => ({ settings: { cycleTrackingEnabled: true }, isLoading: false })),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  // Rend `null` (le renderer RN refuse une chaîne nue) mais reste observable : c'est l'appel qui
  // prouve la redirection, pas un texte à l'écran.
  Redirect: jest.fn(() => null),
}));

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
const mockUseSettings = useSettings as unknown as jest.Mock;
const mockRedirect = Redirect as unknown as jest.Mock;
const mockAutoClose = autoCloseStalePeriods as jest.Mock;

describe('CycleScreen — smoke', () => {
  beforeEach(() => {
    mockUseMenstrualPeriods.mockReturnValue({ periods: [], isLoading: false });
    mockUseOpenPeriod.mockReturnValue({ period: null, isLoading: false });
    mockUseTodayMenstrualLog.mockReturnValue({ log: null, isLoading: false });
    mockUseSettings.mockReturnValue({
      settings: { cycleTrackingEnabled: true },
      isLoading: false,
    });
  });

  /**
   * Non-régression du défaut trouvé en recette device du 31/07/2026 : la route s'ouvrait
   * entièrement suivi éteint, alors que le critère 1 exige « aucune route atteignable ».
   */
  describe("garde d'accès (critère 1)", () => {
    beforeEach(() => mockRedirect.mockClear());

    it('suivi désactivé → redirige, et ne rend aucun contenu de cycle', async () => {
      mockUseSettings.mockReturnValue({
        settings: { cycleTrackingEnabled: false },
        isLoading: false,
      });
      const { queryByText } = await render(<CycleScreen />);
      expect(mockRedirect).toHaveBeenCalled();
      expect(queryByText('cycle.disclaimer')).toBeNull();
    });

    it('réglages absents (compte neuf) → redirige, pas d’accès par défaut', async () => {
      mockUseSettings.mockReturnValue({ settings: null, isLoading: false });
      const { queryByText } = await render(<CycleScreen />);
      expect(mockRedirect).toHaveBeenCalled();
      expect(queryByText('cycle.disclaimer')).toBeNull();
    });

    it('réglages en cours de chargement → on ne redirige PAS (sinon faux négatif)', async () => {
      mockUseSettings.mockReturnValue({ settings: null, isLoading: true });
      await render(<CycleScreen />);
      expect(mockRedirect).not.toHaveBeenCalled();
    });
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

  /**
   * R3 — la clôture d'office des périodes oubliées se déclenche **à l'ouverture de l'écran**, pas
   * sur un minuteur : c'est une correction de saisie, pas un fait à horodater.
   *
   * ⚠️ L'`await` devant `render` n'est pas décoratif : `render` de RNTL 14 renvoie une **promesse**,
   * et c'est lui qui exécute les effets de montage (§3.6). Sans `await`, l'écran serait monté sans
   * avoir rien exécuté et ces deux assertions ne vérifieraient rien.
   */
  describe('clôture des périodes oubliées à l’ouverture (R3)', () => {
    beforeEach(() => mockAutoClose.mockClear());

    it('déclenche la clôture d’office avec le jour courant', async () => {
      await render(<CycleScreen />);

      expect(mockAutoClose).toHaveBeenCalledWith('2026-07-31');
    });

    it('ne la déclenche PAS quand le suivi est désactivé — l’écran redirige avant', async () => {
      mockUseSettings.mockReturnValue({
        settings: { cycleTrackingEnabled: false },
        isLoading: false,
      });

      await render(<CycleScreen />);

      // Écrire dans une donnée de santé sensible sur un écran auquel on n'a pas accès serait le
      // pire des deux mondes : invisible et non consenti.
      expect(mockAutoClose).not.toHaveBeenCalled();
    });
  });
});
