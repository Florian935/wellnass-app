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
import { useSessionMode } from '@/stores/session-mode-store';

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
  upsertProfile: jest.fn(),
  useProfile: jest.fn(() => ({ profile: null, isLoading: false })),
}));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  usePriorWeekAdherence: jest.fn(() => null),
}));

/**
 * Sonde de la carte de série : n'expose que le bouton de validation. C'est le seul geste que
 * l'écran orchestre lui-même (repos, bascule superset), le reste de la carte est testé chez elle.
 */
// ── Sondes adaptées à la recomposition de l'US MUSCU-UX01 ────────────────────────────────────
// La carte ne porte plus que le **contexte** ; la saisie et la validation sont passées dans
// `SetActionBar`, fixée en bas de l'écran. Le bouton `valider` est donc sur la barre, et la carte
// n'expose plus qu'un nom d'exercice.
jest.mock('@/components/workout/CurrentSetCard', () => {
  const { Text: T } = require('react-native');
  return {
    CurrentSetCard: (props: { exerciseName: string }) => <T>{props.exerciseName}</T>,
  };
});
jest.mock('@/components/workout/SetActionBar', () => {
  const { Pressable: P, Text: T } = require('react-native');
  return {
    SetActionBar: (props: { exerciseName: string; currentIndex: number; onValidate: () => void }) => (
      <P testID="valider" onPress={props.onValidate}>
        <T>{`barre-${props.exerciseName}-${props.currentIndex}`}</T>
      </P>
    ),
  };
});
// Sonde du menu : la clôture y vit désormais, puisque la barre du bas ne devient « Terminer »
// qu'une fois **toutes** les séries validées. Écourter une séance passe donc par ici.
//
// MUSCU-FIX02 : la sonde compte ses montages et expose le changement de mode — c'est ce qui prouve
// qu'une bascule immersif ↔ classique ne démonte plus le menu ouvert.
const mockMenuMounts = { count: 0 };
jest.mock('@/components/workout/SessionMenuSheet', () => {
  const { useEffect } = require('react');
  const { Pressable: P, Text: T, View: V } = require('react-native');
  return {
    SessionMenuSheet: (props: {
      visible: boolean;
      onFinish: () => void;
      onChangeMode?: (mode: 'classic' | 'immersive') => void;
    }) => {
      useEffect(() => {
        mockMenuMounts.count += 1;
      }, []);
      return (
        <V>
          <P testID="menu-terminer" onPress={props.onFinish}>
            <T>menu-terminer</T>
          </P>
          <P testID="menu-classique" onPress={() => props.onChangeMode?.('classic')}>
            <T>{props.visible ? 'menu-ouvert' : 'menu-ferme'}</T>
          </P>
        </V>
      );
    },
  };
});
jest.mock('@/components/workout/ExerciseList', () => ({ ExerciseList: () => null }));
jest.mock('@/components/workout/SupersetPickerModal', () => ({ SupersetPickerModal: () => null }));
// Sonde du rendu immersif (US MUSCU-UX03). Ce fichier teste le **mode classique**, qui reste le
// défaut ; la sonde sert surtout à couper l'arbre d'imports du mode immersif, dont `SetOptions`
// tire l'i18n réel — incompatible avec le `react-i18next` mocké plus bas.
jest.mock('@/components/workout/immersive/ImmersiveWorkout', () => {
  const { Pressable: P, Text: T } = require('react-native');
  return {
    ImmersiveWorkout: (props: { runtime: { onOpenMenu: () => void; closing: boolean } }) => (
      <P testID="immersif" onPress={props.runtime.onOpenMenu}>
        <T>{props.runtime.closing ? 'immersif-ceremonie' : 'immersif'}</T>
      </P>
    ),
  };
});
// Sonde de repos : sa simple présence prouve que le décompte est parti.
jest.mock('@/components/workout/RestOverlay', () => {
  const { Text: T } = require('react-native');
  return { RestOverlay: () => <T testID="repos">repos</T> };
});

