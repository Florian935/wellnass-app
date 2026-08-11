/**
 * Création / édition d'un programme de course (`app/running-programs/edit.tsx`).
 *
 * Écran à **0 %** avant ce fichier (111 instructions), et **il portait un quatorzième site du défaut
 * de double appui** : `onAddSession` gardait sur `if (addingSession) return`, un état React, qui ne
 * garde rien — deux appuis rapides tombent dans le même cycle de rendu et lisent tous deux `false`.
 * Résultat : deux séances créées portant la **même lettre**, puisque l'index est calculé avant
 * l'écriture. Corrigé le 11/08/2026 par `useActionLock`, et le test ci-dessous a été vu rouge
 * avant le correctif.
 *
 * Les deux autres décisions qui portent le risque :
 *
 *  1. **Un même fichier, deux écrans.** Sans `?id=`, c'est un formulaire de création qui bascule en
 *     édition (`replace`, pour ne pas laisser le formulaire vierge dans l'historique). Avec `?id=`,
 *     c'est le composeur.
 *  2. **L'édition enregistre À LA FRAPPE** (commit-on-change), pas seulement au `onBlur` : sur
 *     Android, taper « Terminé » ne fait pas nécessairement perdre le focus au champ, et la saisie
 *     serait perdue. PowerSync coalesce les écritures locales, donc le coût est nul.
 *
 * Une durée non entière ou négative n'écrit **rien** — plutôt que d'écrire `NaN`, qui traverserait
 * la validation Zod côté client et casserait l'affichage du détail.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RunningProgramEditScreen from '../edit';
import {
  addSession,
  createProgram,
  updateProgram,
  updateProgramTranslation,
  useProgramDetail,
} from '@/data/repositories/program-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  useProgramDetail: jest.fn(() => ({ detail: null, isLoading: false })),
  createProgram: jest.fn(),
  addSession: jest.fn(),
  updateProgram: jest.fn(),
  updateProgramTranslation: jest.fn(),
}));

/** L'éditeur de séance a ses propres tests (22) : sonde, pour prouver le montage et l'ordre. */
jest.mock('@/components/running/RunningSessionEditor', () => {
  const { Text } = require('react-native');
  return {
    RunningSessionEditor: ({
      session,
      fallbackName,
    }: {
      session: { id: string };
      fallbackName: string;
    }) => <Text>seance:{session.id}:{fallbackName}</Text>,
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
      onBlur,
    }: {
      label: string;
      value: string;
      onChangeText: (v: string) => void;
      onBlur?: () => void;
    }) => (
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} onBlur={onBlur} />
    ),
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
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#33291f', textMuted: '#96856f', accent: '#c0562f' },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockDetail = useProgramDetail as jest.Mock;
const mockCreate = createProgram as jest.Mock;
const mockAddSession = addSession as jest.Mock;
const mockUpdate = updateProgram as jest.Mock;
const mockUpdateTranslation = updateProgramTranslation as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();
const replace = jest.fn();
const back = jest.fn();

const programme = (overrides: Record<string, unknown> = {}) => ({
  id: 'rp-1',
  name: '10 km en 8 semaines',
  summary: null,
  goal: null,
  level: null,
  durationWeeks: null,
  isActive: false,
  sessions: [],
  ...overrides,
});

/** Formulaire de création : aucun `?id=`. */
const afficherCreation = async () => {
  mockParams.mockReturnValue({});
  await render(<RunningProgramEditScreen />);
};

