/**
 * US MUSCU-UX05 — les données des **cartes neuves du hub Musculation**.
 *
 * Trois lectures qui n'existaient nulle part, parce que le hub n'avait jamais eu à les poser :
 *
 *  1. `useLoadProgress`  → « Tes charges », la carte dominante (brique `load-progress.ts`).
 *  2. `useRecentRecords` → « Le mur » : les records **tombés**. Le hub ne montrait que ceux
 *     à venir (`useNearRecords`) — on affichait la carotte, jamais le trophée.
 *  3. `useStrengthThread` → « Le fil du jour », la seule ligne de l'écran qui change tous les jours.
 *
 * ── Pourquoi le fil ne réutilise PAS `useInsights()` ─────────────────────────────────────────────
 * L'accueil agrège huit hooks pour nourrir `selectInsights`, et `insights-context.tsx` documente
 * pourquoi il diffuse ce calcul au lieu de le refaire : le remonter sur un second écran doublerait
 * l'union. Or `selectInsights` ne calcule rien — il **filtre, classe et plafonne** des candidats que
 * l'appelant lui remet. Le hub muscu lui remet donc les siens, bâtis sur ce qu'il monte déjà
 * (équilibre musculaire, favoris délaissés, records récents). Même moteur de classement, sans le
 * coût de l'agrégateur.
 */

import { useQuery } from '@powersync/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_INSIGHTS,
  computeLoadProgress,
  candidateFromMuscleBalance,
  candidateFromNeglectedExercise,
  candidateFromRecentRecord,
  emptySbdLifts,
  localDayKey,
  resolveLoadCardMode,
  selectInsights,
  type InsightCandidate,
  type LoadCardMode,
  type LoadProgress,
  type LoadSet,
  type SelectedInsight,
} from '@wellness/shared';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useSettings } from './settings-repository';
import { useMuscleBalance, useNeglectedFavorites } from './records-repository';

// ---------------------------------------------------------------------------
// « Tes charges »
// ---------------------------------------------------------------------------

/**
 * Fenêtre de lecture. Il en faut **strictement plus** que la fenêtre de comparaison (30 j) : sans
 * l'historique d'avant, aucun exercice n'aurait de référence et la carte serait vide pour tout le
 * monde. 120 jours donnent trois mois de recul sans charger l'app entière.
 */
const LOAD_LOOKBACK_DAYS = 120;

/**
 * Les séries chargées des N derniers jours, nom d'exercice résolu.
 *
 * Le filtrage des répétitions (3-10) n'est **pas** ici : il vit dans `computeLoadProgress`, pour
 * qu'aucun appelant ne puisse l'oublier. Ici on écarte seulement ce qui n'est pas une série de
 * travail — échauffements et séries au temps n'ont pas de 1RM.
 */
const SELECT_LOAD_SETS = `
  SELECT s.exercise_id,
         COALESCE(tl.name, tfr.name) AS exercise_name,
         w.finished_at,
         s.reps,
         s.weight_kg
  FROM workout_sets s
  JOIN workouts w ON w.id = s.workout_id
    AND w.status = 'completed' AND w.deleted_at IS NULL AND w.finished_at IS NOT NULL
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = s.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = s.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE s.deleted_at IS NULL
    AND s.done = 1
    AND s.set_type NOT IN ('warmup', 'duration')
    AND s.reps IS NOT NULL
    AND s.weight_kg IS NOT NULL
    AND w.finished_at >= ?
  ORDER BY w.finished_at
`;

type LoadSetDbRow = {
  exercise_id: string;
  exercise_name: string | null;
  finished_at: string;
  reps: number | null;
  weight_kg: number | null;
};

/**
 * L'état de la carte « Tes charges », plus le visage à rendre.
 *
 * `mode` vient du réglage de la carte ; `auto` (le défaut) laisse la pratique décider — voir
 * `resolveLoadCardMode`.
 */
export function useLoadProgress(mode: LoadCardMode = 'auto'): {
  progress: LoadProgress;
  /** `strength` uniquement si les trois mouvements sont désignés ET pratiqués. */
  face: 'loads' | 'strength';
  isLoading: boolean;
} {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const todayKey = useTodayKey();
  const { settings, isLoading: settingsLoading } = useSettings();

  const sinceUtc = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - LOAD_LOOKBACK_DAYS);
    return d.toISOString();
  }, []);

  const { data, isLoading } = useQuery<LoadSetDbRow>(SELECT_LOAD_SETS, [lang, sinceUtc]);

  const sets: LoadSet[] = useMemo(
    () =>
      data.map((row) => ({
        exerciseId: row.exercise_id,
        // Un exercice sans traduction garde son id : laid mais honnête, et c'est un défaut de
        // contenu, pas de calcul (même parti pris que `useNeglectedFavorites`).
        exerciseName: row.exercise_name ?? row.exercise_id,
        day: localDayKey(new Date(row.finished_at)),
        reps: row.reps,
        weightKg: row.weight_kg,
      })),
    [data],
  );

  const designated = settings?.sbdLifts ?? emptySbdLifts();

  return {
    progress: useMemo(() => computeLoadProgress({ sets, todayKey }), [sets, todayKey]),
    face: useMemo(
      () => resolveLoadCardMode({ mode, sets, designated }),
      [mode, sets, designated],
    ),
    isLoading: isLoading || settingsLoading,
  };
}

