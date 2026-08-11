/**
 * Progression musculaire (`app/progress/index.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (111 instructions). Sept sections, chacune avec son propre état
 * de chargement, son état vide et sa règle de silence. Ce qui est vérifié :
 *
 *  1. **Aucun graphique vide n'est jamais rendu.** Un histogramme à zéro barre ou une courbe à zéro
 *     point ressemble à un écran cassé, pas à « pas encore de données ». Chaque section a un état
 *     vide **rédigé**, et pour les trois qui en ont un, une action pour en sortir.
 *  2. **Le chargement ne passe JAMAIS par l'état vide.** Une section qui affiche « aucune donnée »
 *     puis se remplit fait douter de tout l'écran — et c'est le comportement par défaut d'un
 *     `data.length === 0` posé avant le test de `isLoading`.
 *  3. **Le deep-link ne prime PAS sur un choix explicite** (`pickedExercise ?? paramExercise`).
 *     Arrivé depuis une fiche exercice puis ayant changé d'exercice dans le sélecteur, l'utilisateur
 *     doit rester sur son choix — une synchronisation par effet le ramènerait au paramètre d'URL.
 *  4. **L'alerte d'équilibre exige `hasEnoughData`.** Annoncer un groupe négligé sur trois séances
 *     serait un diagnostic sur du bruit ; la règle est la même que partout ailleurs — une moyenne
 *     sur n=1 est un mensonge.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ProgressScreen from '../index';
import {
  useExerciseProgression,
  useExerciseRecords,
  useLifetimeTonnage,
  useMuscleBalance,
  useMuscleVolumeThisWeek,
  useWeeklyVolumeComparison,
} from '@/data/repositories/records-repository';
import { useExercise } from '@/data/repositories/exercise-repository';
import { useTrainingRegularity } from '@/data/repositories/planned-session-repository';
import { track } from '@/lib/analytics';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/records-repository', () => ({
  useMuscleVolumeThisWeek: jest.fn(),
  useWeeklyVolumeComparison: jest.fn(),
  useLifetimeTonnage: jest.fn(),
  useMuscleBalance: jest.fn(),
  useExerciseRecords: jest.fn(),
  useExerciseProgression: jest.fn(),
}));
jest.mock('@/data/repositories/exercise-repository', () => ({
  useExercise: jest.fn(() => ({ exercise: null })),
}));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  useTrainingRegularity: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({
  track: jest.fn(() => Promise.resolve()),
  ANALYTICS_EVENTS: { statsViewed: 'stats_viewed' },
}));

/** Les deux sections conditionnelles ont leurs propres tests : sondes muettes. */
jest.mock('@/components/strength/StrengthSection', () => ({ StrengthSection: () => null }));
jest.mock('@/components/progress/ExecutionSection', () => ({ ExecutionSection: () => null }));

/** Les graphiques sont testés chez eux : ici on vérifie ce qu'on leur passe. */
jest.mock('@/components/charts/MuscleVolumeBarChart', () => {
  const { Text } = require('react-native');
  return {
    MuscleVolumeBarChart: ({
      data,
      title,
    }: {
      data: { label: string; value: number }[];
      title: string;
    }) => (
      <Text>
        barres[{title}]:{data.map((d) => `${d.label}=${d.value}`).join(',')}
      </Text>
    ),
  };
});
jest.mock('@/components/charts/ProgressLineChart', () => {
  const { Text } = require('react-native');
  return {
    ProgressLineChart: ({
      data,
      title,
    }: {
      data: { label: string; value: number }[];
      title: string;
    }) => (
      <Text>
        courbe[{title}]:{data.map((d) => `${d.label}=${d.value}`).join(',')}
      </Text>
    ),
  };
});
jest.mock('@/components/DeltaBadge', () => {
  const { Text } = require('react-native');
  return {
    DeltaBadge: ({ change }: { change: { pct: number | null; direction: string } }) => (
      <Text>delta:{String(change.pct)}:{change.direction}</Text>
    ),
  };
});

