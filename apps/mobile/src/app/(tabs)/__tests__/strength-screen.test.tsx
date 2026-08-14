/**
 * Hub musculation (`app/(tabs)/strength.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier, et **il portait le seizième site du défaut de double appui** :
 * `onStartToday` gardait sur `if (starting) return`, un état React, qui ne garde rien. Deux appuis
 * du même cycle de rendu créaient **deux séances**, dont une orpheline que rien ne rouvrirait —
 * l'app n'en affiche qu'une. Corrigé le 14/08/2026 par `useActionLock`, test vu rouge avant.
 *
 * L'autre chose que cet écran décide, et qui n'est visible nulle part ailleurs, c'est **quelle
 * carte d'action épinglée** afficher. Elles s'excluent, dans un ordre qui est une règle produit :
 *
 *  1. **Une séance en cours passe avant tout.** La reprendre est la seule action sensée : proposer
 *     d'en démarrer une autre par-dessus produirait exactement le doublon que le verrou empêche.
 *  2. **Puis la séance planifiée du jour**, avec son programme — c'est ce qu'on est venu faire.
 *  3. **Sinon la séance libre**, avec deux repères discrets : ce qui a déjà été fait aujourd'hui,
 *     et la prochaine séance prévue. Un écran qui ne dirait rien ferait croire à un planning vide.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import StrengthScreen from '../strength';
import { startWorkout, startWorkoutFromSession, useActiveWorkout } from '@/data/repositories/workout-repository';
import { useTodaySession } from '@/data/repositories/dashboard-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-repository', () => ({
  useActiveWorkout: jest.fn(() => ({ workout: null })),
  startWorkout: jest.fn(),
  startWorkoutFromSession: jest.fn(),
}));
jest.mock('@/data/repositories/dashboard-repository', () => ({
  useTodaySession: jest.fn(() => ({ state: 'none', doneToday: null, nextUpcoming: null })),
}));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));

/**
 * La grille de widgets a ses propres tests (55) : sonde muette ici, elle n'entre dans aucune des
 * règles vérifiées. Elle est aussi ce qui, sans mock, tire `widget-layout-repository` puis
 * l'initialisation d'i18next — d'où le `initReactI18next` dans le mock de `react-i18next`.
 */
jest.mock('@/components/widgets/WidgetGrid', () => ({ WidgetGrid: () => null }));
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
jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
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
      textMuted: '#96856f',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
      success: '#7c8a5b',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockActive = useActiveWorkout as jest.Mock;
const mockToday = useTodaySession as jest.Mock;
const mockStartFree = startWorkout as jest.Mock;
const mockStartFromSession = startWorkoutFromSession as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

const seanceDuJour = (overrides: Record<string, unknown> = {}) => ({
  state: 'today-session' as const,
  session: {
    sessionId: 's-1',
    plannedSessionId: 'ps-1',
    name: 'Haut du corps',
    orderIndex: 0,
    exerciseCount: 5,
    programName: 'Full body 3×',
    ...(overrides.session as Record<string, unknown>),
  },
  ...overrides,
});

