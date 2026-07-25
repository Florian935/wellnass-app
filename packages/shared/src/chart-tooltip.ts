/**
 * Formatage de la valeur affichée dans l'infobulle des graphiques (US UX-01). **Pur**, aucune I/O.
 *
 * Volontairement sorti des composants : c'est la seule règle métier de l'US (arrondi, séparateur
 * décimal, unité), donc la seule chose testable — le reste est du rendu et du geste, couverts en
 * recette.
 *
 * ⚠️ **Aucune conversion d'unité ici.** Les valeurs arrivent déjà converties (kg/lb, /km / /mi) par
 * `useUnits()` en amont, et `unit` est le symbole correspondant. Convertir ici doublerait la conversion.
 */

export type TooltipValueOptions = {
  /**
   * Formateur de l'appelant, **prioritaire** sur l'arrondi par défaut. Sert à rester cohérent avec un
   * axe Y formaté : l'allure est stockée en secondes et affichée « 6:52 » (`formatYLabel`). Sans lui,
   * l'infobulle afficherait « 412 » là où l'axe affiche « 6:52 ».
   */
  formatValue?: (value: number) => string;
  /** Symbole d'unité déjà localisé/converti (kg, lb, kcal, /km…). Absent ou vide = valeur seule. */
  unit?: string;
  /** Locale active. Seul le **séparateur décimal** en dépend. Défaut : français (langue du projet). */
  locale?: string;
};

/** Nombre de décimales maximum de l'arrondi par défaut. */
const MAX_FRACTION_DIGITS = 1;

/**
 * Formate une valeur de point pour l'infobulle.
 *
 * Règles, dans cet ordre :
 * 1. valeur non finie (`NaN`, `Infinity`) → **chaîne vide** (garde-fou : on n'affiche jamais « NaN ») ;
 * 2. `formatValue` fourni → il fait foi ;
 * 3. sinon arrondi à {@link MAX_FRACTION_DIGITS} décimale, **sans décimale inutile** (`82` et non `82,0`) ;
 * 4. séparateur décimal `,` en français, `.` sinon — pas de séparateur de milliers, pour rester
 *    cohérent avec les libellés d'axe existants ;
 * 5. unité accolée après une espace, omise si absente ou vide.
 */
export function formatTooltipValue(value: number, options: TooltipValueOptions): string {
  if (!Number.isFinite(value)) return '';

  const { formatValue, unit, locale } = options;

  const text = formatValue
    ? formatValue(value)
    : formatNumber(value, locale);

  return unit ? `${text} ${unit}` : text;
}

/** Arrondi à 1 décimale max, sans zéro inutile, séparateur selon la locale. */
function formatNumber(value: number, locale: string | undefined): string {
  const factor = 10 ** MAX_FRACTION_DIGITS;
  const rounded = Math.round(value * factor) / factor;
  // `toString()` supprime déjà la décimale nulle (82.0 → "82") et n'ajoute aucun séparateur de milliers.
  const raw = rounded.toString();
  return isFrench(locale) ? raw.replace('.', ',') : raw;
}

/** Le français est la langue par défaut du projet : locale absente = français. */
function isFrench(locale: string | undefined): boolean {
  return locale === undefined || locale.toLowerCase().startsWith('fr');
}
