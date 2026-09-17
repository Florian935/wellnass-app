/**
 * US IA-LAB-01 — assemble l'instantané (`AiSnapshot`) envoyé au modèle.
 *
 * ⚠️ **Ce fichier ne contient que du câblage SQL**, comme `insights-repository`. La forme de ce qui
 * part, et la règle de minimisation qui la justifie, vivent dans `@wellness/shared/ai-context`, où
 * elles sont testées sans React ni base — y compris le **test-garde de liste blanche** qui échoue
 * dès qu'on ajoute un champ à l'instantané.
 *
 * ⚠️ **Rien de ce qui est lu ici n'est du texte libre.** Pas de `notes`, pas de journal de douleur,
 * pas de trace GPS, pas de prénom, pas de date de naissance (l'âge est dérivé puis la date jetée).
 * Le seul libellé qui sort est un **nom d'exercice**, qui vient de la bibliothèque et non d'une
 * saisie. Si vous ajoutez une requête ici, la question à se poser est : « est-ce que ça a le droit
 * de quitter l'appareil ? ».
 *
 * ── Deux bornes de fenêtre, et c'est volontaire ──────────────────────────────────────────────────
 * Les tables de journal sont datées en **date locale** (`log_date`, un `YYYY-MM-DD`), les tables
 * d'événement en **instant UTC** (`finished_at`, `started_at`). Comparer une date à un instant ISO
 * en SQLite « marche » lexicographiquement et donne un résultat faux d'un jour selon le fuseau.
 * D'où `windowDayKey` **et** `windowIso`.
 */

import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import {
  AI_TREND_WINDOW_DAYS,
  buildAiContext,
  localDayKey,
  MUSCLE_GROUPS,
  type AiSnapshot,
  type AiSnapshotActivity,
} from '@wellness/shared';

import { useSettings } from '@/data/repositories/settings-repository';
import { useTodayDate } from '@/hooks/useTodayKey';
import { getAppLanguage } from '@/i18n';

/** Fenêtre par défaut. 90 jours : assez pour une tendance de poids et un bloc d'entraînement. */
export const AI_CONTEXT_WINDOW_DAYS = 90;

/** Nombre de groupes musculaires et de meilleures séries remontés — au-delà, le contexte enfle. */
const MAX_MUSCLE_ROWS = 8;
const MAX_TOP_SETS = 6;
const MAX_ACTIVITY_ROWS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

type ProfileRow = { sex: string | null; birth_date: string | null; height_cm: number | null };
type NutritionProfileRow = {
  objective: string | null;
  manual_calories: number | null;
  manual_protein_g: number | null;
};
type WeightRow = {
  first_kg: number | null;
  last_kg: number | null;
  count: number | null;
  first_date: string | null;
  last_date: string | null;
  recent_kg: number | null;
  previous_kg: number | null;
};
type StrengthRow = { sessions: number | null; volume: number | null; avg_seconds: number | null };
type MuscleRow = { muscle: string | null; sets: number | null; volume: number | null };
type TopSetRow = { exercise_name: string | null; weight_kg: number | null; reps: number | null };
type ProgressionRow = {
  exercise_name: string | null;
  recent_max: number | null;
  previous_max: number | null;
};
type RunRow = {
  runs: number | null;
  distance_m: number | null;
  seconds: number | null;
  longest_m: number | null;
  recent_m: number | null;
  recent_s: number | null;
  previous_m: number | null;
  previous_s: number | null;
};
type NutritionRow = {
  days: number | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  recent_kcal: number | null;
  previous_kcal: number | null;
  recent_protein: number | null;
  previous_protein: number | null;
};
type ActivityRow = { activity_type: string | null; sessions: number | null; seconds: number | null };
type WellbeingRow = {
  days: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleep: number | null;
  recent_energy: number | null;
  previous_energy: number | null;
  recent_stress: number | null;
  previous_stress: number | null;
  recent_sleep: number | null;
  previous_sleep: number | null;
};
type StepsRow = {
  days: number | null;
  steps: number | null;
  recent_steps: number | null;
  previous_steps: number | null;
};

