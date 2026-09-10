/**
 * US CARDIO-UX01 (R2, R3) — l'état du hub course, et l'entrée dans le pilier.
 *
 * Calqué sur `strength-hub.ts` (US MUSCU-UX01, livrée la veille sur le pilier voisin) : même
 * patron de zone Agir à états exclusifs, mêmes raisons. Ce qui diffère est propre à la course —
 * une course libre est toujours possible, là où une séance de muscu sans programme est un cas
 * limite.
 */

import { predictRaceTime } from './pace-records';

// ---------------------------------------------------------------------------
// Zone Agir du hub (règle R3-1)
// ---------------------------------------------------------------------------

/**
 * Séance de course planifiée aujourd'hui, telle que le hub en a besoin pour la carte.
 *
 * Elle porte **le contenu** de la séance, pas seulement son existence : c'est ce qui permet de
 * relire la consigne avant de partir, au lieu de découvrir la séance une fois dehors.
 */
export type RunHubTodaySession = {
  plannedSessionId: string;
  sessionId: string;
  sessionType: string | null;
  targetDistanceM: number | null;
  targetDurationSeconds: number | null;
  /** Consigne rédigée (« ne pas accélérer le premier 1 000 m »), livrée par RUN-F4. */
  instructions: string | null;
  /** Résumé lisible de chaque segment, dans l'ordre — vide si la séance n'a pas de structure. */
  segmentSummaries: readonly string[];
  /** Volume total en mètres, dérivé de la structure ou de la cible. `null` si non calculable. */
  totalDistanceM: number | null;
  /** Durée estimée en minutes. `null` si non calculable. */
  estimatedMinutes: number | null;
};

/** Prochaine séance de course à venir (état C), pour dire quand on reprend. */
export type RunHubUpcoming = {
  scheduledDate: string;
  sessionType: string | null;
};

/** Entrées de la décision — tout ce que le hub sait de la situation. */
export type RunHubStateInput = {
  /** Course en cours reprenable, `null` sinon. */
  activeRun: { source: 'gps' | 'manual'; distanceM: number | null; durationSeconds: number | null } | null;
  /** Occurrence `planned` du jour pour le pilier course, `null` sinon. */
  todaySession: RunHubTodaySession | null;
  /** Vrai si un programme de course est actif. */
  hasActiveProgram: boolean;
  /** Séance de course du jour déjà faite, `null` sinon — nuance l'état C. */
  doneToday: { sessionType: string | null } | null;
  /** Prochaine occurrence à venir, `null` si aucune. */
  nextUpcoming: RunHubUpcoming | null;
};

/**
 * État résolu de la zone Agir. Un seul à la fois, par construction.
 *
 * `rest` porte un nom trompeur pour la course et c'est assumé : ce n'est pas « repos » mais
 * « rien de prévu aujourd'hui ». La carte y propose une **course libre**, qui reste le mode
 * majoritaire du pilier — contrairement à la muscu, où l'état équivalent invite au repos.
 */
export type RunHubState =
  | { kind: 'resume'; run: NonNullable<RunHubStateInput['activeRun']> }
  | { kind: 'today'; session: RunHubTodaySession }
  | { kind: 'rest'; doneToday: { sessionType: string | null } | null; nextUpcoming: RunHubUpcoming | null }
  | { kind: 'onboarding' };

/**
 * Résout l'état unique de la zone Agir (règle R3-1).
 *
 * ── Ce que ça remplace ───────────────────────────────────────────────────────────────────────────
 * `(tabs)/running.tsx` portait une cascade de ternaires dans le JSX :
 * `active ? … : todaySession ? … : …`, soit **trois** états, dont aucun ne distinguait
 * « j'ai un programme mais rien aujourd'hui » de « je n'ai pas de programme ». Le hub proposait
 * donc la même carte « Démarrer une course » à quelqu'un qui suit un plan de 8 semaines et à
 * quelqu'un qui vient d'installer l'app.
 *
 * L'ordre des tests **est** la règle de priorité : ne pas le réordonner sans changer la spec.
 */
export function resolveRunHubState(input: RunHubStateInput): RunHubState {
  if (input.activeRun) return { kind: 'resume', run: input.activeRun };
  if (input.todaySession) return { kind: 'today', session: input.todaySession };
  if (input.hasActiveProgram) {
    return { kind: 'rest', doneToday: input.doneToday, nextUpcoming: input.nextUpcoming };
  }
  return { kind: 'onboarding' };
}

