import { create } from 'zustand';
import type { SessionConflict } from '@wellness/shared';

/**
 * L'état des déplacements de séance décidés d'office par le régime **guidé** (US GUID-01).
 *
 * ── Pourquoi un store, et pas un `useState` dans l'écran ────────────────────────────────────────
 * 🔴 C'est un défaut trouvé en revue, et il vidait l'annulation de son sens. `/planning` est une
 * route empilée : en sortir et y revenir **remonte le composant**. Avec un état local, un refus
 * (« Annuler le déplacement ») était oublié à la navigation suivante, le conflit réapparaissait
 * dans `conflicts`, et l'effet **redéplaçait la séance**. Deux allers-retours suffisaient à défaire
 * l'annulation — exactement le comportement que le régime guidé ne doit jamais avoir : il décide
 * **à défaut**, jamais contre.
 *
 * ── Portée : la session d'application ───────────────────────────────────────────────────────────
 * En mémoire, non persisté. Un refus vaut pour la session en cours ; au lancement suivant la
 * situation a pu changer (séances déplacées, semaine écoulée) et re-proposer est légitime. Ce n'est
 * pas le même contrat qu'un rejet de règle (`dismissed-rules-store`), qui porte sur une **règle**
 * et non sur une occurrence, et qui lui est durable.
 */

type AutoMove = {
  /** Le jour d'où la séance vient — c'est là qu'« Annuler » la remet. */
  from: string;
  /** Le jour où elle a été posée : l'annonce s'affiche sur ce jour-là. */
  to: string;
  /**
   * Instantané du conflit d'origine.
   *
   * 🔴 Indispensable : une fois la séance déplacée, le conflit **disparaît** de `conflicts` —
   * c'était tout l'objet du déplacement. Sans cette copie, l'annonce « je l'ai déplacée » n'aurait
   * plus rien à afficher, et le régime guidé agirait en silence.
   */
  conflict: SessionConflict;
};

type AutoMoveState = {
  moved: Record<string, AutoMove>;
  /** Séances qu'on ne redéplacera plus : refus explicite, ou échec d'écriture répété. */
  refused: string[];
  remember: (runSessionId: string, move: AutoMove) => void;
  /** Annulation par l'utilisateur : on oublie le déplacement ET on ne le refera pas. */
  refuse: (runSessionId: string) => void;
  /** Échec d'écriture : même effet, pour ne pas boucler sur une erreur persistante. */
  markFailed: (runSessionId: string) => void;
};

export const useAutoMove = create<AutoMoveState>((set) => ({
  moved: {},
  refused: [],

  remember: (runSessionId, move) =>
    set((state) => ({ moved: { ...state.moved, [runSessionId]: move } })),

  refuse: (runSessionId) =>
    set((state) => {
      const moved = { ...state.moved };
      delete moved[runSessionId];
      return {
        moved,
        refused: state.refused.includes(runSessionId)
          ? state.refused
          : [...state.refused, runSessionId],
      };
    }),

  markFailed: (runSessionId) =>
    set((state) => ({
      refused: state.refused.includes(runSessionId)
        ? state.refused
        : [...state.refused, runSessionId],
    })),
}));
