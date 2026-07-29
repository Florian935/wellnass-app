import { describe, expect, it } from 'vitest';

import {
  buildWeeklyReview,
  isEmptyWeek,
  lastClosedWeek,
  previousWeek,
  SIGNAL_ORDER,
  type PillarWeek,
  type ReviewGoal,
  type WeeklyReviewInput,
} from './weekly-review';

const week = (over: Partial<PillarWeek> = {}): PillarWeek => ({
  workouts: 3,
  tonnageKg: 12_000,
  runs: 2,
  distanceM: 20_000,
  loggedDays: 6,
  daysInTarget: 5,
  activeDays: 5,
  ...over,
});

const allPillars = { strength: true, running: true, nutrition: true };

const input = (over: Partial<WeeklyReviewInput> = {}): WeeklyReviewInput => ({
  period: { start: '2026-07-20', end: '2026-07-26' },
  current: week(),
  previous: week(),
  recordsBeaten: 0,
  goals: [],
  underworkedMuscle: null,
  activePillars: allPillars,
  ...over,
});

describe('fenêtre de la semaine close', () => {
  it('prend la semaine lundi→dimanche PRÉCÉDENTE, un mercredi', () => {
    // Mercredi 29/07/2026 → semaine close = lundi 20 au dimanche 26.
    expect(lastClosedWeek(new Date(2026, 6, 29))).toEqual({
      start: '2026-07-20',
      end: '2026-07-26',
    });
  });

  it('un DIMANCHE, montre encore la semaine d’avant — la semaine en cours n’est pas finie', () => {
    // C'est le cas limite qui compte : résumer une semaine non terminée serait faux.
    expect(lastClosedWeek(new Date(2026, 6, 26))).toEqual({
      start: '2026-07-13',
      end: '2026-07-19',
    });
  });

  it('un LUNDI, la semaine qui vient de se clore est celle qu’on résume', () => {
    expect(lastClosedWeek(new Date(2026, 6, 27))).toEqual({
      start: '2026-07-20',
      end: '2026-07-26',
    });
  });

  it('la semaine de comparaison est les 7 jours qui précèdent', () => {
    expect(previousWeek({ start: '2026-07-20', end: '2026-07-26' })).toEqual({
      start: '2026-07-13',
      end: '2026-07-19',
    });
  });

  it('traverse un changement de mois sans se tromper', () => {
    expect(lastClosedWeek(new Date(2026, 7, 3))).toEqual({
      start: '2026-07-27',
      end: '2026-08-02',
    });
  });
});

describe('semaine vide', () => {
  const empty = week({
    workouts: 0,
    tonnageKg: 0,
    runs: 0,
    distanceM: 0,
    loggedDays: 0,
    daysInTarget: null,
    activeDays: 0,
  });

  it('est détectée', () => {
    expect(isEmptyWeek(empty)).toBe(true);
    expect(isEmptyWeek(week())).toBe(false);
  });

  it('ne produit AUCUNE décision — rien à conseiller, et rien à reprocher', () => {
    const r = buildWeeklyReview(input({ current: empty }));
    expect(r.isEmpty).toBe(true);
    expect(r.decision).toBeNull();
  });

  it('un jour de journal seul suffit à ne plus être vide', () => {
    expect(isEmptyWeek({ ...empty, loggedDays: 1 })).toBe(false);
  });
});

describe('comparaison à la semaine précédente', () => {
  it('ne compare RIEN au premier usage — pas de « +100 % » depuis zéro', () => {
    const r = buildWeeklyReview(input({ previous: null }));
    expect(r.changes.tonnage).toBeNull();
    expect(r.changes.distance).toBeNull();
    expect(r.changes.activeDays).toBeNull();
    expect(r.changes.loggedDays).toBeNull();
  });

  it('calcule les variations quand la semaine précédente existe', () => {
    const r = buildWeeklyReview(
      input({ current: week({ tonnageKg: 15_000 }), previous: week({ tonnageKg: 10_000 }) }),
    );
    expect(r.changes.tonnage).toEqual({ pct: 50, direction: 'up' });
  });
});

