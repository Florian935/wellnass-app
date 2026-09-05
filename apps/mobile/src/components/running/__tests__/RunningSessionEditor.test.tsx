/**
 * Éditeur de séance de course dans un programme (`components/running/RunningSessionEditor`).
 *
 * Composant à **0 %** avant ce fichier. Il partage le patron commit-on-blur d'`IntervalBlockEditor`,
 * mais y ajoute **un second filet** — un commit-on-change silencieux — et c'est ce croisement qui
 * porte le risque.
 *
 *  1. **La saisie est enregistrée à la frappe, mais SANS jamais afficher l'erreur.** C'est le filet
 *     contre la perte de saisie quand « Terminé » est tapé sans que le champ perde le focus. Une
 *     erreur affichée à la frappe reprocherait à l'utilisateur d'avoir tapé « 1 » avant « 12 ».
 *  2. **La cible est distance OU durée**, jamais les deux : basculer remet l'autre à `null`.
 *  3. **Le type de séance est dérivé des données** tant que l'utilisateur n'a pas basculé le
 *     sélecteur. Le composant n'est pas remonté après un commit (`useProgramDetail` ré-émet) :
 *     un état local figé afficherait un champ vide sur une séance qui a une cible.
 *  4. **Les blocs de fractionné n'existent que pour le type `fractionne`** (R5) — les proposer
 *     ailleurs produirait une séance d'endurance avec des répétitions.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { RunningSessionEditor } from '../RunningSessionEditor';
import {
  addIntervalBlock,
  removeSession,
  updateRunningSession,
  type SessionDetail,
} from '@/data/repositories/program-repository';
import { useRunnerProfile } from '@/data/repositories/running-profile-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  updateRunningSession: jest.fn(),
  removeSession: jest.fn(),
  addIntervalBlock: jest.fn(),
  updateIntervalBlock: jest.fn(),
  removeIntervalBlock: jest.fn(),
}));

jest.mock('@/data/repositories/running-profile-repository', () => ({
  useRunnerProfile: jest.fn(() => ({ runnerProfile: null, isLoading: false })),
}));

/** L'éditeur de bloc a ses propres tests : ici, une sonde qui prouve qu'il est monté. */
jest.mock('@/components/running/IntervalBlockEditor', () => {
  const { Text } = require('react-native');
  return {
    IntervalBlockEditor: ({ block }: { block: { id: string } }) => <Text>bloc-{block.id}</Text>,
  };
});

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

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    distanceSymbol: 'km',
    distanceInputValue: (km: number | null | undefined) => (km == null ? '' : String(km)),
    formatPace: (s: number | null | undefined) => (s == null ? '—' : `${s} s/km`),
    parseDistanceToKm: (t: string) => {
      const n = Number(t.trim().replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : null;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockUpdate = updateRunningSession as jest.Mock;
const mockRemove = removeSession as jest.Mock;
const mockAddBlock = addIntervalBlock as jest.Mock;
const mockProfile = useRunnerProfile as jest.Mock;

const seance = (overrides: Partial<SessionDetail> = {}): SessionDetail =>
  ({
    id: 's-1',
    name: 'Sortie longue',
    orderIndex: 0,
    sessionType: null,
    targetDistanceM: 12000,
    targetDurationSeconds: null,
    intervals: [],
    plans: [],
    ...overrides,
  }) as SessionDetail;

const afficher = (s = seance()) =>
  render(<RunningSessionEditor session={s} fallbackName="Séance 1" />);

const champDistance = () => screen.getByPlaceholderText('running.program.targetDistancePlaceholder');
const champDuree = () => screen.getByPlaceholderText('running.program.targetDurationPlaceholder');

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const frapper = async (champ: ReturnType<typeof champDistance>, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(champ, valeur);
  });
};

const quitter = async (champ: ReturnType<typeof champDistance>) => {
  await act(async () => {
    fireEvent(champ, 'blur');
  });
};

let boutonsAlerte: { text?: string; onPress?: () => void }[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  boutonsAlerte = [];
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, boutons) => {
    boutonsAlerte = (boutons ?? []) as typeof boutonsAlerte;
  });
  mockProfile.mockReturnValue({ runnerProfile: null, isLoading: false });
  mockAddBlock.mockResolvedValue({ id: 'b-1', error: null });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Nom
// ---------------------------------------------------------------------------