/** Composeur : `?id=rp-1`. */
const afficherComposeur = async (detail: unknown = programme(), isLoading = false) => {
  mockParams.mockReturnValue({ id: 'rp-1' });
  mockDetail.mockReturnValue({ detail, isLoading });
  await render(<RunningProgramEditScreen />);
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

const quitterLeChamp = async (label: string) => {
  await act(async () => {
    fireEvent(screen.getByLabelText(label), 'blur');
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push, replace, back });
  mockDetail.mockReturnValue({ detail: null, isLoading: false });
  mockCreate.mockResolvedValue('rp-neuf');
  mockAddSession.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockUpdateTranslation.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

describe('création', () => {
  it('🔴 le nom est REQUIS', async () => {
    await afficherCreation();

    // Un programme sans nom serait indistinguable des autres dans « Mes programmes » — et rien
    // ne permettrait de le retrouver pour le renommer.
    expect(
      screen.getByLabelText('running.program.createCta').props.accessibilityState.disabled,
    ).toBe(true);

    await saisir('running.program.name', 'Mon plan');
    expect(
      screen.getByLabelText('running.program.createCta').props.accessibilityState.disabled,
    ).toBe(false);
  });

  it('🔴 un nom fait d’espaces ne suffit pas', async () => {
    await afficherCreation();

    await saisir('running.program.name', '   ');

    expect(
      screen.getByLabelText('running.program.createCta').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('crée un programme de COURSE, avec le nom détouré', async () => {
    await afficherCreation();

    await saisir('running.program.name', '  Mon plan  ');
    await taper(screen.getByLabelText('running.program.createCta'));

    // Sans `pillar`, le programme apparaîtrait dans l'onglet musculation.
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ pillar: 'running', name: 'Mon plan' }),
    );
  });

  it('🔴 objectif et niveau non renseignés partent à `null`, pas à « none »', async () => {
    await afficherCreation();

    await saisir('running.program.name', 'Mon plan');
    await taper(screen.getByLabelText('running.program.createCta'));

    // `none` est une sentinelle d'interface : l'écrire en base créerait une valeur d'énumération
    // qui n'existe pas, et les filtres de la bibliothèque ne la retrouveraient jamais.
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ goal: null, level: null, durationWeeks: null }),
    );
  });

  it('objectif et niveau choisis sont transmis', async () => {
    await afficherCreation();

    await saisir('running.program.name', 'Mon plan');
    await taper(screen.getByLabelText('choix-10k'));
    await taper(screen.getByLabelText('choix-beginner'));
    await taper(screen.getByLabelText('running.program.createCta'));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ goal: '10k', level: 'beginner' }),
    );
  });

  it.each([
    ['8', 8],
    ['', null],
    ['0', null],
    ['-4', null],
    ['8.5', null],
    ['abc', null],
  ])('durée « %s » → %s', async (saisie, attendu) => {
    await afficherCreation();

    await saisir('running.program.name', 'Mon plan');
    await saisir('running.program.durationWeeks', saisie);
    await taper(screen.getByLabelText('running.program.createCta'));

    // Tout ce qui n'est pas un entier strictement positif vaut « non renseigné ». Écrire `NaN`
    // traverserait la validation côté client et casserait l'affichage du détail.
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ durationWeeks: attendu }));
  });

  it('🔴 la création BASCULE en édition, en remplaçant le formulaire', async () => {
    await afficherCreation();

    await saisir('running.program.name', 'Mon plan');
    await taper(screen.getByLabelText('running.program.createCta'));

    // `replace` : laisser le formulaire vierge dans l'historique ferait revenir dessus au retour,
    // et un second appui créerait un doublon.
    expect(replace).toHaveBeenCalledWith('/running-programs/edit?id=rp-neuf');
  });

  it('🔴 un échec REND la main au lieu de bloquer le formulaire', async () => {
    mockCreate.mockRejectedValue(new Error('hors ligne'));
    await afficherCreation();

    await saisir('running.program.name', 'Mon plan');
    await taper(screen.getByLabelText('running.program.createCta'));

    expect(replace).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText('running.program.createCta').props.accessibilityState.disabled,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Composeur — chargement et séances
// ---------------------------------------------------------------------------

describe('composeur', () => {
  it('un chargement n’affiche pas un formulaire vide', async () => {
    await afficherComposeur(null, true);

    // Des champs vides puis remplis se lisent comme une perte de données.
    expect(screen.queryByLabelText('running.program.name')).toBeNull();
  });

  it('les séances sont montées dans l’ordre, avec leur lettre de repli', async () => {
    await afficherComposeur(
      programme({ sessions: [{ id: 's-1' }, { id: 's-2' }] }),
    );

    expect(
      screen.getByText('seance:s-1:running.program.sessionDefaultName:{"letter":"A"}'),
    ).toBeTruthy();
    expect(
      screen.getByText('seance:s-2:running.program.sessionDefaultName:{"letter":"B"}'),
    ).toBeTruthy();
  });

  it('un programme sans séance le dit', async () => {
    await afficherComposeur();

    expect(screen.getByText('running.program.emptySessions')).toBeTruthy();
  });

  it('ajouter une séance la nomme d’après son RANG', async () => {
    await afficherComposeur(programme({ sessions: [{ id: 's-1' }, { id: 's-2' }] }));

    await taper(screen.getByLabelText('running.program.addSession'));

    // La troisième séance est « C » : repartir de A produirait deux séances homonymes.
    expect(mockAddSession).toHaveBeenCalledWith('rp-1', {
      name: 'running.program.sessionDefaultName:{"letter":"C"}',
    });
  });

  it('🔴 deux appuis dans le MÊME cycle n’ajoutent qu’UNE séance', async () => {
    let resoudre: (() => void) | undefined;
    mockAddSession.mockReturnValue(new Promise<void>((r) => (resoudre = r)));
    await afficherComposeur();

    const b = screen.getByLabelText('running.program.addSession');
    await act(async () => {
      fireEvent.press(b);
      fireEvent.press(b);
    });

    // Quatorzième site du défaut du 08/08/2026, trouvé le 11/08 en écrivant ce test :
    // `if (addingSession) return` lit un état React, et deux appuis du même cycle le lisent tous
    // deux à `false`. Deux séances créées, portant la MÊME lettre — l'index étant calculé avant
    // l'écriture, la seconde ne voit pas la première.
    expect(mockAddSession).toHaveBeenCalledTimes(1);
    resoudre?.();
  });

  it('« terminé » referme l’écran', async () => {
    await afficherComposeur();

    await taper(screen.getByLabelText('running.program.done'));

    expect(back).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Composeur — métadonnées
// ---------------------------------------------------------------------------

describe('métadonnées éditables', () => {
  it('🔴 le nom est enregistré À LA FRAPPE, pas seulement au blur', async () => {
    await afficherComposeur();

    await saisir('running.program.name', 'Nouveau nom');

    // Sur Android, taper « Terminé » ne fait pas nécessairement perdre le focus au champ : le
    // `onBlur` ne se déclencherait pas et la saisie serait perdue. PowerSync coalesce les
    // écritures locales, donc écrire à chaque frappe ne coûte rien.
    expect(mockUpdateTranslation).toHaveBeenCalledWith('rp-1', { name: 'Nouveau nom' });
  });

  it('🔴 un nom VIDÉ n’écrase pas le nom existant', async () => {
    await afficherComposeur();

    await saisir('running.program.name', '');
    await quitterLeChamp('running.program.name');

    // Effacer le champ pour retaper laisserait sinon le programme sans nom entre deux frappes —
    // et un programme sans nom est introuvable dans la liste.
    expect(mockUpdateTranslation).not.toHaveBeenCalled();
  });

  it('🔴 un résumé vidé, lui, est bien EFFACÉ', async () => {
    await afficherComposeur(programme({ summary: 'Ancien résumé' }));

    await saisir('running.program.summary', '');

    // Contrairement au nom, le résumé est facultatif : sans ce `null`, on ne pourrait jamais le
    // retirer une fois écrit.
    expect(mockUpdateTranslation).toHaveBeenCalledWith('rp-1', { summary: null });
  });

  it('objectif et niveau s’enregistrent au choix, sentinelle traduite en `null`', async () => {
    await afficherComposeur(programme({ goal: '10k' }));

    await taper(screen.getByLabelText('choix-semi'));
    expect(mockUpdate).toHaveBeenCalledWith('rp-1', { goal: 'semi' });

    // Deux segments portent une option « none » (objectif et niveau) : le premier est l'objectif,
    // dans l'ordre d'affichage.
    await taper(screen.getAllByLabelText('choix-none')[0]!);
    expect(mockUpdate).toHaveBeenLastCalledWith('rp-1', { goal: null });
  });

  it('le niveau suit la même règle', async () => {
    await afficherComposeur();

    await taper(screen.getByLabelText('choix-advanced'));

    expect(mockUpdate).toHaveBeenCalledWith('rp-1', { level: 'advanced' });
  });

  it.each([
    ['12', { durationWeeks: 12 }],
    ['', { durationWeeks: null }],
  ])('durée « %s » est enregistrée', async (saisie, attendu) => {
    await afficherComposeur();

    await saisir('running.program.durationWeeks', saisie);

    expect(mockUpdate).toHaveBeenCalledWith('rp-1', attendu);
  });

  it.each(['0', '-3', '7.5', 'abc'])('🔴 durée invalide « %s » n’écrit RIEN', async (saisie) => {
    await afficherComposeur();

    await saisir('running.program.durationWeeks', saisie);

    // Ni écriture, ni message : la saisie est en cours. Écrire `NaN` ou `0` figerait une valeur
    // fausse que l'utilisateur ne verrait qu'au prochain affichage du détail.
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('🔴 la saisie locale PRIME sur la donnée rechargée', async () => {
    await afficherComposeur(programme({ name: 'Ancien' }));

    await saisir('running.program.name', 'En cours de frappe');

    // La synchro peut renvoyer la valeur d'avant pendant qu'on tape : sans l'état local
    // prioritaire, le champ reviendrait à « Ancien » sous les doigts de l'utilisateur.
    expect(screen.getByLabelText('running.program.name').props.value).toBe('En cours de frappe');
  });

  it('les valeurs existantes pré-remplissent les champs', async () => {
    await afficherComposeur(
      programme({ name: 'Plan 10 km', summary: 'Huit semaines', durationWeeks: 8 }),
    );

    expect(screen.getByLabelText('running.program.name').props.value).toBe('Plan 10 km');
    expect(screen.getByLabelText('running.program.summary').props.value).toBe('Huit semaines');
    expect(screen.getByLabelText('running.program.durationWeeks').props.value).toBe('8');
  });
});
