/**
 * US LABO-01 → LABO-02 / LABO-04 — l'écran du Labo (`app/(tabs)/lab.tsx`), monté pour de vrai.
 *
 * Toutes les **règles** vivent dans `@wellness/shared` (couvertes sous Vitest) et toutes les
 * **lectures** dans `cross-links-repository` / `lab-repository`. Ce qui est testé ici est ce que
 * l'écran **décide**, et d'abord la promesse sur laquelle repose la confiance dans cet écran :
 *
 *  1. **rien n'est écrit sans la feuille** (R4) — un appui sur le geste d'un lien le met « prêt »,
 *     l'écriture n'a lieu qu'à la confirmation. Un Labo qui modifierait le plan au tap serait
 *     exactement le « joujou » qu'on ne veut pas : on cesserait d'y toucher ;
 *  2. **un geste qui n'écrit rien part tout de suite** — le faire passer par une feuille « ce qui
 *     change dans ton plan » alors que rien ne change serait mensonger ;
 *  3. **le geste écrit ce que le lien annonce**, au bon identifiant et au bon jour ;
 *  4. **l'expérience démarre le lundi suivant**, jamais aujourd'hui ; une expérience terminée est
 *     close **avec son verdict figé** (LABO-04) ;
 *  5. **décision H** : un pilier désactivé ne produit rien — une seule ligne discrète, masquable.
 *
 * La scène 3D est remplacée par un double : elle vit dans une WebView (WebGL), que jest-expo ne
 * sait pas monter — et ce qu'elle décide a été sorti dans `scene-state.ts`, testé à part. Le double
 * expose un bouton par zone, pour vérifier que toucher la carte filtre la liste.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { CrossLink, CrossLinkAction, CrossLinkState, LabProposal, LabQuestion, LabWeek } from '@wellness/shared';

import LabScreen from '../lab';
import type { LabExperimentView } from '@/data/repositories/lab-repository';
import { nextMondayKey, useLabComposer, useLabObjective, useLabPillars } from '@/data/repositories/lab-repository';
import { useCrossLinks } from '@/data/repositories/cross-links-repository';
import { finishLabExperiment, startLabExperiment, stopLabExperiment } from '@/data/repositories/lab-experiment-repository';
import { applyAdaptationForToday, reschedulePlannedSession } from '@/data/repositories/planned-session-repository';
import { upsertNutritionProfile } from '@/data/repositories/nutrition-repository';
import { upsertRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useLabOtherPillars } from '@/stores/lab-other-pillars-store';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/lab-repository', () => ({
  useLabComposer: jest.fn(),
  useLabObjective: jest.fn(() => 'maintain'),
  useLabPillars: jest.fn(() => ['strength', 'running', 'nutrition']),
  // La vraie fonction lit une clé de jour, jamais l'horloge : on la reproduit telle quelle.
  nextMondayKey: jest.fn(() => '2026-09-21'),
}));
jest.mock('@/data/repositories/cross-links-repository', () => ({ useCrossLinks: jest.fn() }));
jest.mock('@/data/repositories/lab-experiment-repository', () => ({
  startLabExperiment: jest.fn(async () => 'exp-1'),
  stopLabExperiment: jest.fn(async () => undefined),
  finishLabExperiment: jest.fn(async () => undefined),
  LAB_WRITE_READY: true,
}));
jest.mock('@/data/repositories/planned-session-repository', () => ({
  reschedulePlannedSession: jest.fn(async () => undefined),
  applyAdaptationForToday: jest.fn(async () => undefined),
}));
// US NARR-01 : l'écran lit les réglages pour savoir si le consentement IA est donné. Non bouchonné,
// l'import tire i18n et fait tomber toute la suite. `settings: null` = pas de consentement.
jest.mock('@/data/repositories/settings-repository', () => ({
  useSettings: () => ({ settings: null, isLoading: false }),
}));
jest.mock('@/data/repositories/nutrition-repository', () => ({ upsertNutritionProfile: jest.fn(async () => undefined) }));
jest.mock('@/data/repositories/running-profile-repository', () => ({ upsertRunnerProfile: jest.fn(async () => undefined) }));
jest.mock('@/data/goal-conflict-resolution', () => ({
  keepMainGoal: jest.fn(async () => undefined),
  keepPillarGoal: jest.fn(async () => undefined),
}));
jest.mock('@/components/dashboard/CouncilSheet', () => {
  const { Text } = require('react-native');
  return { CouncilSheet: () => <Text testID="council-sheet">council</Text> };
});
jest.mock('@/lib/secure-storage', () => ({
  secureStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) },
}));

/** La scène vit dans une WebView : on la remplace par sa légende, et un bouton par zone. */
jest.mock('@/components/lab/LabStage', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    LAB_STAGE_HEIGHT: 300,
    LabStage: ({ caption, footer, onPickZone }: { caption: string; footer?: React.ReactNode; onPickZone?: (z: string) => void }) => (
      <View>
        <Text testID="lab-stage">{caption}</Text>
        <Pressable testID="pick-zone-mn" onPress={() => onPickZone?.('mn')} />
        {footer}
      </View>
    ),
  };
});
jest.mock('@/components/stage/PillarStage', () => ({
  useStageTheme: () => ({ ink: '#fff', inkMuted: '#ccc', glass: '#0003', glassBorder: '#fff3', solid: '#7a5714', onSolid: '#fff' }),
}));

jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn(() => '2026-09-16') }));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));
jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));
jest.mock('@/hooks/useActionLock', () => ({
  useActionLock: () => (fn: () => Promise<void>) => fn(),
}));
jest.mock('@/lib/haptics', () => ({ hapticConfirm: jest.fn(), hapticSelect: jest.fn() }));

jest.mock('expo-router', () => ({ useRouter: jest.fn(), useLocalSearchParams: jest.fn(() => ({})) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>icone-{name}</Text> };
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
      accent: '#c0562f',
      accentText: '#ffffff',
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCrossLinks = useCrossLinks as jest.Mock;
const mockComposer = useLabComposer as jest.Mock;
const mockPillars = useLabPillars as jest.Mock;
const mockObjective = useLabObjective as jest.Mock;
const mockRouter = useRouter as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;

const push = jest.fn();

const DAYS = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'];

const semaine = (): LabWeek => ({
  days: DAYS.map((dayKey) => ({
    dayKey,
    isToday: dayKey === '2026-09-16',
    isPast: dayKey < '2026-09-16',
    strength: [],
    running: [],
    proteinGPerKg: null,
    sleepMinutes: null,
  })),
  progress: {
    strength: { done: 2, planned: 4, next: null },
    running: { doneKm: 18, plannedKm: 30, next: null },
    nutrition: { gPerKg: 1.4, target: { min: 1.6, max: 2.2 }, loggedDays: 5 },
    sleep: { goodNights: 3, loggedNights: 5, lastMinutes: 430 },
  },
  proposals: [],
  allProposals: [],
});

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

const PROTEINES: LabProposal = {
  id: 'protein',
  kind: 'protein',
  tone: 'warn',
  pair: ['nutrition', 'strength'],
  safety: false,
  values: { gPerKg: 1.4, targetMin: 1.6, missingG: 14 },
  action: { type: 'open', target: 'foodSuggestion' },
};

const ZONE_OF: Record<CrossLink['id'], CrossLink['zone']> = {
  sports: 'mc',
  fuelStrength: 'mn',
  fuelRunning: 'cn',
  recovery: 'centre',
  weight: 'mn',
  goals: 'centre',
  rhythm: 'centre',
  strengthWeight: 'mn',
  cycle: 'centre',
};

const lien = (id: CrossLink['id'], state: CrossLinkState, actions: CrossLinkAction[] = []): CrossLink => ({
  id,
  zone: ZONE_OF[id],
  lens: ['strength', 'running'],
  state,
  verdict: { key: 'v', values: {} },
  short: { key: 's', values: {} },
  figures: [],
  rows: [],
  actions,
  missing: state === 'discover' ? { key: 'weeks', values: { have: 1, need: 3 }, have: 1, need: 3 } : null,
  chart: null,
  source: { key: 'src', values: {} },
  echoes: [],
});

const contexteComposer = (over: Record<string, unknown> = {}) => ({
  context: {
    activePillars: ['strength', 'running', 'nutrition'],
    baseline: { strengthSessions: 4, runningFrequency: 3, proteinGPerKg: 1.6, objective: 'maintain', sleep: 'long' },
    weightKg: 78,
    tdeeKcal: 2600,
    sbd: null,
    loadRatio: null,
    hoursPerRun: 1,
    ...over,
  },
});

type Affichage = {
  links?: CrossLink[];
  questions?: LabQuestion[];
  experiments?: LabExperimentView[];
  composer?: ReturnType<typeof contexteComposer>;
};

const afficher = async ({ links = [], questions = [], experiments = [], composer = contexteComposer() }: Affichage = {}) => {
  mockCrossLinks.mockReturnValue({
    links,
    learning: [],
    core: { week: semaine(), questions, cards: [], experiments },
    weeks: [],
    goalConflict: null,
    cycleTrackingEnabled: false,
    isLoading: false,
  });
  mockComposer.mockReturnValue(composer);
  await render(<LabScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const allerA = async (onglet: 'cross' | 'composer' | 'learn') => {
  await taper(screen.getByTestId(`lab-tab-${onglet}`));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.mockReturnValue({ push });
  mockParams.mockReturnValue({});
  mockPillars.mockReturnValue(['strength', 'running', 'nutrition']);
  mockObjective.mockReturnValue('maintain');
  (nextMondayKey as jest.Mock).mockReturnValue('2026-09-21');
  useLabOtherPillars.setState({ hidden: false, hydrated: false });
});

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------

describe('navigation entre onglets', () => {
  it('ouvre sur Croiser : la scène l’annonce, la semaine réelle reste en bas', async () => {
    await afficher({ links: [lien('recovery', 'holds')] });

    expect(screen.getByTestId('lab-stage')).toHaveTextContent('lab.stage.cross');
    expect(screen.getByTestId('lab-cross-panel')).toBeTruthy();
    expect(screen.getByTestId('lab-progress-sleep')).toBeTruthy();
  });

  it('un lien entrant `?section=learn` ouvre directement Apprendre', async () => {
    mockParams.mockReturnValue({ section: 'learn' });
    await afficher();

    expect(screen.getByTestId('lab-stage')).toHaveTextContent('lab.stage.learn');
    expect(screen.getByTestId('lab-learn-panel')).toBeTruthy();
  });

  it('une section inconnue retombe sur Croiser', async () => {
    mockParams.mockReturnValue({ section: 'week' });
    await afficher();

    expect(screen.getByTestId('lab-stage')).toHaveTextContent('lab.stage.cross');
  });

  it('chaque onglet change la scène ET le corps', async () => {
    await afficher();

    await allerA('composer');
    expect(screen.getByTestId('lab-stage')).toHaveTextContent('lab.stage.composer');
    expect(screen.getByTestId('lab-lever-proteinGPerKg')).toBeTruthy();

    await allerA('learn');
    expect(screen.getByTestId('lab-stage')).toHaveTextContent('lab.stage.learn');
    expect(screen.getByText('lab.why.emptyTitle')).toBeTruthy();
  });

  it('🔴 un pilier désactivé ne propose pas son levier', async () => {
    mockPillars.mockReturnValue(['strength']);
    await afficher();

    await allerA('composer');

    // Régler une cible de protéines quand la nutrition n'est pas activée n'aurait nulle part où
    // s'écrire — et le levier promettrait un effet que rien ne produirait.
    expect(screen.queryByTestId('lab-lever-proteinGPerKg')).toBeNull();
    expect(screen.getByTestId('lab-lever-strengthSessions')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Croiser — la liste des liens
// ---------------------------------------------------------------------------

describe('Croiser', () => {
  it('range les liens par état : le garde-fou d’abord, et le dit en tête', async () => {
    await afficher({ links: [lien('recovery', 'guard'), lien('fuelStrength', 'adjust'), lien('rhythm', 'holds'), lien('cycle', 'discover')] });

    expect(screen.getByText('lab.cross.leadGuard')).toBeTruthy();
    for (const state of ['guard', 'adjust', 'holds', 'discover']) {
      expect(screen.getByTestId(`lab-section-${state}`)).toBeTruthy();
    }
  });

  it('toucher une carte ouvre la fiche du lien', async () => {
    await afficher({ links: [lien('rhythm', 'holds')] });

    await taper(screen.getByTestId('lab-link-rhythm'));

    expect(push).toHaveBeenCalledWith('/lab-link?id=rhythm');
  });

  it('toucher une zone de la carte filtre la liste — « Tout voir » la rend entière', async () => {
    await afficher({ links: [lien('sports', 'holds'), lien('fuelStrength', 'holds')] });

    await taper(screen.getByTestId('pick-zone-mn'));

    expect(screen.getByTestId('lab-zone-filter')).toBeTruthy();
    expect(screen.getByTestId('lab-link-fuelStrength')).toBeTruthy();
    expect(screen.queryByTestId('lab-link-sports')).toBeNull();

    await taper(screen.getByText('lab.cross.showAll'));
    expect(screen.getByTestId('lab-link-sports')).toBeTruthy();
  });

  it('le Conseil des trois s’ouvre depuis le lien des objectifs', async () => {
    const conflict = { rule: 'bulkVsLean' } as unknown as Extract<CrossLinkAction, { type: 'council' }>['conflict'];
    await afficher({ links: [lien('goals', 'adjust', [{ type: 'council', conflict }])] });

    await taper(screen.getByTestId('lab-link-goals-action'));

    expect(screen.getByTestId('council-sheet')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Décision H — les piliers non activés
// ---------------------------------------------------------------------------

describe('piliers non activés (décision H, Q4)', () => {
  it('avec deux piliers, une seule ligne discrète dit ce que le Labo croiserait', async () => {
    mockPillars.mockReturnValue(['strength', 'running']);
    await afficher({ links: [lien('sports', 'holds')] });

    expect(screen.getByTestId('lab-other-pillars')).toBeTruthy();
    expect(screen.getByText('lab.cross.otherPillarsMc')).toBeTruthy();
  });

  it('🔴 masquée, elle ne revient pas', async () => {
    mockPillars.mockReturnValue(['strength', 'running']);
    await afficher({ links: [lien('sports', 'holds')] });

    await taper(screen.getByLabelText('lab.cross.hideOther'));

    // Un reproche qui revient à chaque ouverture ferait du pilier désactivé une dette — l'inverse
    // de la décision H.
    expect(screen.queryByTestId('lab-other-pillars')).toBeNull();
    expect(useLabOtherPillars.getState().hidden).toBe(true);
  });

  it('avec les trois piliers, rien à dire', async () => {
    await afficher({ links: [lien('sports', 'holds')] });

    expect(screen.queryByTestId('lab-other-pillars')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// R4 — rien ne s'écrit sans la feuille
// ---------------------------------------------------------------------------

describe('appliquer le geste d’un lien', () => {
  const collision = () => lien('sports', 'adjust', [{ type: 'proposal', proposal: COLLISION }]);

  it('🔴 le premier appui met « prêt » et n’écrit RIEN', async () => {
    await afficher({ links: [collision()] });

    await taper(screen.getByTestId('lab-link-sports-action'));

    // C'est toute la promesse de l'écran : le Labo propose, l'utilisateur dispose. Écrire au tap
    // ferait du plan un terrain glissant, et on cesserait d'explorer.
    expect(reschedulePlannedSession).not.toHaveBeenCalled();
    expect(screen.getByText('lab.cross.staged')).toBeTruthy();
  });

  it('la feuille nomme le changement, et les écrans où ça se verra', async () => {
    await afficher({ links: [collision()] });

    await taper(screen.getByTestId('lab-link-sports-action'));
    await taper(screen.getByLabelText('lab.cross.apply:{"count":1}'));

    expect(screen.getByTestId('lab-change-collision:2026-09-17')).toBeTruthy();
    expect(screen.getByText('lab.apply.where:{"list":"lab.proposals.collision.changeWhere"}')).toBeTruthy();
  });

  it('🔴 la feuille dit le JOUR en toutes lettres, jamais la clé brute', async () => {
    await afficher({ links: [collision()] });

    await taper(screen.getByTestId('lab-link-sports-action'));
    await taper(screen.getByLabelText('lab.cross.apply:{"count":1}'));

    // Avant LIENS-01, la feuille affichait « Séance déplacée au 2026-09-19 ».
    const detail = screen.getByTestId('lab-change-collision:2026-09-17');
    expect(detail).toHaveTextContent(/"toDay":"samedi"/);
  });

  it('confirmer DÉPLACE la séance au jour annoncé', async () => {
    await afficher({ links: [collision()] });

    await taper(screen.getByTestId('lab-link-sports-action'));
    await taper(screen.getByLabelText('lab.cross.apply:{"count":1}'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    expect(reschedulePlannedSession).toHaveBeenCalledWith('ps-1', '2026-09-19');
    expect(screen.getByText('lab.cross.applied')).toBeTruthy();
  });

  it('🔴 la collision suivante du même lien reste applicable (mémorisé par proposition, pas par lien)', async () => {
    await afficher({ links: [collision()] });
    await taper(screen.getByTestId('lab-link-sports-action'));
    await taper(screen.getByLabelText('lab.cross.apply:{"count":1}'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    // Le registre se recalcule : la première collision est réglée, le lien porte la seconde.
    const SECONDE: LabProposal = {
      ...COLLISION,
      id: 'collision:2026-09-24',
      values: { legSets: 10, toDayKey: '2026-09-26' },
      action: { type: 'reschedule', plannedSessionId: 'ps-9', fromDayKey: '2026-09-24', toDayKey: '2026-09-26' },
    };
    mockCrossLinks.mockReturnValue({
      links: [lien('sports', 'adjust', [{ type: 'proposal', proposal: SECONDE }])],
      learning: [],
      core: { week: semaine(), questions: [], cards: [], experiments: [] },
      weeks: [],
      goalConflict: null,
      cycleTrackingEnabled: false,
      isLoading: false,
    });
    await act(async () => {
      await screen.rerender(<LabScreen />);
    });

    // Avant : mémorisé par lien, le bouton restait « Dans ton plan », désactivé, jusqu'au redémarrage.
    expect(screen.queryByText('lab.cross.applied')).toBeNull();
    await taper(screen.getByTestId('lab-link-sports-action'));
    await taper(screen.getByLabelText('lab.cross.apply:{"count":1}'));
    await taper(screen.getByLabelText('lab.apply.confirm'));
    expect(reschedulePlannedSession).toHaveBeenLastCalledWith('ps-9', '2026-09-26');
  });

  it('un allègement passe par l’adaptation du jour, sans toucher l’allure', async () => {
    await afficher({ links: [lien('recovery', 'guard', [{ type: 'proposal', proposal: NUIT_COURTE }])] });

    await taper(screen.getByTestId('lab-link-recovery-action'));
    await taper(screen.getByLabelText('lab.cross.apply:{"count":1}'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    // Même écriture que l'adaptation de CARDIO-UX01 : une seule journée, pas le programme.
    expect(applyAdaptationForToday).toHaveBeenCalledWith('ps-2', { repsReductionPct: 25, paceSlowdownSPerKm: null });
  });

  it('🔴 un geste qui n’écrit rien NAVIGUE, sans passer par la feuille', async () => {
    await afficher({ links: [lien('fuelStrength', 'adjust', [{ type: 'proposal', proposal: PROTEINES }])] });

    await taper(screen.getByTestId('lab-link-fuelStrength-action'));

    // Une feuille « ce qui change dans ton plan » devant un changement qui n'existe pas apprendrait
    // à la confirmer sans lire — et c'est la seule protection de cet écran.
    // US NUTRI-UX03 (D14) — noter un repas : l'onglet Aujourd'hui, quel que soit le dernier choisi.
    expect(push).toHaveBeenCalledWith('/nutrition?section=today');
    expect(screen.queryByLabelText(/lab\.cross\.apply/)).toBeNull();
  });

  it('un geste « ouvrir » part vers son écran', async () => {
    await afficher({ links: [lien('weight', 'adjust', [{ type: 'open', route: 'nutritionHistory' }])] });

    await taper(screen.getByTestId('lab-link-weight-action'));

    expect(push).toHaveBeenCalledWith('/nutrition?section=history');
  });

  it('un second appui retire le geste mis prêt', async () => {
    await afficher({ links: [collision()] });

    await taper(screen.getByTestId('lab-link-sports-action'));
    await taper(screen.getByTestId('lab-link-sports-action'));

    expect(screen.queryByLabelText(/lab\.cross\.apply/)).toBeNull();
  });

  it('🔴 sans rien de prêt, aucun bouton d’application n’est offert', async () => {
    await afficher({ links: [collision()] });

    expect(screen.queryByLabelText(/lab\.cross\.apply/)).toBeNull();
  });

  it('🔴 un échec d’écriture SE VOIT, au lieu de laisser croire que c’est fait', async () => {
    (reschedulePlannedSession as jest.Mock).mockRejectedValueOnce(new Error('hors ligne'));
    await afficher({ links: [collision()] });

    await taper(screen.getByTestId('lab-link-sports-action'));
    await taper(screen.getByLabelText('lab.cross.apply:{"count":1}'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    // Leçon CONF-06 : une rejection avalée laisse l'utilisateur croire son plan modifié. La feuille
    // reste ouverte, avec le message — et le geste n'est PAS marqué appliqué.
    expect(screen.getByText('lab.apply.error')).toBeTruthy();
    expect(screen.queryByText('lab.cross.applied')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

describe('composer une formule', () => {
  const monter = async (composer = contexteComposer()) => {
    await afficher({ composer });
    await allerA('composer');
  };

  it('🔴 régler un levier n’écrit rien tant que la feuille n’est pas confirmée', async () => {
    await monter();

    await taper(screen.getAllByLabelText('lab.composer.increase:{"lever":"lab.composer.lever.runningFrequency"}')[0]!);

    expect(upsertRunnerProfile).not.toHaveBeenCalled();
    expect(screen.getByLabelText('lab.composer.apply:{"count":1}')).toBeTruthy();
  });

  it('confirmer écrit la nouvelle fréquence de course', async () => {
    await monter();

    await taper(screen.getAllByLabelText('lab.composer.increase:{"lever":"lab.composer.lever.runningFrequency"}')[0]!);
    await taper(screen.getByLabelText('lab.composer.apply:{"count":1}'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    expect(upsertRunnerProfile).toHaveBeenCalledWith({ weeklyFrequency: 4 });
  });

  it('la cible de protéines s’écrit en grammes, d’après le poids réel', async () => {
    await monter();

    await taper(screen.getAllByLabelText('lab.composer.increase:{"lever":"lab.composer.lever.proteinGPerKg"}')[0]!);
    await taper(screen.getByLabelText('lab.composer.apply:{"count":1}'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    // Le profil nutrition stocke des grammes par jour, pas des g/kg : un cran (0,2) au-dessus de
    // 1,6 fait 1,8 g/kg, soit 1,8 × 78 kg = 140 g.
    expect(upsertNutritionProfile).toHaveBeenCalledWith({ manualProteinG: 140 });
  });

  it('🔴 sans poids connu, la cible de protéines n’est PAS écrite', async () => {
    await monter(contexteComposer({ weightKg: null }));

    await taper(screen.getAllByLabelText('lab.composer.increase:{"lever":"lab.composer.lever.proteinGPerKg"}')[0]!);

    // 🔴 Le réglage ne doit même pas être PROPOSÉ : `applyFormula` ne l'écrit pas sans poids
    // (convertir des g/kg en grammes demanderait d'inventer le poids). L'annoncer dans la feuille,
    // encaisser la confirmation puis n'écrire rien détruirait la confiance que R4 construit.
    expect(screen.queryByLabelText(/lab\.composer\.apply/)).toBeNull();
    expect(screen.getByText('lab.composer.notWritable')).toBeTruthy();
    expect(upsertNutritionProfile).not.toHaveBeenCalled();
  });

  it('« revenir à mes réglages » efface le brouillon', async () => {
    await monter();

    await taper(screen.getAllByLabelText('lab.composer.increase:{"lever":"lab.composer.lever.runningFrequency"}')[0]!);
    await taper(screen.getByText('lab.composer.reset'));

    expect(screen.queryByLabelText(/lab\.composer\.apply/)).toBeNull();
  });

  it('🔴 les séances de musculation se règlent, mais ne s’écrivent pas — et c’est dit', async () => {
    await monter();

    await taper(screen.getAllByLabelText('lab.composer.increase:{"lever":"lab.composer.lever.strengthSessions"}')[0]!);

    // Elles viennent du programme : les écrire ici les ferait diverger en silence de la séance
    // réellement proposée chaque jour.
    expect(screen.getByText('lab.composer.notWritable')).toBeTruthy();
    expect(screen.queryByLabelText(/lab\.composer\.apply/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Apprendre — enquêtes et expériences
// ---------------------------------------------------------------------------

describe('Apprendre', () => {
  const question: LabQuestion = {
    id: 'q-paceFade',
    kind: 'paceFade',
    values: { recentPace: '5:10', previousPace: '5:02', deltaS: 8 },
    series: [302, 304, 308, 310],
    flatFrom: 2,
    suspects: [
      {
        kind: 'legsBeforeQuality',
        pair: ['strength', 'running'],
        effect: 0.8,
        level: 'strong',
        values: { count: 3, runs: 5 },
        proposal: 'collision',
        experiment: 'legs48h',
      },
    ],
    cleared: [],
    missing: [],
    focus: ['strength', 'running'],
    experiment: 'legs48h',
  };

  const enCours: LabExperimentView = {
    record: { id: 'e-1', kind: 'legs48h', startKey: '2026-09-14', schedule: ['test', 'usual', 'usual', 'test'], status: 'running' },
    verdict: { status: 'sealed', endKey: '2026-10-11' },
  };

  it('🔴 l’expérience démarre le LUNDI SUIVANT, pas aujourd’hui', async () => {
    await afficher({ questions: [question] });
    await allerA('learn');

    await taper(screen.getByTestId('lab-start-experiment'));

    // Démarrer un mercredi donnerait une première « semaine » de cinq jours, incomparable aux
    // trois autres : le verdict porterait sur des semaines de longueurs différentes.
    expect(nextMondayKey).toHaveBeenCalledWith('2026-09-16');
    expect(startLabExperiment).toHaveBeenCalledWith('legs48h', '2026-09-21');
  });

  it('un suspect ouvre la fiche de son lien, en se souvenant d’où l’on vient', async () => {
    await afficher({ questions: [question], links: [lien('sports', 'holds')] });
    await allerA('learn');

    await taper(screen.getByTestId('lab-suspect-legsBeforeQuality-link'));

    expect(push).toHaveBeenCalledWith('/lab-link?id=sports&from=learn');
  });

  it('🔴 un suspect dont le lien n’existe pas (pilier désactivé) n’offre pas de fiche', async () => {
    await afficher({ questions: [question], links: [] });
    await allerA('learn');

    // Une fiche vide derrière un bouton serait une impasse : le lien n'est pas calculé.
    expect(screen.queryByTestId('lab-suspect-legsBeforeQuality-link')).toBeNull();
  });

  it('une expérience déjà en cours ne se relance pas', async () => {
    await afficher({ questions: [question], experiments: [enCours] });
    await allerA('learn');

    // Deux protocoles simultanés sur la même question se contamineraient : la semaine « habitude »
    // de l'un serait la semaine « essai » de l'autre.
    expect(screen.queryByTestId('lab-start-experiment')).toBeNull();
    expect(screen.getByText('lab.why.alreadyRunning')).toBeTruthy();
  });

  it('🔴 une expérience TERMINÉE est close à la relance — AVEC son verdict figé (LABO-04)', async () => {
    const verdict = { status: 'noEffect', delta: 0.4, better: false, testCount: 3, usualCount: 3 } as const;
    await afficher({
      questions: [question],
      experiments: [
        {
          record: { id: 'e-vieille', kind: 'legs48h', startKey: '2026-07-06', schedule: ['test', 'usual', 'usual', 'test'], status: 'running' },
          // Fenêtre close : le verdict n'est plus scellé.
          verdict,
        },
      ],
    });
    await allerA('learn');

    await taper(screen.getByTestId('lab-start-experiment'));

    // La ligne terminée est clôturée d'abord (l'index unique ne tolère qu'une ligne `running` par
    // modèle), et son verdict est écrit : recalculé plus tard, il bougerait avec les données.
    expect(finishLabExperiment).toHaveBeenCalledWith('e-vieille', verdict);
    expect(startLabExperiment).toHaveBeenCalledWith('legs48h', '2026-09-21');
  });

  it('on peut arrêter une expérience depuis Apprendre', async () => {
    await afficher({ experiments: [enCours] });
    await allerA('learn');

    await taper(screen.getByText('lab.known.stop'));

    expect(stopLabExperiment).toHaveBeenCalledWith('e-1');
  });
});
