/**
 * US EXEC-01 (roadmap 3.58, catalogue MUSC-13) — répartition des séries par type.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── Le seul vrai piège de ce module : les arrondis ───────────────────────────────────────────────
 * Trois parts égales arrondies à l'entier donnent 33 + 33 + 33 = **99**, et une barre qui n'atteint
 * pas son bord fait douter de tout le reste de l'écran. La plus grosse part absorbe donc le reliquat
 * (méthode du plus grand reste, simplifiée) : le total est **toujours** 100.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SetTypeShare = {
  /** Valeur brute de `workout_sets.set_type` — l'appelant résout le libellé i18n. */
  setType: string;
  count: number;
  /** Part entière en pourcentage. La somme des parts vaut exactement 100. */
  percent: number;
};

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

/**
 * Répartition des séries **validées** par type, triée de la plus fréquente à la plus rare.
 *
 * Rend `null` quand aucune série n'est exploitable : l'écran se tait plutôt que d'afficher une barre
 * vide. Seules les séries `done` comptent (spec R5) — une série planifiée non faite ne dit rien du
 * style d'entraînement.
 *
 * ⚠️ Un `set_type` inconnu (valeur ajoutée en base après ce code) est **conservé tel quel**, jamais
 * filtré : le perdre ferait un total inférieur à 100 sans que personne comprenne pourquoi. C'est à
 * la couche i18n de choisir un libellé de repli.
 */
export function computeSetTypeMix(input: {
  sets: ReadonlyArray<{ setType: string; done: boolean }>;
}): SetTypeShare[] | null {
  const counts = new Map<string, number>();
  for (const s of input.sets) {
    if (!s.done) continue;
    counts.set(s.setType, (counts.get(s.setType) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, c) => sum + c, 0);
  if (total === 0) return null;

  // Tri d'abord : le reliquat d'arrondi doit atterrir sur la part la plus grosse, où il est le moins
  // visible. À égalité de compte, l'ordre alphabétique rend la sortie déterministe — sans quoi deux
  // rendus successifs pourraient intervertir deux parts identiques.
  const shares = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([setType, count]) => ({ setType, count, percent: Math.floor((count / total) * 100) }));

  const remainder = 100 - shares.reduce((sum, s) => sum + s.percent, 0);
  shares[0]!.percent += remainder;

  return shares;
}
