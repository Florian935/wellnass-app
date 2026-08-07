/**
 * Écran de séance (`app/workout.tsx`) — le **vrai** écran, monté.
 *
 * `workout-focus.test.ts` couvre les fonctions pures de cet écran ; ici on monte le composant
 * exporté par la route (patron §3.7 de `strategie-tests.md`), parce que ce qui reste ne vit que
 * dans le rendu : la clôture, le repos, la bascule superset et les trois sorties par `Alert`.
 *
 * Le motif immédiat de ce fichier : **verrouiller le correctif de double clôture du 07/08/2026.**
 * « Terminer » est un `Pressable` nu qui reste actif pendant tout l'`await` — sans garde, deux
 * appuis rapides clôturaient la séance deux fois, réévaluaient les records deux fois (donc
 * pouvaient pousser deux notifications de record identiques) et navigueaient deux fois. La garde
 * est une **ref** et non un état React, précisément parce que deux appuis rapides tombent dans le
 * même cycle de rendu (voir §3.2). Une régression vers `useState` repasserait invisible.
 *
 * Les composants lourds (`CurrentSetCard`, `ExerciseList`, `RestOverlay`, `SupersetPickerModal`)
 * sont remplacés par des sondes minimales : ils sont testés chez eux, et ce qui compte ici est
 * **ce que l'écran leur passe** et **quand**.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WorkoutScreen from '../workout';
import {
  cancelWorkout,
  finishWorkout,
  updateSet,
  useActiveWorkout,
  useSessionRest,
  useSupersetPairs,
  type ActiveWorkout,
  type WorkoutSetItem,
} from '@/data/repositories/workout-repository';
import { evaluateWorkoutRecords } from '@/data/repositories/records-repository';
import { maybePushRecords } from '@/data/repositories/notification-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-repository', () => ({
  useActiveWorkout: jest.fn(() => ({ workout: null, isLoading: false })),
  useSessionRest: jest.fn(() => ({})),
  useLastPerformance: jest.fn(() => []),
  usePreviousStruggled: jest.fn(() => false),
  useSupersetPairs: jest.fn(() => ({})),
  useExerciseNote: jest.fn(() => ({ note: null, isLoading: false })),
  useExerciseNotes: jest.fn(() => ({})),
  addSet: jest.fn(),
  cancelWorkout: jest.fn().mockResolvedValue(undefined),
  finishWorkout: jest.fn().mockResolvedValue(undefined),
  linkSupersetPair: jest.fn(),
  removeSet: jest.fn(),
  reorderExercise: jest.fn(),
  sendExerciseToEnd: jest.fn(),
  setExerciseNote: jest.fn(),
  unlinkSupersetPair: jest.fn(),
  updateSet: jest.fn(),
}));

jest.mock('@/data/repositories/records-repository', () => ({
  evaluateWorkoutRecords: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/data/repositories/notification-repository', () => ({
  maybePushRecords: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null, isLoading: false })),
}));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  usePriorWeekAdherence: jest.fn(() => null),
}));

/**
 * Sonde de la carte de série : n'expose que le bouton de validation. C'est le seul geste que
 * l'écran orchestre lui-même (repos, bascule superset), le reste de la carte est testé chez elle.
 */
