import { describe, expect, it } from 'vitest';

import {
  barChange,
  computePlates,
  DEFAULT_BAR_KG,
  loadableKg,
  loadedTotal,
  roundToLoadable,
  stepLoadable,
  stepLoadableKg,
} from './barbell';
import { kgToLb, lbToKg } from './units';

describe('disques par côté', () => {
  it('décompose 82,5 kg sur une barre de 20 en 25 + 5 + 1,25', () => {
    const load = computePlates({ total: 82.5, bar: DEFAULT_BAR_KG });
    expect(load.perSide).toEqual([25, 5, 1.25]);
    expect(load.remainder).toBe(0);
    expect(load.barOnly).toBe(false);
  });

  it('ne laisse AUCUN reste sur les charges usuelles — le piège des flottants', () => {
    // 31,25 − 25 − 5 − 1,25 vaut 3,55e-15 en arithmétique flottante : un reste fantôme s'afficherait.
    for (const total of [60, 62.5, 82.5, 100, 102.5, 137.5]) {
      expect(computePlates({ total, bar: 20 }).remainder).toBe(0);
    }
  });

  it('recompose exactement la charge demandée', () => {
    const load = computePlates({ total: 137.5, bar: 20 });
    expect(loadedTotal({ perSide: load.perSide, bar: 20 })).toBe(137.5);
  });

  it('signale la barre seule quand la charge ne la dépasse pas', () => {
    expect(computePlates({ total: 20, bar: 20 }).barOnly).toBe(true);
    expect(computePlates({ total: 15, bar: 20 }).barOnly).toBe(true);
    expect(computePlates({ total: null, bar: 20 }).barOnly).toBe(true);
  });

  it('sort un reste non chargeable au lieu de mentir', () => {
    // 21,5 kg : 0,75 kg par côté, impossible avec des disques de 1,25 minimum.
    const load = computePlates({ total: 21.5, bar: 20 });
    expect(load.perSide).toEqual([]);
    expect(load.remainder).toBeCloseTo(0.75, 5);
  });

  it('utilise les disques en livres quand l\'unité est lb', () => {
    const load = computePlates({ total: 135, bar: 45, unit: 'lb' });
    expect(load.perSide).toEqual([45]);
    expect(load.remainder).toBe(0);
  });

  it('empile plusieurs disques identiques avant de descendre de calibre', () => {
    expect(computePlates({ total: 220, bar: 20 }).perSide).toEqual([25, 25, 25, 25]);
  });
});

// ---------------------------------------------------------------------------
// Charges chargeables — MUSCU-FIX02, passe 2 (recette du 23/09/2026)
// ---------------------------------------------------------------------------
//
// La barre annonçait « 136,5 kg — dont 0,75 kg non chargeable » : la charge PROPOSÉE (plan,
// dernière fois, suggestion) ne tombait pas sur ce qu'on peut monter avec des disques de salle.
// Le plus petit disque courant pèse 1,25 kg, par paire : on charge par pas de 2,5 kg au-dessus de
// la barre (5 lb en livres).

describe('roundToLoadable', () => {
  it('ramène une charge proposée sur la plus proche charge chargeable', () => {
    expect(roundToLoadable({ total: 136.5, bar: 20 })).toBe(137.5);
    expect(roundToLoadable({ total: 136, bar: 20 })).toBe(135);
    expect(roundToLoadable({ total: 81, bar: 20 })).toBe(80);
  });

  it('laisse intacte une charge déjà chargeable', () => {
    expect(roundToLoadable({ total: 82.5, bar: 20 })).toBe(82.5);
    expect(roundToLoadable({ total: 100, bar: 20 })).toBe(100);
  });

  it('à mi-chemin, arrondit vers le bas : on ne propose pas plus lourd que prévu', () => {
    expect(roundToLoadable({ total: 81.25, bar: 20 })).toBe(80);
  });

  it('suit le poids de la barre réglé', () => {
    expect(roundToLoadable({ total: 41, bar: 15 })).toBe(40);
    expect(roundToLoadable({ total: 41, bar: 20 })).toBe(40);
    expect(roundToLoadable({ total: 43, bar: 15 })).toBe(42.5);
  });

  it('en livres : pas de 5 lb au-dessus d’une barre de 45 lb', () => {
    expect(roundToLoadable({ total: 137, bar: 45, unit: 'lb' })).toBe(135);
    expect(roundToLoadable({ total: 138, bar: 45, unit: 'lb' })).toBe(140);
  });

  it('ne touche pas une charge sous la barre ou nulle — il n’y a rien à charger', () => {
    expect(roundToLoadable({ total: 12, bar: 20 })).toBe(12);
    expect(roundToLoadable({ total: 20, bar: 20 })).toBe(20);
    expect(roundToLoadable({ total: 0, bar: 20 })).toBe(0);
  });

  it('toute charge arrondie se décompose sans reste', () => {
    for (let total = 20; total <= 300; total += 0.25) {
      const loadable = roundToLoadable({ total, bar: 20 });
      expect(computePlates({ total: loadable, bar: 20 }).remainder).toBe(0);
    }
  });
});

