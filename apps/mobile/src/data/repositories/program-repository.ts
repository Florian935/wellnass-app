/**
 * Repository des programmes d'entraînement (bibliothèque éditoriale + programmes
 * personnalisés + activation par pilier).
 *
 * Responsabilité unique : lire/écrire les tables locales PowerSync `programs`,
 * `program_translations`, `sessions` et `exercise_plans`, et exposer des vues
 * « liste » et « détail » prêtes pour l'UI (nom résolu selon la langue applicative).
 *
 * Modèle de données (voir docs/specs/functional/musculation.md §3.12 et
 * docs/specs/technical/modele-donnees.md) :
 *  - `programs`             : `owner_id` null = bibliothèque éditoriale (lecture seule
 *                             depuis l'app, RLS interdit d'écrire owner_id null),
 *                             non-null = programme personnalisé de l'utilisateur.
 *                             `status` ('draft' | 'published'), `is_active` (0/1),
 *                             `level`, `goal`, `duration_weeks`, `pillar`.
 *  - `program_translations` : une ligne par (programme, langue) ; `name`, `summary`,
 *                             `description`. Un programme **créé** from scratch (`createProgram`)
 *                             n'a qu'une traduction (langue applicative de saisie) ; une
 *                             **duplication** (`duplicateProgram`) recopie **toutes** les
 *                             traductions de la source — un programme éditorial bilingue
 *                             dupliqué reste ainsi bilingue.
 *  - `sessions`             : séances d'un programme, ordonnées par `order_index`.
 *  - `exercise_plans`       : exercices planifiés d'une séance, ordonnés par `order_index`.
 *
 * Résolution du nom : faite **en SQL** (jamais via les helpers domaine) avec repli
 * langue courante → `fr`, et repli final chaîne vide côté mapper si aucune traduction.
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields` ou `generateId`).
 *  - Timestamps en UTC ; suppression = soft delete (jamais de hard delete client).
 *  - `owner_id` = utilisateur de la session courante sur toute écriture personnalisée.
 *  - Une seule règle « un programme actif par pilier » appliquée en transaction.
 */

import { useQuery } from '@powersync/react';
import type { Pillar, ProgramLevel, ProgramSessionType, SetType } from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { getAppLanguage } from '@/i18n';
import { generateId } from '@/lib/id';
import { insertWithSyncFields, nowUtc, patch, softDelete } from './_sql';

// ---------------------------------------------------------------------------
// Types de domaine exposés à l'UI
// ---------------------------------------------------------------------------

/** Élément de programme tel qu'affiché dans les listes (biblio, mes programmes). */
export type ProgramListItem = {
  id: string;
  name: string;
  pillar: Pillar;
  level: ProgramLevel | null;
  goal: string | null;
  durationWeeks: number | null;
  isActive: boolean;
};

/** Un exercice planifié au sein d'une séance, prêt pour l'écran détail. */
export type PlanItem = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  setType: SetType;
  targetSets: number | null;
  targetReps: string | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
};

/** Une séance avec ses exercices planifiés (triés par `order_index`). */
export type SessionDetail = {
  id: string;
  name: string | null;
  orderIndex: number;
  plans: PlanItem[];
  /** Running uniquement — null pour les séances muscu. */
  sessionType: ProgramSessionType | null;
  /** Running uniquement (mètres) — null pour les séances muscu. */
  targetDistanceM: number | null;
  /** Running uniquement (secondes) — null pour les séances muscu. */
  targetDurationSeconds: number | null;
};

/** Détail complet d'un programme : entête + séances + plans. */
export type ProgramDetail = {
  id: string;
  name: string;
  pillar: Pillar;
  level: ProgramLevel | null;
  goal: string | null;
  durationWeeks: number | null;
  isActive: boolean;
  sessions: SessionDetail[];
};

/** Filtres facultatifs pour la bibliothèque éditoriale. */
export type ProgramLibraryFilters = {
  level?: ProgramLevel;
  goal?: string;
  durationWeeks?: number;
};

/** Champs modifiables d'un plan d'exercice via `updateExercisePlan`. */
export type ExercisePlanPatch = {
  setType?: SetType;
  targetSets?: number | null;
  targetReps?: string | null;
  targetWeightKg?: number | null;
  restSeconds?: number | null;
};

