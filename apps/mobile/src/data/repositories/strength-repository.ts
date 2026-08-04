/**
 * Repository du **module force** (US MUSCPWR-01, catalogue MUSC-16 / MUSC-27 / MUSC-29).
 *
 * ⚠️ **Aucune analyse n'est stockée.** Le %1RM, le DOTS, le total SBD et sa projection sont
 * **entièrement dérivés** de `personal_records`, `body_weight_entries` et `profiles`. Ce fichier ne
 * fait que rassembler la matière ; le calcul vit dans `@wellness/shared`. Conséquence voulue :
 * corriger une série passée corrige immédiatement les trois analyses, sans recalcul différé (R13).
 *
 * La seule écriture de l'US est la **désignation des trois mouvements** (`user_settings.sbd_lifts`),
 * qui sert aussi d'opt-in au module (décision D3).
 *
 * Réf. : docs/specs/functional/us/muscpwr01-module-force.md
 */

import { useQuery } from '@powersync/react';
import {
  bodyweightNearest,
  emptySbdLifts,
  SBD_LIFTS,
  sbdHistory,
  sessionRelativeIntensity,
  sbdTotal,
  type BodyweightEntry,
  type DatedOneRm,
  type DotsSex,
  type SbdHistoryPoint,
  type SbdLift,
  type SbdLifts,
  type SbdTotalResult,
} from '@wellness/shared';
import { useAuthStore } from '@/stores/auth-store';
import { useProfile } from './profile-repository';
import { updateSettings, useSettings } from './settings-repository';

/** Un mouvement désigné, prêt pour l'écran : libellé résolu et drapeau d'archivage. */
export type DesignatedLift = {
  lift: SbdLift;
  exerciseId: string | null;
  /** Libellé FR résolu, ou `null` si non désigné. */
  name: string | null;
  /**
   * `true` si l'exercice désigné a été archivé depuis (règle R12) : le mouvement est **signalé**,
   * pas silencieusement retiré — sinon le total baisserait sans explication.
   */
  archived: boolean;
};

/** Tout ce dont la section « Force » a besoin, en une seule passe. */
export type StrengthSectionData = {
  lifts: DesignatedLift[];
  /** 1RM estimé par mouvement (`null` = non désigné ou aucun record). */
  oneRmByLift: Record<SbdLift, number | null>;
  total: SbdTotalResult;
  history: SbdHistoryPoint[];
  /** Poids de corps retenu pour le DOTS et sa date (règle R7), ou `null`. */
  bodyweight: BodyweightEntry | null;
  sex: DotsSex;
  isLoading: boolean;
};

// ---------------------------------------------------------------------------
// Requêtes
// ---------------------------------------------------------------------------

/** Records de 1RM estimé, tous exercices — la matière du total et de son historique. */
export const SELECT_ESTIMATED_1RM = `
  SELECT exercise_id, type, value, achieved_at
  FROM personal_records
  WHERE user_id = ? AND type = 'estimated_1rm' AND deleted_at IS NULL
  ORDER BY achieved_at
`;

/** Toutes les pesées, du plus ancien au plus récent (`bodyweightNearest` départage par ordre). */
export const SELECT_BODYWEIGHTS = `
  SELECT log_date, weight_kg
  FROM body_weight_entries
  WHERE user_id = ? AND deleted_at IS NULL
  ORDER BY log_date
`;

/**
 * Libellés des exercices désignés.
 *
 * ⚠️ **Sans filtre `deleted_at`**, volontairement : un exercice archivé doit continuer à résoudre
 * son nom pour être signalé « à re-désigner » (règle R12). Même choix que l'historique muscu depuis
 * ADMIN-01 — sinon le mouvement disparaîtrait de l'écran, et le total baisserait sans raison visible.
 */
export const SELECT_DESIGNATED_EXERCISES = `
  SELECT e.id, e.deleted_at, COALESCE(tl.name, tfr.name) AS name
  FROM exercises e
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = e.id AND tl.lang = ?
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = e.id AND tfr.lang = 'fr'
  WHERE e.id IN (?, ?, ?)
`;

type RecordRow = { exercise_id: string; type: string; value: number; achieved_at: string };
type WeightRow = { log_date: string; weight_kg: number };
type ExerciseRow = { id: string; deleted_at: string | null; name: string | null };

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/**
 * Rassemble la matière des trois analyses.
 *
 * **Un seul hook** plutôt qu'un par analyse : l'écran Progression est déjà chargé, et trois hooks
 * multiplieraient les requêtes PowerSync et les rendus pour des données qui s'affichent ensemble.
 */
