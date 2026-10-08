import { describe, expect, it } from 'vitest';
import { norynDaySchema, norynWeekSchema, type NorynDay, type NorynWeek } from './contract';

/**
 * Exemples de référence : recopiés **tels quels** du contrat Noryn (`docs/08-WELLNESS-CONTRACT.md`,
 * « Concrete v1 contract (TASK-013) », branche `agent/claude/TASK-013`, lu le 08/10/2026).
 */
const DAY_EXAMPLE: NorynDay = {
  date: '2026-10-08',
  generated_at: '2026-10-08T12:00:00Z',
  synced_at: '2026-10-08T11:40:00Z',
  steps: { count: 6400, daily_target: 8000 },
  nutrition: {
    energy_kcal: 1450,
    energy_target_kcal: 2600,
    protein_g: 92,
    protein_target_g: 160,
  },
  hydration: { volume_ml: 1250, target_ml: 2000 },
  recovery: { sleep_minutes: 425, sleep_quality: 4, energy: 3, motivation: 4 },
  readiness: 'ok',
  intensity_on_hold: false,
  training: [
    {
      id: '5b0c2f9e-8d1a-4c3e-9f6b-2a7d1e0c4b85',
      date: '2026-10-08',
      start_time: '18:30',
      kind: 'strength',
      intensity: 'high',
      estimated_minutes: 55,
      status: 'planned',
      tags: ['heavy_lower'],
    },
  ],
};

const WEEK_EXAMPLE: NorynWeek = {
  start: '2026-10-05',
  generated_at: '2026-10-08T12:00:00Z',
  synced_at: '2026-10-08T11:40:00Z',
  steps: {
    daily_target: 8000,
    days: [
      { date: '2026-10-05', count: 9120 },
      { date: '2026-10-06', count: 7410 },
      { date: '2026-10-07', count: 10230 },
      { date: '2026-10-08', count: 6400 },
      { date: '2026-10-09', count: null },
      { date: '2026-10-10', count: null },
      { date: '2026-10-11', count: null },
    ],
  },
  sleep: { average_minutes: 412, nights: 4 },
  training: { sessions: [], done: { strength: 2, running: 1 } },
};

const session = DAY_EXAMPLE.training[0]!;
const day = (over: Partial<NorynDay>): unknown => ({ ...DAY_EXAMPLE, ...over });
const week = (over: Partial<NorynWeek>): unknown => ({ ...WEEK_EXAMPLE, ...over });
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('norynDaySchema — exemples du contrat', () => {
  it('accepte l’exemple de référence', () => {
    expect(ok(norynDaySchema, DAY_EXAMPLE)).toBe(true);
  });

  it('accepte des domaines non suivis (null) et un instant avec décalage', () => {
    expect(
      ok(norynDaySchema, day({ steps: null, nutrition: null, hydration: null, recovery: null, readiness: null })),
    ).toBe(true);
    expect(ok(norynDaySchema, day({ synced_at: '2026-10-08T13:40:00.123+02:00' }))).toBe(true);
  });
});

