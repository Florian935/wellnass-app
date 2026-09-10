/**
 * Historique des séances (`app/history/index.tsx`) — le **vrai** écran, monté.
 *
 * ⚠️ Ce fichier **remplace** `history-smoke.test.tsx`, qui testait une réécriture locale de la
 * logique de liste (`HistoryListShell`) au lieu de l'écran. On pouvait supprimer l'écran entier :
 * il restait vert. Voir §3.7 de `strategie-tests.md`.
 *
 * Ce que l'écran ajoute par-dessus le repository, et qui n'est vérifiable qu'ici :
 *
 *  1. **Le filtre de période, calculé sur la date de FIN** (avec repli sur la date de début pour
 *     une séance jamais clôturée). Se tromper de champ ferait disparaître de « 7 derniers jours »
 *     une séance faite hier mais commencée avant-hier soir.
 *  2. **Les bornes sont ramenées à minuit.** Sans ça, « 7 derniers jours » signifierait « 7×24 h
 *     glissantes » : une séance faite il y a exactement une semaine apparaîtrait le matin et
 *     disparaîtrait l'après-midi, sans que rien n'ait changé.
 *  3. **Un filtre qui ne rend rien affiche l'état vide**, pas une liste blanche.
 *  4. **Chargement ≠ vide** : `workouts = []` est l'état transitoire normal de PowerSync.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import HistoryScreen from '../index';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks — uniquement ce qui ne peut pas tourner hors device
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-repository', () => ({
  useWorkoutHistory: jest.fn(() => ({ workouts: [], isLoading: false })),
}));

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text } = require('react-native');
  return { ScreenHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/components/EmptyState', () => {
  const { Text } = require('react-native');
  return { EmptyState: ({ message }: { message: string }) => <Text>{message}</Text> };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    i18n: { language: 'fr' },
  }),
  // Requis depuis que l'écran tire `useUnits` (US MUSCU-UX01, affichage du tonnage) : un module
  // de la chaîne initialise i18next, et `i18n.use(undefined)` échoue au chargement du fichier,
  // avant qu'aucun test ne démarre.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// `useUnits` : le formatage réel dépend des réglages (métrique/impérial) chargés par PowerSync.
// Ici on veut vérifier **que** le tonnage est affiché, pas comment il est formaté — c'est déjà
// couvert par les tests d'unités.
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatWeight: (kg: number) => `${Math.round(kg)} kg`,
    weightSymbol: 'kg',
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockUseHistory = useWorkoutHistory as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

/** Aujourd'hui, figé : les bornes de période sont relatives à `Date.now()`. */
const AUJOURDHUI = new Date('2026-08-08T12:00:00.000Z');

/** Une date décalée de `jours` dans le passé, à midi (loin des bornes de minuit). */
const ilYA = (jours: number) =>
  new Date(AUJOURDHUI.getTime() - jours * 24 * 3600 * 1000).toISOString();

/** Une séance terminée de l'historique. */
const seance = (overrides: Record<string, unknown> = {}) => ({
  id: 'w1',
  startedAt: ilYA(1),
  finishedAt: ilYA(1),
  durationSeconds: 3600,
  rpe: 7,
  notes: null,
  sessionId: null,
  programId: null,
  volumeKg: 0,
  // US MUSCU-UX01 : ce qui permet de reconnaître une séance sans l'ouvrir.
  sessionName: null,
  exerciseCount: 0,
  recordCount: 0,
  ...overrides,
});

