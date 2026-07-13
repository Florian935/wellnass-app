import { supabase } from '../lib/supabase';
import {
  PROGRAM_LEVELS,
  PROGRAM_SESSION_TYPES,
  PROGRAM_STATUSES,
  SET_TYPES,
  type Database,
  type ProgramLevel,
  type ProgramSessionType,
  type ProgramStatus,
  type SetType,
} from '@wellness/shared';

/**
 * Couche data des programmes éditoriaux (US 8.4 — constructeur de programmes du
 * back-office). Requêtes Supabase via `supabase-js` (clé anon ; la RLS est la
 * frontière — seul un admin peut écrire l'éditorial). Programmes éditoriaux =
 * `owner_id IS NULL`. Écriture séquentielle (jamais de transaction côté client),
 * UUID générés client (`crypto.randomUUID()`), suppression = soft-delete
 * (`deleted_at = now`, jamais de hard delete).
 *
 * Deux piliers gérés par le constructeur : `strength` (muscu → séances +
 * exercices planifiés) et `running` (séances avec cibles distance/durée, sans
 * exercices). Miroir logique du repository mobile `program-repository.ts`,
 * adapté à supabase-js + `owner_id NULL` (pas de PowerSync ici).
 */

/** Les deux piliers gérés par le constructeur (nutrition exclue). */
export const PILLAR_BUILDER = ['strength', 'running'] as const;
/** Pilier géré par le constructeur (`strength` | `running`). */
export type PillarBuilder = (typeof PILLAR_BUILDER)[number];

// Réexports pour la commodité des écrans (source unique `@wellness/shared`).
// `SessionType` est ici le sous-ensemble « programme » (les 4 types autorisés en
// séance de programme running — sans `course_libre`, qui est un run libre).
export { PROGRAM_LEVELS, PROGRAM_SESSION_TYPES, PROGRAM_STATUSES, SET_TYPES };
export type { ProgramLevel, ProgramStatus, SetType };
export type SessionType = ProgramSessionType;

/** Une ligne programme éditorial enrichie de ses noms FR/EN (pour la liste). */
export type AdminProgramRow = {
  id: string;
  pillar: string;
  status: string;
  level: string | null;
  goal: string | null;
  durationWeeks: number | null;
  createdAt: string;
  nameFr: string | null;
  nameEn: string | null;
};

/** Un exercice planifié au sein d'une séance (nom FR résolu pour l'affichage). */
export type AdminExercisePlan = {
  id: string;
  orderIndex: number;
  exerciseId: string;
  exerciseNameFr: string | null;
  setType: string;
  targetSets: number | null;
  targetReps: string | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
};

/** Une séance d'un programme, avec ses exercices planifiés (vide en running). */
export type AdminSession = {
  id: string;
  orderIndex: number;
  name: string | null;
  sessionType: string | null;
  targetDistanceM: number | null;
  targetDurationSeconds: number | null;
  plans: AdminExercisePlan[];
};

/** Détail complet d'un programme éditorial : entête + traductions + séances. */
export type ProgramDetail = {
  id: string;
  pillar: string;
  status: string;
  level: string | null;
  goal: string | null;
  durationWeeks: number | null;
  nameFr: string | null;
  nameEn: string | null;
  summaryFr: string | null;
  summaryEn: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  sessions: AdminSession[];
};

/** Entrée de `createEditorialProgram` (FR/EN requis non vides côté écran). */
export type CreateProgramInput = {
  pillar: PillarBuilder;
  level: ProgramLevel | null;
  goal: string | null;
  durationWeeks: number | null;
  nameFr: string;
  nameEn: string;
};

/** Entrée de `updateProgramMeta` (métadonnées + traductions FR/EN). */
export type UpdateProgramMetaInput = {
  level: ProgramLevel | null;
  goal: string | null;
  durationWeeks: number | null;
  nameFr: string;
  nameEn: string;
  summaryFr: string | null;
  summaryEn: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
};

