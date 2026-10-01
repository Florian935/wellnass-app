/**
 * Repository du check-in de bien-être (US BIEN-01) : table `daily_wellbeing`, une ligne par jour.
 *
 * Toute la logique de décision (échelle valide, check-in vide, fenêtre de rattrapage, séries et
 * moyennes) vit dans `@wellness/shared` (`wellbeing.ts`, testée sous Vitest) : ici, uniquement des
 * entrées/sorties SQL.
 *
 * US BIEN-03 → BIEN-07 — le pilier Bien-être y ajoute la qualité de la nuit, l'envie, quatre
 * étiquettes, quatre réponses de modules et la nuit lue dans Health Connect. **Toujours une ligne par
 * jour** : le check-in du matin et celui du soir écrivent la même.
 *
 * ⚠️ **Le poids n'est pas géré ici.** Il vit dans `body_weight_entries` et passe par
 * `logWeight()` de `bodyweight-repository`, qui sait déjà mettre à jour la pesée du jour au lieu
 * d'en créer une seconde. Dupliquer cette logique fabriquerait deux vérités pour la même mesure.
 */

import { useQuery } from '@powersync/react';
import {
  WELLBEING_SCALE_KEYS,
  WELLBEING_TAGS,
  canEditDay,
  canWriteImportedNight,
  isAlcoholDrinks,
  isEmptyCheckin,
  isNapMinutes,
  isSleepMinutes,
  isWellbeingLevel,
  localDayKey,
  type ImportedNight,
  type LocalWellbeing,
  type WellbeingCheckinInput,
  type WellbeingScaleKey,
  type WellbeingTag,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch } from './_sql';
import { useTodayKey } from '@/hooks/useTodayKey';

/** Un check-in, forme applicative. */
export type WellbeingEntry = {
  id: string;
  logDate: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  /** US LABO-01 : la nuit qui précède ce matin, en minutes, ou `null` si non saisie. */
  sleepMinutes: number | null;
  /** US BIEN-03 — qualité de la nuit et envie de s'entraîner (1-5). */
  sleepQuality: number | null;
  motivation: number | null;
  /** US BIEN-03 — les quatre étiquettes du jour. */
  sick: boolean;
  busyDay: boolean;
  lateNight: boolean;
  travel: boolean;
  /** US BIEN-07 — les réponses des modules (`null` = pas répondu). */
  alcoholDrinks: number | null;
  lateCaffeine: boolean | null;
  napMinutes: number | null;
  cravings: number | null;
  /** US BIEN-06 — d'où vient la nuit, et ses bornes quand elle a été lue. */
  sleepSource: 'manual' | 'health_connect' | null;
  sleepStartAt: string | null;
  sleepEndAt: string | null;
};

type WellbeingDbRow = {
  id: string;
  log_date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleep_minutes: number | null;
  sleep_quality: number | null;
  motivation: number | null;
  sick: number | null;
  busy_day: number | null;
  late_night: number | null;
  travel: number | null;
  alcohol_drinks: number | null;
  late_caffeine: number | null;
  nap_minutes: number | null;
  cravings: number | null;
  sleep_source: string | null;
  sleep_start_at: string | null;
  sleep_end_at: string | null;
};

const SELECT_COLS = `id, log_date, mood, energy, stress, sleep_minutes, sleep_quality, motivation, sick, busy_day,
  late_night, travel, alcohol_drinks, late_caffeine, nap_minutes, cravings, sleep_source, sleep_start_at, sleep_end_at`;

/** Les colonnes d'une échelle 1-5, et d'une étiquette. */
const SCALE_COLUMN: Record<WellbeingScaleKey, string> = {
  mood: 'mood',
  energy: 'energy',
  stress: 'stress',
  sleepQuality: 'sleep_quality',
  motivation: 'motivation',
  cravings: 'cravings',
};
const TAG_COLUMN: Record<WellbeingTag, string> = {
  sick: 'sick',
  busyDay: 'busy_day',
  lateNight: 'late_night',
  travel: 'travel',
};

function toEntry(row: WellbeingDbRow): WellbeingEntry {
  return {
    id: row.id,
    logDate: row.log_date,
    mood: row.mood,
    energy: row.energy,
    stress: row.stress,
    sleepMinutes: row.sleep_minutes,
    sleepQuality: row.sleep_quality ?? null,
    motivation: row.motivation ?? null,
    // `=== 1` : une colonne absente d'une ligne ancienne (`null`) se lit « non coché ».
    sick: row.sick === 1,
    busyDay: row.busy_day === 1,
    lateNight: row.late_night === 1,
    travel: row.travel === 1,
    alcoholDrinks: row.alcohol_drinks ?? null,
    lateCaffeine: row.late_caffeine === null || row.late_caffeine === undefined ? null : row.late_caffeine === 1,
    napMinutes: row.nap_minutes ?? null,
    cravings: row.cravings ?? null,
    sleepSource: row.sleep_source === 'manual' || row.sleep_source === 'health_connect' ? row.sleep_source : null,
    sleepStartAt: row.sleep_start_at ?? null,
    sleepEndAt: row.sleep_end_at ?? null,
  };
}