/**
 * Allure en secondes par kilomètre, recomposée depuis une durée et une distance.
 *
 * `null` dès qu'une des deux manque ou que la distance est nulle : une division par zéro produirait
 * `Infinity`, et une allure de `Infinity` s'écrirait dans le contexte comme un fait.
 */
function paceFrom(seconds: number | null, metres: number | null): number | null {
  if (seconds === null || metres === null || metres <= 0) return null;
  return seconds / (metres / 1000);
}

/** Âge en années révolues. `null` si la date est absente ou illisible — jamais un âge deviné. */
function ageFromBirthDate(birthDate: string | null, today: Date): number | null {
  if (!birthDate) return null;
  const born = new Date(`${birthDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * L'instantané de l'utilisateur courant, réactif à la base locale.
 *
 * `context` est le texte **exact** qui partira au fournisseur : l'écran l'affiche tel quel avant
 * l'envoi (R3 de la spec). Montrer autre chose que ce qui part rendrait le consentement décoratif.
 */
export function useAiSnapshot(windowDays: number = AI_CONTEXT_WINDOW_DAYS): {
  snapshot: AiSnapshot | null;
  context: string;
  isLoading: boolean;
} {
  const today = useTodayDate();
  const lang = getAppLanguage();
  const { settings } = useSettings();

  const windowIso = useMemo(
    () => new Date(today.getTime() - windowDays * DAY_MS).toISOString(),
    [today, windowDays],
  );
  const windowDayKey = useMemo(
    () => localDayKey(new Date(today.getTime() - windowDays * DAY_MS)),
    [today, windowDays],
  );

  /**
   * Les deux fenêtres de comparaison : `[recent, aujourd'hui]` et `[previous, recent[`.
   *
   * 🔴 Elles existent parce que la première recette (16/09/2026) a montré qu'un agrégat unique sur
   * 90 jours ne porte **aucune** tendance : « allure moyenne 5:32/km » est un chiffre juste dont on
   * ne peut rien conclure. Cinq des six signaux du jeu de test sont des évolutions ; sans ces deux
   * bornes, ils étaient invisibles pour le modèle.
   */
  const recentIso = useMemo(
    () => new Date(today.getTime() - AI_TREND_WINDOW_DAYS * DAY_MS).toISOString(),
    [today],
  );
  const previousIso = useMemo(
    () => new Date(today.getTime() - 2 * AI_TREND_WINDOW_DAYS * DAY_MS).toISOString(),
    [today],
  );
  const recentDayKey = useMemo(
    () => localDayKey(new Date(today.getTime() - AI_TREND_WINDOW_DAYS * DAY_MS)),
    [today],
  );
  const previousDayKey = useMemo(
    () => localDayKey(new Date(today.getTime() - 2 * AI_TREND_WINDOW_DAYS * DAY_MS)),
    [today],
  );

  const profile = useQuery<ProfileRow>(
    `SELECT sex, birth_date, height_cm FROM profiles WHERE deleted_at IS NULL LIMIT 1`,
  );

  const nutritionProfile = useQuery<NutritionProfileRow>(
    `SELECT objective, manual_calories, manual_protein_g
     FROM nutrition_profiles WHERE deleted_at IS NULL LIMIT 1`,
  );

  // `MIN(log_date)`/`MAX(log_date)` et les poids associés en une passe : deux sous-requêtes
  // corrélées coûteraient deux parcours de plus pour trois valeurs.
  const weight = useQuery<WeightRow>(
    `SELECT
       (SELECT weight_kg FROM body_weight_entries
         WHERE deleted_at IS NULL AND log_date >= ? ORDER BY log_date ASC LIMIT 1)  AS first_kg,
       (SELECT weight_kg FROM body_weight_entries
         WHERE deleted_at IS NULL AND log_date >= ? ORDER BY log_date DESC LIMIT 1) AS last_kg,
       COUNT(*) AS count, MIN(log_date) AS first_date, MAX(log_date) AS last_date,
       AVG(CASE WHEN log_date >= ? THEN weight_kg END) AS recent_kg,
       AVG(CASE WHEN log_date >= ? AND log_date < ? THEN weight_kg END) AS previous_kg
     FROM body_weight_entries WHERE deleted_at IS NULL AND log_date >= ?`,
    [windowDayKey, windowDayKey, recentDayKey, previousDayKey, recentDayKey, windowDayKey],
  );

  const strength = useQuery<StrengthRow>(
    `SELECT COUNT(DISTINCT w.id) AS sessions,
            SUM(s.reps * s.weight_kg) AS volume,
            AVG(w.duration_seconds) AS avg_seconds
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
       AND w.status = 'completed' AND w.deleted_at IS NULL
     WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
       AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
       AND w.finished_at >= ?`,
    [windowIso],
  );

  const byMuscle = useQuery<MuscleRow>(
    `SELECT e.muscle_primary AS muscle, COUNT(*) AS sets, SUM(s.reps * s.weight_kg) AS volume
     FROM workout_sets s
     JOIN workouts w  ON w.id = s.workout_id
       AND w.status = 'completed' AND w.deleted_at IS NULL
     JOIN exercises e ON e.id = s.exercise_id AND e.deleted_at IS NULL
     WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
       AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
       AND w.finished_at >= ?
     GROUP BY e.muscle_primary
     ORDER BY volume DESC
     LIMIT ${MAX_MUSCLE_ROWS}`,
    [windowIso],
  );

  // La série la plus lourde **par exercice**, pas les N séries les plus lourdes : sans le
  // `GROUP BY`, un seul exercice trusterait les six lignes et le contexte ne dirait plus rien.
  const topSets = useQuery<TopSetRow>(
    `SELECT COALESCE(tl.name, tfr.name) AS exercise_name,
            MAX(s.weight_kg) AS weight_kg,
            s.reps AS reps
     FROM workout_sets s
     JOIN workouts w  ON w.id = s.workout_id
       AND w.status = 'completed' AND w.deleted_at IS NULL
     JOIN exercises e ON e.id = s.exercise_id AND e.deleted_at IS NULL
     LEFT JOIN exercise_translations tl  ON tl.exercise_id = e.id AND tl.lang = ?    AND tl.deleted_at IS NULL
     LEFT JOIN exercise_translations tfr ON tfr.exercise_id = e.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
     WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
       AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
       AND w.finished_at >= ?
     GROUP BY e.id
     ORDER BY weight_kg DESC
     LIMIT ${MAX_TOP_SETS}`,
    [lang, windowIso],
  );

  /**
   * 🔴 **La requête qui rend une stagnation visible.** `MAX(CASE WHEN …)` donne la charge max sur
   * chaque fenêtre en un seul parcours. Deux valeurs identiques disent « bloqué depuis un mois » —
   * ce qu'un maximum unique sur 90 jours ne dira jamais.
   *
   * `HAVING` sur la fenêtre récente : un exercice abandonné depuis deux mois n'a pas à occuper une
   * ligne du contexte, et « rien récemment » n'est pas une progression.
   */
  const progression = useQuery<ProgressionRow>(
    `SELECT COALESCE(tl.name, tfr.name) AS exercise_name,
            MAX(CASE WHEN w.finished_at >= ? THEN s.weight_kg END) AS recent_max,
            MAX(CASE WHEN w.finished_at >= ? AND w.finished_at < ? THEN s.weight_kg END) AS previous_max
     FROM workout_sets s
     JOIN workouts w  ON w.id = s.workout_id
       AND w.status = 'completed' AND w.deleted_at IS NULL
     JOIN exercises e ON e.id = s.exercise_id AND e.deleted_at IS NULL
     LEFT JOIN exercise_translations tl  ON tl.exercise_id = e.id AND tl.lang = ?    AND tl.deleted_at IS NULL
     LEFT JOIN exercise_translations tfr ON tfr.exercise_id = e.id AND tfr.lang = 'fr' AND tfr.deleted_at IS NULL
     WHERE s.deleted_at IS NULL AND s.done = 1 AND s.set_type <> 'warmup'
       AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
       AND w.finished_at >= ?
     GROUP BY e.id
     HAVING MAX(CASE WHEN w.finished_at >= ? THEN s.weight_kg END) IS NOT NULL
     -- 🔴 Trié par PROGRESSION croissante, pas par charge absolue.
     --
     -- Le tri par charge absolue mettait le développé couché bloqué à 82,5 kg en fin de liste,
     -- derrière la presse à 191 kg et le squat à 134 — c'est-à-dire que le seul exercice
     -- intéressant était classé dernier, par un critère sans rapport avec la question. En recette
     -- (17/09/2026), le modèle a cité les charges qui montent et conclu « tes charges progressent
     -- encore », en ratant la stagnation qui était pourtant sous ses yeux.
     --
     -- Ce qui compte dans une liste de progression, c'est **ce qui ne progresse pas**. Les
     -- stagnations et les reculs passent donc en tête. Les exercices sans historique précédent
     -- (previous_max nul) vont en fin : ils n'ont pas régressé, ils viennent de commencer.
     --
     -- ⚠️ Aucun accent grave dans ce commentaire : il vit dans un template literal TypeScript, où
     -- il fermerait la chaîne. Le typecheck l'a attrapé, mais la cause n'était pas évidente.
     ORDER BY (previous_max IS NULL) ASC, (recent_max - previous_max) ASC
     LIMIT ${MAX_TOP_SETS}`,
    [recentIso, previousIso, recentIso, lang, previousIso, recentIso],
  );

  const running = useQuery<RunRow>(
    // Les sommes par fenêtre plutôt que `AVG(avg_pace_s_per_km)` : la moyenne des allures donne
    // autant de poids à un 5 km qu'à un 20 km. L'allure se recompose côté TypeScript, secondes
    // divisées par kilomètres — la seule définition juste.
    `SELECT COUNT(*) AS runs, SUM(distance_m) AS distance_m,
            SUM(duration_seconds) AS seconds, MAX(distance_m) AS longest_m,
            SUM(CASE WHEN finished_at >= ? THEN distance_m END) AS recent_m,
            SUM(CASE WHEN finished_at >= ? THEN duration_seconds END) AS recent_s,
            SUM(CASE WHEN finished_at >= ? AND finished_at < ? THEN distance_m END) AS previous_m,
            SUM(CASE WHEN finished_at >= ? AND finished_at < ? THEN duration_seconds END) AS previous_s
     FROM runs
     WHERE deleted_at IS NULL AND status = 'completed' AND finished_at >= ?`,
    [recentIso, recentIso, previousIso, recentIso, previousIso, recentIso, windowIso],
  );

  // Moyenne **par jour journalisé**, pas par ligne : `AVG(kcal)` sur `food_entries` donnerait la
  // calorie moyenne d'un aliment, ce qui ne veut rien dire. D'où l'agrégat imbriqué.
  const nutrition = useQuery<NutritionRow>(
    `SELECT COUNT(*) AS days, AVG(kcal) AS kcal, AVG(protein) AS protein,
            AVG(carbs) AS carbs, AVG(fat) AS fat,
            AVG(CASE WHEN log_date >= ? THEN kcal END) AS recent_kcal,
            AVG(CASE WHEN log_date >= ? AND log_date < ? THEN kcal END) AS previous_kcal,
            AVG(CASE WHEN log_date >= ? THEN protein END) AS recent_protein,
            AVG(CASE WHEN log_date >= ? AND log_date < ? THEN protein END) AS previous_protein
     FROM (
       SELECT log_date, SUM(kcal) AS kcal, SUM(protein_g) AS protein,
              SUM(carbs_g) AS carbs, SUM(fat_g) AS fat
       FROM food_entries WHERE deleted_at IS NULL AND log_date >= ?
       GROUP BY log_date
     )`,
    [recentDayKey, previousDayKey, recentDayKey, recentDayKey, previousDayKey, recentDayKey, windowDayKey],
  );

  const activities = useQuery<ActivityRow>(
    `SELECT activity_type, COUNT(*) AS sessions, SUM(duration_seconds) AS seconds
     FROM activities WHERE deleted_at IS NULL AND started_at >= ?
     GROUP BY activity_type ORDER BY seconds DESC LIMIT ${MAX_ACTIVITY_ROWS}`,
    [windowIso],
  );

  const wellbeing = useQuery<WellbeingRow>(
    // `AVG` ignore les NULL : une moyenne de sommeil se calcule sur les nuits **renseignées**, pas
    // sur les jours de check-in. Le sommeil est facultatif (LABO-01), la plupart des jours l'ont
    // vide, et compter ces jours comme des nuits de zéro heure diviserait la moyenne par trois.
    `SELECT COUNT(*) AS days, AVG(mood) AS mood, AVG(energy) AS energy, AVG(stress) AS stress,
            AVG(sleep_minutes) AS sleep,
            AVG(CASE WHEN log_date >= ? THEN energy END) AS recent_energy,
            AVG(CASE WHEN log_date >= ? AND log_date < ? THEN energy END) AS previous_energy,
            AVG(CASE WHEN log_date >= ? THEN stress END) AS recent_stress,
            AVG(CASE WHEN log_date >= ? AND log_date < ? THEN stress END) AS previous_stress,
            AVG(CASE WHEN log_date >= ? THEN sleep_minutes END) AS recent_sleep,
            AVG(CASE WHEN log_date >= ? AND log_date < ? THEN sleep_minutes END) AS previous_sleep
     FROM daily_wellbeing WHERE deleted_at IS NULL AND log_date >= ?`,
    [
      recentDayKey, previousDayKey, recentDayKey,
      recentDayKey, previousDayKey, recentDayKey,
      recentDayKey, previousDayKey, recentDayKey,
      windowDayKey,
    ],
  );

  const steps = useQuery<StepsRow>(
    `SELECT COUNT(*) AS days, AVG(steps) AS steps,
            AVG(CASE WHEN log_date >= ? THEN steps END) AS recent_steps,
            AVG(CASE WHEN log_date >= ? AND log_date < ? THEN steps END) AS previous_steps
     FROM daily_steps WHERE deleted_at IS NULL AND log_date >= ?`,
    [recentDayKey, previousDayKey, recentDayKey, windowDayKey],
  );

  const isLoading =
    profile.isLoading ||
    nutritionProfile.isLoading ||
    weight.isLoading ||
    strength.isLoading ||
    byMuscle.isLoading ||
    topSets.isLoading ||
    progression.isLoading ||
    running.isLoading ||
    nutrition.isLoading ||
    activities.isLoading ||
    wellbeing.isLoading ||
    steps.isLoading;

  const snapshot = useMemo<AiSnapshot | null>(() => {
    if (isLoading) return null;

    const p = profile.data[0];
    const np = nutritionProfile.data[0];
    const w = weight.data[0];
    const s = strength.data[0];
    const r = running.data[0];
    const n = nutrition.data[0];
    const wb = wellbeing.data[0];
    const st = steps.data[0];

    const runDistanceM = r?.distance_m ?? 0;
    const runSeconds = r?.seconds ?? 0;

    return {
      windowDays,
      generatedOn: localDayKey(today),
      trendWindowDays: AI_TREND_WINDOW_DAYS,
      profile: {
        sex: (p?.sex as AiSnapshot['profile']['sex']) ?? null,
        ageYears: ageFromBirthDate(p?.birth_date ?? null, today),
        heightCm: p?.height_cm ?? null,
        activePillars: settings?.activePillars ?? [],
        nutritionObjective: np?.objective ?? null,
        targetKcal: np?.manual_calories ?? null,
        targetProteinG: np?.manual_protein_g ?? null,
      },
      // Une seule pesée ne fait pas une tendance, mais elle fait un poids — et le poids est le
      // chiffre dont dépend toute estimation de dépense. On le garde dès la première.
      weight:
        w && (w.count ?? 0) > 0 && w.first_kg !== null && w.last_kg !== null
          ? {
              firstKg: w.first_kg,
              lastKg: w.last_kg,
              count: w.count ?? 0,
              firstDate: w.first_date ?? '',
              lastDate: w.last_date ?? '',
              weightTrend: { recent: w.recent_kg, previous: w.previous_kg },
            }
          : null,
      strength:
        s && (s.sessions ?? 0) > 0
          ? {
              sessions: s.sessions ?? 0,
              totalVolumeKg: s.volume ?? 0,
              avgSessionMinutes: s.avg_seconds ? s.avg_seconds / 60 : null,
              // Le complément de `byMuscle` sur la taxonomie fermée : ce qui n'a JAMAIS été
              // travaillé. Calculé ici plutôt que déduit par le lecteur, parce que personne — ni un
              // humain ni un modèle — ne remarque ce qui n'est pas écrit.
              untrainedMuscles: MUSCLE_GROUPS.filter(
                (group) => !byMuscle.data.some((row) => row.muscle === group),
              ),
              byMuscle: byMuscle.data
                .filter((row): row is MuscleRow & { muscle: string } => row.muscle !== null)
                .map((row) => ({
                  muscle: row.muscle,
                  sets: row.sets ?? 0,
                  volumeKg: row.volume ?? 0,
                })),
              topSets: topSets.data
                .filter(
                  (row): row is TopSetRow & { exercise_name: string; weight_kg: number } =>
                    row.exercise_name !== null && row.weight_kg !== null,
                )
                .map((row) => ({
                  exercise: row.exercise_name,
                  weightKg: row.weight_kg,
                  reps: row.reps ?? 0,
                })),
              progression: progression.data
                .filter(
                  (row): row is ProgressionRow & { exercise_name: string; recent_max: number } =>
                    row.exercise_name !== null && row.recent_max !== null,
                )
                .map((row) => ({
                  exercise: row.exercise_name,
                  recentMaxKg: row.recent_max,
                  // `null` et non 0 : « pas travaillé sur la fenêtre précédente » n'est pas
                  // « soulevé 0 kg ». Le rendu écrit « (rien avant) » plutôt qu'une régression fausse.
                  previousMaxKg: row.previous_max,
                })),
            }
          : null,
      running:
        r && (r.runs ?? 0) > 0
          ? {
              runs: r.runs ?? 0,
              totalKm: runDistanceM / 1000,
              totalMinutes: runSeconds / 60,
              // Une allure ne se calcule pas sur zéro mètre : `null` plutôt qu'une division qui
              // produirait `Infinity` puis une chaîne absurde dans le contexte.
              avgPaceSPerKm: runDistanceM > 0 ? runSeconds / (runDistanceM / 1000) : null,
              longestKm: (r.longest_m ?? 0) / 1000,
              paceTrend: {
                recent: paceFrom(r.recent_s, r.recent_m),
                previous: paceFrom(r.previous_s, r.previous_m),
              },
            }
          : null,
      nutrition:
        n && (n.days ?? 0) > 0
          ? {
              daysLogged: n.days ?? 0,
              avgKcal: Math.round(n.kcal ?? 0),
              avgProteinG: n.protein ?? 0,
              avgCarbsG: n.carbs ?? 0,
              avgFatG: n.fat ?? 0,
              kcalTrend: { recent: n.recent_kcal, previous: n.previous_kcal },
              proteinTrend: { recent: n.recent_protein, previous: n.previous_protein },
            }
          : null,
      activities: activities.data
        .filter((row): row is ActivityRow & { activity_type: string } => row.activity_type !== null)
        .map<AiSnapshotActivity>((row) => ({
          type: row.activity_type,
          sessions: row.sessions ?? 0,
          minutes: (row.seconds ?? 0) / 60,
        })),
      wellbeing:
        wb && (wb.days ?? 0) > 0
          ? {
              daysLogged: wb.days ?? 0,
              avgMood: wb.mood,
              avgEnergy: wb.energy,
              avgStress: wb.stress,
              avgSleepMinutes: wb.sleep,
              energyTrend: { recent: wb.recent_energy, previous: wb.previous_energy },
              stressTrend: { recent: wb.recent_stress, previous: wb.previous_stress },
              sleepTrend: { recent: wb.recent_sleep, previous: wb.previous_sleep },
            }
          : null,
      steps:
        st && (st.days ?? 0) > 0
          ? {
              daysLogged: st.days ?? 0,
              avgSteps: Math.round(st.steps ?? 0),
              stepsTrend: { recent: st.recent_steps, previous: st.previous_steps },
            }
          : null,
    };
  }, [
    isLoading,
    profile.data,
    nutritionProfile.data,
    weight.data,
    strength.data,
    byMuscle.data,
    topSets.data,
    progression.data,
    running.data,
    nutrition.data,
    activities.data,
    wellbeing.data,
    steps.data,
    settings?.activePillars,
    today,
    windowDays,
  ]);

  return {
    snapshot,
    context: snapshot ? buildAiContext(snapshot) : '',
    isLoading,
  };
}
