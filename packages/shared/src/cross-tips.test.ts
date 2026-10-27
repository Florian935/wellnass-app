import { describe, expect, it } from 'vitest';
import { crossTip, type CrossTipFacts } from './cross-tips';
import type { DayNow } from './day-timeline';
import type { MealSlot } from './meal-slots';
import type { TodayTraining } from './now-action';

const lunch: MealSlot = { key: 'lunch', label: null, hour: 12.5, learned: true, logged: false };
const dinner: MealSlot = { key: 'dinner', label: null, hour: 20, learned: true, logged: false };

const legs: TodayTraining = {
  pillar: 'strength',
  name: 'Jambes',
  scheduledTime: '18:00:00',
  exerciseCount: 6,
  targetDistanceM: null,
  targetDurationSeconds: null,
  programName: null,
  plannedSessionId: 'p',
  sessionId: 's',
};

const facts = (over: Partial<CrossTipFacts> = {}): CrossTipFacts => ({
  pendingTrainings: [],
  trainedPillar: null,
  trainingBonusKcal: 0,
  proteinGapG: null,
  ...over,
});

describe('crossTip — les piliers se parlent au bon moment (constat 13)', () => {
  it('🔴 « Jambes ce soir » : le déjeuner devient le carburant de la séance', () => {
    expect(crossTip({ kind: 'meal-due', meal: lunch }, facts({ pendingTrainings: [legs] }))).toEqual({
      key: 'home.tips.beforeStrengthNamed',
      params: { name: 'Jambes' },
      tag: 'strength-nutrition',
    });
  });

  it('une sortie de course plus tard : des glucides à ce repas', () => {
    const run = { ...legs, pillar: 'running' as const, name: '' };
    expect(crossTip({ kind: 'meal-next', meal: lunch }, facts({ pendingTrainings: [run] }))?.key).toBe(
      'home.tips.beforeRun',
    );
  });

  it('pas d’astuce « avant la séance » pour un repas pris APRÈS elle', () => {
    expect(crossTip({ kind: 'meal-due', meal: dinner }, facts({ pendingTrainings: [legs] }))).toBeNull();
  });

  it('séance faite et bonus de kcal : « +250 kcal gagnés par ta séance »', () => {
    expect(
      crossTip({ kind: 'meal-due', meal: dinner }, facts({ trainedPillar: 'strength', trainingBonusKcal: 250 })),
    ).toEqual({ key: 'home.tips.afterTraining', params: { kcal: 250 }, tag: 'strength-nutrition' });
  });

  it('l’écart de protéines, arrondi à 5 g, au-delà de 30 g', () => {
    expect(crossTip({ kind: 'meal-due', meal: lunch }, facts({ proteinGapG: 47 }))).toEqual({
      key: 'home.tips.proteinGap',
      params: { grams: 45 },
      tag: 'nutrition',
    });
    expect(crossTip({ kind: 'meal-due', meal: lunch }, facts({ proteinGapG: 20 }))).toBeNull();
  });

  it('seuls les repas portent une astuce', () => {
    const others: DayNow[] = [{ kind: 'checkin-due' }, { kind: 'weigh-in-due' }, { kind: 'wellbeing-due' }];
    for (const now of others) expect(crossTip(now, facts({ pendingTrainings: [legs], proteinGapG: 60 }))).toBeNull();
  });
});

describe('US ACCUEIL-09 — les astuces enrichies', () => {
  const session: DayNow = { kind: 'session-today', training: legs };
  const run: DayNow = { kind: 'session-today', training: { ...legs, pillar: 'running', name: 'Footing' } };
  const squat = { exerciseName: 'Squat', gapKind: 'kg' as const, gap: 2.5 };

  it('🔴 forme au rouge avant la séance : on le dit AVANT le record à portée', () => {
    // Pousser un record un jour de « repos conseillé » serait un conseil contradictoire.
    expect(crossTip(session, facts({ readinessVerdict: 'rest', nearRecord: squat }))).toEqual({
      key: 'home.tips.sessionRest',
      params: {},
      tag: 'readiness-strength',
    });
  });

  it('« Squat : à 2,5 kg de ton record » sur la carte de la séance', () => {
    expect(crossTip(session, facts({ nearRecord: squat }))).toEqual({
      key: 'home.tips.nearRecordKg',
      params: { exercise: 'Squat', gap: 2.5 },
      tag: 'strength-record',
    });
  });

  it('à portée en répétitions : le nombre de répétitions qui manquent', () => {
    expect(crossTip(session, facts({ nearRecord: { exerciseName: 'Tractions', gapKind: 'reps', gap: 1 } }))).toEqual({
      key: 'home.tips.nearRecordReps',
      params: { exercise: 'Tractions', count: 1 },
      tag: 'strength-record',
    });
  });

  it('tous les signaux au vert, sans record à portée : c’est le jour de pousser', () => {
    expect(crossTip(session, facts({ readinessVerdict: 'push' }))?.key).toBe('home.tips.sessionPush');
  });

  it('une sortie de course un jour de « repos conseillé » : facile, sans chrono — pas de record de muscu', () => {
    expect(crossTip(run, facts({ readinessVerdict: 'rest', nearRecord: squat }))).toEqual({
      key: 'home.tips.runRest',
      params: {},
      tag: 'readiness-running',
    });
    expect(crossTip(run, facts({ nearRecord: squat }))).toBeNull();
  });

  it('forme « correcte » et rien à portée : la carte de la séance n’a pas d’astuce', () => {
    expect(crossTip(session, facts({ readinessVerdict: 'ok' }))).toBeNull();
  });

  it('🔴 « Vise ~25 g de protéines à ce repas » : l’écart du jour réparti sur les repas qui restent', () => {
    expect(crossTip({ kind: 'meal-due', meal: lunch }, facts({ proteinGapG: 72, mealsLeft: 3 }))).toEqual({
      key: 'home.tips.proteinPerMeal',
      params: { grams: 25 },
      tag: 'nutrition',
    });
  });

  it('dernier repas de la journée : l’écart entier, comme avant', () => {
    expect(crossTip({ kind: 'meal-due', meal: dinner }, facts({ proteinGapG: 47, mealsLeft: 1 }))?.key).toBe(
      'home.tips.proteinGap',
    );
  });

  it('la séance qui arrive passe toujours devant les protéines', () => {
    expect(
      crossTip({ kind: 'meal-due', meal: lunch }, facts({ pendingTrainings: [legs], proteinGapG: 72, mealsLeft: 3 }))?.key,
    ).toBe('home.tips.beforeStrengthNamed');
  });
});
