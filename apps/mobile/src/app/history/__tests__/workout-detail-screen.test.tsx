/**
 * Détail d'une séance passée (`app/history/[id].tsx`) — ce que **la route** décide.
 *
 * ── Ce que ce fichier ne teste plus, et où c'est parti ───────────────────────────────────────────
 * Il couvrait le rendu série par série, l'écart au planifié, l'intensité et les records : tout cela
 * a déménagé dans le bilan partagé (US MUSCU-UX02) et y est testé au bon niveau —
 * [`ReportExerciseList.test.tsx`](../../../components/workout/report/__tests__/ReportExerciseList.test.tsx)
 * pour les séries, [`WorkoutReport.test.tsx`](../../../components/workout/report/__tests__/WorkoutReport.test.tsx)
 * pour les blocs et le ressenti. Ces règles valent désormais pour **les deux** écrans au lieu d'un.
 *
 * Il ne couvrait **plus** les chips « durée / volume / RPE » : elles ont disparu. Le RPE y était
 * affiché brut (« 8/10 ») alors que le récap disait « Difficile » — deux lectures contradictoires
 * de `workouts.rpe`, corrigées par la spec R10.
 *
 * Restent les décisions de la route : ne pas faire clignoter « introuvable », rester sortable, et
 * titrer par la date.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import WorkoutDetailScreen from '../[id]';
import { useWorkoutReport } from '@/data/repositories/workout-report-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/workout-report-repository', () => ({
  useWorkoutReport: jest.fn(() => ({ report: null, isLoading: false })),
}));

// Le bilan a sa propre couverture : on ne remonte pas douze blocs pour tester un en-tête.
jest.mock('@/components/workout/report/WorkoutReport', () => {
  const { Text } = require('react-native');
  return { WorkoutReport: ({ context }: { context: string }) => <Text>bilan:{context}</Text> };
});

jest.mock('@/components/Screen', () => {
  const { View } = require('react-native');
  return {
    Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('@/components/ScreenHeader', () => {
  const { Text, View } = require('react-native');
  return {
    ScreenHeader: ({
      title,
      subtitle,
      action,
    }: {
      title: string;
      subtitle?: string;
      action?: React.ReactNode;
    }) => (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
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
  useTheme: () => ({ colors: { text: '#f4ecdd', textMuted: '#c9b79a', accent: '#dd6e40' } }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockReport = useWorkoutReport as jest.Mock;
const mockParams = useLocalSearchParams as unknown as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const back = jest.fn();

const bilan = (over: Record<string, unknown> = {}) => ({
  workoutId: 'w-1',
  title: 'Haut du corps',
  startedAt: '2026-09-11T16:42:00.000Z',
  ...over,
});

const afficher = async ({
  report = bilan() as unknown,
  isLoading = false,
  params = { id: 'w-1' } as Record<string, string>,
} = {}) => {
  mockReport.mockReturnValue({ report, isLoading });
  mockParams.mockReturnValue(params);
  await render(<WorkoutDetailScreen />);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ back });
});

// ---------------------------------------------------------------------------
// États d'écran
// ---------------------------------------------------------------------------

describe('états d’écran', () => {
  it('🔴 « introuvable » ne clignote pas pendant le chargement', async () => {
    await afficher({ report: null, isLoading: true });

    // La requête locale répond en quelques millisecondes : afficher « séance introuvable » en
    // attendant produirait un clignotement que personne ne sait interpréter.
    expect(screen.queryByText('history.detail.notFoundTitle')).toBeNull();
  });

  it('une séance absente le dit', async () => {
    await afficher({ report: null, isLoading: false });

    expect(screen.getByText('history.detail.notFoundTitle')).toBeTruthy();
    expect(screen.getByText('history.detail.notFoundMessage')).toBeTruthy();
  });

  it('🔴 une séance absente reste SORTABLE', async () => {
    await afficher({ report: null, isLoading: false });

    // Sans flèche de retour sur l'écran d'erreur, on est piégé : c'est un cul-de-sac atteignable
    // par simple lien profond ou suppression depuis un autre appareil.
    expect(screen.getByText('icone-arrow-back')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// En-tête
// ---------------------------------------------------------------------------

describe('en-tête', () => {
  it('titre la séance par sa date, en LOCAL', async () => {
    await afficher({ report: bilan({ startedAt: '2026-09-11T16:42:00.000Z' }) });

    const d = new Date('2026-09-11T16:42:00.000Z');
    const attendu = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    // Un `slice` de la chaîne ISO UTC décalerait le jour d'un fuseau : une séance du soir
    // deviendrait celle du lendemain.
    expect(screen.getByText(attendu)).toBeTruthy();
  });

  it('sous-titre par le nom de la séance', async () => {
    await afficher({ report: bilan({ title: 'Haut du corps' }) });

    expect(screen.getByText('Haut du corps')).toBeTruthy();
  });

  it('une séance libre est nommée comme telle, pas laissée vide', async () => {
    await afficher({ report: bilan({ title: null }) });

    expect(screen.getByText('history.freeSession')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Montage du bilan
// ---------------------------------------------------------------------------

describe('bilan', () => {
  it('🔴 monte le bilan dans son contexte HISTORIQUE', async () => {
    await afficher();

    // C'est ce qui empêche la célébration de rejouer à la réouverture d'une vieille séance
    // (spec R9) — la seule différence de fond entre les deux montages.
    expect(screen.getByText('bilan:history')).toBeTruthy();
  });
});
