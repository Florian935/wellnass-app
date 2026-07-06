import { z } from 'zod';
import { contentOwnerSyncFieldsSchema, uuidSchema } from './sync';
import { pillarSchema } from './pillar';
import { localeSchema } from './pillar';
import { setTypeSchema } from './workout';

// ---------------------------------------------------------------------------
// Statuts d'un programme
// ---------------------------------------------------------------------------

/**
 * Statuts du cycle de vie d'un programme.
 * - `draft`     : programme en cours de création, non visible par les utilisateurs.
 * - `published` : programme publié et disponible dans le catalogue.
 */
export const PROGRAM_STATUSES = ['draft', 'published'] as const;
export const programStatusSchema = z.enum(PROGRAM_STATUSES);
export type ProgramStatus = z.infer<typeof programStatusSchema>;

// ---------------------------------------------------------------------------
// Niveaux d'un programme
// ---------------------------------------------------------------------------

/**
 * Niveaux de difficulté d'un programme.
 * - `beginner`     : débutant.
 * - `intermediate` : intermédiaire.
 * - `advanced`     : avancé.
 */
export const PROGRAM_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const programLevelSchema = z.enum(PROGRAM_LEVELS);
export type ProgramLevel = z.infer<typeof programLevelSchema>;

// ---------------------------------------------------------------------------
// Schéma d'une ligne programme (table `programs`)
// ---------------------------------------------------------------------------

/**
 * Schéma d'une ligne programme.
 * Hérite de `contentOwnerSyncFieldsSchema` (id, ownerId nullable, createdAt, updatedAt, deletedAt).
 * `ownerId` null = programme de la bibliothèque globale ; UUID = programme personnalisé.
 */
export const programRowSchema = contentOwnerSyncFieldsSchema.extend({
  /** Pilier auquel appartient le programme (musculation, running, nutrition). */
  pillar: pillarSchema,
  /** Statut de publication du programme. */
  status: programStatusSchema,
  /** Indique si le programme est actif dans le catalogue de l'utilisateur. */
  isActive: z.boolean(),
  /** Niveau de difficulté (nullable si non renseigné). */
  level: programLevelSchema.nullable(),
  /** Objectif principal du programme, texte libre (nullable). */
  goal: z.string().nullable(),
  /** Durée du programme en semaines (entier positif strict, nullable). */
  durationWeeks: z.number().int().positive().nullable(),
});
export type ProgramRow = z.infer<typeof programRowSchema>;

// ---------------------------------------------------------------------------
// Schéma d'une traduction de programme (table `program_translations`)
// ---------------------------------------------------------------------------

/**
 * Schéma d'une traduction de programme.
 * Hérite de `contentOwnerSyncFieldsSchema` + référence au programme parent.
 */
export const programTranslationRowSchema = contentOwnerSyncFieldsSchema.extend({
  /** Identifiant du programme parent. */
  programId: uuidSchema,
  /** Langue de la traduction (fr | en). */
  lang: localeSchema,
  /** Nom localisé du programme. */
  name: z.string(),
  /** Résumé court (nullable). */
  summary: z.string().nullable(),
  /** Description longue (nullable). */
  description: z.string().nullable(),
});
export type ProgramTranslationRow = z.infer<typeof programTranslationRowSchema>;

// ---------------------------------------------------------------------------
// Schéma d'une session (table `sessions`)
// ---------------------------------------------------------------------------

/**
 * Schéma d'une session de programme.
 * Hérite de `contentOwnerSyncFieldsSchema`.
 * Les sessions ne sont pas traduites en V0.3 (champ `name` nullable).
 */
export const sessionRowSchema = contentOwnerSyncFieldsSchema.extend({
  /** Identifiant du programme parent. */
  programId: uuidSchema,
  /** Position dans le programme (0-based). */
  orderIndex: z.number().int().min(0),
  /** Nom de la session (nullable — traduction non implémentée en V0.3). */
  name: z.string().nullable(),
});
export type SessionRow = z.infer<typeof sessionRowSchema>;

// ---------------------------------------------------------------------------
// Schéma d'un plan d'exercice (table `exercise_plans`)
// ---------------------------------------------------------------------------

/**
 * Schéma d'une ligne plan d'exercice au sein d'une session.
 * Hérite de `contentOwnerSyncFieldsSchema`.
 */
export const exercisePlanRowSchema = contentOwnerSyncFieldsSchema.extend({
  /** Identifiant de la session parente. */
  sessionId: uuidSchema,
  /** Identifiant de l'exercice planifié. */
  exerciseId: uuidSchema,
  /** Position dans la session (0-based). */
  orderIndex: z.number().int().min(0),
  /** Type de série (défaut : 'normal'). */
  setType: setTypeSchema.default('normal'),
  /** Nombre de séries cibles (entier positif strict, nullable). */
  targetSets: z.number().int().positive().nullable(),
  /** Plage de répétitions cibles, texte libre ex. "8-12" (nullable). */
  targetReps: z.string().nullable(),
  /** Charge cible en kilogrammes (nombre positif strict, nullable). */
  targetWeightKg: z.number().positive().nullable(),
  /** Temps de repos en secondes (entier >= 0, nullable). */
  restSeconds: z.number().int().min(0).nullable(),
});
export type ExercisePlanRow = z.infer<typeof exercisePlanRowSchema>;

// ---------------------------------------------------------------------------
// Helper — résolution du nom d'un programme
// ---------------------------------------------------------------------------

/**
 * Résout le nom d'un programme à partir de ses traductions selon la langue demandée.
 *
 * Stratégie de repli (fallback) — identique à `resolveExerciseName` :
 *  1. Traduction dans `lang` demandée.
 *  2. Traduction en `fr`.
 *  3. Premier élément du tableau (quelle que soit sa langue).
 *  4. `undefined` si le tableau est vide.
 */
export function resolveProgramName(
  translations: ReadonlyArray<{ lang: string; name: string }>,
  lang: string,
): string | undefined {
  if (translations.length === 0) return undefined;
  const found = translations.find((t) => t.lang === lang);
  if (found) return found.name;
  const fr = translations.find((t) => t.lang === 'fr');
  if (fr) return fr.name;
  // Le tableau est non-vide (guard ci-dessus) — l'assertion est sûre.
  return translations[0]!.name;
}
