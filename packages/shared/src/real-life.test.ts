import { describe, expect, it } from 'vitest';

import { JOKER_MAX_AGE_DAYS } from './streak-joker';
import {
  REAL_LIFE_DURATIONS,
  REAL_LIFE_MAX_BACKDATE_DAYS,
  activeRealLifePeriod,
  isRealLifeDay,
  minimalWeekTargets,
  realLifeDayKeys,
  realLifeDaysInWeek,
  realLifeDaysRemaining,
  validateRealLifePeriod,
  type RealLifePeriod,
} from './real-life';

/** Période du lundi 3 au dimanche 9 août 2026, bornes incluses. */
const P: RealLifePeriod = { id: 'p1', startedOn: '2026-08-03', endsOn: '2026-08-09' };

function period(startedOn: string, endsOn: string, id = 'p'): RealLifePeriod {
  return { id, startedOn, endsOn };
}

const ALL_PILLARS = { strength: true, running: true, nutrition: true };

describe('constantes', () => {
  it('réutilise la borne du joker plutôt que de redéclarer un 7', () => {
    // Le test porte sur l'identité, pas sur la valeur : si STREAK-01 ajuste sa borne, celle-ci suit.
    expect(REAL_LIFE_MAX_BACKDATE_DAYS).toBe(JOKER_MAX_AGE_DAYS);
  });

  it('propose 3, 7 et 14 jours', () => {
    expect(REAL_LIFE_DURATIONS).toEqual([3, 7, 14]);
  });
});

describe('isRealLifeDay', () => {
  it('couvre les deux bornes, incluses', () => {
    expect(isRealLifeDay([P], '2026-08-03')).toBe(true);
    expect(isRealLifeDay([P], '2026-08-09')).toBe(true);
  });

  it('exclut la veille et le lendemain', () => {
    expect(isRealLifeDay([P], '2026-08-02')).toBe(false);
    expect(isRealLifeDay([P], '2026-08-10')).toBe(false);
  });

  it('rend false sans aucune période', () => {
    expect(isRealLifeDay([], '2026-08-05')).toBe(false);
  });
});

describe('realLifeDayKeys', () => {
  it('énumère les 7 jours d’une période d’une semaine', () => {
    const days = realLifeDayKeys([P]);
    expect(days.size).toBe(7);
    expect([...days].sort()).toEqual([
      '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06',
      '2026-08-07', '2026-08-08', '2026-08-09',
    ]);
  });

  it('rend un seul jour pour une période d’un jour', () => {
    expect(realLifeDayKeys([period('2026-08-05', '2026-08-05')]).size).toBe(1);
  });

  it('prend l’UNION de deux périodes qui se chevauchent, sans compter deux fois', () => {
    // Cas normal, pas une erreur : deux appareils hors réseau peuvent déclarer la même semaine, et la
    // base l'autorise volontairement (une contrainte violée bloquerait la file d'upload PowerSync).
    const days = realLifeDayKeys([
      period('2026-08-03', '2026-08-05', 'a'),
      period('2026-08-04', '2026-08-07', 'b'),
    ]);
    expect(days.size).toBe(5); // 03 → 07
  });

  it('traverse un changement de mois', () => {
    expect(realLifeDayKeys([period('2026-07-30', '2026-08-02')]).size).toBe(4);
  });

  it('traverse une transition d’heure d’été sans perdre ni dupliquer un jour', () => {
    // Dernier dimanche d'octobre 2026 : passage à l'heure d'hiver en France dans la nuit du 24 au 25.
    expect(realLifeDayKeys([period('2026-10-23', '2026-10-27')]).size).toBe(5);
  });

  it('ne produit aucun jour — et ne boucle pas — sur une période inversée', () => {
    expect(realLifeDayKeys([period('2026-08-09', '2026-08-03')]).size).toBe(0);
  });
});

describe('activeRealLifePeriod', () => {
  it('trouve la période qui couvre aujourd’hui', () => {
    expect(activeRealLifePeriod([P], '2026-08-05')?.id).toBe('p1');
  });

  it('rend null hors de toute période', () => {
    expect(activeRealLifePeriod([P], '2026-08-15')).toBeNull();
  });

  it('retient celle qui a commencé le plus tard quand deux se recouvrent', () => {
    const active = activeRealLifePeriod(
      [period('2026-08-01', '2026-08-10', 'ancienne'), period('2026-08-04', '2026-08-06', 'recente')],
      '2026-08-05',
    );
    expect(active?.id).toBe('recente');
  });

  it('à début égal, retient celle qui finit le plus tard', () => {
    const active = activeRealLifePeriod(
      [period('2026-08-04', '2026-08-06', 'courte'), period('2026-08-04', '2026-08-12', 'longue')],
      '2026-08-05',
    );
    expect(active?.id).toBe('longue');
  });
});

describe('realLifeDaysRemaining', () => {
  it('rend 0 le DERNIER jour de la période, pas 1', () => {
    expect(realLifeDaysRemaining(P, '2026-08-09')).toBe(0);
  });

  it('rend 6 le premier jour d’une période de 7 jours', () => {
    expect(realLifeDaysRemaining(P, '2026-08-03')).toBe(6);
  });

  it('ne rend jamais un négatif sur une période échue', () => {
    expect(realLifeDaysRemaining(P, '2026-08-20')).toBe(0);
  });
});

