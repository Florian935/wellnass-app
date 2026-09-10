/**
 * Détail d'un programme (`app/programs/[id].tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier, et **il porte trois des verrous corrigés le 08/08/2026**
 * (démarrer une séance, dupliquer, supprimer) qui n'avaient encore aucun test. C'est la dette la
 * plus directe du chantier : neuf gardes corrigées, trois seulement couvertes.
 *
 * Deux règles produit s'y ajoutent, et aucune ne se voit dans un repository :
 *
 *  1. **Un programme éditorial ne peut être ni planifié ni supprimé** — seulement dupliqué. Activer
 *     un programme de la bibliothèque ferait diverger le local et le cloud, puisqu'il n'appartient
 *     à personne. La distinction se lit sur « Mes programmes », pas sur une colonne.
 *  2. **Une séance sans exercice n'offre pas de bouton « Démarrer »** : lancer une séance vide
 *     mènerait à un écran de saisie sans rien à saisir.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ProgramDetailScreen from '../[id]';
import {
  deleteProgram,
  duplicateProgram,
  useMyPrograms,
  useProgramDetail,
} from '@/data/repositories/program-repository';
import { startWorkoutFromSession } from '@/data/repositories/workout-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  useProgramDetail: jest.fn(),
  useMyPrograms: jest.fn(),
  duplicateProgram: jest.fn(),
  deleteProgram: jest.fn(),
}));

jest.mock('@/data/repositories/workout-repository', () => ({
  startWorkoutFromSession: jest.fn(),
}));

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
/** La carte repliable est testée chez elle : ici on rend titre, résumé, contenu et pied. */
jest.mock('@/components/CollapsibleCard', () => {
  const { Text, View } = require('react-native');
  return {
    CollapsibleCard: ({
      title,
      summary,
      footer,
      children,
    }: {
      title: string;
      summary?: string;
      footer?: React.ReactNode;
      children?: React.ReactNode;
    }) => (
      <View>
        <Text>{title}</Text>
        {summary ? <Text>{summary}</Text> : null}
        {children}
        {footer}
      </View>
    ),
  };
});
jest.mock('@/components/body/BodyMap', () => ({ BodyMap: () => null }));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: () => ({ id: 'prog-1' }),
}));

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
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatWeight: (kg: number | null | undefined) => (kg == null ? '—' : `${kg} kg`),
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockDetail = useProgramDetail as jest.Mock;
const mockMine = useMyPrograms as jest.Mock;
const mockDuplicate = duplicateProgram as jest.Mock;
const mockDelete = deleteProgram as jest.Mock;
const mockStart = startWorkoutFromSession as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();
const replace = jest.fn();

const plan = (id: string) => ({
  id,
  exerciseId: 'ex-1',
  exerciseName: 'Squat',
  orderIndex: 0,
  setType: 'normal',
  targetSets: 4,
  targetReps: '8',
  targetWeightKg: 80,
  restSeconds: 120,
  musclePrimary: 'legs',
  musclesSecondary: [],
  musclesFine: [],
});

