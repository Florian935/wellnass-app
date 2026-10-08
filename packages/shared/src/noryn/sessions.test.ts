import { describe, expect, it } from 'vitest';
import { estimateSessionMinutes } from '../session-estimate';
import { buildNorynSessions, runIntensity, runTags, toNorynSession, type NorynSessionInput } from './sessions';

const ID = '5b0c2f9e-8d1a-4c3e-9f6b-2a7d1e0c4b85';

const run = (over: Partial<NorynSessionInput> = {}): NorynSessionInput => ({
  id: ID,
  scheduledDate: '2026-10-08',
  scheduledTime: '07:00:00',
  status: 'planned',
  pillar: 'running',
  sessionType: 'endurance',
  orderIndex: 0,
  targetDurationSeconds: 40 * 60,
  targetDistanceM: null,
  durationPlans: [],
  setsByMuscle: {},
  blocks: [],
  ...over,
});

const strength = (over: Partial<NorynSessionInput> = {}): NorynSessionInput =>
  run({
    pillar: 'strength',
    sessionType: null,
    scheduledTime: '18:30:00',
    targetDurationSeconds: null,
    durationPlans: [
      { targetSets: 4, restSeconds: 120 },
      { targetSets: 3, restSeconds: 90 },
    ],
    setsByMuscle: { legs: 4, back: 3 },
    ...over,
  });

describe('runIntensity', () => {
  it.each([
    ['recuperation', 'low'],
    ['endurance', 'low'],
    ['sortie_longue', 'moderate'],
    ['fractionne', 'high'],
    ['test', 'high'],
    ['course', 'high'],
  ])('%s → %s', (type, expected) => {
    expect(runIntensity(type)).toBe(expected);
  });

  it('type vide, course libre ou inconnu de cette version → null (R14)', () => {
    expect(runIntensity(null)).toBeNull();
    expect(runIntensity('course_libre')).toBeNull();
    expect(runIntensity('seuil')).toBeNull();
  });
});

describe('runTags', () => {
  it.each([
    ['endurance', ['easy_run']],
    ['recuperation', ['easy_run']],
    ['sortie_longue', ['long_run']],
    ['fractionne', ['intervals']],
    ['test', ['race_effort']],
    ['course', ['race_effort']],
  ])('%s → %j', (type, expected) => {
    expect(runTags(type)).toEqual(expected);
  });

  it('type vide, course libre ou inconnu → aucune étiquette', () => {
    expect(runTags(null)).toEqual([]);
    expect(runTags('course_libre')).toEqual([]);
    expect(runTags('seuil')).toEqual([]);
  });
});

describe('toNorynSession — course', () => {
  it('donne type, intensité, étiquette, heure et durée cible', () => {
    expect(toNorynSession(run(), 300)).toEqual({
      id: ID,
      date: '2026-10-08',
      start_time: '07:00',
      kind: 'running',
      intensity: 'low',
      estimated_minutes: 40,
      status: 'planned',
      tags: ['easy_run'],
    });
  });

  it('une sortie longue est modérée et porte long_run', () => {
    const s = toNorynSession(run({ sessionType: 'sortie_longue' }), 300);
    expect(s?.intensity).toBe('moderate');
    expect(s?.tags).toEqual(['long_run']);
  });

  it('sans durée cible, estime par le volume des blocs et l’allure de référence (comme le hub)', () => {
    // 6 × (400 + 200) = 3 600 m à 300 s/km × 1,15 = 20,7 min → 21
    const s = toNorynSession(
      run({
        sessionType: 'fractionne',
        targetDurationSeconds: null,
        blocks: [{ reps: 6, fastDistanceM: 400, recoveryDistanceM: 200 }],
      }),
      300,
    );
    expect(s?.estimated_minutes).toBe(21);
    expect(s?.intensity).toBe('high');
    expect(s?.tags).toEqual(['intervals']);
  });

  it('sans durée cible ni allure de référence → durée null', () => {
    expect(toNorynSession(run({ targetDurationSeconds: null, targetDistanceM: 8000 }), null)?.estimated_minutes).toBeNull();
  });

  it('une durée hors 1–600 min devient null', () => {
    expect(toNorynSession(run({ targetDurationSeconds: 20 }), 300)?.estimated_minutes).toBeNull();
    expect(toNorynSession(run({ targetDurationSeconds: 601 * 60 }), 300)?.estimated_minutes).toBeNull();
  });
});

