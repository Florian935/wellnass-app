/**
 * US ACCUEIL-08 — **le fil du jour** : les gestes de la journée, horodatés, tous piliers.
 *
 * L'accueil répond d'abord à « où j'en suis aujourd'hui ? ». Les faits existaient tous (séances
 * planifiées et leur heure, repas aux heures apprises, pesée, check-ins, pas, activités) mais
 * dispersés : la carte « maintenant » n'en montrait qu'un, et rien ne disait ce qui était fait, ce
 * qui restait, ni à quelle heure. Ce module les range sur une seule ligne de temps et désigne
 * **l'action du moment** — c'est la référence de comportement de la toile validée le 25/10/2026
 * (`design/accueil-2026-10/Phone.dc.html`, `data()` et `renderVals()`).
 *
 * ── La règle de l'action du moment ───────────────────────────────────────────────────────────────
 *  1. ce qui **tourne déjà** (séance, course) passe avant tout — la table de `resolveNowAction` ;
 *  2. puis **le premier geste non fait**, dans l'ordre des heures, qu'il soit dû ou à venir
 *     (« À 18:00 · dans 5 h ») ; une suggestion (« Idée » : la marche) ne compte que dans sa
 *     fenêtre ; un geste **manqué** (sa fenêtre est passée) est sauté — on ne réclame pas le
 *     check-in du matin à 15 h ;
 *  3. sinon le **rattrapage** d'un repas manqué : la journée n'est pas faite tant qu'il manque ;
 *  4. sinon **la journée est faite** (ou rien de prévu) : le repli de `resolveNowAction`.
 *
 * ⚠️ Différence assumée avec `resolveNowAction` seul : la table plaçait la séance du jour avant les
 * repas dus, quelle que soit l'heure. Le fil suit l'horloge — à 12 h 40, c'est le déjeuner, et la
 * séance de 18 h vient ensuite dans « la suite » (toile validée, « Anatomie » à 12:40).
 *
 * **Journée faite** (règle validée le 25/10/2026) = la séance prévue faite (ou rien de prévu) **et**
 * chaque repas du jour noté — le check-in et le point du soir n'en font pas partie : ce sont des
 * gestes de bien-être, proposés, jamais exigés.
 *
 * Aucune lecture d'horloge : l'heure entre par `now.hour` (règle du dépôt).
 */

import { MORNING_UNTIL_HOUR } from './dashboard-moment';
import { MEAL_DUE_WINDOW_HOURS, mealsComplete, missedMeal, type MealSlot } from './meal-slots';
import {
  hasDoneSomething,
  resolveNowAction,
  restSuggestion,
  sortTrainingsByTime,
  type NowAction,
  type NowActionInput,
  type TodayTraining,
} from './now-action';

// ---------------------------------------------------------------------------
// Les repères horaires
// ---------------------------------------------------------------------------

/** Heure affichée du check-in du matin (la toile : 07:30). */
export const CHECKIN_HOUR = 7.5;
/** Heure affichée du point du soir. */
export const EVENING_POINT_HOUR = 21.5;
/** Heure retenue pour une séance planifiée sans heure (HORAIRE-01 ne l'impose pas). */
export const DEFAULT_TRAINING_HOUR = 18;
/** Après son échéance, la pesée reste « due » trois heures, comme un repas. */
export const WEIGH_DUE_WINDOW_HOURS = 3;
/** La marche suggérée (repos actif, objectif de pas) : heure affichée et fenêtre de suggestion. */
export const WALK_IDEA = { hour: 17.5, from: 16, until: 20.5 } as const;

// ---------------------------------------------------------------------------
// Les types
// ---------------------------------------------------------------------------

export type TimelineItemKind = 'checkin' | 'weigh' | 'meal' | 'training' | 'activity' | 'walk' | 'evening';
export type TimelinePillar = 'wellbeing' | 'home' | 'nutrition' | 'strength' | 'running';

/** Une séance ou une sortie **terminée** aujourd'hui. */
export interface DoneTraining {
  pillar: 'strength' | 'running';
  name: string;
  /** Heure locale de fin (décimale). */
  hour: number;
  durationMinutes: number | null;
  distanceM: number | null;
}

/** Une autre activité notée aujourd'hui (vélo, yoga…, AUTRE-01). */
export interface DoneActivity {
  activityType: string;
  /** Heure locale de début (décimale). */
  hour: number;
  durationMinutes: number;
}

export interface TimelineItem {
  /** Clé stable : `checkin`, `weigh`, `meal:lunch`, `training:<occurrence>`, `walk`, `evening`… */
  id: string;
  kind: TimelineItemKind;
  pillar: TimelinePillar;
  /** Heure locale décimale du geste. */
  hour: number;
  /** `false` pour une séance planifiée sans heure : l'heure affichée n'est qu'un rang. */
  timeKnown: boolean;
  done: boolean;
  /** « Idée » : ne compte dans la journée que si elle est faite. */
  suggested: boolean;
  /** En cours (séance ou course ouverte). */
  live: boolean;
  /** Fenêtre passée sans être fait : visible, jamais l'action du moment. */
  missed: boolean;
  meal?: MealSlot;
  /** Séance prévue (à faire). */
  training?: TodayTraining;
  /** Séance ou sortie terminée. */
  doneTraining?: DoneTraining;
  activity?: DoneActivity;
  /** Marche : pas restants avant l'objectif. */
  stepsLeft?: number;
}

