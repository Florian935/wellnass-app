import { describe, expect, it } from 'vitest';

import {
  MIN_RUNS_FOR_POLARISATION,
  POLARISATION_REFERENCE_LOW_PCT,
  computePaceZoneMix,
  computePolarisation,
} from './pace-zone-mix';
import type { KmSplit } from './running';

/** Référence 5 km à 5:00/km. Bornes qui en découlent : vma 285, seuil 300, tempo 360, endu 390. */
const REF = 300;

/** N kilomètres à une allure donnée (la durée d'un km plein EST son allure). */
const km = (n: number, seconds: number): KmSplit[] =>
  Array.from({ length: n }, (_, i) => ({ km: i + 1, seconds }));

const ENDURANCE = 375; // entre ref+60 et ref+90
const RECUP = 420; // au-delà de ref+90
const SEUIL = 295; // entre vma et ref
const TEMPO = 330; // entre ref et ref+60

describe('constantes', () => {
  it('expose le seuil de données et le repère, tous deux nommés', () => {
    expect(MIN_RUNS_FOR_POLARISATION).toBe(2);
    expect(POLARISATION_REFERENCE_LOW_PCT).toBe(80);
  });
});

describe('computePaceZoneMix — RUN-17', () => {
  it('rend null sans allure de référence — aucune valeur neutre n’existe (R4)', () => {
    expect(computePaceZoneMix({ splits: km(5, ENDURANCE), ref5kPaceSPerKm: null })).toBeNull();
  });

  it('rend null sans split', () => {
    expect(computePaceZoneMix({ splits: [], ref5kPaceSPerKm: REF })).toBeNull();
  });

  it('rend 100 % sur une course entièrement en endurance', () => {
    const out = computePaceZoneMix({ splits: km(6, ENDURANCE), ref5kPaceSPerKm: REF })!;
    expect(out).toEqual([{ zone: 'endurance', km: 6, percent: 100 }]);
  });

  it('répartit sur plusieurs zones et rend les kilomètres', () => {
    const out = computePaceZoneMix({
      splits: [...km(6, ENDURANCE), ...km(2, TEMPO)],
      ref5kPaceSPerKm: REF,
    })!;
    expect(out).toEqual([
      { zone: 'endurance', km: 6, percent: 75 },
      { zone: 'tempo', km: 2, percent: 25 },
    ]);
  });

  it('trie de la zone la plus représentée à la moins', () => {
    const out = computePaceZoneMix({
      splits: [...km(1, SEUIL), ...km(8, ENDURANCE), ...km(3, RECUP)],
      ref5kPaceSPerKm: REF,
    })!;
    expect(out.map((s) => s.zone)).toEqual(['endurance', 'recuperation', 'seuil']);
  });

  it('🔴 les parts somment TOUJOURS à 100, malgré les arrondis (R8)', () => {
    const out = computePaceZoneMix({
      splits: [...km(1, SEUIL), ...km(1, TEMPO), ...km(1, ENDURANCE)],
      ref5kPaceSPerKm: REF,
    })!;
    expect(out.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it('n’affiche pas les zones non touchées — pas de « 0 % » décoratif', () => {
    const out = computePaceZoneMix({ splits: km(4, RECUP), ref5kPaceSPerKm: REF })!;
    expect(out).toHaveLength(1);
    expect(out.map((s) => s.zone)).not.toContain('vma');
  });

  it('ignore un split inexploitable sans perdre les autres', () => {
    // Contrairement au negative split, un km manquant ne fait que déplacer légèrement les parts :
    // refuser tout le calcul serait une sévérité inutile.
    const splits: KmSplit[] = [...km(3, ENDURANCE), { km: 4, seconds: 0 }];
    const out = computePaceZoneMix({ splits, ref5kPaceSPerKm: REF })!;
    expect(out).toEqual([{ zone: 'endurance', km: 3, percent: 100 }]);
  });

  it('rend null si AUCUN split n’est classable', () => {
    const splits: KmSplit[] = [
      { km: 1, seconds: 0 },
      { km: 2, seconds: Number.NaN },
    ];
    expect(computePaceZoneMix({ splits, ref5kPaceSPerKm: REF })).toBeNull();
  });

  it('classe une course marchée entièrement en récupération', () => {
    expect(
      computePaceZoneMix({ splits: km(5, 720), ref5kPaceSPerKm: REF })!.map((s) => s.zone),
    ).toEqual(['recuperation']);
  });
});

describe('computePolarisation — RUN-08', () => {
  it('rend null sans allure de référence', () => {
    expect(
      computePolarisation({ runs: [{ splits: km(5, ENDURANCE) }], ref5kPaceSPerKm: null }),
    ).toBeNull();
  });

  it('rend null sans course', () => {
    expect(computePolarisation({ runs: [], ref5kPaceSPerKm: REF })).toBeNull();
  });

  it('rend null sur une seule course — une sortie n’est pas une répartition (R3)', () => {
    expect(
      computePolarisation({ runs: [{ splits: km(10, ENDURANCE) }], ref5kPaceSPerKm: REF }),
    ).toBeNull();
  });

  it('🔴 pèse les KILOMÈTRES et non les courses (R9)', () => {
    // 20 km d'endurance + 5 km de seuil. En kilomètres : 80/20. En COURSES : 50/50.
    // C'est le test écrit exprès pour échouer sur l'erreur la plus facile de ce module.
    const out = computePolarisation({
      runs: [{ splits: km(20, ENDURANCE) }, { splits: km(5, SEUIL) }],
      ref5kPaceSPerKm: REF,
    })!;
    expect(out.lowIntensityPct).toBe(80);
    expect(out.highIntensityPct).toBe(20);
    expect(out.lowIntensityPct).not.toBe(50);
    expect(out.totalKm).toBe(25);
    expect(out.runCount).toBe(2);
  });

  it('range tempo, seuil et vma en haute intensité', () => {
    const out = computePolarisation({
      runs: [
        { splits: [...km(5, TEMPO), ...km(5, ENDURANCE)] },
        { splits: [...km(3, SEUIL), ...km(2, 270)] },
      ],
      ref5kPaceSPerKm: REF,
    })!;
    // Haute : 5 tempo + 3 seuil + 2 vma = 10. Faible : 5 endurance. Total 15.
    expect(out.highIntensityPct).toBe(67);
    expect(out.lowIntensityPct).toBe(33);
  });

  it('range endurance et récupération en faible intensité', () => {
    const out = computePolarisation({
      runs: [{ splits: km(6, ENDURANCE) }, { splits: km(4, RECUP) }],
      ref5kPaceSPerKm: REF,
    })!;
    expect(out.lowIntensityPct).toBe(100);
    expect(out.highIntensityPct).toBe(0);
  });

  it('les deux parts somment TOUJOURS à 100 — pas de second arrondi', () => {
    // 1 km haute / 2 km faible : 33,3 % et 66,7 %. Deux arrondis indépendants donneraient 33 + 67
    // ou 33 + 66 selon la méthode ; ici le complément est exact.
    const out = computePolarisation({
      runs: [{ splits: km(1, SEUIL) }, { splits: km(2, ENDURANCE) }],
      ref5kPaceSPerKm: REF,
    })!;
    expect(out.lowIntensityPct + out.highIntensityPct).toBe(100);
  });

  it('ignore une course sans trace exploitable, et ne la compte pas', () => {
    const out = computePolarisation({
      runs: [{ splits: km(10, ENDURANCE) }, { splits: [] }, { splits: km(5, ENDURANCE) }],
      ref5kPaceSPerKm: REF,
    })!;
    expect(out.runCount).toBe(2);
    expect(out.totalKm).toBe(15);
  });

  it('applique le seuil APRÈS le filtre, pas avant', () => {
    // Deux entrées mais une seule exploitable : ce n'est pas une répartition.
    expect(
      computePolarisation({
        runs: [{ splits: km(10, ENDURANCE) }, { splits: [] }],
        ref5kPaceSPerKm: REF,
      }),
    ).toBeNull();
  });
});