/** Entrée de `addSession` / `updateSession` (cibles running nullables en muscu). */
export type SessionInput = {
  name: string | null;
  sessionType: SessionType | null;
  targetDistanceM: number | null;
  targetDurationSeconds: number | null;
};

/** Entrée de `addExercisePlan` / `updateExercisePlan`. */
export type ExercisePlanInput = {
  exerciseId: string;
  setType: SetType;
  targetSets: number | null;
  targetReps: string | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NamedTranslation = { lang: string; name: string; deleted_at?: string | null };

/**
 * Retrouve le nom d'une langue donnée dans un tableau de traductions, en ignorant
 * les traductions soft-deletées (`deleted_at` non nul) — aligné sur le repository
 * mobile qui filtre `deleted_at IS NULL` sur chaque jointure de traduction.
 */
function nameForLang(
  translations: readonly NamedTranslation[],
  lang: 'fr' | 'en',
): string | null {
  return translations.find((t) => t.lang === lang && t.deleted_at == null)?.name ?? null;
}

/** Transforme un `max(order_index)` en position suivante (0 si aucune ligne). */
function toNextIndex(max: number | null | undefined): number {
  return max === null || max === undefined ? 0 : max + 1;
}

/**
 * `order_index` suivant pour les séances non supprimées d'un programme éditorial :
 * max+1, ou 0 si aucune.
 */
async function nextSessionOrderIndex(
  programId: string,
): Promise<{ index: number; error: unknown }> {
  const { data, error } = await supabase
    .from('sessions')
    .select('order_index')
    .eq('program_id', programId)
    .is('owner_id', null)
    .is('deleted_at', null)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { index: 0, error };
  }
  return { index: toNextIndex(data?.order_index), error: null };
}

/**
 * `order_index` suivant pour les plans d'exercice non supprimés d'une séance
 * éditoriale : max+1, ou 0 si aucun.
 */
async function nextPlanOrderIndex(
  sessionId: string,
): Promise<{ index: number; error: unknown }> {
  const { data, error } = await supabase
    .from('exercise_plans')
    .select('order_index')
    .eq('session_id', sessionId)
    .is('owner_id', null)
    .is('deleted_at', null)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { index: 0, error };
  }
  return { index: toNextIndex(data?.order_index), error: null };
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/**
 * Liste des programmes éditoriaux (`owner_id IS NULL`, non supprimés), avec leurs
 * traductions FR/EN jointes, triés du plus récent au plus ancien. Tout l'éditorial
 * (brouillons compris) est lisible via la RLS `select` des programmes (`owner_id is
 * null`) ; côté mobile, seuls les publiés descendent (filtre des sync rules).
 */
export async function listEditorialPrograms(): Promise<{
  rows: AdminProgramRow[];
  error: unknown;
}> {
  const { data, error } = await supabase
    .from('programs')
    .select(
      'id, pillar, status, level, goal, duration_weeks, created_at, program_translations(lang, name, deleted_at)',
    )
    .is('owner_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return { rows: [], error };
  }

  const rows: AdminProgramRow[] = (data ?? []).map((p) => {
    const translations = (p.program_translations ?? []) as NamedTranslation[];
    return {
      id: p.id,
      pillar: p.pillar,
      status: p.status,
      level: p.level,
      goal: p.goal,
      durationWeeks: p.duration_weeks,
      createdAt: p.created_at,
      nameFr: nameForLang(translations, 'fr'),
      nameEn: nameForLang(translations, 'en'),
    };
  });

  return { rows, error: null };
}

/**
 * Détail complet d'un programme éditorial (entête + traductions + séances
 * ordonnées + exercices planifiés ordonnés). Assemblé en étapes claires :
 *  1. programme + traductions (owner_id NULL, non supprimé) ;
 *  2. séances du programme (triées par `order_index`) ;
 *  3. exercices planifiés de ces séances (triés par `order_index`), avec le nom
 *     FR de l'exercice résolu via `exercises(exercise_translations(...))`.
 * Les séances running n'ont pas d'exercices : leur tableau `plans` reste vide.
 * Renvoie `{ program: null }` si le programme est introuvable (sans erreur).
 */
