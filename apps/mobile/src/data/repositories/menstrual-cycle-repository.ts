/**
 * Repository du suivi de cycle menstruel (US CYCLE-01) : tables `menstrual_periods` et
 * `menstrual_daily_logs`.
 *
 * Toute la logique de décision (clôtures, longueurs, aberrants, prédiction, phases, croisement) vit
 * dans `@wellness/shared` (`menstrual-cycle.ts`, 33 tests Vitest) : ici, uniquement des
 * entrées/sorties SQL et la **garde d'opt-in**.
 *
 * ⚠️ **La garde d'opt-in est appliquée ici, pas seulement dans l'UI.** Masquer un écran ne garantit
 * pas qu'aucune ligne n'est écrite ; sur une donnée de santé sensible, la garantie doit tenir au
 * point d'écriture. Toutes les fonctions d'écriture de ce fichier lèvent si le suivi est désactivé.
 *
 * ⚠️ **Ce n'est PAS une garde en lecture.** Désactiver le suivi sans supprimer les données est un
 * choix offert (R17) : ce qui est conservé doit rester lisible — pour l'export RGPD notamment.
 */

import { useQuery } from '@powersync/react';
import {
  localDayKey,
  menstrualFlowSchema,
  menstrualSymptomSchema,
  closeOpenPeriodsFor,
  staleOpenPeriods,
  type MenstrualFlow,
  type MenstrualPeriod,
  type MenstrualSymptom,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch, softDelete } from './_sql';
import { useTodayKey } from '@/hooks/useTodayKey';

// ---------------------------------------------------------------------------
// Types de domaine
// ---------------------------------------------------------------------------

export type MenstrualDailyLog = {
  id: string;
  logDate: string;
  flow: MenstrualFlow | null;
  symptoms: MenstrualSymptom[];
};

type PeriodDbRow = {
  id: string;
  started_on: string;
  ended_on: string | null;
  source: string;
};

type DailyLogDbRow = {
  id: string;
  log_date: string;
  flow: string | null;
  symptoms: string | null;
};

const PERIOD_COLS = 'id, started_on, ended_on, source';
const LOG_COLS = 'id, log_date, flow, symptoms';

function toPeriod(row: PeriodDbRow): MenstrualPeriod {
  return { id: row.id, startedOn: row.started_on, endedOn: row.ended_on };
}

/**
 * `symptoms` est stocké en **TEXT** côté SQLite (PowerSync n'a pas de type `jsonb`). Le parse est
 * volontairement tolérant : une valeur illisible ou un code inconnu donne une liste vide plutôt
 * qu'une exception — un journal de santé ne doit pas devenir inaccessible parce qu'une ligne est
 * malformée.
 */
function parseSymptoms(raw: string | null): MenstrualSymptom[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((v) => {
      const r = menstrualSymptomSchema.safeParse(v);
      return r.success ? [r.data] : [];
    });
  } catch {
    return [];
  }
}

function toDailyLog(row: DailyLogDbRow): MenstrualDailyLog {
  const flow = menstrualFlowSchema.safeParse(row.flow);
  return {
    id: row.id,
    logDate: row.log_date,
    flow: flow.success ? flow.data : null,
    symptoms: parseSymptoms(row.symptoms),
  };
}

// ---------------------------------------------------------------------------
// Lecture (hooks réactifs)
// ---------------------------------------------------------------------------

/**
 * Toutes les périodes, de la plus ancienne à la plus récente.
 *
 * L'ordre croissant est celui qu'attendent les briques pures (`cycleLengths`, `predictNextPeriod`) —
 * elles retrient de toute façon, mais lire dans l'ordre du calcul évite les surprises au débogage.
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) : pas de filtre
 * `user_id` en lecture, comme partout ailleurs.
 */