describe('realLifeDaysInWeek', () => {
  // Semaines calendaires : lundi 3 → dimanche 9, puis lundi 10 → dimanche 16 août 2026.
  it('compte les jours d’une période entièrement dans la semaine', () => {
    expect(realLifeDaysInWeek([P], '2026-08-03', '2026-08-09')).toBe(7);
  });

  it('découpe une période à cheval : chaque semaine reçoit SON décompte', () => {
    const straddling = [period('2026-08-07', '2026-08-12')]; // ven → mer
    expect(realLifeDaysInWeek(straddling, '2026-08-03', '2026-08-09')).toBe(3); // ven, sam, dim
    expect(realLifeDaysInWeek(straddling, '2026-08-10', '2026-08-16')).toBe(3); // lun, mar, mer
  });

  it('ne compte pas deux fois un jour couvert par deux périodes', () => {
    const overlapping = [
      period('2026-08-03', '2026-08-05', 'a'),
      period('2026-08-04', '2026-08-06', 'b'),
    ];
    expect(realLifeDaysInWeek(overlapping, '2026-08-03', '2026-08-09')).toBe(4);
  });

  it('rend 0 sur une semaine sans aucune période', () => {
    expect(realLifeDaysInWeek([P], '2026-08-17', '2026-08-23')).toBe(0);
  });
});

describe('minimalWeekTargets', () => {
  it('demande la moitié du plan habituel', () => {
    const t = minimalWeekTargets({
      activePillars: ALL_PILLARS, habitualStrengthSessions: 4, proteinTargetG: 130,
    });
    expect(t.strengthSessions).toBe(2);
  });

  it('plancher à 1 : un plan à 2 séances donne 1, pas 2', () => {
    // Le cas qui justifie le plancher ET la division : une cible dégradée égale à la cible normale ne
    // dégraderait rien du tout.
    const t = minimalWeekTargets({
      activePillars: ALL_PILLARS, habitualStrengthSessions: 2, proteinTargetG: 130,
    });
    expect(t.strengthSessions).toBe(1);
  });

  it('plancher à 1 même sans aucune séance planifiée', () => {
    // 0 se lirait « ne fais rien » ; le message est « fais peu ».
    const t = minimalWeekTargets({
      activePillars: ALL_PILLARS, habitualStrengthSessions: 0, proteinTargetG: 130,
    });
    expect(t.strengthSessions).toBe(1);
  });

  it('plancher à 1 sur un plan à 1 séance', () => {
    const t = minimalWeekTargets({
      activePillars: ALL_PILLARS, habitualStrengthSessions: 1, proteinTargetG: 130,
    });
    expect(t.strengthSessions).toBe(1);
  });

  it('demande 1 sortie, sans cible d’allure ni de distance', () => {
    const t = minimalWeekTargets({
      activePillars: ALL_PILLARS, habitualStrengthSessions: 4, proteinTargetG: 130,
    });
    expect(t.runs).toBe(1);
  });

  it('conserve la cible protéines telle quelle', () => {
    const t = minimalWeekTargets({
      activePillars: ALL_PILLARS, habitualStrengthSessions: 4, proteinTargetG: 145,
    });
    expect(t.proteinG).toBe(145);
  });

  it('rend null — et non 0 — sur un pilier inactif', () => {
    const t = minimalWeekTargets({
      activePillars: { strength: false, running: false, nutrition: true },
      habitualStrengthSessions: 4,
      proteinTargetG: 130,
    });
    expect(t.strengthSessions).toBeNull();
    expect(t.runs).toBeNull();
    expect(t.proteinG).toBe(130);
  });

  it('rend null sur la nutrition quand la cible protéines n’est pas calculable', () => {
    // Profil incomplet : le mode n'invente pas un chiffre.
    const t = minimalWeekTargets({
      activePillars: ALL_PILLARS, habitualStrengthSessions: 4, proteinTargetG: null,
    });
    expect(t.proteinG).toBeNull();
  });

  it('ne se laisse pas déstabiliser par un plan négatif', () => {
    const t = minimalWeekTargets({
      activePillars: ALL_PILLARS, habitualStrengthSessions: -3, proteinTargetG: 130,
    });
    expect(t.strengthSessions).toBe(1);
  });
});

describe('validateRealLifePeriod', () => {
  const todayKey = '2026-08-10';

  it('accepte une période qui commence aujourd’hui', () => {
    expect(validateRealLifePeriod({
      startedOn: todayKey, endsOn: '2026-08-16', todayKey,
    })).toBeNull();
  });

  it('accepte une période d’un seul jour', () => {
    expect(validateRealLifePeriod({
      startedOn: todayKey, endsOn: todayKey, todayKey,
    })).toBeNull();
  });

  it('refuse une fin antérieure au début', () => {
    expect(validateRealLifePeriod({
      startedOn: '2026-08-10', endsOn: '2026-08-09', todayKey,
    })).toBe('ends_before_start');
  });

  it('accepte une rétro-déclaration à J-7 (la borne, incluse)', () => {
    expect(validateRealLifePeriod({
      startedOn: '2026-08-03', endsOn: '2026-08-12', todayKey,
    })).toBeNull();
  });

  it('refuse une rétro-déclaration à J-8', () => {
    expect(validateRealLifePeriod({
      startedOn: '2026-08-02', endsOn: '2026-08-12', todayKey,
    })).toBe('backdated_too_far');
  });

  it('accepte une période qui commence dans le futur', () => {
    // Des vacances déjà posées. Sans danger : tous les effets sont dérivés de la fenêtre, donc la
    // période n'agit pas avant d'avoir commencé.
    expect(validateRealLifePeriod({
      startedOn: '2026-09-01', endsOn: '2026-09-14', todayKey,
    })).toBeNull();
  });

  it('signale la fin invalide AVANT la rétro-déclaration quand les deux sont fausses', () => {
    // Ordre volontaire : « ta date de fin est avant ta date de début » est actionnable, « c'est trop
    // ancien » ne l'est pas encore.
    expect(validateRealLifePeriod({
      startedOn: '2026-07-01', endsOn: '2026-06-01', todayKey,
    })).toBe('ends_before_start');
  });
});
