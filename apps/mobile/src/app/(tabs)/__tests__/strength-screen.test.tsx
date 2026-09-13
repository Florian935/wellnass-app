/**
 * Hub musculation (`app/(tabs)/strength.tsx`) — le **vrai** écran, monté.
 *
 * ── Ce que ce fichier protège ────────────────────────────────────────────────────────────────────
 * Cet écran portait **le seizième site du défaut de double appui** : `onStartToday` gardait sur
 * `if (starting) return`, un état React, qui ne garde rien. Deux appuis du même cycle de rendu
 * créaient **deux séances**, dont une orpheline que rien ne rouvrirait — l'app n'en affiche qu'une.
 * Corrigé le 14/08/2026 par `useActionLock`, test vu rouge avant. **Cette garde reste vérifiée
 * ici** : c'est la raison d'être principale du fichier.
 *
 * ── Réécrit le 10/09/2026 (US MUSCU-UX01) ────────────────────────────────────────────────────────
 * L'écran ne décide plus lui-même quelle carte afficher : la priorité des quatre états est portée
 * par `resolveHubState` (`packages/shared`), testée à part et exhaustivement. Ce fichier vérifie
 * donc ce qui reste **propre à l'écran** : qu'il rend l'état qu'on lui donne, qu'il câble les
 * bonnes actions, et qu'il ne monte pas une tuile vide dans la grille.
 *
 * La quatrième carte — **jour de repos** — n'existait pas avant cette US : rien ne s'affichait
 * entre deux séances d'un programme actif, sinon l'invitation à improviser une séance libre.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { HubState } from '@wellness/shared';

import StrengthScreen from '../strength';
import {
  startWorkout,
  startWorkoutFromSession,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import { useStrengthHub } from '@/data/repositories/strength-hub-repository';
import { useWorkoutTemplates } from '@/data/repositories/workout-template-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useRouter } from 'expo-router';
import { useSessionMode } from '@/stores/session-mode-store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-repository', () => ({
  startWorkout: jest.fn(),
  startWorkoutFromSession: jest.fn(),
  useWorkoutHistory: jest.fn(() => ({ workouts: [], isLoading: false })),
}));
jest.mock('@/data/repositories/strength-hub-repository', () => ({
  useStrengthHub: jest.fn(),
}));
jest.mock('@/data/repositories/workout-template-repository', () => ({
  useWorkoutTemplates: jest.fn(() => ({ templates: [], isLoading: false })),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null })),
}));
jest.mock('@/components/strength/SuggestedPrograms', () => ({
  SuggestedPrograms: () => null,
}));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));

/**
 * La grille a ses propres tests : ici, une sonde qui **expose le prédicat `isActive`**. C'est le
 * seul moyen de vérifier depuis l'écran qu'une tuile sans donnée est bien exclue — le défaut que
 * l'US corrige, et qui ne se voit pas autrement qu'en comptant des cases vides à l'œil.
 */
let isActiveSpy: ((id: string) => boolean) | undefined;
jest.mock('@/components/widgets/WidgetGrid', () => ({
  WidgetGrid: (props: { isActive?: (id: string) => boolean }) => {
    isActiveSpy = props.isActive;
    return null;
  },
}));
jest.mock('@/components/widgets/CustomizeButton', () => ({ CustomizeButton: () => null }));
jest.mock('@/components/widgets/strength-widgets', () => ({ STRENGTH_WIDGETS: {} }));

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text, View } = require('react-native');
  return {
    ScreenHeader: ({ title, action }: { title: string; action?: React.ReactNode }) => (
      <View>
        <Text>{title}</Text>
        {action}
      </View>
    ),
  };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
  // Requis dès qu'un module de la chaîne d'import initialise i18next : `i18n.use(undefined)`
  // échoue au chargement du fichier, avant qu'aucun test ne démarre.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      track: '#eadcc6',
      accent: '#b14f2b',
      accentText: '#ffffff',
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
const mockTemplates = useWorkoutTemplates as jest.Mock;
const mockProfile = useProfile as jest.Mock;
const mockStartFree = startWorkout as jest.Mock;
const mockStartFromSession = startWorkoutFromSession as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