/**
 * L'action du moment, telle que la carte la peint : les décisions de `resolveNowAction`, plus les
 * deux gestes que seul le fil connaît — le check-in du matin et la marche suggérée.
 */
export type DayNow = NowAction | { kind: 'checkin-due' } | { kind: 'walk-idea'; stepsLeft: number };

export interface DayTimelineInput {
  /** Les faits de la table de priorité (séances, repas, pesée, bien-être, décompte du jour). */
  now: NowActionInput;
  /** Check-in du matin (énergie) fait aujourd'hui. */
  checkinDone: boolean;
  /** Échéance de la pesée (heure apprise ou réglée). */
  weighInHour: number;
  weighInDone: boolean;
  doneTrainings: readonly DoneTraining[];
  activities: readonly DoneActivity[];
  /** Pas du jour : `tracked` = Health Connect en écrit (sinon une marche ne serait pas comptée). */
  steps: { tracked: boolean; today: number; goal: number };
}

export interface DayTimeline {
  /** Les gestes du jour, dans l'ordre des heures. */
  items: TimelineItem[];
  now: DayNow;
  /** Le geste du fil qui porte l'action du moment (`null` : compte rendu ou repli). */
  nowItemId: string | null;
  /** « x sur y » : les suggestions ne comptent que faites. */
  progress: { done: number; total: number };
  /** Séance prévue faite (ou rien de prévu) ET chaque repas noté ET au moins une trace. */
  dayDone: boolean;
}

// ---------------------------------------------------------------------------
// La construction
// ---------------------------------------------------------------------------

/** À heure égale, l'ordre d'une matinée : check-in, pesée, repas, séance… point du soir. */
const KIND_RANK: Record<TimelineItemKind, number> = {
  checkin: 0,
  weigh: 1,
  meal: 2,
  training: 3,
  activity: 4,
  walk: 5,
  evening: 6,
};

/** `HH:MM[:SS]` → heure décimale, ou `null` si la chaîne n'en est pas une. */
export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h + m / 60;
}

function item(base: Partial<TimelineItem> & Pick<TimelineItem, 'id' | 'kind' | 'pillar' | 'hour'>): TimelineItem {
  return { timeKnown: true, done: false, suggested: false, live: false, missed: false, ...base };
}

