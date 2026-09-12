/**
 * « Ce que tu as fait » (`ReportExerciseList`) — la lecture d'une série.
 *
 * ── D'où viennent ces cas ────────────────────────────────────────────────────────────────────────
 * Repris de `app/history/__tests__/workout-detail-screen.test.tsx`, qui testait le rendu série par
 * série de l'ancien écran d'historique. Ce rendu a déménagé ici en même temps que le bilan est
 * devenu commun aux deux écrans (US MUSCU-UX02) ; ses règles, elles, n'ont pas changé — et elles
 * valent désormais pour **les deux** écrans au lieu d'un seul.
 *
 * Ce sont des règles de **lecture**, pas de calcul : elles décident si un gainage de 90 s se lit
 * « 1:30 » ou « 90 reps », si un lest se distingue d'une charge, si une série non faite se
 * distingue d'une série faite. Aucune ne casse bruyamment.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { ReportExercise, ReportSet } from '@wellness/shared';

import { ReportExerciseList } from '../ReportExerciseList';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockIntensity = jest.fn(() => ({
  format: (rpe: number | null) => (rpe === null ? null : `RPE ${rpe}`),
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      opts && typeof opts === 'object' ? `${k}:${JSON.stringify(opts)}` : k,
  }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#f4ecdd',
      textMuted: '#c9b79a',
      surface: '#30271e',
      surfaceAlt: '#3a2e22',
      border: '#3a2e22',
      borderStrong: '#797169',
      accent: '#dd6e40',
      success: '#a9ba7e',
    },
  }),
}));
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({ formatWeight: (kg: number) => `${Math.round(kg)} kg` }),
}));
jest.mock('@/hooks/useIntensity', () => ({ useIntensity: () => mockIntensity() }));

// ---------------------------------------------------------------------------
// Fabriques
// ---------------------------------------------------------------------------

let seq = 0;
function serie(over: Partial<ReportSet> = {}): ReportSet {
  seq += 1;
  return {
    id: `s${seq}`,
    exerciseId: 'ex-1',
    setType: 'normal',
    reps: 10,
    weightKg: 80,
    durationSeconds: null,
    rpe: null,
    plannedWeightKg: null,
    targetReps: null,
    done: true,
    orderIndex: seq,
    ...over,
  };
}

function exercice(sets: ReportSet[], over: Partial<ReportExercise> = {}): ReportExercise {
  return {
    exerciseId: 'ex-1',
    exerciseName: 'Développé couché',
    sets,
    workingSets: sets.filter((s) => s.done && s.setType !== 'warmup'),
    volumeKg: 800,
    delta: null,
    bestEstimated1RM: null,
    relativeIntensityPercent: null,
    ...over,
  };
}

/**
 * Rend une seule série, détail déplié — la forme de la plupart des cas ci-dessous.
 *
 * ⚠️ Une carte **sans aucune série de travail ne se rend pas** (c'est la règle : un exercice qui
 * n'a que des échauffements ne compte pas). Pour pouvoir observer une série d'échauffement ou une
 * série non validée, il faut donc lui adjoindre une série de travail qui fasse exister la carte.
 * Cette ancre est ajoutée ici plutôt que dans chaque cas, et uniquement quand elle est nécessaire.
 */
const afficherSerie = (over: Partial<ReportSet> = {}) => {
  const cible = serie(over);
  const sets = cible.done && cible.setType !== 'warmup' ? [cible] : [cible, serie()];
  return render(
    <ReportExerciseList exercises={[exercice(sets)]} detail="expanded" warmupSets={0} />,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIntensity.mockReturnValue({
    format: (rpe: number | null) => (rpe === null ? null : `RPE ${rpe}`),
  });
});

// ---------------------------------------------------------------------------
// Lecture des séries
// ---------------------------------------------------------------------------