const sessionDuJour = (over: Partial<Record<string, unknown>> = {}) => ({
  sessionId: 's-1',
  plannedSessionId: 'ps-1',
  name: 'Haut du corps',
  orderIndex: 0,
  exerciseCount: 5,
  programName: 'Full body 3×',
  previewExercises: ['Développé couché', 'Rowing', 'Squat'],
  estimatedMinutes: 55,
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
    isLoading: false,
  });
  await render(<StrengthScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

let boutonsAlerte: { text?: string; onPress?: () => void }[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  // US MUSCU-UX03, R-MO-3 : la feuille « Comment veux-tu t'entraîner ? » s'interpose au tout
  // premier démarrage. Ces tests portent sur les chemins **après** ce choix ; le cas de la feuille
  // a son propre bloc plus bas.
  useSessionMode.setState({ mode: 'classic', chosen: true, hydrated: true });
  isActiveSpy = undefined;
  boutonsAlerte = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockUseRouter.mockReturnValue({ push });
  mockHistory.mockReturnValue({ workouts: [], isLoading: false });
  mockTemplates.mockReturnValue({ templates: [], isLoading: false });
  mockProfile.mockReturnValue({ profile: null });
  mockStartFree.mockResolvedValue('w-neuf');
  mockStartFromSession.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// La zone Agir rend l'état qu'on lui donne
// ---------------------------------------------------------------------------

describe('zone Agir', () => {
  it('reprend une séance en cours, et montre son avancement', async () => {
    await afficher({
      kind: 'resume',
      workout: { exerciseCount: 3, doneSets: 7, totalSets: 18, name: null },
    });

    expect(screen.getByText('workout.resumeTitle')).toBeTruthy();
    // L'avancement réel : sans lui, « reprendre » ne dit pas où on en est.
    expect(screen.getByText('7/18')).toBeTruthy();

    await taper(screen.getByText('workout.resume'));
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('annonce la séance du jour AVEC son contenu', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    expect(screen.getByText('Haut du corps')).toBeTruthy();
    // Le défaut corrigé : on savait « 5 exercices », jamais lesquels.
    expect(screen.getByText('Développé couché')).toBeTruthy();
    expect(screen.getByText('strengthHub.today.more:{"count":2}')).toBeTruthy();
    expect(screen.getByText('strengthHub.minutesShort:{"count":55}')).toBeTruthy();
  });

  it('🔴 une séance du jour SANS nom retombe sur son rang, 1-indexé', async () => {
    await afficher({ kind: 'today', session: sessionDuJour({ name: null, orderIndex: 2 }) });

    // `orderIndex` est 0-based en base : « Séance 0 » se lirait comme un bug.
    expect(screen.getByText('programs.detail.sessionFallback:{"index":3}')).toBeTruthy();
  });

  it('masque la durée estimée quand elle n’est pas calculable', async () => {
    // Mieux vaut ne rien dire qu'annoncer un chiffre inventé.
    await afficher({ kind: 'today', session: sessionDuJour({ estimatedMinutes: null }) });
    expect(screen.queryByText('strengthHub.estimated')).toBeNull();
  });

  it('🔴 un jour de repos est une information, pas un vide', async () => {
    // Cette carte n'existait pas : entre deux séances d'un programme actif, l'écran ne proposait
    // que « Séance libre », comme s'il n'y avait pas de plan.
    await afficher({
      kind: 'rest',
      doneToday: null,
      nextUpcoming: { scheduledDate: '2026-09-12', name: 'Pull A' },
    });

    expect(screen.getByText('strengthHub.rest.title')).toBeTruthy();
    expect(screen.getByText('home.today.next:{"date":"12/09","name":"Pull A"}')).toBeTruthy();
  });

  it('🔴 une séance DÉJÀ FAITE aujourd’hui est rappelée, sans reproposer de la démarrer', async () => {
    await afficher({ kind: 'rest', doneToday: { name: 'Push A' }, nextUpcoming: null });

    expect(screen.getByText('strengthHub.rest.doneTitle')).toBeTruthy();
    expect(screen.getByText('home.today.doneToday:{"name":"Push A"}')).toBeTruthy();
    expect(screen.queryByText('home.today.cta')).toBeNull();
  });

  it('🔴 sans programme, l’action principale est de CHOISIR un programme', async () => {
    // Le défaut central du hub : « Séance libre » — la moins structurée — était l'action mise en
    // avant pour quelqu'un qui n'avait encore rien fait.
    await afficher({ kind: 'onboarding' });

    await taper(screen.getByText('strengthHub.onboarding.cta'));
    expect(push).toHaveBeenCalledWith('/programs');
  });
});

// ---------------------------------------------------------------------------
// Démarrer la séance du jour — le verrou de double appui
// ---------------------------------------------------------------------------

describe('démarrer la séance du jour', () => {
  it('crée la séance en la RATTACHANT à la planification', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByText('home.today.cta'));

    // Sans `plannedSessionId`, l'occurrence resterait « planifiée » puis « manquée » alors que la
    // séance a réellement eu lieu (US Refonte-A).
    expect(mockStartFromSession).toHaveBeenCalledWith('s-1', { plannedSessionId: 'ps-1' });
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('🔴 deux appuis dans le MÊME cycle ne créent qu’UNE séance', async () => {
    // Seizième site du défaut du 08/08/2026. Un état React ne voit pas le second appui du même
    // cycle de rendu : seul `useActionLock` garde.
    await afficher({ kind: 'today', session: sessionDuJour() });
    const bouton = screen.getByText('home.today.cta');

    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });

    expect(mockStartFromSession).toHaveBeenCalledTimes(1);
  });

  it('🔴 un échec ne navigue pas, et laisse réessayer', async () => {
    mockStartFromSession.mockRejectedValueOnce(new Error('boom'));
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByText('home.today.cta'));
    expect(push).not.toHaveBeenCalled();

    mockStartFromSession.mockResolvedValueOnce(undefined);
    await taper(screen.getByText('home.today.cta'));
    expect(push).toHaveBeenCalledWith('/workout');
  });
});

