/**
 * US ACCUEIL-08 — les sections de l'accueil « Ta journée » : **les cadrans**, **la semaine** et
 * **Du nouveau**. Trois briques pures, testées, pour que l'écran ne fasse que peindre.
 *
 *  - `buildDayDials` — les trois cadrans transverses Bouger · Manger · Récupérer (décision D2 du
 *    25/10/2026), chacun visible seulement si son pilier est actif ; « Marcher » remplace Bouger
 *    pour un compte nutrition seule.
 *  - `buildWeekStrip` — « Ta semaine » : sept colonnes, une pastille par pilier actif (plein = fait,
 *    pointillé = prévu), et le résumé « 3 séances sur 5 · 3 jours dans ta cible ». Remplace les
 *    anneaux, la Régularité, « La suite » et le bilan du lundi.
 *  - `selectHomeNews` — « Du nouveau » : deux cartes au plus, dans un ordre écrit une fois.
 *
 * Aucune lecture d'horloge : les jours et l'heure entrent par paramètre (règle du dépôt).
 */

import { addDays, localDateFromDayKey, localDayKey } from './date';
import type { Pillar } from './pillar';
import type { ReadinessComponentState, ReadinessResult, ReadinessVerdict } from './readiness';

// ---------------------------------------------------------------------------
// Les cadrans
// ---------------------------------------------------------------------------

/** La couleur d'un segment de cadran, en rôle (l'écran la traduit selon la scène). */
export type DialTone =
  | 'strength'
  | 'running'
  | 'strength-soft'
  | 'running-soft'
  | 'idle'
  | 'positive'
  | 'neutral'
  | 'negative';

/** Une séance de la semaine, pour le cadran Bouger. */
export interface WeekSession {
  pillar: 'strength' | 'running';
  dayKey: string;
  done: boolean;
}

export type DayDial =
  | { key: 'move'; done: number; total: number; restToday: boolean; segments: DialTone[] }
  | {
      key: 'eat';
      consumed: number;
      target: number | null;
      /** Kcal restantes (négatif = cible dépassée), `null` sans cible. */
      remaining: number | null;
      /** Avancement dans [0, 1] de l'anneau continu. */
      progress: number;
      proteinG: number;
      proteinTarget: number | null;
    }
  | { key: 'walk'; steps: number; goal: number; progress: number }
  | {
      key: 'recover';
      /** Le check-in du matin n'est pas fait : « ? », et renvoi vers le geste. */
      pending: boolean;
      verdict: ReadinessVerdict | null;
      segments: DialTone[];
    };

