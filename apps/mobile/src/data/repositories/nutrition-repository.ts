/**
 * Repository du profil nutritionnel (une ligne par compte — pilier Alimentation).
 *
 * Responsabilité unique : lire/écrire la table locale `nutrition_profiles` de PowerSync
 * et assurer le mapping snake_case (base) ↔ camelCase (domaine Zod `@wellness/shared`).
 *
 * Colonnes JSON (`restrictions`, `allergens`) stockées en TEXT côté SQLite
 * (déclaration PowerSync `column.text`), sérialisées / désérialisées explicitement ici.
 *
 * Règles offline-first (voir docs/specs/technical/offline-sync.md) :
 *  - UUID généré côté client (via `insertWithSyncFields`).
 *  - Timestamps en UTC.
 *  - `user_id` = utilisateur de la session courante (posé à l'insertion).
 *
 * PowerSync ne réplique que les lignes de l'utilisateur courant (bucket par JWT) :
 * en lecture, `WHERE deleted_at IS NULL LIMIT 1` suffit.
 */

import { useQuery } from '@powersync/react';
import type {
  CarbLoadLevel,
  CarbsPerKg,
  DietRestriction,
  MealConfigItem,
  NutritionObjective,
  NutritionProfileRow,
  ProteinPerKg,
  RunningDayKind,
  TrainingBonusMode,
} from '@wellness/shared';
import {
  averageIntake,
  classifyRunningDay,
  computeCarbLoadLevel,
  computeCarbsPerKg,
  computeProteinPerKg,
  localDayKey,
  objectiveFromGoal,
  parseJsonColumn,
  resolveActivePillars,
  weeklyEquivalentHours,
} from '@wellness/shared';
import { useTodayKey, useWindowStartKey } from '@/hooks/useTodayKey';
import { powerSync } from '@/powersync/system';
import { useAuthStore } from '@/stores/auth-store';
import { insertWithSyncFields, patch } from './_sql';
import { useLatestWeight } from './bodyweight-repository';
import { useDailyTotals } from './journal-repository';
import { useProfile } from './profile-repository';
import { useRunHistory } from './run-repository';
import { useSettings } from './settings-repository';

/** Profil nutritionnel applicatif (forme camelCase du domaine partagé). */
export type NutritionProfile = NutritionProfileRow;

/**
 * Champs applicatifs modifiables (hors champs de synchro `id`, `userId`,
 * timestamps, gérés automatiquement par la couche `_sql`).
 */
export type NutritionProfileInput = Pick<
  NutritionProfileRow,
  | 'objective'
  | 'activityLevel'
  | 'manualCalories'
  | 'manualProteinG'
  | 'manualCarbsG'
  | 'manualFatG'
  | 'restrictions'
  | 'allergens'
  | 'trainingDayBonus'
  | 'trainingBonusMode'
  | 'adherenceMarginPct'
  | 'meals'
>;