// ---------------------------------------------------------------------------
// « Le mur » — les records tombés
// ---------------------------------------------------------------------------

export type WallRecord = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  type: 'max_weight' | 'estimated_1rm' | 'best_volume';
  value: number;
  /** Valeur précédente, quand il y en avait une — c'est elle qui donne le « +5 kg ». */
  previous: number | null;
  achievedOn: string;
};

/**
 * Les derniers records, le plus récent d'abord.
 *
 * ⚠️ `max_weight` seulement. Les trois types coexistent dans `personal_records`, et une même série
 * en produit souvent deux (charge **et** 1RM estimé) : les mélanger remplirait le mur de doublons
 * qui ne célèbrent qu'une seule performance.
 */
const SELECT_WALL_RECORDS = `
  SELECT r.id, r.exercise_id, r.type, r.value, r.achieved_at,
         COALESCE(tl.name, tfr.name) AS exercise_name,
         (SELECT MAX(p.value) FROM personal_records p
           WHERE p.exercise_id = r.exercise_id AND p.type = r.type
             AND p.achieved_at < r.achieved_at AND p.deleted_at IS NULL) AS previous
  FROM personal_records r
  LEFT JOIN exercise_translations tl  ON tl.exercise_id = r.exercise_id AND tl.lang = ?      AND tl.deleted_at IS NULL
  LEFT JOIN exercise_translations tfr ON tfr.exercise_id = r.exercise_id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
  WHERE r.deleted_at IS NULL AND r.type = 'max_weight'
  ORDER BY r.achieved_at DESC
  LIMIT ?
`;

type WallDbRow = {
  id: string;
  exercise_id: string;
  exercise_name: string | null;
  type: string;
  value: number;
  previous: number | null;
  achieved_at: string;
};

export function useRecentRecords(limit = 6): { records: WallRecord[]; isLoading: boolean } {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const { data, isLoading } = useQuery<WallDbRow>(SELECT_WALL_RECORDS, [lang, limit]);

  const records = useMemo(
    () =>
      data.map((row) => ({
        id: row.id,
        exerciseId: row.exercise_id,
        exerciseName: row.exercise_name ?? row.exercise_id,
        type: row.type as WallRecord['type'],
        value: row.value,
        previous: row.previous,
        achievedOn: localDayKey(new Date(row.achieved_at)),
      })),
    [data],
  );

  return { records, isLoading };
}

// ---------------------------------------------------------------------------
// « Le fil du jour »
// ---------------------------------------------------------------------------

/**
 * Le fil retient **un** insight, pas trois : c'est une bande d'une ligne, pas une pile de cartes.
 * `selectInsights` en rend jusqu'à `MAX_INSIGHTS` ; on prend la tête de son classement.
 */
export function useStrengthThread(): { thread: SelectedInsight | null; isLoading: boolean } {
  const todayKey = useTodayKey();
  const { balance, isLoading: balanceLoading } = useMuscleBalance();
  const { neglected, isLoading: neglectedLoading } = useNeglectedFavorites();
  const { records, isLoading: recordsLoading } = useRecentRecords(1);

  // Les candidats passent par les MÊMES adaptateurs que l'accueil : les règles (quels chiffres,
  // quelle date, quel pilier) vivent dans `shared`, pas ici. Un candidat bâti à la main dans un
  // repository serait un second jeu de règles à maintenir — et à faire diverger.
  const candidates: InsightCandidate[] = useMemo(() => {
    const out: InsightCandidate[] = [];
    const imbalance = candidateFromMuscleBalance(balance);
    if (imbalance) out.push(imbalance);
    const forgotten = candidateFromNeglectedExercise(neglected);
    if (forgotten) out.push(forgotten);
    const record = candidateFromRecentRecord(
      records.map((r) => ({
        type: r.type,
        value: r.value,
        exerciseName: r.exerciseName,
        achievedOn: r.achievedOn,
      })),
    );
    if (record) out.push(record);
    return out;
  }, [balance, neglected, records]);

  const thread = useMemo(() => {
    const selected = selectInsights({
      candidates,
      activePillars: ['strength'],
      todayKey,
    });
    return selected[0] ?? null;
  }, [candidates, todayKey]);

  return {
    thread,
    isLoading: balanceLoading || neglectedLoading || recordsLoading,
  };
}

/** Exposé pour le test de plafond : le fil ne montre jamais plus d'une ligne. */
export const STRENGTH_THREAD_MAX = Math.min(1, MAX_INSIGHTS);
