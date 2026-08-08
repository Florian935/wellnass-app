/**
 * Liste des exercices de la séance en cours (`components/workout/ExerciseList`, C1 + C3).
 *
 * ⚠️ Ce composant était à **4 %** de couverture — et `workout-screen.test.tsx` le remplace par une
 * sonde, donc rien ne le vérifiait. C'est pourtant l'endroit d'où l'utilisateur corrige sa séance
 * en cours : dé-valider une série mal saisie, en retirer une, réordonner, remplacer un exercice
 * parce que la machine est prise.
 *
 * Quatre règles y vivent, toutes invisibles depuis l'écran parent :
 *
 *  1. **Le dépli est un défaut, pas un état.** L'exercice courant est déplié ; un tap pose une
 *     **dérogation** pour cet exercice-là. Quand le focus change, le nouvel exercice courant
 *     retombe sur le défaut — sans quoi il faudrait le déplier à la main à chaque série.
 *  2. **Les actions de réorganisation sont masquées si le parent ne les câble pas.** Des boutons
 *     inertes valent moins que pas de boutons.
 *  3. **Un exercice entièrement validé n'affiche aucune action** : il garde sa position, on ne le
 *     remplace pas et on ne l'envoie pas plus tard.
 *  4. **La dé-validation n'est proposée que sur une série validée.** Le bouton existe toujours
 *     (la ligne garde sa géométrie) mais reste **désactivé** — le rendre actif ferait « valider »
 *     depuis la liste, ce qui court-circuiterait le repos (spec §2.2).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ExerciseList } from '../ExerciseList';
import type { WorkoutEntry, WorkoutSetItem } from '@/data/repositories/workout-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatWeight: (kg: number | null | undefined) => (kg == null ? '—' : `${kg} kg`),
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const colors = {
  text: '#33291f',
  textMuted: '#96856f',
  surface: '#fffaf2',
  surfaceAlt: '#f3ddd0',
  border: '#ece0cd',
  accent: '#c0562f',
  success: '#7c8a5b',
} as unknown as Parameters<typeof ExerciseList>[0]['colors'];

let compteur = 0;

const serie = (overrides: Partial<WorkoutSetItem> = {}): WorkoutSetItem => {
  compteur += 1;
  return {
    id: `set-${compteur}`,
    exerciseId: 'squat',
    setType: 'normal',
    reps: 8,
    weightKg: 80,
    durationSeconds: null,
    done: false,
    orderIndex: compteur,
    rpe: null,
    plannedWeightKg: null,
    ...overrides,
  };
};

const exercice = (exerciseId: string, sets: WorkoutSetItem[]): WorkoutEntry => ({
  exerciseId,
  exerciseName: exerciseId.toUpperCase(),
  sets: sets.map((s) => ({ ...s, exerciseId })),
});

const handlers = () => ({
  onSelect: jest.fn(),
  onToggleSetDone: jest.fn(),
  onRemoveSet: jest.fn(),
  onAddSet: jest.fn(),
});

/** Rend la liste. `actions` câble les trois gestes de réorganisation. */
async function afficher(
  entries: WorkoutEntry[],
  opts: {
    currentExerciseId?: string;
    actions?: boolean;
    exerciseNotes?: Record<string, string | null>;
    supersetPairs?: Record<string, string>;
  } = {},
) {
  const h = handlers();
  const reorg = {
    onReorder: jest.fn(),
    onSendLater: jest.fn(),
    onReplace: jest.fn(),
  };
  await render(
    <ExerciseList
      entries={entries}
      currentExerciseId={opts.currentExerciseId ?? entries[0]?.exerciseId ?? ''}
      exerciseNotes={opts.exerciseNotes}
      supersetPairs={opts.supersetPairs}
      colors={colors}
      {...h}
      {...(opts.actions === false ? {} : reorg)}
    />,
  );
  return { ...h, ...reorg };
}

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  compteur = 0;
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Dépli
// ---------------------------------------------------------------------------

