import { describe, expect, it } from 'vitest';
import { assignSessionDays, spreadSessionsOverWeek } from './strength-planning';

/** Écart minimal entre deux jours consécutifs d'une répartition. */
function minGap(days: number[]): number {
  if (days.length < 2) return Number.POSITIVE_INFINITY;
  return Math.min(...days.slice(1).map((d, i) => d - (days[i] as number)));
}

describe('spreadSessionsOverWeek', () => {
  it('place les répartitions attendues de 1 à 7 séances', () => {
    // Ce sont les répartitions que proposent les programmes du commerce — le test les fige.
    expect(spreadSessionsOverWeek(1)).toEqual([0]); // L
    expect(spreadSessionsOverWeek(2)).toEqual([0, 3]); // L J
    expect(spreadSessionsOverWeek(3)).toEqual([0, 2, 4]); // L M V
    expect(spreadSessionsOverWeek(4)).toEqual([0, 1, 3, 4]); // L M J V
    expect(spreadSessionsOverWeek(5)).toEqual([0, 1, 2, 3, 4]); // L M M J V
    expect(spreadSessionsOverWeek(6)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(spreadSessionsOverWeek(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('ne place jamais deux séances le même jour', () => {
    for (let n = 1; n <= 7; n += 1) {
      const days = spreadSessionsOverWeek(n);
      expect(new Set(days).size).toBe(days.length);
    }
  });

  it('reste dans la semaine et croît strictement', () => {
    for (let n = 1; n <= 7; n += 1) {
      const days = spreadSessionsOverWeek(n);
      expect(days.every((d) => d >= 0 && d <= 6)).toBe(true);
      expect([...days].sort((a, b) => a - b)).toEqual(days);
    }
  });

  it('espace les semaines légères, là où c’est possible', () => {
    // Tout l'intérêt de la fonction sur 2 et 3 séances — un placement naïf 0,1,2 échouerait ici.
    expect(minGap(spreadSessionsOverWeek(2))).toBeGreaterThanOrEqual(3);
    expect(minGap(spreadSessionsOverWeek(3))).toBeGreaterThanOrEqual(2);
  });

  it('laisse le dimanche libre en dessous de 7 séances', () => {
    // Convention de coach, pas contrainte mathématique : c'est ce que font les programmes réels.
    for (let n = 1; n <= 6; n += 1) {
      expect(spreadSessionsOverWeek(n)).not.toContain(6);
    }
  });

  it('coupe le mercredi sur un 4 jours', () => {
    expect(spreadSessionsOverWeek(4)).not.toContain(2);
  });

  it('plafonne à 7 jours au-delà de 7 séances', () => {
    expect(spreadSessionsOverWeek(9)).toHaveLength(7);
    expect(spreadSessionsOverWeek(9)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('retourne un tableau vide pour 0, un négatif ou une valeur non finie', () => {
    expect(spreadSessionsOverWeek(0)).toEqual([]);
    expect(spreadSessionsOverWeek(-3)).toEqual([]);
    expect(spreadSessionsOverWeek(Number.NaN)).toEqual([]);
  });
});

describe('assignSessionDays', () => {
  it('affecte un jour à chaque séance, dans l’ordre donné', () => {
    expect(assignSessionDays(['a', 'b', 'c'])).toEqual({ a: 0, b: 2, c: 4 });
  });

  it('rend le formulaire immédiatement validable : aucune séance sans jour', () => {
    // Le défaut corrigé : `canPlan` restait faux tant qu'une séance n'avait pas son jour.
    const ids = ['s1', 's2', 's3', 's4'];
    const assignments = assignSessionDays(ids);
    expect(ids.every((id) => assignments[id] !== undefined)).toBe(true);
  });

  it('reprend au lundi au-delà de 7 séances plutôt que de laisser un trou', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `s${i}`);
    const assignments = assignSessionDays(ids);
    expect(ids.every((id) => assignments[id] !== undefined)).toBe(true);
    expect(assignments['s7']).toBe(0);
    expect(assignments['s8']).toBe(1);
  });

  it('accepte une liste vide', () => {
    expect(assignSessionDays([])).toEqual({});
  });
});
