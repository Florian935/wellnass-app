import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INTENSITY_SCALE,
  fromDisplayIntensity,
  INTENSITY_SCALES,
  intensityChoices,
  intensityLabelKey,
  parseIntensityScale,
  RPE_MAX,
  toDisplayIntensity,
} from './intensity';

describe('conversion RPE → affichage', () => {
  it('laisse le RPE inchangé en mode RPE', () => {
    expect(toDisplayIntensity(8, 'rpe')).toBe(8);
    expect(toDisplayIntensity(1, 'rpe')).toBe(1);
  });

  it('inverse en RIR : RPE 10 → RIR 0, RPE 8 → RIR 2', () => {
    // Les deux décrivent la même série : 10 = plus aucune répétition possible = 0 en réserve.
    expect(toDisplayIntensity(10, 'rir')).toBe(0);
    expect(toDisplayIntensity(8, 'rir')).toBe(2);
    expect(toDisplayIntensity(1, 'rir')).toBe(9);
  });

  it('garde `null` en `null` — une intensité NON SAISIE ne devient pas « RIR 10 »', () => {
    // C'est le piège de la conversion naïve `10 - (rpe ?? 0)` : elle transformerait une absence de
    // donnée en valeur maximale, donc en information inventée.
    for (const scale of INTENSITY_SCALES) {
      expect(toDisplayIntensity(null, scale)).toBeNull();
      expect(toDisplayIntensity(undefined, scale)).toBeNull();
    }
  });

  it('rejette une valeur non finie plutôt que de propager NaN', () => {
    expect(toDisplayIntensity(Number.NaN, 'rir')).toBeNull();
    expect(toDisplayIntensity(Number.POSITIVE_INFINITY, 'rpe')).toBeNull();
  });
});

describe('conversion affichage → RPE', () => {
  it('est la réciproque EXACTE — un aller-retour ne dérive pas', () => {
    // C'est la propriété qui rend la bascule d'échelle non destructrice.
    for (const scale of INTENSITY_SCALES) {
      for (let rpe = 1; rpe <= RPE_MAX; rpe += 1) {
        const displayed = toDisplayIntensity(rpe, scale);
        expect(fromDisplayIntensity(displayed, scale)).toBe(rpe);
      }
    }
  });

  it('convertit une saisie RIR vers le RPE à stocker', () => {
    expect(fromDisplayIntensity(2, 'rir')).toBe(8);
    expect(fromDisplayIntensity(0, 'rir')).toBe(10);
  });

  it('garde `null` en `null`', () => {
    expect(fromDisplayIntensity(null, 'rir')).toBeNull();
  });
});

describe('valeurs proposées à la saisie', () => {
  it('propose 10 valeurs dans les DEUX échelles — aucune perte', () => {
    // Le choix « plage utile 0-4 » aurait rendu les RPE de 1 à 5 inaffichables.
    expect(intensityChoices('rpe')).toHaveLength(10);
    expect(intensityChoices('rir')).toHaveLength(10);
  });

  it('RPE : 1 → 10, l’effort croît vers la droite', () => {
    expect(intensityChoices('rpe')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('RIR : 0 → 9, la réserve croît vers la droite (donc l’effort décroît)', () => {
    // Chaque échelle se lit de gauche à droite comme l'utilisateur la pense. Présenter le RIR en
    // 9 → 0 « pour garder l'ordre du RPE » serait déroutant.
    expect(intensityChoices('rir')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('toute valeur proposée est convertible en un RPE valide', () => {
    for (const scale of INTENSITY_SCALES) {
      for (const choice of intensityChoices(scale)) {
        const rpe = fromDisplayIntensity(choice, scale);
        expect(rpe).not.toBeNull();
        expect(rpe!).toBeGreaterThanOrEqual(1);
        expect(rpe!).toBeLessThanOrEqual(RPE_MAX);
      }
    }
  });
});

describe('parse et libellés', () => {
  it('retombe sur le RPE pour toute valeur inconnue', () => {
    // Les réglages déjà enregistrés n'ont pas cette colonne : ils doivent lire « rpe », pas planter.
    expect(parseIntensityScale(undefined)).toBe('rpe');
    expect(parseIntensityScale(null)).toBe('rpe');
    expect(parseIntensityScale('')).toBe('rpe');
    expect(parseIntensityScale('RIR')).toBe('rpe'); // sensible à la casse, volontairement strict
    expect(parseIntensityScale(42)).toBe('rpe');
    expect(DEFAULT_INTENSITY_SCALE).toBe('rpe');
  });

  it('reconnaît « rir »', () => {
    expect(parseIntensityScale('rir')).toBe('rir');
  });

  it('donne une clé i18n par échelle', () => {
    expect(intensityLabelKey('rpe')).toBe('intensity.rpe.short');
    expect(intensityLabelKey('rir')).toBe('intensity.rir.short');
  });
});