describe('norynDaySchema — refus', () => {
  it('refuse un champ en plus, à la racine comme dans un domaine', () => {
    expect(ok(norynDaySchema, { ...DAY_EXAMPLE, mood: 3 })).toBe(false);
    expect(ok(norynDaySchema, day({ recovery: { ...DAY_EXAMPLE.recovery!, stress: 2 } as never }))).toBe(false);
  });

  it('refuse un champ manquant', () => {
    const { readiness: _omitted, ...rest } = DAY_EXAMPLE;
    expect(ok(norynDaySchema, rest)).toBe(false);
  });

  it('refuse un flottant et une borne dépassée', () => {
    expect(ok(norynDaySchema, day({ steps: { count: 6400.5, daily_target: 8000 } }))).toBe(false);
    expect(ok(norynDaySchema, day({ steps: { count: 200_001, daily_target: 8000 } }))).toBe(false);
    expect(ok(norynDaySchema, day({ steps: { count: 10, daily_target: 999 } }))).toBe(false);
    expect(ok(norynDaySchema, day({ hydration: { volume_ml: 10, target_ml: 10_001 } }))).toBe(false);
    expect(
      ok(norynDaySchema, day({ recovery: { sleep_minutes: 841, sleep_quality: null, energy: null, motivation: null } })),
    ).toBe(false);
  });

  it('refuse des kcal sans protéines (nuls ensemble ou pas du tout)', () => {
    expect(ok(norynDaySchema, day({ nutrition: { ...DAY_EXAMPLE.nutrition!, protein_g: null } }))).toBe(false);
  });

  it('refuse un synced_at postérieur à generated_at', () => {
    expect(ok(norynDaySchema, day({ synced_at: '2026-10-08T12:00:01Z' }))).toBe(false);
  });

  it('refuse une date impossible et un instant sans décalage', () => {
    expect(ok(norynDaySchema, day({ date: '2026-02-29' }))).toBe(false);
    expect(ok(norynDaySchema, day({ generated_at: '2026-10-08T12:00:00' }))).toBe(false);
  });

  it('refuse un décalage sans deux-points, comme le zod 4 de Noryn', () => {
    expect(ok(norynDaySchema, day({ generated_at: '2026-10-08T14:00:00+0200' }))).toBe(false);
    expect(ok(norynDaySchema, day({ synced_at: '2026-10-08T13:40:00+0200' }))).toBe(false);
  });

  it('refuse une séance d’un autre jour, en double, ou plus de six', () => {
    expect(ok(norynDaySchema, day({ training: [{ ...session, date: '2026-10-09' }] }))).toBe(false);
    expect(ok(norynDaySchema, day({ training: [session, session] }))).toBe(false);
    const many = Array.from({ length: 7 }, (_, i) => ({ ...session, id: `5b0c2f9e-8d1a-4c3e-9f6b-2a7d1e0c4b8${i}` }));
    expect(ok(norynDaySchema, day({ training: many }))).toBe(false);
    expect(ok(norynDaySchema, day({ training: many.slice(0, 6) }))).toBe(true);
  });

  it('refuse un identifiant qui n’est pas un UUID canonique minuscule', () => {
    expect(ok(norynDaySchema, day({ training: [{ ...session, id: session.id.toUpperCase() }] }))).toBe(false);
    expect(ok(norynDaySchema, day({ training: [{ ...session, id: 'séance jambes' }] }))).toBe(false);
  });

  it('refuse une heure, une étiquette ou une durée hors contrat', () => {
    expect(ok(norynDaySchema, day({ training: [{ ...session, start_time: '7:00' }] }))).toBe(false);
    expect(ok(norynDaySchema, day({ training: [{ ...session, start_time: '24:00' }] }))).toBe(false);
    expect(ok(norynDaySchema, day({ training: [{ ...session, tags: ['heavy_lower', 'heavy_lower'] }] }))).toBe(false);
    expect(
      ok(norynDaySchema, day({ training: [{ ...session, tags: ['easy_run', 'long_run', 'intervals', 'race_effort', 'upper_body'] }] })),
    ).toBe(false);
    expect(ok(norynDaySchema, day({ training: [{ ...session, estimated_minutes: 0 }] }))).toBe(false);
    expect(ok(norynDaySchema, day({ training: [{ ...session, tags: ['legs' as never] }] }))).toBe(false);
  });

  it('jamais synchronisé : aucune valeur mesurée, aucune séance, pas de veille', () => {
    const neverSynced = day({
      synced_at: null,
      steps: { count: null, daily_target: 8000 },
      nutrition: { energy_kcal: null, energy_target_kcal: 2600, protein_g: null, protein_target_g: 160 },
      hydration: { volume_ml: null, target_ml: 2000 },
      recovery: { sleep_minutes: null, sleep_quality: null, energy: null, motivation: null },
      readiness: null,
      training: [],
    });
    expect(ok(norynDaySchema, neverSynced)).toBe(true);
    expect(ok(norynDaySchema, { ...(neverSynced as object), intensity_on_hold: true })).toBe(false);
    expect(ok(norynDaySchema, { ...(neverSynced as object), training: [session] })).toBe(false);
    expect(ok(norynDaySchema, { ...(neverSynced as object), readiness: 'ok' })).toBe(false);
    expect(
      ok(norynDaySchema, { ...(neverSynced as object), recovery: { ...DAY_EXAMPLE.recovery!, energy: null } }),
    ).toBe(false);
  });

  it('jamais synchronisé, domaines non suivis : accepté', () => {
    expect(
      ok(
        norynDaySchema,
        day({ synced_at: null, steps: null, nutrition: null, hydration: null, recovery: null, readiness: null, training: [] }),
      ),
    ).toBe(true);
  });
});

