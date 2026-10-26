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
