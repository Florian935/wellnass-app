/**
 * « Faut-il supprimer le mouvement ? » — la **seule** porte d'entrée de MOTION-01.
 *
 * ── Ce qu'il remplace ───────────────────────────────────────────────────────────────────────────
 * `CelebrationCard` gérait le réglage système à la main : `AccessibilityInfo.isReduceMotionEnabled()`
 * dans un effet, un écouteur `reduceMotionChanged`, un état à trois valeurs (`null` = pas encore su)
 * pour ne pas jouer l'animation avant d'avoir la réponse. C'était correct, et c'était le **seul**
 * fichier de l'app à le faire — donc un patron que quarante-quatre effets de plus auraient dû
 * recopier, avec une chance sur deux d'oublier l'écouteur.
 *
 * `useReducedMotion()` de Reanimated fait la même chose **de façon synchrone** : la valeur est
 * connue dès le premier rendu, il n'y a plus d'état intermédiaire « pas encore su » ni de risque de
 * jouer une animation une fois de trop.
 *
 * ── Pourquoi un OU, et pas une priorité ─────────────────────────────────────────────────────────
 * Réglage système actif **ou** réglage app coupé ⇒ pas de mouvement. Le réglage applicatif ne peut
 * donc que *retirer* du mouvement, jamais en rendre à quelqu'un qui a demandé au système de ne pas
 * en recevoir : l'inverse serait un défaut d'accessibilité déguisé en préférence.
 *
 * ── Ce que « pas de mouvement » veut dire ───────────────────────────────────────────────────────
 * **L'état final, tout de suite** — pas « rien ne s'affiche ». C'est la règle R1 de la spec qui
 * rend la chose sûre : aucune animation ne porte d'information, donc son absence ne cache rien.
 * Chaque primitive de `components/motion/` applique ce contrat, et c'est ce que testent leurs tests.
 *
 * ⚠️ Le retour **haptique**, lui, n'est pas du mouvement visuel : il reste actif quand les
 * animations sont coupées. Quelqu'un qui supprime les animations pour cause de sensibilité
 * vestibulaire a toujours besoin de sentir que sa série a été validée.
 */

import { useReducedMotion } from 'react-native-reanimated';
import { useMotionPreference } from '@/stores/motion-store';

/** `true` quand il ne faut produire aucun mouvement visuel. */
export function useAppReducedMotion(): boolean {
  const systemReduced = useReducedMotion();
  const appEnabled = useMotionPreference((s) => s.enabled);
  return systemReduced || !appEnabled;
}
