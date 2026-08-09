/**
 * Feuille de création d'un objectif (`components/goals/GoalFormSheet`, US OBJ-01).
 *
 * Composant à **0 %** avant ce fichier. C'est un formulaire, et un formulaire ne se juge pas à ce
 * qu'il enregistre quand tout va bien, mais à **ce qu'il refuse d'enregistrer**.
 *
 * Quatre règles y vivent :
 *
 *  1. **Le formulaire est monté à l'ouverture**, pas rendu en permanence derrière une modale
 *     masquée. C'est ce qui remet l'état à zéro entre deux ouvertures — sans quoi rouvrir la
 *     feuille après un abandon proposerait de valider les valeurs de la fois précédente.
 *  2. **Changer de type d'objectif remet à zéro tout ce qui en dépend.** Une cible de « 12 »
 *     saisie en kilomètres deviendrait 12 kg sur un objectif de force : le même nombre, un sens
 *     radicalement différent, et rien à l'écran pour le signaler.
 *  3. **Le 1RM de départ est figé au choix de l'exercice** (décision D6) : c'est la référence de
 *     l'objectif. Le recalculer à l'enregistrement le ferait dépendre d'une séance faite entre-temps.
 *  4. **La validation vient de `@wellness/shared`**, testée là-bas. Ce qui est vérifié ici, c'est le
 *     **branchement** : que la règle soit appelée avec les bonnes valeurs, et que son verdict
 *     bloque réellement le bouton.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { GoalFormSheet } from '../GoalFormSheet';
import { createGoal, currentBest1RM } from '@/data/repositories/goal-repository';
import { useExercises } from '@/data/repositories/exercise-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/goal-repository', () => ({
  createGoal: jest.fn(),
  currentBest1RM: jest.fn(),
}));

jest.mock('@/data/repositories/exercise-repository', () => ({
  useExercises: jest.fn(() => ({ exercises: [], isLoading: false })),
}));

/** `Segment` rendu en boutons : c'est par lui que passent le type et l'échéance. */
jest.mock('@/components/Segment', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Segment: <T,>({
      options,
      onChange,
      label,
    }: {
      options: readonly T[];
      onChange: (v: T) => void;
      label: (v: T) => string;
    }) => (
      <>
        {options.map((o) => (
          <Pressable key={String(o)} onPress={() => onChange(o)}>
            <Text>{label(o)}</Text>
          </Pressable>
        ))}
      </>
    ),
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
      border: '#ece0cd',
      danger: '#b23b2e',
      track: '#f3ddd0',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    distanceSymbol: 'km',
    weightSymbol: 'kg',
    formatWeight: (kg: number | null | undefined) => (kg == null ? '—' : `${kg} kg`),
    // Les vraies règles : une saisie non numérique doit rendre `null`, c'est ce qui empêche
    // d'enregistrer un objectif `NaN`.
    parseDistanceToKm: (t: string) => {
      const n = Number(t.replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : null;
    },
    parseWeightToKg: (t: string) => {
      const n = Number(t.replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : null;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockCreate = createGoal as jest.Mock;
const mockBest1RM = currentBest1RM as jest.Mock;
const mockUseExercises = useExercises as jest.Mock;

const onClose = jest.fn();

const CIBLE_DISTANCE = 'goals.form.targetDistance, km';
const CIBLE_1RM = 'goals.form.target1rm, kg';

const saisir = async (label: string, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), valeur);
  });
};

const taper = async (texte: string) => {
  await act(async () => {
    fireEvent.press(screen.getByText(texte));
  });
};

/** Le bouton d'enregistrement. */
const bouton = () => screen.getByLabelText('goals.form.submit');

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue(undefined);
  mockBest1RM.mockResolvedValue(100);
  mockUseExercises.mockReturnValue({
    exercises: [
      { id: 'squat', name: 'Squat' },
      { id: 'bench', name: 'Développé couché' },
    ],
    isLoading: false,
  });
});

// ---------------------------------------------------------------------------
// Montage
// ---------------------------------------------------------------------------