export async function getProgram(id: string): Promise<{
  program: ProgramDetail | null;
  error: unknown;
}> {
  // 1. Entête + traductions.
  const { data: programData, error: programError } = await supabase
    .from('programs')
    .select(
      'id, pillar, status, level, goal, duration_weeks, program_translations(lang, name, summary, description, deleted_at)',
    )
    .eq('id', id)
    .is('owner_id', null) // éditorial uniquement
    .is('deleted_at', null)
    .maybeSingle();

  if (programError) {
    return { program: null, error: programError };
  }
  if (!programData) {
    return { program: null, error: null };
  }

  type FullTranslation = {
    lang: string;
    name: string;
    summary: string | null;
    description: string | null;
    deleted_at: string | null;
  };
  // Ignore les traductions soft-deletées (cf. `nameForLang` / repo mobile).
  const translations = ((programData.program_translations ?? []) as FullTranslation[]).filter(
    (t) => t.deleted_at == null,
  );
  const fr = translations.find((t) => t.lang === 'fr');
  const en = translations.find((t) => t.lang === 'en');

  // 2. Séances du programme, triées par position.
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('sessions')
    .select(
      'id, order_index, name, session_type, target_distance_m, target_duration_seconds',
    )
    .eq('program_id', id)
    .is('owner_id', null)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });

  if (sessionsError) {
    return { program: null, error: sessionsError };
  }

  const sessions: AdminSession[] = (sessionsData ?? []).map((s) => ({
    id: s.id,
    orderIndex: s.order_index,
    name: s.name,
    sessionType: s.session_type,
    targetDistanceM: s.target_distance_m,
    targetDurationSeconds: s.target_duration_seconds,
    plans: [],
  }));

  const sessionIds = sessions.map((s) => s.id);

  // 3. Exercices planifiés de ces séances (le nom FR de l'exercice est joint).
  //    Sauté si aucune séance (running sans séance, ou muscu vide).
  if (sessionIds.length > 0) {
    const { data: plansData, error: plansError } = await supabase
      .from('exercise_plans')
      .select(
        'id, session_id, order_index, exercise_id, set_type, target_sets, target_reps, target_weight_kg, rest_seconds, exercises(exercise_translations(lang, name, deleted_at))',
      )
      .in('session_id', sessionIds)
      .is('owner_id', null)
      .is('deleted_at', null)
      .order('order_index', { ascending: true });

    if (plansError) {
      return { program: null, error: plansError };
    }

    const bySessionId = new Map<string, AdminSession>();
    for (const s of sessions) {
      bySessionId.set(s.id, s);
    }

    for (const plan of plansData ?? []) {
      const exercise = plan.exercises as
        | { exercise_translations: NamedTranslation[] | null }
        | null;
      const exTranslations = (exercise?.exercise_translations ?? []) as NamedTranslation[];
      const session = bySessionId.get(plan.session_id);
      // Un plan sans séance connue est ignoré (ne devrait pas arriver — filtre `in`).
      if (session) {
        session.plans.push({
          id: plan.id,
          orderIndex: plan.order_index,
          exerciseId: plan.exercise_id,
          exerciseNameFr: nameForLang(exTranslations, 'fr'),
          setType: plan.set_type,
          targetSets: plan.target_sets,
          targetReps: plan.target_reps,
          // `numeric` peut remonter en chaîne (PostgREST préserve la précision) : on
          // coerce en nombre pour que le type déclaré ne mente pas au runtime.
          targetWeightKg:
            plan.target_weight_kg == null ? null : Number(plan.target_weight_kg),
          restSeconds: plan.rest_seconds,
        });
      }
    }
  }

  const program: ProgramDetail = {
    id: programData.id,
    pillar: programData.pillar,
    status: programData.status,
    level: programData.level,
    goal: programData.goal,
    durationWeeks: programData.duration_weeks,
    nameFr: fr?.name ?? null,
    nameEn: en?.name ?? null,
    summaryFr: fr?.summary ?? null,
    summaryEn: en?.summary ?? null,
    descriptionFr: fr?.description ?? null,
    descriptionEn: en?.description ?? null,
    sessions,
  };

  return { program, error: null };
}

