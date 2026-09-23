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
 *
 * ── Recomposé le 19/09/2026 (US MUSCU-UX05) ─────────────────────────────────────────────────────
 * Le hub n'a plus de **grille de widgets** : ses trois tuiles étaient de l'administration et sont
 * sorties avec la zone « Suivre ». Les tests de tuile vide (`isActive`) disparaissent donc avec
 * elle — ce qui les remplace, c'est que **chaque carte se tait d'elle-même** quand elle n'a rien
 * à dire, ce que vérifient leurs fichiers respectifs.
 *
 * Ce qui reste ici est ce qui est propre à l'écran : la garde de double appui, le rendu de l'état
 * qu'on lui donne, le câblage des gestes, et la composition.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { HubState } from '@wellness/shared';

import StrengthScreen from '../strength';
import {
  startWorkout,
  startWorkoutFromSession,
  startWorkoutFromWorkout,
  useWorkoutHistory,
} from '@/data/repositories/workout-repository';
import { useStrengthHub } from '@/data/repositories/strength-hub-repository';
import {
  startWorkoutFromTemplate,
  useWorkoutTemplates,
} from '@/data/repositories/workout-template-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useRouter } from 'expo-router';
import { useSessionMode } from '@/stores/session-mode-store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-repository', () => ({
  startWorkout: jest.fn(),
  startWorkoutFromSession: jest.fn(),
  startWorkoutFromWorkout: jest.fn(),
  useWorkoutHistory: jest.fn(() => ({ workouts: [], isLoading: false })),
}));
jest.mock('@/data/repositories/strength-hub-repository', () => ({
  useStrengthHub: jest.fn(),
}));
jest.mock('@/data/repositories/workout-template-repository', () => ({
  startWorkoutFromTemplate: jest.fn(),
  useWorkoutTemplates: jest.fn(() => ({ templates: [], isLoading: false })),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null })),
}));
jest.mock('@/components/strength/SuggestedPrograms', () => ({
  SuggestedPrograms: () => null,
}));
// US DASH-01 : la scène est REELLE ici (c'est l'assemblage qu'on vérifie) ; les deux cartes du
// corps ont leurs propres tests.
jest.mock('@/components/strength/StrengthWeekCard', () => {
  const { Text } = require('react-native');
  return { StrengthWeekCard: () => <Text>sonde-semaine</Text> };
});
jest.mock('@/components/strength/NearRecordsCard', () => {
  const { Text } = require('react-native');
  return { NearRecordsCard: () => <Text>sonde-portee</Text> };
});
jest.mock('@/components/strength/WhatIfCard', () => {
  const { Text } = require('react-native');
  return { WhatIfCard: () => <Text>sonde-etsi</Text> };
});
jest.mock('@/data/repositories/records-repository', () => ({
  useNearRecords: jest.fn(() => ({ items: [], isLoading: false })),
}));
jest.mock('@/hooks/useTodayKey', () => ({
  useTodayKey: () => '2026-09-14',
  useTodayDate: () => new Date(2026, 8, 14),
  useCurrentHour: () => 10,
  useWindowStartUtc: () => '2026-08-01T00:00:00.000Z',
  useWindowStartKey: () => '2026-08-01',
}));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));

