import { describe, expect, it } from 'vitest';
import type { RunIntervalRow } from './run-interval-results';
import { lastTimeReps, pickRunLastTime, repsInRange, type LastTimeCandidate } from './run-last-time';

const run = (
  id: string,
  finishedAt: string | null,
  sessionId: string | null,
  sessionType: LastTimeCandidate['sessionType'],
): LastTimeCandidate => ({ id, finishedAt, sessionId, sessionType });

describe('pickRunLastTime — R3', () => {
  const today = { sessionId: 'sess-frac', sessionType: 'fractionne' as const };

  it('la même séance de programme passe avant tout', () => {
    const runs = [
      run('r-type-recent', '2026-09-23T18:00:00.000Z', 'sess-autre-frac', 'fractionne'),
      run('r-meme-seance', '2026-09-18T18:00:00.000Z', 'sess-frac', 'fractionne'),
    ];
    expect(pickRunLastTime(runs, today)).toEqual({ runId: 'r-meme-seance', match: 'session' });
  });

  it('parmi plusieurs courses de la même séance, la plus récente', () => {
    const runs = [
      run('r-ancienne', '2026-09-11T18:00:00.000Z', 'sess-frac', 'fractionne'),
      run('r-recente', '2026-09-18T18:00:00.000Z', 'sess-frac', 'fractionne'),
    ];
    expect(pickRunLastTime(runs, today)?.runId).toBe('r-recente');
  });

  it('à défaut, la plus récente du même type de séance', () => {
    const runs = [
      run('r-endurance', '2026-09-23T18:00:00.000Z', 'sess-ef', 'endurance'),
      run('r-frac-ancien', '2026-09-04T18:00:00.000Z', 'sess-frac-v1', 'fractionne'),
      run('r-frac-recent', '2026-09-11T18:00:00.000Z', 'sess-frac-v2', 'fractionne'),
    ];
    expect(pickRunLastTime(runs, today)).toEqual({ runId: 'r-frac-recent', match: 'type' });
  });

  it('🔴 une course libre ne sert jamais de dernière fois à une séance', () => {
    const runs = [run('r-libre', '2026-09-23T18:00:00.000Z', null, null)];
    expect(pickRunLastTime(runs, { sessionId: 'sess-x', sessionType: null })).toBeNull();
    expect(pickRunLastTime(runs, today)).toBeNull();
  });

  it('une course non terminée est ignorée', () => {
    const runs = [run('r-active', null, 'sess-frac', 'fractionne')];
    expect(pickRunLastTime(runs, today)).toBeNull();
  });

  it('aucune correspondance : null (« Première fois »)', () => {
    const runs = [run('r-sl', '2026-09-20T09:00:00.000Z', 'sess-sl', 'sortie_longue')];
    expect(pickRunLastTime(runs, today)).toBeNull();
  });

  it('sans séance du jour identifiée, rien', () => {
    const runs = [run('r-frac', '2026-09-18T18:00:00.000Z', 'sess-frac', 'fractionne')];
    expect(pickRunLastTime(runs, { sessionId: null, sessionType: null })).toBeNull();
  });
});

const row = (over: Partial<RunIntervalRow>): RunIntervalRow => ({
  phaseIndex: 0,
  phaseKind: 'fast',
  segmentKind: 'work',
  rep: 1,
  totalReps: 6,
  plannedDistanceM: 400,
  plannedDurationSeconds: null,
  plannedPaceMinSPerKm: 230,
  plannedPaceMaxSPerKm: 240,
  actualDistanceM: 400,
  actualDurationSeconds: 94,
  actualPaceSPerKm: 235,
  ...over,
});

