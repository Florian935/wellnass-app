/**
 * Catalogue d'exercices (`app/exercises.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (54 instructions). C'est **un écran, quatre métiers**, choisis
 * par les paramètres d'URL : consulter (`mode=browse`), **ajouter** à la séance en cours,
 * **remplacer** un exercice de la séance (`replaceExerciseId`), ou **lier une variante**
 * (`mode=pickVariant`). Un même appui sur une ligne fait donc quatre choses différentes.
 *
 * Ce qui casse en silence, et qui est vérifié :
 *
 *  1. **Chaque mode exclut ce qui n'a pas de sens.** Remplacer ne propose pas ce qui est déjà dans
 *     la séance ; lier une variante ne propose ni l'exercice lui-même, ni ceux déjà liés. Sans ces
 *     filtres, on remplace un exercice par son voisin déjà présent — ce qui le duplique.
 *  2. **Les favoris remontent en tête**, le SQL ne fournissant que l'ordre alphabétique. Un tri
 *     perdu ne casse rien : il rend juste le catalogue de 400 exercices inutilisable.
 *  3. **L'état vide distingue « rien ne correspond au filtre » de « rien du tout »** — et propose
 *     de réinitialiser dans le premier cas seulement. Un catalogue qui paraît vide à cause d'un
 *     filtre oublié se lit comme une app cassée.
 *  4. **Les suggestions de substitution n'existent qu'en mode remplacement** : ailleurs, il n'y a
 *     pas d'exercice source, donc rien à suggérer.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ExercisesScreen from '../exercises';
import { toggleFavorite, useExercise, useExercises } from '@/data/repositories/exercise-repository';
import { useSubstitutions } from '@/data/repositories/exercise-substitution-repository';
import {
  addExerciseVariant,
  useLinkedExerciseIds,
} from '@/data/repositories/exercise-variant-repository';
import {
  addExerciseToWorkout,
  replaceExercise,
  useActiveWorkout,
} from '@/data/repositories/workout-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/exercise-repository', () => ({
  useExercises: jest.fn(() => ({ exercises: [], isLoading: false })),
  useExercise: jest.fn(() => ({ exercise: null })),
  toggleFavorite: jest.fn(),
}));
jest.mock('@/data/repositories/exercise-substitution-repository', () => ({
  useSubstitutions: jest.fn(() => ({ substitutions: [] })),
}));
jest.mock('@/data/repositories/exercise-variant-repository', () => ({
  useLinkedExerciseIds: jest.fn(() => ({ ids: new Set<string>() })),
  addExerciseVariant: jest.fn(),
}));
jest.mock('@/data/repositories/workout-repository', () => ({
  useActiveWorkout: jest.fn(() => ({ workout: null })),
  addExerciseToWorkout: jest.fn(),
  replaceExercise: jest.fn(),
}));

/** Le tiroir de filtres et la modale de création ont leurs propres tests : sondes pilotables. */
jest.mock('@/components/programs/ExerciseFilterDrawer', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    ExerciseFilterDrawer: ({
      visible,
      muscles,
      onMusclesChange,
    }: {
      visible: boolean;
      muscles: string[];
      onMusclesChange: (m: string[]) => void;
    }) =>
      visible ? (
        <View>
          <Text>tiroir:{muscles.join(',')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="filtrer-pectoraux"
            onPress={() => onMusclesChange(['chest'])}
          >
            <Text>filtrer</Text>
          </Pressable>
        </View>
      ) : null,
  };
});
jest.mock('@/components/exercises/CreateExerciseModal', () => {
  const { Text } = require('react-native');
  return {
    CreateExerciseModal: ({ visible }: { visible: boolean }) =>
      visible ? <Text>modale-creation</Text> : null,
  };
});
jest.mock('@/components/exercises/SubstitutionSection', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    SubstitutionSection: ({
      substitutions,
      onPick,
    }: {
      substitutions: { id: string; name: string }[];
      onPick: (i: { id: string }) => void;
    }) =>
      substitutions.length === 0 ? null : (
        <View>
          <Text>suggestions:{substitutions.length}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="suggestion-0"
            onPress={() => onPick(substitutions[0]!)}
          >
            <Text>{substitutions[0]!.name}</Text>
          </Pressable>
        </View>
      ),
  };
});

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
jest.mock('@/components/TextField', () => {
  const { TextInput } = require('react-native');
  return {
    TextField: ({
      label,
      value,
      onChangeText,
    }: {
      label: string;
      value: string;
      onChangeText: (v: string) => void;
    }) => <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} />,
  };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#fffaf2',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockExercises = useExercises as jest.Mock;
const mockExercise = useExercise as jest.Mock;
const mockToggleFavorite = toggleFavorite as jest.Mock;
const mockSubstitutions = useSubstitutions as jest.Mock;
const mockLinkedIds = useLinkedExerciseIds as jest.Mock;
const mockAddVariant = addExerciseVariant as jest.Mock;
const mockActive = useActiveWorkout as jest.Mock;
const mockAddToWorkout = addExerciseToWorkout as jest.Mock;
const mockReplace = replaceExercise as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();
const back = jest.fn();

const exercice = (overrides: Record<string, unknown> = {}) => ({
  id: 'ex-1',
  name: 'Squat',
  muscle: 'legs' as const,
  equipment: 'barbell' as const,
  musclesSecondary: [],
  source: 'catalog' as const,
  isFavorite: false,
  ...overrides,
});

const afficher = async ({
  exercises = [exercice()] as unknown[],
  isLoading = false,
  params = {} as Record<string, string>,
  active = null as Record<string, unknown> | null,
} = {}) => {
  mockExercises.mockReturnValue({ exercises, isLoading });
  mockParams.mockReturnValue(params);
  mockActive.mockReturnValue({ workout: active });
  await render(<ExercisesScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const saisir = async (label: string, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), valeur);
  });
};

