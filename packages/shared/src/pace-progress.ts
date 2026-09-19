/**
 * US CARDIO-UX02 — **« Ton allure »**, la carte dominante du hub Course.
 *
 * ── Ce qu'elle comble ────────────────────────────────────────────────────────────────────────────
 * Le hub course ne répondait **nulle part** à la seule question qui fait rouvrir l'app d'un
 * coureur : *est-ce que je cours plus vite qu'avant ?* RUN-05 (courbe et tendance d'allure) est
 * livrée depuis le 29/07 — mais elle ne vit que dans `/running-history`, à deux écrans du hub. Le
 * plus gros chiffre du hub était la distance de la **dernière** sortie : une mesure de ce qui vient
 * de se passer, pas de ce qui progresse.
 *
 * C'est exactement le défaut 4 de l'audit muscu (`load-progress.ts`), transposé au pilier voisin,
 * et cette brique en reprend la forme : **deux visages choisis par les données**, jamais par un
 * réglage.
 *
 *  1. `onboarding` — pas encore de quoi comparer deux fenêtres. On montre la **meilleure allure
 *     tenue depuis le début** et le volume parcouru. Un débutant n'a pas de tendance, mais il a
 *     des kilomètres, et c'est le moment où l'app risque le plus d'être désinstallée.
 *  2. `established` — l'allure **médiane** des 30 derniers jours contre celle des 30 jours d'avant.
 *
 * ── Les trois règles qui évitent d'afficher du bruit ─────────────────────────────────────────────
 *  - **Médiane, jamais moyenne** (même règle que `load-progress.ts`) : une sortie de récupération à
 *    7:30/km ne doit pas déplacer le titre de la carte.
 *  - **Deux fenêtres pleines, sinon rien** : comparer 6 sorties à 1 seule produirait un écart qui
 *    ne mesure que le hasard de la semaine.
 *  - **Un plancher d'écart** (`PACE_FLAT_S_PER_KM`) : sous 3 s/km, on dit « stable » plutôt que
 *    d'afficher un « −1 s/km » qui prêterait à l'estimation une précision qu'elle n'a pas.
 *
 * ⚠️ **La limite est connue et assumée** : `runs` ne porte pas de `session_type` (c'est le mur qui
 * laisse RUN-07 en ⏳ au catalogue et qui a borné RUN-20 en distance). L'allure médiane mélange donc
 * fractionnés, sorties longues et récupérations. La médiane sur 30 jours absorbe ce mélange tant
 * que la **composition** des semaines ne change pas ; elle ne le corrige pas. À reprendre le jour
 * où une course libre saura dire son type — et pas avant, parce qu'inventer le type d'une sortie
 * serait pire que d'assumer le mélange.
 *
 * Aucune dépendance React, ni base, ni horloge : `todayKey` entre par paramètre, comme pour
 * `insights.ts`, `load-progress.ts` et `neglected-exercises.ts`.
 */

import { daysBetween } from './date';
import { median } from './load-progress';
import type { PaceTrendKind } from './run-stats';

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/** Largeur d'une fenêtre de comparaison, en jours. Deux fenêtres accolées sont comparées. */
export const PACE_WINDOW_DAYS = 30;

/**
 * Sorties minimales **dans chaque** fenêtre pour qu'une comparaison ait un sens.
 *
 * Trois, et pas deux : avec deux sorties la médiane est une moyenne de deux points, donc aussi
 * fragile qu'eux. Avec trois, un point aberrant ne peut plus porter le résultat à lui seul.
 *
 * Le préfixe `PACE_PROGRESS_` n'est pas décoratif : `lab-investigations.ts` exporte déjà un
 * `PACE_MIN_RUNS` (à 5, pour une enquête du Labo). `index.ts` réexporte tout à plat — deux
 * constantes homonymes y sont une erreur de compilation, pas une ambiguïté silencieuse.
 */
export const PACE_PROGRESS_MIN_RUNS = 3;

/**
 * En deçà, l'écart se dit « stable » (s/km).
 *
 * 3 s/km sur une allure de 5:30 représente 0,9 % — l'ordre de grandeur de la dérive d'un GPS de
 * téléphone sur une sortie, mesuré par les réserves de RUN-03. En dessous, on n'annonce pas un
 * progrès qu'on ne peut pas distinguer du bruit de la mesure.
 */
export const PACE_FLAT_S_PER_KM = 3;

// ---------------------------------------------------------------------------
// Entrées / sorties
// ---------------------------------------------------------------------------

/** Une sortie terminée, réduite à ce dont le calcul a besoin. */
export type PaceRun = {
  /** Jour local de fin, `AAAA-MM-JJ`. */
  dayKey: string;
  /** Allure moyenne en secondes par kilomètre. */
  paceSPerKm: number;
  /** Distance en mètres — sert au visage `onboarding`, jamais à la comparaison. */
  distanceM: number;
};

