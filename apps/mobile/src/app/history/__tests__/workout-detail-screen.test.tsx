/**
 * Détail d'une séance passée (`app/history/[id].tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (81 instructions). C'est un écran en **lecture seule**, ce qui
 * pourrait laisser croire qu'il ne risque rien : au contraire, c'est le seul endroit où l'on relit
 * ce qui a été fait, et **une valeur mal formatée y devient un souvenir faux**. Sept types de série
 * y cohabitent, chacun avec sa lecture.
 *
 * Ce qui est vérifié :
 *
 *  1. **Chaque type de série est lu dans SON unité.** Une série à la durée s'affiche en `m:ss`, une
 *     série au poids de corps sans charge, une série normale en « reps × charge ». Le même champ
 *     `weightKg` veut dire « lest » sur une série à la durée et « charge » sur une série normale.
 *  2. **L'écart à la charge planifiée est signé** (`=` / `▲` / `▼`) : c'est la seule information
 *     qui distingue « j'ai suivi le programme » de « j'ai forcé » ou « j'ai réduit ».
 *  3. **L'intensité est affichée dans l'échelle CHOISIE** (RPE ou RIR, US UX-05) alors que la donnée
 *     stockée reste le RPE. Afficher la donnée brute contredirait le réglage.
 *  4. **Les métadonnées absentes disparaissent**, elles ne s'affichent pas à zéro : « 0 kg de
 *     volume » sur une séance au poids de corps serait faux.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WorkoutDetailScreen from '../[id]';
import { useWorkoutDetail, useWorkoutRecords } from '@/data/repositories/records-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/records-repository', () => ({
  useWorkoutDetail: jest.fn(),
  useWorkoutRecords: jest.fn(() => ({ records: [], isLoading: false })),
}));

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text, View } = require('react-native');
  return {
    ScreenHeader: ({ title, action }: { title: string; action?: React.ReactNode }) => (
      <View>
        <Text>{title}</Text>
        {action}
      </View>
    ),
  };
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({ id: 'w-1' })),
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
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({ formatWeight: (kg: number) => `${kg} kg` }),
}));

/**
 * `useIntensity` est le point de bascule RPE ↔ RIR (US UX-05) : piloté depuis le test pour vérifier
 * que l'écran affiche l'échelle **choisie** et non la donnée stockée.
 */
jest.mock('@/hooks/useIntensity', () => ({ useIntensity: jest.fn() }));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockDetail = useWorkoutDetail as jest.Mock;
const mockRecords = useWorkoutRecords as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockIntensity = jest.requireMock('@/hooks/useIntensity').useIntensity as jest.Mock;

const back = jest.fn();

const serie = (overrides: Record<string, unknown> = {}) => ({
  id: 'set-1',
  setType: 'normal',
  reps: 10,
  weightKg: 80,
  durationSeconds: null,
  plannedWeightKg: null,
  rpe: null,
  done: true,
  ...overrides,
});

const exercice = (overrides: Record<string, unknown> = {}) => ({
  exerciseId: 'ex-1',
  exerciseName: 'Squat',
  sets: [serie()],
  ...overrides,
});

const seance = (overrides: Record<string, unknown> = {}) => ({
  id: 'w-1',
  startedAt: '2026-08-05T07:00:00.000Z',
  finishedAt: '2026-08-05T08:30:00.000Z',
  durationSeconds: 5400,
  volume: 12500,
  rpe: null,
  notes: null,
  entries: [exercice()],
  ...overrides,
});

const afficher = async (
  detail: unknown = seance(),
  { records = [] as unknown[], isLoading = false } = {},
) => {
  mockDetail.mockReturnValue({ detail, isLoading });
  mockRecords.mockReturnValue({ records, isLoading: false });
  await render(<WorkoutDetailScreen />);
};

