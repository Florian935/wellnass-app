/**
 * Repository de la planification datée des séances (pilier-agnostique : muscu + running).
 *
 * Responsabilité unique : lire/écrire la table locale PowerSync `planned_sessions`
 * (instances datées d'un programme) et exposer des vues « semaine » et « manquées »
 * prêtes pour l'UI (nom + métadonnées de la séance résolus par jointure sur `sessions`,
 * pilier + nombre d'exercices résolus par jointure sur `programs` / `exercise_plans`).
 *
 * Modèle de données (voir docs/specs/functional/running.md et
 * docs/specs/technical/modele-donnees.md) :
 *  - `planned_sessions` : une ligne par occurrence datée d'une séance de programme.
 *                         `scheduled_date` (AAAA-MM-JJ), `status` ('planned' | 'done' |
 *                         'skipped'), `week_index` (0-based), `completed_at`. La table est
 *                         pilier-agnostique ; le filtrage running se fait par jointure sur
 *                         `programs.pillar`.
 *
 * Planification (`planProgram`) : génération datée des instances à partir du
 * template de séances du programme + affectation d'un jour de semaine par séance, le
 * tout dans UNE transaction atomique (soft-delete des `planned` existants → insertion
 * des nouvelles → activation du programme inlinée). Voir `@wellness/shared` :
 * `generatePlannedSessions` (alignement au lundi de la semaine de `startDate`).
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `txInsert` en transaction).
 *  - Timestamps en UTC ; dates calendaires en AAAA-MM-JJ (chaîne locale).
 *  - `owner_id` = utilisateur de la session courante sur toute écriture.
 *  - Suppression = soft delete (jamais de hard delete client).
 *  - Toutes les valeurs SQL sont passées en paramètres liés (?), jamais interpolées.
 */

import { useQuery } from '@powersync/react';
import type {
  Pillar,
  PlanProgramInput,
  PlanTemplateSession,
  ProgramSessionType,
} from '@wellness/shared';
import {
  addDays,
  generatePlannedSessions,
  localDayKey,
  planProgramInputSchema,
} from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { nowUtc, patch, txInsert } from './_sql';
import { useTodayDate, useTodayKey } from '@/hooks/useTodayKey';

// ---------------------------------------------------------------------------
// Types de domaine exposés à l'UI
// ---------------------------------------------------------------------------

export type PlannedSessionStatus = 'planned' | 'done' | 'skipped';

/** Séance planifiée datée, prête pour l'UI (nom + cibles résolus par jointure). */
export type PlannedSessionItem = {
  id: string;
  programId: string;
  sessionId: string;
  scheduledDate: string; // AAAA-MM-JJ
  status: PlannedSessionStatus;
  weekIndex: number | null;
  sessionName: string | null;
  sessionType: ProgramSessionType | null;
  targetDistanceM: number | null;
  targetDurationSeconds: number | null;
  orderIndex: number;
  pillar: Pillar;
  exerciseCount: number;
};

// Le type `PlanProgramInput` (+ son schéma Zod `planProgramInputSchema`)
// est défini et exporté par `@wellness/shared` : validation runtime des saisies UI.

// ---------------------------------------------------------------------------
// Lignes brutes SQLite (colonnes snake_case)
// ---------------------------------------------------------------------------

/** Ligne brute d'une séance planifiée jointe à `sessions` (pour les vues). */
type PlannedSessionDbRow = {
  id: string;
  program_id: string;
  session_id: string;
  scheduled_date: string;
  status: string;
  week_index: number | null;
  session_name: string | null;
  session_type: string | null;
  target_distance_m: number | null;
  target_duration_seconds: number | null;
  order_index: number;
  pillar: string;
  exercise_count: number;
};

// ---------------------------------------------------------------------------
// Requêtes SQL (noms de tables/colonnes statiques ; valeurs toujours liées via ?)
// ---------------------------------------------------------------------------

/**
 * Séances planifiées d'une plage de dates (vue semaine), owner-scopées, TOUS piliers.
 * Le pilier est résolu par jointure sur `programs.pillar` (aucun filtre pilier) et le
 * nombre d'exercices planifiés (muscu) par sous-requête corrélée sur `exercise_plans`.
 * Params : owner_id, date début (>=), date fin (<=).
 */