/** Les noms d'exercice affichés, dans l'ordre de la liste. */
const nomsAffiches = () =>
  screen.queryAllByText(/^(Squat|Développé|Rowing|Fente|Presse)/).map((n) => n.children.join(''));

const seanceAvec = (...exerciseIds: string[]) => ({
  id: 'w-1',
  entries: exerciseIds.map((exerciseId) => ({ exerciseId })),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push, back });
  mockExercise.mockReturnValue({ exercise: null });
  mockSubstitutions.mockReturnValue({ substitutions: [] });
  mockLinkedIds.mockReturnValue({ ids: new Set<string>() });
  mockAddVariant.mockResolvedValue(undefined);
  mockAddToWorkout.mockResolvedValue(undefined);
  mockReplace.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Liste, recherche et filtres
// ---------------------------------------------------------------------------

describe('liste', () => {
  it('un chargement n’affiche pas l’état vide', async () => {
    await afficher({ exercises: [], isLoading: true });

    // Sur un catalogue de 400 exercices, « aucun exercice » pendant le chargement se lit comme
    // une base non synchronisée.
    expect(screen.queryByText('programs.edit.picker.empty')).toBeNull();
  });

  it('🔴 les FAVORIS remontent en tête', async () => {
    await afficher({
      exercises: [
        exercice({ id: 'a', name: 'Développé couché' }),
        exercice({ id: 'b', name: 'Rowing', isFavorite: true }),
      ],
    });

    // Le SQL ne fournit que l'ordre alphabétique : le tri par favori est fait ici, et le perdre
    // rend un catalogue de 400 entrées inutilisable sans qu'aucun test ne rougisse.
    expect(nomsAffiches()).toEqual(['Rowing', 'Développé couché']);
  });

  it('la recherche est transmise au repository', async () => {
    await afficher();

    await saisir('exercises.search', 'squat');

    expect(mockExercises).toHaveBeenLastCalledWith('squat', [], []);
  });

  it('les filtres sont transmis, et comptés sur le bouton', async () => {
    await afficher();

    await taper(screen.getByText(/exercises\.filters/));
    await taper(screen.getByLabelText('filtrer-pectoraux'));

    expect(mockExercises).toHaveBeenLastCalledWith('', ['chest'], []);
    // Le compteur est le seul indice qu'une liste est filtrée quand le tiroir est refermé.
    expect(screen.getByText('exercises.filters · 1')).toBeTruthy();
  });

  it('🔴 un catalogue vide SANS filtre et vide À CAUSE d’un filtre ne disent pas la même chose', async () => {
    await afficher({ exercises: [] });
    expect(screen.getByText('programs.edit.picker.empty')).toBeTruthy();
    expect(screen.queryByLabelText('exercises.filterDrawer.reset')).toBeNull();

    await afficher({ exercises: [] });
    await taper(screen.getByText(/exercises\.filters/));
    await taper(screen.getByLabelText('filtrer-pectoraux'));

    // Un catalogue qui paraît vide à cause d'un filtre oublié se lit comme une app cassée : le
    // bouton de réinitialisation est la sortie.
    expect(screen.getByText('exercises.emptyFiltered')).toBeTruthy();
    expect(screen.getByLabelText('exercises.filterDrawer.reset')).toBeTruthy();
  });

  it('réinitialiser vide les deux familles de filtres', async () => {
    await afficher({ exercises: [] });

    await taper(screen.getByText(/exercises\.filters/));
    await taper(screen.getByLabelText('filtrer-pectoraux'));
    await taper(screen.getByLabelText('exercises.filterDrawer.reset'));

    expect(mockExercises).toHaveBeenLastCalledWith('', [], []);
  });

  it('un exercice perso est marqué comme tel', async () => {
    await afficher({ exercises: [exercice({ source: 'custom' })] });

    // Le badge distingue ce qu'on a créé de la base éditoriale — utile avant de renommer ou de
    // supprimer.
    expect(screen.getByText(/exercises\.customBadge/)).toBeTruthy();
  });

  it('🔴 mettre en favori n’ouvre PAS l’exercice', async () => {
    await afficher({ params: { mode: 'browse' } });

    await taper(screen.getByText('icone-star-outline'));

    // L'étoile est imbriquée dans la ligne : sans gestion propre, elle déclencherait aussi la
    // navigation, et on quitterait l'écran à chaque mise en favori.
    expect(mockToggleFavorite).toHaveBeenCalledWith('ex-1');
    expect(push).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Les quatre métiers
// ---------------------------------------------------------------------------

describe('mode consultation', () => {
  it('un appui ouvre la fiche', async () => {
    await afficher({ params: { mode: 'browse' } });

    await taper(screen.getByText('Squat'));

    expect(push).toHaveBeenCalledWith('/exercises/ex-1');
    expect(mockAddToWorkout).not.toHaveBeenCalled();
  });

  it('🔴 même avec une séance active, consulter n’AJOUTE rien', async () => {
    await afficher({ params: { mode: 'browse' }, active: seanceAvec() });

    await taper(screen.getByText('Squat'));

    // Le mode est explicite : sans cette priorité, ouvrir le catalogue depuis la fiche d'un
    // exercice pendant une séance ajouterait l'exercice au lieu de l'afficher.
    expect(mockAddToWorkout).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/exercises/ex-1');
  });
});

describe('mode ajout à la séance', () => {
  it('ajoute puis referme', async () => {
    await afficher({ active: seanceAvec() });

    await taper(screen.getByText('Squat'));

    expect(mockAddToWorkout).toHaveBeenCalledWith('w-1', 'ex-1');
    expect(back).toHaveBeenCalled();
  });

  it('🔴 sans séance active, un appui n’écrit RIEN', async () => {
    await afficher({ active: null });

    await taper(screen.getByText('Squat'));

    // Écran ouvert en lien direct, ou séance clôturée depuis un autre appareil : il n'y a pas de
    // séance où ajouter, et inventer une cible créerait un enregistrement fantôme.
    expect(mockAddToWorkout).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});

describe('mode remplacement', () => {
  it('remplace dans la séance active', async () => {
    await afficher({
      params: { replaceExerciseId: 'ex-old' },
      active: seanceAvec('ex-old'),
    });

    await taper(screen.getByText('Squat'));

    expect(mockReplace).toHaveBeenCalledWith('w-1', 'ex-old', 'ex-1');
    expect(mockAddToWorkout).not.toHaveBeenCalled();
  });

  it('🔴 les exercices DÉJÀ dans la séance sont exclus', async () => {
    await afficher({
      params: { replaceExerciseId: 'ex-old' },
      exercises: [exercice({ id: 'ex-1', name: 'Squat' }), exercice({ id: 'ex-2', name: 'Rowing' })],
      active: seanceAvec('ex-old', 'ex-2'),
    });

    // Remplacer un exercice par un voisin déjà présent le dupliquerait dans la séance.
    expect(nomsAffiches()).toEqual(['Squat']);
  });

  it('🔴 les suggestions n’existent QU’EN mode remplacement', async () => {
    mockSubstitutions.mockReturnValue({ substitutions: [{ id: 'ex-9', name: 'Presse' }] });
    await afficher({ active: seanceAvec() });

    // Sans exercice source, `useSubstitutions` reçoit `null` : afficher une section « Suggestions »
    // hors remplacement suggérerait des alternatives à rien.
    expect(mockSubstitutions).toHaveBeenCalledWith(null, expect.anything());
  });

  it('la source de substitution est construite depuis l’exercice remplacé', async () => {
    mockExercise.mockReturnValue({
      exercise: {
        id: 'ex-old',
        name: 'Développé couché',
        muscle: 'chest',
        equipment: 'barbell',
        musclesSecondary: ['arms'],
      },
    });
    await afficher({ params: { replaceExerciseId: 'ex-old' }, active: seanceAvec('ex-old') });

    expect(mockSubstitutions).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ex-old', muscle: 'chest' }),
      ['ex-old'],
    );
  });

  it('🔴 ce qui est déjà dans la séance n’est pas une suggestion', async () => {
    mockExercise.mockReturnValue({
      exercise: { id: 'ex-old', name: 'X', muscle: 'chest', equipment: null, musclesSecondary: [] },
    });
    await afficher({
      params: { replaceExerciseId: 'ex-old' },
      active: seanceAvec('ex-old', 'ex-2'),
    });

    // « Remplace-le par celui que tu fais déjà » n'est pas une suggestion : c'est un doublon.
    expect(mockSubstitutions).toHaveBeenCalledWith(expect.anything(), ['ex-old', 'ex-2']);
  });

  it('choisir une suggestion remplace comme une ligne ordinaire', async () => {
    mockSubstitutions.mockReturnValue({ substitutions: [{ id: 'ex-9', name: 'Presse' }] });
    mockExercise.mockReturnValue({
      exercise: { id: 'ex-old', name: 'X', muscle: 'chest', equipment: null, musclesSecondary: [] },
    });
    await afficher({ params: { replaceExerciseId: 'ex-old' }, active: seanceAvec('ex-old') });

    await taper(screen.getByLabelText('suggestion-0'));

    // `onPick` ne dépend que de l'`id` : la section n'a pas à fabriquer un faux exercice complet
    // avec des champs inventés.
    expect(mockReplace).toHaveBeenCalledWith('w-1', 'ex-old', 'ex-9');
  });
});

describe('mode variante', () => {
  it('lie la variante puis referme', async () => {
    await afficher({ params: { mode: 'pickVariant', forExerciseId: 'ex-src' } });

    await taper(screen.getByText('Squat'));

    expect(mockAddVariant).toHaveBeenCalledWith('ex-src', 'ex-1');
    expect(back).toHaveBeenCalled();
  });

  it('🔴 l’exercice LUI-MÊME est exclu', async () => {
    await afficher({
      params: { mode: 'pickVariant', forExerciseId: 'ex-1' },
      exercises: [exercice({ id: 'ex-1', name: 'Squat' }), exercice({ id: 'ex-2', name: 'Rowing' })],
    });

    // Se lier à soi-même produirait une variante circulaire, que rien en aval ne sait démêler.
    expect(nomsAffiches()).toEqual(['Rowing']);
  });

  it('🔴 les exercices DÉJÀ liés sont exclus', async () => {
    mockLinkedIds.mockReturnValue({ ids: new Set(['ex-2']) });
    await afficher({
      params: { mode: 'pickVariant', forExerciseId: 'ex-src' },
      exercises: [exercice({ id: 'ex-1', name: 'Squat' }), exercice({ id: 'ex-2', name: 'Rowing' })],
    });

    expect(nomsAffiches()).toEqual(['Squat']);
  });

  it('🔴 les variantes ne sont demandées QU’EN mode variante', async () => {
    await afficher({ params: { mode: 'browse' } });

    // Chaîne vide = requête neutre : interroger les liens d'un exercice qu'on ne remplace pas
    // serait une lecture pour rien, sur chaque ouverture du catalogue.
    expect(mockLinkedIds).toHaveBeenCalledWith('');
  });

  it('🔴 le mode variante n’ajoute RIEN à la séance active', async () => {
    await afficher({
      params: { mode: 'pickVariant', forExerciseId: 'ex-src' },
      active: seanceAvec(),
    });

    await taper(screen.getByText('Squat'));

    // Lier une variante depuis une fiche pendant une séance ne doit pas ajouter l'exercice au
    // milieu de l'entraînement en cours.
    expect(mockAddToWorkout).not.toHaveBeenCalled();
    expect(mockAddVariant).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Création d'exercice
// ---------------------------------------------------------------------------

describe('création d’exercice', () => {
  it('la modale est fermée par défaut et s’ouvre au tap', async () => {
    await afficher();
    expect(screen.queryByText('modale-creation')).toBeNull();

    await taper(screen.getByLabelText('exercises.createCustom'));
    expect(screen.getByText('modale-creation')).toBeTruthy();
  });
});
