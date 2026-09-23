/**
 * Le **contrat** entre l'écran de séance et son rendu immersif (US MUSCU-UX03).
 *
 * ── Pourquoi un objet unique ────────────────────────────────────────────────────────────────────
 * `workout.tsx` reste le **porteur de l'état de séance** : série courante, dérogation de focus,
 * échéance du repos, édition en cours, verrou de clôture. C'est ce qui permet de **basculer de mode
 * en pleine séance sans rien perdre** (spec R-MO-4) : le mode ne change que le rendu, jamais l'état.
 *
 * Les deux rendus reçoivent donc la même matière. Le classique la lit directement (il vit encore
 * dans `workout.tsx`, inchangé) ; l'immersif la reçoit par ce type.
 */

import type {
  BarChange,
  CoachLine,
  ExerciseBests,
  ExerciseMuscles,
  GhostReference,
  LiveRecord,
  SetFeel,
  SetType,
  SetVerdict,
  WorkoutDisplayLevel,
} from '@wellness/shared';
import type { Palette } from '@/theme/colors';
import type { SetChip, SupersetLinkState } from '@/components/workout/CurrentSetCard';
import type { WorkoutEntry } from '@/data/repositories/workout-repository';
import type { CurrentSet } from '@/app/workout';
import type { ImmersivePrefs } from '@/stores/immersive-prefs-store';
import type { useUnits } from '@/hooks/useUnits';

/** Ce que la validation d'une série produit, et que le repos affiche. */
export type SessionFeedback = {
  /** Libellé de la série validée (« 82,5 kg × 7 »), déjà formaté. */
  doneLabel: string;
  /** Rang (1-based) de la série validée. */
  setIndex: number;
  verdict: SetVerdict;
  /**
   * Comment nommer la séance de référence (« mardi », « 02/08 »), déjà résolu et localisé.
   * `null` quand il n'y a pas de référence — le verdict se lit alors sans jour.
   */
  dayLabel: string | null;
  /** Record battu par cette série, ou `null`. */
  record: LiveRecord | null;
  /** Vrai si ce record mérite le plein écran (premier record de charge de la séance). */
  takeover: boolean;
  /** Nom de l'exercice concerné. */
  exerciseName: string;
  /** Bilan d'exercice, quand cette série était la dernière de son exercice. */
  exerciseDone: { name: string; sets: number; tonnage: number; deltaPercent: number | null; records: number } | null;
  /** Ajustement proposé pour la série suivante (spec §5.8). */
  adjust: { weightKg: number; direction: 'down' | 'up' } | null;
  /** Réplique du coach déclenchée par cette validation. */
  coach: CoachLine | null;
};

/** Valeurs explicites de validation — le cadran valide avec ses propres chiffres. */
export type ValidateOverride = {
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  feel?: SetFeel | null;
};