// ---------------------------------------------------------------------------
// Lignes brutes SQLite (colonnes snake_case ; booléens en 0/1)
// ---------------------------------------------------------------------------

/**
 * Ligne brute d'un programme pour la vue liste, avec nom résolu (langue courante → fr).
 * `is_active` est renvoyé en 0/1 par SQLite.
 */
type ProgramListDbRow = {
  id: string;
  pillar: string;
  level: string | null;
  goal: string | null;
  duration_weeks: number | null;
  is_active: number;
  /** Nom résolu par COALESCE(langue courante, fr) — peut être null si aucune traduction. */
  name: string | null;
};

/** Ligne brute d'une séance (sans plans). Colonnes running nullables pour muscu. */
type SessionDbRow = {
  id: string;
  name: string | null;
  order_index: number;
  session_type: string | null;
  target_distance_m: number | null;
  target_duration_seconds: number | null;
};

/**
 * Ligne brute d'un plan d'exercice avec le nom d'exercice résolu (langue courante → fr).
 */
type PlanDbRow = {
  id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  set_type: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight_kg: number | null;
  rest_seconds: number | null;
  /** Nom d'exercice résolu par COALESCE(langue courante, fr) — peut être null. */
  exercise_name: string | null;
};

// ---------------------------------------------------------------------------
// Requêtes SQL (noms de tables/colonnes statiques ; valeurs toujours liées via ?)
// ---------------------------------------------------------------------------

/**
 * Sélection de base d'un programme avec nom résolu (langue courante → fr).
 * Premier `?` = langue courante. La clause `WHERE` reste à compléter par appelant.
 */
const SELECT_PROGRAM_BASE = `
  SELECT p.id, p.pillar, p.level, p.goal, p.duration_weeks, p.is_active,
         COALESCE(tl.name, tfr.name) AS name
  FROM programs p
  LEFT JOIN program_translations tl  ON tl.program_id = p.id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN program_translations tfr ON tfr.program_id = p.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE p.deleted_at IS NULL
`;

const ORDER_BY_NAME = 'ORDER BY name COLLATE NOCASE';

/**
 * Séances d'un programme, triées par position. Premier `?` = id du programme.
 * Colonnes running incluses (nulles pour les séances muscu — harmless).
 */
const SELECT_SESSIONS_FOR_PROGRAM = `
  SELECT id, name, order_index, session_type, target_distance_m, target_duration_seconds
  FROM sessions
  WHERE program_id = ? AND deleted_at IS NULL
  ORDER BY order_index
`;

/**
 * Tous les plans d'exercice des séances d'un programme, avec nom d'exercice résolu.
 * Premier `?` = langue courante ; second `?` = id du programme.
 * Tri par (order_index de la séance, order_index du plan) : garantit un regroupement
 * ordonné en JS.
 */
const SELECT_PLANS_FOR_PROGRAM = `
  SELECT ep.id, ep.session_id, ep.exercise_id, ep.order_index, ep.set_type,
         ep.target_sets, ep.target_reps, ep.target_weight_kg, ep.rest_seconds,
         COALESCE(tl.name, tfr.name) AS exercise_name
  FROM exercise_plans ep
  JOIN sessions s ON s.id = ep.session_id AND s.deleted_at IS NULL
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = ep.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = ep.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE s.program_id = ? AND ep.deleted_at IS NULL
  ORDER BY s.order_index, ep.order_index
`;

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne programme SQLite (vue liste) → élément de domaine. */
function rowToListItem(row: ProgramListDbRow): ProgramListItem {
  return {
    id: row.id,
    // Repli ultime : chaîne vide si aucune traduction (ne devrait pas arriver).
    name: row.name ?? '',
    pillar: row.pillar as Pillar,
    level: (row.level as ProgramLevel | null) ?? null,
    goal: row.goal,
    durationWeeks: row.duration_weeks,
    isActive: row.is_active === 1,
  };
}

