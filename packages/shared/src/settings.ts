import { z } from 'zod';
import { localeSchema, PILLARS, pillarSchema } from './pillar';
import { unitSystemSchema } from './units';
import { syncFieldsSchema } from './sync';

/**
 * Thème visuel de l'interface.
 * `'system'` suit le thème système de l'appareil.
 */
export const THEMES = ['light', 'dark', 'system'] as const;
export const themeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof themeSchema>;

/**
 * Réglages utilisateur — une ligne par compte, synchronisée via PowerSync.
 * Tous les champs applicatifs ont une valeur par défaut : la ligne peut être
 * créée avec uniquement les champs de synchronisation.
 */
export const userSettingsRowSchema = syncFieldsSchema.extend({
  /** Thème visuel : clair, sombre ou système. */
  theme: themeSchema.default('system'),

  /**
   * Système d'unités affiché (indépendant de la langue).
   * Stockage toujours en métrique (SI) ; conversion à l'affichage.
   */
  units: unitSystemSchema.default('metric'),

  /** Langue de l'interface. */
  language: localeSchema.default('fr'),

  /**
   * Piliers actifs pour cet utilisateur.
   * Un pilier non activé voit son onglet masqué (décision H).
   */
  activePillars: z.array(pillarSchema).default([...PILLARS]),

  /**
   * Préférences de notifications par type.
   * Clé = identifiant de type de notification, valeur = activé/désactivé.
   */
  notifications: z.record(z.string(), z.boolean()).default({}),

  /**
   * Disposition du dashboard (JSON libre).
   * `null` = disposition par défaut non personnalisée.
   */
  dashboardLayout: z.unknown().nullable().default(null),
});

export type UserSettingsRow = z.infer<typeof userSettingsRowSchema>;
