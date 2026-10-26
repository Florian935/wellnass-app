import { describe, expect, it } from 'vitest';
import {
  CHECKIN_HOUR,
  DEFAULT_TRAINING_HOUR,
  buildDayTimeline,
  parseClock,
  timelineItems,
  type DayTimelineInput,
} from './day-timeline';
import type { MealSlot } from './meal-slots';
import type { DayTally, NowActionInput, TodayTraining } from './now-action';

// ---------------------------------------------------------------------------
// La journée de la toile : « séance » (design/accueil-2026-10/Phone.dc.html, `data('seance')`)
// ---------------------------------------------------------------------------

const tally = (over: Partial<DayTally> = {}): DayTally => ({
  strengthSessions: 0,
  runs: 0,
  mealsLogged: 0,
  streak: 12,
  ...over,
});

function meal(key: string, hour: number, logged = false): MealSlot {
  return { key, label: null, hour, learned: true, logged };
}

const legs: TodayTraining = {
  pillar: 'strength',
  name: 'Jambes',
  scheduledTime: '18:00:00',
  exerciseCount: 6,
  targetDistanceM: null,
  targetDurationSeconds: null,
  programName: 'PPL',
  plannedSessionId: 'ps-legs',
  sessionId: 's-legs',
};

/** La journée de séance à `hour` ; `logged` = repas déjà notés. */
function seance(
  hour: number,
  over: Partial<NowActionInput> = {},
  extra: Partial<Omit<DayTimelineInput, 'now'>> = {},
  logged: readonly string[] = [],
): DayTimelineInput {
  return {
    now: {
      hour,
      moment: hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening',
      activeWorkoutId: null,
      hasActiveRun: false,
      todayTrainings: [legs],
      meals: [
        meal('breakfast', 8, logged.includes('breakfast')),
        meal('lunch', 12.5, logged.includes('lunch')),
        meal('dinner', 20, logged.includes('dinner')),
      ],
      nutritionActive: true,
      weighInDue: false,
      weighInHabit: true,
      wellbeingLogged: false,
      wellbeingEnabled: true,
      strengthActive: true,
      hasStrengthProgram: true,
      tally: tally({ mealsLogged: logged.length }),
      ...over,
    },
    checkinDone: false,
    weighInHour: 7.75,
    weighInDone: false,
    doneTrainings: [],
    activities: [],
    steps: { tracked: true, today: 4200, goal: 8000 },
    ...extra,
  };
}

describe('parseClock', () => {
  it('lit HH:MM et HH:MM:SS, refuse le reste', () => {
    expect(parseClock('18:30:00')).toBe(18.5);
    expect(parseClock('7:15')).toBe(7.25);
    expect(parseClock('bientôt')).toBeNull();
    expect(parseClock(null)).toBeNull();
    expect(parseClock('25:00')).toBeNull();
  });
});

