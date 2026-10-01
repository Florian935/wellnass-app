/**
 * US BIEN-06 — la nuit lue dans Health Connect (décision D3 du 01/10/2026).
 *
 * ── Comment ça marche ────────────────────────────────────────────────────────────────────────────
 * Le téléphone ne mesure pas le sommeil. Une **application source** (Samsung Health, Fitbit, Google
 * Fit, Garmin Connect, Withings, Sleep as Android…) écrit dans Health Connect des **sessions de
 * sommeil** : un début, une fin, et parfois des **phases** (éveillé, léger, profond, paradoxal). Avec
 * la permission `READ_SLEEP`, nous les relisons ; ce fichier en tire **une nuit par matin**.
 *
 * Trois règles, et ce sont elles qui font qu'une nuit lue vaut une nuit saisie :
 * 1. **une nuit appartient au matin où l'on se réveille** — comme `daily_wellbeing.sleep_minutes`,
 *    « la nuit qui précède `log_date` ». Une session qui finit entre 3 h et 14 h (heure locale du
 *    record) est une nuit ; ailleurs dans la journée, et sous 3 h, c'est une sieste ;
 * 2. **les phases d'éveil ne comptent pas** : 7 h au lit dont 50 min réveillé font 6 h 10 de sommeil.
 *    Sans phases, on prend la durée de la session — c'est tout ce que la source a dit ;
 * 3. **une nuit coupée en deux sessions reste une nuit** : les sessions d'un même réveil s'additionnent.
 *
 * Pure et testée : aucune lecture d'horloge, le fuseau de repli entre par paramètre.
 */

import { deviceOffsetSeconds, toIsoInstant, type RecordZoneOffset } from './health-connect';
import { SLEEP_MINUTES_MAX } from './wellbeing';

/** Les phases de Health Connect qui ne sont pas du sommeil : éveillé, hors du lit, éveillé au lit. */
export const SLEEP_AWAKE_STAGES: readonly number[] = [1, 3, 7];

/** Une session finissant avant cette heure locale n'est pas une nuit (c'est la fin d'une soirée). */
export const NIGHT_END_FROM_HOUR = 3;
/** …ni après celle-ci (c'est une sieste d'après-midi). */
export const NIGHT_END_UNTIL_HOUR = 14;
/** Sous cette durée, une session est une sieste, même finie le matin. */
export const NIGHT_MIN_MINUTES = 3 * 60;

export type RemoteSleepStage = { startTime: string; endTime: string; stage: number };

/** Record `SleepSession` tel que renvoyé par `react-native-health-connect`. */
export type RemoteSleepSessionRecord = {
  startTime: string;
  endTime: string;
  startZoneOffset?: RecordZoneOffset;
  endZoneOffset?: RecordZoneOffset;
  stages?: RemoteSleepStage[];
  metadata?: { dataOrigin?: string };
};

/** Une nuit prête à écrire dans `daily_wellbeing`. */
export type ImportedNight = {
  /** Le matin du réveil (AAAA-MM-JJ). */
  dayKey: string;
  /** Minutes de sommeil, phases d'éveil retirées, bornées à 14 h. */
  minutes: number;
  /** Début et fin de la nuit (ISO UTC) — servent à la régularité du coucher. */
  startAt: string;
  endAt: string;
};

function msOf(value: string): number | null {
  const iso = toIsoInstant(value);
  return iso === null ? null : Date.parse(iso);
}

function offsetOf(zoneOffset: RecordZoneOffset | undefined, fallbackSeconds: number): number {
  if (typeof zoneOffset === 'object' && zoneOffset !== null && Number.isFinite(zoneOffset.totalSeconds)) {
    return zoneOffset.totalSeconds as number;
  }
  if (typeof zoneOffset === 'number' && Number.isFinite(zoneOffset)) return zoneOffset;
  if (typeof zoneOffset === 'string') {
    const match = /^([+-])(\d{2}):?(\d{2})$/.exec(zoneOffset.trim());
    if (match) {
      const sign = match[1] === '-' ? -1 : 1;
      return sign * (Number(match[2]) * 3600 + Number(match[3]) * 60);
    }
  }
  return fallbackSeconds;
}

/** Jour civil et heure locale d'un instant, dans le fuseau du record. */
function localClock(ms: number, offsetSeconds: number): { dayKey: string; hour: number } {
  const shifted = new Date(ms + offsetSeconds * 1000);
  return { dayKey: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() };
}

/** Minutes réellement dormies d'une session : phases d'éveil retirées quand la source les donne. */
function asleepMinutes(record: RemoteSleepSessionRecord, startMs: number, endMs: number): number {
  const stages = (record.stages ?? []).filter((s) => msOf(s.startTime) !== null && msOf(s.endTime) !== null);
  if (stages.length === 0) return (endMs - startMs) / 60_000;
  let asleepMs = 0;
  let awakeMs = 0;
  for (const stage of stages) {
    const duration = Math.max(0, (msOf(stage.endTime) as number) - (msOf(stage.startTime) as number));
    if (SLEEP_AWAKE_STAGES.includes(stage.stage)) awakeMs += duration;
    else asleepMs += duration;
  }
  // Phases partielles (la source n'a découpé qu'une partie de la nuit) : on retire l'éveil déclaré de
  // la durée totale plutôt que de ne garder que les phases de sommeil, qui sous-estimeraient la nuit.
  const total = endMs - startMs;
  return Math.max(asleepMs, total - awakeMs) / 60_000;
}