const afficher = async (today: Record<string, unknown> = { state: 'none', doneToday: null, nextUpcoming: null }) => {
  mockToday.mockReturnValue(today);
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
  boutonsAlerte = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockUseRouter.mockReturnValue({ push });
  mockActive.mockReturnValue({ workout: null });
  mockStartFree.mockResolvedValue('w-neuf');
  mockStartFromSession.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Carte épinglée : trois états qui s'excluent
// ---------------------------------------------------------------------------

describe('carte d’action épinglée', () => {
  it('🔴 une séance EN COURS passe avant tout', async () => {
    mockActive.mockReturnValue({ workout: { id: 'w-1', entries: [{}, {}] } });
    await afficher(seanceDuJour());

    // Proposer d'en démarrer une autre par-dessus produirait exactement le doublon que le verrou
    // empêche — et l'app n'affiche qu'une séance active.
    expect(screen.getByText('workout.resumeTitle')).toBeTruthy();
    expect(screen.queryByText('home.today.title')).toBeNull();
    expect(screen.queryByLabelText('workout.startFree')).toBeNull();
  });

  it('reprendre ouvre la séance en cours', async () => {
    mockActive.mockReturnValue({ workout: { id: 'w-1', entries: [] } });
    await afficher();

    await taper(screen.getByLabelText('workout.resume'));

    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('sans séance en cours, la séance PLANIFIÉE du jour est proposée', async () => {
    await afficher(seanceDuJour());

    expect(screen.getByText('home.today.title')).toBeTruthy();
    expect(screen.getByText(/Haut du corps/)).toBeTruthy();
    expect(screen.getByText('home.today.program:{"name":"Full body 3×"}')).toBeTruthy();
  });

  it('🔴 une séance du jour SANS nom retombe sur son rang, 1-indexé', async () => {
    await afficher(seanceDuJour({ session: { sessionId: 's-1', plannedSessionId: 'ps-1', name: '  ', orderIndex: 2, exerciseCount: 4, programName: null } }));

    expect(screen.getByText(/programs\.detail\.sessionFallback:\{"index":3\}/)).toBeTruthy();
  });

  it('sans programme, la ligne de programme disparaît', async () => {
    await afficher(seanceDuJour({ session: { sessionId: 's-1', plannedSessionId: 'ps-1', name: 'A', orderIndex: 0, exerciseCount: 4, programName: null } }));

    expect(screen.queryByText(/home\.today\.program/)).toBeNull();
  });

  it('rien de prévu : la séance libre', async () => {
    await afficher();

    expect(screen.getByText('workout.freeTitle')).toBeTruthy();
    expect(screen.getByLabelText('workout.startFree')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Démarrer la séance du jour
// ---------------------------------------------------------------------------

describe('démarrer la séance du jour', () => {
  it('crée la séance en la RATTACHANT à la planification', async () => {
    await afficher(seanceDuJour());

    await taper(screen.getByLabelText('home.today.cta'));

    // Sans `plannedSessionId`, la case du planning resterait « planifiée » pour toujours.
    expect(mockStartFromSession).toHaveBeenCalledWith('s-1', { plannedSessionId: 'ps-1' });
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('🔴 deux appuis dans le MÊME cycle ne créent qu’UNE séance', async () => {
    let resoudre: (() => void) | undefined;
    mockStartFromSession.mockReturnValue(new Promise<void>((r) => (resoudre = r)));
    await afficher(seanceDuJour());

    const b = screen.getByLabelText('home.today.cta');
    await act(async () => {
      fireEvent.press(b);
      fireEvent.press(b);
    });

    // Seizième site du défaut du 08/08/2026 : `if (starting) return` lit un état React, et deux
    // appuis du même cycle le lisent tous deux à `false`. Deux séances créées, dont une orpheline
    // que rien ne rouvrirait.
    expect(mockStartFromSession).toHaveBeenCalledTimes(1);
    resoudre?.();
  });

  it('🔴 un échec ne navigue pas, et laisse réessayer', async () => {
    mockStartFromSession.mockRejectedValueOnce(new Error('hors ligne'));
    await afficher(seanceDuJour());

    await taper(screen.getByLabelText('home.today.cta'));
    expect(push).not.toHaveBeenCalled();

    // `finally` : rester bloqué en « démarrage » priverait l'écran de son action principale.
    await taper(screen.getByLabelText('home.today.cta'));
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('un raccourci vers les modèles reste offert', async () => {
    await afficher(seanceDuJour());

    await taper(screen.getByText('workout.freeStart.fromTemplate'));

    // Avoir une séance prévue n'oblige pas à la faire : le modèle libre reste à un geste.
    expect(push).toHaveBeenCalledWith('/templates');
  });
});

// ---------------------------------------------------------------------------
// Séance libre
// ---------------------------------------------------------------------------

describe('séance libre', () => {
  it('🔴 le choix est posé AVANT de créer quoi que ce soit', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.startFree'));

    // Créer une séance vierge puis proposer un modèle laisserait un enregistrement à nettoyer si
    // l'utilisateur change d'avis.
    expect(mockStartFree).not.toHaveBeenCalled();
    expect(boutonsAlerte.map((b) => b.text)).toEqual([
      'workout.freeStart.blank',
      'workout.freeStart.fromTemplate',
      'common.cancel',
    ]);
  });

  it('« vierge » crée la séance et ouvre la saisie', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.startFree'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'workout.freeStart.blank')?.onPress?.();
    });

    expect(mockStartFree).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('« depuis un modèle » n’écrit rien et ouvre la liste', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.startFree'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'workout.freeStart.fromTemplate')?.onPress?.();
    });

    expect(mockStartFree).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/templates');
  });

  it('annuler ne crée rien', async () => {
    await afficher();

    await taper(screen.getByLabelText('workout.startFree'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockStartFree).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Repères du jour
// ---------------------------------------------------------------------------

describe('repères du jour', () => {
  it('🔴 une séance DÉJÀ FAITE aujourd’hui est rappelée', async () => {
    await afficher({
      state: 'none',
      doneToday: { name: 'Haut du corps' },
      nextUpcoming: null,
    });

    // Sans ce repère, l'écran proposerait « séance libre » à quelqu'un qui vient de s'entraîner,
    // comme si rien n'avait été fait.
    expect(screen.getByText('home.today.doneToday:{"name":"Haut du corps"}')).toBeTruthy();
  });

  it('🔴 la prochaine séance prévue est annoncée en JJ/MM', async () => {
    await afficher({
      state: 'none',
      doneToday: null,
      nextUpcoming: { scheduledDate: '2026-08-19', name: 'Bas du corps' },
    });

    // Une date ISO affichée telle quelle serait illisible ; et sans elle, un planning à venir se
    // lirait comme un planning vide.
    expect(screen.getByText(/home\.today\.next.*"date":"19\/08"/)).toBeTruthy();
  });

  it('la prochaine séance mène au planning', async () => {
    await afficher({
      state: 'none',
      doneToday: null,
      nextUpcoming: { scheduledDate: '2026-08-19', name: 'Bas du corps' },
    });

    await taper(screen.getByText(/home\.today\.next/));

    expect(push).toHaveBeenCalledWith('/planning');
  });

  it('sans repère, aucune ligne parasite', async () => {
    await afficher();

    expect(screen.queryByText(/doneToday|home\.today\.next/)).toBeNull();
  });
});
