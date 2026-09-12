import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBodyExercises } from '@/data/repositories/body-explorer-repository';
import BodyScreen from '../body';

jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: jest.fn() }));
jest.mock('@/data/repositories/body-explorer-repository', () => ({ useBodyExercises: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const { useRef } = require('react');
  return {
    __esModule: true, default: { View },
    useSharedValue: (initial: number) => useRef({
      value: initial,
      get() { return this.value; },
      set(value: number) { this.value = value; },
    }).current,
    useAnimatedStyle: (style: () => unknown) => style(),
    runOnJS: (callback: unknown) => callback,
    runOnUI: (callback: unknown) => callback,
  };
});
jest.mock('react-native-gesture-handler', () => {
  const gesture = () => {
    const chain: Record<string, jest.Mock> = {};
    for (const name of ['onBegin', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'minPointers']) {
      chain[name] = jest.fn(() => chain);
    }
    return chain;
  };
  return { Gesture: { Pinch: gesture, Pan: gesture, Simultaneous: jest.fn() }, GestureDetector: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ scheme: 'light', colors: require('@/theme/colors').palettes.light }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const dict = require('@/i18n/locales/fr.json');
      const value = key.split('.').reduce((part: unknown, field) =>
        part && typeof part === 'object' ? (part as Record<string, unknown>)[field] : undefined, dict);
      return typeof value === 'string'
        ? value.replace(/{{(\w+)}}/g, (_: string, name: string) => String(options?.[name] ?? ''))
        : key;
    },
  }),
}));

const push = jest.fn();
const back = jest.fn();
const params = useLocalSearchParams as jest.Mock;
const data = useBodyExercises as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push, back, canGoBack: () => true });
  params.mockReturnValue({});
  data.mockReturnValue({ exercises: [], isLoading: false, error: null });
});

const tap = async (node: ReturnType<typeof screen.getByText>) => {
  await act(async () => { fireEvent.press(node); });
};
const show = async () => { await act(async () => { render(<BodyScreen />); }); };

it('ouvre un explorateur neutre et permet de sélectionner un muscle du dos avec sa liste accessible', async () => {
  await show();
  expect(screen.getByText('Mon corps')).toBeTruthy();
  expect(screen.getByText('Choisis un muscle pour découvrir les exercices associés.')).toBeTruthy();
  await tap(screen.getByRole('button', { name: 'Ischio-jambiers' }));
  expect(screen.getByRole('tab', { name: 'Dos' }).props.accessibilityState.selected).toBe(true);
  expect(data).toHaveBeenLastCalledWith('hamstrings', '');
  expect(screen.getByRole('button', { name: 'Ischio-jambiers' }).props.accessibilityState.selected).toBe(true);
});

it('valide les paramètres entrants et conserve les épaules sur la vue arrière', async () => {
  params.mockReturnValue({ muscle: 'invalid', full: 'invalid,chest', context: 'bad' });
  await show();
  expect(screen.getByText('Choisis un muscle pour découvrir les exercices associés.')).toBeTruthy();
  await tap(screen.getByRole('tab', { name: 'Dos' }));
  await tap(screen.getByRole('button', { name: 'Épaules' }));
  expect(screen.getByRole('tab', { name: 'Dos' }).props.accessibilityState.selected).toBe(true);
});