jest.mock('@/components/workout/CurrentSetCard', () => {
  const { Pressable: P, Text: T } = require('react-native');
  return {
    CurrentSetCard: (props: { exerciseName: string; onValidate: () => void }) => (
      <P testID="valider" onPress={props.onValidate}>
        <T>{props.exerciseName}</T>
      </P>
    ),
  };
});
jest.mock('@/components/workout/ExerciseList', () => ({ ExerciseList: () => null }));
jest.mock('@/components/workout/SupersetPickerModal', () => ({ SupersetPickerModal: () => null }));
// Sonde de repos : sa simple présence prouve que le décompte est parti.
jest.mock('@/components/workout/RestOverlay', () => {
  const { Text: T } = require('react-native');
  return { RestOverlay: () => <T testID="repos">repos</T> };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

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
      background: '#f7eede',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#7c8a5b',
      danger: '#b23b2e',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    system: 'metric',
    weightSymbol: 'kg',
    formatWeight: (kg: number | null | undefined) => (kg == null ? '—' : `${kg} kg`),
    weightInputValue: (kg: number | null | undefined) => (kg == null ? '' : String(kg)),
    parseWeightToKg: (v: string) => Number(v),
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockUseActiveWorkout = useActiveWorkout as jest.Mock;
const mockUseSessionRest = useSessionRest as jest.Mock;
const mockUseSupersetPairs = useSupersetPairs as jest.Mock;
const mockFinishWorkout = finishWorkout as jest.Mock;
const mockCancelWorkout = cancelWorkout as jest.Mock;
const mockUpdateSet = updateSet as jest.Mock;
const mockEvaluateRecords = evaluateWorkoutRecords as jest.Mock;
const mockPushRecords = maybePushRecords as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const replace = jest.fn();
const push = jest.fn();

type BoutonAlerte = { text?: string; onPress?: () => void; style?: string };
let boutonsAlerte: BoutonAlerte[] = [];

/** Déclenche le bouton d'`Alert` dont la clé i18n est donnée. */
const appuyerAlerte = async (cle: string) => {
  const bouton = boutonsAlerte.find((b) => b.text === cle);
  if (!bouton) throw new Error(`Bouton d'alerte introuvable : ${cle} (${boutonsAlerte.map((b) => b.text).join(', ')})`);
  await act(async () => {
    bouton.onPress?.();
  });
};

/** Une série de la séance active. */
const serie = (
  id: string,
  exerciseId: string,
  done: boolean,
  setType: WorkoutSetItem['setType'] = 'normal',
): WorkoutSetItem => ({
  id,
  exerciseId,
  setType,
  reps: 8,
  weightKg: 80,
  durationSeconds: null,
  done,
  orderIndex: 0,
  rpe: null,
  plannedWeightKg: null,
});

/** Séance active par défaut : un exercice, deux séries, rien de validé. */
const seance = (overrides: Partial<ActiveWorkout> = {}): ActiveWorkout =>
  ({
    id: 'w-1',
    startedAt: '2026-08-07T08:00:00.000Z',
    sessionId: null,
    programId: null,
    plannedSessionId: null,
    weekIndex: null,
    entries: [
      {
        exerciseId: 'squat',
        exerciseName: 'Squat',
        sets: [serie('s1', 'squat', false), serie('s2', 'squat', false)],
      },
    ],
    ...overrides,
  }) as ActiveWorkout;

beforeEach(() => {
  jest.clearAllMocks();
  boutonsAlerte = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_titre, _msg, boutons) => {
    boutonsAlerte = (boutons ?? []) as BoutonAlerte[];
  });
  mockUseRouter.mockReturnValue({ replace, push });
  mockUseActiveWorkout.mockReturnValue({ workout: seance(), isLoading: false });
  mockUseSessionRest.mockReturnValue({});
  mockUseSupersetPairs.mockReturnValue({});
  mockFinishWorkout.mockResolvedValue(undefined);
  mockCancelWorkout.mockResolvedValue(undefined);
  mockEvaluateRecords.mockResolvedValue([]);
  mockPushRecords.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('sans séance active, propose le retour à l’accueil', async () => {
    mockUseActiveWorkout.mockReturnValue({ workout: null, isLoading: false });

    await render(<WorkoutScreen />);

    expect(screen.getByText('workout.none')).toBeTruthy();
  });

  it('affiche la 1ʳᵉ série non validée dans la carte focus', async () => {
    await render(<WorkoutScreen />);

    expect(screen.getByTestId('valider')).toBeTruthy();
    expect(screen.getByText('Squat')).toBeTruthy();
  });

  it('toutes les séries validées → carte de fin, plus de carte focus', async () => {
    mockUseActiveWorkout.mockReturnValue({
      workout: seance({
        entries: [{ exerciseId: 'squat', exerciseName: 'Squat', sets: [serie('s1', 'squat', true)] }],
      }),
      isLoading: false,
    });

    await render(<WorkoutScreen />);

    expect(screen.queryByTestId('valider')).toBeNull();
    expect(screen.getByText('workout.sessionDone')).toBeTruthy();
  });

  it('aucun repos n’est affiché à l’ouverture', async () => {
    await render(<WorkoutScreen />);

    expect(screen.queryByTestId('repos')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Clôture — le correctif de double appui
// ---------------------------------------------------------------------------

describe('clôture de la séance', () => {
  /** Une séance avec au moins une série validée : « Terminer » clôture sans confirmation. */
  const seanceEntamee = () =>
    seance({
      entries: [
        {
          exerciseId: 'squat',
          exerciseName: 'Squat',
          sets: [serie('s1', 'squat', true), serie('s2', 'squat', false)],
        },
      ],
    });

  beforeEach(() => {
    mockUseActiveWorkout.mockReturnValue({ workout: seanceEntamee(), isLoading: false });
  });

  it('clôture, évalue les records, puis navigue vers le résumé', async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('workout.finish'));
    });

    expect(mockFinishWorkout).toHaveBeenCalledWith('w-1');
    expect(mockEvaluateRecords).toHaveBeenCalledWith('w-1');
    expect(replace).toHaveBeenCalledWith({ pathname: '/workout-summary', params: { id: 'w-1' } });
  });

  it('🔴 deux appuis dans le MÊME cycle de rendu ne clôturent pas deux fois', async () => {
    let resoudreFinish: (() => void) | undefined;
    mockFinishWorkout.mockReturnValue(
      new Promise<void>((resolve) => {
        resoudreFinish = resolve;
      }),
    );

    await render(<WorkoutScreen />);
    const bouton = screen.getByText('workout.finish');
    // « Terminer » est un `Pressable` nu : rien ne le désactive pendant l'await, et React n'a pas
    // re-rendu entre les deux appuis. Une garde par `useState` verrait `false` deux fois — c'est
    // exactement le défaut corrigé le 07/08/2026, et ce test est ce qui l'empêche de revenir.
    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });

    resoudreFinish?.();
    await act(async () => {});

    expect(mockFinishWorkout).toHaveBeenCalledTimes(1);
    expect(mockEvaluateRecords).toHaveBeenCalledTimes(1);
    // Deux évaluations, ce sont potentiellement deux notifications de record identiques.
    expect(mockPushRecords).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('🔴 navigue MÊME si l’évaluation des records échoue', async () => {
    mockEvaluateRecords.mockRejectedValue(new Error('base indisponible'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('workout.finish'));
    });

    // Les records sont un enrichissement best-effort : rester coincé sur l'écran de saisie parce
    // qu'un calcul annexe a échoué, alors que la séance EST clôturée en base, est le pire des états.
    expect(mockFinishWorkout).toHaveBeenCalledWith('w-1');
    expect(replace).toHaveBeenCalled();
  });

  it('🔴 navigue MÊME si le push de notification de record échoue', async () => {
    mockPushRecords.mockRejectedValue(new Error('permission notifications refusée'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('workout.finish'));
    });

    expect(replace).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Clôture d'une séance sans aucune série validée
// ---------------------------------------------------------------------------

describe('clôture d’une séance vide', () => {
  it('🔴 demande confirmation plutôt que de clôturer une séance sans rien de validé', async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('workout.finish'));
    });

    // Une séance ouverte par erreur et clôturée d'un geste polluerait l'historique et le streak.
    expect(mockFinishWorkout).not.toHaveBeenCalled();
    expect(boutonsAlerte.map((b) => b.text)).toEqual(['common.cancel', 'workout.finishAnyway']);
  });

  it('confirmer clôture quand même', async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('workout.finish'));
    });
    await appuyerAlerte('workout.finishAnyway');

    expect(mockFinishWorkout).toHaveBeenCalledWith('w-1');
    expect(replace).toHaveBeenCalled();
  });

  it('annuler ne clôture rien et ne navigue pas', async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('workout.finish'));
    });
    await appuyerAlerte('common.cancel');

    expect(mockFinishWorkout).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Sortie de l'écran
