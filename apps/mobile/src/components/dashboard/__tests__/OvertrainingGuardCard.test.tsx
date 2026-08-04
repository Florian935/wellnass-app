/**
 * US GARDE-01 — smoke test du garde-fou unifié charge & récupération (fusion TRI-12 + MR-14).
 *
 * Vérifie le contrat central de la fusion : **une seule carte, deux niveaux de sévérité**.
 *  - masquée quand `show` est faux ;
 *  - niveau `streak` → textes de repos, titre interpolé avec le nombre de jours réel ;
 *  - niveau `streakAndDeficit` → textes de surcharge (ceux de TRI-12, conservés mot pour mot).
 *
 * Le point le plus important : **l'eyebrow est le même aux deux niveaux**. C'est ce qui garantit que
 * l'utilisateur voit *une* carte qui change de contenu, et non deux cartes qui se relaient — le
 * défaut que cette US corrige (spec §0).
 *
 * Même stratégie de mock que les autres cartes Tier 2 : repository, i18n (clés en sentinelle,
 * suffixées des options pour vérifier l'interpolation), thème isolés.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { OvertrainingGuardCard } from '../OvertrainingGuardCard';
import { useOvertrainingGuardAlert } from '@/data/repositories/dashboard-repository';
import type { OvertrainingGuardResult } from '@wellness/shared';

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useOvertrainingGuardAlert: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
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

function mockGuard(result: OvertrainingGuardResult) {
  (useOvertrainingGuardAlert as jest.Mock).mockReturnValue(result);
}

describe('OvertrainingGuardCard (US GARDE-01, 2 niveaux)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ne rend rien sous le seuil de streak (gating ou streak insuffisant)', async () => {
    mockGuard({ show: false, severity: null, streakDays: 3 });
    const { toJSON } = await render(<OvertrainingGuardCard size="wide" />);
    expect(toJSON()).toBeNull();
  });

  it('niveau repos : titre interpolé avec le nombre de jours réel + message de repos', async () => {
    mockGuard({ show: true, severity: 'streak', streakDays: 8 });
    const { getByText } = await render(<OvertrainingGuardCard size="wide" />);
    expect(getByText('home.overtrainingGuard.streak.title:8')).toBeTruthy();
    expect(getByText('home.overtrainingGuard.streak.message')).toBeTruthy();
  });

  it('niveau surcharge : textes de TRI-12, jamais ceux du niveau repos', async () => {
    mockGuard({ show: true, severity: 'streakAndDeficit', streakDays: 9 });
    const { getByText, queryByText } = await render(<OvertrainingGuardCard size="wide" />);
    // Regex sur le préfixe de clé : `days` est passé aux **deux** niveaux (i18next ignore une
    // variable qu'une chaîne n'utilise pas), donc le mock le suffixe même ici. En production
    // `deficit.title` n'a pas de placeholder — l'assertion ne doit pas dépendre de cet artefact.
    expect(getByText(/home\.overtrainingGuard\.deficit\.title/)).toBeTruthy();
    expect(getByText('home.overtrainingGuard.deficit.message')).toBeTruthy();
    expect(queryByText('home.overtrainingGuard.streak.message')).toBeNull();
  });

  it('même eyebrow aux deux niveaux — une carte qui change de contenu, pas deux cartes (spec §0)', async () => {
    mockGuard({ show: true, severity: 'streak', streakDays: 7 });
    const streakRender = await render(<OvertrainingGuardCard size="large" />);
    expect(streakRender.getByText('home.overtrainingGuard.eyebrow')).toBeTruthy();

    mockGuard({ show: true, severity: 'streakAndDeficit', streakDays: 7 });
    const deficitRender = await render(<OvertrainingGuardCard size="large" />);
    expect(deficitRender.getByText('home.overtrainingGuard.eyebrow')).toBeTruthy();
  });

  it('forme small : titre seul, pas le message', async () => {
    mockGuard({ show: true, severity: 'streak', streakDays: 6 });
    const { getByText, queryByText } = await render(<OvertrainingGuardCard size="small" />);
    expect(getByText('home.overtrainingGuard.streak.title:6')).toBeTruthy();
    expect(queryByText('home.overtrainingGuard.streak.message')).toBeNull();
  });

  it('forme large : affiche la recommandation du niveau courant', async () => {
    mockGuard({ show: true, severity: 'streakAndDeficit', streakDays: 10 });
    const { getByText } = await render(<OvertrainingGuardCard size="large" />);
    expect(getByText('home.overtrainingGuard.deficit.recommend')).toBeTruthy();
  });

  it('severity null avec show true (état incohérent) → ne rend rien plutôt que de crasher', async () => {
    mockGuard({ show: true, severity: null, streakDays: 6 });
    const { toJSON } = await render(<OvertrainingGuardCard size="wide" />);
    expect(toJSON()).toBeNull();
  });
});
