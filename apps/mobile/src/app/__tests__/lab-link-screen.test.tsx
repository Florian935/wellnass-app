/**
 * US LABO-03 — la fiche d'un lien (`app/lab-link.tsx`).
 *
 * Ce que la fiche **décide**, et que rien d'autre ne vérifie :
 *  1. **un identifiant inconnu** (lien d'une ancienne version, faute de frappe) ne fait pas planter
 *     l'écran : il le dit, et le retour reste possible ;
 *  2. **un geste qui écrit ne part jamais au toucher** : la feuille « ce qui change » d'abord (R4),
 *     et seule sa confirmation écrit — au bon identifiant, au bon jour ;
 *  3. **un geste qui n'écrit rien** part tout de suite, vers son écran ;
 *  4. **l'histoire est figée** : les semaines sans trace restent des trous (jamais un état inventé),
 *     et une semaine connue dit son état en toutes lettres (jamais la couleur seule) ;
 *  5. **un lien « à découvrir »** dit ce qui lui manque — et n'a pas d'histoire à montrer ;
 *  6. le retour dit d'où l'on vient (Apprendre, ou le Labo).
 *
 * Le graphique a sa propre suite (`CrossLinkChart`, dataviz) : il est remplacé par un témoin.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { CrossLink, CrossLinkAction, CrossLinkState, CrossLinkWeekRecord, LabProposal } from '@wellness/shared';

import LabLinkScreen from '../lab-link';
import { useCrossLinks } from '@/data/repositories/cross-links-repository';
import { useCycleInsights } from '@/data/repositories/cycle-insights-repository';
import { applyAdaptationForToday, reschedulePlannedSession } from '@/data/repositories/planned-session-repository';
import { useLocalSearchParams, useRouter } from 'expo-router';

jest.mock('@/data/repositories/cross-links-repository', () => ({ useCrossLinks: jest.fn() }));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  reschedulePlannedSession: jest.fn(async () => undefined),
  applyAdaptationForToday: jest.fn(async () => undefined),
}));
jest.mock('@/data/repositories/cycle-insights-repository', () => ({
  useCycleInsights: jest.fn(() => ({ isLoading: true, byMetric: {} })),
}));
jest.mock('@/data/goal-conflict-resolution', () => ({
  keepMainGoal: jest.fn(async () => undefined),
  keepPillarGoal: jest.fn(async () => undefined),
}));
jest.mock('@/components/dashboard/CouncilSheet', () => {
  const { Text } = require('react-native');
  return { CouncilSheet: () => <Text testID="council-sheet">council</Text> };
});
jest.mock('@/components/lab/CrossLinkChart', () => {
  const { Text } = require('react-native');
  return { CrossLinkChart: ({ chart }: { chart: { type: string } }) => <Text testID="lab-link-chart">{chart.type}</Text> };
});
jest.mock('@/components/lab/LinkLens', () => ({ LinkLens: () => null }));
// Les deux cartes croisées de Stats nutrition (APPORT-01, MN-03) lisent leurs propres hooks : des témoins.
jest.mock('@/components/nutrition/CrossTrainingSection', () => {
  const { Text } = require('react-native');
  return { CrossTrainingSection: () => <Text testID="apport-01">APPORT-01</Text> };
});
jest.mock('@/components/TrainingNutritionCrossCard', () => {
  const { Text } = require('react-native');
  return { TrainingNutritionCrossCard: () => <Text testID="mn-03">MN-03</Text> };
});
jest.mock('@/components/stage/PillarStage', () => {
  const { View } = require('react-native');
  return {
    PillarStage: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    useStageTheme: () => ({ ink: '#fff', inkMuted: '#ccc', glass: '#0003', glassBorder: '#fff3', solid: '#7a5714', onSolid: '#fff' }),
  };
});
jest.mock('@/components/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!!disabled} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn(() => '2026-09-16') }));
jest.mock('@/hooks/useActionLock', () => ({
  useActionLock: () => (fn: () => Promise<void>) => fn(),
}));
jest.mock('@/lib/haptics', () => ({ hapticConfirm: jest.fn(), hapticSelect: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    scheme: 'light',
    colors: {
      text: '#33291f',
      textMuted: '#96856f',
      background: '#fffaf2',
      surface: '#fffaf2',
      surfaceAlt: '#f5ecdd',
      border: '#ece0cd',
      amber: '#d99a2b',
      success: '#3f7d4f',
      warnText: '#8a5a12',
      warnBorder: '#e6c98f',
      danger: '#b23b2e',
      pillarStrength: '#8a3d2a',
      pillarRunning: '#2f6b6b',
      pillarNutrition: '#6b7a2f',
      pillarLab: '#7a5714',
    },
  }),
}));

const mockLinks = useCrossLinks as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;
const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };

const COLLISION: LabProposal = {
  id: 'collision:2026-09-17',
  kind: 'collision',
  tone: 'warn',
  pair: ['strength', 'running'],
  safety: false,
  values: { legSets: 12, toDayKey: '2026-09-19' },
  action: { type: 'reschedule', plannedSessionId: 'ps-1', fromDayKey: '2026-09-17', toDayKey: '2026-09-19' },
};

const NUIT_COURTE: LabProposal = {
  id: 'shortNight:2026-09-16',
  kind: 'shortNight',
  tone: 'guard',
  pair: ['sleep', 'strength'],
  safety: true,
  values: {},
  action: { type: 'lighten', plannedSessionId: 'ps-2', dayKey: '2026-09-16', repsReductionPct: 25 },
};

const lien = (over: Partial<CrossLink> & { id: CrossLink['id']; state: CrossLinkState }): CrossLink => ({
  zone: 'mc',
  lens: ['strength', 'running'],
  verdict: { key: 'v', values: {} },
  short: { key: 's', values: {} },
  figures: [],
  rows: [],
  actions: [],
  missing: null,
  chart: null,
  source: { key: 'src', values: {} },
  echoes: [],
  ...over,
});

const afficher = async (link: CrossLink | null, { weeks = [] as CrossLinkWeekRecord[], params = {} as Record<string, string> } = {}) => {
  mockParams.mockReturnValue({ id: link?.id ?? 'inconnu', ...params });
  mockLinks.mockReturnValue({ links: link === null ? [] : [link], weeks, isLoading: false });
  await render(<LabLinkScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(router);
  router.canGoBack.mockReturnValue(true);
});

describe('fiche d’un lien', () => {
  it('dit la question, l’état, le verdict, les chiffres et le graphique', async () => {
    await afficher(
      lien({
        id: 'sports',
        state: 'adjust',
        figures: [{ key: 'legSets', values: { count: 12 } }],
        chart: { type: 'split', exposed: [300], other: [295] } as unknown as CrossLink['chart'],
      }),
    );

    expect(screen.getByTestId('lab-link-screen-sports')).toBeTruthy();
    expect(screen.getByText('lab.links.sports.question')).toBeTruthy();
    expect(screen.getByText('lab.links.states.adjust')).toBeTruthy();
    expect(screen.getByText('lab.links.sports.verdict.v:{}')).toBeTruthy();
    expect(screen.getByText('lab.links.figures.legSets.value:{"count":12}')).toBeTruthy();
    expect(screen.getByTestId('lab-link-chart')).toBeTruthy();
  });

  it('une ligne par mesure croisée, avec son état en mots', async () => {
    await afficher(
      lien({
        id: 'fuelStrength',
        state: 'adjust',
        rows: [
          { key: 'protein', values: { gPerKg: 1.3 }, state: 'adjust' },
          { key: 'volume', values: {}, state: null },
        ],
      }),
    );

    expect(screen.getByTestId('lab-link-row-0')).toBeTruthy();
    expect(screen.getByTestId('lab-link-row-1')).toBeTruthy();
    expect(screen.getByText('lab.fiche.measures:{"count":2}')).toBeTruthy();
    expect(screen.getByLabelText('lab.links.states.adjust')).toBeTruthy();
  });

  it('🔴 un identifiant inconnu ne plante pas : la fiche le dit, le retour reste', async () => {
    await afficher(null);

    expect(screen.getByTestId('lab-link-missing')).toHaveTextContent('lab.fiche.notFound');
    await taper(screen.getByLabelText('lab.fiche.back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('sans historique de navigation, le retour mène au Labo', async () => {
    router.canGoBack.mockReturnValue(false);
    await afficher(lien({ id: 'rhythm', state: 'holds' }));

    await taper(screen.getByLabelText('lab.fiche.back'));

    expect(router.replace).toHaveBeenCalledWith('/lab');
  });

  it('venue d’Apprendre, la fiche le dit sur son bouton retour', async () => {
    await afficher(lien({ id: 'sports', state: 'holds' }), { params: { from: 'learn' } });

    expect(screen.getByLabelText('lab.fiche.backLearn')).toBeTruthy();
  });
});

describe('la fiche du cycle (Q7)', () => {
  it('🔴 une mesure pas encore lisible dit ce qui lui manque, au lieu de disparaître', async () => {
    (useCycleInsights as jest.Mock).mockReturnValueOnce({
      isLoading: false,
      byMetric: {
        energy: { status: 'ready', byPhase: { menstrual: { average: 2.6 }, follicular: { average: 3.4 }, ovulatory: { average: 3.6 }, luteal: { average: 3 } } },
        pace: { status: 'insufficient', cyclesAvailable: 3, cyclesNeeded: 3, missingByPhase: { menstrual: 0, follicular: 1, ovulatory: 0, luteal: 3 } },
      },
    });
    await afficher(lien({ id: 'cycle', state: 'holds' }));

    expect(screen.getByTestId('lab-link-chart')).toHaveTextContent('phases');
    // L'ancien écran « Croisement » le disait ; la fiche qui le remplace doit le dire aussi.
    expect(screen.getByTestId('lab-cycle-missing-pace')).toHaveTextContent(
      /cycle\.insights\.missingSamples:\{"count":3,"phase":"cycle\.phase\.luteal"\}/,
    );
    expect(screen.queryByTestId('lab-cycle-missing-energy')).toBeNull();
  });
});

describe('le détail déménagé de Stats nutrition (Q3)', () => {
  it('🔴 « Manges-tu assez pour ta muscu ? » porte les cartes APPORT-01 et MN-03, entières', async () => {
    await afficher(lien({ id: 'fuelStrength', state: 'holds' }));

    // Sans elles, retirer ces cartes de Stats nutrition aurait supprimé l'analyse au lieu de la déplacer.
    expect(screen.getByTestId('apport-01')).toBeTruthy();
    expect(screen.getByTestId('mn-03')).toBeTruthy();
  });

  it('pas sur un autre lien', async () => {
    await afficher(lien({ id: 'sports', state: 'holds' }));
    expect(screen.queryByTestId('lab-link-detail-fuelStrength')).toBeNull();
  });

  it('pas tant que le lien est « à découvrir »', async () => {
    await afficher(lien({ id: 'fuelStrength', state: 'discover', missing: { key: 'proteinDays', values: { have: 2, need: 4 }, have: 2, need: 4 } }));
    expect(screen.queryByTestId('lab-link-detail-fuelStrength')).toBeNull();
  });
});

describe('les gestes de la fiche (R4)', () => {
  it('🔴 un geste qui écrit ouvre la feuille — et n’écrit RIEN avant la confirmation', async () => {
    await afficher(lien({ id: 'sports', state: 'adjust', actions: [{ type: 'proposal', proposal: COLLISION }] }));

    await taper(screen.getByTestId('lab-link-action-0'));

    expect(reschedulePlannedSession).not.toHaveBeenCalled();
    expect(screen.getByTestId('lab-change-collision:2026-09-17')).toBeTruthy();
  });

  it('confirmer déplace la séance au jour annoncé, et le geste se dit fait', async () => {
    await afficher(lien({ id: 'sports', state: 'adjust', actions: [{ type: 'proposal', proposal: COLLISION }] }));

    await taper(screen.getByTestId('lab-link-action-0'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    expect(reschedulePlannedSession).toHaveBeenCalledWith('ps-1', '2026-09-19');
    expect(screen.getByText('lab.cross.applied')).toBeTruthy();
  });

  it('un allègement passe par l’adaptation du jour, sans toucher l’allure', async () => {
    await afficher(lien({ id: 'recovery', state: 'guard', actions: [{ type: 'proposal', proposal: NUIT_COURTE }] }));

    await taper(screen.getByTestId('lab-link-action-0'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    expect(applyAdaptationForToday).toHaveBeenCalledWith('ps-2', { repsReductionPct: 25, paceSlowdownSPerKm: null });
  });

  it('🔴 un échec d’écriture se voit, et le geste n’est PAS marqué fait', async () => {
    (reschedulePlannedSession as jest.Mock).mockRejectedValueOnce(new Error('hors ligne'));
    await afficher(lien({ id: 'sports', state: 'adjust', actions: [{ type: 'proposal', proposal: COLLISION }] }));

    await taper(screen.getByTestId('lab-link-action-0'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    expect(screen.getByText('lab.apply.error')).toBeTruthy();
    expect(screen.queryByText('lab.cross.applied')).toBeNull();
  });

  it('un geste qui ouvre part tout de suite, sans feuille', async () => {
    const open: CrossLinkAction = { type: 'open', route: 'nutritionHistory' };
    await afficher(lien({ id: 'weight', state: 'adjust', actions: [open] }));

    await taper(screen.getByTestId('lab-link-action-0'));

    expect(router.push).toHaveBeenCalledWith('/nutrition?section=history');
    expect(screen.queryByLabelText('lab.apply.confirm')).toBeNull();
  });

  it('le Conseil des trois s’ouvre depuis la fiche des objectifs', async () => {
    const conflict = { rule: 'bulkVsLean' } as unknown as Extract<CrossLinkAction, { type: 'council' }>['conflict'];
    await afficher(lien({ id: 'goals', state: 'adjust', actions: [{ type: 'council', conflict }] }));

    await taper(screen.getByTestId('lab-link-action-0'));

    expect(screen.getByTestId('council-sheet')).toBeTruthy();
  });
});

describe('l’histoire figée (Q5)', () => {
  it('🔴 une semaine sans trace reste un TROU ; une semaine connue dit son état en mots', async () => {
    // Semaine en cours : lundi 14/09. Une trace le 07/09, rien avant.
    const weeks: CrossLinkWeekRecord[] = [{ id: 'w1', linkId: 'sports', weekStart: '2026-09-07', state: 'guard' }];
    await afficher(lien({ id: 'sports', state: 'holds' }), { weeks });

    expect(screen.getByLabelText('lab.fiche.historyWeek:{"date":"07/09","state":"lab.links.states.guard"}')).toBeTruthy();
    // Avant le Labo, aucune semaine n'est coloriée « ça tient » par défaut.
    expect(screen.getByLabelText('lab.fiche.historyWeekNone:{"date":"31/08"}')).toBeTruthy();
  });

  it('une trace d’un AUTRE lien n’entre pas dans cette histoire', async () => {
    const weeks: CrossLinkWeekRecord[] = [{ id: 'w1', linkId: 'recovery', weekStart: '2026-09-07', state: 'guard' }];
    await afficher(lien({ id: 'sports', state: 'holds' }), { weeks });

    expect(screen.getByLabelText('lab.fiche.historyWeekNone:{"date":"07/09"}')).toBeTruthy();
    expect(screen.getByText('lab.fiche.historyEmpty')).toBeTruthy();
  });
});

describe('un lien « à découvrir »', () => {
  it('dit ce qui lui manque, et n’a pas d’histoire à montrer', async () => {
    await afficher(
      lien({
        id: 'fuelRunning',
        state: 'discover',
        missing: { key: 'carbDays', values: { have: 2, need: 5 }, have: 2, need: 5 },
      }),
    );

    expect(screen.getByText('lab.links.missing.carbDays.text:{"have":2,"need":5}')).toBeTruthy();
    expect(screen.getByText('lab.links.missing.carbDays.meter:{"have":2,"need":5}')).toBeTruthy();
    // Huit trous alignés ne diraient rien de plus que « pas encore assez de données ».
    expect(screen.queryByText('LAB.FICHE.HISTORY')).toBeNull();
  });
});