export function useMenstrualPeriods(): { periods: MenstrualPeriod[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<PeriodDbRow>(
    `SELECT ${PERIOD_COLS} FROM menstrual_periods WHERE deleted_at IS NULL ORDER BY started_on ASC`,
  );
  return { periods: data.map(toPeriod), isLoading };
}

/** Période en cours (`ended_on` nul), ou `null`. L'index unique garantit qu'il n'y en a qu'une. */
export function useOpenPeriod(): { period: MenstrualPeriod | null; isLoading: boolean } {
  const { data, isLoading } = useQuery<PeriodDbRow>(
    `SELECT ${PERIOD_COLS} FROM menstrual_periods WHERE deleted_at IS NULL AND ended_on IS NULL LIMIT 1`,
  );
  const row = data[0];
  return { period: row ? toPeriod(row) : null, isLoading };
}

/** Journaux quotidiens depuis `sinceDate` incluse, du plus récent au plus ancien. */
export function useMenstrualDailyLogs(sinceDate?: string): {
  logs: MenstrualDailyLog[];
  isLoading: boolean;
} {
  const sql = sinceDate
    ? `SELECT ${LOG_COLS} FROM menstrual_daily_logs WHERE deleted_at IS NULL AND log_date >= ? ORDER BY log_date DESC`
    : `SELECT ${LOG_COLS} FROM menstrual_daily_logs WHERE deleted_at IS NULL ORDER BY log_date DESC`;
  const { data, isLoading } = useQuery<DailyLogDbRow>(sql, sinceDate ? [sinceDate] : []);
  return { logs: data.map(toDailyLog), isLoading };
}

/** Journal du jour, ou `null` — alimente l'état du widget. */
export function useTodayMenstrualLog(): { log: MenstrualDailyLog | null; isLoading: boolean } {
  const todayKey = useTodayKey();
  const { data, isLoading } = useQuery<DailyLogDbRow>(
    `SELECT ${LOG_COLS} FROM menstrual_daily_logs WHERE deleted_at IS NULL AND log_date = ? LIMIT 1`,
    [todayKey],
  );
  const row = data[0];
  return { log: row ? toDailyLog(row) : null, isLoading };
}

export async function getMenstrualLogForDay(logDate: string): Promise<MenstrualDailyLog | null> {
  const row = await powerSync.getOptional<DailyLogDbRow>(
    `SELECT ${LOG_COLS} FROM menstrual_daily_logs WHERE deleted_at IS NULL AND log_date = ? LIMIT 1`,
    [logDate],
  );
  return row ? toDailyLog(row) : null;
}

// ---------------------------------------------------------------------------
// Gardes
// ---------------------------------------------------------------------------

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible d’écrire un suivi de cycle.');
  return userId;
}

/**
 * Lève si le suivi n'est pas activé (R16).
 *
 * Lue **en base locale** et non depuis un store React : cette fonction est appelée hors contexte de
 * hook, et le réglage est la seule source de vérité — un état React désynchronisé laisserait passer
 * une écriture.
 */
async function assertCycleTrackingEnabled(): Promise<void> {
  const row = await powerSync.getOptional<{ cycle_tracking_enabled: number | null }>(
    'SELECT cycle_tracking_enabled FROM user_settings WHERE deleted_at IS NULL LIMIT 1',
  );
  if (row?.cycle_tracking_enabled !== 1) {
    throw new Error('Suivi du cycle désactivé : aucune écriture autorisée.');
  }
}

/** R4 — la saisie rétroactive est libre, le futur est refusé : on ne note pas ce qui n'a pas eu lieu. */
function assertNotFuture(dateKey: string): void {
  if (dateKey > localDayKey(new Date())) {
    throw new Error(`Date future refusée : ${dateKey}`);
  }
}

// ---------------------------------------------------------------------------
// Écritures — périodes
// ---------------------------------------------------------------------------

/**
 * Démarre une période à `startedOn`.
 *
 * Applique **R2 dans la même passe** : toute période restée ouverte est close la veille du nouveau
 * début. Sans ça, l'index unique partiel `(user_id) where ended_on is null` rejetterait l'insertion —
 * et surtout, deux périodes ouvertes fausseraient silencieusement toutes les longueurs de cycle.
 *
 * Idempotent sur `started_on` : redémarrer une période déjà enregistrée ne crée pas de doublon
 * (c'est aussi ce qui rend l'import Health Connect rejouable, R21).
 */
