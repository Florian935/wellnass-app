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

/** Langues supportées dès le lancement (décision G — FR + EN). */
export const LOCALES = ['fr', 'en'] as const;

export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;
