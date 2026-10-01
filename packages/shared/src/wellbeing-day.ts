/**
 * US BIEN-04 — la boucle : ce que l'état du jour change à la séance et à l'assiette.
 *
 * L'onglet « Aujourd'hui » du pilier Bien-être ne montre pas une courbe : il dit ce que la nuit,
 * l'énergie, l'envie et le contexte **changent aujourd'hui**. Ce fichier compose des signaux déjà
 * définis ailleurs (`isPoorNight`, les seuils de TRI-03 et de l'adaptation de séance) et rend des
 * **propositions** — jamais une écriture, jamais une obligation.
 *
 * Règles (planche « Prototype — un matin », validée le 01/10/2026) :
 *  1. « Malade » met **l'intensité en veille** : toute séance prévue est proposée au lendemain.
 *  2. Une séance intense et un signal défavorable (nuit courte ou agitée, énergie ≤ 2, stress de la
 *     veille ≥ 4) : on **allège** — garder l'échauffement, retirer du volume. Un seul signal suffit,
 *     comme pour le score de forme (R4 de TRI-03).
 *  3. Une envie ≤ 2 sans autre signal : on propose une **version courte**, jamais imposée.
 *  4. Tout au vert : on le dit (« bon jour pour tenter la charge prévue »).
 *  5. **Rien d'automatique** : chaque proposition se refuse d'un geste.
 *
 * ⚠️ Aucune lecture d'horloge.
 */

import type { Pillar } from './pillar';
import { isIntenseSessionType } from './session-adaptation';
import type { ProgramSessionType } from './running-paces';
import { isPoorNight, isSleepMinutes, isWellbeingLevel, type LocalWellbeing } from './wellbeing';
import { GOOD_NIGHT_MINUTES } from './lab-week';

/** Énergie à ce niveau ou en dessous : signal défavorable (aligné sur TRI-03 et l'adaptation). */
export const DAY_LOW_ENERGY = 2;
/** Stress de la veille à ce niveau ou au-dessus : signal défavorable (aligné sur TRI-03). */
export const DAY_HIGH_STRESS = 4;
/** Envie à ce niveau ou en dessous : version courte proposée. */
export const DAY_LOW_MOTIVATION = 2;

export type WellbeingDaySignalCode =
  | 'sick'
  | 'poorNight'
  | 'lowEnergy'
  | 'highStressYesterday'
  | 'lowMotivation'
  | 'goodNight'
  | 'highEnergy';

export type WellbeingDaySignal = { code: WellbeingDaySignalCode; tone: 'down' | 'up' };

export type WellbeingDaySession = {
  id: string;
  pillar: Pillar;
  name: string | null;
  sessionType: ProgramSessionType | null;
  status: 'planned' | 'done' | 'skipped';
  /** La séance porte déjà une adaptation du jour (CARDIO-UX01, Labo) : on n'en propose pas une seconde. */
  adapted: boolean;
};

export type SessionAdviceKind = 'postpone' | 'lighten' | 'shorten' | 'go' | 'keep';

export type SessionAdvice = {
  sessionId: string;
  pillar: Pillar;
  name: string | null;
  kind: SessionAdviceKind;
  /**
   * L'allègement peut-il s'**écrire** ? Seulement sur une course intense non encore adaptée : c'est la
   * seule séance qui sait lire `adapted_reps_pct` (CARDIO-UX01). Ailleurs, le conseil reste un conseil.
   */
  canWriteLighten: boolean;
  adapted: boolean;
};

export type DayNutritionNote = 'sick' | 'poorNight' | 'lateNight' | 'stressed';

export type WellbeingDay = {
  signals: WellbeingDaySignal[];
  advice: SessionAdvice[];
  nutritionNote: DayNutritionNote | null;
  /** Rien de défavorable, et au moins un signal favorable : « tout au vert ». */
  allGood: boolean;
};

export type WellbeingDayInput = {
  today: LocalWellbeing | null;
  yesterday: LocalWellbeing | null;
  sessions: readonly WellbeingDaySession[];
  activePillars: readonly Pillar[];
};

/** Une séance de muscu prévue est traitée comme intense : rien ne la type « facile » aujourd'hui. */
function isIntense(session: WellbeingDaySession): boolean {
  if (session.pillar === 'strength') return true;
  if (session.pillar === 'running') return isIntenseSessionType(session.sessionType);
  return false;
}

export function buildWellbeingDay(input: WellbeingDayInput): WellbeingDay {
  const today = input.today;
  const yesterday = input.yesterday;
  const signals: WellbeingDaySignal[] = [];

  const sick = today?.sick === true;
  if (sick) signals.push({ code: 'sick', tone: 'down' });
  const poor = isPoorNight(today);
  if (poor === true) signals.push({ code: 'poorNight', tone: 'down' });
  const lowEnergy = isWellbeingLevel(today?.energy) && (today?.energy as number) <= DAY_LOW_ENERGY;
  if (lowEnergy) signals.push({ code: 'lowEnergy', tone: 'down' });
  const highStress = isWellbeingLevel(yesterday?.stress) && (yesterday?.stress as number) >= DAY_HIGH_STRESS;
  if (highStress) signals.push({ code: 'highStressYesterday', tone: 'down' });
  const lowMotivation = isWellbeingLevel(today?.motivation) && (today?.motivation as number) <= DAY_LOW_MOTIVATION;
  if (lowMotivation) signals.push({ code: 'lowMotivation', tone: 'down' });

  const goodNight =
    poor === false && isSleepMinutes(today?.sleepMinutes) && (today?.sleepMinutes as number) >= GOOD_NIGHT_MINUTES;
  if (goodNight) signals.push({ code: 'goodNight', tone: 'up' });
  const highEnergy = isWellbeingLevel(today?.energy) && (today?.energy as number) >= 4;
  if (highEnergy) signals.push({ code: 'highEnergy', tone: 'up' });

  // L'envie faible n'est pas un signal de fatigue : elle propose une version courte, elle n'allège pas.
  const adverse = sick || poor === true || lowEnergy || highStress;
  const allGood = !adverse && !lowMotivation && (goodNight || highEnergy);

  const advice: SessionAdvice[] = input.sessions
    .filter((s) => s.status === 'planned' && (s.pillar === 'strength' || s.pillar === 'running'))
    .map((s) => {
      const intense = isIntense(s);
      let kind: SessionAdviceKind = 'keep';
      if (sick) kind = 'postpone';
      else if (intense && adverse) kind = 'lighten';
      else if (intense && lowMotivation) kind = 'shorten';
      else if (intense && allGood) kind = 'go';
      return {
        sessionId: s.id,
        pillar: s.pillar,
        name: s.name,
        kind,
        canWriteLighten: kind === 'lighten' && s.pillar === 'running' && !s.adapted,
        adapted: s.adapted,
      };
    });

  let nutritionNote: DayNutritionNote | null = null;
  if (input.activePillars.includes('nutrition')) {
    if (sick) nutritionNote = 'sick';
    else if (poor === true) nutritionNote = 'poorNight';
    else if (yesterday?.lateNight === true) nutritionNote = 'lateNight';
    else if (highStress || yesterday?.busyDay === true) nutritionNote = 'stressed';
  }

  return { signals, advice, nutritionNote, allGood };
}
