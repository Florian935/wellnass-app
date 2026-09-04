/**
 * Résumé de séance (`app/workout-summary.tsx`) — le **vrai** écran, monté.
 *
 * `buildSummary` a déjà son test ([`workout-summary-build.test.ts`](./workout-summary-build.test.ts)) :
 * ce fichier couvre ce que l'écran **décide autour**, et il n'était couvert qu'à 7,5 % de branches
 * — le plus gros écart instructions ↔ branches de `src/app`. C'est le dernier écran qu'on voit
 * après un entraînement, donc celui où une erreur reste en mémoire.
 *
 * Quatre décisions, toutes conditionnelles, toutes silencieuses si elles cassent :
 *
 *  1. **« Enregistrer comme modèle » n'apparaît QUE sur une séance libre non vide.** Une séance
 *     issue d'un programme a déjà sa structure ailleurs : en refaire un modèle créerait un doublon
 *     que rien ne relie à l'original.
 *  2. **La carte partageable exige un contenu.** Une séance sans exercice ne produirait qu'une
 *     carte vide, envoyée à des tiers.
 *  3. **Le ressenti est borné 1–5 à l'affichage**, et un RPE hors bornes (donnée héritée d'une
 *     autre échelle) ne doit pas remplir six étoiles ni en vider cinq.
 *  4. **Le nom de modèle par défaut est daté en LOCAL.** Un `slice` de la chaîne ISO UTC
 *     décalerait le jour affiché d'un fuseau — une séance du soir deviendrait celle du lendemain.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WorkoutSummaryScreen from '../workout-summary';
import {
  getWorkoutSets,
  setWorkoutFeedback,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import { useWorkoutRecords } from '@/data/repositories/records-repository';
import { createTemplateFromWorkout } from '@/data/repositories/workout-template-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-repository', () => ({
  useWorkoutHistory: jest.fn(() => ({ workouts: [] })),
  getWorkoutSets: jest.fn(),
  setWorkoutFeedback: jest.fn(),
}));
jest.mock('@/data/repositories/records-repository', () => ({
  useWorkoutRecords: jest.fn(() => ({ records: [], isLoading: false })),
}));
jest.mock('@/data/repositories/workout-template-repository', () => ({
  createTemplateFromWorkout: jest.fn(),
}));

jest.mock('@/components/CelebrationCard', () => {
  const { Text } = require('react-native');
  return { CelebrationCard: ({ title }: { title: string }) => <Text>celebration:{title}</Text> };
});
jest.mock('@/components/share/ShareCardSheet', () => {
  const { Text } = require('react-native');
  return {
    ShareCardSheet: ({
      visible,
      data,
    }: {
      visible: boolean;
      data: { stats: { exercises: number; volume: string }; records: string[] };
    }) =>
      visible ? (
        <Text>
          partage:{data.stats.exercises}:{data.stats.volume}:{data.records.join('|')}
        </Text>
      ) : null,
  };
});
jest.mock('@/components/FormScreen', () => {
  const { View } = require('react-native');
  return { FormScreen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text } = require('react-native');
  return { ScreenHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
      >
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
      onBlur,
    }: {
      label: string;
      value: string;
      onChangeText: (v: string) => void;
      onBlur?: () => void;
    }) => (
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} onBlur={onBlur} />
    ),
  };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({ id: 'w-1' })),
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
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({ formatWeight: (kg: number) => `${Math.round(kg)} kg` }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockHistory = useWorkoutHistory as jest.Mock;
const mockSets = getWorkoutSets as jest.Mock;
const mockFeedback = setWorkoutFeedback as jest.Mock;
const mockRecords = useWorkoutRecords as jest.Mock;
const mockCreateTemplate = createTemplateFromWorkout as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const replace = jest.fn();

const serie = (overrides: Record<string, unknown> = {}) => ({
  exerciseId: 'ex-1',
  setType: 'normal',
  reps: 10,
  weightKg: 80,
  done: true,
  ...overrides,
});

/** Séance LIBRE par défaut : ni séance de programme, ni programme — condition du modèle. */
const seance = (overrides: Record<string, unknown> = {}) => ({
  id: 'w-1',
  startedAt: '2026-08-13T18:30:00.000Z',
  finishedAt: '2026-08-13T19:45:00.000Z',
  durationSeconds: 4500,
  sessionId: null,
  programId: null,
  rpe: null,
  notes: null,
  ...overrides,
});