/**
 * Check-ins depuis `sinceDate` (AAAA-MM-JJ incluse), du plus récent au plus ancien.
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) : pas besoin de
 * filtrer sur `user_id` en lecture, comme partout ailleurs dans les repositories.
 */
export function useWellbeingEntries(sinceDate?: string): {
  entries: WellbeingEntry[];
  isLoading: boolean;
} {
  const sql = sinceDate
    ? `SELECT ${SELECT_COLS} FROM daily_wellbeing WHERE deleted_at IS NULL AND log_date >= ? ORDER BY log_date DESC`
    : `SELECT ${SELECT_COLS} FROM daily_wellbeing WHERE deleted_at IS NULL ORDER BY log_date DESC`;
  const { data, isLoading } = useQuery<WellbeingDbRow>(sql, sinceDate ? [sinceDate] : []);
  return { entries: data.map(toEntry), isLoading };
}

/**
 * Lignes brutes pour les briques pures de `@wellness/shared` (séries, moyennes) — même forme que
 * `LocalWellbeing`, `deletedAt` compris pour que les briques puissent l'ignorer elles-mêmes.
 */
export function useWellbeingRows(sinceDate?: string): {
  rows: LocalWellbeing[];
  isLoading: boolean;
} {
  const { entries, isLoading } = useWellbeingEntries(sinceDate);
  return { rows: entries, isLoading };
}

/** Check-in du jour, ou `null` s'il n'a pas encore été fait — alimente l'état du widget. */
export function useTodayWellbeing(): { entry: WellbeingEntry | null; isLoading: boolean } {
  const todayKey = useTodayKey();
  return useWellbeingForDay(todayKey);
}

/** Check-in d'un jour donné, réactif (hier, pour le rattrapage du soir depuis le matin). */
export function useWellbeingForDay(logDate: string): { entry: WellbeingEntry | null; isLoading: boolean } {
  const { data, isLoading } = useQuery<WellbeingDbRow>(
    `SELECT ${SELECT_COLS} FROM daily_wellbeing WHERE deleted_at IS NULL AND log_date = ? LIMIT 1`,
    [logDate],
  );
  const row = data[0];
  return { entry: row ? toEntry(row) : null, isLoading };
}

/** Check-in d'un jour donné (pour le rattrapage depuis l'historique). */
export async function getWellbeingForDay(logDate: string): Promise<WellbeingEntry | null> {
  const row = await powerSync.getOptional<WellbeingDbRow>(
    `SELECT ${SELECT_COLS} FROM daily_wellbeing WHERE deleted_at IS NULL AND log_date = ? LIMIT 1`,
    [logDate],
  );
  return row ? toEntry(row) : null;
}

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’écrire un check-in.');
  return userId;
}

/** Normalise en valeur stockable : un niveau hors échelle est traité comme absent. */
function toColumn(value: number | null | undefined): number | null {
  return isWellbeingLevel(value) ? value : null;
}

/**
 * Les colonnes que porte une entrée — **seulement les clés présentes** (règle du correctif LABO-01 :
 * une mise à jour partielle n'efface pas ce qu'elle ne porte pas).
 */
function presentColumns(input: WellbeingCheckinInput): Record<string, number | string | null> {
  const columns: Record<string, number | string | null> = {};
  for (const key of WELLBEING_SCALE_KEYS) {
    if (key in input) columns[SCALE_COLUMN[key]] = toColumn(input[key]);
  }
  // US LABO-01 : une durée hors bornes est traitée comme absente, comme un niveau hors échelle.
  if ('sleepMinutes' in input) {
    columns.sleep_minutes = isSleepMinutes(input.sleepMinutes) ? input.sleepMinutes : null;
    // US BIEN-06 : une nuit saisie à la main l'est à la main — une lecture ne l'écrasera plus.
    columns.sleep_source = isSleepMinutes(input.sleepMinutes) ? 'manual' : null;
    if (!isSleepMinutes(input.sleepMinutes)) {
      columns.sleep_start_at = null;
      columns.sleep_end_at = null;
    }
  }
  for (const tag of WELLBEING_TAGS) {
    if (tag in input) columns[TAG_COLUMN[tag]] = input[tag] === true ? 1 : 0;
  }
  if ('alcoholDrinks' in input) columns.alcohol_drinks = isAlcoholDrinks(input.alcoholDrinks) ? input.alcoholDrinks : null;
  if ('lateCaffeine' in input) columns.late_caffeine = typeof input.lateCaffeine === 'boolean' ? (input.lateCaffeine ? 1 : 0) : null;
  if ('napMinutes' in input) columns.nap_minutes = isNapMinutes(input.napMinutes) ? input.napMinutes : null;
  return columns;
}

