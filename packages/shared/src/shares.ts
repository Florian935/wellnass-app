/**
 * Répartition en parts entières qui **somment toujours à 100**.
 *
 * Extrait le 07/08/2026 (US ALLURE-01) de `computeSetTypeMix` (US EXEC-01), qui portait cette
 * mécanique seul. ALLURE-01 en avait besoin à l'identique pour les zones d'allure, et **un même
 * arrondi implémenté deux fois divergera** — au premier ajustement, une des deux barres cessera
 * d'atteindre son bord et personne ne saura laquelle est juste.
 *
 * ── Le piège que ce module existe pour éviter ────────────────────────────────────────────────────
 * Trois parts égales arrondies à l'entier donnent **33 + 33 + 33 = 99**. Une barre de progression qui
 * n'atteint pas son bord fait douter de tout l'écran qui l'entoure — et c'est le genre de défaut que
 * personne ne signale en recette, parce qu'il ressemble à un choix graphique.
 *
 * Le reliquat va donc à la **part la plus grosse**, là où un point de pourcentage est le moins visible
 * (méthode du plus grand reste, simplifiée à un seul bénéficiaire).
 */

/** Une part : sa clé, son compte brut, et son pourcentage entier. */
export type Share = {
  key: string;
  count: number;
  /** Part entière. La somme des `percent` d'un même appel vaut **exactement** 100. */
  percent: number;
};

/**
 * Les parts d'une distribution, triées de la plus grosse à la plus petite.
 *
 * Rend `null` quand le total est nul : l'appelant se tait alors plutôt que d'afficher une barre vide.
 * Les clés à compte nul sont **absentes** du résultat — une zone qu'on n'a pas touchée ne doit pas
 * apparaître à « 0 % », ce serait du bruit visuel pour une information nulle.
 *
 * ⚠️ À compte égal, le tri retombe sur l'ordre **alphabétique** des clés. Sans ce départage, deux
 * rendus successifs pourraient intervertir deux parts identiques à l'écran — un scintillement sans
 * cause apparente.
 */
export function sharesOf(counts: ReadonlyMap<string, number>): Share[] | null {
  let total = 0;
  for (const count of counts.values()) total += count;
  if (total <= 0) return null;

  // 🔴 **`shares` n'est jamais vide ici** : un total strictement positif implique au moins un compte
  // strictement positif, que le filtre conserve. Défendre le cas vide serait du code mort — le dépôt
  // les supprime plutôt que de figer un appel impossible par un test.
  const shares: Share[] = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count, percent: Math.floor((count / total) * 100) }));

  const remainder = 100 - shares.reduce((sum, s) => sum + s.percent, 0);
  shares[0]!.percent += remainder;

  return shares;
}
