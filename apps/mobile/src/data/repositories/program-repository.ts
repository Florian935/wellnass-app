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
import type {
  FineMuscle,
  MuscleGroup,
  PacingPlan,
  Pillar,
  ProgramLevel,
  ProgramSessionType,
  RecoveryKind,
  SegmentKind,
  SetType,
} from '@wellness/shared';
import {
  DEFAULT_SEGMENT_KIND,
  normalizeFineMuscles,
  normalizeSecondaryMuscles,
  parseJsonColumn,
  parsePacingPlan,
} from '@wellness/shared';
import { useTranslation } from 'react-i18next';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { getAppLanguage } from '@/i18n';
import { insertWithSyncFields, nowUtc, patch, softDelete, txInsert } from './_sql';

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
  /**
   * Anatomie de l'exercice planifié — US MUSC-F1b, à passer à `resolveFineMuscles` par
   * l'appelant. `musclePrimary` null uniquement si l'exercice référencé a disparu (ne devrait
   * pas arriver, FK garantie) — l'appelant ignore alors ce plan dans l'agrégat.
   */
  musclePrimary: MuscleGroup | null;
  musclesSecondary: MuscleGroup[];
  musclesFine: FineMuscle[];
};

/**
 * Un bloc de répétitions fractionné (US RUN-F2c) — une ligne = un bloc (ex. « 6×400 m »), pas
 * une ligne par répétition individuelle. Running uniquement, type `fractionne`.
 */
export type IntervalBlockItem = {
  id: string;
  orderIndex: number;
  reps: number;
  fastDistanceM: number | null;
  fastDurationSeconds: number | null;
  fastPacePctVma: number | null;
  recoveryDistanceM: number | null;
  recoveryDurationSeconds: number | null;
  // ---- US RUN-F4 : le bloc devient un SEGMENT typé (lots A, B, C, D) ----
  /** Nature du segment. Jamais null en lecture : une ligne sans nature vaut `'work'`. */
  kind: SegmentKind;
  label: string | null;
  /** Plage d'allure ABSOLUE de la phase rapide (s/km) — prioritaire sur `fastPacePctVma`. */
  fastPaceMinSPerKm: number | null;
  fastPaceMaxSPerKm: number | null;
  /** Chrono cible de la fraction bornée en distance (« 400 m en 1:38 »). Pas l'étendue. */
  fastTargetTimeMinSeconds: number | null;
  fastTargetTimeMaxSeconds: number | null;
  recoveryKind: RecoveryKind | null;
  recoveryPaceMinSPerKm: number | null;
  recoveryPaceMaxSPerKm: number | null;
  /** Segments consécutifs de même clé = un groupe répété `groupReps` fois. */
  groupKey: string | null;
  groupReps: number | null;
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
  /**
   * Segments de la séance. **US RUN-F4 (lot B) a levé la restriction au type `fractionne`** :
   * un footing peut désormais porter ses lignes droites, un tempo son bloc inséré. C'est ce
   * verrou qui bloquait le plus de séances (6 sur 24 dans l'analyse du 04/09/2026).
   */
  intervals: IntervalBlockItem[];
  // ---- US RUN-F4 : la consigne de la séance (lots A, G, I) ----
  /** Plage d'allure cible SAISIE (s/km). Null = allure dérivée, comportement historique. */
  targetPaceMinSPerKm: number | null;
  targetPaceMaxSPerKm: number | null;
  /** RPE visé (1-10) — la consigne, à distinguer du RPE ressenti stocké sur `runs`. */
  targetRpe: number | null;
  /** Objectif chrono (s) sur `targetDistanceM` — séances `test` / `course`. */
  targetTimeSeconds: number | null;
  /** Plan de passage par km, relu sans jamais lever (`parsePacingPlan`). */
  pacingPlan: PacingPlan | null;
  description: string | null;
  instructions: string | null;
  adaptationCriterion: string | null;
};

/** Détail complet d'un programme : entête + séances + plans. */
export type ProgramDetail = {
  id: string;
  name: string;
  /** Résumé résolu (langue courante → fr), null si aucune traduction. */
  summary: string | null;
  pillar: Pillar;
  level: ProgramLevel | null;
  goal: string | null;
  durationWeeks: number | null;
  isActive: boolean;
  sessions: SessionDetail[];
  // ---- US RUN-F4 (lot H) : l'ancre qui manquait au calendrier ----
  /** Date de l'échéance (`AAAA-MM-JJ`). Null = programme sans échéance (la majorité). */
  targetDate: string | null;
  /** Chrono visé sur la course objectif (s). */
  targetTimeSeconds: number | null;
  /** Nom de l'événement (« Course caritative »). Non traduit : c'est un nom propre. */
  eventName: string | null;
};