export interface DayDialsInput {
  pillars: readonly Pillar[];
  todayKey: string;
  weekSessions: readonly WeekSession[];
  nutrition: { consumed: number; target: number | null; proteinG: number; proteinTarget: number | null };
  steps: { tracked: boolean; today: number; goal: number };
  readiness: Pick<ReadinessResult, 'show' | 'verdict' | 'load' | 'nutrition' | 'wellbeing'>;
  /** Le check-in du matin est attendu (pratiqué, pas encore fait, avant 11 h). */
  checkinPending: boolean;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

function toneOf(state: ReadinessComponentState): DialTone {
  return state === 'unavailable' ? 'idle' : state;
}

/**
 * Les cadrans du jour, dans l'ordre Bouger · Manger · Récupérer (ou Manger · Marcher).
 *
 * - **Bouger** : musculation ou course actives **et** au moins une séance cette semaine (prévue ou
 *   faite). Un segment par séance : faite = couleur du pilier, celle du jour pas encore faite = pâle,
 *   les autres = éteintes.
 * - **Manger** : nutrition active. Kcal restantes sur la cible du jour, et les protéines.
 * - **Marcher** : nutrition seule (aucun pilier d'entraînement) et pas suivis.
 * - **Récupérer** : la charge existe (un pilier d'entraînement est actif) **et** le verdict TRI-03 a
 *   de quoi se dire — ou le check-in du matin l'attend.
 */
export function buildDayDials(input: DayDialsInput): DayDial[] {
  const dials: DayDial[] = [];
  const training = input.pillars.includes('strength') || input.pillars.includes('running');

  if (training) {
    const sessions = input.weekSessions.filter((s) => input.pillars.includes(s.pillar));
    if (sessions.length > 0) {
      const ordered = [...sessions].sort(
        (a, b) => a.dayKey.localeCompare(b.dayKey) || (a.pillar === b.pillar ? 0 : a.pillar === 'strength' ? -1 : 1),
      );
      dials.push({
        key: 'move',
        done: ordered.filter((s) => s.done).length,
        total: ordered.length,
        restToday: !ordered.some((s) => s.dayKey === input.todayKey),
        segments: ordered.map((s) =>
          s.done ? s.pillar : s.dayKey === input.todayKey ? (`${s.pillar}-soft` as DialTone) : 'idle',
        ),
      });
    }
  }

  if (input.pillars.includes('nutrition')) {
    const { consumed, target, proteinG, proteinTarget } = input.nutrition;
    dials.push({
      key: 'eat',
      consumed: Math.round(consumed),
      target,
      remaining: target !== null ? Math.round(target - consumed) : null,
      progress: target !== null && target > 0 ? clamp01(consumed / target) : 0,
      proteinG: Math.round(proteinG),
      proteinTarget,
    });
    if (!training && input.steps.tracked) {
      dials.push({
        key: 'walk',
        steps: input.steps.today,
        goal: input.steps.goal,
        progress: input.steps.goal > 0 ? clamp01(input.steps.today / input.steps.goal) : 0,
      });
    }
  }

  if (training && (input.readiness.show || input.checkinPending)) {
    dials.push({
      key: 'recover',
      pending: input.checkinPending,
      verdict: input.readiness.show ? input.readiness.verdict : null,
      segments: [
        toneOf(input.readiness.load.state),
        toneOf(input.readiness.nutrition.state),
        toneOf(input.readiness.wellbeing.state),
      ],
    });
  }

  return dials;
}

// ---------------------------------------------------------------------------
// Ta semaine
// ---------------------------------------------------------------------------

/** L'état d'une pastille : fait, prévu (pointillé), saisi hors cible (pâle), rien. */
export type WeekMark = 'done' | 'planned' | 'logged' | 'idle';

export interface WeekStripDay {
  key: string;
  /** 1 = lundi … 7 = dimanche. */
  weekday: number;
  /** Jour du mois. */
  dayOfMonth: number;
  isToday: boolean;
  /** Jour d'une période « vie réelle » (hachuré). */
  paused: boolean;
  marks: Partial<Record<Pillar, WeekMark>>;
}

export interface WeekStripInput {
  weekStartKey: string;
  todayKey: string;
  pillars: readonly Pillar[];
  /** Les séances prévues de la semaine (hors séances sautées). */
  planned: readonly { dayKey: string; pillar: 'strength' | 'running'; done: boolean }[];
  /** Les séances et sorties terminées de la semaine, prévues ou non (une entrée par séance). */
  done: readonly { dayKey: string; pillar: 'strength' | 'running' }[];
  /** Les jours notés, avec leur cible effective (`useDailyCalorieTargets`). */
  nutrition: readonly { dayKey: string; kcal: number; effectiveTarget: number | null }[];
  /** Marge de tolérance de l'utilisateur (défaut 10 %), la même que l'adhérence (NUTR-10). */
  marginPct: number;
  pausedDays: ReadonlySet<string>;
}

export interface WeekStrip {
  days: WeekStripDay[];
  /** Séances faites / séances de la semaine (prévues + faites hors plan). */
  sessionsDone: number;
  sessionsTotal: number;
  /** Jours notés dans la cible / jours notés (jusqu'à aujourd'hui). */
  daysInTarget: number;
  loggedDays: number;
}

/** « Dans la cible » : la même règle que l'adhérence calorique (`computeGoalAdherence`). */
function inTarget(kcal: number, target: number | null, marginPct: number): boolean {
  return target !== null && target > 0 && Math.abs(kcal - target) <= target * (marginPct / 100);
}

export function buildWeekStrip(input: WeekStripInput): WeekStrip {
  const start = localDateFromDayKey(input.weekStartKey);
  const doneSet = (pillar: 'strength' | 'running') =>
    new Set(input.done.filter((d) => d.pillar === pillar).map((d) => d.dayKey));
  const plannedSet = (pillar: 'strength' | 'running') =>
    new Set(input.planned.filter((p) => p.pillar === pillar).map((p) => p.dayKey));
  const done = { strength: doneSet('strength'), running: doneSet('running') };
  const planned = { strength: plannedSet('strength'), running: plannedSet('running') };
  const food = new Map(input.nutrition.map((d) => [d.dayKey, d]));

  const days: WeekStripDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(start, i);
    const key = localDayKey(date);
    const marks: Partial<Record<Pillar, WeekMark>> = {};
    for (const pillar of ['strength', 'running'] as const) {
      if (!input.pillars.includes(pillar)) continue;
      // Un jour passé prévu mais pas fait s'éteint : la pastille ne garde pas un pointillé de reproche.
      marks[pillar] = done[pillar].has(key)
        ? 'done'
        : planned[pillar].has(key) && key >= input.todayKey
          ? 'planned'
          : 'idle';
    }
    if (input.pillars.includes('nutrition')) {
      const day = food.get(key);
      marks.nutrition =
        day && day.kcal > 0
          ? inTarget(day.kcal, day.effectiveTarget, input.marginPct)
            ? 'done'
            : 'logged'
          : key === input.todayKey
            ? 'planned'
            : 'idle';
    }
    days.push({
      key,
      weekday: i + 1,
      dayOfMonth: date.getDate(),
      isToday: key === input.todayKey,
      paused: input.pausedDays.has(key),
      marks,
    });
  }

