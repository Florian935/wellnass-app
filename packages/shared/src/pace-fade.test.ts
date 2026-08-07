import { describe, expect, it } from 'vitest';

import { FADE_MIN_DISTANCE_KM, computePaceFade } from './pace-fade';
import type { KmSplit } from './running';

const splitsOf = (...seconds: number[]): KmSplit[] =>
  seconds.map((s, i) => ({ km: i + 1, seconds: s }));

/** N kilomètres à allure constante. */
const flat = (n: number, seconds = 300) => splitsOf(...Array.from({ length: n }, () => seconds));

describe('constantes', () => {
  it('expose le seul nombre inventé du lot, nommé et calibrable', () => {
    expect(FADE_MIN_DISTANCE_KM).toBe(10);
  });
});

describe('computePaceFade — le seuil de distance (D2)', () => {
  it('rend null sans split', () => {
    expect(computePaceFade([])).toBeNull();
  });

  it('rend null sous le seuil — la dérive ne veut rien dire sur 5 km', () => {
    expect(computePaceFade(flat(9))).toBeNull();
  });

  it('calcule au seuil pile — borne inclusive', () => {
    const out = computePaceFade(flat(FADE_MIN_DISTANCE_KM));
    expect(out).not.toBeNull();
    expect(out!.kmPerQuarter).toBe(2);
  });
});

describe('computePaceFade — la dégradation', () => {
  it('rend un fade ≈ 0 à allure constante', () => {
    expect(computePaceFade(flat(12))!.fadePct).toBeCloseTo(0, 5);
  });

  it('rend un fade positif quand la fin est plus lente', () => {
    // 12 km : quarts de 3. Premier quart à 300, dernier à 330 → +10 %.
    const out = computePaceFade(
      splitsOf(300, 300, 300, 300, 300, 300, 300, 300, 300, 330, 330, 330),
    )!;
    expect(out.fadePct).toBeCloseTo(10, 5);
    expect(out.firstQuarterPaceSPerKm).toBe(300);
    expect(out.lastQuarterPaceSPerKm).toBe(330);
  });

  it('🔴 rend un fade NÉGATIF quand la fin est plus rapide — jamais plafonné à 0', () => {
    // Accélérer sur la fin est une information (bonne gestion d'effort), pas une anomalie à écrêter.
    const out = computePaceFade(
      splitsOf(300, 300, 300, 300, 300, 300, 300, 300, 300, 270, 270, 270),
    )!;
    expect(out.fadePct).toBeCloseTo(-10, 5);
    expect(out.fadePct).toBeLessThan(0);
  });

  it('rend le nombre de km par quart — le chiffre doit être vérifiable (R2)', () => {
    expect(computePaceFade(flat(20))!.kmPerQuarter).toBe(5);
    expect(computePaceFade(flat(14))!.kmPerQuarter).toBe(3);
  });
});

describe('computePaceFade — 🔴 pourquoi des quarts et pas le 1ᵉʳ km contre le dernier (R6)', () => {
  it('un seul km très lent AU MILIEU n’affecte pas le fade', () => {
    // Le feu rouge du 6ᵉ kilomètre. Avec une comparaison km-à-km il serait invisible ; avec une
    // moyenne globale il fausserait tout. Ici il tombe dans le milieu ignoré, donc fade = 0.
    const out = computePaceFade(
      splitsOf(300, 300, 300, 300, 300, 600, 300, 300, 300, 300, 300, 300),
    )!;
    expect(out.fadePct).toBeCloseTo(0, 5);
  });

  it('un seul km lent DANS le dernier quart est lissé par ses voisins', () => {
    // 12 km, dernier quart = 3 km : un km à 360 parmi deux à 300 donne +6,7 %, pas +20 %.
    const out = computePaceFade(
      splitsOf(300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 360),
    )!;
    expect(out.fadePct).toBeCloseTo(6.666, 2);
  });

  it('ignore volontairement le milieu — c’est l’intention de R6', () => {
    // Les 4 km du centre sont remplacés par des valeurs absurdes-mais-valides : le résultat ne
    // bouge pas d'un iota.
    const withMiddle = computePaceFade(
      splitsOf(300, 300, 300, 900, 900, 900, 900, 900, 300, 330, 330, 330),
    )!;
    const withoutMiddle = computePaceFade(
      splitsOf(300, 300, 300, 400, 400, 400, 400, 400, 400, 330, 330, 330),
    )!;
    expect(withMiddle.fadePct).toBeCloseTo(withoutMiddle.fadePct, 5);
  });
});

describe('computePaceFade — données impossibles', () => {
  it('rend null si un split du premier quart est inexploitable', () => {
    const s = flat(12);
    s[0] = { km: 1, seconds: 0 };
    expect(computePaceFade(s)).toBeNull();
  });

  it('rend null si un split du dernier quart est inexploitable', () => {
    const s = flat(12);
    s[11] = { km: 12, seconds: Number.NaN };
    expect(computePaceFade(s)).toBeNull();
  });

  it('tolère un split absurde AU MILIEU — il n’entre pas dans le calcul', () => {
    // Cohérent avec R6 : le milieu est ignoré, donc une valeur impossible qui s'y trouve ne doit pas
    // faire échouer une analyse qui ne la regarde pas.
    const s = flat(12);
    s[5] = { km: 6, seconds: 0 };
    expect(computePaceFade(s)).not.toBeNull();
  });

  it('ne rend jamais un fadePct non fini', () => {
    expect(Number.isFinite(computePaceFade(flat(16))!.fadePct)).toBe(true);
  });
});
