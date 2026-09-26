/**
 * Statistiques nutrition (`app/nutrition-stats.tsx`) — le **vrai** écran, monté.
 *
 * Écran à **0 %** avant ce fichier (68 instructions). Six cartes, chacune avec son état vide — et
 * une contrainte qui les relie : **une seule fenêtre temporelle** (7 j / 30 j) pilote les apports,
 * la répartition par repas, l'adhérence et la régularité. Quatre toggles indépendants auraient
 * produit quatre chiffres qu'on croirait comparables sans qu'ils le soient.
 *
 * Ce qui est vérifié, et qui casse en silence :
 *
 *  1. **La comparaison de période lit DEUX fenêtres.** L'écart « +12 % vs période précédente »
 *     suppose de charger 2 × la fenêtre puis de couper au seuil : un seul chargement donnerait un
 *     écart calculé contre du vide, donc toujours positif.
 *  2. **Le badge d'écart attend la fin du chargement.** Affiché trop tôt, il compare une moyenne
 *     partielle à une moyenne complète — un chiffre faux, plus visible que celui qu'il commente.
 *  3. **Le bilan calorique est SIGNÉ**, avec séparateur de milliers localisé : « 8400 » ne dit pas
 *     si l'on est au-dessus ou en dessous de sa cible, et c'est toute l'information.
 *  4. **L'adhérence distingue TROIS silences** : pas d'objectif, objectif mais aucun jour
 *     journalisé, et chargement. Un message unique ferait croire à un bug dans deux cas sur trois.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import NutritionStatsScreen from '../nutrition-stats';
import { logWeight, useLatestWeight, useWeightEntries } from '@/data/repositories/bodyweight-repository';
import {
  useDailyTotals,
  useJournalCompletion,
  useMealTotals,
} from '@/data/repositories/journal-repository';
import { useGoalAdherence } from '@/data/repositories/dashboard-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { track } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/bodyweight-repository', () => ({
  useLatestWeight: jest.fn(() => ({ latest: null })),
  useWeightEntries: jest.fn(() => ({ entries: [] })),
  logWeight: jest.fn(),
}));
jest.mock('@/data/repositories/journal-repository', () => ({
  useDailyTotals: jest.fn(() => ({ totals: [], isLoading: false })),
  useMealTotals: jest.fn(() => ({ mealTotals: [] })),
  useJournalCompletion: jest.fn(() => ({ isLoading: false, effectiveWindow: 0, loggedDays: 0, pct: 0 })),
  // US NUTRI-UX01 (R4.1) — onglet « Qualité » : fibres / sucres / AGS, moyennés sur la fenêtre.
  useQualityAverage: jest.fn(() => ({
    quality: { fiber: 0, sugars: 0, saturatedFat: 0, coverageRatio: 0 },
    loggedDays: 0,
    isLoading: false,
  })),
}));
jest.mock('@/data/repositories/dashboard-repository', () => ({
  useGoalAdherence: jest.fn(() => ({ isLoading: false, hasTarget: false })),
  // US NUTRI-UX01 (R4.3) — le graphe d'adhérence a besoin du détail par jour, pas d'un seul taux.
  useDailyCalorieTargets: jest.fn(() => ({
    days: [],
    marginPct: 10,
    hasTarget: false,
    weightKg: null,
    isLoading: false,
  })),
}));
jest.mock('@/data/repositories/nutrition-repository', () => ({
  useNutritionProfile: jest.fn(() => ({ nutritionProfile: null })),
}));
jest.mock('@/lib/analytics', () => ({
  track: jest.fn(() => Promise.resolve()),
  ANALYTICS_EVENTS: { statsViewed: 'stats_viewed' },
}));

/** Les cartes auto-portantes ont leurs propres tests : muettes ici. */
jest.mock('@/components/WeightGoalCard', () => ({ WeightGoalCard: () => null }));
jest.mock('@/components/ProteinPerKgCard', () => ({ ProteinPerKgCard: () => null }));
jest.mock('@/components/TrainingNutritionCrossCard', () => ({ TrainingNutritionCrossCard: () => null }));
jest.mock('@/components/nutrition/CrossTrainingSection', () => ({ CrossTrainingSection: () => null }));

