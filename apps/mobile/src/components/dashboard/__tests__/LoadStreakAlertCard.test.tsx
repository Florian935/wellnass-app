/**
 * US MR-14 — smoke test du widget « jours consécutifs sans repos ».
 *
 * Vérifie le contrat de la spec : masqué quand `show` est faux (sous le seuil, gating incomplet,
 * ou TRI-12 déjà affiché — D1), titre interpolé avec le nombre de jours réel quand l'alerte est
 * active, recommandation visible en forme large.
 *
 * Même stratégie de mock que `ConcurrentTrainingInterferenceCard.test.tsx` : repository, i18n
 * (clés en sentinelle), thème isolés.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { LoadStreakAlertCard } from '../LoadStreakAlertCard';
import { useLoadStreakAlert } from '@/data/repositories/dashboard-repository';
import type { LoadStreakAlert } from '@wellness/shared';

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useLoadStreakAlert: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    // Renvoie la clé, suffixée des options pour vérifier l'interpolation du nombre de jours.
    t: (k: string, opts?: Record<string, unknown>) =>
      opts?.days != null ? `${k}:${String(opts.days)}` : k,
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
      warnBorder: '#e2b3a6',
      warnText: '#a63b2e',
    },
  })),
}));

function mockAlert(result: LoadStreakAlert) {
  (useLoadStreakAlert as jest.Mock).mockReturnValue(result);
}

describe('LoadStreakAlertCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ne rend rien quand show est faux (sous le seuil, gating incomplet, ou TRI-12 actif — D1)', async () => {
    mockAlert({ show: false, streakDays: 4 });
    const { toJSON } = await render(<LoadStreakAlertCard size="wide" />);
    expect(toJSON()).toBeNull();
  });

  it('affiche le titre interpolé avec le nombre de jours réel, en forme wide', async () => {
    mockAlert({ show: true, streakDays: 8 });
    const { getByText } = await render(<LoadStreakAlertCard size="wide" />);
    expect(getByText('home.loadStreakAlert.title:8')).toBeTruthy();
    expect(getByText('home.loadStreakAlert.message')).toBeTruthy();
  });

  it('forme small : titre seul, pas le message', async () => {
    mockAlert({ show: true, streakDays: 6 });
    const { getByText, queryByText } = await render(<LoadStreakAlertCard size="small" />);
    expect(getByText('home.loadStreakAlert.title:6')).toBeTruthy();
    expect(queryByText('home.loadStreakAlert.message')).toBeNull();
  });

  it('forme large : affiche la recommandation de repos', async () => {
    mockAlert({ show: true, streakDays: 9 });
    const { getByText } = await render(<LoadStreakAlertCard size="large" />);
    expect(getByText('home.loadStreakAlert.title:9')).toBeTruthy();
    expect(getByText('home.loadStreakAlert.recommend')).toBeTruthy();
  });
});
