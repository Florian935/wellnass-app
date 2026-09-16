import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type {
  BodyTrainingDocument,
  Equipment,
  StrengthProgramContext,
} from '@wellness/shared';

import i18n from '@/i18n';
import {
  saveStrengthProgramContext,
  useStrengthProgramContext,
} from '@/data/repositories/strength-program-context-repository';
import { useStrengthProgramCandidates } from '@/data/repositories/strength-program-recommendation-repository';
import { prepareCompatibleStrengthProgram } from '@/data/repositories/program-repository';
import { useBodyTraining } from '@/data/repositories/body-training-repository';
import { useAuthStore } from '@/stores/auth-store';
import BodyTrainingProgramsScreen from '../body-training-programs';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
}));
jest.mock('@/data/repositories/body-training-repository', () => ({
  useBodyTraining: jest.fn(),
}));
jest.mock('@/data/repositories/strength-program-context-repository', () => ({
  useStrengthProgramContext: jest.fn(),
  saveStrengthProgramContext: jest.fn(),
}));
jest.mock('@/data/repositories/strength-program-recommendation-repository', () => ({
  useStrengthProgramCandidates: jest.fn(),
}));
jest.mock('@/data/repositories/program-repository', () => ({
  prepareCompatibleStrengthProgram: jest.fn(),
}));

const useTraining = useBodyTraining as jest.MockedFunction<typeof useBodyTraining>;
const useContext = useStrengthProgramContext as jest.MockedFunction<
  typeof useStrengthProgramContext
>;
const saveContext = saveStrengthProgramContext as jest.MockedFunction<
  typeof saveStrengthProgramContext
>;
const useCandidates = useStrengthProgramCandidates as jest.MockedFunction<
  typeof useStrengthProgramCandidates
>;
const prepare = prepareCompatibleStrengthProgram as jest.MockedFunction<
  typeof prepareCompatibleStrengthProgram
>;

const confirmedPriorities: BodyTrainingDocument = {
  version: 1,
  priorities: ['arms', 'shoulders'],
  sourceGoal: {
    baseline: {
      base: 'balanced',
      proportions: {
        shoulders: 0,
        chest: 0,
        waist: 0,
        hips: 0,
        arms: 0,
        thighs: 0,
        calves: 0,
      },
    },
    baselineSavedAt: '2026-09-15T07:55:00.000Z',
    emphasis: {
      shoulders: 2,
      chest: 0,
      back: 0,
      arms: 2,
      glutes: 0,
      thighs: 0,
      calves: 0,
    },
    savedAt: '2026-09-15T08:00:00.000Z',
  },
  confirmedAt: '2026-09-15T08:05:00.000Z',
};

const savedContext: StrengthProgramContext = {
  level: 'intermediate',
  weeklyAvailability: 3,
  sessionMinutes: 45,
  equipment: ['dumbbell', 'band'],
};

type Candidate = ReturnType<typeof useStrengthProgramCandidates>['candidates'][number];

function candidate({
  id,
  name,
  current = false,
  level = 'intermediate',
  sessions = 2,
  equipment = 'dumbbell',
  musclesFine = ['biceps'],
  musclePrimary = 'arms',
  sets = 3,
  fingerprint = `fingerprint-${id}`,
}: {
  id: string;
  name: string;
  current?: boolean;
  level?: 'beginner' | 'intermediate' | 'advanced' | null;
  sessions?: number;
  equipment?: Equipment | null;
  musclesFine?: Candidate['program']['sessions'][number]['plans'][number]['musclesFine'];
  musclePrimary?: Candidate['program']['sessions'][number]['plans'][number]['musclePrimary'];
  sets?: number | null;
  fingerprint?: string;
}): Candidate {
  return {
    program: {
      id,
      name,
      ownerId: current ? 'user-1' : null,
      level,
      sessions: Array.from({ length: sessions }, (_, index) => ({
        id: `${id}-session-${index}`,
        name: `Séance ${index + 1}`,
        plans: [
          {
            id: `${id}-plan-${index}`,
            exerciseId: `${id}-exercise-${index}`,
            exerciseName: 'Curl',
            setType: 'normal',
            targetSets: sets,
            musclePrimary,
            musclesSecondary: [],
            musclesFine,
            restSeconds: 60,
            equipment,
          },
        ],
      })),
    },
    isCurrent: current,
    fingerprint,
    sourceSnapshot: {} as Candidate['sourceSnapshot'],
  };
}

