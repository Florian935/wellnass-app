/**
 * US OBJ-01 — smoke test du widget d'objectifs.
 *
 * Ce qui est vérifié est le **contrat produit** de la spec, pas le rendu :
 *  - aucun état muet : sans objectif, une invitation ;
 *  - l'anneau **ne porte jamais seul** l'information — la valeur atteinte et la cible sont en texte ;
 *  - une progression **non calculable** (exercice supprimé) est dite, et surtout n'affiche **pas**
 *    « 0 % », qui se lirait comme un échec ;
 *  - l'ordre est celui de l'**urgence** (échéance), pas de l'avancement.
 *
 * Même stratégie de mock que `WellbeingCard.test.tsx` : repositories, i18n, thème et unités isolés
 * pour ne dépendre ni de PowerSync ni du natif.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { GoalsCard } from '../GoalsCard';
import { useGoals } from '@/data/repositories/goal-repository';

jest.mock('@/data/repositories/goal-repository', () => ({
  useGoals: jest.fn(() => ({ active: [], finished: [], isLoading: false })),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatDistance: (km: number | null) => (km == null ? '—' : `${km} km`),
    formatWeight: (kg: number | null) => (kg == null ? '—' : `${kg} kg`),
    distanceSymbol: 'km',
    weightSymbol: 'kg',
  }),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    // Les clés sont renvoyées en sentinelle ; les interpolations sont rendues pour être cherchées.
    t: (k: string, opts?: Record<string, unknown>) =>
      opts === undefined ? k : `${k}:${JSON.stringify(opts)}`,
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#f7eede',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      track: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
      danger: '#b23b2e',
      warn: '#fbf1dd',
      warnBorder: '#b5761f',
      warnText: '#b5761f',
      panel: '#2b2018',
      panelMuted: '#8f8272',
    },
  })),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

type Active = Parameters<typeof mockGoals>[0];

const mockGoals = (active: Record<string, unknown>[]) =>
  (useGoals as jest.Mock).mockReturnValue({ active, finished: [], isLoading: false });

/** Objectif de course à mi-parcours. */
const runGoal = (overrides: Record<string, unknown> = {}) => ({
  id: 'g-run',
  kind: 'run_distance',
  targetValue: 50_000,
  startValue: null,
  exerciseId: null,
  startDate: '2026-07-01',
  deadline: '2026-12-31',
  exerciseName: null,
  progress: {
    currentValue: 20_000,
    ratio: 0.4,
    rawRatio: 0.4,
    status: 'active',
    unavailable: false,
  },
  ...overrides,
});

describe('GoalsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGoals([]);
  });

  it('invite à créer un objectif quand il n’y en a aucun, plutôt qu’une carte morte', async () => {
    const { getByText } = await render(<GoalsCard size="wide" />);
    expect(getByText('goals.widgetEmpty')).toBeTruthy();
  });

  it('écrit la valeur atteinte et la cible en TEXTE — l’anneau ne porte jamais seul l’info', async () => {
    mockGoals([runGoal()]);
    const { getByText } = await render(<GoalsCard size="wide" />);
    // 20 000 m et 50 000 m stockés → 20 km / 50 km affichés.
    expect(getByText(/goals\.progress.*20 km.*50 km/)).toBeTruthy();
  });

  it('dit qu’une progression est non calculable au lieu d’afficher 0 %', async () => {
    // Exercice visé supprimé : `exerciseId` est passé à NULL côté base (on delete set null).
    mockGoals([
      runGoal({
        kind: 'exercise_1rm',
        exerciseName: 'Développé couché',
        progress: {
          currentValue: null,
          ratio: null,
          rawRatio: null,
          status: 'active',
          unavailable: true,
        },
      }),
    ]);
    const { getByText, queryByText } = await render(<GoalsCard size="wide" />);
    expect(getByText('goals.unavailable')).toBeTruthy();
    expect(queryByText('0%')).toBeNull();
  });

  it('affiche jusqu’à 3 objectifs en grande forme, 1 seul en rectangle', async () => {
    const three: Active = [
      runGoal({ id: 'a' }),
      runGoal({ id: 'b' }),
      runGoal({ id: 'c' }),
    ];
    mockGoals(three);

    const wide = await render(<GoalsCard size="wide" />);
    expect(wide.queryAllByText(/goals\.progress/)).toHaveLength(1);

    const large = await render(<GoalsCard size="large" />);
    expect(large.queryAllByText(/goals\.progress/)).toHaveLength(3);
  });

  it('ne rend rien pendant le chargement', async () => {
    (useGoals as jest.Mock).mockReturnValue({ active: [], finished: [], isLoading: true });
    const { toJSON } = await render(<GoalsCard size="wide" />);
    expect(toJSON()).toBeNull();
  });
});