jest.mock('@/components/charts/ProgressLineChart', () => {
  const { Text } = require('react-native');
  return {
    ProgressLineChart: ({ data, unit }: { data: { label: string; value: number }[]; unit: string }) => (
      <Text>
        courbe[{unit}]:{data.map((d) => `${d.label}=${d.value}`).join(',')}
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
jest.mock('@/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{label}</Text>
      </Pressable>
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
    }: {
      label: string;
      value: string;
      onChangeText: (v: string) => void;
    }) => <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} />,
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
          accessibilityLabel={`plage-${String(o)}`}
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
        >
          <Text>{label(o)}</Text>
        </Pressable>
      )),
  };
});

// US NUTRI-UX03 (R12) — l'écran s'ouvre sur un sous-onglet passé en paramètre.
jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(() => ({})) }));

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
      background: '#fffaf2',
      surface: '#fffaf2',
      track: '#ece0cd',
      accent: '#c0562f',
      success: '#7c8a5b',
      danger: '#b23b2e',
    },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    system: 'metric',
    weightSymbol: 'kg',
    toWeightValue: (kg: number) => kg,
    formatWeight: (kg: number) => `${kg} kg`,
    parseWeightToKg: (v: string) => {
      const n = Number(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockLatest = useLatestWeight as jest.Mock;
const mockEntries = useWeightEntries as jest.Mock;
const mockLogWeight = logWeight as jest.Mock;
const mockTotals = useDailyTotals as jest.Mock;
const mockMealTotals = useMealTotals as jest.Mock;
const mockCompletion = useJournalCompletion as jest.Mock;
const mockAdherence = useGoalAdherence as jest.Mock;
const mockNutritionProfile = useNutritionProfile as jest.Mock;
const mockTrack = track as jest.Mock;

/** « Aujourd'hui » : vendredi 14/08/2026. */
const AUJOURDHUI = '2026-08-14';

const jour = (logDate: string, kcal: number, overrides: Record<string, unknown> = {}) => ({
  logDate,
  kcal,
  proteinG: 100,
  carbsG: 200,
  fatG: 60,
  ...overrides,
});

/**
 * Monte l'écran **et ouvre l'onglet demandé**.
 *
 * ⚠️ Depuis l'US NUTRI-UX01 (R4.1), l'écran est découpé en quatre sous-onglets — Régularité ·
 * Apports · Poids · Qualité. Il empilait auparavant 8 sections permanentes et 4 cartes dans un
 * seul scroll, là où l'ADR-007 §2 plafonne le Tier 1 à 4-5 sections **et nommait déjà cet écran**
 * comme le point de saturation. Une assertion doit donc dire dans quel onglet elle se place.
 */
type Onglet = 'regularity' | 'intake' | 'weight' | 'quality';

/** Onglet ouvert par défaut — chaque `describe` fixe celui qui porte la section qu'il teste. */
let ongletParDefaut: Onglet = 'intake';

const afficher = async ({
  totals = [] as unknown[],
  isLoading = false,
  onglet = ongletParDefaut,
}: { totals?: unknown[]; isLoading?: boolean; onglet?: Onglet } = {}) => {
  mockTotals.mockReturnValue({ totals, isLoading });
  await render(<NutritionStatsScreen />);
  if (onglet !== 'regularity') {
    await act(async () => {
      fireEvent.press(screen.getByLabelText(`plage-${onglet}`));
    });
  }
};

afterEach(() => {
  ongletParDefaut = 'intake';
});

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const saisir = async (label: string, valeur: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText(label), valeur);
  });
};

