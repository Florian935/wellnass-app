/**
 * US LIENS-01 — 🔴 garde-fou : **chaque phrase que le registre peut produire existe, en FR et en EN.**
 *
 * Le registre (`@wellness/shared`, `cross-links.ts`) rend des **clés** construites à l'exécution
 * (`lab.links.<lien>.verdict.<clé>`, `lab.links.rows.<clé>.note`…) : aucun test de parité ne les voit,
 * puisqu'elles n'apparaissent nulle part en toutes lettres dans le code. Une clé absente ne fait pas
 * planter l'écran — i18next rend **la clé elle-même**, et l'utilisateur lit
 * « lab.links.rows.acwr.note » au milieu d'une fiche. C'est exactement le défaut qu'aucune recette ne
 * voit tant que la situation qui le produit ne s'est pas présentée sur le téléphone.
 *
 * On fait donc tourner le vrai registre sur des situations qui couvrent chaque branche (compte neuf,
 * semaine chargée, garde-fous, vie réelle, associations à chaque stade, forme du jour, cycle…), puis
 * on résout chaque texte avec les **vraies** fonctions de mise en mots (`link-format.ts`) et un `t`
 * qui note les clés demandées. Chaque clé notée doit exister dans les deux langues.
 */

import {
  buildCrossLinks,
  buildLabWeek,
  crossLinkWindows,
  type CrossLink,
  type CrossLinkSeries,
  type CrossLinksInput,
  type LabKnowledgeCard,
  type LabQuestion,
  type LabWeekInput,
  type SessionConflict,
} from '@wellness/shared';
import type { TFunction } from 'i18next';

import fr from '@/i18n/locales/fr.json';
import en from '@/i18n/locales/en.json';
import { actionLabel } from '../CrossLinkCard';
import { figureTexts, formatLinkValues, linkTexts, rowTexts } from '../link-format';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr' } }) }));

type Dict = Record<string, unknown>;

function lookup(dict: Dict, key: string): unknown {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null || !(part in cur)) return undefined;
    cur = (cur as Dict)[part];
  }
  return cur;
}

/** Une clé existe si elle est une chaîne, ou (avec `count`) si ses formes plurielles le sont. */
function exists(dict: Dict, key: string, withCount: boolean): boolean {
  if (typeof lookup(dict, key) === 'string') return true;
  return withCount && typeof lookup(dict, `${key}_one`) === 'string' && typeof lookup(dict, `${key}_other`) === 'string';
}

const asked: { key: string; withCount: boolean }[] = [];
const t = ((key: string, opts?: Record<string, unknown>) => {
  asked.push({ key, withCount: opts !== undefined && 'count' in opts });
  return key;
}) as unknown as TFunction;

// ---------------------------------------------------------------------------
// Situations — calquées sur `cross-links.test.ts` (Vitest), qui en vérifie les états
// ---------------------------------------------------------------------------

const MON = '2026-09-21';
const TODAY = '2026-09-24';
const FRI = '2026-09-25';
const SAT = '2026-09-26';
const eight = <T>(v: T): T[] => Array.from({ length: 8 }, () => v);

function weekInput(over: Partial<LabWeekInput> = {}): LabWeekInput {
  return {
    weekStartKey: MON,
    todayKey: TODAY,
    activePillars: ['strength', 'running', 'nutrition'],
    sessions: [],
    runs: [],
    proteinByDay: [],
    weightKg: 72.4,
    proteinTarget: { min: 1.6, max: 2.2 },
    nights: [],
    conflicts: [],
    overtraining: { show: false, severity: null, streakDays: 0 },
    acwr: null,
    deficitVolume: { show: false, deficitPct: 0, loggedDays: 0 },
    carbs: null,
    ...over,
  };
}