describe('montage', () => {
  it('🔴 ne monte RIEN tant que la feuille est fermée', async () => {
    await render(<GoalFormSheet visible={false} onClose={onClose} />);

    // Le formulaire est monté à l'ouverture, pas rendu en permanence derrière une modale masquée.
    // C'est ce qui garantit un état neuf — et c'est aussi ce qui évite d'interroger le catalogue
    // d'exercices sur un écran que personne ne regarde.
    expect(screen.queryByText('goals.form.title')).toBeNull();
  });

  it('monte le formulaire à l’ouverture', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    expect(screen.getByText('goals.form.title')).toBeTruthy();
  });

  it('un tap sur le fond ferme la feuille', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('goals.form.close'));
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('🔴 l’objectif de course est proposé par défaut — sans exercice à choisir', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    // Le défaut le moins coûteux : un objectif de course se saisit en un champ, un objectif de
    // force en demande trois.
    expect(screen.queryByLabelText('goals.form.exercise')).toBeNull();
    expect(screen.getByLabelText(CIBLE_DISTANCE)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validation', () => {
  it('🔴 le bouton est désactivé tant que rien n’est saisi', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('🔴 une saisie non numérique n’active PAS le bouton', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await saisir(CIBLE_DISTANCE, 'à peu près dix');

    // Un objectif `NaN` en base ne se voit nulle part et casse toute la progression affichée.
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('🔴 rien de saisi ≠ saisie invalide : aucune erreur affichée à l’ouverture', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    // Accueillir l'utilisateur par un message d'erreur sur un formulaire vierge est hostile.
    expect(screen.queryByText(/goals\.errors\./)).toBeNull();
  });

  it('une cible de course valide active le bouton', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await saisir(CIBLE_DISTANCE, '15');

    expect(bouton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('🔴 un objectif de force sans exercice reste bloqué, ET le dit', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');
    await saisir(CIBLE_1RM, '120');

    // Un bouton grisé sans explication laisse chercher ce qui manque.
    expect(screen.getByText('goals.errors.missingExercise')).toBeTruthy();
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('🔴 une cible inférieure au 1RM de départ est refusée, avec le repère', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');
    await taper('Squat');
    await saisir(CIBLE_1RM, '90');

    // Le message rappelle le point de départ : « 90 kg » ne dit pas tout seul que c'est un recul.
    expect(screen.getByText(/goals\.errors\.targetBelowStart/)).toBeTruthy();
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('une cible supérieure au 1RM de départ est acceptée', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');
    await taper('Squat');
    await saisir(CIBLE_1RM, '120');

    expect(screen.queryByText(/goals\.errors\./)).toBeNull();
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: false });
  });
});

// ---------------------------------------------------------------------------
// Changement de type
// ---------------------------------------------------------------------------

describe('changement de type', () => {
  it('🔴 remet la cible à zéro — le même nombre n’a pas le même sens', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await saisir(CIBLE_DISTANCE, '12');
    await taper('goals.kinds.exercise_1rm');

    // « 12 » saisi en kilomètres deviendrait 12 kg : le même nombre, un sens radicalement
    // différent, et rien à l'écran pour le signaler.
    expect(screen.getByLabelText(CIBLE_1RM).props.value).toBe('');
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('🔴 remet aussi l’exercice et son 1RM de départ à zéro', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');
    await taper('Squat');
    expect(screen.getByText(/goals\.form\.startValue/)).toBeTruthy();

    await taper('goals.kinds.run_distance');
    await taper('goals.kinds.exercise_1rm');

    // Garder l'exercice précédent enregistrerait un objectif sur une référence qui n'est plus
    // affichée — l'utilisateur croirait partir de zéro.
    expect(screen.queryByText(/goals\.form\.startValue/)).toBeNull();
  });

  it('bascule le libellé et l’unité de la cible', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    expect(screen.getByLabelText(CIBLE_DISTANCE)).toBeTruthy();

    await taper('goals.kinds.exercise_1rm');

    expect(screen.getByLabelText(CIBLE_1RM)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Choix de l'exercice
// ---------------------------------------------------------------------------

describe('choix de l’exercice', () => {
  it('🔴 fige le 1RM de départ AU CHOIX, pas à l’enregistrement', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');
    await taper('Squat');

    // Décision D6 : c'est la référence de l'objectif. La recalculer à l'enregistrement la ferait
    // dépendre d'une séance faite entre-temps, et l'objectif changerait de sens tout seul.
    expect(mockBest1RM).toHaveBeenCalledWith('squat');
    expect(screen.getByText(/goals\.form\.startValue/)).toBeTruthy();
  });

  it('🔴 un exercice jamais fait le DIT, au lieu d’afficher « — »', async () => {
    mockBest1RM.mockResolvedValue(null);
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');
    await taper('Squat');

    // « Aucun historique » est une information ; « — » se lit comme un défaut d'affichage.
    expect(screen.getByText('goals.form.noStartValue')).toBeTruthy();
  });

  it('🔴 sans 1RM de départ, la cible n’est plus comparée à rien — et reste acceptée', async () => {
    mockBest1RM.mockResolvedValue(null);
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');
    await taper('Squat');
    await saisir(CIBLE_1RM, '80');

    // Refuser faute de référence empêcherait de se fixer un objectif sur un exercice neuf —
    // exactement le moment où on en pose un.
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('marque l’exercice choisi comme sélectionné', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');
    await taper('Squat');

    const ligne = screen.getByText('Squat').parent;
    expect(ligne?.props.accessibilityState ?? {}).toMatchObject({ selected: true });
  });

  it('la recherche est transmise au repository', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');
    await saisir('goals.form.exercise', 'squ');

    expect(mockUseExercises).toHaveBeenLastCalledWith('squ');
  });

  it('🔴 la liste est bornée à douze exercices', async () => {
    mockUseExercises.mockReturnValue({
      exercises: Array.from({ length: 30 }, (_, i) => ({ id: `ex-${i}`, name: `Exercice ${i}` })),
      isLoading: false,
    });
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');

    // Afficher deux cents exercices dans une feuille de création noierait le champ qui compte.
    expect(screen.queryByText('Exercice 12')).toBeNull();
    expect(screen.getByText('Exercice 11')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Enregistrement
// ---------------------------------------------------------------------------

describe('enregistrement', () => {
  it('🔴 convertit la cible de course en MÈTRES', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await saisir(CIBLE_DISTANCE, '15');
    await taper('goals.form.submit');

    // La base stocke des mètres ; enregistrer 15 ferait un objectif de quinze mètres.
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'run_distance', targetValue: 15000 }),
    );
  });

  it('🔴 n’attache ni exercice ni 1RM à un objectif de COURSE', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await saisir(CIBLE_DISTANCE, '15');
    await taper('goals.form.submit');

    // Un exercice traînant depuis une bascule de type rendrait l'objectif incohérent en base.
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId: null, startValue: null }),
    );
  });

  it('attache l’exercice et le 1RM à un objectif de force', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await taper('goals.kinds.exercise_1rm');
    await taper('Squat');
    await saisir(CIBLE_1RM, '120');
    await taper('goals.form.submit');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'exercise_1rm',
        exerciseId: 'squat',
        startValue: 100,
        targetValue: 120,
      }),
    );
  });

  it('🔴 l’échéance suit le nombre de semaines choisi', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await saisir(CIBLE_DISTANCE, '15');
    await taper('goals.weeks:{"count":4}');
    await taper('goals.form.submit');

    const { startDate, deadline } = mockCreate.mock.calls[0]?.[0] ?? {};
    const ecartJours = Math.round(
      (new Date(deadline).getTime() - new Date(startDate).getTime()) / 86400000,
    );
    expect(ecartJours).toBe(28);
  });

  it('ferme la feuille après un enregistrement réussi', async () => {
    await render(<GoalFormSheet visible onClose={onClose} />);

    await saisir(CIBLE_DISTANCE, '15');
    await taper('goals.form.submit');

    expect(onClose).toHaveBeenCalled();
  });

  it('🔴 un échec NE ferme PAS la feuille, et annonce le plafond', async () => {
    mockCreate.mockRejectedValue(new Error('plafond'));
    await render(<GoalFormSheet visible onClose={onClose} />);

    await saisir(CIBLE_DISTANCE, '15');
    await taper('goals.form.submit');

    // Fermer perdrait la saisie sans dire pourquoi. Le plafond d'objectifs actifs est relu côté
    // repository : c'est l'échec le plus probable ici, et le message doit le nommer.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/goals\.errors\.limitReached/)).toBeTruthy();
  });

  it('🔴 après un échec, on peut réessayer', async () => {
    mockCreate.mockRejectedValueOnce(new Error('plafond'));
    await render(<GoalFormSheet visible onClose={onClose} />);

    await saisir(CIBLE_DISTANCE, '15');
    await taper('goals.form.submit');
    await taper('goals.form.submit');

    // Le drapeau d'enregistrement doit être relâché dans tous les cas : sinon le bouton reste en
    // attente pour toujours et la seule issue est de fermer la feuille.
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalled();
  });
});
