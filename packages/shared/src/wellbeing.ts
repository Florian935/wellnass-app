/**
 * US BIEN-01 — briques pures du check-in de bien-être (roadmap 1.24).
 *
 * Aucune dépendance React ni base de données : du calcul, testé sous Vitest. L'écran et le
 * repository ne font que des entrées/sorties par-dessus.
 *
 * Trois règles structurent ce fichier, et ce sont les trois endroits où l'on se trompe :
 * 1. **un jour non renseigné est un trou, jamais un zéro** — matérialiser des zéros fabriquerait un
 *    historique faux (courbe qui plonge, moyennes tirées vers le bas) pour des jours où l'utilisateur
 *    n'a simplement rien dit. Même principe que `toDailySteps` qui écarte les totaux nuls ;
 * 2. **les moyennes ne portent que sur les jours renseignés** (patron `averageIntake` du journal
 *    nutrition) — sinon une semaine à 2 check-ins ressemble à une mauvaise semaine ;
 * 3. **la fenêtre de rattrapage est bornée** (décision D4) : réécrire un mois de journal le rendrait
 *    faux, et fausserait les corrélations récup ↔ perfs que cette donnée doit alimenter plus tard.
 */

import { daysBetween } from './date';
import { SHORT_NIGHT_MINUTES } from './lab-week';

/** Bornes de l'échelle subjective (décision D2 : 1-5, pas 1-10). */
export const WELLBEING_SCALE_MIN = 1;
export const WELLBEING_SCALE_MAX = 5;

/**
 * Largeur totale de la fenêtre de saisie, en jours (décision D4) : le jour courant **plus** les
 * 6 précédents. Oublier hier est normal ; réécrire l'avant-dernière semaine ne l'est pas.
 */
export const WELLBEING_CATCHUP_DAYS = 7;

/**
 * Les 3 indicateurs (décision D1). L'ordre est celui de la saisie et de l'affichage.
 *
 * ⚠️ `stress` se lit **à l'envers** des deux autres : 5 = beaucoup de stress = mauvais. Aucune
 * moyenne ni aucun calcul de ce fichier ne suppose qu'une valeur haute est « bonne » — c'est
 * l'affichage (libellés, jamais la couleur seule) qui porte ce sens.
 */
export const WELLBEING_INDICATORS = ['mood', 'energy', 'stress'] as const;

export type WellbeingIndicator = (typeof WELLBEING_INDICATORS)[number];

/** Un niveau valide de l'échelle, 1 à 5. */
export type WellbeingLevel = 1 | 2 | 3 | 4 | 5;

/**
 * US LABO-01 — la **nuit qui précède** le check-in, en minutes. Facultative, indépendante des trois
 * indicateurs (même décision D3). Bornée à 14 h : au-delà, c'est une erreur de saisie, pas une nuit.
 * Le pas de saisie est d'un quart d'heure — la précision d'une montre n'apporte rien à ce qu'on en fait.
 */
export const SLEEP_MINUTES_MIN = 0;
export const SLEEP_MINUTES_MAX = 14 * 60;
export const SLEEP_MINUTES_STEP = 15;

/**
 * US BIEN-03 — les échelles ajoutées par le pilier Bien-être (décision D5 du 01/10/2026), et la faim
 * du soir (module, décision D6). Mêmes règles que les trois indicateurs de BIEN-01 : 1 à 5, un libellé
 * par niveau, toutes facultatives, et un jour sans valeur est un trou.
 *
 * ⚠️ `sleepQuality` et `motivation` montent vers le **favorable** (5 = nuit réparatrice, très envie) ;
 * `cravings` monte vers le **défavorable** (5 = fringales fortes), comme `stress`. C'est l'affichage
 * (libellés) qui porte ce sens, jamais une couleur seule.
 */
export const WELLBEING_EXTRA_SCALES = ['sleepQuality', 'motivation', 'cravings'] as const;
export type WellbeingExtraScale = (typeof WELLBEING_EXTRA_SCALES)[number];

