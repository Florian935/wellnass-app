import { describe, expect, it } from 'vitest';

import {
  GOOD_NIGHT_MINUTES,
  LAB_MAX_PROPOSALS,
  LAB_MIN_PROTEIN_DAYS,
  LAB_PROPOSAL_KINDS,
  SHORT_NIGHT_MINUTES,
  buildLabWeek,
  type LabSessionInput,
  type LabWeekInput,
} from './lab-week';
import { REPS_REDUCTION_PCT } from './session-adaptation';
import type { SessionConflict } from './session-conflicts';

// Semaine du lundi 14 au dimanche 20 septembre 2026 ; aujourd'hui, mardi 15.
const MON = '2026-09-14';
const TUE = '2026-09-15';
const WED = '2026-09-16';
const THU = '2026-09-17';
const FRI = '2026-09-18';
const SAT = '2026-09-19';

function session(over: Partial<LabSessionInput> & Pick<LabSessionInput, 'id' | 'dayKey' | 'pillar'>): LabSessionInput {
  return { status: 'planned', name: null, sessionType: null, targetDistanceM: null, ...over };
}

function input(over: Partial<LabWeekInput> = {}): LabWeekInput {
  return {
    weekStartKey: MON,
    todayKey: TUE,
    activePillars: ['strength', 'running', 'nutrition'],
    sessions: [],
    runs: [],
    proteinByDay: [],
    weightKg: 77.6,
    proteinTarget: { min: 1.8, max: 2.4 },
    nights: [],
    conflicts: [],
    overtraining: { show: false, severity: null, streakDays: 0 },
    acwr: null,
    deficitVolume: { show: false, deficitPct: 0, loggedDays: 0 },
    carbs: null,
    ...over,
  };
}

const conflict = (over: Partial<SessionConflict> = {}): SessionConflict => ({
  runSessionId: 'run-thu',
  runDayKey: THU,
  runType: 'fractionne',
  strengthSessionId: 'legs-wed',
  strengthDayKey: WED,
  legSets: 12,
  suggestedDayKey: SAT,
  ...over,
});

const kinds = (i: LabWeekInput) => buildLabWeek(i).proposals.map((p) => p.kind);