const SELECT_PLANNED_BETWEEN = `
  SELECT ps.id, ps.program_id, ps.session_id, ps.scheduled_date, ps.status, ps.week_index,
         s.name AS session_name, s.session_type, s.target_distance_m, s.target_duration_seconds, s.order_index,
         p.pillar AS pillar,
         (SELECT COUNT(*) FROM exercise_plans ep WHERE ep.session_id = ps.session_id AND ep.deleted_at IS NULL) AS exercise_count
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs  p ON p.id = ps.program_id AND p.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL
    AND ps.scheduled_date >= ? AND ps.scheduled_date <= ?
  ORDER BY ps.scheduled_date, s.order_index
`;

/**
 * Séances encore `planned` avec une date passée (manquées), owner-scopées, TOUS piliers.
 * La jointure sur `programs` fournit le pilier (aucun filtre pilier) ; le nombre
 * d'exercices planifiés (muscu) est résolu par sous-requête corrélée sur `exercise_plans`.
 * Params : owner_id, date du jour (<).
 */
const SELECT_MISSED = `
  SELECT ps.id, ps.program_id, ps.session_id, ps.scheduled_date, ps.status, ps.week_index,
         s.name AS session_name, s.session_type, s.target_distance_m, s.target_duration_seconds, s.order_index,
         p.pillar AS pillar,
         (SELECT COUNT(*) FROM exercise_plans ep WHERE ep.session_id = ps.session_id AND ep.deleted_at IS NULL) AS exercise_count
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs p ON p.id = ps.program_id AND p.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND ps.status = 'planned' AND ps.scheduled_date < ?
  ORDER BY ps.scheduled_date, s.order_index
`;

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne SQLite (snake_case) → item de domaine (camelCase). */
function rowToItem(row: PlannedSessionDbRow): PlannedSessionItem {
  return {
    id: row.id,
    programId: row.program_id,
    sessionId: row.session_id,
    scheduledDate: row.scheduled_date,
    status: row.status as PlannedSessionStatus,
    weekIndex: row.week_index,
    sessionName: row.session_name,
    sessionType: (row.session_type as ProgramSessionType | null) ?? null,
    targetDistanceM: row.target_distance_m,
    targetDurationSeconds: row.target_duration_seconds,
    orderIndex: row.order_index,
    pillar: row.pillar as Pillar,
    exerciseCount: row.exercise_count,
  };
}

// ---------------------------------------------------------------------------
// Lecture réactive (hooks)
// ---------------------------------------------------------------------------

/**
 * Séances planifiées de la semaine commençant à `weekStartDate` (AAAA-MM-JJ inclus)
 * jusqu'au 6e jour suivant (inclus), réactives aux changements locaux. TOUS piliers
 * (muscu + running) : chaque item porte son `pillar` et son `exerciseCount` (muscu).
 *
 * La `Date` est construite composant par composant depuis la chaîne AAAA-MM-JJ pour
 * éviter tout décalage de fuseau (pas de `new Date('AAAA-MM-JJ')` interprété UTC).
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (offline-first,
 * ADR-001 / décision B) — jamais d'une synchro réseau.
 */
export function useWeekPlan(weekStartDate: string): {
  items: PlannedSessionItem[];
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');

  const [y, m, d] = weekStartDate.split('-').map(Number);
  const weekEnd = localDayKey(addDays(new Date(y!, m! - 1, d!), 6));

  const { data, isLoading } = useQuery<PlannedSessionDbRow>(SELECT_PLANNED_BETWEEN, [
    userId,
    weekStartDate,
    weekEnd,
  ]);

  const items = data.map(rowToItem);
  return { items, isLoading };
}

/**
 * Séances manquées de l'utilisateur courant, TOUS piliers (muscu + running) : statut
 * encore `planned` et date strictement antérieure à aujourd'hui. Réactives aux
 * changements locaux. Chaque item porte son `pillar` et son `exerciseCount` (muscu).
 *
 * `today` est calculé côté JS et passé en paramètre lié (jamais interpolé).
 */
export function useMissedSessions(): {
  items: PlannedSessionItem[];
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const today = useTodayKey();

  const { data, isLoading } = useQuery<PlannedSessionDbRow>(SELECT_MISSED, [
    userId,
    today,
  ]);

  const items = data.map(rowToItem);
  return { items, isLoading };
}

/**
 * Séances à venir dans les `days` prochains jours (aujourd'hui inclus), owner-scopées,
 * TOUS piliers — pour l'aperçu « Mon planning » des onglets piliers (mini-calendrier).
 * Réactif aux changements locaux. `today` et la borne haute sont calculés côté JS et
 * passés en paramètres liés (jamais interpolés).
 */