/** Toutes les échelles 1-5 du check-in, dans l'ordre de stockage. */
export type WellbeingScaleKey = WellbeingIndicator | WellbeingExtraScale;
export const WELLBEING_SCALE_KEYS: readonly WellbeingScaleKey[] = [...WELLBEING_INDICATORS, ...WELLBEING_EXTRA_SCALES];

/**
 * US BIEN-03 — les étiquettes du jour (décision D5) : une **liste fermée**, un tap, analysable. Le
 * texte libre reste écarté (BIEN-01 §2) : il ne se croise avec rien et pose une question RGPD.
 */
export const WELLBEING_TAGS = ['sick', 'busyDay', 'lateNight', 'travel'] as const;
export type WellbeingTag = (typeof WELLBEING_TAGS)[number];

/** Les étiquettes proposées au réveil (ce qu'on sait le matin) et le soir (ce qu'on sait du jour). */
export const MORNING_TAGS: readonly WellbeingTag[] = ['sick', 'travel'];
export const EVENING_TAGS: readonly WellbeingTag[] = ['busyDay', 'lateNight'];

/** US BIEN-07 — les modules du pilier, éteints par défaut (décision D6). */
export const WELLBEING_MODULES = ['alcohol', 'caffeine', 'nap', 'cravings'] as const;
export type WellbeingModule = (typeof WELLBEING_MODULES)[number];

/** Verres d'alcool la veille au soir : 0, 1, 2, ou « 3 et plus » (stocké 3). Rien au-delà. */
export const ALCOHOL_DRINKS_MAX = 3;

/** Sieste du jour, en minutes. Au-delà de 3 h, ce n'est plus une sieste. Pas de saisie : 10 min. */
export const NAP_MINUTES_MAX = 180;
export const NAP_MINUTES_STEP = 10;

/** Vrai si la valeur est un nombre de verres stockable (0 à 3, entier). */
export function isAlcoholDrinks(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= ALCOHOL_DRINKS_MAX;
}

/** Vrai si la valeur est une durée de sieste stockable (entier, 0 à 3 h). */
export function isNapMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= NAP_MINUTES_MAX;
}

/** Ce que l'utilisateur a saisi — les champs sont indépendants et facultatifs (décision D3). */
export type WellbeingCheckinInput = Partial<Record<WellbeingScaleKey, number | null | undefined>> &
  Partial<Record<WellbeingTag, boolean | null | undefined>> & {
    sleepMinutes?: number | null;
    /**
     * US BIEN-07 — verres bus **ce jour-là**, saisis au check-in du soir (module « alcool »). Les liens
     * lisent donc l'alcool d'un jour J contre la nuit et la course de J+1.
     */
    alcoholDrinks?: number | null;
    /** US BIEN-07 — « un café après 16 h ? » (module « caféine »). `null` = pas répondu. */
    lateCaffeine?: boolean | null;
    /** US BIEN-07 — sieste du jour (module « sieste »). */
    napMinutes?: number | null;
  };

/** Vrai si la durée est une nuit exploitable (entier, 0 à 14 h). */
export function isSleepMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= SLEEP_MINUTES_MIN && value <= SLEEP_MINUTES_MAX;
}

/** Une ligne `daily_wellbeing` telle qu'elle existe en base locale. */
export type LocalWellbeing = WellbeingCheckinInput & {
  logDate: string;
  deletedAt?: string | null;
};

/** Un point de courbe : une valeur à une date. Les jours sans valeur n'y figurent pas (règle 1). */
export type WellbeingPoint = { dayKey: string; value: number };

/** Moyenne d'un indicateur et nombre de jours sur lesquels elle porte (règle 2). */
export type WellbeingAverage = { average: number | null; days: number };

