/**
 * Hub musculation (`app/(tabs)/strength.tsx`) — le **vrai** écran, monté.
 *
 * ── Ce que ce fichier protège depuis le 14/08/2026 ───────────────────────────────────────────────
 * Le **seizième site du défaut de double appui** : deux appuis du même cycle de rendu créaient deux
 * séances, dont une orpheline. La garde (`useActionLock`, désormais dans `useStartTodaySession`)
 * reste vérifiée ici — c'est la raison d'être première du fichier.
 *
 * ── Réécrit le 25/09/2026 (US MUSCU-UX07) ───────────────────────────────────────────────────────
 * Le hub passe en **trois onglets** : S'entraîner, Historique, Progrès. Ce fichier vérifie ce qui est
 * propre à l'écran :
 *  - l'onglet affiché (D3) : S'entraîner à froid, le paramètre `section` lu puis effacé, la mémoire ;
 *  - la carte du moment rend l'état qu'on lui donne, avec ses gestes (§4.2-1) ;
 *  - « Voir le détail », qui ouvrait le planning, a disparu ; « Voir les N exercices » ouvre l'aperçu ;
 *  - Refaire en un geste (R4, l'alerte pendant une séance), séance libre, modèles, annuaire ;
 *  - pendant une séance, rien d'autre que Reprendre dans S'entraîner (R8) ;
 *  - la question du tout premier mode (R-MO-3) et la ligne « Changer » (D4) ;
 *  - Progrès monte les cartes d'analyse, ou un seul message sans séance.
 *
 * Les cartes d'analyse, la semaine, « la dernière fois » et la section Historique ont leurs propres
 * tests : ici, des sondes.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { HubState } from '@wellness/shared';

import StrengthScreen from '../strength';
import {
  hasActiveWorkout,
  startWorkoutFromSession,
  startWorkoutFromWorkout,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import { useStrengthHub } from '@/data/repositories/strength-hub-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSessionMode } from '@/stores/session-mode-store';
import { useStrengthSection } from '@/stores/strength-section-store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-repository', () => ({
  hasActiveWorkout: jest.fn(),
  startWorkoutFromSession: jest.fn(),
  startWorkoutFromWorkout: jest.fn(),
  useWorkoutHistory: jest.fn(() => ({ workouts: [], isLoading: false })),
}));
jest.mock('@/data/repositories/strength-hub-repository', () => ({ useStrengthHub: jest.fn() }));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null })),
  upsertProfile: jest.fn(),
}));
jest.mock('@/components/strength/SuggestedPrograms', () => {
  const { Text } = require('react-native');
  return { SuggestedPrograms: () => <Text>sonde-suggeres</Text> };
});

const sonde = (name: string, text: string) => {
  const { Text } = require('react-native');
  return { [name]: () => <Text>{text}</Text> };
};
jest.mock('@/components/strength/StrengthWeekCard', () => sonde('StrengthWeekCard', 'sonde-semaine'));
jest.mock('@/components/strength/NearRecordsCard', () => sonde('NearRecordsCard', 'sonde-portee'));
jest.mock('@/components/strength/DayThread', () => sonde('DayThread', 'sonde-fil'));
jest.mock('@/components/strength/LoadProgressCard', () => sonde('LoadProgressCard', 'sonde-charges'));
jest.mock('@/components/strength/BodyBalanceCard', () => sonde('BodyBalanceCard', 'sonde-corps'));
jest.mock('@/components/strength/RecordWall', () => sonde('RecordWall', 'sonde-mur'));
jest.mock('@/components/strength/LifetimeLine', () => sonde('LifetimeLine', 'sonde-total'));
jest.mock('@/components/strength/LastTimeList', () => ({
  LastTimeList: ({ exercises }: { exercises: { name: string }[] }) => {
    const { Text } = require('react-native');
    return <Text>sonde-derniere-fois:{exercises.map((e) => e.name).join(',')}</Text>;
  },
}));
jest.mock('@/components/strength/sections/HistorySection', () => ({
  HistorySection: ({ resumeName }: { resumeName: string | null }) => {
    const { Text } = require('react-native');
    return <Text>sonde-historique:{resumeName ?? 'aucune'}</Text>;
  },
}));

jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: () => '2026-09-24',
  useTodayDate: () => new Date(2026, 8, 24),
  useCurrentHour: () => 10,
  useWindowStartUtc: () => '2026-08-01T00:00:00.000Z',
  useWindowStartKey: () => '2026-08-01',
}));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
  useScrollToTop: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    i18n: { language: 'fr' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      background: '#f7eede',
      border: '#e3d3ba',
      borderStrong: '#90897d',
      track: '#eadcc6',
      accent: '#a8261d',
      accentText: '#ffffff',
      amber: '#b47f31',
      warn: '#f7ead6',
      warnText: '#8a6419',
      success: '#66714b',
      panel: '#33291f',
      panelText: '#f0e4d0',
      panelMuted: '#c9b79a',
      panelAccent: '#d9a888',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockHub = useStrengthHub as jest.Mock;
const mockHistory = useWorkoutHistory as jest.Mock;
const mockProfile = useProfile as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockStartFromSession = startWorkoutFromSession as jest.Mock;
const mockStartFromWorkout = startWorkoutFromWorkout as jest.Mock;
const mockHasActive = hasActiveWorkout as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();
const setParams = jest.fn();

const sessionDuJour = (over: Partial<Record<string, unknown>> = {}) => ({
  sessionId: 's-1',
  plannedSessionId: 'ps-1',
  name: 'Push',
  orderIndex: 0,
  exerciseCount: 6,
  programName: 'Push Pull Legs',
  previewExercises: ['Développé couché', 'Développé militaire', 'Dips'],
  estimatedMinutes: 55,
  ...over,
});

const seanceFaite = (over: Record<string, unknown> = {}) => ({
  id: 'w-legs',
  startedAt: '2026-09-22T17:00:00.000Z',
  finishedAt: '2026-09-22T18:04:00.000Z',
  durationSeconds: 3840,
  rpe: null,
  notes: null,
  sessionId: 's-legs',
  programId: 'p',
  volumeKg: 11400,
  sessionName: 'Legs',
  exerciseCount: 5,
  recordCount: 2,
  firstExercises: [],
  ...over,
});

const afficher = async (
  state: HubState,
  extra: { progress?: unknown; programName?: string | null } = {},
) => {
  mockHub.mockReturnValue({
    state,
    progress: extra.progress ?? null,
    programName: extra.programName ?? null,
    todayMuscles: [],
    todayExercises: [
      { exerciseId: 'bench', name: 'Développé couché', equipment: 'barbell' },
      { exerciseId: 'ohp', name: 'Développé militaire', equipment: 'barbell' },
    ],
    todayProgram: { programId: 'p', weekIndex: 2 },
    isLoading: false,
  });
  await render(<StrengthScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  // R-MO-3 : la feuille du tout premier mode a son propre bloc ; ailleurs, le choix est fait.
  useSessionMode.setState({ mode: 'classic', chosen: true, hydrated: true });
  useStrengthSection.setState({ section: null });
  mockUseRouter.mockReturnValue({ push, setParams });
  mockParams.mockReturnValue({});
  mockHistory.mockReturnValue({ workouts: [], isLoading: false });
  mockProfile.mockReturnValue({ profile: null });
  mockStartFromSession.mockResolvedValue(undefined);
  mockStartFromWorkout.mockResolvedValue('w-rejouee');
  mockHasActive.mockResolvedValue(false);
});

// ---------------------------------------------------------------------------
// Trois onglets — D3
// ---------------------------------------------------------------------------

describe('trois onglets', () => {
  it('🔴 S’entraîner s’ouvre à froid, les trois onglets sont là', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    for (const key of ['train', 'history', 'progress']) {
      expect(screen.getByTestId(`strength-tab-${key}`)).toBeTruthy();
    }
    expect(screen.getByTestId('strength-section-train')).toBeTruthy();
  });

  it('changer d’onglet change le contenu, et l’onglet est retenu', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-tab-progress'));

    expect(screen.getByTestId('strength-section-progress')).toBeTruthy();
    expect(useStrengthSection.getState().section).toBe('progress');
  });

  it('🔴 un paramètre `section` ouvre l’onglet, puis est effacé', async () => {
    mockParams.mockReturnValue({ section: 'history' });
    await afficher({ kind: 'today', session: sessionDuJour() });

    expect(screen.getByText('sonde-historique:aucune')).toBeTruthy();
    // Laissé en place, il écraserait à chaque retour le dernier onglet choisi.
    expect(setParams).toHaveBeenCalledWith({ section: undefined });
    expect(useStrengthSection.getState().section).toBe('history');
  });

  it('un paramètre inconnu est ignoré', async () => {
    mockParams.mockReturnValue({ section: 'calendrier' });
    await afficher({ kind: 'today', session: sessionDuJour() });
    expect(screen.getByTestId('strength-section-train')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// La carte du moment — §4.2-1
// ---------------------------------------------------------------------------

describe('la carte du moment', () => {
  it('reprend une séance en cours, nommée, avec son avancement', async () => {
    await afficher({ kind: 'resume', workout: { exerciseCount: 3, doneSets: 7, totalSets: 18, name: 'Push' } });

    expect(screen.getByTestId('strength-moment-resume')).toBeTruthy();
    expect(screen.getByText('Push')).toBeTruthy();
    expect(screen.getByText('stage.strength.setsProgress:{"done":7,"total":18}')).toBeTruthy();

    await taper(screen.getByTestId('strength-moment-primary'));
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('🔴 la séance du jour montre la dernière fois, et plus de « Voir le détail »', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    expect(screen.getByText('sonde-derniere-fois:Développé couché,Développé militaire')).toBeTruthy();
    // « Voir le détail » ouvrait le planning (constat b) : il a disparu.
    expect(screen.queryByText('stage.strength.secondary.today')).toBeNull();
    expect(screen.queryByTestId('strength-moment-secondary')).toBeNull();
  });

  it('« Voir les N exercices » ouvre l’aperçu, avec le programme et la semaine (R11)', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-see-all'));

    expect(push).toHaveBeenCalledWith({
      pathname: '/session-preview',
      params: { sessionId: 's-1', plannedSessionId: 'ps-1', programId: 'p', weekIndex: '2' },
    });
  });

  it('🔴 une séance du jour SANS nom retombe sur son rang, 1-indexé', async () => {
    await afficher({ kind: 'today', session: sessionDuJour({ name: null, orderIndex: 2 }) });
    expect(screen.getByText('programs.detail.sessionFallback:{"index":3}')).toBeTruthy();
  });

  it('masque la durée estimée quand elle n’est pas calculable', async () => {
    await afficher({ kind: 'today', session: sessionDuJour({ estimatedMinutes: null }) });
    expect(screen.queryByText(/strengthHub\.minutesShort/)).toBeNull();
  });

  it('un jour de repos dit la prochaine séance, et mène au planning', async () => {
    await afficher({
      kind: 'rest',
      doneToday: null,
      nextUpcoming: { scheduledDate: '2026-09-26', name: 'Pull' },
    });

    expect(screen.getByText('strengthHub.rest.title')).toBeTruthy();
    expect(screen.getByText('home.today.next:{"date":"26/09","name":"Pull"}')).toBeTruthy();
    await taper(screen.getByTestId('strength-moment-primary'));
    expect(push).toHaveBeenCalledWith('/planning');
  });

  it('séance faite aujourd’hui : le bilan, et Partager ouvre sa carte', async () => {
    mockHistory.mockReturnValue({
      workouts: [seanceFaite({ id: 'w-today', finishedAt: new Date(2026, 8, 24, 12).toISOString() })],
      isLoading: false,
    });
    await afficher({ kind: 'rest', doneToday: { name: 'Push' }, nextUpcoming: null });

    expect(screen.getByTestId('strength-moment-after')).toBeTruthy();
    await taper(screen.getByTestId('strength-moment-primary'));
    expect(push).toHaveBeenCalledWith('/workout-summary?id=w-today');
    await taper(screen.getByTestId('strength-moment-secondary'));
    expect(push).toHaveBeenCalledWith('/workout-summary?id=w-today&share=1');
  });

  it('🔴 R2 — une séance faite ce matin laisse « Démarrer » un jour de séance prévue', async () => {
    mockHistory.mockReturnValue({
      workouts: [seanceFaite({ finishedAt: new Date(2026, 8, 24, 8).toISOString() })],
      isLoading: false,
    });
    await afficher({ kind: 'today', session: sessionDuJour() });

    expect(screen.getByTestId('strength-moment-today')).toBeTruthy();
    expect(screen.queryByTestId('strength-moment-after')).toBeNull();
  });

  it('sans programme, l’action principale est de CHOISIR un programme', async () => {
    await afficher({ kind: 'onboarding' });

    await taper(screen.getByTestId('strength-moment-primary'));

    expect(push).toHaveBeenCalledWith('/programs');
    expect(screen.getByText('sonde-suggeres')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Démarrer la séance du jour — le verrou de double appui
// ---------------------------------------------------------------------------

describe('démarrer la séance du jour', () => {
  it('crée la séance en la RATTACHANT à la planification', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-moment-primary'));

    expect(mockStartFromSession).toHaveBeenCalledWith('s-1', { plannedSessionId: 'ps-1' });
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('🔴 deux appuis dans le MÊME cycle ne créent qu’UNE séance', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });
    const bouton = screen.getByTestId('strength-moment-primary');

    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });

    expect(mockStartFromSession).toHaveBeenCalledTimes(1);
  });

  it('🔴 un échec ne navigue pas, et laisse réessayer', async () => {
    mockStartFromSession.mockRejectedValueOnce(new Error('boom'));
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-moment-primary'));
    expect(push).not.toHaveBeenCalled();

    await taper(screen.getByTestId('strength-moment-primary'));
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('en immersif, le brief annonce la séance — rien n’est créé', async () => {
    useSessionMode.setState({ mode: 'immersive' });
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-moment-primary'));

    expect(mockStartFromSession).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/workout-brief' }));
  });
});

// ---------------------------------------------------------------------------
// Refaire, séance libre, modèles — §4.2-2 et §4.2-3
// ---------------------------------------------------------------------------

describe('refaire une séance', () => {
  it('🔴 les trois dernières séances sont là, sans geste', async () => {
    mockHistory.mockReturnValue({
      workouts: [
        seanceFaite({ id: 'a' }),
        seanceFaite({ id: 'b' }),
        seanceFaite({ id: 'vide', exerciseCount: 0 }),
        seanceFaite({ id: 'c' }),
        seanceFaite({ id: 'd' }),
      ],
      isLoading: false,
    });
    await afficher({ kind: 'today', session: sessionDuJour() });

    expect(screen.getByTestId('workout-redo-a')).toBeTruthy();
    expect(screen.getByTestId('workout-redo-c')).toBeTruthy();
    // Une séance sans exercice travaillé n'a rien à rejouer ; au-delà de trois, c'est l'historique.
    expect(screen.queryByTestId('workout-redo-vide')).toBeNull();
    expect(screen.queryByTestId('workout-redo-d')).toBeNull();
  });

  it('Refaire rejoue la séance puis l’ouvre', async () => {
    mockHistory.mockReturnValue({ workouts: [seanceFaite()], isLoading: false });
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('workout-redo-w-legs'));

    expect(mockStartFromWorkout).toHaveBeenCalledWith('w-legs');
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('🔴 R4 — pendant une séance, Refaire alerte et ne crée RIEN', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockHasActive.mockResolvedValue(true);
    mockHistory.mockReturnValue({ workouts: [seanceFaite()], isLoading: false });
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('workout-redo-w-legs'));

    expect(alert).toHaveBeenCalledWith('strengthHub.redo.busyTitle', 'strengthHub.redo.busyMessage', expect.any(Array));
    expect(mockStartFromWorkout).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('« Tout l’historique » ouvre l’onglet Historique', async () => {
    mockHistory.mockReturnValue({ workouts: [seanceFaite()], isLoading: false });
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-all-history'));

    expect(screen.getByText('sonde-historique:aucune')).toBeTruthy();
  });

  it('séance libre ouvre la composition ; Mes templates, la liste des modèles', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-free'));
    expect(push).toHaveBeenCalledWith({ pathname: '/exercises', params: { mode: 'compose' } });

    await taper(screen.getByTestId('strength-templates'));
    expect(push).toHaveBeenCalledWith('/templates');
  });

  it('🔴 R8 — pendant une séance, S’entraîner ne propose rien d’autre que Reprendre', async () => {
    mockHistory.mockReturnValue({ workouts: [seanceFaite()], isLoading: false });
    await afficher({ kind: 'resume', workout: { exerciseCount: 3, doneSets: 7, totalSets: 18, name: 'Push' } });

    expect(screen.queryByTestId('strength-recent')).toBeNull();
    expect(screen.queryByTestId('strength-free')).toBeNull();
  });

  it('pendant une séance, l’onglet Historique reçoit la ligne « Reprendre » (D3)', async () => {
    await afficher({ kind: 'resume', workout: { exerciseCount: 3, doneSets: 7, totalSets: 18, name: 'Push' } });

    await taper(screen.getByTestId('strength-tab-history'));

    expect(screen.getByText('sonde-historique:Push')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Le mode — R-MO-3 et D4
// ---------------------------------------------------------------------------

describe('le mode', () => {
  it('🔴 R-MO-3 — la question se pose au tout premier démarrage, puis rejoue Démarrer', async () => {
    useSessionMode.setState({ mode: 'classic', chosen: false });
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-moment-primary'));
    expect(mockStartFromSession).not.toHaveBeenCalled();
    // Le titre de la feuille, et le bouton tant qu'aucun mode n'est choisi : deux occurrences.
    expect(screen.getAllByText('workoutMode.sheetTitle').length).toBeGreaterThan(0);

    await taper(screen.getByText('workoutMode.classic'));
    await taper(screen.getByText('workoutMode.start:{"mode":"workoutMode.classic"}'));

    expect(mockStartFromSession).toHaveBeenCalledWith('s-1', { plannedSessionId: 'ps-1' });
  });

  it('D4 — « Changer » ouvre le choix, mode courant présélectionné, et le retient', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-mode-line'));
    expect(screen.getByText('workoutMode.changeCta')).toBeTruthy();
    // Pas de case « retenir » : changer depuis le hub, c'est changer LE mode.
    expect(screen.queryByText('workoutMode.remember')).toBeNull();

    await taper(screen.getByText('workoutMode.immersive'));
    await taper(screen.getByText('workoutMode.changeCta'));

    expect(useSessionMode.getState().mode).toBe('immersive');
    expect(mockStartFromSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Annuaire, programme, Progrès
// ---------------------------------------------------------------------------

describe('annuaire', () => {
  it('🔴 l’icône mène AUX TROIS destinations — templates compris', async () => {
    await afficher({ kind: 'onboarding' });

    await taper(screen.getByLabelText('strengthHub.directory'));
    await taper(screen.getByTestId('directory-templates'));
    expect(push).toHaveBeenCalledWith('/templates');
  });

  it('les exercices s’ouvrent en consultation', async () => {
    await afficher({ kind: 'onboarding' });

    await taper(screen.getByLabelText('strengthHub.directory'));
    await taper(screen.getByTestId('directory-exercises'));

    expect(push).toHaveBeenCalledWith({ pathname: '/exercises', params: { mode: 'browse' } });
  });

  it('l’icône planning ouvre le planning', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByLabelText('planning.title'));

    expect(push).toHaveBeenCalledWith('/planning');
  });
});

describe('ton programme', () => {
  it('affiche la semaine et l’avancement du programme', async () => {
    await afficher(
      { kind: 'today', session: sessionDuJour() },
      { programName: 'Push Pull Legs', progress: { week: 3, totalWeeks: 8, done: 9, total: 24, ratio: 9 / 24 } },
    );

    expect(screen.getByText('sonde-semaine')).toBeTruthy();
    expect(
      screen.getByText('strengthHub.progress.week:{"name":"Push Pull Legs","week":3,"totalWeeks":8}'),
    ).toBeTruthy();
    // La semaine du programme monte aussi dans l'en-tête de la carte du jour.
    expect(screen.getByText(/strengthHub\.moment\.week:\{"week":3,"total":8\}/)).toBeTruthy();
  });
});

describe('progrès', () => {
  it('🔴 monte les cartes d’analyse, et le lien vers toute la progression', async () => {
    mockHistory.mockReturnValue({ workouts: [seanceFaite()], isLoading: false });
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-tab-progress'));

    for (const s of ['sonde-fil', 'sonde-charges', 'sonde-portee', 'sonde-corps', 'sonde-mur', 'sonde-total']) {
      expect(screen.getByText(s)).toBeTruthy();
    }
    await taper(screen.getByTestId('strength-progress-link'));
    expect(push).toHaveBeenCalledWith('/progress');
  });

  it('sans aucune séance, un seul message — et « Commencer » ramène à S’entraîner', async () => {
    await afficher({ kind: 'onboarding' });

    await taper(screen.getByTestId('strength-tab-progress'));
    expect(screen.getByTestId('strength-progress-empty')).toBeTruthy();
    expect(screen.queryByText('sonde-charges')).toBeNull();

    await taper(screen.getByTestId('strength-progress-start'));
    expect(screen.getByTestId('strength-section-train')).toBeTruthy();
  });
});