jest.mock('@/lib/haptics', () => ({
  hapticConfirm: jest.fn(),
  hapticMilestone: jest.fn(),
  hapticSelect: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  // `plan=1` n'est passé que par le brief du mode immersif (US MUSCU-UX03) : ici, jamais.
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    // `i18n.language` sert au nom du jour de référence et à l'heure de fin de repos (MUSCU-UX03).
    i18n: { language: 'fr' },
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
  mockMenuMounts.count = 0;
  // Le mode est une préférence d'appareil (store) : chaque test repart du classique, le défaut.
  useSessionMode.setState({ mode: 'classic' });
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

  it('🔴 pendant le chargement, ne prétend PAS qu’il n’y a aucune séance', async () => {
    // Le défaut du 19/09/2026 : l'écran ne lisait que `workout`, jamais `isLoading`. Entre le
    // `push('/workout')` et la résolution de la requête PowerSync, `workout` vaut `null` — et
    // l'écran annonçait « Aucune séance en cours » avec un bouton de retour, sur la séance qu'on
    // venait tout juste de créer. C'est l'« écran noir » remonté en recette.
    mockUseActiveWorkout.mockReturnValue({ workout: null, isLoading: true });

    await render(<WorkoutScreen />);

    expect(screen.queryByText('workout.none')).toBeNull();
    expect(screen.getByTestId('workout-loading')).toBeTruthy();
  });

  it('🔴 séance vide : l’ajout d’un exercice est VISIBLE, pas seulement dans le menu', async () => {
    // Une séance libre démarre TOUJOURS à zéro exercice. La barre d'action n'avait que deux
    // branches (série en cours / clôture) : à zéro exercice elle rendait `null`, et le seul
    // « + Ajouter un exercice » vivait derrière les trois points. L'écran d'arrivée de la séance
    // libre était donc un cul-de-sac.
    mockUseActiveWorkout.mockReturnValue({ workout: seance({ entries: [] }), isLoading: false });

    await render(<WorkoutScreen />);

    const ajout = screen.getByTestId('workout-add-exercise');
    await act(async () => {
      fireEvent.press(ajout);
    });

    expect(push).toHaveBeenCalledWith('/exercises');
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
      fireEvent.press(screen.getByTestId('menu-terminer'));
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
    const bouton = screen.getByTestId('menu-terminer');
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
      fireEvent.press(screen.getByTestId('menu-terminer'));
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
      fireEvent.press(screen.getByTestId('menu-terminer'));
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
      fireEvent.press(screen.getByTestId('menu-terminer'));
    });

    // Une séance ouverte par erreur et clôturée d'un geste polluerait l'historique et le streak.
    expect(mockFinishWorkout).not.toHaveBeenCalled();
    expect(boutonsAlerte.map((b) => b.text)).toEqual(['common.cancel', 'workout.finishAnyway']);
  });

  it('confirmer clôture quand même', async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-terminer'));
    });
    await appuyerAlerte('workout.finishAnyway');

    expect(mockFinishWorkout).toHaveBeenCalledWith('w-1');
    expect(replace).toHaveBeenCalled();
  });

  it('annuler ne clôture rien et ne navigue pas', async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-terminer'));
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
  // ── Réécrit le 10/09/2026 (US MUSCU-UX01) ────────────────────────────────────────────────────
  // L'écran posait un dialogue à trois issues : « Continuer / Mettre en pause / Abandonner ».
  // « Mettre en pause » nommait un état **qui n'existe pas** : MUSC-F6 pose que la séance reste
  // `active` en base, sans état de pause distinct, et reprenable jusqu'à la clôture automatique à
  // 3 h. Le dialogue faisait donc confirmer une sortie qui ne coûte rien, avec un mot faux.
  //
  // La croix quitte maintenant directement, et l'abandon — la seule action destructive — vit dans
  // le menu, derrière sa propre confirmation.

  it('🔴 la croix quitte sans rien demander, et sans toucher à la séance', async () => {
    await render(<WorkoutScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('workout.leave.later'));
    });

    // Rien à perdre, donc rien à confirmer : la séance reste ouverte et reprenable.
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockCancelWorkout).not.toHaveBeenCalled();
    expect(mockFinishWorkout).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/(tabs)/strength');
  });

  it('🔴 quitter ramène au hub muscu, pas à l’accueil', async () => {
    // La séance reprenable s'y affiche en première carte : c'est là qu'on la retrouve.
    await render(<WorkoutScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('workout.leave.later'));
    });

    expect(replace).toHaveBeenCalledWith('/(tabs)/strength');
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

// ---------------------------------------------------------------------------
// MUSCU-FIX02 — la séance doit dérouler (recette du 23/09/2026)
// ---------------------------------------------------------------------------

describe('clôture : l’écran garde la séance jusqu’au départ', () => {
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

  /**
   * `finishWorkout` rend la séance « completed » : la requête réactive répond alors `null`. Le mock
   * reproduit exactement cela — la séance disparaît de `useActiveWorkout` dès l'écriture.
   */
  const clotureQuiEfface = () => {
    mockFinishWorkout.mockImplementation(async () => {
      mockUseActiveWorkout.mockReturnValue({ workout: null, isLoading: false });
    });
    // Le calcul des records reste en cours : on observe l'écran PENDANT la clôture.
    mockEvaluateRecords.mockReturnValue(new Promise(() => {}));
  };

  beforeEach(() => {
    mockUseActiveWorkout.mockReturnValue({ workout: seanceEntamee(), isLoading: false });
  });

  it('🔴 classique : jamais « Aucune séance en cours » pendant le calcul des records', async () => {
    clotureQuiEfface();

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-terminer'));
    });
    await screen.rerender(<WorkoutScreen />);

    expect(mockFinishWorkout).toHaveBeenCalledWith('w-1');
    expect(screen.queryByText('workout.none')).toBeNull();
    expect(screen.getByText('Squat')).toBeTruthy();
  });

  it('🔴 immersif : « Terminer » depuis le MENU lance la cérémonie, qui reste jusqu’au bilan', async () => {
    // Deux défauts cumulés : seul le bouton du pont lançait la cérémonie — depuis le menu ⋮, la
    // séance était close sans cérémonie ni navigation ; et la séance close, l'écran remplaçait tout
    // par « Aucune séance en cours » avant que la cérémonie ait pu mener au bilan.
    useSessionMode.setState({ mode: 'immersive' });
    clotureQuiEfface();

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-terminer'));
    });
    await screen.rerender(<WorkoutScreen />);

    expect(mockFinishWorkout).toHaveBeenCalledWith('w-1');
    expect(screen.queryByText('workout.none')).toBeNull();
    expect(screen.getByText('immersif-ceremonie')).toBeTruthy();
    // En immersif, c'est la cérémonie qui navigue — pas la clôture.
    expect(replace).not.toHaveBeenCalled();
  });

  it('si la clôture échoue, la séance continue normalement — sans promesse rejetée orpheline', async () => {
    mockFinishWorkout.mockRejectedValue(new Error('base verrouillée'));
    const avertissement = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-terminer'));
    });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('barre-Squat-2')).toBeTruthy();
    expect(avertissement).toHaveBeenCalled();
  });
});

