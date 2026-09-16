/**
 * Écran de fin de séance (`app/workout-summary.tsx`) — ce que **la route** décide.
 *
 * Depuis MUSCU-UX02, tout le contenu du bilan vit dans `<WorkoutReport>`, partagé avec
 * l'historique, et a sa propre couverture
 * ([`WorkoutReport.test.tsx`](../../components/workout/report/__tests__/WorkoutReport.test.tsx)) :
 * niveaux, blocs vides, ressenti, célébration. Le composant est donc **mocké** ici — le remonter
 * ne testerait rien de plus et rendrait chaque cas dépendant de blocs sans rapport.
 *
 * Restent trois décisions, toutes conditionnelles, toutes silencieuses si elles cassent :
 *
 *  1. **« Enregistrer comme modèle » n'apparaît QUE sur une séance libre non vide.** Une séance
 *     issue d'un programme a déjà sa structure ailleurs : en refaire un modèle créerait un doublon
 *     que rien ne relie à l'original.
 *  2. **La carte partageable exige un contenu**, et porte des libellés DÉJÀ formatés — une séance
 *     sans exercice ne produirait qu'une carte vide, envoyée à des tiers.
 *  3. **Le nom de modèle par défaut est daté en LOCAL.** Un `slice` de la chaîne ISO UTC décalerait
 *     le jour affiché d'un fuseau — une séance du soir deviendrait celle du lendemain.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WorkoutSummaryScreen from '../workout-summary';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import { useWorkoutReport } from '@/data/repositories/workout-report-repository';
import { createTemplateFromWorkout } from '@/data/repositories/workout-template-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-repository', () => ({
  useWorkoutHistory: jest.fn(() => ({ workouts: [] })),
}));
jest.mock('@/data/repositories/workout-report-repository', () => ({
  useWorkoutReport: jest.fn(() => ({ report: null, isLoading: false })),
}));
jest.mock('@/data/repositories/workout-template-repository', () => ({
  createTemplateFromWorkout: jest.fn(),
}));

// Le bilan a sa propre couverture : on ne remonte pas douze blocs pour tester un bouton.
jest.mock('@/components/workout/report/WorkoutReport', () => {
  const { Text } = require('react-native');
  return { WorkoutReport: ({ context }: { context: string }) => <Text>bilan:{context}</Text> };
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

// US DEPENSE-02 : la section dépense est testée à part (EnergyCard.test.tsx).
jest.mock('@/components/energy/WorkoutEnergySection', () => ({ WorkoutEnergySection: () => null }));

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
    colors: { text: '#33291f', textMuted: '#96856f', surface: '#fffaf2', border: '#ece0cd', accent: '#c0562f' },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({ formatWeight: (kg: number) => `${Math.round(kg)} kg` }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockHistory = useWorkoutHistory as jest.Mock;
const mockReport = useWorkoutReport as jest.Mock;
const mockCreateTemplate = createTemplateFromWorkout as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const replace = jest.fn();

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

/** Un bilan réduit à ce que l'écran lui demande : des totaux et des records. */
const bilan = (overrides: Record<string, unknown> = {}) => ({
  workoutId: 'w-1',
  startedAt: '2026-08-13T18:30:00.000Z',
  totals: {
    exercises: 2,
    workingSets: 5,
    warmupSets: 0,
    volumeKg: 1600,
    durationMin: 75,
    densityKgPerMin: 21,
    bestEstimated1RM: null,
    relativeIntensityPercent: null,
    averageRpe: null,
    sessionLoad: null,
    hardSets: 0,
    ratedSets: 0,
  },
  records: [],
  ...overrides,
});