// ---------------------------------------------------------------------------
// Séance libre
// ---------------------------------------------------------------------------

describe('séance libre', () => {
  it('🔴 sans aucun modèle, démarre directement — pas de choix à une seule issue', async () => {
    // Proposer « à blanc / depuis un modèle » quand aucun modèle n'existe fait choisir entre une
    // option et une impasse.
    mockTemplates.mockReturnValue({ templates: [], isLoading: false });
    await afficher({ kind: 'onboarding' });

    await taper(screen.getByText('workout.freeTitle'));

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockStartFree).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('avec des modèles, le choix est posé AVANT de créer quoi que ce soit', async () => {
    mockTemplates.mockReturnValue({ templates: [{ id: 't1' }], isLoading: false });
    await afficher({ kind: 'onboarding' });

    await taper(screen.getByText('workout.freeTitle'));

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockStartFree).not.toHaveBeenCalled();
  });

  it('« à blanc » crée la séance et ouvre la saisie', async () => {
    mockTemplates.mockReturnValue({ templates: [{ id: 't1' }], isLoading: false });
    await afficher({ kind: 'onboarding' });
    await taper(screen.getByText('workout.freeTitle'));

    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'workout.freeStart.blank')?.onPress?.();
    });

    expect(mockStartFree).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('« depuis un modèle » n’écrit rien et ouvre la liste', async () => {
    mockTemplates.mockReturnValue({ templates: [{ id: 't1' }], isLoading: false });
    await afficher({ kind: 'onboarding' });
    await taper(screen.getByText('workout.freeTitle'));

    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'workout.freeStart.fromTemplate')?.onPress?.();
    });

    expect(mockStartFree).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/templates');
  });
});

// ---------------------------------------------------------------------------
// Zone Suivre : aucune tuile vide
// ---------------------------------------------------------------------------

describe('zone Suivre', () => {
  it('🔴 exclut historique et progression tant qu’aucune séance n’existe', async () => {
    // LE défaut du hub : la grille ne recevait pas de prédicat, donc une tuile sans donnée
    // réservait quand même sa case — 2,4 écrans de scroll de carrés vides sur un compte neuf.
    mockHistory.mockReturnValue({ workouts: [], isLoading: false });
    await afficher({ kind: 'onboarding' });

    expect(isActiveSpy).toBeDefined();
    expect(isActiveSpy!('strength-history')).toBe(false);
    expect(isActiveSpy!('strength-progress')).toBe(false);
  });

  it('les monte dès qu’une séance existe', async () => {
    mockHistory.mockReturnValue({ workouts: [{ id: 'w1' }], isLoading: false });
    await afficher({ kind: 'onboarding' });

    expect(isActiveSpy!('strength-history')).toBe(true);
    expect(isActiveSpy!('strength-progress')).toBe(true);
  });

  it('garde le planning même vide — il montre la semaine à venir', async () => {
    mockHistory.mockReturnValue({ workouts: [], isLoading: false });
    await afficher({ kind: 'onboarding' });

    expect(isActiveSpy!('strength-planning')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Avancement du programme
// ---------------------------------------------------------------------------

describe('avancement du programme', () => {
  it('🔴 affiche la semaine en cours — le repère que MUSC-F15 calculait sans le montrer', async () => {
    await afficher(
      { kind: 'today', session: sessionDuJour() },
      {
        programName: 'PPL 6 jours',
        progress: { week: 3, totalWeeks: 8, done: 14, total: 24, ratio: 14 / 24 },
      },
    );

    expect(
      screen.getByText('strengthHub.progress.week:{"name":"PPL 6 jours","week":3,"totalWeeks":8}'),
    ).toBeTruthy();
    expect(screen.getByText('strengthHub.progress.sessions:{"done":14,"total":24}')).toBeTruthy();
  });

  it('ne montre rien sans programme actif', async () => {
    await afficher({ kind: 'onboarding' });
    expect(screen.queryByText(/strengthHub\.progress\.week/)).toBeNull();
  });
});
