/**
 * Édition d'un bloc fractionné (`components/running/IntervalBlockEditor`, US RUN-F2c).
 *
 * Composant à **0 %** avant ce fichier. Un éditeur en **commit-on-blur** : chaque champ écrit en
 * base quand il perd le focus, sans bouton « Enregistrer ». Ce patron a une conséquence directe —
 * **une saisie refusée doit être visiblement refusée**, sinon l'utilisateur croit avoir enregistré
 * et découvre l'inverse en lançant sa séance.
 *
 * Quatre règles y vivent :
 *
 *  1. **Les répétitions ne sont jamais nulles (R1)** — la colonne ne l'accepte pas. Une saisie
 *     illisible **remet la valeur d'avant** dans le champ plutôt que d'écrire quoi que ce soit.
 *  2. **La phase rapide est distance OU durée, jamais les deux, jamais aucune (R2).** Basculer le
 *     sélecteur doit remettre l'autre à `null` : deux cibles concurrentes en base, et le guidage
 *     vocal ne sait plus quand annoncer la fin de phase.
 *  3. **La récupération est entièrement optionnelle (R3)** — « aucune » est un choix explicite qui
 *     efface les deux colonnes.
 *  4. **Le % VMA est nullable (R4)** : vider le champ efface la valeur, on n'invente jamais un
 *     pourcentage par défaut.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { IntervalBlockEditor } from '../IntervalBlockEditor';
import {
  removeIntervalBlock,
  updateIntervalBlock,
  type IntervalBlockItem,
} from '@/data/repositories/program-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  updateIntervalBlock: jest.fn(),
  removeIntervalBlock: jest.fn(),
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
      background: '#f7eede',
      border: '#ece0cd',
      borderStrong: '#d8c8b0',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockUpdate = updateIntervalBlock as jest.Mock;
const mockRemove = removeIntervalBlock as jest.Mock;

const bloc = (overrides: Partial<IntervalBlockItem> = {}): IntervalBlockItem =>
  ({
    id: 'b-1',
    orderIndex: 0,
    reps: 8,
    fastDistanceM: 400,
    fastDurationSeconds: null,
    fastPacePctVma: 100,
    recoveryDistanceM: null,
    recoveryDurationSeconds: 90,
    ...overrides,
  }) as IntervalBlockItem;

const afficher = (b = bloc()) => render(<IntervalBlockEditor block={b} index={0} />);

/**
 * Les champs se retrouvent par leur **libellé d'accessibilité** — ajouté au composant en écrivant
 * ce fichier : les quatre saisies n'en portaient aucune, et TalkBack les annonçait toutes
 * « champ de saisie » sur un formulaire entièrement numérique (US CONF-07). Le libellé visible est
 * un `Text` frère, que le lecteur d'écran n'associe pas au champ.
 */
const REPS = 'running.intervals.reps';
const RAPIDE = 'running.intervals.fastPhase';
const VMA = 'running.intervals.pctVma';
const RECUP = 'running.intervals.recoveryPhase';

const champ = (label: string) => screen.getByLabelText(label);

/** Saisit puis fait perdre le focus — c'est le blur qui commite. */
const saisirEtQuitter = async (label: string, valeur: string) => {
  const c = champ(label);
  await act(async () => {
    fireEvent.changeText(c, valeur);
  });
  await act(async () => {
    fireEvent(c, 'blur');
  });
};

/**
 * Tape sur un onglet. `rang` désigne lequel quand le libellé apparaît deux fois : « distance » et
 * « durée » servent à la fois à la phase rapide (rang 0) et à la récupération (rang 1).
 */
const taper = async (texte: string, rang = 0) => {
  await act(async () => {
    fireEvent.press(screen.getAllByText(texte)[rang]!);
  });
};

const DISTANCE = 'running.intervals.distanceM';
const DUREE = 'running.intervals.durationMin';
const AUCUNE = 'running.intervals.recoveryNone';

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Répétitions
// ---------------------------------------------------------------------------