describe('lecture des séries', () => {
  it('une série normale se lit « charge × reps »', async () => {
    await afficherSerie({ reps: 10, weightKg: 80 });

    // Même format que la ligne condensée : c'est ce qui fait que déplier ne dépayse pas.
    expect(screen.getByText('80 kg × 10')).toBeTruthy();
  });

  it('🔴 une série à la DURÉE se lit en m:ss, pas en répétitions', async () => {
    await afficherSerie({ setType: 'duration', reps: null, weightKg: null, durationSeconds: 90 });

    // Un gainage de 90 s affiché « 90 reps » serait une lecture absurde.
    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('🔴 sur une série à la durée, la charge est un LEST, noté « + »', async () => {
    await afficherSerie({ setType: 'duration', reps: null, weightKg: 10, durationSeconds: 45 });

    // Le même champ `weightKg` veut dire « charge soulevée » ailleurs : sans le préfixe, un gainage
    // lesté de 10 kg se lirait comme un mouvement à 10 kg.
    expect(screen.getByText('0:45 · +10 kg')).toBeTruthy();
  });

  it('une série à la durée sans durée saisie affiche un tiret', async () => {
    await afficherSerie({ setType: 'duration', reps: null, weightKg: null, durationSeconds: null });

    expect(screen.getByText('—')).toBeTruthy();
  });

  it('une série au poids de corps n’affiche que les répétitions', async () => {
    await afficherSerie({ setType: 'bodyweight', reps: 12, weightKg: null });

    expect(screen.getByText('workout.report.repsOnly:{"count":12}')).toBeTruthy();
  });

  it('une charge sans répétition reste lisible', async () => {
    await afficherSerie({ reps: null, weightKg: 60 });

    expect(screen.getByText('60 kg')).toBeTruthy();
  });

  it('une série totalement vide affiche un tiret, pas « undefined »', async () => {
    await afficherSerie({ reps: null, weightKg: null });

    expect(screen.getByText('—')).toBeTruthy();
  });

  it.each([
    ['normal'],
    ['warmup'],
    ['superset'],
    ['duration'],
    ['bodyweight'],
    ['dropset'],
    ['failure'],
  ])('le type « %s » a son propre libellé', async (setType) => {
    await afficherSerie({ setType });

    expect(screen.getByText(`workout.report.setType.${setType}`)).toBeTruthy();
  });

  it('🔴 un type INCONNU garde une étiquette plutôt que de laisser un vide', async () => {
    await afficherSerie({ setType: 'type-du-futur' });

    // Une valeur ajoutée par une version plus récente et synchronisée depuis le cloud ne doit pas
    // laisser une ligne sans libellé : `t()` retombe sur sa valeur de repli.
    expect(screen.getByText('workout.report.setType.type-du-futur')).toBeTruthy();
  });

  it('les séries sont numérotées à partir de 1', async () => {
    await render(
      <ReportExerciseList
        exercises={[exercice([serie(), serie()])]}
        detail="expanded"
        warmupSets={0}
      />,
    );

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('🔴 une série non validée se distingue d’une série faite', async () => {
    await render(
      <ReportExerciseList
        exercises={[exercice([serie({ done: true }), serie({ done: false })])]}
        detail="expanded"
        warmupSets={0}
      />,
    );

    // Une séance interrompue garde ses séries prévues : sans distinction, on relirait un
    // entraînement qu'on n'a pas fait.
    expect(screen.getByText('icone-checkmark-circle')).toBeTruthy();
    expect(screen.getByText('icone-ellipse-outline')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Écart au planifié et intensité
// ---------------------------------------------------------------------------

describe('écart au planifié', () => {
  it.each([
    ['▲', 90],
    ['▼', 70],
    ['=', 80],
  ])('%s quand la charge réalisée est comparée aux 80 kg prévus', async (fleche, weightKg) => {
    await afficherSerie({ weightKg, plannedWeightKg: 80 });

    // C'est la seule information qui distingue « j'ai suivi le programme » de « j'ai forcé » ou
    // « j'ai réduit » — l'écart se lit d'un coup d'œil, pas en comparant deux nombres.
    expect(screen.getByText(`workout.report.planned:{"weight":"80 kg"} ${fleche}`)).toBeTruthy();
  });

  it('🔴 sans charge planifiée, aucun écart n’est affiché', async () => {
    await afficherSerie({ weightKg: 80, plannedWeightKg: null });

    // Une séance libre n'a rien à comparer : un « = » y suggérerait un plan qui n'existe pas.
    expect(screen.queryByText(/workout\.report\.planned/)).toBeNull();
  });

  it('une charge planifiée non réalisée affiche « = » plutôt que rien', async () => {
    await afficherSerie({ weightKg: null, plannedWeightKg: 80, done: false });

    // Série non faite : la consigne reste visible, ce qui permet de la reprendre.
    expect(screen.getByText('workout.report.planned:{"weight":"80 kg"} =')).toBeTruthy();
  });

  it('🔴 l’intensité suit l’ÉCHELLE choisie, pas la donnée stockée', async () => {
    mockIntensity.mockReturnValue({
      format: (rpe: number | null) => (rpe === null ? null : `RIR ${10 - rpe}`),
    });
    await afficherSerie({ rpe: 8 });

    // US UX-05 : la base stocke le RPE, l'écran affiche ce que l'utilisateur a réglé. Afficher la
    // donnée brute contredirait le réglage sans que rien n'échoue.
    expect(screen.getByText('RIR 2')).toBeTruthy();
  });

  it('une série sans intensité n’affiche rien', async () => {
    await afficherSerie({ rpe: null });

    expect(screen.queryByText(/RPE|RIR/)).toBeNull();
  });

  it('écart et intensité se combinent sur une seule ligne', async () => {
    await afficherSerie({ weightKg: 90, plannedWeightKg: 80, rpe: 9 });

    expect(screen.getByText('workout.report.planned:{"weight":"80 kg"} ▲ · RPE 9')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Les trois états du détail
// ---------------------------------------------------------------------------

describe('niveau de détail', () => {
  it('Simple affiche la ligne condensée, pas les séries', async () => {
    await render(
      <ReportExerciseList
        exercises={[exercice([serie({ reps: 8, weightKg: 82.5 }), serie({ reps: 8, weightKg: 82.5 })])]}
        detail="hidden"
        warmupSets={0}
      />,
    );

    expect(screen.getByText('83 kg × 8 · 8')).toBeTruthy();
    expect(screen.queryByText('icone-chevron-down')).toBeNull();
  });

  it('Intermédiaire garde la ligne condensée mais rend la carte dépliable', async () => {
    await render(
      <ReportExerciseList exercises={[exercice([serie()])]} detail="collapsed" warmupSets={0} />,
    );

    expect(screen.getByText('icone-chevron-down')).toBeTruthy();
    expect(screen.queryByText('icone-checkmark-circle')).toBeNull();
  });

  it('Avancé ouvre le détail d’emblée', async () => {
    await render(
      <ReportExerciseList exercises={[exercice([serie()])]} detail="expanded" warmupSets={0} />,
    );

    expect(screen.getByText('icone-checkmark-circle')).toBeTruthy();
  });

  it('🔴 changer de niveau déplie et replie VRAIMENT le détail', async () => {
    // Régression trouvée en revue : `useState(detail === 'expanded')` n'évalue son initialiseur
    // qu'au montage, et la carte est keyée sur `exerciseId` — inchangé quand le niveau bouge. Le
    // détail restait donc figé sur son état d'origine, dans les DEUX sens : Avancé n'ouvrait rien,
    // et revenir en Simple laissait un écran déplié **sans chevron pour le refermer**.
    //
    // Aucun test existant ne l'attrapait : tous montaient le composant avec un `detail` fixe. Il
    // faut un `rerender` pour le voir.
    const { rerender } = await render(
      <ReportExerciseList exercises={[exercice([serie()])]} detail="collapsed" warmupSets={0} />,
    );
    expect(screen.queryByText('icone-checkmark-circle')).toBeNull();

    await rerender(
      <ReportExerciseList exercises={[exercice([serie()])]} detail="expanded" warmupSets={0} />,
    );
    expect(screen.getByText('icone-checkmark-circle')).toBeTruthy();

    await rerender(
      <ReportExerciseList exercises={[exercice([serie()])]} detail="hidden" warmupSets={0} />,
    );
    expect(screen.queryByText('icone-checkmark-circle')).toBeNull();
  });

  it('🔴 la charge commune est sortie en préfixe, pas répétée', async () => {
    await render(
      <ReportExerciseList
        exercises={[
          exercice([
            serie({ reps: 8, weightKg: 82.5 }),
            serie({ reps: 8, weightKg: 82.5 }),
            serie({ reps: 7, weightKg: 82.5 }),
          ]),
        ]}
        detail="hidden"
        warmupSets={0}
      />,
    );

    // « 83 kg × 8 · 8 · 7 » se lit d'un coup, là où « 83×8, 83×8, 83×7 » oblige à comparer trois
    // fois le même nombre.
    expect(screen.getByText('83 kg × 8 · 8 · 7')).toBeTruthy();
  });

  it('à charges différentes, chaque série porte la sienne', async () => {
    await render(
      <ReportExerciseList
        exercises={[exercice([serie({ reps: 8, weightKg: 80 }), serie({ reps: 6, weightKg: 90 })])]}
        detail="hidden"
        warmupSets={0}
      />,
    );

    expect(screen.getByText('80 kg×8 · 90 kg×6')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Échauffements
// ---------------------------------------------------------------------------

describe('échauffements', () => {
  it('mentionne le nombre d’échauffements hors tonnage', async () => {
    await render(
      <ReportExerciseList exercises={[exercice([serie()])]} detail="hidden" warmupSets={2} />,
    );

    expect(screen.getByText('workout.report.warmupCount:{"count":2}')).toBeTruthy();
  });

  it('sans échauffement, aucune mention', async () => {
    await render(
      <ReportExerciseList exercises={[exercice([serie()])]} detail="hidden" warmupSets={0} />,
    );

    expect(screen.queryByText(/warmupCount/)).toBeNull();
  });

  it('🔴 la ligne condensée ignore les échauffements', async () => {
    await render(
      <ReportExerciseList
        exercises={[
          exercice([serie({ setType: 'warmup', reps: 15, weightKg: 40 }), serie({ reps: 5, weightKg: 100 })]),
        ]}
        detail="hidden"
        warmupSets={1}
      />,
    );

    // Le résumé doit raconter le travail, pas la mise en route.
    expect(screen.getByText('100 kg × 5')).toBeTruthy();
  });
});
