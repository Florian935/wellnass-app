import { describe, expect, it } from 'vitest';
import { emptySbdLifts, type SbdLifts } from './settings';
import {
  projectSbd,
  sbdHistory,
  sbdTotal,
  SBD_MAX_PROJECTION_WEEKS,
  type DatedOneRm,
  type SbdHistoryPoint,
} from './strength-sbd';

const LIFTS: SbdLifts = { squat: 'ex-squat', bench: 'ex-bench', deadlift: 'ex-dead' };

const rec = (exerciseId: string, value: number, achievedAt: string): DatedOneRm => ({
  exerciseId,
  type: 'estimated_1rm',
  value,
  achievedAt,
});

describe('sbdTotal (R11)', () => {
  it('additionne les trois mouvements', () => {
    expect(sbdTotal({ squat: 195, bench: 122.5, deadlift: 195 })).toEqual({
      totalKg: 512.5,
      missing: [],
    });
  });

  it('rend null ET la liste des manquants dès qu’un mouvement manque', () => {
    // Annoncer « 317 kg » en taisant l'absence du soulevé de terre serait faux — et d'autant plus
    // trompeur que le nombre a l'air juste.
    expect(sbdTotal({ squat: 195, bench: 122.5, deadlift: null })).toEqual({
      totalKg: null,
      missing: ['deadlift'],
    });
  });

  it('liste les trois quand rien n’est renseigné', () => {
    expect(sbdTotal({ squat: null, bench: null, deadlift: null })).toEqual({
      totalKg: null,
      missing: ['squat', 'bench', 'deadlift'],
    });
  });

  it('traite une valeur nulle, négative ou non finie comme manquante', () => {
    expect(sbdTotal({ squat: 0, bench: -100, deadlift: Number.NaN }).missing).toEqual([
      'squat',
      'bench',
      'deadlift',
    ]);
  });
});

describe('sbdHistory', () => {
  it('émet un point dès que les trois mouvements sont connus, et à chaque nouveau record', () => {
    const points = sbdHistory(
      [
        rec('ex-squat', 180, '2026-01-10'),
        rec('ex-bench', 110, '2026-02-10'),
        rec('ex-dead', 190, '2026-03-10'), // les 3 connus → 1er point
        rec('ex-squat', 195, '2026-04-10'), // record → 2e point
      ],
      LIFTS,
    );
    expect(points).toEqual([
      { date: '2026-03-10', totalKg: 480 },
      { date: '2026-04-10', totalKg: 495 },
    ]);
  });

  it('n’émet rien tant qu’un mouvement n’a aucun record', () => {
    // Un total partiel n'est pas un total (R11) : la courbe ne démarre qu'au troisième mouvement.
    expect(
      sbdHistory([rec('ex-squat', 180, '2026-01-10'), rec('ex-bench', 110, '2026-02-10')], LIFTS),
    ).toEqual([]);
  });

  it('ne fait jamais baisser le total sur un record inférieur', () => {
    // Une séance plus légère ne « défait » pas un record : le meilleur reste le meilleur (R1).
    const points = sbdHistory(
      [
        rec('ex-squat', 195, '2026-01-10'),
        rec('ex-bench', 122.5, '2026-01-10'),
        rec('ex-dead', 195, '2026-01-10'),
        rec('ex-squat', 150, '2026-02-10'),
      ],
      LIFTS,
    );
    expect(points.map((p) => p.totalKg)).toEqual([512.5, 512.5]);
  });

  it('trie les records, sans présumer de l’ordre de la requête', () => {
    const points = sbdHistory(
      [
        rec('ex-dead', 190, '2026-03-10'),
        rec('ex-squat', 180, '2026-01-10'),
        rec('ex-bench', 110, '2026-02-10'),
      ],
      LIFTS,
    );
    expect(points).toEqual([{ date: '2026-03-10', totalKg: 480 }]);
  });

  it('fusionne plusieurs records du même instant en un seul point', () => {
    const points = sbdHistory(
      [
        rec('ex-squat', 180, '2026-03-10'),
        rec('ex-bench', 110, '2026-03-10'),
        rec('ex-dead', 190, '2026-03-10'),
      ],
      LIFTS,
    );
    expect(points).toHaveLength(1);
    expect(points[0]!.totalKg).toBe(480);
  });

  it('rend une liste vide si un mouvement n’est pas désigné', () => {
    // Sans désignation complète, il n'y a pas de total à suivre (D3 : la désignation est l'opt-in).
    expect(sbdHistory([rec('ex-squat', 180, '2026-01-10')], emptySbdLifts())).toEqual([]);
    expect(sbdHistory([rec('ex-squat', 180, '2026-01-10')], { ...LIFTS, deadlift: null })).toEqual([]);
  });

  it('ignore les records d’un autre exercice, d’un autre type, ou aberrants', () => {
    const points = sbdHistory(
      [
        rec('ex-autre', 300, '2026-01-01'),
        { ...rec('ex-squat', 999, '2026-01-02'), type: 'max_weight' },
        rec('ex-squat', Number.NaN, '2026-01-03'),
        rec('ex-squat', -50, '2026-01-04'),
        rec('ex-squat', 180, '2026-01-10'),
        rec('ex-bench', 110, '2026-02-10'),
        rec('ex-dead', 190, '2026-03-10'),
      ],
      LIFTS,
    );
    expect(points).toEqual([{ date: '2026-03-10', totalKg: 480 }]);
  });

  it('ignore un record dont la date est illisible', () => {
    const points = sbdHistory(
      [
        rec('ex-squat', 180, 'pas-une-date'),
        rec('ex-squat', 175, '2026-01-10'),
        rec('ex-bench', 110, '2026-02-10'),
        rec('ex-dead', 190, '2026-03-10'),
      ],
      LIFTS,
    );
    expect(points).toEqual([{ date: '2026-03-10', totalKg: 475 }]);
  });
});