describe('clôture : ce qui s’arrête avec la séance', () => {
  it('le repos en cours s’arrête, et plus aucune série n’est acceptée pendant la clôture', async () => {
    // Le repos continuait sous la cérémonie et vibrait à zéro ; et la barre de saisie, encore
    // visible en classique pendant le calcul des records, validait une série d'une séance close.
    mockEvaluateRecords.mockReturnValue(new Promise(() => {}));

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });
    expect(screen.getByTestId('repos')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-terminer'));
    });
    expect(screen.queryByTestId('repos')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
  });
});

describe('validation : l’écran n’attend pas la base', () => {
  it('🔴 la série suivante est prête AVANT que la base ait relu la validation', async () => {
    // Le mock ne change pas : c'est la base qui n'a pas encore répondu.
    await render(<WorkoutScreen />);
    expect(screen.getByText('barre-Squat-1')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });

    expect(screen.getByText('barre-Squat-2')).toBeTruthy();
  });

  it('🔴 deux validations successives valident deux séries, pas deux fois la même', async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });

    expect(mockUpdateSet.mock.calls.map(([id]) => id)).toEqual(['s1', 's2']);
  });

  it('🔴 deux appuis dans le MÊME cycle de rendu ne valident la série qu’une fois', async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
      fireEvent.press(screen.getByTestId('valider'));
    });

    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith('s1', expect.objectContaining({ done: true }));
  });

  it('une fois la base à jour, c’est elle qui fait foi', async () => {
    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });
    // La base relit la validation.
    mockUseActiveWorkout.mockReturnValue({
      workout: seance({
        entries: [
          {
            exerciseId: 'squat',
            exerciseName: 'Squat',
            sets: [serie('s1', 'squat', true), serie('s2', 'squat', false)],
          },
        ],
      }),
      isLoading: false,
    });
    await screen.rerender(<WorkoutScreen />);

    expect(screen.getByText('barre-Squat-2')).toBeTruthy();
  });
});

describe('bascule de mode en pleine séance', () => {
  it('🔴 immersif → classique : le menu n’est pas remonté, il se referme', async () => {
    // Le défaut : le menu vivait DANS chaque rendu. Changer de mode depuis le menu remplaçait tout
    // l'arbre, modale ouverte comprise — démontée et remontée dans le même rendu, et restée ouverte
    // par-dessus le nouveau mode.
    useSessionMode.setState({ mode: 'immersive' });

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('immersif'));
    });
    expect(screen.getByText('menu-ouvert')).toBeTruthy();
    const montagesAvant = mockMenuMounts.count;

    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-classique'));
    });

    expect(useSessionMode.getState().mode).toBe('classic');
    expect(screen.queryByTestId('immersif')).toBeNull();
    expect(screen.getByText('barre-Squat-1')).toBeTruthy();
    expect(mockMenuMounts.count).toBe(montagesAvant);
    expect(screen.getByText('menu-ferme')).toBeTruthy();
  });

  it('rien n’est perdu à la bascule : la série validée reste validée', async () => {
    useSessionMode.setState({ mode: 'immersive' });
    await render(<WorkoutScreen />);
    // Retour en classique pour valider depuis la barre, puis aller-retour.
    await act(async () => {
      useSessionMode.setState({ mode: 'classic' });
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('valider'));
    });
    await act(async () => {
      useSessionMode.setState({ mode: 'immersive' });
    });
    await act(async () => {
      useSessionMode.setState({ mode: 'classic' });
    });

    expect(screen.getByText('barre-Squat-2')).toBeTruthy();
  });
});

describe('clôture en immersif sans série validée', () => {
  it('pas de cérémonie : rien à fêter, on part au bilan', async () => {
    useSessionMode.setState({ mode: 'immersive' });

    await render(<WorkoutScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-terminer'));
    });
    await appuyerAlerte('workout.finishAnyway');

    expect(screen.queryByText('immersif-ceremonie')).toBeNull();
    expect(replace).toHaveBeenCalledWith({ pathname: '/workout-summary', params: { id: 'w-1' } });
  });
});