export type ImmersiveRuntime = {
  workoutId: string;
  entries: WorkoutEntry[];
  current: CurrentSet | null;
  currentExerciseId: string;
  level: WorkoutDisplayLevel;
  colors: Palette;
  units: ReturnType<typeof useUnits>;

  /** Chrono de séance, déjà formaté. */
  elapsed: string;
  totalSets: number;
  doneSets: number;

  /** Saisie de la série courante (valeurs affichées, déjà éditées le cas échéant). */
  displayReps: string;
  displayWeightKg: number | null;
  displayDurationSeconds: number | null;
  durationValue: string;
  applyEdit: (patch: { reps?: string; weightKg?: number | null; durationSeconds?: number | null }) => void;
  /**
   * Saisie au clavier des champs du pont — les mêmes gestionnaires que la barre du mode classique
   * (MUSCU-FIX02, passe 2 : le pont immersif n'avait que − / +, impossible d'y taper sa charge).
   */
  onChangeReps: (text: string) => void;
  onChangeWeight: (text: string) => void;
  onChangeDuration: (text: string) => void;
  /** − / + sur la charge : charge chargeable voisine à la barre, pas simple ailleurs. */
  onStepWeight: (direction: 1 | -1) => void;

  /** Repères de la scène. */
  setChips: SetChip[];
  lastPerfLabel: string | null;
  suggestionLabel: string | null;
  plannedLabel: string | null;
  deltaLabel: string | null;
  deltaPositive: boolean;
  currentSetType: SetType;
  onSetType: (type: SetType) => void;
  rpe: number | null;
  onSetRpe: (rpe: number | null) => void;
  note: string;
  onChangeNote: (value: string) => void;
  onBlurNote: () => void;
  supersetLink: SupersetLinkState;
  chainsToSuperset: boolean;
  onRequestLinkSuperset: () => void;
  onUnlinkSuperset: () => void;

  /** Actions de séance. */
  onValidate: (override?: ValidateOverride) => void;
  onFinish: () => void;
  onLeave: () => void;
  onOpenMenu: () => void;
  onAddSet: (exerciseId: string) => void;
  onSelectExercise: (exerciseId: string) => void;
  onToggleSetDone: (setId: string, done: boolean) => void;
  onRemoveSet: (setId: string) => void;
  onReorder: (exerciseId: string, direction: 'up' | 'down') => void;
  onSendLater: (exerciseId: string) => void;
  onReplace: (exerciseId: string) => void;
  onAddExercise: () => void;
  exerciseNotes: Record<string, string | null>;
  supersetPairs: Record<string, string>;

  /** Repos en cours. */
  rest: {
    active: boolean;
    secondsLeft: number;
    totalSeconds: number;
    /** Réglage durable de l'exercice courant. */
    restSeconds: number;
    /** Replié = barre compacte ; l'écran de séance reste visible derrière (spec §5.9). */
    collapsed: boolean;
    onToggleCollapse: () => void;
    onSkip: () => void;
    onExtend: () => void;
    onChangeRest: (seconds: number) => void;
  };

  /** Matière propre au mode immersif. */
  references: Record<string, GhostReference>;
  bests: Record<string, ExerciseBests>;
  muscles: Record<string, ExerciseMuscles>;
  feedback: SessionFeedback | null;
  /** Records annoncés depuis le début de la séance — la cérémonie de fin les recompte. */
  recordsCount: number;
  prefs: ImmersivePrefs;
  /** Dit une réplique du coach (voix + légende). Muet ou voix coupée : ne fait rien. */
  speak: (line: CoachLine | null) => void;
  /** Applique l'ajustement proposé à la série suivante. */
  onAcceptAdjust: () => void;
  onDismissAdjust: () => void;
  /** Ferme le plein écran de record. */
  onDismissTakeover: () => void;
  /** Vrai quand l'exercice courant se charge sur une barre (spec §5.5). */
  showBarbell: boolean;
  /**
   * Ce qui change sur la barre depuis la série validée précédente **du même exercice** — « ajoute
   * 1,25 kg de chaque côté ». `null` hors barre, ou quand il n'y a pas encore de série faite sur
   * cet exercice (la barre se charge alors de zéro : c'est le détail par côté qui compte). MUSCU-FIX02,
   * passe 3 : l'information qu'on cherche vraiment entre deux séries.
   */
  barChange: BarChange | null;
  /**
   * Consigne technique courte de l'exercice courant : affichée sur la scène, et dite au lancement
   * d'une série chronométrée (les séries en reps n'ont plus de « lancement », MUSCU-FIX02 passe 3).
   */
  cue: string | null;
  /** Vrai quand on arrive du brief par « Modifier avant de commencer » : le plan s'ouvre. */
  openPlanOnMount: boolean;
  /** Ouvre le bilan de séance (MUSCU-UX02) — appelé par la cérémonie de clôture. */
  goToSummary: () => void;
  /**
   * La séance se clôt et la cérémonie de fin doit occuper l'écran (spec §5.13).
   *
   * Porté par l'écran de séance et non par ce rendu (MUSCU-FIX02) : « Terminer » vit à **deux**
   * endroits, le pont et le menu ⋮. Seul le pont déclenchait la cérémonie ; depuis le menu, la
   * séance était close sans cérémonie ni navigation, et l'écran affichait « Aucune séance en
   * cours ». Faux quand il n'y a rien à fêter (clôture sans série validée) : on part au bilan.
   */
  closing: boolean;
};