const seance = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Jour ${id}`,
  orderIndex: 0,
  sessionType: null,
  targetDistanceM: null,
  targetDurationSeconds: null,
  plans: [plan(`p-${id}`)],
  intervals: [],
  ...overrides,
});

const programme = (overrides: Record<string, unknown> = {}) => ({
  id: 'prog-1',
  name: 'Prise de masse',
  level: 'beginner',
  durationWeeks: 8,
  goal: null,
  isActive: false,
  sessions: [seance('a')],
  ...overrides,
});

/** `isOwned` se déduit de la présence dans « Mes programmes ». */
const afficher = async (detail: unknown = programme(), possede = true) => {
  mockDetail.mockReturnValue({ detail, isLoading: false });
  mockMine.mockReturnValue({
    programs: possede && detail ? [{ id: 'prog-1' }] : [],
    isLoading: false,
  });
  await render(<ProgramDetailScreen />);
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
  mockUseRouter.mockReturnValue({ push, replace });
  mockStart.mockResolvedValue(undefined);
  mockDuplicate.mockResolvedValue('prog-copie');
  mockDelete.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('🔴 pendant le premier chargement, n’affiche PAS « introuvable »', async () => {
    mockDetail.mockReturnValue({ detail: null, isLoading: true });
    mockMine.mockReturnValue({ programs: [], isLoading: false });

    await render(<ProgramDetailScreen />);

    // Un « programme introuvable » qui clignote à chaque ouverture ferait croire à une perte de
    // données là où il n'y a qu'une requête en vol.
    expect(screen.queryByText('programs.detail.notFoundTitle')).toBeNull();
  });

  it('programme introuvable → mention explicite', async () => {
    await afficher(null);

    expect(screen.getByText('programs.detail.notFoundTitle')).toBeTruthy();
  });

  it('affiche le nom et les métadonnées disponibles', async () => {
    await afficher();

    expect(screen.getByText('Prise de masse')).toBeTruthy();
    expect(screen.getByText(/programs\.level\.beginner.*programs\.weeks/)).toBeTruthy();
  });

  it('🔴 aucune ligne de métadonnées quand il n’y en a aucune', async () => {
    await afficher(programme({ level: null, durationWeeks: null, goal: null }));

    // Une ligne vide sous le titre se lit comme une donnée perdue.
    expect(screen.queryByText(/programs\.level\./)).toBeNull();
  });

  it('signale un programme actif', async () => {
    await afficher(programme({ isActive: true }));

    expect(screen.getByText('programs.active')).toBeTruthy();
  });

  it('un programme sans séance le dit', async () => {
    await afficher(programme({ sessions: [] }));

    expect(screen.getByText('programs.detail.emptySessions')).toBeTruthy();
  });

  it('🔴 une séance sans nom retombe sur son rang, numéroté à partir de 1', async () => {
    await afficher(programme({ sessions: [seance('a', { name: '  ', orderIndex: 2 })] }));

    expect(screen.getByText('programs.detail.sessionFallback:{"index":3}')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Éditorial contre possédé
// ---------------------------------------------------------------------------

describe('éditorial contre possédé', () => {
  // ── Réécrit le 10/09/2026 (US MUSCU-UX01) ────────────────────────────────────────────────────
  // La règle de fond n'a pas changé : on n'active jamais un programme éditorial, sinon le local
  // et le cloud divergent. Ce qui change, c'est **qui porte cette contrainte**. Avant, elle était
  // remontée à l'utilisateur, qui devait « Dupliquer », atterrir sur la copie, puis « Démarrer » —
  // une contrainte d'implémentation transformée en décision. Elle est désormais implicite.

  it('🔴 un programme ÉDITORIAL se suit d’un seul geste, et ne propose pas de suppression', async () => {
    await afficher(programme(), false);

    expect(screen.getByText('programs.detail.followProgram')).toBeTruthy();
    // Supprimer un contenu éditorial n'a toujours aucun sens : il n'appartient pas à l'utilisateur.
    expect(screen.queryByText('programs.detail.delete')).toBeNull();
    // Et l'édition non plus, tant que la copie n'existe pas.
    expect(screen.queryByText('programs.detail.edit')).toBeNull();
    // La conséquence est annoncée, plutôt que posée en question.
    expect(screen.getByText('programs.detail.followHint')).toBeTruthy();
  });

  it('🔴 un programme POSSÉDÉ porte le même geste principal, plus l’édition', async () => {
    await afficher(programme(), true);

    expect(screen.getByText('programs.detail.followProgram')).toBeTruthy();
    expect(screen.getByText('programs.detail.edit')).toBeTruthy();
    // Rien à annoncer : aucune copie ne sera créée.
    expect(screen.queryByText('programs.detail.followHint')).toBeNull();
  });

  it('un programme déjà actif propose de modifier son planning', async () => {
    await afficher(programme({ isActive: true }), true);

    // « Démarrer » sur un programme actif laisserait croire qu'on peut le relancer de zéro.
    expect(screen.getByText('programs.detail.editPlanning')).toBeTruthy();
  });

  it('🔴 un programme SANS séance ne peut pas être suivi', async () => {
    // L'assistant de planification serait vide, et `planProgram` lève de toute façon.
    await afficher(programme({ sessions: [] }), true);

    const bouton = screen.getByLabelText('programs.detail.followProgram');
    expect(bouton.props.accessibilityState?.disabled).toBe(true);
  });

  it('l’édition ouvre le bon écran', async () => {
    await afficher();

    await taper(screen.getByText('programs.detail.edit'));
    expect(push).toHaveBeenCalledWith('/programs/edit?id=prog-1');
  });
});

// ---------------------------------------------------------------------------
// Démarrer une séance
// ---------------------------------------------------------------------------

describe('démarrer une séance', () => {
  it('crée la séance puis ouvre l’écran de saisie', async () => {
    await afficher();

    await taper(screen.getByText('programs.detail.startSession'));

    expect(mockStart).toHaveBeenCalledWith('a');
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('🔴 une séance SANS exercice n’offre pas de bouton « Démarrer »', async () => {
    await afficher(programme({ sessions: [seance('a', { plans: [] })] }));

    // Lancer une séance vide mènerait à un écran de saisie sans rien à saisir.
    expect(screen.queryByText('programs.detail.startSession')).toBeNull();
    expect(screen.getByText('programs.detail.emptyPlans')).toBeTruthy();
  });

  it('🔴 deux appuis dans le MÊME cycle ne démarrent qu’une séance', async () => {
    let resoudre: (() => void) | undefined;
    mockStart.mockReturnValue(new Promise<void>((r) => (resoudre = r)));
    await afficher();

    const bouton = screen.getByText('programs.detail.startSession');
    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });

    // Verrou corrigé le 08/08/2026 (`useActionLock`) : deux séances créées, et l'utilisateur
    // remplirait la seconde pendant que la première reste ouverte pour toujours.
    expect(mockStart).toHaveBeenCalledTimes(1);
    resoudre?.();
  });

  it('🔴 démarrer une séance DÉSACTIVE les boutons des autres', async () => {
    let resoudre: (() => void) | undefined;
    mockStart.mockReturnValue(new Promise<void>((r) => (resoudre = r)));
    await afficher(
      programme({ sessions: [seance('a'), seance('b', { name: 'Jour B', orderIndex: 1 })] }),
    );

    await taper(screen.getAllByText('programs.detail.startSession')[0]!);

    // Sans ça, on démarre le jour A puis le jour B pendant que le premier est en vol : deux
    // séances ouvertes, et l'app n'en affiche qu'une.
    // Bornée aux boutons de séance : `startProgram` (la planification) n'est pas concerné.
    const boutonsSeance = screen.getAllByLabelText(/programs\.detail\.(startSession|starting)$/);
    expect(boutonsSeance).toHaveLength(2);
    expect(boutonsSeance.every((b) => b.props.accessibilityState?.disabled === true)).toBe(true);
    resoudre?.();
  });

  it('🔴 un échec de démarrage NE navigue pas', async () => {
    mockStart.mockRejectedValue(new Error('hors ligne'));
    await afficher();

    await taper(screen.getByText('programs.detail.startSession'));

    // Arriver sur un écran de séance vide serait pire que de rester sur le détail.
    expect(push).not.toHaveBeenCalledWith('/workout');
  });
});

// ---------------------------------------------------------------------------
// Duplication
// ---------------------------------------------------------------------------

describe('duplication implicite', () => {
  // US MUSCU-UX01 : la duplication n'est plus un geste de l'utilisateur, c'est ce que fait
  // « Suivre ce programme » sur un contenu éditorial. Les gardes restent les mêmes.

  it('🔴 planifie la COPIE, pas l’original', async () => {
    await afficher(programme(), false);

    await taper(screen.getByText('programs.detail.followProgram'));

    // Planifier l'original activerait un contenu éditorial : local et cloud divergeraient.
    expect(mockDuplicate).toHaveBeenCalledWith('prog-1');
    expect(push).toHaveBeenCalledWith('/planning/plan?id=prog-copie');
  });

  it('🔴 ne duplique PAS un programme déjà possédé', async () => {
    await afficher(programme(), true);

    await taper(screen.getByText('programs.detail.followProgram'));

    expect(mockDuplicate).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/planning/plan?id=prog-1');
  });

  it('annonce la copie APRÈS coup, sans la faire décider', async () => {
    await afficher(programme(), false);

    await taper(screen.getByText('programs.detail.followProgram'));

    // La copie a une conséquence visible — elle apparaît dans « Mes programmes » — donc on le dit.
    // Mais après : c'est une conséquence, pas un choix.
    expect(Alert.alert).toHaveBeenCalledWith(
      'programs.detail.copyCreatedTitle',
      'programs.detail.copyCreated',
    );
  });

  it('🔴 deux appuis dans le MÊME cycle ne créent qu’une copie', async () => {
    let resoudre: ((id: string) => void) | undefined;
    mockDuplicate.mockReturnValue(new Promise<string>((r) => (resoudre = r)));
    await afficher(programme(), false);

    const bouton = screen.getByText('programs.detail.followProgram');
    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });

    expect(mockDuplicate).toHaveBeenCalledTimes(1);
    resoudre?.('prog-copie');
  });

  it('🔴 un échec ne navigue pas, et laisse réessayer', async () => {
    mockDuplicate.mockRejectedValueOnce(new Error('transaction annulée'));
    await afficher(programme(), false);

    await taper(screen.getByText('programs.detail.followProgram'));
    // Ouvrir l'assistant après un échec planifierait un programme qui n'existe pas.
    expect(push).not.toHaveBeenCalled();

    // Le verrou doit être relâché : sinon le bouton reste mort jusqu'au prochain affichage.
    await taper(screen.getByText('programs.detail.followProgram'));
    expect(push).toHaveBeenCalledWith('/planning/plan?id=prog-copie');
  });
});

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

describe('suppression', () => {
  it('🔴 demande confirmation, en nommant le programme', async () => {
    await afficher();

    await taper(screen.getByText('programs.detail.delete'));

    // Supprimer un programme emporte ses séances et ses plans : la confirmation doit dire lequel.
    expect(Alert.alert).toHaveBeenCalledWith(
      'Prise de masse',
      expect.any(String),
      expect.any(Array),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('confirmer supprime puis quitte l’écran', async () => {
    await afficher();

    await taper(screen.getByText('programs.detail.delete'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'programs.detail.delete')?.onPress?.();
    });

    expect(mockDelete).toHaveBeenCalledWith('prog-1');
    // `replace` et non `push` : revenir sur un programme supprimé afficherait « introuvable ».
    expect(replace).toHaveBeenCalledWith('/programs');
  });

  it('annuler ne supprime rien', async () => {
    await afficher();

    await taper(screen.getByText('programs.detail.delete'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('🔴 un échec de suppression est ANNONCÉ et ne quitte pas l’écran', async () => {
    mockDelete.mockRejectedValue(new Error('rls'));
    await afficher();

    await taper(screen.getByText('programs.detail.delete'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'programs.detail.delete')?.onPress?.();
    });

    // Quitter sur un échec laisserait croire que le programme est supprimé — il réapparaîtrait à
    // la prochaine ouverture de la liste, sans explication.
    expect(replace).not.toHaveBeenCalledWith('/programs');
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'programs.detail.deleteError',
      'programs.detail.deleteErrorMessage',
    );
  });
});