// ---------------------------------------------------------------------------
// Écritures — programme
// ---------------------------------------------------------------------------

/**
 * Crée un programme éditorial (`owner_id NULL`, `status 'draft'`) et ses deux
 * traductions (FR, EN — `summary`/`description` à null à la création). Écriture
 * séquentielle : la ligne `programs` d'abord, puis les deux `program_translations`.
 * En cas d'échec partiel, renvoie l'`id` (non null) déjà créé pour que l'UI
 * puisse retenter. Retourne l'`id` du programme.
 */
export async function createEditorialProgram(input: CreateProgramInput): Promise<{
  id: string | null;
  error: unknown;
}> {
  const id = crypto.randomUUID();

  const programInsert: Database['public']['Tables']['programs']['Insert'] = {
    id,
    owner_id: null,
    pillar: input.pillar,
    status: 'draft',
    level: input.level,
    goal: input.goal,
    duration_weeks: input.durationWeeks,
  };

  const { error: programError } = await supabase.from('programs').insert(programInsert);
  if (programError) {
    return { id: null, error: programError };
  }

  const translations: Database['public']['Tables']['program_translations']['Insert'][] = [
    {
      id: crypto.randomUUID(),
      program_id: id,
      owner_id: null,
      lang: 'fr',
      name: input.nameFr,
      summary: null,
      description: null,
    },
    {
      id: crypto.randomUUID(),
      program_id: id,
      owner_id: null,
      lang: 'en',
      name: input.nameEn,
      summary: null,
      description: null,
    },
  ];

  for (const t of translations) {
    const { error } = await supabase.from('program_translations').insert(t);
    if (error) {
      // Le programme a bien été créé : on renvoie son `id` (pas null) pour retenter.
      return { id, error };
    }
  }

  return { id, error: null };
}

/**
 * Met à jour les métadonnées d'un programme éditorial (level/goal/durationWeeks)
 * et ses deux traductions FR/EN (name/summary/description). Écriture séquentielle :
 * la ligne `programs` d'abord, puis upsert des deux traductions (conflit sur
 * `(program_id, lang)` → update). Idempotent.
 */
export async function updateProgramMeta(
  id: string,
  input: UpdateProgramMetaInput,
): Promise<{ error: unknown }> {
  const { error: programError } = await supabase
    .from('programs')
    .update({
      level: input.level,
      goal: input.goal,
      duration_weeks: input.durationWeeks,
    })
    .eq('id', id)
    .is('owner_id', null); // éditorial uniquement
  if (programError) {
    return { error: programError };
  }

  const translations: Database['public']['Tables']['program_translations']['Insert'][] = [
    {
      id: crypto.randomUUID(),
      program_id: id,
      owner_id: null,
      lang: 'fr',
      name: input.nameFr,
      summary: input.summaryFr,
      description: input.descriptionFr,
    },
    {
      id: crypto.randomUUID(),
      program_id: id,
      owner_id: null,
      lang: 'en',
      name: input.nameEn,
      summary: input.summaryEn,
      description: input.descriptionEn,
    },
  ];

  for (const t of translations) {
    const { error } = await supabase
      .from('program_translations')
      .upsert(t, { onConflict: 'program_id,lang' });
    if (error) {
      return { error };
    }
  }

  return { error: null };
}

/** Publie / repasse en brouillon un programme éditorial (`status`). */
export async function setStatus(
  id: string,
  status: ProgramStatus,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('programs')
    .update({ status })
    .eq('id', id)
    .is('owner_id', null); // éditorial uniquement
  return { error };
}

