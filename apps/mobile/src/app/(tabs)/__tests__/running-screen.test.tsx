/**
 * Hub Course (`app/(tabs)/running.tsx`) — le **vrai** écran, monté.
 *
 * ── Réécrit le 25/09/2026 (US CARDIO-UX03) ──────────────────────────────────────────────────────
 * Le hub passe en **trois onglets** : Courir, Historique, Progrès. Ce fichier vérifie ce qui est
 * propre à l'écran :
 *  - l'onglet affiché (D1) : Courir à froid, le paramètre `section` lu puis effacé, la mémoire ;
 *  - la carte du moment rend l'état qu'on lui donne, avec ses gestes (§4.2-1) — plus de « Voir le
 *    détail » (qui ouvrait le planning) ni de « Ma semaine » sous l'arrivée (qui ouvrait l'historique) ;
 *  - la dernière fois de la même séance (D3), les trois dernières sorties et Recourir (D4) ;
 *  - pendant une course, rien d'autre que Reprendre dans Courir, et une ligne Reprendre ailleurs ;
 *  - Progrès monte les cartes d'analyse et « Toutes tes stats », ou un seul message sans sortie ;
 *  - **la garde de CARDIO-UX02 est conservée** : « Ta semaine » lit le dénominateur `goalCount`.
 *
 * Les cartes d'analyse ont leurs propres tests : ici, des sondes.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunningScreen from '../running';
import {
  useActiveRun,
  useIntervalBlocksForRun,
  useRunHistory,
  useRunIntervals,
  useTodayRunSession,
} from '@/data/repositories/run-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useRunProgram } from '@/data/repositories/run-hub-repository';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRunSection } from '@/stores/run-section-store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));

jest.mock('@/data/repositories/run-repository', () => ({
  useActiveRun: jest.fn(() => ({ run: null, isLoading: false })),
  useTodayRunSession: jest.fn(() => ({ session: null, isLoading: false })),
  useIntervalBlocksForRun: jest.fn(() => ({ sessionType: null, blocks: [] })),
  useRunHistory: jest.fn(() => ({ runs: [], isLoading: false })),
  useRunIntervals: jest.fn(() => ({ intervals: [], isLoading: false })),
}));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  useWeekPlan: jest.fn(() => ({ items: [], isLoading: false })),
  usePlannedRunningDays: jest.fn(() => []),
}));
jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(() => ({ runnerProfile: null, isLoading: false })),
}));
jest.mock('@/data/repositories/program-repository', () => ({
  useActiveProgram: jest.fn(() => ({ program: null, isLoading: false })),
}));
jest.mock('@/data/repositories/run-hub-repository', () => ({
  useRunProgram: jest.fn(() => ({ progress: null, race: null })),
}));
jest.mock('@/data/repositories/session-adaptation-repository', () => ({
  useSessionAdaptation: jest.fn(() => null),
}));
jest.mock('@/data/repositories/running-record-repository', () => ({
  useRunningRecords: jest.fn(() => ({ records: [], isLoading: false })),
}));

// Les cartes d'analyse : des sondes. Chacune a son propre fichier de test.
//
// ⚠️ Chaque fabrique est écrite **en entier** : jest hisse les appels `jest.mock` au-dessus des
// imports, et une fabrique qui référence une variable du module échoue au chargement.
jest.mock('@/components/running/SessionAdaptationCard', () => ({ SessionAdaptationCard: () => null }));
jest.mock('@/components/running/RunThread', () => {
  const { Text } = require('react-native');
  return { RunThread: () => <Text>sonde-fil</Text> };
});
jest.mock('@/components/running/PaceProgressCard', () => {
  const { Text } = require('react-native');
  return { PaceProgressCard: () => <Text>sonde-allure</Text> };
});
jest.mock('@/components/running/RunEngineCard', () => {
  const { Text } = require('react-native');
  return { RunEngineCard: () => <Text>sonde-moteur</Text> };
});
jest.mock('@/components/running/RunRecordWall', () => {
  const { Text } = require('react-native');
  return { RunRecordWall: () => <Text>sonde-records</Text> };
});
jest.mock('@/components/running/RunLifetimeLine', () => {
  const { Text } = require('react-native');
  return { RunLifetimeLine: () => <Text>sonde-total</Text> };
});
jest.mock('@/components/running/RunSplitsCard', () => {
  const { Text } = require('react-native');
  return { RunSplitsCard: () => <Text>sonde-splits</Text> };
});
jest.mock('@/components/running/RunPredictionsCard', () => {
  const { Text } = require('react-native');
  return { RunPredictionsCard: () => <Text>sonde-predictions</Text> };
});
jest.mock('@/components/running/RunLoadCard', () => {
  const { Text } = require('react-native');
  return { RunLoadCard: () => <Text>sonde-charge</Text> };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
  useScrollToTop: jest.fn(),
}));

jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: () => '2026-09-25',
  useTodayDate: () => new Date(2026, 8, 25),
  useCurrentHour: () => 10,
  useWindowStartUtc: () => '2026-08-26T00:00:00.000Z',
  useWindowStartKey: () => '2026-08-26',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    i18n: { language: 'fr' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      background: '#f1efe9',
      surface: '#fffaf2',
      surfaceAlt: '#e1eaf6',
      border: '#ece0cd',
      borderStrong: '#90897d',
      track: '#eadcc6',
      accent: '#2a64ad',
      accentText: '#ffffff',
      success: '#66714b',
      warn: '#f5e6c4',
      warnText: '#6b4c0f',
      amber: '#e0a526',
      panel: '#33291f',
      panelText: '#f0e4d0',
      panelMuted: '#c9b79a',
      panelAccent: '#d9a888',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockActive = useActiveRun as jest.Mock;
const mockToday = useTodayRunSession as jest.Mock;
const mockBlocks = useIntervalBlocksForRun as jest.Mock;
const mockHistory = useRunHistory as jest.Mock;
const mockIntervals = useRunIntervals as jest.Mock;
const mockWeekPlan = useWeekPlan as jest.Mock;
const mockProfile = useRunnerProfile as jest.Mock;
const mockProgram = useActiveProgram as jest.Mock;
const mockRunProgram = useRunProgram as jest.Mock;
const mockRecords = useRunningRecords as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();
const setParams = jest.fn();

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** Une sortie terminée — dates **locales** (sans « Z ») : le jour d'une sortie est un jour local (R8). */
const sortie = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  source: 'gps',
  startedAt: '2026-09-23T07:00:00',
  finishedAt: '2026-09-23T07:46:00',
  durationSeconds: 2772,
  distanceM: 8100,
  avgPaceSPerKm: 342,
  rpe: null,
  notes: null,
  elevationGainM: 40,
  elevationLossM: 40,
  terrain: null,
  plannedSessionId: null,
  sessionId: null,
  sessionType: null,
  ...over,
});

