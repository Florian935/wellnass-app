import { describe, expect, it } from 'vitest';
import {
  weekKeyOf,
  prevWeekKey,
  weekActivity,
  computeWeeklyStreak,
  weeklyGoalProgress,
  weeklyGoalConflict,
  WEEKLY_GOAL_MIN,
  WEEKLY_GOAL_MAX,
} from './streak-week';
import type { DayActivity } from './streak';

/** Un jour d'activité, réduit à ce que le test veut dire. */
const day = (d: string, over: Partial<DayActivity> = {}): DayActivity => ({
  day: d,
  strength: false,
  running: false,
  nutrition: false,
  ...over,
});

// 2026 : le 21 septembre est un lundi, le 27 un dimanche.
const LUN = '2026-09-21';
const DIM = '2026-09-27';

describe('weekKeyOf / prevWeekKey', () => {
  it('🔴 la clé de semaine EST le lundi — pas un numéro ISO', () => {
    // Un numéro de semaine ISO traîne ses pièges (semaine 53, bascules d'année) pour aucun gain :
    // le lundi est unique, trié naturellement, et se compare comme une date.
    expect(weekKeyOf(LUN)).toBe(LUN);
    expect(weekKeyOf(DIM)).toBe(LUN);
    expect(weekKeyOf('2026-09-24')).toBe(LUN);
  });

  it('le dimanche et le lundi suivant ne sont PAS dans la même semaine', () => {
    expect(weekKeyOf(DIM)).not.toBe(weekKeyOf('2026-09-28'));
  });

  it('traverse un changement de mois et d’année sans trébucher', () => {
    // 1er janvier 2027 est un vendredi : sa semaine commence le 28 décembre 2026.
    expect(weekKeyOf('2027-01-01')).toBe('2026-12-28');
    expect(weekKeyOf('2026-12-28')).toBe('2026-12-28');
  });

  it('prevWeekKey recule de sept jours exactement', () => {
    expect(prevWeekKey(LUN)).toBe('2026-09-14');
    expect(prevWeekKey('2027-01-04')).toBe('2026-12-28');
  });
});

describe('weekActivity — ce qui rend une semaine active (R1, D3)', () => {
  it('une seule activité suffit', () => {
    const { active } = weekActivity([day('2026-09-24', { running: true })]);
    expect([...active]).toEqual([LUN]);
  });

  it('🔴 la NUTRITION rend une semaine active, au même titre que la muscu', () => {
    // La série quotidienne la compte déjà. L'exclure priverait de série quelqu'un qui n'utilise
    // que le pilier Nutrition — contraire à la décision de cadrage H (chaque pilier utile seul).
    const { active } = weekActivity([day('2026-09-24', { nutrition: true })]);
    expect(active.has(LUN)).toBe(true);
  });

  it('une AUTRE activité compte aussi (vélo, natation…)', () => {
    const { active } = weekActivity([day('2026-09-24', { other: true })]);
    expect(active.has(LUN)).toBe(true);
  });

  it('🔴 les PAS seuls ne rendent PAS une semaine active (D3)', () => {
    // « J'ai marché » et « je me suis entraîné » ne sont pas la même promesse. À l'échelle de la
    // semaine, les confondre viderait la série de son sens — alors que le quotidien les compte.
    const { active } = weekActivity([day('2026-09-24', { steps: true })]);
    expect(active.size).toBe(0);
  });

  it('un jour totalement vide ne compte pas', () => {
    expect(weekActivity([day('2026-09-24')]).active.size).toBe(0);
  });

  it('plusieurs jours de la même semaine ne comptent qu’une fois', () => {
    const { active } = weekActivity([
      day('2026-09-21', { strength: true }),
      day('2026-09-24', { running: true }),
    ]);
    expect(active.size).toBe(1);
  });

  it('liste vide → rien', () => {
    const { active, transparent } = weekActivity([]);
    expect(active.size).toBe(0);
    expect(transparent.size).toBe(0);
  });
});

describe('weekActivity — les semaines en pause (R5)', () => {
  /** Les sept jours d'une semaine, depuis son lundi. */
  const weekDays = (monday: string): string[] => {
    const [y, m, d] = monday.split('-').map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      const t = new Date(Date.UTC(y!, m! - 1, d!) + i * 86_400_000);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
    });
  };

  it('🔴 une semaine ENTIÈREMENT en pause et sans activité est transparente', () => {
    const { active, transparent } = weekActivity([], new Set(weekDays(LUN)));
    expect(transparent.has(LUN)).toBe(true);
    expect(active.has(LUN)).toBe(false);
  });

  it('une semaine PARTIELLEMENT en pause reste une semaine ordinaire', () => {
    const { transparent } = weekActivity([], new Set(weekDays(LUN).slice(0, 6)));
    expect(transparent.size).toBe(0);
  });

  it('🔴 une semaine en pause où l’on s’est entraîné est ACTIVE, pas transparente', () => {
    // L'activité prime sur la pause — c'est le cas C de VIE-01, transposé à la semaine.
    const { active, transparent } = weekActivity(
      [day('2026-09-24', { strength: true })],
      new Set(weekDays(LUN)),
    );
    expect(active.has(LUN)).toBe(true);
    expect(transparent.has(LUN)).toBe(false);
  });
});

