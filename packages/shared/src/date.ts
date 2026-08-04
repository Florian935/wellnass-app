/** Clé de jour local AAAA-MM-JJ (pour agréger séances/courses UTC et journées nutrition/poids locales). */
export function localDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Inverse de `localDayKey` : minuit **local** du jour désigné par la clé `AAAA-MM-JJ`.
 *
 * Ne jamais passer par `new Date('2026-07-12')` pour ça : la spec ECMAScript parse une date seule
 * en **UTC**, donc dans un fuseau négatif on obtiendrait la veille. On découpe la chaîne et on
 * construit la date par composants, ce qui la rend locale par construction.
 *
 * Sert à reconstruire une `Date` depuis la clé réactive du jour courant (`useTodayKey` côté mobile) :
 * une seule valeur réactive à la racine, tout le reste en dérive.
 */
export function localDateFromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

/** Jour de semaine ISO : 0 = lundi … 6 = dimanche (JS getDay() est 0 = dimanche). */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Nouvelle date décalée de `n` jours (préserve l'heure locale ; usage sur dates calendaires). */
export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Lundi de la semaine contenant `d`. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -weekdayIndex(d));
}

/**
 * Nombre de jours de la fenêtre « semaine » des stats : **fenêtre glissante** de 7 jours
 * (aujourd'hui + 6 jours précédents), et non la semaine calendaire lundi→dimanche.
 */
export const ROLLING_WEEK_DAYS = 7;

/**
 * Minuit local du jour situé `daysAgo` jours avant `ref` (aujourd'hui = 0, hier = 1…).
 * Sert de borne basse, jour-alignée, aux fenêtres glissantes de stats. `ref` injectable
 * pour tester ; converti en ISO UTC par l'appelant (`.toISOString()`) pour comparer aux
 * timestamps stockés en UTC.
 */
export function localMidnightDaysAgo(daysAgo: number, ref: Date = new Date()): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - daysAgo, 0, 0, 0, 0);
}

/** Minuit local du 1er janvier de l'année de `ref` (US MUSC-19, spec D1/R2). */
export function localStartOfYear(ref: Date = new Date()): Date {
  return new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
}

/**
 * Bornes basses (minuit local) des `count` fenêtres glissantes de 7 jours consécutives,
 * la plus récente en premier : `[aujourd'hui−6, aujourd'hui−13, …]`. Pour les graphiques
 * de tendance « par semaine » (désormais 7 jours glissants, pas de semaines calendaires).
 */
export function rollingWeekStarts(count: number, ref: Date = new Date()): Date[] {
  return Array.from({ length: count }, (_, i) =>
    localMidnightDaysAgo(ROLLING_WEEK_DAYS - 1 + ROLLING_WEEK_DAYS * i, ref),
  );
}

/**
 * Nombre de jours calendaires de `fromKey` à `toKey` (clés locales AAAA-MM-JJ).
 * Calcul via midi UTC → insensible aux transitions d'heure d'été (DST-safe).
 */
export function daysBetween(fromKey: string, toKey: string): number {
  const toMs = (key: string): number => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!, 12);
  };
  return Math.round((toMs(toKey) - toMs(fromKey)) / 86_400_000);
}

/**
 * Formate une date en **JJ/MM/AAAA** (convention du projet), pour l'affichage utilisateur.
 *
 * Accepte les **deux** formes qui circulent dans l'app, et c'est tout l'intérêt :
 * - une **clé de jour** `YYYY-MM-DD` (journal nutrition `log_date`, `dayKey` running) → les champs sont
 *   lus **directement dans la chaîne**. Passer par `new Date('2026-07-12')` la parserait à **minuit UTC**
 *   puis `getDate()` la rendrait en heure locale : dans un fuseau négatif on afficherait **la veille**.
 * - un **timestamp ISO complet** (date de séance) → parsé, puis rendu avec les getters **locaux** : la
 *   séance s'affiche au jour où elle a eu lieu pour l'utilisateur.
 *
 * Renvoie une chaîne vide si l'entrée est vide ou impossible à interpréter (jamais « NaN/NaN/NaN »).
 */
export function formatDayFull(value: string | null | undefined): string {
  if (!value) return '';

  // Clé de jour pure (`YYYY-MM-DD`, éventuellement rien derrière) → lecture littérale, sans fuseau.
  const dayKeyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dayKeyMatch) {
    const [, yyyy, mm, dd] = dayKeyMatch;
    return `${dd}/${mm}/${yyyy}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