// ---------------------------------------------------------------------------

describe('sortie de l’écran', () => {
  const quitter = async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('workout.leave.title'));
    });
  };

  it('propose trois issues : continuer, mettre en pause, abandonner', async () => {
    await quitter();

    expect(boutonsAlerte.map((b) => b.text)).toEqual([
      'workout.leave.continue',
      'workout.leave.pause',
      'workout.leave.abandon',
    ]);
  });

  it('🔴 « mettre en pause » quitte SANS toucher à la séance', async () => {
    await quitter();
    await appuyerAlerte('workout.leave.pause');

    // C'est toute la différence avec l'abandon : la séance reste ouverte, on la reprend plus tard.
    expect(mockCancelWorkout).not.toHaveBeenCalled();
    expect(mockFinishWorkout).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('🔴 « abandonner » redemande confirmation avant d’annuler', async () => {
    await quitter();
    await appuyerAlerte('workout.leave.abandon');

    // Une seconde confirmation avant une action destructive et irréversible.
    expect(mockCancelWorkout).not.toHaveBeenCalled();
    expect(boutonsAlerte.map((b) => b.text)).toEqual([
      'common.cancel',
      'workout.leave.abandonConfirm',
    ]);
  });

  it('abandon confirmé → annule la séance puis quitte', async () => {
    await quitter();
    await appuyerAlerte('workout.leave.abandon');
    await appuyerAlerte('workout.leave.abandonConfirm');

    expect(mockCancelWorkout).toHaveBeenCalledWith('w-1');
    expect(replace).toHaveBeenCalledWith('/(tabs)');
  });
});

