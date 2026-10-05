/**
 * US PRISME-01 — la carte « Ta journée » de l'accueil, dès 18 h (spec §3, §4, DD11).
 *
 * Elle montre toujours ses faits — exactement ceux qui partiraient chez le fournisseur (R4) — et ne
 * propose « Prisme raconte » que si Prisme est visible et qu'aucune humeur basse n'est en cours (R12).
 * Une journée sans fait n'a pas de carte.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { EveningFacts } from '@wellness/shared';

import { EveningCard } from '../EveningCard';

const mockTell = jest.fn();
jest.mock('@/components/prisme/PrismeTell', () => ({
  PrismeTell: (props: unknown) => {
    mockTell(props);
    return null;
  },
}));

const FACTS: EveningFacts = {
  dayLabel: 'vendredi 2 octobre',
  sessions: [{ type: 'strength', minutes: 52, tonnageKg: 8420, setsDone: null, setsPlanned: null, records: 0 }],
  plate: { kcal: 2140, targetKcal: 2450, proteinG: 118, targetProteinG: 150, carbsG: 236, meals: 3 },
  week: null,
  tomorrow: null,
  realLife: false,
};

let mockFacts: EveningFacts = FACTS;
let mockLowMood = false;
jest.mock('@/hooks/useEveningFacts', () => ({
  useEveningFacts: () => ({ facts: mockFacts, todayKey: '2026-10-02', lowMood: mockLowMood, isLoading: false }),
}));

let mockVisible = true;
jest.mock('@/hooks/usePrismeVisibility', () => ({
  usePrismeVisibility: () => ({ visible: mockVisible, minor: false, status: null }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr' } }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ colors: { text: '#33291f', textMuted: '#786a59', surface: '#fffaf2', border: '#ece0cd' }, scheme: 'light' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFacts = FACTS;
  mockLowMood = false;
  mockVisible = true;
});

describe('EveningCard', () => {
  it('montre les faits du jour — ceux-là mêmes qui partiraient', async () => {
    await render(<EveningCard />);

    expect(screen.getByText('prisme.evening.title')).toBeTruthy();
    expect(screen.getByText('prisme.dossier.session.strength')).toBeTruthy();
    expect(screen.getByText('prisme.dossier.plate.label')).toBeTruthy();
  });

  it('propose Prisme pour la journée, avec l’empreinte des faits', async () => {
    await render(<EveningCard />);

    const props = mockTell.mock.calls.at(-1)![0] as { usage: string; storeKey: string; fingerprint: string };
    expect(props.usage).toBe('evening');
    expect(props.storeKey).toBe('evening:2026-10-02');
    expect(props.fingerprint.length).toBeGreaterThan(0);
  });

  it('🔴 humeur basse en cours : les faits, sans Prisme (R12)', async () => {
    mockLowMood = true;

    await render(<EveningCard />);

    expect(screen.getByText('prisme.dossier.session.strength')).toBeTruthy();
    expect(mockTell).not.toHaveBeenCalled();
  });

  it('Prisme invisible : les faits, sans Prisme (R7)', async () => {
    mockVisible = false;

    await render(<EveningCard />);

    expect(screen.getByText('prisme.evening.title')).toBeTruthy();
    expect(mockTell).not.toHaveBeenCalled();
  });

  it('une journée sans séance ni repas n’a pas de carte', async () => {
    mockFacts = { ...FACTS, sessions: [], plate: null };

    await render(<EveningCard />);

    expect(screen.toJSON()).toBeNull();
  });
});