const SEANCE_DU_JOUR = {
  id: 'ps-1',
  sessionId: 's-frac',
  name: 'Fractionné court',
  scheduledTime: '18:30:00',
  targetDistanceM: null,
  targetDurationSeconds: null,
  sessionType: 'fractionne',
  targetPaceMinSPerKm: null,
  targetPaceMaxSPerKm: null,
  targetTimeSeconds: null,
  instructions: 'Régulier.',
};

beforeEach(() => {
  jest.clearAllMocks();
  useRunSection.setState({ section: null });
  mockUseRouter.mockReturnValue({ push, setParams });
  mockParams.mockReturnValue({});
  mockActive.mockReturnValue({ run: null, isLoading: false });
  mockToday.mockReturnValue({ session: null, isLoading: false });
  mockBlocks.mockReturnValue({ sessionType: null, blocks: [] });
  mockHistory.mockReturnValue({ runs: [], isLoading: false });
  mockIntervals.mockReturnValue({ intervals: [], isLoading: false });
  mockWeekPlan.mockReturnValue({ items: [], isLoading: false });
  mockProfile.mockReturnValue({ runnerProfile: { weeklyFrequency: null, ref5kPaceSPerKm: 284 }, isLoading: false });
  mockProgram.mockReturnValue({ program: null, isLoading: false });
  mockRunProgram.mockReturnValue({ progress: null, race: null });
  mockRecords.mockReturnValue({ records: [], isLoading: false });
});