const CHAMP_POIDS = 'stats.weight.log (kg)';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${AUJOURDHUI}T10:00:00`));
  mockLatest.mockReturnValue({ latest: null });
  mockEntries.mockReturnValue({ entries: [] });
  mockMealTotals.mockReturnValue({ mealTotals: [] });
  mockNutritionProfile.mockReturnValue({ nutritionProfile: null });
  mockCompletion.mockReturnValue({ isLoading: false, effectiveWindow: 0, loggedDays: 0, pct: 0 });
  mockAdherence.mockReturnValue({ isLoading: false, hasTarget: false });
  mockLogWeight.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Pesée
// ---------------------------------------------------------------------------

describe('pesée', () => {
  beforeEach(() => {
    ongletParDefaut = 'weight';
  });

  it('sans pesée, un message plutôt qu’un zéro', async () => {
    await afficher();

    // « 0 kg » serait une donnée fausse ; l'absence de pesée n'est pas un poids nul.
    expect(screen.getByText('stats.weight.empty')).toBeTruthy();
  });

  it('la dernière pesée est affichée avec sa tendance', async () => {
    mockLatest.mockReturnValue({ latest: { weightKg: 78 } });
    mockEntries.mockReturnValue({
      entries: [
        { logDate: '2026-08-01', weightKg: 80 },
        { logDate: '2026-08-14', weightKg: 78 },
      ],
    });
    await afficher();

    // `weightTrend` est pure et prise telle quelle : le sens de l'évolution est ce qu'on vient
    // chercher, pas le nombre seul.
    expect(screen.getByText('78 kg')).toBeTruthy();
    expect(screen.getByText('stats.weight.trend.down')).toBeTruthy();
  });

  it('🔴 le champ vide interdit l’enregistrement', async () => {
    await afficher();

    expect(
      screen.getByLabelText('stats.weight.save').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('enregistrer une pesée la date d’AUJOURD’HUI et vide le champ', async () => {
    await afficher();

    await saisir(CHAMP_POIDS, '77,5');
    await taper(screen.getByLabelText('stats.weight.save'));

    // La pesée du jour est un fait daté : sans la date, elle écraserait ou dupliquerait une autre.
    expect(mockLogWeight).toHaveBeenCalledWith(AUJOURDHUI, 77.5);
    expect(screen.getByLabelText(CHAMP_POIDS).props.value).toBe('');
  });

  it('🔴 une saisie illisible ou nulle n’écrit RIEN', async () => {
    await afficher();

    await saisir(CHAMP_POIDS, '0');
    await taper(screen.getByLabelText('stats.weight.save'));

    // Un poids de 0 kg fausserait la tendance et l'apport protéique par kilo — durablement, la
    // pesée étant un point de la courbe.
    expect(mockLogWeight).not.toHaveBeenCalled();
  });

  it('🔴 la courbe exige DEUX points', async () => {
    mockEntries.mockReturnValue({ entries: [{ logDate: '2026-08-14', weightKg: 78 }] });
    await afficher();

    // Une courbe à un point est un point : elle donne l'illusion d'une tendance qu'on ne peut pas
    // encore lire.
    expect(screen.queryByText(/^courbe\[kg\]/)).toBeNull();
  });

  it('avec deux points, la courbe apparaît en JJ/MM', async () => {
    mockEntries.mockReturnValue({
      entries: [
        { logDate: '2026-08-01', weightKg: 80 },
        { logDate: '2026-08-14', weightKg: 78 },
      ],
    });
    await afficher();

    expect(screen.getByText('courbe[kg]:01/08=80,14/08=78')).toBeTruthy();
  });

  it('changer de plage REDEMANDE les pesées sur la bonne fenêtre', async () => {
    mockEntries.mockReturnValue({
      entries: [
        { logDate: '2026-08-01', weightKg: 80 },
        { logDate: '2026-08-14', weightKg: 78 },
      ],
    });
    await afficher();

    await taper(screen.getByLabelText('plage-4w'));

    // 28 jours avant le 14/08 → 17/07. Sans ce paramètre, la courbe afficherait toujours la même
    // fenêtre quel que soit le bouton pressé.
    expect(mockEntries).toHaveBeenLastCalledWith('2026-07-17');
  });
});

// ---------------------------------------------------------------------------
// Apports moyens
// ---------------------------------------------------------------------------

describe('apports moyens', () => {
  it('sans jour journalisé, un état vide', async () => {
    await afficher();

    // Deux cartes portent ce message — apports et répartition par repas : c'est le même fait,
    // rien de journalisé sur la fenêtre.
    expect(screen.getAllByText('stats.intake.empty')).toHaveLength(2);
  });

  it('🔴 la fenêtre chargée fait DEUX fois la période affichée', async () => {
    await afficher();

    // L'écart « vs période précédente » suppose de charger 2 × la fenêtre puis de couper au seuil :
    // un seul chargement donnerait un écart calculé contre du vide, donc toujours positif.
    // 7 j affichés → 14 j chargés → depuis le 31/07.
    expect(mockTotals).toHaveBeenCalledWith('2026-07-31');
  });

  it('🔴 seuls les jours DANS la fenêtre entrent dans la moyenne', async () => {
    await afficher({
      totals: [
        jour('2026-08-01', 3000), // hors fenêtre 7 j → période précédente
        jour('2026-08-12', 2000),
        jour('2026-08-13', 2000),
      ],
    });

    // `averageIntake` est pure : ce qui se teste ici, c'est la COUPE au seuil. Mélanger les deux
    // périodes rendrait la moyenne et l'écart faux tous les deux.
    expect(screen.getByText('2000')).toBeTruthy();
  });

  it('🔴 l’écart compare bien les deux périodes', async () => {
    await afficher({
      totals: [
        jour('2026-08-01', 1000),
        jour('2026-08-12', 2000),
      ],
    });

    // 1000 → 2000 = +100 %, et le SENS est porté par le badge : un pourcentage nu ne dit pas si
    // la semaine est meilleure.
    expect(screen.getByText('delta:100:up')).toBeTruthy();
  });

  it('🔴 le badge d’écart attend la fin du CHARGEMENT', async () => {
    await afficher({ totals: [jour('2026-08-12', 2000)], isLoading: true });

    // Affiché trop tôt, il compare une moyenne partielle à une moyenne complète — un chiffre faux,
    // plus visible que celui qu'il commente.
    expect(screen.queryByText(/^delta:/)).toBeNull();
    expect(screen.getByText('2000')).toBeTruthy();
  });

  it('les macros moyennes accompagnent les calories', async () => {
    await afficher({ totals: [jour('2026-08-12', 2000)] });

    expect(screen.getByText(/nutrition\.macros\.protein 100 g/)).toBeTruthy();
  });

  it('🔴 changer de plage recharge les DEUX fenêtres', async () => {
    await afficher({ totals: [jour('2026-08-12', 2000)] });

    await taper(screen.getByLabelText('plage-30d'));

    // 30 j affichés → 60 j chargés → depuis le 15/06.
    expect(mockTotals).toHaveBeenLastCalledWith('2026-06-15');
  });

  it('la courbe d’apports exige elle aussi deux points', async () => {
    await afficher({ totals: [jour('2026-08-12', 2000)] });

    expect(screen.queryByText(/^courbe\[nutrition\.kcal\]/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Répartition par repas
// ---------------------------------------------------------------------------

describe('répartition par repas', () => {
  it('sans donnée, l’état vide de la section apports', async () => {
    await afficher();

    // Deux cartes peuvent afficher ce message : c'est le même fait — rien de journalisé.
    expect(screen.getAllByText('stats.intake.empty').length).toBeGreaterThan(0);
  });

  it('🔴 un repas CUSTOM sans nom retombe sur son RANG, jamais sur sa clé technique', async () => {
    mockNutritionProfile.mockReturnValue({
      nutritionProfile: {
        meals: [
          { key: 'breakfast', label: null },
          { key: 'custom-abc123', label: null },
        ],
      },
    });
    mockMealTotals.mockReturnValue({
      mealTotals: [{ mealKey: 'custom-abc123', kcal: 4200 }],
    });
    await afficher({ totals: [jour('2026-08-12', 2000)] });

    // Afficher « custom-abc123 » à l'écran est le défaut déjà corrigé côté journal : la clé
    // technique n'a aucun sens pour l'utilisateur.
    expect(screen.getByText('meals.mealN:{"n":2}')).toBeTruthy();
    expect(screen.queryByText(/custom-abc123/)).toBeNull();
  });

  it('🔴 le bucket « Autres » a sa PROPRE clé', async () => {
    mockMealTotals.mockReturnValue({ mealTotals: [{ mealKey: 'other', kcal: 1400 }] });
    await afficher({ totals: [jour('2026-08-12', 2000)] });

    // Les entrées orphelines (repas supprimé de la config) atterrissent ici : les compter dans un
    // repas existant fausserait sa part.
    expect(screen.getByText('journal.meals.other')).toBeTruthy();
  });

  it('un repas par défaut prend son libellé traduit', async () => {
    mockMealTotals.mockReturnValue({ mealTotals: [{ mealKey: 'breakfast', kcal: 2800 }] });
    await afficher({ totals: [jour('2026-08-12', 2000)] });

    expect(screen.getByText('journal.meals.breakfast')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Adhérence
// ---------------------------------------------------------------------------

describe('adhérence à l’objectif', () => {
  beforeEach(() => {
    ongletParDefaut = 'regularity';
  });

  it('🔴 trois silences distincts, trois messages', async () => {
    mockAdherence.mockReturnValue({ isLoading: true });
    await afficher();
    expect(screen.queryByText('stats.adherence.noTarget')).toBeNull();

    mockAdherence.mockReturnValue({ isLoading: false, hasTarget: false });
    await afficher();
    // Sans objectif, il n'y a rien à respecter : ce n'est pas une absence de données.
    expect(screen.getByText('stats.adherence.noTarget')).toBeTruthy();

    mockAdherence.mockReturnValue({ isLoading: false, hasTarget: true, loggedDays: 0 });
    await afficher();
    // Objectif posé mais rien journalisé : le geste attendu est différent du précédent.
    expect(screen.getByText('stats.adherence.empty')).toBeTruthy();
  });

  it('affiche le score, la marge et le décompte par état', async () => {
    mockAdherence.mockReturnValue({
      isLoading: false,
      hasTarget: true,
      loggedDays: 7,
      daysInTarget: 5,
      pct: 71,
      marginPct: 10,
      balanceKcal: -1400,
      daysAbove: 1,
      daysBelow: 1,
    });
    await afficher({ totals: [jour('2026-08-12', 2000)] });

    // Depuis l'US NUTRI-UX01 (R4.3), l'adhérence n'est plus quatre phrases en texte mono mais un
    // graphe à zone-cible : le score se lit « 5 / 7 j », et la marge reste affichée — « dans la
    // cible » ne veut rien dire sans la tolérance retenue.
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('stats.adherence.outOfDays:{"total":7}')).toBeTruthy();
    expect(screen.getByText('stats.adherence.marginShort:{"pct":10}')).toBeTruthy();
  });

  it.each([
    [-1400, '−1 400'],
    [8400, '+8 400'],
    [0, '0'],
  ])('🔴 le bilan calorique %i est SIGNÉ et localisé', async (balanceKcal, attendu) => {
    mockAdherence.mockReturnValue({
      isLoading: false,
      hasTarget: true,
      loggedDays: 7,
      daysInTarget: 5,
      pct: 71,
      marginPct: 10,
      balanceKcal,
      daysAbove: 1,
      daysBelow: 1,
    });
    await afficher({ totals: [jour('2026-08-12', 2000)] });

    // « 8400 » ne dit pas si l'on est au-dessus ou en dessous de sa cible, et c'est toute
    // l'information. `Intl.NumberFormat` apporte aussi le séparateur de milliers de la langue —
    // une concaténation manuelle donnerait « +8400 », illisible.
    const balance = screen.getByText(/stats\.adherence\.balanceSentence/).children.join('');
    expect(balance).toContain(attendu.replace('−', '-').replace(/ /g, ' ').split(' ')[0]!);
  });

  it('les jours au-dessus et en dessous sont comptés séparément', async () => {
    mockAdherence.mockReturnValue({
      isLoading: false,
      hasTarget: true,
      loggedDays: 7,
      daysInTarget: 4,
      pct: 57,
      marginPct: 10,
      balanceKcal: 0,
      daysAbove: 2,
      daysBelow: 1,
    });
    await afficher({ totals: [jour('2026-08-12', 2000)] });

    // Un bilan à zéro peut cacher deux jours très hauts et un très bas : le détail est ce qui
    // rend le chiffre actionnable. Il vient de `useGoalAdherence` — le graphe ne recompte rien,
    // sous peine d'afficher deux chiffres différents pour la même semaine.
    expect(screen.getByText('stats.adherence.legend.over:{"count":2}')).toBeTruthy();
    expect(screen.getByText('stats.adherence.legend.under:{"count":1}')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Régularité et divers
// ---------------------------------------------------------------------------

describe('régularité du journal', () => {
  beforeEach(() => {
    ongletParDefaut = 'regularity';
  });

  it('🔴 une fenêtre effective NULLE affiche l’état vide, pas 0 %', async () => {
    mockCompletion.mockReturnValue({ isLoading: false, effectiveWindow: 0, loggedDays: 0, pct: 0 });
    await afficher();

    // « 0 % de régularité » à quelqu'un qui vient d'installer l'app est un reproche pour une
    // fenêtre qui n'existe pas encore.
    expect(screen.getByText('stats.completion.empty')).toBeTruthy();
  });

  it('affiche la heatmap dès que la fenêtre existe', async () => {
    mockCompletion.mockReturnValue({ isLoading: false, effectiveWindow: 7, loggedDays: 5, pct: 71 });
    await afficher();

    // R4.2 — le taux nu (« 71 % ») est remplacé par 30 cases et trois compteurs : un pourcentage
    // ne dit ni QUAND on a décroché, ni depuis combien de jours on tient.
    expect(screen.getByText('stats.regularity.title')).toBeTruthy();
    expect(screen.getByText('stats.regularity.currentStreak')).toBeTruthy();
    expect(screen.getByText('stats.regularity.bestStreak')).toBeTruthy();
  });

  it('l’ouverture de l’écran est tracée UNE fois', async () => {
    await afficher();

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('stats_viewed', { pillar: 'nutrition' });
  });

  it('🔴 une SEULE fenêtre pilote tout ce qui est visible dans l’onglet', async () => {
    await afficher({ totals: [jour('2026-08-12', 2000)] });

    await taper(screen.getByLabelText('plage-7d'));

    // La règle n'a pas changé avec les sous-onglets (US NUTRI-UX01, R4.1), elle s'applique
    // seulement à ce qui est **affiché ensemble** : ici la heatmap et le graphe d'adhérence.
    // Deux fenêtres côte à côte donneraient deux périodes qu'on croirait comparables — c'est
    // d'ailleurs le défaut que la première version de cette refonte avait introduit, la heatmap
    // restant figée à 30 jours en face d'une adhérence sur 7.
    expect(mockAdherence).toHaveBeenLastCalledWith(7);
    expect(mockCompletion).toHaveBeenLastCalledWith(7);
  });

  it('🔴 la répartition par repas suit la fenêtre de SON onglet', async () => {
    await afficher({ totals: [jour('2026-08-12', 2000)], onglet: 'intake' });

    await taper(screen.getByLabelText('plage-30d'));

    // Les apports et la répartition sont affichés ensemble : ils partagent donc leur sélecteur.
    expect(mockMealTotals).toHaveBeenLastCalledWith('2026-07-15');
  });
});

// ---------------------------------------------------------------------------
// US NUTRI-UX03 — « Me peser » ouvre l'onglet Poids (R12, décision Q8)
// ---------------------------------------------------------------------------

describe('sous-onglet passé en paramètre', () => {
  const { useLocalSearchParams } = jest.requireMock('expo-router') as { useLocalSearchParams: jest.Mock };

  afterEach(() => {
    useLocalSearchParams.mockReturnValue({});
  });

  it('🔴 `tab=weight` ouvre directement Poids, où sont la pesée et la courbe', async () => {
    // Avant : les trois portes « Me peser » de l'accueil ouvraient Régularité, et il fallait
    // trouver l'onglet Poids pour saisir sa pesée.
    useLocalSearchParams.mockReturnValue({ tab: 'weight' });
    mockTotals.mockReturnValue({ totals: [], isLoading: false });
    await render(<NutritionStatsScreen />);

    expect(screen.getByLabelText('plage-weight').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText(CHAMP_POIDS)).toBeTruthy();
  });

  it('un paramètre inconnu retombe sur Régularité, comme avant', async () => {
    useLocalSearchParams.mockReturnValue({ tab: 'poids' });
    mockTotals.mockReturnValue({ totals: [], isLoading: false });
    await render(<NutritionStatsScreen />);

    expect(screen.getByLabelText('plage-regularity').props.accessibilityState.selected).toBe(true);
  });
});