describe('buildLabWeek — la semaine', () => {
  it('rend les 7 jours du lundi au dimanche, avec aujourd’hui et le passé', () => {
    const { days } = buildLabWeek(input());
    expect(days.map((d) => d.dayKey)).toEqual([MON, TUE, WED, THU, FRI, SAT, '2026-09-20']);
    expect(days.filter((d) => d.isToday).map((d) => d.dayKey)).toEqual([TUE]);
    expect(days.filter((d) => d.isPast).map((d) => d.dayKey)).toEqual([MON]);
  });

  it('range les séances par jour et par pilier, dans l’ordre des jours', () => {
    const { days, progress } = buildLabWeek(
      input({
        sessions: [
          session({ id: 'run-thu', dayKey: THU, pillar: 'running', sessionType: 'fractionne', targetDistanceM: 6800 }),
          session({ id: 'upper-mon', dayKey: MON, pillar: 'strength', status: 'done', name: 'Haut' }),
          session({ id: 'legs-wed', dayKey: WED, pillar: 'strength', name: 'Jambes' }),
          session({ id: 'run-tue', dayKey: TUE, pillar: 'running', status: 'done', targetDistanceM: 6000 }),
          session({ id: 'skipped', dayKey: FRI, pillar: 'running', status: 'skipped', targetDistanceM: 5000 }),
          session({ id: 'free', dayKey: SAT, pillar: 'running' }),
        ],
        runs: [{ dayKey: TUE, distanceM: 6200 }],
      }),
    );
    expect(days[0]!.strength).toEqual([{ id: 'upper-mon', name: 'Haut', sessionType: null, status: 'done', distanceM: null }]);
    expect(days[3]!.running.map((s) => s.id)).toEqual(['run-thu']);
    expect(progress.strength).toEqual({ done: 1, planned: 2, next: { dayKey: WED, name: 'Jambes', sessionType: null } });
    // La séance sautée ne compte pas au prévu ; une séance sans distance compte pour zéro.
    expect(progress.running).toEqual({ doneKm: 6.2, plannedKm: 12.8, next: { dayKey: THU, name: null, sessionType: 'fractionne' } });
  });

  it('n’a plus de prochaine séance quand tout est fait ou passé', () => {
    const { progress } = buildLabWeek(
      input({ sessions: [session({ id: 'past', dayKey: MON, pillar: 'strength' }), session({ id: 'done', dayKey: WED, pillar: 'strength', status: 'done' })] }),
    );
    expect(progress.strength!.next).toBeNull();
  });

  it('un pilier désactivé n’a ni ligne, ni progression (décision H)', () => {
    const { days, progress } = buildLabWeek(
      input({
        activePillars: ['running'],
        sessions: [session({ id: 'legs', dayKey: WED, pillar: 'strength' })],
        proteinByDay: [{ dayKey: MON, proteinG: 120 }],
      }),
    );
    expect(days[2]!.strength).toEqual([]);
    expect(days[0]!.proteinGPerKg).toBeNull();
    expect(progress.strength).toBeNull();
    expect(progress.nutrition).toBeNull();
    expect(buildLabWeek(input({ activePillars: ['nutrition'] })).progress.running).toBeNull();
  });

  it('calcule les protéines par kilo du jour et de la semaine, sur les seuls jours de la semaine', () => {
    const { days, progress } = buildLabWeek(
      input({ proteinByDay: [{ dayKey: MON, proteinG: 124.2 }, { dayKey: TUE, proteinG: 108.6 }, { dayKey: '2026-09-10', proteinG: 999 }] }),
    );
    expect(days[0]!.proteinGPerKg).toBe(1.6);
    expect(days[1]!.proteinGPerKg).toBe(1.4);
    expect(days[2]!.proteinGPerKg).toBeNull();
    expect(progress.nutrition).toEqual({ gPerKg: 1.5, target: { min: 1.8, max: 2.4 }, loggedDays: 2 });
  });

  it('sans poids, pas de g/kg ; sans jour saisi, pas de moyenne', () => {
    const noWeight = buildLabWeek(input({ weightKg: null, proteinByDay: [{ dayKey: MON, proteinG: 120 }] }));
    expect(noWeight.days[0]!.proteinGPerKg).toBeNull();
    expect(noWeight.progress.nutrition!.gPerKg).toBeNull();
    expect(buildLabWeek(input({ weightKg: 0, proteinByDay: [{ dayKey: MON, proteinG: 120 }] })).days[0]!.proteinGPerKg).toBeNull();
    expect(buildLabWeek(input()).progress.nutrition!.gPerKg).toBeNull();
  });

  it('compte les nuits saisies jusqu’à aujourd’hui, les bonnes, et garde la dernière', () => {
    const { days, progress } = buildLabWeek(
      input({
        nights: [
          { dayKey: MON, sleepMinutes: GOOD_NIGHT_MINUTES + 40 },
          { dayKey: TUE, sleepMinutes: 370 },
          { dayKey: WED, sleepMinutes: 500 }, // demain : pas encore une nuit passée
          { dayKey: '2026-09-13', sleepMinutes: null },
        ],
      }),
    );
    expect(days[1]!.sleepMinutes).toBe(370);
    expect(days[4]!.sleepMinutes).toBeNull();
    expect(progress.sleep).toEqual({ goodNights: 1, loggedNights: 2, lastMinutes: 370 });
    expect(buildLabWeek(input()).progress.sleep).toEqual({ goodNights: 0, loggedNights: 0, lastMinutes: null });
  });
});