// ---------------------------------------------------------------------------
// Les onglets (D1)
// ---------------------------------------------------------------------------

describe('trois onglets', () => {
  it('🔴 Courir s’ouvre à froid, les trois onglets sont là', async () => {
    await render(<RunningScreen />);

    for (const key of ['run', 'history', 'progress']) {
      expect(screen.getByTestId(`run-tab-${key}`)).toBeTruthy();
    }
    expect(screen.getByTestId('run-section-run')).toBeTruthy();
    expect(screen.getByText('runningHub.sections.run')).toBeTruthy();
  });

  it('changer d’onglet change le contenu, et l’onglet est retenu', async () => {
    await render(<RunningScreen />);

    await taper(screen.getByTestId('run-tab-history'));

    expect(screen.getByTestId('run-section-history')).toBeTruthy();
    expect(useRunSection.getState().section).toBe('history');
  });

  it('🔴 un paramètre `section` ouvre l’onglet, puis est effacé', async () => {
    mockParams.mockReturnValue({ section: 'progress' });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-section-progress')).toBeTruthy();
    expect(setParams).toHaveBeenCalledWith({ section: undefined });
    expect(useRunSection.getState().section).toBe('progress');
  });

  it('un paramètre inconnu est ignoré', async () => {
    mockParams.mockReturnValue({ section: 'train' });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-section-run')).toBeTruthy();
  });

  it('les icônes de l’en-tête ouvrent le planning, le profil coureur et les programmes', async () => {
    await render(<RunningScreen />);

    await taper(screen.getByLabelText('planning.title'));
    await taper(screen.getByLabelText('running.profile.title'));
    await taper(screen.getByLabelText('running.library.title'));

    expect(push).toHaveBeenCalledWith('/planning');
    expect(push).toHaveBeenCalledWith('/running-profile');
    expect(push).toHaveBeenCalledWith('/running-programs');
  });
});

// ---------------------------------------------------------------------------
// La carte du moment (§4.2-1)
// ---------------------------------------------------------------------------

