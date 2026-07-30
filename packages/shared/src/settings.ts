import { z } from 'zod';
import { localeSchema, PILLARS, pillarSchema } from './pillar';
import { unitSystemSchema } from './units';
import { INTENSITY_SCALES } from './intensity';
import { syncFieldsSchema } from './sync';
import { defaultNotificationPrefs, parseNotificationPrefs } from './notifications';

/**
 * Schéma Zod des préférences de notifications (voir `notifications.ts`).
 *
 * ── Pourquoi ce schéma délègue au lieu d'énumérer ─────────────────────────────────────────────────
 * Il décrivait la forme champ par champ, avec des champs **obligatoires**. Deux problèmes, dont le
 * second est celui qui compte :
 *
 * 1. Il en déclarait **6 sur 8** : `weeklyReview` et `weeklyReviewHour` manquaient depuis BILAN-01, et
 *    `z.object` étant strippant, tout passage par ce schéma les **perdait silencieusement**.
 * 2. Surtout, `user_settings.notifications` est une colonne JSON **enrichie sans migration** : aucune
 *    ligne existante en base ne contient les champs ajoutés après coup. Compléter la liste à 13
 *    champs obligatoires n'aurait pas corrigé le piège, ça l'aurait **approfondi** — au lieu de
 *    stripper en silence, le schéma se serait mis à lever sur toute ligne antérieure, le jour où
 *    quelqu'un aurait branché `userSettingsRowSchema.parse()` sur une lecture.
 *
 * Le contrat de cette colonne, c'est le **parse tolérant**. Le schéma l'exprime donc en déléguant à
 * `parseNotificationPrefs` : n'importe quelle entrée (absente, `{}`, l'ancien
 * `Record<string, boolean>`, partielle, avec des heures hors bornes) produit des `NotificationPrefs`
 * complètes, heures bornées à [0, 23] et `maxPerDay >= 1`. Une seule implémentation de la tolérance,
 * testée en un seul endroit.
 */
export const notificationPrefsSchema = z
  .unknown()
  .transform((raw): ReturnType<typeof defaultNotificationPrefs> => parseNotificationPrefs(raw));

/**
 * Thème visuel de l'interface.
 * `'system'` suit le thème système de l'appareil.
 */
export const THEMES = ['light', 'dark', 'system'] as const;
export const themeSchema = z.enum(THEMES);

/** Échelle d'intensité affichée (US UX-05) — `rpe` par défaut, la seule qui existait avant. */
export const intensityScaleSchema = z.enum(INTENSITY_SCALES);
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

  /**
   * Échelle d'intensité **affichée** pour les séries de musculation (US UX-05).
   *
   * Même patron que `units` juste au-dessus : la donnée stockée reste `workout_sets.rpe`, et le RIR
   * (`10 − RPE`) est calculé **à l'affichage**. Basculer d'une échelle à l'autre ne convertit donc
   * rien en base et ne perd aucune donnée.
   */
  intensityScale: intensityScaleSchema.default('rpe'),

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

  /**
   * Suivi du cycle menstruel (US CYCLE-01). **Opt-in strict : false par défaut**, et **accessible à
   * tout le monde** — aucun filtre sur `profiles.sex` (arbitrage Damien du 30/07/2026).
   *
   * Tant qu'il est faux : aucun widget, aucune route atteignable, et **aucune ligne écrite** dans
   * `menstrual_periods` / `menstrual_daily_logs`. Le défaut `false` garantit qu'aucun compte
   * existant ne voit la fonctionnalité apparaître à la mise à jour.
   */
  cycleTrackingEnabled: z.boolean().default(false),

  /**
   * Synchronisation du cycle avec Health Connect (US CYCLE-01, R20). **Indépendant** de
   * `cycleTrackingEnabled` et de `healthConnectEnabled` : les **trois** doivent être vrais, plus la
   * permission système, pour qu'une écriture ait lieu. Aucune écriture silencieuse.
   */
  cycleHealthConnectEnabled: z.boolean().default(false),
});

export type UserSettingsRow = z.infer<typeof userSettingsRowSchema>;