/** Sens de l'écart. `up` = on court **plus vite** (l'allure baisse) — le sens du produit, pas celui du nombre. */
export type PaceDirection = 'up' | 'flat' | 'down';

export type PaceProgress =
  /** Aucune sortie exploitable : la carte se tait. */
  | { kind: 'empty' }
  /** Pas deux fenêtres pleines — on montre ce qui existe déjà : le meilleur, et le cumul. */
  | {
      kind: 'onboarding';
      /** Meilleure allure tenue sur une sortie, en s/km. */
      bestPaceSPerKm: number;
      /** Jour de cette sortie. */
      bestDayKey: string;
      /** Nombre de sorties connues. */
      runs: number;
      /** Distance cumulée, en mètres. */
      totalDistanceM: number;
    }
  /** Deux fenêtres pleines : l'écart médian, et son sens. */
  | {
      kind: 'established';
      /** Allure médiane de la fenêtre courante (s/km). */
      currentPaceSPerKm: number;
      /** Allure médiane de la fenêtre précédente (s/km). */
      previousPaceSPerKm: number;
      /**
       * Écart **positif = plus rapide** (`previous − current`), en s/km. Le signe est inversé par
       * rapport au nombre brut parce qu'une allure qui baisse est un progrès : afficher « −8 s/km »
       * pour une amélioration se lit à l'envers une fois sur deux.
       */
      deltaSPerKm: number;
      direction: PaceDirection;
      /** Sorties retenues dans chaque fenêtre. */
      runsCurrent: number;
      runsPrevious: number;
      /** Tendance longue, telle que la calcule RUN-05 — fournie par l'appelant. */
      trend: PaceTrendKind;
    };

export type PaceProgressInput = {
  runs: readonly PaceRun[];
  todayKey: string;
  /**
   * Tendance longue déjà calculée par `paceTrend` (RUN-05). Elle entre au lieu d'être recalculée :
   * la refaire ici donnerait deux verdicts de tendance dans l'app, qui divergeraient le jour où
   * l'un des deux seuils bougerait.
   */
  trend: PaceTrendKind;
};

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

/**
 * L'état de la carte « Ton allure ».
 *
 * Les deux fenêtres sont **accolées et fermées** : `[J−29, J]` et `[J−59, J−30]`. Une sortie
 * postérieure à `todayKey` (horloge de l'appareil en avance, import daté du futur) est écartée
 * plutôt que rangée dans la fenêtre courante — elle fausserait la comparaison sans qu'on le voie.
 */
export function computePaceProgress(input: PaceProgressInput): PaceProgress {
  const usable = input.runs.filter(
    (r) =>
      Number.isFinite(r.paceSPerKm) && r.paceSPerKm > 0 && r.dayKey <= input.todayKey,
  );
  if (usable.length === 0) return { kind: 'empty' };

  const age = (r: PaceRun): number => daysBetween(r.dayKey, input.todayKey);
  const current = usable.filter((r) => age(r) < PACE_WINDOW_DAYS);
  const previous = usable.filter(
    (r) => age(r) >= PACE_WINDOW_DAYS && age(r) < PACE_WINDOW_DAYS * 2,
  );

  if (current.length < PACE_PROGRESS_MIN_RUNS || previous.length < PACE_PROGRESS_MIN_RUNS) {
    // Le meilleur de l'histoire, pas de la fenêtre : c'est un palier franchi, il ne se périme pas.
    const best = usable.reduce((lo, r) => (r.paceSPerKm < lo.paceSPerKm ? r : lo), usable[0]!);
    return {
      kind: 'onboarding',
      bestPaceSPerKm: Math.round(best.paceSPerKm),
      bestDayKey: best.dayKey,
      runs: usable.length,
      totalDistanceM: usable.reduce((sum, r) => sum + (r.distanceM > 0 ? r.distanceM : 0), 0),
    };
  }

  const currentPace = Math.round(median(current.map((r) => r.paceSPerKm)));
  const previousPace = Math.round(median(previous.map((r) => r.paceSPerKm)));
  const delta = previousPace - currentPace;

  return {
    kind: 'established',
    currentPaceSPerKm: currentPace,
    previousPaceSPerKm: previousPace,
    deltaSPerKm: delta,
    direction: paceDirection(delta),
    runsCurrent: current.length,
    runsPrevious: previous.length,
    trend: input.trend,
  };
}

/** Le sens d'un écart d'allure, plancher `PACE_FLAT_S_PER_KM` appliqué. */
export function paceDirection(deltaSPerKm: number): PaceDirection {
  if (deltaSPerKm >= PACE_FLAT_S_PER_KM) return 'up';
  if (deltaSPerKm <= -PACE_FLAT_S_PER_KM) return 'down';
  return 'flat';
}