/** Vrai si la valeur est un niveau exploitable de l'échelle. Tout le reste est écarté. */
export function isWellbeingLevel(value: unknown): value is WellbeingLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= WELLBEING_SCALE_MIN &&
    value <= WELLBEING_SCALE_MAX
  );
}

/**
 * Vrai si le check-in n'apporte **aucun** indicateur exploitable — auquel cas il ne faut rien
 * écrire en base plutôt que de créer une ligne vide.
 *
 * Une valeur hors échelle est traitée comme absente : elle ne suffit pas à rendre le check-in valide.
 * Le contrôle vit ici, et non dans une contrainte SQL, pour ne pas compliquer l'édition (retirer un
 * indicateur d'une ligne existante doit rester possible).
 */
export function isEmptyCheckin(input: WellbeingCheckinInput): boolean {
  // US LABO-01 : une nuit seule suffit à faire un check-in — c'est souvent la seule chose qu'on
  // retient au réveil.
  // US BIEN-03 : une étiquette cochée (« malade ») ou une réponse d'un module en est un aussi. Une
  // étiquette DÉCOCHÉE, elle, n'apporte rien : elle ne doit pas créer une ligne à elle seule.
  return (
    !WELLBEING_SCALE_KEYS.some((key) => isWellbeingLevel(input[key])) &&
    !isSleepMinutes(input.sleepMinutes) &&
    !WELLBEING_TAGS.some((tag) => input[tag] === true) &&
    !isAlcoholDrinks(input.alcoholDrinks) &&
    typeof input.lateCaffeine !== 'boolean' &&
    !isNapMinutes(input.napMinutes)
  );
}

/**
 * Vrai si ce jour est encore ouvert à la saisie (décision D4) : entre J-6 et aujourd'hui inclus.
 *
 * Le futur est refusé, et une clé de jour illisible aussi — mieux vaut refuser que laisser passer
 * une date qu'on n'a pas comprise.
 */
export function canEditDay(logDate: string, todayKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) return false;

  const age = daysBetween(logDate, todayKey);
  return age >= 0 && age <= WELLBEING_CATCHUP_DAYS - 1;
}

/** Lignes vivantes de la fenêtre, du plus ancien au plus récent. */
function livingRowsWithin(
  rows: ReadonlyArray<LocalWellbeing>,
  days: number,
  todayKey: string,
): LocalWellbeing[] {
  return rows
    .filter((row) => {
      if (row.deletedAt != null) return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.logDate)) return false;

      const age = daysBetween(row.logDate, todayKey);
      return age >= 0 && age < days;
    })
    .sort((a, b) => (a.logDate < b.logDate ? -1 : a.logDate > b.logDate ? 1 : 0));
}

/**
 * Série d'un indicateur sur une fenêtre glissante, prête pour la courbe.
 *
 * Un jour dont **cet** indicateur est nul est omis, même si les autres sont remplis (conséquence de
 * la saisie partielle, décision D3) : la courbe de l'humeur ne doit pas inventer une valeur parce
 * que l'énergie, elle, a été saisie.
 */
export function wellbeingSeries(
  rows: ReadonlyArray<LocalWellbeing>,
  indicator: WellbeingScaleKey,
  days: number,
  todayKey: string,
): WellbeingPoint[] {
  const points: WellbeingPoint[] = [];

  for (const row of livingRowsWithin(rows, days, todayKey)) {
    const value = row[indicator];
    if (isWellbeingLevel(value)) points.push({ dayKey: row.logDate, value });
  }

  return points;
}

/**
 * Moyenne de chaque indicateur sur la fenêtre, **jours renseignés seulement** (règle 2), avec le
 * nombre de jours qui la fonde — à afficher à côté de la moyenne : « 3,4 sur 5 jours » est une
 * information, « 3,4 » tout seul est trompeur.
 */
