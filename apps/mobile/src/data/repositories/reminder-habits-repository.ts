/**
 * Habitudes de saisie et échéances des rappels programmés — US NUTR-F1 (roadmap 1.14, 2.5).
 *
 * Répond à deux questions, pour le journal alimentaire et pour la pesée :
 *  - **à quelle heure faut-il rappeler ?** (échéance apprise, ou repli réglé par l'utilisateur) ;
 *  - **le geste est-il déjà fait aujourd'hui ?** (auquel cas il n'y a rien à rappeler).
 *
 * Toute la règle métier vit dans `@wellness/shared` (`learned-hour.ts` + `clampOutOfDnd`, testés).
 * Ici : uniquement des requêtes SQL locales et l'assemblage. **100 % offline** — aucune écriture,
 * aucun appel réseau.
 *
 * ── Pourquoi aucun agrégat SQL sur `created_at` ───────────────────────────────────────────────────
 * On lit **toutes** les entrées de la fenêtre au lieu d'un `MIN(created_at) … GROUP BY log_date`. Le
 * choix de l'entrée retenue dépend du filtre anti-saisie-rétroactive (le jour **local** de
 * `created_at` doit égaler `log_date`), et `created_at` est stocké en **UTC** : un
 * `strftime('%H', created_at)` renverrait l'heure UTC et décalerait tout l'apprentissage de 1 à 2 h
 * selon la saison. La conversion se fait donc en JS, et le filtre avec elle. Volume concerné :
 * 14 jours de saisies, négligeable.
 *
 * ── Pas de filtre `user_id` ───────────────────────────────────────────────────────────────────────
 * PowerSync ne réplique que le bucket de l'utilisateur courant : la base locale ne contient que ses
 * lignes. C'est la convention du dépôt (cf. `body-measurement-repository.ts`).
 */

import { useMemo } from 'react';

import { useQuery } from '@powersync/react';
import {
  LEARNED_HOUR_WINDOW_DAYS,
  localMidnightDaysAgo,
  resolveReminderDeadline,
  type LogSample,
  type NotificationPrefs,
  type ReminderDeadline as PureReminderDeadline,
} from '@wellness/shared';
import { useTodayKey } from '@/hooks/useTodayKey';

/** Échéance résolue d'un rappel, plus l'état de chargement des requêtes locales. */
export type ReminderDeadline = PureReminderDeadline & { isLoading: boolean };

type SampleDbRow = { log_date: string; created_at: string };

/**
 * Toutes les entrées alimentaires de la fenêtre d'apprentissage.
 * `ORDER BY created_at` n'est pas requis par la brique pure (qui prend le minimum par jour) mais
 * rend la requête déterministe, donc les tests reproductibles.
 */
const SELECT_MEAL_SAMPLES = `
  SELECT log_date, created_at
  FROM food_entries
  WHERE deleted_at IS NULL AND created_at >= ?
  ORDER BY created_at
`;

/** Pesées de la fenêtre d'apprentissage (au plus une par jour). */
const SELECT_WEIGH_IN_SAMPLES = `
  SELECT log_date, created_at
  FROM body_weight_entries
  WHERE deleted_at IS NULL AND created_at >= ?
  ORDER BY created_at
`;

const COUNT_MEALS_TODAY = `
  SELECT COUNT(*) AS n FROM food_entries WHERE log_date = ? AND deleted_at IS NULL
`;

const COUNT_WEIGH_IN_TODAY = `
  SELECT COUNT(*) AS n FROM body_weight_entries WHERE log_date = ? AND deleted_at IS NULL
`;

/**
 * Borne basse de la fenêtre d'apprentissage, dérivée du **jour courant** : minuit local il y a
 * `LEARNED_HOUR_WINDOW_DAYS - 1` jours, converti en instant UTC pour être comparé aux `created_at`
 * stockés en UTC. Même patron que `utcBounds()` dans `weekly-review-repository.ts`.
 *
 * Le `- 1` compte les jours **inclusivement** : J-13 → J0 fait bien 14 jours, pas 15. C'est la
 * convention du dépôt (cf. `ROLLING_WEEK_DAYS - 1` dans `records-repository.ts`).
 */
function windowStartUtcFrom(todayKey: string): string {
  const [y, m, d] = todayKey.split('-').map(Number);
  const ref = new Date(y!, m! - 1, d!, 0, 0, 0, 0);
  return localMidnightDaysAgo(LEARNED_HOUR_WINDOW_DAYS - 1, ref).toISOString();
}

function useSamples(sql: string, todayKey: string): { samples: LogSample[]; isLoading: boolean } {
  const windowStart = windowStartUtcFrom(todayKey);
  const { data, isLoading } = useQuery<SampleDbRow>(sql, [windowStart]);
  const samples = useMemo(
    () => data.map((row) => ({ logDate: row.log_date, createdAt: row.created_at })),
    [data],
  );
  return { samples, isLoading };
}

function useDoneToday(sql: string, todayKey: string): { done: boolean; isLoading: boolean } {
  const { data, isLoading } = useQuery<{ n: number }>(sql, [todayKey]);
  return { done: (data[0]?.n ?? 0) > 0, isLoading };
}

/**
 * Échéance du rappel de journal alimentaire.
 *
 * Les préférences sont passées en **paramètre** plutôt que lues via `useNotificationPrefs()` : ce
 * module serait sinon en cycle d'import avec `notification-repository`, qui le consomme. L'écran de
 * réglages et le planificateur disposent tous deux déjà des prefs.
 */
export function useMealDeadline(prefs: NotificationPrefs): ReminderDeadline {
  const todayKey = useTodayKey();
  const { samples, isLoading } = useSamples(SELECT_MEAL_SAMPLES, todayKey);
  const resolved = resolveReminderDeadline(
    samples,
    prefs.mealReminderHour,
    prefs.learnedHour,
    prefs,
  );
  return { ...resolved, isLoading };
}

/** Échéance du rappel de pesée. */
export function useWeighInDeadline(prefs: NotificationPrefs): ReminderDeadline {
  const todayKey = useTodayKey();
  const { samples, isLoading } = useSamples(SELECT_WEIGH_IN_SAMPLES, todayKey);
  const resolved = resolveReminderDeadline(
    samples,
    prefs.weighInReminderHour,
    prefs.learnedHour,
    prefs,
  );
  return { ...resolved, isLoading };
}

/** Au moins une entrée alimentaire enregistrée pour le jour local courant ? */
export function useMealLoggedToday(): { done: boolean; isLoading: boolean } {
  const todayKey = useTodayKey();
  return useDoneToday(COUNT_MEALS_TODAY, todayKey);
}

/** Pesée enregistrée pour le jour local courant ? */
export function useWeighInToday(): { done: boolean; isLoading: boolean } {
  const todayKey = useTodayKey();
  return useDoneToday(COUNT_WEIGH_IN_TODAY, todayKey);
}
