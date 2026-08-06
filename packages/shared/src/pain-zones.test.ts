import { describe, expect, it } from 'vitest';

import { FINE_MUSCLES } from './exercise';
import {
  PAIN_FRESHNESS_DAYS,
  PAIN_JOINT_ZONES,
  PAIN_LEVELS,
  PAIN_MUSCLE_ZONES,
  PAIN_ZONES,
  SIGNALLING_LEVELS,
  dominantFineMuscles,
  freshPainReports,
  isPainMuscleZone,
  latestByZone,
  painZoneToMuscle,
  pickSessionPainSignal,
  type PainLevel,
  type PainReport,
  type PainZone,
} from './pain-zones';

const TODAY = '2026-08-20';

/** Une déclaration, datée par décalage en jours dans le passé. */
function report(zone: PainZone, level: PainLevel, daysAgo = 0, id = `${zone}-${daysAgo}`): PainReport {
  const [y, m, d] = TODAY.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d!, 12) - daysAgo * 86_400_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    id,
    zone,
    level,
    logDate: `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`,
  };
}

describe('vocabulaire', () => {
  it('déclare 18 zones, toutes distinctes', () => {
    expect(PAIN_ZONES).toHaveLength(18);
    expect(new Set(PAIN_ZONES).size).toBe(18);
  });

  it('sépare 10 muscles et 8 articulations', () => {
    expect(PAIN_MUSCLE_ZONES).toHaveLength(10);
    expect(PAIN_JOINT_ZONES).toHaveLength(8);
  });

  it('aligne EXACTEMENT les zones musculaires sur FINE_MUSCLES', () => {
    // C'est cet alignement qui rend la projection possible. Le vérifier plutôt que le supposer :
    // si MUSC-F1b ajoute un muscle fin un jour, ce test dira qu'il manque ici.
    expect([...PAIN_MUSCLE_ZONES].sort()).toEqual([...FINE_MUSCLES].sort());
  });

  it('n’a aucune articulation en commun avec les muscles', () => {
    const muscles = new Set<string>(PAIN_MUSCLE_ZONES);
    for (const joint of PAIN_JOINT_ZONES) expect(muscles.has(joint)).toBe(false);
  });

  it('garde `shoulders` et `shoulder_joint` distincts — ce sont deux choses', () => {
    expect(PAIN_ZONES).toContain('shoulders');
    expect(PAIN_ZONES).toContain('shoulder_joint');
  });

  it('ordonne les niveaux du plus léger au plus grave', () => {
    // L'ordre du tableau EST la comparaison de gravité : il n'y a pas de second endroit à tenir.
    expect(PAIN_LEVELS).toEqual(['discomfort', 'pain', 'blocking']);
  });

  it('exclut `discomfort` des niveaux qui signalent (D6)', () => {
    expect(SIGNALLING_LEVELS).toEqual(['pain', 'blocking']);
    expect(SIGNALLING_LEVELS).not.toContain('discomfort');
  });
});

describe('projection zone → muscle', () => {
  it('projette chaque zone musculaire sur elle-même', () => {
    for (const zone of PAIN_MUSCLE_ZONES) expect(painZoneToMuscle(zone)).toBe(zone);
  });

  it('🔴 ne projette AUCUNE articulation — et ce n’est pas un oubli', () => {
    // Le test qui protège l'asymétrie. Rien dans nos données ne relie un exercice à une
    // articulation : « corriger » ceci ferait produire à l'app des affirmations sans fondement.
    for (const joint of PAIN_JOINT_ZONES) expect(painZoneToMuscle(joint)).toBeNull();
  });

  it('isPainMuscleZone discrimine les deux familles', () => {
    expect(isPainMuscleZone('quadriceps')).toBe(true);
    expect(isPainMuscleZone('knee')).toBe(false);
    expect(isPainMuscleZone('shoulders')).toBe(true);
    expect(isPainMuscleZone('shoulder_joint')).toBe(false);
  });
});

