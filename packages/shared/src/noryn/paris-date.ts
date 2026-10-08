/**
 * US NORYN-01 — les dates de Noryn : des jours civils **à Paris**.
 *
 * La fonction `noryn-context` tourne sur un serveur réglé en UTC. « Aujourd'hui », la fenêtre servie
 * et le jour d'un instant (`finished_at` d'une séance) se calculent donc explicitement à l'heure de
 * Paris, changements d'heure compris — jamais avec un `Date` local, qui serait le jour UTC.
 *
 * Les clés de jour (`AAAA-MM-JJ`) s'additionnent en arithmétique UTC : un jour civil reste un jour,
 * qu'il dure 23, 24 ou 25 heures à Paris.
 *
 * ⚠️ Aucune lecture d'horloge ici : « aujourd'hui » entre par paramètre.
 */

export const PARIS_TIME_ZONE = 'Europe/Paris';

/**
 * Fenêtre servie (décision D8) : celle du contrat, J−7 … J+14, plus **un jour de marge** de chaque
 * côté. Noryn calcule sa fenêtre sur sa propre horloge avant l'appel : une demande partie juste avant
 * minuit à Paris arrive le lendemain, et le contrat dit « must answer ».
 */
export const SERVED_WINDOW_PAST_DAYS = 8;
export const SERVED_WINDOW_FUTURE_DAYS = 15;

const DAY_MS = 86_400_000;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Minuit UTC d'une clé valide, en millisecondes. */
function utcMs(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

/** Une vraie date du calendrier, au format strict `AAAA-MM-JJ`. */
export function isValidDayKey(value: string): boolean {
  const match = DAY_KEY.exec(value);
  if (match === null) return false;
  const ms = utcMs(value);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** La clé `days` jours après `key` (avant, si négatif). */
export function addDayKeys(key: string, days: number): string {
  return new Date(utcMs(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Vrai si la clé tombe un lundi. */
export function isMondayKey(key: string): boolean {
  return new Date(utcMs(key)).getUTCDay() === 1;
}

/** Les sept jours d'une semaine, à partir de son lundi. */
export function weekKeysFrom(start: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDayKeys(start, index));
}

let parisParts: Intl.DateTimeFormat | undefined;

/**
 * Le jour civil à Paris d'un instant. `formatToParts` : aucun format de langue n'est supposé.
 * Le formateur est construit **à la demande**, pas au chargement du module : un runtime privé des
 * données de fuseaux lèverait ici, dans le gestionnaire, qui répond alors 500 en JSON — au lieu
 * d'empêcher la fonction de démarrer.
 */
export function parisDayKey(instant: Date): string {
  parisParts ??= new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(parisParts.formatToParts(instant).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Vrai si la date est dans la fenêtre servie autour d'aujourd'hui (à Paris). */
export function inServedWindow(key: string, todayKey: string): boolean {
  return (
    key >= addDayKeys(todayKey, -SERVED_WINDOW_PAST_DAYS) &&
    key <= addDayKeys(todayKey, SERVED_WINDOW_FUTURE_DAYS)
  );
}

/** Vrai si au moins un des sept jours de la semaine est dans la fenêtre servie. */
export function weekOverlapsServedWindow(start: string, todayKey: string): boolean {
  return weekKeysFrom(start).some((key) => inServedWindow(key, todayKey));
}
