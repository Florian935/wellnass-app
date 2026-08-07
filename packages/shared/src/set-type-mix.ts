/**
 * US EXEC-01 (roadmap 3.58, catalogue MUSC-13) — répartition des séries par type.
 *
 * Aucune dépendance React ni base : du calcul, testé sous Vitest.
 *
 * ── Le seul vrai piège de ce module : les arrondis ───────────────────────────────────────────────
 * Trois parts égales arrondies à l'entier donnent 33 + 33 + 33 = **99**, et une barre qui n'atteint
 * pas son bord fait douter de tout le reste de l'écran.
 *
 * Cette mécanique vivait ici ; elle est **extraite dans `sharesOf`** depuis le 07/08/2026, parce
 * qu'ALLURE-01 en avait besoin à l'identique pour les zones d'allure. Un même arrondi implémenté deux
 * fois divergera — au premier ajustement, une des deux barres cesserait d'atteindre son bord et
 * personne ne saurait laquelle est juste.
 */

import { sharesOf } from './shares';

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

  // Tri, arrondi et reliquat sont dans `sharesOf` : tri par part décroissante, départage alphabétique
  // à égalité, et somme garantie à 100.
  const shares = sharesOf(counts);
  if (shares === null) return null;

  return shares.map(({ key, count, percent }) => ({ setType: key, count, percent }));
}
