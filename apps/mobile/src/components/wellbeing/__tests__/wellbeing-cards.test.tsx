/**
 * US BIEN-02 / BIEN-04 — deux cartes du pilier Bien-être qui ne doivent JAMAIS parler à tort.
 *
 *  - **le garde-fou « humeur basse »** (D7) : il apparaît sur la règle, reste le jour où il est apparu,
 *    se ferme, et ne revient pas avant 14 jours — une carte qui revient chaque matin devient un rappel,
 *    une carte qui ne revient jamais manque la personne qu'elle devait voir ;
 *  - **la ligne « contexte » des bilans** : rien pilier éteint ou sans check-in, et « ce que ça fait
 *    d'habitude » seulement après une nuit courte ET quand le lien a assez de cas.
 */

import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { LocalWellbeing } from '@wellness/shared';

import { LowMoodCard } from '../LowMoodCard';
import { WellbeingContextLine } from '../WellbeingContextLine';
import { useLowMoodCard } from '@/stores/low-mood-store';
import { secureStorage } from '@/lib/secure-storage';
import { useWellbeingForDay } from '@/data/repositories/daily-wellbeing-repository';
import { useWellbeingPillar } from '@/data/repositories/wellbeing-pillar-repository';
import { useCrossLinks } from '@/data/repositories/cross-links-repository';

jest.mock('@/lib/secure-storage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ useWellbeingForDay: jest.fn() }));
jest.mock('@/data/repositories/wellbeing-pillar-repository', () => ({ useWellbeingPillar: jest.fn() }));
jest.mock('@/data/repositories/cross-links-repository', () => ({ useCrossLinks: jest.fn() }));
jest.mock('@/components/wellbeing/WellbeingScale', () => ({
  useLevelLabel: () => (key: string, level: number) => `${key}-${level}`,
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ colors: { text: '#222', textMuted: '#777', surface: '#fff', border: '#ddd', pillarWellbeing: '#6a3fb0', accent: '#6a3fb0', accentText: '#fff' } }),
}));

const TODAY = '2026-10-01';
const dayKey = (n: number) => {
  const d = new Date(2026, 9, 1);
  d.setDate(d.getDate() - n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const mood = (n: number, value: number) => ({ logDate: dayKey(n), mood: value, energy: null, stress: null, deletedAt: null }) as unknown as LocalWellbeing;

/** Cinq jours bas sur les sept derniers renseignés. */
const LOW_WEEK = [mood(0, 2), mood(1, 1), mood(2, 2), mood(3, 4), mood(4, 2), mood(5, 3), mood(6, 2)];
const OK_WEEK = [mood(0, 3), mood(1, 4), mood(2, 2), mood(3, 4), mood(4, 2), mood(5, 3), mood(6, 2)];

const reset = () => useLowMoodCard.setState({ shownOn: null, dismissedOn: null, hydrated: false });

beforeEach(() => {
  jest.clearAllMocks();
  reset();
  (secureStorage.getItem as jest.Mock).mockResolvedValue(null);
});

describe('garde-fou « humeur basse » (D7)', () => {
  it('apparaît sur la règle — 5 des 7 derniers jours renseignés à 1 ou 2 — et retient le jour', async () => {
    await render(<LowMoodCard rows={LOW_WEEK} todayKey={TODAY} />);

    expect(await screen.findByTestId('low-mood-card')).toBeTruthy();
    expect(useLowMoodCard.getState().shownOn).toBe(TODAY);
    expect(secureStorage.setItem).toHaveBeenCalledWith('wellbeing_low_mood_card', JSON.stringify({ shownOn: TODAY, dismissedOn: null }));
  });

  it('ne dit rien sur une semaine ordinaire', async () => {
    await render(<LowMoodCard rows={OK_WEEK} todayKey={TODAY} />);
    await act(async () => {});

    expect(screen.queryByTestId('low-mood-card')).toBeNull();
  });

  it('appeler compose le 3114', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<LowMoodCard rows={LOW_WEEK} todayKey={TODAY} />);

    await act(async () => {
      fireEvent.press(await screen.findByTestId('low-mood-call'));
    });
    expect(open).toHaveBeenCalledWith('tel:3114');
  });

  it('fermée, elle ne revient pas le même jour', async () => {
    await render(<LowMoodCard rows={LOW_WEEK} todayKey={TODAY} />);
    await act(async () => {
      fireEvent.press(await screen.findByTestId('low-mood-dismiss'));
    });

    expect(screen.queryByTestId('low-mood-card')).toBeNull();
    expect(useLowMoodCard.getState().dismissedOn).toBe(TODAY);
  });

  it('🔴 apparue il y a 3 jours, elle ne revient pas — même si l’humeur reste basse', async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ shownOn: dayKey(3), dismissedOn: dayKey(3) }));
    await render(<LowMoodCard rows={LOW_WEEK} todayKey={TODAY} />);
    await act(async () => {});

    expect(screen.queryByTestId('low-mood-card')).toBeNull();
  });

  it('passé 14 jours, elle peut revenir', async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ shownOn: dayKey(14), dismissedOn: dayKey(14) }));
    await render(<LowMoodCard rows={LOW_WEEK} todayKey={TODAY} />);

    expect(await screen.findByTestId('low-mood-card')).toBeTruthy();
  });

  it('apparue aujourd’hui, elle reste visible toute la journée même si la règle ne tient plus', async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ shownOn: TODAY, dismissedOn: null }));
    // L'humeur du soir remonte : la règle ne tient plus, mais retirer la carte en cours de journée
    // la ferait passer pour une erreur.
    await render(<LowMoodCard rows={OK_WEEK} todayKey={TODAY} />);

    expect(await screen.findByTestId('low-mood-card')).toBeTruthy();
  });
});