describe('la carte du moment', () => {
  it('une course GPS en cours : sa distance, et Reprendre', async () => {
    mockActive.mockReturnValue({
      run: { id: 'run-live', source: 'gps', distanceM: 3420, durationSeconds: 1268, plannedSessionId: null },
      isLoading: false,
    });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-moment-resume')).toBeTruthy();
    await taper(screen.getByTestId('run-moment-primary'));
    expect(push).toHaveBeenCalledWith('/run/active');
  });

  it('🔴 une course SANS GPS en cours dit sa durée, pas « 0,00 km »', async () => {
    mockActive.mockReturnValue({
      run: { id: 'run-live', source: 'manual', distanceM: null, durationSeconds: 1268, plannedSessionId: null },
      isLoading: false,
    });

    await render(<RunningScreen />);

    expect(screen.getByText('running.start.manualMode')).toBeTruthy();
    expect(screen.queryByText(/0[,.]00/)).toBeNull();
  });

  it('🔴 la séance du jour : Partir rattache la course à la séance ; plus de « Voir le détail »', async () => {
    mockToday.mockReturnValue({ session: SEANCE_DU_JOUR, isLoading: false });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-moment-today')).toBeTruthy();
    expect(screen.getByText('running.sessionType.fractionne')).toBeTruthy();
    expect(screen.queryByTestId('run-moment-secondary')).toBeNull();

    await taper(screen.getByTestId('run-moment-primary'));
    expect(push).toHaveBeenCalledWith({ pathname: '/run', params: { plannedSessionId: 'ps-1' } });
  });

  it('🔴 la dernière fois de LA MÊME SÉANCE, en pastilles de fractions (D3)', async () => {
    mockToday.mockReturnValue({ session: SEANCE_DU_JOUR, isLoading: false });
    mockHistory.mockReturnValue({
      runs: [
        sortie('r-ef', { sessionId: 's-ef', sessionType: 'endurance' }),
        sortie('r-frac', {
          startedAt: '2026-09-18T18:30:00',
          finishedAt: '2026-09-18T19:14:00',
          sessionId: 's-frac',
          sessionType: 'fractionne',
          plannedSessionId: 'ps-0',
        }),
      ],
      isLoading: false,
    });
    mockIntervals.mockImplementation((runId?: string) => ({
      intervals:
        runId === 'r-frac'
          ? [
              {
                phaseIndex: 0,
                phaseKind: 'fast',
                segmentKind: 'work',
                rep: 1,
                totalReps: 1,
                plannedDistanceM: 400,
                plannedDurationSeconds: null,
                plannedPaceMinSPerKm: 230,
                plannedPaceMaxSPerKm: 240,
                actualDistanceM: 400,
                actualDurationSeconds: 94,
                actualPaceSPerKm: 235,
              },
            ]
          : [],
      isLoading: false,
    }));

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-last-time')).toBeTruthy();
    expect(screen.getByText('runningHub.lastTime.sameSession')).toBeTruthy();
    expect(screen.getByText('1:34')).toBeTruthy();
    expect(screen.getByText('runningHub.lastTime.inRange:{"done":1,"total":1}')).toBeTruthy();

    await taper(screen.getByTestId('run-last-time-open'));
    expect(push).toHaveBeenCalledWith({ pathname: '/run/analysis', params: { id: 'r-frac' } });
  });

  it('une séance jamais courue dit « Première fois »', async () => {
    mockToday.mockReturnValue({ session: SEANCE_DU_JOUR, isLoading: false });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-last-time-first')).toBeTruthy();
  });

  it('🔴 après une sortie : Voir l’analyse et Partager — plus de « Ma semaine » vers l’historique', async () => {
    mockHistory.mockReturnValue({
      runs: [
        sortie('r-today', {
          startedAt: '2026-09-25T08:00:00',
          finishedAt: '2026-09-25T08:44:00',
          plannedSessionId: 'ps-1',
          sessionId: 's-frac',
          sessionType: 'fractionne',
        }),
      ],
      isLoading: false,
    });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-moment-arrival')).toBeTruthy();
    expect(screen.getByText('runningHub.moment.validated')).toBeTruthy();

    await taper(screen.getByTestId('run-moment-primary'));
    expect(push).toHaveBeenCalledWith({ pathname: '/run/analysis', params: { id: 'r-today' } });

    await taper(screen.getByTestId('run-moment-secondary'));
    expect(push).toHaveBeenCalledWith({ pathname: '/run/analysis', params: { id: 'r-today', share: '1' } });
    expect(push).not.toHaveBeenCalledWith('/running-history');
  });

  it('un jour de repos : Course libre et Planning', async () => {
    mockProgram.mockReturnValue({ program: { id: 'prog-1', name: '10 km', durationWeeks: 8 }, isLoading: false });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-moment-rest')).toBeTruthy();
    await taper(screen.getByTestId('run-moment-primary'));
    expect(push).toHaveBeenCalledWith('/run');
    await taper(screen.getByTestId('run-moment-secondary'));
    expect(push).toHaveBeenCalledWith('/planning');
  });

  it('premiers pas sans allure de référence : la donner, ou choisir un programme', async () => {
    mockProfile.mockReturnValue({ runnerProfile: null, isLoading: false });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-moment-onboarding')).toBeTruthy();
    await taper(screen.getByTestId('run-moment-ref-pace'));
    expect(push).toHaveBeenCalledWith('/running-profile');
    await taper(screen.getByTestId('run-moment-primary'));
    expect(push).toHaveBeenCalledWith('/running-programs');
  });
});

// ---------------------------------------------------------------------------
// Tes dernières sorties, Recourir (§4.2-3, D4)
// ---------------------------------------------------------------------------