export async function startPeriod(
  startedOn: string,
  source: 'manual' | 'health_connect' = 'manual',
): Promise<string> {
  await assertCycleTrackingEnabled();
  assertNotFuture(startedOn);

  const existing = await powerSync.getOptional<{ id: string }>(
    'SELECT id FROM menstrual_periods WHERE deleted_at IS NULL AND started_on = ? LIMIT 1',
    [startedOn],
  );
  if (existing) return existing.id;

  const open = await powerSync.getAll<PeriodDbRow>(
    `SELECT ${PERIOD_COLS} FROM menstrual_periods WHERE deleted_at IS NULL AND ended_on IS NULL`,
  );
  for (const closure of closeOpenPeriodsFor(open.map(toPeriod), startedOn)) {
    await patch('menstrual_periods', closure.id, { ended_on: closure.endedOn });
  }

  return insertWithSyncFields('menstrual_periods', {
    user_id: currentUserId(),
    started_on: startedOn,
    ended_on: null,
    source,
  });
}

/** Clôt une période. `endedOn` antérieur au début est refusé (l'invariant SQL le refuserait aussi). */
export async function endPeriod(id: string, endedOn: string): Promise<void> {
  await assertCycleTrackingEnabled();
  assertNotFuture(endedOn);
  await patch('menstrual_periods', id, { ended_on: endedOn });
}

/** Suppression **douce** — comme partout dans le projet, jamais de `delete` côté client. */
export async function deletePeriod(id: string): Promise<void> {
  await assertCycleTrackingEnabled();
  await softDelete('menstrual_periods', id);
}

/**
 * R3 — clôt d'office les périodes ouvertes depuis plus de 15 jours.
 *
 * À appeler à l'ouverture de l'écran, pas sur un minuteur : c'est une **correction de saisie**
 * (oubli de « fin »), pas un fait à horodater. Renvoie le nombre de périodes corrigées, pour que
 * l'UI puisse le signaler — la valeur est reprise telle quelle, sans phrase.
 */
export async function autoCloseStalePeriods(todayKey: string): Promise<number> {
  const open = await powerSync.getAll<PeriodDbRow>(
    `SELECT ${PERIOD_COLS} FROM menstrual_periods WHERE deleted_at IS NULL AND ended_on IS NULL`,
  );
  const stale = staleOpenPeriods(open.map(toPeriod), todayKey);
  for (const s of stale) {
    await patch('menstrual_periods', s.id, { ended_on: s.endedOn });
  }
  return stale.length;
}

// ---------------------------------------------------------------------------
// Écritures — journal quotidien
// ---------------------------------------------------------------------------

/**
 * Enregistre le journal d'un jour : **met à jour** la ligne existante, ou la crée.
 *
 * Un jour sans flux **et** sans symptôme est une saisie valide : c'est ainsi qu'on **efface** une
 * saisie précédente. On écrit donc la ligne vide plutôt que de refuser — refuser rendrait la
 * correction impossible.
 */
export async function saveMenstrualDailyLog(
  logDate: string,
  input: { flow?: MenstrualFlow | null; symptoms?: MenstrualSymptom[] },
): Promise<void> {
  await assertCycleTrackingEnabled();
  assertNotFuture(logDate);

  const columns = {
    flow: input.flow ?? null,
    symptoms: JSON.stringify(input.symptoms ?? []),
  };

  const existing = await powerSync.getOptional<{ id: string }>(
    'SELECT id FROM menstrual_daily_logs WHERE deleted_at IS NULL AND log_date = ? LIMIT 1',
    [logDate],
  );

  if (existing) {
    await patch('menstrual_daily_logs', existing.id, columns);
    return;
  }

  await insertWithSyncFields('menstrual_daily_logs', {
    user_id: currentUserId(),
    log_date: logDate,
    ...columns,
  });
}

// ---------------------------------------------------------------------------
// Désactivation (R17)
// ---------------------------------------------------------------------------

/**
 * Supprime **toutes** les données de cycle (soft delete).
 *
 * Appelée uniquement si l'utilisatrice le demande explicitement à la désactivation : désactiver
 * n'efface pas, « garder » reste un choix valide (R17). Ne passe **pas** par
 * `assertCycleTrackingEnabled` — on doit pouvoir supprimer après avoir désactivé.
 */
export async function deleteAllCycleData(): Promise<void> {
  const now = new Date().toISOString();
  await powerSync.writeTransaction(async (tx) => {
    await tx.execute(
      'UPDATE menstrual_periods SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL',
      [now, now],
    );
    await tx.execute(
      'UPDATE menstrual_daily_logs SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL',
      [now, now],
    );
  });
}
