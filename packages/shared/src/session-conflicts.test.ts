import { describe, expect, it } from 'vitest';

import {
  CONFLICTING_RUN_TYPES,
  LEG_SETS_CONFLICT_THRESHOLD,
  findSessionConflicts,
  isHeavyLegSession,
  type ScheduledSession,
} from './session-conflicts';

// Semaine du lundi 10 au dimanche 16 août 2026.
const WEEK_START = '2026-08-10';
const MON = '2026-08-10';
const TUE = '2026-08-11';
const WED = '2026-08-12';
const THU = '2026-08-13';
const SUN = '2026-08-16';
/** Avant la semaine : sert à prouver qu'un repli passé est refusé. */
const TODAY_BEFORE = '2026-08-01';

function legs(dayKey: string, sets: number, over: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    id: `strength-${dayKey}`,
    dayKey,
    pillar: 'strength',
    status: 'planned',
    runType: null,
    setsByMuscle: { legs: sets, chest: 2 },
    ...over,
  };
}

function run(dayKey: string, over: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    id: `run-${dayKey}`,
    dayKey,
    pillar: 'running',
    status: 'planned',
    runType: 'sortie_longue',
    setsByMuscle: null,
    ...over,
  };
}

const find = (sessions: ScheduledSession[], todayKey = TODAY_BEFORE) =>
  findSessionConflicts({ sessions, weekStartKey: WEEK_START, todayKey });

describe('constantes', () => {
  it('expose le seuil, nommé et calibrable', () => {
    expect(LEG_SETS_CONFLICT_THRESHOLD).toBe(8);
  });

  it('ne retient que les courses de qualité', () => {
    expect(CONFLICTING_RUN_TYPES).toEqual(['sortie_longue', 'fractionne']);
  });
});

describe('isHeavyLegSession', () => {
  it('rend false sans données de muscle (course, ou séance sans exercices)', () => {
    expect(isHeavyLegSession(null)).toBe(false);
    expect(isHeavyLegSession({})).toBe(false);
  });

  it('exige le seuil : 5 séries ne suffisent pas', () => {
    expect(isHeavyLegSession({ legs: 5 })).toBe(false);
  });

  it('accepte le seuil pile — borne inclusive', () => {
    expect(isHeavyLegSession({ legs: 8 })).toBe(true);
  });

  it('exige la dominance : 12 séries de jambes sous 14 de dos ne comptent pas', () => {
    expect(isHeavyLegSession({ legs: 12, back: 14 })).toBe(false);
  });

  it('refuse l’égalité — à parts égales, aucun groupe ne domine', () => {
    expect(isHeavyLegSession({ legs: 10, back: 10 })).toBe(false);
  });

  it('traite une valeur nulle comme non chiffrée, pas comme zéro fiable', () => {
    // Un exercice planifié sans nombre de séries ne rapproche pas du seuil.
    expect(isHeavyLegSession({ legs: null })).toBe(false);
    expect(isHeavyLegSession({ legs: 9, back: null })).toBe(true);
  });

  it('ignore un NaN comme une absence', () => {
    expect(isHeavyLegSession({ legs: Number.NaN })).toBe(false);
  });
});