/** Les lignes de séance, identifiées par leur libellé d'accessibilité (la date). */
const lignes = () => screen.queryAllByRole('button').filter((n) => /\d/.test(
  String(n.props.accessibilityLabel ?? ''),
));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(AUJOURDHUI);
  mockUseRouter.mockReturnValue({ push });
  mockUseHistory.mockReturnValue({ workouts: [], isLoading: false });
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('🔴 pendant le chargement, n’affiche PAS l’état vide', async () => {
    mockUseHistory.mockReturnValue({ workouts: [], isLoading: true });

    await render(<HistoryScreen />);

    // `workouts = []` est l'état transitoire normal de PowerSync : « aucune séance » s'afficherait
    // à chaque ouverture, à quelqu'un qui en a trois cents.
    expect(screen.queryByText('history.empty.message')).toBeNull();
  });

  it('sans séance, affiche un état vide rédigé', async () => {
    await render(<HistoryScreen />);

    expect(screen.getByText('history.empty.message')).toBeTruthy();
  });

  // ── Adapté le 10/09/2026 (US MUSCU-UX01) ─────────────────────────────────────────────────
  // La ligne portait « JJ/MM/AAAA · durée · RPE » et rien d'autre : impossible de reconnaître une
  // séance sans l'ouvrir. Elle porte désormais le **nom** de la séance, son tonnage et ses
  // exercices, et la date passe en pastille jour + mois — l'année se lit dans l'en-tête du mois.
  it('affiche le jour de chaque séance', async () => {
    mockUseHistory.mockReturnValue({ workouts: [seance()], isLoading: false });

    await render(<HistoryScreen />);

    expect(screen.getByText('07')).toBeTruthy();
  });

  it('affiche la durée quand elle existe', async () => {
    // Le **RPE a quitté la ligne** au profit du tonnage et du nombre d'exercices : sur une ligne
    // qui porte déjà un nom, ce sont eux qui distinguent deux séances, pas une note d'effort.
    // Le RPE reste sur la fiche de détail et dans le résumé de fin.
    mockUseHistory.mockReturnValue({ workouts: [seance()], isLoading: false });

    await render(<HistoryScreen />);

    expect(screen.getByText(/history\.row\.durationMin/)).toBeTruthy();
  });

  it('🔴 une séance sans aucune métrique n’affiche pas une ligne de méta vide', async () => {
    mockUseHistory.mockReturnValue({
      workouts: [seance({ durationSeconds: null, rpe: null, volumeKg: 0, exerciseCount: 0 })],
      isLoading: false,
    });

    await render(<HistoryScreen />);

    // Un séparateur « · » orphelin sous le nom se lit comme un défaut d'affichage.
    expect(screen.queryByText(/history\.row\./)).toBeNull();
    expect(screen.getByText('07')).toBeTruthy();
  });

  it('🔴 affiche le tonnage, qui était chargé mais jamais montré', async () => {
    // `volumeKg` faisait déjà partie de `WorkoutHistoryItem` et le widget du hub l'affichait :
    // c'est ce qui distingue deux séances de même durée.
    mockUseHistory.mockReturnValue({
      workouts: [seance({ volumeKg: 7100, exerciseCount: 5 })],
      isLoading: false,
    });

    await render(<HistoryScreen />);

    // Plusieurs occurrences attendues : la ligne, le cumul du mois et le total de l'en-tête —
    // avec une seule séance de 7 100 kg, les trois valent la même chose.
    expect(screen.getAllByText(/7100 kg/).length).toBeGreaterThan(0);
    expect(screen.getByText(/history\.row\.exercises/)).toBeTruthy();
  });

  it('🔴 nomme la séance, et marque les séances libres', async () => {
    mockUseHistory.mockReturnValue({
      workouts: [
        seance({ id: 'w-prog', sessionName: 'Push A' }),
        seance({ id: 'w-libre', sessionName: null }),
      ],
      isLoading: false,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('Push A')).toBeTruthy();
    expect(screen.getByText('history.freeSession')).toBeTruthy();
    expect(screen.getByText('history.freeBadge')).toBeTruthy();
  });

  it('signale un record par une pastille', async () => {
    mockUseHistory.mockReturnValue({ workouts: [seance({ recordCount: 2 })], isLoading: false });

    await render(<HistoryScreen />);

    expect(screen.getByText('🏆')).toBeTruthy();
  });

  it('ouvre le détail au tap', async () => {
    mockUseHistory.mockReturnValue({ workouts: [seance({ id: 'w-42' })], isLoading: false });

    await render(<HistoryScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('history.freeSession'));
    });

    expect(push).toHaveBeenCalledWith('/history/w-42');
  });
});

// ---------------------------------------------------------------------------
// Filtre de période
// ---------------------------------------------------------------------------