/**
 * Archive un programme éditorial (soft-delete `deleted_at = now`) en cascade, en
 * partant du plus fin vers l'entête pour ne jamais laisser d'orphelin visible :
 *  1. collecte les id des séances du programme ;
 *  2. soft-delete les `exercise_plans` de ces séances ;
 *  3. soft-delete les `sessions` du programme ;
 *  4. soft-delete les `program_translations` du programme ;
 *  5. soft-delete la ligne `programs`.
 * Séquentiel, owner-scopé (`owner_id NULL`) et idempotent ; s'arrête et renvoie à
 * la première erreur. L'ordre (fin → entête) garantit qu'un arrêt en cours ne laisse
 * jamais un parent supprimé au-dessus d'enfants vivants ; l'UI doit **retenter** en
 * cas d'erreur (le rejeu ne touche que les lignes encore vivantes).
 */
export async function archiveProgram(id: string): Promise<{ error: unknown }> {
  const now = new Date().toISOString();

  // 1. Séances du programme (id uniquement).
  const { data: sessionRows, error: sessionsError } = await supabase
    .from('sessions')
    .select('id')
    .eq('program_id', id)
    .is('owner_id', null)
    .is('deleted_at', null);
  if (sessionsError) {
    return { error: sessionsError };
  }

  const sessionIds = (sessionRows ?? []).map((s) => s.id);

  // 2. Plans d'exercice de ces séances. `.is('deleted_at', null)` → vraie
  //    idempotence : un retry ne réécrit pas `deleted_at` sur des lignes déjà mortes.
  if (sessionIds.length > 0) {
    const { error: plansError } = await supabase
      .from('exercise_plans')
      .update({ deleted_at: now })
      .in('session_id', sessionIds)
      .is('owner_id', null)
      .is('deleted_at', null);
    if (plansError) {
      return { error: plansError };
    }
  }

  // 3. Séances du programme.
  const { error: sessError } = await supabase
    .from('sessions')
    .update({ deleted_at: now })
    .eq('program_id', id)
    .is('owner_id', null)
    .is('deleted_at', null);
  if (sessError) {
    return { error: sessError };
  }

  // 4. Traductions du programme.
  const { error: trError } = await supabase
    .from('program_translations')
    .update({ deleted_at: now })
    .eq('program_id', id)
    .is('owner_id', null)
    .is('deleted_at', null);
  if (trError) {
    return { error: trError };
  }

  // 5. Entête programme.
  const { error: programError } = await supabase
    .from('programs')
    .update({ deleted_at: now })
    .eq('id', id)
    .is('owner_id', null)
    .is('deleted_at', null);
  return { error: programError };
}

// ---------------------------------------------------------------------------
// Écritures — séances
// ---------------------------------------------------------------------------

/**
 * Ajoute une séance à un programme éditorial. `order_index` = position suivante
 * (max+1) parmi les séances non supprimées du programme (0 si aucune). Retourne
 * l'`id` de la séance créée.
 */
export async function addSession(
  programId: string,
  input?: SessionInput,
): Promise<{ id: string | null; error: unknown }> {
  const { index, error: indexError } = await nextSessionOrderIndex(programId);
  if (indexError) {
    return { id: null, error: indexError };
  }

  const id = crypto.randomUUID();
  const sessionInsert: Database['public']['Tables']['sessions']['Insert'] = {
    id,
    program_id: programId,
    owner_id: null,
    order_index: index,
    name: input?.name ?? null,
    session_type: input?.sessionType ?? null,
    target_distance_m: input?.targetDistanceM ?? null,
    target_duration_seconds: input?.targetDurationSeconds ?? null,
  };

  const { error } = await supabase.from('sessions').insert(sessionInsert);
  if (error) {
    return { id: null, error };
  }
  return { id, error: null };
}

/**
 * Met à jour une séance éditoriale (nom + cibles running). Les cibles restent à
 * null pour les séances muscu.
 */
export async function updateSession(
  id: string,
  input: SessionInput,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('sessions')
    .update({
      name: input.name,
      session_type: input.sessionType,
      target_distance_m: input.targetDistanceM,
      target_duration_seconds: input.targetDurationSeconds,
    })
    .eq('id', id)
    .is('owner_id', null); // éditorial uniquement
  return { error };
}

