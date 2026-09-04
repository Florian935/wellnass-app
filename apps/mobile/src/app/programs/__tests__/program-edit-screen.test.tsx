/**
 * Création / édition d'un programme de musculation (`app/programs/edit.tsx`).
 *
 * Écran à **0 %** avant ce fichier, et **il portait le quinzième site du défaut de double appui** —
 * jumeau exact de celui trouvé la veille dans `running-programs/edit.tsx` : `onAddSession` gardait
 * sur `if (addingSession) return`, un état React. Deux appuis du même cycle créaient **deux séances
 * portant la même lettre**, l'index étant calculé avant l'écriture. Corrigé le 14/08/2026.
 *
 * Le reste est le même contrat que son jumeau running, et c'est justement l'intérêt de le tester :
 * les deux écrans ont divergé une fois (le verrou), ils peuvent diverger encore.
 *
 *  - Sans `?id=`, c'est un formulaire de création qui **remplace** l'écran une fois créé — y revenir
 *    et réappuyer produirait un doublon.
 *  - Une durée non entière ou nulle vaut « non renseignée », jamais `NaN`.
 *  - Le pilier est **écrit explicitement** : sans lui, un programme de muscu atterrirait dans
 *    l'onglet course.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ProgramEditScreen from '../edit';
import { addSession, createProgram, useProgramDetail } from '@/data/repositories/program-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  useProgramDetail: jest.fn(() => ({ detail: null, isLoading: false })),
  createProgram: jest.fn(),
  addSession: jest.fn(),
}));

/** L'éditeur de séance a ses propres tests : sonde, pour prouver le montage et l'ordre. */
jest.mock('@/components/programs/SessionEditor', () => {
  const { Text } = require('react-native');
  return {
    SessionEditor: ({ session, fallbackName }: { session: { id: string }; fallbackName: string }) => (
      <Text>seance:{session.id}:{fallbackName}</Text>
    ),
  };
});

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text } = require('react-native');
  return { ScreenHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/components/TextField', () => {
  const { TextInput } = require('react-native');
  return {
    TextField: ({
      label,
      value,
      onChangeText,
    }: {
      label: string;
      value: string;
      onChangeText: (v: string) => void;
    }) => <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} />,
  };
});
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
          accessibilityLabel={`choix-${String(o)}`}
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
        >
          <Text>{label(o)}</Text>
        </Pressable>
      )),
  };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ colors: { text: '#33291f', textMuted: '#96856f', accent: '#c0562f' } }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockDetail = useProgramDetail as jest.Mock;
const mockCreate = createProgram as jest.Mock;
const mockAddSession = addSession as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const replace = jest.fn();
const back = jest.fn();

const programme = (overrides: Record<string, unknown> = {}) => ({
  id: 'p-1',
  name: 'Full body 3×',
  sessions: [] as { id: string }[],
  ...overrides,
});

const afficherCreation = async () => {
  mockParams.mockReturnValue({});
  await render(<ProgramEditScreen />);
};

const afficherComposeur = async (detail: unknown = programme(), isLoading = false) => {
  mockParams.mockReturnValue({ id: 'p-1' });
  mockDetail.mockReturnValue({ detail, isLoading });
  await render(<ProgramEditScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const saisir = async (label: string, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), valeur);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ replace, back });
  mockDetail.mockReturnValue({ detail: null, isLoading: false });
  mockCreate.mockResolvedValue('p-neuf');
  mockAddSession.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

