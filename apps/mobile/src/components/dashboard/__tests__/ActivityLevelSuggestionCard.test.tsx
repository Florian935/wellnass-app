/**
 * US RN-03 — smoke test du widget de suggestion de niveau d'activité.
 *
 * Vérifie le contrat de la spec : masqué quand `show` est faux, message + indication du renvoi
 * vers le profil nutrition visibles quand un écart existe — jamais de bouton d'application directe
 * (spec D5, texte seul).
 *
 * Même stratégie de mock que `ReadinessCard.test.tsx` : repository, i18n (clés en sentinelle),
 * thème et icônes isolés.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { ActivityLevelSuggestionCard } from '../ActivityLevelSuggestionCard';
import { useActivityLevelSuggestion } from '@/data/repositories/dashboard-repository';
import type { ActivityLevelSuggestion } from '@/data/repositories/dashboard-repository';

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useActivityLevelSuggestion: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string) => k,
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: jest.fn(() => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      accent: '#c0562f',
      surface: '#fffaf2',
      border: '#ece0cd',
    },
  })),
}));

function mockSuggestion(result: ActivityLevelSuggestion) {
  (useActivityLevelSuggestion as jest.Mock).mockReturnValue(result);
}

describe('ActivityLevelSuggestionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ne rend rien quand show est faux (palier déjà cohérent, ou gating hors course+nutrition)', async () => {
    mockSuggestion({ show: false });
    const { toJSON } = await render(<ActivityLevelSuggestionCard size="wide" />);
    expect(toJSON()).toBeNull();
  });

  it('affiche le titre et le message quand un écart existe, en forme wide', async () => {
    mockSuggestion({ show: true, current: 'sedentary', suggested: 'active', runningDays: 12 });
    const { getByText } = await render(<ActivityLevelSuggestionCard size="wide" />);
    expect(getByText('home.activityLevelSuggestion.title')).toBeTruthy();
    expect(getByText('home.activityLevelSuggestion.message')).toBeTruthy();
  });

  it('forme small : titre seul', async () => {
    mockSuggestion({ show: true, current: 'active', suggested: 'sedentary', runningDays: 0 });
    const { getByText, queryByText } = await render(<ActivityLevelSuggestionCard size="small" />);
    expect(getByText('home.activityLevelSuggestion.title')).toBeTruthy();
    expect(queryByText('home.activityLevelSuggestion.message')).toBeNull();
  });

  it('forme large : affiche l’indication de renvoi vers le profil (jamais de bouton d’application, spec D5)', async () => {
    mockSuggestion({ show: true, current: 'sedentary', suggested: 'active', runningDays: 12 });
    const { getByText, queryByText } = await render(<ActivityLevelSuggestionCard size="large" />);
    expect(getByText('home.activityLevelSuggestion.hint')).toBeTruthy();
    expect(queryByText('home.activityLevelSuggestion.apply')).toBeNull();
  });
});
