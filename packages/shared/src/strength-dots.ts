/**
 * US MUSCPWR-01 (catalogue MUSC-27) — **DOTS** : score de force relative au poids de corps.
 *
 * À quoi ça sert : comparer la force de deux personnes de gabarits différents, et suivre sa propre
 * progression **quand le poids de corps bouge**. Un total qui monte de 10 kg pendant qu'on prend
 * 5 kg n'est pas le même progrès qu'un total qui monte de 10 kg à poids constant — le DOTS répond
 * exactement à cette question.
 *
 * **Pourquoi DOTS et pas Wilks ni IPF GL** (décision D2) : Wilks est déprécié (l'IPF ne l'utilise
 * plus depuis 2020) ; IPF GL exige de distinguer équipé/non-équipé et le type de compétition, que
 * nous ne modélisons pas — l'afficher supposerait des données qu'on n'a pas. DOTS ne dépend que du
 * poids de corps et du sexe : c'est le seul des trois calculable **honnêtement** ici.
 *
 * ⚠️⚠️ **COEFFICIENTS À FAIRE VÉRIFIER AVANT CLÔTURE** (spec §4, point de vigilance).
 * Ils sont reproduits ci-dessous depuis la définition publique du DOTS, mais **n'ont pas pu être
 * confrontés à une source officielle** au moment de l'écriture. Un coefficient faux produit un score
 * **plausible mais faux** — donc invisible en recette, contrairement à un plantage.
 * Les tests de ce module ancrent deux choses :
 *   1. des **propriétés indépendantes des coefficients** (monotonie, sens de la normalisation,
 *      bornes) — elles resteront vraies même si un chiffre est corrigé ;
 *   2. des **valeurs figées**, qui servent de détecteur de régression, **pas** de preuve de justesse.
 * Seule une relecture par quelqu'un qui pratique peut valider le point 2 (critère de recette 21).
 *
 * Réf. : docs/specs/functional/us/muscpwr01-module-force.md
 */

/** Sexe tel que stocké dans `profiles.sex`. `'unspecified'` rend le DOTS incalculable (R6). */
export type DotsSex = 'female' | 'male' | 'unspecified';

/**
 * Polynôme du dénominateur, par sexe : `A + B·bw + C·bw² + D·bw³ + E·bw⁴`.
 * Le score vaut `total × 500 / dénominateur`.
 */
const DOTS_COEFFICIENTS: Record<'male' | 'female', readonly [number, number, number, number, number]> = {
  male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
};

/**
 * Bornes de poids de corps sur lesquelles le polynôme est défini.
 *
 * Hors bornes, on **borne** au lieu de refuser : le polynôme diverge (le terme en bw⁴ est négatif,
 * donc le dénominateur finit par s'effondrer et le score exploserait). Un score borné reste
 * interprétable ; un score de 4 000 serait absurde, et un `null` priverait d'information un
 * utilisateur réel — des poids de 35 kg ou 220 kg existent.
 */
const BODYWEIGHT_BOUNDS: Record<'male' | 'female', readonly [number, number]> = {
  male: [40, 210],
  female: [40, 150],
};

/**
 * Score DOTS, ou `null` s'il n'est pas calculable.
 *
 * `null` dans trois cas, tous volontaires :
 * - **sexe non renseigné** (R6) : les coefficients diffèrent selon le sexe et il n'existe pas de
 *   valeur neutre. Inventer un sexe pour produire un score serait à la fois faux et intrusif ;
 * - **poids de corps absent ou non positif** : c'est le dénominateur, il n'y a rien à faire sans lui ;
 * - **total absent ou non positif**.
 *
 * ⚠️ Le calcul est **toujours en kilogrammes** — c'est la définition du score (décision D9). Passer
 * des livres donnerait un score faux d'un facteur ~2,2, et *plausible*.
 */
export function dotsScore(
  totalKg: number | null | undefined,
  bodyweightKg: number | null | undefined,
  sex: DotsSex,
): number | null {
  if (sex === 'unspecified') return null;
  if (totalKg == null || !Number.isFinite(totalKg) || totalKg <= 0) return null;
  if (bodyweightKg == null || !Number.isFinite(bodyweightKg) || bodyweightKg <= 0) return null;

  const [min, max] = BODYWEIGHT_BOUNDS[sex];
  const bw = Math.min(max, Math.max(min, bodyweightKg));

  const [a, b, c, d, e] = DOTS_COEFFICIENTS[sex];
  const denominator = a + b * bw + c * bw ** 2 + d * bw ** 3 + e * bw ** 4;

  // Le polynôme est positif sur les bornes ci-dessus ; la garde couvre une correction de
  // coefficients qui les invaliderait, plutôt que de renvoyer un score négatif ou infini.
  if (denominator <= 0) return null;

  return (totalKg * 500) / denominator;
}

/** Une pesée, réduite à ce dont le DOTS a besoin. */
export type BodyweightEntry = { logDate: string; weightKg: number };

/**
 * Pesée **la plus proche** d'une date donnée (règle R7), et sa date.
 *
 * Pourquoi la plus proche et non la plus récente : un total réalisé à 75 kg il y a six mois ne se
 * normalise pas avec les 82 kg d'aujourd'hui. C'est précisément l'effet que le score sert à
 * corriger — utiliser le poids actuel le réintroduirait.
 *
 * La date est renvoyée pour que l'écran l'affiche : sans elle, le score paraît sorti de nulle part.
 * En cas d'égalité de distance, la pesée **la plus ancienne** gagne — arbitraire, mais déterministe.
 */
export function bodyweightNearest(
  entries: readonly BodyweightEntry[],
  dateIso: string,
): BodyweightEntry | null {
  const target = Date.parse(dateIso);
  if (!Number.isFinite(target)) return null;

  let best: BodyweightEntry | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    if (!Number.isFinite(entry.weightKg) || entry.weightKg <= 0) continue;
    const stamp = Date.parse(entry.logDate);
    if (!Number.isFinite(stamp)) continue;

    const distance = Math.abs(stamp - target);
    // `<` strict : à distance égale, la première rencontrée gagne. L'appelant fournit les pesées
    // triées par date croissante, donc c'est la plus ancienne — déterministe.
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }

  return best;
}
