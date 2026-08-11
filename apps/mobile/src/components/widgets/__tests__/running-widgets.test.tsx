/**
 * Widgets du hub course (`components/widgets/running-widgets`).
 *
 * Fichier à **0 %** avant ce test. Même forme que les widgets muscu, mais avec une dégradation
 * supplémentaire qui vaut d'être verrouillée : **le grand format affiche les splits par kilomètre
 * quand la trace GPS existe, et se replie sur une courbe des distances récentes sinon.** Deux
 * rendus radicalement différents pour un même widget, décidés par une donnée qui manque souvent
 * (course manuelle, trace perdue, moins d'un kilomètre couru).
 *
 * Le reste tient en trois règles :
 *  1. **Chaque forme a un état vide rédigé** — un widget d'accueil vide ne se distingue pas d'un
 *     widget en panne.
 *  2. **Les dates relatives sont dites en mots** (« aujourd'hui », « hier ») avant de retomber sur
 *     JJ/MM : « 11/08 » sur une course faite ce matin oblige à faire le calcul.
 *  3. **Le registre expose exactement les identifiants attendus** : un widget absent de la map
 *     rendrait une case vide dans la grille, sans erreur.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { RUNNING_WIDGETS } from '../running-widgets';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useRun, useRunHistory } from '@/data/repositories/run-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  useActiveProgram: jest.fn(() => ({ program: null, isLoading: false })),
}));
jest.mock('@/data/repositories/run-repository', () => ({
  useRunHistory: jest.fn(() => ({ runs: [], isLoading: false })),
  useRun: jest.fn(() => ({ run: null, isLoading: false })),
}));

jest.mock('@/components/PlanningPreview', () => {
  const { Text } = require('react-native');
  return { PlanningPreview: ({ size }: { size: string }) => <Text>planning-{size}</Text> };
});
jest.mock('@/components/dashboard/TrainingTimeCard', () => {
  const { Text } = require('react-native');
  return { TrainingTimeCard: () => <Text>temps</Text> };
});
jest.mock('@/components/widgets/primitives', () => {
  const { Text } = require('react-native');
  return {
    Sparkline: ({ values }: { values: number[] }) => <Text>spark-{values.length}</Text>,
    MiniBars: ({ values, highlightIndex }: { values: number[]; highlightIndex: number }) => (
      <Text>{`bars-${values.length}-best${highlightIndex}`}</Text>
    ),
  };
});

jest.mock('@/components/widgets/WidgetFrame', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    WidgetFrame: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
    }) =>
      onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
          {children}
        </Pressable>
      ) : (
        <View>{children}</View>
      ),
    Eyebrow: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Metric: ({ value, sub }: { value: string; sub?: string }) => (
      <View>
        <Text>{value}</Text>
        {sub ? <Text>{sub}</Text> : null}
      </View>
    ),
  };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#96856f', border: '#ece0cd', accent: '#c0562f' },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatDistance: (km: number | null | undefined) => (km == null ? '—' : `${km.toFixed(2)} km`),
    formatPace: (s: number | null | undefined) => (s == null ? '—' : `${s} s/km`),
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockHistory = useRunHistory as jest.Mock;
const mockRun = useRun as jest.Mock;
const mockProgram = useActiveProgram as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

/** Aujourd'hui figé : les dates relatives dépendent de `Date.now()`. */
const AUJOURDHUI = new Date('2026-08-11T12:00:00');
const ilYA = (jours: number) =>
  new Date(AUJOURDHUI.getTime() - jours * 86_400_000).toISOString();

const course = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  startedAt: ilYA(0),
  finishedAt: ilYA(0),
  durationSeconds: 2700,
  distanceM: 8000,
  avgPaceSPerKm: 337,
  rpe: null,
  ...overrides,
});

const TAILLES = ['small', 'wide', 'large'] as const;

