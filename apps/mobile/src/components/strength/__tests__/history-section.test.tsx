/**
 * L'onglet Historique du hub (US MUSCU-UX07, §4.3) — monté réellement, requêtes simulées.
 *
 * Il reprend les garanties de l'ancien écran `/history` (date de FIN des séances, ouverture du
 * détail, suppression par appui long, état vide rédigé) et ajoute celles de l'US : calendrier du
 * mois et ses bornes (R5), jour à une ou plusieurs séances, Refaire (R4), séance libre reconnue à ses
 * exercices (D9), ligne « Reprendre » pendant une séance (D3), dernière fois par exercice (R7).
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HistorySection } from '../sections/HistorySection';
import { normalizeSearch } from '../ExerciseLastDoneList';
import {
  deleteWorkout,
  useExercisesLastDone,
  type WorkoutHistoryItem,
} from '@/data/repositories/workout-repository';

jest.mock('@/data/repositories/workout-repository', () => ({
  deleteWorkout: jest.fn(),
  useExercisesLastDone: jest.fn(() => ({ items: [], isLoading: false })),
}));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  usePlannedStrengthDays: jest.fn(() => ['2026-09-26']),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    i18n: { language: 'fr' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({ system: 'metric', weightSymbol: 'kg', formatWeight: (kg: number) => `${kg} kg` }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#e3d3ba',
      borderStrong: '#90897d',
      background: '#f7eede',
      accent: '#a8261d',
      accentText: '#ffffff',
      amber: '#b47f31',
      warn: '#f7ead6',
      warnText: '#8a6419',
      track: '#eadcc6',
    },
  }),
}));

const TODAY = '2026-09-24';

/** Une séance terminée, datée en heure LOCALE (le calendrier range en jours locaux). */
const seance = (
  id: string,
  [y, m, d, h]: [number, number, number, number],
  over: Partial<WorkoutHistoryItem> = {},
): WorkoutHistoryItem => {
  const at = new Date(y, m - 1, d, h, 0).toISOString();
  return {
    id,
    startedAt: at,
    finishedAt: at,
    durationSeconds: 3600,
    rpe: null,
    notes: null,
    sessionId: 's',
    programId: 'p',
    volumeKg: 7800,
    sessionName: id,
    exerciseCount: 5,
    recordCount: 0,
    firstExercises: [],
    ...over,
  };
};

const SEANCES = [
  seance('legs', [2026, 9, 22, 19], { recordCount: 2 }),
  seance('libre', [2026, 9, 19, 18], {
    sessionId: null,
    programId: null,
    sessionName: null,
    firstExercises: ['Curl barre', 'Curl marteau'],
  }),
  seance('pull', [2026, 9, 19, 10]),
  seance('push', [2026, 9, 17, 18]),
  seance('aout', [2026, 8, 29, 10]),
];

const onOpenWorkout = jest.fn();
const onRedo = jest.fn();
const onOpenExercise = jest.fn();
const onResume = jest.fn();

const afficher = async (workouts = SEANCES, resumeName: string | null = null) => {
  await render(
    <HistorySection
      workouts={workouts}
      todayKey={TODAY}
      resumeName={resumeName}
      onResume={onResume}
      onOpenWorkout={onOpenWorkout}
      onRedo={onRedo}
      onOpenExercise={onOpenExercise}
    />,
  );
};

const taper = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('le calendrier du mois — R5, R6', () => {
  it('ouvre sur le mois courant, et en fait le résumé', async () => {
    await afficher();

    expect(screen.getByText(/history\.calendar\.workouts:\{"count":4\}/)).toBeTruthy();
    expect(screen.getByText('history.calendar.records:{"count":2}')).toBeTruthy();
  });

  it('la liste suit le mois affiché', async () => {
    await afficher();

    expect(screen.getByTestId('workout-row-legs')).toBeTruthy();
    expect(screen.queryByTestId('workout-row-aout')).toBeNull();

    await taper('calendar-prev');
    expect(screen.getByTestId('workout-row-aout')).toBeTruthy();
    expect(screen.queryByTestId('workout-row-legs')).toBeNull();
  });

  it('🔴 les flèches s’arrêtent au mois de la première séance et au mois courant', async () => {
    await afficher();

    await taper('calendar-next');
    expect(screen.getByTestId('workout-row-legs')).toBeTruthy();

    await taper('calendar-prev');
    await taper('calendar-prev');
    expect(screen.getByTestId('workout-row-aout')).toBeTruthy();
  });

  it('🔴 range une séance au jour de sa FIN, pas de son début', async () => {
    // Commencée le 21 à 23 h 50, finie le 22 à 0 h 40 : elle est du 22.
    const debut = new Date(2026, 8, 21, 23, 50).toISOString();
    const fin = new Date(2026, 8, 22, 0, 40).toISOString();
    await afficher([seance('nuit', [2026, 9, 22, 0], { startedAt: debut, finishedAt: fin })]);

    await taper('calendar-day-2026-09-22');
    expect(onOpenWorkout).toHaveBeenCalledWith('nuit');
  });

  it('un jour à une séance ouvre son détail', async () => {
    await afficher();

    await taper('calendar-day-2026-09-22');

    expect(onOpenWorkout).toHaveBeenCalledWith('legs');
  });

  it('un jour à deux séances restreint la liste, et « Tout le mois » la rétablit', async () => {
    await afficher();

    await taper('calendar-day-2026-09-19');
    expect(onOpenWorkout).not.toHaveBeenCalled();
    expect(screen.getByTestId('workout-row-pull')).toBeTruthy();
    expect(screen.getByTestId('workout-row-libre')).toBeTruthy();
    expect(screen.queryByTestId('workout-row-legs')).toBeNull();

    await taper('history-whole-month');
    expect(screen.getByTestId('workout-row-legs')).toBeTruthy();
  });

  it('un jour vide n’est pas un bouton', async () => {
    await afficher();
    expect(screen.queryByTestId('calendar-day-2026-09-20')).toBeNull();
  });

  it('🔴 un mois sans séance le dit, sans liste blanche', async () => {
    await afficher([]);
    expect(screen.getAllByText('history.calendar.empty').length).toBeGreaterThan(0);
  });
});