describe('les gestes du jour', () => {
  it('range la journée dans l’ordre des heures, tous piliers', () => {
    const items = timelineItems(seance(12.67));
    expect(items.map((i) => i.id)).toEqual([
      'checkin',
      'weigh',
      'meal:breakfast',
      'meal:lunch',
      'training:ps-legs',
      'meal:dinner',
      'evening',
    ]);
  });

  it('🔴 check-in et point du soir seulement à qui les pratique (garde d’habitude)', () => {
    const ids = timelineItems(seance(10, { wellbeingEnabled: false })).map((i) => i.id);
    expect(ids).not.toContain('checkin');
    expect(ids).not.toContain('evening');
  });

  it('🔴 la pesée seulement à qui se pèse', () => {
    expect(timelineItems(seance(10, { weighInHabit: false })).map((i) => i.id)).not.toContain('weigh');
  });

  it('un geste dont la fenêtre est passée est « manqué », jamais imposé', () => {
    const items = timelineItems(seance(15));
    expect(items.find((i) => i.id === 'checkin')).toMatchObject({ done: false, missed: true });
    expect(items.find((i) => i.id === 'meal:breakfast')).toMatchObject({ missed: true });
    expect(items.find((i) => i.id === 'meal:lunch')).toMatchObject({ missed: false });
  });

  it('une séance sans heure se range à 18 h, signalée comme telle', () => {
    const noTime = { ...legs, scheduledTime: null };
    const item = timelineItems(seance(9, { todayTrainings: [noTime] })).find((i) => i.kind === 'training');
    expect(item).toMatchObject({ hour: DEFAULT_TRAINING_HOUR, timeKnown: false });
  });

  it('ce qui est fait aujourd’hui apparaît fait : séance terminée, activité notée', () => {
    const items = timelineItems(
      seance(
        19,
        { todayTrainings: [] },
        {
          doneTrainings: [{ pillar: 'strength', name: 'Jambes', hour: 18.9, durationMinutes: 58, distanceM: null }],
          activities: [{ activityType: 'cycling', hour: 7, durationMinutes: 45 }],
        },
      ),
    );
    expect(items.find((i) => i.kind === 'training')).toMatchObject({ done: true, hour: 18.9 });
    expect(items.find((i) => i.kind === 'activity')).toMatchObject({ done: true });
  });

  it('la marche n’est proposée qu’un jour sans séance, pas suivis, et disparaît passée sa fenêtre', () => {
    const rest = { todayTrainings: [] };
    expect(timelineItems(seance(15, rest)).find((i) => i.id === 'walk')).toMatchObject({
      suggested: true,
      stepsLeft: 3800,
    });
    expect(timelineItems(seance(15)).find((i) => i.id === 'walk')).toBeUndefined();
    expect(
      timelineItems(seance(15, rest, { steps: { tracked: false, today: 0, goal: 8000 } })).find(
        (i) => i.id === 'walk',
      ),
    ).toBeUndefined();
    expect(timelineItems(seance(21, rest)).find((i) => i.id === 'walk')).toBeUndefined();
    // Objectif atteint : la marche est faite, et le reste même le soir.
    expect(
      timelineItems(seance(21, rest, { steps: { tracked: true, today: 8400, goal: 8000 } })).find(
        (i) => i.id === 'walk',
      ),
    ).toMatchObject({ done: true, suggested: false });
  });
});

