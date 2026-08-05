/**
 * US INSIGHTS-01 — smoke test de l'écran « Insights » (`app/insights.tsx`).
 *
 * Ce que ce test protège réellement, au-delà du « ça se rend » :
 *  - l'**état vide** s'affiche quand le moteur ne retient rien, et **aucune carte** avec lui ;
 *  - pendant le chargement, **ni cartes ni état vide** — sinon l'écran flashe « rien à signaler »
 *    avant d'afficher trois cartes à chaque ouverture ;
 *  - les trois familles se rendent, avec leurs **chiffres interpolés** (R1 : une carte sans nombre
 *    est un défaut) ;
 *  - le **cas particulier de `weekly_decision`**, seule carte dont le corps sort de l'arborescence
 *    `insights.cards` pour réutiliser `review.decisions.<kind>`, la clé même de BILAN-01 ;
 *  - la **clé du groupe musculaire** est traduite (`muscle.back`) et non affichée brute.
 *
 * Le rendu se fait dans un `await act` (§3.6 de la stratégie de tests) : sans lui, les effets ne
 * tournent pas et le test est un faux vert.
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';
import type { SelectedInsight } from '@wellness/shared';

import InsightsScreen from '../insights';
import { resolveInsightSubject } from '@/components/insights/InsightCard';
import { useInsights } from '@/data/repositories/insights-repository';

jest.mock('@/data/repositories/insights-repository', () => ({
  useInsights: jest.fn(),
  canAccessInsights: () => true,
}));

// `t` renvoie la clé + ses options : on peut donc asserter **quelle** clé a été résolue et **avec
// quels chiffres**, ce qu'un mock qui renverrait la clé nue ne permettrait pas.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
    i18n: { language: 'fr' },
  }),
}));

jest.mock('@/hooks/useUnits', () => ({
  useUnits: () => ({
    formatWeight: (kg: number) => `${kg} kg`,
    formatDistance: (km: number) => `${km} km`,
  }),
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#33291f',
      textMuted: '#786a59',
      accent: '#b14f2b',
      success: '#66714b',
      border: '#ece0cd',
      surface: '#fffaf2',
    },
  }),
}));

const mockUseInsights = useInsights as jest.MockedFunction<typeof useInsights>;

function insight(over: Partial<SelectedInsight> = {}): SelectedInsight {
  return {
    id: 'training_load',
    family: 'alert',
    metrics: { ratio: 1.42 },
    occurredOn: null,
    pillars: ['strength', 'running'],
    rank: 0,
    ...over,
  };
}

async function renderScreen() {
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(<InsightsScreen />);
  });
  return utils;
}

describe('écran Insights', () => {
  it('n’affiche ni carte ni état vide pendant le chargement', async () => {
    mockUseInsights.mockReturnValue({ insights: [], isLoading: true });
    const { queryByText } = await renderScreen();
    expect(queryByText('insights.empty.title')).toBeNull();
    expect(queryByText(/insights\.cards/)).toBeNull();
  });

  it('affiche l’état vide quand le moteur ne retient rien', async () => {
    mockUseInsights.mockReturnValue({ insights: [], isLoading: false });
    const { getByText, queryByText } = await renderScreen();
    expect(getByText('insights.empty.title')).toBeTruthy();
    expect(getByText('insights.empty.body')).toBeTruthy();
    expect(queryByText('insights.lead')).toBeNull();
  });

  it('rend une alerte avec son chiffre interpolé', async () => {
    mockUseInsights.mockReturnValue({ insights: [insight()], isLoading: false });
    const { getByText } = await renderScreen();
    expect(getByText('insights.families.alert')).toBeTruthy();
    expect(getByText(/insights\.cards\.training_load\.body.*1,42/)).toBeTruthy();
  });

  it('rend les trois familles ensemble, sans état vide', async () => {
    mockUseInsights.mockReturnValue({
      insights: [
        insight(),
        insight({
          id: 'record_recent',
          family: 'celebration',
          variant: 'max_weight',
          metrics: { value: 82.5 },
          subject: 'Développé couché',
          occurredOn: '2026-08-03',
          pillars: ['strength'],
          rank: 1,
        }),
        insight({
          id: 'tonnage_change',
          family: 'change',
          variant: 'down',
          metrics: { pct: 22 },
          pillars: ['strength'],
          rank: 2,
        }),
      ],
      isLoading: false,
    });
    const { getByText, queryByText } = await renderScreen();
    expect(getByText('insights.families.alert')).toBeTruthy();
    expect(getByText('insights.families.celebration')).toBeTruthy();
    expect(getByText('insights.families.change')).toBeTruthy();
    expect(queryByText('insights.empty.title')).toBeNull();
    // Le corps d'une variation pointe la sous-clé du sens, pas une clé générique.
    expect(getByText(/insights\.cards\.tonnage_change\.body_down/)).toBeTruthy();
  });

  it('formate un record de charge selon les unités, pas en nombre nu', async () => {
    mockUseInsights.mockReturnValue({
      insights: [
        insight({
          id: 'record_recent',
          family: 'celebration',
          variant: 'max_weight',
          metrics: { value: 82.5 },
          subject: 'Développé couché',
          pillars: ['strength'],
        }),
      ],
      isLoading: false,
    });
    const { getByText } = await renderScreen();
    expect(getByText(/body_max_weight.*82\.5 kg/)).toBeTruthy();
  });

  it('convertit un objectif de course des mètres vers les kilomètres', async () => {
    mockUseInsights.mockReturnValue({
      insights: [
        insight({
          id: 'goal_achieved',
          family: 'celebration',
          variant: 'run_distance',
          metrics: { achievedValue: 52_400, targetValue: 50_000 },
          subject: '50 km en août',
          pillars: ['running'],
        }),
      ],
      isLoading: false,
    });
    const { getByText } = await renderScreen();
    // 50 000 m → « 50 km », et surtout pas « 50 000 km ».
    expect(getByText(/body_run_distance.*52\.4 km.*50 km/)).toBeTruthy();
  });

  it('réutilise la clé de BILAN-01 pour la décision de la semaine', async () => {
    mockUseInsights.mockReturnValue({
      insights: [
        insight({
          id: 'weekly_decision',
          family: 'change',
          variant: 'consistency_drop',
          metrics: { activeDays: 1, previousActiveDays: 5 },
          occurredOn: '2026-08-02',
          pillars: [],
        }),
      ],
      isLoading: false,
    });
    const { getByText } = await renderScreen();
    // La clé vient de `review.*`, pas de `insights.cards.*` : c'est tout l'intérêt du variant.
    expect(getByText(/^review\.decisions\.consistency_drop/)).toBeTruthy();
  });

  it('traduit la clé du groupe musculaire au lieu de l’afficher brute', async () => {
    mockUseInsights.mockReturnValue({
      insights: [
        insight({
          id: 'muscle_neglected',
          family: 'change',
          metrics: { sharePct: 7, evenSharePct: 17, sets: 4 },
          subject: 'back',
          pillars: ['strength'],
        }),
      ],
      isLoading: false,
    });
    const { getByText } = await renderScreen();
    expect(getByText(/insights\.cards\.muscle_neglected\.title.*muscle\.back/)).toBeTruthy();
  });
});

/**
 * Régression trouvée en revue de code (05/08/2026) : le widget d'accueil interpolait `subject` brut
 * alors que l'écran le traduisait, d'où « back sous-travaillé » sur l'accueil et « Dos
 * sous-travaillé » sur l'écran. Les deux surfaces passent désormais par `resolveInsightSubject`.
 */
