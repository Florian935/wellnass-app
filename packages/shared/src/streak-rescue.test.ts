import { describe, expect, it } from 'vitest';
import { canFreezeToday, streakRescueOptions, walkMinutesFor } from './streak-rescue';

const TODAY = '2026-10-25';

describe('canFreezeToday — le joker sur aujourd’hui', () => {
  it('possible s’il reste un joker ce mois-ci', () => {
    expect(canFreezeToday({ jokerDays: [], todayKey: TODAY })).toBe(true);
  });

  it('impossible si le joker du mois est déjà pris', () => {
    expect(canFreezeToday({ jokerDays: ['2026-10-03'], todayKey: TODAY })).toBe(false);
  });

  it('🔴 impossible si HIER est déjà couvert par un joker — deux jokers d’affilée cassent la série', () => {
    // Règle 2 de STREAK-01 : le calcul s'arrête à deux jours joker consécutifs. Un joker posé ici
    // serait brûlé pour rien. (Hier = le mois d'avant, pour que le quota ne masque pas la règle.)
    expect(canFreezeToday({ jokerDays: ['2026-09-30'], todayKey: '2026-10-01' })).toBe(false);
  });

  it('impossible si aujourd’hui est déjà couvert', () => {
    expect(canFreezeToday({ jokerDays: [TODAY], todayKey: TODAY })).toBe(false);
  });
});

describe('walkMinutesFor — le temps de marche annoncé', () => {
  it('compte ~120 pas par minute, arrondi aux 5 minutes, jamais moins de 5', () => {
    expect(walkMinutesFor(1900)).toBe(20);
    expect(walkMinutesFor(1500)).toBe(15);
    expect(walkMinutesFor(200)).toBe(5);
  });
});

describe('streakRescueOptions — sauver la série par un vrai geste (constat 5)', () => {
  const base = { stepsTracked: true, steps: 6100, stepGoal: 8000, jokerDays: [], todayKey: TODAY };

  it('🔴 propose les trois sorties réelles, dans l’ordre : marcher, noter une activité, le joker', () => {
    // Avant : « Sauver ma série » ouvrait /planning, qui ne sauve rien.
    expect(streakRescueOptions(base)).toEqual([
      { kind: 'walk', stepsLeft: 1900, minutes: 20 },
      { kind: 'activity' },
      { kind: 'joker' },
    ]);
  });

  it('pas de marche proposée sans pas suivis (Health Connect absent) — on ne peut pas la valider', () => {
    expect(streakRescueOptions({ ...base, stepsTracked: false }).map((o) => o.kind)).toEqual([
      'activity',
      'joker',
    ]);
  });

  it('pas de marche si l’objectif de pas est déjà atteint (la série tient déjà par les pas)', () => {
    expect(streakRescueOptions({ ...base, steps: 8200 }).map((o) => o.kind)).not.toContain('walk');
  });

  it('pas de joker quand il n’est plus disponible', () => {
    expect(
      streakRescueOptions({ ...base, jokerDays: ['2026-10-02'] }).map((o) => o.kind),
    ).toEqual(['walk', 'activity']);
  });

  it('noter une activité reste toujours possible', () => {
    const none = streakRescueOptions({ ...base, stepsTracked: false, jokerDays: ['2026-10-02'] });
    expect(none).toEqual([{ kind: 'activity' }]);
  });
});