/** Affiche une séance ne contenant qu'une série, décrite par `overrides`. */
const afficherSerie = async (overrides: Record<string, unknown>) =>
  afficher(seance({ entries: [exercice({ sets: [serie(overrides)] })] }));

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.mockReturnValue({ id: 'w-1' });
  mockUseRouter.mockReturnValue({ back });
  // Par défaut : échelle RPE, la donnée brute.
  mockIntensity.mockReturnValue({
    format: (rpe: number | null) => (rpe == null ? null : `RPE ${rpe}`),
  });
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('🔴 « introuvable » ne clignote pas pendant le chargement', async () => {
    await afficher(null, { isLoading: true });

    expect(screen.queryByText('history.detail.notFoundTitle')).toBeNull();
  });

  it('🔴 une séance absente reste sortable', async () => {
    await afficher(null);

    // Une séance supprimée depuis un autre appareil ouvre cet écran sur du vide : sans retour,
    // l'écran serait un cul-de-sac.
    expect(screen.getByText('history.detail.notFoundMessage')).toBeTruthy();
    await taper(screen.getByText('icone-arrow-back'));
    expect(back).toHaveBeenCalled();
  });

  it('🔴 le titre est la date de FIN, pas celle de début', async () => {
    await afficher(
      seance({ startedAt: '2026-08-05T23:30:00.000Z', finishedAt: '2026-08-06T00:45:00.000Z' }),
    );

    // Une séance à cheval sur minuit se range dans l'historique au jour où elle s'est terminée :
    // afficher le début ferait diverger le titre du détail et sa position dans la liste.
    expect(screen.getByText('06/08/2026')).toBeTruthy();
  });

  it('une séance jamais terminée retombe sur sa date de début', async () => {
    await afficher(seance({ finishedAt: null }));

    expect(screen.getByText('05/08/2026')).toBeTruthy();
  });

  it('une séance sans exercice le dit', async () => {
    await afficher(seance({ entries: [] }));

    expect(screen.getByText('history.detail.emptyExercises')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Métadonnées
// ---------------------------------------------------------------------------

describe('métadonnées', () => {
  it('durée, volume et RPE sont affichés quand ils existent', async () => {
    await afficher(seance({ durationSeconds: 5400, volume: 12500, rpe: 8 }));

    expect(screen.getByText('history.detail.durationMin:{"count":90}')).toBeTruthy();
    expect(screen.getByText('history.detail.volumeKg:{"volume":"12500 kg"}')).toBeTruthy();
    expect(screen.getByText('history.detail.metaRpeValue:{"value":8}')).toBeTruthy();
  });

  it('🔴 un volume NUL n’est pas affiché', async () => {
    await afficher(seance({ volume: 0 }));

    // « 0 kg de volume » sur une séance au poids de corps serait faux : le volume n'est pas nul,
    // il n'est pas mesurable.
    expect(screen.queryByText(/volumeKg/)).toBeNull();
  });

  it('une durée absente disparaît au lieu de valoir zéro', async () => {
    await afficher(seance({ durationSeconds: null }));

    expect(screen.queryByText(/durationMin/)).toBeNull();
  });

  it('🔴 un RPE de 0 reste affiché', async () => {
    await afficher(seance({ rpe: 0 }));

    // `!= null` et non un test de vérité : 0 est une valeur d'intensité légitime, la masquer
    // perdrait l'information la plus intéressante d'une séance de récupération.
    expect(screen.getByText('history.detail.metaRpeValue:{"value":0}')).toBeTruthy();
  });

  it('les notes ne sont montrées que si elles existent', async () => {
    await afficher(seance({ notes: null }));
    expect(screen.queryByText('history.detail.metaNotes')).toBeNull();

    await afficher(seance({ notes: 'Dos douloureux en fin de séance' }));
    expect(screen.getByText('Dos douloureux en fin de séance')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Séries : une lecture par type
// ---------------------------------------------------------------------------

describe('lecture des séries', () => {
  it('une série normale se lit « reps × charge »', async () => {
    await afficherSerie({ reps: 10, weightKg: 80 });

    expect(
      screen.getByText('history.detail.repsWeight:{"reps":10,"weight":"80 kg"}'),
    ).toBeTruthy();
  });

  it('🔴 une série à la DURÉE se lit en m:ss, pas en répétitions', async () => {
    await afficherSerie({ setType: 'duration', reps: null, weightKg: null, durationSeconds: 90 });

    // Un gainage de 90 s affiché « 90 reps » serait une lecture absurde.
    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('🔴 sur une série à la durée, la charge est un LEST, noté « + »', async () => {
    await afficherSerie({
      setType: 'duration',
      reps: null,
      weightKg: 10,
      durationSeconds: 45,
    });

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

    expect(screen.getByText('history.detail.repsOnly:{"reps":12}')).toBeTruthy();
  });

  it('une charge sans répétition reste lisible', async () => {
    await afficherSerie({ reps: null, weightKg: 60 });

    expect(screen.getByText('history.detail.weightOnly:{"weight":"60 kg"}')).toBeTruthy();
  });

  it('une série totalement vide affiche un tiret, pas « undefined »', async () => {
    await afficherSerie({ reps: null, weightKg: null });

    expect(screen.getByText('—')).toBeTruthy();
  });

  it.each([
    ['normal', 'history.detail.setNormal'],
    ['warmup', 'history.detail.setWarmup'],
    ['superset', 'history.detail.setSuperset'],
    ['duration', 'history.detail.setDuration'],
    ['bodyweight', 'history.detail.setBodyweight'],
    ['dropset', 'history.detail.setDropset'],
    ['failure', 'history.detail.setFailure'],
  ])('le type « %s » a son propre libellé', async (setType, cle) => {
    await afficherSerie({ setType });

    expect(screen.getByText(cle)).toBeTruthy();
  });

  it('🔴 un type INCONNU retombe sur « normale » plutôt que de casser', async () => {
    await afficherSerie({ setType: 'type-du-futur' });

    // Une valeur ajoutée par une version plus récente et synchronisée depuis le cloud ne doit pas
    // laisser une ligne sans libellé.
    expect(screen.getByText('history.detail.setNormal')).toBeTruthy();
  });

  it('les séries sont numérotées à partir de 1', async () => {
    await afficher(
      seance({
        entries: [exercice({ sets: [serie({ id: 'a' }), serie({ id: 'b' })] })],
      }),
    );

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('une série non validée se distingue d’une série faite', async () => {
    await afficher(
      seance({
        entries: [exercice({ sets: [serie({ id: 'a', done: true }), serie({ id: 'b', done: false })] })],
      }),
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
    ['▲', 90, 'plus lourd que prévu'],
    ['▼', 70, 'moins lourd que prévu'],
    ['=', 80, 'conforme'],
  ])('%s quand la charge réalisée est %s', async (fleche, weightKg) => {
    await afficherSerie({ weightKg, plannedWeightKg: 80 });

    // C'est la seule information qui distingue « j'ai suivi le programme » de « j'ai forcé » ou
    // « j'ai réduit » — l'écart se lit d'un coup d'œil, pas en comparant deux nombres.
    expect(
      screen.getByText(`history.detail.planned:{"weight":"80 kg"} ${fleche}`),
    ).toBeTruthy();
  });

  it('🔴 sans charge planifiée, aucun écart n’est affiché', async () => {
    await afficherSerie({ weightKg: 80, plannedWeightKg: null });

    // Une séance libre n'a rien à comparer : un « = » y suggérerait un plan qui n'existe pas.
    expect(screen.queryByText(/history\.detail\.planned/)).toBeNull();
  });

  it('une charge planifiée non réalisée affiche « = » plutôt que rien', async () => {
    await afficherSerie({ weightKg: null, plannedWeightKg: 80 });

    // Série non faite : la consigne reste visible, ce qui permet de la reprendre.
    expect(screen.getByText('history.detail.planned:{"weight":"80 kg"} =')).toBeTruthy();
  });

  it('🔴 l’intensité suit l’ÉCHELLE choisie, pas la donnée stockée', async () => {
    mockIntensity.mockReturnValue({
      format: (rpe: number | null) => (rpe == null ? null : `RIR ${10 - rpe}`),
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

    expect(
      screen.getByText('history.detail.planned:{"weight":"80 kg"} ▲ · RPE 9'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Records battus
// ---------------------------------------------------------------------------

describe('records battus', () => {
  it('🔴 aucune section quand aucun record n’a été battu', async () => {
    await afficher();

    // Une section « Records » vide sur chaque séance ordinaire banaliserait la seule chose qui
    // mérite d'être remarquée.
    expect(screen.queryByText('history.detail.sectionRecords')).toBeNull();
  });

  it('un record en charge affiche reps et charge', async () => {
    await afficher(seance(), {
      records: [
        { exerciseId: 'ex-1', exerciseName: 'Squat', type: 'max_weight', value: 120, reps: 3, weightKg: 120 },
      ],
    });

    expect(screen.getByText('history.detail.sectionRecords')).toBeTruthy();
    expect(
      screen.getByText('history.detail.repsWeight:{"reps":3,"weight":"120 kg"}'),
    ).toBeTruthy();
  });

  it('🔴 un record de VOLUME n’affiche pas de répétitions', async () => {
    // Séance sans exercice : les séries afficheraient elles aussi « reps × charge », et l'assertion
    // de négation ne saurait plus laquelle des deux lignes elle regarde.
    await afficher(seance({ entries: [] }), {
      records: [
        { exerciseId: 'ex-1', exerciseName: 'Squat', type: 'best_volume', value: 2400, reps: null, weightKg: null },
      ],
    });

    // Un volume est un produit charge × répétitions : lui coller un nombre de reps donnerait une
    // performance qui n'a jamais eu lieu.
    expect(screen.getByText('2400')).toBeTruthy();
    expect(screen.queryByText(/repsWeight/)).toBeNull();
  });

  it('plusieurs records du même exercice cohabitent', async () => {
    await afficher(seance(), {
      records: [
        { exerciseId: 'ex-1', exerciseName: 'Squat', type: 'max_weight', value: 120, reps: 3, weightKg: 120 },
        { exerciseId: 'ex-1', exerciseName: 'Squat', type: 'best_volume', value: 2400, reps: null, weightKg: null },
      ],
    });

    // La clé de liste combine exercice ET type : la seule sur l'exercice écraserait le second.
    expect(screen.getByText('history.detail.record.max_weight')).toBeTruthy();
    expect(screen.getByText('history.detail.record.best_volume')).toBeTruthy();
  });
});
