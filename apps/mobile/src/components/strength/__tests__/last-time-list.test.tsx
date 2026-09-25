/**
 * « La dernière fois » de la carte du jour (US MUSCU-UX07, §4.2.1) — monté, lectures simulées.
 *
 * Vérifie ce que la brique de formatage (testée à part) ne peut pas voir : la pastille courte de la
 * suggestion calculée par le hook partagé avec la séance (R11), « Première fois » sans pastille, et la
 * date commune ou par ligne dans l'en-tête.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LastTimeList } from '../LastTimeList';
import { useLastDoneDates } from '@/data/repositories/workout-repository';
import { useProgressionSuggestion } from '@/hooks/useProgressionSuggestion';

jest.mock('@/data/repositories/workout-repository', () => ({ useLastDoneDates: jest.fn() }));
jest.mock('@/hooks/useProgressionSuggestion', () => ({ useProgressionSuggestion: jest.fn() }));
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({ system: 'metric', weightSymbol: 'kg', formatWeight: (kg: number | null) => `${kg} kg` }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    i18n: { language: 'fr' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#786a59', background: '#f7eede', border: '#e3d3ba', surfaceAlt: '#f3ddd0', accent: '#a8261d' },
  }),
}));

const serie = (weightKg: number, reps: number) => ({ weightKg, reps, setType: 'normal', rpe: null, durationSeconds: null });

const EXOS = [
  { exerciseId: 'bench', name: 'Développé couché', equipment: 'barbell' },
  { exerciseId: 'ohp', name: 'Développé militaire', equipment: 'barbell' },
  { exerciseId: 'new', name: 'Pompes déclinées', equipment: null },
  { exerciseId: 'fourth', name: 'Quatrième', equipment: null },
];

const JEUDI = new Date(2026, 8, 17, 18).toISOString();
const MARDI = new Date(2026, 8, 15, 18).toISOString();

beforeEach(() => {
  (useProgressionSuggestion as jest.Mock).mockImplementation((id: string) =>
    id === 'bench'
      ? { lastPerf: [serie(80, 8), serie(80, 8), serie(80, 7), serie(80, 6)], suggestion: { kind: 'weightOrReps', weightKg: 82.5, reps: 9 } }
      : id === 'ohp'
        ? { lastPerf: [serie(50, 8), serie(50, 8)], suggestion: null }
        : { lastPerf: [], suggestion: null },
  );
});

const afficher = async () => {
  await render(<LastTimeList exercises={EXOS} program={{ programId: 'p', weekIndex: 2 }} />);
};

it('trois exercices au plus : les autres sont dans l’aperçu', async () => {
  (useLastDoneDates as jest.Mock).mockReturnValue({ bench: JEUDI, ohp: JEUDI });
  await afficher();
  expect(screen.queryByText('Quatrième')).toBeNull();
});

it('la dernière fois en une ligne, et la suggestion en pastille courte (R3, R11)', async () => {
  (useLastDoneDates as jest.Mock).mockReturnValue({ bench: JEUDI, ohp: JEUDI });
  await afficher();

  expect(screen.getByText('80 kg × 8 · 8 · 7 · 6')).toBeTruthy();
  // 82,5 kg à la barre de 20 kg est chargeable : la pastille reprend la charge telle quelle.
  expect(screen.getByText('strengthHub.lastTime.tip.weightOrReps:{"weight":"82.5 kg","reps":9}')).toBeTruthy();
});

it('🔴 le moteur ne propose rien : pas de pastille', async () => {
  (useLastDoneDates as jest.Mock).mockReturnValue({ bench: JEUDI, ohp: JEUDI });
  await afficher();

  expect(screen.getByText('50 kg × 8 · 8')).toBeTruthy();
  expect(screen.getAllByText(/strengthHub\.lastTime\.tip/)).toHaveLength(1);
});

it('🔴 un exercice jamais fait dit « Première fois »', async () => {
  (useLastDoneDates as jest.Mock).mockReturnValue({ bench: JEUDI, ohp: JEUDI });
  await afficher();

  expect(screen.getByText('strengthHub.lastTime.firstTime')).toBeTruthy();
});

it('même séance pour tous : la date une fois, en en-tête', async () => {
  (useLastDoneDates as jest.Mock).mockReturnValue({ bench: JEUDI, ohp: JEUDI });
  await afficher();

  expect(screen.getByText(/strengthHub\.lastTime\.titleOn:\{"date":".+ 17\/09"\}/)).toBeTruthy();
});

it('séances différentes : pas de date en en-tête, chaque ligne porte la sienne', async () => {
  (useLastDoneDates as jest.Mock).mockReturnValue({ bench: JEUDI, ohp: MARDI });
  await afficher();

  expect(screen.getByText('strengthHub.lastTime.title')).toBeTruthy();
  expect(screen.getByText(/80 kg × 8 · 8 · 7 · 6 · .+ 17\/09/)).toBeTruthy();
  expect(screen.getByText(/50 kg × 8 · 8 · .+ 15\/09/)).toBeTruthy();
});
