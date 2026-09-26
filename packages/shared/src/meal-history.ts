/**
 * Les repas déjà mangés — US NUTRI-UX03, règles R3 (Reprendre), R8 (liste des jours) et R9 (repas
 * habituels).
 *
 * Quelqu'un qui note ce qu'il mange mange souvent la même chose : le même petit-déjeuner six jours
 * sur sept, deux ou trois déjeuners qui tournent. Le journal le savait déjà — `copyMeal` existait —
 * mais ne le proposait que dans le menu ⋯ d'un repas **déjà rempli**, là où il ne pouvait que le
 * doubler. Ces briques retrouvent ce qui a été mangé pour le proposer là où l'on note.
 *
 * ── Qu'est-ce que « le même repas » ? ──────────────────────────────────────────────────────────────
 * Le même **ensemble d'aliments** : un aliment de la base se reconnaît à son `food_id`, une saisie en
 * texte libre à son nom normalisé (sans casse, sans accents, espaces réduits). Les **quantités ne
 * comptent pas** — 150 g de skyr un jour et 200 g le lendemain, c'est le même petit-déjeuner — et
 * l'ordre non plus. Reprendre un repas copie ensuite la dernière occurrence **telle quelle**, avec
 * ses quantités : c'est ce que `copyMeal` fait déjà.
 */

export type MealHistoryRow = {
  /** Jour local `AAAA-MM-JJ`. */
  logDate: string;
  mealType: string;
  foodId: string | null;
  name: string;
  kcal: number;
  orderIndex: number;
};

/** Les entrées d'un repas, un jour donné. */
export type MealOccurrence = {
  dayKey: string;
  mealKey: string;
  items: MealHistoryRow[];
  kcal: number;
  signature: string;
};

export function normalizeFoodName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function foodIdentity(entry: { foodId: string | null; name: string }): string {
  return entry.foodId ? `id:${entry.foodId}` : `nom:${normalizeFoodName(entry.name)}`;
}

/** L'ensemble des aliments d'un repas, sans ordre ni doublon. */
export function mealSignature(items: readonly { foodId: string | null; name: string }[]): string {
  return [...new Set(items.map(foodIdentity))].sort().join('|');
}

/** Regroupe des entrées par (jour, repas), du jour le plus récent au plus ancien. */
export function groupMealOccurrences(rows: readonly MealHistoryRow[]): MealOccurrence[] {
  const byKey = new Map<string, MealHistoryRow[]>();
  for (const r of rows) {
    const key = `${r.logDate}\u0000${r.mealType}`;
    const list = byKey.get(key);
    if (list) list.push(r);
    else byKey.set(key, [r]);
  }
  const occurrences: MealOccurrence[] = [];
  for (const items of byKey.values()) {
    const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
    occurrences.push({
      dayKey: sorted[0]!.logDate,
      mealKey: sorted[0]!.mealType,
      items: sorted,
      kcal: sorted.reduce((sum, e) => sum + e.kcal, 0),
      signature: mealSignature(sorted),
    });
  }
  // Jour décroissant ; à jour égal, l'ordre de première apparition (celui du SQL) est conservé.
  return occurrences.sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : 0));
}

export type RecentMeal = {
  /** L'occurrence la plus récente de ce repas : c'est elle que Reprendre copie. */
  occurrence: MealOccurrence;
  /** Nombre d'occurrences du même repas dans la fenêtre fournie. */
  count: number;
};

/**
 * R3 — les derniers repas **différents** d'un type, du plus récent au plus ancien.
 *
 * `occurrences` doit déjà être bornée à la fenêtre voulue (60 jours avant aujourd'hui) : le compte
 * d'occurrences porte sur ce qu'on lui donne.
 */
export function recentDistinctMeals(
  occurrences: readonly MealOccurrence[],
  mealKey: string,
  options: { limit?: number } = {},
): RecentMeal[] {
  const limit = options.limit ?? 3;
  const ofMeal = occurrences.filter((o) => o.mealKey === mealKey);
  const counts = new Map<string, number>();
  for (const o of ofMeal) counts.set(o.signature, (counts.get(o.signature) ?? 0) + 1);

  const seen = new Set<string>();
  const out: RecentMeal[] = [];
  for (const o of [...ofMeal].sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : 0))) {
    if (seen.has(o.signature)) continue;
    seen.add(o.signature);
    out.push({ occurrence: o, count: counts.get(o.signature) ?? 1 });
    if (out.length >= limit) break;
  }
  return out;
}

export type HabitualMeal = {
  /** La dernière occurrence : ses quantités sont celles que Reprendre recopie. */
  last: MealOccurrence;
  count: number;
};

/**
 * R9 — les repas habituels d'un type : chaque ensemble d'aliments noté au moins `minCount` fois,
 * trié par nombre d'occurrences décroissant, puis par date de dernière occurrence.
 */
export function habitualMeals(
  occurrences: readonly MealOccurrence[],
  mealKey: string,
  options: { minCount?: number; limit?: number } = {},
): HabitualMeal[] {
  const minCount = options.minCount ?? 2;
  const limit = options.limit ?? 10;
  const bySignature = new Map<string, HabitualMeal>();
  for (const o of occurrences) {
    if (o.mealKey !== mealKey) continue;
    const current = bySignature.get(o.signature);
    if (!current) bySignature.set(o.signature, { last: o, count: 1 });
    else {
      current.count += 1;
      if (o.dayKey > current.last.dayKey) current.last = o;
    }
  }
  return [...bySignature.values()]
    .filter((h) => h.count >= minCount)
    .sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.last.dayKey < b.last.dayKey ? 1 : a.last.dayKey > b.last.dayKey ? -1 : 0,
    )
    .slice(0, limit);
}

/**
 * R8 — le résumé d'une journée pour la liste des jours : les `perMeal` premiers aliments de chaque
 * repas, dans l'ordre des repas configurés ; un repas qui n'est plus dans la configuration passe en
 * dernier. L'appelant joint les morceaux (« Skyr, Flocons · Poulet, Riz »).
 */
export function summarizeDayFoods(
  items: readonly { mealType: string; name: string; orderIndex?: number }[],
  mealOrder: readonly string[],
  perMeal = 2,
): string[] {
  const byMeal = new Map<string, { name: string; orderIndex: number }[]>();
  items.forEach((e, i) => {
    const list = byMeal.get(e.mealType) ?? [];
    list.push({ name: e.name, orderIndex: e.orderIndex ?? i });
    byMeal.set(e.mealType, list);
  });
  const known = mealOrder.filter((m) => byMeal.has(m));
  const unknown = [...byMeal.keys()].filter((m) => !mealOrder.includes(m));
  return [...known, ...unknown].map((m) =>
    byMeal
      .get(m)!
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .slice(0, perMeal)
      .map((e) => e.name)
      .join(', '),
  );
}