const afficher = async ({
  workouts = [seance()] as unknown[],
  sets = [serie()] as unknown[],
  records = [] as unknown[],
  recordsLoading = false,
  params = { id: 'w-1' } as Record<string, string>,
} = {}) => {
  mockHistory.mockReturnValue({ workouts });
  mockSets.mockResolvedValue(sets);
  mockRecords.mockReturnValue({ records, isLoading: recordsLoading });
  mockParams.mockReturnValue(params);
  await render(<WorkoutSummaryScreen />);
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

const record = (overrides: Record<string, unknown> = {}) => ({
  exerciseId: 'ex-1',
  exerciseName: 'Squat',
  type: 'max_weight',
  value: 120,
  reps: 3,
  weightKg: 120,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockUseRouter.mockReturnValue({ replace });
  mockCreateTemplate.mockResolvedValue('tpl-1');
  mockFeedback.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Résumé
// ---------------------------------------------------------------------------

describe('résumé', () => {
  it('🔴 une séance INTROUVABLE affiche un message, pas un écran de zéros', async () => {
    await afficher({ workouts: [] });

    // Séance supprimée depuis un autre appareil, ou lien direct : « 0 exercice, 0 kg » se lirait
    // comme un entraînement raté.
    expect(screen.getByText('workout.none')).toBeTruthy();
    expect(mockSets).not.toHaveBeenCalled();
  });

  it('🔴 sans identifiant, rien n’est calculé', async () => {
    await afficher({ params: {} });

    expect(screen.getByText('workout.none')).toBeTruthy();
  });

  it('affiche durée, exercices, séries, volume et densité', async () => {
    await afficher({ sets: [serie(), serie({ exerciseId: 'ex-2' })] });

    expect(screen.getByText('workout.summary.minutes:{"count":75}')).toBeTruthy();
    // « 2 » apparaît deux fois — deux exercices ET deux séries faites : c'est justement ce que
    // le résumé compte séparément.
    expect(screen.getAllByText('2')).toHaveLength(2);
    expect(screen.getByText('1600 kg')).toBeTruthy();
  });

  it('🔴 les séries d’ÉCHAUFFEMENT sont comptées à part', async () => {
    await afficher({
      sets: [serie(), serie({ setType: 'warmup' }), serie({ setType: 'warmup' })],
    });

    // Elles ne comptent ni dans les séries faites ni dans le volume : les mélanger gonflerait le
    // tonnage d'une séance de 30 %, durablement, puisque le résumé est archivé.
    expect(screen.getByText('workout.summary.warmupCount:{"count":2}')).toBeTruthy();
  });

  it('sans échauffement, aucune mention', async () => {
    await afficher({ sets: [serie()] });

    expect(screen.queryByText(/warmupCount/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Enregistrer comme modèle
// ---------------------------------------------------------------------------

describe('enregistrer comme modèle', () => {
  it('🔴 proposé sur une séance LIBRE non vide', async () => {
    await afficher();

    expect(screen.getByLabelText('workout.summary.saveAsTemplate')).toBeTruthy();
  });

  it.each([
    ['issue d’une séance de programme', { sessionId: 's-1' }],
    ['rattachée à un programme', { programId: 'p-1' }],
  ])('🔴 PAS proposé sur une séance %s', async (_cas, overrides) => {
    await afficher({ workouts: [seance(overrides)] });

    // Une séance de programme a déjà sa structure ailleurs : en refaire un modèle créerait un
    // doublon que rien ne relie à l'original.
    expect(screen.queryByLabelText('workout.summary.saveAsTemplate')).toBeNull();
  });

  it('🔴 PAS proposé sur une séance SANS exercice', async () => {
    await afficher({ sets: [] });

    // Un modèle vide est un modèle qu'on ouvrira une fois avant de le supprimer.
    expect(screen.queryByLabelText('workout.summary.saveAsTemplate')).toBeNull();
  });

  it('🔴 le nom par défaut est daté en LOCAL, pas en UTC', async () => {
    // 13/08 22h30 UTC = 14/08 00h30 à Paris : un `slice` de la chaîne ISO daterait le modèle du
    // 13, alors que la séance s'est faite le 14 pour l'utilisateur.
    await afficher({ workouts: [seance({ startedAt: '2026-08-13T18:30:00.000Z' })] });

    await taper(screen.getByLabelText('workout.summary.saveAsTemplate'));

    const attendu = (() => {
      const d = new Date('2026-08-13T18:30:00.000Z');
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();
    expect(screen.getByLabelText('workout.summary.templateNameLabel').props.value).toBe(
      `workout.summary.saveAsTemplateDefaultName:{"date":"${attendu}"}`,
    );
  });

  it('🔴 un nom VIDE interdit la validation', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.summary.saveAsTemplate'));
    await saisir('workout.summary.templateNameLabel', '   ');

    // Un modèle sans nom serait introuvable dans la liste — et le détourage empêche de contourner
    // la garde avec des espaces.
    expect(
      screen.getByLabelText('workout.summary.saveAsTemplateConfirm').props.accessibilityState
        .disabled,
    ).toBe(true);
  });

  it('valider crée le modèle avec le nom détouré, et confirme', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.summary.saveAsTemplate'));
    await saisir('workout.summary.templateNameLabel', '  Haut du corps  ');
    await taper(screen.getByLabelText('workout.summary.saveAsTemplateConfirm'));

    expect(mockCreateTemplate).toHaveBeenCalledWith('w-1', 'Haut du corps');
    // La confirmation nomme le modèle : c'est ce qui permet de le retrouver ensuite.
    expect(Alert.alert).toHaveBeenCalledWith('workout.summary.templateSaved', 'Haut du corps');
  });

  it('🔴 le formulaire se REFERME après succès', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.summary.saveAsTemplate'));
    await saisir('workout.summary.templateNameLabel', 'Haut du corps');
    await taper(screen.getByLabelText('workout.summary.saveAsTemplateConfirm'));

    // Rester ouvert inviterait à valider deux fois, et créerait deux modèles homonymes.
    expect(screen.queryByLabelText('workout.summary.templateNameLabel')).toBeNull();
  });

  it('🔴 un ÉCHEC laisse le formulaire ouvert pour réessayer', async () => {
    mockCreateTemplate.mockRejectedValue(new Error('hors ligne'));
    await afficher();

    await taper(screen.getByLabelText('workout.summary.saveAsTemplate'));
    await saisir('workout.summary.templateNameLabel', 'Haut du corps');
    await taper(screen.getByLabelText('workout.summary.saveAsTemplateConfirm'));

    // Le fermer effacerait le nom saisi : l'utilisateur devrait tout retaper.
    expect(screen.getByLabelText('workout.summary.templateNameLabel')).toBeTruthy();
    expect(
      screen.getByLabelText('workout.summary.saveAsTemplateConfirm').props.accessibilityState
        .disabled,
    ).toBe(false);
  });

  it('annuler referme sans écrire', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.summary.saveAsTemplate'));
    await taper(screen.getByLabelText('common.cancel'));

    expect(mockCreateTemplate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('workout.summary.saveAsTemplate')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Ressenti
// ---------------------------------------------------------------------------

describe('ressenti', () => {
  it('cinq étoiles, aucune pleine par défaut', async () => {
    await afficher();

    expect(screen.getAllByText('icone-star-outline')).toHaveLength(5);
    expect(screen.queryByText('icone-star')).toBeNull();
  });

  it('noter écrit immédiatement et remplit les étoiles', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.summary.starLabel:{"count":3}'));

    expect(mockFeedback).toHaveBeenCalledWith('w-1', { rpe: 3 });
    expect(screen.getAllByText('icone-star')).toHaveLength(3);
  });

  it.each([
    [9, 5],
    [-2, 0],
  ])('🔴 un RPE hors bornes (%i) est ramené à %i étoiles', async (rpe, attendu) => {
    await afficher({ workouts: [seance({ rpe })] });

    // Donnée héritée d'une autre échelle (RPE 1–10) ou corrompue : six étoiles casseraient la
    // mise en page, et un nombre négatif en viderait cinq sans expliquer pourquoi.
    const pleines = screen.queryAllByText('icone-star');
    expect(pleines).toHaveLength(attendu);
  });

  it('la note existante pré-remplit le champ', async () => {
    await afficher({ workouts: [seance({ notes: 'Dos sensible' })] });

    expect(screen.getByLabelText('workout.summary.note').props.value).toBe('Dos sensible');
  });

  it('🔴 une note VIDÉE est effacée, pas enregistrée comme chaîne vide', async () => {
    await afficher({ workouts: [seance({ notes: 'Dos sensible' })] });

    await saisir('workout.summary.note', '   ');
    await act(async () => {
      fireEvent(screen.getByLabelText('workout.summary.note'), 'blur');
    });

    // `null` et non `''` : une chaîne vide s'afficherait comme une note existante dans les écrans
    // qui testent la présence plutôt que le contenu.
    expect(mockFeedback).toHaveBeenCalledWith('w-1', { notes: null });
  });

  it('🔴 une note non vide est enregistrée telle quelle, espaces compris', async () => {
    await afficher();

    await saisir('workout.summary.note', '  Bonne séance  ');
    await act(async () => {
      fireEvent(screen.getByLabelText('workout.summary.note'), 'blur');
    });

    // Le détourage sert à décider si la note existe, pas à réécrire ce que l'utilisateur a tapé —
    // une mise en forme volontaire (retour à la ligne, indentation) serait perdue.
    expect(mockFeedback).toHaveBeenCalledWith('w-1', { notes: '  Bonne séance  ' });
  });
});

// ---------------------------------------------------------------------------
// Records et célébration
// ---------------------------------------------------------------------------

describe('records', () => {
  it('🔴 aucune section ni célébration pendant le CHARGEMENT', async () => {
    await afficher({ records: [record()], recordsLoading: true });

    // Une bannière de félicitations qui apparaît une seconde après le résumé se lit comme un
    // artefact, pas comme une récompense.
    expect(screen.queryByText(/^celebration:/)).toBeNull();
  });

  it('🔴 aucune célébration sans record', async () => {
    await afficher({ records: [] });

    // Célébrer chaque séance banaliserait la seule chose qui mérite d'être remarquée.
    expect(screen.queryByText(/^celebration:/)).toBeNull();
  });

  it('un record battu déclenche la célébration', async () => {
    await afficher({ records: [record()] });

    expect(screen.getByText(/^celebration:/)).toBeTruthy();
    expect(screen.getByText('workout.summary.records.sectionTitle')).toBeTruthy();
  });

  it('deux records sur le MÊME exercice ne comptent qu’un exercice', async () => {
    await afficher({
      records: [record({ type: 'max_weight' }), record({ type: 'best_volume', value: 2400 })],
    });

    // `new Set(...).size` : « 2 exercices » alors qu'on n'en a battu qu'un donnerait une
    // félicitation fausse.
    expect(screen.getByText(/^celebration:/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Carte partageable
// ---------------------------------------------------------------------------

describe('carte partageable', () => {
  it('🔴 aucun partage sur une séance SANS exercice', async () => {
    await afficher({ sets: [] });

    // Une carte vide envoyée à des tiers : le pire moment pour découvrir un état limite.
    expect(screen.queryByLabelText('share.cta')).toBeNull();
  });

  it('la carte s’ouvre avec les statistiques de la séance', async () => {
    await afficher({ sets: [serie(), serie({ exerciseId: 'ex-2' })] });

    await taper(screen.getByLabelText('share.cta'));

    expect(screen.getByText(/^partage:2:1600 kg/)).toBeTruthy();
  });

  it('🔴 les records sont portés sur la carte, DÉJÀ formatés', async () => {
    await afficher({ records: [record({ exerciseName: 'Squat', value: 120 })] });

    await taper(screen.getByLabelText('share.cta'));

    // La carte n'applique aucune mise en forme métier : elle affiche des chaînes. Lui passer des
    // nombres bruts lui ferait inventer un format, hors du système d'unités.
    expect(screen.getByText(/Squat · 120 kg/)).toBeTruthy();
  });

  it('🔴 un record de VOLUME n’est pas formaté en poids', async () => {
    await afficher({
      records: [record({ type: 'best_volume', value: 2400, exerciseName: 'Squat' })],
    });

    await taper(screen.getByLabelText('share.cta'));

    // Un volume est un produit charge × répétitions : « 2400 kg » suggérerait une charge soulevée.
    expect(screen.getByText(/Squat · 2400\|?/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Sortie
// ---------------------------------------------------------------------------

describe('sortie', () => {
  it('🔴 le retour à l’accueil REMPLACE la pile', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.backHome'));

    // `replace` : revenir en arrière depuis l'accueil rouvrirait le résumé d'une séance close,
    // et le geste de retour d'Android y ramènerait en boucle.
    expect(replace).toHaveBeenCalledWith('/(tabs)');
  });
});