describe('dépli', () => {
  it('déplie l’exercice courant, replie les autres', async () => {
    await afficher(
      [exercice('squat', [serie()]), exercice('bench', [serie()])],
      { currentExerciseId: 'squat' },
    );

    // Le dépli se lit sur l'état d'accessibilité de l'en-tête — c'est aussi ce que TalkBack annonce.
    const entetes = screen.getAllByRole('button').filter((n) => typeof n.props.accessibilityState?.expanded === 'boolean');
    expect(entetes[0]?.props.accessibilityState).toMatchObject({ expanded: true });
    expect(entetes[1]?.props.accessibilityState).toMatchObject({ expanded: false });
  });

  it('un tap sur l’en-tête bascule le dépli ET déplace le focus', async () => {
    const h = await afficher(
      [exercice('squat', [serie()]), exercice('bench', [serie()])],
      { currentExerciseId: 'squat' },
    );

    await taper(screen.getByText('BENCH'));

    // Les deux gestes sont volontairement liés : taper un exercice, c'est vouloir y travailler.
    expect(h.onSelect).toHaveBeenCalledWith('bench');
    const entetes = screen.getAllByRole('button').filter((n) => typeof n.props.accessibilityState?.expanded === 'boolean');
    expect(entetes[1]?.props.accessibilityState).toMatchObject({ expanded: true });
  });

  it('🔴 replie l’exercice courant au second tap', async () => {
    await afficher([exercice('squat', [serie()])], { currentExerciseId: 'squat' });

    await taper(screen.getByText('SQUAT'));

    // La dérogation prime sur le défaut : sans elle, l'exercice courant serait impossible à
    // replier, et sa liste de séries occuperait l'écran en permanence.
    const entete = screen.getAllByRole('button').filter((n) => typeof n.props.accessibilityState?.expanded === 'boolean')[0];
    expect(entete?.props.accessibilityState).toMatchObject({ expanded: false });
  });

  it('les séries ne sont rendues que si l’exercice est déplié', async () => {
    await afficher(
      [exercice('squat', [serie()]), exercice('bench', [serie(), serie()])],
      { currentExerciseId: 'squat' },
    );

    // Une seule série visible : celle de l'exercice courant.
    expect(screen.getAllByText(/workout\.set /)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

describe('progression', () => {
  it('affiche le décompte « faites / total »', async () => {
    await afficher([exercice('squat', [serie({ done: true }), serie(), serie()])]);

    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('🔴 un exercice sans série affiche 0/0, il ne compte pas comme terminé', async () => {
    await afficher([exercice('squat', [])], { currentExerciseId: 'autre' });

    // `doneCount === total` est vrai pour `0 === 0` : sans la garde `total > 0`, un exercice
    // fraîchement ajouté s'afficherait coché et perdrait toutes ses actions.
    expect(screen.getByText('0/0')).toBeTruthy();
    expect(screen.getByText('workout.later')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Actions de réorganisation
// ---------------------------------------------------------------------------

describe('actions de réorganisation', () => {
  it('🔴 sont MASQUÉES si le parent ne les câble pas', async () => {
    await afficher([exercice('squat', [serie()])], { actions: false });

    // Des boutons inertes valent moins que pas de boutons : l'utilisateur appuie, rien ne bouge,
    // et il conclut que l'app est cassée.
    expect(screen.queryByText('workout.later')).toBeNull();
    expect(screen.queryByText('workout.replace')).toBeNull();
    expect(screen.queryByLabelText('workout.reorder.up')).toBeNull();
  });

  it('🔴 disparaissent quand l’exercice est ENTIÈREMENT validé', async () => {
    await afficher([exercice('squat', [serie({ done: true }), serie({ done: true })])]);

    // Un exercice terminé garde sa position : le réordonner ou le remplacer n'a plus de sens, et
    // l'envoyer « plus tard » le ferait réapparaître comme s'il restait à faire.
    expect(screen.queryByText('workout.later')).toBeNull();
    expect(screen.queryByText('workout.replace')).toBeNull();
  });

  it('restent visibles tant qu’une série n’est pas validée', async () => {
    await afficher([exercice('squat', [serie({ done: true }), serie()])]);

    expect(screen.getByText('workout.later')).toBeTruthy();
  });

  it('remontent, descendent, envoient plus tard et remplacent', async () => {
    const h = await afficher([exercice('squat', [serie()])]);

    await taper(screen.getByLabelText('workout.reorder.up'));
    await taper(screen.getByLabelText('workout.reorder.down'));
    await taper(screen.getByText('workout.later'));
    await taper(screen.getByText('workout.replace'));

    expect(h.onReorder).toHaveBeenNthCalledWith(1, 'squat', 'up');
    expect(h.onReorder).toHaveBeenNthCalledWith(2, 'squat', 'down');
    expect(h.onSendLater).toHaveBeenCalledWith('squat');
    expect(h.onReplace).toHaveBeenCalledWith('squat');
  });

  it('🔴 restent accessibles même quand l’exercice est REPLIÉ', async () => {
    await afficher(
      [exercice('squat', [serie()]), exercice('bench', [serie()])],
      { currentExerciseId: 'squat' },
    );

    // Réordonner un exercice qu'on ne fait pas encore est le cas normal : l'obliger à le déplier
    // d'abord ajouterait un geste à chaque réorganisation.
    expect(screen.getAllByText('workout.later')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Gestion des séries
// ---------------------------------------------------------------------------

describe('gestion des séries', () => {
  it('🔴 la dé-validation est DÉSACTIVÉE sur une série non validée', async () => {
    await afficher([exercice('squat', [serie({ done: false })])]);

    // Le bouton reste présent (la ligne garde sa géométrie) mais inerte : le rendre actif
    // permettrait de « valider » depuis la liste, ce qui court-circuiterait le repos (spec §2.2).
    expect(screen.getByLabelText('workout.unvalidateSet').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('dé-valide une série validée, en transmettant son état courant', async () => {
    const h = await afficher([exercice('squat', [serie({ id: 'set-a', done: true })])]);

    await taper(screen.getByLabelText('workout.unvalidateSet'));

    expect(h.onToggleSetDone).toHaveBeenCalledWith('set-a', true);
  });

  it('retire une série', async () => {
    const h = await afficher([exercice('squat', [serie({ id: 'set-a' })])]);

    await taper(screen.getByLabelText('workout.removeSet'));

    expect(h.onRemoveSet).toHaveBeenCalledWith('set-a');
  });

  it('🔴 le retrait reste possible sur une série DÉJÀ validée', async () => {
    const h = await afficher([exercice('squat', [serie({ id: 'set-a', done: true })])]);

    await taper(screen.getByLabelText('workout.removeSet'));

    // Corriger une série ajoutée par erreur après l'avoir validée est exactement le cas d'usage :
    // la bloquer obligerait à dé-valider d'abord, pour rien.
    expect(h.onRemoveSet).toHaveBeenCalledWith('set-a');
  });

  it('ajoute une série à l’exercice déplié', async () => {
    const h = await afficher([exercice('squat', [serie()])]);

    await taper(screen.getByText('workout.addSet'));

    expect(h.onAddSet).toHaveBeenCalledWith('squat');
  });
});

// ---------------------------------------------------------------------------
// Résumé d'une série
// ---------------------------------------------------------------------------

describe('résumé d’une série', () => {
  it('affiche « reps × charge »', async () => {
    await afficher([exercice('squat', [serie({ reps: 8, weightKg: 80 })])]);

    expect(screen.getByText('8 × 80 kg')).toBeTruthy();
  });

  it('🔴 des reps absentes donnent un tiret, pas « null »', async () => {
    await afficher([exercice('squat', [serie({ reps: null, weightKg: 80 })])]);

    expect(screen.getByText('— × 80 kg')).toBeTruthy();
  });

  it('une série à la durée affiche « m:ss » et non des reps', async () => {
    await afficher([
      exercice('planche', [serie({ setType: 'duration', durationSeconds: 90, weightKg: null })]),
    ]);

    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('🔴 une série à la durée AVEC lest affiche les deux', async () => {
    await afficher([
      exercice('traction', [serie({ setType: 'duration', durationSeconds: 45, weightKg: 10 })]),
    ]);

    // Le lest change complètement la difficulté : l'omettre rendrait deux séries identiques à
    // l'écran alors qu'elles n'ont rien à voir.
    expect(screen.getByText('0:45 · +10 kg')).toBeTruthy();
  });

  it('une durée absente donne un tiret', async () => {
    await afficher([
      exercice('planche', [serie({ setType: 'duration', durationSeconds: null, weightKg: null })]),
    ]);

    expect(screen.getByText('—')).toBeTruthy();
  });

  it('affiche le RPE quand il est renseigné, rien sinon', async () => {
    await afficher([exercice('squat', [serie({ rpe: 8 }), serie({ rpe: null })])]);

    expect(screen.getAllByText(/workout\.rpeValue/)).toHaveLength(1);
  });

  it('🔴 une série « normale » ne porte AUCUN badge', async () => {
    await afficher([exercice('squat', [serie({ setType: 'normal' })])]);

    // Le cas courant : un badge sur chaque ligne rendrait les badges illisibles là où ils comptent.
    expect(screen.queryByText(/workout\.setTypeBadge/)).toBeNull();
  });

  it.each(['warmup', 'dropset', 'failure', 'duration', 'bodyweight', 'superset'] as const)(
    'une série « %s » porte son badge',
    async (setType) => {
      await afficher([exercice('squat', [serie({ setType })])]);

      expect(screen.getByText(`workout.setTypeBadge.${setType}`)).toBeTruthy();
    },
  );
});

// ---------------------------------------------------------------------------
// Note et superset
// ---------------------------------------------------------------------------

describe('note et superset', () => {
  it('🔴 la note d’exercice est visible même REPLIÉ', async () => {
    await afficher(
      [exercice('squat', [serie()]), exercice('bench', [serie()])],
      { currentExerciseId: 'squat', exerciseNotes: { bench: 'Prise serrée' } },
    );

    // Une note qu'il faut déplier pour lire ne sert à rien pendant une séance.
    expect(screen.getByText('📝 Prise serrée')).toBeTruthy();
  });

  it('aucune note → aucune ligne vide', async () => {
    await afficher([exercice('squat', [serie()])], { exerciseNotes: { squat: null } });

    expect(screen.queryByText(/📝/)).toBeNull();
  });

  it('🔴 la liaison superset affiche le NOM du partenaire, pas son identifiant', async () => {
    await afficher(
      [exercice('squat', [serie()]), exercice('rowing', [serie()])],
      { supersetPairs: { squat: 'rowing', rowing: 'squat' } },
    );

    expect(screen.getAllByText(/🔗.*ROWING/).length).toBeGreaterThan(0);
  });

  it('🔴 un partenaire absent de la séance n’affiche RIEN', async () => {
    await afficher([exercice('squat', [serie()])], { supersetPairs: { squat: 'parti' } });

    // Le lien survit en base au retrait de l'exercice : afficher « 🔗 » sans nom serait une
    // information mutilée, pire que pas d'information.
    expect(screen.queryByText(/🔗/)).toBeNull();
  });
});