/** Ligne brute renvoyée par SQLite (colonnes snake_case). */
type NutritionDbRow = {
  id: string;
  user_id: string;
  objective: string | null;
  activity_level: string;
  manual_calories: number | null;
  manual_protein_g: number | null;
  manual_carbs_g: number | null;
  manual_fat_g: number | null;
  restrictions: string | null;
  allergens: string | null;
  training_day_bonus: number | null;
  training_bonus_mode: string | null;
  adherence_margin_pct: number | null;
  meals: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const SELECT_CURRENT =
  'SELECT * FROM nutrition_profiles WHERE deleted_at IS NULL LIMIT 1';

// ---------------------------------------------------------------------------
// Mapping snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** Convertit une ligne SQLite (snake_case) → objet de domaine (camelCase). */
function rowToNutritionProfile(row: NutritionDbRow): NutritionProfile {
  return {
    id: row.id,
    userId: row.user_id,
    objective: row.objective as NutritionProfile['objective'],
    activityLevel: row.activity_level as NutritionProfile['activityLevel'],
    manualCalories: row.manual_calories,
    manualProteinG: row.manual_protein_g,
    manualCarbsG: row.manual_carbs_g,
    manualFatG: row.manual_fat_g,
    restrictions: parseJsonColumn<DietRestriction[]>(row.restrictions, []),
    allergens: parseJsonColumn<string[]>(row.allergens, []),
    trainingDayBonus: row.training_day_bonus ?? 0,
    trainingBonusMode: (row.training_bonus_mode as TrainingBonusMode | null) ?? 'fixed',
    adherenceMarginPct: row.adherence_margin_pct ?? 10,
    meals: parseJsonColumn<MealConfigItem[] | null>(row.meals, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** Convertit un patch de domaine (camelCase) → colonnes SQLite (snake_case). */
function inputToColumns(input: Partial<NutritionProfileInput>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ('objective' in input) columns['objective'] = input.objective;
  if ('activityLevel' in input) columns['activity_level'] = input.activityLevel;
  if ('manualCalories' in input) columns['manual_calories'] = input.manualCalories;
  if ('manualProteinG' in input) columns['manual_protein_g'] = input.manualProteinG;
  if ('manualCarbsG' in input) columns['manual_carbs_g'] = input.manualCarbsG;
  if ('manualFatG' in input) columns['manual_fat_g'] = input.manualFatG;
  if ('restrictions' in input) columns['restrictions'] = JSON.stringify(input.restrictions ?? []);
  if ('allergens' in input) columns['allergens'] = JSON.stringify(input.allergens ?? []);
  if ('trainingDayBonus' in input) columns['training_day_bonus'] = input.trainingDayBonus;
  if ('trainingBonusMode' in input) columns['training_bonus_mode'] = input.trainingBonusMode;
  if ('adherenceMarginPct' in input) columns['adherence_margin_pct'] = input.adherenceMarginPct;
  if ('meals' in input) columns['meals'] = input.meals ? JSON.stringify(input.meals) : null;
  return columns;
}

// ---------------------------------------------------------------------------
// Lecture réactive (hook)
// ---------------------------------------------------------------------------

/**
 * Profil nutritionnel de l'utilisateur courant, réactif aux changements de la base locale.
 *
 * `isLoading` ne dépend QUE de la résolution de la requête locale (SQLite), jamais de la
 * synchro réseau (offline-first, ADR-001 / décision B). Peut être `null` tant qu'aucun
 * profil nutritionnel n'a été créé : le consommateur applique alors les valeurs par défaut.
 */
export function useNutritionProfile(): {
  nutritionProfile: NutritionProfile | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<NutritionDbRow>(SELECT_CURRENT);
  const row = data[0];
  const nutritionProfile = row ? rowToNutritionProfile(row) : null;
  return { nutritionProfile, isLoading };
}

// ---------------------------------------------------------------------------
// Écritures (hors contexte hook)
// ---------------------------------------------------------------------------

/** Identifiant de l'utilisateur de la session courante (lève si déconnecté). */
function currentUserId(): string {
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) {
    throw new Error('Aucune session active : impossible d’écrire le profil nutritionnel.');
  }
  return userId;
}

/** Lit la ligne courante (ou null) hors contexte réactif. */
async function getCurrentRow(): Promise<NutritionDbRow | null> {
  return powerSync.getOptional<NutritionDbRow>(SELECT_CURRENT);
}

/**
 * Crée ou met à jour le profil nutritionnel de l'utilisateur courant.
 * Patch la ligne existante si elle existe, sinon l'insère (avec `user_id`).
 */
export async function upsertNutritionProfile(
  patchInput: Partial<NutritionProfileInput>,
): Promise<void> {
  const columns = inputToColumns(patchInput);
  const existing = await getCurrentRow();

  if (existing) {
    await patch('nutrition_profiles', existing.id, columns);
    return;
  }

  await insertWithSyncFields('nutrition_profiles', {
    user_id: currentUserId(),
    ...columns,
  });
}

// ---------------------------------------------------------------------------
// Ratio protéines/kg vs cible objectif (MN-06)
// ---------------------------------------------------------------------------

export type ProteinWindow = '7d' | '30d';
const WINDOW_DAYS: Record<ProteinWindow, number> = { '7d': 7, '30d': 30 };

/** Borne basse `AAAA-MM-JJ` local d'il y a `n` jours (pour useDailyTotals). */
function proteinSinceDayKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDayKey(d);
}

/**
 * Apport protéique g/kg (moyenne sur la fenêtre) vs cible de l'objectif (MN-06), réactif, lecture seule.
 * Tous les hooks appelés inconditionnellement. `hasWeight` distingue « pas de pesée » de « pas de repas » ;
 * `objective` sert au libellé de la cible côté composant.
 */
export function useProteinPerKg(window: ProteinWindow): {
  result: ProteinPerKg | null;
  objective: NutritionObjective;
  hasWeight: boolean;
  isLoading: boolean;
} {
  const { totals, isLoading: tLoading } = useDailyTotals(proteinSinceDayKey(WINDOW_DAYS[window]));
  const { latest, isLoading: wLoading } = useLatestWeight();
  const { profile, isLoading: pLoading } = useProfile();
  const { nutritionProfile, isLoading: nLoading } = useNutritionProfile();

  const weightKg = latest?.weightKg ?? profile?.weightKg ?? null;
  const objective = nutritionProfile?.objective ?? objectiveFromGoal(profile?.mainGoal ?? null);
  const avgProteinG = totals.length > 0 ? averageIntake(totals).proteinG : null;

  const result = computeProteinPerKg({ avgProteinG, weightKg, objective });
  const isLoading = tLoading || wLoading || pLoading || nLoading;

  return { result, objective, hasWeight: weightKg != null, isLoading };
}

// ---------------------------------------------------------------------------
// Socle glucidique du coureur (FUEL-01, catalogue RN-05 + RN-06)
// ---------------------------------------------------------------------------

/**
 * Types des séances de course **planifiées du jour**, pour classer la journée (RN-06).
 *
 * `status <> 'skipped'` : une séance sautée n'est pas la nature de la journée, mais une séance déjà
 * `done` l'est toujours. Pas de `LIMIT` — deux séances le même jour existent (badge MR-01), et R5
 * veut que la plus exigeante gagne.
 *
 * ⚠️ **La requête vit ici et pas dans `run-repository.ts`, volontairement** : ce fichier-là est lu
 * par RUN-F2b, RUN-F2c, RUN-F2d et RUN-F3, **toutes en recette**. Y ajouter une requête pour une
 * autre US élargirait la surface de régression de quatre recettes en attente, pour aucun gain.
 */
export const SELECT_TODAY_RUN_SESSION_TYPES = `
  SELECT s.session_type
  FROM planned_sessions ps
  JOIN sessions s ON s.id = ps.session_id AND s.deleted_at IS NULL
  JOIN programs  p ON p.id = ps.program_id AND p.deleted_at IS NULL
  WHERE ps.owner_id = ? AND ps.deleted_at IS NULL AND p.pillar = 'running'
    AND ps.status <> 'skipped' AND ps.scheduled_date = ?
`;

/**
 * Apport glucidique en g/kg vs la fourchette de référence du volume de course (FUEL-01).
 *
 * 🔴 **Strictement descriptif** (spec R1, décision D1) : ne touche ni `trainingDayMacroGrams` ni
 * aucune cible affichée. La cible du journal reste celle de MN-04, pilotée par les calories.
 *
 * Fenêtre : la **même** que celle des protéines (7 j / 30 j, choisie dans la carte), avec la charge
 * de course normalisée en **équivalent hebdomadaire** (R6 bis) — sans quoi 30 jours de cumul
 * comparés à des seuils hebdomadaires classeraient presque tout en « gros volume ».
 *
 * Tous les hooks sont appelés **inconditionnellement** (règle des hooks React) ; le gating à 2
 * piliers (décision H, via `resolveActivePillars`) n'intervient qu'au retour.
 */
export function useCarbsPerKg(window: ProteinWindow): {
  result: CarbsPerKg | null;
  level: CarbLoadLevel | null;
  dayKind: RunningDayKind;
  hasWeight: boolean;
  isLoading: boolean;
} {
  const windowDays = WINDOW_DAYS[window];
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const todayKey = useTodayKey();
  const windowStartKey = useWindowStartKey(windowDays);

  const { settings, isLoading: sLoading } = useSettings();
  const { totals, isLoading: tLoading } = useDailyTotals(proteinSinceDayKey(windowDays));
  const { latest, isLoading: wLoading } = useLatestWeight();
  const { profile, isLoading: pLoading } = useProfile();
  const { runs, isLoading: rLoading } = useRunHistory();
  const { data: typeRows, isLoading: dLoading } = useQuery<{ session_type: string | null }>(
    SELECT_TODAY_RUN_SESSION_TYPES,
    [userId, todayKey],
  );

  const isLoading = sLoading || tLoading || wLoading || pLoading || rLoading || dLoading;

  const activePillars = resolveActivePillars(settings?.activePillars);
  const gated = !(activePillars.includes('running') && activePillars.includes('nutrition'));

  // Durée de course de la fenêtre. `finished_at` est un instant UTC : on le ramène en jour LOCAL
  // avant de comparer, comme le fait `useOvertrainingGuardAlert`. Une durée `null` contribue zéro
  // sans retirer la course du décompte (même règle que le RPE absent dans `sessionLoad`).
  const totalDurationSeconds = runs.reduce((sum, r) => {
    if (r.finishedAt == null) return sum;
    const dayKey = localDayKey(new Date(r.finishedAt));
    if (dayKey < windowStartKey || dayKey > todayKey) return sum;
    return sum + (r.durationSeconds ?? 0);
  }, 0);

  const weightKg = latest?.weightKg ?? profile?.weightKg ?? null;
  const avgCarbsG = totals.length > 0 ? averageIntake(totals).carbsG : null;
  const level = computeCarbLoadLevel(weeklyEquivalentHours(totalDurationSeconds, windowDays));
  // `course_libre` n'a pas de `session_type` en base : un `null` est un type inconnu, pas un type
  // absent — `classifyRunningDay` doit le voir pour renvoyer `unavailable` (décision D4).
  const dayKind = classifyRunningDay(typeRows.map((r) => r.session_type ?? 'course_libre'));

  if (gated || level == null) {
    return { result: null, level: null, dayKind: 'rest', hasWeight: weightKg != null, isLoading };
  }

  return {
    result: computeCarbsPerKg({ avgCarbsG, weightKg, level }),
    level,
    dayKind,
    hasWeight: weightKg != null,
    isLoading,
  };
}
