/**
 * Bibliothèque et mes programmes (`app/programs/index.tsx`) — le **vrai** écran, monté.
 *
 * ⚠️ Ce fichier **remplace** `components/programs/__tests__/programs-smoke.test.tsx`, qui testait
 * une réécriture locale (`ProgramListLabel`) au lieu de l'écran. On pouvait supprimer l'écran
 * entier : il restait vert. Voir §3.7 de `strategie-tests.md`.
 *
 * Ce que cet écran porte, et que le repository ne dit pas :
 *
 *  1. **Le filtre de pilier `strength` est OBLIGATOIRE sur les deux listes.** Sans lui, les
 *     programmes de course apparaissaient dans la bibliothèque muscu — une fuite inter-piliers qui
 *     contredit la décision H (« intégration sans imposition ») : l'onglet d'un pilier non activé
 *     est masqué, mais son contenu ne doit pas fuir dans un autre.
 *  2. **La duplication a un verrou.** Elle crée un programme puis navigue vers lui ; deux appuis
 *     rapides créeraient deux copies, dont une orpheline que l'utilisateur ne verra jamais.
 *  3. **Une duplication qui échoue ne navigue pas** — mais laisse l'écran utilisable, y compris
 *     pour réessayer.
 *  4. **Deux sections, deux états vides distincts.** « Aucun programme en bibliothèque » et
 *     « tu n'as pas encore de programme » ne veulent pas dire la même chose.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ProgramsScreen from '../index';
import {
  duplicateProgram,
  useMyPrograms,
  useProgramLibrary,
} from '@/data/repositories/program-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  useProgramLibrary: jest.fn(() => ({ programs: [], isLoading: false })),
  useMyPrograms: jest.fn(() => ({ programs: [], isLoading: false })),
  duplicateProgram: jest.fn(),
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
      background: '#f7eede',
      surface: '#fffaf2',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockLibrary = useProgramLibrary as jest.Mock;
const mockMine = useMyPrograms as jest.Mock;
const mockDuplicate = duplicateProgram as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

/** Un programme de liste. */
const programme = (overrides: Record<string, unknown> = {}) => ({
  id: 'prog-1',
  name: 'Force débutant',
  pillar: 'strength',
  level: 'beginner',
  goal: null,
  durationWeeks: 8,
  isActive: false,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockLibrary.mockReturnValue({ programs: [], isLoading: false });
  mockMine.mockReturnValue({ programs: [], isLoading: false });
  mockDuplicate.mockResolvedValue('prog-copie');
});

// ---------------------------------------------------------------------------
// Étanchéité des piliers
// ---------------------------------------------------------------------------

describe('étanchéité des piliers', () => {
  it('🔴 la bibliothèque est bornée au pilier muscu', async () => {
    await render(<ProgramsScreen />);

    // Sans ce filtre, les programmes de course remontaient dans la bibliothèque muscu — décision H
    // (« intégration sans imposition ») : le contenu d'un pilier ne fuit pas dans un autre.
    expect(mockLibrary).toHaveBeenCalledWith({ pillar: 'strength' });
  });

  it('🔴 « mes programmes » aussi', async () => {
    await render(<ProgramsScreen />);

    expect(mockMine).toHaveBeenCalledWith('strength');
  });

  it('le filtre de niveau s’ajoute au pilier, il ne le remplace pas', async () => {
    await render(<ProgramsScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('programs.level.intermediate'));
    });

    expect(mockLibrary).toHaveBeenLastCalledWith({ pillar: 'strength', level: 'intermediate' });
  });

  it('revenir à « tous les niveaux » retire le niveau, pas le pilier', async () => {
    await render(<ProgramsScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('programs.level.advanced'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('programs.levelAll'));
    });

    expect(mockLibrary).toHaveBeenLastCalledWith({ pillar: 'strength' });
  });
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('🔴 pendant le chargement, n’affiche AUCUN état vide', async () => {
    mockLibrary.mockReturnValue({ programs: [], isLoading: true });

    await render(<ProgramsScreen />);

    expect(screen.queryByText('programs.emptyLibrary')).toBeNull();
  });

  it('🔴 le chargement de l’UNE des deux listes suffit à attendre', async () => {
    mockMine.mockReturnValue({ programs: [], isLoading: true });

    await render(<ProgramsScreen />);

    // Afficher « tu n'as pas encore de programme » pendant que la requête tourne serait un
    // message faux, et le seul que l'utilisateur retiendra.
    expect(screen.queryByText('programs.emptyMine')).toBeNull();
  });

  it('deux sections, deux états vides distincts', async () => {
    await render(<ProgramsScreen />);

    // « Rien en bibliothèque » (problème de contenu) et « tu n'as pas encore de programme »
    // (invitation à en créer un) ne veulent pas dire la même chose.
    expect(screen.getByText('programs.emptyLibrary')).toBeTruthy();
    expect(screen.getByText('programs.emptyMine')).toBeTruthy();
  });

  it('affiche niveau et durée d’un programme', async () => {
    mockLibrary.mockReturnValue({ programs: [programme()], isLoading: false });

    await render(<ProgramsScreen />);

    // Le libellé de méta est composé de plusieurs enfants (`niveau · durée`) : on l'inspecte par
    // le contenu de la ligne plutôt que par une correspondance de texte, qui ne verrait qu'un
    // fragment.
    expect(screen.getByText('Force débutant')).toBeTruthy();
    const ligne = screen.getByLabelText('Force débutant');
    expect(JSON.stringify(ligne)).toContain('programs.level.beginner');
    expect(JSON.stringify(ligne)).toContain('programs.weeks');
  });

  it('signale le programme actif', async () => {
    mockMine.mockReturnValue({
      programs: [programme({ id: 'mien', name: 'Mon programme', isActive: true })],
      isLoading: false,
    });

    await render(<ProgramsScreen />);

    expect(screen.getByText('programs.active')).toBeTruthy();
  });

  it('ouvre un programme au tap', async () => {
    mockLibrary.mockReturnValue({ programs: [programme({ id: 'prog-42' })], isLoading: false });

    await render(<ProgramsScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Force débutant'));
    });

    expect(push).toHaveBeenCalledWith('/programs/prog-42');
  });

  it('ouvre la création depuis l’en-tête', async () => {
    await render(<ProgramsScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('programs.create'));
    });

    expect(push).toHaveBeenCalledWith('/programs/edit');
  });
});