describe('les séances du mois', () => {
  it('🔴 une séance libre se reconnaît à ses deux premiers exercices (D9)', async () => {
    await afficher();
    expect(
      screen.getByText(/strengthHub\.redo\.freeExercises:\{"first":"Curl barre","second":"Curl marteau"\}/),
    ).toBeTruthy();
  });

  it('Refaire rejoue la bonne séance (R4)', async () => {
    await afficher();

    await taper('workout-redo-legs');

    expect(onRedo).toHaveBeenCalledWith('legs');
  });

  it('ouvre le détail au tap', async () => {
    await afficher();

    await taper('workout-row-push');

    expect(onOpenWorkout).toHaveBeenCalledWith('push');
  });

  it('un appui long supprime, après confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await afficher();

    await act(async () => {
      fireEvent(screen.getByTestId('workout-row-legs'), 'longPress');
    });
    const buttons = alert.mock.calls[0]![2] as { style?: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((b) => b.style === 'destructive')!.onPress!();
    });

    expect(deleteWorkout).toHaveBeenCalledWith('legs');
    alert.mockRestore();
  });
});

describe('pendant une séance — D3', () => {
  it('la ligne « Reprendre » est en tête', async () => {
    await afficher(SEANCES, 'Push');

    await taper('strength-resume-line');

    expect(onResume).toHaveBeenCalled();
  });

  it('rien sans séance en cours', async () => {
    await afficher();
    expect(screen.queryByTestId('strength-resume-line')).toBeNull();
  });
});

describe('par exercice — R7', () => {
  const items = [
    {
      exerciseId: 'bench',
      name: 'Développé couché',
      finishedAt: new Date(2026, 8, 17, 18).toISOString(),
      sessionName: 'Push',
      sets: [
        { setType: 'normal', weightKg: 80, reps: 8, durationSeconds: null },
        { setType: 'normal', weightKg: 80, reps: 7, durationSeconds: null },
      ],
      recordKg: 85,
      recordReps: 5,
    },
    {
      exerciseId: 'squat',
      name: 'Squat',
      finishedAt: new Date(2026, 8, 22, 19).toISOString(),
      sessionName: null,
      sets: [{ setType: 'normal', weightKg: 120, reps: 5, durationSeconds: null }],
      recordKg: null,
      recordReps: null,
    },
  ];

  it('la liste ne se charge qu’à l’ouverture de l’onglet', async () => {
    await afficher();
    expect(useExercisesLastDone).not.toHaveBeenCalled();
  });

  it('montre la dernière fois et le record, et ouvre la fiche', async () => {
    (useExercisesLastDone as jest.Mock).mockReturnValue({ items, isLoading: false });
    await afficher();

    await taper('history-tab-byExercise');

    expect(screen.getByText('80 kg × 8 · 7')).toBeTruthy();
    expect(screen.getByText(/history\.byExercise\.record:\{"value":"85 kg × 5"\}/)).toBeTruthy();
    await taper('exercise-last-bench');
    expect(onOpenExercise).toHaveBeenCalledWith('bench');
  });

  it('🔴 la recherche ignore casse et accents : « couche » trouve « Développé couché »', async () => {
    (useExercisesLastDone as jest.Mock).mockReturnValue({ items, isLoading: false });
    await afficher();
    await taper('history-tab-byExercise');

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('history-exercise-search'), 'COUCHE');
    });

    expect(screen.getByTestId('exercise-last-bench')).toBeTruthy();
    expect(screen.queryByTestId('exercise-last-squat')).toBeNull();
  });

  it('normalizeSearch', () => {
    expect(normalizeSearch('  Développé Couché ')).toBe('developpe couche');
  });
});
