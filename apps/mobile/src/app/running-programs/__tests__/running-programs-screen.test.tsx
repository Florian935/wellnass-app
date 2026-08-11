/**
 * Liste des programmes de course (`app/running-programs/index.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier, et **le dernier à porter des verrous du 08/08/2026 sans test**
 * (créer, dupliquer). Avec `running-programs/[id]`, la dette est close pour de bon : **treize
 * verrous sur huit fichiers, tous couverts**.
 *
 * Ce que l'écran décide, et qui ne se voit dans aucun repository :
 *
 *  1. **Deux onglets, deux modèles d'interaction.** « Mes programmes » navigue vers le détail ;
 *     la bibliothèque n'y navigue **pas** — elle duplique, parce qu'un éditorial ne peut pas être
 *     activé (divergence local ↔ cloud). Le même geste sur deux onglets fait deux choses.
 *  2. **Le bouton « créer » n'existe que sur « Mes programmes ».** Créer depuis la bibliothèque
 *     n'a pas de sens : on n'écrit pas dans le catalogue éditorial.
 *  3. **Les filtres se combinent en ET**, et la sentinelle « Tous » n'ajoute **aucune** clause —
 *     un `goal: 'all'` envoyé au repository ne renverrait jamais rien.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunningProgramsScreen from '../index';
import {
  createProgram,
  duplicateProgram,
  useMyPrograms,
  useProgramLibrary,
} from '@/data/repositories/program-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  useMyPrograms: jest.fn(),
  useProgramLibrary: jest.fn(),
  createProgram: jest.fn(),
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

/** Le sélecteur d'onglet est testé chez lui : ici, deux boutons pour piloter la bascule. */
jest.mock('@/components/Segment', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Segment: <T,>({
      options,
      value,
      onChange,
      label,
    }: {
      options: readonly T[];
      value: T;
      onChange: (v: T) => void;
      label: (o: T) => string;
    }) =>
      options.map((o) => (
        <Pressable
          key={String(o)}
          accessibilityRole="button"
          accessibilityLabel={`onglet-${String(o)}`}
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
        >
          <Text>{label(o)}</Text>
        </Pressable>
      )),
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
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockMine = useMyPrograms as jest.Mock;
const mockLibrary = useProgramLibrary as jest.Mock;
const mockCreate = createProgram as jest.Mock;
const mockDuplicate = duplicateProgram as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'rp-1',
  name: '10 km en 8 semaines',
  goal: null,
  level: null,
  durationWeeks: null,
  isActive: false,
  ...overrides,
});

const afficher = async ({
  mine = [item()],
  library = [item({ id: 'lib-1', name: 'Semi-marathon' })],
  myLoading = false,
  libraryLoading = false,
}: {
  mine?: unknown[];
  library?: unknown[];
  myLoading?: boolean;
  libraryLoading?: boolean;
} = {}) => {
  mockMine.mockReturnValue({ programs: mine, isLoading: myLoading });
  mockLibrary.mockReturnValue({ programs: library, isLoading: libraryLoading });
  await render(<RunningProgramsScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** Bascule sur la bibliothèque — l'onglet par défaut est « Mes programmes ». */
const ouvrirBibliotheque = async () => {
  await taper(screen.getByLabelText('onglet-library'));
};

/** Derniers filtres réellement passés au repository. */
const derniersFiltres = () =>
  mockLibrary.mock.calls[mockLibrary.mock.calls.length - 1]![0] as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockCreate.mockResolvedValue('rp-neuf');
  mockDuplicate.mockResolvedValue('rp-copie');
});

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------

