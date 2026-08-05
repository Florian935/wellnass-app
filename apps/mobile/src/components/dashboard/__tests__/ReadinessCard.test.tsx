/**
 * US TRI-03 — smoke test du widget de score de forme (readiness).
 *
 * Vérifie le contrat de la spec : masqué quand `show` est faux (R5), verdict + emoji cohérents
 * par forme, et le détail des 3 composantes (R8) visible en forme `large` — y compris l'affichage
 * distinct d'une composante `unavailable` avec sa raison (jamais confondue avec un état neutre).
 *
 * Même stratégie de mock que `WellbeingCard.test.tsx` : repository, i18n (clés en sentinelle),
 * thème et icônes isolés pour ne dépendre ni de PowerSync ni du natif.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { ReadinessCard } from '../ReadinessCard';
import { useReadiness } from '@/data/repositories/dashboard-repository';
import type { ReadinessComponent, ReadinessResult } from '@wellness/shared';

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useReadiness: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    // Les clés sont renvoyées telles quelles pour être cherchées dans l'arbre.
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
      success: '#66714b',
      warn: '#f7ead6',
      warnBorder: '#e9cfa0',
      warnText: '#8a6419',
      surface: '#fffaf2',
      border: '#ece0cd',
    },
  })),
}));

function mockResult(result: ReadinessResult) {
  (useReadiness as jest.Mock).mockReturnValue(result);
}

const unavailable = (reason?: ReadinessComponent['reason']): ReadinessComponent =>
  reason ? { state: 'unavailable', reason } : { state: 'unavailable' };
const positive: ReadinessComponent = { state: 'positive' };
const neutral: ReadinessComponent = { state: 'neutral' };
const negative: ReadinessComponent = { state: 'negative' };

describe('ReadinessCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ne rend rien quand show est faux (R5, aucune composante disponible)', async () => {
    mockResult({
      show: false,
      verdict: null, negativeCount: 0, availableCount: 3,
      load: unavailable('insufficient-history'),
      nutrition: unavailable('insufficient-logged-days'),
      wellbeing: unavailable('no-recent-checkin'),
    });
    const { toJSON } = await render(<ReadinessCard size="wide" />);
    expect(toJSON()).toBeNull();
  });

  it('affiche le titre et le message du verdict « rest » en forme wide', async () => {
    mockResult({ show: true, verdict: 'rest', negativeCount: 0, availableCount: 3, load: negative, nutrition: neutral, wellbeing: positive });
    const { getByText } = await render(<ReadinessCard size="wide" />);
    expect(getByText('home.readiness.verdict.rest.title')).toBeTruthy();
    expect(getByText('home.readiness.verdict.rest.message')).toBeTruthy();
  });

  it('affiche le titre du verdict « push » (un seul signal positif suffit, R4)', async () => {
    mockResult({ show: true, verdict: 'push', negativeCount: 0, availableCount: 3, load: positive, nutrition: neutral, wellbeing: neutral });
    const { getByText } = await render(<ReadinessCard size="wide" />);
    expect(getByText('home.readiness.verdict.push.title')).toBeTruthy();
  });

  it('forme small : titre seul, pas le détail des composantes', async () => {
    mockResult({ show: true, verdict: 'ok', negativeCount: 0, availableCount: 3, load: neutral, nutrition: neutral, wellbeing: neutral });
    const { getByText, queryByText } = await render(<ReadinessCard size="small" />);
    expect(getByText('home.readiness.verdict.ok.title')).toBeTruthy();
    expect(queryByText(/home\.readiness\.component/)).toBeNull();
  });

  it('forme large : détail des 3 composantes, une indisponible avec sa raison (R8)', async () => {
    mockResult({
      show: true,
      verdict: 'ok', negativeCount: 0, availableCount: 3,
      load: neutral,
      nutrition: unavailable('insufficient-logged-days'),
      wellbeing: positive,
    });
    const { getByText } = await render(<ReadinessCard size="large" />);
    expect(
      getByText('home.readiness.component.nutrition : home.readiness.unavailable — home.readiness.reason.insufficientLoggedDays'),
    ).toBeTruthy();
    expect(getByText('home.readiness.component.load : home.readiness.load.neutral')).toBeTruthy();
    expect(getByText('home.readiness.component.wellbeing : home.readiness.wellbeing.positive')).toBeTruthy();
  });
});