/**
 * Retire une séance éditoriale (soft-delete de la séance ET de tous ses plans
 * d'exercice). Séquentiel : les plans d'abord, puis la séance. Owner-scopé,
 * idempotent ; s'arrête à la première erreur.
 */
export async function removeSession(id: string): Promise<{ error: unknown }> {
  const now = new Date().toISOString();

  const { error: plansError } = await supabase
    .from('exercise_plans')
    .update({ deleted_at: now })
    .eq('session_id', id)
    .is('owner_id', null)
    .is('deleted_at', null);
  if (plansError) {
    return { error: plansError };
  }

  const { error: sessError } = await supabase
    .from('sessions')
    .update({ deleted_at: now })
    .eq('id', id)
    .is('owner_id', null)
    .is('deleted_at', null);
  return { error: sessError };
}

/**
 * Réordonne les séances d'un programme : pour chaque id à l'index `i`, pose
 * `order_index = i`. Écriture séquentielle, owner-scopée et bornée au programme
 * (`.eq('program_id', programId)` = défense en profondeur contre un `orderedIds`
 * mal formé) ; s'arrête à la première erreur.
 */
export async function reorderSessions(
  programId: string,
  orderedIds: string[],
): Promise<{ error: unknown }> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await supabase
      .from('sessions')
      .update({ order_index: i })
      .eq('id', orderedIds[i]!)
      .eq('program_id', programId)
      .is('owner_id', null);
    if (error) {
      return { error };
    }
  }
  return { error: null };
}

// ---------------------------------------------------------------------------
// Écritures — exercices planifiés (muscu uniquement)
// ---------------------------------------------------------------------------

/**
 * Ajoute un exercice planifié à une séance éditoriale. `order_index` = position
 * suivante (max+1) parmi les plans non supprimés de la séance (0 si aucun).
 * Retourne l'`id` du plan créé.
 */
export async function addExercisePlan(
  sessionId: string,
  input: ExercisePlanInput,
): Promise<{ id: string | null; error: unknown }> {
  const { index, error: indexError } = await nextPlanOrderIndex(sessionId);
  if (indexError) {
    return { id: null, error: indexError };
  }

  const id = crypto.randomUUID();
  const planInsert: Database['public']['Tables']['exercise_plans']['Insert'] = {
    id,
    session_id: sessionId,
    owner_id: null,
    exercise_id: input.exerciseId,
    order_index: index,
    set_type: input.setType,
    target_sets: input.targetSets,
    target_reps: input.targetReps,
    target_weight_kg: input.targetWeightKg,
    rest_seconds: input.restSeconds,
  };

  const { error } = await supabase.from('exercise_plans').insert(planInsert);
  if (error) {
    return { id: null, error };
  }
  return { id, error: null };
}

/** Met à jour un exercice planifié (type de série, cibles, repos). */
export async function updateExercisePlan(
  id: string,
  input: ExercisePlanInput,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('exercise_plans')
    .update({
      set_type: input.setType,
      target_sets: input.targetSets,
      target_reps: input.targetReps,
      target_weight_kg: input.targetWeightKg,
      rest_seconds: input.restSeconds,
    })
    .eq('id', id)
    .is('owner_id', null); // éditorial uniquement
  return { error };
}

/** Retire un exercice planifié d'une séance (soft-delete). */
export async function removeExercisePlan(id: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('exercise_plans')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('owner_id', null); // éditorial uniquement
  return { error };
}

/**
 * Réordonne les exercices planifiés d'une séance : pour chaque id à l'index `i`,
 * pose `order_index = i`. Écriture séquentielle, owner-scopée et bornée à la séance
 * (`.eq('session_id', sessionId)` = défense en profondeur) ; s'arrête à la première
 * erreur.
 */
export async function reorderExercisePlans(
  sessionId: string,
  orderedIds: string[],
): Promise<{ error: unknown }> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await supabase
      .from('exercise_plans')
      .update({ order_index: i })
      .eq('id', orderedIds[i]!)
      .eq('session_id', sessionId)
      .is('owner_id', null);
    if (error) {
      return { error };
    }
  }
  return { error: null };
}