describe('norynWeekSchema', () => {
  it('accepte l’exemple de référence, et des domaines non suivis', () => {
    expect(ok(norynWeekSchema, WEEK_EXAMPLE)).toBe(true);
    expect(ok(norynWeekSchema, week({ steps: null, sleep: null }))).toBe(true);
  });

  it('refuse un début qui n’est pas un lundi', () => {
    expect(ok(norynWeekSchema, week({ start: '2026-10-06' }))).toBe(false);
  });

  it('refuse un début illisible sans lever (pas de calcul de dates sur une date invalide)', () => {
    expect(() => norynWeekSchema.safeParse(week({ start: 'x' }))).not.toThrow();
    expect(ok(norynWeekSchema, week({ start: 'x' }))).toBe(false);
  });

  it('refuse six jours, ou sept jours dans le désordre', () => {
    expect(
      ok(norynWeekSchema, week({ steps: { daily_target: 8000, days: WEEK_EXAMPLE.steps!.days.slice(0, 6) } })),
    ).toBe(false);
    const swapped = [...WEEK_EXAMPLE.steps!.days];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    expect(ok(norynWeekSchema, week({ steps: { daily_target: 8000, days: swapped } }))).toBe(false);
  });

  it('refuse des nuits sans moyenne, ou une moyenne sans nuit', () => {
    expect(ok(norynWeekSchema, week({ sleep: { average_minutes: null, nights: 2 } }))).toBe(false);
    expect(ok(norynWeekSchema, week({ sleep: { average_minutes: 400, nights: 0 } }))).toBe(false);
  });

  it('refuse une séance hors de la semaine ou plus de six le même jour', () => {
    const inWeek = { ...session, date: '2026-10-07' };
    expect(ok(norynWeekSchema, week({ training: { sessions: [inWeek], done: { strength: 0, running: 0 } } }))).toBe(
      true,
    );
    expect(
      ok(norynWeekSchema, week({ training: { sessions: [{ ...session, date: '2026-10-12' }], done: { strength: 0, running: 0 } } })),
    ).toBe(false);
    const sameDay = Array.from({ length: 7 }, (_, i) => ({ ...inWeek, id: `5b0c2f9e-8d1a-4c3e-9f6b-2a7d1e0c4b8${i}` }));
    expect(ok(norynWeekSchema, week({ training: { sessions: sameDay, done: { strength: 0, running: 0 } } }))).toBe(false);
  });

  it('refuse un compte de séances faites hors bornes', () => {
    expect(ok(norynWeekSchema, week({ training: { sessions: [], done: { strength: 51, running: 0 } } }))).toBe(false);
  });

  it('jamais synchronisé : aucun pas, aucune nuit, aucune séance, rien de fait', () => {
    const neverSynced = week({
      synced_at: null,
      steps: { daily_target: 8000, days: WEEK_EXAMPLE.steps!.days.map((d) => ({ ...d, count: null })) },
      sleep: { average_minutes: null, nights: 0 },
      training: { sessions: [], done: { strength: 0, running: 0 } },
    });
    expect(ok(norynWeekSchema, neverSynced)).toBe(true);
    expect(ok(norynWeekSchema, { ...(neverSynced as object), steps: WEEK_EXAMPLE.steps })).toBe(false);
    expect(ok(norynWeekSchema, { ...(neverSynced as object), sleep: WEEK_EXAMPLE.sleep })).toBe(false);
    expect(
      ok(norynWeekSchema, { ...(neverSynced as object), training: { sessions: [], done: { strength: 1, running: 0 } } }),
    ).toBe(false);
  });

  it('refuse un synced_at postérieur à generated_at', () => {
    expect(ok(norynWeekSchema, week({ synced_at: '2026-10-08T12:30:00Z' }))).toBe(false);
  });

  it('jamais synchronisé, domaines non suivis : accepté', () => {
    expect(
      ok(norynWeekSchema, week({ synced_at: null, steps: null, sleep: null, training: { sessions: [], done: { strength: 0, running: 0 } } })),
    ).toBe(true);
  });
});