export function useUpcomingSessions(days: number): {
  items: PlannedSessionItem[];
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const today = useTodayKey();
  const todayDate = useTodayDate();
  const end = localDayKey(addDays(todayDate, Math.max(0, days - 1)));

  const { data, isLoading } = useQuery<PlannedSessionDbRow>(SELECT_PLANNED_BETWEEN, [
    userId,
    today,
    end,
  ]);

  const items = data.map(rowToItem);
  return { items, isLoading };
}

// ---------------------------------------------------------------------------
// useHasPlannedSession — support US 4.7b (anticipation bonus calorique)
// ---------------------------------------------------------------------------

const SELECT_HAS_PLANNED = `
  SELECT 1 AS has FROM planned_sessions
  WHERE owner_id = ? AND scheduled_date = ?
    AND status IN ('planned','done') AND deleted_at IS NULL
  LIMIT 1`;

/**
 * Indique si une séance planifiée (statut `planned` ou `done`) existe pour
 * `dayKey` (AAAA-MM-JJ) et l'utilisateur courant. Réactif aux changements locaux.
 *
 * Utilisé par `useIsTrainingDay` (dashboard-repository) pour la détection
 * anticipée des jours d'entraînement (US 4.7b).
 */
export function useHasPlannedSession(dayKey: string): {
  hasPlanned: boolean;
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const { data, isLoading } = useQuery<{ has: number }>(SELECT_HAS_PLANNED, [
    userId,
    dayKey,
  ]);
  return { hasPlanned: data.length > 0, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook) — toutes optimistes (SQLite immédiat)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible de planifier des séances.");
  }
  return userId;
}

/**
 * Planifie un programme (tous piliers) : génère les instances datées de toutes les séances
 * pour `durationWeeks` semaines, puis active le programme. Le tout dans UNE transaction
 * atomique (aucun état partiel possible).
 *
 * Pré-requis : `programId` doit être un programme **de l'utilisateur** — les séances-gabarit
 * sont lues avec `owner_id = user` (typiquement après `duplicateProgram`, qui crée une copie
 * personnalisée à partir d'un programme éditorial). Un programme éditorial non dupliqué n'a
 * pas de séances `owner_id = user` : la garde « template vide » lèvera alors une erreur.
 *
 * Les entrées (`startDate`, `durationWeeks`, `dayAssignments`) sont validées par
 * `planProgramInputSchema` (Zod) AVANT d'ouvrir la transaction : `durationWeeks`
 * doit être un entier > 0 (sinon une durée vide/NaN produirait 0 séance en silence tout en
 * activant quand même le programme).
 *
 * Étapes :
 *  0. Validation Zod des entrées (hors transaction) → `parsed`.
 *  1. Lit les séances (template) du programme, ordonnées. Garde : lève si aucune séance.
 *  2. Construit les `templateSessions` à partir de `dayAssignments` — CHAQUE séance doit
 *     avoir une affectation, sinon on lève (pas de skip silencieux).
 *  3. `generatePlannedSessions` (alignement au lundi de la semaine de `startDate`).
 *  4. Soft-delete de TOUTES les instances encore `planned` de ce programme (re-planification).
 *  5. Insertion des instances générées (`txInsert`).
 *  6. Lecture du programme cible (`target`, notamment son `pillar`) — lue une seule fois, réutilisée
 *     ci-dessous et pour l'activation.
 *  7. Si `opts.removePreviousFuture`, soft-delete des occurrences encore `planned` de date ≥
 *     aujourd'hui de l'ANCIEN programme actif du même pilier (l'historique `done`/`skipped` et
 *     les occurrences passées sont conservés). DOIT s'exécuter AVANT la désactivation ci-dessous,
 *     car le sous-select identifie l'ancien programme par `is_active = 1`.
 *  8. Activation du programme inlinée (UN SEUL actif par pilier) — on ne peut pas appeler
 *     `activateProgram` qui ouvrirait sa PROPRE transaction (imbrication non sûre).
 *
 * Retourne le nombre d'instances générées.
 */
