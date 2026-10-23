/**
 * Écran du Labo IA (`app/ai-lab.tsx`) sous la bêta fermée d'ACCES-IA (spec §4.1, §14 critère 11).
 *
 * Les Réglages ne mènent plus au labo sans accès confirmé ; cet écran reste le garde d'un **lien
 * direct** : sans accès, il le dit, et ne montre ni le formulaire ni « ce qui est envoyé ».
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import AiLabScreen from '../ai-lab';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#786a59', surface: '#fffaf2', surfaceAlt: '#f3ddd0', border: '#ece0cd', background: '#f7eede', accent: '#b14f2b', accentText: '#fff', danger: '#b23b2e', borderStrong: '#999' },
  }),
}));
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: () => ({ settings: { aiConsentAt: '2026-09-15T10:00:00.000Z' }, isLoading: false }),
}));
jest.mock('@/data/repositories/ai-context-repository', () => ({
  AI_CONTEXT_WINDOW_DAYS: 28,
  useAiSnapshot: () => ({ snapshot: null, context: 'contexte', isLoading: false }),
}));
jest.mock('@/lib/ai/ai-client', () => ({ callAiAssist: jest.fn() }));

let mockAccess: 'allowed' | 'closed' | 'unknown' = 'allowed';
let mockLoading = false;
jest.mock('@/hooks/useAiAccess', () => ({
  useAiAccess: () => ({ access: mockAccess, mode: 'testers', status: null, loading: mockLoading }),
}));

beforeEach(() => {
  mockAccess = 'allowed';
  mockLoading = false;
});

describe('AiLabScreen — ACCES-IA', () => {
  it('accès confirmé : le labo d’IA-LAB-01', async () => {
    await render(<AiLabScreen />);

    expect(screen.getByText('aiLab.warning.title')).toBeTruthy();
    expect(screen.getByText('aiLab.context.title')).toBeTruthy();
  });

  it('🔴 bêta fermée : « réservé aux testeurs », sans formulaire', async () => {
    mockAccess = 'closed';

    await render(<AiLabScreen />);

    expect(screen.getByTestId('ai-lab-closed')).toBeTruthy();
    expect(screen.getByText('aiLab.closed')).toBeTruthy();
    expect(screen.queryByText('aiLab.context.title')).toBeNull();
    expect(screen.queryByText('aiLab.ask.title')).toBeNull();
  });

  it('première demande de statut en cours : ni formulaire, ni « il faut le réseau »', async () => {
    mockAccess = 'unknown';
    mockLoading = true;

    await render(<AiLabScreen />);

    expect(screen.queryByText('aiLab.unknown')).toBeNull();
    expect(screen.queryByText('aiLab.context.title')).toBeNull();
  });

  it('accès inconnu : « il faut le réseau », sans formulaire', async () => {
    mockAccess = 'unknown';

    await render(<AiLabScreen />);

    expect(screen.getByText('aiLab.unknown')).toBeTruthy();
    expect(screen.queryByText('aiLab.context.title')).toBeNull();
  });
});