/** Les gestes du jour, sans l'action du moment. Exportée pour les tests et l'écran. */
export function timelineItems(input: DayTimelineInput): TimelineItem[] {
  const { now: facts } = input;
  const hour = facts.hour;
  const items: TimelineItem[] = [];

  // Le check-in et le point du soir : seulement à qui les pratique (garde d'habitude du bien-être).
  if (facts.wellbeingEnabled) {
    items.push(
      item({
        id: 'checkin',
        kind: 'checkin',
        pillar: 'wellbeing',
        hour: CHECKIN_HOUR,
        done: input.checkinDone,
        // « Ton énergie ce matin » n'a plus de sens après 11 h.
        missed: !input.checkinDone && hour >= MORNING_UNTIL_HOUR,
      }),
    );
  }

  // La pesée : seulement à qui se pèse (ACCUEIL-07).
  if (facts.weighInHabit) {
    items.push(
      item({
        id: 'weigh',
        kind: 'weigh',
        pillar: 'home',
        hour: input.weighInHour,
        done: input.weighInDone,
        missed: !input.weighInDone && hour >= input.weighInHour + WEIGH_DUE_WINDOW_HOURS,
      }),
    );
  }

  for (const slot of facts.meals) {
    items.push(
      item({
        id: `meal:${slot.key}`,
        kind: 'meal',
        pillar: 'nutrition',
        hour: slot.hour,
        done: slot.logged,
        missed: !slot.logged && hour >= slot.hour + MEAL_DUE_WINDOW_HOURS,
        meal: slot,
      }),
    );
  }

  // Les séances prévues, la plus proche d'abord ; celle qui tourne porte la pastille « En cours ».
  let liveWorkoutPlaced = false;
  let liveRunPlaced = false;
  for (const training of sortTrainingsByTime(facts.todayTrainings)) {
    const scheduled = parseClock(training.scheduledTime);
    let live = false;
    if (training.pillar === 'strength' && facts.activeWorkoutId && !liveWorkoutPlaced) {
      live = true;
      liveWorkoutPlaced = true;
    }
    if (training.pillar === 'running' && facts.hasActiveRun && !liveRunPlaced) {
      live = true;
      liveRunPlaced = true;
    }
    items.push(
      item({
        id: `training:${training.plannedSessionId}`,
        kind: 'training',
        pillar: training.pillar,
        hour: scheduled ?? DEFAULT_TRAINING_HOUR,
        timeKnown: scheduled !== null,
        live,
        training,
      }),
    );
  }
  // Une séance libre ou une course hors plan qui tourne a aussi sa ligne, à l'heure présente.
  if (facts.activeWorkoutId && !liveWorkoutPlaced) {
    items.push(item({ id: 'live:workout', kind: 'training', pillar: 'strength', hour, live: true }));
  }
  if (facts.hasActiveRun && !liveRunPlaced) {
    items.push(item({ id: 'live:run', kind: 'training', pillar: 'running', hour, live: true }));
  }

  input.doneTrainings.forEach((done, index) => {
    items.push(
      item({
        id: `done:${done.pillar}:${index}`,
        kind: 'training',
        pillar: done.pillar,
        hour: done.hour,
        done: true,
        doneTraining: done,
      }),
    );
  });

  input.activities.forEach((activity, index) => {
    items.push(
      item({ id: `activity:${index}`, kind: 'activity', pillar: 'home', hour: activity.hour, done: true, activity }),
    );
  });

  // La marche : repos actif quand rien n'est prévu, et seulement si les pas se comptent.
  if (input.steps.tracked && facts.todayTrainings.length === 0) {
    const stepsLeft = Math.max(0, input.steps.goal - input.steps.today);
    const reached = stepsLeft === 0;
    // Passée sa fenêtre, une idée non suivie disparaît : elle n'a plus rien à proposer.
    if (reached || hour <= WALK_IDEA.until) {
      items.push(
        item({
          id: 'walk',
          kind: 'walk',
          pillar: 'home',
          hour: WALK_IDEA.hour,
          done: reached,
          suggested: !reached,
          stepsLeft,
        }),
      );
    }
  }

  if (facts.wellbeingEnabled) {
    items.push(
      item({
        id: 'evening',
        kind: 'evening',
        pillar: 'wellbeing',
        hour: EVENING_POINT_HOUR,
        done: facts.wellbeingLogged,
      }),
    );
  }

  return items.sort((a, b) => a.hour - b.hour || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
}

/** Un geste du fil, traduit en décision que la carte sait peindre. */
function nowFor(it: TimelineItem, hour: number): DayNow | null {
  switch (it.kind) {
    case 'checkin':
      return { kind: 'checkin-due' };
    case 'weigh':
      return { kind: 'weigh-in-due' };
    case 'meal':
      return it.meal
        ? hour >= it.meal.hour
          ? { kind: 'meal-due', meal: it.meal }
          : { kind: 'meal-next', meal: it.meal }
        : null;
    case 'training':
      return it.training ? { kind: 'session-today', training: it.training } : null;
    case 'evening':
      return { kind: 'wellbeing-due' };
    case 'walk':
      return { kind: 'walk-idea', stepsLeft: it.stepsLeft ?? 0 };
    default:
      return null;
  }
}

/** Le fil du jour et son action du moment. */
export function buildDayTimeline(input: DayTimelineInput): DayTimeline {
  const facts = input.now;
  const hour = facts.hour;
  const items = timelineItems(input);

  const counted = items.filter((it) => !it.suggested || it.done);
  const progress = { done: counted.filter((it) => it.done).length, total: counted.length };
  const dayDone =
    facts.todayTrainings.length === 0 &&
    !facts.activeWorkoutId &&
    !facts.hasActiveRun &&
    mealsComplete(facts.meals) &&
    hasDoneSomething(facts.tally);

  const result = (now: DayNow, nowItemId: string | null): DayTimeline => ({
    items,
    now,
    nowItemId,
    progress,
    dayDone,
  });

  // 1 · Ce qui tourne déjà : la table de priorité tranche.
  const priority = resolveNowAction(facts);
  if (priority.kind === 'workout-active' || priority.kind === 'run-active') {
    const live = items.find(
      (it) => it.live && it.pillar === (priority.kind === 'workout-active' ? 'strength' : 'running'),
    );
    return result(priority, live?.id ?? null);
  }

  // 2 · Le premier geste non fait, dans l'ordre des heures.
  for (const it of items) {
    if (it.done || it.missed) continue;
    if (it.suggested && (hour < WALK_IDEA.from || hour > WALK_IDEA.until)) continue;
    const now = nowFor(it, hour);
    if (now) return result(now, it.id);
  }

  // 3 · Le rattrapage d'un repas manqué.
  const missed = missedMeal(facts.meals, hour);
  if (missed) return result({ kind: 'meal-missed', meal: missed }, `meal:${missed.key}`);

  // 4 · La journée est faite — ou il n'y avait rien de prévu.
  if (dayDone) return result({ kind: 'day-done', tally: facts.tally }, null);
  return result({ kind: 'idle', moment: facts.moment, suggestion: restSuggestion(facts) }, null);
}
