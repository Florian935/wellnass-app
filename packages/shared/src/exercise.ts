import { z } from 'zod';
import { contentOwnerSyncFieldsSchema, uuidSchema } from './sync';
import { localeSchema } from './pillar';

/**
 * Groupes musculaires canoniques. Valeurs utilisées dans les exercices de la
 * bibliothèque et dans les exercices personnalisés. L'app mobile importe
 * `MUSCLE_GROUPS` / `MuscleGroup` depuis `@wellness/shared`.
 */
export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
export const muscleGroupSchema = z.enum(MUSCLE_GROUPS);
export type MuscleGroup = z.infer<typeof muscleGroupSchema>;

/**
 * Anatomie fine (US MUSC-F1b) — référentiel de 10 muscles repris tel quel
 * d'`administration.md` §3.3, **additif** aux 6 groupes larges ci-dessus (deux champs
 * distincts : `musclePrimary`/`musclesSecondary` vs `musclesFine`, voir spec §0).
 */
export const FINE_MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'abs',
  'glutes',
  'quadriceps',
  'hamstrings',
  'calves',
] as const;
export const fineMuscleSchema = z.enum(FINE_MUSCLES);
export type FineMuscle = z.infer<typeof fineMuscleSchema>;

/** Vue(s) `<BodyMap/>` sur laquelle chaque muscle fin s'affiche (spec §1) — seules les épaules sont sur les deux. */
export const FINE_MUSCLE_VIEWS: Record<FineMuscle, ('front' | 'back')[]> = {
  chest: ['front'],
  back: ['back'],
  shoulders: ['front', 'back'],
  biceps: ['front'],
  triceps: ['back'],
  abs: ['front'],
  glutes: ['back'],
  quadriceps: ['front'],
  hamstrings: ['back'],
  calves: ['back'],
};

/** Expansion d'un groupe large vers les muscles fins qu'il recouvre (spec §2) — repli tant qu'un exercice n'est pas tagué fin. */
export const BROAD_TO_FINE: Record<MuscleGroup, FineMuscle[]> = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps'],
  legs: ['quadriceps', 'hamstrings', 'calves'],
  core: ['abs'],
};

/**
 * Équipements disponibles en salle ou à domicile.
 * `equipment` est nullable sur la ligne exercice (exercice sans matériel).
 */
export const EQUIPMENTS = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const;
export const equipmentSchema = z.enum(EQUIPMENTS);
export type Equipment = z.infer<typeof equipmentSchema>;

/**
 * Origine de l'exercice : bibliothèque globale ou créé par l'utilisateur.
 */
export const SOURCES = ['library', 'custom'] as const;
export const sourceSchema = z.enum(SOURCES);
export type Source = z.infer<typeof sourceSchema>;

/**
 * Schéma d'une ligne exercice.
 * Hérite de `contentOwnerSyncFieldsSchema` (id, ownerId, createdAt, updatedAt, deletedAt).
 */
export const exerciseRowSchema = contentOwnerSyncFieldsSchema.extend({
  source: sourceSchema,
  musclePrimary: muscleGroupSchema,
  musclesSecondary: z.array(muscleGroupSchema).default([]),
  musclesFine: z.array(fineMuscleSchema).default([]),
  equipment: equipmentSchema.nullable(),
  mediaUrl: z.string().url().nullable(),
});
export type ExerciseRow = z.infer<typeof exerciseRowSchema>;

/**
 * Schéma d'une traduction d'exercice.
 * Hérite de `contentOwnerSyncFieldsSchema` + référence à l'exercice parent.
 */
export const exerciseTranslationRowSchema = contentOwnerSyncFieldsSchema.extend({
  exerciseId: uuidSchema,
  lang: localeSchema,
  name: z.string(),
  instructions: z.string().nullable(),
});
export type ExerciseTranslationRow = z.infer<typeof exerciseTranslationRowSchema>;

/**
 * Résout le nom d'un exercice à partir de ses traductions selon la langue demandée.
 *
 * Stratégie de repli (fallback) :
 *  1. Traduction dans `lang` demandée.
 *  2. Traduction en `fr`.
 *  3. Premier élément du tableau (quelle que soit sa langue).
 *  4. `undefined` si le tableau est vide.
 */
