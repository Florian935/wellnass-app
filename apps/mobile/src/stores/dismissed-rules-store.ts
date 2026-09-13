import { create } from 'zustand';
import { GOAL_CONFLICT_RULES, type GoalConflictRule } from '@wellness/shared';
import { secureStorage } from '@/lib/secure-storage';

/**
 * Les règles de contradiction que l'utilisateur a rejetées — US GUID-01, volet E.
 *
 * ── « Cette règle ne me correspond pas » ────────────────────────────────────────────────────────
 * Principe transverse noté dans IDEAS le 25/07/2026 : chaque recommandation doit être
 * **explicable** ET **contestable**. Une carte qui ne sait dire que « tu as tort » et qu'on ne peut
 * que subir finit par être ignorée en bloc — y compris les fois où elle a raison.
 *
 * ── Pourquoi c'est local et non synchronisé ─────────────────────────────────────────────────────
 * Refuser un conseil sur son téléphone n'a aucune raison de voyager. Même choix que les micros
 * suivis (US 4.35) : préférence **device**, `secureStorage`, aucune colonne, aucune migration.
 * Promotion vers `user_settings` possible plus tard si le besoin apparaît — il ne s'est pas
 * présenté.
 *
 * ── Le rejet est durable ────────────────────────────────────────────────────────────────────────
 * Il survit au redémarrage. Il ne se réinitialise **pas** tout seul : le faire réapparaître « au
 * bout d'un moment » serait exactement le comportement que le rejet cherchait à éteindre.
 *
 * ⚠️ **Aucun écran ne permet de le défaire aujourd'hui**, et il n'y a donc pas de `reset()` ici :
 * une fonction publique que personne n'appelle est du code mort qui se fait passer pour une
 * fonctionnalité (constat de revue, 13/09/2026). Le jour où un écran offrira « réafficher les
 * règles masquées », il l'ajoutera avec son point d'entrée — pas avant.
 */
const STORAGE_KEY = 'dismissed_goal_rules';

/** Ne garde que des identifiants de règles connus, dans l'ordre déclaré (stable). */
function sanitize(list: unknown): GoalConflictRule[] {
  if (!Array.isArray(list)) return [];
  return GOAL_CONFLICT_RULES.filter((rule) => list.includes(rule));
}

async function persist(rules: GoalConflictRule[]): Promise<void> {
  try {
    await secureStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // Persistance best-effort : un échec de stockage ne doit pas casser l'écran d'accueil.
  }
}

type DismissedRulesState = {
  dismissed: GoalConflictRule[];
  /** Vrai une fois la lecture initiale terminée. Avant, on n'affiche aucune carte : afficher une
   *  règle déjà rejetée le temps d'un chargement reviendrait à ignorer le rejet. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  dismiss: (rule: GoalConflictRule) => void;
};

export const useDismissedRules = create<DismissedRulesState>((set, get) => ({
  dismissed: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await secureStorage.getItem(STORAGE_KEY);
      set({ dismissed: raw ? sanitize(JSON.parse(raw)) : [], hydrated: true });
    } catch {
      set({ dismissed: [], hydrated: true });
    }
  },

  dismiss: (rule) => {
    const next = sanitize([...get().dismissed, rule]);
    set({ dismissed: next });
    void persist(next);
  },
}));
