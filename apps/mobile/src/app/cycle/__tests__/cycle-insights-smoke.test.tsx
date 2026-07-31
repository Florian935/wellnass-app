/**
 * US CYCLE-01 — smoke test de l'écran « Croisement » (`app/cycle/insights.tsx`).
 *
 * Ce qui compte : les 6 métriques (dont les 2 ajoutées ici — `calories`, `pace`) se rendent sans
 * planter dans leurs deux états (`insufficient` / prêt), et le formatage spécifique de l'allure et
 * des calories (§ `useMetricFormatter`) ne casse rien — ni une chaîne brute en secondes pour
 * l'allure, ni un nombre non arrondi pour les calories.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import CycleInsightsScreen from '../insights';
import { useCycleInsights } from '@/data/repositories/cycle-insights-repository';

// Pas de `requireActual` : le vrai module importe `workout-repository` → `@/i18n` (init i18next
// réel), qui entrerait en conflit avec le mock de `react-i18next` ci-dessous. La liste des métriques
// est donc dupliquée ici — elle ne change pas indépendamment de l'écran qui la consomme.
jest.mock('@/data/repositories/cycle-insights-repository', () => ({
  CYCLE_INSIGHT_METRICS: ['energy', 'mood', 'stress', 'tonnage', 'calories', 'pace'],
  useCycleInsights: jest.fn(),
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
      surface: '#fffaf2',
      track: '#ece0cd',
    },
  }),
}));

// `formatPace` dépend de `useSettings` (PowerSync) via `useUnits` — hors de propos pour ce smoke
// test, qui vérifie l'écran, pas la conversion d'unités (déjà testée ailleurs).
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({ formatPace: (s: number) => `${Math.round(s)}s/km` }),
}));

const mockUseCycleInsights = useCycleInsights as jest.Mock;

const INSUFFICIENT = {
  status: 'insufficient' as const,
  cyclesNeeded: 3,
  cyclesAvailable: 1,
  missingByPhase: { menstrual: 2, follicular: 5, ovulatory: 0, luteal: 3 },
};

const READY = {
  status: 'ready' as const,
  cyclesObserved: 4,
  byPhase: {
    menstrual: { average: 2.8, count: 6 },
    follicular: { average: 3.6, count: 8 },
    ovulatory: { average: 3.4, count: 4 },
    luteal: { average: 2.9, count: 7 },
  },
};

describe('CycleInsightsScreen — smoke', () => {
  it('toutes les métriques en insuffisant → écran sans crash, dit ce qui manque', async () => {
    mockUseCycleInsights.mockReturnValue({
      byMetric: {
        energy: INSUFFICIENT,
        mood: INSUFFICIENT,
        stress: INSUFFICIENT,
        tonnage: INSUFFICIENT,
        calories: INSUFFICIENT,
        pace: INSUFFICIENT,
      },
      cyclesObserved: 1,
      isLoading: false,
    });
    const { getAllByText } = await render(<CycleInsightsScreen />);
    expect(getAllByText('cycle.insights.pending')).toHaveLength(6);
  });

  it('toutes les métriques prêtes, dont calories et pace → formatage sans crash', async () => {
    mockUseCycleInsights.mockReturnValue({
      byMetric: {
        energy: READY,
        mood: READY,
        stress: READY,
        tonnage: READY,
        calories: READY,
        pace: READY,
      },
      cyclesObserved: 4,
      isLoading: false,
    });
    const { getAllByText, getByText } = await render(<CycleInsightsScreen />);
    // Titres des 6 métriques, dont les 2 nouvelles.
    expect(getByText('cycle.insights.metrics.calories')).toBeTruthy();
    expect(getByText('cycle.insights.metrics.pace')).toBeTruthy();
    // La pace est formatée via `useUnits().formatPace` (mocké), pas affichée en secondes brutes.
    expect(getAllByText('3s/km').length).toBeGreaterThan(0); // round(2.8..3.6) selon la phase
    // Les calories portent le suffixe kcal.
    expect(getAllByText(/nutrition\.kcal/).length).toBeGreaterThan(0);
  });

  it('métriques mixtes (certaines prêtes, d’autres non) → les deux états coexistent (R13)', async () => {
    mockUseCycleInsights.mockReturnValue({
      byMetric: {
        energy: READY,
        mood: INSUFFICIENT,
        stress: INSUFFICIENT,
        tonnage: INSUFFICIENT,
        calories: INSUFFICIENT,
        pace: INSUFFICIENT,
      },
      cyclesObserved: 4,
      isLoading: false,
    });
    const { getAllByText } = await render(<CycleInsightsScreen />);
    expect(getAllByText('cycle.insights.pending')).toHaveLength(5);
  });

  it('isLoading → ne rend rien', async () => {
    mockUseCycleInsights.mockReturnValue({ byMetric: {}, cyclesObserved: 0, isLoading: true });
    const { toJSON } = await render(<CycleInsightsScreen />);
    expect(toJSON()).toBeNull();
  });
});
