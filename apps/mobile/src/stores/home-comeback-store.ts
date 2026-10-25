import { create } from 'zustand';

/**
 * US ACCUEIL-07 — « Mon plan normal », choisi au retour d'une absence.
 *
 * « En douceur » écrit une période « vie réelle » en base : la scène la relit et le dit d'elle-même.
 * « Mon plan normal », lui, n'écrit rien — il n'y a rien à changer, c'est le plan qui reprend. Il faut
 * pourtant s'en souvenir le temps de la journée, sinon la scène reposerait la question à chaque
 * passage sur l'accueil. Préférence **de session** (mémoire seulement) : au pire, après un redémarrage
 * de l'app le même jour, la question revient une fois — jusqu'à la première activité, qui fait sortir
 * du moment « retour » de toute façon.
 */
type ComebackChoiceState = {
  /** Jour (`AAAA-MM-JJ`) où « Mon plan normal » a été choisi. */
  normalChosenOn: string | null;
  chooseNormal: (dayKey: string) => void;
};

export const useComebackChoice = create<ComebackChoiceState>((set) => ({
  normalChosenOn: null,
  chooseNormal: (dayKey) => set({ normalChosenOn: dayKey }),
}));