describe('ligne « contexte » des bilans (BIEN-04)', () => {
  const entry = (over: Record<string, unknown> = {}) => ({
    id: 'w-1',
    logDate: TODAY,
    mood: null,
    energy: 2,
    stress: null,
    sleepMinutes: 320,
    sleepQuality: 2,
    motivation: 2,
    sick: true,
    busyDay: false,
    lateNight: false,
    travel: false,
    alcoholDrinks: null,
    lateCaffeine: null,
    napMinutes: null,
    cravings: null,
    sleepSource: 'manual',
    sleepStartAt: null,
    sleepEndAt: null,
    ...over,
  });
  const link = (id: string, status: string, delta: number | null = -9) => ({ id, status, delta, exposed: 11, other: 40, adverse: true, scope: 'cross', unit: 'pct', pillars: [], need: 8 });

  beforeEach(() => {
    (useWellbeingPillar as jest.Mock).mockReturnValue({ enabled: true });
    (useWellbeingForDay as jest.Mock).mockReturnValue({ entry: entry(), isLoading: false });
    (useCrossLinks as jest.Mock).mockReturnValue({ wellbeing: { links: [link('nightStrength', 'probable')], recentPoorNights: 2 } });
  });

  it('dit la nuit, l’énergie, l’envie et les étiquettes du jour de la séance', async () => {
    await render(<WellbeingContextLine dayKey={TODAY} pillar="strength" />);

    const facts = screen.getByText(/wellbeingHub\.context\.nightWithQuality/).props.children as string;
    expect(facts).toContain('"value":"5 h 20"');
    expect(facts).toContain('wellbeingHub.context.energy');
    expect(facts).toContain('wellbeingHub.context.motivation');
    expect(facts).toContain('wellbeing.tags.sick');
  });

  it('après une nuit courte, cite ce que ça fait d’habitude — signe typographique compris', async () => {
    await render(<WellbeingContextLine dayKey={TODAY} pillar="strength" />);

    expect(screen.getByText('wellbeingHub.context.usual.strength:{"delta":"−9","count":11}')).toBeTruthy();
  });

  it('🔴 rien « d’habitude » tant que le lien apprend — un chiffre sur 3 cas serait une invention', async () => {
    (useCrossLinks as jest.Mock).mockReturnValue({ wellbeing: { links: [link('nightStrength', 'learning', null)], recentPoorNights: 2 } });
    await render(<WellbeingContextLine dayKey={TODAY} pillar="strength" />);

    expect(screen.getByTestId('wellbeing-context-line')).toBeTruthy();
    expect(screen.queryByText(/wellbeingHub\.context\.usual/)).toBeNull();
  });

  it('rien « d’habitude » après une bonne nuit', async () => {
    (useWellbeingForDay as jest.Mock).mockReturnValue({ entry: entry({ sleepMinutes: 470, sleepQuality: 4 }), isLoading: false });
    await render(<WellbeingContextLine dayKey={TODAY} pillar="strength" />);

    expect(screen.queryByText(/wellbeingHub\.context\.usual/)).toBeNull();
  });

  it('cite le lien du pilier du bilan — l’assiette pour une journée nutrition, sans l’envie de s’entraîner', async () => {
    (useCrossLinks as jest.Mock).mockReturnValue({ wellbeing: { links: [link('nightStrength', 'probable'), link('nightIntake', 'solid', 240)], recentPoorNights: 2 } });
    await render(<WellbeingContextLine dayKey={TODAY} pillar="nutrition" />);

    expect(screen.getByText('wellbeingHub.context.usual.nutrition:{"delta":"+240","count":11}')).toBeTruthy();
    expect(screen.getByText(/wellbeingHub\.context\.nightWithQuality/).props.children).not.toContain('wellbeingHub.context.motivation');
  });

  it('🔴 rien du tout, pilier éteint', async () => {
    (useWellbeingPillar as jest.Mock).mockReturnValue({ enabled: false });
    await render(<WellbeingContextLine dayKey={TODAY} pillar="running" />);

    expect(screen.queryByTestId('wellbeing-context-line')).toBeNull();
  });

  it('rien du tout sans check-in ce jour-là', async () => {
    (useWellbeingForDay as jest.Mock).mockReturnValue({ entry: null, isLoading: false });
    await render(<WellbeingContextLine dayKey={TODAY} pillar="running" />);

    expect(screen.queryByTestId('wellbeing-context-line')).toBeNull();
  });

  it('ouvre le journal du pilier', async () => {
    await render(<WellbeingContextLine dayKey={TODAY} pillar="running" />);

    await act(async () => {
      fireEvent.press(screen.getByText('wellbeingHub.context.open'));
    });
    expect(mockPush).toHaveBeenCalledWith('/wellbeing-hub?section=journal');
  });
});