type Classified = { dayKey: string; minutes: number; startMs: number; endMs: number; night: boolean };

function classify(records: readonly RemoteSleepSessionRecord[], fallbackOffsetSeconds: number): Classified[] {
  const out: Classified[] = [];
  for (const record of records) {
    const startMs = msOf(record.startTime);
    const endMs = msOf(record.endTime);
    if (startMs === null || endMs === null || endMs <= startMs) continue;
    const durationMin = (endMs - startMs) / 60_000;
    // Une session de plus de 20 h est une erreur de la source, pas une nuit.
    if (durationMin > 20 * 60) continue;
    const { dayKey, hour } = localClock(endMs, offsetOf(record.endZoneOffset, fallbackOffsetSeconds));
    const night = durationMin >= NIGHT_MIN_MINUTES && hour >= NIGHT_END_FROM_HOUR && hour < NIGHT_END_UNTIL_HOUR;
    out.push({ dayKey, minutes: asleepMinutes(record, startMs, endMs), startMs, endMs, night });
  }
  return out;
}

/**
 * Les nuits des sessions lues, une par matin, du plus ancien au plus récent.
 *
 * `fallbackOffsetSeconds` s'applique aux records sans décalage horaire (cas courant) : c'est le fuseau
 * de l'appareil, comme partout ailleurs dans l'import Health Connect — jamais UTC.
 */
export function nightsFromSleepSessions(
  records: readonly RemoteSleepSessionRecord[],
  fallbackOffsetSeconds: number = deviceOffsetSeconds(),
): ImportedNight[] {
  const byDay = new Map<string, { minutes: number; startMs: number; endMs: number }>();
  for (const s of classify(records, fallbackOffsetSeconds)) {
    if (!s.night) continue;
    const prev = byDay.get(s.dayKey);
    byDay.set(
      s.dayKey,
      prev === undefined
        ? { minutes: s.minutes, startMs: s.startMs, endMs: s.endMs }
        : { minutes: prev.minutes + s.minutes, startMs: Math.min(prev.startMs, s.startMs), endMs: Math.max(prev.endMs, s.endMs) },
    );
  }
  return [...byDay.entries()]
    .map(([dayKey, v]) => ({
      dayKey,
      minutes: Math.min(SLEEP_MINUTES_MAX, Math.max(0, Math.round(v.minutes))),
      startAt: new Date(v.startMs).toISOString(),
      endAt: new Date(v.endMs).toISOString(),
    }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

/**
 * Une nuit lue peut-elle remplacer ce qui est déjà en base ?
 *
 * **Jamais une saisie manuelle** : si l'utilisateur a corrigé sa nuit à la main, c'est lui qui a
 * raison — sa montre a pu croire qu'il dormait devant un film. Une nuit déjà lue, elle, se relit
 * (la source a pu compléter la session après coup).
 */
export function canWriteImportedNight(existing: { sleepMinutes: number | null; sleepSource: string | null } | null): boolean {
  if (existing === null) return true;
  if (existing.sleepMinutes === null) return true;
  return existing.sleepSource === 'health_connect';
}

// ---------------------------------------------------------------------------
// La régularité du coucher — dérivée, sans rien demander
// ---------------------------------------------------------------------------

/** Nuits lues minimales pour parler de régularité. */
export const REGULARITY_MIN_NIGHTS = 5;
/** Fenêtre regardée, en jours. */
export const REGULARITY_WINDOW_DAYS = 14;

/**
 * Écart-type de l'heure de coucher, en minutes, sur les nuits **lues** des 14 derniers matins.
 *
 * L'heure est comptée depuis midi pour qu'un coucher à 23 h 30 et un autre à 0 h 30 soient à une heure
 * l'un de l'autre, et non à 23. `null` sous 5 nuits : deux couchers ne font pas une habitude.
 */
export function bedtimeSpread(
  nights: ReadonlyArray<{ logDate: string; sleepStartAt: string | null }>,
  todayKey: string,
  fallbackOffsetSeconds: number = deviceOffsetSeconds(),
): { spreadMinutes: number; nights: number; meanBedtimeMinutes: number } | null {
  const minutes: number[] = [];
  for (const n of nights) {
    if (n.sleepStartAt === null || n.logDate > todayKey) continue;
    const ageDays = (Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${n.logDate}T00:00:00Z`)) / 86_400_000;
    if (!(ageDays >= 0 && ageDays < REGULARITY_WINDOW_DAYS)) continue;
    const ms = msOf(n.sleepStartAt);
    if (ms === null) continue;
    const shifted = new Date(ms + fallbackOffsetSeconds * 1000);
    const ofDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
    minutes.push((ofDay - 720 + 1440) % 1440);
  }
  if (minutes.length < REGULARITY_MIN_NIGHTS) return null;
  const mean = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  const variance = minutes.reduce((a, b) => a + (b - mean) ** 2, 0) / minutes.length;
  return {
    spreadMinutes: Math.round(Math.sqrt(variance)),
    nights: minutes.length,
    // Ramenée en minutes depuis minuit (0 = minuit), pour l'affichage d'une heure.
    meanBedtimeMinutes: Math.round(mean + 720) % 1440,
  };
}
