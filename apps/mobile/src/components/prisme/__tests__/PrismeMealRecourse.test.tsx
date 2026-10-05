/**
 * US PRISME-01 — « Demander à Prisme » sous les lignes non reconnues de la saisie rapide (spec §3, R8,
 * R10). Seule la partie non reconnue part, montrée avant l'envoi ; ce qui revient rejoint la même
 * revue, et rien n'est écrit ici.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { PrismeStatus } from '@wellness/shared';

import { PrismeMealRecourse } from '../PrismeMealRecourse';
import { askMeal } from '@/lib/ai/prisme';

jest.mock('@/lib/ai/prisme', () => ({ askMeal: jest.fn(), grantPrismeConsent: jest.fn() }));

const STATUS: PrismeStatus = {
  available: true,
  reason: null,
  provider: { id: 'groq', label: 'Groq', country: 'US', trains: false, retentionDays: 30 },
  consent: { at: '2026-10-03T19:00:00.000Z', provider: 'groq' },
  remaining: { narrate: 6, meal_text: 6 },
};

let mockVisible = true;
let mockStatus: PrismeStatus | null = STATUS;
jest.mock('@/hooks/usePrismeVisibility', () => ({
  usePrismeVisibility: () => ({ visible: mockVisible, minor: false, status: mockStatus }),
}));

const mockSettings = { prismeConsentAt: '2026-10-03T19:00:00.000Z' as string | null, prismeConsentProvider: 'groq' as string | null };
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

const mockAsk = askMeal as jest.Mock;
const ITEMS = [
  { name: 'Riz blanc cuit', grams: 150, confidence: 0.6 },
  { name: 'Saumon cru', grams: 80, confidence: 0.9 },
];

const ask = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId('prisme-meal-ask'));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockVisible = true;
  mockStatus = STATUS;
  mockSettings.prismeConsentAt = '2026-10-03T19:00:00.000Z';
  mockSettings.prismeConsentProvider = 'groq';
});

describe('PrismeMealRecourse', () => {
  it('🔴 montre ce qui part, et chez qui, avant d’envoyer (R10)', async () => {
    await render(<PrismeMealRecourse unmatchedText="poke bowl saumon avocat" onItems={jest.fn()} />);

    expect(screen.getByText(/prisme\.meal\.sends .*"provider":"Groq".*"text":"poke bowl saumon avocat"/)).toBeTruthy();
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('statut inconnu (chargé hors ligne) : dit quand même chez qui, celui de l’accord', async () => {
    mockStatus = null;

    await render(<PrismeMealRecourse unmatchedText="poke bowl" onItems={jest.fn()} />);

    expect(screen.getByText(/prisme\.meal\.sends .*"provider":"Groq"/)).toBeTruthy();
  });

  it('demande, puis rend les aliments et grammes à l’écran — qui les rapproche et ne les écrit pas', async () => {
    const onItems = jest.fn();
    mockAsk.mockResolvedValue({ ok: true, items: ITEMS, truncated: false });

    await render(<PrismeMealRecourse unmatchedText="poke bowl saumon avocat" onItems={onItems} />);
    await ask();

    expect(mockAsk).toHaveBeenCalledWith('poke bowl saumon avocat', 'fr');
    expect(onItems).toHaveBeenCalledWith(ITEMS);
  });

  it('🔴 deux appuis rapides : un seul appel', async () => {
    mockAsk.mockResolvedValue({ ok: true, items: ITEMS, truncated: false });

    await render(<PrismeMealRecourse unmatchedText="poke bowl" onItems={jest.fn()} />);
    const button = screen.getByTestId('prisme-meal-ask');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });

    expect(mockAsk).toHaveBeenCalledTimes(1);
  });

  it('une liste coupée à 12 le dit', async () => {
    mockAsk.mockResolvedValue({ ok: true, items: ITEMS, truncated: true });

    await render(<PrismeMealRecourse unmatchedText="buffet" onItems={jest.fn()} />);
    await ask();

    expect(screen.getByText('prisme.meal.truncated')).toBeTruthy();
  });

  it('la liste coupée reste dite une fois les lignes remplacées (plus rien de non reconnu)', async () => {
    mockAsk.mockResolvedValue({ ok: true, items: ITEMS, truncated: true });

    const view = await render(<PrismeMealRecourse unmatchedText="buffet" onItems={jest.fn()} />);
    await ask();
    await view.rerender(<PrismeMealRecourse unmatchedText="" onItems={jest.fn()} />);

    expect(screen.getByText('prisme.meal.truncated')).toBeTruthy();
    expect(screen.queryByTestId('prisme-meal-ask')).toBeNull();
  });

  it('aucun aliment reconnu : le dit, et ne touche pas à la revue', async () => {
    const onItems = jest.fn();
    mockAsk.mockResolvedValue({ ok: true, items: [], truncated: false });

    await render(<PrismeMealRecourse unmatchedText="rien" onItems={onItems} />);
    await ask();

    expect(screen.getByText('prisme.meal.none')).toBeTruthy();
    expect(onItems).not.toHaveBeenCalled();
  });

  it('hors ligne : le dit', async () => {
    mockAsk.mockResolvedValue({ ok: false, code: 'offline' });

    await render(<PrismeMealRecourse unmatchedText="poke bowl" onItems={jest.fn()} />);
    await ask();

    expect(screen.getByText('prisme.errors.offline')).toBeTruthy();
  });

  it('une réponse illisible : « n’a pas pu lire ce repas » (spec §7), pas un repas vide', async () => {
    mockAsk.mockResolvedValue({ ok: false, code: 'invalid' });

    await render(<PrismeMealRecourse unmatchedText="poke bowl" onItems={jest.fn()} />);
    await ask();

    expect(screen.getByText('prisme.meal.invalid')).toBeTruthy();
  });

  it('🔴 le serveur ne voit pas l’accord : la feuille se rouvre (spec §7)', async () => {
    mockAsk.mockResolvedValue({ ok: false, code: 'consent-required' });

    await render(<PrismeMealRecourse unmatchedText="poke bowl" onItems={jest.fn()} />);
    await ask();

    expect(screen.getByTestId('prisme-consent-sheet')).toBeTruthy();
  });

  it('🔴 sans accord : la feuille s’ouvre, rien ne part', async () => {
    mockSettings.prismeConsentAt = null;
    mockSettings.prismeConsentProvider = null;

    await render(<PrismeMealRecourse unmatchedText="poke bowl" onItems={jest.fn()} />);
    await ask();

    expect(screen.getByTestId('prisme-consent-sheet')).toBeTruthy();
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('Prisme invisible, ou rien de non reconnu : rien', async () => {
    mockVisible = false;
    const hidden = await render(<PrismeMealRecourse unmatchedText="poke bowl" onItems={jest.fn()} />);
    expect(hidden.toJSON()).toBeNull();

    mockVisible = true;
    const empty = await render(<PrismeMealRecourse unmatchedText="   " onItems={jest.fn()} />);
    expect(empty.toJSON()).toBeNull();
  });
});