describe('onglets', () => {
  it('ouvre sur « Mes programmes »', async () => {
    await afficher();

    expect(screen.getByLabelText('onglet-mine').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('10 km en 8 semaines')).toBeTruthy();
  });

  it('🔴 le bouton « créer » n’existe QUE sur « Mes programmes »', async () => {
    await afficher();
    expect(screen.getByLabelText('running.program.create')).toBeTruthy();

    await ouvrirBibliotheque();

    // On n'écrit pas dans le catalogue éditorial : un « + » y serait une promesse fausse.
    expect(screen.queryByLabelText('running.program.create')).toBeNull();
  });

  it('🔴 les filtres n’existent QUE sur la bibliothèque', async () => {
    await afficher();
    expect(screen.queryByText('running.library.filterObjective')).toBeNull();

    await ouvrirBibliotheque();

    // Filtrer trois programmes personnels par objectif et niveau serait trois lignes de chips pour
    // une liste qu'on lit d'un coup d'œil.
    expect(screen.getByText('running.library.filterObjective')).toBeTruthy();
    expect(screen.getByText('running.library.filterLevel')).toBeTruthy();
    expect(screen.getByText('running.library.filterDuration')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Mes programmes
// ---------------------------------------------------------------------------

describe('mes programmes', () => {
  it('un chargement affiche l’indicateur, pas l’état vide', async () => {
    await afficher({ mine: [], myLoading: true });

    // « Aucun programme » pendant le chargement est un diagnostic faux, et le pire moment pour le
    // dire : juste avant que la liste n'arrive.
    expect(screen.queryByText('running.program.empty')).toBeNull();
  });

  it('une liste vide est annoncée', async () => {
    await afficher({ mine: [] });

    expect(screen.getByText('running.program.empty')).toBeTruthy();
  });

  it('un appui ouvre le détail', async () => {
    await afficher();

    await taper(screen.getByLabelText('10 km en 8 semaines'));
    expect(push).toHaveBeenCalledWith('/running-programs/rp-1');
  });

  it('la méta assemble ce qui est renseigné, et rien d’autre', async () => {
    await afficher({ mine: [item({ goal: '10k', level: null, durationWeeks: 8 })] });

    // `filter(Boolean)` : sans lui, un niveau absent laisserait « race10k ·  · 8 semaines ».
    expect(
      screen.getByText('running.objective.10k · programs.weeks:{"count":8}'),
    ).toBeTruthy();
  });

  it('le badge « actif » ne marque que le programme en cours', async () => {
    await afficher({
      mine: [item({ id: 'a', name: 'A', isActive: true }), item({ id: 'b', name: 'B' })],
    });

    expect(screen.getAllByText('running.program.activeBadge')).toHaveLength(1);
  });

  it('la liste demande UNIQUEMENT les programmes de course', async () => {
    await afficher();

    // Sans le pilier, les programmes de musculation apparaîtraient dans l'onglet running.
    expect(mockMine).toHaveBeenCalledWith('running');
  });
});

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

describe('création', () => {
  it('crée puis ouvre l’éditeur', async () => {
    await afficher();

    await taper(screen.getByLabelText('running.program.create'));

    expect(mockCreate).toHaveBeenCalledWith({
      pillar: 'running',
      name: 'running.program.createTitle',
    });
    expect(push).toHaveBeenCalledWith('/running-programs/edit?id=rp-neuf');
  });

  it('🔴 deux appuis dans le MÊME cycle ne créent qu’UN programme', async () => {
    let resoudre: ((id: string) => void) | undefined;
    mockCreate.mockReturnValue(new Promise<string>((r) => (resoudre = r)));
    await afficher();

    const b = screen.getByLabelText('running.program.create');
    await act(async () => {
      fireEvent.press(b);
      fireEvent.press(b);
    });

    // Verrou du 08/08/2026 : sans lui, deux programmes créés dont un orphelin — l'éditeur ne
    // s'ouvre que sur le second, le premier reste dans la liste sans que personne l'ait voulu.
    expect(mockCreate).toHaveBeenCalledTimes(1);
    resoudre?.('rp-neuf');
  });

  it('🔴 un échec RÉACTIVE le bouton', async () => {
    mockCreate.mockRejectedValue(new Error('hors ligne'));
    await afficher();

    await taper(screen.getByLabelText('running.program.create'));

    // `finally` : rester bloqué en création après un échec laisserait l'écran sans son action
    // principale jusqu'au prochain remontage.
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText('running.program.create').props.accessibilityState?.disabled,
    ).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// Bibliothèque
// ---------------------------------------------------------------------------

describe('bibliothèque', () => {
  it('🔴 une carte éditoriale ne NAVIGUE pas — elle duplique', async () => {
    await afficher();
    await ouvrirBibliotheque();

    await taper(screen.getByLabelText('running.library.use'));

    // Ouvrir le détail d'un éditorial pour l'activer ferait diverger le local et le cloud : la
    // seule sortie est la copie, et c'est la copie qu'on ouvre.
    expect(mockDuplicate).toHaveBeenCalledWith('lib-1');
    expect(push).toHaveBeenCalledWith('/running-programs/rp-copie');
  });

  it('🔴 deux appuis dans le MÊME cycle ne créent qu’une copie', async () => {
    let resoudre: ((id: string) => void) | undefined;
    mockDuplicate.mockReturnValue(new Promise<string>((r) => (resoudre = r)));
    await afficher();
    await ouvrirBibliotheque();

    const b = screen.getByLabelText('running.library.use');
    await act(async () => {
      fireEvent.press(b);
      fireEvent.press(b);
    });

    expect(mockDuplicate).toHaveBeenCalledTimes(1);
    resoudre?.('rp-copie');
  });

  it('🔴 le verrou est PARTAGÉ entre les cartes, pas par carte', async () => {
    let resoudre: ((id: string) => void) | undefined;
    mockDuplicate.mockReturnValue(new Promise<string>((r) => (resoudre = r)));
    await afficher({
      library: [item({ id: 'lib-1', name: 'A' }), item({ id: 'lib-2', name: 'B' })],
    });
    await ouvrirBibliotheque();

    const boutons = screen.getAllByLabelText('running.library.use');
    await act(async () => {
      fireEvent.press(boutons[0]!);
      fireEvent.press(boutons[1]!);
    });

    // Choix délibéré : `duplicating` ne mémorise **qu'un** identifiant, donc deux copies
    // simultanées n'auraient qu'un seul indicateur de progression. Une seule à la fois, et la
    // seconde repart d'un appui.
    expect(mockDuplicate).toHaveBeenCalledTimes(1);
    expect(mockDuplicate).toHaveBeenCalledWith('lib-1');
    resoudre?.('rp-copie');
  });

  it('un échec de copie reste sur la liste', async () => {
    mockDuplicate.mockRejectedValue(new Error('transaction annulée'));
    await afficher();
    await ouvrirBibliotheque();

    await taper(screen.getByLabelText('running.library.use'));

    // La transaction garantit l'absence de copie partielle : rien à nettoyer, rien à annoncer.
    expect(push).not.toHaveBeenCalled();
  });

  it('un chargement n’affiche pas l’état vide', async () => {
    await afficher({ library: [], libraryLoading: true });
    await ouvrirBibliotheque();

    expect(screen.queryByText('running.library.empty')).toBeNull();
  });

  it('une bibliothèque filtrée à vide le dit', async () => {
    await afficher({ library: [] });
    await ouvrirBibliotheque();

    // C'est l'état le plus fréquent après trois filtres : il doit se distinguer d'un écran cassé.
    expect(screen.getByText('running.library.empty')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Filtres
// ---------------------------------------------------------------------------

describe('filtres', () => {
  it('🔴 « Tous » n’envoie AUCUNE clause', async () => {
    await afficher();
    await ouvrirBibliotheque();

    // Un `goal: 'all'` transmis au repository serait comparé à une valeur d'énumération qui
    // n'existe pas : la bibliothèque reviendrait vide, sans erreur.
    expect(derniersFiltres()).toEqual({ pillar: 'running' });
  });

  it('un filtre sélectionné est ajouté à la requête', async () => {
    await afficher();
    await ouvrirBibliotheque();

    await taper(screen.getByText('running.objective.10k'));

    expect(derniersFiltres()).toMatchObject({ pillar: 'running', goal: '10k' });
  });

  it('🔴 les filtres se COMBINENT en ET', async () => {
    await afficher();
    await ouvrirBibliotheque();

    await taper(screen.getByText('running.objective.10k'));
    await taper(screen.getByText('running.programLevel.beginner'));
    await taper(screen.getByText('programs.weeks:{"count":8}'));

    // Chaque chip remplace la valeur de SON groupe et laisse les autres : sélectionner le niveau
    // ne doit pas effacer l'objectif déjà choisi.
    expect(derniersFiltres()).toEqual({
      pillar: 'running',
      goal: '10k',
      level: 'beginner',
      durationWeeks: 8,
    });
  });

  it('revenir sur « Tous » RETIRE la clause', async () => {
    await afficher();
    await ouvrirBibliotheque();

    await taper(screen.getByText('running.objective.10k'));
    expect(derniersFiltres()).toMatchObject({ goal: '10k' });

    // Trois chips « Tous » (objectif, niveau, durée) : le premier est celui de l'objectif.
    await taper(screen.getAllByText('running.library.filterAll')[0]!);

    // Sans ce retrait, « Tous » serait un filtre de plus au lieu d'être son absence.
    expect(derniersFiltres()).toEqual({ pillar: 'running' });
  });

  it('la chip sélectionnée est annoncée comme telle', async () => {
    await afficher();
    await ouvrirBibliotheque();

    await taper(screen.getByText('running.objective.10k'));

    // `accessibilityState.selected` : sans lui, un lecteur d'écran énonce cinq chips identiques
    // sans dire laquelle est active.
    const chip = screen.getByText('running.objective.10k').parent;
    expect(chip?.props.accessibilityState?.selected).toBe(true);
  });
});