describe('stepLoadable', () => {
  it('monte ou descend d’un disque par paire depuis une charge chargeable', () => {
    expect(stepLoadable({ total: 82.5, bar: 20, direction: 1 })).toBe(85);
    expect(stepLoadable({ total: 82.5, bar: 20, direction: -1 })).toBe(80);
  });

  it('depuis une charge saisie non chargeable, va à la chargeable voisine — pas un pas plus loin', () => {
    expect(stepLoadable({ total: 136.5, bar: 20, direction: 1 })).toBe(137.5);
    expect(stepLoadable({ total: 136.5, bar: 20, direction: -1 })).toBe(135);
  });

  it('sous la barre, redescend par pas simples sans jamais passer sous zéro', () => {
    expect(stepLoadable({ total: 20, bar: 20, direction: -1 })).toBe(17.5);
    expect(stepLoadable({ total: 1, bar: 20, direction: -1 })).toBe(0);
    expect(stepLoadable({ total: 17.5, bar: 20, direction: 1 })).toBe(20);
  });

  it('en livres, par pas de 5 lb', () => {
    expect(stepLoadable({ total: 135, bar: 45, unit: 'lb', direction: 1 })).toBe(140);
  });
});

describe('loadableKg / stepLoadableKg (unité de stockage)', () => {
  it('en métrique, arrondit directement en kilos', () => {
    expect(loadableKg(136.5, { barKg: 20, imperial: false })).toBe(137.5);
    expect(stepLoadableKg(136.5, 1, { barKg: 20, imperial: false })).toBe(137.5);
  });

  it('en impérial, arrondit en livres sur une barre de 45 lb, puis revient en kilos', () => {
    // 60 kg = 132,3 lb → 130 lb chargeables (135 est à 2,7 lb, 130 à 2,3).
    expect(kgToLb(loadableKg(60, { barKg: 20, imperial: true }))).toBeCloseTo(130, 6);
    // 62 kg = 136,7 lb → 135 lb.
    expect(kgToLb(loadableKg(62, { barKg: 20, imperial: true }))).toBeCloseTo(135, 6);
    expect(kgToLb(stepLoadableKg(lbToKg(135), 1, { barKg: 20, imperial: true }))).toBeCloseTo(140, 6);
  });

  it('n’altère pas une charge déjà chargeable en livres (aucune dérive kg ↔ lb)', () => {
    const kg = lbToKg(135);
    expect(loadableKg(kg, { barKg: 20, imperial: true })).toBe(kg);
  });
});

// ---------------------------------------------------------------------------
// Ce qui change sur la barre — MUSCU-FIX02, passe 3
// ---------------------------------------------------------------------------

describe('barChange', () => {
  it('dit ce qu’il faut ajouter de chaque côté', () => {
    expect(barChange({ from: 135, to: 137.5 })).toEqual({ direction: 'add', perSide: 1.25 });
    expect(barChange({ from: 100, to: 120 })).toEqual({ direction: 'add', perSide: 10 });
  });

  it('dit ce qu’il faut retirer de chaque côté', () => {
    expect(barChange({ from: 140, to: 130 })).toEqual({ direction: 'remove', perSide: 5 });
  });

  it('même charge : rien à toucher', () => {
    expect(barChange({ from: 82.5, to: 82.5 })).toEqual({ direction: 'same', perSide: 0 });
  });

  it('calcule en centièmes — pas de 1,2499999', () => {
    expect(barChange({ from: 0.1 + 0.2, to: 2.8 }).perSide).toBe(1.25);
  });
});