function series(over: Partial<CrossLinkSeries> = {}): CrossLinkSeries {
  return {
    weeks: crossLinkWindows(TODAY).map((w) => w.from),
    proteinGPerKg: [1.8, 1.8, 1.7, 1.7, 1.6, 1.5, 1.4, 1.4],
    mainLift: { name: 'Squat', values: [108, 111, 113, 116, 119, 120, 120, 120] },
    acwr: [0.95, 1.02, 1.08, 1.1, 1.05, 1.12, 1.15, 1.12],
    weightKg: [72.9, 72.8, 72.7, 72.7, 72.6, 72.5, 72.4, 72.4],
    sbdTotal: eight(null),
    activeDays: { strength: eight(3), running: eight(3), nutrition: eight(6) },
    legsPace: { exposed: [252, 249, 255, 250, 253, 247], other: [246, 248, 244, 249, 247, 245, 250, 246, 248] },
    carbsByDayType: { hard: 3.2, easy: 3.4, hardDays: 4, easyDays: 10 },
    ...over,
  };
}

function input(over: Partial<CrossLinksInput> = {}, week: Partial<LabWeekInput> = {}): CrossLinksInput {
  const activePillars = over.activePillars ?? week.activePillars ?? ['strength', 'running', 'nutrition'];
  return {
    todayKey: TODAY,
    activePillars,
    cycleTrackingEnabled: false,
    inRealLifePeriod: false,
    week: buildLabWeek(weekInput({ activePillars, ...week })),
    knowledge: [],
    questions: [],
    acwr: { ratio: 1.12, zone: 'safe', showAlert: false },
    overtraining: { show: false, severity: null, streakDays: 3 },
    deficitVolume: { show: false, deficitPct: 0, loggedDays: 5 },
    interference: { show: false, direction: null, runRatio: 1.05, strengthRatio: 0.98 },
    protein: { gPerKg: 1.8, target: { min: 1.6, max: 2.2 }, status: 'in', loggedDays: 5 },
    carbs: { gPerKg: 5.4, target: { min: 5, max: 7 }, status: 'in' },
    activityLevel: { show: false },
    apport: {
      energy: { deltaKcal: 240, trainingAvgKcal: 2600, restAvgKcal: 2360 },
      adherence: { trainingPct: 92, restPct: 88 },
      lowFuelDays: 1,
      distribution: { servings: [{ dayKey: TODAY, meal: 'lunch', proteinG: 35 }], servingsAtReference: 2, referenceG: 29 },
    } as unknown as CrossLinksInput['apport'],
    trainingTime: { strengthSeconds: 7800, runningSeconds: 9600 },
    readiness: null,
    goalConflicts: [],
    rhythm: { streakDays: 12, lastWeekActiveDays: 6, lastWeekDone: 5, lastWeekPlanned: 6 },
    weight: { latestKg: 72.4, kgPerWeek: -0.1, weighIns: 8, loggedDays7: 5 },
    strength: { dots: 318, dotsDelta: 6, sbdTotal: 372 },
    cycle: null,
    series: series(),
    ...over,
  };
}

const conflict: SessionConflict = { runSessionId: 'long', runDayKey: SAT, runType: 'sortie_longue', strengthSessionId: 'legs', strengthDayKey: FRI, legSets: 22, suggestedDayKey: '2026-09-27' };
const conflictToday: SessionConflict = { ...conflict, runSessionId: 'q', runDayKey: TODAY, runType: 'fractionne', strengthDayKey: '2026-09-23' };
const readiness = (verdict: 'rest' | 'ok' | 'push') =>
  ({ show: true, verdict, negativeCount: verdict === 'rest' ? 2 : 0, availableCount: 3 }) as unknown as CrossLinksInput['readiness'];