// ---------------------------------------------------------------------------
// Duplication
// ---------------------------------------------------------------------------

describe('duplication', () => {
  const dupliquer = async () => {
    await act(async () => {
      fireEvent.press(screen.getByLabelText(/programs\.duplicateA11y/));
    });
  };

  beforeEach(() => {
    mockLibrary.mockReturnValue({ programs: [programme()], isLoading: false });
  });

  it('🔴 n’est proposée QUE sur la bibliothèque', async () => {
    mockLibrary.mockReturnValue({ programs: [], isLoading: false });
    mockMine.mockReturnValue({ programs: [programme({ id: 'mien' })], isLoading: false });

    await render(<ProgramsScreen />);

    // Dupliquer son propre programme n'a pas de sens ici : c'est l'écran d'édition qui le permet,
    // et l'offrir aux deux endroits multiplierait les copies quasi identiques.
    expect(screen.queryByLabelText(/programs\.duplicateA11y/)).toBeNull();
  });

  it('copie puis ouvre la copie — pas l’original', async () => {
    await render(<ProgramsScreen />);
    await dupliquer();

    // Ouvrir l'original laisserait croire que la duplication a échoué.
    expect(mockDuplicate).toHaveBeenCalledWith('prog-1');
    expect(push).toHaveBeenCalledWith('/programs/prog-copie');
  });

  it('🔴 deux appuis dans le même cycle de rendu ne créent qu’UNE copie', async () => {
    let resoudre: ((id: string) => void) | undefined;
    mockDuplicate.mockReturnValue(
      new Promise<string>((resolve) => {
        resoudre = resolve;
      }),
    );

    await render(<ProgramsScreen />);
    const bouton = screen.getByLabelText(/programs\.duplicateA11y/);
    // Même famille de défaut que les gardes de clôture corrigées le 07/08 : le second appui tombe
    // dans la même fermeture. Une copie orpheline que l'utilisateur ne verra jamais.
    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });

    resoudre?.('prog-copie');
    await act(async () => {});

    expect(mockDuplicate).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('🔴 un échec ne navigue pas, et laisse l’écran utilisable', async () => {
    mockDuplicate.mockRejectedValue(new Error('transaction annulée'));

    await render(<ProgramsScreen />);
    await dupliquer();

    // La copie partielle est impossible côté transaction : il n'y a rien à ouvrir, et rien à
    // nettoyer. Mais le verrou doit être relâché, sinon le bouton reste mort jusqu'au prochain
    // affichage de l'écran.
    expect(push).not.toHaveBeenCalled();

    mockDuplicate.mockResolvedValue('prog-copie');
    await dupliquer();
    expect(push).toHaveBeenCalledWith('/programs/prog-copie');
  });
});
