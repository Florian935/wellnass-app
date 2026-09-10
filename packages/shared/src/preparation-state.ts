/**
 * État de préparation d'un aliment — cru ou cuit (US NUTRI-UX01, R6.7).
 *
 * ── Pourquoi c'est une règle métier et pas une décoration ────────────────────────────────────
 * 100 g de riz cru pèsent ~330 kcal ; 100 g de riz cuit, ~110. Un facteur 3 sur l'aliment le
 * plus courant d'une assiette française. La règle métier §8 exige donc « une mention **cru /
 * cuit** sur les aliments concernés » — elle n'était appliquée nulle part dans le code.
 *
 * ── Deux sources, une seule vérité affichée ──────────────────────────────────────────────────
 * La colonne `foods.preparation_state` porte l'état **déclaré** (aliments perso et scannés, qui
 * n'en avaient aucun moyen). Pour les 80 aliments de la bibliothèque CIQUAL, l'information est
 * déjà là — mais **dans le nom** (« Poulet (blanc, cuit) », « Riz basmati cuit »). Plutôt que de
 * migrer ces données à la main, on les **dérive** : la colonne prime, le nom sert de repli.
 *
 * Sans ce repli, le badge n'apparaîtrait que sur les aliments créés après cette US — c'est-à-dire
 * précisément là où l'utilisateur en a le moins besoin, puisqu'il vient de saisir la fiche.
 */

export const PREPARATION_STATES = ['raw', 'cooked'] as const;
export type PreparationState = (typeof PREPARATION_STATES)[number];

/** Marqueurs reconnus dans un nom d'aliment, par langue. */
const COOKED_MARKERS = ['cuit', 'cuite', 'cuites', 'cuits', 'cooked', 'boiled', 'grilled'];
const RAW_MARKERS = ['cru', 'crue', 'crues', 'crus', 'raw'];

/**
 * Dérive l'état d'un nom d'aliment. `null` = le nom ne dit rien, ce qui est le cas courant.
 *
 * La recherche porte sur des **mots entiers** : sans cela, « écru », « crudités » ou « biscuit »
 * déclencheraient un faux positif — et « biscuit » contient littéralement « cuit ».
 */
export function preparationStateFromName(name: string): PreparationState | null {
  const words = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/)
    .filter(Boolean);
  if (words.some((w) => COOKED_MARKERS.includes(w))) return 'cooked';
  if (words.some((w) => RAW_MARKERS.includes(w))) return 'raw';
  return null;
}

/**
 * État à afficher : la valeur déclarée si elle existe, sinon ce que dit le nom.
 *
 * L'ordre compte — un utilisateur qui déclare « cru » sur un aliment dont le nom contient
 * « cuit » (parce qu'il a dupliqué une fiche) doit voir son propre choix.
 */
export function resolvePreparationState(
  declared: PreparationState | null | undefined,
  name: string,
): PreparationState | null {
  return declared ?? preparationStateFromName(name);
}