describe('projectSbd (R8, R9, R10)', () => {
  /** Historique régulier : +5 kg toutes les 4 semaines, sur 12 semaines. */
  const regular: SbdHistoryPoint[] = [
    { date: '2026-01-01', totalKg: 480 },
    { date: '2026-01-29', totalKg: 485 },
    { date: '2026-02-26', totalKg: 490 },
    { date: '2026-03-26', totalKg: 495 },
  ];

  it('projette au rythme observé', () => {
    const result = projectSbd(regular, 12);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // ~5 kg / 4 semaines = 1,25 kg / semaine → +15 kg sur 12 semaines.
    expect(result.slopePerWeek).toBeCloseTo(1.25, 2);
    expect(result.projectedKg).toBeCloseTo(510, 0);
    expect(result.weeks).toBe(12);
  });

  it('refuse sous 3 mesures, en disant combien il en manque (R8)', () => {
    const result = projectSbd(regular.slice(0, 2), 12);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not-enough-points');
    expect(result.pointsMissing).toBe(1);
  });

  it('refuse sur une fenêtre trop courte, en disant combien de jours manquent (R8)', () => {
    // 3 points, mais sur 3 semaines seulement : une droite tracée là n'a aucune valeur prédictive.
    const tight: SbdHistoryPoint[] = [
      { date: '2026-01-01', totalKg: 480 },
      { date: '2026-01-11', totalKg: 485 },
      { date: '2026-01-21', totalKg: 490 },
    ];
    const result = projectSbd(tight, 12);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('window-too-short');
    expect(result.daysMissing).toBe(36); // 56 − 20
  });

  it('refuse sur un historique vide', () => {
    const result = projectSbd([], 12);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not-enough-points');
    expect(result.pointsMissing).toBe(3);
  });

  it('rend une pente négative telle quelle (R10)', () => {
    // Masquer une régression décrédibiliserait les bonnes nouvelles.
    const declining: SbdHistoryPoint[] = [
      { date: '2026-01-01', totalKg: 500 },
      { date: '2026-01-29', totalKg: 495 },
      { date: '2026-02-26', totalKg: 490 },
    ];
    const result = projectSbd(declining, 12);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slopePerWeek).toBeLessThan(0);
    expect(result.projectedKg).toBeLessThan(490);
  });

  it('rend une pente nulle sur un plateau', () => {
    const flat: SbdHistoryPoint[] = [
      { date: '2026-01-01', totalKg: 500 },
      { date: '2026-01-29', totalKg: 500 },
      { date: '2026-02-26', totalKg: 500 },
    ];
    const result = projectSbd(flat, 12);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slopePerWeek).toBeCloseTo(0, 6);
    expect(result.projectedKg).toBeCloseTo(500, 6);
  });

  it('borne l’horizon à 12 semaines (R9)', () => {
    // Extrapoler un an de progression linéaire est physiologiquement faux.
    const result = projectSbd(regular, 52);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.weeks).toBe(SBD_MAX_PROJECTION_WEEKS);
  });

  it('accepte un horizon plus court que le plafond', () => {
    const result = projectSbd(regular, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.weeks).toBe(4);
    expect(result.projectedKg).toBeCloseTo(500, 0);
  });

  it('traite un horizon négatif comme zéro', () => {
    const result = projectSbd(regular, -8);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.weeks).toBe(0);
    expect(result.projectedKg).toBeCloseTo(495, 6);
  });

  it('accepte exactement 3 points sur exactement 8 semaines (bornes incluses)', () => {
    const exact: SbdHistoryPoint[] = [
      { date: '2026-01-01', totalKg: 480 },
      { date: '2026-02-01', totalKg: 485 },
      { date: '2026-02-26', totalKg: 490 }, // 56 jours après le premier
    ];
    expect(projectSbd(exact, 12).ok).toBe(true);
  });
});
