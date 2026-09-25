/**
 * « La dernière fois » d'une séance de course — US CARDIO-UX03, D3, R3 et R4.
 *
 * Avant de partir faire ses 6 × 400, un coureur veut savoir en combien il les avait passés la semaine
 * dernière. La donnée existait (chaque course porte sa séance planifiée, chaque fraction son réalisé
 * dans `run_intervals`) ; aucun écran ne rapprochait les deux.
 *
 * Un programme de course est aujourd'hui une **semaine type répétée** : `generatePlannedSessions`
 * ignore encore `sessions.week_index` (CARDIO-06, backlog). La même séance revient donc chaque
 * semaine, et c'est elle qu'on cherche d'abord. Le jour où les semaines progresseront, chaque séance
 * aura son identifiant propre : le repli sur le même type prendra alors le relais.
 *
 * Entièrement pur : l'appelant fournit les courses et les fractions déjà lues.
 */

import type { RunIntervalRow } from './run-interval-results';
import { normalizePaceRange, type ProgramSessionType } from './running-paces';

/** Le strict nécessaire d'une course de l'historique pour la retrouver. */
export type LastTimeCandidate = {
  id: string;
  /** `null` = course non terminée : jamais retenue. */
  finishedAt: string | null;
  /** Séance de programme réalisée (via l'occurrence planifiée) ; `null` pour une course libre. */
  sessionId: string | null;
  sessionType: ProgramSessionType | null;
};

export type RunLastTimeMatch = { runId: string; match: 'session' | 'type' };

/**
 * R3 — la plus récente course terminée de **la même séance** ; sinon du **même type** ; sinon rien.
 *
 * Une course libre n'a pas de type : elle ne sert jamais de « dernière fois » à une séance (on
 * comparerait un footing du dimanche à un fractionné).
 */
export function pickRunLastTime(
  runs: readonly LastTimeCandidate[],
  today: { sessionId: string | null; sessionType: ProgramSessionType | null },
): RunLastTimeMatch | null {
  const finished = runs
    .filter((r): r is LastTimeCandidate & { finishedAt: string } => r.finishedAt != null)
    .slice()
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));

  if (today.sessionId != null) {
    const same = finished.find((r) => r.sessionId === today.sessionId);
    if (same) return { runId: same.id, match: 'session' };
  }
  if (today.sessionType != null) {
    const sameType = finished.find((r) => r.sessionType === today.sessionType);
    if (sameType) return { runId: sameType.id, match: 'type' };
  }
  return null;
}

/** Une pastille de fraction : ce qui s'affiche, et si c'était dans la plage prévue. */
export type LastTimeRep = {
  /** Rang dans la série affichée, 1-based, continu d'un bloc à l'autre. */
  rep: number;
  /**
   * `time` : répétition bornée en distance, on dit son **temps** (« 1:34 » au 400) ;
   * `pace` : bornée en durée (ou sans borne), on dit son **allure** (« 3:58/km »).
   */
  kind: 'time' | 'pace';
  /** Secondes (temps) ou secondes par km (allure), arrondies ; `null` sans réalisé mesurable. */
  seconds: number | null;
  /** `none` : pas de plage prévue, ou rien à comparer. */
  state: 'in' | 'out' | 'none';
};

/**
 * R4 — les répétitions du **corps de séance** d'une course, dans l'ordre des phases.
 *
 * Deux filtres, et le second est le piège : les récupérations sont écartées (mêlées aux fractions,
 * elles rendraient la série illisible), **et** l'échauffement, les éducatifs et le retour au calme
 * aussi — `expandIntervalPhases` les développe en phases « rapides », si bien que
 * `summarizeIntervalSeries`, qui ne filtre que le type de phase, les compte comme des fractions. Un
 * échauffement de 15 minutes se lirait alors comme une répétition ratée.
 *
 * Une répétition franchie lors d'un rattrapage silencieux n'a pas de réalisé (RUN-F2d R8 bis) : sa
 * pastille dit « — », on n'invente rien.
 */
export function lastTimeReps(rows: readonly RunIntervalRow[]): LastTimeRep[] {
  return rows
    .filter((r) => r.phaseKind === 'fast' && r.segmentKind === 'work')
    .slice()
    .sort((a, b) => a.phaseIndex - b.phaseIndex)
    .map((r, index) => {
      const kind: LastTimeRep['kind'] = r.plannedDistanceM != null ? 'time' : 'pace';
      const raw = kind === 'time' ? r.actualDurationSeconds : r.actualPaceSPerKm;
      const seconds = raw != null && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;

      const range = normalizePaceRange(r.plannedPaceMinSPerKm, r.plannedPaceMaxSPerKm);
      const pace = r.actualPaceSPerKm;
      const state: LastTimeRep['state'] =
        range == null || pace == null || !Number.isFinite(pace) || seconds == null
          ? 'none'
          : pace >= range.minSPerKm && pace <= range.maxSPerKm
            ? 'in'
            : 'out';

      return { rep: index + 1, kind, seconds, state };
    });
}

/**
 * « 5 sur 6 dans la plage » — sur les pastilles de `lastTimeReps`, donc sur le corps de séance seul.
 * Le dénominateur ne compte que les répétitions qu'on peut juger (une plage prévue et un réalisé) ;
 * `null` quand il n'y en a aucune : « 0 sur 0 » ne dirait rien.
 */
export function repsInRange(reps: readonly LastTimeRep[]): { done: number; total: number } | null {
  const rated = reps.filter((r) => r.state !== 'none');
  if (rated.length === 0) return null;
  return { done: rated.filter((r) => r.state === 'in').length, total: rated.length };
}
