/**
 * Widget « Séance du jour » (`components/dashboard/TodaySessionCard`, roadmap 7.4).
 *
 * Composant à **0 %** avant ce fichier, et **trois déclinaisons** (`small` / `wide` / `large`) qui
 * partagent la même machine à états mais pas le même rendu. C'est le premier widget de l'accueil :
 * il est lu en une seconde, et c'est lui qui lance la séance.
 *
 * Trois états, dans cet ordre de priorité :
 *  1. **une séance en cours** → reprendre (jamais « démarrer » : on ne recrée pas une séance
 *     par-dessus celle qui tourne) ;
 *  2. **une occurrence planifiée aujourd'hui** → démarrer ;
 *  3. **rien aujourd'hui** → repli, qui distingue lui-même « pas de programme actif » (invitation
 *     à en créer un) de « rien aujourd'hui, prochaine séance le … ».
 *
 * Le point qui compte le plus : **le widget ne rend RIEN pendant le chargement**. Sur un accueil
 * fait de six widgets, afficher « aucune séance » une fraction de seconde à chaque ouverture est
 * la façon la plus sûre de faire croire que l'app a perdu le programme.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { TodaySessionCard } from '../TodaySessionCard';
import { useTodaySession } from '@/data/repositories/dashboard-repository';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useTodaySession: jest.fn(),
}));

jest.mock('@/data/repositories/workout-repository', () => ({
  startWorkoutFromSession: jest.fn(),
}));

/** Cadre du widget : rendu transparent, mais on garde son `onPress` et son libellé. */
jest.mock('@/components/widgets/WidgetFrame', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    WidgetFrame: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
    }) =>
      onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
          {children}
        </Pressable>
      ) : (
        <View accessibilityLabel={accessibilityLabel}>{children}</View>
      ),
    Eyebrow: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Metric: ({ value, sub }: { value: string; sub?: string }) => (
      <View>
        <Text>{value}</Text>
        {sub ? <Text>{sub}</Text> : null}
      </View>
    ),
  };
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
      accent: '#c0562f',
      accentText: '#ffffff',
      panelMuted: '#cfc4b4',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockToday = useTodaySession as jest.Mock;
const mockStart = startWorkoutFromSession as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

/** Occurrence planifiée du jour. */
const seance = (overrides: Record<string, unknown> = {}) => ({
  state: 'today-session',
  session: {
    sessionId: 's-1',
    plannedSessionId: 'ps-1',
    name: 'Jour A',
    orderIndex: 0,
    exerciseCount: 5,
    programName: 'Prise de masse',
    ...(overrides.session as Record<string, unknown>),
  },
  isLoading: false,
  ...overrides,
});

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockStart.mockResolvedValue(undefined);
  mockToday.mockReturnValue(seance());
});

const TAILLES = ['small', 'wide', 'large'] as const;

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

