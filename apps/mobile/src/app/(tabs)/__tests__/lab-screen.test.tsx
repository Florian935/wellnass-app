/**
 * US LABO-01 — l'écran du Labo (`app/(tabs)/lab.tsx`), monté pour de vrai.
 *
 * Toutes les **règles** vivent dans `@wellness/shared` (couvertes sous Vitest) et toutes les
 * **lectures** dans `lab-repository`. Ce qui est testé ici est ce que l'écran **décide**, et
 * d'abord la promesse sur laquelle repose la confiance dans cet écran :
 *
 *  1. **rien n'est écrit sans la feuille** (R4) — un appui sur une proposition la met « prête »,
 *     l'écriture n'a lieu qu'à la confirmation. Un Labo qui modifierait le plan au tap serait
 *     exactement le « joujou » qu'on ne veut pas : on cesserait d'y toucher ;
 *  2. **une proposition qui n'écrit rien part tout de suite** — la faire passer par une feuille
 *     « ce qui change dans ton plan » alors que rien ne change serait mensonger ;
 *  3. **le geste écrit ce que la proposition annonce**, au bon identifiant et au bon jour ;
 *  4. **l'expérience démarre le lundi suivant**, jamais aujourd'hui : une semaine commencée un
 *     jeudi ne se compare à rien.
 *
 * La scène 3D est remplacée par un double : elle vit dans une WebView (WebGL), que jest-expo ne
 * sait pas monter — et ce qu'elle décide a été sorti dans `scene-state.ts`, testé à part.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { LabKnowledgeCard, LabProposal, LabQuestion, LabWeek } from '@wellness/shared';

import LabScreen from '../lab';
import type { LabExperimentView } from '@/data/repositories/lab-repository';
import {
  nextMondayKey,
  useLabComposer,
  useLabKnowledge,
  useLabObjective,
  useLabPillars,
  useLabQuestions,
  useLabWeek,
} from '@/data/repositories/lab-repository';
import { finishLabExperiment, startLabExperiment, stopLabExperiment } from '@/data/repositories/lab-experiment-repository';
import { applyAdaptationForToday, reschedulePlannedSession } from '@/data/repositories/planned-session-repository';
import { upsertNutritionProfile } from '@/data/repositories/nutrition-repository';
import { upsertRunnerProfile } from '@/data/repositories/running-profile-repository';
import { useRouter } from 'expo-router';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/data/repositories/lab-repository', () => ({
  useLabWeek: jest.fn(),
  useLabQuestions: jest.fn(() => ({ questions: [] })),
  useLabKnowledge: jest.fn(() => ({ cards: [], experiments: [] })),
  useLabComposer: jest.fn(),
  useLabObjective: jest.fn(() => 'maintain'),
  useLabPillars: jest.fn(() => ['strength', 'running', 'nutrition']),
  // La vraie fonction lit une clé de jour, jamais l'horloge : on la reproduit telle quelle.
  nextMondayKey: jest.fn(() => '2026-09-21'),
}));
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
jest.mock('@/data/repositories/nutrition-repository', () => ({ upsertNutritionProfile: jest.fn(async () => undefined) }));
jest.mock('@/data/repositories/running-profile-repository', () => ({ upsertRunnerProfile: jest.fn(async () => undefined) }));

/** La scène vit dans une WebView : on la remplace par sa légende, qui suffit à vérifier le mode. */
jest.mock('@/components/lab/LabStage', () => {
  const { Text } = require('react-native');
  return {
    LAB_STAGE_HEIGHT: 300,
    LabStage: ({ caption }: { caption: string }) => <Text testID="lab-stage">{caption}</Text>,
  };
});

jest.mock('@/hooks/useTodayKey', () => ({ useTodayKey: jest.fn(() => '2026-09-16') }));
jest.mock('@/hooks/useMenuFocus', () => ({ useMenuFocus: jest.fn() }));
jest.mock('@/hooks/useAppReducedMotion', () => ({ useAppReducedMotion: jest.fn(() => false) }));
jest.mock('@/hooks/useActionLock', () => ({
  useActionLock: () => (fn: () => Promise<void>) => fn(),
}));
jest.mock('@/lib/haptics', () => ({ hapticConfirm: jest.fn(), hapticSelect: jest.fn() }));

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
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
      border: '#ece0cd',
      accent: '#c0562f',
      accentText: '#ffffff',
      success: '#3f7d4f',
      warnText: '#8a5a12',
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

const mockWeek = useLabWeek as jest.Mock;
const mockQuestions = useLabQuestions as jest.Mock;
const mockKnowledge = useLabKnowledge as jest.Mock;
const mockComposer = useLabComposer as jest.Mock;
const mockPillars = useLabPillars as jest.Mock;
const mockObjective = useLabObjective as jest.Mock;
const mockRouter = useRouter as jest.Mock;

const push = jest.fn();

const DAYS = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'];