export function resolveExerciseName(
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

/**
 * Normalise une liste de muscles secondaires : ne garde que des `MuscleGroup`
 * valides, dédupliqués et **distincts du muscle primaire** (invariant primaire ∉
 * secondaires). Entrée non-tableau ou vide → `[]`. Utilisée à l'écriture (admin)
 * et comme garde de forme à la lecture (mobile).
 */
export function normalizeSecondaryMuscles(input: unknown, primary: MuscleGroup): MuscleGroup[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<MuscleGroup>();
  for (const v of input) {
    const parsed = muscleGroupSchema.safeParse(v);
    if (parsed.success && parsed.data !== primary) seen.add(parsed.data);
  }
  return [...seen];
}

/**
 * Normalise une liste de muscles fins (US MUSC-F1b) : ne garde que des `FineMuscle` valides,
 * dédupliqués. Contrairement à `normalizeSecondaryMuscles`, **aucun invariant d'exclusion** — les
 * muscles fins ne « contiennent » pas le primaire large, ce sont deux espaces distincts (spec §0).
 */
export function normalizeFineMuscles(input: unknown): FineMuscle[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<FineMuscle>();
  for (const v of input) {
    const parsed = fineMuscleSchema.safeParse(v);
    if (parsed.success) seen.add(parsed.data);
  }
  return [...seen];
}

/**
 * Décide quoi éclairer sur `<BodyMap/>` pour un exercice donné (spec §2) — chemin de rendu unique,
 * utilisé par la fiche, l'aperçu de séance et le bilan hebdo. Tagué fin → tout à pleine émphase (la
 * précision EST la nuance). Pas encore tagué → repli sur les groupes larges, deux niveaux d'émphase
 * (primaire plein, secondaires réduits) — reproduit fidèlement le comportement du repli large.
 */
export function resolveFineMuscles(exercise: {
  musclePrimary: MuscleGroup;
  musclesSecondary: MuscleGroup[];
  musclesFine: FineMuscle[];
}): { full: FineMuscle[]; reduced: FineMuscle[] } {
  if (exercise.musclesFine.length > 0) {
    return { full: exercise.musclesFine, reduced: [] };
  }
  return {
    full: BROAD_TO_FINE[exercise.musclePrimary],
    reduced: exercise.musclesSecondary.flatMap((m) => BROAD_TO_FINE[m]),
  };
}

/**
 * Union de `resolveFineMuscles` sur tous les exercices d'une séance (aperçu avant démarrage,
 * plan étape 4) : un muscle est à pleine émphase s'il l'est pour **au moins un** exercice, sinon
 * réduite s'il l'est pour au moins un — pas de somme, pas de troisième niveau. Un muscle réduit
 * pour un exercice et plein pour un autre finit plein (le plus fort gagne).
 */
export function resolveSessionFineMuscles(
  exercises: ReadonlyArray<{
    musclePrimary: MuscleGroup;
    musclesSecondary: MuscleGroup[];
    musclesFine: FineMuscle[];
  }>,
): { full: FineMuscle[]; reduced: FineMuscle[] } {
  const full = new Set<FineMuscle>();
  const reduced = new Set<FineMuscle>();
  for (const exercise of exercises) {
    const resolved = resolveFineMuscles(exercise);
    resolved.full.forEach((m) => full.add(m));
    resolved.reduced.forEach((m) => reduced.add(m));
  }
  for (const m of full) reduced.delete(m);
  return { full: [...full], reduced: [...reduced] };
}

/**
 * Bilan hebdomadaire (US MUSC-F1b, R3) : agrège le tonnage de chaque exercice performé dans la
 * semaine vers tous les muscles fins qu'il cible (`resolveFineMuscles`), puis retient le(s)
 * muscle(s) au tonnage maximal en pleine émphase, tous les autres muscles touchés (tonnage > 0)
 * en émphase réduite. Semaine vide → `{ full: [], reduced: [] }` (silhouette neutre, spec critère
 * 6) — pas de division par zéro.
 */
export function resolveTonnageFineMuscles(
  contributions: ReadonlyArray<{
    tonnageKg: number;
    musclePrimary: MuscleGroup;
    musclesSecondary: MuscleGroup[];
    musclesFine: FineMuscle[];
  }>,
): { full: FineMuscle[]; reduced: FineMuscle[] } {
  const tonnageByMuscle = new Map<FineMuscle, number>();
  for (const contribution of contributions) {
    const { full, reduced } = resolveFineMuscles(contribution);
    for (const muscle of [...full, ...reduced]) {
      tonnageByMuscle.set(muscle, (tonnageByMuscle.get(muscle) ?? 0) + contribution.tonnageKg);
    }
  }

  if (tonnageByMuscle.size === 0) {
    return { full: [], reduced: [] };
  }

  const max = Math.max(...tonnageByMuscle.values());
  const full: FineMuscle[] = [];
  const reduced: FineMuscle[] = [];
  for (const [muscle, tonnage] of tonnageByMuscle) {
    if (tonnage === max) full.push(muscle);
    else if (tonnage > 0) reduced.push(muscle);
  }
  return { full, reduced };
}