/** Convertit une ligne plan SQLite → item de domaine (camelCase). */
function rowToPlanItem(row: PlanDbRow): PlanItem {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name ?? '',
    orderIndex: row.order_index,
    setType: row.set_type as SetType,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    targetWeightKg: row.target_weight_kg,
    restSeconds: row.rest_seconds,
  };
}

/**
 * Regroupe les plans (déjà triés par order_index de séance puis de plan) sous leurs
 * séances (elles-mêmes déjà triées par order_index). L'ordre est préservé.
 */
function buildSessionDetails(
  sessionRows: SessionDbRow[],
  planRows: PlanDbRow[],
): SessionDetail[] {
  const sessions: SessionDetail[] = sessionRows.map((s) => ({
    id: s.id,
    name: s.name,
    orderIndex: s.order_index,
    plans: [],
    sessionType: (s.session_type as ProgramSessionType | null) ?? null,
    targetDistanceM: s.target_distance_m,
    targetDurationSeconds: s.target_duration_seconds,
  }));

  const bySessionId = new Map<string, SessionDetail>();
  for (const s of sessions) {
    bySessionId.set(s.id, s);
  }

  for (const row of planRows) {
    const session = bySessionId.get(row.session_id);
    // Un plan sans séance connue est ignoré (ne devrait pas arriver — JOIN garanti).
    if (session) {
      session.plans.push(rowToPlanItem(row));
    }
  }

  return sessions;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hooks)
// ---------------------------------------------------------------------------

/**
 * Programmes éditoriaux publiés (bibliothèque : `owner_id IS NULL` et
 * `status = 'published'`), réactifs aux changements locaux. Filtres facultatifs
 * (niveau, objectif, durée en semaines) appliqués via clauses WHERE paramétrées.
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (offline-first,
 * ADR-001 / décision B) — jamais d'une synchro réseau.
 */
export function useProgramLibrary(filters?: ProgramLibraryFilters): {
  programs: ProgramListItem[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const clauses: string[] = ["p.owner_id IS NULL", "p.status = 'published'"];
  const params: unknown[] = [lang];

  if (filters?.level !== undefined) {
    clauses.push('p.level = ?');
    params.push(filters.level);
  }
  if (filters?.goal !== undefined) {
    clauses.push('p.goal = ?');
    params.push(filters.goal);
  }
  if (filters?.durationWeeks !== undefined) {
    clauses.push('p.duration_weeks = ?');
    params.push(filters.durationWeeks);
  }

  const sql = `${SELECT_PROGRAM_BASE} AND ${clauses.join(' AND ')} ${ORDER_BY_NAME}`;

  const { data, isLoading: queryLoading } = useQuery<ProgramListDbRow>(sql, params);

  const isLoading = queryLoading;
  const programs = data.map(rowToListItem);

  return { programs, isLoading };
}

/**
 * Programmes personnalisés de l'utilisateur courant (`owner_id = user`), réactifs.
 * PowerSync ne réplique que les lignes de l'utilisateur ; le filtre `owner_id = ?`
 * exclut néanmoins explicitement l'éditorial (owner_id null).
 *
 * @param pillar — filtre optionnel par pilier. Non fourni = tous les piliers (comportement
 *   muscu historique inchangé). Les écrans running passent `'running'` pour n'obtenir que
 *   leurs programmes. Le filtre est ajouté comme clause WHERE paramétrée (pas d'injection).
 */
export function useMyPrograms(pillar?: Pillar): {
  programs: ProgramListItem[];
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const userId = useAuthStore((s) => s.session?.user.id ?? '');

  const sql = pillar
    ? `${SELECT_PROGRAM_BASE} AND p.owner_id = ? AND p.pillar = ? ${ORDER_BY_NAME}`
    : `${SELECT_PROGRAM_BASE} AND p.owner_id = ? ${ORDER_BY_NAME}`;

  const params = pillar ? [lang, userId, pillar] : [lang, userId];

  const { data, isLoading: queryLoading } = useQuery<ProgramListDbRow>(sql, params);

  const isLoading = queryLoading;
  const programs = data.map(rowToListItem);

  return { programs, isLoading };
}

/**
 * Programme actif de l'utilisateur courant pour un pilier donné (ou `null`).
 * Au plus un programme actif par pilier (garanti par `activateProgram`).
 */
export function useActiveProgram(pillar: Pillar): {
  program: ProgramListItem | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const userId = useAuthStore((s) => s.session?.user.id ?? '');

  const sql = `${SELECT_PROGRAM_BASE} AND p.owner_id = ? AND p.pillar = ? AND p.is_active = 1 LIMIT 1`;

  const { data, isLoading: queryLoading } = useQuery<ProgramListDbRow>(sql, [
    lang,
    userId,
    pillar,
  ]);

  const isLoading = queryLoading;
  const first = data[0];
  const program = first ? rowToListItem(first) : null;

  return { program, isLoading };
}

/**
 * Détail complet d'un programme (entête + séances ordonnées + plans ordonnés),
 * réactif. Les noms d'exercice sont résolus dans la langue applicative.
 *
 * Trois requêtes réactives (entête, séances, plans) toujours appelées (règle des
 * hooks) ; quand `programId` est vide/inconnu, elles renvoient des résultats vides.
 */
export function useProgramDetail(programId: string): {
  detail: ProgramDetail | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const headerSql = `${SELECT_PROGRAM_BASE} AND p.id = ? LIMIT 1`;

  const { data: headerRows, isLoading: headerLoading } =
    useQuery<ProgramListDbRow>(headerSql, [lang, programId]);
  const { data: sessionRows, isLoading: sessionsLoading } =
    useQuery<SessionDbRow>(SELECT_SESSIONS_FOR_PROGRAM, [programId]);
  const { data: planRows, isLoading: plansLoading } = useQuery<PlanDbRow>(
    SELECT_PLANS_FOR_PROGRAM,
    [lang, programId],
  );

  const isLoading = headerLoading || sessionsLoading || plansLoading;

  const header = headerRows[0];
  if (!header) {
    return { detail: null, isLoading };
  }

  const base = rowToListItem(header);
  const detail: ProgramDetail = {
    ...base,
    sessions: buildSessionDetails(sessionRows, planRows),
  };

  return { detail, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook) — toutes optimistes (SQLite immédiat)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error("Aucune session active : impossible d'écrire un programme.");
  }
  return userId;
}