const bodyState = (document: BodyTrainingDocument | null = confirmedPriorities) => ({
  document,
  raw: document ? JSON.stringify(document) : null,
  status: document ? ('ready' as const) : ('empty' as const),
  isLoading: false,
  error: null,
});

const contextState = (context: StrengthProgramContext | null = savedContext) => ({
  context,
  updatedAt: context ? '2026-09-15T08:10:00.000Z' : null,
  isLoading: false,
  error: null,
});

function setCandidates(candidates: Candidate[], error: Error | null = null) {
  useCandidates.mockReturnValue({ candidates, isLoading: false, error });
}

const tap = async (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => {
    useAuthStore.setState({ session: { user: { id: 'user-1' } } as never });
  });
  await i18n.changeLanguage('fr');
  useTraining.mockReturnValue(bodyState());
  useContext.mockReturnValue(contextState());
  setCandidates([
    candidate({ id: 'current', name: 'Mon programme', current: true }),
    candidate({ id: 'editorial', name: 'Bras et épaules' }),
  ]);
  let saveNumber = 0;
  saveContext.mockImplementation(async (context) => {
    saveNumber += 1;
    return {
      context,
      updatedAt: `2026-09-15T08:${10 + saveNumber}:00.000Z`,
    };
  });
  prepare.mockResolvedValue('copy-1');
});

afterEach(async () => {
  await act(async () => {
    useAuthStore.setState({ session: null });
  });
  jest.restoreAllMocks();
});

it('renvoie explicitement aux priorités lorsqu’elles sont absentes ou illisibles', async () => {
  useTraining.mockReturnValue(bodyState(null));
  await render(<BodyTrainingProgramsScreen />);

  expect(screen.getByText('Confirme d’abord tes priorités d’entraînement.')).toBeTruthy();
  await tap('Choisir mes priorités');
  expect(mockPush).toHaveBeenCalledWith('/body-training');
  expect(screen.queryByRole('button', { name: 'Comparer les programmes' })).toBeNull();
});

it('présente niveau et disponibilité en lecture seule sans inventer les valeurs absentes', async () => {
  useContext.mockReturnValue(
    contextState({ ...savedContext, level: null, weeklyAvailability: null }),
  );
  await render(<BodyTrainingProgramsScreen />);

  expect(screen.getAllByText('À confirmer')).toHaveLength(2);
  await tap('Modifier mon profil musculation');
  expect(mockPush).toHaveBeenCalledWith('/strength-profile');
  expect(screen.queryByRole('radio', { name: /Je débute/ })).toBeNull();
});