export function wellbeingAverages(
  rows: ReadonlyArray<LocalWellbeing>,
  days: number,
  todayKey: string,
): Record<WellbeingIndicator, WellbeingAverage> {
  const living = livingRowsWithin(rows, days, todayKey);

  const result = {} as Record<WellbeingIndicator, WellbeingAverage>;
  for (const indicator of WELLBEING_INDICATORS) {
    const values = living
      .map((row) => row[indicator])
      .filter((value): value is WellbeingLevel => isWellbeingLevel(value));

    result[indicator] =
      values.length === 0
        ? { average: null, days: 0 }
        : {
            average: values.reduce((sum, value) => sum + value, 0) / values.length,
            days: values.length,
          };
  }

  return result;
}

/**
 * US BIEN-02 — moyenne d'une échelle quelconque (y compris celles du pilier), jours renseignés
 * seulement — même règle 2 que `wellbeingAverages`.
 */
export function wellbeingScaleAverage(
  rows: ReadonlyArray<LocalWellbeing>,
  key: WellbeingScaleKey,
  days: number,
  todayKey: string,
): WellbeingAverage {
  const values = livingRowsWithin(rows, days, todayKey)
    .map((row) => row[key])
    .filter((value): value is WellbeingLevel => isWellbeingLevel(value));
  if (values.length === 0) return { average: null, days: 0 };
  return { average: values.reduce((sum, value) => sum + value, 0) / values.length, days: values.length };
}

// ---------------------------------------------------------------------------
// US BIEN-03 — le check-in en deux temps (décision D4 du 01/10/2026)
// ---------------------------------------------------------------------------

/**
 * Deux moments de dix secondes plutôt qu'un long : le **matin** répond à « que faire aujourd'hui ? »
 * (la nuit, sa qualité, l'énergie, l'envie), le **soir** à « comment s'est passée la journée ? »
 * (humeur, stress, étiquettes). Les deux écrivent la **même ligne** : celle du jour civil local.
 */
export type CheckinMoment = 'morning' | 'evening';

/** Avant cette heure, on propose le matin quoi qu'il arrive. */
export const CHECKIN_MORNING_UNTIL_HOUR = 12;
/** À partir de cette heure, on propose le soir quoi qu'il arrive. */
export const CHECKIN_EVENING_FROM_HOUR = 17;

/** Le matin est fait dès qu'**un** de ses gestes l'est (saisie partielle, décision D3 de BIEN-01). */
export function hasMorningCheckin(entry: WellbeingCheckinInput | null | undefined): boolean {
  if (!entry) return false;
  return (
    isSleepMinutes(entry.sleepMinutes) ||
    isWellbeingLevel(entry.sleepQuality) ||
    isWellbeingLevel(entry.energy) ||
    isWellbeingLevel(entry.motivation) ||
    MORNING_TAGS.some((tag) => entry[tag] === true)
  );
}

/** Le soir est fait dès qu'un de ses gestes l'est. */
export function hasEveningCheckin(entry: WellbeingCheckinInput | null | undefined): boolean {
  if (!entry) return false;
  return (
    isWellbeingLevel(entry.mood) ||
    isWellbeingLevel(entry.stress) ||
    isWellbeingLevel(entry.cravings) ||
    EVENING_TAGS.some((tag) => entry[tag] === true) ||
    isAlcoholDrinks(entry.alcoholDrinks) ||
    typeof entry.lateCaffeine === 'boolean' ||
    isNapMinutes(entry.napMinutes)
  );
}

/**
 * Le moment à proposer à cette heure. Entre midi et 17 h, c'est le matin tant qu'il n'est pas fait —
 * un réveil tardif ou un oubli ne doit pas faire sauter la nuit, qui est la donnée la plus utile.
 */
export function suggestCheckinMoment(hour: number, entry: WellbeingCheckinInput | null | undefined): CheckinMoment {
  if (hour < CHECKIN_MORNING_UNTIL_HOUR) return 'morning';
  if (hour >= CHECKIN_EVENING_FROM_HOUR) return 'evening';
  return hasMorningCheckin(entry) ? 'evening' : 'morning';
}

