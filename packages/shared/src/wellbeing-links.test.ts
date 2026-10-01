/** US BIEN-05 — les croisements Bien-être × piliers : assez de cas, un écart lisible, des pistes écartées. */
import { describe, expect, it } from 'vitest';

import {
  WELLBEING_LINK_IDS,
  WELLBEING_LINK_MIN_CASES,
  WELLBEING_LINK_SOLID_CASES,
  WELLBEING_LINK_THRESHOLDS,
  buildWellbeingLinks,
  compareGroups,
  recentPoorNights,
  type WellbeingLinksInput,
} from './wellbeing-links';
import type { LocalWellbeing } from './wellbeing';

const TODAY = '2026-10-01';

function day(n: number): string {
  const d = new Date(2026, 9, 1);
  d.setDate(d.getDate() - n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function input(over: Partial<WellbeingLinksInput> = {}): WellbeingLinksInput {
  return {
    todayKey: TODAY,
    checkins: [],
    strength: [],
    runs: [],
    intake: [],
    trainingDays: [],
    activePillars: ['strength', 'running', 'nutrition'],
    modules: { alcohol: false, caffeine: false },
    ...over,
  };
}

const byId = (links: ReturnType<typeof buildWellbeingLinks>, id: string) => links.find((l) => l.id === id)!;
const range = (n: number, from = 1) => Array.from({ length: n }, (_, i) => i + from);

describe('compareGroups — les règles du « va souvent avec »', () => {
  it('sous 8 cas d’un côté : on apprend, sans écart ni sens', () => {
    const r = compareGroups([1, 2, 3], range(10).map(() => 0), 'pct', true);
    expect(r).toMatchObject({ status: 'learning', delta: null, adverse: null, exposed: 3, other: 10, need: WELLBEING_LINK_MIN_CASES });
  });

  it('un écart sous le seuil, avec assez de cas : une piste écartée, dite comme telle', () => {
    const r = compareGroups(range(8).map(() => -3), range(8).map(() => 0), 'pct', true);
    expect(r.status).toBe('noLink');
    expect(r.delta).toBe(-3);
    expect(r.adverse).toBeNull();
    expect(WELLBEING_LINK_THRESHOLDS.pct).toBe(5);
  });

  it('probable de 8 à 13 cas, solide à partir de 14 de chaque côté', () => {
    expect(compareGroups(range(8).map(() => -10), range(8).map(() => 0), 'pct', true).status).toBe('probable');
    const solid = compareGroups(range(WELLBEING_LINK_SOLID_CASES).map(() => -10), range(14).map(() => 0), 'pct', true);
    expect(solid).toMatchObject({ status: 'solid', delta: -10, adverse: true });
  });

  it('le sens dépend de la mesure : une allure plus haute est défavorable', () => {
    expect(compareGroups(range(8).map(() => 15), range(8).map(() => 0), 'secPerKm', false).adverse).toBe(true);
    expect(compareGroups(range(8).map(() => -15), range(8).map(() => 0), 'secPerKm', false).adverse).toBe(false);
  });
});

describe('décision H — un croisement n’existe que si son pilier (ou son module) est activé', () => {
  it('trois piliers sans module : les sept croisements « croisés » sauf l’alcool', () => {
    expect(buildWellbeingLinks(input()).map((l) => l.id)).toEqual([
      'nightStrength',
      'nightRunning',
      'nightIntake',
      'motivationTraining',
      'stressJournal',
      'trainingMood',
    ]);
  });

  it('nutrition seule : la nuit et le stress côté assiette, rien sur les séances', () => {
    expect(buildWellbeingLinks(input({ activePillars: ['nutrition'] })).map((l) => l.id)).toEqual(['nightIntake', 'stressJournal']);
  });

  it('les modules ajoutent leurs croisements, internes au pilier ou non', () => {
    const ids = buildWellbeingLinks(input({ modules: { alcohol: true, caffeine: true } })).map((l) => l.id);
    expect(ids).toEqual([...WELLBEING_LINK_IDS]);
    expect(buildWellbeingLinks(input({ activePillars: [], modules: { alcohol: true, caffeine: false } })).map((l) => l.id)).toEqual(['alcoholNight']);
  });
});

describe('les croisements, calculés', () => {
  it('nuit → muscu : tonnage relatif à la référence du MÊME type de séance', () => {
    const checkins: LocalWellbeing[] = [];
    const strength: { dayKey: string; tonnage: number; groupKey: string }[] = [];
    // 10 séances « jambes » après une bonne nuit (5 000 kg), 9 après une nuit courte (4 500 kg).
    for (const n of range(10, 2)) {
      checkins.push({ logDate: day(n), sleepMinutes: 450 });
      strength.push({ dayKey: day(n), tonnage: 5000, groupKey: 'legs' });
    }
    for (const n of range(9, 20)) {
      checkins.push({ logDate: day(n), sleepMinutes: 320 });
      strength.push({ dayKey: day(n), tonnage: 4500, groupKey: 'legs' });
    }
    // Une séance « bras » à 1 000 kg ne doit rien fausser : elle a sa propre référence (mais moins de 3 séances).
    strength.push({ dayKey: day(40), tonnage: 1000, groupKey: 'arms' });
    const link = byId(buildWellbeingLinks(input({ checkins, strength })), 'nightStrength');
    expect(link.status).toBe('probable');
    expect(link.exposed).toBe(9);
    expect(link.other).toBe(10);
    expect(link.delta).toBe(-10);
    expect(link.adverse).toBe(true);
  });

  it('nuit → allure, à effort égal : les courses sans effort saisi ne comptent pas', () => {
    const checkins: LocalWellbeing[] = [];
    const runs: { dayKey: string; paceSPerKm: number; rpe: number | null }[] = [];
    for (const n of range(8, 2)) {
      checkins.push({ logDate: day(n), sleepMinutes: 460 });
      runs.push({ dayKey: day(n), paceSPerKm: 330, rpe: 5 });
    }
    for (const n of range(8, 20)) {
      checkins.push({ logDate: day(n), sleepQuality: 1 });
      runs.push({ dayKey: day(n), paceSPerKm: 345, rpe: 5 });
      runs.push({ dayKey: day(n), paceSPerKm: 300, rpe: null });
    }
    const link = byId(buildWellbeingLinks(input({ checkins, runs })), 'nightRunning');
    expect(link).toMatchObject({ status: 'probable', exposed: 8, other: 8, adverse: true });
    expect(link.delta).toBe(15);
  });

  it('nuit → apports : seulement les journées finies (aujourd’hui exclu)', () => {
    const checkins: LocalWellbeing[] = [{ logDate: TODAY, sleepMinutes: 200 }];
    const intake: { dayKey: string; kcal: number }[] = [{ dayKey: TODAY, kcal: 9000 }];
    for (const n of range(8, 1)) {
      checkins.push({ logDate: day(n), sleepMinutes: 300 });
      intake.push({ dayKey: day(n), kcal: 2400 });
    }
    for (const n of range(8, 10)) {
      checkins.push({ logDate: day(n), sleepMinutes: 470 });
      intake.push({ dayKey: day(n), kcal: 2000 });
    }
    const link = byId(buildWellbeingLinks(input({ checkins, intake })), 'nightIntake');
    expect(link.exposed).toBe(8);
    expect(link.status).toBe('probable');
    expect(link.delta).toBe(400);
  });

  it('envie → séances : le niveau 3 ne tranche rien, aujourd’hui n’est pas fini', () => {
    const checkins: LocalWellbeing[] = [{ logDate: TODAY, motivation: 1 }];
    const trainingDays: string[] = [];
    for (const n of range(8, 1)) checkins.push({ logDate: day(n), motivation: 1 }); // jamais d'entraînement
    for (const n of range(8, 10)) {
      checkins.push({ logDate: day(n), motivation: 5 });
      trainingDays.push(day(n));
    }
    for (const n of range(5, 30)) checkins.push({ logDate: day(n), motivation: 3 });
    const link = byId(buildWellbeingLinks(input({ checkins, trainingDays })), 'motivationTraining');
    expect(link).toMatchObject({ exposed: 8, other: 8, delta: -100, adverse: true, status: 'probable' });
  });

  it('s’entraîner → humeur du soir : un résultat favorable n’est pas « défavorable »', () => {
    const checkins: LocalWellbeing[] = [];
    const trainingDays: string[] = [];
    for (const n of range(8, 1)) {
      checkins.push({ logDate: day(n), mood: 4 });
      trainingDays.push(day(n));
    }
    for (const n of range(8, 10)) checkins.push({ logDate: day(n), mood: 3 });
    const link = byId(buildWellbeingLinks(input({ checkins, trainingDays })), 'trainingMood');
    expect(link).toMatchObject({ status: 'probable', delta: 1, adverse: false });
  });

  it('alcool et caféine → la nuit SUIVANTE', () => {
    const checkins: LocalWellbeing[] = [];
    // Soirs J pairs : 2 verres puis nuit de 6 h ; soirs J impairs : 0 verre puis nuit de 7 h 30.
    for (const n of range(36, 2)) {
      const drinks = n % 2 === 0 ? 2 : 0;
      checkins.push({ logDate: day(n), alcoholDrinks: drinks, lateCaffeine: false });
    }
    // La nuit de J+1 (= day(n-1)) dépend de l'alcool de J.
    for (const row of checkins) {
      const n = range(36, 2).find((k) => day(k) === row.logDate)!;
      row.sleepMinutes = (n + 1) % 2 === 0 ? 360 : 450;
    }
    const links = buildWellbeingLinks(input({ checkins, activePillars: [], modules: { alcohol: true, caffeine: true } }));
    const alcohol = byId(links, 'alcoholNight');
    expect(alcohol.status).toBe('solid');
    expect(alcohol.delta).toBe(-90);
    expect(alcohol.adverse).toBe(true);
    // Toujours « non » au café : un seul côté rempli → on apprend.
    expect(byId(links, 'caffeineNight').status).toBe('learning');
  });

  it('ignore les lignes supprimées et ce qui sort de la fenêtre de 90 jours', () => {
    const checkins: LocalWellbeing[] = range(10, 100).map((n) => ({ logDate: day(n), motivation: 1 }));
    checkins.push(...range(10, 1).map((n) => ({ logDate: day(n), motivation: 1, deletedAt: '2026-10-01T00:00:00Z' })));
    const link = byId(buildWellbeingLinks(input({ checkins })), 'motivationTraining');
    expect(link.exposed).toBe(0);
  });
});

describe('recentPoorNights', () => {
  it('compte les nuits courtes ou agitées des 7 derniers matins renseignés', () => {
    const rows: LocalWellbeing[] = [
      { logDate: TODAY, sleepMinutes: 300 },
      { logDate: day(1), sleepQuality: 2 },
      { logDate: day(2), sleepMinutes: 450 },
      { logDate: day(3), mood: 2 },
      { logDate: day(8), sleepMinutes: 200 },
    ];
    expect(recentPoorNights(rows, TODAY)).toEqual({ poor: 2, known: 3 });
  });
});
