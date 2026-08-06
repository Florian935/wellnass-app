/**
 * US STREAK-01 — joker de série (roadmap 7.14).
 *
 * Un joker « gèle » **un** jour manqué pour que la série ne retombe pas à zéro. Ce n'est pas une
 * récompense qu'on gagne (arbitrage C : pas de boucle de jeu) mais un filet qu'on utilise.
 *
 * Trois règles portent la crédibilité du dispositif, et ce sont elles qui empêchent la série de
 * devenir un compteur qui ne mesure plus rien :
 *
 * 1. **un joker ne couvre qu'un jour ISOLÉ** (décision D4). Deux jours d'affilée sans rien, c'est une
 *    interruption réelle : la série tombe. C'est ce qui distingue l'accident de l'arrêt ;
 * 2. **deux jours couverts ne peuvent pas se suivre**, et le garde-fou est **dans le calcul** — pas
 *    seulement à la consommation. Si la base contenait deux jokers consécutifs (anomalie, import,
 *    bug futur), la série doit s'arrêter là plutôt que de propager une valeur fausse ;
 * 3. **un joker n'affecte QUE la série** (décision D3). Il ne rend pas le jour « actif » : l'adhérence,
 *    la complétion du journal et les corrélations post-V1 continuent de voir un jour vide, parce qu'il
 *    l'est. Falsifier la donnée pour sauver un affichage serait le pire des choix.
 *
 * ── US VIE-01 : les jours « en pause » ────────────────────────────────────────────────────────────
 * Le mode « vie réelle » (roadmap 1.28) ajoute un **troisième** état de jour, distinct du joker et
 * volontairement plus faible que lui : un jour couvert par une période déclarée et **inactif** est
 * **transparent** — le parcours arrière le traverse, mais le compteur n'avance pas. La série est donc
 * « ni cassée, ni allongée » (décision D4 de VIE-01).
 *
 * La nuance qui compte : un jour en période où l'utilisateur **s'est entraîné** compte
 * normalement (`+1`). La période abaisse ce qui est **demandé** ; elle n'efface pas ce qui est
 * **accompli**. C'est pour ça que le prédicat de pause exclut les jours actifs.
 *
 * Et un jour en période **ne consomme jamais de joker** : le proposer gaspillerait le filet du mois
 * sur un jour déjà couvert. `findRestorableGap` traite donc une pause comme une couverture.
 */

/** Nombre de jokers accordés par mois calendaire (décision D2). */
export const JOKERS_PER_MONTH = 1;

/** Défaut partagé pour les paramètres d'ensembles optionnels — évite d'allouer un `Set` par appel. */
const EMPTY_DAYS: ReadonlySet<string> = new Set<string>();

/** Ancienneté maximale, en jours, d'un trou encore rattrapable (décision D5). */
export const JOKER_MAX_AGE_DAYS = 7;