describe('tes dernières sorties', () => {
  const quatre = [
    sortie('r-1', { startedAt: '2026-09-23T07:00:00', finishedAt: '2026-09-23T07:46:00' }),
    sortie('r-2', { startedAt: '2026-09-21T18:00:00', finishedAt: '2026-09-21T18:41:00', source: 'manual', terrain: 'treadmill' }),
    sortie('r-3', { startedAt: '2026-09-20T09:00:00', finishedAt: '2026-09-20T09:03:00', distanceM: 420 }),
    sortie('r-4', { startedAt: '2026-09-18T18:30:00', finishedAt: '2026-09-18T19:14:00' }),
  ];

  it('🔴 les trois plus récentes, visibles sans geste', async () => {
    mockHistory.mockReturnValue({ runs: quatre, isLoading: false });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-row-r-1')).toBeTruthy();
    expect(screen.getByTestId('run-row-r-2')).toBeTruthy();
    expect(screen.getByTestId('run-row-r-3')).toBeTruthy();
    expect(screen.queryByTestId('run-row-r-4')).toBeNull();
  });

  it('🔴 Recourir seulement là où un fantôme est possible (GPS, 500 m et plus — R5)', async () => {
    mockHistory.mockReturnValue({ runs: quatre, isLoading: false });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-again-r-1')).toBeTruthy();
    expect(screen.queryByTestId('run-again-r-2')).toBeNull();
    expect(screen.queryByTestId('run-again-r-3')).toBeNull();

    await taper(screen.getByTestId('run-again-r-1'));
    expect(push).toHaveBeenCalledWith({ pathname: '/run', params: { ghostRunId: 'r-1' } });
  });

  it('une sortie ouvre son détail — l’analyse, plus l’écran d’arrivée (D6)', async () => {
    mockHistory.mockReturnValue({ runs: quatre, isLoading: false });

    await render(<RunningScreen />);
    await taper(screen.getByTestId('run-row-r-1'));

    expect(push).toHaveBeenCalledWith({ pathname: '/run/analysis', params: { id: 'r-1' } });
    expect(push).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/run/summary' }));
  });

  it('« Tout l’historique » ouvre l’onglet Historique', async () => {
    mockHistory.mockReturnValue({ runs: quatre, isLoading: false });

    await render(<RunningScreen />);
    await taper(screen.getByTestId('run-all-history'));

    expect(screen.getByTestId('run-section-history')).toBeTruthy();
  });

  it('la course libre est proposée sous les sorties un jour de séance (D10)', async () => {
    mockToday.mockReturnValue({ session: SEANCE_DU_JOUR, isLoading: false });

    await render(<RunningScreen />);
    await taper(screen.getByTestId('run-other-free'));

    expect(push).toHaveBeenCalledWith('/run');
  });
});

// ---------------------------------------------------------------------------
// Ta semaine, ton programme
// ---------------------------------------------------------------------------

describe('ta semaine', () => {
  it('🔴 garde de CARDIO-UX02 : le dénominateur est la fréquence visée (`goalCount`), jamais « / 0 »', async () => {
    mockHistory.mockReturnValue({
      runs: [
        sortie('r-1', { startedAt: '2026-09-21T18:00:00', finishedAt: '2026-09-21T18:41:00' }),
        sortie('r-2', { startedAt: '2026-09-23T07:00:00', finishedAt: '2026-09-23T07:46:00' }),
      ],
      isLoading: false,
    });
    mockProfile.mockReturnValue({ runnerProfile: { weeklyFrequency: 3, ref5kPaceSPerKm: 284 }, isLoading: false });

    await render(<RunningScreen />);

    expect(screen.getByText('running.week.count:{"done":2,"total":3}')).toBeTruthy();
    expect(screen.queryByText(/"total\\?":0/)).toBeNull();
  });
});

