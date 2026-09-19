/**
 * US CARDIO-UX02 — les **six surfaces neuves** du hub Course.
 *
 * Ce qui est vérifié ici est la **règle de silence** de chacune : *une carte qui n'a rien à dire ne
 * se rend pas, et ne s'excuse pas*. C'est la règle R1 de MUSCU-UX05, reprise telle quelle — et
 * c'est elle qui traite à la racine le défaut « la moitié des blocs parlent de ce qui manque ».
 *
 * Les calculs sont testés dans `@wellness/shared` (`pace-progress`, `running-hub`,
 * `insight-adapters`) : on ne les reteste pas ici. Ce qui reste propre aux composants, c'est le
 * **sens de lecture** — un écart positif doit s'afficher comme une accélération, et un chrono de
 * record doit sortir formaté et non en secondes brutes.
 */
import { render, screen } from '@testing-library/react-native';
import { PaceProgressCard } from '../PaceProgressCard';
import { RunEngineCard } from '../RunEngineCard';
import { RunLifetimeLine } from '../RunLifetimeLine';
import { RunRecordWall } from '../RunRecordWall';
import { RunThread } from '../RunThread';
import { RunWeekCard } from '../RunWeekCard';
import {
  usePaceProgress,
  useRunLifetime,
  useRunningThread,
} from '@/data/repositories/run-cards-repository';
import { usePolarisation } from '@/data/repositories/run-repository';
import { useRunningRecords } from '@/data/repositories/running-record-repository';
import type { RunWeekSummary } from '@wellness/shared';

jest.mock('@/data/repositories/run-cards-repository', () => ({
  usePaceProgress: jest.fn(),
  useRunLifetime: jest.fn(),
  useRunningThread: jest.fn(),
}));
jest.mock('@/data/repositories/run-repository', () => ({
  usePolarisation: jest.fn(),
}));
jest.mock('@/data/repositories/running-record-repository', () => ({
  useRunningRecords: jest.fn(),
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
  // Requis dès qu'un module de la chaîne d'import initialise i18next (`useUnits` → `settings-repository`
  // → `src/i18n`) : `i18n.use(undefined)` échoue au chargement, avant qu'aucun test ne démarre.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      background: '#f1efe9',
      surface: '#f6fbff',
      surfaceAlt: '#eaf2fb',
      border: '#dfe7ef',
      track: '#e3e9f0',
      accent: '#2a64ad',
      accentText: '#ffffff',
      success: '#66714b',
    },
  }),
}));

const mockPace = usePaceProgress as jest.Mock;
const mockLifetime = useRunLifetime as jest.Mock;
const mockThread = useRunningThread as jest.Mock;
const mockPolarisation = usePolarisation as jest.Mock;
const mockRecords = useRunningRecords as jest.Mock;

const noop = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  mockPace.mockReturnValue({ progress: { kind: 'empty' }, series: [], isLoading: false });
  mockLifetime.mockReturnValue({
    totalDistanceM: 0,
    totalDurationS: 0,
    count: 0,
    isLoading: false,
  });
  mockThread.mockReturnValue({ thread: null, isLoading: false });
  mockPolarisation.mockReturnValue({ polarisation: null, isLoading: false });
  mockRecords.mockReturnValue({ records: [], isLoading: false });
});

// ---------------------------------------------------------------------------
// Ton allure
// ---------------------------------------------------------------------------

