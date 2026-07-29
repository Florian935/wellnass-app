/**
 * US BILAN-01 — smoke test du widget de bilan.
 *
 * Ce qui est vérifié est le **contrat de l'US**, pas le rendu :
 *  - la règle non négociable — **jamais de narration sans chiffres** : le widget affiche toujours des
 *    nombres à côté de la décision ;
 *  - **une seule** décision, jamais deux ;
 *  - semaine vide → **message de reprise**, jamais un reproche (décision D4).
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { ReviewCard } from '../ReviewCard';
import { useWeeklyReview } from '@/data/repositories/weekly-review-repository';

jest.mock('@/data/repositories/weekly-review-repository', () => ({
  useWeeklyReview: jest.fn(),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatDistance: (km: number | null) => (km == null ? '—' : `${km} km`),
    formatWeight: (kg: number | null) => (kg == null ? '—' : `${kg} kg`),
  }),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
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

const week = {
  workouts: 3,
  tonnageKg: 12_000,
  runs: 2,
  distanceM: 20_000,
  loggedDays: 6,
  daysInTarget: 5,
  activeDays: 5,
};

const mockReview = (over: Record<string, unknown> = {}, isLoading = false) =>
  (useWeeklyReview as jest.Mock).mockReturnValue({
    isLoading,
    review: {
      period: { start: '2026-07-20', end: '2026-07-26' },
      current: week,
      previous: week,
      recordsBeaten: 1,
      changes: { tonnage: null, distance: null, activeDays: null, loggedDays: null },
      isEmpty: false,
      decision: { kind: 'all_good', metrics: { activeDays: 5, workouts: 3, runs: 2 } },
      ...over,
    },
  });

describe('ReviewCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReview();
  });

  it('affiche la décision de la semaine', async () => {
    const { getByText } = await render(<ReviewCard size="wide" />);
    expect(getByText(/review\.decisions\.all_good/)).toBeTruthy();
  });

  it('accompagne TOUJOURS la décision de chiffres — la règle non négociable', async () => {
    const { getByText } = await render(<ReviewCard size="wide" />);
    // 5 jours actifs sur 7, affichés à côté du texte.
    expect(getByText(/5\/7/)).toBeTruthy();
  });

  it('n’affiche qu’UNE seule décision, jamais deux', async () => {
    const { queryAllByText } = await render(<ReviewCard size="large" />);
    expect(queryAllByText(/review\.decisions\./)).toHaveLength(1);
  });

  it('semaine vide : message de reprise, et AUCUNE décision', async () => {
    mockReview({ isEmpty: true, decision: null });
    const { getByText, queryAllByText } = await render(<ReviewCard size="wide" />);
    expect(getByText('review.empty')).toBeTruthy();
    expect(queryAllByText(/review\.decisions\./)).toHaveLength(0);
  });

  it('décision absente sans semaine vide : on ne raconte rien pour autant', async () => {
    // Défense : `decision === null` doit suffire à basculer sur l'état neutre, même si `isEmpty`
    // n'a pas été positionné — les deux ne doivent pas pouvoir se contredire à l'écran.
    mockReview({ isEmpty: false, decision: null });
    const { getByText } = await render(<ReviewCard size="wide" />);
    expect(getByText('review.empty')).toBeTruthy();
  });

  it('ne rend rien pendant le chargement', async () => {
    mockReview({}, true);
    const { toJSON } = await render(<ReviewCard size="wide" />);
    expect(toJSON()).toBeNull();
  });
});
