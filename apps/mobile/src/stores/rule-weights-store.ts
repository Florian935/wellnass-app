import { create } from 'zustand';
import { secureStorage } from '@/lib/secure-storage';

/**
 * US DASH-01 (§6.1, R12) — « **Ce n'est pas ça** » : le poids qu'on donne à une règle.
 *
 * Quand l'utilisateur dit qu'une explication ne correspond pas à ce qu'il vit (« le sommeil ne
 * change rien pour moi »), l'app enregistre un **poids local** pour cette règle. Trois principes,
 * et ils sont la raison d'être de ce module :
 *
 *  1. **Local, jamais synchronisé.** C'est un ressenti sur un appareil, pas une donnée de santé :
 *     il n'a ni table, ni migration, ni règle de synchro (même choix que `tracked-micros`).
 *  2. **Borné.** Un poids reste entre 0 et 1 : un désaccord atténue une règle, il ne la retourne
 *     jamais. Une projection ne doit pas pouvoir s'inverser parce qu'on a tapé trois fois sur un
 *     bouton.
 *  3. **Jamais sur un garde-fou.** Les règles de sécurité (surcharge, déficit prolongé, ACWR) ne
 *     sont pas pondérables : on peut contester un conseil, pas une alerte (R12, R11).
 */
const STORAGE_KEY = 'rule_weights';

/** Les règles qu'on peut contester. La liste **est** la garantie : rien d'autre n'est pondérable. */
export const WEIGHTABLE_RULES = ['sleep', 'protein'] as const;
export type WeightableRule = (typeof WEIGHTABLE_RULES)[number];

/** Ce qu'un « ce n'est pas ça » retire au poids de la règle. Trois désaccords la neutralisent. */
export const DISAGREE_STEP = 0.34;
const MIN_WEIGHT = 0;
const MAX_WEIGHT = 1;

export type RuleWeights = Partial<Record<WeightableRule, number>>;

function sanitize(value: unknown): RuleWeights {
  if (typeof value !== 'object' || value === null) return {};
  const out: RuleWeights = {};
  for (const rule of WEIGHTABLE_RULES) {
    const weight = (value as Record<string, unknown>)[rule];
    if (typeof weight === 'number' && Number.isFinite(weight)) {
      out[rule] = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, weight));
    }
  }
  return out;
}

async function persist(weights: RuleWeights): Promise<void> {
  try {
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  } catch {
    // Best-effort : un échec de stockage ne doit pas empêcher de contester une règle.
  }
}

type RuleWeightsState = {
  weights: RuleWeights;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Enregistre un désaccord sur une règle : son poids baisse d'un cran, borné à zéro. */
  disagree: (rule: WeightableRule) => void;
  /** Rend sa pleine force à une règle (« finalement si »). */
  reset: (rule: WeightableRule) => void;
};

export const useRuleWeights = create<RuleWeightsState>((set, get) => ({
  weights: {},
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
      set({ weights: raw != null ? sanitize(JSON.parse(raw)) : {}, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  disagree: (rule) => {
    const current = get().weights[rule] ?? MAX_WEIGHT;
    const next = { ...get().weights, [rule]: Math.max(MIN_WEIGHT, current - DISAGREE_STEP) };
    set({ weights: next });
    void persist(next);
  },
  reset: (rule) => {
    const next = { ...get().weights };
    delete next[rule];
    set({ weights: next });
    void persist(next);
  },
}));