/**
 * Durée estimée d'une séance de course, en minutes — ou `null` si non calculable.
 *
 * La carte du jour annonçait la cible chiffrée sans jamais dire **combien de temps ça prend**, ce
 * qui est la première question quand on regarde son agenda. Trois sources, dans cet ordre :
 *
 *  1. la **durée cible** de la séance, quand elle est bornée en temps — c'est la réponse exacte ;
 *  2. le **volume** (structure ou cible) divisé par l'allure de référence, majoré de 15 % parce
 *     qu'une séance structurée contient de la récupération et des transitions plus lentes que
 *     l'allure de référence ;
 *  3. rien — et on n'affiche pas d'estimation plutôt qu'un chiffre inventé.
 *
 * Les 15 % sont un **nombre posé**, pas mesuré : à recalibrer après recette terrain, comme
 * `PACE_TOLERANCE_S_PER_KM` de RUN-F4.
 */
export function estimateRunMinutes(input: {
  targetDurationSeconds: number | null;
  totalDistanceM: number | null;
  refPaceSPerKm: number | null;
}): number | null {
  if (input.targetDurationSeconds != null && input.targetDurationSeconds > 0) {
    return Math.round(input.targetDurationSeconds / 60);
  }
  const { totalDistanceM, refPaceSPerKm } = input;
  if (totalDistanceM == null || totalDistanceM <= 0) return null;
  if (refPaceSPerKm == null || refPaceSPerKm <= 0) return null;

  const seconds = (totalDistanceM / 1000) * refPaceSPerKm * 1.15;
  return Math.round(seconds / 60);
}

// ---------------------------------------------------------------------------
// Ma semaine (constat F37)
// ---------------------------------------------------------------------------

/** Un jour de la semaine, tel que la bande du hub l'affiche. */
export type RunWeekDay = {
  /** Clé `AAAA-MM-JJ`. */
  dayKey: string;
  /** 0 = lundi … 6 = dimanche. */
  weekday: number;
  /** Une course a été enregistrée ce jour-là. */
  done: boolean;
  /** Une séance est planifiée ce jour-là et pas encore faite. */
  planned: boolean;
  /** C'est aujourd'hui. */
  isToday: boolean;
};

/** Résumé de la semaine de course. */
export type RunWeekSummary = {
  days: RunWeekDay[];
  /** Courses enregistrées cette semaine. */
  doneCount: number;
  /** Séances prévues cette semaine (faites + à faire). */
  plannedCount: number;
  distanceM: number;
  durationSeconds: number;
  elevationGainM: number;
  /**
   * Fréquence hebdo visée, telle que déclarée au profil coureur — ou `null`.
   *
   * ⚠️ Ce champ était **saisi et lu nulle part** (constat F40) : le profil demandait « fréquence
   * hebdo visée » et rien dans l'app ne s'en servait. Il devient ici le repère de la bande, ce qui
   * est la seule raison de poser la question.
   */
  targetFrequency: number | null;
};

/**
 * Compose la semaine de course affichée par le hub (constat F37).
 *
 * Le hub ne montrait **qu'une action et rien de la semaine** : pas de « 2 faites sur 3 », pas de
 * volume, pas de prochaine séance si elle n'était pas aujourd'hui. Aucune vue d'ensemble, alors
 * que c'est la première question d'un coureur qui suit un plan.
 *
 * `weekStartKey` doit être un lundi (`startOfWeek`). Les jours sont générés même sans donnée : une
 * semaine à trous se lit, une semaine absente ne se lit pas.
 */
