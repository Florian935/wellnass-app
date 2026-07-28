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

/** Ce que l'utilisateur a saisi — les 3 champs sont indépendants et facultatifs (décision D3). */
export type WellbeingCheckinInput = Partial<Record<WellbeingIndicator, number | null | undefined>>;

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
  return !WELLBEING_INDICATORS.some((indicator) => isWellbeingLevel(input[indicator]));
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
  indicator: WellbeingIndicator,
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