export async function planProgram(
  programId: string,
  rawInput: PlanProgramInput,
  opts?: { removePreviousFuture?: boolean },
): Promise<number> {
  const ownerId = currentUserId();
  // Validation runtime AVANT toute écriture : rejette durée vide/NaN/négative, format de
  // date invalide, jours affectés hors [0..6]. `parse` lève une ZodError le cas échéant.
  const input = planProgramInputSchema.parse({
    startDate: rawInput.startDate,
    durationWeeks: rawInput.durationWeeks,
    dayAssignments: rawInput.dayAssignments,
  });

  return powerSync.writeTransaction(async (tx) => {
    // 1. Séances du template.
    const sessionRows = await tx.getAll<{ id: string; order_index: number }>(
      `SELECT id, order_index FROM sessions
       WHERE program_id = ? AND owner_id = ? AND deleted_at IS NULL
       ORDER BY order_index`,
      [programId, ownerId],
    );

    // Garde : programme sans séances (ex. éditorial non dupliqué) → pas d'activation à vide.
    if (sessionRows.length === 0) {
      throw new Error(
        'Aucune séance à planifier pour ce programme : planification impossible.',
      );
    }

    // 2. Construction du template — chaque séance DOIT avoir une affectation de jour.
    const templateSessions: PlanTemplateSession[] = sessionRows.map((s) => {
      const dayOfWeek = input.dayAssignments[s.id];
      if (dayOfWeek === undefined) {
        throw new Error(
          `Aucun jour affecté pour la séance ${s.id} : planification impossible.`,
        );
      }
      return { sessionId: s.id, dayOfWeek };
    });

    // 3. Génération datée alignée sur le lundi de la semaine de startDate.
    const generated = generatePlannedSessions({
      templateSessions,
      startDate: input.startDate,
      durationWeeks: input.durationWeeks,
    });

    // 4. Soft-delete des instances encore `planned` (re-planification propre).
    const now = nowUtc();
    await tx.execute(
      `UPDATE planned_sessions SET deleted_at = ?, updated_at = ?
       WHERE program_id = ? AND owner_id = ? AND status = 'planned' AND deleted_at IS NULL`,
      [now, now, programId, ownerId],
    );

    // 5. Insertion des instances générées.
    for (const g of generated) {
      await txInsert(tx, 'planned_sessions', {
        owner_id: ownerId,
        program_id: programId,
        session_id: g.sessionId,
        scheduled_date: g.scheduledDate,
        status: 'planned',
        week_index: g.weekIndex,
        completed_at: null,
      });
    }

    // 6. Lecture du programme cible (pilier requis pour les étapes 7 et 8).
    const target = await tx.getOptional<{ pillar: string }>(
      `SELECT pillar FROM programs WHERE id = ? AND deleted_at IS NULL`,
      [programId],
    );
    if (!target) {
      throw new Error('Programme introuvable : planification impossible.');
    }

    // 7. Retrait optionnel des occurrences futures encore `planned` de l'ANCIEN programme actif
    //    du même pilier (l'historique et les occurrences passées sont conservés). Doit s'exécuter
    //    AVANT la désactivation (étape 8), qui identifie l'ancien programme par `is_active = 1`.
    if (opts?.removePreviousFuture) {
      const today = localDayKey(new Date());
      await tx.execute(
        `UPDATE planned_sessions SET deleted_at = ?, updated_at = ?
         WHERE owner_id = ? AND status = 'planned' AND scheduled_date >= ?
           AND deleted_at IS NULL
           AND program_id IN (
             SELECT id FROM programs
             WHERE owner_id = ? AND pillar = ? AND is_active = 1 AND id <> ? AND deleted_at IS NULL
           )`,
        [now, now, ownerId, today, ownerId, target.pillar, programId],
      );
    }

    // 8. Activation inlinée (reproduit activateProgram sans transaction imbriquée).
    await tx.execute(
      `UPDATE programs SET is_active = 0, updated_at = ?
       WHERE owner_id = ? AND pillar = ? AND is_active = 1 AND id <> ?
         AND deleted_at IS NULL`,
      [now, ownerId, target.pillar, programId],
    );
    // **Owner-scopé** : on n'active que les programmes possédés (jamais un éditorial,
    // owner_id null — cf. `activateProgram`). Filet de sécurité contre la divergence
    // local↔cloud ; l'UI empêche par ailleurs de planifier un programme non possédé.
    await tx.execute(
      `UPDATE programs SET is_active = 1, updated_at = ? WHERE id = ? AND owner_id = ?`,
      [now, programId, ownerId],
    );

    return generated.length;
  });
}

/** Reporte une séance planifiée à une nouvelle date (AAAA-MM-JJ). */
export async function reschedulePlannedSession(
  id: string,
  newDate: string,
): Promise<void> {
  await patch('planned_sessions', id, { scheduled_date: newDate });
}

/** Marque une séance planifiée comme sautée (statut `skipped`). */
export async function skipPlannedSession(id: string): Promise<void> {
  await patch('planned_sessions', id, { status: 'skipped' });
}

/** Marque une séance planifiée comme faite (statut `done` + horodatage `completed_at`). */
export async function markPlannedSessionDone(id: string): Promise<void> {
  await patch('planned_sessions', id, { status: 'done', completed_at: nowUtc() });
}
