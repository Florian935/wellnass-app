/**
 * US PRISME-01 — Réglages › Prisme. Toujours visible, pour pouvoir retirer l'accord (spec §4) ; le
 * retrait marche hors ligne (DD3) ; activer ouvre la feuille d'accord ; un compte de moins de 18 ans
 * lit « réservé aux 18 ans et plus » (R13).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { PrismeStatus } from '@wellness/shared';

import { PrismeSettingsSection } from '../PrismeSettingsSection';
import { refreshPrismeStatus, revokePrismeConsent } from '@/lib/ai/prisme';

jest.mock('@/lib/ai/prisme', () => ({
  refreshPrismeStatus: jest.fn(async () => ({ ok: false, code: 'offline' })),
  revokePrismeConsent: jest.fn(async () => undefined),
  grantPrismeConsent: jest.fn(),
}));

const STATUS: PrismeStatus = {
  available: true,
  reason: null,
  provider: { id: 'groq', label: 'Groq', country: 'US', trains: false, retentionDays: 30 },
  consent: { at: null, provider: null },
  remaining: { narrate: 6, meal_text: 6 },
};

let mockVisibility: { visible: boolean; minor: boolean; status: PrismeStatus | null } = { visible: true, minor: false, status: STATUS };
jest.mock('@/hooks/usePrismeVisibility', () => ({ usePrismeVisibility: () => mockVisibility }));

const mockSettings = { prismeConsentAt: null as string | null, prismeConsentProvider: null as string | null };
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: () => ({ settings: mockSettings, isLoading: false }),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: () => ({ profile: { birthDate: '1990-05-01' }, isLoading: false }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k),
    i18n: { language: 'fr' },
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#786a59', surface: '#fffaf2', border: '#ece0cd', background: '#f7eede', accent: '#b14f2b', accentText: '#fff', danger: '#b23b2e' },
    scheme: 'light',
  }),
}));

const toggle = () => screen.getByTestId('prisme-settings-switch');

beforeEach(() => {
  jest.clearAllMocks();
  mockVisibility = { visible: true, minor: false, status: STATUS };
  mockSettings.prismeConsentAt = null;
  mockSettings.prismeConsentProvider = null;
});

describe('PrismeSettingsSection', () => {
  it('sans accord : l’interrupteur est éteint, et l’allumer ouvre la feuille d’accord', async () => {
    await render(<PrismeSettingsSection />);

    expect(toggle().props.value).toBe(false);
    await act(async () => {
      fireEvent(toggle(), 'valueChange', true);
    });
    expect(screen.getByTestId('prisme-consent-sheet')).toBeTruthy();
  });

  it('avec accord : dit à qui et quand, et l’éteindre retire l’accord en local', async () => {
    mockSettings.prismeConsentAt = '2026-10-03T19:00:00.000Z';
    mockSettings.prismeConsentProvider = 'groq';

    await render(<PrismeSettingsSection />);

    expect(toggle().props.value).toBe(true);
    expect(screen.getByText(/prisme\.settings\.grantedOn .*"provider":"Groq"/)).toBeTruthy();
    await act(async () => {
      fireEvent(toggle(), 'valueChange', false);
    });
    expect(revokePrismeConsent).toHaveBeenCalled();
  });

  it('🔴 un accord donné à un autre fournisseur se lit comme éteint : il sera redemandé (R6)', async () => {
    mockSettings.prismeConsentAt = '2026-10-03T19:00:00.000Z';
    mockSettings.prismeConsentProvider = 'mistral';

    await render(<PrismeSettingsSection />);

    expect(toggle().props.value).toBe(false);
  });

  it('statut inconnu (hors ligne) : le dit, propose de vérifier, et laisse retirer un accord existant', async () => {
    mockVisibility = { visible: true, minor: false, status: null };
    mockSettings.prismeConsentAt = '2026-10-03T19:00:00.000Z';
    mockSettings.prismeConsentProvider = 'groq';

    await render(<PrismeSettingsSection />);

    expect(screen.getByText('prisme.settings.unknown')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('prisme-settings-refresh'));
    });
    expect(refreshPrismeStatus).toHaveBeenCalled();
    await act(async () => {
      fireEvent(toggle(), 'valueChange', false);
    });
    expect(revokePrismeConsent).toHaveBeenCalled();
  });

  it('🔴 moins de 18 ans : « réservé aux 18 ans et plus », sans interrupteur', async () => {
    mockVisibility = { visible: false, minor: true, status: STATUS };

    await render(<PrismeSettingsSection />);

    expect(screen.getByText('prisme.settings.adultOnly')).toBeTruthy();
    expect(screen.queryByTestId('prisme-settings-switch')).toBeNull();
  });

  it('🔴 moins de 18 ans AVEC un accord déjà stocké : on peut toujours le retirer', async () => {
    mockVisibility = { visible: false, minor: true, status: STATUS };
    mockSettings.prismeConsentAt = '2026-10-03T19:00:00.000Z';
    mockSettings.prismeConsentProvider = 'groq';

    await render(<PrismeSettingsSection />);

    // Les appels sont refusés de toute façon ; mais un accord qu'on ne peut plus retirer reste stocké.
    expect(screen.getByText('prisme.settings.adultOnly')).toBeTruthy();
    await act(async () => {
      fireEvent(toggle(), 'valueChange', false);
    });
    expect(revokePrismeConsent).toHaveBeenCalled();
  });

  it('Prisme indisponible et aucun accord : le dit, sans interrupteur', async () => {
    mockVisibility = { visible: false, minor: false, status: { ...STATUS, available: false, reason: 'provider', provider: null } };

    await render(<PrismeSettingsSection />);

    expect(screen.getByText('prisme.settings.unavailable')).toBeTruthy();
    expect(screen.queryByTestId('prisme-settings-switch')).toBeNull();
  });
});