describe('l’action du moment', () => {
  it('🔴 à 12 h 40, c’est le déjeuner — pas la séance de 18 h (toile, « Anatomie »)', () => {
    const tl = buildDayTimeline(
      seance(12.67, {}, { checkinDone: true, weighInDone: true }, ['breakfast']),
    );
    expect(tl.now).toMatchObject({ kind: 'meal-due', meal: { key: 'lunch' } });
    expect(tl.nowItemId).toBe('meal:lunch');
    // Check-in, pesée, petit-déj : 3 sur 7.
    expect(tl.progress).toEqual({ done: 3, total: 7 });
  });

  it('à 7 h, rien de fait : le check-in à venir (« À 07:30 »)', () => {
    const tl = buildDayTimeline(seance(7));
    expect(tl.now).toEqual({ kind: 'checkin-due' });
    expect(tl.items.find((i) => i.id === tl.nowItemId)?.hour).toBe(CHECKIN_HOUR);
  });

  it('un repas pas encore arrivé est annoncé, pas réclamé', () => {
    const tl = buildDayTimeline(seance(10, {}, { checkinDone: true, weighInDone: true }, ['breakfast']));
    expect(tl.now).toMatchObject({ kind: 'meal-next', meal: { key: 'lunch' } });
  });

  it('l’après-midi, repas notés : la séance du soir', () => {
    const tl = buildDayTimeline(
      seance(15, {}, { checkinDone: true, weighInDone: true }, ['breakfast', 'lunch']),
    );
    expect(tl.now).toMatchObject({ kind: 'session-today', training: { name: 'Jambes' } });
  });

  it('🔴 un geste manqué n’est jamais l’action du moment (check-in à 15 h, petit-déj oublié)', () => {
    const tl = buildDayTimeline(seance(15, {}, { weighInDone: true }, ['lunch']));
    expect(tl.now.kind).toBe('session-today');
  });

  it('une séance en cours passe avant tout, et sa ligne porte « En cours »', () => {
    const tl = buildDayTimeline(seance(18.4, { activeWorkoutId: 'w-1' }));
    expect(tl.now).toEqual({ kind: 'workout-active', workoutId: 'w-1' });
    expect(tl.items.find((i) => i.id === 'training:ps-legs')).toMatchObject({ live: true });
    expect(tl.nowItemId).toBe('training:ps-legs');
  });

  it('une séance libre en cours a sa ligne à l’heure présente', () => {
    const tl = buildDayTimeline(seance(11, { activeWorkoutId: 'w-2', todayTrainings: [] }));
    expect(tl.items.find((i) => i.id === 'live:workout')).toMatchObject({ live: true, hour: 11 });
  });

  it('le soir, séance faite et repas notés : le point du soir, et la journée est faite', () => {
    const tl = buildDayTimeline(
      seance(
        21.6,
        { todayTrainings: [], tally: tally({ strengthSessions: 1, mealsLogged: 3 }) },
        { checkinDone: true, weighInDone: true },
        ['breakfast', 'lunch', 'dinner'],
      ),
    );
    expect(tl.now).toEqual({ kind: 'wellbeing-due' });
    expect(tl.dayDone).toBe(true);
  });

  it('tout fait : « Ta journée est faite »', () => {
    const tl = buildDayTimeline(
      seance(
        22.5,
        { todayTrainings: [], wellbeingLogged: true, tally: tally({ strengthSessions: 1, mealsLogged: 3 }) },
        { checkinDone: true, weighInDone: true },
        ['breakfast', 'lunch', 'dinner'],
      ),
    );
    expect(tl.now.kind).toBe('day-done');
    expect(tl.nowItemId).toBeNull();
  });

  it('🔴 un repas manqué empêche « journée faite » et se propose en rattrapage, en dernier', () => {
    const tl = buildDayTimeline(
      seance(
        22.5,
        { todayTrainings: [], wellbeingLogged: true, tally: tally({ strengthSessions: 1, mealsLogged: 2 }) },
        { checkinDone: true, weighInDone: true },
        ['lunch', 'dinner'],
      ),
    );
    expect(tl.dayDone).toBe(false);
    expect(tl.now).toMatchObject({ kind: 'meal-missed', meal: { key: 'breakfast' } });
  });

  it('jour de repos, nutrition seule, à 17 h : la marche suggérée, dans sa fenêtre', () => {
    const tl = buildDayTimeline(
      seance(
        17,
        { todayTrainings: [], strengthActive: false, wellbeingEnabled: false, weighInHabit: false },
        {},
        ['breakfast', 'lunch'],
      ),
    );
    expect(tl.now).toEqual({ kind: 'walk-idea', stepsLeft: 3800 });
    // L'idée ne compte pas dans « x sur y » tant qu'elle n'est pas faite.
    expect(tl.progress).toEqual({ done: 2, total: 3 });
  });

  it('avant la fenêtre, la marche attend : le prochain geste réel passe devant', () => {
    const tl = buildDayTimeline(
      seance(13, { todayTrainings: [], strengthActive: false, wellbeingEnabled: false, weighInHabit: false }, {}, [
        'breakfast',
        'lunch',
      ]),
    );
    expect(tl.now).toMatchObject({ kind: 'meal-next', meal: { key: 'dinner' } });
  });

  it('rien de prévu, rien à suggérer : le repli de la table, avec un geste qui a du sens', () => {
    const tl = buildDayTimeline(
      seance(
        10,
        {
          todayTrainings: [],
          meals: [],
          nutritionActive: false,
          wellbeingEnabled: false,
          weighInHabit: false,
          hasStrengthProgram: true,
        },
        { steps: { tracked: false, today: 0, goal: 8000 } },
      ),
    );
    expect(tl.now).toMatchObject({ kind: 'idle', suggestion: 'activity' });
    expect(tl.items).toEqual([]);
  });

  it('rend toujours une décision, à toute heure', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const tl = buildDayTimeline(seance(h));
      expect(tl.now).toBeDefined();
    }
  });
});