describe('Ton allure', () => {
  it('se tait sans donnée, et ne s’excuse pas', async () => {
    await render(<PaceProgressCard onPress={noop} />);
    expect(screen.queryByTestId('pace-progress-card')).toBeNull();
  });

  it('montre le meilleur et le cumul tant qu’il n’y a pas deux fenêtres à comparer', async () => {
    mockPace.mockReturnValue({
      progress: {
        kind: 'onboarding',
        bestPaceSPerKm: 320,
        bestDayKey: '2026-09-10',
        runs: 3,
        totalDistanceM: 24000,
      },
      series: [],
      isLoading: false,
    });

    await render(<PaceProgressCard onPress={noop} />);

    expect(screen.getByTestId('pace-progress-card')).toBeTruthy();
    expect(screen.getByText('runningHub.pace.title.onboarding')).toBeTruthy();
  });

  it('🔴 un écart positif se lit comme une ACCÉLÉRATION (flèche vers le haut)', async () => {
    mockPace.mockReturnValue({
      progress: {
        kind: 'established',
        currentPaceSPerKm: 322,
        previousPaceSPerKm: 344,
        deltaSPerKm: 22,
        direction: 'up',
        runsCurrent: 5,
        runsPrevious: 4,
        trend: 'improving',
      },
      series: [340, 335, 322],
      isLoading: false,
    });

    await render(<PaceProgressCard onPress={noop} />);

    // L'allure a BAISSÉ de 344 à 322 : la flèche doit pointer vers le haut, pas vers le bas.
    expect(screen.getByText('icone-arrow-up')).toBeTruthy();
    // Le gros chiffre est l'allure COURANTE (322 s = 5:22), la légende cite la précédente (5:44).
    expect(screen.getByText('5:22 /km')).toBeTruthy();
    expect(screen.getByText('runningHub.pace.caption.up:{"previous":"5:44 /km"}')).toBeTruthy();
    expect(screen.getByText('runningHub.pace.delta:{"count":22}')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Ton moteur
// ---------------------------------------------------------------------------

describe('Ton moteur', () => {
  it('se tait quand la polarisation n’est pas calculable', async () => {
    await render(<RunEngineCard onOpen={noop} />);
    expect(screen.queryByTestId('run-engine-card')).toBeNull();
  });

  it('affiche les deux parts ET le repère, sans juger l’écart', async () => {
    mockPolarisation.mockReturnValue({
      polarisation: { lowIntensityPct: 83, highIntensityPct: 17, totalKm: 46, runCount: 6 },
      isLoading: false,
    });

    await render(<RunEngineCard onOpen={noop} />);

    expect(screen.getByTestId('run-engine-card')).toBeTruthy();
    expect(screen.getByText('83 %')).toBeTruthy();
    expect(screen.getByText('17 %')).toBeTruthy();
    // Le repère est dit, jamais transformé en verdict (réserve du catalogue sur RUN-08).
    expect(
      screen.getByText('runningHub.engine.reference:{"reference":80,"km":46}'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tes records
// ---------------------------------------------------------------------------

describe('Tes records', () => {
  it('se tait sans record', async () => {
    await render(<RunRecordWall onOpen={noop} />);
    expect(screen.queryByTestId('run-record-wall')).toBeNull();
  });

  it('rend une cellule par distance, chrono formaté', async () => {
    mockRecords.mockReturnValue({
      records: [
        {
          distanceKey: '5k',
          bestTimeSeconds: 1450,
          runId: 'r-1',
          achievedAt: '2026-09-17T18:00:00.000Z',
        },
        {
          distanceKey: '10k',
          bestTimeSeconds: 3020,
          runId: 'r-2',
          achievedAt: '2026-08-02T18:00:00.000Z',
        },
      ],
      isLoading: false,
    });

    await render(<RunRecordWall onOpen={noop} />);

    expect(screen.getByTestId('run-record-wall')).toBeTruthy();
    // 1450 s = 24 min 10 s — jamais « 1450 ».
    expect(screen.getByText('24 min 10 s')).toBeTruthy();
    expect(screen.getByText('50 min 20 s')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// La ligne de toujours
// ---------------------------------------------------------------------------

describe('La ligne de toujours', () => {
  it('se tait à zéro course — « 0,00 km depuis le début » serait une excuse', async () => {
    await render(<RunLifetimeLine onPress={noop} />);
    expect(screen.queryByTestId('run-lifetime-line')).toBeNull();
  });

  it('dit la distance, le temps et le nombre de sorties', async () => {
    mockLifetime.mockReturnValue({
      totalDistanceM: 412_000,
      totalDurationS: 144_000,
      count: 48,
      isLoading: false,
    });

    await render(<RunLifetimeLine onPress={noop} />);

    expect(screen.getByTestId('run-lifetime-line')).toBeTruthy();
    expect(screen.getByText(/runningHub\.lifetime\.line.*"count":48/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Le fil du jour
// ---------------------------------------------------------------------------

describe('Le fil du jour', () => {
  it('se tait quand le moteur ne retient rien', async () => {
    await render(<RunThread onPress={noop} />);
    expect(screen.queryByTestId('running-day-thread')).toBeNull();
  });

  it('🔴 formate le chrono d’un record au lieu d’afficher des secondes brutes', async () => {
    mockThread.mockReturnValue({
      thread: {
        id: 'run_record_recent',
        family: 'celebration',
        variant: '5k',
        metrics: { seconds: 1450 },
        subject: '5 km',
        occurredOn: '2026-09-17',
        rank: 0,
      },
      isLoading: false,
    });

    await render(<RunThread onPress={noop} />);

    // `metrics` n'accepte que des nombres : sans le formatage du composant, la phrase dirait « 1450 ».
    expect(screen.getByText(/"time":"24 min 10 s"/)).toBeTruthy();
    expect(screen.getByText('icone-trophy-outline')).toBeTruthy();
  });

  it('passe le sens de l’écart en `context` i18next', async () => {
    mockThread.mockReturnValue({
      thread: {
        id: 'pace_trend',
        family: 'change',
        variant: 'up',
        metrics: { seconds: 22, paceSPerKm: 322 },
        occurredOn: null,
        rank: 0,
      },
      isLoading: false,
    });

    await render(<RunThread onPress={noop} />);

    expect(screen.getByText(/"context":"up"/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Ma semaine
// ---------------------------------------------------------------------------

const semaine = (over: Partial<RunWeekSummary> = {}): RunWeekSummary => ({
  days: Array.from({ length: 7 }, (_, i) => ({
    dayKey: `2026-09-${String(14 + i).padStart(2, '0')}`,
    weekday: i,
    done: i === 0 || i === 2,
    planned: false,
    isToday: i === 5,
  })),
  doneCount: 2,
  plannedCount: 0,
  goalCount: 3,
  distanceM: 17_000,
  durationSeconds: 5820,
  elevationGainM: 90,
  targetFrequency: 3,
  ...over,
});

describe('Ma semaine', () => {
  it('se tait sur une semaine sans rien de couru ni de prévu', async () => {
    await render(
      <RunWeekCard
        week={semaine({ doneCount: 0, plannedCount: 0 })}
        nextLabel={null}
        programLabel={null}
        onOpenPlanning={noop}
      />,
    );
    expect(screen.queryByTestId('run-week-card')).toBeNull();
  });

  it('🔴 lit `goalCount`, jamais `plannedCount`', async () => {
    await render(
      <RunWeekCard week={semaine()} nextLabel={null} programLabel={null} onOpenPlanning={noop} />,
    );

    expect(screen.getByText('running.week.count:{"done":2,"total":3}')).toBeTruthy();
    expect(screen.queryByText('running.week.count:{"done":2,"total":0}')).toBeNull();
  });

  it('n’invente pas d’objectif quand il n’y en a aucun', async () => {
    await render(
      <RunWeekCard
        week={semaine({ goalCount: 0, targetFrequency: null })}
        nextLabel={null}
        programLabel={null}
        onOpenPlanning={noop}
      />,
    );

    expect(screen.getByText('runningHub.week.doneOnly:{"count":2}')).toBeTruthy();
  });

  it('dit ce qu’il RESTE — c’est la moitié de la question que le hub n’adressait pas', async () => {
    await render(
      <RunWeekCard
        week={semaine()}
        nextLabel="Prochaine le 21/09 · Fractionné"
        programLabel="Programme : 10 km en 8 semaines"
        onOpenPlanning={noop}
      />,
    );

    expect(screen.getByText('Prochaine le 21/09 · Fractionné')).toBeTruthy();
    expect(screen.getByText('Programme : 10 km en 8 semaines')).toBeTruthy();
  });
});