/**
 * `order_index` suivant pour un ensemble de lignes : max(order_index) + 1, ou 0
 * si aucune ligne. `column` et `table` sont des littéraux de notre code (pas de saisie
 * utilisateur → aucun risque d'injection).
 */
async function nextOrderIndex(
  table: string,
  column: string,
  parentId: string,
): Promise<number> {
  const row = await powerSync.getOptional<{ max_index: number | null }>(
    `SELECT MAX(order_index) AS max_index FROM ${table}
     WHERE ${column} = ? AND deleted_at IS NULL`,
    [parentId],
  );
  const max = row?.max_index;
  return max === null || max === undefined ? 0 : max + 1;
}

/**
 * Crée un programme personnalisé de l'utilisateur courant.
 *
 * Écriture en deux temps :
 *  1. une ligne `programs` (`owner_id`=user, `status='published'`, `is_active=0`) ;
 *  2. une unique ligne `program_translations` dans la langue applicative courante.
 *
 * Un programme custom n'a qu'une traduction (langue de saisie). Retourne l'`id` créé.
 */
export async function createProgram(input: {
  pillar: Pillar;
  name: string;
  level?: ProgramLevel | null;
  goal?: string | null;
  durationWeeks?: number | null;
}): Promise<string> {
  const ownerId = currentUserId();

  const programId = await insertWithSyncFields('programs', {
    owner_id: ownerId,
    pillar: input.pillar,
    status: 'published',
    is_active: 0,
    level: input.level ?? null,
    goal: input.goal ?? null,
    duration_weeks: input.durationWeeks ?? null,
  });

  await insertWithSyncFields('program_translations', {
    program_id: programId,
    owner_id: ownerId,
    lang: getAppLanguage(),
    name: input.name.trim(),
    summary: null,
    description: null,
  });

  return programId;
}

/**
 * Ajoute une séance à un programme.
 * `order_index` = valeur fournie, sinon position suivante (max+1) dans le programme.
 * Retourne l'`id` de la séance créée.
 */
