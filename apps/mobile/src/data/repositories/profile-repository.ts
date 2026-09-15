/**
 * Repository du profil utilisateur (une ligne par compte).
 *
 * Responsabilité unique : lire/écrire la table locale `profiles` de PowerSync et
 * assurer le mapping snake_case (base) ↔ camelCase (domaine Zod `@wellness/shared`).
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`).
 *  - Timestamps en UTC.
 *  - `user_id` = utilisateur de la session courante (posé à l'insertion).
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) :
 * en lecture, on peut donc se contenter de `WHERE deleted_at IS NULL LIMIT 1`
 * (pas besoin de filtrer sur `user_id`). En écriture, `user_id` reste obligatoire.
 */

import { useQuery } from '@powersync/react';
import {
  computeWeightGoalProgress,
  coerceWorkoutDisplayLevel,
  type ProfileRow,
  type WeightGoalProgress,
} from '@wellness/shared';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, nowUtc, patch } from './_sql';
import { getLatestWeightKg, useLatestWeight } from './bodyweight-repository';

/** Profil applicatif (forme camelCase du domaine partagé). */
export type Profile = ProfileRow;

/**
 * Champs applicatifs modifiables du profil (hors champs de synchro `id`, `userId`,
 * timestamps, gérés automatiquement par la couche `_sql`).
 */
export type ProfileInput = Pick<
  ProfileRow,
  | 'firstName'
  | 'birthDate'
  | 'sex'
  | 'heightCm'
  | 'weightKg'
  | 'targetWeightKg'
  | 'startWeightKg'
  | 'mainGoal'
  | 'workoutDisplayLevel'
  | 'summaryDisplayLevel'
  | 'dailyStepGoal'
  | 'mainGoalDeadline'
  | 'trainingFocus'
  | 'trainingLevel'
  | 'weeklyAvailability'
  | 'guidanceRegime'
  | 'guidanceStrength'
  | 'guidanceCardio'
  | 'guidanceNutrition'
  | 'onboardingCompletedAt'
  | 'activationPathDismissedAt'
>;