describe('toNorynSession — musculation', () => {
  it('intensité null (D6), durée égale à celle de la carte du hub', () => {
    const input = strength();
    const s = toNorynSession(input, null);
    expect(s?.kind).toBe('strength');
    expect(s?.intensity).toBeNull();
    expect(s?.estimated_minutes).toBe(estimateSessionMinutes(input.durationPlans));
    expect(s?.start_time).toBe('18:30');
  });

  it('heavy_lower au seuil de COLLIS-01 (8 séries de jambes dominantes), pas en dessous', () => {
    expect(toNorynSession(strength({ setsByMuscle: { legs: 8, back: 3 } }), null)?.tags).toEqual(['heavy_lower']);
    expect(toNorynSession(strength({ setsByMuscle: { legs: 7, back: 3 } }), null)?.tags).toEqual([]);
    expect(toNorynSession(strength({ setsByMuscle: { legs: 8, back: 8 } }), null)?.tags).toEqual([]);
  });

  it('les deux règles gardent leurs entrées : un exercice archivé compte pour heavy_lower, pas pour la durée', () => {
    // L'appelant passe des plans différents à chaque règle (spec §4.2) : ici, aucun plan pour la durée.
    const s = toNorynSession(strength({ durationPlans: [], setsByMuscle: { legs: 9 } }), null);
    expect(s?.estimated_minutes).toBeNull();
    expect(s?.tags).toEqual(['heavy_lower']);
  });

  it('n’émet jamais upper_body (D7)', () => {
    const s = toNorynSession(strength({ setsByMuscle: { chest: 12, shoulders: 6, arms: 6 } }), null);
    expect(s?.tags).toEqual([]);
  });
});

describe('toNorynSession — champs écartés ou normalisés', () => {
  it('heure sur deux chiffres ramenée à HH:MM, heure mal formée → null', () => {
    expect(toNorynSession(run({ scheduledTime: '07:05' }), 300)?.start_time).toBe('07:05');
    expect(toNorynSession(run({ scheduledTime: '7:00' }), 300)?.start_time).toBeNull();
    expect(toNorynSession(run({ scheduledTime: '25:00:00' }), 300)?.start_time).toBeNull();
    expect(toNorynSession(run({ scheduledTime: null }), 300)?.start_time).toBeNull();
  });

  it('identifiant en majuscules ramené en minuscules', () => {
    expect(toNorynSession(run({ id: ID.toUpperCase() }), 300)?.id).toBe(ID);
  });

  it('écarte une séance dont l’identifiant n’est pas un UUID', () => {
    expect(toNorynSession(run({ id: 'séance-jambes' }), 300)).toBeNull();
  });

  it('écarte un pilier, un statut ou une date inconnus', () => {
    expect(toNorynSession(run({ pillar: 'nutrition' }), 300)).toBeNull();
    expect(toNorynSession(run({ status: 'moved' }), 300)).toBeNull();
    expect(toNorynSession(run({ scheduledDate: '2026-02-30' }), 300)).toBeNull();
  });

  it('garde les statuts fait et sauté', () => {
    expect(toNorynSession(run({ status: 'done' }), 300)?.status).toBe('done');
    expect(toNorynSession(run({ status: 'skipped' }), 300)?.status).toBe('skipped');
  });
});

describe('buildNorynSessions — ordre et plafond', () => {
  const id = (n: number) => `5b0c2f9e-8d1a-4c3e-9f6b-2a7d1e0c4b${String(n).padStart(2, '0')}`;

  it('trie par jour, heure (sans heure en dernier), ordre de séance puis identifiant', () => {
    const out = buildNorynSessions(
      [
        run({ id: id(1), scheduledDate: '2026-10-09', scheduledTime: '06:00:00' }),
        run({ id: id(2), scheduledTime: null, orderIndex: 0 }),
        run({ id: id(3), scheduledTime: '18:00:00' }),
        run({ id: id(5), scheduledTime: '07:00:00', orderIndex: 2 }),
        run({ id: id(4), scheduledTime: '07:00:00', orderIndex: 2 }),
        run({ id: id(6), scheduledTime: '07:00:00', orderIndex: 1 }),
      ],
      300,
    );
    expect(out.map((s) => s.id)).toEqual([id(6), id(4), id(5), id(3), id(2), id(1)]);
  });

  it('garde au plus six séances par jour, les premières', () => {
    const seven = Array.from({ length: 7 }, (_, n) => run({ id: id(n), scheduledTime: `0${n}:00:00` }));
    const out = buildNorynSessions([...seven, run({ id: id(9), scheduledDate: '2026-10-09' })], 300);
    expect(out.filter((s) => s.date === '2026-10-08').map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5].map(id));
    expect(out.filter((s) => s.date === '2026-10-09')).toHaveLength(1);
  });

  it('une séance sans heure passe après une séance à l’heure, dans les deux sens de comparaison', () => {
    const late = run({ id: id(1), scheduledTime: null });
    const early = run({ id: id(2), scheduledTime: '06:00:00' });
    expect(buildNorynSessions([late, early], 300).map((s) => s.id)).toEqual([id(2), id(1)]);
    expect(buildNorynSessions([early, late], 300).map((s) => s.id)).toEqual([id(2), id(1)]);
  });

  it('retire les séances écartées', () => {
    expect(buildNorynSessions([run({ id: 'x' }), run()], 300)).toHaveLength(1);
  });
});