it('mémorise le premier contexte chargé puis garde le brouillon pendant une lecture vide en erreur', async () => {
  useContext.mockReturnValue({ ...contextState(null), isLoading: true });
  const view = await render(<BodyTrainingProgramsScreen />);
  expect(screen.getByLabelText('Chargement des programmes compatibles')).toBeTruthy();

  useContext.mockReturnValue(contextState());
  await view.rerender(<BodyTrainingProgramsScreen />);
  await fireEvent.press(screen.getByRole('radio', { name: '60 minutes maximum' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Barre' }));

  useContext.mockReturnValue({
    ...contextState(null),
    error: new Error('offline'),
  });
  await view.rerender(<BodyTrainingProgramsScreen />);
  expect(screen.getByRole('radio', { name: '60 minutes maximum' }).props.accessibilityState)
    .toMatchObject({ selected: true });
  expect(screen.getByRole('checkbox', { name: 'Barre' }).props.accessibilityState)
    .toMatchObject({ checked: true });
  expect(screen.queryByText('Ton profil musculation est indisponible.')).toBeNull();
});

it('garde le brouillon durée/matériel après un conflit CAS', async () => {
  const view = await render(<BodyTrainingProgramsScreen />);
  await fireEvent.press(screen.getByRole('radio', { name: '60 minutes maximum' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Barre' }));
  useContext.mockReturnValue(contextState());
  saveContext.mockRejectedValue(Object.assign(new Error('conflict'), { code: 'conflict' }));
  await view.rerender(<BodyTrainingProgramsScreen />);
  await tap('Enregistrer mon contexte');

  expect(screen.getByText(/Le profil a changé\. Ton brouillon est conservé/)).toBeTruthy();
  expect(screen.getByRole('radio', { name: '60 minutes maximum' }).props.accessibilityState)
    .toMatchObject({ selected: true });
  expect(screen.getByRole('checkbox', { name: 'Barre' }).props.accessibilityState)
    .toMatchObject({ checked: true });
});

it('utilise null pour Tout le matériel et revient à null après le dernier retrait', async () => {
  useContext.mockReturnValue(contextState({ ...savedContext, equipment: null }));
  await render(<BodyTrainingProgramsScreen />);

  expect(screen.getByRole('checkbox', { name: 'Tout le matériel' }).props.accessibilityState)
    .toMatchObject({ checked: true });
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Barre' }));
  await tap('Enregistrer mon contexte');
  expect(saveContext).toHaveBeenLastCalledWith(
    { ...savedContext, equipment: ['barbell'] },
    '2026-09-15T08:10:00.000Z',
  );

  useContext.mockReturnValue({
    context: { ...savedContext, equipment: ['barbell'] },
    updatedAt: '2026-09-15T08:11:00.000Z',
    isLoading: false,
    error: null,
  });
  await screen.rerender(<BodyTrainingProgramsScreen />);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Barre' }));
  await tap('Enregistrer mon contexte');
  expect(saveContext).toHaveBeenLastCalledWith(
    { ...savedContext, equipment: null },
    '2026-09-15T08:11:00.000Z',
  );
});

it('sépare la sauvegarde de la comparaison puis affiche au plus trois cartes explicables', async () => {
  setCandidates([
    candidate({ id: 'z', name: 'Zeta' }),
    candidate({ id: 'a', name: 'Alpha' }),
    candidate({ id: 'b', name: 'Bêta' }),
    candidate({ id: 'c', name: 'Gamma' }),
  ]);
  await render(<BodyTrainingProgramsScreen />);

  await fireEvent.press(screen.getByRole('radio', { name: '60 minutes maximum' }));
  expect(screen.getByText('Enregistre ton contexte avant de comparer.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Comparer les programmes' }).props.accessibilityState)
    .toMatchObject({ disabled: true });
  expect(saveContext).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('radio', { name: '45 minutes maximum' }));
  await tap('Comparer les programmes');
  expect(saveContext).not.toHaveBeenCalled();
  expect(screen.getAllByLabelText(/Fiche programme/)).toHaveLength(3);
  expect(screen.getAllByText('Correspond à ton niveau').length).toBeGreaterThan(0);
  expect(screen.queryByText(/score/i)).toBeNull();
  expect(screen.queryByText('Zeta')).toBeNull();
});

it('nomme honnêtement durée inconnue et couverture générale sans action éditoriale incompatible', async () => {
  setCandidates([
    candidate({
      id: 'general',
      name: 'Programme général',
      equipment: 'machine',
      musclesFine: [],
      musclePrimary: 'arms',
      sets: null,
      sessions: 1,
    }),
  ]);
  await render(<BodyTrainingProgramsScreen />);
  await tap('Comparer les programmes');

  expect(screen.getByText(/Non vérifiable avec les données du programme/)).toBeTruthy();
  expect(screen.getByText('Association générale seulement : Bras')).toBeTruthy();
  expect(screen.getByText('Matériel non disponible dans ton contexte')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Préparer ce programme' })).toBeNull();
});

it('ouvre le programme actuel dans son éditeur même s’il a des contraintes à revoir', async () => {
  setCandidates([
    candidate({ id: 'current', name: 'Mon programme', current: true, sessions: 5 }),
  ]);
  await render(<BodyTrainingProgramsScreen />);
  await tap('Comparer les programmes');
  await tap('Ajuster mon programme actuel');

  expect(mockPush).toHaveBeenCalledWith('/programs/edit?id=current');
  expect(prepare).not.toHaveBeenCalled();
});

it('acquiert le verrou avant l’Alert, le libère sur annulation/dismiss et consomme la confirmation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  prepare.mockResolvedValue('copy-42');
  await render(<BodyTrainingProgramsScreen />);
  await tap('Comparer les programmes');
  const button = screen.getByRole('button', { name: 'Préparer ce programme' });
  await fireEvent.press(button);
  await fireEvent.press(button);

  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenLastCalledWith(
    'Préparer ce programme ?',
    expect.stringContaining('original reste intact'),
    expect.any(Array),
    expect.objectContaining({ onDismiss: expect.any(Function) }),
  );

  alert.mock.calls[0]![2]![0]!.onPress!();
  await Promise.resolve();
  await fireEvent.press(button);
  expect(alert).toHaveBeenCalledTimes(2);

  alert.mock.calls[1]![3]!.onDismiss!();
  await Promise.resolve();
  await fireEvent.press(button);
  expect(alert).toHaveBeenCalledTimes(3);

  const confirm = alert.mock.calls[2]![2]![1]!.onPress!;
  await act(async () => {
    const confirmed = confirm() as unknown as Promise<void>;
    confirm();
    await confirmed;
  });
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith('editorial', 'fingerprint-editorial');

  expect(mockPush).toHaveBeenCalledWith('/programs/edit?id=copy-42');
  await act(async () => {
    await (confirm() as unknown as Promise<void>);
  });
  expect(prepare).toHaveBeenCalledTimes(1);
});

it('ouvre la copie réussie du même compte même si les entrées réactives changent pendant la préparation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let resolveCopy!: (id: string) => void;
  let confirmation!: Promise<void>;
  prepare.mockImplementation(() => new Promise((resolve) => {
    resolveCopy = resolve;
  }));
  const view = await render(<BodyTrainingProgramsScreen />);
  await tap('Comparer les programmes');
  await tap('Préparer ce programme');
  const confirm = alert.mock.calls.at(-1)![2]![1]!.onPress!;

  await act(async () => {
    confirmation = confirm() as unknown as Promise<void>;
    await Promise.resolve();
  });
  expect(prepare).toHaveBeenCalledTimes(1);

  useTraining.mockReturnValue(bodyState({
    ...confirmedPriorities,
    priorities: ['back'],
    confirmedAt: '2026-09-15T09:15:00.000Z',
  }));
  useContext.mockReturnValue({
    context: { ...savedContext, sessionMinutes: 60 },
    updatedAt: '2026-09-15T09:16:00.000Z',
    isLoading: false,
    error: null,
  });
  setCandidates([
    candidate({ id: 'current', name: 'Mon programme', current: true }),
    candidate({
      id: 'editorial',
      name: 'Bras et épaules',
      fingerprint: 'fingerprint-editorial-updated',
    }),
  ]);
  await view.rerender(<BodyTrainingProgramsScreen />);

  await act(async () => {
    resolveCopy('copy-after-reactive-change');
    await confirmation;
  });

  expect(prepare).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/programs/edit?id=copy-after-reactive-change');
});

it('ne navigue pas vers la copie réussie si le compte change pendant la préparation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let resolveCopy!: (id: string) => void;
  let confirmation!: Promise<void>;
  prepare.mockImplementation(() => new Promise((resolve) => {
    resolveCopy = resolve;
  }));
  await render(<BodyTrainingProgramsScreen />);
  await tap('Comparer les programmes');
  await tap('Préparer ce programme');
  const confirm = alert.mock.calls.at(-1)![2]![1]!.onPress!;

  await act(async () => {
    confirmation = confirm() as unknown as Promise<void>;
    await Promise.resolve();
  });
  expect(prepare).toHaveBeenCalledTimes(1);

  await act(async () => {
    useAuthStore.setState({ session: { user: { id: 'user-2' } } as never });
  });
  await act(async () => {
    resolveCopy('copy-for-user-1');
    await confirmation;
  });

  expect(prepare).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
});

it('refuse une ancienne confirmation si le compte change avant tout flush React', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<BodyTrainingProgramsScreen />);
  await tap('Comparer les programmes');
  await tap('Préparer ce programme');
  const confirm = alert.mock.calls.at(-1)![2]![1]!.onPress!;

  await act(async () => {
    useAuthStore.setState({ session: { user: { id: 'user-2' } } as never });
    await (confirm() as unknown as Promise<void>);
  });

  expect(prepare).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it('remonte un orchestrateur vierge quand le compte change', async () => {
  const view = await render(<BodyTrainingProgramsScreen />);
  await fireEvent.press(screen.getByRole('radio', { name: '60 minutes maximum' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Barre' }));

  useContext.mockReturnValue(contextState({
    ...savedContext,
    sessionMinutes: 30,
    equipment: null,
  }));
  await act(async () => {
    useAuthStore.setState({ session: { user: { id: 'user-2' } } as never });
  });
  await view.rerender(<BodyTrainingProgramsScreen />);

  expect(screen.getByRole('radio', { name: '30 minutes maximum' }).props.accessibilityState)
    .toMatchObject({ selected: true });
  expect(screen.getByRole('radio', { name: '60 minutes maximum' }).props.accessibilityState)
    .toMatchObject({ selected: false });
  expect(screen.getByRole('checkbox', { name: 'Tout le matériel' }).props.accessibilityState)
    .toMatchObject({ checked: true });
  expect(screen.getByRole('checkbox', { name: 'Barre' }).props.accessibilityState)
    .toMatchObject({ checked: false });
});

it.each(['priorités', 'contexte', 'source'])(
  'demande un recalcul si le snapshot %s a changé avant une action',
  async (changed) => {
  const current = candidate({ id: 'current', name: 'Mon programme', current: true });
  setCandidates([current]);
  const view = await render(<BodyTrainingProgramsScreen />);
  await tap('Comparer les programmes');

  if (changed === 'priorités') {
    useTraining.mockReturnValue(bodyState({
      ...confirmedPriorities,
      priorities: ['back'],
      confirmedAt: '2026-09-15T09:00:00.000Z',
    }));
  } else if (changed === 'contexte') {
    useContext.mockReturnValue({ ...contextState(), updatedAt: '2026-09-15T09:00:01.000Z' });
  } else if (changed === 'source') {
    setCandidates([{ ...current, fingerprint: 'fingerprint-current-new' }]);
  }
  await view.rerender(<BodyTrainingProgramsScreen />);
  await tap('Ajuster mon programme actuel');

  expect(screen.getAllByText(/Recalcule les propositions/).length).toBeGreaterThan(0);
  expect(mockPush).not.toHaveBeenCalled();
  },
);

it('distingue chargement initial, bibliothèque vide, programme actuel seul et erreur de lecture', async () => {
  useTraining.mockReturnValue({ ...bodyState(), isLoading: true });
  const view = await render(<BodyTrainingProgramsScreen />);
  expect(screen.getByLabelText('Chargement des programmes compatibles')).toBeTruthy();

  useTraining.mockReturnValue(bodyState());
  setCandidates([]);
  await view.rerender(<BodyTrainingProgramsScreen />);
  expect(screen.getByText('La bibliothèque de programmes est vide.')).toBeTruthy();

  setCandidates([candidate({ id: 'current', name: 'Mon programme', current: true })]);
  await view.rerender(<BodyTrainingProgramsScreen />);
  expect(screen.getByText('Seul ton programme actuel est disponible.')).toBeTruthy();

  setCandidates([], new Error('read'));
  await view.rerender(<BodyTrainingProgramsScreen />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'La bibliothèque ne peut pas être lue pour le moment.',
  );
});

it('garde les candidats valides malgré un avertissement de lecture partielle', async () => {
  setCandidates(
    [candidate({ id: 'editorial', name: 'Bras et épaules' })],
    new Error('one malformed candidate'),
  );
  await render(<BodyTrainingProgramsScreen />);

  expect(screen.getByText(/Certains programmes n’ont pas pu être lus/)).toBeTruthy();
  await tap('Comparer les programmes');
  expect(screen.getByText('Bras et épaules')).toBeTruthy();
});