/** Ligne brute renvoyée par SQLite (colonnes snake_case). */
type ProfileDbRow = {
  id: string;
  user_id: string;
  first_name: string | null;
  birth_date: string | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  start_weight_kg: number | null;
  main_goal: string | null;
  workout_display_level: string | null;
  summary_display_level: string | null;
  daily_step_goal: number | null;
  main_goal_deadline: string | null;
  training_focus: string | null;
  training_level: string | null;
  weekly_availability: number | null;
  guidance_regime: string | null;
  guidance_strength: string | null;
  guidance_cardio: string | null;
  guidance_nutrition: string | null;
  onboarding_completed_at: string | null;
  activation_path_dismissed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const SELECT_CURRENT = 'SELECT * FROM profiles WHERE deleted_at IS NULL LIMIT 1';

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne SQLite (snake_case) → objet de domaine (camelCase). */
function rowToProfile(row: ProfileDbRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    birthDate: row.birth_date,
    sex: row.sex as Profile['sex'],
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    targetWeightKg: row.target_weight_kg,
    startWeightKg: row.start_weight_kg,
    mainGoal: row.main_goal as Profile['mainGoal'],
    workoutDisplayLevel: coerceWorkoutDisplayLevel(row.workout_display_level),
    // Décision D1 : « colonne dédiée, **initialisée sur la valeur du niveau de séance** ». La
    // migration pose `default 'normal'`, qui ne couvre que les lignes créées après elle : sans ce
    // repli, quelqu'un qui avait réglé sa séance en « Avancé » ouvrait son premier bilan en
    // « Intermédiaire ». `NULL` veut dire « jamais choisi », pas « normal ».
    summaryDisplayLevel: coerceWorkoutDisplayLevel(
      row.summary_display_level ?? row.workout_display_level,
    ),
    dailyStepGoal: row.daily_step_goal,
    // US GUID-01 — lues telles quelles : `null` veut dire « jamais répondu », et c'est une
    // information. Le repli est appliqué par `effectiveRegime()` / `pillarDefaults()`, jamais ici —
    // sinon l'interface ne pourrait plus distinguer un choix d'un défaut (leçon NUTRI-UX01 R1.3).
    mainGoalDeadline: row.main_goal_deadline,
    trainingFocus: row.training_focus as Profile['trainingFocus'],
    trainingLevel: row.training_level as Profile['trainingLevel'],
    weeklyAvailability: row.weekly_availability,
    guidanceRegime: row.guidance_regime as Profile['guidanceRegime'],
    guidanceStrength: row.guidance_strength as Profile['guidanceStrength'],
    guidanceCardio: row.guidance_cardio as Profile['guidanceCardio'],
    guidanceNutrition: row.guidance_nutrition as Profile['guidanceNutrition'],
    onboardingCompletedAt: row.onboarding_completed_at,
    activationPathDismissedAt: row.activation_path_dismissed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * **Interrupteur de sûreté — US GUID-01.**
 *
 * ✅ **Migration appliquée sur le cloud le 13/09/2026** (`npm run db:push`, colonnes confirmées
 * dans `database.types.ts` après `npm run db:types`). Le drapeau est donc à `true` et les 8
 * colonnes sont écrites normalement.
 *
 * ── Pourquoi ce drapeau, et pas un `try/catch` ──────────────────────────────────────────────────
 * Les 8 colonnes existent en base **locale** (déclarées dans `powersync/schema.ts`) mais pas encore
 * sur le cloud : `npm run db:push` est refusé tant que l'historique distant porte une migration
 * qu'aucun commit ne contient (voir `supabase/MIGRATIONS.md`).
 *
 * Sans ce garde-fou, la panne ne serait **pas** limitée à cette US. L'écriture locale réussit, donc
 * PowerSync met en file une opération `PATCH` portant `guidance_regime` & co ; PostgREST la rejette
 * (`column does not exist`) ; `connector.ts` relance l'erreur **sans compléter la transaction**,
 * qui reste en tête de file et se rejoue indéfiniment. Or la file est **sérialisée** : plus aucune
 * écriture ne remonte — séances, repas, poids, courses, toutes tables confondues. Un compte neuf
 * est pire encore (`PUT` avec les 8 colonnes dès le premier `upsertProfile`).
 *
 * Même garde-fou explicite que `ADAPTATION_WRITE_READY` (CARDIO-UX01), pour la même raison : le
 * coût d'un oubli est disproportionné, et il doit se voir dans le code, pas seulement dans un
 * fichier de suivi.
 *
 * ⚠️ Tant qu'il vaut `false`, les choix de guidage et de contexte **ne sont pas persistés** —
 * l'interface les propose, la base ne les garde pas. C'était volontaire : perdre un réglage est
 * réparable, figer la synchro de tout le monde ne l'est pas.
 *
 * Il reste comme **garde-fou documentaire** plutôt que d'être supprimé (même choix que
 * `ADAPTATION_WRITE_READY`) : il nomme la dépendance entre ce code et huit colonnes distantes, et
 * il donne un point de retour immédiat si la migration devait être annulée.
 */
export const GUIDANCE_WRITE_READY = true;

/** Les colonnes de GUID-01, retirées de l'écriture tant que `GUIDANCE_WRITE_READY` est `false`. */
const GUIDANCE_COLUMNS = [
  'main_goal_deadline',
  'training_focus',
  'training_level',
  'weekly_availability',
  'guidance_regime',
  'guidance_strength',
  'guidance_cardio',
  'guidance_nutrition',
] as const;

/** Convertit un patch de domaine (camelCase) → colonnes SQLite (snake_case). */
function inputToColumns(input: Partial<ProfileInput>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ('firstName' in input) columns['first_name'] = input.firstName;
  if ('birthDate' in input) columns['birth_date'] = input.birthDate;
  if ('sex' in input) columns['sex'] = input.sex;
  if ('heightCm' in input) columns['height_cm'] = input.heightCm;
  if ('weightKg' in input) columns['weight_kg'] = input.weightKg;
  if ('targetWeightKg' in input) columns['target_weight_kg'] = input.targetWeightKg;
  if ('startWeightKg' in input) columns['start_weight_kg'] = input.startWeightKg;
  if ('mainGoal' in input) columns['main_goal'] = input.mainGoal;
  if ('workoutDisplayLevel' in input) columns['workout_display_level'] = input.workoutDisplayLevel;
  if ('summaryDisplayLevel' in input) columns['summary_display_level'] = input.summaryDisplayLevel;
  if ('dailyStepGoal' in input) columns['daily_step_goal'] = input.dailyStepGoal;
  if ('mainGoalDeadline' in input) columns['main_goal_deadline'] = input.mainGoalDeadline;
  if ('trainingFocus' in input) columns['training_focus'] = input.trainingFocus;
  if ('trainingLevel' in input) columns['training_level'] = input.trainingLevel;
  if ('weeklyAvailability' in input) columns['weekly_availability'] = input.weeklyAvailability;
  if ('guidanceRegime' in input) columns['guidance_regime'] = input.guidanceRegime;
  if ('guidanceStrength' in input) columns['guidance_strength'] = input.guidanceStrength;
  if ('guidanceCardio' in input) columns['guidance_cardio'] = input.guidanceCardio;
  if ('guidanceNutrition' in input) columns['guidance_nutrition'] = input.guidanceNutrition;
  if ('onboardingCompletedAt' in input) {
    columns['onboarding_completed_at'] = input.onboardingCompletedAt;
  }
  if ('activationPathDismissedAt' in input) {
    columns['activation_path_dismissed_at'] = input.activationPathDismissedAt;
  }

  // Voir `GUIDANCE_WRITE_READY` : tant que la migration n'est pas sur le cloud, ces colonnes sont
  // retirées de l'écriture — un réglage perdu vaut mieux qu'une file de synchro figée pour TOUTES
  // les tables. On filtre la **sortie** et jamais `input`, qui appartient à l'appelant.
  if (!GUIDANCE_WRITE_READY) {
    for (const column of GUIDANCE_COLUMNS) delete columns[column];
  }

  return columns;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hook)
// ---------------------------------------------------------------------------

/**
 * Profil de l'utilisateur courant, réactif aux changements de la base locale.
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (SQLite),
 * jamais de la synchro réseau : le routage / contenu ne doit pas se bloquer sur
 * une synchro réseau (offline-first, ADR-001 / décision B). La base locale est
 * disponible hors-ligne ; `useQuery.isLoading` se résout sans réseau.
 *
 * Remplace le drapeau `hasHydrated` des ex-stores Zustand.
 */
export function useProfile(): { profile: Profile | null; isLoading: boolean } {
  const { data, isLoading: queryLoading } = useQuery<ProfileDbRow>(SELECT_CURRENT);

  const isLoading = queryLoading;
  const row = data[0];
  const profile = row ? rowToProfile(row) : null;

  return { profile, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error('Aucune session active : impossible d’écrire le profil.');
  }
  return userId;
}

/** Lit la ligne de profil courante (ou null) hors contexte réactif. */
async function getCurrentRow(): Promise<ProfileDbRow | null> {
  return powerSync.getOptional<ProfileDbRow>(SELECT_CURRENT);
}

/**
 * Crée ou met à jour le profil de l'utilisateur courant.
 * Met à jour la ligne existante si elle existe, sinon l'insère (avec `user_id`).
 */
export async function upsertProfile(patchInput: Partial<ProfileInput>): Promise<void> {
  const columns = inputToColumns(patchInput);
  const existing = await getCurrentRow();

  if (existing) {
    await patch('profiles', existing.id, columns);
    return;
  }

  await insertWithSyncFields('profiles', {
    user_id: currentUserId(),
    ...columns,
  });
}

/**
 * Marque l'onboarding comme terminé (`onboarding_completed_at = maintenant UTC`).
 * Crée la ligne de profil au besoin.
 */
export async function completeOnboarding(): Promise<void> {
  await upsertProfile({ onboardingCompletedAt: nowUtc() });
}

/**
 * Ferme explicitement le widget « Parcours 7 jours pour démarrer » (US ACTIV-01, bouton
 * « Passer »). Distinct de l'expiration naturelle au jour 7, qui n'écrit rien (calculée à la
 * lecture, voir `activationPathDayIndex`).
 */
export async function dismissActivationPath(): Promise<void> {
  await upsertProfile({ activationPathDismissedAt: nowUtc() });
}

/**
 * Définit / modifie / efface le poids cible. Fige le poids de départ (start_weight_kg)
 * sur le poids actuel quand la cible est créée ou modifiée (règle NUTR-11).
 */
export async function setWeightTarget(targetKg: number | null): Promise<void> {
  const existing = await getCurrentRow();
  const currentTarget = existing?.target_weight_kg ?? null;

  if (targetKg == null) {
    await upsertProfile({ targetWeightKg: null, startWeightKg: null });
    return;
  }
  if (targetKg === currentTarget) return; // inchangé → ne pas ré-ancrer le départ

  const startKg = (await getLatestWeightKg()) ?? existing?.weight_kg ?? null;
  await upsertProfile({ targetWeightKg: targetKg, startWeightKg: startKg });
}

// ---------------------------------------------------------------------------
// Progression vers l'objectif de poids (NUTR-11)
// ---------------------------------------------------------------------------

/** Progression vers l'objectif de poids, dérivée du profil + de la dernière pesée. */
export function useWeightGoalProgress(): {
  progress: WeightGoalProgress | null;
  hasTarget: boolean;
  isLoading: boolean;
} {
  const { profile, isLoading: pLoading } = useProfile();
  const { latest, isLoading: wLoading } = useLatestWeight();

  const currentKg = latest?.weightKg ?? profile?.weightKg ?? null;
  const progress = computeWeightGoalProgress({
    startKg: profile?.startWeightKg ?? null,
    targetKg: profile?.targetWeightKg ?? null,
    currentKg,
  });

  return { progress, hasTarget: profile?.targetWeightKg != null, isLoading: pLoading || wLoading };
}
