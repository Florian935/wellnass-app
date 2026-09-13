import { z } from 'zod';
import {
  guidanceRegimeSchema,
  trainingFocusSchema,
  trainingLevelSchema,
  MAX_WEEKLY_AVAILABILITY,
  MIN_WEEKLY_AVAILABILITY,
} from './guidance';
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
   * Niveau de lecture du **bilan** de séance (MUSCU-UX02). Même échelle que
   * `workoutDisplayLevel`, **réglage distinct** (décision D1) : l'un règle la densité de *saisie*
   * sous la barre, l'autre la profondeur de *lecture* du bilan, assis au calme. Rien n'impose que
   * ce soit le même choix. NULL en base → « normal » à la lecture (repo).
   */
  summaryDisplayLevel: workoutDisplayLevelSchema.nullable().default(null),

  /**
   * Objectif de pas quotidien (US PAS-01). NULL en base pour les comptes antérieurs à la migration
   * → ramené au défaut (`DEFAULT_STEP_GOAL`) à la lecture, comme `workoutDisplayLevel`.
   */
  dailyStepGoal: z.number().int().positive().nullable().default(null),

  /**
   * US GUID-01 — l'**échéance** optionnelle de l'objectif principal (AAAA-MM-JJ), demandée à
   * l'étape 3 de l'onboarding. `null` est le cas normal : la plupart des gens n'ont pas de date.
   */
  mainGoalDeadline: z.string().nullable().default(null),

  /**
   * US GUID-01 — discipline visée quand `mainGoal` vaut `performance` (décision D2).
   * `null` quand la question n'a pas lieu d'être (un seul pilier d'entraînement actif) ou n'a pas
   * été posée.
   */
  trainingFocus: trainingFocusSchema.nullable().default(null),

  /**
   * US GUID-01 volet B — niveau d'entraînement **déclaré**.
   *
   * 🔴 À ne pas confondre avec `workoutDisplayLevel` : jusqu'à cette US, la muscu utilisait ce
   * dernier comme **proxy** d'expérience pour trier les programmes suggérés, faute d'avoir jamais
   * posé la question. `null` = jamais demandé, et le repli reste ce proxy (spec §4.2).
   */
  trainingLevel: trainingLevelSchema.nullable().default(null),

  /** US GUID-01 volet B — jours d'entraînement disponibles par semaine. `null` = jamais demandé. */
  weeklyAvailability: z
    .number()
    .int()
    .min(MIN_WEEKLY_AVAILABILITY)
    .max(MAX_WEEKLY_AVAILABILITY)
    .nullable()
    .default(null),

  /**
   * US GUID-01 volet C — le **régime de guidage** global, choisi à l'étape 4 de l'onboarding.
   * `null` = la question n'a jamais été posée → `assisted` appliqué, **affiché comme repli**.
   */
  guidanceRegime: guidanceRegimeSchema.nullable().default(null),

  /**
   * Surcharges par pilier. `null` = **hérite** du régime global ; le global ne réécrit jamais une
   * surcharge (spec §9). Réglées dans l'écran de profil du pilier concerné, jamais dans la liste
   * des réglages — qui compte déjà 18 sections et 11 interrupteurs.
   */
  guidanceStrength: guidanceRegimeSchema.nullable().default(null),
  guidanceCardio: guidanceRegimeSchema.nullable().default(null),
  guidanceNutrition: guidanceRegimeSchema.nullable().default(null),

  /** Horodatage de fin d'onboarding (null = onboarding non terminé). */
  onboardingCompletedAt: utcTimestampSchema.nullable().default(null),

  /**
   * US ACTIV-01 (1.27) : fermeture explicite du widget « Parcours 7 jours pour démarrer »
   * (null = jamais fermé). Distinct de l'expiration naturelle au jour 7 (calculée, pas stockée).
   */
  activationPathDismissedAt: utcTimestampSchema.nullable().default(null),
});

export type ProfileRow = z.infer<typeof profileRowSchema>;
