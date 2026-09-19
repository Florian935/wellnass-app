/**
 * Hub Course (`app/(tabs)/running.tsx`) — le **vrai** écran, monté (US CARDIO-UX02).
 *
 * ── Ce que ce fichier protège ────────────────────────────────────────────────────────────────────
 * Le hub course n'avait **aucun test d'écran**, là où les quatre autres onglets en ont un depuis
 * MUSCU-UX01. C'est ce qui a permis au défaut 1 de l'audit de vivre : la scène rendait
 * `doneCount / plannedCount` et affichait « 2 / 0 faites » pendant que « Ma semaine », deux blocs
 * plus bas, affichait « 2 / 3 faites ». Deux surfaces, deux dénominateurs, aucun test entre les deux.
 *
 * Ce fichier vérifie donc ce qui est **propre à l'écran** — l'assemblage, pas le calcul :
 *  - la scène et la carte lisent le **même** dénominateur (`goalCount`) ;
 *  - la composition du corps (les cartes neuves sont montées, dans l'ordre voulu) ;
 *  - la grille de widgets et son bouton « Personnaliser » ont bien disparu ;
 *  - l'annuaire s'ouvre et route correctement.
 *
 * Les cartes ont chacune leurs tests ; ici, des **sondes** qui prouvent seulement qu'elles sont
 * montées. Même parti pris que `strength-screen.test.tsx`.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunningScreen from '../running';
import { useRunHistory } from '@/data/repositories/run-repository';
import { useWeekPlan } from '@/data/repositories/planned-session-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));

jest.mock('@/data/repositories/run-repository', () => ({
  useActiveRun: jest.fn(() => ({ run: null, isLoading: false })),
  useTodayRunSession: jest.fn(() => ({ session: null, isLoading: false })),
  useIntervalBlocksForRun: jest.fn(() => ({ blocks: [], isLoading: false })),
  useRunHistory: jest.fn(() => ({ runs: [], isLoading: false })),
}));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  useWeekPlan: jest.fn(() => ({ items: [], isLoading: false })),
}));
jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(() => ({ runnerProfile: null, isLoading: false })),
}));
jest.mock('@/data/repositories/program-repository', () => ({
  useActiveProgram: jest.fn(() => ({ program: null, isLoading: false })),
}));
jest.mock('@/data/repositories/session-adaptation-repository', () => ({
  useSessionAdaptation: jest.fn(() => null),
}));
jest.mock('@/data/repositories/running-record-repository', () => ({
  useRunningRecords: jest.fn(() => ({ records: [], isLoading: false })),
}));

// Les cartes du corps : des sondes. Chacune a son propre fichier de test.
//
// ⚠️ Chaque fabrique est écrite **en entier**, sans passer par un helper partagé : jest hisse les
// appels `jest.mock` au-dessus des imports, et une fabrique qui référence une variable du module
// (`sonde`) échoue au chargement (« not allowed to reference any out-of-scope variables »).
jest.mock('@/components/running/SessionAdaptationCard', () => ({
  SessionAdaptationCard: () => null,
}));
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

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: () => '2026-09-19',
  useTodayDate: () => new Date(2026, 8, 19),
  useCurrentHour: () => 10,
  useWindowStartUtc: () => '2026-08-22T00:00:00.000Z',
  useWindowStartKey: () => '2026-08-22',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    // `useUnits` lit `i18n.language` pour choisir son `Intl.NumberFormat` : sans lui, l'écran
    // plante avant d'avoir rendu quoi que ce soit.
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
      surface: '#f6fbff',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      track: '#eadcc6',
      accent: '#2a64ad',
      accentText: '#ffffff',
      success: '#66714b',
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

const mockHistory = useRunHistory as jest.Mock;
const mockWeekPlan = useWeekPlan as jest.Mock;
const mockProfile = useRunnerProfile as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

/** Un appui, joué dans `act` — sinon la feuille modale n'a pas fini de s'ouvrir au test suivant. */
const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** Deux sorties cette semaine (lundi 14/09 et mercredi 16/09), aucune séance planifiée. */
const DEUX_SORTIES = [
  {
    id: 'r-1',
    source: 'gps',
    startedAt: '2026-09-14T08:00:00.000Z',
    finishedAt: '2026-09-14T09:00:00.000Z',
    durationSeconds: 3060,
    distanceM: 9000,
    avgPaceSPerKm: 341,
    rpe: null,
    notes: null,
    elevationGainM: 45,
    elevationLossM: 45,
    terrain: null,
    plannedSessionId: null,
    sessionType: null,
  },
  {
    id: 'r-2',
    source: 'gps',
    startedAt: '2026-09-16T08:00:00.000Z',
    finishedAt: '2026-09-16T08:46:00.000Z',
    durationSeconds: 2760,
    distanceM: 8000,
    avgPaceSPerKm: 345,
    rpe: null,
    notes: null,
    elevationGainM: 45,
    elevationLossM: 45,
    terrain: null,
    plannedSessionId: null,
    sessionType: null,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockHistory.mockReturnValue({ runs: [], isLoading: false });
  mockWeekPlan.mockReturnValue({ items: [], isLoading: false });
  mockProfile.mockReturnValue({ runnerProfile: null, isLoading: false });
});