describe('freshPainReports', () => {
  it('retient une déclaration du jour', () => {
    expect(freshPainReports([report('back', 'pain', 0)], TODAY)).toHaveLength(1);
  });

  it('retient une déclaration à J-7 — la borne est incluse', () => {
    expect(freshPainReports([report('back', 'pain', PAIN_FRESHNESS_DAYS)], TODAY)).toHaveLength(1);
  });

  it('écarte une déclaration à J-8', () => {
    expect(freshPainReports([report('back', 'pain', 8)], TODAY)).toHaveLength(0);
  });

  it('écarte `discomfort` quelle que soit sa fraîcheur (D6)', () => {
    expect(freshPainReports([report('back', 'discomfort', 0)], TODAY)).toHaveLength(0);
  });

  it('retient `blocking` comme `pain`', () => {
    expect(freshPainReports([report('knee', 'blocking', 1)], TODAY)).toHaveLength(1);
  });

  it('conserve une déclaration datée dans le futur', () => {
    // Horloge d'un autre appareil en avance : l'écarter effacerait une donnée réelle.
    expect(freshPainReports([report('back', 'pain', -2)], TODAY)).toHaveLength(1);
  });
});

describe('pickSessionPainSignal', () => {
  const backSession = ['back', 'biceps'] as const;

  it('signale une zone musculaire sensible ciblée par la séance', () => {
    const signal = pickSessionPainSignal({
      reports: [report('back', 'pain', 2)],
      sessionMuscles: [...backSession],
      todayKey: TODAY,
    });
    expect(signal).toEqual({ zone: 'back', level: 'pain', daysAgo: 2 });
  });

  it('🔴 ne signale RIEN sur une articulation, même `blocking`, même séance correspondante', () => {
    // Le cas le plus contre-intuitif de l'US, et le plus important : on sait qu'un squat charge les
    // quadriceps, on ne sait pas qu'il charge le genou. L'app se tait plutôt que d'inventer.
    const signal = pickSessionPainSignal({
      reports: [report('knee', 'blocking', 0)],
      sessionMuscles: ['quadriceps', 'hamstrings', 'glutes'],
      todayKey: TODAY,
    });
    expect(signal).toBeNull();
  });

  it('ne signale rien si la séance ne cible pas la zone', () => {
    const signal = pickSessionPainSignal({
      reports: [report('calves', 'blocking', 1)],
      sessionMuscles: [...backSession],
      todayKey: TODAY,
    });
    expect(signal).toBeNull();
  });

  it('ne signale rien pour une gêne (D6)', () => {
    const signal = pickSessionPainSignal({
      reports: [report('back', 'discomfort', 0)],
      sessionMuscles: [...backSession],
      todayKey: TODAY,
    });
    expect(signal).toBeNull();
  });

  it('ne signale rien au-delà de la fraîcheur', () => {
    const signal = pickSessionPainSignal({
      reports: [report('back', 'pain', 8)],
      sessionMuscles: [...backSession],
      todayKey: TODAY,
    });
    expect(signal).toBeNull();
  });

  it('retient la zone LA PLUS GRAVE quand deux sont concernées', () => {
    const signal = pickSessionPainSignal({
      reports: [report('back', 'pain', 0), report('biceps', 'blocking', 3)],
      sessionMuscles: [...backSession],
      todayKey: TODAY,
    });
    expect(signal?.zone).toBe('biceps');
  });

  it('à gravité égale, retient la plus récemment déclarée', () => {
    const signal = pickSessionPainSignal({
      reports: [report('back', 'pain', 5), report('biceps', 'pain', 1)],
      sessionMuscles: [...backSession],
      todayKey: TODAY,
    });
    expect(signal?.zone).toBe('biceps');
    expect(signal?.daysAgo).toBe(1);
  });

  it('garde la plus grave même si elle est déclarée en PREMIER', () => {
    // Miroir du test précédent, ordre d'entrée inversé : le verdict ne doit pas dépendre de
    // l'ordre des lignes remontées par la base, qui n'est garanti par rien.
    const signal = pickSessionPainSignal({
      reports: [report('biceps', 'blocking', 3), report('back', 'pain', 0)],
      sessionMuscles: [...backSession],
      todayKey: TODAY,
    });
    expect(signal?.zone).toBe('biceps');
  });

  it('à gravité égale, ignore une déclaration PLUS ANCIENNE arrivée ensuite', () => {
    const signal = pickSessionPainSignal({
      reports: [report('biceps', 'pain', 1), report('back', 'pain', 5)],
      sessionMuscles: [...backSession],
      todayKey: TODAY,
    });
    expect(signal?.zone).toBe('biceps');
    expect(signal?.daysAgo).toBe(1);
  });

  it('n’expose jamais un `daysAgo` négatif', () => {
    // Une déclaration future est légitime en base ; « il y a −2 jours » ne l'est pas à l'écran.
    const signal = pickSessionPainSignal({
      reports: [report('back', 'pain', -2)],
      sessionMuscles: [...backSession],
      todayKey: TODAY,
    });
    expect(signal?.daysAgo).toBe(0);
  });

  it('rend null sans aucune déclaration', () => {
    expect(
      pickSessionPainSignal({ reports: [], sessionMuscles: [...backSession], todayKey: TODAY }),
    ).toBeNull();
  });

  it('rend null sur une séance sans muscle connu (séance libre)', () => {
    const signal = pickSessionPainSignal({
      reports: [report('back', 'blocking', 0)],
      sessionMuscles: [],
      todayKey: TODAY,
    });
    expect(signal).toBeNull();
  });
});

