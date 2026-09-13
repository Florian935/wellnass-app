import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useBodyVisual, saveBodyVisual } from '@/data/repositories/body-visual-repository';
import { createBodyVisualDocument, prepareBodyVisualSave } from '@wellness/shared';
import BodyShapeScreen from '../body-shape';

const mockPush = jest.fn();
const mockDispatch = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useNavigation: () => ({ dispatch: mockDispatch }),
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/data/repositories/body-visual-repository', () => ({ useBodyVisual: jest.fn(), saveBodyVisual: jest.fn() }), { virtual: true });
jest.mock('@/data/repositories/body-measurement-repository', () => ({ useLatestMeasurements: () => ({ latest: {}, isLoading: false }) }));
jest.mock('@/stores/auth-store', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ session: { user: { id: 'user-1' } } }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/components/motion/PressableScale', () => ({
  PressableScale: ({ haptic, ...props }: Record<string, unknown>) => require('react').createElement(require('react-native').Pressable, props),
}));
jest.mock('react-native-gesture-handler', () => {
  const gesture = () => {
    const chain: Record<string, jest.Mock> = {};
    for (const key of ['runOnJS', 'enabled', 'onBegin', 'onStart', 'onUpdate', 'onEnd', 'activeOffsetX', 'failOffsetY']) chain[key] = jest.fn(() => chain);
    return chain;
  };
  return { Gesture: { Pan: gesture, Tap: gesture, Race: jest.fn() }, GestureDetector: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', colors: require('@/theme/colors').palettes.light }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({
  i18n: { language: 'fr' },
  t: (key: string, values?: Record<string, unknown>) => {
    const result = key.split('.').reduce((part: unknown, field) => part && typeof part === 'object' ? (part as Record<string, unknown>)[field] : undefined, require('@/i18n/locales/fr.json'));
    return typeof result === 'string' ? result.replace(/{{(\w+)}}/g, (_: string, name: string) => String(values?.[name] ?? '')) : key;
  },
}) }));

const data = useBodyVisual as jest.Mock;
const save = saveBodyVisual as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  data.mockReturnValue({ document: null, raw: null, status: 'empty', isLoading: false, error: null });
  save.mockImplementation(async (draft) => prepareBodyVisualSave(draft, null, '2026-09-12T12:00:00.000Z'));
});
afterEach(() => { jest.restoreAllMocks(); });
const tap = async (name: string) => { await fireEvent.press(screen.getByRole('button', { name })); };
const tab = async (name: string) => { await fireEvent.press(screen.getByRole('tab', { name })); };

it('ouvre un départ sans mesures et ne sauvegarde que sur action explicite', async () => {
  await render(<BodyShapeScreen />);
  expect(screen.getByText('Ma silhouette')).toBeTruthy();
  expect(screen.getByText('Aucune mensuration enregistrée.')).toBeTruthy();
  await tap('Augmenter : Épaules');
  expect(save).not.toHaveBeenCalled();
  await tap('Enregistrer');
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ baseline: expect.objectContaining({ proportions: expect.objectContaining({ shoulders: 0.25 }) }) }), null);
  expect(screen.getByText('Silhouette enregistrée.')).toBeTruthy();
});

it('conserve le départ capturé dans l’objectif après une nouvelle édition du départ', async () => {
  await render(<BodyShapeScreen />);
  await tap('Augmenter : Épaules');
  await tab('Objectif');
  await tap('Créer mon objectif');
  await tap('Augmenter : Épaules');
  await tab('Départ');
  await tap('Augmenter : Épaules');
  await tab('Comparer');
  expect(screen.getByText('Cet objectif utilise une version précédente de ta silhouette de départ.')).toBeTruthy();
  await tap('Enregistrer');
  const doc = save.mock.calls[0]![0];
  expect(doc.baseline.proportions.shoulders).toBe(0.5);
  expect(doc.goal.baseline.proportions.shoulders).toBe(0.25);
  expect(doc.goal.emphasis.shoulders).toBe(1);
});

