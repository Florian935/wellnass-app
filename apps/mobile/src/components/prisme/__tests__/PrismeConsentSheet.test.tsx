/**
 * US PRISME-01 — la feuille d'accord. Ce qu'elle doit tenir : dire d'abord que c'est une IA (R14),
 * nommer le **vrai** fournisseur et son pays, lus dans le statut (R6), et exiger « 18 ans ou plus »
 * quand la date de naissance est inconnue (DD15).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { PrismeStatus } from '@wellness/shared';

import { PrismeConsentSheet } from '../PrismeConsentSheet';
import { grantPrismeConsent } from '@/lib/ai/prisme';

jest.mock('@/lib/ai/prisme', () => ({ grantPrismeConsent: jest.fn() }));

let mockBirthDate: string | null = null;
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: () => ({ profile: { birthDate: mockBirthDate }, isLoading: false }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k),
    i18n: { language: 'fr' },
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#786a59', surface: '#fffaf2', border: '#ece0cd', background: '#f7eede', danger: '#b23b2e', accent: '#b14f2b', accentText: '#fff' },
    scheme: 'light',
  }),
}));

const mockGrant = grantPrismeConsent as jest.Mock;

const STATUS: PrismeStatus = {
  available: true,
  reason: null,
  provider: { id: 'groq', label: 'Groq', country: 'US', trains: false, retentionDays: 30 },
  consent: { at: null, provider: null },
  remaining: { narrate: 6, meal_text: 6 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBirthDate = null;
});

describe('PrismeConsentSheet', () => {
  it('🔴 dit que c’est une IA, et nomme le fournisseur réel avec son pays', async () => {
    await render(<PrismeConsentSheet visible status={STATUS} onClose={jest.fn()} onGranted={jest.fn()} />);

    expect(screen.getByText('prisme.consent.isAi')).toBeTruthy();
    expect(screen.getByText(/prisme\.consent\.where .*"provider":"Groq".*"country":"prisme\.country\.US"/)).toBeTruthy();
    expect(screen.getByText('prisme.consent.trainingNo')).toBeTruthy();
    expect(screen.getByText(/prisme\.consent\.retention .*"days":30/)).toBeTruthy();
  });

  it('🔴 sans date de naissance, « 18 ans ou plus » doit être coché avant d’activer', async () => {
    const onGranted = jest.fn();
    mockGrant.mockResolvedValue({ ok: true, status: STATUS });

    await render(<PrismeConsentSheet visible status={STATUS} onClose={jest.fn()} onGranted={onGranted} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('prisme-consent-activate'));
    });
    expect(mockGrant).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByTestId('prisme-consent-adult'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('prisme-consent-activate'));
    });

    expect(mockGrant).toHaveBeenCalledWith(true);
    expect(onGranted).toHaveBeenCalled();
  });

  it('avec une date de naissance connue, pas de case à cocher', async () => {
    mockBirthDate = '1990-05-01';
    mockGrant.mockResolvedValue({ ok: true, status: STATUS });

    await render(<PrismeConsentSheet visible status={STATUS} onClose={jest.fn()} onGranted={jest.fn()} />);

    expect(screen.queryByTestId('prisme-consent-adult')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('prisme-consent-activate'));
    });
    expect(mockGrant).toHaveBeenCalledWith(false);
  });

  it('un refus du serveur reste affiché, la feuille ne se ferme pas', async () => {
    mockBirthDate = '1990-05-01';
    const onGranted = jest.fn();
    mockGrant.mockResolvedValue({ ok: false, code: 'offline' });

    await render(<PrismeConsentSheet visible status={STATUS} onClose={jest.fn()} onGranted={onGranted} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('prisme-consent-activate'));
    });

    expect(screen.getByText('prisme.errors.offline')).toBeTruthy();
    expect(onGranted).not.toHaveBeenCalled();
  });

  it('sans statut connu (hors ligne), elle ne promet rien : elle dit qu’il faut le réseau', async () => {
    await render(<PrismeConsentSheet visible status={null} onClose={jest.fn()} onGranted={jest.fn()} />);

    expect(screen.getByText('prisme.settings.unknown')).toBeTruthy();
    expect(screen.queryByTestId('prisme-consent-activate')).toBeNull();
  });
});
