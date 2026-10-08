/**
 * US NORYN-01 — une séance planifiée, telle que Noryn la lit : type, intensité, étiquettes, heure,
 * durée estimée. **Aucun titre** : un nom de programme ou de séance est du texte libre.
 *
 * Aucune formule n'est écrite ici. La durée vient d'`estimateSessionMinutes` (carte du hub muscu) et
 * d'`estimateRunMinutes` + `plannedRunDistanceM` (hub Course) ; `heavy_lower` vient de
 * `isHeavyLegSession` (COLLIS-01) ; l'intensité haute, d'`isIntenseSessionType`. Seul le passage aux
 * mots du contrat (`low`, `easy_run`…) est propre à ce fichier.
 */

import type { MuscleGroup } from '../exercise';
import { estimateRunMinutes, plannedRunDistanceM, type PlannedRunBlockVolume } from '../running-hub';
import { SESSION_TYPES, type SessionType } from '../running-paces';
import { isIntenseSessionType } from '../session-adaptation';
import { isHeavyLegSession } from '../session-conflicts';
import { estimateSessionMinutes, type PlannedExerciseDuration } from '../session-estimate';
import {
  MAX_SESSIONS_PER_DAY,
  NORYN_SESSION_KINDS,
  NORYN_SESSION_STATUSES,
  NORYN_UUID,
  type NorynSession,
  type NorynSessionIntensity,
  type NorynSessionKind,
  type NorynSessionStatus,
  type NorynSessionTag,
} from './contract';
import { isValidDayKey } from './paris-date';

/** Une séance planifiée, ses liens déjà résolus (voir `snapshot.ts`). */
export type NorynSessionInput = {
  id: string;
  scheduledDate: string;
  /** `HH:MM:SS` (ou `HH:MM`), heure locale ; `null` = pas d'heure. */
  scheduledTime: string | null;
  status: string;
  pillar: string;
  sessionType: string | null;
  orderIndex: number;
  targetDurationSeconds: number | null;
  targetDistanceM: number | null;
  /** Pour la durée : les plans de la carte du hub (exercices non archivés), dans l'ordre. */
  durationPlans: readonly PlannedExerciseDuration[];
  /** Pour `heavy_lower` : les séries par muscle de COLLIS-01 (exercices archivés compris). */
  setsByMuscle: Partial<Record<MuscleGroup, number | null>>;
  /** Course : les blocs, pour le volume prévu. */
  blocks: readonly PlannedRunBlockVolume[];
};

const KNOWN_TYPES: readonly string[] = SESSION_TYPES;

function knownType(type: string | null): SessionType | null {
  return type !== null && KNOWN_TYPES.includes(type) ? (type as SessionType) : null;
}

/** Intensité d'une course. Type vide, `course_libre` ou inconnu de cette version → `null` (R14). */
export function runIntensity(type: string | null): NorynSessionIntensity | null {
  const known = knownType(type);
  if (known === 'recuperation' || known === 'endurance') return 'low';
  if (known === 'sortie_longue') return 'moderate';
  if (isIntenseSessionType(known)) return 'high';
  return null;
}

/** Étiquettes d'une course. */
export function runTags(type: string | null): NorynSessionTag[] {
  switch (knownType(type)) {
    case 'endurance':
    case 'recuperation':
      return ['easy_run'];
    case 'sortie_longue':
      return ['long_run'];
    case 'fractionne':
      return ['intervals'];
    case 'test':
    case 'course':
      return ['race_effort'];
    default:
      return [];
  }
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d(\.\d+)?)?$/;

function startTime(value: string | null): string | null {
  const match = value === null ? null : TIME.exec(value);
  return match ? `${match[1]}:${match[2]}` : null;
}

function inContract(minutes: number | null): number | null {
  return minutes !== null && minutes >= 1 && minutes <= 600 ? minutes : null;
}

/** La séance du contrat, ou `null` si elle doit être écartée (identifiant, pilier, statut, date). */
export function toNorynSession(input: NorynSessionInput, refPaceSPerKm: number | null): NorynSession | null {
  const id = input.id.toLowerCase();
  if (!NORYN_UUID.test(id)) return null;
  if (!(NORYN_SESSION_KINDS as readonly string[]).includes(input.pillar)) return null;
  if (!(NORYN_SESSION_STATUSES as readonly string[]).includes(input.status)) return null;
  if (!isValidDayKey(input.scheduledDate)) return null;
  const kind = input.pillar as NorynSessionKind;

  if (kind === 'strength') {
    return {
      id,
      date: input.scheduledDate,
      start_time: startTime(input.scheduledTime),
      kind,
      // D6 : l'app ne type pas l'intensité d'une séance de muscu.
      intensity: null,
      estimated_minutes: inContract(estimateSessionMinutes(input.durationPlans)),
      status: input.status as NorynSessionStatus,
      // D7 : `upper_body` n'a aucune définition dans l'app ; il n'est jamais émis.
      tags: isHeavyLegSession(input.setsByMuscle) ? ['heavy_lower'] : [],
    };
  }

  return {
    id,
    date: input.scheduledDate,
    start_time: startTime(input.scheduledTime),
    kind,
    intensity: runIntensity(input.sessionType),
    estimated_minutes: inContract(
      estimateRunMinutes({
        targetDurationSeconds: input.targetDurationSeconds,
        totalDistanceM: plannedRunDistanceM(input.blocks, input.targetDistanceM),
        refPaceSPerKm,
      }),
    ),
    status: input.status as NorynSessionStatus,
    tags: runTags(input.sessionType),
  };
}

/**
 * Les séances du contrat, triées par jour, heure (sans heure en dernier), ordre de séance puis
 * identifiant ; six par jour au plus (le contrat n'a aucun moyen de signaler les suivantes).
 */
export function buildNorynSessions(
  inputs: readonly NorynSessionInput[],
  refPaceSPerKm: number | null,
): NorynSession[] {
  const kept = inputs
    .map((input) => ({ input, session: toNorynSession(input, refPaceSPerKm) }))
    .filter((entry): entry is { input: NorynSessionInput; session: NorynSession } => entry.session !== null)
    .sort((a, b) => {
      const sa = a.session;
      const sb = b.session;
      if (sa.date !== sb.date) return sa.date < sb.date ? -1 : 1;
      if (sa.start_time !== sb.start_time) {
        if (sa.start_time === null) return 1;
        if (sb.start_time === null) return -1;
        return sa.start_time < sb.start_time ? -1 : 1;
      }
      if (a.input.orderIndex !== b.input.orderIndex) return a.input.orderIndex - b.input.orderIndex;
      return sa.id < sb.id ? -1 : 1;
    });

  const perDay = new Map<string, number>();
  const out: NorynSession[] = [];
  for (const { session } of kept) {
    const count = perDay.get(session.date) ?? 0;
    if (count >= MAX_SESSIONS_PER_DAY) continue;
    perDay.set(session.date, count + 1);
    out.push(session);
  }
  return out;
}