// ---------------------------------------------------------------------------
// US BIEN-04 — la nuit « courte ou agitée »
// ---------------------------------------------------------------------------

/** Une qualité à ce niveau ou en dessous (« mauvaise », « agitée ») vaut une nuit courte. */
export const POOR_SLEEP_QUALITY = 2;

/**
 * La nuit qui précède ce check-in était-elle **courte ou agitée** ? Moins de 6 h (le repère du Labo,
 * `SHORT_NIGHT_MINUTES`, jamais un second chiffre), **ou** une qualité de 1 ou 2.
 *
 * `null` quand on n'en sait rien — ni durée ni qualité. Un « non » se prouve : une nuit inconnue
 * n'est pas une bonne nuit.
 */
export function isPoorNight(entry: { sleepMinutes?: number | null; sleepQuality?: number | null } | null | undefined): boolean | null {
  if (!entry) return null;
  const minutesKnown = isSleepMinutes(entry.sleepMinutes);
  const qualityKnown = isWellbeingLevel(entry.sleepQuality);
  if (!minutesKnown && !qualityKnown) return null;
  if (minutesKnown && (entry.sleepMinutes as number) < SHORT_NIGHT_MINUTES) return true;
  if (qualityKnown && (entry.sleepQuality as number) <= POOR_SLEEP_QUALITY) return true;
  return false;
}

// ---------------------------------------------------------------------------
// US BIEN-02 — le garde-fou « humeur basse » (décision D7)
// ---------------------------------------------------------------------------

/** Une humeur à ce niveau ou en dessous (« très maussade », « maussade ») compte comme basse. */
export const LOW_MOOD_LEVEL = 2;
/** Combien des derniers jours renseignés doivent être bas. */
export const LOW_MOOD_MIN_DAYS = 5;
/** Sur combien des derniers jours **renseignés** on regarde. */
export const LOW_MOOD_RECENT_ENTRIES = 7;
/** On ne remonte pas plus loin : une humeur d'il y a trois semaines ne dit rien d'aujourd'hui. */
export const LOW_MOOD_LOOKBACK_DAYS = 14;
/** Entre deux apparitions de la carte : elle ne doit jamais devenir un rappel. */
export const LOW_MOOD_COOLDOWN_DAYS = 14;

/**
 * Faut-il montrer la carte « ça ne va pas fort ces jours-ci » ?
 *
 * Règle (décision D7, seuil **à faire relire par une personne compétente** avant la sortie) :
 * parmi les 7 derniers jours où l'humeur a été notée — dans les 14 derniers jours civils —, au
 * moins 5 sont à 1 ou 2. Et la carte n'est pas apparue depuis 14 jours.
 *
 * Ce que la règle ne fait PAS, volontairement : commenter une journée isolée, compter un jour sans
 * saisie comme un jour bas, ou se déclencher sur trois mauvais jours de suite.
 */
export function shouldShowLowMoodCard(
  rows: ReadonlyArray<LocalWellbeing>,
  todayKey: string,
  lastShownKey: string | null,
): boolean {
  if (lastShownKey !== null && /^\d{4}-\d{2}-\d{2}$/.test(lastShownKey)) {
    const since = daysBetween(lastShownKey, todayKey);
    if (since >= 0 && since < LOW_MOOD_COOLDOWN_DAYS) return false;
  }
  const recent = livingRowsWithin(rows, LOW_MOOD_LOOKBACK_DAYS, todayKey)
    .filter((row) => isWellbeingLevel(row.mood))
    .slice(-LOW_MOOD_RECENT_ENTRIES);
  if (recent.length < LOW_MOOD_MIN_DAYS) return false;
  const low = recent.filter((row) => (row.mood as number) <= LOW_MOOD_LEVEL).length;
  return low >= LOW_MOOD_MIN_DAYS;
}