/** Filtres facultatifs pour la bibliothèque éditoriale. */
export type ProgramLibraryFilters = {
  pillar?: Pillar;
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

/** Champs modifiables d'un bloc fractionné via `updateIntervalBlock` (US RUN-F2c, RUN-F4). */
export type IntervalBlockPatch = {
  reps?: number;
  fastDistanceM?: number | null;
  fastDurationSeconds?: number | null;
  fastPacePctVma?: number | null;
  recoveryDistanceM?: number | null;
  recoveryDurationSeconds?: number | null;
  kind?: SegmentKind;
  label?: string | null;
  fastPaceMinSPerKm?: number | null;
  fastPaceMaxSPerKm?: number | null;
  fastTargetTimeMinSeconds?: number | null;
  fastTargetTimeMaxSeconds?: number | null;
  recoveryKind?: RecoveryKind | null;
  recoveryPaceMinSPerKm?: number | null;
  recoveryPaceMaxSPerKm?: number | null;
  groupKey?: string | null;
  groupReps?: number | null;
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
  // US RUN-F4 — consigne de séance. `description`/`instructions` sont résolus par COALESCE sur
  // `session_translations` (lot I) ; les autres viennent directement de `sessions`.
  target_pace_min_s_per_km: number | null;
  target_pace_max_s_per_km: number | null;
  target_rpe: number | null;
  target_time_seconds: number | null;
  pacing_plan: string | null;
  description: string | null;
  instructions: string | null;
  adaptation_criterion: string | null;
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
  muscle_primary: string;
  muscles_secondary: string | null;
  muscles_fine: string | null;
};

/**
 * Ligne brute d'un bloc fractionné (US RUN-F2c). Exportée pour réutilisation par
 * `run-repository.ts` (US RUN-F2d, `useIntervalBlocksForRun`) — même forme de ligne,
 * scopée séance plutôt que programme.
 */
export type IntervalDbRow = {
  id: string;
  session_id: string;
  order_index: number;
  reps: number;
  fast_distance_m: number | null;
  fast_duration_seconds: number | null;
  fast_pace_pct_vma: number | null;
  recovery_distance_m: number | null;
  recovery_duration_seconds: number | null;
  // US RUN-F4 — segments typés. `kind` a un `default 'work'` en base, mais reste typé nullable
  // ici : une base locale synchronisée avant la migration peut rendre la colonne absente.
  kind: string | null;
  label: string | null;
  fast_pace_min_s_per_km: number | null;
  fast_pace_max_s_per_km: number | null;
  fast_target_time_min_seconds: number | null;
  fast_target_time_max_seconds: number | null;
  recovery_kind: string | null;
  recovery_pace_min_s_per_km: number | null;
  recovery_pace_max_s_per_km: number | null;
  group_key: string | null;
  group_reps: number | null;
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
 * Ligne brute d'un programme pour la vue **détail** : identique à la vue liste plus
 * le `summary` résolu (langue courante → fr). Requête dédiée à `useProgramDetail`
 * pour ne pas alourdir les vues liste qui n'affichent pas le résumé.
 */
type ProgramDetailDbRow = ProgramListDbRow & {
  summary: string | null;
  // US RUN-F4 (lot H) — l'ancre du bloc de préparation.
  target_date: string | null;
  target_time_seconds: number | null;
  event_name: string | null;
};

/**
 * Sélection d'un programme pour l'écran détail : nom ET résumé résolus (langue
 * courante → fr, mêmes jointures `tl`/`tfr` que `SELECT_PROGRAM_BASE`).
 * Premier `?` = langue courante ; second `?` = id du programme.
 */
const SELECT_PROGRAM_DETAIL_HEADER = `
  SELECT p.id, p.pillar, p.level, p.goal, p.duration_weeks, p.is_active,
         p.target_date, p.target_time_seconds, p.event_name,
         COALESCE(tl.name, tfr.name) AS name,
         COALESCE(tl.summary, tfr.summary) AS summary
  FROM programs p
  LEFT JOIN program_translations tl  ON tl.program_id = p.id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN program_translations tfr ON tfr.program_id = p.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE p.deleted_at IS NULL AND p.id = ?
  LIMIT 1
`;

/**
 * Séances d'un programme, triées par position. Premier `?` = id du programme.
 * Colonnes running incluses (nulles pour les séances muscu — harmless).
 */
/**
 * Séances d'un programme, triées par position, avec la consigne RUN-F4 et le nom/les textes
 * résolus par traduction.
 *
 * Repli en trois temps (US RUN-F4, lot I) : traduction de la langue courante → traduction `fr`
 * → **`sessions.name`**. Ce troisième niveau est ce qui rend la table `session_translations`
 * purement additive : les 3 programmes éditoriaux déjà publiés et toutes les séances
 * personnelles existantes s'affichent sans qu'une seule ligne de traduction existe.
 *
 * Même patron de jointures que `SELECT_PROGRAM_BASE`. Premier `?` = langue courante ;
 * second `?` = id du programme.
 */
const SELECT_SESSIONS_FOR_PROGRAM = `
  SELECT s.id,
         COALESCE(tl.name, tfr.name, s.name) AS name,
         s.order_index, s.session_type, s.target_distance_m, s.target_duration_seconds,
         s.target_pace_min_s_per_km, s.target_pace_max_s_per_km, s.target_rpe,
         s.target_time_seconds, s.pacing_plan,
         COALESCE(tl.description, tfr.description, s.description) AS description,
         COALESCE(tl.instructions, tfr.instructions, s.instructions) AS instructions,
         s.adaptation_criterion
  FROM sessions s
  LEFT JOIN session_translations tl  ON tl.session_id = s.id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN session_translations tfr ON tfr.session_id = s.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE s.program_id = ? AND s.deleted_at IS NULL
  ORDER BY s.order_index
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
         COALESCE(tl.name, tfr.name) AS exercise_name,
         e.muscle_primary, e.muscles_secondary, e.muscles_fine
  FROM exercise_plans ep
  JOIN sessions s ON s.id = ep.session_id AND s.deleted_at IS NULL
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = ep.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = ep.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  LEFT JOIN exercises e ON e.id = ep.exercise_id
  WHERE s.program_id = ? AND ep.deleted_at IS NULL
  ORDER BY s.order_index, ep.order_index
`;

/**
 * Tous les blocs fractionné des séances d'un programme (US RUN-F2c). Premier `?` = id du
 * programme. Tri par (order_index de la séance, order_index du bloc), même patron que
 * `SELECT_PLANS_FOR_PROGRAM`.
 */
const SELECT_INTERVALS_FOR_PROGRAM = `
  SELECT si.id, si.session_id, si.order_index, si.reps,
         si.fast_distance_m, si.fast_duration_seconds, si.fast_pace_pct_vma,
         si.recovery_distance_m, si.recovery_duration_seconds,
         si.kind, si.label,
         si.fast_pace_min_s_per_km, si.fast_pace_max_s_per_km,
         si.fast_target_time_min_seconds, si.fast_target_time_max_seconds,
         si.recovery_kind, si.recovery_pace_min_s_per_km, si.recovery_pace_max_s_per_km,
         si.group_key, si.group_reps
  FROM session_intervals si
  JOIN sessions s ON s.id = si.session_id AND s.deleted_at IS NULL
  WHERE s.program_id = ? AND si.deleted_at IS NULL
  ORDER BY s.order_index, si.order_index
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
  const musclePrimary = (row.muscle_primary as MuscleGroup | null) ?? null;
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
    musclePrimary,
    musclesSecondary: musclePrimary
      ? normalizeSecondaryMuscles(parseJsonColumn<unknown>(row.muscles_secondary, []), musclePrimary)
      : [],
    musclesFine: normalizeFineMuscles(parseJsonColumn<unknown>(row.muscles_fine, [])),
  };
}

/**
 * Convertit une ligne bloc fractionné SQLite → item de domaine (camelCase, US RUN-F2c).
 * Exportée (voir `IntervalDbRow`) pour réutilisation par `run-repository.ts` (US RUN-F2d).
 */
export function rowToIntervalItem(row: IntervalDbRow): IntervalBlockItem {
  return {
    id: row.id,
    orderIndex: row.order_index,
    reps: row.reps,
    fastDistanceM: row.fast_distance_m,
    fastDurationSeconds: row.fast_duration_seconds,
    fastPacePctVma: row.fast_pace_pct_vma,
    recoveryDistanceM: row.recovery_distance_m,
    recoveryDurationSeconds: row.recovery_duration_seconds,
    // Repli sur `work` plutôt que de propager un null : une ligne écrite avant RUN-F4 EST un
    // segment de corps de séance, et le typer ainsi évite un cas particulier partout en aval.
    kind: (row.kind as SegmentKind | null) ?? DEFAULT_SEGMENT_KIND,
    label: row.label,
    fastPaceMinSPerKm: row.fast_pace_min_s_per_km,
    fastPaceMaxSPerKm: row.fast_pace_max_s_per_km,
    fastTargetTimeMinSeconds: row.fast_target_time_min_seconds,
    fastTargetTimeMaxSeconds: row.fast_target_time_max_seconds,
    recoveryKind: (row.recovery_kind as RecoveryKind | null) ?? null,
    recoveryPaceMinSPerKm: row.recovery_pace_min_s_per_km,
    recoveryPaceMaxSPerKm: row.recovery_pace_max_s_per_km,
    groupKey: row.group_key,
    groupReps: row.group_reps,
  };
}

/**
 * Regroupe les plans et blocs fractionné (déjà triés par order_index de séance puis d'élément)
 * sous leurs séances (elles-mêmes déjà triées par order_index). L'ordre est préservé.
 */
function buildSessionDetails(
  sessionRows: SessionDbRow[],
  planRows: PlanDbRow[],
  intervalRows: IntervalDbRow[] = [],
): SessionDetail[] {
  const sessions: SessionDetail[] = sessionRows.map((s) => ({
    id: s.id,
    name: s.name,
    orderIndex: s.order_index,
    plans: [],
    sessionType: (s.session_type as ProgramSessionType | null) ?? null,
    targetDistanceM: s.target_distance_m,
    targetDurationSeconds: s.target_duration_seconds,
    intervals: [],
    targetPaceMinSPerKm: s.target_pace_min_s_per_km,
    targetPaceMaxSPerKm: s.target_pace_max_s_per_km,
    targetRpe: s.target_rpe,
    targetTimeSeconds: s.target_time_seconds,
    // Tolérant par conception : une colonne jsonb libre peut contenir n'importe quoi, et une
    // exception ici ferait planter l'écran de détail à cause d'une donnée décorative.
    pacingPlan: parsePacingPlan(s.pacing_plan),
    description: s.description,
    instructions: s.instructions,
    adaptationCriterion: s.adaptation_criterion,
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

  for (const row of intervalRows) {
    const session = bySessionId.get(row.session_id);
    // Un bloc sans séance connue est ignoré (ne devrait pas arriver — JOIN garanti).
    if (session) {
      session.intervals.push(rowToIntervalItem(row));
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

  if (filters?.pillar !== undefined) {
    clauses.push('p.pillar = ?');
    params.push(filters.pillar);
  }
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
 * Quatre requêtes réactives (entête, séances, plans, blocs fractionné) toujours appelées (règle des
 * hooks) ; quand `programId` est vide/inconnu, elles renvoient des résultats vides.
 */
export function useProgramDetail(programId: string): {
  detail: ProgramDetail | null;
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';

  const { data: headerRows, isLoading: headerLoading } =
    useQuery<ProgramDetailDbRow>(SELECT_PROGRAM_DETAIL_HEADER, [lang, programId]);
  // US RUN-F4 (lot I) : la requête prend désormais la langue en 1er paramètre — les séances
  // sont traduites comme les programmes l'étaient déjà.
  const { data: sessionRows, isLoading: sessionsLoading } =
    useQuery<SessionDbRow>(SELECT_SESSIONS_FOR_PROGRAM, [lang, programId]);
  const { data: planRows, isLoading: plansLoading } = useQuery<PlanDbRow>(
    SELECT_PLANS_FOR_PROGRAM,
    [lang, programId],
  );
  const { data: intervalRows, isLoading: intervalsLoading } = useQuery<IntervalDbRow>(
    SELECT_INTERVALS_FOR_PROGRAM,
    [programId],
  );

  const isLoading = headerLoading || sessionsLoading || plansLoading || intervalsLoading;

  const header = headerRows[0];
  if (!header) {
    return { detail: null, isLoading };
  }

  const base = rowToListItem(header);
  const detail: ProgramDetail = {
    ...base,
    summary: header.summary,
    sessions: buildSessionDetails(sessionRows, planRows, intervalRows),
    targetDate: header.target_date,
    targetTimeSeconds: header.target_time_seconds,
    eventName: header.event_name,
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
 * Ajoute un bloc fractionné à une séance running (US RUN-F2c, type `fractionne` uniquement —
 * non contraint côté écriture, la lecture ignore les blocs des autres types).
 * `order_index` = position suivante (max+1) dans la séance.
 */
export async function addIntervalBlock(
  sessionId: string,
  input: {
    reps?: number;
    fastDistanceM?: number | null;
    fastDurationSeconds?: number | null;
    fastPacePctVma?: number | null;
    recoveryDistanceM?: number | null;
    recoveryDurationSeconds?: number | null;
    kind?: SegmentKind;
    label?: string | null;
    fastPaceMinSPerKm?: number | null;
    fastPaceMaxSPerKm?: number | null;
    fastTargetTimeMinSeconds?: number | null;
    fastTargetTimeMaxSeconds?: number | null;
    recoveryKind?: RecoveryKind | null;
    recoveryPaceMinSPerKm?: number | null;
    recoveryPaceMaxSPerKm?: number | null;
    groupKey?: string | null;
    groupReps?: number | null;
  } = {},
): Promise<void> {
  const ownerId = currentUserId();
  const orderIndex = await nextOrderIndex(
    'session_intervals',
    'session_id',
    sessionId,
  );

  await insertWithSyncFields('session_intervals', {
    session_id: sessionId,
    owner_id: ownerId,
    order_index: orderIndex,
    reps: input.reps ?? 1,
    fast_distance_m: input.fastDistanceM ?? null,
    fast_duration_seconds: input.fastDurationSeconds ?? null,
    fast_pace_pct_vma: input.fastPacePctVma ?? null,
    recovery_distance_m: input.recoveryDistanceM ?? null,
    recovery_duration_seconds: input.recoveryDurationSeconds ?? null,
    kind: input.kind ?? DEFAULT_SEGMENT_KIND,
    label: input.label ?? null,
    fast_pace_min_s_per_km: input.fastPaceMinSPerKm ?? null,
    fast_pace_max_s_per_km: input.fastPaceMaxSPerKm ?? null,
    fast_target_time_min_seconds: input.fastTargetTimeMinSeconds ?? null,
    fast_target_time_max_seconds: input.fastTargetTimeMaxSeconds ?? null,
    recovery_kind: input.recoveryKind ?? null,
    recovery_pace_min_s_per_km: input.recoveryPaceMinSPerKm ?? null,
    recovery_pace_max_s_per_km: input.recoveryPaceMaxSPerKm ?? null,
    group_key: input.groupKey ?? null,
    group_reps: input.groupReps ?? null,
  });
}

/**
 * Met à jour un bloc fractionné (répétitions, phase rapide, récupération).
 * Seules les clés présentes dans `input` sont modifiées.
 */
export async function updateIntervalBlock(
  blockId: string,
  input: IntervalBlockPatch,
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('reps' in input) columns['reps'] = input.reps;
  if ('fastDistanceM' in input) columns['fast_distance_m'] = input.fastDistanceM;
  if ('fastDurationSeconds' in input) columns['fast_duration_seconds'] = input.fastDurationSeconds;
  if ('fastPacePctVma' in input) columns['fast_pace_pct_vma'] = input.fastPacePctVma;
  if ('recoveryDistanceM' in input) columns['recovery_distance_m'] = input.recoveryDistanceM;
  if ('recoveryDurationSeconds' in input) columns['recovery_duration_seconds'] = input.recoveryDurationSeconds;
  if ('kind' in input) columns['kind'] = input.kind;
  if ('label' in input) columns['label'] = input.label;
  if ('fastPaceMinSPerKm' in input) columns['fast_pace_min_s_per_km'] = input.fastPaceMinSPerKm;
  if ('fastPaceMaxSPerKm' in input) columns['fast_pace_max_s_per_km'] = input.fastPaceMaxSPerKm;
  if ('fastTargetTimeMinSeconds' in input) columns['fast_target_time_min_seconds'] = input.fastTargetTimeMinSeconds;
  if ('fastTargetTimeMaxSeconds' in input) columns['fast_target_time_max_seconds'] = input.fastTargetTimeMaxSeconds;
  if ('recoveryKind' in input) columns['recovery_kind'] = input.recoveryKind;
  if ('recoveryPaceMinSPerKm' in input) columns['recovery_pace_min_s_per_km'] = input.recoveryPaceMinSPerKm;
  if ('recoveryPaceMaxSPerKm' in input) columns['recovery_pace_max_s_per_km'] = input.recoveryPaceMaxSPerKm;
  if ('groupKey' in input) columns['group_key'] = input.groupKey;
  if ('groupReps' in input) columns['group_reps'] = input.groupReps;

  await patch('session_intervals', blockId, columns);
}

/** Retire un bloc fractionné d'une séance (soft delete). */
export async function removeIntervalBlock(blockId: string): Promise<void> {
  await softDelete('session_intervals', blockId);
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
    // ---- US RUN-F4 : la consigne (lots A, G, I) ----
    targetPaceMinSPerKm?: number | null;
    targetPaceMaxSPerKm?: number | null;
    targetRpe?: number | null;
    targetTimeSeconds?: number | null;
    pacingPlan?: PacingPlan | null;
    description?: string | null;
    instructions?: string | null;
    adaptationCriterion?: string | null;
  },
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('sessionType' in input) columns['session_type'] = input.sessionType;
  if ('targetDistanceM' in input) columns['target_distance_m'] = input.targetDistanceM;
  if ('targetDurationSeconds' in input) columns['target_duration_seconds'] = input.targetDurationSeconds;
  if ('name' in input) columns['name'] = input.name;
  if ('targetPaceMinSPerKm' in input) columns['target_pace_min_s_per_km'] = input.targetPaceMinSPerKm;
  if ('targetPaceMaxSPerKm' in input) columns['target_pace_max_s_per_km'] = input.targetPaceMaxSPerKm;
  if ('targetRpe' in input) columns['target_rpe'] = input.targetRpe;
  if ('targetTimeSeconds' in input) columns['target_time_seconds'] = input.targetTimeSeconds;
  // Sérialisé ici et nulle part ailleurs : l'UI manipule un tableau typé, la colonne est du JSON.
  if ('pacingPlan' in input) {
    columns['pacing_plan'] = input.pacingPlan == null ? null : JSON.stringify(input.pacingPlan);
  }
  if ('description' in input) columns['description'] = input.description;
  if ('instructions' in input) columns['instructions'] = input.instructions;
  if ('adaptationCriterion' in input) columns['adaptation_criterion'] = input.adaptationCriterion;

  await patch('sessions', sessionId, columns);
}

/**
 * Met à jour l'échéance d'un programme (US RUN-F4, lot H) — la date de course, le chrono visé
 * et le nom de l'événement. `null` efface l'échéance et le compte à rebours disparaît.
 */
export async function updateProgramTarget(
  programId: string,
  input: {
    targetDate?: string | null;
    targetTimeSeconds?: number | null;
    eventName?: string | null;
  },
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if ('targetDate' in input) columns['target_date'] = input.targetDate;
  if ('targetTimeSeconds' in input) columns['target_time_seconds'] = input.targetTimeSeconds;
  if ('eventName' in input) columns['event_name'] = input.eventName;

  await patch('programs', programId, columns);
}

/**
 * Retire une séance d'un programme (soft delete de la séance ET de tous ses plans).
 *
 * Cascade également les `planned_sessions` de l'utilisateur courant qui référencent
 * cette séance (`session_id`), afin de ne pas laisser d'entrées de planning orphelines
 * (US suppression). Owner-scopé et idempotent (`deleted_at IS NULL`).
 */
export async function removeSession(sessionId: string): Promise<void> {
  const ownerId = currentUserId();
  const now = nowUtc();

  const plans = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM exercise_plans WHERE session_id = ? AND deleted_at IS NULL`,
    [sessionId],
  );
  for (const plan of plans) {
    await softDelete('exercise_plans', plan.id);
  }

  const intervals = await powerSync.getAll<{ id: string }>(
    `SELECT id FROM session_intervals WHERE session_id = ? AND deleted_at IS NULL`,
    [sessionId],
  );
  for (const block of intervals) {
    await softDelete('session_intervals', block.id);
  }

  // Cascade planning : soft-delete les séances planifiées de l'owner liées à cette séance.
  await powerSync.execute(
    `UPDATE planned_sessions SET deleted_at = ?, updated_at = ?
     WHERE session_id = ? AND owner_id = ? AND deleted_at IS NULL`,
    [now, now, sessionId, ownerId],
  );

  await softDelete('sessions', sessionId);
}

