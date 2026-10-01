/**
 * US BIEN-02 / BIEN-07 — Bien-être › Journal : ce qu'un jour dit de lui-même.
 *
 *  1. **un jour non renseigné est un trou**, jamais une valeur — dans la liste comme au calendrier ;
 *  2. **ce qui a été noté se relit** : les réponses des modules (alcool, café tardif, sieste, fringales)
 *     apparaissent au jour — sans quoi la sieste et les fringales seraient enregistrées et visibles nulle
 *     part ;
 *  3. **le voisinage** : ce que les piliers ont fait ce jour-là est écrit sous l'état du jour.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { JournalSection } from '../sections/JournalSection';
import { useWellbeingEntries } from '@/data/repositories/daily-wellbeing-repository';

const TODAY = '2026-10-01';
const YESTERDAY = '2026-09-30';

jest.mock('@/data/repositories/daily-wellbeing-repository', () => ({ useWellbeingEntries: jest.fn() }));
jest.mock('@/data/repositories/workout-repository', () => ({
  useWorkoutHistory: () => ({ workouts: [{ id: 'w', finishedAt: '2026-10-01T09:00:00', sessionName: 'Jambes' }] }),
}));
jest.mock('@/data/repositories/run-repository', () => ({ useRunHistory: () => ({ runs: [] }) }));
jest.mock('@/data/repositories/journal-repository', () => ({ useDailyTotals: () => ({ totals: [] }) }));
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-10-01', useWindowStartKey: () => '2026-09-18' }));
jest.mock('@/components/wellbeing/MomentCheckinSheet', () => ({ MomentCheckinSheet: () => null }));
jest.mock('@/components/wellbeing/WellbeingScale', () => ({ useLevelLabel: () => (key: string, level: number) => `${key}-${level}` }));
jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ scheme: 'light', colors: { text: '#222', textMuted: '#777', surface: '#fff', border: '#ddd', background: '#fff', accent: '#6a3fb0' } }),
}));

const entry = (logDate: string, over: Record<string, unknown> = {}) => ({
  id: logDate,
  logDate,
  mood: null,
  energy: null,
  stress: null,
  sleepMinutes: null,
  sleepQuality: null,
  motivation: null,
  sick: false,
  busyDay: false,
  lateNight: false,
  travel: false,
  alcoholDrinks: null,
  lateCaffeine: null,
  napMinutes: null,
  cravings: null,
  sleepSource: null,
  sleepStartAt: null,
  sleepEndAt: null,
  ...over,
});

const ligne = (dayKey: string) => {
  const row = screen.getByTestId(`journal-day-${dayKey}`);
  const texts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') texts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'children' in (node as object)) walk((node as { children: unknown }).children);
  };
  walk(row.children);
  return texts.join(' | ');
};

beforeEach(() => {
  (useWellbeingEntries as jest.Mock).mockReturnValue({
    entries: [
      entry(TODAY, { sleepMinutes: 412, energy: 3, cravings: 4, alcoholDrinks: 2, lateCaffeine: true, napMinutes: 20, sick: true }),
      entry(YESTERDAY, { mood: 4, alcoholDrinks: 0, lateCaffeine: false }),
    ],
  });
});

describe('Journal — un jour', () => {
  it('🔴 les réponses des modules se relisent au jour : verres, café tardif, sieste, fringales', async () => {
    await render(<JournalSection />);
    const today = ligne(TODAY);

    expect(today).toContain('wellbeingHub.journal.night:{"value":"6 h 52"}');
    expect(today).toContain('wellbeing.indicators.cravings cravings-4');
    expect(today).toContain('wellbeingHub.journal.alcohol:{"count":2}');
    expect(today).toContain('wellbeingHub.journal.lateCaffeine');
    expect(today).toContain('wellbeingHub.journal.nap:{"value":"20 min"}');
    expect(today).toContain('wellbeing.tags.sick');
  });

  it('« aucun verre » est une réponse, dite comme telle ; un « non » au café ne charge pas la ligne', async () => {
    await render(<JournalSection />);
    const hier = ligne(YESTERDAY);

    expect(hier).toContain('wellbeingHub.journal.alcoholNone');
    expect(hier).not.toContain('wellbeingHub.journal.lateCaffeine');
  });

  it('ce que les piliers ont fait ce jour-là est écrit sous l’état du jour', async () => {
    await render(<JournalSection />);

    expect(ligne(TODAY)).toContain('wellbeingHub.journal.didStrength:{"name":"Jambes"}');
  });

  it('🔴 un jour sans check-in est un trou — « rien de noté », jamais une valeur', async () => {
    await render(<JournalSection />);

    expect(ligne('2026-09-29')).toContain('wellbeingHub.journal.empty');
    expect(screen.getAllByLabelText(/wellbeingHub\.journal\.cellEmpty/).length).toBeGreaterThan(0);
  });
});
