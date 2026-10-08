import { z } from 'zod';

/**
 * Les trois piliers du produit. L'intégration inter-piliers est une couche
 * opt-in (décision H) : un pilier non activé voit son onglet masqué.
 * Voir docs/specs/functional/navigation-ux.md.
 */
export const PILLARS = ['strength', 'running', 'nutrition'] as const;

export const pillarSchema = z.enum(PILLARS);
export type Pillar = z.infer<typeof pillarSchema>;

/**
 * Piliers actifs, avec repli explicite (US REFACTO-01) : `null`/`undefined` (réglages pas encore
 * chargés) → **tous** les piliers, jamais un sous-ensemble deviné. Source **unique** de ce repli —
 * remplace ~10 copies en ligne de `settings?.activePillars ?? [...PILLARS]`, dont une était
 * désynchronisée de `PILLARS` (`weekly-review-repository.ts`).
 *
 * Un tableau **vide** saisi n'est pas une absence de donnée : il n'est pas retombé sur le repli.
 */
export function resolveActivePillars(activePillars: readonly Pillar[] | null | undefined): Pillar[] {
  return activePillars ? [...activePillars] : [...PILLARS];
}

/**
 * Garde de la colonne `active_pillars` une fois décodée : un tableau de piliers **connus**. Sans elle,
 * une ligne corrompue (JSON trop profondément encodé) laissait passer une **chaîne** typée `Pillar[]`
 * (crash rejeu, fix/onboarding-rejeu-profil). À passer à `parseJsonColumn`.
 *
 * Sortie de `settings-repository.ts` et `home-widget-data.ts` (deux copies) par **NORYN-01** : la
 * fonction `noryn-context` décode les piliers actifs exactement comme l'app.
 */
export function isPillarArray(value: unknown): value is Pillar[] {
  return Array.isArray(value) && value.every((p) => (PILLARS as readonly string[]).includes(p as string));
}

/** Langues supportées dès le lancement (décision G — FR + EN). */
export const LOCALES = ['fr', 'en'] as const;

export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;