/** Clé du jour précédent, calculée en UTC pour rester insensible aux changements d'heure. */
function prevKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!) - 86_400_000;
  const p = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.getUTCFullYear()}-${pad(p.getUTCMonth() + 1)}-${pad(p.getUTCDate())}`;
}

/** Nombre de jours entre deux clés (`to - from`). */
function daysApart(fromKey: string, toKey: string): number {
  const ms = (key: string): number => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((ms(toKey) - ms(fromKey)) / 86_400_000);
}

/** Vrai si les deux clés tombent dans le même mois calendaire. */
export function isSameCalendarMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/**
 * Jokers encore disponibles ce mois-ci.
 *
 * On compte sur `log_date` — la date **que l'utilisateur voit** — et non sur la date de consommation :
 * c'est celle qui a du sens quand il se demande « j'ai déjà utilisé mon joker ce mois-ci ? ».
 */
export function jokersRemaining(jokerDays: ReadonlyArray<string>, todayKey: string): number {
  const usedThisMonth = jokerDays.filter((day) => isSameCalendarMonth(day, todayKey)).length;
  return Math.max(0, JOKERS_PER_MONTH - usedThisMonth);
}

/**
 * Série de jours consécutifs, jokers **et** jours en pause compris.
 *
 * Même contrat que `computeStreak` (dont elle reprend la tolérance du jour courant : une journée
 * commencée n'est pas une journée manquée), avec trois différences :
 *  - un jour couvert par un joker compte comme actif **pour la série seulement** ;
 *  - **deux jours joker consécutifs arrêtent le comptage** (règle 2) ;
 *  - un jour **en pause et inactif** est **transparent** : traversé, non compté (US VIE-01).
 *
 * `pausedDays` est optionnel et vaut l'ensemble vide par défaut : sans mode « vie réelle » déclaré, le
 * comportement est **exactement** celui d'avant.
 */
export function computeStreakWithJokers(
  activeDays: ReadonlySet<string>,
  jokerDays: ReadonlySet<string>,
  todayKey: string,
  pausedDays: ReadonlySet<string> = EMPTY_DAYS,
): { current: number; activeToday: boolean } {
  const counts = (key: string): boolean => activeDays.has(key) || jokerDays.has(key);
  // Un jour actif en période n'est PAS en pause : il compte normalement (VIE-01, cas C). C'est ce
  // `!activeDays.has` qui empêche la période d'effacer une séance réellement faite.
  const paused = (key: string): boolean => pausedDays.has(key) && !activeDays.has(key);
  const traversable = (key: string): boolean => counts(key) || paused(key);

  const activeToday = activeDays.has(todayKey);

  let cursor: string;
  if (traversable(todayKey)) {
    cursor = todayKey;
  } else {
    const yesterday = prevKey(todayKey);
    if (traversable(yesterday)) {
      cursor = yesterday;
    } else {
      return { current: 0, activeToday };
    }
  }

  let count = 0;
  let previousWasJoker = false;

  // ⚠️ La condition est `traversable`, pas `counts` : un jour transparent ne doit pas **arrêter** le
  // parcours. Avec `counts`, la série se serait arrêtée au premier jour de période et VIE-01 n'aurait
  // rien fait du tout — en silence, sans qu'aucun test existant ne le voie.
  while (traversable(cursor)) {
    if (paused(cursor)) {
      // Transparent : on avance sans compter. `previousWasJoker` est laissé **tel quel**, pas remis à
      // faux — une période intercalée ne doit pas servir à contourner la règle 2. Cas très théorique
      // (`JOKERS_PER_MONTH` vaut 1, il faut donc franchir un mois), mais le garde-fou est gratuit.
      cursor = prevKey(cursor);
      continue;
    }

    const isJoker = !activeDays.has(cursor) && jokerDays.has(cursor);
    // Deux jours joker d'affilée : on refuse de propager (règle 2).
    if (isJoker && previousWasJoker) break;

    count += 1;
    previousWasJoker = isJoker;
    cursor = prevKey(cursor);
  }

  return { current: count, activeToday };
}

/** Un trou rattrapable, et ce que le joker sauverait. */
export type RestorableGap = {
  /** Le jour manqué à couvrir. */
  day: string;
  /** Longueur de série obtenue si le joker est consommé — l'enjeu à annoncer. */
  streakIfUsed: number;
};

/**
 * Cherche le trou rattrapable le plus récent, ou `null`.
 *
 * Un trou est rattrapable si, **et seulement si** :
 *  - le jour est inactif et pas déjà couvert ;
 *  - il est **isolé** : le jour juste avant est actif (ou couvert) — sinon c'est une interruption
 *    réelle et non un accident (règle 1) ;
 *  - il a moins de `JOKER_MAX_AGE_DAYS` jours (D5) : ressusciter une série morte depuis deux semaines
 *    n'aurait aucun sens ;
 *  - il reste un joker ce mois-ci.
 *
 * On ne renvoie que le trou **le plus récent** : proposer de réparer un trou ancien alors qu'un plus
 * récent existe donnerait une série encore rompue juste après.
 *
 * ⚠️ **Un jour en pause (US VIE-01) compte comme couvert** : il n'est donc jamais proposé, et il ne
 * casse pas l'isolement d'un trou voisin. Sans cette règle, l'app aurait proposé de brûler le joker du
 * mois sur un jour de vacances que la période protégeait déjà gratuitement.
 */
export function findRestorableGap(params: {
  activeDays: ReadonlySet<string>;
  jokerDays: ReadonlySet<string>;
  todayKey: string;
  pausedDays?: ReadonlySet<string>;
}): RestorableGap | null {
  const { activeDays, jokerDays, todayKey, pausedDays = EMPTY_DAYS } = params;

  if (jokersRemaining([...jokerDays], todayKey) <= 0) return null;

  const covered = (key: string): boolean =>
    activeDays.has(key) || jokerDays.has(key) || pausedDays.has(key);

  // On part d'hier : le jour courant bénéficie déjà de sa propre tolérance, il n'est jamais un « trou ».
  let cursor = prevKey(todayKey);

  while (daysApart(cursor, todayKey) <= JOKER_MAX_AGE_DAYS) {
    if (!covered(cursor)) {
      // Trou trouvé. Il n'est rattrapable que s'il est isolé : le jour d'avant doit tenir.
      const before = prevKey(cursor);
      if (!covered(before)) return null;

      const simulated = new Set(jokerDays);
      simulated.add(cursor);
      const { current } = computeStreakWithJokers(activeDays, simulated, todayKey, pausedDays);

      // Un joker qui ne rallonge rien ne vaut pas d'être proposé.
      return current > 0 ? { day: cursor, streakIfUsed: current } : null;
    }

    cursor = prevKey(cursor);
  }

  return null;
}