describe('chargement', () => {
  it.each(TAILLES)('🔴 %s ne rend RIEN tant que la source charge', async (size) => {
    mockToday.mockReturnValue({ state: 'none', hasActiveProgram: false, isLoading: true });

    const vue = await render(<TodaySessionCard size={size} />);

    // Sur un accueil de six widgets, afficher « aucune séance » une fraction de seconde à chaque
    // ouverture est la façon la plus sûre de faire croire que l'app a perdu le programme.
    expect(vue.toJSON()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Séance planifiée aujourd'hui
// ---------------------------------------------------------------------------

describe('séance planifiée aujourd’hui', () => {
  it.each(TAILLES)('%s affiche le nom de la séance', async (size) => {
    await render(<TodaySessionCard size={size} />);

    expect(screen.getByText('Jour A')).toBeTruthy();
  });

  it('🔴 une séance sans nom retombe sur son rang, PAS sur un vide', async () => {
    mockToday.mockReturnValue(seance({ session: { name: null, orderIndex: 2 } }));

    await render(<TodaySessionCard size="wide" />);

    // Un widget d'accueil sans titre se lit comme un défaut de chargement. Le rang est numéroté à
    // partir de 1 : « Séance 3 », pas « Séance 2 ».
    expect(screen.getByText('programs.detail.sessionFallback:{"index":3}')).toBeTruthy();
  });

  it('🔴 un nom fait uniquement d’espaces compte comme absent', async () => {
    mockToday.mockReturnValue(seance({ session: { name: '   ' } }));

    await render(<TodaySessionCard size="wide" />);

    expect(screen.getByText(/programs\.detail\.sessionFallback/)).toBeTruthy();
  });

  it('démarre la séance depuis l’occurrence PLANIFIÉE', async () => {
    await render(<TodaySessionCard size="large" />);

    await taper(screen.getByLabelText('home.today.cta'));

    // `plannedSessionId` est ce qui relie la séance à son occurrence : sans lui, l'adhérence au
    // programme (MUSC-F15) ne peut plus être calculée.
    expect(mockStart).toHaveBeenCalledWith('s-1', { plannedSessionId: 'ps-1' });
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('🔴 un échec de démarrage ne navigue PAS', async () => {
    mockStart.mockRejectedValue(new Error('hors ligne'));
    await render(<TodaySessionCard size="large" />);

    await taper(screen.getByLabelText('home.today.cta'));

    // Arriver sur un écran de séance vide serait pire que de rester sur l'accueil.
    expect(push).not.toHaveBeenCalled();
  });

  it('🔴 après un échec, on peut réessayer', async () => {
    mockStart.mockRejectedValueOnce(new Error('hors ligne'));
    await render(<TodaySessionCard size="large" />);

    await taper(screen.getByLabelText('home.today.cta'));
    await taper(screen.getByLabelText('home.today.cta'));

    // Le drapeau doit être relâché dans tous les cas, sinon le bouton reste mort jusqu'au
    // prochain affichage de l'accueil.
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('le programme d’origine est rappelé quand il existe', async () => {
    await render(<TodaySessionCard size="large" />);

    expect(screen.getByText('Prise de masse')).toBeTruthy();
  });

  it('aucune ligne de programme quand la séance n’en a pas', async () => {
    mockToday.mockReturnValue(seance({ session: { programName: null } }));

    await render(<TodaySessionCard size="large" />);

    expect(screen.queryByText('Prise de masse')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Séance en cours
// ---------------------------------------------------------------------------

describe('séance en cours', () => {
  beforeEach(() => {
    mockToday.mockReturnValue({ state: 'active-workout', isLoading: false });
  });

  it.each(['wide', 'large'] as const)('%s propose de REPRENDRE, pas de démarrer', async (size) => {
    await render(<TodaySessionCard size={size} />);

    // Démarrer par-dessus une séance en cours en créerait une seconde et perdrait les séries
    // déjà saisies.
    expect(screen.getAllByText('home.today.resume').length).toBeGreaterThan(0);
    expect(screen.queryByText('home.today.cta')).toBeNull();
  });

  it('🔴 reprendre n’appelle AUCUNE écriture', async () => {
    await render(<TodaySessionCard size="wide" />);

    await taper(screen.getByLabelText('home.today.title'));

    expect(mockStart).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('le petit format mène aussi à la séance', async () => {
    await render(<TodaySessionCard size="small" />);

    await taper(screen.getByLabelText('home.today.title'));

    expect(push).toHaveBeenCalledWith('/workout');
  });
});

// ---------------------------------------------------------------------------
// Repli
// ---------------------------------------------------------------------------

describe('repli', () => {
  it('🔴 sans programme actif, INVITE à en créer un', async () => {
    mockToday.mockReturnValue({ state: 'none', hasActiveProgram: false, isLoading: false });

    await render(<TodaySessionCard size="wide" />);

    // « Rien aujourd'hui » sur un compte sans programme est un constat inutile : ce qu'il faut
    // dire, c'est qu'il n'y a rien à planifier tant qu'aucun programme n'est actif.
    expect(screen.getByText('home.today.empty')).toBeTruthy();
    expect(screen.queryByText('home.today.noneToday')).toBeNull();
  });

  it('mène à la bibliothèque de programmes', async () => {
    mockToday.mockReturnValue({ state: 'none', hasActiveProgram: false, isLoading: false });

    await render(<TodaySessionCard size="wide" />);
    await taper(screen.getByText('home.today.createProgram'));

    expect(push).toHaveBeenCalledWith('/programs');
  });

  it('🔴 avec un programme actif, dit « rien aujourd’hui » et annonce la SUITE', async () => {
    mockToday.mockReturnValue({
      state: 'none',
      hasActiveProgram: true,
      nextUpcoming: { name: 'Jour B', scheduledDate: '2026-08-12' },
      isLoading: false,
    });

    await render(<TodaySessionCard size="wide" />);

    // Un jour de repos annoncé avec la prochaine échéance rassure ; le même jour sans suite se lit
    // comme un programme terminé.
    expect(screen.getByText('home.today.noneToday')).toBeTruthy();
    expect(screen.getByText('home.today.next:{"date":"12/08","name":"Jour B"}')).toBeTruthy();
  });

  it('aucune ligne « prochaine » quand il n’y a plus rien de planifié', async () => {
    mockToday.mockReturnValue({
      state: 'none',
      hasActiveProgram: true,
      nextUpcoming: null,
      isLoading: false,
    });

    await render(<TodaySessionCard size="wide" />);

    expect(screen.getByText('home.today.noneToday')).toBeTruthy();
    expect(screen.queryByText(/home\.today\.next/)).toBeNull();
  });

  it('🔴 le repli n’est PAS cliquable vers la séance', async () => {
    mockToday.mockReturnValue({ state: 'none', hasActiveProgram: true, isLoading: false });

    await render(<TodaySessionCard size="small" />);
    await taper(screen.getByLabelText('home.today.title'));

    // Ouvrir l'écran de séance sans séance mènerait à un écran vide, avec un simple bouton retour.
    expect(push).toHaveBeenCalledWith('/programs');
  });
});
