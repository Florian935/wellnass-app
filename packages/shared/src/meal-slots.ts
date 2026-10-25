/**
 * US ACCUEIL-07 — **les repas du jour, chacun à son heure apprise.**
 *
 * ── Le défaut que ce module corrige ──────────────────────────────────────────────────────────────
 * L'accueil ne savait qu'une chose de l'assiette : « au moins une entrée aujourd'hui ? »
 * (`useMealLoggedToday`). Deux conséquences, vérifiées dans le code le 24/10/2026 :
 *  - un petit-déjeuner noté à 8 h suffisait à déclarer « Ta journée est faite » à 8 h 05 ;
 *  - une fois ce premier repas noté, ni le déjeuner ni le dîner n'étaient plus jamais réclamés.
 *
 * Ce module découpe la journée en **repas**, chacun avec son heure : celle que l'utilisateur
 * pratique (apprise sur 14 jours), ou une heure par défaut tant qu'il n'y a pas d'historique.
 *
 * ── Habitude, pas échéance ───────────────────────────────────────────────────────────────────────
 * `learned-hour.ts` apprend le **9ᵉ décile** de la première saisie du jour : une échéance de
 * notification, qui doit tomber quand c'est d'habitude déjà fait. Ici, on veut l'inverse — l'heure
 * à laquelle le repas se prend (« d'habitude vers 12 h 45 ») — donc la **médiane**, par repas. Le
 * filtre anti-saisie-rétroactive est le même (le jour local de `createdAt` doit être `logDate`).
 *
 * ── On ne réclame que ce qui est pratiqué ────────────────────────────────────────────────────────
 * Un repas n'est une habitude que s'il est noté **plus d'un jour sur deux** (et au moins 3 fois) :
 * quelqu'un qui ne prend pas de petit-déjeuner un jour sur deux ne doit pas se le voir réclamer.
 * Même logique que la garde d'habitude du bien-être et, depuis cette US, de la pesée.
 *
 * Aucune lecture d'horloge : `todayKey` et l'heure entrent par paramètre (règle du dépôt).
 */

import { localDayKey } from './date';
import type { MealConfigItem } from './nutrition';

/** Une saisie de repas candidate à l'apprentissage (`food_entries`). */
export interface MealSample {
  /** Clé du repas (`meal_type`, libre depuis les repas personnalisés). */
  mealKey: string;
  /** Jour que l'entrée décrit (`log_date`). */
  logDate: string;
  /** Instant de la saisie, ISO UTC (`created_at`). */
  createdAt: string;
}

/** Un repas de la journée, à son heure. */
export interface MealSlot {
  key: string;
  /** Libellé personnalisé de la configuration, `null` = libellé par défaut (i18n). */
  label: string | null;
  /** Heure locale décimale (12,75 = 12 h 45), arrondie au quart d'heure. */
  hour: number;
  /** `true` si l'heure vient de l'historique, `false` si c'est l'heure par défaut. */
  learned: boolean;
  /** Le repas porte au moins une entrée aujourd'hui. */
  logged: boolean;
}

/** Jours saisis (tous repas confondus) à partir desquels on se fie à l'historique. */
export const MEAL_LEARNING_MIN_DAYS = 5;
/** Nombre minimal de jours où un repas doit être noté pour être une habitude. */
export const MEAL_HABIT_MIN_DAYS = 3;
/** Part des jours saisis où un repas doit apparaître pour être une habitude : plus d'un sur deux. */
export const MEAL_HABIT_SHARE = 0.5;
/**
 * Fenêtre pendant laquelle un repas dû est **le** repas du moment. Au-delà, il est manqué : on ne
 * réclame pas un petit-déjeuner à 15 h, on le propose seulement en rattrapage.
 */
export const MEAL_DUE_WINDOW_HOURS = 3;

/**
 * Heures par défaut, tant que l'historique ne dit rien. Trois repas : la collation n'est pas
 * réclamée à qui ne l'a jamais notée.
 */
export const DEFAULT_MEAL_HOURS: Readonly<Record<string, number>> = {
  breakfast: 8,
  lunch: 12.5,
  dinner: 19.5,
};

/** Heure d'un repas noté aujourd'hui sans habitude ni heure par défaut (collation, repas perso). */
const UNKNOWN_MEAL_HOUR = 16.5;