describe('findSessionConflicts — détection', () => {
  it('rend [] sur une semaine vide', () => {
    expect(find([])).toEqual([]);
  });

  it('détecte le cas canonique : jambes lourdes lundi, sortie longue mardi', () => {
    const out = find([legs(MON, 12), run(TUE)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      runDayKey: TUE,
      strengthDayKey: MON,
      legSets: 12,
      runType: 'sortie_longue',
    });
  });

  it('détecte aussi devant un fractionné', () => {
    expect(find([legs(MON, 12), run(TUE, { runType: 'fractionne' })])).toHaveLength(1);
  });

  it('ignore une course d’endurance — elle est neutre, voire bénéfique', () => {
    expect(find([legs(MON, 12), run(TUE, { runType: 'endurance' })])).toEqual([]);
  });

  it('ignore une course de récupération', () => {
    expect(find([legs(MON, 12), run(TUE, { runType: 'recuperation' })])).toEqual([]);
  });

  it('ignore une course sans type — on ne devine pas', () => {
    expect(find([legs(MON, 12), run(TUE, { runType: null })])).toEqual([]);
  });

  it('ignore une course déjà réalisée — on ne commente pas le passé', () => {
    expect(find([legs(MON, 12), run(TUE, { status: 'done' })])).toEqual([]);
  });

  it('ignore une séance de muscu sautée — elle n’a fatigué personne', () => {
    expect(find([legs(MON, 12, { status: 'skipped' }), run(TUE)])).toEqual([]);
  });

  it('ignore une séance de muscu déjà réalisée', () => {
    expect(find([legs(MON, 12, { status: 'done' }), run(TUE)])).toEqual([]);
  });

  it('n’est pas un conflit si la course est le surlendemain', () => {
    expect(find([legs(MON, 12), run(WED)])).toEqual([]);
  });

  it('est à sens unique : une course la veille de jambes ne déclenche rien', () => {
    expect(find([run(MON), legs(TUE, 12)])).toEqual([]);
  });

  it('ignore une séance de jambes sous le seuil', () => {
    expect(find([legs(MON, 5), run(TUE)])).toEqual([]);
  });

  it('ne déclenche pas sur une course le premier jour de la semaine — pas de veille', () => {
    expect(find([run(MON)])).toEqual([]);
  });

  it('retient la séance la plus lourde quand deux précèdent la même course', () => {
    const out = find([
      legs(MON, 9, { id: 'legere' }),
      legs(MON, 15, { id: 'lourde' }),
      run(TUE),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.strengthSessionId).toBe('lourde');
    expect(out[0]!.legSets).toBe(15);
  });

  it('garde la plus lourde même quand elle est rencontrée en premier', () => {
    const out = find([
      legs(MON, 15, { id: 'lourde' }),
      legs(MON, 9, { id: 'legere' }),
      run(TUE),
    ]);
    expect(out[0]!.strengthSessionId).toBe('lourde');
  });

  it('rend deux conflits distincts dans la même semaine', () => {
    const out = find([legs(MON, 12), run(TUE), legs(WED, 10), run(THU)]);
    expect(out.map((c) => c.runDayKey)).toEqual([TUE, THU]);
  });
});

describe('findSessionConflicts — le repli', () => {
  it('propose le premier jour libre après le conflit', () => {
    const out = find([legs(MON, 12), run(TUE)]);
    expect(out[0]!.suggestedDayKey).toBe(WED);
  });

  it('cherche avant quand il n’y a plus rien après', () => {
    // Course dimanche, jambes samedi : le seul jour libre est en amont.
    const out = find([
      legs('2026-08-15', 12),
      run(SUN),
      run(MON),
      run(WED),
      run(THU),
      run('2026-08-14'),
    ]);
    expect(out[0]!.suggestedDayKey).toBe(TUE);
  });

  it('rend null quand la semaine est pleine', () => {
    const sessions = [
      legs(MON, 12),
      ...['2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'].map(
        (d) => run(d),
      ),
    ];
    expect(find(sessions)[0]!.suggestedDayKey).toBeNull();
  });

  it('écarte un jour qui recréerait le conflit — on ne déplace pas le problème', () => {
    // Mercredi est libre de course, mais mardi porte une grosse séance de jambes.
    const out = find([legs(MON, 12), run(TUE), legs(TUE, 14)]);
    expect(out[0]!.suggestedDayKey).not.toBe(WED);
    expect(out[0]!.suggestedDayKey).toBe(THU);
  });

  it('n’avance jamais une course dans le passé — elle naîtrait « manquée »', () => {
    // Aujourd'hui = jeudi : mercredi est libre mais déjà passé, donc refusé.
    const out = find([legs(MON, 12), run(TUE)], THU);
    expect(out[0]!.suggestedDayKey).toBe(THU);
  });

  it('rend null si tous les jours restants sont passés', () => {
    const out = find([legs(MON, 12), run(TUE)], '2026-08-20');
    expect(out[0]!.suggestedDayKey).toBeNull();
  });

  it('informe même sans repli — le conflit reste signalé', () => {
    const out = find([legs(MON, 12), run(TUE)], '2026-08-20');
    expect(out).toHaveLength(1);
    expect(out[0]!.legSets).toBe(12);
  });
});
