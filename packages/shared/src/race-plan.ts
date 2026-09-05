/**
 * US RUN-F4 (lots G et H) — la seance de course et le bloc de preparation date.
 * Ref. : docs/product/analyse-seances-structurees-running.md (murs M9 et M12)
 *
 * Deux manques que l'analyse du 04/09/2026 a mis face a face :
 *  - **M9** — aucun type ne portait une seance de TEST ni de COURSE, alors que ce sont elles
 *    qui calibrent tout le reste d'un plan, et rien ne portait un plan de passage par km.
 *  - **M12** — `programs` n'avait ni date d'echeance ni chrono vise. Le calendrier existait
 *    pourtant deja : **il manquait l'ancre, pas le calendrier**.
 *
 * Paradoxe que ces deux lots referment : RUN-14 sait PREDIRE un temps de course (Riegel) et la
 * 5.31 sait RECALER l'allure de reference sur un record — mais on ne pouvait nulle part ecrire
 * « ma course est le 25/10/2026 et je vise 20:00 ».
 *
 * Entierement pur, et notamment **sans horloge** : la date du jour est toujours un parametre.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Plan de passage par kilometre (lot G)
// ---------------------------------------------------------------------------

/**
 * Une ligne du plan de course : « le km 4 se court en 3:58-4:00 ».
 * Stocke en JSON sur `sessions.pacing_plan` — le nombre de kilometres varie par seance, des
 * colonnes ne conviendraient pas.
 */
export const pacingPlanEntrySchema = z.object({
  km: z.number().int().positive(),
  paceMinSPerKm: z.number().positive(),
  paceMaxSPerKm: z.number().positive(),
});
export type PacingPlanEntry = z.infer<typeof pacingPlanEntrySchema>;

export const pacingPlanSchema = z.array(pacingPlanEntrySchema);
export type PacingPlan = z.infer<typeof pacingPlanSchema>;

/**
 * Relit un plan stocke en base sans jamais lever.
 *
 * ⚠️ Tolerant par conception : une colonne `jsonb` libre peut contenir n'importe quoi (version
 * plus ancienne de l'app, ecriture concurrente, migration manuelle). Une exception ici ferait
 * planter l'ecran de detail d'une seance a cause d'une donnee decorative — on rend `null` et
 * l'UI se contente de ne rien afficher.
 */