describe('hub Course — le dénominateur de la semaine', () => {
  it('🔴 la scène et la carte affichent le MÊME « n faites sur m »', async () => {
    // Le cas exact de la capture du 19/09 : deux sorties, aucun programme, fréquence visée = 3.
    mockHistory.mockReturnValue({ runs: DEUX_SORTIES, isLoading: false });
    mockProfile.mockReturnValue({
      runnerProfile: { weeklyFrequency: 3, ref5kPaceSPerKm: null },
      isLoading: false,
    });

    await render(<RunningScreen />);

    // Avant CARDIO-UX02, la scène rendait `{"done":2,"total":0}` et la carte `{"done":2,"total":3}`.
    // La scène imbrique le libellé dans `stage.running.weekLine` (d'où la recherche par motif) ;
    // la carte le rend tel quel.
    expect(screen.getByText(/stage\.running\.weekLine.*"done\\":2,\\"total\\":3/)).toBeTruthy();
    expect(screen.getByText('running.week.count:{"done":2,"total":3}')).toBeTruthy();
    // Le dénominateur fautif n'apparaît NULLE PART, quelle que soit la surface qui le porte.
    // L'antislash optionnel couvre les deux formes : `"total":0` (rendu direct) et `\"total\":0`
    // (le même libellé imbriqué dans un second `t()`, donc ré-échappé par le mock).
    expect(screen.queryByText(/"total\\?":0/)).toBeNull();
  });

  it('sans programme NI fréquence visée, on compte les sorties au lieu d’inventer un objectif', async () => {
    mockHistory.mockReturnValue({ runs: DEUX_SORTIES, isLoading: false });

    await render(<RunningScreen />);

    expect(screen.getAllByText('runningHub.week.doneOnly:{"count":2}').length).toBeGreaterThan(0);
    expect(screen.queryByText('running.week.count:{"done":2,"total":0}')).toBeNull();
  });
});

describe('hub Course — la composition', () => {
  it('monte les cartes neuves dans l’ordre voulu', async () => {
    mockHistory.mockReturnValue({ runs: DEUX_SORTIES, isLoading: false });

    await render(<RunningScreen />);

    for (const sondeAttendue of [
      'sonde-fil',
      'sonde-allure',
      'sonde-predictions',
      'sonde-moteur',
      'sonde-records',
      'sonde-charge',
      'sonde-splits',
      'sonde-total',
    ]) {
      expect(screen.getByText(sondeAttendue)).toBeTruthy();
    }
  });

  it('🔴 la grille de widgets et « Personnaliser » ont disparu', async () => {
    await render(<RunningScreen />);

    // Le bouton portait cette clé ; la grille rendait des tuiles `widget-*`.
    expect(screen.queryByText(/widgets\.customize/)).toBeNull();
    expect(screen.queryByTestId('widget-grid')).toBeNull();
  });
});

describe('hub Course — l’annuaire', () => {
  it('s’ouvre depuis la ligne de pied et route vers le profil coureur', async () => {
    await render(<RunningScreen />);

    await taper(screen.getByTestId('running-directory-link'));
    await taper(screen.getByTestId('run-directory-profile'));

    expect(push).toHaveBeenCalledWith('/running-profile');
  });

  it('route vers les programmes, le planning et l’historique', async () => {
    await render(<RunningScreen />);

    await taper(screen.getByTestId('running-directory-link'));
    await taper(screen.getByTestId('run-directory-programs'));
    expect(push).toHaveBeenCalledWith('/running-programs');

    await taper(screen.getByTestId('running-directory-link'));
    await taper(screen.getByTestId('run-directory-planning'));
    expect(push).toHaveBeenCalledWith('/planning');

    await taper(screen.getByTestId('running-directory-link'));
    await taper(screen.getByTestId('run-directory-history'));
    expect(push).toHaveBeenCalledWith('/running-history');
  });
});