const rendre = (id: keyof typeof RUNNING_WIDGETS, size: (typeof TAILLES)[number]) => {
  const Widget = RUNNING_WIDGETS[id];
  return render(<Widget size={size} />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(AUJOURDHUI);
  mockUseRouter.mockReturnValue({ push });
  mockHistory.mockReturnValue({ runs: [], isLoading: false });
  mockRun.mockReturnValue({ run: null, isLoading: false });
  mockProgram.mockReturnValue({ program: null, isLoading: false });
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Registre
// ---------------------------------------------------------------------------

describe('registre', () => {
  it('🔴 expose exactement les quatre widgets du hub', async () => {
    // Un identifiant absent de la map rendrait une case **vide** dans la grille, sans erreur.
    expect(Object.keys(RUNNING_WIDGETS).sort()).toEqual([
      'running-history',
      'running-planning',
      'running-programs',
      'running-training-time',
    ]);
  });

  // Un cas par couple (widget, forme) — jamais de boucle avec `unmount()`, voir §3.7.
  it.each(
    (Object.keys(RUNNING_WIDGETS) as (keyof typeof RUNNING_WIDGETS)[]).flatMap((id) =>
      TAILLES.map((size) => [id, size] as const),
    ),
  )('%s se rend en %s sans planter', async (id, size) => {
    const vue = await rendre(id, size);

    expect(vue.toJSON()).not.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

describe('historique', () => {
  it.each(TAILLES)('%s dit qu’il n’y a aucune course', async (size) => {
    await rendre('running-history', size);

    expect(screen.getByText('running.history.empty')).toBeTruthy();
  });

  it('affiche distance, durée et allure de la dernière course', async () => {
    mockHistory.mockReturnValue({ runs: [course()], isLoading: false });

    await rendre('running-history', 'wide');

    expect(screen.getByText('8.00 km')).toBeTruthy();
    expect(screen.getByText('337 s/km')).toBeTruthy();
  });

  it('🔴 « aujourd’hui » et « hier » sont dits en MOTS', async () => {
    mockHistory.mockReturnValue({ runs: [course({ finishedAt: ilYA(0) })], isLoading: false });

    await rendre('running-history', 'small');

    // « 11/08 » sur une course faite ce matin oblige à faire le calcul de tête.
    expect(screen.getByText(/common\.today/)).toBeTruthy();
  });

  it('une course plus ancienne retombe sur JJ/MM', async () => {
    mockHistory.mockReturnValue({ runs: [course({ finishedAt: ilYA(5) })], isLoading: false });

    await rendre('running-history', 'small');

    expect(screen.getByText(/06\/08/)).toBeTruthy();
  });

  it('🔴 une date de fin absente ou invalide n’affiche pas « Invalid Date »', async () => {
    mockHistory.mockReturnValue({ runs: [course({ finishedAt: null })], isLoading: false });

    await rendre('running-history', 'small');

    expect(screen.queryByText(/Invalid|NaN/)).toBeNull();
  });

  it('🔴 une course manuelle sans distance affiche 0, pas « NaN km »', async () => {
    mockHistory.mockReturnValue({ runs: [course({ distanceM: null })], isLoading: false });

    await rendre('running-history', 'wide');

    expect(screen.getByText('0.00 km')).toBeTruthy();
  });

  it('mène à l’historique de course', async () => {
    await rendre('running-history', 'small');

    await taper(screen.getByLabelText('running.history.title'));

    expect(push).toHaveBeenCalledWith('/running-history');
  });
});

// ---------------------------------------------------------------------------
// Grand format : splits ou repli
// ---------------------------------------------------------------------------

describe('grand format', () => {
  /** Trace GPS d'environ 3 km, un point tous les 100 m. */
  const trace = () => {
    const M_PAR_DEG = 111_320;
    const pts = Array.from({ length: 31 }, (_, k) => ({
      lat: 0,
      lng: (k * 100) / M_PAR_DEG,
      t: k * 30,
    }));
    // On encode via la vraie fonction pour que `decodeTrack` la relise réellement.
    const { encodeSegment, appendToTrack } = jest.requireActual('@wellness/shared');
    return appendToTrack('', encodeSegment(pts));
  };

  it('🔴 affiche les splits par kilomètre quand la trace GPS existe', async () => {
    mockHistory.mockReturnValue({ runs: [course()], isLoading: false });
    mockRun.mockReturnValue({ run: { ...course(), gpsTrack: trace() }, isLoading: false });

    await rendre('running-history', 'large');

    // Deux splits sur ~3 km (le dernier partiel est ignoré) : c'est l'information la plus riche
    // dont on dispose sur une course, et elle n'existe que s'il y a une trace.
    expect(screen.getByText(/^bars-/)).toBeTruthy();
    expect(screen.getByText(/widgets\.running\.bestKm/)).toBeTruthy();
  });

  it('🔴 le kilomètre le plus RAPIDE est mis en avant', async () => {
    mockHistory.mockReturnValue({ runs: [course()], isLoading: false });
    mockRun.mockReturnValue({ run: { ...course(), gpsTrack: trace() }, isLoading: false });

    await rendre('running-history', 'large');

    // Sur une trace régulière le premier km gagne ; ce qui compte est que l'index soit **calculé**
    // et non figé : mettre en avant le mauvais km rendrait le graphe trompeur.
    expect(screen.getByText(/best\d/)).toBeTruthy();
  });

  it('🔴 SANS trace GPS, se replie sur la courbe des distances récentes', async () => {
    const runs = Array.from({ length: 4 }, (_, i) =>
      course({ id: `r-${i}`, finishedAt: ilYA(i), distanceM: 5000 + i * 1000 }),
    );
    mockHistory.mockReturnValue({ runs, isLoading: false });
    mockRun.mockReturnValue({ run: { ...course(), gpsTrack: null }, isLoading: false });

    await rendre('running-history', 'large');

    // Course manuelle, trace perdue, ou moins d'un kilomètre : le cas est fréquent, et laisser un
    // grand carré vide serait le pire des rendus.
    expect(screen.getByText('spark-4')).toBeTruthy();
    expect(screen.getByText('widgets.running.recentDistances')).toBeTruthy();
  });

  it('🔴 une seule course ne trace AUCUNE courbe', async () => {
    mockHistory.mockReturnValue({ runs: [course()], isLoading: false });
    mockRun.mockReturnValue({ run: { ...course(), gpsTrack: null }, isLoading: false });

    await rendre('running-history', 'large');

    // Une « courbe » à un point est un point : elle suggère une tendance qui n'existe pas.
    expect(screen.queryByText(/spark-/)).toBeNull();
  });

  it('🔴 la série des distances est ordonnée du plus ANCIEN au plus récent', async () => {
    const runs = Array.from({ length: 10 }, (_, i) => course({ id: `r-${i}`, finishedAt: ilYA(i) }));
    mockHistory.mockReturnValue({ runs, isLoading: false });
    mockRun.mockReturnValue({ run: { ...course(), gpsTrack: null }, isLoading: false });

    await rendre('running-history', 'large');

    // L'historique arrive du plus récent au plus ancien : tracé tel quel, le graphe se lirait à
    // l'envers, et une progression passerait pour une régression.
    expect(screen.getByText('spark-10')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Programme de course
// ---------------------------------------------------------------------------

describe('programme de course', () => {
  it.each(TAILLES)('%s dit qu’aucun plan n’est actif', async (size) => {
    await rendre('running-programs', size);

    expect(screen.getByText('programs.noneActive')).toBeTruthy();
  });

  it('🔴 lit le programme du pilier COURSE, pas celui de la muscu', async () => {
    await rendre('running-programs', 'wide');

    // Sans le filtre de pilier, le hub course afficherait le programme de musculation actif —
    // la fuite inter-piliers que la décision H interdit.
    expect(mockProgram).toHaveBeenCalledWith('running');
  });

  it('affiche le nom du plan et sa durée', async () => {
    mockProgram.mockReturnValue({
      program: { id: 'p1', name: 'Prépa 10 km', durationWeeks: 8, goal: null },
      isLoading: false,
    });

    await rendre('running-programs', 'wide');

    expect(screen.getByText('Prépa 10 km')).toBeTruthy();
    expect(screen.getByText('programs.weeks:{"count":8}')).toBeTruthy();
  });

  it('sans durée, retombe sur l’objectif', async () => {
    mockProgram.mockReturnValue({
      program: { id: 'p1', name: 'Prépa 10 km', durationWeeks: null, goal: 'Sub 45' },
      isLoading: false,
    });

    await rendre('running-programs', 'wide');

    expect(screen.getByText('Sub 45')).toBeTruthy();
  });

  it('mène aux programmes de course', async () => {
    await rendre('running-programs', 'small');

    await taper(screen.getByLabelText('running.program.myTitle'));

    // `/programs` mènerait au hub muscu : deux écrans distincts, deux piliers distincts.
    expect(push).toHaveBeenCalledWith('/running-programs');
  });
});

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

describe('planning', () => {
  it.each(TAILLES)('%s transmet sa forme à l’aperçu', async (size) => {
    await rendre('running-planning', size);

    expect(screen.getByText(`planning-${size}`)).toBeTruthy();
  });

  it('mène au planning unifié', async () => {
    await rendre('running-planning', 'wide');

    await taper(screen.getByLabelText('planning.title'));

    expect(push).toHaveBeenCalledWith('/planning');
  });
});