describe('resolveInsightSubject', () => {
  const t = (k: string) => k;

  it('traduit le groupe musculaire de la carte « muscle négligé »', () => {
    expect(
      resolveInsightSubject({ id: 'muscle_neglected', subject: 'back' }, t),
    ).toBe('muscle.back');
  });

  it('traduit aussi le groupe porté par la décision hebdo « déséquilibre musculaire »', () => {
    expect(
      resolveInsightSubject(
        { id: 'weekly_decision', variant: 'muscle_imbalance', subject: 'chest' },
        t,
      ),
    ).toBe('muscle.chest');
  });

  it('laisse intact un nom d’exercice, qui est déjà du texte', () => {
    expect(
      resolveInsightSubject({ id: 'record_recent', subject: 'Développé couché' }, t),
    ).toBe('Développé couché');
  });

  it('ne traduit pas une décision hebdo d’une autre nature', () => {
    expect(
      resolveInsightSubject(
        { id: 'weekly_decision', variant: 'goal_behind', subject: 'Semi-marathon' },
        t,
      ),
    ).toBe('Semi-marathon');
  });

  it('rend undefined quand il n’y a pas de sujet', () => {
    expect(resolveInsightSubject({ id: 'training_load', subject: undefined }, t)).toBeUndefined();
  });
});
