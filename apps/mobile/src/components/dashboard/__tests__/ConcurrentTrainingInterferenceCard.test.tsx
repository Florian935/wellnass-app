/**
 * US MR-08 — smoke test du widget de divergence muscu/course.
 *
 * Vérifie le contrat de la spec : masqué quand `show` est faux, titre + message visibles quand
 * une divergence est détectée, dans les deux sens (spec R4, bidirectionnel).
 *
 * Même stratégie de mock que `ActivityLevelSuggestionCard.test.tsx` : repository, i18n (clés en
 * sentinelle), thème isolés.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { ConcurrentTrainingInterferenceCard } from '../ConcurrentTrainingInterferenceCard';
import { useConcurrentTrainingInterference } from '@/data/repositories/dashboard-repository';
import type { ConcurrentTrainingInterference } from '@wellness/shared';

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useConcurrentTrainingInterference: jest.fn(),
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
      text: '#26243a',
      textMuted: '#5f5d78',
      accent: '#4a3f8f',
      surface: '#fbfbfe',
      border: '#dcdbec',
    },
  })),
}));

function mockInterference(result: ConcurrentTrainingInterference) {
  (useConcurrentTrainingInterference as jest.Mock).mockReturnValue(result);
}

describe('ConcurrentTrainingInterferenceCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ne rend rien quand show est faux (pas de divergence, ou gating incomplet)', async () => {
    mockInterference({ show: false, direction: null, runRatio: null, strengthRatio: null });
    const { toJSON } = await render(<ConcurrentTrainingInterferenceCard size="wide" />);
    expect(toJSON()).toBeNull();
  });

  it('affiche le titre et le message en forme wide, direction course en hausse', async () => {
    mockInterference({ show: true, direction: 'runningUpStrengthDown', runRatio: 1.42, strengthRatio: 0.71 });
    const { getByText } = await render(<ConcurrentTrainingInterferenceCard size="wide" />);
    expect(getByText('home.concurrentTrainingInterference.title')).toBeTruthy();
    expect(getByText('home.concurrentTrainingInterference.message')).toBeTruthy();
  });

  it('affiche le titre et le message en forme wide, direction muscu en hausse (symétrique, R4)', async () => {
    mockInterference({ show: true, direction: 'strengthUpRunningDown', runRatio: 1.42, strengthRatio: 0.71 });
    const { getByText } = await render(<ConcurrentTrainingInterferenceCard size="wide" />);
    expect(getByText('home.concurrentTrainingInterference.title')).toBeTruthy();
    expect(getByText('home.concurrentTrainingInterference.message')).toBeTruthy();
  });

  it('forme small : titre seul', async () => {
    mockInterference({ show: true, direction: 'runningUpStrengthDown', runRatio: 1.42, strengthRatio: 0.71 });
    const { getByText, queryByText } = await render(
      <ConcurrentTrainingInterferenceCard size="small" />,
    );
    expect(getByText('home.concurrentTrainingInterference.title')).toBeTruthy();
    expect(queryByText('home.concurrentTrainingInterference.message')).toBeNull();
  });

  it('forme large : affiche le hint (jamais une action suggérée, spec R5)', async () => {
    mockInterference({ show: true, direction: 'strengthUpRunningDown', runRatio: 1.42, strengthRatio: 0.71 });
    const { getByText, queryByText } = await render(
      <ConcurrentTrainingInterferenceCard size="large" />,
    );
    expect(getByText('home.concurrentTrainingInterference.hint')).toBeTruthy();
    expect(queryByText('home.concurrentTrainingInterference.apply')).toBeNull();
  });
});
