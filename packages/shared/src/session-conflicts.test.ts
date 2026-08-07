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
/** Le dimanche **précédent** — hors semaine affichée, mais dans la fenêtre de détection (D7). */
const EVE = '2026-08-09';
const MON = '2026-08-10';
const TUE = '2026-08-11';
const WED = '2026-08-12';
const THU = '2026-08-13';
const FRI = '2026-08-14';
const SAT = '2026-08-15';
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

  it('ne déclenche pas sur une course le premier jour de la semaine si sa veille est vide', () => {
    // ⚠️ Ce test disait l'inverse jusqu'au 07/08/2026 : « pas de veille ». Il **figeait un bug** —
    // le lundi avait bien une veille, elle était simplement hors de la fenêtre de lecture, et le
    // conflit « jambes dimanche → sortie longue lundi » était donc invisible (spec D7, §4.1 n° 1).
    // Réécrit plutôt que supprimé : un test retiré sans trace laisse croire que le cas n'a jamais
    // été couvert, un test réécrit dit qu'on a changé d'avis et pourquoi.
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

// ---------------------------------------------------------------------------
// La veille hors semaine (spec D7 — correctif du 07/08/2026)
// ---------------------------------------------------------------------------

/**
 * Le trou que ces tests ferment : la règle du §2 dit « le lendemain », mais la détection ne regardait
 * que la **semaine affichée**. Un dimanche de jambes suivi d'un lundi de qualité était donc
 * structurellement invisible — **une paire de jours sur sept**, et pas la plus rare : le dimanche est
 * un jour de muscu courant, le lundi un jour de qualité courant.
 *
 * Deux bornes, et c'est tout le correctif : la **détection** voit 8 jours (hier existe même hors
 * écran), le **repli** reste borné aux 7 jours affichés (proposer un jour invisible n'a pas de sens).
 */
describe('findSessionConflicts — la veille hors semaine (D7)', () => {
  it('détecte le conflit « jambes la veille → sortie longue lundi »', () => {
    const out = find([legs(EVE, 12), run(MON)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.strengthDayKey).toBe(EVE);
    expect(out[0]!.runDayKey).toBe(MON);
    expect(out[0]!.legSets).toBe(12);
  });

  it('applique le seuil à l’identique de l’autre côté de la frontière', () => {
    expect(find([legs(EVE, 5), run(MON)])).toEqual([]);
  });

  it('applique la dominance à l’identique — dos dominant la veille ne déclenche rien', () => {
    expect(find([legs(EVE, 12, { setsByMuscle: { legs: 12, back: 14 } }), run(MON)])).toEqual([]);
  });

  it('ne déclenche pas sur une course facile le lundi', () => {
    expect(find([legs(EVE, 12), run(MON, { runType: 'endurance' })])).toEqual([]);
  });

  it('ignore une séance de la veille sautée ou déjà faite', () => {
    expect(find([legs(EVE, 12, { status: 'skipped' }), run(MON)])).toEqual([]);
    expect(find([legs(EVE, 12, { status: 'done' }), run(MON)])).toEqual([]);
  });

  it('ne JUGE pas la veille : une course de qualité ce jour-là ne produit aucun conflit', () => {
    // La veille entre dans la fenêtre pour être **lue**, pas pour être jugée. Son propre conflit
    // appartient au bandeau de la semaine précédente (D5 : le bandeau vit sur le jour de la course).
    expect(find([legs('2026-08-08', 12), run(EVE)])).toEqual([]);
  });

  it('retient la plus lourde même quand une candidate est hors semaine', () => {
    // R5 ne change pas parce qu'une séance est de l'autre côté de la frontière.
    const out = find([legs(EVE, 15, { id: 'lourde' }), legs(EVE, 9, { id: 'legere' }), run(MON)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.strengthSessionId).toBe('lourde');
  });

  it('rend deux conflits quand la veille ET la semaine en portent chacun un', () => {
    const out = find([legs(EVE, 12), run(MON), legs(WED, 10), run(THU)]);
    expect(out.map((c) => c.runDayKey)).toEqual([MON, THU]);
  });

  it('propose un repli qui reste DANS la semaine affichée', () => {
    const out = find([legs(EVE, 12), run(MON)]);
    expect(out[0]!.suggestedDayKey).toBe(TUE);
  });

  it('🔴 n’offre JAMAIS le lundi en repli quand la veille porte des jambes lourdes', () => {
    // §4.1 n° 2 — le second bug, invisible en lecture de code, et le plus coûteux du dispositif.
    //
    // Le conflit est mardi → mercredi. Tout est bloqué après, donc le balayage revient en arrière :
    // mardi est écarté (il porte les jambes du conflit), et **lundi paraît libre**. Mais la veille du
    // lundi, c'est le dimanche des 14 séries : le proposer aurait **fabriqué le conflit qu'on
    // prétendait résoudre**, un jour plus tôt. Avant correctif, le moteur proposait lundi — la
    // vérification de la veille d'un candidat existait déjà, elle échouait sur le seul lundi.
    const out = find([
      legs(EVE, 14),
      legs(TUE, 12),
      run(WED),
      run(THU),
      run(FRI),
      run(SAT),
      run(SUN),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.runDayKey).toBe(WED);
    expect(out[0]!.suggestedDayKey).not.toBe(MON);
    expect(out[0]!.suggestedDayKey).toBeNull();
  });

  it('ne change rien quand la veille est vide — non-régression des 6 autres jours', () => {
    const out = find([legs(MON, 12), run(TUE)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.suggestedDayKey).toBe(WED);
  });
});