describe('filtre de période', () => {
  const historique = () => [
    seance({ id: 'hier', finishedAt: ilYA(1), startedAt: ilYA(1) }),
    seance({ id: 'il-y-a-20j', finishedAt: ilYA(20), startedAt: ilYA(20) }),
    seance({ id: 'il-y-a-60j', finishedAt: ilYA(60), startedAt: ilYA(60) }),
    seance({ id: 'il-y-a-200j', finishedAt: ilYA(200), startedAt: ilYA(200) }),
  ];

  beforeEach(() => {
    mockUseHistory.mockReturnValue({ workouts: historique(), isLoading: false });
  });

  const filtrer = async (cle: string) => {
    await act(async () => {
      fireEvent.press(screen.getByText(cle));
    });
  };

  it('« tout » est le filtre par défaut', async () => {
    await render(<HistoryScreen />);

    expect(lignes()).toHaveLength(4);
  });

  it.each([
    ['history.filter7d', 1],
    ['history.filter30d', 2],
    ['history.filter90d', 3],
  ])('%s ne garde que les séances de la fenêtre', async (cle, attendu) => {
    await render(<HistoryScreen />);

    await filtrer(cle);

    expect(lignes()).toHaveLength(attendu);
  });

  it('revenir à « tout » restaure la liste complète', async () => {
    await render(<HistoryScreen />);

    await filtrer('history.filter7d');
    await filtrer('history.filterAll');

    expect(lignes()).toHaveLength(4);
  });

  it('🔴 filtre sur la date de FIN, pas sur celle de début', async () => {
    mockUseHistory.mockReturnValue({
      workouts: [seance({ id: 'longue', startedAt: ilYA(40), finishedAt: ilYA(2) })],
      isLoading: false,
    });

    await render(<HistoryScreen />);
    await filtrer('history.filter7d');

    // Une séance commencée il y a 40 jours et clôturée avant-hier appartient à la semaine
    // écoulée. Filtrer sur `startedAt` la ferait disparaître sans explication.
    expect(lignes()).toHaveLength(1);
  });

  it('🔴 replie sur la date de début quand la séance n’a jamais été clôturée', async () => {
    mockUseHistory.mockReturnValue({
      workouts: [seance({ id: 'ouverte', startedAt: ilYA(2), finishedAt: null })],
      isLoading: false,
    });

    await render(<HistoryScreen />);
    await filtrer('history.filter7d');

    // Sans le repli, `new Date(null)` vaut le 1ᵉʳ janvier 1970 : la séance sortirait de **toutes**
    // les fenêtres, et l'utilisateur ne la retrouverait que dans « tout ».
    expect(lignes()).toHaveLength(1);
  });

  it('🔴 la borne est ramenée à MINUIT, pas à 7×24 h glissantes', async () => {
    // Séance faite il y a exactement 7 jours, en fin de matinée. Avec une borne glissante à
    // `now - 7j` (12 h), elle serait dedans le matin et dehors l'après-midi — une liste qui change
    // toute seule au fil de la journée.
    mockUseHistory.mockReturnValue({
      workouts: [
        seance({
          id: 'pile-7j',
          startedAt: '2026-08-01T08:00:00.000Z',
          finishedAt: '2026-08-01T09:00:00.000Z',
        }),
      ],
      isLoading: false,
    });

    await render(<HistoryScreen />);
    await filtrer('history.filter7d');

    expect(lignes()).toHaveLength(1);
  });

  it('🔴 un filtre qui ne rend rien affiche l’état vide, pas une liste blanche', async () => {
    mockUseHistory.mockReturnValue({
      workouts: [seance({ id: 'vieux', finishedAt: ilYA(300), startedAt: ilYA(300) })],
      isLoading: false,
    });

    await render(<HistoryScreen />);
    await filtrer('history.filter7d');

    // US MUSCU-UX01 : message **spécifique au filtre**, et non celui du compte vide. « Démarre ta
    // première séance » à quelqu'un qui en a trois cents, parce qu'il a cliqué « 7 j », est faux —
    // ce qu'il faut lui proposer, c'est de retirer le filtre.
    expect(screen.getByText('history.empty.filtered')).toBeTruthy();
  });
});
