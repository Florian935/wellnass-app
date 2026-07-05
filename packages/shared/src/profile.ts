import { z } from 'zod';

/** Sexe déclaré — optionnel, utilisé pour les calculs TDEE (nutrition). */
export const SEXES = ['female', 'male', 'unspecified'] as const;
export const sexSchema = z.enum(SEXES);
export type Sex = z.infer<typeof sexSchema>;

/** Objectif principal — influence programmes et calcul calorique. */
export const GOALS = ['muscle', 'weightloss', 'performance', 'health'] as const;
export const goalSchema = z.enum(GOALS);
export type Goal = z.infer<typeof goalSchema>;
