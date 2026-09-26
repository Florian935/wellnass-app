/**
 * US NUTRI-UX03 (D13, décision Q8) — les portes « Me peser » de l'accueil ouvrent Stats sur l'onglet
 * **Poids**, où sont la pesée et la courbe. Avant, elles ouvraient Régularité, et il fallait trouver
 * l'onglet Poids pour saisir sa pesée. La carte du moment (`NowCard`) a son propre test.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QuickActions } from '../QuickActions';
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
    colors: { text: '#000', textMuted: '#666', surface: '#fff', border: '#ddd', accent: '#b14f2b', accentText: '#fff' },
  }),
}));

const push = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push });
});

it('🔴 l’action rapide « Me peser » ouvre Stats sur Poids', async () => {
  await render(<QuickActions />);

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