  const pillarsOk = (p: 'strength' | 'running') => input.pillars.includes(p);
  const doneSessions = input.done.filter((d) => pillarsOk(d.pillar)).length;
  const plannedSessions = input.planned.filter((p) => pillarsOk(p.pillar));
  const plannedDone = plannedSessions.filter((p) => p.done).length;
  const sessionsTotal = plannedSessions.length + Math.max(0, doneSessions - plannedDone);

  const logged = input.nutrition.filter((d) => d.dayKey <= input.todayKey && d.kcal > 0);
  return {
    days,
    sessionsDone: doneSessions,
    sessionsTotal,
    daysInTarget: logged.filter((d) => inTarget(d.kcal, d.effectiveTarget, input.marginPct)).length,
    loggedDays: logged.length,
  };
}

// ---------------------------------------------------------------------------
// Du nouveau
// ---------------------------------------------------------------------------

/**
 * **L'ordre de ce tableau EST la priorité** (même parti pris que `NOW_ACTION_ORDER`) :
 *  1. un **conflit d'objectifs** demande une décision — c'est une alerte ;
 *  2. le **parcours des premiers jours** ne dure qu'une semaine ;
 *  3. un **record battu** se célèbre le jour même (et le lendemain) ;
 *  4. **depuis ta dernière visite** ne dit quelque chose qu'au retour ;
 *  5. un **record à portée** n'a de sens qu'un jour de séance ;
 *  6. un **lien du Labo** à régler, ou un insight ;
 *  7. **l'objectif** le plus proche, la carte la plus stable.
 */
export const HOME_NEWS_ORDER = [
  'conflict',
  'activation',
  'record',
  'since-last-visit',
  'near-record',
  'lab',
  'goal',
] as const;
export type HomeNewsKind = (typeof HOME_NEWS_ORDER)[number];

/** Deux cartes au plus : au-delà, « Du nouveau » redeviendrait la pile de cartes qu'il remplace. */
export const HOME_NEWS_MAX = 2;

/** Les cartes de « Du nouveau », dans l'ordre, parmi celles qui ont quelque chose à dire. */
export function selectHomeNews(available: Partial<Record<HomeNewsKind, boolean>>): HomeNewsKind[] {
  return HOME_NEWS_ORDER.filter((kind) => available[kind] === true).slice(0, HOME_NEWS_MAX);
}

/** Un record battu « se célèbre » aujourd'hui et demain, pas au-delà. */
export const RECORD_FRESH_DAYS = 1;

/** Le record est-il assez frais pour « Du nouveau » ? (`achievedDayKey` en jour local.) */
export function isFreshRecord(achievedDayKey: string | null, todayKey: string): boolean {
  if (!achievedDayKey) return false;
  const limit = localDayKey(addDays(localDateFromDayKey(todayKey), -RECORD_FRESH_DAYS));
  return achievedDayKey >= limit && achievedDayKey <= todayKey;
}
