import { z } from 'zod';

/**
 * Les trois piliers du produit. L'intégration inter-piliers est une couche
 * opt-in (décision H) : un pilier non activé voit son onglet masqué.
 * Voir docs/specs/functional/navigation-ux.md.
 */
export const PILLARS = ['strength', 'running', 'nutrition'] as const;

export const pillarSchema = z.enum(PILLARS);
export type Pillar = z.infer<typeof pillarSchema>;

/** Langues supportées dès le lancement (décision G — FR + EN). */
export const LOCALES = ['fr', 'en'] as const;

export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;