describe('la décision unique — ordre de priorité', () => {
  const behindGoal: ReviewGoal = {
    id: 'g1',
    label: 'Développé couché',
    ratio: 0.2,
    elapsedRatio: 0.6, // 40 points de retard
  };

  it('1. un objectif en retard passe AVANT tout le reste', () => {
    // On empile volontairement tous les autres signaux : l'objectif doit gagner.
    const r = buildWeeklyReview(
      input({
        goals: [behindGoal],
        current: week({ activeDays: 0 }),
        underworkedMuscle: 'back',
      }),
    );
    expect(r.decision?.kind).toBe('goal_behind');
    expect(r.decision?.subject).toBe('Développé couché');
    // Les chiffres qui JUSTIFIENT le conseil accompagnent le signal.
    expect(r.decision?.metrics).toEqual({ progressPct: 20, elapsedPct: 60 });
  });

  it('ignore un objectif dont la progression est NON CALCULABLE', () => {
    // Exercice supprimé : un retard indéterminable n'est pas un retard, l'annoncer serait une
    // accusation sans preuve.
    const r = buildWeeklyReview(
      input({ goals: [{ ...behindGoal, ratio: null }], underworkedMuscle: 'back' }),
    );
    expect(r.decision?.kind).toBe('muscle_imbalance');
  });

  it('ne signale pas un retard sous le seuil de 15 points', () => {
    const r = buildWeeklyReview(
      input({ goals: [{ ...behindGoal, ratio: 0.5, elapsedRatio: 0.6 }] }),
    );
    expect(r.decision?.kind).not.toBe('goal_behind');
  });

  it('retient l’objectif le PLUS en retard quand plusieurs le sont', () => {
    const r = buildWeeklyReview(
      input({
        goals: [
          { id: 'a', label: 'Squat', ratio: 0.4, elapsedRatio: 0.6 },
          { id: 'b', label: 'Semi-marathon', ratio: 0.1, elapsedRatio: 0.8 },
        ],
      }),
    );
    expect(r.decision?.subject).toBe('Semi-marathon');
  });

  it('2. la régularité passe avant le déséquilibre musculaire', () => {
    const r = buildWeeklyReview(
      input({ current: week({ activeDays: 1 }), previous: week({ activeDays: 5 }), underworkedMuscle: 'back' }),
    );
    expect(r.decision?.kind).toBe('consistency_drop');
    expect(r.decision?.metrics).toEqual({ activeDays: 1, previousActiveDays: 5 });
  });

  it('2bis. zéro jour actif déclenche la régularité même SANS semaine précédente', () => {
    const r = buildWeeklyReview(
      input({ current: week({ activeDays: 0, workouts: 0, runs: 0 }), previous: null }),
    );
    expect(r.decision?.kind).toBe('consistency_drop');
  });

  it('ne déclenche pas la régularité pour une baisse de 2 jours', () => {
    const r = buildWeeklyReview(
      input({ current: week({ activeDays: 4 }), previous: week({ activeDays: 6 }) }),
    );
    expect(r.decision?.kind).not.toBe('consistency_drop');
  });

  it('3. le déséquilibre musculaire, si la muscu est activée', () => {
    const r = buildWeeklyReview(input({ underworkedMuscle: 'back' }));
    expect(r.decision?.kind).toBe('muscle_imbalance');
    expect(r.decision?.subject).toBe('back');
  });

  it('3bis. muscu DÉSACTIVÉE → aucun signal musculaire, on passe au suivant', () => {
    const r = buildWeeklyReview(
      input({
        underworkedMuscle: 'back',
        activePillars: { strength: false, running: true, nutrition: true },
      }),
    );
    expect(r.decision?.kind).not.toBe('muscle_imbalance');
  });

  it('4. une chute de tonnage de 25 % ou plus', () => {
    const r = buildWeeklyReview(
      input({ current: week({ tonnageKg: 6_000 }), previous: week({ tonnageKg: 12_000 }) }),
    );
    expect(r.decision?.kind).toBe('volume_drop');
    // Le pourcentage est présenté en valeur ABSOLUE : le sens est porté par le texte i18n.
    expect(r.decision?.metrics['dropPct']).toBe(50);
  });

  it('4bis. une chute de distance quand la course est active', () => {
    const r = buildWeeklyReview(
      input({
        current: week({ distanceM: 5_000 }),
        previous: week({ distanceM: 20_000 }),
      }),
    );
    expect(r.decision?.kind).toBe('volume_drop');
    expect(r.decision?.metrics['dropPct']).toBe(75);
  });

  it('4ter. course désactivée → une chute de distance ne déclenche rien', () => {
    const r = buildWeeklyReview(
      input({
        current: week({ distanceM: 0 }),
        previous: week({ distanceM: 20_000 }),
        activePillars: { strength: true, running: false, nutrition: true },
      }),
    );
    expect(r.decision?.kind).not.toBe('volume_drop');
  });

  it('5. l’adhérence nutrition, en DERNIER — on n’ouvre pas la semaine sur l’alimentation', () => {
    const r = buildWeeklyReview(
      input({ current: week({ loggedDays: 6, daysInTarget: 1 }) }),
    );
    expect(r.decision?.kind).toBe('nutrition_drift');
    expect(r.decision?.metrics).toEqual({ daysInTarget: 1, loggedDays: 6 });
  });

  it('5bis. aucune cible calorique → pas de signal nutrition (et non « 0 sur 6 »)', () => {
    const r = buildWeeklyReview(input({ current: week({ daysInTarget: null }) }));
    expect(r.decision?.kind).toBe('all_good');
  });

  it('6. semaine sans rien à redire : on NOMME le point fort', () => {
    const r = buildWeeklyReview(input({ recordsBeaten: 2 }));
    expect(r.decision?.kind).toBe('all_good');
    expect(r.decision?.metrics).toEqual({
      activeDays: 5,
      workouts: 3,
      runs: 2,
      recordsBeaten: 2,
    });
  });
});

describe('contrat « aucune narration sans chiffres »', () => {
  it('toute décision transporte au moins un chiffre', () => {
    // Les 6 signaux, provoqués un par un : aucun ne doit pouvoir sortir sans métrique.
    const cases: WeeklyReviewInput[] = [
      input({ goals: [{ id: 'g', label: 'X', ratio: 0.1, elapsedRatio: 0.9 }] }),
      input({ current: week({ activeDays: 0 }) }),
      input({ underworkedMuscle: 'back' }),
      input({ current: week({ tonnageKg: 1_000 }), previous: week({ tonnageKg: 12_000 }) }),
      input({ current: week({ loggedDays: 7, daysInTarget: 0 }) }),
      input(),
    ];

    const kinds = cases.map((c) => {
      const decision = buildWeeklyReview(c).decision;
      expect(decision).not.toBeNull();
      expect(Object.keys(decision!.metrics).length).toBeGreaterThan(0);
      return decision!.kind;
    });

    // Et au passage : les 6 cas couvrent bien les 6 signaux déclarés, dans l'ordre de priorité.
    expect(kinds).toEqual([...SIGNAL_ORDER]);
  });
});