// ---------------------------------------------------------------------------
// Duplication et activation (transactions atomiques)
// ---------------------------------------------------------------------------

/**
 * Duplique un programme (éditorial ou autre) en un NOUVEAU programme personnalisé
 * de l'utilisateur : nouveaux UUID partout, `owner_id`=user, `status='published'`,
 * `is_active=0`. Copie l'entête, toutes les traductions, les séances, leurs plans et leurs
 * blocs fractionné (avec remappage des `session_id`).
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
      target_time_seconds: number | null;
      event_name: string | null;
    }>(
      `SELECT pillar, level, goal, duration_weeks, target_time_seconds, event_name FROM programs
       WHERE id = ? AND deleted_at IS NULL`,
      [sourceProgramId],
    );
    if (!source) {
      throw new Error('Programme source introuvable : duplication impossible.');
    }

    // 1. Nouvel entête programme.
    //
    // ⚠️ US RUN-F4 (lot H) : on recopie l'objectif chrono et le nom de l'événement, mais
    // **délibérément PAS `target_date`**. Dupliquer un plan sert à le refaire, sur une NOUVELLE
    // échéance : recopier la date afficherait un « J-42 » déjà périmé (souvent négatif) dès la
    // première ouverture du programme dupliqué. L'utilisateur repose la date, le reste suit.
    const newProgramId = await txInsert(tx, 'programs', {
      owner_id: ownerId,
      pillar: source.pillar,
      status: 'published',
      is_active: 0,
      level: source.level,
      goal: source.goal,
      duration_weeks: source.duration_weeks,
      target_date: null,
      target_time_seconds: source.target_time_seconds,
      event_name: source.event_name,
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
      target_pace_min_s_per_km: number | null;
      target_pace_max_s_per_km: number | null;
      target_rpe: number | null;
      target_time_seconds: number | null;
      pacing_plan: string | null;
      description: string | null;
      instructions: string | null;
      adaptation_criterion: string | null;
    }>(
      `SELECT id, order_index, name, session_type, target_distance_m, target_duration_seconds,
              target_pace_min_s_per_km, target_pace_max_s_per_km, target_rpe,
              target_time_seconds, pacing_plan, description, instructions, adaptation_criterion
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
        // US RUN-F4 : la consigne suit la séance. Sans ces 8 colonnes, dupliquer un programme
        // rendrait des séances vidées de leur allure et de leurs instructions — exactement le
        // vide que cette US comble.
        target_pace_min_s_per_km: s.target_pace_min_s_per_km,
        target_pace_max_s_per_km: s.target_pace_max_s_per_km,
        target_rpe: s.target_rpe,
        target_time_seconds: s.target_time_seconds,
        pacing_plan: s.pacing_plan,
        description: s.description,
        instructions: s.instructions,
        adaptation_criterion: s.adaptation_criterion,
      });
      sessionIdMap.set(s.id, newSessionId);
    }

    // 3 bis. Copie des traductions de séance (US RUN-F4, lot I) — même raisonnement que les
    // traductions de programme juste au-dessus : un programme éditorial bilingue dupliqué doit
    // rester bilingue, séance par séance.
    for (const [oldSessionId, newSessionId] of sessionIdMap) {
      const sessionTranslations = await tx.getAll<{
        lang: string;
        name: string | null;
        description: string | null;
        instructions: string | null;
      }>(
        `SELECT lang, name, description, instructions FROM session_translations
         WHERE session_id = ? AND deleted_at IS NULL`,
        [oldSessionId],
      );
      for (const t of sessionTranslations) {
        await txInsert(tx, 'session_translations', {
          session_id: newSessionId,
          owner_id: ownerId,
          lang: t.lang,
          name: t.name,
          description: t.description,
          instructions: t.instructions,
        });
      }
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

    // 5. Copie des blocs fractionné (nouveaux id, session_id remappé — US RUN-F2c).
    for (const [oldSessionId, newSessionId] of sessionIdMap) {
      const intervals = await tx.getAll<{
        order_index: number;
        reps: number;
        fast_distance_m: number | null;
        fast_duration_seconds: number | null;
        fast_pace_pct_vma: number | null;
        recovery_distance_m: number | null;
        recovery_duration_seconds: number | null;
        kind: string | null;
        label: string | null;
        fast_pace_min_s_per_km: number | null;
        fast_pace_max_s_per_km: number | null;
        fast_target_time_min_seconds: number | null;
        fast_target_time_max_seconds: number | null;
        recovery_kind: string | null;
        recovery_pace_min_s_per_km: number | null;
        recovery_pace_max_s_per_km: number | null;
        group_key: string | null;
        group_reps: number | null;
      }>(
        `SELECT order_index, reps, fast_distance_m, fast_duration_seconds, fast_pace_pct_vma,
                recovery_distance_m, recovery_duration_seconds,
                kind, label, fast_pace_min_s_per_km, fast_pace_max_s_per_km,
                fast_target_time_min_seconds, fast_target_time_max_seconds,
                recovery_kind, recovery_pace_min_s_per_km, recovery_pace_max_s_per_km,
                group_key, group_reps
         FROM session_intervals
         WHERE session_id = ? AND deleted_at IS NULL
         ORDER BY order_index`,
        [oldSessionId],
      );
      for (const block of intervals) {
        await txInsert(tx, 'session_intervals', {
          session_id: newSessionId,
          owner_id: ownerId,
          order_index: block.order_index,
          reps: block.reps,
          fast_distance_m: block.fast_distance_m,
          fast_duration_seconds: block.fast_duration_seconds,
          fast_pace_pct_vma: block.fast_pace_pct_vma,
          recovery_distance_m: block.recovery_distance_m,
          recovery_duration_seconds: block.recovery_duration_seconds,
          // US RUN-F4 : nature, allures, chrono cible et imbrication suivent le segment.
          // ⚠️ `group_key` est recopiée telle quelle : elle n'a de sens que RELATIVEMENT aux
          // segments consécutifs de la même séance (jamais une référence globale), donc la
          // réutiliser dans le programme dupliqué est correct et préserve les groupes.
          kind: block.kind ?? DEFAULT_SEGMENT_KIND,
          label: block.label,
          fast_pace_min_s_per_km: block.fast_pace_min_s_per_km,
          fast_pace_max_s_per_km: block.fast_pace_max_s_per_km,
          fast_target_time_min_seconds: block.fast_target_time_min_seconds,
          fast_target_time_max_seconds: block.fast_target_time_max_seconds,
          recovery_kind: block.recovery_kind,
          recovery_pace_min_s_per_km: block.recovery_pace_min_s_per_km,
          recovery_pace_max_s_per_km: block.recovery_pace_max_s_per_km,
          group_key: block.group_key,
          group_reps: block.group_reps,
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

    // Active la cible — **owner-scopé** : on ne peut activer qu'un programme POSSÉDÉ.
    // Sans ce filtre, activer un programme éditorial (owner_id null) écrivait `is_active=1`
    // en local (rejeté par la RLS au sync → divergence) alors que `useActiveProgram`
    // (owner-scopé) ne le voyait pas. Un éditorial doit d'abord être dupliqué.
    await tx.execute(
      `UPDATE programs SET is_active = 1, updated_at = ? WHERE id = ? AND owner_id = ?`,
      [now, programId, userId],
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
 *
 * Durcissements (US suppression) :
 *  1. **[transaction]** si le programme est actif (`is_active=1`), le passer `is_active=0`
 *     **puis** poser le soft-delete du programme dans une **même `writeTransaction`**.
 *     L'ordre est impératif : `is_active=0` d'abord, car `activateProgram` filtre
 *     `is_active=1 AND deleted_at IS NULL` — on ne veut jamais laisser une ligne
 *     soft-deletée restée active.
 *  2. cascade `planned_sessions` de l'owner par `program_id` (un seul filtre suffit :
 *     il couvre toutes les séances planifiées du programme) — nettoie les orphelins de planning.
 *  3. cascade existante (séances → exercise_plans → traductions), séquentielle.
 *
 * Idempotent : toutes les écritures filtrent `deleted_at IS NULL`.
 */
export async function deleteProgram(programId: string): Promise<void> {
  const ownerId = currentUserId();
  const now = nowUtc();

  // 1. Désactivation (si actif) + soft-delete du programme, atomiques et ordonnés.
  await powerSync.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE programs SET is_active = 0, updated_at = ?
       WHERE id = ? AND is_active = 1 AND deleted_at IS NULL`,
      [now, programId],
    );
    await tx.execute(
      `UPDATE programs SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [now, now, programId],
    );
  });

  // 2. Cascade planning : soft-delete les séances planifiées de l'owner pour ce programme.
  await powerSync.execute(
    `UPDATE planned_sessions SET deleted_at = ?, updated_at = ?
     WHERE program_id = ? AND owner_id = ? AND deleted_at IS NULL`,
    [now, now, programId, ownerId],
  );

  // 3. Cascade existante : séances → plans → traductions.
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
}
