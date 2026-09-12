/**
 * Jetons de mouvement — l'équivalent de `colors.ts` pour le temps.
 *
 * ── Pourquoi un fichier de jetons plutôt que des durées au cas par cas ──────────────────────────
 * Avant cette US, l'app comptait exactement **une** animation (`CelebrationCard`, 320 ms écrites en
 * dur) et deux usages de Reanimated, tous deux dans le glisser-déposer. À partir du moment où l'on
 * en pose quarante-cinq, les valeurs en dur deviennent le problème : deux cartes voisines animées à
 * 240 et 300 ms ne se lisent pas comme un système, elles se lisent comme une négligence.
 *
 * ── Ce que ce fichier ne contient pas ───────────────────────────────────────────────────────────
 * **Aucune couleur.** Le mouvement ne connaît pas la palette : un effet qui aurait besoin d'une
 * couleur la reçoit de `useTheme()`. Garder les deux séparés évite qu'un changement de thème passe
 * par ici, et qu'un changement de rythme touche aux contrastes validés par CONF-07.
 *
 * ── Une physique par pilier (spec §1) ───────────────────────────────────────────────────────────
 * Les quatre familles ci-dessous ne sont pas décoratives : chaque pilier a une réalité physique et
 * le mouvement la reprend. Un ressort d'impact sur une jauge de calories serait un contresens —
 * voir `SPRING.impact` et `EASING.fill`, volontairement incompatibles.
 */

import { Easing } from 'react-native-reanimated';

/**
 * Durées, en millisecondes.
 *
 * Le palier compte plus que la valeur exacte : ce qui doit se voir, c'est qu'un enfoncement au
 * doigt (`instant`) et un chiffre qui change (`data`) n'appartiennent pas au même monde.
 */
export const DURATION = {
  /** Niveau 0 — l'enfoncement sous le doigt. Le seul autorisé partout. */
  instant: 90,
  /** Bascule, chip, changement de sélection. */
  quick: 160,
  /** Niveau 1 — entrée de carte, transition d'écran, cascade. */
  base: 240,
  /** Niveau 2 — une valeur qui change : anneau, barre, compteur. */
  data: 420,
  /** Niveau 3 — record, séance bouclée, objectif atteint. Rare par construction. */
  celebrate: 700,
  /** Boucles de fond : halo qui respire, pulsation GPS, vagues d'hydratation. */
  ambient: 2400,
} as const;

/**
 * Décalage entre deux éléments d'une cascade d'entrée, et **plafond du nombre d'éléments décalés**.
 *
 * Le plafond est la partie qui compte. Sans lui, une grille de douze widgets fait attendre le
 * dernier 480 ms après le premier : le décalage cesse d'être une élégance et devient une latence.
 * Au-delà du sixième, tout le monde arrive avec le même retard.
 */
export const STAGGER = 40;
export const STAGGER_MAX = 6;

/** Retard d'un élément de rang `index` dans une cascade, plafonné. */
export function staggerDelay(index: number): number {
  const rank = Math.max(0, Math.min(STAGGER_MAX - 1, Math.floor(index)));
  return rank * STAGGER;
}

/**
 * Ressorts. `damping` / `stiffness` / `mass` sont les paramètres de `withSpring`.
 *
 * ⚠️ Un ressort **dépasse puis revient** : c'est exactement ce qu'on veut pour un impact, et
 * exactement ce qu'on ne veut pas sur une donnée surveillée (règle R6 — une jauge de calories qui
 * dépasse affiche un chiffre faux pendant une fraction de seconde). Pour ces cas-là, `EASING.fill`.
 */
export const SPRING = {
  /**
   * **Musculation.** Raide, court, franc : le geste est fini avant que l'œil n'arrive. C'est le
   * ressort de la validation de série — répétée 30 à 40 fois par séance, elle ne peut pas traîner.
   */
  impact: { damping: 18, stiffness: 420, mass: 0.7 },
  /** Générique — l'enfoncement au doigt, la pastille d'onglet. Se pose sans osciller. */
  settle: { damping: 24, stiffness: 260, mass: 1 },
  /** Apparition qui doit se remarquer : toast de record, jour de streak qui s'allume. */
  pop: { damping: 14, stiffness: 300, mass: 1 },
} as const;

/**
 * Courbes. `EASING.fill` et `EASING.flow` portent l'identité de deux piliers.
 */
export const EASING = {
  /**
   * **Nutrition.** Décélération pure, overshoot zéro (règle R6). Manger, c'est remplir : ça monte
   * et ça se pose. Une jauge qui rebondit serait un contresens sur la métaphore *et* un chiffre
   * faux à l'écran.
   */
  fill: Easing.bezier(0.22, 0.61, 0.36, 1),
  /**
   * **Course.** Vitesse constante, ni début ni fin. Sert aux boucles qui doivent donner
   * l'impression que rien ne démarre et que rien ne s'arrête : pointillés du tracé, anneau du
   * timer de repos (qui se vide à vitesse réelle, donc linéairement).
   */
  flow: Easing.linear,
  /**
   * **Accueil / bien-être.** Part et revient sans fin. Assez lent pour qu'on ne le remarque pas —
   * on remarquerait son absence.
   */
  breath: Easing.inOut(Easing.sin),
  /** Sortie d'écran, disparition : l'inverse de `fill`. */
  exit: Easing.bezier(0.4, 0, 1, 1),
} as const;

/** Amplitude d'une respiration de fond. Au-delà, le halo devient une pulsation qui attire l'œil. */
export const BREATH_SCALE = 1.07;

/** Enfoncement d'un élément pressé. Assez pour être senti, trop court pour être attendu. */
export const PRESS_SCALE = 0.97;