export function useStrengthSection(lang = 'fr'): StrengthSectionData {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');
  const { settings, isLoading: settingsLoading } = useSettings();
  const { profile, isLoading: profileLoading } = useProfile();

  const sbdLifts: SbdLifts = settings?.sbdLifts ?? emptySbdLifts();

  const { data: recordRows, isLoading: recordsLoading } = useQuery<RecordRow>(
    SELECT_ESTIMATED_1RM,
    [userId],
  );
  const { data: weightRows, isLoading: weightsLoading } = useQuery<WeightRow>(SELECT_BODYWEIGHTS, [
    userId,
  ]);
  // Les trois paramètres sont toujours fournis (chaîne vide si non désigné) : un nombre de
  // paramètres variable casserait la préparation de la requête.
  const { data: exerciseRows, isLoading: exercisesLoading } = useQuery<ExerciseRow>(
    SELECT_DESIGNATED_EXERCISES,
    [lang, sbdLifts.squat ?? '', sbdLifts.bench ?? '', sbdLifts.deadlift ?? ''],
  );

  const records: DatedOneRm[] = recordRows.map((r) => ({
    exerciseId: r.exercise_id,
    type: r.type,
    value: r.value,
    achievedAt: r.achieved_at,
  }));
  const weights: BodyweightEntry[] = weightRows.map((w) => ({
    logDate: w.log_date,
    weightKg: w.weight_kg,
  }));
  const exerciseById = new Map(exerciseRows.map((e) => [e.id, e]));

  // Meilleur 1RM par mouvement — le plus ÉLEVÉ, pas le plus récent (règle R1).
  const oneRmByLift = Object.fromEntries(
    SBD_LIFTS.map((lift) => {
      const exerciseId = sbdLifts[lift];
      if (!exerciseId) return [lift, null];
      const best = records
        .filter((r) => r.exerciseId === exerciseId && r.value > 0)
        .reduce<number | null>((max, r) => (max === null || r.value > max ? r.value : max), null);
      return [lift, best];
    }),
  ) as Record<SbdLift, number | null>;

  const lifts: DesignatedLift[] = SBD_LIFTS.map((lift) => {
    const exerciseId = sbdLifts[lift];
    const row = exerciseId ? exerciseById.get(exerciseId) : undefined;
    return {
      lift,
      exerciseId: exerciseId ?? null,
      name: row?.name ?? null,
      archived: row?.deleted_at != null,
    };
  });

  const total = sbdTotal(oneRmByLift);
  const history = sbdHistory(records, sbdLifts);

  // Poids retenu pour le DOTS : celui le plus proche du **dernier total connu** (R7), pas le poids
  // du jour — c'est l'écart entre les deux que le score sert justement à neutraliser.
  const referenceDate = history.at(-1)?.date ?? null;
  const bodyweight = referenceDate ? bodyweightNearest(weights, referenceDate) : null;

  return {
    lifts,
    oneRmByLift,
    total,
    history,
    bodyweight,
    sex: (profile?.sex ?? 'unspecified') as DotsSex,
    isLoading:
      settingsLoading || profileLoading || recordsLoading || weightsLoading || exercisesLoading,
  };
}

// ---------------------------------------------------------------------------
// Écriture — la seule de l'US
// ---------------------------------------------------------------------------

/**
 * Désigne (ou retire, avec `null`) l'exercice d'un mouvement.
 *
 * Écrit l'objet complet et non un champ : `sbd_lifts` est une colonne JSON, et un patch partiel
 * écraserait les deux autres mouvements.
 */
export async function setSbdLift(
  lift: SbdLift,
  exerciseId: string | null,
  current: SbdLifts,
): Promise<void> {
  await updateSettings({ sbdLifts: { ...current, [lift]: exerciseId } });
}

// ---------------------------------------------------------------------------
// Intensité relative d'un exercice (catalogue MUSC-16)
// ---------------------------------------------------------------------------

/** Séries de la dernière séance ayant travaillé l'exercice, hors échauffement. */
export const SELECT_LAST_SESSION_SETS = `
  SELECT ws.reps, ws.weight_kg, ws.set_type
  FROM workout_sets ws
  WHERE ws.exercise_id = ? AND ws.user_id = ? AND ws.deleted_at IS NULL
    AND ws.workout_id = (
      SELECT w.id FROM workouts w
      JOIN workout_sets s ON s.workout_id = w.id AND s.exercise_id = ? AND s.deleted_at IS NULL
      WHERE w.user_id = ? AND w.status = 'finished' AND w.deleted_at IS NULL
      ORDER BY COALESCE(w.finished_at, w.started_at) DESC
      LIMIT 1
    )
  ORDER BY ws.order_index
`;

/** 1RM estimé le plus élevé pour un exercice — le meilleur connu, pas le dernier (règle R1). */
export const SELECT_BEST_1RM_FOR_EXERCISE = `
  SELECT MAX(value) AS best
  FROM personal_records
  WHERE user_id = ? AND exercise_id = ? AND type = 'estimated_1rm' AND deleted_at IS NULL
`;

export type ExerciseIntensity = {
  /** Meilleur 1RM estimé connu, ou `null` → aucune intensité relative affichable (R2). */
  oneRmKg: number | null;
  lastSession: {
    averagePercent: number;
    sets: { reps: number | null; weightKg: number | null; setType: string }[];
  } | null;
  isLoading: boolean;
};

/**
 * Intensité relative de la **dernière séance** ayant travaillé cet exercice (catalogue MUSC-16).
 *
 * Rend `oneRmKg: null` s'il n'existe aucun 1RM : pas d'estimation de secours à partir d'une série
 * isolée (règle R2). `lastSession` est `null` si aucune série ne qualifie — les échauffements sont
 * exclus (R5), donc une séance qui n'en contenait que ne produit rien plutôt que 0 %.
 */
export function useExerciseRelativeIntensity(exerciseId: string): ExerciseIntensity {
  const userId = useAuthStore((s) => s.session?.user.id ?? '');

  const { data: bestRows, isLoading: bestLoading } = useQuery<{ best: number | null }>(
    SELECT_BEST_1RM_FOR_EXERCISE,
    [userId, exerciseId],
  );
  const { data: setRows, isLoading: setsLoading } = useQuery<{
    reps: number | null;
    weight_kg: number | null;
    set_type: string;
  }>(SELECT_LAST_SESSION_SETS, [exerciseId, userId, exerciseId, userId]);

  const oneRmKg = bestRows[0]?.best ?? null;
  const sets = setRows.map((r) => ({
    reps: r.reps,
    weightKg: r.weight_kg,
    setType: r.set_type,
  }));

  const averagePercent = sessionRelativeIntensity(sets, oneRmKg);

  return {
    oneRmKg,
    lastSession:
      averagePercent === null
        ? null
        : { averagePercent, sets: sets.filter((s) => s.setType !== 'warmup') },
    isLoading: bestLoading || setsLoading,
  };
}