/** Le sélecteur d'exercice est un modal testé chez lui : un bouton qui choisit « Squat ». */
jest.mock('@/components/programs/ExercisePicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ExercisePicker: ({
      visible,
      onPick,
    }: {
      visible: boolean;
      onPick: (e: { id: string; name: string }) => void;
    }) =>
      visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="choisir-squat"
          onPress={() => onPick({ id: 'ex-squat', name: 'Squat' })}
        >
          <Text>picker</Text>
        </Pressable>
      ) : null,
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
jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/EmptyState', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    EmptyState: ({
      title,
      message,
      cta,
    }: {
      title: string;
      message: string;
      cta?: { label: string; onPress: () => void };
    }) => (
      <View>
        <Text>vide:{title}</Text>
        <Text>{message}</Text>
        {cta ? (
          <Pressable accessibilityRole="button" accessibilityLabel={cta.label} onPress={cta.onPress}>
            <Text>{cta.label}</Text>
          </Pressable>
        ) : null}
      </View>
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
          accessibilityLabel={`metrique-${String(o)}`}
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
        >
          <Text>{label(o)}</Text>
        </Pressable>
      )),
  };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
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
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      surface: '#fffaf2',
      surfaceAlt: '#f3ddd0',
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    // Identité : le système métrique est le stockage. Un facteur ici masquerait les erreurs de
    // conversion au lieu de les révéler.
    toWeightValue: (kg: number) => kg,
    formatWeight: (kg: number) => `${kg} kg`,
    weightSymbol: 'kg',
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockVolume = useMuscleVolumeThisWeek as jest.Mock;
const mockComparison = useWeeklyVolumeComparison as jest.Mock;
const mockTonnage = useLifetimeTonnage as jest.Mock;
const mockBalance = useMuscleBalance as jest.Mock;
const mockRecords = useExerciseRecords as jest.Mock;
const mockProgression = useExerciseProgression as jest.Mock;
const mockExercise = useExercise as jest.Mock;
const mockRegularity = useTrainingRegularity as jest.Mock;
const mockTrack = track as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

const equilibreVide = {
  balance: { totalSets: 0, groups: [], neglected: [], hasEnoughData: false },
  isLoading: false,
};

