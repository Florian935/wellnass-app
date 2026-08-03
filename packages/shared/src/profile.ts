import { z } from 'zod';
import { syncFieldsSchema, utcTimestampSchema } from './sync';
import { workoutDisplayLevelSchema } from './workout-display';

/** Sexe déclaré — optionnel, utilisé pour les calculs TDEE (nutrition). */
export const SEXES = ['female', 'male', 'unspecified'] as const;
export const sexSchema = z.enum(SEXES);
export type Sex = z.infer<typeof sexSchema>;

/** Objectif principal — influence programmes et calcul calorique. */
export const GOALS = ['muscle', 'weightloss', 'performance', 'health'] as const;
export const goalSchema = z.enum(GOALS);
export type Goal = z.infer<typeof goalSchema>;

/**
 * Ligne de profil utilisateur — une ligne par compte, synchronisée via PowerSync.
 * Tous les champs applicatifs sont nullable : le profil peut être incomplet
 * (ex. : onboarding non terminé).
 */
export const profileRowSchema = syncFieldsSchema.extend({
  /** Prénom affiché. */
  firstName: z.string().nullable().default(null),

  /** Date de naissance au format ISO 8601 (AAAA-MM-JJ). Stockée telle quelle, sans timezone. */
  birthDate: z.string().nullable().default(null),

  /** Sexe déclaré — utilisé pour les calculs TDEE. */
  sex: sexSchema.nullable().default(null),

  /** Taille en centimètres (toujours en métrique en base). */
  heightCm: z.number().positive().nullable().default(null),

  /** Poids en kilogrammes (toujours en métrique en base). */
  weightKg: z.number().positive().nullable().default(null),

  /** Poids cible en kg (null = aucun objectif de poids). */
  targetWeightKg: z.number().positive().nullable().default(null),

  /** Poids de départ figé au moment où la cible est définie (kg). */
  startWeightKg: z.number().positive().nullable().default(null),

  /** Objectif principal de l'utilisateur. */
  mainGoal: goalSchema.nullable().default(null),

  /** Niveau d'affichage de l'écran de séance (MUSC-F13). NULL en base → « normal » à la lecture (repo). */
  workoutDisplayLevel: workoutDisplayLevelSchema.nullable().default(null),

  /**
   * Objectif de pas quotidien (US PAS-01). NULL en base pour les comptes antérieurs à la migration
   * → ramené au défaut (`DEFAULT_STEP_GOAL`) à la lecture, comme `workoutDisplayLevel`.
   */
  dailyStepGoal: z.number().int().positive().nullable().default(null),

  /** Horodatage de fin d'onboarding (null = onboarding non terminé). */
  onboardingCompletedAt: utcTimestampSchema.nullable().default(null),

  /**
   * US ACTIV-01 (1.27) : fermeture explicite du widget « Parcours 7 jours pour démarrer »
   * (null = jamais fermé). Distinct de l'expiration naturelle au jour 7 (calculée, pas stockée).
   */
  activationPathDismissedAt: utcTimestampSchema.nullable().default(null),
});

export type ProfileRow = z.infer<typeof profileRowSchema>;