export function resolveRunWeek(input: {
  /** Lundi de la semaine, clé `AAAA-MM-JJ`. */
  weekStartKey: string;
  /** Aujourd'hui, clé `AAAA-MM-JJ`. */
  todayKey: string;
  /** Courses terminées de la semaine. */
  runs: ReadonlyArray<{
    dayKey: string;
    distanceM: number | null;
    durationSeconds: number | null;
    elevationGainM: number | null;
  }>;
  /** Séances de course planifiées de la semaine, faites ou non. */
  planned: ReadonlyArray<{ dayKey: string; done: boolean }>;
  targetFrequency: number | null;
}): RunWeekSummary {
  const runDays = new Set(input.runs.map((r) => r.dayKey));
  const plannedByDay = new Map<string, boolean>();
  for (const p of input.planned) {
    // Un jour qui porte plusieurs séances est « à faire » dès qu'il en reste une.
    plannedByDay.set(p.dayKey, (plannedByDay.get(p.dayKey) ?? false) || !p.done);
  }

  const days: RunWeekDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const dayKey = addDaysToKey(input.weekStartKey, i);
    days.push({
      dayKey,
      weekday: i,
      done: runDays.has(dayKey),
      planned: plannedByDay.get(dayKey) === true,
      isToday: dayKey === input.todayKey,
    });
  }

  return {
    days,
    doneCount: runDays.size,
    plannedCount: input.planned.length,
    distanceM: input.runs.reduce((sum, r) => sum + (r.distanceM ?? 0), 0),
    durationSeconds: input.runs.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0),
    elevationGainM: input.runs.reduce((sum, r) => sum + (r.elevationGainM ?? 0), 0),
    targetFrequency: input.targetFrequency,
  };
}

/**
 * `AAAA-MM-JJ` + n jours → `AAAA-MM-JJ`, en arithmétique de calendrier locale.
 *
 * Volontairement sans `new Date('AAAA-MM-JJ')`, qui est interprété en **UTC** et décale le jour
 * dans tous les fuseaux à l'ouest de Greenwich — le défaut classique de ce dépôt, signalé à
 * plusieurs endroits.
 */
function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d! + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Les quatre portes vers l'allure de référence (règle R2b / constat F2)
// ---------------------------------------------------------------------------

/** Distance de référence du système d'allures : le 5 km. */
const REFERENCE_DISTANCE_M = 5000;

/**
 * Allure de référence 5 km (s/km) déduite d'un chrono sur **n'importe quelle** distance.
 *
 * ── Le mur que ça lève ───────────────────────────────────────────────────────────────────────────
 * Le profil demandait « ton allure actuelle sur 5 km » — et rien d'autre (constat F2). Un
 * débutant qui n'a jamais couru 5 km ne peut pas répondre ; il n'y avait ni « je ne sais pas », ni
 * test proposé, ni estimation possible. Or l'allure de référence pilote **toutes** les allures
 * cibles dérivées, les zones d'allure, la polarisation et les prédictions : sans elle le pilier
 * tourne en mode dégradé **silencieux**.
 *
 * La formule de Riegel était déjà là (RUN-14) mais ne servait qu'à **prédire** un temps plus long
 * depuis le 5 km. Elle marche dans les deux sens : un 10 km en 52:30 donne un 5 km estimé, donc
 * une allure de référence. On ne lui demande rien de neuf, seulement de tourner dans l'autre sens.
 *
 * Rend `null` sur une saisie inexploitable — jamais une allure inventée.
 */
export function referencePaceFromRaceTime(
  distanceM: number,
  timeSeconds: number,
): number | null {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null;
  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) return null;

  const estimated5k = predictRaceTime(timeSeconds, distanceM, REFERENCE_DISTANCE_M);
  if (!Number.isFinite(estimated5k) || estimated5k <= 0) return null;

  return Math.round(estimated5k / (REFERENCE_DISTANCE_M / 1000));
}

/**
 * Distance couverte en 12 minutes → allure de référence 5 km (s/km).
 *
 * Le test de Cooper (12 min à fond) est la porte d'entrée pour qui n'a **aucun** chrono : il ne
 * demande ni piste mesurée ni dossard, seulement de courir 12 minutes avec l'app. On convertit la
 * distance couverte en un chrono équivalent, puis on passe par Riegel comme pour tout le reste —
 * une seule formule pour toutes les portes, donc aucune divergence possible entre elles.
 *
 * Rend `null` sous 400 m : en dessous, la conversion amplifie tellement l'erreur que le résultat
 * n'a plus de sens (et 400 m en 12 min, c'est de la marche).
 */
export function referencePaceFromCooperTest(distanceM: number): number | null {
  if (!Number.isFinite(distanceM) || distanceM < 400) return null;
  return referencePaceFromRaceTime(distanceM, 12 * 60);
}
