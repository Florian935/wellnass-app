/**
 * US PRISME-01 — « Prisme raconte », vu depuis l'écran.
 *
 * Ce qui compte : **rien ne part sans geste** (DD10), **le refus se voit** (R2), **sans accord, la
 * feuille s'ouvre au lieu d'appeler** (R6), et **un texte périmé le dit** (DD12).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { BilanDossier, PrismeStatus } from '@wellness/shared';

import { PrismeTell } from '../PrismeTell';
import { tellBilan } from '@/lib/ai/prisme';
import { usePrismeStore } from '@/stores/prisme-store';

jest.mock('@/lib/ai/prisme', () => ({ tellBilan: jest.fn(), grantPrismeConsent: jest.fn() }));

const mockSettings = { prismeConsentAt: '2026-10-03T19:00:00.000Z' as string | null, prismeConsentProvider: 'groq' as string | null };
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: () => ({ settings: mockSettings, isLoading: false }),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: () => ({ profile: { birthDate: '1990-05-01' }, isLoading: false }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr' } }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#786a59', surface: '#fffaf2', border: '#ece0cd', background: '#f7eede', danger: '#b23b2e', accent: '#b14f2b', accentText: '#fff', warn: '#f7ead6', warnText: '#8a6419', pillarLab: '#7a5714' },
    scheme: 'light',
  }),
}));

const mockTell = tellBilan as jest.Mock;

const DOSSIER: BilanDossier = {
  headline: 'Ta journée',
  facts: [
    { label: 'Séance de musculation', detail: '52 min', values: [52] },
    { label: 'Assiette', detail: '2140 kcal', values: [2140] },
  ],
  decision: null,
  realLife: false,
};

const STATUS: PrismeStatus = {
  available: true,
  reason: null,
  provider: { id: 'groq', label: 'Groq', country: 'US', trains: false, retentionDays: 30 },
  consent: { at: '2026-10-03T19:00:00.000Z', provider: 'groq' },
  remaining: { narrate: 6, meal_text: 6 },
};

const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings.prismeConsentAt = '2026-10-03T19:00:00.000Z';
  mockSettings.prismeConsentProvider = 'groq';
  usePrismeStore.setState({ status: STATUS, texts: {}, devSimulateInvented: false });
});

describe('PrismeTell', () => {
  it('🔴 ne demande rien tant qu’on ne le demande pas', async () => {
    await render(<PrismeTell dossier={DOSSIER} usage="evening" storeKey="evening:2026-10-02" fingerprint="a" testID="t" />);

    expect(mockTell).not.toHaveBeenCalled();
    expect(screen.getByText('prisme.tell')).toBeTruthy();
  });

  it('raconte, dit que c’est une IA, que c’est vérifié, et d’où ça vient', async () => {
    mockTell.mockResolvedValue({ ok: true, text: 'Bonne séance ce soir : 52 min.' });

    await render(<PrismeTell dossier={DOSSIER} usage="evening" storeKey="evening:2026-10-02" fingerprint="a" testID="t" />);
    await press('t-tell');

    expect(mockTell).toHaveBeenCalledWith(DOSSIER, 'evening', 'fr');
    expect(screen.getByText('Bonne séance ce soir : 52 min.')).toBeTruthy();
    expect(screen.getByText('prisme.badge')).toBeTruthy();
    expect(screen.getByText('prisme.verified')).toBeTruthy();
    expect(screen.getByText('Séance de musculation · Assiette')).toBeTruthy();
  });

  it('🔴 deux appuis rapides : un seul appel (critère 15)', async () => {
    mockTell.mockResolvedValue({ ok: true, text: 'Bonne séance ce soir : 52 min.' });

    await render(<PrismeTell dossier={DOSSIER} usage="evening" storeKey="evening:2026-10-02" fingerprint="a" testID="t" />);
    const button = screen.getByTestId('t-tell');
    // Les deux appuis tombent avant que l'écran ne se redessine (bouton encore là).
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });

    expect(mockTell).toHaveBeenCalledTimes(1);
  });

  it('🔴 le serveur ne voit pas l’accord (retiré ailleurs, pas encore synchronisé) : la feuille se rouvre (spec §7)', async () => {
    mockTell.mockResolvedValue({ ok: false, code: 'consent-required' });

    await render(<PrismeTell dossier={DOSSIER} usage="evening" storeKey="evening:2026-10-02" fingerprint="a" testID="t" />);
    await press('t-tell');

    expect(screen.getByTestId('prisme-consent-sheet')).toBeTruthy();
  });

  it('🔴 dit le refus quand le garde-fou a jeté un chiffre inventé', async () => {
    mockTell.mockResolvedValue({ ok: false, code: 'rejected' });

    await render(<PrismeTell dossier={DOSSIER} usage="evening" storeKey="evening:2026-10-02" fingerprint="a" testID="t" />);
    await press('t-tell');

    expect(screen.getByText('prisme.rejected')).toBeTruthy();
  });

  it('une panne du serveur a son message produit (hors ligne)', async () => {
    mockTell.mockResolvedValue({ ok: false, code: 'offline' });

    await render(<PrismeTell dossier={DOSSIER} usage="week" storeKey="week:2026-09-21" fingerprint="a" testID="t" />);
    await press('t-tell');

    expect(screen.getByText('prisme.errors.offline')).toBeTruthy();
  });

  it('un échec inattendu ne casse pas l’écran', async () => {
    mockTell.mockRejectedValue(new Error('boom'));

    await render(<PrismeTell dossier={DOSSIER} usage="evening" storeKey="evening:2026-10-02" fingerprint="a" testID="t" />);
    await press('t-tell');

    expect(screen.getByText('prisme.errors.failed')).toBeTruthy();
  });

  it('🔴 sans accord, la feuille s’ouvre — et rien ne part', async () => {
    mockSettings.prismeConsentAt = null;
    mockSettings.prismeConsentProvider = null;

    await render(<PrismeTell dossier={DOSSIER} usage="evening" storeKey="evening:2026-10-02" fingerprint="a" testID="t" />);
    await press('t-tell');

    expect(screen.getByTestId('prisme-consent-sheet')).toBeTruthy();
    expect(mockTell).not.toHaveBeenCalled();
  });

  it('🔴 un accord donné à un autre fournisseur est redemandé (R6)', async () => {
    mockSettings.prismeConsentProvider = 'mistral';

    await render(<PrismeTell dossier={DOSSIER} usage="evening" storeKey="evening:2026-10-02" fingerprint="a" testID="t" />);
    await press('t-tell');

    expect(screen.getByTestId('prisme-consent-sheet')).toBeTruthy();
    expect(mockTell).not.toHaveBeenCalled();
  });

  it('un texte lu reste là à la réouverture ; si la journée a bougé, il le dit et propose de relire', async () => {
    usePrismeStore.setState({ texts: { 'evening:2026-10-02': { text: 'Texte d’avant.', fingerprint: 'a' } } });
    mockTell.mockResolvedValue({ ok: true, text: 'Texte neuf.' });

    await render(<PrismeTell dossier={DOSSIER} usage="evening" storeKey="evening:2026-10-02" fingerprint="b" testID="t" />);

    expect(screen.getByText('Texte d’avant.')).toBeTruthy();
    expect(screen.getByText('prisme.stale')).toBeTruthy();
    expect(mockTell).not.toHaveBeenCalled();

    await press('t-retell');
    expect(screen.getByText('Texte neuf.')).toBeTruthy();
  });

  it('un texte à jour ne se dit pas périmé', async () => {
    usePrismeStore.setState({ texts: { 'evening:2026-10-02': { text: 'Texte à jour.', fingerprint: 'a' } } });

    await render(<PrismeTell dossier={DOSSIER} usage="evening" storeKey="evening:2026-10-02" fingerprint="a" testID="t" />);

    expect(screen.getByText('Texte à jour.')).toBeTruthy();
    expect(screen.queryByText('prisme.stale')).toBeNull();
  });
});
