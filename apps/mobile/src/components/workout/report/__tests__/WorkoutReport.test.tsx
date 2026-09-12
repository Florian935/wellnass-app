/**
 * Le bilan de séance (`components/workout/report/WorkoutReport.tsx`) — le composant **partagé** par
 * l'écran de fin de séance et celui de l'historique (US MUSCU-UX02).
 *
 * Ce fichier couvre ce que le **composant** décide, pas ce que les calculs produisent (testés purs
 * dans `@wellness/shared`) ni ce que les routes décident autour (testé dans
 * `app/__tests__/workout-summary-screen.test.tsx`). Quatre familles de décisions, toutes
 * silencieuses si elles cassent :
 *
 *  1. **`context` ne pilote que la célébration** (spec R9). Si la garde saute, rouvrir depuis
 *     l'historique une séance vieille de trois mois relance une animation de trophée — et rien
 *     dans l'écran ne signale l'anomalie.
 *  2. **Le niveau montre et cache les bons blocs**, sans jamais en retirer en montant.
 *  3. **Un bloc sans donnée disparaît**, il ne s'affiche pas à zéro (spec R2).
 *  4. **Le ressenti écrit un RPE**, pas l'index du cran — et une note vidée s'efface au lieu
 *     d'être enregistrée comme chaîne vide. Reprises de l'ancien test d'écran, ces règles ayant
 *     suivi la section quand elle a déménagé ici.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { WorkoutReport as Report } from '@wellness/shared';
import { WORKOUT_FEELINGS } from '@wellness/shared';

import { WorkoutReport } from '../WorkoutReport';
import { upsertProfile, useProfile } from '@/data/repositories/profile-repository';
import { setWorkoutFeedback } from '@/data/repositories/workout-repository';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null })),
  upsertProfile: jest.fn(),
}));
jest.mock('@/data/repositories/workout-repository', () => ({
  setWorkoutFeedback: jest.fn(),
}));

jest.mock('@/components/CelebrationCard', () => {
  const { View } = require('react-native');
  return {
    CelebrationCard: ({ children }: { children: React.ReactNode }) => (
      <View accessibilityLabel="celebration">{children}</View>
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
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      opts && typeof opts === 'object' ? `${k}:${JSON.stringify(opts)}` : k,
    i18n: { language: 'fr' },
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
      accentText: '#1c150e',
      success: '#a9ba7e',
      danger: '#e0524a',
      track: '#362c22',
      chartGreen: '#a9ba7e',
      amber: '#e0b155',
      panel: '#241e18',
      panelText: '#f0e4d0',
      panelMuted: '#c9b79a',
      panelAccent: '#e0a97f',
    },
  }),
}));
jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatWeight: (kg: number) => `${Math.round(kg)} kg`,
    // La densité n'est pas un poids : elle passe par la valeur convertie + le symbole, pour que
    // l'unité reste juste en impérial (« lb/min » et non « lb » sous un libellé « kg/min »).
    toWeightValue: (kg: number) => kg,
    formatAxisNumber: (value: number) => String(value),
    weightSymbol: 'kg',
  }),
}));
jest.mock('@/hooks/useIntensity', () => ({
  useIntensity: () => ({ format: (rpe: number | null) => (rpe === null ? null : `RPE ${rpe}`) }),
}));

// ---------------------------------------------------------------------------
// Fabrique de bilan
// ---------------------------------------------------------------------------

const mockProfile = useProfile as jest.Mock;
const mockUpsert = upsertProfile as jest.Mock;
const mockFeedback = setWorkoutFeedback as jest.Mock;

function report(over: Partial<Report> = {}): Report {
  return {
    workoutId: 'w-1',
    title: 'Haut du corps',
    startedAt: '2026-09-11T16:42:00.000Z',
    feelingRpe: null,
    notes: null,
    totals: {
      exercises: 1,
      workingSets: 3,
      warmupSets: 0,
      volumeKg: 1980,
      densityKgPerMin: 34,
      durationMin: 58,
      bestEstimated1RM: 104.5,
      relativeIntensityPercent: 76,
      averageRpe: 8,
      sessionLoad: 464,
      hardSets: 2,
      ratedSets: 3,
      ...(over.totals ?? {}),
    },
    exercises: [
      {
        exerciseId: 'bench',
        exerciseName: 'Développé couché',
        sets: [
          {
            id: 's1',
            exerciseId: 'bench',
            setType: 'normal',
            reps: 8,
            weightKg: 82.5,
            durationSeconds: null,
            rpe: 8,
            plannedWeightKg: 80,
            targetReps: null,
            done: true,
            orderIndex: 1,
          },
        ],
        workingSets: [
          {
            id: 's1',
            exerciseId: 'bench',
            setType: 'normal',
            reps: 8,
            weightKg: 82.5,
            durationSeconds: null,
            rpe: 8,
            plannedWeightKg: 80,
            targetReps: null,
            done: true,
            orderIndex: 1,
          },
        ],
        volumeKg: 660,
        delta: { kind: 'weight', deltaKg: 2.5 },
        bestEstimated1RM: 104.5,
        relativeIntensityPercent: 76,
      },
    ],
    records: [],
    verdict: { kind: 'done', durationMin: 58 },
    comparison: null,
    muscleSplit: null,
    repRanges: null,
    setTypes: null,
    compliance: null,
    weight: { weekSessionCount: 1, weekVolumeKg: 1980, lifetimeVolumeKg: 482000 },
    ...over,
  };
}

const afficher = async ({
  data = report(),
  level = 'normal',
  context = 'post-session' as 'post-session' | 'history',
} = {}) => {
  mockProfile.mockReturnValue({ profile: { summaryDisplayLevel: level } });
  await render(<WorkoutReport report={data} context={context} />);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFeedback.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// L'iso : ce que `context` pilote
// ---------------------------------------------------------------------------

describe('iso récap / historique', () => {
  const avecRecord = report({
    records: [
      { exerciseId: 'bench', exerciseName: 'Développé couché', type: 'max_weight', value: 82.5, previousValue: 80 },
    ],
    verdict: { kind: 'record', exerciseName: 'Développé couché', recordCount: 1 },
  });

  it('célèbre un record en fin de séance', async () => {
    await afficher({ data: avecRecord, context: 'post-session' });

    expect(screen.getByLabelText('celebration')).toBeTruthy();
  });

  it('🔴 ne célèbre RIEN depuis l’historique, même record battu', async () => {
    await afficher({ data: avecRecord, context: 'history' });

    // Rouvrir une séance de mars ne doit pas relancer une animation de trophée : la célébration
    // appartient au moment, pas à la séance.
    expect(screen.queryByLabelText('celebration')).toBeNull();
  });

  it('🔴 le VERDICT, lui, est identique dans les deux contextes', async () => {
    await afficher({ data: avecRecord, context: 'history' });

    // Toute la valeur de l'US tient là : l'historique montre le même bilan, pas une version au
    // rabais. Seuls l'en-tête, la célébration et le bouton de pied diffèrent (spec R9).
    expect(
      screen.getByText('workout.report.verdict.record:{"exercise":"Développé couché"}'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Niveaux
// ---------------------------------------------------------------------------

describe('niveaux de lecture', () => {
  const complet = report({
    comparison: {
      volume: { current: 1980, median: 1800, deltaPercent: 10 },
      density: null,
      durationSeconds: null,
      load: null,
      referenceCount: 5,
    },
    muscleSplit: [{ group: 'chest', sets: 3, hardSets: 2, volumeKg: 660 }],
    repRanges: [{ range: 'hypertrophy', volumeKg: 660, percent: 100 }],
  });

  it('Simple ne montre ni comparaison ni analyse', async () => {
    await afficher({ data: complet, level: 'simplified' });

    expect(screen.queryByText('workout.report.habit.title')).toBeNull();
    expect(screen.queryByText('workout.report.muscles.title')).toBeNull();
    expect(screen.queryByText('workout.report.repRanges.title')).toBeNull();
  });

  it('Intermédiaire ouvre la mise en perspective, pas encore l’analyse', async () => {
    await afficher({ data: complet, level: 'normal' });

    expect(screen.getByText('workout.report.habit.title')).toBeTruthy();
    expect(screen.getByText('workout.report.muscles.title')).toBeTruthy();
    expect(screen.queryByText('workout.report.repRanges.title')).toBeNull();
  });

  it('Avancé ouvre tout', async () => {
    await afficher({ data: complet, level: 'detailed' });

    expect(screen.getByText('workout.report.habit.title')).toBeTruthy();
    expect(screen.getByText('workout.report.repRanges.title')).toBeTruthy();
    expect(screen.getByText('workout.report.weight.title')).toBeTruthy();
  });

  it('🔴 un niveau INCONNU retombe sur Intermédiaire, pas sur du vide', async () => {
    await afficher({ data: complet, level: 'n’importe quoi' });

    expect(screen.getByText('workout.report.habit.title')).toBeTruthy();
  });

  it('changer de niveau l’enregistre dans le profil', async () => {
    await afficher({ level: 'simplified' });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('workout.report.level.detailed'));
    });

    expect(mockUpsert).toHaveBeenCalledWith({ summaryDisplayLevel: 'detailed' });
  });
});

// ---------------------------------------------------------------------------
// Blocs sans donnée (spec R2)
// ---------------------------------------------------------------------------

describe('blocs sans donnée', () => {
  it('🔴 aucune comparaison affichée au premier passage', async () => {
    await afficher({ data: report({ comparison: null }), level: 'detailed' });

    // « +0 % vs ton habitude » sur une première séance serait un mensonge : il n'y a pas
    // d'habitude. Le bloc disparaît au lieu de s'afficher à zéro.
    expect(screen.queryByText('workout.report.habit.title')).toBeNull();
  });

  it('🔴 aucun bloc « programme » sur une séance libre', async () => {
    await afficher({ data: report({ compliance: null }), level: 'detailed' });

    expect(screen.queryByText('workout.report.program.title')).toBeNull();
  });

  it('🔴 aucune section « records » quand rien n’a été battu', async () => {
    await afficher({ data: report({ records: [] }), level: 'detailed' });

    expect(screen.queryByText('workout.report.records.title')).toBeNull();
  });

  it('mentionne les échauffements dès qu’il y en a', async () => {
    const data = report();
    data.totals.warmupSets = 2;
    await afficher({ data });

    expect(screen.getByText('workout.report.warmupCount:{"count":2}')).toBeTruthy();
  });

  it('sans échauffement, aucune mention', async () => {
    await afficher();

    expect(screen.queryByText(/warmupCount/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ressenti — reprises de l'ancien test d'écran
// ---------------------------------------------------------------------------

describe('ressenti', () => {
  it('aucun niveau sélectionné par défaut', async () => {
    await afficher({ data: report({ feelingRpe: null }) });

    for (const value of WORKOUT_FEELINGS) {
      expect(
        screen.getByLabelText(`workout.summary.feeling.${value}`).props.accessibilityState.selected,
      ).toBe(false);
    }
  });

  it('🔴 choisir un niveau écrit le RPE correspondant, pas l’index du cran', async () => {
    await afficher();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('workout.summary.feeling.hard'));
    });

    const [, patch] = mockFeedback.mock.calls[0];
    // L'échelle affichée compte 5 crans, la colonne en stocke 10 : écrire l'index produirait un
    // RPE de 3 pour « Dur ».
    expect(patch.rpe).toBeGreaterThan(5);
  });

  it('retaper le niveau déjà posé l’efface', async () => {
    await afficher();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('workout.summary.feeling.hard'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('workout.summary.feeling.hard'));
    });

    expect(mockFeedback).toHaveBeenLastCalledWith('w-1', { rpe: null });
  });

  it('la note existante pré-remplit le champ, déjà ouvert', async () => {
    await afficher({ data: report({ notes: 'Bon ressenti' }) });

    expect(screen.getByLabelText('workout.summary.note').props.value).toBe('Bon ressenti');
  });

  it('sans note, le champ est replié derrière un bouton', async () => {
    await afficher();

    expect(screen.queryByLabelText('workout.summary.note')).toBeNull();
    expect(screen.getByText('workout.summary.addNote')).toBeTruthy();
  });

  it('🔴 une note VIDÉE est effacée, pas enregistrée comme chaîne vide', async () => {
    await afficher({ data: report({ notes: 'Bon ressenti' }) });

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('workout.summary.note'), '   ');
    });
    await act(async () => {
      fireEvent(screen.getByLabelText('workout.summary.note'), 'blur');
    });

    // `''` en base se relirait comme « une note existe », et rouvrirait le champ à chaque visite.
    expect(mockFeedback).toHaveBeenLastCalledWith('w-1', { notes: null });
  });

  it('🔴 une note non vide est enregistrée telle quelle, espaces compris', async () => {
    await afficher();

    await act(async () => {
      fireEvent.press(screen.getByText('workout.summary.addNote'));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('workout.summary.note'), '  Dos en vrac  ');
    });
    await act(async () => {
      fireEvent(screen.getByLabelText('workout.summary.note'), 'blur');
    });

    expect(mockFeedback).toHaveBeenLastCalledWith('w-1', { notes: '  Dos en vrac  ' });
  });
});

// ---------------------------------------------------------------------------
// Profil non chargé
// ---------------------------------------------------------------------------

describe('profil non chargé', () => {
  it('🔴 retombe sur Intermédiaire plutôt que sur un écran vide', async () => {
    // Le profil arrive par une requête distincte : le bilan doit se rendre sans l'attendre.
    // Le chargement et la séance introuvable, eux, appartiennent désormais aux **routes**
    // (`workout-summary.tsx` et `history/[id].tsx`), qui lisent la donnée et gardent ces cas.
    mockProfile.mockReturnValue({ profile: null });
    await render(
      <WorkoutReport
        report={report({
          comparison: {
            volume: { current: 1980, median: 1800, deltaPercent: 10 },
            density: null,
            durationSeconds: null,
            load: null,
            referenceCount: 5,
          },
        })}
        context="history"
      />,
    );

    expect(screen.getByText('workout.report.habit.title')).toBeTruthy();
  });
});
