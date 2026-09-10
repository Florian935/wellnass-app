/**
 * US CARDIO-UX01 (R1a) — l'horloge d'une course, et la seule règle qui la gouverne.
 *
 * ── Le défaut ────────────────────────────────────────────────────────────────────────────────────
 * `run/active.tsx` affichait `now − startedAt` : l'**horloge murale**, pauses incluses. La base,
 * elle, porte `runs.duration_seconds` = la durée **nette**, hors pauses, accumulée par le tracker.
 * Deux horloges, une seule persistée. Le coureur voyait 32:10, le résumé affichait 29:45, et
 * pendant une pause le chrono continuait de défiler — donnant l'impression que le bouton Pause ne
 * faisait rien.
 *
 * L'incohérence était visible **dans le même écran** : l'allure moyenne, elle, utilisait déjà la
 * durée nette (`durationForPace = active?.durationSeconds ?? elapsedSeconds`). Le chrono était le
 * seul chiffre resté sur l'horloge murale.
 *
 * ── Le principe ──────────────────────────────────────────────────────────────────────────────────
 * **Il n'y a qu'une durée : le temps écoulé moins le temps en pause.** Elle s'affiche, elle
 * s'enregistre, et c'est la même. Tout ce module sert à ne jamais en fabriquer une seconde.
 *
 * ── Pourquoi la durée ne dépend plus du GPS (règle R1a-2, constat F16) ───────────────────────────
 * L'accumulation vivait **dans la branche « segment fiable »** du tracker : `netDurationS += dt`
 * ne s'exécutait qu'après le filtre de vitesse plausible destiné à la **distance**. Sous un tunnel,
 * en forêt dense, entre deux immeubles, la durée n'avançait donc pas — alors que le coureur courait.
 * La distance garde son filtre (un saut de 300 m en 2 s n'est pas une distance) ; la durée ne le
 * partage plus (2 s se sont écoulées, quoi qu'en dise le fix).
 */

/**
 * Borne basse d'un pas d'avancement, en secondes. Un `dt` nul ou négatif (horloge qui recule,
 * deux points au même instant) n'avance rien plutôt que de retirer du temps déjà compté.
 */
const MIN_STEP_S = 0;

/** Entrées d'un pas d'avancement de la durée nette. */
export type NetAdvanceInput = {
  /** Durée nette déjà comptée, en secondes. */
  netSeconds: number;
  /**
   * Epoch (ms) du dernier avancement, ou `null` si aucun n'a encore eu lieu — auquel cas ce pas
   * ne fait que **poser le repère**, sans compter de temps. C'est ce qui évite de compter la
   * latence entre la création de la course et le premier point comme du temps de course.
   */
  lastAdvanceAtMs: number | null;
  /** Epoch (ms) de l'instant jusqu'auquel on avance. */
  nowMs: number;
  /** Course en pause (manuelle ou auto) : le temps ne compte pas. */
  paused: boolean;
};

/** Résultat d'un pas : la nouvelle durée nette et le nouveau repère. */
export type NetAdvanceResult = {
  netSeconds: number;
  lastAdvanceAtMs: number;
};

/**
 * Avance la durée nette jusqu'à `nowMs`.
 *
 * Le repère se déplace **toujours**, y compris en pause : sans ça, la reprise compterait tout le
 * temps de la pause d'un coup. C'est la subtilité qui rend cette fonction non triviale, et la
 * raison pour laquelle elle est isolée et testée.
 */
export function advanceNetSeconds(input: NetAdvanceInput): NetAdvanceResult {
  const { netSeconds, lastAdvanceAtMs, nowMs, paused } = input;

  // Premier pas : on pose le repère, on ne compte rien.
  if (lastAdvanceAtMs === null) {
    return { netSeconds, lastAdvanceAtMs: nowMs };
  }

  const deltaS = (nowMs - lastAdvanceAtMs) / 1000;

  // Le repère avance dans tous les cas — en pause aussi (voir docstring).
  if (paused || deltaS <= MIN_STEP_S) {
    return { netSeconds, lastAdvanceAtMs: nowMs };
  }

  return { netSeconds: netSeconds + deltaS, lastAdvanceAtMs: nowMs };
}

/**
 * La durée à **afficher** pour une course, en secondes entières.
 *
 * Deux sources, dans cet ordre :
 *  1. le **tracker vivant**, quand il est attaché à cette course — il connaît la seconde courante ;
 *  2. la **valeur persistée**, sinon.
 *
 * Le second cas n'est pas un cas d'erreur : l'écran de suivi peut être remonté après un
 * redémarrage du runtime, avec une course toujours `active` en base et aucun tracker attaché. La
 * durée est alors **figée** sur le dernier flush — ce qui est honnête. L'ancien code retombait sur
 * l'horloge murale, c'est-à-dire sur un chiffre faux qui avait l'air vivant.
 *
 * Ne rend jamais de négatif ni de `NaN` : une course sans aucune donnée s'affiche `0`.
 */
export function displayedNetSeconds(input: {
  /** Durée nette du tracker attaché, ou `null` s'il ne suit pas cette course. */
  liveNetSeconds: number | null;
  /** `runs.duration_seconds` tel qu'il est en base, ou `null`. */
  storedDurationSeconds: number | null;
}): number {
  const { liveNetSeconds, storedDurationSeconds } = input;
  const chosen = liveNetSeconds ?? storedDurationSeconds ?? 0;
  if (!Number.isFinite(chosen) || chosen < 0) return 0;
  return Math.floor(chosen);
}

/**
 * L'écart entre le temps **écoulé** et le temps **compté**, en secondes — c'est-à-dire le temps
 * passé en pause.
 *
 * Sert à écrire au résumé « 2:12 de pause exclues · 38:52 écoulées » plutôt que de laisser
 * l'utilisateur découvrir un écart qu'il ne s'explique pas. Rend `null` quand il n'y a rien à
 * dire : pas de données, ou moins d'une seconde d'écart (bruit d'arrondi).
 */
export function pausedSeconds(input: {
  /** Epoch (ms) de départ de la course. */
  startedAtMs: number;
  /** Epoch (ms) de clôture de la course. */
  finishedAtMs: number;
  /** Durée nette enregistrée, en secondes. */
  netSeconds: number | null;
}): { pausedS: number; elapsedS: number } | null {
  const { startedAtMs, finishedAtMs, netSeconds } = input;
  if (netSeconds == null || !Number.isFinite(netSeconds)) return null;
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(finishedAtMs)) return null;

  const elapsedS = Math.floor((finishedAtMs - startedAtMs) / 1000);
  if (elapsedS <= 0) return null;

  const pausedS = Math.round(elapsedS - netSeconds);
  // Négatif = la durée nette dépasse l'écoulé : impossible en théorie, mais un flush tardif ou
  // une horloge qui a reculé peut le produire. On se tait plutôt que d'afficher une absurdité.
  if (pausedS < 1) return null;

  return { pausedS, elapsedS };
}
