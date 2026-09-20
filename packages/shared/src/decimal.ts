/**
 * Formatage décimal selon la locale (US NUTRI-UX02, passe 2).
 *
 * ── Pourquoi cette brique existe ─────────────────────────────────────────────────────────────────
 * Le dépôt réimplémentait `.replace('.', ',')` à **sept endroits** : `chart-tooltip`, le journal
 * alimentaire, `MicronutrientDetails`, `ProteinPerKgCard`, le rapport de séance, et deux écrans de
 * profil. Chacun avec ses propres règles d'arrondi, et aucun moyen de savoir lequel fait foi.
 *
 * Le défaut est sorti en recette device du 20/09/2026 : la carte « Le verdict de la semaine »
 * affichait « Protéines à 1.5 g/kg, sous ta fourchette de 1.8 à 2.2 » — en **point décimal** — trois
 * centimètres au-dessus d'une carte qui écrivait « 1,5 g/kg ». Elle passait ses nombres bruts à
 * i18next, qui n'a aucune raison de les localiser ; les autres cartes avaient chacune pensé à le
 * faire, la nouvelle non. C'est le genre d'incohérence qu'on ne voit pas en relisant un diff et
 * qu'on voit immédiatement sur un téléphone.
 *
 * ⚠️ Volontairement **sans `Intl.NumberFormat`** : il ajoute un séparateur de milliers et un espace
 * insécable dont aucun de ces sept appelants ne veut, et son comportement varie selon le moteur
 * Hermes embarqué. Ici la règle tient en une ligne et se teste.
 */

/** Le français est la langue par défaut du projet : locale absente = français. */
export function isFrenchLocale(locale: string | undefined): boolean {
  return locale === undefined || locale.toLowerCase().startsWith('fr');
}

/**
 * Arrondit à `decimals` décimales et rend la chaîne avec le séparateur de la locale.
 *
 * `decimals` omis : au plus 1 décimale, **sans zéro inutile** (82,0 → « 82 »), ce qui est le
 * comportement attendu d'une valeur affichée dans une phrase. Un `decimals` explicite force le
 * nombre de décimales — utile quand plusieurs valeurs sont alignées et doivent avoir la même forme.
 */
export function formatDecimal(
  value: number,
  locale: string | undefined,
  decimals?: number,
): string {
  if (!Number.isFinite(value)) return '';
  const raw =
    decimals === undefined
      ? (Math.round(value * 10) / 10).toString()
      : value.toFixed(decimals);
  return isFrenchLocale(locale) ? raw.replace('.', ',') : raw;
}
