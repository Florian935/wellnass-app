/**
 * US DASH-01 — contrats de l'assistant IA (spec §7).
 *
 * La sortie d'un modèle est traitée comme une **entrée non fiable** : elle est extraite, validée par
 * un schéma, et rejetée au moindre écart. Surtout, **aucune calorie ne vient du modèle** (R5) : il
 * nomme des aliments et estime des grammes ; les calories sont calculées ici, à partir du catalogue
 * d'aliments de l'app.
 */

/*
 * ⚠️ **Historique.** La surface IA a été retirée du build de lancement le 13/09/2026 (l'app est
 * gratuite en V1, et `docs/product/ia-integration-analyse.md` plaçait l'IA en palier payant
 * post-V1). Les contrats `photo` et `ask` ci-dessous n'ont donc **toujours aucun appelant** : ils
 * restent parce qu'ils portent la règle qui garantit qu'aucun chiffre affiché ne vient d'un modèle.
 *
 * ✅ **Rouvert le 15/09/2026 par IA-LAB-01**, avec un troisième type, `coach`, et un fournisseur
 * **gratuit** (Gemini) : un labo d'évaluation, réservé à des **données factices**, qui ne coûte rien
 * et n'expose rien de l'app de lancement. Le contexte envoyé vit dans `ai-context.ts`.
 */

import { z } from 'zod';

/**
 * Plafonds quotidiens par utilisateur, appliqués côté serveur (la vérité) et affichés côté client.
 *
 * ⚠️ **Miroir de `DAILY_QUOTA` dans `supabase/functions/ai-assist/index.ts`** : la fonction ne
 * partage pas ce bundle. Modifier ici sans modifier là-bas ne change rien au plafond réel.
 *
 * `coach` est le plus bas des trois alors que c'est le mode d'exploration : une analyse coûte dix
 * fois le contexte d'une reformulation, et le palier gratuit de Gemini plafonne autour de 1 500
 * appels/jour **pour tout le projet** — un seul testeur ne doit pas pouvoir l'épuiser.
 *
 * US PRISME-01 (DD9) — `narrate` (les bilans de Prisme) et `meal_text` (le repas décrit) : 6 par
 * jour chacun pendant la bêta. Le palier gratuit est commun à toute la famille ; un bilan du soir,
 * un de semaine et quelques relances suffisent.
 */
export const AI_DAILY_QUOTA = { photo: 10, ask: 30, coach: 20, narrate: 6, meal_text: 6 } as const;
export type AiKind = keyof typeof AI_DAILY_QUOTA;

/** Les fournisseurs câblés dans la fonction Edge. Miroir de `AI_PROVIDERS` (`providers.ts`). */
export const AI_PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  groq: 'Groq',
  mistral: 'Mistral AI',
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// US PRISME-01 — le statut de Prisme, l'accord, le repas décrit
// ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Ce que le serveur dit de Prisme (`kind: 'status'`, gratuit, non décompté — spec DD6).
 *
 * 🔴 **`trains` est le littéral `false`.** Le serveur ne renvoie jamais disponible un fournisseur qui
 * entraîne ses modèles sur nos requêtes (DD1) ; si un jour il le faisait, l'app refuserait ce statut
 * plutôt que d'afficher un texte d'accord faux. Le nom, le pays et la conservation viennent d'ici et
 * jamais d'un texte écrit en dur : on consent à un destinataire précis (R6).
 */
export const prismeStatusSchema = z.object({
  available: z.boolean(),
  /** Pourquoi Prisme n'est pas disponible : fournisseur non autorisé, âge, rien de configuré. */
  reason: z.enum(['provider', 'age', 'unconfigured']).nullable(),
  provider: z
    .object({
      id: z.string().min(1),
      label: z.string().min(1),
      /** Code pays ISO (« US », « FR ») : le texte d'accord dit où partent les données. */
      country: z.string().length(2),
      trains: z.literal(false),
      /** Jours de conservation chez le fournisseur (journaux de sécurité). 0 = aucune. */
      retentionDays: z.number().int().min(0),
    })
    .nullable(),
  consent: z.object({ at: z.string().nullable(), provider: z.string().nullable() }),
  remaining: z.object({ narrate: z.number().int().min(0), meal_text: z.number().int().min(0) }),
});
export type PrismeStatus = z.infer<typeof prismeStatusSchema>;

/** L'accord Prisme tel que l'app le connaît (`user_settings.prisme_consent_*`). */
export type PrismeConsent = { at: string | null; provider: string | null };

/**
 * Faut-il (re)demander l'accord avant un appel ?
 *
 * Oui sans accord, et oui si l'accord a été donné à **un autre** fournisseur que celui que le serveur
 * emploie aujourd'hui (R6). Sans statut connu — l'app a démarré hors ligne —, l'accord local fait
 * foi : le serveur tranchera au premier appel, et un refus `consent_required` rouvrira la feuille.
 */
export function needsPrismeConsent(consent: PrismeConsent, status: PrismeStatus | null): boolean {
  if (consent.at === null) return true;
  if (status === null) return false;
  if (status.provider === null) return true;
  return consent.provider !== status.provider.id;
}

/** Le texte envoyé par « Demander à Prisme » : la partie non reconnue de la phrase, pas plus. */
export const MEAL_TEXT_MAX_CHARS = 300;

/** Au-delà, la liste est coupée — le schéma de la photo borne au même nombre. */
export const MEAL_ITEMS_MAX = 12;

/**
 * Lit la réponse d'un repas décrit (`meal_text`).
 *
 * 🔴 **Coupe la liste à {@link MEAL_ITEMS_MAX} avant de la valider.** `mealPhotoResultSchema` borne à
 * 12 aliments : valider d'abord jetterait une réponse entière de 14 aliments, alors que les 12 premiers
 * sont utilisables. `truncated` permet à l'écran de dire « vérifie qu'il ne manque rien ».
 */
export function parseMealTextResult(raw: string): { items: MealPhotoItem[]; truncated: boolean } | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const items = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return null;
  const truncated = items.length > MEAL_ITEMS_MAX;
  const result = mealPhotoResultSchema.safeParse({ items: items.slice(0, MEAL_ITEMS_MAX) });
  return result.success ? { items: result.data.items, truncated } : null;
}

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
