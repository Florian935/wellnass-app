/**
 * US DASH-01 — contrats de l'assistant IA (spec §7).
 *
 * La sortie d'un modèle est traitée comme une **entrée non fiable** : elle est extraite, validée par
 * un schéma, et rejetée au moindre écart. Surtout, **aucune calorie ne vient du modèle** (R5) : il
 * nomme des aliments et estime des grammes ; les calories sont calculées ici, à partir du catalogue
 * d'aliments de l'app.
 */

import { z } from 'zod';

/** Plafonds quotidiens par utilisateur, appliqués côté serveur (la vérité) et affichés côté client. */
export const AI_DAILY_QUOTA = { photo: 10, ask: 30 } as const;
export type AiKind = keyof typeof AI_DAILY_QUOTA;

/** Sous ce seuil, l'aliment reconnu est signalé « à vérifier ». */
export const AI_LOW_CONFIDENCE = 0.75;

export const mealPhotoResultSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        grams: z.number().positive().max(1500),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(12),
});
export type MealPhotoResult = z.infer<typeof mealPhotoResultSchema>;
export type MealPhotoItem = MealPhotoResult['items'][number];

export const askPhrasingSchema = z.object({
  headline: z.string().trim().min(1).max(200),
});
export type AskPhrasing = z.infer<typeof askPhrasingSchema>;

/**
 * Extrait le premier objet JSON d'une réponse de modèle et le valide. `null` au moindre défaut : un
 * modèle qui bavarde autour de son JSON est toléré, un JSON faux ne l'est pas.
 */
export function parseAiJson<T>(schema: z.ZodType<T>, raw: string): T | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const result = schema.safeParse(parsed);
  return result.success ? result.data : null;
}

export type CatalogCandidate = {
  id: string;
  name: string;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
};

export type MatchedPhotoItem = {
  name: string;
  food: CatalogCandidate | null;
  grams: number;
  kcal: number | null;
  lowConfidence: boolean;
};

export function matchPhotoItems(
  items: ReadonlyArray<MealPhotoItem>,
  lookup: (name: string) => ReadonlyArray<CatalogCandidate>,
): MatchedPhotoItem[] {
  return items.map((item) => {
    const food = lookup(item.name)[0] ?? null;
    return {
      name: item.name,
      food,
      grams: item.grams,
      kcal: food ? Math.round((food.kcal100 * item.grams) / 100) : null,
      lowConfidence: item.confidence < AI_LOW_CONFIDENCE,
    };
  });
}

export function photoMealTotals(items: ReadonlyArray<MatchedPhotoItem>): {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  unmatched: number;
} {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let unmatched = 0;
  for (const item of items) {
    if (!item.food) {
      unmatched += 1;
      continue;
    }
    const f = item.grams / 100;
    kcal += item.food.kcal100 * f;
    protein += item.food.protein100 * f;
    carbs += item.food.carbs100 * f;
    fat += item.food.fat100 * f;
  }
  return {
    kcal: Math.round(kcal),
    proteinG: Math.round(protein),
    carbsG: Math.round(carbs),
    fatG: Math.round(fat),
    unmatched,
  };
}

const MIN_PORTION_G = 10;
const MAX_PORTION_G = 1500;

/** Pas d'ajustement d'une portion : 10 g sous 60 g, 20 g au-delà. */
export function stepPortion(grams: number, direction: 1 | -1): number {
  const step = grams < 60 ? 10 : 20;
  return Math.max(MIN_PORTION_G, Math.min(MAX_PORTION_G, grams + step * direction));
}