const semaine = (proposals: LabProposal[] = []): LabWeek => ({
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
  proposals,
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
  week?: LabWeek;
  questions?: LabQuestion[];
  knowledge?: { cards: LabKnowledgeCard[]; experiments: LabExperimentView[] };
};

const afficher = async ({ week = semaine(), questions = [], knowledge = { cards: [], experiments: [] } }: Affichage = {}) => {
  mockWeek.mockReturnValue({ week });
  mockQuestions.mockReturnValue({ questions });
  mockKnowledge.mockReturnValue(knowledge);
  mockComposer.mockReturnValue(contexteComposer());
  await render(<LabScreen />);
};

const taper = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const allerA = async (onglet: 'week' | 'composer' | 'why' | 'known') => {
  await taper(screen.getByLabelText(`lab.tabs.${onglet}`));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.mockReturnValue({ push });
  mockPillars.mockReturnValue(['strength', 'running', 'nutrition']);
  mockObjective.mockReturnValue('maintain');
  (nextMondayKey as jest.Mock).mockReturnValue('2026-09-21');
});

// ---------------------------------------------------------------------------
// Onglets
// ---------------------------------------------------------------------------

describe('navigation entre onglets', () => {
  it('ouvre sur la semaine, et la scène annonce le mode', async () => {
    await afficher();

    expect(screen.getByTestId('lab-stage')).toHaveTextContent('lab.stage.week');
    expect(screen.getByTestId('lab-progress-sleep')).toBeTruthy();
  });

  it('chaque onglet change la scène ET le corps', async () => {
    await afficher();

    await allerA('composer');
    expect(screen.getByTestId('lab-stage')).toHaveTextContent('lab.stage.composer');
    expect(screen.getByTestId('lab-lever-proteinGPerKg')).toBeTruthy();

    await allerA('why');
    expect(screen.getByTestId('lab-stage')).toHaveTextContent('lab.stage.why');
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
// R4 — rien ne s'écrit sans la feuille
// ---------------------------------------------------------------------------

describe('appliquer une proposition', () => {
  it('🔴 le premier appui met « prêt » et n’écrit RIEN', async () => {
    await afficher({ week: semaine([COLLISION]) });

    await taper(screen.getByText('lab.proposals.collision.action:{"legSets":12,"toDayKey":"2026-09-19"}'));

    // C'est toute la promesse de l'écran : le Labo propose, l'utilisateur dispose. Écrire au tap
    // ferait du plan un terrain glissant, et on cesserait d'explorer.
    expect(reschedulePlannedSession).not.toHaveBeenCalled();
    expect(screen.getByText('lab.week.staged')).toBeTruthy();
  });

  it('la feuille nomme le changement, le pilier et les écrans où ça se verra', async () => {
    await afficher({ week: semaine([COLLISION]) });

    await taper(screen.getByText('lab.proposals.collision.action:{"legSets":12,"toDayKey":"2026-09-19"}'));
    await taper(screen.getByLabelText('lab.week.apply:{"count":1}'));

    expect(screen.getByTestId('lab-change-collision:2026-09-17')).toBeTruthy();
    expect(screen.getByText('lab.apply.where:{"list":"lab.proposals.collision.changeWhere"}')).toBeTruthy();
  });

  it('confirmer DÉPLACE la séance au jour annoncé', async () => {
    await afficher({ week: semaine([COLLISION]) });

    await taper(screen.getByText('lab.proposals.collision.action:{"legSets":12,"toDayKey":"2026-09-19"}'));
    await taper(screen.getByLabelText('lab.week.apply:{"count":1}'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    expect(reschedulePlannedSession).toHaveBeenCalledWith('ps-1', '2026-09-19');
    expect(screen.getByText('lab.week.applied')).toBeTruthy();
  });

  it('un allègement passe par l’adaptation du jour, sans toucher l’allure', async () => {
    await afficher({ week: semaine([NUIT_COURTE]) });

    await taper(screen.getByText('lab.proposals.shortNight.action:{}'));
    await taper(screen.getByLabelText('lab.week.apply:{"count":1}'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    // Même écriture que l'adaptation de CARDIO-UX01 : une seule journée, pas le programme.
    expect(applyAdaptationForToday).toHaveBeenCalledWith('ps-2', { repsReductionPct: 25, paceSlowdownSPerKm: null });
  });

  it('🔴 une proposition qui n’écrit rien NAVIGUE, sans passer par la feuille', async () => {
    await afficher({ week: semaine([PROTEINES]) });

    await taper(screen.getByText('lab.proposals.protein.action:{"gPerKg":1.4,"targetMin":1.6,"missingG":14}'));

    // Une feuille « ce qui change dans ton plan » devant un changement qui n'existe pas apprendrait
    // à la confirmer sans lire — et c'est la seule protection de cet écran.
    expect(push).toHaveBeenCalledWith('/nutrition');
    expect(screen.queryByLabelText('lab.apply.confirm')).toBeNull();
  });

  it('« retirer » annule une proposition mise prête', async () => {
    await afficher({ week: semaine([COLLISION]) });

    await taper(screen.getByText('lab.proposals.collision.action:{"legSets":12,"toDayKey":"2026-09-19"}'));
    await taper(screen.getByText('lab.week.remove'));

    expect(screen.queryByLabelText(/lab\.week\.apply/)).toBeNull();
  });

  it('🔴 sans rien de prêt, aucun bouton d’application n’est offert', async () => {
    await afficher({ week: semaine([COLLISION]) });

    expect(screen.queryByLabelText(/lab\.week\.apply/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

describe('composer une formule', () => {
  const monter = async () => {
    await afficher();
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
    mockWeek.mockReturnValue({ week: semaine() });
    mockQuestions.mockReturnValue({ questions: [] });
    mockKnowledge.mockReturnValue({ cards: [], experiments: [] });
    mockComposer.mockReturnValue(contexteComposer({ weightKg: null }));
    await render(<LabScreen />);
    await allerA('composer');

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
// Expériences
// ---------------------------------------------------------------------------

describe('expériences', () => {
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

  it('🔴 l’expérience démarre le LUNDI SUIVANT, pas aujourd’hui', async () => {
    await afficher({ questions: [question] });
    await allerA('why');

    await taper(screen.getByTestId('lab-start-experiment'));

    // Démarrer un mercredi donnerait une première « semaine » de cinq jours, incomparable aux
    // trois autres : le verdict porterait sur des semaines de longueurs différentes.
    expect(nextMondayKey).toHaveBeenCalledWith('2026-09-16');
    expect(startLabExperiment).toHaveBeenCalledWith('legs48h', '2026-09-21');
  });

  it('lancer une expérience bascule sur les acquis, où elle se suit', async () => {
    await afficher({ questions: [question] });
    await allerA('why');

    await taper(screen.getByTestId('lab-start-experiment'));

    expect(screen.getByTestId('lab-stage')).toHaveTextContent('lab.stage.known');
  });

  it('une expérience déjà en cours ne se relance pas', async () => {
    await afficher({
      questions: [question],
      knowledge: {
        cards: [],
        experiments: [{ record: { id: 'e-1', kind: 'legs48h', startKey: '2026-09-14', schedule: ['test', 'usual', 'usual', 'test'], status: 'running' }, verdict: { status: 'sealed', endKey: '2026-10-11' } }],
      },
    });
    await allerA('why');

    // Deux protocoles simultanés sur la même question se contamineraient : la semaine « habitude »
    // de l'un serait la semaine « essai » de l'autre.
    expect(screen.queryByTestId('lab-start-experiment')).toBeNull();
    expect(screen.getByText('lab.why.alreadyRunning')).toBeTruthy();
  });

  it('🔴 une expérience TERMINÉE ne bloque plus son modèle — et est clôturée à la relance', async () => {
    await afficher({
      questions: [question],
      knowledge: {
        cards: [],
        experiments: [
          {
            record: { id: 'e-vieille', kind: 'legs48h', startKey: '2026-07-06', schedule: ['test', 'usual', 'usual', 'test'], status: 'running' },
            // Fenêtre close : le verdict n'est plus scellé.
            verdict: { status: 'noEffect', delta: 0.4, better: false, testCount: 3, usualCount: 3 },
          },
        ],
      },
    });
    await allerA('why');

    // Avant correctif, `status` restait à `running` à vie : le bouton était remplacé pour toujours
    // par « déjà en cours », et l'utilisateur n'avait AUCUN chemin pour refaire l'essai.
    await taper(screen.getByTestId('lab-start-experiment'));

    // La ligne terminée est clôturée d'abord : l'index unique de la base ne tolère qu'une seule
    // ligne `running` par modèle, et un rejet à l'upload figerait toute la file de synchro.
    expect(finishLabExperiment).toHaveBeenCalledWith('e-vieille');
    expect(startLabExperiment).toHaveBeenCalledWith('legs48h', '2026-09-21');
  });

  it('🔴 un échec d’écriture SE VOIT, au lieu de laisser croire que c’est fait', async () => {
    (reschedulePlannedSession as jest.Mock).mockRejectedValueOnce(new Error('hors ligne'));
    await afficher({ week: semaine([COLLISION]) });

    await taper(screen.getByText('lab.proposals.collision.action:{"legSets":12,"toDayKey":"2026-09-19"}'));
    await taper(screen.getByLabelText('lab.week.apply:{"count":1}'));
    await taper(screen.getByLabelText('lab.apply.confirm'));

    // Leçon CONF-06 : une rejection avalée laisse l'utilisateur croire son plan modifié. La feuille
    // reste ouverte, avec le message — et la proposition n'est PAS marquée appliquée.
    expect(screen.getByText('lab.apply.error')).toBeTruthy();
    expect(screen.queryByText('lab.week.applied')).toBeNull();
  });

  it('on peut arrêter une expérience depuis les acquis', async () => {
    await afficher({
      knowledge: {
        cards: [],
        experiments: [{ record: { id: 'e-1', kind: 'legs48h', startKey: '2026-09-14', schedule: ['test', 'usual', 'usual', 'test'], status: 'running' }, verdict: { status: 'sealed', endKey: '2026-10-11' } }],
      },
    });
    await allerA('known');

    await taper(screen.getByText('lab.known.stop'));

    expect(stopLabExperiment).toHaveBeenCalledWith('e-1');
  });
});
