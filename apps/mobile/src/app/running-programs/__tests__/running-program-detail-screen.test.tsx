/**
 * Détail d'un programme de course (`app/running-programs/[id].tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier. Il porte **les deux derniers verrous** du 08/08/2026 qui
 * n'avaient encore aucun test (dupliquer, supprimer) : la note « les neuf sont couverts » écrite le
 * 11/08 était fausse, elle comptait `programs/` et oubliait `running-programs/`. C'est ce fichier
 * et son voisin `running-programs-screen` qui la rendent vraie.
 *
 * Trois règles propres à cet écran, aucune visible dans un repository :
 *
 *  1. **Un programme éditorial ne peut être ni planifié, ni modifié, ni supprimé** — seulement
 *     dupliqué. L'activer ferait diverger le local et le cloud, puisqu'il n'appartient à personne.
 *     La propriété se lit sur « Mes programmes », il n'y a pas de colonne pour ça.
 *  2. **Un échec de suppression est ANNONCÉ** — contrairement à la duplication, qui échoue en
 *     silence : une copie ratée ne perd rien, une suppression qu'on croit faite si.
 *  3. **Sans profil coureur, l'allure cible est remplacée par une invite**, pas masquée : une
 *     séance de fractionné sans allure ne dit pas à quelle vitesse courir.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunningProgramDetailScreen from '../[id]';
import {
  deleteProgram,
  duplicateProgram,
  useMyPrograms,
  useProgramDetail,
} from '@/data/repositories/program-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';
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
jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(() => ({ runnerProfile: null })),
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
jest.mock('@/components/CollapsibleCard', () => {
  const { Text, View } = require('react-native');
  return {
    CollapsibleCard: ({
      title,
      summary,
      children,
    }: {
      title: string;
      summary?: string;
      children?: React.ReactNode;
    }) => (
      <View>
        <Text>{title}</Text>
        {summary ? <Text>{summary}</Text> : null}
        {children}
      </View>
    ),
  };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: () => ({ id: 'rp-1' }),
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
      background: '#fffaf2',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatDistance: (km: number) => `${km} km`,
    formatPace: (s: number) => `${s}s`,
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockDetail = useProgramDetail as jest.Mock;
const mockMine = useMyPrograms as jest.Mock;
const mockDuplicate = duplicateProgram as jest.Mock;
const mockDelete = deleteProgram as jest.Mock;
const mockRunner = useRunnerProfile as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();
const replace = jest.fn();

const seance = (overrides: Record<string, unknown> = {}) => ({
  id: 's-1',
  name: null,
  sessionType: null,
  targetDistanceM: null,
  targetDurationSeconds: null,
  intervals: [],
  ...overrides,
});

const programme = (overrides: Record<string, unknown> = {}) => ({
  id: 'rp-1',
  name: '10 km en 8 semaines',
  goal: null,
  level: null,
  durationWeeks: null,
  isActive: false,
  sessions: [seance()],
  ...overrides,
});

/** `possede` pilote `useMyPrograms` : c'est ce qui distingue un programme éditorial du mien. */
const afficher = async (
  detail: unknown = programme(),
  { possede = true, isLoading = false }: { possede?: boolean; isLoading?: boolean } = {},
) => {
  mockDetail.mockReturnValue({ detail, isLoading });
  mockMine.mockReturnValue({ programs: possede ? [{ id: 'rp-1' }] : [] });
  await render(<RunningProgramDetailScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const bouton = (cle: string) => screen.getByLabelText(cle);

let boutonsAlerte: { text?: string; style?: string; onPress?: () => void }[] = [];
let titreAlerte: string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  boutonsAlerte = [];
  titreAlerte = undefined;
  jest.spyOn(Alert, 'alert').mockImplementation((titre, _m, boutons) => {
    titreAlerte = titre;
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockUseRouter.mockReturnValue({ push, replace });
  mockRunner.mockReturnValue({ runnerProfile: null });
  mockDuplicate.mockResolvedValue('rp-copie');
  mockDelete.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('🔴 « introuvable » ne clignote PAS pendant le premier chargement', async () => {
    await afficher(null, { isLoading: true });

    // `isLoading && !detail` : sans cette garde, l'écran affiche « programme introuvable » une
    // fraction de seconde à chaque ouverture, ce qui se lit comme une donnée perdue.
    expect(screen.queryByText('programs.detail.notFoundTitle')).toBeNull();
  });

  it('un programme réellement absent est annoncé, sans action', async () => {
    await afficher(null);

    expect(screen.getByText('programs.detail.notFoundTitle')).toBeTruthy();
    expect(screen.queryByLabelText('running.program.duplicate')).toBeNull();
    expect(screen.queryByLabelText('running.program.delete')).toBeNull();
  });

  it('le badge « actif » n’apparaît que sur le programme en cours', async () => {
    await afficher(programme({ isActive: true }));
    expect(screen.getByText('running.program.activeBadge')).toBeTruthy();
  });

  it('la ligne de méta est OMISE quand elle serait vide', async () => {
    await afficher(programme({ goal: null, level: null, durationWeeks: null }));

    // Un séparateur « · » seul, ou une ligne vide, occuperait la place d'une information absente.
    expect(screen.queryByText(/ · /)).toBeNull();
  });

  it('la méta assemble objectif, niveau et durée', async () => {
    await afficher(programme({ goal: 'race10k', level: 'beginner', durationWeeks: 8 }));

    expect(
      screen.getByText(
        'running.objective.race10k · running.programLevel.beginner · programs.weeks:{"count":8}',
      ),
    ).toBeTruthy();
  });

  it('un programme sans séance le dit au lieu d’afficher une liste vide', async () => {
    await afficher(programme({ sessions: [] }));

    expect(screen.getByText('running.program.emptySessions')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Propriété du programme
// ---------------------------------------------------------------------------

describe('programme éditorial', () => {
  it('🔴 ne peut être ni planifié, ni modifié, ni supprimé — seulement dupliqué', async () => {
    await afficher(programme(), { possede: false });

    // L'activer ferait diverger le local et le cloud : il n'appartient à personne. La duplication
    // est le seul chemin, et c'est elle qui crée l'exemplaire possédé.
    expect(screen.queryByLabelText('programs.detail.startProgram')).toBeNull();
    expect(screen.queryByLabelText('running.program.edit')).toBeNull();
    expect(screen.queryByLabelText('running.program.delete')).toBeNull();
    expect(bouton('running.program.duplicate')).toBeTruthy();
  });

  it('un programme possédé propose les quatre actions', async () => {
    await afficher(programme(), { possede: true });

    expect(bouton('programs.detail.startProgram')).toBeTruthy();
    expect(bouton('running.program.edit')).toBeTruthy();
    expect(bouton('running.program.duplicate')).toBeTruthy();
    expect(bouton('running.program.delete')).toBeTruthy();
  });

  it('un programme DÉJÀ actif propose de modifier le planning, pas de le démarrer', async () => {
    await afficher(programme({ isActive: true }));

    expect(bouton('programs.detail.editPlanning')).toBeTruthy();
    expect(screen.queryByLabelText('programs.detail.startProgram')).toBeNull();
  });

  it('planifier ouvre l’écran de planification du programme', async () => {
    await afficher(programme());

    await taper(bouton('programs.detail.startProgram'));
    expect(push).toHaveBeenCalledWith('/planning/plan?id=rp-1');
  });

  it('modifier ouvre l’éditeur du programme', async () => {
    await afficher(programme());

    await taper(bouton('running.program.edit'));
    expect(push).toHaveBeenCalledWith('/running-programs/edit?id=rp-1');
  });
});

// ---------------------------------------------------------------------------
// Dupliquer
// ---------------------------------------------------------------------------

describe('dupliquer', () => {
  it('🔴 ouvre la COPIE en REMPLAÇANT l’écran courant', async () => {
    await afficher(programme());

    await taper(bouton('running.program.duplicate'));

    // `replace` : empiler l'original sous la copie ferait revenir sur le programme d'origine au
    // retour, ce qui se lit comme une duplication ratée.
    expect(mockDuplicate).toHaveBeenCalledWith('rp-1');
    expect(replace).toHaveBeenCalledWith('/running-programs/rp-copie');
  });

  it('🔴 deux appuis dans le MÊME cycle ne créent qu’une copie', async () => {
    let resoudre: ((id: string) => void) | undefined;
    mockDuplicate.mockReturnValue(new Promise<string>((r) => (resoudre = r)));
    await afficher(programme());

    const b = bouton('running.program.duplicate');
    await act(async () => {
      fireEvent.press(b);
      fireEvent.press(b);
    });

    // Verrou du 08/08/2026 : un état React ne voit pas un second appui du même cycle de rendu.
    // Sans lui, deux programmes identiques dans « Mes programmes ».
    expect(mockDuplicate).toHaveBeenCalledTimes(1);
    resoudre?.('rp-copie');
  });

  it('un échec de duplication reste sur le détail, SANS alerte', async () => {
    mockDuplicate.mockRejectedValue(new Error('transaction annulée'));
    await afficher(programme());

    await taper(bouton('running.program.duplicate'));

    // La transaction interdit la copie partielle : il n'y a rien à nettoyer, et rien de perdu —
    // réessayer suffit. Une alerte ici serait du bruit.
    expect(replace).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('🔴 un échec RÉACTIVE le bouton', async () => {
    mockDuplicate.mockRejectedValue(new Error('hors ligne'));
    await afficher(programme());

    await taper(bouton('running.program.duplicate'));

    // `finally` : rester bloqué en « duplication… » après un échec laisserait l'écran inerte.
    expect(bouton('running.program.duplicate').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Supprimer
// ---------------------------------------------------------------------------

describe('supprimer', () => {
  it('🔴 demande confirmation en NOMMANT le programme', async () => {
    await afficher(programme({ name: '10 km en 8 semaines' }));

    await taper(bouton('running.program.delete'));

    // Le nom dans le titre est la seule chose qui distingue deux confirmations identiques quand on
    // supprime le mauvais programme d'une liste.
    expect(titreAlerte).toBe('10 km en 8 semaines');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('confirmer supprime puis quitte vers la liste', async () => {
    await afficher(programme());

    await taper(bouton('running.program.delete'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'running.program.delete')?.onPress?.();
    });

    expect(mockDelete).toHaveBeenCalledWith('rp-1');
    // `replace` : revenir sur un programme supprimé afficherait un écran introuvable.
    expect(replace).toHaveBeenCalledWith('/running-programs');
  });

  it('annuler ne supprime rien', async () => {
    await afficher(programme());

    await taper(bouton('running.program.delete'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('🔴 un échec de suppression est ANNONCÉ et ne quitte pas l’écran', async () => {
    mockDelete.mockRejectedValue(new Error('rls'));
    await afficher(programme());

    await taper(bouton('running.program.delete'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'running.program.delete')?.onPress?.();
    });

    // Contrairement à la duplication, l'échec est dit : quitter laisserait croire à une suppression,
    // et le programme réapparaîtrait dans la liste sans explication.
    expect(replace).not.toHaveBeenCalledWith('/running-programs');
    expect(titreAlerte).toBe('running.program.deleteError');
  });

  it('🔴 deux confirmations dans le MÊME cycle ne suppriment qu’une fois', async () => {
    let resoudre: (() => void) | undefined;
    mockDelete.mockReturnValue(new Promise<void>((r) => (resoudre = r)));
    await afficher(programme());

    await taper(bouton('running.program.delete'));
    const confirmer = boutonsAlerte.find((b) => b.text === 'running.program.delete')?.onPress;
    await act(async () => {
      confirmer?.();
      confirmer?.();
    });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    resoudre?.();
  });

  it('la suppression est proposée en style destructif, l’annulation en « cancel »', async () => {
    await afficher(programme());

    await taper(bouton('running.program.delete'));

    expect(boutonsAlerte.find((b) => b.text === 'running.program.delete')?.style).toBe('destructive');
    expect(boutonsAlerte.find((b) => b.text === 'common.cancel')?.style).toBe('cancel');
  });
});

// ---------------------------------------------------------------------------
// Cartes de séance
// ---------------------------------------------------------------------------

describe('cartes de séance', () => {
  it('une séance sans nom reçoit une lettre, dans l’ordre', async () => {
    await afficher(
      programme({ sessions: [seance({ id: 's-1' }), seance({ id: 's-2' })] }),
    );

    // Sans ce repli, deux séances vides seraient indistinguables dans la liste.
    expect(screen.getByText('running.program.sessionDefaultName:{"letter":"A"}')).toBeTruthy();
    expect(screen.getByText('running.program.sessionDefaultName:{"letter":"B"}')).toBeTruthy();
  });

  it('🔴 un nom fait d’espaces retombe sur la lettre', async () => {
    await afficher(programme({ sessions: [seance({ name: '   ' })] }));

    // `?.trim() || …` : un titre invisible dans la liste vaut un titre absent.
    expect(screen.getByText('running.program.sessionDefaultName:{"letter":"A"}')).toBeTruthy();
  });

  it('la cible en DISTANCE passe par le formateur d’unités', async () => {
    await afficher(programme({ sessions: [seance({ targetDistanceM: 5000 })] }));

    // Mètres en base, kilomètres (ou miles) à l'affichage : un « 5000 » brut serait illisible.
    // Deux occurrences attendues : le résumé de l'en-tête replié, et la puce du contenu déplié.
    expect(screen.getAllByText('5 km')).toHaveLength(2);
  });

  it('la cible en DURÉE est arrondie à la minute', async () => {
    await afficher(programme({ sessions: [seance({ targetDurationSeconds: 2730 })] }));

    expect(screen.getAllByText('46 min').length).toBeGreaterThan(0);
  });

  it('🔴 la distance PRIME sur la durée quand les deux sont posées', async () => {
    await afficher(
      programme({ sessions: [seance({ targetDistanceM: 5000, targetDurationSeconds: 1800 })] }),
    );

    // Afficher les deux donnerait une consigne ambiguë : court 5 km, ou court 30 min ?
    expect(screen.getAllByText('5 km').length).toBeGreaterThan(0);
    expect(screen.queryByText('30 min')).toBeNull();
  });

  it('une cible à ZÉRO est traitée comme absente', async () => {
    await afficher(
      programme({ sessions: [seance({ targetDistanceM: 0, targetDurationSeconds: 0 })] }),
    );

    // `> 0` et non `!= null` : une cible de 0 km est une donnée non renseignée, pas une consigne.
    expect(screen.queryByText('0 km')).toBeNull();
    expect(screen.queryByText('0 min')).toBeNull();
  });

  it('🔴 sans profil coureur, l’allure cible est remplacée par une INVITE', async () => {
    await afficher(programme({ sessions: [seance({ sessionType: 'endurance' })] }));

    // Masquer l'allure laisserait une séance d'endurance sans indication de vitesse — l'invite dit
    // quoi faire pour l'obtenir.
    expect(screen.getByText('running.program.noProfileHint')).toBeTruthy();
  });

  it('avec un profil, l’allure cible est une FOURCHETTE', async () => {
    mockRunner.mockReturnValue({ runnerProfile: { ref5kPaceSPerKm: 300 } });
    await afficher(programme({ sessions: [seance({ sessionType: 'endurance' })] }));

    // `sessionTargetPace` est pure (`@wellness/shared`), prise telle quelle : une allure unique
    // serait intenable au mètre près, la fourchette est ce qu'on peut réellement tenir.
    expect(screen.getByText(/^\d+s – \d+s$/)).toBeTruthy();
  });

  it('une séance SANS type n’affiche aucune allure', async () => {
    mockRunner.mockReturnValue({ runnerProfile: { ref5kPaceSPerKm: 300 } });
    await afficher(programme({ sessions: [seance({ sessionType: null })] }));

    // L'allure se déduit du type (tempo, seuil, fractionné…) : sans type, il n'y a rien à calculer.
    expect(screen.queryByText('running.program.noProfileHint')).toBeNull();
    expect(screen.queryByText(/s – /)).toBeNull();
  });
});
