/**
 * Réglages › Labo IA (US IA-LAB-01), sous la bêta fermée d'ACCES-IA (spec §4.1, §14 critère 11).
 *
 * L'accord au labo s'écrit **en local** : la section ne doit s'offrir qu'à un accès confirmé, sinon un
 * non-testeur hors ligne pourrait s'en créer un seul. Elle reste pour **retirer** un accord existant.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { AiLabSection } from '../AiLabSection';
import { updateSettings } from '@/data/repositories/settings-repository';

jest.mock('@/data/repositories/settings-repository', () => ({ updateSettings: jest.fn(async () => undefined) }));

let mockAccess: 'allowed' | 'closed' | 'unknown' = 'allowed';
jest.mock('@/hooks/useAiAccess', () => ({
  useAiAccess: () => ({ access: mockAccess, mode: 'testers', status: null }),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#786a59', surface: '#fffaf2', border: '#ece0cd', background: '#f7eede', accent: '#b14f2b', accentText: '#fff', danger: '#b23b2e', borderStrong: '#999' },
  }),
}));

const CONSENT = '2026-09-15T10:00:00.000Z';

beforeEach(() => {
  jest.clearAllMocks();
  mockAccess = 'allowed';
});

describe('AiLabSection — ACCES-IA', () => {
  it('accès confirmé : la section d’IA-LAB-01, inchangée', async () => {
    await render(<AiLabSection consentedAt={CONSENT} />);

    expect(screen.getByText('aiLab.settings.toggle')).toBeTruthy();
    expect(screen.getByText('aiLab.settings.open')).toBeTruthy();
  });

  it.each(['closed', 'unknown'] as const)('🔴 accès « %s » sans accord : rien', async (access) => {
    mockAccess = access;

    await render(<AiLabSection consentedAt={null} />);

    expect(screen.queryByText('aiLab.settings.title')).toBeNull();
  });

  it('🔴 bêta fermée avec un accord : carte réduite, et le bouton retire l’accord', async () => {
    mockAccess = 'closed';

    await render(<AiLabSection consentedAt={CONSENT} />);

    expect(screen.getByTestId('ai-lab-settings-closed')).toBeTruthy();
    expect(screen.getByText('aiLab.settings.closed')).toBeTruthy();
    expect(screen.queryByText('aiLab.settings.open')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('ai-lab-settings-withdraw'));
    });
    expect(updateSettings).toHaveBeenCalledWith({ aiConsentAt: null });
  });

  it('accès inconnu avec un accord : l’interrupteur reste pour le retirer, sans porte vers le labo', async () => {
    mockAccess = 'unknown';

    await render(<AiLabSection consentedAt={CONSENT} />);

    expect(screen.getByText('aiLab.settings.toggle')).toBeTruthy();
    expect(screen.queryByText('aiLab.settings.open')).toBeNull();
  });
});