describe('dominantFineMuscles', () => {
  it('étend le groupe dominant vers ses muscles fins', () => {
    expect(dominantFineMuscles({ legs: 12, chest: 3 })).toEqual([
      'quadriceps',
      'hamstrings',
      'calves',
    ]);
  });

  it('rend un seul muscle pour un groupe qui n’en couvre qu’un', () => {
    expect(dominantFineMuscles({ chest: 10, arms: 4 })).toEqual(['chest']);
  });

  it('étend `arms` vers biceps ET triceps', () => {
    expect(dominantFineMuscles({ arms: 9 })).toEqual(['biceps', 'triceps']);
  });

  it('ne retient RIEN à égalité — un « majoritaire » ambigu ne justifie aucune affirmation', () => {
    expect(dominantFineMuscles({ legs: 8, chest: 8 })).toEqual([]);
  });

  it('ignore les groupes à 0, null ou absents', () => {
    expect(dominantFineMuscles({ legs: 6, chest: 0, back: null })).toEqual([
      'quadriceps',
      'hamstrings',
      'calves',
    ]);
  });

  it('rend un tableau vide sur une séance sans série chiffrée', () => {
    expect(dominantFineMuscles({})).toEqual([]);
    expect(dominantFineMuscles({ chest: 0 })).toEqual([]);
  });

  it('rend un tableau vide sur une course (setsByMuscle null)', () => {
    expect(dominantFineMuscles(null)).toEqual([]);
  });

  it('composé avec pickSessionPainSignal : une douleur au dos sur une séance dos signale', () => {
    const signal = pickSessionPainSignal({
      reports: [report('back', 'pain', 1)],
      // `arms` et non `biceps` : l'entrée est en **groupes larges** (les 6 de `MuscleGroup`),
      // c'est `dominantFineMuscles` qui étend ensuite vers les muscles fins.
      sessionMuscles: dominantFineMuscles({ back: 14, arms: 4 }),
      todayKey: TODAY,
    });
    expect(signal?.zone).toBe('back');
  });

  it('composé : un genou bloquant sur une séance de jambes ne signale toujours rien', () => {
    const signal = pickSessionPainSignal({
      reports: [report('knee', 'blocking', 0)],
      sessionMuscles: dominantFineMuscles({ legs: 16 }),
      todayKey: TODAY,
    });
    expect(signal).toBeNull();
  });
});

describe('latestByZone', () => {
  it('ne garde qu’une ligne par zone, la plus récente', () => {
    const rows = latestByZone([
      report('back', 'blocking', 5, 'a'),
      report('back', 'discomfort', 1, 'b'),
      report('knee', 'pain', 3, 'c'),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.zone === 'back')?.level).toBe('discomfort');
  });

  it('rend la DERNIÈRE déclaration, pas une moyenne', () => {
    // Passer de bloquant à gêne est une information ; sa moyenne n'en est pas une.
    const rows = latestByZone([
      report('shoulder_joint', 'blocking', 4, 'a'),
      report('shoulder_joint', 'discomfort', 0, 'b'),
    ]);
    expect(rows[0]?.level).toBe('discomfort');
  });

  it('trie de la plus récente à la plus ancienne', () => {
    const rows = latestByZone([report('back', 'pain', 6, 'a'), report('knee', 'pain', 1, 'b')]);
    expect(rows.map((r) => r.zone)).toEqual(['knee', 'back']);
  });

  it('garde les niveaux non signalants — l’historique n’est pas filtré', () => {
    // `freshPainReports` filtre pour le SIGNAL ; l'historique, lui, montre tout ce qui a été déclaré.
    const rows = latestByZone([report('calves', 'discomfort', 2)]);
    expect(rows).toHaveLength(1);
  });

  it('rend un tableau vide sans déclaration', () => {
    expect(latestByZone([])).toEqual([]);
  });
});