// Les cartes neuves ont leurs propres tests : ici, des sondes qui prouvent seulement qu'elles sont
// montées, et à quel geste elles sont câblées.
jest.mock('@/components/strength/DayThread', () => {
  const { Text } = require('react-native');
  return { DayThread: () => <Text>sonde-fil</Text> };
});
jest.mock('@/components/strength/LoadProgressCard', () => {
  const { Text } = require('react-native');
  return { LoadProgressCard: () => <Text>sonde-charges</Text> };
});
jest.mock('@/components/strength/BodyBalanceCard', () => {
  const { Text } = require('react-native');
  return { BodyBalanceCard: () => <Text>sonde-corps</Text> };
});
jest.mock('@/components/strength/RecordWall', () => {
  const { Text } = require('react-native');
  return { RecordWall: () => <Text>sonde-mur</Text> };
});
jest.mock('@/components/strength/LifetimeLine', () => {
  const { Text } = require('react-native');
  return { LifetimeLine: () => <Text>sonde-total</Text> };
});

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
    // La feuille « Séance libre » date les séances à refaire dans la langue de l'app.
    i18n: { language: 'fr' },
  }),
  // Requis dès qu'un module de la chaîne d'import initialise i18next : `i18n.use(undefined)`
  // échoue au chargement du fichier, avant qu'aucun test ne démarre.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    // La scène dérive son dégradé du schéma : sans lui, `stageTheme` n'a pas de teinte.
    scheme: 'light',
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
const mockStartFromWorkout = startWorkoutFromWorkout as jest.Mock;
const mockStartFromTemplate = startWorkoutFromTemplate as jest.Mock;
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
    todayMuscles: ['chest', 'arms'],
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
  // US MUSCU-UX03, R-MO-3 : la feuille « Comment veux-tu t'entraîner ? » s'interpose au tout
  // premier démarrage. Ces tests portent sur les chemins **après** ce choix ; le cas de la feuille
  // a son propre bloc plus bas.
  useSessionMode.setState({ mode: 'classic', chosen: true, hydrated: true });
  mockUseRouter.mockReturnValue({ push });
  mockHistory.mockReturnValue({ workouts: [], isLoading: false });
  mockTemplates.mockReturnValue({ templates: [], isLoading: false });
  mockProfile.mockReturnValue({ profile: null });
  mockStartFree.mockResolvedValue('w-neuf');
  mockStartFromSession.mockResolvedValue(undefined);
  mockStartFromWorkout.mockResolvedValue('w-rejouee');
  mockStartFromTemplate.mockResolvedValue('w-modele');
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
    expect(screen.getByText('stage.strength.setsProgress:{"done":7,"total":18}')).toBeTruthy();

    await taper(screen.getByLabelText('stage.strength.primary.resume'));
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('annonce la séance du jour AVEC son contenu', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    expect(screen.getByText('Haut du corps')).toBeTruthy();
    // Le défaut corrigé : on savait « 5 exercices », jamais lesquels.
    expect(screen.getByText('Développé couché')).toBeTruthy();
    expect(screen.getByText('strengthHub.today.more:{"count":2}')).toBeTruthy();
    expect(screen.getByText(/strengthHub\.minutesShort/)).toBeTruthy();
  });

  it('🔴 une séance du jour SANS nom retombe sur son rang, 1-indexé', async () => {
    await afficher({ kind: 'today', session: sessionDuJour({ name: null, orderIndex: 2 }) });

    // `orderIndex` est 0-based en base : « Séance 0 » se lirait comme un bug.
    expect(screen.getByText('programs.detail.sessionFallback:{"index":3}')).toBeTruthy();
  });

  it('masque la durée estimée quand elle n’est pas calculable', async () => {
    // Mieux vaut ne rien dire qu'annoncer un chiffre inventé.
    await afficher({ kind: 'today', session: sessionDuJour({ estimatedMinutes: null }) });
    expect(screen.queryByText(/strengthHub\.minutesShort/)).toBeNull();
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

    await taper(screen.getByLabelText('stage.strength.primary.onboarding'));
    expect(push).toHaveBeenCalledWith('/programs');
  });
});

// ---------------------------------------------------------------------------
// Démarrer la séance du jour — le verrou de double appui
// ---------------------------------------------------------------------------

describe('démarrer la séance du jour', () => {
  it('crée la séance en la RATTACHANT à la planification', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByLabelText('stage.strength.primary.today'));

    // Sans `plannedSessionId`, l'occurrence resterait « planifiée » puis « manquée » alors que la
    // séance a réellement eu lieu (US Refonte-A).
    expect(mockStartFromSession).toHaveBeenCalledWith('s-1', { plannedSessionId: 'ps-1' });
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('🔴 deux appuis dans le MÊME cycle ne créent qu’UNE séance', async () => {
    // Seizième site du défaut du 08/08/2026. Un état React ne voit pas le second appui du même
    // cycle de rendu : seul `useActionLock` garde.
    await afficher({ kind: 'today', session: sessionDuJour() });
    const bouton = screen.getByLabelText('stage.strength.primary.today');

    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });

    expect(mockStartFromSession).toHaveBeenCalledTimes(1);
  });

  it('🔴 un échec ne navigue pas, et laisse réessayer', async () => {
    mockStartFromSession.mockRejectedValueOnce(new Error('boom'));
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByLabelText('stage.strength.primary.today'));
    expect(push).not.toHaveBeenCalled();

    mockStartFromSession.mockResolvedValueOnce(undefined);
    await taper(screen.getByLabelText('stage.strength.primary.today'));
    expect(push).toHaveBeenCalledWith('/workout');
  });
});

// ---------------------------------------------------------------------------
// Séance libre
// ---------------------------------------------------------------------------

