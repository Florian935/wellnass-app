/**
 * US MUSCU-UX01 — état de la **zone Agir** du hub muscu (règle R3-1).
 *
 * ── Ce que ça remplace ───────────────────────────────────────────────────────────────────────────
 * `(tabs)/strength.tsx` portait une cascade de ternaires imbriqués dans le JSX :
 * `active ? … : today.state === 'today-session' ? … : …`, avec deux notes conditionnelles greffées
 * à l'intérieur de la dernière branche. Trois états visibles, un quatrième (jour de repos) qui
 * n'existait pas, et aucune manière de vérifier la priorité autrement qu'en relisant le JSX.
 *
 * ── La règle, une fois pour toutes ───────────────────────────────────────────────────────────────
 * **A > B > C > D**, un seul état affiché, jamais deux cartes concurrentes :
 *
 *   A `resume`     — une séance est en cours. Prioritaire sur tout : c'est la seule situation où
 *                    l'utilisateur a déjà commencé quelque chose qu'il peut perdre.
 *   B `today`      — une occurrence `planned` existe pour aujourd'hui.
 *   C `rest`       — un programme est actif mais rien n'est prévu aujourd'hui (ou c'est déjà fait).
 *   D `onboarding` — aucun programme actif. C'est le compte neuf, et l'état qui doit proposer de
 *                    choisir un programme plutôt qu'une séance libre.
 *
 * Le hub ne décide donc plus rien : il rend l'état que cette fonction retourne.
 */

/** Séance planifiée du jour, telle que le hub en a besoin pour la carte. */
export type HubTodaySession = {
  sessionId: string;
  plannedSessionId: string;
  name: string | null;
  orderIndex: number;
  exerciseCount: number;
  programName: string | null;
  /** Noms des premiers exercices, pour l'aperçu de la carte. */
  previewExercises: readonly string[];
  /** Durée estimée en minutes, `null` si non calculable. */
  estimatedMinutes: number | null;
};

/** Prochaine séance à venir (état C), pour dire quand on reprend. */
export type HubUpcoming = {
  scheduledDate: string;
  name: string | null;
};

/** Entrées de la décision — tout ce que le hub sait de la situation. */
export type HubStateInput = {
  /** Séance active reprenable, `null` sinon. */
  activeWorkout: { exerciseCount: number; doneSets: number; totalSets: number; name: string | null } | null;
  /** Occurrence `planned` d'aujourd'hui, `null` sinon. */
  todaySession: HubTodaySession | null;
  /** Vrai si un programme est actif (qu'il ait ou non une séance aujourd'hui). */
  hasActiveProgram: boolean;
  /** Séance du jour déjà terminée, `null` sinon — nuance l'état C. */
  doneToday: { name: string | null } | null;
  /** Prochaine occurrence à venir, `null` si aucune. */
  nextUpcoming: HubUpcoming | null;
};

/** État résolu de la zone Agir. Un seul à la fois, par construction. */
export type HubState =
  | { kind: 'resume'; workout: NonNullable<HubStateInput['activeWorkout']> }
  | { kind: 'today'; session: HubTodaySession }
  | { kind: 'rest'; doneToday: { name: string | null } | null; nextUpcoming: HubUpcoming | null }
  | { kind: 'onboarding' };

/**
 * Résout l'état unique de la zone Agir (règle R3-1).
 *
 * L'ordre des tests **est** la règle de priorité : ne pas le réordonner sans changer la spec.
 */
export function resolveHubState(input: HubStateInput): HubState {
  if (input.activeWorkout) return { kind: 'resume', workout: input.activeWorkout };
  if (input.todaySession) return { kind: 'today', session: input.todaySession };
  if (input.hasActiveProgram) {
    return { kind: 'rest', doneToday: input.doneToday, nextUpcoming: input.nextUpcoming };
  }
  return { kind: 'onboarding' };
}

/**
 * Avancement d'un programme : semaine courante et séances faites (US MUSC-F15, jamais affichée).
 *
 * `weekIndex` est 0-based côté base (`planned_sessions.week_index`) ; on rend un numéro **1-based**
 * pour l'affichage, borné à la durée du programme — une semaine 9 sur 8 se lit comme une erreur,
 * alors que c'est simplement une séance rattrapée en retard.
 */
export function resolveProgramProgress(input: {
  currentWeekIndex: number | null;
  durationWeeks: number | null;
  doneSessions: number;
  totalSessions: number;
}): { week: number; totalWeeks: number; done: number; total: number; ratio: number } | null {
  const { currentWeekIndex, durationWeeks, doneSessions, totalSessions } = input;
  if (durationWeeks == null || durationWeeks <= 0 || totalSessions <= 0) return null;
  const week = Math.min(Math.max((currentWeekIndex ?? 0) + 1, 1), durationWeeks);
  const done = Math.min(Math.max(doneSessions, 0), totalSessions);
  return {
    week,
    totalWeeks: durationWeeks,
    done,
    total: totalSessions,
    ratio: done / totalSessions,
  };
}
