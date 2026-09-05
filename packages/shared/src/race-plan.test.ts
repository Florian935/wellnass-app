/** US RUN-F4 (lots G et H) — seance de course et bloc de preparation date. */
import { describe, expect, it } from 'vitest';
import {
  blockProgress,
  cumulativePacingSplits,
  evenPacingPlan,
  parsePacingPlan,
  raceCountdown,
} from './race-plan';

/** Le plan de course du PDF analyse : 4:02 / 4:00 / 4:00 / 3:58-4:00 / accelation finale. */
const racePlan = [
  { km: 1, paceMinSPerKm: 242, paceMaxSPerKm: 242 },
  { km: 2, paceMinSPerKm: 240, paceMaxSPerKm: 240 },
  { km: 3, paceMinSPerKm: 240, paceMaxSPerKm: 240 },
  { km: 4, paceMinSPerKm: 238, paceMaxSPerKm: 240 },
  { km: 5, paceMinSPerKm: 235, paceMaxSPerKm: 240 },
];

describe('parsePacingPlan', () => {
  it('relit un plan valide et le trie par kilometre', () => {
    const parsed = parsePacingPlan([racePlan[1], racePlan[0]]);
    expect(parsed?.map((e) => e.km)).toEqual([1, 2]);
  });

  it('accepte une chaine JSON (colonne jsonb relue en texte par SQLite)', () => {
    expect(parsePacingPlan(JSON.stringify(racePlan))).toHaveLength(5);
  });

  it('rend null sans jamais lever sur une donnee abimee', () => {
    // Une colonne jsonb libre peut contenir n'importe quoi ; une exception ici ferait planter
    // l'ecran de detail a cause d'une donnee decorative.
    expect(parsePacingPlan('{pas du json')).toBeNull();
    expect(parsePacingPlan([{ km: 'un', paceMinSPerKm: 240 }])).toBeNull();
    expect(parsePacingPlan([])).toBeNull();
    expect(parsePacingPlan(null)).toBeNull();
    expect(parsePacingPlan(42)).toBeNull();
  });
});

describe('cumulativePacingSplits', () => {
  it('donne les temps de passage — « 2 km ≈ 8:02, 3 km ≈ 12:02 »', () => {
    const splits = cumulativePacingSplits(racePlan);
    expect(splits[1]!.cumulativeMinSeconds).toBe(482); // 8:02
    expect(splits[2]!.cumulativeMinSeconds).toBe(722); // 12:02
  });

  it('cumule les deux bornes separement — l incertitude grandit avec la distance', () => {
    const splits = cumulativePacingSplits(racePlan);
    const last = splits.at(-1)!;
    expect(last.cumulativeMinSeconds).toBe(242 + 240 + 240 + 238 + 235);
    expect(last.cumulativeMaxSeconds).toBe(242 + 240 + 240 + 240 + 240);
    expect(last.cumulativeMaxSeconds).toBeGreaterThan(last.cumulativeMinSeconds);
  });

  it('un plan vide ne produit aucun passage', () => {
    expect(cumulativePacingSplits([])).toEqual([]);
  });
});

describe('evenPacingPlan', () => {
  it('deduit un plan regulier de « 5 km en 20:00 »', () => {
    const plan = evenPacingPlan(5000, 1200);
    expect(plan).toHaveLength(5);
    expect(plan!.every((e) => e.paceMinSPerKm === 240)).toBe(true);
  });

  it('reste regulier et ne prescrit pas de negative split', () => {
    // L'app sait CONSTATER un negative split (ALLURE-01 / RUN-11) ; en PRESCRIRE un d'office
    // serait un choix d'entraineur, pas un calcul.
    const plan = evenPacingPlan(10_000, 2400)!;
    expect(new Set(plan.map((e) => e.paceMinSPerKm)).size).toBe(1);
  });

  it('rend null sur une entree inexploitable', () => {
    expect(evenPacingPlan(null, 1200)).toBeNull();
    expect(evenPacingPlan(5000, null)).toBeNull();
    expect(evenPacingPlan(0, 1200)).toBeNull();
    expect(evenPacingPlan(800, 200)).toBeNull(); // moins d'un kilometre plein
  });
});

describe('raceCountdown', () => {
  it('compte les jours jusqu a l echeance', () => {
    const countdown = raceCountdown('2026-10-25', '2026-09-05');
    expect(countdown?.daysRemaining).toBe(50);
    expect(countdown?.weeksRemaining).toBe(7);
    expect(countdown?.isPast).toBe(false);
    expect(countdown?.isTaperWeek).toBe(false);
  });

  it('reconnait le jour J', () => {
    const countdown = raceCountdown('2026-10-25', '2026-10-25');
    expect(countdown?.isToday).toBe(true);
    expect(countdown?.daysRemaining).toBe(0);
    expect(countdown?.isTaperWeek).toBe(true);
  });

  it('reconnait la semaine d affutage — les 7 derniers jours', () => {
    expect(raceCountdown('2026-10-25', '2026-10-18')?.isTaperWeek).toBe(true);
    expect(raceCountdown('2026-10-25', '2026-10-17')?.isTaperWeek).toBe(false);
  });

  it('une date passee donne un compte negatif, jamais un affutage', () => {
    const countdown = raceCountdown('2026-10-25', '2026-11-01');
    expect(countdown?.daysRemaining).toBe(-7);
    expect(countdown?.isPast).toBe(true);
    expect(countdown?.isTaperWeek).toBe(false);
    expect(countdown?.weeksRemaining).toBe(0);
  });

  it('rend null sans echeance ou sur une date illisible', () => {
    // La majorite des programmes n'a pas d'echeance (« Reprise en douceur ») : l'UI n'affiche
    // alors rien du tout, surtout pas un « J-0 ».
    expect(raceCountdown(null, '2026-09-05')).toBeNull();
    expect(raceCountdown('', '2026-09-05')).toBeNull();
    expect(raceCountdown('pas-une-date', '2026-09-05')).toBeNull();
  });

  it('ne depend pas du fuseau — la date est une cle nue', () => {
    // Une course le 25/10 reste le 25/10, quel que soit le fuseau du telephone.
    expect(raceCountdown('2026-10-25', '2026-10-24')?.daysRemaining).toBe(1);
  });
});

describe('blockProgress', () => {
  it('compte le taux de realisation — « 6 sur 24, 25 % »', () => {
    const statuses = [
      ...Array<'done'>(6).fill('done'),
      ...Array<'planned'>(18).fill('planned'),
    ];
    const progress = blockProgress(statuses);
    expect(progress.doneCount).toBe(6);
    expect(progress.plannedCount).toBe(24);
    expect(progress.ratio).toBeCloseTo(0.25, 5);
  });

  it('les seances sautees comptent au denominateur, jamais au numerateur', () => {
    // Masquer les sauts rendrait l'indicateur flatteur, donc inutile.
    const progress = blockProgress(['done', 'skipped', 'skipped', 'planned']);
    expect(progress.doneCount).toBe(1);
    expect(progress.ratio).toBe(0.25);
  });

  it('un bloc vide n a pas de taux, pas un taux de zero', () => {
    expect(blockProgress([]).ratio).toBeNull();
  });
});