/**
 * US BIEN-06 — toutes les écritures de `daily_wellbeing` passent **l'une après l'autre**.
 *
 * Chaque écriture lit la ligne du jour, puis la patche ou la crée. Deux écritures simultanées sur un
 * jour sans ligne (le retour de l'écran de permission Health Connect lance l'import pendant que le
 * réglage en lance un autre ; un check-in validé pendant un import) créeraient **deux lignes** pour
 * le même jour. SQLite les accepte ; Postgres, lui, a un index unique `(user_id, log_date)` : la
 * seconde serait rejetée à l'envoi, et PowerSync sérialisant sa file, c'est la remontée de **toutes**
 * les tables qui se figerait. En file, la seconde écriture voit la ligne créée par la première.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  // Un échec ne bloque pas les écritures suivantes ; il reste rendu à son appelant.
  writeQueue = run.catch(() => undefined);
  return run;
}

/**
 * Enregistre le check-in d'un jour : **met à jour** la ligne existante, ou la crée.
 *
 * Refuse — et le dit, plutôt que d'échouer en silence :
 * - un jour **hors fenêtre** de rattrapage (décision D4 : J-6 → aujourd'hui, jamais le futur) ;
 * - la **création** d'une ligne vide (aucun indicateur exploitable).
 *
 * US BIEN-03 — sur une ligne **existante**, une entrée « vide » s'écrit quand même : décocher
 * « malade » ou retirer la seule humeur saisie doit pouvoir se faire. Avant, retirer le dernier
 * indicateur d'une journée était silencieusement ignoré.
 *
 * Renvoie `true` si quelque chose a été écrit.
 */
export function saveWellbeing(logDate: string, input: WellbeingCheckinInput): Promise<boolean> {
  return serialized(() => saveWellbeingNow(logDate, input));
}

async function saveWellbeingNow(logDate: string, input: WellbeingCheckinInput): Promise<boolean> {
  if (!canEditDay(logDate, localDayKey(new Date()))) {
    throw new Error(`Jour hors fenêtre de saisie : ${logDate}`);
  }

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM daily_wellbeing WHERE log_date = ? AND deleted_at IS NULL LIMIT 1`,
    [logDate],
  );

  if (existing) {
    const columns = presentColumns(input);
    if (Object.keys(columns).length === 0) return false;
    await patch('daily_wellbeing', existing.id, columns);
    return true;
  }

  if (isEmptyCheckin(input)) return false;

  // À la création en revanche, les colonnes de BIEN-01 absentes sont explicitement nulles : la ligne
  // doit être complète en base, et `null` y est le « non renseigné » du modèle. Les colonnes du pilier
  // ne s'écrivent que si l'entrée les porte : un client sans le pilier reste identique à BIEN-01.
  const present = presentColumns(input);
  await insertWithSyncFields('daily_wellbeing', {
    user_id: currentUserId(),
    log_date: logDate,
    mood: toColumn(input.mood),
    energy: toColumn(input.energy),
    stress: toColumn(input.stress),
    sleep_minutes: isSleepMinutes(input.sleepMinutes) ? input.sleepMinutes : null,
    ...present,
  });
  return true;
}

/**
 * US BIEN-06 — écrit les nuits lues dans Health Connect. Renvoie le nombre de jours écrits.
 *
 * Trois garde-fous :
 * - **une saisie manuelle n'est jamais écrasée** (`canWriteImportedNight`) ;
 * - seuls les jours **ouverts à la saisie** (J-6 → aujourd'hui) sont écrits : une nuit d'il y a trois
 *   semaines ne doit pas réécrire l'historique sur lequel les liens ont été calculés ;
 * - une nuit identique n'est pas réécrite (pas d'écriture, pas de synchro pour rien).
 */
export function upsertImportedNights(nights: readonly ImportedNight[], todayKey: string): Promise<number> {
  return serialized(() => upsertImportedNightsNow(nights, todayKey));
}

async function upsertImportedNightsNow(nights: readonly ImportedNight[], todayKey: string): Promise<number> {
  let written = 0;
  for (const night of nights) {
    if (!canEditDay(night.dayKey, todayKey)) continue;
    const existing = await getWellbeingForDay(night.dayKey);
    if (!canWriteImportedNight(existing)) continue;
    if (existing && existing.sleepMinutes === night.minutes && existing.sleepSource === 'health_connect' && existing.sleepStartAt === night.startAt) {
      continue;
    }
    const columns = {
      sleep_minutes: night.minutes,
      sleep_source: 'health_connect',
      sleep_start_at: night.startAt,
      sleep_end_at: night.endAt,
    };
    if (existing) {
      await patch('daily_wellbeing', existing.id, columns);
    } else {
      await insertWithSyncFields('daily_wellbeing', {
        user_id: currentUserId(),
        log_date: night.dayKey,
        mood: null,
        energy: null,
        stress: null,
        ...columns,
      });
    }
    written += 1;
  }
  return written;
}
