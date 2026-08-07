import { describe, expect, it } from 'vitest';

import { computeSetTypeMix } from './set-type-mix';

/** N séries validées d'un type donné. */
function sets(setType: string, count: number, done = true) {
  return Array.from({ length: count }, () => ({ setType, done }));
}

const compute = (s: { setType: string; done: boolean }[]) => computeSetTypeMix({ sets: s });

describe('computeSetTypeMix', () => {
  it('rend null sans aucune série', () => {
    expect(compute([])).toBeNull();
  });

  it('rend null quand aucune série n’est validée — jamais une barre vide', () => {
    expect(compute(sets('normal', 5, false))).toBeNull();
  });

  it('répartit en parts entières', () => {
    const out = compute([...sets('normal', 3), ...sets('warmup', 1)]);
    expect(out).toEqual([
      { setType: 'normal', count: 3, percent: 75 },
      { setType: 'warmup', count: 1, percent: 25 },
    ]);
  });

  it('ignore les séries non validées (R5)', () => {
    const out = compute([...sets('normal', 3), ...sets('warmup', 10, false)]);
    expect(out).toEqual([{ setType: 'normal', count: 3, percent: 100 }]);
  });

  it('🔴 les parts somment TOUJOURS à 100, malgré les arrondis', () => {
    // Trois tiers arrondis à l'entier donnent 33+33+33 = 99. Une barre qui n'atteint pas son bord
    // fait douter de tout l'écran.
    const out = compute([...sets('a', 1), ...sets('b', 1), ...sets('c', 1)]);
    expect(out!.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it('somme à 100 sur un cas à sept parts inégales', () => {
    const out = compute([
      ...sets('a', 7),
      ...sets('b', 5),
      ...sets('c', 3),
      ...sets('d', 3),
      ...sets('e', 2),
      ...sets('f', 1),
      ...sets('g', 1),
    ]);
    expect(out!.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it('fait porter le reliquat d’arrondi à la part la plus grosse', () => {
    const out = compute([...sets('gros', 1), ...sets('b', 1), ...sets('c', 1)]);
    expect(out![0]!.percent).toBe(34);
    expect(out![1]!.percent).toBe(33);
    expect(out![2]!.percent).toBe(33);
  });

  it('trie de la part la plus fréquente à la plus rare', () => {
    const out = compute([...sets('rare', 1), ...sets('frequent', 8), ...sets('moyen', 3)]);
    expect(out!.map((s) => s.setType)).toEqual(['frequent', 'moyen', 'rare']);
  });

  it('départage deux parts égales par ordre alphabétique — sortie déterministe', () => {
    const out = compute([...sets('zebre', 2), ...sets('alpha', 2)]);
    expect(out!.map((s) => s.setType)).toEqual(['alpha', 'zebre']);
  });

  it('conserve un type inconnu plutôt que de le perdre', () => {
    // Une valeur ajoutée en base après ce code ne doit pas s'évaporer : le total tomberait sous
    // 100 sans que personne comprenne pourquoi.
    const out = compute([...sets('normal', 2), ...sets('type_futur', 2)]);
    expect(out!.map((s) => s.setType)).toContain('type_futur');
    expect(out!.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it('rend 100 % sur un type unique', () => {
    expect(compute(sets('normal', 4))).toEqual([{ setType: 'normal', count: 4, percent: 100 }]);
  });
});
