/**
 * Widget 7.5 — résumé nutritionnel du jour (`components/dashboard/NutritionSummaryCard`).
 *
 * Fichier à **0 %** avant ce test. Le widget ne calcule presque rien lui-même — les calories, les
 * macros et le bonus viennent de `useNutritionSummary`, les cibles de `trainingDayMacroGrams` — mais
 * il **décide de ce qu'on affiche quand la donnée manque**, et c'est là que se logent les défauts
 * qui ne lèvent aucune erreur :
 *
 *  1. **Pendant le chargement, il ne rend RIEN.** Afficher « 0 » puis la vraie valeur se lit comme
 *     « tu n'as encore rien mangé » — un message faux, affiché à chaque ouverture de l'accueil.
 *  2. **Le restant ne descend jamais sous zéro.** `Math.max(0, …)` : un dépassement affiche 0, pas
 *     « −310 ». Un compteur négatif sur un widget d'accueil est un reproche permanent, et la spec
 *     nutrition interdit ce ton.
 *  3. **Sans objectif calculable, il n'invente pas de barre.** Anneau et jauge sont proportionnels à
 *     une cible : sans cible, le widget bascule sur le consommé et retire la barre plutôt que
 *     d'afficher une progression vers rien.
 *  4. **Les macros manuelles priment sur les macros calculées** — la même règle que l'écran
 *     nutrition (US MN-04). Un widget qui recalculerait afficherait d'autres chiffres que l'écran
 *     qu'il résume.
 *
 * Les trois formes sont testées séparément parce qu'elles n'affichent pas les mêmes champs : c'est
 * le petit carré qui régresse en silence, personne ne le regarde en revue.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { objectiveFromGoal, trainingDayMacroGrams } from '@wellness/shared';

import { NutritionSummaryCard } from '../NutritionSummaryCard';
import { useNutritionSummary } from '@/data/repositories/dashboard-repository';
import { useNutritionProfile } from '@/data/repositories/nutrition-repository';
import { useProfile } from '@/data/repositories/profile-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/dashboard-repository', () => ({
  useNutritionSummary: jest.fn(),
}));
jest.mock('@/data/repositories/nutrition-repository', () => ({
  useNutritionProfile: jest.fn(() => ({ nutritionProfile: null })),
}));
jest.mock('@/data/repositories/profile-repository', () => ({
  useProfile: jest.fn(() => ({ profile: null })),
}));

// `useTodayKey` lit l'horloge et s'abonne à `AppState` : figé, sinon le paramètre `date` du
// deep-link changerait de valeur à minuit et le test tomberait une nuit sur deux.
jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: () => '2026-08-11' }));

jest.mock('@/components/widgets/primitives', () => {
  const { Text, View } = require('react-native');
  return {
    // `pct` est rendu en texte : c'est la seule façon d'asserter le remplissage de l'anneau,
    // qui n'est autrement qu'un `strokeDashoffset` dans un SVG.
    RingGauge: ({ pct, children }: { pct: number; children: React.ReactNode }) => (
      <View>
        <Text>anneau:{pct}</Text>
        {children}
      </View>
    ),
  };
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
  };
});

jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

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
      track: '#ece0cd',
      accent: '#c0562f',
      amber: '#d69b3f',
      chartGreen: '#7c8a5b',
      success: '#7c8a5b',
    },
  }),
}));

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const mockSummary = useNutritionSummary as jest.Mock;
const mockNutritionProfile = useNutritionProfile as jest.Mock;
const mockProfile = useProfile as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const push = jest.fn();

const TAILLES = ['small', 'wide', 'large'] as const;

const resume = (overrides: Record<string, unknown> = {}) => ({
  kcal: 1200,
  target: 2000,
  effectiveTarget: 2000,
  trainingBonus: 0,
  isTrainingDay: false,
  bonusSource: 'none' as const,
  macros: { p: 80, g: 150, l: 40 },
  hasProfile: true,
  isLoading: false,
  ...overrides,
});

const afficher = async (
  size: (typeof TAILLES)[number] = 'wide',
  overrides: Record<string, unknown> = {},
) => {
  mockSummary.mockReturnValue(resume(overrides));
  await render(<NutritionSummaryCard size={size} />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRouter.mockReturnValue({ push });
  mockNutritionProfile.mockReturnValue({ nutritionProfile: null });
  mockProfile.mockReturnValue({ profile: null });
});

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

describe('chargement', () => {
  it.each(TAILLES)('🔴 ne rend RIEN tant que la donnée charge (%s)', async (size) => {
    await afficher(size, { isLoading: true, kcal: 0, hasProfile: false });

    // Un « 0 kcal » affiché une fraction de seconde à chaque ouverture de l'accueil se lit comme
    // « tu n'as rien mangé aujourd'hui ». Le vide franc est moins faux qu'un zéro provisoire.
    expect(screen.queryByText('home.nutrition.eyebrow')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sans profil nutritionnel
// ---------------------------------------------------------------------------

describe('sans profil', () => {
  it('le petit carré affiche la mention compacte et mène au profil', async () => {
    await afficher('small', { hasProfile: false });

    expect(screen.getByText('home.nutrition.compactNoGoal')).toBeTruthy();

    await taper(screen.getByLabelText('home.nutrition.title'));
    expect(push).toHaveBeenCalledWith('/nutrition-profile');
  });

  it.each(['wide', 'large'] as const)('%s propose un bouton « définir mon objectif »', async (size) => {
    await afficher(size, { hasProfile: false });

    expect(screen.getByText('home.nutrition.setGoalHint')).toBeTruthy();
    await taper(screen.getByLabelText('home.nutrition.setGoal'));
    expect(push).toHaveBeenCalledWith('/nutrition-profile');
  });

  it('🔴 sans profil, AUCUN chiffre de calories n’est affiché', async () => {
    // `kcal` peut être non nul sans profil (des repas saisis avant de configurer l'objectif).
    // Les afficher sans référence donnerait un nombre que rien ne permet de juger.
    await afficher('wide', { hasProfile: false, kcal: 1200 });

    expect(screen.queryByText('1200')).toBeNull();
    expect(screen.queryByText(/anneau:/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Petit carré
// ---------------------------------------------------------------------------

describe('petit carré', () => {
  it('affiche le RESTANT, pas le consommé', async () => {
    await afficher('small', { kcal: 1200, effectiveTarget: 2000 });

    expect(screen.getByText('800')).toBeTruthy();
    expect(screen.getByText('home.nutrition.remaining')).toBeTruthy();
  });

  it('🔴 un dépassement affiche 0, jamais un nombre négatif', async () => {
    await afficher('small', { kcal: 2310, effectiveTarget: 2000 });

    // « −310 » sur l'accueil est un reproche permanent : la spec nutrition proscrit ce ton.
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.queryByText('-310')).toBeNull();
  });

  it('🔴 sans objectif calculable, bascule sur le CONSOMMÉ et retire la barre', async () => {
    await afficher('small', { kcal: 1200, target: null, effectiveTarget: null });

    // Une barre de progression suppose une cible : sans cible, elle mesurerait une avance vers rien.
    expect(screen.getByText('1200')).toBeTruthy();
    expect(screen.getByText('home.nutrition.consumedSub')).toBeTruthy();
  });

  it('ouvre le journal alimentaire du JOUR, au petit-déjeuner', async () => {
    await afficher('small');

    await taper(screen.getByLabelText('home.nutrition.title'));

    expect(push).toHaveBeenCalledWith({
      pathname: '/food-picker',
      params: { date: '2026-08-11', meal: 'breakfast' },
    });
  });
});

// ---------------------------------------------------------------------------
// Rectangle
// ---------------------------------------------------------------------------

describe('rectangle', () => {
  it('remplit l’anneau au prorata de l’objectif', async () => {
    await afficher('wide', { kcal: 1000, effectiveTarget: 2000 });

    expect(screen.getByText('anneau:0.5')).toBeTruthy();
  });

  it('🔴 l’anneau ne dépasse jamais 100 %', async () => {
    await afficher('wide', { kcal: 4000, effectiveTarget: 2000 });

    // Sans le clamp, l'arc SVG repart pour un second tour et l'anneau se lit comme « à moitié ».
    expect(screen.getByText('anneau:1')).toBeTruthy();
  });

  it('détaille consommé et objectif', async () => {
    await afficher('wide', { kcal: 1200, effectiveTarget: 2200 });

    expect(screen.getByText('home.nutrition.consumed')).toBeTruthy();
    expect(screen.getByText('home.nutrition.kcalValue:{"kcal":2200}')).toBeTruthy();
  });

  it('affiche le bonus sport UNIQUEMENT un jour d’entraînement avec bonus', async () => {
    await afficher('wide', { isTrainingDay: true, trainingBonus: 300, effectiveTarget: 2300 });
    expect(screen.getByText('+300')).toBeTruthy();
  });

  it.each([
    ['jour sans séance', { isTrainingDay: false, trainingBonus: 300 }],
    ['séance sans bonus réglé', { isTrainingDay: true, trainingBonus: 0 }],
  ])('pas de ligne sport : %s', async (_cas, overrides) => {
    await afficher('wide', overrides);

    expect(screen.queryByText('home.nutrition.sport')).toBeNull();
  });

  it('sans objectif, la ligne « objectif » disparaît au lieu d’afficher un tiret', async () => {
    await afficher('wide', { target: null, effectiveTarget: null });

    expect(screen.getByText('home.nutrition.consumed')).toBeTruthy();
    expect(screen.queryByText('home.nutrition.goal')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Grand carré et macros
// ---------------------------------------------------------------------------

describe('grand carré', () => {
  it('affiche le consommé dans l’anneau et le restant à côté', async () => {
    await afficher('large', { kcal: 1200, effectiveTarget: 2000 });

    expect(screen.getByText('1200')).toBeTruthy();
    expect(screen.getByText('800')).toBeTruthy();
    expect(screen.getByText('home.nutrition.ofGoal:{"target":2000}')).toBeTruthy();
    expect(screen.getByText('home.nutrition.budgetPct:{"pct":40}')).toBeTruthy();
  });

  it('sans objectif, ni pourcentage de budget ni mention « sur objectif »', async () => {
    await afficher('large', { target: null, effectiveTarget: null });

    expect(screen.queryByText(/ofGoal/)).toBeNull();
    expect(screen.queryByText(/budgetPct/)).toBeNull();
  });

  it('les cibles macro suivent l’objectif du profil général, faute de profil nutritionnel', async () => {
    mockProfile.mockReturnValue({ profile: { mainGoal: 'health' } });
    await afficher('large', {
      kcal: 1200,
      target: 2000,
      effectiveTarget: 2000,
      macros: { p: 80, g: 150, l: 40 },
    });

    // Cibles calculées par `trainingDayMacroGrams` — fonction pure de `@wellness/shared`, prise
    // telle quelle (jamais stubbée) : la stubber ne prouverait que l'appel, pas le résultat. On
    // recalcule ici la même chose plutôt que de figer des grammes qu'un changement de ratios
    // rendrait faux sans que le widget soit en cause.
    const cible = trainingDayMacroGrams({
      targetBase: 2000,
      effectiveTarget: 2000,
      objective: objectiveFromGoal('health'),
    });
    expect(screen.getByText(`80/${cible.protein} g`)).toBeTruthy();
    expect(screen.getByText(`150/${cible.carbs} g`)).toBeTruthy();
    expect(screen.getByText(`40/${cible.fat} g`)).toBeTruthy();
  });

  it('🔴 le bonus jour de séance va aux GLUCIDES, pas dans un total invisible', async () => {
    mockProfile.mockReturnValue({ profile: { mainGoal: 'health' } });
    await afficher('large', {
      isTrainingDay: true,
      trainingBonus: 300,
      target: 2000,
      effectiveTarget: 2300,
      macros: { p: 80, g: 150, l: 40 },
    });

    // 300 kcal de bonus = 75 g de glucides. Sans cette redirection, l'objectif calorique monte de
    // 300 mais aucune cible macro ne bouge : l'utilisateur voit un budget qu'aucune ligne ne dit
    // comment remplir.
    const base = trainingDayMacroGrams({
      targetBase: 2000,
      effectiveTarget: 2000,
      objective: objectiveFromGoal('health'),
    });
    expect(screen.getByText(`150/${base.carbs + 75} g`)).toBeTruthy();
    expect(screen.getByText(`80/${base.protein} g`)).toBeTruthy();
  });

  it('🔴 les macros MANUELLES priment sur les macros calculées', async () => {
    mockProfile.mockReturnValue({ profile: { mainGoal: 'health' } });
    mockNutritionProfile.mockReturnValue({
      nutritionProfile: { objective: 'maintain', manualProteinG: 111, manualCarbsG: 222, manualFatG: 33 },
    });
    await afficher('large', { macros: { p: 0, g: 0, l: 0 } });

    // Même règle que l'écran nutrition (US MN-04). Recalculer ici afficherait d'autres cibles que
    // l'écran que ce widget résume — l'utilisateur verrait deux vérités pour la même journée.
    expect(screen.getByText('0/111 g')).toBeTruthy();
    expect(screen.getByText('0/222 g')).toBeTruthy();
    expect(screen.getByText('0/33 g')).toBeTruthy();
  });

  it('🔴 un manuel PARTIEL suffit à basculer en manuel, les autres macros tombent à 0', async () => {
    mockNutritionProfile.mockReturnValue({
      nutritionProfile: { objective: 'maintain', manualProteinG: 150, manualCarbsG: null, manualFatG: null },
    });
    await afficher('large', { macros: { p: 60, g: 20, l: 10 } });

    // C'est le comportement réel, et il est délibéré : dès qu'un champ manuel est posé, la
    // répartition entière devient manuelle. Un mélange manuel/calculé donnerait un total qui ne
    // correspond à aucun des deux objectifs.
    expect(screen.getByText('60/150 g')).toBeTruthy();
    expect(screen.getByText('20/0 g')).toBeTruthy();
  });

  it('sans objectif ni profil, les macros s’affichent SANS cible', async () => {
    await afficher('large', {
      target: null,
      effectiveTarget: null,
      macros: { p: 80, g: 150, l: 40 },
    });

    // « 80 g » et non « 80/0 g » : une cible à zéro se lirait comme un dépassement infini.
    expect(screen.getByText('80 g')).toBeTruthy();
    expect(screen.getByText('150 g')).toBeTruthy();
    expect(screen.getByText('40 g')).toBeTruthy();
  });
});
