/**
 * Repository des périodes « mode vie réelle » (US VIE-01, roadmap 1.28) : table `real_life_periods`.
 *
 * Toute la règle vit dans `@wellness/shared` (`real-life.ts`) : ici, uniquement des entrées/sorties
 * SQL et l'assemblage des ensembles que consomment la série, les insights et le bilan hebdo.
 *
 * ⚠️ **Rien de l'état n'est stocké** (patron OBJ-01) : la ligne ne porte que son intervalle
 * `[started_on, ends_on]`, bornes incluses. Période active, jours restants, jours en pause et cibles
 * abaissées sont **recalculés à chaque lecture** — donc rien à écrire pour lire, donc tout marche
 * hors ligne.
 *
 * ⚠️ **« Arrêter maintenant » n'est PAS un soft delete** : on pose `ends_on = aujourd'hui`. La période
 * a existé, elle doit continuer d'annoter les analyses passées (décision D2). Supprimer la ligne
 * effacerait l'explication d'une semaine creuse.
 */

import { useMemo } from 'react';

import { useQuery } from '@powersync/react';
import {
  activeRealLifePeriod,
  localDayKey,
  realLifeDayKeys,
  realLifeDaysInWeek,
  realLifeDaysRemaining,
  validateRealLifePeriod,
  type RealLifePeriod,
  type RealLifePeriodError,
} from '@wellness/shared';

import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch } from './_sql';

/** Ligne brute de `real_life_periods`. */
type PeriodRow = { id: string; started_on: string; ends_on: string };

const SELECT_PERIODS = `
  SELECT id, started_on, ends_on
  FROM real_life_periods
  WHERE deleted_at IS NULL
  ORDER BY started_on DESC
`;

function toPeriod(row: PeriodRow): RealLifePeriod {
  return { id: row.id, startedOn: row.started_on, endsOn: row.ends_on };
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/**
 * Toutes les périodes de l'utilisateur, la plus récente d'abord.
 *
 * L'historique **entier**, et pas seulement la période active : c'est lui qui permet d'annoter les
 * semaines passées (décision D2). Le volume est négligeable — quelques lignes par an.
 */
export function useRealLifePeriods(): { periods: RealLifePeriod[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<PeriodRow>(SELECT_PERIODS);
  const periods = useMemo(() => data.map(toPeriod), [data]);
  return { periods, isLoading };
}

/**
 * Tout ce dont les autres couches ont besoin, dérivé en une passe.
 *
 * Regroupé volontairement : la série, les insights et le bilan hebdo doivent parler **des mêmes**
 * jours. Trois hooks séparés qui reliraient l'horloge à des instants différents pourraient diverger au
 * passage de minuit — et un décalage d'un jour entre « la série est en pause » et « les cartes se
 * taisent » serait incompréhensible.
 */
export function useRealLifeState(): {
  /** La période qui couvre aujourd'hui, ou `null`. */
  activePeriod: RealLifePeriod | null;
  /** Vrai si une période court aujourd'hui — le booléen que consomment `selectInsights` et R4. */
  inRealLifePeriod: boolean;
  /** Jours couverts par une période, pour la série (`computeStreakWithJokers`). */
  pausedDays: Set<string>;
  /** Jours restants de la période active. `null` s'il n'y en a pas. */
  daysRemaining: number | null;
  periods: RealLifePeriod[];
  isLoading: boolean;
} {
  const { periods, isLoading } = useRealLifePeriods();

  return useMemo(() => {
    // `localDayKey(new Date())` est lu ici, dans le corps du `useMemo`, jamais dans le moteur pur :
    // les fonctions de `real-life.ts` reçoivent `todayKey` en paramètre (même contrainte que
    // `selectInsights` et `findSessionConflicts` — une lecture d'horloge dans un slot mount-only
    // serait gelée par React Compiler).
    const todayKey = localDayKey(new Date());
    const activePeriod = activeRealLifePeriod(periods, todayKey);

    return {
      activePeriod,
      inRealLifePeriod: activePeriod !== null,
      pausedDays: realLifeDayKeys(periods),
      daysRemaining: activePeriod === null ? null : realLifeDaysRemaining(activePeriod, todayKey),
      periods,
      isLoading,
    };
  }, [periods, isLoading]);
}

/** Jours de période tombant dans `[weekStart, weekEnd]` — l'annotation du bilan hebdo (R7). */
export function useRealLifeDaysInWeek(weekStart: string, weekEnd: string): number {
  const { periods } = useRealLifePeriods();
  return useMemo(() => realLifeDaysInWeek(periods, weekStart, weekEnd), [periods, weekStart, weekEnd]);
}

/**
 * Nombre de séances de musculation **habituellement** planifiées dans une semaine.
 *
 * C'est le dénominateur de la cible dégradée (R3 : la moitié du plan, plancher à 1). On lit le
 * planning **réel** plutôt qu'un réglage déclaré : c'est la seule source qui dise ce que
 * l'utilisateur fait vraiment, et elle existe déjà.
 *
 * Aucun filtre `owner_id` : la base SQLite locale ne contient que les lignes de l'utilisateur
 * (les sync rules s'en chargent), comme partout ailleurs dans ce dossier.
 *
 * ⚠️ `useMinimalWeekTargets` vit dans `dashboard-repository`, pas ici : il a besoin de la chaîne
 * nutrition (`useDayCalorieTarget`), et l'importer d'ici aurait créé un **cycle** — ce fichier est
 * déjà importé *par* `dashboard-repository`.
 */
export const SELECT_WEEK_STRENGTH_SESSIONS = `
  SELECT COUNT(*) AS n
  FROM planned_sessions ps
  JOIN programs p ON p.id = ps.program_id AND p.deleted_at IS NULL
  WHERE ps.deleted_at IS NULL AND p.pillar = 'strength'
        AND ps.scheduled_date >= ? AND ps.scheduled_date <= ?
`;

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) throw new Error('Aucune session active : impossible de déclarer une période.');
  return userId;
}