const association = (kind: 'heavyLegsPace' | 'carbsPace' | 'shortNightPace', status: LabKnowledgeCard['status'], delta = 4): LabKnowledgeCard => ({
  id: `association:${kind}`,
  source: 'association',
  kind,
  status,
  pair: kind === 'carbsPace' ? ['nutrition', 'running'] : kind === 'heavyLegsPace' ? ['strength', 'running'] : ['sleep', 'running'],
  values: status === 'learning' ? { cases: 2, needed: 3 } : { delta, exposed: 6, other: 9 },
  usedBy: 'collision',
} as unknown as LabKnowledgeCard);
const low = { gPerKg: 1.4, target: { min: 1.6, max: 2.2 }, status: 'low' as const, loggedDays: 4 };
const lowCarbs = { gPerKg: 3.2, target: { min: 5, max: 7 }, status: 'low' as const };
const hardSat = { id: 'long', dayKey: SAT, pillar: 'running' as const, status: 'planned' as const, name: null, sessionType: 'sortie_longue' as const, targetDistanceM: 16000 };
const intenseToday = { id: 'q', dayKey: TODAY, pillar: 'running' as const, status: 'planned' as const, name: 'VMA', sessionType: 'fractionne' as const, targetDistanceM: 8000 };

const SITUATIONS: Record<string, CrossLinksInput> = {
  'tout tient': input(),
  'semaine chargée': input(
    { protein: low, carbs: lowCarbs },
    { conflicts: [conflict], sessions: [hardSat], carbs: lowCarbs, proteinByDay: [MON, '2026-09-22', '2026-09-23', TODAY].map((dayKey) => ({ dayKey, proteinG: 101 })) },
  ),
  'collision aujourd’hui': input({}, { conflicts: [conflictToday], sessions: [intenseToday] }),
  'collision sans jour proposé': input({}, { conflicts: [{ ...conflict, suggestedDayKey: null }] }),
  'charge au-dessus du seuil': input({ acwr: { ratio: 1.42, zone: 'risk', showAlert: true } }, { acwr: { ratio: 1.42, zone: 'risk', showAlert: true } }),
  'surentraînement': input(
    { overtraining: { show: true, severity: 'streak', streakDays: 9 } },
    { overtraining: { show: true, severity: 'streak', streakDays: 9 } },
  ),
  'charge et surentraînement': input(
    { acwr: { ratio: 1.5, zone: 'risk', showAlert: true }, overtraining: { show: true, severity: 'streakAndDeficit', streakDays: 12 } },
    { acwr: { ratio: 1.5, zone: 'risk', showAlert: true }, overtraining: { show: true, severity: 'streakAndDeficit', streakDays: 12 }, sessions: [intenseToday] },
  ),
  'nuit courte': input({}, { sessions: [intenseToday], nights: [{ dayKey: TODAY, sleepMinutes: 300 }, { dayKey: '2026-09-23', sleepMinutes: 470 }] }),
  'nuits courtes qui tiennent': input({}, { nights: [MON, '2026-09-22', '2026-09-23'].map((dayKey) => ({ dayKey, sleepMinutes: 320 })) }),
  'déficit × volume': input({ deficitVolume: { show: true, deficitPct: 18, loggedDays: 5 } }, { deficitVolume: { show: true, deficitPct: 18, loggedDays: 5 } }),
  'vie réelle': input({ inRealLifePeriod: true, deficitVolume: { show: true, deficitPct: 18, loggedDays: 5 } }, { deficitVolume: { show: true, deficitPct: 18, loggedDays: 5 } }),
  'niveau d’activité, sans glucides': input({ carbs: null, activityLevel: { show: true, suggested: 'active', runningDays: 9 } as CrossLinksInput['activityLevel'] }),
  'niveau d’activité, avec glucides': input({ activityLevel: { show: true, suggested: 'very_active', runningDays: 12 } as CrossLinksInput['activityLevel'] }),
  'glucides bas, semaine facile': input({ carbs: lowCarbs }),
  'protéines basses et plateau': input({
    protein: low,
    questions: [{ id: 'q-lift', kind: 'liftPlateau', values: { exerciseName: 'Squat', valueKg: 120, weeksFlat: 3 }, series: [], flatFrom: 5, suspects: [], cleared: [], missing: [], focus: [], experiment: null } as unknown as LabQuestion],
  }),
  'plateau de poids': input({ weight: { latestKg: 72.4, kgPerWeek: 0, weighIns: 8, loggedDays7: 3 }, questions: [{ kind: 'weightPlateau', values: {} } as unknown as LabQuestion] }),
  'journal troué, poids qui tient': input({ weight: { latestKg: 72.4, kgPerWeek: -0.2, weighIns: 8, loggedDays7: 2 } }),
  'contradiction d’objectifs': input({ goalConflicts: [{ rule: 'bulkVsCut', left: 'goal.muscle', right: 'nutrition.cut' } as unknown as CrossLinksInput['goalConflicts'][number]] }),
  'interférence, course au détriment de la force': input({ interference: { show: true, direction: 'runningUpStrengthDown', runRatio: 1.4, strengthRatio: 0.7 } }),
  'interférence, force au détriment de la course': input({ interference: { show: true, direction: 'strengthUpRunningDown', runRatio: 0.7, strengthRatio: 1.4 } }),
  'jambes → allure, en apprentissage': input({ knowledge: [association('heavyLegsPace', 'learning'), association('carbsPace', 'learning')] }),
  'jambes → allure, aucun lien': input({ knowledge: [association('heavyLegsPace', 'noLink', 0), association('carbsPace', 'noLink', 0)] }),
  'jambes → allure, lien solide': input({ knowledge: [association('heavyLegsPace', 'solid', 6), association('carbsPace', 'probable', 5)] }),
  'jambes → allure, lien probable mais favorable': input({ knowledge: [association('heavyLegsPace', 'probable', -2), association('carbsPace', 'solid', -3)] }),
  'forme du jour : repos': input({ readiness: readiness('rest') }),
  'forme du jour : ok': input({ readiness: readiness('ok') }),
  'forme du jour : pousse': input({ readiness: readiness('push') }),
  'force relative en baisse': input({ strength: { dots: 305, dotsDelta: -9, sbdTotal: 360 } }),
  'sans DOTS du passé': input({ strength: { dots: 305, dotsDelta: null, sbdTotal: 360 } }),
  'sans temps d’entraînement': input({ trainingTime: null, apport: { energy: null, adherence: null, lowFuelDays: 0, distribution: null } }),
  'compte neuf': input({
    protein: null,
    carbs: null,
    acwr: null,
    overtraining: { show: false, severity: null, streakDays: 0 },
    rhythm: { streakDays: 0, lastWeekActiveDays: null, lastWeekDone: null, lastWeekPlanned: null },
    weight: { latestKg: null, kgPerWeek: null, weighIns: 0, loggedDays7: 1 },
    strength: { dots: null, dotsDelta: null, sbdTotal: null },
    series: series({ activeDays: { strength: [0, 0, 0, 0, 0, 0, 0, 1], running: [0, 0, 0, 0, 0, 0, 0, 1], nutrition: [0, 0, 0, 0, 0, 0, 0, 1] } }),
  }),
  'poids connu, rien d’autre': input({ protein: null, carbs: null, weight: { latestKg: 72.4, kgPerWeek: null, weighIns: 1, loggedDays7: 0 } }),
  'protéines sous le seuil de jours': input({ protein: { ...low, loggedDays: 3 } }),
  'muscu seule': input({ activePillars: ['strength'] }),
  'course seule, sans ratio de charge': input({ activePillars: ['running'], acwr: null }),
  'course seule, nuits courtes': input(
    { activePillars: ['running'], acwr: null },
    { nights: [MON, '2026-09-22', '2026-09-23'].map((dayKey) => ({ dayKey, sleepMinutes: 320 })) },
  ),
  'muscu + course': input({ activePillars: ['strength', 'running'] }),
  'nutrition seule': input({ activePillars: ['nutrition'] }),
  'cycle, pas encore de cycle': input({ cycleTrackingEnabled: true, cycle: null }),
  'cycle, un cycle': input({ cycleTrackingEnabled: true, cycle: { cyclesObserved: 1, byMetric: null } }),
  'cycle, lisible': input({ cycleTrackingEnabled: true, cycle: { cyclesObserved: 4, byMetric: null } }),
};