it('réinitialise la sélection et la recherche quand le contexte entrant change', async () => {
  params.mockReturnValue({ muscle: 'biceps', context: 'exercise', full: 'biceps' });
  await show();
  await tap(screen.getByRole('button', { name: 'Dos' }));
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Rechercher un exercice'), 'tirage'); });
  params.mockReturnValue({ muscle: 'biceps', context: 'session', full: 'biceps,chest' });
  await act(async () => { screen.rerender(<BodyScreen />); });
  expect(screen.getByRole('button', { name: 'Biceps' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByRole('tab', { name: 'Face' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('Rechercher un exercice').props.value).toBe('');
  expect(screen.getByText('Muscles de cette séance')).toBeTruthy();
});

it('ouvre le détail de l’exercice sélectionné et transmet la recherche au lecteur local', async () => {
  params.mockReturnValue({ muscle: 'biceps', context: 'exercise', full: 'biceps' });
  data.mockReturnValue({ exercises: [{ id: 'curl-1', name: 'Curl marteau', inferred: false, isFavorite: true, equipment: 'dumbbell' }], isLoading: false, error: null });
  await show();
  expect(screen.getByText('Muscles de cet exercice')).toBeTruthy();
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Rechercher un exercice'), 'marteau'); });
  expect(data).toHaveBeenLastCalledWith('biceps', 'marteau');
  await tap(screen.getByRole('button', { name: /Curl marteau/ }));
  expect(push).toHaveBeenCalledWith('/exercises/curl-1');
});

it('distingue une erreur de lecture du catalogue vide et conserve la sélection utilisable', async () => {
  params.mockReturnValue({ muscle: 'back' });
  data.mockReturnValue({ exercises: [], isLoading: false, error: new Error('sqlite read') });
  await show();
  expect(screen.getByText('Les exercices ne sont pas disponibles pour le moment.')).toBeTruthy();
  expect(screen.queryByText('Aucun exercice associé dans ta bibliothèque.')).toBeNull();
  await tap(screen.getByRole('button', { name: 'Pectoraux' }));
  expect(data).toHaveBeenLastCalledWith('chest', '');
});

it('permet de zoomer avec les boutons, borne le zoom et recentre à la sélection suivante', async () => {
  await show();
  for (let i = 0; i < 4; i++) await tap(screen.getByRole('button', { name: 'Agrandir la silhouette' }));
  expect(screen.getByRole('button', { name: 'Agrandir la silhouette' }).props.accessibilityState.disabled).toBe(true);
  await tap(screen.getByRole('button', { name: 'Recentrer' }));
  expect(screen.getByRole('button', { name: 'Réduire la silhouette' }).props.accessibilityState.disabled).toBe(true);
  await tap(screen.getByRole('button', { name: 'Agrandir la silhouette' }));
  await tap(screen.getByRole('button', { name: 'Mollets' }));
  expect(screen.getByRole('button', { name: 'Réduire la silhouette' }).props.accessibilityState.disabled).toBe(true);
});

it('permet de déplacer la silhouette zoomée avec des boutons et borne la caméra', async () => {
  await show();
  expect(screen.queryByRole('button', { name: 'Déplacer la silhouette vers le haut' })).toBeNull();
  for (let i = 0; i < 3; i++) await tap(screen.getByRole('button', { name: 'Agrandir la silhouette' }));
  for (let i = 0; i < 8; i++) {
    await tap(screen.getByRole('button', { name: 'Déplacer la silhouette vers le haut' }));
    await tap(screen.getByRole('button', { name: 'Déplacer la silhouette vers la droite' }));
  }
  // The native animated values update immediately; rerender exposes them through the test adapter.
  await act(async () => { screen.rerender(<BodyScreen />); });
  const { StyleSheet } = require('react-native');
  const transform = StyleSheet.flatten(screen.getByTestId('body-explorer-figure').props.style).transform;
  expect(transform[0].translateX).toBeCloseTo((328 * (724 / 1290) * 2.5 - 300) / 2);
  expect(transform[1].translateY).toBe(-234);
  await tap(screen.getByRole('button', { name: 'Recentrer' }));
  expect(StyleSheet.flatten(screen.getByTestId('body-explorer-figure').props.style).transform)
    .toEqual([{ translateX: 0 }, { translateY: 0 }, { scale: 1 }]);
});

it('annonce la précision de l’association et distingue catalogue vide, recherche vide et chargement', async () => {
  params.mockReturnValue({ muscle: 'biceps' });
  await show();
  expect(screen.getByText('Aucun exercice associé dans ta bibliothèque.')).toBeTruthy();
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Rechercher un exercice'), 'inconnu'); });
  expect(screen.getByText('Aucun exercice ne correspond à cette recherche.')).toBeTruthy();
  data.mockReturnValue({ exercises: [], isLoading: true, error: null });
  await act(async () => { screen.rerender(<BodyScreen />); });
  expect(screen.getByLabelText('Chargement…')).toBeTruthy();
  data.mockReturnValue({ exercises: [{ id: 'curl-2', name: 'Curl', inferred: true, isFavorite: false, equipment: 'dumbbell' }], isLoading: false, error: null });
  await act(async () => { screen.rerender(<BodyScreen />); });
  expect(screen.getByRole('button', { name: /Curl.*Association par groupe/ })).toBeTruthy();
});
