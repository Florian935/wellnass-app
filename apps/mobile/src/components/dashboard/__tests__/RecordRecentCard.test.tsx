/**
 * Widget « Records récents » (`components/dashboard/RecordRecentCard`, roadmap 7.8).
 *
 * Composant à **0 %** avant ce fichier. Trois déclinaisons, **deux sources** et un formatage qui
 * dépend du pilier — c'est ce croisement qui porte le risque, pas le rendu.
 *
 *  1. **`small` / `wide` lisent le dernier record TOUS PILIERS**, `large` lit la liste muscu et
 *     **retombe** sur le dernier record si aucun record muscu n'existe. Deux sources, deux états
 *     vides possibles, et un repli entre les deux.
 *  2. **Le formatage dépend du type de record** : un volume est un nombre de kilos **localisé**,
 *     une charge passe par les unités de l'utilisateur, un temps de course est un chrono. Les
 *     confondre afficherait « 12 500 kg » là où il faut « 4:12 ».
 *  3. **Le décompte « cette semaine » se calcule sur 7 jours pleins**, et n'apparaît pas à zéro.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { RecordRecentCard } from '../RecordRecentCard';
import {
  useMostRecentRecord,
  useRecentStrengthRecords,
} from '@/data/repositories/dashboard-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useMostRecentRecord: jest.fn(),
  useRecentStrengthRecords: jest.fn(),
}));

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
        <View accessibilityLabel={accessibilityLabel}>{children}</View>
      ),
    Eyebrow: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Metric: ({ value }: { value: string }) => <Text>{value}</Text>,
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

const mockLast = useMostRecentRecord as jest.Mock;
const mockRecent = useRecentStrengthRecords as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

/** Aujourd'hui figé : les dates relatives sont calculées depuis `Date.now()`. */
const AUJOURDHUI = new Date('2026-08-09T12:00:00.000Z');
const ilYA = (jours: number) =>
  new Date(AUJOURDHUI.getTime() - jours * 86_400_000).toISOString();

const recordMuscu = (overrides: Record<string, unknown> = {}) => ({
  pillar: 'strength',
  exerciseName: 'Squat',
  type: 'best_weight',
  value: 120,
  achievedAt: ilYA(0),
  ...overrides,
});

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(AUJOURDHUI);
  mockUseRouter.mockReturnValue({ push });
  mockLast.mockReturnValue({ record: recordMuscu(), isLoading: false });
  mockRecent.mockReturnValue({ records: [], isLoading: false });
});

afterEach(() => {
  jest.useRealTimers();
});

const TAILLES = ['small', 'wide', 'large'] as const;

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

