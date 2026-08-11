/**
 * Détail d'un modèle de séance (`app/templates/[id].tsx`, US Refonte-D §2).
 *
 * Écran à **0 %** avant ce fichier, et **il porte trois autres verrous corrigés le 08/08/2026**
 * (démarrer, dupliquer, supprimer) restés sans test. Avec `programs/[id]`, cela clôt la dette :
 * les neuf gardes corrigées ce jour-là sont désormais couvertes.
 *
 * Deux règles propres à cet écran :
 *
 *  1. **Un modèle SANS exercice ne peut pas être démarré** — lancer une séance vide mènerait à un
 *     écran de saisie sans rien à saisir. Le bouton reste **affiché mais désactivé** : le retirer
 *     ferait sauter la mise en page des trois actions au moment où l'utilisateur ajoute son
 *     premier exercice.
 *  2. **Tant que le modèle n'est pas chargé, aucune action n'est offerte.** Un « Supprimer » sur un
 *     modèle qu'on n'a pas encore lu — ou qui a été supprimé depuis un autre appareil — est une
 *     action sur du vide.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TemplateDetailScreen from '../[id]';
import {
  deleteWorkoutTemplate,
  duplicateWorkoutTemplate,
  startWorkoutFromTemplate,
  useWorkoutTemplateDetail,
} from '@/data/repositories/workout-template-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-template-repository', () => ({
  useWorkoutTemplateDetail: jest.fn(),
  startWorkoutFromTemplate: jest.fn(),
  duplicateWorkoutTemplate: jest.fn(),
  deleteWorkoutTemplate: jest.fn(),
}));

/** Le composeur a ses propres tests : sonde ici, pour prouver qu'il est monté. */
jest.mock('@/components/templates/TemplateComposer', () => {
  const { Text } = require('react-native');
  return {
    TemplateComposer: ({ templateId }: { templateId: string }) => (
      <Text>composeur-{templateId}</Text>
    ),
  };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: () => ({ id: 'tpl-1' }),
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
      danger: '#b23b2e',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockDetail = useWorkoutTemplateDetail as jest.Mock;
const mockStart = startWorkoutFromTemplate as jest.Mock;
const mockDuplicate = duplicateWorkoutTemplate as jest.Mock;
const mockDelete = deleteWorkoutTemplate as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();
const replace = jest.fn();

const modele = (overrides: Record<string, unknown> = {}) => ({
  id: 'tpl-1',
  name: 'Full body',
  exercises: [{ id: 'e-1', exerciseId: 'ex-1', exerciseName: 'Squat' }],
  ...overrides,
});

const afficher = async (detail: unknown = modele()) => {
  mockDetail.mockReturnValue({ detail, isLoading: false });
  await render(<TemplateDetailScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const bouton = (cle: string) => screen.getByLabelText(cle);

let boutonsAlerte: { text?: string; onPress?: () => void }[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  boutonsAlerte = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockUseRouter.mockReturnValue({ push, replace });
  mockStart.mockResolvedValue(undefined);
  mockDuplicate.mockResolvedValue('tpl-copie');
  mockDelete.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('🔴 tant que le modèle n’est pas chargé, AUCUNE action n’est offerte', async () => {
    await afficher(null);

    // Un « Supprimer » sur un modèle qu'on n'a pas encore lu — ou supprimé depuis un autre
    // appareil — est une action sur du vide. Le composeur, lui, affiche déjà son propre état.
    expect(screen.getByText('composeur-tpl-1')).toBeTruthy();
    expect(screen.queryByText('templates.delete')).toBeNull();
    expect(screen.queryByText('templates.start')).toBeNull();
  });

  it('monte le composeur ET les trois actions quand le modèle est là', async () => {
    await afficher();

    expect(screen.getByText('composeur-tpl-1')).toBeTruthy();
    expect(screen.getByText('templates.start')).toBeTruthy();
    expect(screen.getByText('templates.duplicate')).toBeTruthy();
    expect(screen.getByText('templates.delete')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Démarrer
// ---------------------------------------------------------------------------

describe('démarrer', () => {
  it('crée la séance puis ouvre l’écran de saisie', async () => {
    await afficher();

    await taper(screen.getByText('templates.start'));

    expect(mockStart).toHaveBeenCalledWith('tpl-1');
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('🔴 un modèle SANS exercice garde le bouton, mais DÉSACTIVÉ', async () => {
    await afficher(modele({ exercises: [] }));

    // Le retirer ferait sauter la mise en page des trois actions au moment où l'utilisateur
    // ajoute son premier exercice — et lancer une séance vide mènerait à un écran sans rien.
    expect(bouton('templates.start').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('🔴 deux appuis dans le MÊME cycle ne démarrent qu’une séance', async () => {
    let resoudre: (() => void) | undefined;
    mockStart.mockReturnValue(new Promise<void>((r) => (resoudre = r)));
    await afficher();

    const b = screen.getByText('templates.start');
    await act(async () => {
      fireEvent.press(b);
      fireEvent.press(b);
    });

    // Verrou du 08/08/2026 : sans lui, deux séances créées, dont une reste ouverte pour toujours.
    expect(mockStart).toHaveBeenCalledTimes(1);
    resoudre?.();
  });

  it('🔴 un échec ne navigue pas, et laisse réessayer', async () => {
    mockStart.mockRejectedValueOnce(new Error('hors ligne'));
    await afficher();

    await taper(screen.getByText('templates.start'));
    expect(push).not.toHaveBeenCalled();

    await taper(screen.getByText('templates.start'));
    expect(push).toHaveBeenCalledWith('/workout');
  });
});

// ---------------------------------------------------------------------------
// Dupliquer
// ---------------------------------------------------------------------------

describe('dupliquer', () => {
  it('🔴 ouvre la COPIE, en REMPLAÇANT l’écran courant', async () => {
    await afficher();

    await taper(screen.getByText('templates.duplicate'));

    // `replace` et non `push` : empiler l'original sous la copie ferait revenir sur le modèle
    // d'origine au retour, ce qui se lit comme une duplication ratée.
    expect(mockDuplicate).toHaveBeenCalledWith('tpl-1');
    expect(replace).toHaveBeenCalledWith('/templates/tpl-copie');
  });

  it('🔴 deux appuis dans le MÊME cycle ne créent qu’une copie', async () => {
    let resoudre: ((id: string) => void) | undefined;
    mockDuplicate.mockReturnValue(new Promise<string>((r) => (resoudre = r)));
    await afficher();

    const b = screen.getByText('templates.duplicate');
    await act(async () => {
      fireEvent.press(b);
      fireEvent.press(b);
    });

    expect(mockDuplicate).toHaveBeenCalledTimes(1);
    resoudre?.('tpl-copie');
  });

  it('un échec reste sur le détail', async () => {
    mockDuplicate.mockRejectedValue(new Error('transaction annulée'));
    await afficher();

    await taper(screen.getByText('templates.duplicate'));

    // La copie partielle est impossible côté transaction : il n'y a rien à ouvrir, ni à nettoyer.
    expect(replace).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Supprimer
// ---------------------------------------------------------------------------

describe('supprimer', () => {
  it('🔴 demande confirmation, en NOMMANT le modèle', async () => {
    await afficher();

    await taper(screen.getByText('templates.delete'));

    expect(Alert.alert).toHaveBeenCalledWith('Full body', expect.any(String), expect.any(Array));
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('confirmer supprime puis quitte', async () => {
    await afficher();

    await taper(screen.getByText('templates.delete'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'templates.delete')?.onPress?.();
    });

    expect(mockDelete).toHaveBeenCalledWith('tpl-1');
    // `replace` : revenir sur un modèle supprimé afficherait un écran introuvable.
    expect(replace).toHaveBeenCalledWith('/templates');
  });

  it('annuler ne supprime rien', async () => {
    await afficher();

    await taper(screen.getByText('templates.delete'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('🔴 un échec ne quitte PAS l’écran', async () => {
    mockDelete.mockRejectedValue(new Error('rls'));
    await afficher();

    await taper(screen.getByText('templates.delete'));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'templates.delete')?.onPress?.();
    });

    // Quitter sur un échec laisserait croire à une suppression : le modèle réapparaîtrait dans la
    // liste sans explication.
    expect(replace).not.toHaveBeenCalledWith('/templates');
  });

  it('🔴 deux confirmations dans le MÊME cycle ne suppriment qu’une fois', async () => {
    let resoudre: (() => void) | undefined;
    mockDelete.mockReturnValue(new Promise<void>((r) => (resoudre = r)));
    await afficher();

    await taper(screen.getByText('templates.delete'));
    const confirmer = boutonsAlerte.find((b) => b.text === 'templates.delete')?.onPress;
    await act(async () => {
      confirmer?.();
      confirmer?.();
    });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    resoudre?.();
  });
});
