import { describe, expect, it } from 'vitest';
import { NOW, OTHER, OWNER, emptySnapshot, uid } from './noryn.testkit';
import { boundedInt, refPaceOf, sessionInputsFor, syncedAtOf, trackedDomains, type OwnerSnapshot } from './snapshot';

describe('syncedAtOf — le reçu de synchro, borné et tronqué', () => {
  it('rend null quand le serveur n’a jamais rien reçu', () => {
    expect(syncedAtOf(null, NOW)).toBeNull();
  });

  it('tronque les microsecondes de Postgres, sans jamais arrondir vers le haut', () => {
    expect(syncedAtOf('2026-10-08T11:40:00.123999+00:00', NOW)).toBe('2026-10-08T11:40:00.123Z');
    expect(syncedAtOf('2026-10-08T11:40:00+00:00', NOW)).toBe('2026-10-08T11:40:00.000Z');
  });

  it('ramène un décalage horaire à UTC', () => {
    expect(syncedAtOf('2026-10-08T13:40:00.5+02:00', NOW)).toBe('2026-10-08T11:40:00.500Z');
  });

  it('ne dépasse jamais l’instant de la réponse', () => {
    expect(syncedAtOf('2026-10-08T12:00:00.000001Z', NOW)).toBe(NOW.toISOString());
    expect(syncedAtOf('2026-10-09T08:00:00Z', NOW)).toBe(NOW.toISOString());
  });

  it('lève sur un reçu illisible plutôt que d’inventer une fraîcheur', () => {
    expect(() => syncedAtOf('hier soir', NOW)).toThrow();
    expect(() => syncedAtOf('2026-13-45T25:00:00Z', NOW)).toThrow();
  });
});

describe('trackedDomains — les domaines suivis, décodés comme l’app (D5)', () => {
  it('sans réglages : tous les piliers, Health Connect et Bien-être éteints', () => {
    expect(trackedDomains(null)).toEqual({ steps: false, nutrition: true, wellbeingPillar: false });
  });

  it('lit les interrupteurs', () => {
    const settings = emptySnapshot().settings;
    expect(trackedDomains(settings)).toEqual({ steps: true, nutrition: true, wellbeingPillar: true });
    expect(
      trackedDomains({ ...settings!, health_connect_enabled: null, wellbeing_pillar_enabled: false }),
    ).toEqual({ steps: false, nutrition: true, wellbeingPillar: false });
  });

  it('pilier Nutrition éteint', () => {
    expect(trackedDomains({ ...emptySnapshot().settings!, active_pillars: ['strength'] }).nutrition).toBe(false);
  });

  it('piliers encodés en texte (synchro) : décodés', () => {
    expect(trackedDomains({ ...emptySnapshot().settings!, active_pillars: '["running"]' }).nutrition).toBe(false);
  });

  it('piliers corrompus : repli sur tous les piliers, comme l’app', () => {
    expect(trackedDomains({ ...emptySnapshot().settings!, active_pillars: ['yoga'] }).nutrition).toBe(true);
    expect(trackedDomains({ ...emptySnapshot().settings!, active_pillars: 'pas du json' }).nutrition).toBe(true);
    expect(trackedDomains({ ...emptySnapshot().settings!, active_pillars: null }).nutrition).toBe(true);
  });
});

describe('refPaceOf', () => {
  it('lit l’allure de référence, ou null', () => {
    expect(refPaceOf(emptySnapshot())).toBe(300);
    expect(refPaceOf(emptySnapshot({ runningProfile: null }))).toBeNull();
  });
});

describe('boundedInt (DD6)', () => {
  it('garde un entier dans les bornes, rend null sinon — jamais rogné', () => {
    expect(boundedInt(5, 1, 5)).toBe(5);
    expect(boundedInt(6, 1, 5)).toBeNull();
    expect(boundedInt(0, 1, 5)).toBeNull();
    expect(boundedInt(2.5, 1, 5)).toBeNull();
    expect(boundedInt(null, 1, 5)).toBeNull();
    expect(boundedInt(undefined, 1, 5)).toBeNull();
  });
});

