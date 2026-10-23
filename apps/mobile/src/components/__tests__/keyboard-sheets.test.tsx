/**
 * US CLAV-01 — **K3** : les trois feuilles qui passaient `behavior={undefined}` à
 * `KeyboardAvoidingView` sur Android (créer un exercice, le modifier, enregistrer un repas type).
 *
 * Le filet de l'étape 1 a d'abord figé leur montage d'avant : un `KeyboardAvoidingView` sans
 * `behavior` sur Android — c'est-à-dire rien —, `'padding'` sur iOS. Courtes et ancrées en bas, elles
 * passaient **entières** sous le clavier. Depuis l'étape 6, elles sont posées dans le conteneur
 * commun `kind="sheet"` : plus de `KeyboardAvoidingView`, et la feuille remonte de ce que le clavier
 * recouvre — **y compris rendue dans un écran qui a son propre conteneur** (une `Modal` est une autre
 * fenêtre : c'est tout l'objet de `kind="sheet"`).
 */

import React from 'react';
import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { KeyboardAvoidingContainer } from '@/components/keyboard';
import { CreateExerciseModal } from '../exercises/CreateExerciseModal';
import { EditExerciseModal } from '../exercises/EditExerciseModal';
import { SaveTemplateSheet } from '../nutrition/SaveTemplateSheet';
import { flatStyle, hostNodes } from '@/test-utils/host-tree';
import '@/i18n';

/** Un `KeyboardAvoidingView` rendu se signalerait par `testID="kav"`. */
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (props: object) => <View testID="kav" {...props} /> };
});
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#000', textMuted: '#888', background: '#fff', surface: '#f5f5f5', surfaceAlt: '#eee',
      border: '#ddd', borderStrong: '#ccc', accent: '#6b0028', accentText: '#fff',
    },
  }),
}));
jest.mock('@/data/repositories/exercise-repository', () => ({
  addCustomExercise: jest.fn(),
  updateCustomExercise: jest.fn(),
}));
const mockFrame = { visible: false, height: 0, screenY: 0 };
jest.mock('@/components/keyboard/useKeyboardFrame', () => ({
  ...jest.requireActual('@/components/keyboard/useKeyboardFrame'),
  useKeyboardFrame: () => mockFrame,
}));
/** Écran de 914 dp : la feuille (plein écran dans sa fenêtre) en touche le bas. */
jest.mock('@/components/keyboard/useMeasuredBottom', () => ({
  useMeasuredBottom: () => ({ bottom: 914, measure: () => {} }),
}));

const setOS = (os: 'android' | 'ios') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const originalOS = Platform.OS;
afterEach(() => {
  setOS(originalOS as 'android' | 'ios');
  Object.assign(mockFrame, { visible: false, height: 0, screenY: 0 });
});

const exercise = {
  id: 'exo-1', name: 'Mon exo', muscle: 'chest' as const, source: 'custom' as const,
  equipment: null, mediaUrl: null, isFavorite: false, instructions: '', musclesSecondary: [],
  musclesFine: [],
};

const sheets: [string, () => React.ReactElement][] = [
  ['CreateExerciseModal', () => <CreateExerciseModal visible onClose={jest.fn()} />],
  ['EditExerciseModal', () => <EditExerciseModal visible exercise={exercise} onClose={jest.fn()} />],
  [
    'SaveTemplateSheet',
    () => (
      <SaveTemplateSheet
        meal={{ label: 'Déjeuner', count: 2, kcal: '600' }}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />
    ),
  ],
];

describe('K3 — les trois feuilles d’avant `behavior={undefined}`', () => {
  it.each(sheets)('%s : plus aucun `KeyboardAvoidingView`, sur Android comme sur iOS', async (_n, el) => {
    for (const os of ['android', 'ios'] as const) {
      setOS(os);
      await render(el());
      expect(screen.queryByTestId('kav')).toBeNull();
      await screen.unmount();
    }
  });

  it.each(sheets)(
    '🔴 %s remonte au-dessus du clavier, même rendue dans un écran qui a son conteneur',
    async (_n, el) => {
      // Clavier ouvert, son bord haut à 600 : 314 recouverts depuis le bas de l'écran.
      Object.assign(mockFrame, { visible: true, height: 290, screenY: 600 });
      await render(<KeyboardAvoidingContainer>{el()}</KeyboardAvoidingContainer>);
      const paddings = hostNodes(screen.toJSON()).map((n) => flatStyle(n).paddingBottom);
      // Deux décalages de 314 : l'écran, et la feuille dans sa fenêtre — jamais une feuille passive.
      expect(paddings.filter((p) => p === 314)).toHaveLength(2);
    },
  );

  it.each(sheets)('%s : clavier fermé, aucun padding ajouté', async (_n, el) => {
    await render(el());
    const sheetLayer = hostNodes(screen.toJSON()).find(
      (n) => flatStyle(n).justifyContent === 'flex-end' && flatStyle(n).flex === 1,
    );
    expect(sheetLayer).toBeDefined();
    expect(flatStyle(sheetLayer!).paddingBottom ?? 0).toBe(0);
  });
});