describe('chargement', () => {
  it.each(TAILLES)('🔴 %s ne rend rien tant que la première source charge', async (size) => {
    mockLast.mockReturnValue({ record: null, isLoading: true });

    const vue = await render(<RecordRecentCard size={size} />);

    expect(vue.toJSON()).toBeNull();
  });

  it('🔴 le chargement de la SECONDE source suffit à attendre', async () => {
    mockRecent.mockReturnValue({ records: [], isLoading: true });

    const vue = await render(<RecordRecentCard size="large" />);

    // Deux sources, deux moments de résolution : afficher « aucun record » parce que l'une des
    // deux n'a pas répondu ferait clignoter un état vide à chaque ouverture de l'accueil.
    expect(vue.toJSON()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Formatage selon le pilier
// ---------------------------------------------------------------------------

describe('formatage', () => {
  it('une charge passe par les unités de l’utilisateur', async () => {
    mockLast.mockReturnValue({
      record: recordMuscu({ type: 'best_weight', value: 120 }),
      isLoading: false,
    });

    await render(<RecordRecentCard size="wide" />);

    expect(screen.getByText('120 kg')).toBeTruthy();
  });

  it('🔴 un VOLUME est un nombre localisé, pas une charge convertie', async () => {
    mockLast.mockReturnValue({
      record: recordMuscu({ type: 'best_volume', value: 12500.4 }),
      isLoading: false,
    });

    await render(<RecordRecentCard size="wide" />);

    // Un volume de séance ne se convertit pas en livres : c'est un cumul, pas une charge soulevée.
    // Il est arrondi et séparé par milliers (espace insécable en français).
    expect(screen.getByText(/12.500 kg/)).toBeTruthy();
  });

  it('🔴 un record de COURSE affiche un chrono, pas des kilos', async () => {
    mockLast.mockReturnValue({
      record: {
        pillar: 'running',
        distanceKey: '5k',
        bestTimeSeconds: 1252,
        achievedAt: ilYA(2),
      },
      isLoading: false,
    });

    await render(<RecordRecentCard size="wide" />);

    // Confondre les deux afficherait « 1252 kg » sur un record de 5 km.
    expect(screen.getByText('20:52')).toBeTruthy();
    expect(screen.getByText('running.records.distance5k')).toBeTruthy();
  });

  it('un record du jour est dit « aujourd’hui »', async () => {
    mockLast.mockReturnValue({ record: recordMuscu({ achievedAt: ilYA(0) }), isLoading: false });

    await render(<RecordRecentCard size="wide" />);

    // « il y a 0 jour » se lit comme un défaut de calcul.
    expect(screen.getByText('home.record.today')).toBeTruthy();
  });

  it('un record plus ancien est daté en jours', async () => {
    mockLast.mockReturnValue({ record: recordMuscu({ achievedAt: ilYA(3) }), isLoading: false });

    await render(<RecordRecentCard size="wide" />);

    expect(screen.getByText('home.record.daysAgo:{"count":3}')).toBeTruthy();
  });

  it('🔴 une date invalide n’affiche pas « NaN »', async () => {
    mockLast.mockReturnValue({
      record: recordMuscu({ achievedAt: 'pas-une-date' }),
      isLoading: false,
    });

    await render(<RecordRecentCard size="wide" />);

    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.getByText('Squat')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('navigation', () => {
  it('un record muscu mène à la progression', async () => {
    await render(<RecordRecentCard size="wide" />);

    await taper(screen.getByLabelText('home.record.title'));

    expect(push).toHaveBeenCalledWith('/progress');
  });

  it('🔴 un record de COURSE mène à l’historique de course', async () => {
    mockLast.mockReturnValue({
      record: { pillar: 'running', distanceKey: '5k', bestTimeSeconds: 1252, achievedAt: ilYA(1) },
      isLoading: false,
    });

    await render(<RecordRecentCard size="wide" />);
    await taper(screen.getByLabelText('home.record.title'));

    // Ouvrir l'écran de progression muscu sur un record de course ne montrerait pas le record.
    expect(push).toHaveBeenCalledWith('/running-history');
  });

  it('🔴 sans aucun record, la carte n’est PAS cliquable', async () => {
    mockLast.mockReturnValue({ record: null, isLoading: false });

    await render(<RecordRecentCard size="wide" />);

    // Un widget vide qui navigue quand même emmène vers un écran vide : deux déceptions au lieu
    // d'une.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('home.record.empty')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Grand format
// ---------------------------------------------------------------------------

describe('grand format', () => {
  const liste = () => [
    { exerciseName: 'Squat', type: 'best_weight', value: 120, achievedAt: ilYA(1) },
    { exerciseName: 'Développé', type: 'best_weight', value: 90, achievedAt: ilYA(3) },
    { exerciseName: 'Soulevé', type: 'best_volume', value: 8200, achievedAt: ilYA(6) },
    { exerciseName: 'Rowing', type: 'best_weight', value: 70, achievedAt: ilYA(20) },
  ];

  it('🔴 n’affiche que les TROIS premiers records', async () => {
    mockRecent.mockReturnValue({ records: liste(), isLoading: false });

    await render(<RecordRecentCard size="large" />);

    // Le widget a une hauteur fixe : une quatrième ligne déborderait ou compresserait les autres.
    expect(screen.getByText('Squat')).toBeTruthy();
    expect(screen.getByText('Soulevé')).toBeTruthy();
    expect(screen.queryByText('Rowing')).toBeNull();
  });

  it('🔴 le décompte hebdomadaire ne compte que les 7 derniers jours', async () => {
    mockRecent.mockReturnValue({ records: liste(), isLoading: false });

    await render(<RecordRecentCard size="large" />);

    // Trois records à 1, 3 et 6 jours ; celui de 20 jours est hors fenêtre. Le compter donnerait
    // une semaine flatteuse et fausse.
    expect(screen.getByText('home.record.weekCount:{"count":3}')).toBeTruthy();
  });

  it('🔴 aucun record cette semaine → AUCUN décompte affiché', async () => {
    mockRecent.mockReturnValue({
      records: [{ exerciseName: 'Squat', type: 'best_weight', value: 120, achievedAt: ilYA(30) }],
      isLoading: false,
    });

    await render(<RecordRecentCard size="large" />);

    // « 0 record cette semaine » sous une liste de records est un reproche gratuit.
    expect(screen.queryByText(/home\.record\.weekCount/)).toBeNull();
  });

  it('🔴 sans record muscu, RETOMBE sur le dernier record tous piliers', async () => {
    mockRecent.mockReturnValue({ records: [], isLoading: false });
    mockLast.mockReturnValue({
      record: { pillar: 'running', distanceKey: '10k', bestTimeSeconds: 2700, achievedAt: ilYA(2) },
      isLoading: false,
    });

    await render(<RecordRecentCard size="large" />);

    // Un coureur qui ne fait pas de muscu verrait sinon « aucun record » alors qu'il vient d'en
    // battre un.
    expect(screen.getByText('running.records.distance10k')).toBeTruthy();
    expect(screen.queryByText('home.record.empty')).toBeNull();
  });

  it('aucun record du tout → état vide rédigé', async () => {
    mockRecent.mockReturnValue({ records: [], isLoading: false });
    mockLast.mockReturnValue({ record: null, isLoading: false });

    await render(<RecordRecentCard size="large" />);

    expect(screen.getByText('home.record.empty')).toBeTruthy();
  });
});