describe('lastTimeReps — R4', () => {
  it('une répétition bornée en distance se dit en temps', () => {
    expect(lastTimeReps([row({})])).toEqual([{ rep: 1, kind: 'time', seconds: 94, state: 'in' }]);
  });

  it('une répétition bornée en durée se dit en allure', () => {
    const r = row({
      plannedDistanceM: null,
      plannedDurationSeconds: 60,
      actualDistanceM: 252,
      actualDurationSeconds: 60,
      actualPaceSPerKm: 238.1,
    });
    expect(lastTimeReps([r])).toEqual([{ rep: 1, kind: 'pace', seconds: 238, state: 'in' }]);
  });

  it('hors de la plage : contour ; sans plage : neutre', () => {
    const lente = row({ phaseIndex: 1, actualDurationSeconds: 99, actualPaceSPerKm: 247.5 });
    const sansPlage = row({ phaseIndex: 2, plannedPaceMinSPerKm: null, plannedPaceMaxSPerKm: null });
    expect(lastTimeReps([lente, sansPlage]).map((r) => r.state)).toEqual(['out', 'none']);
  });

  it('🔴 les récupérations sont écartées, et les répétitions renumérotées dans l’ordre', () => {
    const rows = [
      row({ phaseIndex: 0, rep: 1 }),
      row({ phaseIndex: 1, phaseKind: 'recovery', plannedDistanceM: 200 }),
      row({ phaseIndex: 2, rep: 2, actualDurationSeconds: 93 }),
      row({ phaseIndex: 3, phaseKind: 'recovery', plannedDistanceM: 200 }),
      // Un second bloc recommence à rep = 1 : la pastille, elle, continue la numérotation.
      row({ phaseIndex: 4, rep: 1, actualDurationSeconds: 95 }),
    ];
    expect(lastTimeReps(rows).map((r) => [r.rep, r.seconds])).toEqual([
      [1, 94],
      [2, 93],
      [3, 95],
    ]);
  });

  it('🔴 l’échauffement, les éducatifs et le retour au calme ne sont pas des répétitions', () => {
    // `expandIntervalPhases` développe ces segments en phases « rapides » : sans ce filtre, un
    // échauffement de 15 min se lirait comme une fraction ratée, hors plage.
    const rows = [
      row({ phaseIndex: 0, segmentKind: 'warmup', plannedDistanceM: null, plannedDurationSeconds: 900 }),
      row({ phaseIndex: 1, segmentKind: 'drills', plannedDistanceM: null, plannedDurationSeconds: 300 }),
      row({ phaseIndex: 2, segmentKind: 'work' }),
      row({ phaseIndex: 3, segmentKind: 'cooldown', plannedDistanceM: null, plannedDurationSeconds: 600 }),
    ];
    expect(lastTimeReps(rows)).toEqual([{ rep: 1, kind: 'time', seconds: 94, state: 'in' }]);
  });

  it('suit l’ordre des phases, pas l’ordre d’arrivée des lignes', () => {
    const rows = [row({ phaseIndex: 2, actualDurationSeconds: 96 }), row({ phaseIndex: 0 })];
    expect(lastTimeReps(rows).map((r) => r.seconds)).toEqual([94, 96]);
  });

  it('🔴 une répétition sans réalisé mesurable (rattrapage) : valeur nulle, état neutre', () => {
    const r = row({ actualDurationSeconds: null, actualPaceSPerKm: null });
    expect(lastTimeReps([r])).toEqual([{ rep: 1, kind: 'time', seconds: null, state: 'none' }]);
  });

  it('une plage à une seule borne vaut une cible unique', () => {
    const r = row({ plannedPaceMaxSPerKm: null, actualPaceSPerKm: 230 });
    expect(lastTimeReps([r])[0]!.state).toBe('in');
  });

  it('aucune ligne : aucune pastille', () => {
    expect(lastTimeReps([])).toEqual([]);
  });
});

describe('repsInRange — le « X sur Y dans la plage » (R4)', () => {
  it('ne compte au dénominateur que les répétitions qui ont une plage et un réalisé', () => {
    const reps = lastTimeReps([
      row({ phaseIndex: 0 }),
      row({ phaseIndex: 1, actualDurationSeconds: 99, actualPaceSPerKm: 247.5 }),
      row({ phaseIndex: 2, plannedPaceMinSPerKm: null, plannedPaceMaxSPerKm: null }),
      row({ phaseIndex: 3, actualDurationSeconds: null, actualPaceSPerKm: null }),
    ]);
    expect(repsInRange(reps)).toEqual({ done: 1, total: 2 });
  });

  it('aucune répétition notée : null (on ne dit pas « 0 sur 0 »)', () => {
    expect(repsInRange([])).toBeNull();
    expect(repsInRange(lastTimeReps([row({ plannedPaceMinSPerKm: null, plannedPaceMaxSPerKm: null })]))).toBeNull();
  });
});