export async function addSession(
  programId: string,
  input?: { name?: string | null; orderIndex?: number },
): Promise<string> {
  const ownerId = currentUserId();

  const orderIndex =
    input?.orderIndex ??
    (await nextOrderIndex('sessions', 'program_id', programId));

  return insertWithSyncFields('sessions', {
    program_id: programId,
    owner_id: ownerId,
    order_index: orderIndex,
    name: input?.name ?? null,
  });
}

/**
 * Ajoute un plan d'exercice à une séance.
 * `order_index` = position suivante (max+1) dans la séance ; `set_type` défaut 'normal'.
 */
export async function addExercisePlan(
  sessionId: string,
  input: {
    exerciseId: string;
    setType?: SetType;
    targetSets?: number | null;
    targetReps?: string | null;
    targetWeightKg?: number | null;
    restSeconds?: number | null;
  },
): Promise<void> {
  const ownerId = currentUserId();
  const orderIndex = await nextOrderIndex(
    'exercise_plans',
    'session_id',
    sessionId,
  );

  await insertWithSyncFields('exercise_plans', {
    session_id: sessionId,
    owner_id: ownerId,
    exercise_id: input.exerciseId,
    order_index: orderIndex,
    set_type: input.setType ?? 'normal',
    target_sets: input.targetSets ?? null,
    target_reps: input.targetReps ?? null,
    target_weight_kg: input.targetWeightKg ?? null,
    rest_seconds: input.restSeconds ?? null,
  });
}

/**
 * Met à jour un plan d'exercice (type de série, cibles, repos).
 * Seules les clés présentes dans `input` sont modifiées.
 */
export async function updateExercisePlan(
  planId: string,
  input: ExercisePlanPatch,
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('setType' in input) columns['set_type'] = input.setType;
  if ('targetSets' in input) columns['target_sets'] = input.targetSets;
  if ('targetReps' in input) columns['target_reps'] = input.targetReps;
  if ('targetWeightKg' in input) columns['target_weight_kg'] = input.targetWeightKg;
  if ('restSeconds' in input) columns['rest_seconds'] = input.restSeconds;

  await patch('exercise_plans', planId, columns);
}

/** Retire un plan d'exercice d'une séance (soft delete). */
export async function removeExercisePlan(planId: string): Promise<void> {
  await softDelete('exercise_plans', planId);
}

/**
 * Met à jour le contenu running d'une séance (type, distance cible, durée cible, nom).
 * Seules les clés présentes dans `input` sont modifiées (même pattern que
 * `updateExercisePlan`). Compatible offline-first : écrit en SQLite local, PowerSync
 * synchronise ensuite.
 */
export async function updateRunningSession(
  sessionId: string,
  input: {
    sessionType?: ProgramSessionType;
    targetDistanceM?: number | null;
    targetDurationSeconds?: number | null;
    name?: string;
  },
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('sessionType' in input) columns['session_type'] = input.sessionType;
  if ('targetDistanceM' in input) columns['target_distance_m'] = input.targetDistanceM;
  if ('targetDurationSeconds' in input) columns['target_duration_seconds'] = input.targetDurationSeconds;
  if ('name' in input) columns['name'] = input.name;

  await patch('sessions', sessionId, columns);
}

/**
 * Retire une séance d'un programme (soft delete de la séance ET de tous ses plans).
 */