const afficher = async (params: Record<string, string> = {}) => {
  mockParams.mockReturnValue(params);
  await render(<ProgressScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

/** Sélectionne « Squat » via le picker. */
const choisirSquat = async () => {
  await taper(screen.getByLabelText('progress.exercise.selectA11y'));
  await taper(screen.getByLabelText('choisir-squat'));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockVolume.mockReturnValue({ volumes: [], isLoading: false });
  mockComparison.mockReturnValue({ current: 0, previous: 0, isLoading: false });
  mockTonnage.mockReturnValue({ lifetimeKg: 0, thisYearKg: 0, isLoading: false });
  mockBalance.mockReturnValue(equilibreVide);
  mockRegularity.mockReturnValue({
    sessionsPerWeek: null,
    targetPerWeek: null,
    intervalRegularityDays: null,
    adherenceRate: null,
    isLoading: false,
  });
  mockRecords.mockReturnValue({ records: [], isLoading: false });
  mockProgression.mockReturnValue({ points: [], isLoading: false });
  mockExercise.mockReturnValue({ exercise: null });
});

// ---------------------------------------------------------------------------
// Volume hebdomadaire
// ---------------------------------------------------------------------------

describe('volume hebdomadaire', () => {
  it('🔴 le CHARGEMENT ne passe pas par l’état vide', async () => {
    mockVolume.mockReturnValue({ volumes: [], isLoading: true });
    await afficher();

    // `isLoading` testé AVANT `length === 0` : l'ordre inverse afficherait « aucune séance » une
    // fraction de seconde à chaque ouverture, sur une section qui va se remplir.
    expect(screen.queryByText('vide:progress.weeklyVolume.emptyTitle')).toBeNull();
  });

  it('🔴 sans donnée, un état vide RÉDIGÉ, pas un graphique à zéro barre', async () => {
    await afficher();

    // Un histogramme sans barre ressemble à un écran cassé, pas à « pas encore de données ».
    expect(screen.getByText('vide:progress.weeklyVolume.emptyTitle')).toBeTruthy();
    expect(screen.queryByText(/barres\[progress\.weeklyVolume/)).toBeNull();
  });

  it('l’état vide propose de démarrer une séance', async () => {
    await afficher();

    await taper(screen.getAllByLabelText('progress.cta.startWorkout')[0]!);

    // Sortir de l'état vide demande une séance : sans action, l'écran constate sans aider.
    expect(push).toHaveBeenCalledWith('/workout');
  });

  it('les volumes passent par le formateur d’unités et sont traduits', async () => {
    mockVolume.mockReturnValue({
      volumes: [{ muscle: 'chest', volume: 4200 }, { muscle: 'back', volume: 3100 }],
      isLoading: false,
    });
    await afficher();

    expect(screen.getByText(/barres\[progress\.weeklyVolume\.chartTitle\]:muscle\.chest=4200/)).toBeTruthy();
  });

  it('🔴 le total et sa comparaison n’apparaissent qu’une fois la comparaison CHARGÉE', async () => {
    mockVolume.mockReturnValue({ volumes: [{ muscle: 'chest', volume: 4200 }], isLoading: false });
    mockComparison.mockReturnValue({ current: 4200, previous: 3000, isLoading: true });
    await afficher();

    // Le graphique est déjà là ; afficher « 0 kg, −100 % » en attendant la comparaison serait un
    // chiffre faux, plus visible que le graphique lui-même.
    expect(screen.queryByText('progress.weeklyVolume.total')).toBeNull();
    expect(screen.getByText(/barres\[progress\.weeklyVolume/)).toBeTruthy();
  });

  it('la comparaison chargée affiche le total et l’écart', async () => {
    mockVolume.mockReturnValue({ volumes: [{ muscle: 'chest', volume: 4200 }], isLoading: false });
    mockComparison.mockReturnValue({ current: 4200, previous: 3000, isLoading: false });
    await afficher();

    expect(screen.getByText('4200 kg')).toBeTruthy();
    // `percentChange` est pure (`@wellness/shared`), prise telle quelle : +40 % de 3000 à 4200,
    // avec le SENS de l'écart — c'est lui qui colore le badge, un pourcentage nu ne dit pas si la
    // semaine est meilleure ou moins bonne.
    expect(screen.getByText('delta:40:up')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tonnage cumulé
// ---------------------------------------------------------------------------

describe('tonnage cumulé', () => {
  it('affiche le cumul de toujours ET celui de l’année', async () => {
    mockTonnage.mockReturnValue({ lifetimeKg: 1200000, thisYearKg: 340000, isLoading: false });
    await afficher();

    // Les deux ensemble : le cumul de toujours seul récompense l'ancienneté, celui de l'année
    // seul efface l'historique.
    expect(screen.getByText('1200000 kg')).toBeTruthy();
    expect(screen.getByText('340000 kg')).toBeTruthy();
  });

  it('🔴 le palier n’est annoncé qu’une fois ATTEINT', async () => {
    mockTonnage.mockReturnValue({ lifetimeKg: 1000, thisYearKg: 1000, isLoading: false });
    await afficher();

    // `hasReachedTonnageMilestone` est pure et prise telle quelle : annoncer un palier non atteint
    // transformerait une récompense en objectif affiché, ce que la gamification hors V1 exclut.
    expect(screen.queryByText(/milestone/)).toBeNull();
  });

  it('un palier atteint est célébré', async () => {
    mockTonnage.mockReturnValue({ lifetimeKg: 9_000_000, thisYearKg: 1000, isLoading: false });
    await afficher();

    expect(screen.getByText(/progress\.lifetimeTonnage\.milestone/)).toBeTruthy();
  });

  it('le chargement n’affiche aucun chiffre', async () => {
    mockTonnage.mockReturnValue({ lifetimeKg: 0, thisYearKg: 0, isLoading: true });
    await afficher();

    // « 0 kg » puis « 1,2 t » ferait douter du chiffre définitif.
    expect(screen.queryByText('progress.lifetimeTonnage.lifetime')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Régularité
// ---------------------------------------------------------------------------

describe('régularité', () => {
  it('🔴 l’état vide n’apparaît que si les TROIS métriques manquent (R6)', async () => {
    mockRegularity.mockReturnValue({
      sessionsPerWeek: 3,
      targetPerWeek: null,
      intervalRegularityDays: null,
      adherenceRate: null,
      isLoading: false,
    });
    await afficher();

    // Une seule métrique disponible vaut mieux que rien : masquer la section entière sur un écran
    // Tier 1 ouvert délibérément serait un silence non demandé.
    expect(screen.queryByText('vide:progress.regularity.emptyTitle')).toBeNull();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('🔴 une métrique manquante est marquée « indisponible », pas à zéro', async () => {
    mockRegularity.mockReturnValue({
      sessionsPerWeek: 3,
      targetPerWeek: null,
      intervalRegularityDays: null,
      adherenceRate: null,
      isLoading: false,
    });
    await afficher();

    // « 0 % d'adhérence » est un jugement ; « indisponible » est un fait.
    expect(screen.getAllByText('progress.regularity.unavailable').length).toBeGreaterThan(0);
  });

  it('l’objectif hebdomadaire n’est affiché que s’il existe ET que la fréquence est connue', async () => {
    mockRegularity.mockReturnValue({
      sessionsPerWeek: 3,
      targetPerWeek: 4,
      intervalRegularityDays: 2,
      adherenceRate: 80,
      isLoading: false,
    });
    await afficher();

    expect(screen.getByText('progress.regularity.target:{"value":4}')).toBeTruthy();
    expect(screen.getByText('80 %')).toBeTruthy();
  });

  it('les trois métriques absentes donnent l’état vide, avec action', async () => {
    await afficher();

    expect(screen.getByText('vide:progress.regularity.emptyTitle')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Équilibre musculaire
// ---------------------------------------------------------------------------

describe('équilibre musculaire', () => {
  it('sans série sur 14 jours, état vide', async () => {
    await afficher();

    expect(screen.getByText('vide:progress.balance.emptyTitle')).toBeTruthy();
  });

  it('🔴 l’alerte de groupe négligé exige des données SUFFISANTES', async () => {
    mockBalance.mockReturnValue({
      balance: {
        totalSets: 6,
        groups: [{ muscle: 'legs', sets: 6, status: 'over' }],
        neglected: ['back'],
        hasEnoughData: false,
      },
      isLoading: false,
    });
    await afficher();

    // Annoncer un groupe négligé sur six séries serait un diagnostic sur du bruit — la même règle
    // que partout : une moyenne sur n=1 est un mensonge.
    expect(screen.queryByText(/progress\.balance\.alert/)).toBeNull();
    expect(screen.getByText(/barres\[progress\.balance\.chartTitle\]/)).toBeTruthy();
  });

  it('avec assez de données, les groupes négligés sont NOMMÉS', async () => {
    mockBalance.mockReturnValue({
      balance: {
        totalSets: 60,
        groups: [
          { muscle: 'legs', sets: 40, status: 'over' },
          { muscle: 'back', sets: 4, status: 'neglected' },
        ],
        neglected: ['back'],
        hasEnoughData: true,
      },
      isLoading: false,
    });
    await afficher();

    // « Tu négliges un groupe » sans dire lequel n'aide pas : c'est le nom qui rend l'alerte
    // actionnable.
    expect(
      screen.getByText('progress.balance.alert:{"groups":"muscle.back"}'),
    ).toBeTruthy();
  });

  it('aucun groupe négligé : le graphique seul', async () => {
    mockBalance.mockReturnValue({
      balance: {
        totalSets: 60,
        groups: [{ muscle: 'legs', sets: 30, status: 'balanced' }],
        neglected: [],
        hasEnoughData: true,
      },
      isLoading: false,
    });
    await afficher();

    expect(screen.queryByText(/progress\.balance\.alert/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sélection d'exercice
// ---------------------------------------------------------------------------

describe('sélection d’exercice', () => {
  it('sans exercice, le sélecteur affiche son invite et la section est vide', async () => {
    await afficher();

    expect(screen.getByText('progress.exercise.placeholder')).toBeTruthy();
    expect(screen.getByText('progress.exercise.empty')).toBeTruthy();
  });

  it('choisir un exercice affiche ses records et sa courbe', async () => {
    mockRecords.mockReturnValue({
      records: [{ type: 'max_weight', value: 120 }],
      isLoading: false,
    });
    await afficher();

    await choisirSquat();

    expect(screen.getByText('Squat')).toBeTruthy();
    expect(screen.getByText('120 kg')).toBeTruthy();
    expect(mockRecords).toHaveBeenLastCalledWith('ex-squat');
  });

  it('🔴 un `exerciseId` en paramètre PRÉ-SÉLECTIONNE l’exercice', async () => {
    mockExercise.mockReturnValue({ exercise: { id: 'ex-dc', name: 'Développé couché' } });
    await afficher({ exerciseId: 'ex-dc' });

    // Arriver depuis une fiche exercice et devoir re-choisir le même exercice serait un aller-retour
    // pour rien.
    expect(screen.getByText('Développé couché')).toBeTruthy();
  });

  it('🔴 un choix EXPLICITE prime sur le paramètre d’URL', async () => {
    mockExercise.mockReturnValue({ exercise: { id: 'ex-dc', name: 'Développé couché' } });
    await afficher({ exerciseId: 'ex-dc' });

    await choisirSquat();

    // Valeur dérivée (`pickedExercise ?? paramExercise`) et non synchronisée par effet : une
    // synchronisation ramènerait l'utilisateur au paramètre d'URL à chaque rendu.
    expect(screen.getByText('Squat')).toBeTruthy();
    expect(screen.queryByText('Développé couché')).toBeNull();
  });

  it('🔴 le volume de série n’est PAS formaté en poids', async () => {
    mockRecords.mockReturnValue({
      records: [{ type: 'best_volume', value: 2400 }, { type: 'max_weight', value: 120 }],
      isLoading: false,
    });
    await afficher();
    await choisirSquat();

    // Un volume est un produit charge × répétitions : l'afficher « 2400 kg » suggérerait une charge
    // soulevée, et la conversion en livres le rendrait faux.
    expect(screen.getByText('2400')).toBeTruthy();
    expect(screen.getByText('120 kg')).toBeTruthy();
  });

  it('sans record, un message plutôt qu’une grille vide', async () => {
    await afficher();
    await choisirSquat();

    expect(screen.getByText('progress.records.empty')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Courbe de progression
// ---------------------------------------------------------------------------

describe('courbe de progression', () => {
  const points = [
    { date: '2026-08-01T00:00:00.000Z', value: 100 },
    { date: '2026-08-08T00:00:00.000Z', value: 110 },
  ];

  it('🔴 les points d’axe sont abrégés en JJ/MM', async () => {
    mockProgression.mockReturnValue({ points, isLoading: false });
    await afficher();
    await choisirSquat();

    // Une date complète par point rendrait l'axe illisible sur un écran de téléphone.
    expect(screen.getByText(/courbe\[.*\]:01\/08=100,08\/08=110/)).toBeTruthy();
  });

  it('🔴 sans point, une invite ET une action — jamais une courbe vide', async () => {
    await afficher();
    await choisirSquat();

    expect(screen.getByText('progress.curve.empty')).toBeTruthy();
    expect(screen.queryByText(/^courbe\[/)).toBeNull();
  });

  it('le chargement de la courbe ne passe pas par l’état vide', async () => {
    mockProgression.mockReturnValue({ points: [], isLoading: true });
    await afficher();
    await choisirSquat();

    expect(screen.queryByText('progress.curve.empty')).toBeNull();
  });

  it('changer de métrique REDEMANDE la série', async () => {
    mockProgression.mockReturnValue({ points, isLoading: false });
    await afficher();
    await choisirSquat();

    await taper(screen.getByLabelText('metrique-volume'));

    // Sans le paramètre, la courbe afficherait la charge max sous le titre « volume ».
    expect(mockProgression).toHaveBeenLastCalledWith('ex-squat', 'volume', '30d');
  });

  it('changer de période REDEMANDE la série', async () => {
    mockProgression.mockReturnValue({ points, isLoading: false });
    await afficher();
    await choisirSquat();

    await taper(screen.getByText('progress.curve.period.1y'));

    expect(mockProgression).toHaveBeenLastCalledWith('ex-squat', 'max_weight', '1y');
  });

  it('la période sélectionnée est annoncée aux lecteurs d’écran', async () => {
    mockProgression.mockReturnValue({ points, isLoading: false });
    await afficher();
    await choisirSquat();

    // Quatre puces identiques sans état annoncé : un lecteur d'écran ne dirait pas laquelle est
    // active.
    const puce = screen.getByText('progress.curve.period.30d').parent;
    expect(puce?.props.accessibilityState?.selected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Divers
// ---------------------------------------------------------------------------

describe('divers', () => {
  it('l’ouverture de l’écran est tracée UNE fois', async () => {
    await afficher();

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('stats_viewed', { pillar: 'strength' });
  });

  it('les mensurations sont accessibles depuis cet écran', async () => {
    await afficher();

    await taper(screen.getByLabelText('measurements.cta'));

    // Décision D5 : une mesure mensuelle ne mérite pas une place permanente sur l'accueil, mais
    // sans ce point d'entrée l'écran serait inatteignable.
    expect(push).toHaveBeenCalledWith('/measurements');
  });
});
