import { describe, expect, it } from 'vitest';

import { CM_PER_IN, cmToIn, inToCm } from './units';
import {
  MEASUREMENT_KINDS,
  isMeasurementKind,
  isValidMeasurementCm,
  latestByKind,
  measurementDeltas,
  measurementSeries,
  type MeasurementRow,
} from './measurements';

describe('conversion de circonférences', () => {
  it('convertit cm ↔ pouces sur les valeurs de référence', () => {
    expect(cmToIn(CM_PER_IN)).toBeCloseTo(1, 10);
    expect(inToCm(1)).toBeCloseTo(2.54, 10);
    // Un tour de bras réaliste : 35 cm ≈ 13,78 in — et surtout PAS « 1 ft 1,8 in ».
    expect(cmToIn(35)).toBeCloseTo(13.7795, 3);
  });

  it('fait un aller-retour stable — sinon l’historique dériverait à chaque bascule d’unité', () => {
    for (const cm of [1, 35.5, 82, 104.2, 299.9]) {
      expect(inToCm(cmToIn(cm))).toBeCloseTo(cm, 10);
    }
  });
});

describe('garde-fous', () => {
  it('écarte les valeurs implausibles (virgule oubliée, zéro, négatif)', () => {
    expect(isValidMeasurementCm(82)).toBe(true);
    expect(isValidMeasurementCm(1)).toBe(true);
    expect(isValidMeasurementCm(300)).toBe(true);

    expect(isValidMeasurementCm(0)).toBe(false);
    expect(isValidMeasurementCm(-5)).toBe(false);
    expect(isValidMeasurementCm(820)).toBe(false); // virgule oubliée
    expect(isValidMeasurementCm(Number.NaN)).toBe(false);
    expect(isValidMeasurementCm('82')).toBe(false);
    expect(isValidMeasurementCm(null)).toBe(false);
  });

  it('reconnaît les 6 mesures et rien d’autre', () => {
    expect(MEASUREMENT_KINDS).toEqual(['waist', 'chest', 'hips', 'arm', 'thigh', 'calf']);
    for (const kind of MEASUREMENT_KINDS) expect(isMeasurementKind(kind)).toBe(true);
    expect(isMeasurementKind('forearm')).toBe(false);
    expect(isMeasurementKind(null)).toBe(false);
  });
});

const rows: MeasurementRow[] = [
  { logDate: '2026-05-10', kind: 'waist', valueCm: 84.5 },
  { logDate: '2026-06-14', kind: 'waist', valueCm: 83.5 },
  { logDate: '2026-07-12', kind: 'waist', valueCm: 82 },
  { logDate: '2026-07-12', kind: 'arm', valueCm: 35.5 },
];

describe('measurementSeries', () => {
  it('rend la série d’une mesure, du plus ancien au plus récent', () => {
    expect(measurementSeries(rows, 'waist')).toEqual([
      { dayKey: '2026-05-10', valueCm: 84.5 },
      { dayKey: '2026-06-14', valueCm: 83.5 },
      { dayKey: '2026-07-12', valueCm: 82 },
    ]);
  });

  it('n’inclut que la mesure demandée — un relevé partiel laisse un TROU aux autres', () => {
    // Le bras n'a été mesuré qu'une fois : sa série a un point, pas trois zéros.
    expect(measurementSeries(rows, 'arm')).toEqual([{ dayKey: '2026-07-12', valueCm: 35.5 }]);
    expect(measurementSeries(rows, 'calf')).toEqual([]);
  });

  it('borne la fenêtre', () => {
    expect(measurementSeries(rows, 'waist', '2026-06-01').map((p) => p.dayKey)).toEqual([
      '2026-06-14',
      '2026-07-12',
    ]);
  });

  it('ignore les lignes supprimées et les valeurs aberrantes', () => {
    const dirty: MeasurementRow[] = [
      ...rows,
      { logDate: '2026-07-20', kind: 'waist', valueCm: 80, deletedAt: '2026-07-21T10:00:00Z' },
      { logDate: '2026-07-25', kind: 'waist', valueCm: 820 },
    ];
    expect(measurementSeries(dirty, 'waist').map((p) => p.dayKey)).toEqual([
      '2026-05-10',
      '2026-06-14',
      '2026-07-12',
    ]);
  });
});

describe('latestByKind', () => {
  it('rend la dernière valeur connue de chaque mesure relevée', () => {
    const latest = latestByKind(rows);
    expect(latest.waist).toEqual({ dayKey: '2026-07-12', valueCm: 82 });
    expect(latest.arm).toEqual({ dayKey: '2026-07-12', valueCm: 35.5 });
  });

  it('OMET une mesure jamais relevée au lieu de la mettre à zéro', () => {
    // Le champ doit rester vide dans la feuille : un 0 pré-rempli s'enregistrerait par inadvertance.
    const latest = latestByKind(rows);
    expect(latest.calf).toBeUndefined();
    expect('calf' in latest).toBe(false);
  });

  it('rend un objet vide sans données', () => {
    expect(latestByKind([])).toEqual({});
  });
});

describe('measurementDeltas', () => {
  it('compare au relevé précédent, du plus récent au plus ancien', () => {
    expect(measurementDeltas(rows, 'waist')).toEqual([
      { logDate: '2026-07-12', valueCm: 82, deltaCm: -1.5 },
      { logDate: '2026-06-14', valueCm: 83.5, deltaCm: -1 },
      { logDate: '2026-05-10', valueCm: 84.5, deltaCm: null },
    ]);
  });

  it('met null — et NON zéro — au premier relevé', () => {
    // « rien à comparer » ≠ « aucun changement ». Un 0 laisserait croire à une stagnation.
    const single = measurementDeltas([{ logDate: '2026-07-12', kind: 'arm', valueCm: 35 }], 'arm');
    expect(single).toEqual([{ logDate: '2026-07-12', valueCm: 35, deltaCm: null }]);
    expect(single[0]!.deltaCm).not.toBe(0);
  });

  it('rend un delta de 0 quand la valeur est réellement stable', () => {
    const stable = measurementDeltas(
      [
        { logDate: '2026-06-01', kind: 'arm', valueCm: 35 },
        { logDate: '2026-07-01', kind: 'arm', valueCm: 35 },
      ],
      'arm',
    );
    expect(stable[0]).toEqual({ logDate: '2026-07-01', valueCm: 35, deltaCm: 0 });
  });

  it('arrondit au dixième plutôt que d’exposer le bruit des flottants', () => {
    const d = measurementDeltas(
      [
        { logDate: '2026-06-01', kind: 'thigh', valueCm: 58.3 },
        { logDate: '2026-07-01', kind: 'thigh', valueCm: 56.8 },
      ],
      'thigh',
    );
    expect(d[0]!.deltaCm).toBe(-1.5);
  });

  it('rend une liste vide sans données', () => {
    expect(measurementDeltas([], 'waist')).toEqual([]);
  });
});
