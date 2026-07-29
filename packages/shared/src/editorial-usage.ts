/**
 * US ADMIN-01 — lecture des décomptes d'usage d'un contenu éditorial (roadmap 8.11).
 *
 * Les **chiffres** viennent de la fonction SQL `editorial_usage_counts` (security definer, admins
 * uniquement : la RLS empêche un admin de compter les données des autres utilisateurs en direct).
 * Ce fichier ne contient que la mise en forme, **pure et testée** — `apps/admin` n'a pas de harnais
 * de test, `packages/shared` en a un.
 *
 * La règle qui compte ici : **« aucun usage » et « je n'ai pas pu compter » ne doivent jamais se
 * ressembler.** Un décompte absent affiché comme un zéro ferait archiver en confiance un contenu
 * référencé par des centaines de séances — exactement le risque que cette US corrige.
 */

/** Types de contenu éditorial archivables depuis le back-office. */
export const EDITORIAL_KINDS = ['exercise', 'program', 'food'] as const;

export type EditorialKind = (typeof EDITORIAL_KINDS)[number];

/**
 * Clés renvoyées par `editorial_usage_counts`, par type de contenu. L'ordre est celui de
 * l'affichage : le plus parlant pour un admin d'abord (« des utilisateurs s'en servent » avant
 * « du contenu éditorial le référence »).
 */
export const USAGE_KEYS: Record<EditorialKind, readonly string[]> = {
  exercise: ['workout_sets', 'exercise_plans', 'personal_records', 'exercise_variants'],
  program: ['planned_sessions', 'sessions', 'exercise_plans'],
  food: ['food_entries', 'recipe_ingredients', 'meal_template_items'],
};

/** Une ligne de décompte prête à afficher. */
export type UsageLine = { key: string; count: number };

/**
 * Résumé d'usage.
 *
 * `unavailable` distingue le troisième état, celui qu'on oublie : ni « des usages », ni « aucun
 * usage », mais **« le décompte a échoué »**. L'UI doit alors avertir et non rassurer.
 */
export type UsageSummary = {
  total: number;
  /** Uniquement les lignes non nulles, dans l'ordre de `USAGE_KEYS`. */
  lines: UsageLine[];
  /** Vrai si le contenu n'est référencé nulle part — l'information qui permet d'archiver sereinement. */
  isUnused: boolean;
  /** Vrai si le décompte n'a pas pu être obtenu. `total` et `lines` sont alors sans signification. */
  unavailable: boolean;
};

/** Un décompte indisponible : à afficher comme un avertissement, jamais comme un zéro. */
export const USAGE_UNAVAILABLE: UsageSummary = {
  total: 0,
  lines: [],
  isUnused: false,
  unavailable: true,
};

/** Extrait un entier ≥ 0 d'une valeur venue de `jsonb` (nombre, chaîne numérique, ou rien). */
function toCount(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Met en forme la réponse de `editorial_usage_counts`.
 *
 * `null` / `undefined` (appel en erreur) → `USAGE_UNAVAILABLE`. Un objet vide, en revanche, est un
 * vrai « aucun usage » : la fonction SQL lève sur un type inconnu plutôt que de renvoyer `{}`, donc
 * un objet vide ne peut pas venir d'une faute de frappe.
 */
export function summarizeUsage(
  kind: EditorialKind,
  raw: Record<string, unknown> | null | undefined,
): UsageSummary {
  if (raw == null) return USAGE_UNAVAILABLE;

  const lines: UsageLine[] = [];
  let total = 0;

  for (const key of USAGE_KEYS[kind]) {
    const count = toCount(raw[key]);
    total += count;
    if (count > 0) lines.push({ key, count });
  }

  return { total, lines, isUnused: total === 0, unavailable: false };
}