it('n’invite pas à recharger une ancienne lecture pendant l’écho asynchrone de sa propre sauvegarde', async () => {
  await render(<BodyShapeScreen />);
  await tap('Augmenter : Épaules');
  await tap('Enregistrer');
  expect(screen.queryByRole('button', { name: 'Recharger la version enregistrée' })).toBeNull();
  expect(screen.getByRole('adjustable', { name: 'Proportion : Épaules' }).props.accessibilityValue.now).toBe(0.25);
});

it('garde le jeton écrit lors d’une sauvegarde sans changement qui normalise le JSON', async () => {
  const prior = prepareBodyVisualSave(createBodyVisualDocument(), null, '2026-09-12T10:00:00.000Z');
  data.mockReturnValue({ document: prior, raw: JSON.stringify(prior, null, 2), status: 'ready', isLoading: false, error: null });
  save.mockImplementation(async draft => prepareBodyVisualSave(draft, prior, '2026-09-12T12:00:00.000Z'));
  await render(<BodyShapeScreen />);
  await tap('Enregistrer');
  await tap('Augmenter : Épaules');
  await tap('Enregistrer');
  expect(save.mock.calls[1]![1]).toBe(JSON.stringify(prior));
});

it('conserve un brouillon après erreur ou nouvelle donnée et permet de l’annuler', async () => {
  await render(<BodyShapeScreen />);
  await tap('Augmenter : Épaules');
  save.mockRejectedValue(Object.assign(new Error('conflict'), { code: 'conflict' }));
  await tap('Enregistrer');
  expect(screen.getByText('Une autre version a été enregistrée. Recharge-la avant de sauvegarder.')).toBeTruthy();
  const remote = createBodyVisualDocument();
  remote.baseline.proportions.shoulders = 2;
  data.mockReturnValue({ document: remote, raw: JSON.stringify(remote), status: 'ready', isLoading: false, error: null });
  await screen.rerender(<BodyShapeScreen />);
  expect(screen.getByRole('adjustable', { name: 'Proportion : Épaules' }).props.accessibilityValue.now).toBe(0.25);
  await tap('Annuler');
  expect(screen.getByRole('adjustable', { name: 'Proportion : Épaules' }).props.accessibilityValue.now).toBe(0);
  await tap('Recharger la version enregistrée');
  expect(screen.getByRole('adjustable', { name: 'Proportion : Épaules' }).props.accessibilityValue.now).toBe(2);
});

it('bloque l’édition d’une version future plutôt que de la remplacer par un modèle vide', async () => {
  data.mockReturnValue({ document: null, raw: '{"version":99}', status: 'unsupported', isLoading: false, error: null });
  await render(<BodyShapeScreen />);
  expect(screen.getByText('Cette silhouette utilise une version plus récente de l’application.')).toBeTruthy();
  expect(screen.queryByRole('adjustable')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
});

it('protège le retour système si le brouillon est modifié', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<BodyShapeScreen />);
  await tap('Augmenter : Épaules');
  const [blocked, handler] = (usePreventRemove as jest.Mock).mock.calls.at(-1)!;
  expect(blocked).toBe(true);
  const action = { type: 'GO_BACK' };
  await act(async () => { handler({ data: { action } }); });
  expect(alert).toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
  await act(async () => { alert.mock.calls[0]![2]![1]!.onPress!(); });
  expect(mockDispatch).toHaveBeenCalledWith(action);
});

it('borne les réglages et propose les actions d’accessibilité du curseur', async () => {
  await render(<BodyShapeScreen />);
  for (let i = 0; i < 10; i++) await tap('Augmenter : Épaules');
  expect(screen.getByRole('adjustable', { name: 'Proportion : Épaules' }).props.accessibilityValue.now).toBe(2);
  await fireEvent(screen.getByRole('adjustable', { name: 'Proportion : Épaules' }), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(screen.getByRole('adjustable', { name: 'Proportion : Épaules' }).props.accessibilityValue.now).toBe(1.75);
  await tap('Réinitialiser cette zone');
  expect(screen.getByRole('adjustable', { name: 'Proportion : Épaules' }).props.accessibilityValue.now).toBe(0);
});
