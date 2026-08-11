/**
 * Widgets du hub musculation (`components/widgets/strength-widgets`).
 *
 * Fichier à **0 %** avant ce test : cinq widgets propres, **trois déclinaisons chacun**, soit
 * quinze rendus. Aucun ne porte de logique métier — elle vit dans les repositories et dans
 * `@wellness/shared` — mais tous portent des **dégradations** : ce fichier existe parce que les
 * données disponibles sont incomplètes (pas de nom de séance dans l'historique, pas de tonnage
 * partout, pas toujours de programme actif), et chaque widget doit s'en accommoder sans afficher
 * un trou.
 *
 * Ce qui est vérifié, et qui casse en silence :
 *
 *  1. **Chaque widget a un état vide RÉDIGÉ**, dans les trois formes. Un widget d'accueil vide ne
 *     se distingue pas d'un widget en panne.
 *  2. **Les nombres passent par un formateur localisé** — un tonnage en « 12.5 t » au milieu d'une
 *     app francophone est le défaut qu'on a déjà corrigé trois fois ailleurs.
 *  3. **Le registre expose exactement les identifiants attendus** : un widget absent de la map
 *     rendrait une case vide dans la grille, sans erreur.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { STRENGTH_WIDGETS } from '../strength-widgets';
import { useActiveProgram } from '@/data/repositories/program-repository';
import { useWorkoutHistory } from '@/data/repositories/workout-repository';
import {
  useWeeklyVolumeComparison,
  useWeeklyVolumeSeries,
} from '@/data/repositories/records-repository';
import { useWorkoutTemplates } from '@/data/repositories/workout-template-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/program-repository', () => ({
  useActiveProgram: jest.fn(() => ({ program: null, isLoading: false })),
}));
jest.mock('@/data/repositories/workout-repository', () => ({
  useWorkoutHistory: jest.fn(() => ({ workouts: [], isLoading: false })),
}));
jest.mock('@/data/repositories/records-repository', () => ({
  useWeeklyVolumeComparison: jest.fn(() => ({ current: 0, previous: 0 })),
  useWeeklyVolumeSeries: jest.fn(() => ({ series: [] })),
}));
jest.mock('@/data/repositories/workout-template-repository', () => ({
  useWorkoutTemplates: jest.fn(() => ({ templates: [], isLoading: false })),
}));

// Les widgets réutilisés tels quels ont leurs propres tests : sondes ici.
jest.mock('@/components/PlanningPreview', () => {
  const { Text } = require('react-native');
  return { PlanningPreview: ({ size }: { size: string }) => <Text>planning-{size}</Text> };
});
jest.mock('@/components/dashboard/RecordRecentCard', () => {
  const { Text } = require('react-native');
  return { RecordRecentCard: () => <Text>records</Text> };
});
jest.mock('@/components/dashboard/TrainingTimeCard', () => {
  const { Text } = require('react-native');
  return { TrainingTimeCard: () => <Text>temps</Text> };
});
jest.mock('@/components/widgets/primitives', () => {
  const { Text } = require('react-native');
  return { Sparkline: ({ values }: { values: number[] }) => <Text>spark-{values.length}</Text> };
});

jest.mock('@/components/widgets/WidgetFrame', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    WidgetFrame: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
    }) =>
      onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
          {children}
        </Pressable>
      ) : (
        <View>{children}</View>
      ),
    Eyebrow: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Metric: ({ value, sub }: { value: string; sub?: string }) => (
      <View>
        <Text>{value}</Text>
        {sub ? <Text>{sub}</Text> : null}
      </View>
    ),
    Chip: ({ label }: { label: string }) => <Text>{label}</Text>,
  };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
      success: '#7c8a5b',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatWeight: (kg: number | null | undefined) => (kg == null ? '—' : `${kg} kg`),
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockProgram = useActiveProgram as jest.Mock;
const mockHistory = useWorkoutHistory as jest.Mock;
const mockComparison = useWeeklyVolumeComparison as jest.Mock;
const mockSeries = useWeeklyVolumeSeries as jest.Mock;
const mockTemplates = useWorkoutTemplates as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

const TAILLES = ['small', 'wide', 'large'] as const;

const seance = (overrides: Record<string, unknown> = {}) => ({
  id: 'w-1',
  startedAt: '2026-08-05T07:00:00.000Z',
  finishedAt: '2026-08-05T08:00:00.000Z',
  durationSeconds: 3600,
  rpe: null,
  notes: null,
  sessionId: null,
  programId: null,
  volumeKg: 12500,
  ...overrides,
});

const rendre = (id: keyof typeof STRENGTH_WIDGETS, size: (typeof TAILLES)[number]) => {
  const Widget = STRENGTH_WIDGETS[id];
  return render(<Widget size={size} />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockProgram.mockReturnValue({ program: null, isLoading: false });
  mockHistory.mockReturnValue({ workouts: [], isLoading: false });
  mockComparison.mockReturnValue({ current: 0, previous: 0 });
  mockSeries.mockReturnValue({ series: [] });
  mockTemplates.mockReturnValue({ templates: [], isLoading: false });
});

// ---------------------------------------------------------------------------
// Registre
// ---------------------------------------------------------------------------

describe('registre', () => {
  it('🔴 expose exactement les sept widgets du hub', async () => {
    // Un identifiant absent de la map rendrait une case **vide** dans la grille, sans erreur ni
    // trace : le widget disparaîtrait sans que personne sache pourquoi.
    expect(Object.keys(STRENGTH_WIDGETS).sort()).toEqual([
      'strength-history',
      'strength-planning',
      'strength-programs',
      'strength-progress',
      'strength-records',
      'strength-templates',
      'strength-training-time',
    ]);
  });

  // ⚠️ Un cas de test par couple (widget, forme), et non une boucle avec `unmount()` : démonter au
  // milieu d'un test laisse `screen` pointer sur un arbre mort et fait tomber les tests SUIVANTS
  // du fichier. Piège déjà rencontré le 09/08 — voir §3.7.
  it.each(
    (Object.keys(STRENGTH_WIDGETS) as (keyof typeof STRENGTH_WIDGETS)[]).flatMap((id) =>
      TAILLES.map((size) => [id, size] as const),
    ),
  )('%s se rend en %s sans planter', async (id, size) => {
    const vue = await rendre(id, size);

    expect(vue.toJSON()).not.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Programme actif
// ---------------------------------------------------------------------------

describe('programme actif', () => {
  it.each(TAILLES)('🔴 %s dit qu’aucun programme n’est actif', async (size) => {
    await rendre('strength-programs', size);

    // Un widget vide ne se distingue pas d'un widget en panne : il faut le dire.
    expect(screen.getByText('programs.noneActive')).toBeTruthy();
  });

  it('affiche le nom du programme et sa durée', async () => {
    mockProgram.mockReturnValue({
      program: { id: 'p1', name: 'Prise de masse', durationWeeks: 8, goal: null, level: null },
      isLoading: false,
    });

    await rendre('strength-programs', 'wide');

    expect(screen.getByText('Prise de masse')).toBeTruthy();
    expect(screen.getByText('programs.weeks:{"count":8}')).toBeTruthy();
  });

  it('🔴 sans durée, retombe sur l’objectif puis le niveau', async () => {
    mockProgram.mockReturnValue({
      program: { id: 'p1', name: 'Prise de masse', durationWeeks: null, goal: null, level: 'beginner' },
      isLoading: false,
    });

    await rendre('strength-programs', 'wide');

    // Une ligne de méta vide sous le titre se lit comme une donnée perdue.
    expect(screen.getByText('beginner')).toBeTruthy();
  });

  it('mène à la bibliothèque de programmes', async () => {
    await rendre('strength-programs', 'small');

    await taper(screen.getByLabelText('programs.title'));

    expect(push).toHaveBeenCalledWith('/programs');
  });
});

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

describe('historique', () => {
  it.each(TAILLES)('%s dit quand il n’y a aucune séance', async (size) => {
    await rendre('strength-history', size);

    expect(screen.getByText('history.subtitle')).toBeTruthy();
  });

  it('affiche la date au format JJ/MM et la durée en minutes', async () => {
    mockHistory.mockReturnValue({ workouts: [seance()], isLoading: false });

    await rendre('strength-history', 'small');

    expect(screen.getByText('05/08')).toBeTruthy();
    expect(screen.getByText('history.row.durationMin:{"count":60}')).toBeTruthy();
  });

  it('🔴 une séance sans durée affiche un tiret, pas « NaN min »', async () => {
    mockHistory.mockReturnValue({
      workouts: [seance({ durationSeconds: null })],
      isLoading: false,
    });

    await rendre('strength-history', 'small');

    expect(screen.getByText('—')).toBeTruthy();
  });

  it('🔴 le tonnage est LOCALISÉ et exprimé en tonnes', async () => {
    mockHistory.mockReturnValue({ workouts: [seance({ volumeKg: 12500 })], isLoading: false });

    await rendre('strength-history', 'wide');

    // « 12.5 t » au milieu d'une app francophone est le défaut déjà corrigé trois fois ailleurs :
    // tout nombre affiché passe par un formateur localisé.
    expect(screen.getByText(/widgets\.strength\.tonnage.*12,5/)).toBeTruthy();
  });

  it('🔴 aucun tonnage affiché quand le volume est nul', async () => {
    mockHistory.mockReturnValue({ workouts: [seance({ volumeKg: 0 })], isLoading: false });

    await rendre('strength-history', 'wide');

    // « 0,0 t » sous une séance faite au poids du corps se lit comme une séance vide.
    expect(screen.queryByText(/tonnage/)).toBeNull();
  });

  it.each([
    ['wide', 2],
    ['large', 4],
  ] as const)('🔴 la forme %s montre %i séances au plus', async (size, attendu) => {
    const workouts = Array.from({ length: 6 }, (_, i) =>
      seance({ id: `w-${i}`, startedAt: `2026-08-0${i + 1}T07:00:00.000Z` }),
    );
    mockHistory.mockReturnValue({ workouts, isLoading: false });

    await rendre('strength-history', size);

    // Chaque forme a une hauteur fixe : afficher quatre lignes dans un rectangle les compresserait.
    expect(screen.getAllByText(/^0\d\/08$/)).toHaveLength(attendu);
  });
});

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

describe('progression', () => {
  it.each(TAILLES)('🔴 %s affiche un tiret quand il n’y a aucun volume', async (size) => {
    await rendre('strength-progress', size);

    // « 0 kg » se lit comme un résultat ; « — » se lit comme une absence de données.
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('affiche le volume de la semaine', async () => {
    mockComparison.mockReturnValue({ current: 12500, previous: 0 });

    await rendre('strength-progress', 'wide');

    expect(screen.getByText('12500 kg')).toBeTruthy();
  });

  it('🔴 aucune variation affichée sans semaine précédente', async () => {
    mockComparison.mockReturnValue({ current: 12500, previous: 0 });

    await rendre('strength-progress', 'wide');

    // Une variation calculée contre zéro donnerait « +∞ % » ou « +100 % », deux chiffres faux.
    expect(screen.queryByText(/[▲▼]/)).toBeNull();
  });

  it('🔴 la variation porte une FLÈCHE, pas seulement une couleur', async () => {
    mockComparison.mockReturnValue({ current: 12500, previous: 10000 });

    await rendre('strength-progress', 'wide');

    // Un daltonien lit le sens de la variation ; la teinte seule ne suffit pas.
    expect(screen.getByText(/▲/)).toBeTruthy();
  });

  it('une baisse porte la flèche descendante', async () => {
    mockComparison.mockReturnValue({ current: 8000, previous: 10000 });

    await rendre('strength-progress', 'wide');

    expect(screen.getByText(/▼/)).toBeTruthy();
  });

  it('🔴 aucune courbe quand la série est entièrement à zéro', async () => {
    mockSeries.mockReturnValue({ series: [0, 0, 0, 0] });

    await rendre('strength-progress', 'wide');

    // Une ligne plate à zéro sur huit semaines n'apprend rien et ressemble à un graphe cassé.
    expect(screen.queryByText(/spark-/)).toBeNull();
  });

  it('trace la courbe dès qu’une semaine porte du volume', async () => {
    mockSeries.mockReturnValue({ series: [0, 0, 8000, 12500] });

    await rendre('strength-progress', 'wide');

    expect(screen.getByText('spark-4')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Modèles de séance
// ---------------------------------------------------------------------------

describe('modèles de séance', () => {
  it.each(TAILLES)('%s dit quand il n’y a aucun modèle', async (size) => {
    await rendre('strength-templates', size);

    expect(screen.getByText('templates.emptyList')).toBeTruthy();
  });

  it('liste les modèles avec leur nombre d’exercices', async () => {
    mockTemplates.mockReturnValue({
      templates: [{ id: 't1', name: 'Full body', exerciseCount: 6 }],
      isLoading: false,
    });

    await rendre('strength-templates', 'wide');

    expect(screen.getByText('Full body')).toBeTruthy();
    expect(screen.getByText('templates.exerciseCount:{"count":6}')).toBeTruthy();
  });

  it('mène à la liste des modèles', async () => {
    await rendre('strength-templates', 'small');

    await taper(screen.getByLabelText('templates.title'));

    expect(push).toHaveBeenCalledWith('/templates');
  });
});

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

describe('planning', () => {
  it.each(TAILLES)('🔴 %s transmet sa forme à l’aperçu', async (size) => {
    await rendre('strength-planning', size);

    // Le grand format de l'aperçu couvre deux semaines : lui passer une forme figée annulerait
    // la seconde rangée.
    expect(screen.getByText(`planning-${size}`)).toBeTruthy();
  });

  it('mène au planning', async () => {
    await rendre('strength-planning', 'wide');

    await taper(screen.getByLabelText('planning.title'));

    expect(push).toHaveBeenCalledWith('/planning');
  });
});