/** Arrondi au quart d'heure : « vers 12 h 45 » se lit, « vers 12 h 47 » fait faux-semblant. */
export function quarterHour(hour: number): number {
  return Math.round(hour * 4) / 4;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Heure médiane de chaque repas, et le nombre de jours où il a été noté.
 *
 * Par (repas, jour), seule la **première** saisie retenue compte : un déjeuner saisi en deux fois
 * reste un déjeuner, à l'heure du premier geste.
 */
export function learnMealHours(
  samples: readonly MealSample[],
): Map<string, { hour: number; days: number }> {
  const firstByMealDay = new Map<string, { at: number; hour: number; mealKey: string }>();

  for (const sample of samples) {
    const at = new Date(sample.createdAt);
    const ms = at.getTime();
    if (Number.isNaN(ms)) continue;
    // La saisie doit avoir eu lieu le jour qu'elle décrit — sinon elle ne dit rien de l'heure.
    if (localDayKey(at) !== sample.logDate) continue;

    const id = `${sample.mealKey}|${sample.logDate}`;
    const known = firstByMealDay.get(id);
    if (!known || ms < known.at) {
      firstByMealDay.set(id, {
        at: ms,
        hour: at.getHours() + at.getMinutes() / 60,
        mealKey: sample.mealKey,
      });
    }
  }

  const hoursByMeal = new Map<string, number[]>();
  for (const { mealKey, hour } of firstByMealDay.values()) {
    const list = hoursByMeal.get(mealKey) ?? [];
    list.push(hour);
    hoursByMeal.set(mealKey, list);
  }

  const out = new Map<string, { hour: number; days: number }>();
  for (const [mealKey, hours] of hoursByMeal) {
    out.set(mealKey, { hour: quarterHour(median(hours)), days: hours.length });
  }
  return out;
}

/** Jours distincts portant au moins une saisie retenue. */
function loggedDayCount(samples: readonly MealSample[]): number {
  const daysSeen = new Set<string>();
  for (const sample of samples) {
    const at = new Date(sample.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    if (localDayKey(at) !== sample.logDate) continue;
    daysSeen.add(sample.logDate);
  }
  return daysSeen.size;
}

export interface MealSlotsInput {
  /** Saisies de la fenêtre d'apprentissage. Celles d'aujourd'hui sont ignorées pour apprendre. */
  samples: readonly MealSample[];
  todayKey: string;
  /** Configuration de repas résolue (`resolveMealConfig`), dans son ordre. */
  meals: readonly MealConfigItem[];
  /** Clés des repas qui portent au moins une entrée aujourd'hui. */
  loggedToday: ReadonlySet<string>;
}

/**
 * Les repas de la journée, triés par heure.
 *
 * - **Débutant** (moins de 5 jours saisis) : les trois repas par défaut présents dans la config.
 * - **Habitué** : les repas notés plus d'un jour sur deux, à leur heure médiane. Si aucun n'atteint
 *   ce seuil (historique éparpillé), repli sur les repas par défaut — sinon l'accueil ne
 *   réclamerait plus aucun repas à quelqu'un qui en saisit pourtant.
 * - Un repas **noté aujourd'hui** hors habitude apparaît aussi, déjà fait : la collation du jour a
 *   sa place dans la journée, elle n'a simplement jamais été réclamée.
 *
 * Seules les clés de la configuration comptent : un repas supprimé depuis n'est plus réclamé.
 */
export function resolveMealSlots(input: MealSlotsInput): MealSlot[] {
  const history = input.samples.filter((s) => s.logDate !== input.todayKey);
  const learned = learnMealHours(history);
  const totalDays = loggedDayCount(history);
  const habitThreshold = Math.max(MEAL_HABIT_MIN_DAYS, Math.ceil(totalDays * MEAL_HABIT_SHARE));

  const order = new Map(input.meals.map((m, i) => [m.key, i]));
  const slots: MealSlot[] = [];
  const add = (meal: MealConfigItem, hour: number, isLearned: boolean) => {
    slots.push({
      key: meal.key,
      label: meal.label,
      hour,
      learned: isLearned,
      logged: input.loggedToday.has(meal.key),
    });
  };

  if (totalDays >= MEAL_LEARNING_MIN_DAYS) {
    for (const meal of input.meals) {
      const habit = learned.get(meal.key);
      if (habit && habit.days >= habitThreshold) add(meal, habit.hour, true);
    }
  }

  if (slots.length === 0) {
    for (const meal of input.meals) {
      const fallback = DEFAULT_MEAL_HOURS[meal.key];
      if (fallback !== undefined) add(meal, fallback, false);
    }
  }

  for (const meal of input.meals) {
    if (!input.loggedToday.has(meal.key) || slots.some((s) => s.key === meal.key)) continue;
    const habit = learned.get(meal.key);
    add(meal, habit?.hour ?? DEFAULT_MEAL_HOURS[meal.key] ?? UNKNOWN_MEAL_HOUR, habit !== undefined);
  }

  return slots.sort((a, b) => a.hour - b.hour || order.get(a.key)! - order.get(b.key)!);
}

/**
 * Le repas **dû** : son heure est passée, il n'est pas noté, et on est encore dans sa fenêtre. Si
 * deux repas le sont à la fois, le plus récent — à midi, on propose le déjeuner, pas le
 * petit-déjeuner oublié.
 */
export function dueMeal(slots: readonly MealSlot[], hour: number): MealSlot | null {
  let found: MealSlot | null = null;
  for (const slot of slots) {
    if (slot.logged) continue;
    if (slot.hour <= hour && hour < slot.hour + MEAL_DUE_WINDOW_HOURS) found = slot;
  }
  return found;
}

/** Le prochain repas, pas encore arrivé et pas noté. */
export function nextMeal(slots: readonly MealSlot[], hour: number): MealSlot | null {
  return slots.find((s) => !s.logged && s.hour > hour) ?? null;
}

/** Le plus ancien repas manqué : sa fenêtre est passée sans saisie. */
export function missedMeal(slots: readonly MealSlot[], hour: number): MealSlot | null {
  return slots.find((s) => !s.logged && hour >= s.hour + MEAL_DUE_WINDOW_HOURS) ?? null;
}

/** Côté assiette, la journée est complète quand chaque repas du jour est noté. */
export function mealsComplete(slots: readonly MealSlot[]): boolean {
  return slots.every((s) => s.logged);
}