// ---------------------------------------------------------------------------
// Ce que les écrans demandent pour un lien
// ---------------------------------------------------------------------------

function askEverything(link: CrossLink) {
  linkTexts(t, 'fr', link);
  for (const f of link.figures) figureTexts(t, 'fr', f);
  for (const r of link.rows) {
    rowTexts(t, 'fr', r);
    if (r.state !== null) t(`lab.links.states.${r.state}`);
  }
  for (const a of link.actions) {
    actionLabel(t, 'fr', a);
    // La feuille « ce qui change » d'un geste qui écrit (Labo › Croiser et fiche).
    if (a.type === 'proposal' && a.proposal.action.type !== 'open') {
      const values = formatLinkValues(a.proposal.values, 'fr', t);
      t(`lab.proposals.${a.proposal.kind}.changeTitle`, values);
      t(`lab.proposals.${a.proposal.kind}.changeDetail`, values);
      t(`lab.proposals.${a.proposal.kind}.changeWhere`);
    }
  }
  for (const s of link.echoes) t(`lab.links.surfaces.${s}`);
}

describe('LIENS-01 — chaque phrase du registre existe', () => {
  const produced = new Map<string, Set<string>>();
  const counted = new Set<string>();

  beforeAll(() => {
    for (const [name, situation] of Object.entries(SITUATIONS)) {
      asked.length = 0;
      for (const link of buildCrossLinks(situation)) askEverything(link);
      for (const { key, withCount } of asked) {
        if (!produced.has(key)) produced.set(key, new Set());
        produced.get(key)!.add(name);
        if (withCount) counted.add(key);
      }
    }
  });

  it('les situations couvrent bien les quatre états de chaque lien disponible', () => {
    const seen = new Set<string>();
    for (const situation of Object.values(SITUATIONS)) for (const l of buildCrossLinks(situation)) seen.add(`${l.id}:${l.state}`);
    // Un lien dont on n'a jamais produit l'état « à régler » aurait des phrases jamais vérifiées.
    for (const expected of [
      'sports:adjust', 'sports:holds', 'sports:discover',
      'fuelStrength:guard', 'fuelStrength:adjust', 'fuelStrength:holds', 'fuelStrength:discover',
      'fuelRunning:adjust', 'fuelRunning:holds', 'fuelRunning:discover',
      'recovery:guard', 'recovery:adjust', 'recovery:holds', 'recovery:discover',
      'weight:adjust', 'weight:holds', 'weight:discover',
      'goals:adjust', 'goals:holds',
      'rhythm:holds', 'rhythm:discover',
      'strengthWeight:holds', 'strengthWeight:discover',
      'cycle:holds', 'cycle:discover',
    ]) {
      expect(seen).toContain(expected);
    }
  });

  it('le relevé n’est pas vide : il voit les verdicts, les mesures, les notes et les feuilles', () => {
    // Un `t` mal branché rendrait le test vert sans rien vérifier.
    expect(produced.size).toBeGreaterThan(150);
    for (const key of ['lab.links.recovery.verdict.loadRisk', 'lab.links.rows.acwr.note', 'lab.links.missing.proteinDays.meter', 'lab.proposals.collision.changeDetail']) {
      expect(produced.has(key)).toBe(true);
    }
  });

  it.each([
    ['FR', fr as Dict],
    ['EN', en as Dict],
  ])('🔴 %s : aucune clé demandée ne manque', (_lang, dict) => {
    const missing = [...produced.entries()]
      .filter(([key]) => !exists(dict, key, counted.has(key)))
      .map(([key, where]) => `${key}  (${[...where].slice(0, 2).join(' · ')})`);
    expect(missing).toEqual([]);
  });
});
