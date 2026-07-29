import { describe, expect, it } from 'vitest';

import {
  JOKER_MAX_AGE_DAYS,
  JOKERS_PER_MONTH,
  computeStreakWithJokers,
  findRestorableGap,
  isSameCalendarMonth,
  jokersRemaining,
} from './streak-joker';

/** Suite de clés de jours consécutives se terminant le `to` inclus. */
function daysUpTo(to: string, count: number): string[] {
  const out: string[] = [];
  const [y, m, d] = to.split('-').map(Number);
  for (let i = count - 1; i >= 0; i--) {
    const t = new Date(Date.UTC(y!, m! - 1, d! - i));
    const pad = (n: number) => String(n).padStart(2, '0');
    out.push(`${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`);
  }
  return out;
}

const TODAY = '2026-07-20';

describe('jokersRemaining', () => {
  it('accorde 1 joker par mois calendaire', () => {
    expect(JOKERS_PER_MONTH).toBe(1);
    expect(jokersRemaining([], TODAY)).toBe(1);
    expect(jokersRemaining(['2026-07-05'], TODAY)).toBe(0);
  });

  it('ne compte que le mois courant — le 1er du mois recharge', () => {
    // Un joker consommé en juin ne pèse pas sur juillet.
    expect(jokersRemaining(['2026-06-28'], TODAY)).toBe(1);
    expect(isSameCalendarMonth('2026-06-30', '2026-07-01')).toBe(false);
  });

  it('ne descend jamais sous zéro', () => {
    expect(jokersRemaining(['2026-07-02', '2026-07-09'], TODAY)).toBe(0);
  });
});

describe('computeStreakWithJokers', () => {
  it('compte comme la série normale quand aucun joker n’est posé', () => {
    const active = new Set(daysUpTo(TODAY, 5));
    expect(computeStreakWithJokers(active, new Set(), TODAY)).toEqual({
      current: 5,
      activeToday: true,
    });
  });

  it('garde la tolérance du jour courant : une journée commencée n’est pas manquée', () => {
    const active = new Set(daysUpTo('2026-07-19', 4)); // rien aujourd'hui
    expect(computeStreakWithJokers(active, new Set(), TODAY)).toEqual({
      current: 4,
      activeToday: false,
    });
  });

  it('franchit un jour manqué couvert par un joker', () => {
    // Actifs : 14→18 juillet et 20 juillet. Le 19 est manqué.
    const active = new Set([...daysUpTo('2026-07-18', 5), '2026-07-20']);
    const sansJoker = computeStreakWithJokers(active, new Set(), TODAY);
    const avecJoker = computeStreakWithJokers(active, new Set(['2026-07-19']), TODAY);

    // Sans joker, la série ne remonte pas au-delà du trou.
    expect(sansJoker.current).toBe(1);
    // Avec, elle repart de sa valeur d'avant la rupture : 5 jours + le trou + aujourd'hui.
    expect(avecJoker.current).toBe(7);
  });

  it('ARRÊTE le comptage sur deux jours joker consécutifs, même si la base en contient', () => {
    // Garde-fou dans le calcul (règle 2) : on refuse de propager une série fausse.
    const active = new Set([...daysUpTo('2026-07-16', 5), '2026-07-20']);
    const deuxJokers = new Set(['2026-07-18', '2026-07-19']);

    const { current } = computeStreakWithJokers(active, deuxJokers, TODAY);
    // aujourd'hui + le 19 (joker) → on s'arrête avant le 18, second joker consécutif.
    expect(current).toBe(2);
  });

  it('accepte deux jokers non consécutifs', () => {
    // Actifs : 15, 17, 19, 20. Jokers sur 16 et 18 → jamais deux d'affilée.
    const active = new Set(['2026-07-15', '2026-07-17', '2026-07-19', '2026-07-20']);
    const { current } = computeStreakWithJokers(
      active,
      new Set(['2026-07-16', '2026-07-18']),
      TODAY,
    );
    expect(current).toBe(6);
  });

  it('rend 0 quand ni aujourd’hui ni hier ne tiennent', () => {
    const active = new Set(['2026-07-10']);
    expect(computeStreakWithJokers(active, new Set(), TODAY)).toEqual({
      current: 0,
      activeToday: false,
    });
  });

  it('n’invente pas d’activité : activeToday reste faux si seul un joker couvre aujourd’hui', () => {
    // Décision D3 — un joker protège le compteur, il ne rend pas le jour actif.
    const active = new Set(daysUpTo('2026-07-19', 3));
    const { activeToday } = computeStreakWithJokers(active, new Set([TODAY]), TODAY);
    expect(activeToday).toBe(false);
  });
});

describe('findRestorableGap', () => {
  const gap = (activeDays: string[], jokerDays: string[] = []) =>
    findRestorableGap({
      activeDays: new Set(activeDays),
      jokerDays: new Set(jokerDays),
      todayKey: TODAY,
    });

  it('propose le trou d’hier et annonce la série sauvée', () => {
    // Actifs 14→18 juillet, rien le 19, rien aujourd'hui.
    const found = gap(daysUpTo('2026-07-18', 5));
    expect(found).toEqual({ day: '2026-07-19', streakIfUsed: 6 });
  });

  it('ne propose RIEN sur un trou de deux jours — c’est une interruption réelle', () => {
    // Actifs 13→17, rien le 18 ni le 19.
    expect(gap(daysUpTo('2026-07-17', 5))).toBeNull();
  });

  it('ne propose rien s’il ne reste plus de joker ce mois-ci', () => {
    expect(gap(daysUpTo('2026-07-18', 5), ['2026-07-03'])).toBeNull();
  });

  it('propose de nouveau après un changement de mois', () => {
    // Le joker de juin ne bloque pas juillet.
    expect(gap(daysUpTo('2026-07-18', 5), ['2026-06-15'])).not.toBeNull();
  });

  it('ne propose rien au-delà de la fenêtre de 7 jours', () => {
    expect(JOKER_MAX_AGE_DAYS).toBe(7);
    // Série ancienne, trou bien au-delà de la fenêtre : aucune proposition.
    expect(gap(daysUpTo('2026-07-05', 5))).toBeNull();
  });

  it('ne propose rien quand il n’y a aucun trou', () => {
    expect(gap(daysUpTo(TODAY, 10))).toBeNull();
  });

  it('ne propose que le trou LE PLUS RÉCENT', () => {
    // Deux trous isolés : le 16 et le 19. On doit viser le 19 — réparer le 16 laisserait la
    // série rompue juste après.
    const active = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-17', '2026-07-18'];
    expect(gap(active)?.day).toBe('2026-07-19');
  });

  it('ne propose pas un trou déjà couvert par un joker', () => {
    const active = [...daysUpTo('2026-07-18', 5)];
    expect(gap(active, ['2026-07-19'])).toBeNull();
  });
});
