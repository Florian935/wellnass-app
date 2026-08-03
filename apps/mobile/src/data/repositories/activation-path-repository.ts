/**
 * Repository du parcours « 7 jours pour démarrer » (US ACTIV-01, roadmap 1.27).
 *
 * Aucune nouvelle table de suivi : l'état (jour courant, thème, coche de complétion) est dérivé à
 * la lecture depuis `profiles.onboardingCompletedAt`/`activationPathDismissedAt`, les piliers
 * actifs courants (`user_settings.active_pillars`, jamais un instantané — spec R2), et des
 * requêtes ciblées sur les tables déjà existantes (workouts/runs/food_entries/daily_wellbeing/
 * personal_goals). La seule écriture est le dismiss, sur `profiles`.
 */

import { useQuery } from '@powersync/react';
import {
  activationDayTheme,
  activationPathDayIndex,
  resolveActivePillars,
  type ActivationDayTheme,
} from '@wellness/shared';
import { useProfile } from './profile-repository';
import { useSettings } from './settings-repository';
import { nowUtc } from './_sql';

/** Requête « au moins une ligne depuis `since` » — pas d'agrégation, juste une existence. */
function useExistsSince(table: string, dateColumn: string, since: string | null): boolean {
  const { data } = useQuery<{ found: number }>(
    `SELECT 1 AS found FROM ${table} WHERE ${dateColumn} >= ? AND deleted_at IS NULL LIMIT 1`,
    [since ?? ''],
  );
  return since != null && data.length > 0;
}

/** Coche de complétion du jour (spec R5 : informative, ne bloque jamais la progression). */
function useDayCompletion(theme: ActivationDayTheme | null, since: string | null): boolean {
  const strengthDone = useExistsSince('workouts', 'finished_at', since);
  const runningDone = useExistsSince('runs', 'finished_at', since);
  const nutritionDone = useExistsSince('food_entries', 'created_at', since);
  const wellbeingDone = useExistsSince('daily_wellbeing', 'created_at', since);
  const goalDone = useExistsSince('personal_goals', 'created_at', since);

  if (!theme) return false;
  if (theme.kind === 'pillar') {
    if (theme.pillar === 'strength') return strengthDone;
    if (theme.pillar === 'running') return runningDone;
    return nutritionDone;
  }
  // Jours universels : seuls le jour 3 (repli objectif) et le jour 4 (bien-être) ont une coche
  // significative (spec §2) — les autres (2/6/7) restent toujours "non fait", sans en informer.
  if (theme.day === 3) return goalDone;
  if (theme.day === 4) return wellbeingDone;
  return false;
}

/**
 * État courant du parcours pour l'utilisateur connecté. `show = false` hors fenêtre (jour > 7),
 * après fermeture explicite, ou tant que l'onboarding n'est pas terminé.
 */
export function useActivationPath(): {
  show: boolean;
  day: number | null;
  theme: ActivationDayTheme | null;
  completed: boolean;
} {
  const { profile } = useProfile();
  const { settings } = useSettings();

  const dismissed = profile?.activationPathDismissedAt != null;
  const day = dismissed
    ? null
    : activationPathDayIndex(profile?.onboardingCompletedAt ?? null, nowUtc());
  const activePillars = resolveActivePillars(settings?.activePillars);
  const theme = day != null ? activationDayTheme(day, activePillars) : null;
  const completed = useDayCompletion(theme, profile?.onboardingCompletedAt ?? null);

  return { show: day != null, day, theme, completed };
}