describe('computeWeeklyStreak (R2, R3)', () => {
  const set = (...keys: string[]) => new Set(keys);
  const none = new Set<string>();

  it('la semaine courante active compte', () => {
    expect(computeWeeklyStreak(set(LUN), none, LUN)).toEqual({ current: 1, activeThisWeek: true });
  });

  it('🔴 la semaine COURANTE inactive ne casse pas la série — LA règle de l’US (R3)', () => {
    // Sans elle, la série de tout le monde tomberait à zéro tous les lundis matin.
    const result = computeWeeklyStreak(set('2026-09-14', '2026-09-07'), none, LUN);
    expect(result).toEqual({ current: 2, activeThisWeek: false });
  });

  it('deux semaines vides d’affilée cassent la série', () => {
    expect(computeWeeklyStreak(set('2026-09-07'), none, LUN).current).toBe(0);
  });

  it('un trou au milieu arrête le comptage', () => {
    // Active : cette semaine et la précédente, puis un trou, puis deux autres.
    const active = set(LUN, '2026-09-14', '2026-08-31', '2026-08-24');
    expect(computeWeeklyStreak(active, none, LUN).current).toBe(2);
  });

  it('🔴 une semaine transparente est TRAVERSÉE : ni comptée, ni cassante (R5)', () => {
    const active = set(LUN, '2026-09-07');
    const transparent = set('2026-09-14');
    // Deux semaines actives séparées par une semaine en pause → série de 2, pas de 1 ni de 3.
    expect(computeWeeklyStreak(active, transparent, LUN).current).toBe(2);
  });

  it('une semaine transparente en tête ne démarre pas une série', () => {
    expect(computeWeeklyStreak(none, set(LUN), LUN).current).toBe(0);
  });

  it('compte neuf : aucune semaine, série à 0 et non à 1 (R12)', () => {
    expect(computeWeeklyStreak(none, none, LUN)).toEqual({ current: 0, activeThisWeek: false });
  });
});

describe('weeklyGoalProgress (R8, R9)', () => {
  const semaine: DayActivity[] = [
    day('2026-09-21', { strength: true }),
    day('2026-09-23', { running: true }),
    day('2026-09-30', { running: true }), // semaine suivante : ne compte pas
  ];

  it('compte les JOURS actifs de la semaine courante, pas les activités', () => {
    // Deux séances le même jour ne valent qu'un jour : l'objectif mesure une régularité,
    // pas un volume.
    expect(weeklyGoalProgress(semaine, LUN, 4)).toEqual({ done: 2, total: 4, met: false });
  });

  it('🔴 sans objectif, le total est nul — l’app n’invente pas de cible (R9)', () => {
    expect(weeklyGoalProgress(semaine, LUN, null)).toEqual({ done: 2, total: null, met: false });
  });

  it('objectif atteint, et dépassé sans plafonner le réalisé', () => {
    expect(weeklyGoalProgress(semaine, LUN, 2).met).toBe(true);
    expect(weeklyGoalProgress(semaine, LUN, 1)).toEqual({ done: 2, total: 1, met: true });
  });

  it('la semaine suivante repart de zéro (R8 : il se réarme seul)', () => {
    expect(weeklyGoalProgress(semaine, '2026-09-28', 4).done).toBe(1);
  });

  it('les pas ne comptent pas davantage ici que pour la série', () => {
    expect(weeklyGoalProgress([day('2026-09-22', { steps: true })], LUN, 3).done).toBe(0);
  });
});

describe('weeklyGoalConflict (R10)', () => {
  it('🔴 signale quand l’objectif transverse est SOUS la fréquence de course', () => {
    expect(weeklyGoalConflict(2, 3)).toBe(true);
  });

  it('ne signale rien quand il est égal ou au-dessus', () => {
    expect(weeklyGoalConflict(3, 3)).toBe(false);
    expect(weeklyGoalConflict(5, 3)).toBe(false);
  });

  it('sans objectif ou sans fréquence, il n’y a pas d’incohérence à signaler', () => {
    expect(weeklyGoalConflict(null, 3)).toBe(false);
    expect(weeklyGoalConflict(2, null)).toBe(false);
    expect(weeklyGoalConflict(null, null)).toBe(false);
  });
});

describe('bornes de l’objectif', () => {
  it('de 1 à 14 — deux séances par jour est déjà une semaine hors norme', () => {
    expect(WEEKLY_GOAL_MIN).toBe(1);
    expect(WEEKLY_GOAL_MAX).toBe(14);
  });
});