describe('sessionInputsFor — le planning tel que le téléphone le voit', () => {
  const DAY = '2026-10-08';
  const planned = (n: number, sessionId: string, programId: string, date = DAY) => ({
    owner_id: OWNER,
    id: uid(n),
    scheduled_date: date,
    scheduled_time: '18:30:00',
    status: 'planned',
    session_id: sessionId,
    program_id: programId,
  });
  const session = (id: string, owner: string | null = null, over = {}) => ({
    owner_id: owner,
    id,
    session_type: null,
    order_index: 0,
    target_duration_seconds: null,
    target_distance_m: null,
    ...over,
  });
  const program = (id: string, owner: string | null, status = 'published', pillar = 'strength') => ({
    owner_id: owner,
    id,
    pillar,
    status,
  });
  const plan = (sessionId: string, exerciseId: string, order: number, sets: number | null, owner: string | null = null) => ({
    owner_id: owner,
    session_id: sessionId,
    exercise_id: exerciseId,
    order_index: order,
    target_sets: sets,
    rest_seconds: 60,
  });
  const exercise = (id: string, muscle: string | null, over = {}) => ({
    owner_id: null,
    id,
    muscle_primary: muscle,
    status: 'published',
    deleted_at: null,
    ...over,
  });

  const base = (over: Partial<OwnerSnapshot> = {}) =>
    emptySnapshot({
      planned: [planned(1, 's1', 'p1')],
      sessions: [session('s1')],
      programs: [program('p1', null)],
      ...over,
    });

  it('résout pilier, type, ordre et cibles de la séance', () => {
    const [input] = sessionInputsFor(
      base({
        sessions: [session('s1', null, { session_type: 'endurance', order_index: 3, target_duration_seconds: 2400, target_distance_m: 8000 })],
        programs: [program('p1', null, 'published', 'running')],
      }),
      [DAY],
    );
    expect(input).toMatchObject({
      id: uid(1),
      scheduledDate: DAY,
      scheduledTime: '18:30:00',
      status: 'planned',
      pillar: 'running',
      sessionType: 'endurance',
      orderIndex: 3,
      targetDurationSeconds: 2400,
      targetDistanceM: 8000,
    });
  });

  it('ne garde que les dates demandées', () => {
    const snapshot = base({ planned: [planned(1, 's1', 'p1'), planned(2, 's1', 'p1', '2026-10-09')] });
    expect(sessionInputsFor(snapshot, [DAY]).map((i) => i.id)).toEqual([uid(1)]);
  });

  it('écarte une séance dont la séance ou le programme manque', () => {
    expect(sessionInputsFor(base({ sessions: [] }), [DAY])).toEqual([]);
    expect(sessionInputsFor(base({ programs: [] }), [DAY])).toEqual([]);
  });

  it('programme de la bibliothèque en brouillon : absent du téléphone, séance écartée', () => {
    expect(sessionInputsFor(base({ programs: [program('p1', null, 'draft')] }), [DAY])).toEqual([]);
  });

  it('programme personnel en brouillon : présent, séance gardée', () => {
    expect(sessionInputsFor(base({ programs: [program('p1', OWNER, 'draft')] }), [DAY])).toHaveLength(1);
  });

  it('contenu d’un autre compte : écarté, la séance aussi', () => {
    expect(sessionInputsFor(base({ sessions: [session('s1', OTHER)] }), [DAY])).toEqual([]);
    expect(sessionInputsFor(base({ programs: [program('p1', OTHER)] }), [DAY])).toEqual([]);
  });

  it('durée : plans dans l’ordre, exercices présents et non archivés', () => {
    const [input] = sessionInputsFor(
      base({
        exercisePlans: [plan('s1', 'e2', 2, 3), plan('s1', 'e1', 1, 4), plan('s1', 'e9', 3, 5)],
        exercises: [exercise('e1', 'legs'), exercise('e2', 'back')],
      }),
      [DAY],
    );
    expect(input?.durationPlans).toEqual([
      { targetSets: 4, restSeconds: 60 },
      { targetSets: 3, restSeconds: 60 },
    ]);
  });

  it('un exercice de bibliothèque archivé compte pour heavy_lower, pas pour la durée', () => {
    const [input] = sessionInputsFor(
      base({
        exercisePlans: [plan('s1', 'e1', 1, 5), plan('s1', 'e2', 2, 4)],
        exercises: [exercise('e1', 'legs'), exercise('e2', 'legs', { deleted_at: '2026-09-01T00:00:00Z' })],
      }),
      [DAY],
    );
    expect(input?.durationPlans).toEqual([{ targetSets: 5, restSeconds: 60 }]);
    expect(input?.setsByMuscle).toEqual({ legs: 9 });
  });

  it('un exercice personnel archivé ou un brouillon de bibliothèque : absents du téléphone, ignorés', () => {
    const [input] = sessionInputsFor(
      base({
        exercisePlans: [plan('s1', 'e1', 1, 5), plan('s1', 'e2', 2, 4)],
        exercises: [
          exercise('e1', 'legs', { owner_id: OWNER, deleted_at: '2026-09-01T00:00:00Z' }),
          exercise('e2', 'legs', { status: 'draft' }),
        ],
      }),
      [DAY],
    );
    expect(input?.durationPlans).toEqual([]);
    expect(input?.setsByMuscle).toEqual({});
  });

  it('un exercice sans muscle principal compte pour la durée, pas pour les séries par muscle', () => {
    const [input] = sessionInputsFor(
      base({ exercisePlans: [plan('s1', 'e1', 1, 3)], exercises: [exercise('e1', null)] }),
      [DAY],
    );
    expect(input?.durationPlans).toHaveLength(1);
    expect(input?.setsByMuscle).toEqual({});
  });

  it('séries non chiffrées : ignorées dans la somme, comme SUM en SQL', () => {
    const [input] = sessionInputsFor(
      base({
        exercisePlans: [plan('s1', 'e1', 1, null), plan('s1', 'e2', 2, 6), plan('s1', 'e3', 3, null)],
        exercises: [exercise('e1', 'chest'), exercise('e2', 'legs'), exercise('e3', 'legs')],
      }),
      [DAY],
    );
    expect(input?.setsByMuscle).toEqual({ chest: null, legs: 6 });
  });

  it('plans d’une autre séance ou d’un autre compte : ignorés', () => {
    const [input] = sessionInputsFor(
      base({
        exercisePlans: [plan('s2', 'e1', 1, 4), plan('s1', 'e1', 2, 4, OTHER)],
        exercises: [exercise('e1', 'legs')],
      }),
      [DAY],
    );
    expect(input?.durationPlans).toEqual([]);
  });

  it('blocs de course : ceux de la séance, dans l’ordre, jamais ceux d’un autre compte', () => {
    const interval = (sessionId: string, order: number, reps: number, owner: string | null = null) => ({
      owner_id: owner,
      session_id: sessionId,
      order_index: order,
      reps,
      fast_distance_m: 400,
      recovery_distance_m: 200,
    });
    const [input] = sessionInputsFor(
      base({ intervals: [interval('s1', 2, 4), interval('s1', 1, 6), interval('s2', 1, 9), interval('s1', 3, 8, OTHER)] }),
      [DAY],
    );
    expect(input?.blocks).toEqual([
      { reps: 6, fastDistanceM: 400, recoveryDistanceM: 200 },
      { reps: 4, fastDistanceM: 400, recoveryDistanceM: 200 },
    ]);
  });
});