describe('séance libre', () => {
  // ── Repensée le 23/09/2026 (MUSCU-FIX02, passe 1) ──────────────────────────────────────────
  // Sans modèle, l'appui créait une séance VIDE : chrono lancé, écran noir, « ajoute un premier
  // exercice ». L'arbitrage « pas de choix à une seule issue » (MUSCU-FIX01, R6) est remplacé :
  // « Composer » existe toujours, il n'y a donc plus d'issue unique. On choisit, PUIS la séance naît.

  const ouvrirFeuille = async () => {
    await afficher({ kind: 'onboarding' });
    await taper(screen.getByLabelText('stage.strength.secondary.onboarding'));
  };

  const seanceFaite = (over: Record<string, unknown> = {}) => ({
    id: 'w-old',
    startedAt: '2026-09-12T09:00:00.000Z',
    finishedAt: '2026-09-12T10:00:00.000Z',
    durationSeconds: 3600,
    rpe: null,
    notes: null,
    sessionId: null,
    programId: null,
    volumeKg: 4200,
    sessionName: 'Haut du corps',
    exerciseCount: 4,
    recordCount: 0,
    ...over,
  });

  it('🔴 ouvre une feuille de choix — rien n’est créé, aucun chrono ne part', async () => {
    await ouvrirFeuille();

    expect(screen.getByText('workout.freeSheet.title')).toBeTruthy();
    expect(mockStartFree).not.toHaveBeenCalled();
    expect(mockStartFromWorkout).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('« Composer ma séance » ouvre le sélecteur en composition, sans rien créer', async () => {
    await ouvrirFeuille();

    await taper(screen.getByTestId('free-compose'));

    expect(push).toHaveBeenCalledWith({ pathname: '/exercises', params: { mode: 'compose' } });
    expect(mockStartFree).not.toHaveBeenCalled();
  });

  it('« Refaire » rejoue une séance récente, puis l’ouvre', async () => {
    mockHistory.mockReturnValue({ workouts: [seanceFaite()], isLoading: false });
    await ouvrirFeuille();

    await taper(screen.getByTestId('free-repeat-w-old'));

    expect(mockStartFromWorkout).toHaveBeenCalledWith('w-old');
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('ne propose pas de refaire une séance sans exercice travaillé', async () => {
    mockHistory.mockReturnValue({
      workouts: [seanceFaite({ id: 'w-vide', exerciseCount: 0 })],
      isLoading: false,
    });
    await ouvrirFeuille();

    expect(screen.queryByTestId('free-repeat-w-vide')).toBeNull();
  });

  it('sans modèle, « Créer un modèle » mène à la liste des modèles', async () => {
    await ouvrirFeuille();

    await taper(screen.getByTestId('free-templates-empty'));

    expect(push).toHaveBeenCalledWith('/templates');
  });

  it('un modèle démarre sa séance puis l’ouvre (mode classique)', async () => {
    mockTemplates.mockReturnValue({
      templates: [{ id: 't1', name: 'Jambes', exerciseCount: 5 }],
      isLoading: false,
    });
    await ouvrirFeuille();

    await taper(screen.getByTestId('free-template-t1'));

    expect(mockStartFromTemplate).toHaveBeenCalledWith('t1');
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('en immersif, un modèle passe d’abord par le brief — rien n’est créé', async () => {
    useSessionMode.setState({ mode: 'immersive' });
    mockTemplates.mockReturnValue({
      templates: [{ id: 't1', name: 'Jambes', exerciseCount: 5 }],
      isLoading: false,
    });
    await ouvrirFeuille();

    await taper(screen.getByTestId('free-template-t1'));

    expect(push).toHaveBeenCalledWith({ pathname: '/workout-brief', params: { templateId: 't1' } });
    expect(mockStartFromTemplate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Zone Suivre : aucune tuile vide
// ---------------------------------------------------------------------------

describe('annuaire', () => {
  it('🔴 l’icône mène AUX TROIS destinations — templates compris, même à zéro template', async () => {
    // Le libellé de l'icône promet « Exercices, programmes, templates » et n'ouvrait que les
    // exercices. Combiné au choix « Depuis un template » qui ne paraît qu'à partir d'un template,
    // et à `/templates` comme seul écran pour en créer un, la fonctionnalité était inatteignable
    // sur un compte neuf.
    mockTemplates.mockReturnValue({ templates: [], isLoading: false });
    await afficher({ kind: 'onboarding' });

    await taper(screen.getByLabelText('strengthHub.directory'));
    await taper(screen.getByTestId('directory-templates'));

    expect(push).toHaveBeenCalledWith('/templates');
  });

  it('les programmes sont à la même porte', async () => {
    await afficher({ kind: 'onboarding' });

    await taper(screen.getByLabelText('strengthHub.directory'));
    await taper(screen.getByTestId('directory-programs'));

    expect(push).toHaveBeenCalledWith('/programs');
  });

  it('les exercices s’ouvrent en consultation, pas en ajout', async () => {
    await afficher({ kind: 'onboarding' });

    await taper(screen.getByLabelText('strengthHub.directory'));
    await taper(screen.getByTestId('directory-exercises'));

    expect(push).toHaveBeenCalledWith({ pathname: '/exercises', params: { mode: 'browse' } });
  });
});

// ---------------------------------------------------------------------------
// Composition : six cartes et deux lignes, plus aucune grille
// ---------------------------------------------------------------------------

describe('composition du hub', () => {
  it('🔴 monte les cartes de sens, et AUCUNE grille de widgets', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    for (const sonde of ['sonde-fil', 'sonde-charges', 'sonde-corps', 'sonde-mur', 'sonde-total']) {
      expect(screen.getByText(sonde)).toBeTruthy();
    }
    // La zone « Suivre » et son bouton « Personnaliser » ont disparu avec les trois tuiles
    // d'administration : plus rien ne doit les rappeler.
    expect(screen.queryByText('strengthHub.followSection')).toBeNull();
  });

  it('l’annuaire est atteignable en pied d’écran, pas seulement par l’icône de la scène', async () => {
    await afficher({ kind: 'today', session: sessionDuJour() });

    await taper(screen.getByTestId('strength-directory-link'));
    await taper(screen.getByTestId('directory-templates'));

    expect(push).toHaveBeenCalledWith('/templates');
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
