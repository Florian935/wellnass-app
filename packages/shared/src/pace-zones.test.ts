import { describe, expect, it } from 'vitest';

import {
  HIGH_INTENSITY_ZONES,
  PACE_ZONES,
  isHighIntensity,
  paceZoneBounds,
  paceZoneOf,
} from './pace-zones';
import { VMA_COEFFICIENT, derivedVmaPace, sessionTargetPace } from './running-paces';

/** Allure de référence 5 km : 5:00/km. Choisie ronde pour que les bornes se lisent de tête. */
const REF = 300;
const VMA = REF * VMA_COEFFICIENT; // 285 s/km

describe('PACE_ZONES', () => {
  it('va de la plus rapide à la plus lente — l’ordre fait partie du contrat', () => {
    expect(PACE_ZONES).toEqual(['vma', 'seuil', 'tempo', 'endurance', 'recuperation']);
  });

  it('classe les 3 zones qualitatives en haute intensité', () => {
    expect(HIGH_INTENSITY_ZONES).toEqual(['vma', 'seuil', 'tempo']);
    expect(isHighIntensity('tempo')).toBe(true);
    expect(isHighIntensity('endurance')).toBe(false);
    expect(isHighIntensity('recuperation')).toBe(false);
  });
});

describe('paceZoneBounds — dérivées, jamais recopiées (D1)', () => {
  it('reprend exactement les bornes de sessionTargetPace', () => {
    const b = paceZoneBounds(REF);
    expect(b.vma).toBe(derivedVmaPace(REF));
    expect(b.seuil).toBe(sessionTargetPace('fractionne', REF)!.maxSPerKm);
    expect(b.tempo).toBe(sessionTargetPace('sortie_longue', REF)!.maxSPerKm);
    expect(b.endurance).toBe(sessionTargetPace('endurance', REF)!.maxSPerKm);
    expect(b.recuperation).toBe(Number.POSITIVE_INFINITY);
  });

  it('🔴 TOUTES les bornes suivent un changement de référence', () => {
    // Le test qui interdit de recopier `ref + 60` en littéral : ça marcherait aujourd'hui et
    // divergerait au premier ajustement de `sessionTargetPace`, sans que rien n'échoue.
    const slow = paceZoneBounds(360);
    const fast = paceZoneBounds(240);
    for (const zone of PACE_ZONES) {
      if (zone === 'recuperation') continue; // Infinity ne bouge pas, par construction
      expect(slow[zone]).toBeGreaterThan(fast[zone]);
    }
  });

  it('rend des bornes strictement croissantes — la partition est ordonnée', () => {
    const b = paceZoneBounds(REF);
    expect(b.vma).toBeLessThan(b.seuil);
    expect(b.seuil).toBeLessThan(b.tempo);
    expect(b.tempo).toBeLessThan(b.endurance);
    expect(b.endurance).toBeLessThan(b.recuperation);
  });
});

describe('paceZoneOf — ce qui n’est pas classable rend null (R4)', () => {
  it('rend null sans allure de référence — aucune valeur neutre n’existe', () => {
    expect(paceZoneOf(300, null)).toBeNull();
  });

  it('rend null sur une référence absurde', () => {
    expect(paceZoneOf(300, 0)).toBeNull();
    expect(paceZoneOf(300, -10)).toBeNull();
    expect(paceZoneOf(300, Number.NaN)).toBeNull();
  });

  it('rend null sur une allure absurde — jamais une zone inventée', () => {
    expect(paceZoneOf(0, REF)).toBeNull();
    expect(paceZoneOf(-5, REF)).toBeNull();
    expect(paceZoneOf(Number.NaN, REF)).toBeNull();
    expect(paceZoneOf(Number.POSITIVE_INFINITY, REF)).toBeNull();
  });
});

describe('paceZoneOf — 🔴 plus rapide = nombre plus PETIT', () => {
  it('classe une allure plus rapide que la VMA en « vma »', () => {
    // 4:30/km face à une VMA à 4:45/km : plus rapide, donc un nombre plus petit.
    expect(paceZoneOf(270, REF)).toBe('vma');
  });

  it('classe l’allure VMA pile en « vma » — borne inclusive côté rapide', () => {
    expect(paceZoneOf(VMA, REF)).toBe('vma');
  });

  it('classe une allure entre VMA et référence en « seuil »', () => {
    expect(paceZoneOf(292, REF)).toBe('seuil');
  });

  it('classe l’allure de référence pile en « seuil »', () => {
    expect(paceZoneOf(REF, REF)).toBe('seuil');
  });

  it('classe entre référence et ref+60 en « tempo » — la zone qui comble le trou', () => {
    expect(paceZoneOf(330, REF)).toBe('tempo');
    expect(paceZoneOf(REF + 60, REF)).toBe('tempo');
  });

  it('classe entre ref+60 et ref+90 en « endurance »', () => {
    expect(paceZoneOf(375, REF)).toBe('endurance');
    expect(paceZoneOf(REF + 90, REF)).toBe('endurance');
  });

  it('classe plus lent que ref+90 en « recuperation »', () => {
    expect(paceZoneOf(REF + 91, REF)).toBe('recuperation');
  });

  it('classe une course marchée en « recuperation », sans erreur', () => {
    // 12:00/km : très au-delà de la dernière borne finie. C'est un fait, pas une anomalie.
    expect(paceZoneOf(720, REF)).toBe('recuperation');
  });
});

describe('paceZoneOf — la partition couvre TOUT (R8)', () => {
  it('ne rend jamais null sur un balayage large des allures plausibles', () => {
    // De 2:00/km (plus rapide que tout record humain) à 20:00/km (marche lente) : aucune allure ne
    // doit tomber entre deux zones. C'est ce que « partition » veut dire.
    for (let pace = 120; pace <= 1200; pace += 5) {
      expect(paceZoneOf(pace, REF)).not.toBeNull();
    }
  });

  it('couvre tout aussi avec une référence lente et une référence rapide', () => {
    for (const ref of [200, 240, 300, 360, 480]) {
      for (let pace = 60; pace <= 1500; pace += 20) {
        expect(paceZoneOf(pace, ref)).not.toBeNull();
      }
    }
  });

  it('les zones sont mutuellement exclusives — une allure a exactement une zone', () => {
    const bounds = paceZoneBounds(REF);
    const pace = 330; // tempo
    const matching = PACE_ZONES.filter((z) => paceZoneOf(pace, REF) === z);
    expect(matching).toEqual(['tempo']);
    // Et la zone trouvée respecte bien sa borne haute.
    expect(pace).toBeLessThanOrEqual(bounds.tempo);
    expect(pace).toBeGreaterThan(bounds.seuil);
  });
});