describe('création', () => {
  it('🔴 le nom est requis, espaces exclus', async () => {
    await afficherCreation();

    expect(
      screen.getByLabelText('programs.edit.createCta').props.accessibilityState.disabled,
    ).toBe(true);

    await saisir('programs.edit.name', '   ');
    expect(
      screen.getByLabelText('programs.edit.createCta').props.accessibilityState.disabled,
    ).toBe(true);

    await saisir('programs.edit.name', 'Full body');
    expect(
      screen.getByLabelText('programs.edit.createCta').props.accessibilityState.disabled,
    ).toBe(false);
  });

  it('🔴 le pilier MUSCULATION est écrit explicitement', async () => {
    await afficherCreation();

    await saisir('programs.edit.name', 'Full body');
    await taper(screen.getByLabelText('programs.edit.createCta'));

    // Sans lui, le programme apparaîtrait dans l'onglet course — les deux listes filtrent sur ce
    // seul champ.
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ pillar: 'strength' }));
  });

  it('le nom est détouré avant écriture', async () => {
    await afficherCreation();

    await saisir('programs.edit.name', '  Full body  ');
    await taper(screen.getByLabelText('programs.edit.createCta'));

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Full body' }));
  });

  it('🔴 niveau et objectif non renseignés partent à `null`', async () => {
    await afficherCreation();

    await saisir('programs.edit.name', 'Full body');
    await taper(screen.getByLabelText('programs.edit.createCta'));

    // `none` est une sentinelle d'interface ; l'écrire créerait une valeur d'énumération que les
    // filtres ne retrouveraient jamais. Un objectif fait d'espaces vaut « non renseigné ».
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ level: null, goal: null, durationWeeks: null }),
    );
  });

  it('niveau et objectif saisis sont transmis', async () => {
    await afficherCreation();

    await saisir('programs.edit.name', 'Full body');
    await taper(screen.getByLabelText('choix-beginner'));
    await saisir('programs.edit.goal', 'Prise de masse');
    await taper(screen.getByLabelText('programs.edit.createCta'));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'beginner', goal: 'Prise de masse' }),
    );
  });

  it.each([
    ['12', 12],
    ['', null],
    ['0', null],
    ['-4', null],
    ['8.5', null],
    ['abc', null],
  ])('durée « %s » → %s', async (saisie, attendu) => {
    await afficherCreation();

    await saisir('programs.edit.name', 'Full body');
    await saisir('programs.edit.durationWeeks', saisie);
    await taper(screen.getByLabelText('programs.edit.createCta'));

    // Tout ce qui n'est pas un entier strictement positif vaut « non renseigné » : `NaN`
    // traverserait la validation côté client et casserait l'affichage du détail.
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ durationWeeks: attendu }));
  });

  it('🔴 la création REMPLACE le formulaire dans l’historique', async () => {
    await afficherCreation();

    await saisir('programs.edit.name', 'Full body');
    await taper(screen.getByLabelText('programs.edit.createCta'));

    // Y revenir et réappuyer produirait un doublon.
    expect(replace).toHaveBeenCalledWith('/programs/edit?id=p-neuf');
  });

  it('🔴 un échec REND la main', async () => {
    mockCreate.mockRejectedValue(new Error('hors ligne'));
    await afficherCreation();

    await saisir('programs.edit.name', 'Full body');
    await taper(screen.getByLabelText('programs.edit.createCta'));

    expect(replace).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText('programs.edit.createCta').props.accessibilityState.disabled,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

describe('composition', () => {
  it('un chargement n’affiche pas un écran vide', async () => {
    await afficherComposeur(null, true);

    expect(screen.queryByText('programs.edit.emptySessions')).toBeNull();
  });

  it('les séances sont montées dans l’ordre, avec leur lettre de repli', async () => {
    await afficherComposeur(programme({ sessions: [{ id: 's-1' }, { id: 's-2' }] }));

    expect(
      screen.getByText('seance:s-1:programs.edit.sessionDefaultName:{"letter":"A"}'),
    ).toBeTruthy();
    expect(
      screen.getByText('seance:s-2:programs.edit.sessionDefaultName:{"letter":"B"}'),
    ).toBeTruthy();
  });

  it('un programme sans séance le dit', async () => {
    await afficherComposeur();

    expect(screen.getByText('programs.edit.emptySessions')).toBeTruthy();
  });

  it('ajouter une séance la nomme d’après son RANG', async () => {
    await afficherComposeur(programme({ sessions: [{ id: 's-1' }, { id: 's-2' }] }));

    await taper(screen.getByLabelText('programs.edit.addSession'));

    // La troisième séance est « C » : repartir de A produirait deux séances homonymes.
    expect(mockAddSession).toHaveBeenCalledWith('p-1', {
      name: 'programs.edit.sessionDefaultName:{"letter":"C"}',
    });
  });

  it('🔴 deux appuis dans le MÊME cycle n’ajoutent qu’UNE séance', async () => {
    let resoudre: (() => void) | undefined;
    mockAddSession.mockReturnValue(new Promise<void>((r) => (resoudre = r)));
    await afficherComposeur();

    const b = screen.getByLabelText('programs.edit.addSession');
    await act(async () => {
      fireEvent.press(b);
      fireEvent.press(b);
    });

    // Quinzième site du défaut du 08/08/2026, jumeau exact de `running-programs/edit.tsx` : deux
    // séances créées portant la MÊME lettre, l'index étant calculé avant l'écriture.
    expect(mockAddSession).toHaveBeenCalledTimes(1);
    resoudre?.();
  });

  it('le nom du programme sert de titre une fois chargé', async () => {
    await afficherComposeur(programme({ name: 'Full body 3×' }));

    expect(screen.getByText('Full body 3×')).toBeTruthy();
  });

  it('« terminé » referme l’écran', async () => {
    await afficherComposeur();

    await taper(screen.getByLabelText('programs.edit.done'));

    expect(back).toHaveBeenCalled();
  });
});