export async function removeSession(sessionId: string): Promise<void> {
  const plans = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM exercise_plans WHERE session_id = ? AND deleted_at IS NULL`,
    [sessionId],
  );
  for (const plan of plans) {
    await softDelete('exercise_plans', plan.id);
  }
  await softDelete('sessions', sessionId);
}

// ---------------------------------------------------------------------------
// Duplication et activation (transactions atomiques)
// ---------------------------------------------------------------------------

/** Insère une ligne dans une transaction en injectant les champs de synchro. */
async function txInsert(
  tx: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
  table: string,
  values: Record<string, unknown>,
): Promise<string> {
  const id = typeof values['id'] === 'string' ? (values['id'] as string) : generateId();
  const now = nowUtc();
  const merged: Record<string, unknown> = {
    ...values,
    id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const columns = Object.keys(merged);
  const placeholders = columns.map(() => '?').join(', ');
  const params = columns.map((col) => merged[col]);
  await tx.execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    params,
  );
  return id;
}

/**
 * Duplique un programme (éditorial ou autre) en un NOUVEAU programme personnalisé
 * de l'utilisateur : nouveaux UUID partout, `owner_id`=user, `status='published'`,
 * `is_active=0`. Copie l'entête, toutes les traductions, les séances et leurs plans
 * (avec remappage des `session_id`).
 *
 * Effectué dans une transaction : une copie partielle est impossible.
 * Retourne l'`id` du nouveau programme.
 */
export async function duplicateProgram(
  sourceProgramId: string,
): Promise<string> {
  const ownerId = currentUserId();

  return powerSync.writeTransaction(async (tx) => {
    const source = await tx.getOptional<{
      pillar: string;
      level: string | null;
      goal: string | null;
      duration_weeks: number | null;
    }>(
      `SELECT pillar, level, goal, duration_weeks FROM programs
       WHERE id = ? AND deleted_at IS NULL`,
      [sourceProgramId],
    );
    if (!source) {
      throw new Error('Programme source introuvable : duplication impossible.');
    }

    // 1. Nouvel entête programme.
    const newProgramId = await txInsert(tx, 'programs', {
      owner_id: ownerId,
      pillar: source.pillar,
      status: 'published',
      is_active: 0,
      level: source.level,
      goal: source.goal,
      duration_weeks: source.duration_weeks,
    });

    // 2. Copie des traductions (toutes langues disponibles).
    const translations = await tx.getAll<{
      lang: string;
      name: string;
      summary: string | null;
      description: string | null;
    }>(
      `SELECT lang, name, summary, description FROM program_translations
       WHERE program_id = ? AND deleted_at IS NULL`,
      [sourceProgramId],
    );
    for (const t of translations) {
      await txInsert(tx, 'program_translations', {
        program_id: newProgramId,
        owner_id: ownerId,
        lang: t.lang,
        name: t.name,
        summary: t.summary,
        description: t.description,
      });
    }

    // 3. Copie des séances (nouveaux id) — on conserve la correspondance ancien→nouveau.
    //    Colonnes running incluses : les séances muscu les ont à NULL (aucun effet).
    const sourceSessions = await tx.getAll<{
      id: string;
      order_index: number;
      name: string | null;
      session_type: string | null;
      target_distance_m: number | null;
      target_duration_seconds: number | null;
    }>(
      `SELECT id, order_index, name, session_type, target_distance_m, target_duration_seconds
       FROM sessions
       WHERE program_id = ? AND deleted_at IS NULL
       ORDER BY order_index`,
      [sourceProgramId],
    );

    const sessionIdMap = new Map<string, string>();
    for (const s of sourceSessions) {
      const newSessionId = await txInsert(tx, 'sessions', {
        program_id: newProgramId,
        owner_id: ownerId,
        order_index: s.order_index,
        name: s.name,
        session_type: s.session_type,
        target_distance_m: s.target_distance_m,
        target_duration_seconds: s.target_duration_seconds,
      });
      sessionIdMap.set(s.id, newSessionId);
    }

    // 4. Copie des plans d'exercice (nouveaux id, session_id remappé).
    for (const [oldSessionId, newSessionId] of sessionIdMap) {
      const plans = await tx.getAll<{
        exercise_id: string;
        order_index: number;
        set_type: string;
        target_sets: number | null;
        target_reps: string | null;
        target_weight_kg: number | null;
        rest_seconds: number | null;
      }>(
        `SELECT exercise_id, order_index, set_type, target_sets, target_reps,
                target_weight_kg, rest_seconds
         FROM exercise_plans
         WHERE session_id = ? AND deleted_at IS NULL
         ORDER BY order_index`,
        [oldSessionId],
      );
      for (const plan of plans) {
        await txInsert(tx, 'exercise_plans', {
          session_id: newSessionId,
          owner_id: ownerId,
          exercise_id: plan.exercise_id,
          order_index: plan.order_index,
          set_type: plan.set_type,
          target_sets: plan.target_sets,
          target_reps: plan.target_reps,
          target_weight_kg: plan.target_weight_kg,
          rest_seconds: plan.rest_seconds,
        });
      }
    }

    return newProgramId;
  });
}

/**
 * Active un programme en garantissant UN SEUL programme actif par pilier (spec §3.12).
 *
 * Dans une transaction : lit le pilier du programme cible, désactive
 * (`is_active=0`) le programme actuellement actif de ce pilier pour cet utilisateur
 * (le cas échéant), puis active (`is_active=1`) la cible. L'historique est préservé
 * (aucune suppression).
 */
export async function activateProgram(programId: string): Promise<void> {
  const userId = currentUserId();
  const now = nowUtc();

  await powerSync.writeTransaction(async (tx) => {
    const target = await tx.getOptional<{ pillar: string }>(
      `SELECT pillar FROM programs WHERE id = ? AND deleted_at IS NULL`,
      [programId],
    );
    if (!target) {
      throw new Error('Programme introuvable : activation impossible.');
    }

    // Désactive tout autre programme actif du même pilier pour cet utilisateur.
    await tx.execute(
      `UPDATE programs SET is_active = 0, updated_at = ?
       WHERE owner_id = ? AND pillar = ? AND is_active = 1 AND id <> ?
         AND deleted_at IS NULL`,
      [now, userId, target.pillar, programId],
    );

    // Active la cible.
    await tx.execute(
      `UPDATE programs SET is_active = 1, updated_at = ? WHERE id = ?`,
      [now, programId],
    );
  });
}

/**
 * Met à jour les métadonnées scalaires d'un programme personnalisé
 * (level, goal, durationWeeks). Seules les clés présentes dans `input` sont modifiées.
 * Compatible offline-first : écrit en SQLite local, PowerSync synchronise ensuite.
 */
export async function updateProgram(
  programId: string,
  input: {
    level?: ProgramLevel | null;
    goal?: string | null;
    durationWeeks?: number | null;
  },
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('level' in input) columns['level'] = input.level;
  if ('goal' in input) columns['goal'] = input.goal;
  if ('durationWeeks' in input) columns['duration_weeks'] = input.durationWeeks;
  await patch('programs', programId, columns);
}

/**
 * Met à jour la traduction d'un programme pour la langue applicative courante.
 * Si la ligne n'existe pas encore pour cette langue, elle est insérée.
 * Compatible offline-first.
 */
export async function updateProgramTranslation(
  programId: string,
  input: { name?: string; summary?: string | null },
): Promise<void> {
  const ownerId = currentUserId();
  const lang = getAppLanguage();

  const existing = await powerSync.getOptional<{ id: string }>(
    `SELECT id FROM program_translations WHERE program_id = ? AND lang = ? AND deleted_at IS NULL`,
    [programId, lang],
  );

  if (existing) {
    const columns: Record<string, unknown> = {};
    if ('name' in input) columns['name'] = input.name;
    if ('summary' in input) columns['summary'] = input.summary;
    await patch('program_translations', existing.id, columns);
  } else {
    await insertWithSyncFields('program_translations', {
      program_id: programId,
      owner_id: ownerId,
      lang,
      name: input.name ?? '',
      summary: input.summary ?? null,
      description: null,
    });
  }
}

/**
 * Supprime un programme (soft delete du programme + de ses séances + de leurs plans
 * + de ses traductions). Les identifiants sont récupérés via `getAll`.
 */
export async function deleteProgram(programId: string): Promise<void> {
  const sessions = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM sessions WHERE program_id = ? AND deleted_at IS NULL`,
    [programId],
  );
  for (const session of sessions) {
    const plans = await powerSync.getAll<{ id: string }>(
      `SELECT id FROM exercise_plans WHERE session_id = ? AND deleted_at IS NULL`,
      [session.id],
    );
    for (const plan of plans) {
      await softDelete('exercise_plans', plan.id);
    }
    await softDelete('sessions', session.id);
  }

  const translations = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM program_translations WHERE program_id = ? AND deleted_at IS NULL`,
    [programId],
  );
  for (const t of translations) {
    await softDelete('program_translations', t.id);
  }

  await softDelete('programs', programId);
}