describe('ton programme (D8)', () => {
  it('l’avancement, le compte à rebours et l’objectif face au record ; un appui ouvre le programme', async () => {
    mockProgram.mockReturnValue({ program: { id: 'prog-1', name: '10 km en 8 semaines', durationWeeks: 8 }, isLoading: false });
    mockRunProgram.mockReturnValue({
      progress: { week: 3, totalWeeks: 8, done: 9, total: 32, ratio: 9 / 32 },
      race: { targetDate: '2026-11-08', targetTimeSeconds: 2940, eventName: null, raceDistanceM: 10000 },
    });
    mockRecords.mockReturnValue({
      records: [{ distanceKey: '10k', bestTimeSeconds: 3062, achievedAt: '2026-09-13T09:00:00.000Z', runId: 'r-10' }],
      isLoading: false,
    });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-program-card')).toBeTruthy();
    expect(screen.getByText('running.prepa.countdown:{"count":44}')).toBeTruthy();
    expect(screen.getByText('49:00')).toBeTruthy();
    expect(screen.getByText('runningHub.program.record')).toBeTruthy();
    expect(screen.getByText('51:02')).toBeTruthy();

    await taper(screen.getByTestId('run-program-card'));
    expect(push).toHaveBeenCalledWith('/running-programs/prog-1');
  });

  it('sans programme, pas de carte programme', async () => {
    await render(<RunningScreen />);
    expect(screen.queryByTestId('run-program-card')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pendant une course
// ---------------------------------------------------------------------------

describe('pendant une course', () => {
  beforeEach(() => {
    mockActive.mockReturnValue({
      run: { id: 'run-live', source: 'gps', distanceM: 3420, durationSeconds: 1268, plannedSessionId: null },
      isLoading: false,
    });
    mockHistory.mockReturnValue({ runs: [sortie('r-1')], isLoading: false });
  });

  it('🔴 Courir ne propose rien d’autre que Reprendre', async () => {
    await render(<RunningScreen />);

    expect(screen.getByTestId('run-moment-resume')).toBeTruthy();
    expect(screen.queryByTestId('run-recent')).toBeNull();
    expect(screen.queryByTestId('run-other-free')).toBeNull();
  });

  it('Historique et Progrès portent la ligne « Reprendre » (D1)', async () => {
    await render(<RunningScreen />);

    await taper(screen.getByTestId('run-tab-history'));
    expect(screen.getByTestId('run-resume-line')).toBeTruthy();

    await taper(screen.getByTestId('run-tab-progress'));
    await taper(screen.getByTestId('run-resume-line'));
    expect(push).toHaveBeenCalledWith('/run/active');
  });
});

// ---------------------------------------------------------------------------
// Progrès (§4.4)
// ---------------------------------------------------------------------------

describe('progrès', () => {
  it('🔴 monte les cartes de CARDIO-UX02, et « Toutes tes stats »', async () => {
    mockHistory.mockReturnValue({ runs: [sortie('r-1')], isLoading: false });
    mockParams.mockReturnValue({ section: 'progress' });

    await render(<RunningScreen />);

    for (const sonde of [
      'sonde-fil',
      'sonde-allure',
      'sonde-predictions',
      'sonde-moteur',
      'sonde-records',
      'sonde-charge',
      'sonde-splits',
      'sonde-total',
    ]) {
      expect(screen.getByText(sonde)).toBeTruthy();
    }
    await taper(screen.getByTestId('run-progress-stats'));
    expect(push).toHaveBeenCalledWith('/running-stats');
  });

  it('sans aucune sortie, un seul message — et « Commencer » ramène à Courir', async () => {
    // Par la mémoire, pas par le paramètre : le mock ne rejoue pas l'effacement de `setParams`.
    useRunSection.setState({ section: 'progress' });

    await render(<RunningScreen />);

    expect(screen.getByTestId('run-progress-empty')).toBeTruthy();
    expect(screen.queryByText('sonde-allure')).toBeNull();
    await taper(screen.getByTestId('run-progress-start'));
    expect(screen.getByTestId('run-section-run')).toBeTruthy();
  });

  it('🔴 la grille de widgets, « Personnaliser » et l’annuaire ont disparu', async () => {
    await render(<RunningScreen />);

    expect(screen.queryByText(/widgets\.customize/)).toBeNull();
    expect(screen.queryByTestId('widget-grid')).toBeNull();
    expect(screen.queryByTestId('running-directory-link')).toBeNull();
  });
});
