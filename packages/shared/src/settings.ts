import { z } from 'zod';
import { localeSchema, PILLARS, pillarSchema } from './pillar';
import { unitSystemSchema } from './units';
import { syncFieldsSchema } from './sync';
import { defaultNotificationPrefs } from './notifications';

/**
 * Schéma Zod des préférences de notifications (voir `notifications.ts`).
 * Les heures sont bornées à [0, 23] et `maxPerDay >= 1`. La forme est validée
 * ici ; le parse *tolérant* des anciennes valeurs (colonne enrichie sans
 * migration) reste à la charge de `parseNotificationPrefs` côté repository.
 */
const hourSchema = z.number().int().min(0).max(23);
export const notificationPrefsSchema = z.object({
  streakDanger: z.boolean(),
  reminderHour: hourSchema,
  dndEnabled: z.boolean(),
  dndStartHour: hourSchema,
  dndEndHour: hourSchema,
  maxPerDay: z.number().int().min(1),
});

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
   * Préférences de notifications (rappel streak, Ne pas déranger, max/jour).
   * Objet typé `NotificationPrefs` — colonne enrichie depuis l'ancien
   * `Record<string, boolean>` **sans migration** : le parse tolérant
   * (`parseNotificationPrefs`) applique les défauts aux anciennes valeurs.
   */
  notifications: notificationPrefsSchema.default(defaultNotificationPrefs()),

  /**
   * Disposition du dashboard (JSON libre).
   * `null` = disposition par défaut non personnalisée.
   */
  dashboardLayout: z.unknown().nullable().default(null),

  /** Consentement analytics (opt-out : true par défaut). US 9.10. */
  analyticsEnabled: z.boolean().default(true),

  /**
   * Synchronisation Health Connect (US CONF-06). **Opt-in : false par défaut** — donnée de santé,
   * consentement explicite requis (contrairement à `analyticsEnabled`, opt-out).
   *
   * Exprime une **intention synchronisée** entre appareils ; les permissions Health Connect, elles,
   * restent **locales à l'appareil**. Réglage ON sans permission = aucune écriture, et aucune
   * demande de permission automatique.
   */
  healthConnectEnabled: z.boolean().default(false),
});

export type UserSettingsRow = z.infer<typeof userSettingsRowSchema>;