describe('nom', () => {
  it('affiche le nom de la séance', async () => {
    await afficher();

    expect(screen.getByText('Sortie longue')).toBeTruthy();
  });

  it('🔴 un nom vide ou fait d’espaces retombe sur le repli fourni', async () => {
    await afficher(seance({ name: '   ' }));

    // Une carte d'édition sans titre, au milieu de plusieurs, ne se distingue plus des autres.
    expect(screen.getByText('Séance 1')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Type de séance
// ---------------------------------------------------------------------------

describe('type de séance', () => {
  it('aucun type sélectionné au départ sur une séance neuve', async () => {
    await afficher(seance({ sessionType: null }));

    const selectionnes = screen
      .getAllByRole('button')
      .filter((n) => n.props.accessibilityState?.selected === true);
    // Seul le toggle distance/durée est sélectionné par défaut, pas un type.
    expect(selectionnes).toHaveLength(1);
  });

  it('commite le type au tap, immédiatement', async () => {
    await afficher();

    await taper(screen.getByText('running.sessionType.fractionne'));

    // Pas de blur à attendre : le choix est explicite et sans ambiguïté.
    expect(mockUpdate).toHaveBeenCalledWith('s-1', { sessionType: 'fractionne' });
  });
});

// ---------------------------------------------------------------------------
// Cible
// ---------------------------------------------------------------------------

describe('cible', () => {
  it('🔴 DÉDUIT « durée » quand la séance porte une durée', async () => {
    await afficher(seance({ targetDistanceM: null, targetDurationSeconds: 2700 }));

    // Le composant n'est pas remonté après un commit (`useProgramDetail` ré-émet) : un état local
    // figé afficherait un champ de distance vide sur une séance qui a bien une cible.
    expect(champDuree().props.value).toBe('45');
  });

  it('pré-remplit la distance en kilomètres', async () => {
    await afficher();

    expect(champDistance().props.value).toBe('12');
  });

  it('🔴 enregistre à la FRAPPE, sans attendre le blur', async () => {
    await afficher();

    await frapper(champDistance(), '15');

    // Filet contre la perte de saisie quand « Terminé » est tapé sans que le champ perde le focus.
    expect(mockUpdate).toHaveBeenCalledWith('s-1', {
      targetDistanceM: 15000,
      targetDurationSeconds: null,
    });
  });

  it('🔴 n’affiche AUCUNE erreur pendant la frappe', async () => {
    await afficher();

    await frapper(champDistance(), '');

    // Reprocher un champ vide à quelqu'un qui vient d'effacer pour retaper serait hostile — et
    // l'erreur clignoterait entre chaque caractère.
    expect(screen.queryByText('running.program.targetRequired')).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('🔴 une cible vide au BLUR est refusée, et le dit', async () => {
    await afficher();

    await frapper(champDistance(), '');
    await quitter(champDistance());

    // Une séance de course sans cible n'a rien à exécuter : le guidage n'a aucune borne.
    expect(screen.getByText('running.program.targetRequired')).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('🔴 basculer vers la durée met la distance à NULL', async () => {
    await afficher();

    await taper(screen.getByText('running.program.targetDuration_label'));
    await frapper(champDuree(), '45');

    // Deux cibles concurrentes en base rendraient la comparaison post-course ambiguë (RUN-F2b).
    expect(mockUpdate).toHaveBeenCalledWith('s-1', {
      targetDurationSeconds: 2700,
      targetDistanceM: null,
    });
  });

  it('changer d’onglet efface l’erreur affichée', async () => {
    await afficher();

    await frapper(champDistance(), '');
    await quitter(champDistance());
    expect(screen.getByText('running.program.targetRequired')).toBeTruthy();

    await taper(screen.getByText('running.program.targetDuration_label'));

    // L'erreur portait sur le champ précédent : la garder au-dessus d'un champ neuf est un
    // reproche sans objet.
    expect(screen.queryByText('running.program.targetRequired')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Allure calculée
// ---------------------------------------------------------------------------

describe('allure calculée', () => {
  it('🔴 sans profil coureur, EXPLIQUE au lieu d’afficher une fourchette inventée', async () => {
    await afficher(seance({ sessionType: 'endurance' }));

    // Une allure cible se dérive du record de 5 km : sans référence, en afficher une serait une
    // consigne d'entraînement fabriquée.
    expect(screen.getByText('running.program.noProfileHint')).toBeTruthy();
  });

  it('affiche la fourchette d’allure quand le profil existe', async () => {
    mockProfile.mockReturnValue({ runnerProfile: { ref5kPaceSPerKm: 300 }, isLoading: false });

    await afficher(seance({ sessionType: 'endurance' }));

    expect(screen.getByText(/s\/km.*–.*s\/km/)).toBeTruthy();
  });

  it('🔴 aucune allure tant qu’aucun type n’est choisi', async () => {
    mockProfile.mockReturnValue({ runnerProfile: { ref5kPaceSPerKm: 300 }, isLoading: false });

    await afficher(seance({ sessionType: null }));

    // L'allure dépend du type : l'afficher avant le choix donnerait un chiffre qui change tout
    // seul dès qu'on sélectionne quelque chose.
    expect(screen.queryByText('running.program.noProfileHint')).toBeNull();
    expect(screen.queryByText(/s\/km/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Blocs de fractionné
// ---------------------------------------------------------------------------

describe('blocs de fractionné', () => {
  it('🔴 sont proposés sur TOUS les types de séance (US RUN-F4, lot B)', async () => {
    // Le verrou « fractionné uniquement » de RUN-F2c (R5) est LEVÉ. C'était le mur qui bloquait
    // le plus de séances de l'analyse du 04/09/2026 : un footing avec lignes droites, une sortie
    // avec tempo inséré, une endurance progressive sont des séances d'endurance QUI PORTENT UNE
    // STRUCTURE. Les typer « fractionné » pour leur donner des blocs aurait détruit leur nature
    // et faussé toutes les analyses par type.
    await afficher(seance({ sessionType: 'endurance' }));

    expect(screen.getByText('running.intervalsF4.addSegment')).toBeTruthy();
  });

  it('restent proposés quand le type devient « fractionné »', async () => {
    await afficher(seance({ sessionType: null }));

    await taper(screen.getByText('running.sessionType.fractionne'));

    expect(screen.getByText('running.intervalsF4.addSegment')).toBeTruthy();
  });

  it('monte un éditeur par bloc existant', async () => {
    await afficher(
      seance({
        sessionType: 'fractionne',
        intervals: [{ id: 'b-1' }, { id: 'b-2' }] as SessionDetail['intervals'],
      }),
    );

    expect(screen.getByText('bloc-b-1')).toBeTruthy();
    expect(screen.getByText('bloc-b-2')).toBeTruthy();
  });

  it('ajoute un bloc à une répétition', async () => {
    await afficher(seance({ sessionType: 'fractionne' }));

    await taper(screen.getByText('running.intervalsF4.addSegment'));

    // `reps: 1` est le minimum valide : un bloc créé à zéro serait immédiatement invalide.
    expect(mockAddBlock).toHaveBeenCalledWith('s-1', { reps: 1 });
  });

  it('🔴 deux appuis rapides n’ajoutent qu’UN bloc', async () => {
    let resoudre: ((v: unknown) => void) | undefined;
    mockAddBlock.mockReturnValue(new Promise((r) => (resoudre = r)));
    await afficher(seance({ sessionType: 'fractionne' }));

    const bouton = screen.getByText('running.intervalsF4.addSegment');
    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });

    // Deux blocs créés au même `order_index`, et l'ordre devient celui que Postgres tranche.
    expect(mockAddBlock).toHaveBeenCalledTimes(1);
    resoudre?.({ id: 'b-1', error: null });
  });
});

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

describe('suppression', () => {
  it('🔴 demande confirmation, en NOMMANT la séance', async () => {
    await afficher();

    await taper(screen.getByLabelText(/removeSessionA11y.*Sortie longue/));

    // Retirer une séance emporte ses blocs : la confirmation doit dire laquelle, surtout dans un
    // programme qui en compte cinq.
    expect(Alert.alert).toHaveBeenCalledWith('Sortie longue', expect.any(String), expect.any(Array));
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('confirmer retire la séance', async () => {
    await afficher();

    await taper(screen.getByLabelText(/removeSessionA11y/));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'running.program.removeSession')?.onPress?.();
    });

    expect(mockRemove).toHaveBeenCalledWith('s-1');
  });

  it('annuler ne retire rien', async () => {
    await afficher();

    await taper(screen.getByLabelText(/removeSessionA11y/));
    await act(async () => {
      boutonsAlerte.find((b) => b.text === 'common.cancel')?.onPress?.();
    });

    expect(mockRemove).not.toHaveBeenCalled();
  });
});