/** Erreur portant un motif traduisible par l'UI, plutôt qu'un message technique. */
export class RealLifePeriodValidationError extends Error {
  constructor(readonly reason: RealLifePeriodError) {
    super(`Période « vie réelle » invalide : ${reason}`);
    this.name = 'RealLifePeriodValidationError';
  }
}

/**
 * Déclare une période et renvoie son id.
 *
 * ⚠️ **La validation est appelée ici et à chaque prolongation**, parce qu'elle est la **seule**
 * protection : la table ne porte volontairement aucune contrainte de plage — une violation bloquerait
 * la file d'upload PowerSync (patron REPAS-01, D6).
 *
 * ⚠️ **Ne jamais `void` cet appel côté UI.** C'est ce qui a rendu la panne de CYCLE-01 invisible :
 * l'écriture échouait, `void updateSettings()` avalait l'erreur, et l'interrupteur restait éteint sans
 * le moindre message. L'appelant doit pouvoir afficher l'échec.
 */
export async function startRealLifePeriod(input: {
  startedOn: string;
  endsOn: string;
}): Promise<string> {
  const todayKey = localDayKey(new Date());
  const reason = validateRealLifePeriod({ ...input, todayKey });
  if (reason !== null) throw new RealLifePeriodValidationError(reason);

  return insertWithSyncFields('real_life_periods', {
    user_id: currentUserId(),
    started_on: input.startedOn,
    ends_on: input.endsOn,
  });
}

/**
 * Prolonge une période en repoussant sa date de fin.
 *
 * On relit `started_on` en base plutôt que de le recevoir en paramètre : la validation doit porter sur
 * l'intervalle **réel**, pas sur ce que l'écran croit savoir — il a pu être ouvert avant une synchro.
 */
export async function extendRealLifePeriod(id: string, endsOn: string): Promise<void> {
  const row = await powerSync.getOptional<{ started_on: string }>(
    `SELECT started_on FROM real_life_periods WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  if (!row) throw new Error(`Période introuvable : ${id}`);

  const reason = validateRealLifePeriod({
    startedOn: row.started_on,
    endsOn,
    todayKey: localDayKey(new Date()),
  });
  if (reason !== null) throw new RealLifePeriodValidationError(reason);

  await patch('real_life_periods', id, { ends_on: endsOn });
}

/**
 * Termine une période aujourd'hui — « reprendre le plan normal ».
 *
 * **Pas de soft delete**, et c'est le point : la période garde ses jours écoulés, donc elle continue
 * d'annoter les analyses de la semaine (décision D2). L'effacer rendrait une semaine creuse
 * inexplicable.
 *
 * Cas limite volontairement traité : si la période **commence aujourd'hui**, `ends_on = aujourd'hui`
 * la réduit à un seul jour au lieu de produire un intervalle inversé.
 */
export async function stopRealLifePeriod(id: string): Promise<void> {
  await patch('real_life_periods', id, { ends_on: localDayKey(new Date()) });
}