describe('répétitions', () => {
  it('commite au blur', async () => {
    await afficher();

    await saisirEtQuitter(REPS, '10');

    expect(mockUpdate).toHaveBeenCalledWith('b-1', { reps: 10 });
  });

  it('🔴 une saisie illisible n’écrit RIEN et remet la valeur d’avant', async () => {
    await afficher(bloc({ reps: 8 }));

    await saisirEtQuitter(REPS, 'abc');

    // La colonne n'accepte pas `null` (R1). Laisser le champ vide ferait croire à une valeur
    // enregistrée, et l'écriture suivante partirait sur du vide.
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(champ(REPS).props.value).toBe('8');
  });

  it('🔴 zéro est refusé comme une saisie illisible', async () => {
    await afficher(bloc({ reps: 8 }));

    await saisirEtQuitter(REPS, '0');

    // « 8 × 0 » n'est pas un fractionné : c'est une séance vide qui passerait le guidage vocal.
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(champ(REPS).props.value).toBe('8');
  });
});

// ---------------------------------------------------------------------------
// Phase rapide
// ---------------------------------------------------------------------------

describe('phase rapide', () => {
  it('devine « distance » quand le bloc porte une distance', async () => {
    await afficher(bloc({ fastDistanceM: 400, fastDurationSeconds: null }));

    const onglets = screen.getAllByText(DISTANCE);
    expect(onglets[0]!.parent?.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('🔴 devine « durée » quand le bloc porte une durée', async () => {
    await afficher(bloc({ fastDistanceM: null, fastDurationSeconds: 60 }));

    // Sans cette déduction, rouvrir un bloc « 8 × 1 min » afficherait un champ de distance vide,
    // et le premier blur écraserait la durée par `null`.
    expect(champ(RAPIDE).props.value).toBe('1');
  });

  it('commite une distance en mètres bruts', async () => {
    await afficher();

    await saisirEtQuitter(RAPIDE, '600');

    // Un fractionné se décrit universellement en mètres (« 400 m », convention piste) : pas de
    // conversion impériale ici, contrairement à la distance totale d'une séance.
    expect(mockUpdate).toHaveBeenCalledWith('b-1', {
      fastDistanceM: 600,
      fastDurationSeconds: null,
    });
  });

  it('🔴 basculer vers la durée met la distance à null', async () => {
    await afficher();

    await taper(DUREE);
    await saisirEtQuitter(RAPIDE, '2');

    // Deux cibles concurrentes en base, et le guidage vocal ne sait plus quand annoncer la fin de
    // phase (R2 : exactement une des deux).
    expect(mockUpdate).toHaveBeenCalledWith('b-1', {
      fastDistanceM: null,
      fastDurationSeconds: 120,
    });
  });

  it('convertit les minutes en secondes, arrondi à la seconde', async () => {
    await afficher();

    await taper(DUREE);
    await saisirEtQuitter(RAPIDE, '1,5'.replace(',', '.'));

    expect(mockUpdate).toHaveBeenCalledWith('b-1', {
      fastDistanceM: null,
      fastDurationSeconds: 90,
    });
  });

  it('🔴 une phase rapide VIDE est refusée, et le dit', async () => {
    await afficher();

    await saisirEtQuitter(RAPIDE, '');

    // Écrire les deux à `null` ferait un bloc sans cible : la séance existerait sans rien à
    // exécuter, et le guidage vocal n'aurait aucune borne.
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('running.intervals.fastRequired')).toBeTruthy();
  });

  it('🔴 changer d’onglet efface le message d’erreur', async () => {
    await afficher();

    await saisirEtQuitter(RAPIDE, '');
    expect(screen.getByText('running.intervals.fastRequired')).toBeTruthy();

    await taper(DUREE);

    // L'erreur porte sur le champ précédent : la laisser afficher au-dessus d'un champ neuf est
    // un reproche sans objet.
    expect(screen.queryByText('running.intervals.fastRequired')).toBeNull();
  });

  it('une saisie valide après une erreur efface le message', async () => {
    await afficher();

    await saisirEtQuitter(RAPIDE, '');
    await saisirEtQuitter(RAPIDE, '400');

    expect(screen.queryByText('running.intervals.fastRequired')).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith('b-1', {
      fastDistanceM: 400,
      fastDurationSeconds: null,
    });
  });
});

// ---------------------------------------------------------------------------
// % VMA
// ---------------------------------------------------------------------------

describe('% VMA', () => {
  it('commite la valeur saisie', async () => {
    await afficher();

    await saisirEtQuitter(VMA, '95');

    expect(mockUpdate).toHaveBeenCalledWith('b-1', { fastPacePctVma: 95 });
  });

  it('🔴 vider le champ EFFACE la valeur, on n’invente pas un défaut', async () => {
    await afficher(bloc({ fastPacePctVma: 100 }));

    await saisirEtQuitter(VMA, '');

    // R4 : le % VMA est nullable. Retomber sur 100 % afficherait une consigne d'intensité que
    // personne n'a écrite.
    expect(mockUpdate).toHaveBeenCalledWith('b-1', { fastPacePctVma: null });
  });
});

// ---------------------------------------------------------------------------
// Récupération
// ---------------------------------------------------------------------------

describe('récupération', () => {
  it('devine « durée » quand le bloc porte une récupération en durée', async () => {
    await afficher(bloc({ recoveryDurationSeconds: 90, recoveryDistanceM: null }));

    expect(champ(RECUP).props.value).toBe('1.5');
  });

  it('🔴 « aucune » n’affiche AUCUN champ', async () => {
    await afficher(bloc({ recoveryDistanceM: null, recoveryDurationSeconds: null }));

    // R3 : la récupération est entièrement optionnelle. Un champ vide affiché en permanence se
    // lit comme une saisie oubliée.
    expect(screen.queryByLabelText(RECUP)).toBeNull();
  });

  it('🔴 choisir « aucune » efface LES DEUX colonnes, immédiatement', async () => {
    await afficher(bloc({ recoveryDurationSeconds: 90 }));

    await taper(AUCUNE);

    // Pas de blur à attendre : le choix est explicite, et laisser la valeur en base ferait
    // réapparaître la récupération à la réouverture.
    expect(mockUpdate).toHaveBeenCalledWith('b-1', {
      recoveryDistanceM: null,
      recoveryDurationSeconds: null,
    });
  });

  it('🔴 basculer vers la distance met la durée à null', async () => {
    await afficher(bloc({ recoveryDurationSeconds: 90 }));

    const onglets = screen.getAllByText(DISTANCE);
    await act(async () => {
      fireEvent.press(onglets[1]!); // second onglet « distance » = celui de la récupération
    });
    await saisirEtQuitter(RECUP, '200');

    expect(mockUpdate).toHaveBeenLastCalledWith('b-1', {
      recoveryDistanceM: 200,
      recoveryDurationSeconds: null,
    });
  });

  it('🔴 une récupération illisible n’écrit rien', async () => {
    await afficher(bloc({ recoveryDurationSeconds: 90 }));

    await saisirEtQuitter(RECUP, 'abc');

    // Contrairement à la phase rapide, il n'y a pas de message : la récupération est optionnelle,
    // et l'onglet « aucune » est le chemin explicite pour la retirer.
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

describe('suppression', () => {
  it('retire le bloc', async () => {
    await afficher();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('running.intervalsF4.removeSegmentA11y:{"index":1}'));
    });

    expect(mockRemove).toHaveBeenCalledWith('b-1');
  });

  it('🔴 le libellé du bloc et de sa suppression sont numérotés à partir de 1', async () => {
    await afficher();

    // « Bloc 0 » ne veut rien dire pour un utilisateur, et deux blocs indiscernables au lecteur
    // d'écran rendraient la suppression risquée.
    expect(screen.getByText('running.intervalsF4.segmentTitle:{"index":1}')).toBeTruthy();
  });
});
