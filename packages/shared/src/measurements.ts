/**
 * US MESUR-01 — briques pures des mensurations corporelles (roadmap 3.51).
 *
 * Aucune dépendance React ni base de données : du calcul, testé sous Vitest.
 *
 * Le modèle est **normalisé** (décision D1) : une ligne par `(log_date, kind, value_cm)`. La liste
 * des mesures a vocation à bouger — la spec E8 dit elle-même « etc. » —, et en table large chaque
 * ajout coûterait une migration pour des colonnes majoritairement nulles. Ces fonctions sont donc
 * écrites pour **replier** ces lignes en séries et en derniers relevés.
 *
 * Deux règles à ne pas défaire :
 * 1. **un jour non mesuré est un trou**, jamais un zéro — une courbe qui plonge parce que personne
 *    n'a sorti le mètre serait un mensonge ;
 * 2. **le delta du premier relevé est `null`, pas `0`** — « rien à comparer » et « aucun changement »
 *    sont deux informations différentes, et les confondre laisserait croire à une stagnation.
 */

/** Les 6 mesures suivies au lancement (décision D2). L'ordre est celui de la saisie. */
export const MEASUREMENT_KINDS = ['waist', 'chest', 'hips', 'arm', 'thigh', 'calf'] as const;

export type MeasurementKind = (typeof MEASUREMENT_KINDS)[number];

/** Bornes de plausibilité, en centimètres. */
export const MEASUREMENT_MIN_CM = 1;
export const MEASUREMENT_MAX_CM = 300;

/** Une ligne `body_measurements` telle qu'elle existe en base locale. */
export type MeasurementRow = {
  logDate: string;
  kind: MeasurementKind;
  valueCm: number;
  deletedAt?: string | null;
};

/** Un point de courbe. Les jours sans relevé n'y figurent pas (règle 1). */
export type MeasurementPoint = { dayKey: string; valueCm: number };

/** Un relevé et son écart avec le précédent de la même mesure. */
export type MeasurementEntry = {
  logDate: string;
  valueCm: number;
  /** `null` au **premier** relevé : il n'y a rien à comparer (règle 2). */
  deltaCm: number | null;
};

/** Vrai si la valeur est une circonférence plausible. Écarte la virgule oubliée (820 cm). */
export function isValidMeasurementCm(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MEASUREMENT_MIN_CM &&
    value <= MEASUREMENT_MAX_CM
  );
}

/** Vrai si la chaîne est un `kind` connu (garde-fou de lecture d'une ligne en base). */
export function isMeasurementKind(value: unknown): value is MeasurementKind {
  return typeof value === 'string' && (MEASUREMENT_KINDS as readonly string[]).includes(value);
}

/** Lignes vivantes et plausibles d'une mesure, du plus ancien au plus récent. */
function livingRowsOf(
  rows: ReadonlyArray<MeasurementRow>,
  kind: MeasurementKind,
): MeasurementRow[] {
  return rows
    .filter(
      (row) =>
        row.deletedAt == null &&
        row.kind === kind &&
        isValidMeasurementCm(row.valueCm) &&
        /^\d{4}-\d{2}-\d{2}$/.test(row.logDate),
    )
    .sort((a, b) => (a.logDate < b.logDate ? -1 : a.logDate > b.logDate ? 1 : 0));
}

/**
 * Série d'une mesure, prête pour la courbe, du plus ancien au plus récent.
 *
 * `sinceDayKey` borne la fenêtre (comparaison lexicographique — les clés `AAAA-MM-JJ` s'ordonnent
 * comme des dates). Omis, toute la série est renvoyée : c'est la fenêtre « Tout ».
 */
export function measurementSeries(
  rows: ReadonlyArray<MeasurementRow>,
  kind: MeasurementKind,
  sinceDayKey?: string,
): MeasurementPoint[] {
  return livingRowsOf(rows, kind)
    .filter((row) => sinceDayKey === undefined || row.logDate >= sinceDayKey)
    .map((row) => ({ dayKey: row.logDate, valueCm: row.valueCm }));
}

/**
 * Dernière valeur connue de **chaque** mesure — ce qui pré-remplit la feuille de saisie.
 *
 * Une mesure jamais relevée est **absente** de l'objet (et non à zéro) : le champ doit rester vide,
 * pas afficher un 0 que l'utilisateur enregistrerait par inadvertance.
 */
export function latestByKind(
  rows: ReadonlyArray<MeasurementRow>,
): Partial<Record<MeasurementKind, MeasurementPoint>> {
  const result: Partial<Record<MeasurementKind, MeasurementPoint>> = {};

  for (const kind of MEASUREMENT_KINDS) {
    const living = livingRowsOf(rows, kind);
    const last = living[living.length - 1];
    if (last) result[kind] = { dayKey: last.logDate, valueCm: last.valueCm };
  }

  return result;
}

/**
 * Relevés d'une mesure avec leur écart, du **plus récent au plus ancien** (ordre d'affichage).
 *
 * Le delta compare au relevé **précédent de la même mesure**, quel que soit l'écart de temps : deux
 * relevés à six mois d'intervalle se comparent quand même, c'est l'information utile.
 */
export function measurementDeltas(
  rows: ReadonlyArray<MeasurementRow>,
  kind: MeasurementKind,
): MeasurementEntry[] {
  const living = livingRowsOf(rows, kind);

  const entries: MeasurementEntry[] = living.map((row, index) => {
    const previous = index > 0 ? living[index - 1] : undefined;
    return {
      logDate: row.logDate,
      valueCm: row.valueCm,
      // Arrondi au dixième : les valeurs sont stockées en `numeric(5,1)`, et une soustraction de
      // flottants produirait sinon des « −1,4999999999999998 ».
      deltaCm:
        previous === undefined ? null : Math.round((row.valueCm - previous.valueCm) * 10) / 10,
    };
  });

  return entries.reverse();
}
