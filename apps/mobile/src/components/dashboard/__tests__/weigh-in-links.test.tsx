/**
 * US NUTRI-UX03 (D13, décision Q8) — les portes « Me peser » de l'accueil ouvrent Stats sur l'onglet
 * **Poids**, où sont la pesée et la courbe. Avant, elles ouvraient Régularité, et il fallait trouver
 * l'onglet Poids pour saisir sa pesée. La carte du moment (`NowCard`) a son propre test.
 *
 * US ACCUEIL-08 — la barre d'actions rapides a cédé la place au « + » et à sa feuille « Noter » : la
 * porte « Me peser » y a déménagé, et sa destination avec elle.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AddSheet } from '../AddSheet';
import { WeightCard } from '../WeightCard';
import { useRouter } from 'expo-router';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: jest.fn(() => ({ settings: { activePillars: ['strength', 'running', 'nutrition'] } })),
}));
jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: jest.fn(() => '2026-09-25'),
  useCurrentHour: jest.fn(() => 12),
  useWindowStartKey: jest.fn(() => '2026-09-01'),
}));
jest.mock('@/data/repositories/bodyweight-repository', () => ({
  useLatestWeight: jest.fn(() => ({ latest: null, isLoading: false })),
  useWeightEntries: jest.fn(() => ({ entries: [], isLoading: false })),
}));
jest.mock('@/data/repositories/water-repository', () => ({ addWater: jest.fn(() => Promise.resolve()) }));
jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));
jest.mock('@/lib/haptics', () => ({ hapticConfirm: jest.fn(), hapticSelect: jest.fn(), hapticMilestone: jest.fn() }));
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({ formatWeight: (kg: number) => `${kg} kg`, weightSymbol: 'kg' }),
}));
jest.mock('@/components/widgets/WidgetFrame', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    WidgetFrame: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Eyebrow: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Metric: () => null,
    Chip: () => null,
    Pressable,
  };
});
jest.mock('@/components/widgets/primitives', () => ({ Sparkline: () => null }));
jest.mock('@/components/widgets/WidgetSkeleton', () => ({ WidgetSkeleton: () => null }));
jest.mock('@/components/widgets/RowLine', () => ({ RowLine: () => null }));
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'fr' }, t: (k: string) => k }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: { text: '#000', textMuted: '#666', surface: '#fff', border: '#ddd', accent: '#b14f2b', accentText: '#fff',
      // Les tuiles de la feuille « Noter » portent la couleur de leur pilier.
      background: '#f7eede', borderStrong: '#ccc', pillarHome: '#0f766e', pillarNutrition: '#4a6c2e',
      pillarRunning: '#2a64ad', pillarStrength: '#6b0028', pillarWellbeing: '#7c3aed' },
  }),
}));

const push = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push });
});

it('🔴 la tuile « Me peser » de la feuille « Noter » ouvre Stats sur Poids', async () => {
  await render(<AddSheet visible onClose={jest.fn()} pillars={['strength', 'running', 'nutrition']} hour={12} />);

  await act(async () => {
    fireEvent.press(screen.getByLabelText('home.quick.weighIn'));
  });

  expect(push).toHaveBeenCalledWith('/nutrition-stats?tab=weight');
});

it('🔴 la carte Poids (première pesée à saisir) ouvre Stats sur Poids', async () => {
  await render(<WeightCard />);

  await act(async () => {
    fireEvent.press(screen.getByLabelText('home.weight.addFirst'));
  });

  expect(push).toHaveBeenCalledWith('/nutrition-stats?tab=weight');
});