// ---------------------------------------------------------------------------
// Validation d'une série — repos et bascule superset
// ---------------------------------------------------------------------------

describe('validation d’une série', () => {
  it('marque la série validée et déclenche le repos', async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });

    expect(mockUpdateSet).toHaveBeenCalledWith('s1', expect.objectContaining({ done: true }));
    expect(screen.getByTestId('repos')).toBeTruthy();
  });

  it('une série à la durée enregistre la durée et efface les reps', async () => {
    mockUseActiveWorkout.mockReturnValue({
      workout: seance({
        entries: [
          {
            exerciseId: 'planche',
            exerciseName: 'Planche',
            sets: [serie('s1', 'planche', false, 'duration')],
          },
        ],
      }),
      isLoading: false,
    });

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });

    // Laisser des reps sur une série chronométrée les ferait remonter dans le volume de séance.
    expect(mockUpdateSet).toHaveBeenCalledWith('s1', expect.objectContaining({ reps: null }));
  });

  it('🔴 en superset, bascule sur le partenaire SANS repos', async () => {
    mockUseActiveWorkout.mockReturnValue({
      workout: seance({
        entries: [
          { exerciseId: 'squat', exerciseName: 'Squat', sets: [serie('s1', 'squat', false)] },
          { exerciseId: 'rowing', exerciseName: 'Rowing', sets: [serie('r1', 'rowing', false)] },
        ],
      }),
      isLoading: false,
    });
    mockUseSupersetPairs.mockReturnValue({ squat: 'rowing', rowing: 'squat' });

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });

    // Un superset s'enchaîne sans pause : déclencher le repos ici en casserait tout le principe.
    expect(screen.queryByTestId('repos')).toBeNull();
    expect(screen.getByText('Rowing')).toBeTruthy();
  });

  it('en superset, la 2ᵉ série du couple déclenche bien le repos', async () => {
    mockUseActiveWorkout.mockReturnValue({
      workout: seance({
        entries: [
          { exerciseId: 'squat', exerciseName: 'Squat', sets: [serie('s1', 'squat', false)] },
          { exerciseId: 'rowing', exerciseName: 'Rowing', sets: [serie('r1', 'rowing', true)] },
        ],
      }),
      isLoading: false,
    });
    mockUseSupersetPairs.mockReturnValue({ squat: 'rowing', rowing: 'squat' });

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });

    // Le partenaire est déjà validé : le couple est bouclé, le repos est dû.
    expect(screen.getByTestId('repos')).toBeTruthy();
  });

  it('partenaire ayant quitté la séance → repos normal, pas de plantage', async () => {
    mockUseSupersetPairs.mockReturnValue({ squat: 'exercice-retire' });

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });

    // Dégradation silencieuse assumée (spec §2.2).
    expect(screen.getByTestId('repos')).toBeTruthy();
  });
});