const afficher = async ({
  workouts = [seance()] as unknown[],
  report = bilan() as unknown,
  params = { id: 'w-1' } as Record<string, string>,
} = {}) => {
  mockHistory.mockReturnValue({ workouts });
  mockReport.mockReturnValue({ report, isLoading: false });
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockUseRouter.mockReturnValue({ replace });
  mockCreateTemplate.mockResolvedValue('tpl-1');
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Montage du bilan
// ---------------------------------------------------------------------------

describe('bilan', () => {
  it('monte le bilan partagé dans son contexte de fin de séance', async () => {
    await afficher();

    // `context` est ce qui distingue ce montage de celui de l'historique (spec R9).
    expect(screen.getByText('bilan:post-session')).toBeTruthy();
  });

  it('🔴 une séance INTROUVABLE affiche un message, pas un écran de zéros', async () => {
    await afficher({ workouts: [], report: null });

    // Séance supprimée depuis un autre appareil, ou lien direct : « 0 exercice, 0 kg » se lirait
    // comme un entraînement raté.
    expect(screen.getByText('workout.none')).toBeTruthy();
  });

  it('🔴 sans identifiant, aucun bilan n’est monté', async () => {
    await afficher({ params: {}, report: null });

    expect(screen.queryByText(/^bilan:/)).toBeNull();
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

    expect(screen.queryByLabelText('workout.summary.saveAsTemplate')).toBeNull();
  });

  it('🔴 PAS proposé sur une séance SANS exercice', async () => {
    await afficher({ report: bilan({ totals: { ...bilan().totals, exercises: 0 } }) });

    // Un modèle vide est un modèle qu'on ouvrira une fois avant de le supprimer.
    expect(screen.queryByLabelText('workout.summary.saveAsTemplate')).toBeNull();
  });

  it('🔴 le nom par défaut est daté en LOCAL, pas en UTC', async () => {
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

    expect(
      screen.getByLabelText('workout.summary.saveAsTemplateConfirm').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('valider crée le modèle avec le nom détouré, et confirme', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.summary.saveAsTemplate'));
    await saisir('workout.summary.templateNameLabel', '  Haut du corps  ');
    await taper(screen.getByLabelText('workout.summary.saveAsTemplateConfirm'));

    expect(mockCreateTemplate).toHaveBeenCalledWith('w-1', 'Haut du corps');
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

    expect(screen.getByLabelText('workout.summary.templateNameLabel')).toBeTruthy();
  });

  it('annuler referme sans écrire', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.summary.saveAsTemplate'));
    await taper(screen.getByLabelText('common.cancel'));

    expect(mockCreateTemplate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('workout.summary.templateNameLabel')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Carte partageable
// ---------------------------------------------------------------------------

describe('carte partageable', () => {
  it('🔴 aucun partage sur une séance SANS exercice', async () => {
    await afficher({ report: bilan({ totals: { ...bilan().totals, exercises: 0 } }) });

    expect(screen.queryByLabelText('share.cta')).toBeNull();
  });

  it('la carte s’ouvre avec les statistiques de la séance', async () => {
    await afficher();

    await taper(screen.getByLabelText('share.cta'));

    expect(screen.getByText('partage:2:1600 kg:')).toBeTruthy();
  });

  it('🔴 les records sont portés sur la carte, DÉJÀ formatés', async () => {
    await afficher({
      report: bilan({
        records: [
          { exerciseId: 'ex-1', exerciseName: 'Squat', type: 'max_weight', value: 120, previousValue: 115 },
        ],
      }),
    });

    await taper(screen.getByLabelText('share.cta'));

    // La carte n'a aucune règle métier : elle affiche des chaînes déjà résolues et traduites.
    expect(screen.getByText('partage:2:1600 kg:Squat · 120 kg')).toBeTruthy();
  });

  it('🔴 un record de VOLUME n’est pas formaté en poids', async () => {
    await afficher({
      report: bilan({
        records: [
          { exerciseId: 'ex-1', exerciseName: 'Squat', type: 'best_volume', value: 700, previousValue: 630 },
        ],
      }),
    });

    await taper(screen.getByLabelText('share.cta'));

    // Un volume de série est un nombre brut (kg·reps) : lui coller « kg » en ferait une charge.
    expect(screen.getByText('partage:2:1600 kg:Squat · 700')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Sortie
// ---------------------------------------------------------------------------

describe('sortie', () => {
  it('🔴 le retour à l’accueil REMPLACE la pile', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.backHome'));

    // Un `push` laisserait le résumé derrière : le geste « retour » y ramènerait, et la séance
    // paraîtrait recommencer.
    expect(replace).toHaveBeenCalledWith('/(tabs)');
  });
});