describe('buildLabWeek — les propositions', () => {
  it('ne propose rien quand rien ne le justifie', () => {
    expect(buildLabWeek(input()).proposals).toEqual([]);
  });

  it('GARDE-01 : garde-fou qui ouvre le planning, avec les jours d’affilée', () => {
    const [p] = buildLabWeek(input({ overtraining: { show: true, severity: 'streakAndDeficit', streakDays: 8 } })).proposals;
    expect(p).toMatchObject({ kind: 'overtraining', tone: 'guard', safety: true, values: { streakDays: 8, severity: 'streakAndDeficit' }, action: { type: 'open', target: 'planning' } });
    expect(kinds(input({ activePillars: ['nutrition'], overtraining: { show: true, severity: 'streak', streakDays: 6 } }))).toEqual([]);
  });

  it('META-19 : allège la séance intense du jour, sinon ouvre le planning', () => {
    const acwr = { ratio: 1.456, zone: 'risk' as const, showAlert: true };
    const intenseToday = session({ id: 'run-tue', dayKey: TUE, pillar: 'running', sessionType: 'fractionne' });
    const withRun = buildLabWeek(input({ acwr, sessions: [intenseToday] })).proposals[0]!;
    expect(withRun).toMatchObject({ kind: 'loadRisk', safety: true, values: { ratio: 1.46 } });
    expect(withRun.action).toEqual({ type: 'lighten', plannedSessionId: 'run-tue', dayKey: TUE, repsReductionPct: REPS_REDUCTION_PCT });

    const easyToday = session({ id: 'easy', dayKey: TUE, pillar: 'running', sessionType: 'endurance' });
    const doneToday = session({ id: 'done', dayKey: TUE, pillar: 'running', sessionType: 'fractionne', status: 'done' });
    const tomorrow = session({ id: 'wed', dayKey: WED, pillar: 'running', sessionType: 'fractionne' });
    expect(buildLabWeek(input({ acwr, sessions: [easyToday, doneToday, tomorrow] })).proposals[0]!.action).toEqual({ type: 'open', target: 'planning' });
    expect(kinds(input({ acwr: { ...acwr, showAlert: false } }))).toEqual([]);
    expect(kinds(input({ activePillars: ['nutrition'], acwr }))).toEqual([]);
  });

  it('MN-02 : garde-fou déficit × volume, seulement si nutrition et musculation sont actives', () => {
    const deficitVolume = { show: true, deficitPct: 22, loggedDays: 5 };
    expect(buildLabWeek(input({ deficitVolume })).proposals[0]).toMatchObject({ kind: 'deficitVolume', values: { deficitPct: 22 }, action: { type: 'open', target: 'nutritionProfile' } });
    expect(kinds(input({ deficitVolume, activePillars: ['strength', 'running'] }))).toEqual([]);
    expect(kinds(input({ deficitVolume, activePillars: ['nutrition', 'running'] }))).toEqual([]);
  });

  it('COLLIS-01 : déplace la course vers le repli vérifié, ou ouvre le planning sans repli', () => {
    const { proposals } = buildLabWeek(
      input({ conflicts: [conflict({ runSessionId: 'late', runDayKey: SAT, suggestedDayKey: null }), conflict()] }),
    );
    expect(proposals.map((p) => p.id)).toEqual(['collision:run-thu', 'collision:late']);
    expect(proposals[0]!.action).toEqual({ type: 'reschedule', plannedSessionId: 'run-thu', fromDayKey: THU, toDayKey: SAT });
    expect(proposals[0]!.values).toEqual({ legSets: 12, runDayKey: THU, strengthDayKey: WED, runType: 'fractionne', toDayKey: SAT });
    expect(proposals[1]!.action).toEqual({ type: 'open', target: 'planning' });
    expect(proposals[1]!.values.toDayKey).toBe('');
    expect(kinds(input({ conflicts: [conflict()], activePillars: ['running', 'nutrition'] }))).toEqual([]);
    expect(kinds(input({ conflicts: [conflict()], activePillars: ['strength', 'nutrition'] }))).toEqual([]);
  });

  it('nuit courte + séance intense aujourd’hui : allège la séance', () => {
    const intense = session({ id: 'run-tue', dayKey: TUE, pillar: 'running', sessionType: 'fractionne', name: '6×800 m' });
    const short = [{ dayKey: TUE, sleepMinutes: SHORT_NIGHT_MINUTES - 10 }];
    const [p] = buildLabWeek(input({ sessions: [intense], nights: short })).proposals;
    expect(p).toMatchObject({ kind: 'shortNight', pair: ['sleep', 'running'], values: { sleepMinutes: 350, sessionName: '6×800 m' } });
    expect(p!.action).toMatchObject({ type: 'lighten', plannedSessionId: 'run-tue' });
    expect(buildLabWeek(input({ sessions: [{ ...intense, name: null }], nights: short })).proposals[0]!.values.sessionName).toBe('');
    // Pas de séance intense, pas de nuit saisie, ou une nuit suffisante : rien.
    expect(kinds(input({ nights: short }))).toEqual([]);
    expect(kinds(input({ sessions: [intense] }))).toEqual([]);
    expect(kinds(input({ sessions: [intense], nights: [{ dayKey: TUE, sleepMinutes: null }] }))).toEqual([]);
    expect(kinds(input({ sessions: [intense], nights: [{ dayKey: TUE, sleepMinutes: SHORT_NIGHT_MINUTES }] }))).toEqual([]);
  });

  it('MN-06 : protéines sous la cible sur au moins deux jours, avec l’écart en grammes', () => {
    const low = [{ dayKey: MON, proteinG: 124.2 }, { dayKey: TUE, proteinG: 108.6 }];
    const [p] = buildLabWeek(input({ proteinByDay: low })).proposals;
    expect(p).toMatchObject({ kind: 'protein', pair: ['nutrition', 'strength'], values: { gPerKg: 1.5, targetMin: 1.8, missingG: 23 }, action: { type: 'open', target: 'foodSuggestion' } });
    expect(buildLabWeek(input({ proteinByDay: low, activePillars: ['running', 'nutrition'] })).proposals[0]!.pair).toEqual(['nutrition', 'running']);
    expect(buildLabWeek(input({ proteinByDay: low, activePillars: ['nutrition'] })).proposals[0]!.pair).toEqual(['nutrition', 'nutrition']);
    expect(kinds(input({ proteinByDay: low.slice(0, LAB_MIN_PROTEIN_DAYS - 1) }))).toEqual([]);
    expect(kinds(input({ proteinByDay: low, proteinTarget: null }))).toEqual([]);
    expect(kinds(input({ proteinByDay: low, weightKg: null }))).toEqual([]);
    expect(kinds(input({ proteinByDay: low, proteinTarget: { min: 1.5, max: 2 } }))).toEqual([]);
    expect(kinds(input({ proteinByDay: low, activePillars: ['strength'] }))).toEqual([]);
  });

  it('FUEL-01 : glucides bas alors qu’il reste une séance dure', () => {
    const carbs = { gPerKg: 3.1, target: { min: 5, max: 7 }, status: 'low' as const };
    const hard = session({ id: 'long', dayKey: SAT, pillar: 'running', sessionType: 'sortie_longue' });
    const [p] = buildLabWeek(input({ carbs, sessions: [hard, session({ id: 'past', dayKey: MON, pillar: 'running', sessionType: 'fractionne' })] })).proposals;
    expect(p).toMatchObject({ kind: 'carbs', tone: 'info', values: { gPerKg: 3.1, targetMin: 5, hardSessions: 1 }, action: { type: 'open', target: 'nutritionStats' } });
    expect(kinds(input({ carbs }))).toEqual([]);
    expect(kinds(input({ carbs: { ...carbs, status: 'in' }, sessions: [hard] }))).toEqual([]);
    expect(kinds(input({ carbs: null, sessions: [hard] }))).toEqual([]);
    expect(kinds(input({ carbs, sessions: [hard], activePillars: ['running'] }))).toEqual([]);
  });

  it('range les garde-fous en tête et plafonne le nombre de cartes', () => {
    const intense = session({ id: 'run-tue', dayKey: TUE, pillar: 'running', sessionType: 'fractionne' });
    const all = input({
      sessions: [intense, session({ id: 'long', dayKey: SAT, pillar: 'running', sessionType: 'sortie_longue' })],
      overtraining: { show: true, severity: 'streak', streakDays: 6 },
      acwr: { ratio: 1.4, zone: 'risk', showAlert: true },
      deficitVolume: { show: true, deficitPct: 20, loggedDays: 5 },
      conflicts: [conflict()],
      nights: [{ dayKey: TUE, sleepMinutes: 300 }],
      proteinByDay: [{ dayKey: MON, proteinG: 100 }, { dayKey: TUE, proteinG: 100 }],
      carbs: { gPerKg: 3, target: { min: 5, max: 7 }, status: 'low' },
    });
    const result = kinds(all);
    expect(result).toHaveLength(LAB_MAX_PROPOSALS);
    expect(result).toEqual(LAB_PROPOSAL_KINDS.slice(0, LAB_MAX_PROPOSALS));
  });
});