export function parsePacingPlan(raw: unknown): PacingPlan | null {
  if (raw == null) return null;
  const value = typeof raw === 'string' ? safeJsonParse(raw) : raw;
  if (value === undefined) return null;
  const parsed = pacingPlanSchema.safeParse(value);
  if (!parsed.success || parsed.data.length === 0) return null;
  return [...parsed.data].sort((a, b) => a.km - b.km);
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export type PacingSplit = {
  km: number;
  paceMinSPerKm: number;
  paceMaxSPerKm: number;
  /** Temps de passage cumule le plus RAPIDE a ce km (bornes basses additionnees). */
  cumulativeMinSeconds: number;
  /** Temps de passage cumule le plus LENT. */
  cumulativeMaxSeconds: number;
};

/**
 * Temps de passage cumules — « passages vises 2 km ≈ 8:02 et 3 km ≈ 12:02 », exactement ce que
 * la fiche de course du plan analyse donne au coureur.
 *
 * Les deux bornes sont cumulees separement : additionner un « milieu » de plage a chaque km
 * ferait perdre l'incertitude, alors qu'elle grandit precisement avec la distance.
 */
export function cumulativePacingSplits(plan: readonly PacingPlanEntry[]): PacingSplit[] {
  let min = 0;
  let max = 0;
  return [...plan]
    .sort((a, b) => a.km - b.km)
    .map((entry) => {
      min += entry.paceMinSPerKm;
      max += entry.paceMaxSPerKm;
      return {
        km: entry.km,
        paceMinSPerKm: entry.paceMinSPerKm,
        paceMaxSPerKm: entry.paceMaxSPerKm,
        cumulativeMinSeconds: min,
        cumulativeMaxSeconds: max,
      };
    });
}

/**
 * Plan de passage regulier deduit d'un objectif chrono — le point de depart par defaut, que le
 * coureur ajuste ensuite km par km.
 *
 * **Regulier et non « negative split »** : l'app sait deja CONSTATER un negative split apres
 * coup (ALLURE-01 / RUN-11), elle n'a pas a en PRESCRIRE un d'office. Proposer une strategie de
 * course serait un choix d'entraineur, pas un calcul — et le plan analyse le fait a la main,
 * km par km.
 *
 * Le dernier kilometre absorbe l'arrondi : sans cela, la somme des km ne redonnerait pas le
 * chrono vise, et un coureur qui additionne s'en apercevrait.
 */
export function evenPacingPlan(
  distanceM: number | null | undefined,
  targetTimeSeconds: number | null | undefined,
): PacingPlan | null {
  if (distanceM == null || targetTimeSeconds == null) return null;
  if (distanceM <= 0 || targetTimeSeconds <= 0) return null;

  const fullKm = Math.floor(distanceM / 1000);
  if (fullKm < 1) return null;

  const pace = (targetTimeSeconds * 1000) / distanceM;
  const rounded = Math.round(pace);
  const plan: PacingPlanEntry[] = [];
  for (let km = 1; km <= fullKm; km += 1) {
    plan.push({ km, paceMinSPerKm: rounded, paceMaxSPerKm: rounded });
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Bloc de preparation date (lot H)
// ---------------------------------------------------------------------------

export type RaceCountdown = {
  /** Jours restants. Negatif si la date est passee. */
  daysRemaining: number;
  /** Semaines pleines restantes (plancher), jamais negatif. */
  weeksRemaining: number;
  /** La course a-t-elle lieu aujourd'hui ? */
  isToday: boolean;
  /** La date est-elle derriere nous ? */
  isPast: boolean;
  /**
   * Semaine d'affutage : les 7 derniers jours avant l'echeance. Le plan analyse y reduit le
   * volume muscu de 40-50 % et transforme sa derniere seance en simple activation.
   */
  isTaperWeek: boolean;
};

/** Nombre de jours pleins entre deux dates `YYYY-MM-DD`, en UTC (aucune heure locale en jeu). */
function daysBetweenDates(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
  return Math.round((to - from) / 86_400_000);
}

/**
 * Compte a rebours jusqu'a l'echeance d'un programme.
 *
 * Les deux dates sont des cles `YYYY-MM-DD` **nues** (jamais des instants) : c'est le meme
 * raisonnement que `planned_sessions.scheduled_date` et que la colonne `programs.target_date`
 * — une course le 25/10 reste le 25/10 quel que soit le fuseau du telephone.
 *
 * Retourne `null` si le programme n'a pas d'echeance (la majorite : « Reprise en douceur ») ou
 * si la date est illisible — l'UI n'affiche alors rien du tout, pas un « J-0 ».
 */
export function raceCountdown(
  targetDate: string | null | undefined,
  todayKey: string,
): RaceCountdown | null {
  if (targetDate == null || targetDate === '') return null;
  const daysRemaining = daysBetweenDates(todayKey, targetDate);
  if (Number.isNaN(daysRemaining)) return null;

  return {
    daysRemaining,
    weeksRemaining: Math.max(0, Math.floor(daysRemaining / 7)),
    isToday: daysRemaining === 0,
    isPast: daysRemaining < 0,
    isTaperWeek: daysRemaining >= 0 && daysRemaining <= 7,
  };
}

export type BlockProgress = {
  doneCount: number;
  plannedCount: number;
  /** Taux de realisation entre 0 et 1, `null` si le bloc ne contient aucune seance. */
  ratio: number | null;
};

/**
 * Taux de realisation d'un bloc — le « 6 sur 24, 25 % » du tableau de bord du plan analyse.
 *
 * Les seances SAUTEES comptent au denominateur, jamais au numerateur : un plan dont on saute la
 * moitie des seances n'est pas realise a 100 %, et masquer les sauts rendrait l'indicateur
 * flatteur donc inutile.
 */
export function blockProgress(
  statuses: readonly ('planned' | 'done' | 'skipped')[],
): BlockProgress {
  const plannedCount = statuses.length;
  const doneCount = statuses.filter((s) => s === 'done').length;
  return {
    doneCount,
    plannedCount,
    ratio: plannedCount > 0 ? doneCount / plannedCount : null,
  };
}
