/**
 * US LABO-02 / ECHO-01 — où mène chaque geste d'un lien, et comment on ouvre une fiche.
 *
 * Une seule table pour le Labo, les fiches, les échos des piliers et le widget de l'accueil : un même
 * geste mène au même endroit, quel que soit l'écran d'où on le fait.
 */

import type { Href } from 'expo-router';
import type { CrossLinkId, CrossLinkRoute, LabOpenTarget } from '@wellness/shared';

export const LINK_ROUTES: Record<CrossLinkRoute | LabOpenTarget, Href> = {
  planning: '/planning',
  // US NUTRI-UX03 (D14) — « noter un repas » ouvre Aujourd'hui, quel que soit le dernier onglet.
  foodSuggestion: '/nutrition?section=today',
  nutritionProfile: '/nutrition-profile',
  nutritionStats: '/nutrition-stats',
  nutritionToday: '/nutrition?section=today',
  nutritionHistory: '/nutrition?section=history',
  // US CARDIO-UX03 — l'onglet Courir, là où vit l'adaptation de la séance du jour (RUN-F4).
  runningToday: '/running?section=run',
  review: '/review',
  checkin: '/wellbeing',
  progress: '/progress',
  cycle: '/cycle',
  learn: '/lab?section=learn',
  // US BIEN-05 — le hub Bien-être, sur « Ce qui compte » (là où vit l'écho du lien).
  wellbeing: '/wellbeing-hub?section=insights',
};

/**
 * La fiche d'un lien (LABO-03). Un écran de premier niveau, `lab-link`, plutôt qu'un dossier `lab/` :
 * l'onglet du Labo répond déjà à `/lab`, et une route imbriquée sous le même segment rendrait la
 * résolution ambiguë.
 */
export function linkHref(id: CrossLinkId, from?: 'learn'): Href {
  return from === undefined ? `/lab-link?id=${id}` : `/lab-link?id=${id}&from=${from}`;
}
