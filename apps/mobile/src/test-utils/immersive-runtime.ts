/**
 * Fixture de `ImmersiveRuntime` — le contrat entre `workout.tsx` et le rendu immersif (US
 * MUSCU-UX03).
 *
 * ⚠️ **Construite à partir du type réel, champ par champ.** Un runtime partiel ferait planter le
 * rendu à trois pas de sa cause, ou — bien pire — le ferait passer dans un chemin de repli
 * silencieux qui rendrait les tests verts sans rien vérifier. C'est la septième famille de faux
 * vert documentée en §5 bis de `strategie-tests.md`, rencontrée trois fois pendant les lots 8 à 10.
 *
 * Le runtime est **plat et sans logique** : c'est tout l'intérêt du contrat. Une fixture suffit
 * donc à mettre l'écran dans n'importe quel état, sans base ni navigation.
 *
 * ⚠️ Rangée dans `src/test-utils/` et non dans un `__tests__/` : Jest y voit une suite et échoue
 * sur « Your test suite must contain at least one test ». Même emplacement que `sqlite-harness`.
 */

import type { ImmersiveRuntime } from '@/components/workout/immersive/types';

/** Palette minimale : le rendu ne lit que des couleurs, jamais leur valeur. */
const colors = {
  background: '#000',
  surface: '#111',
  surfaceAlt: '#181818',
  border: '#222',
  track: '#222',
  text: '#fff',
  textMuted: '#999',
  accent: '#c00',
  accentText: '#fff',
  success: '#0a0',
  danger: '#a00',
  warning: '#aa0',
  pillarStrength: '#a33',
  pillarRunning: '#36a',
  pillarNutrition: '#3a6',
} as unknown as ImmersiveRuntime['colors'];

/** Formatage d'unités : les vraies fonctions sont testées chez elles (`useUnits`). */
const units = {
  weightSymbol: 'kg',
  formatWeight: (kg: number) => `${kg} kg`,
  weightInputValue: (kg: number | null) => (kg == null ? '' : String(kg)),
  formatHeight: (cm: number) => `${cm} cm`,
  formatCircumference: (cm: number) => `${cm} cm`,
  formatDistance: (m: number) => `${m} m`,
  imperial: false,
} as unknown as ImmersiveRuntime['units'];

export type SetSeed = {
  id?: string;
  done?: boolean;
  reps?: number | null;
  weightKg?: number | null;
  setType?: string;
  rpe?: number | null;
};

/** Une série de séance, au format `WorkoutEntry['sets']`. */
export function seedSet(over: SetSeed = {}) {
  return {
    id: over.id ?? 's-1',
    done: over.done ?? false,
    reps: over.reps ?? 10,
    weightKg: over.weightKg ?? 60,
    durationSeconds: null,
    setType: over.setType ?? 'normal',
    rpe: over.rpe ?? null,
    plannedWeightKg: null,
    orderIndex: 0,
  };
}

/** Un exercice de la séance avec ses séries. */
export function seedEntry(exerciseId: string, exerciseName: string, sets: SetSeed[]) {
  return {
    exerciseId,
    exerciseName,
    sets: sets.map((s, i) => ({ ...seedSet(s), id: s.id ?? `${exerciseId}-${i}`, orderIndex: i })),
    notes: null,
    targetReps: null,
    restSeconds: 90,
    setType: 'normal',
  };
}

type Entries = ReturnType<typeof seedEntry>[];

/**
 * Un runtime complet. `over` remplace ce qu'on veut ; `current` est dérivé des entrées quand il
 * n'est pas fourni, pour que le cas nominal ne demande rien.
 */
export type RuntimeOverrides = Omit<
  Partial<ImmersiveRuntime>,
  'rest' | 'entries' | 'current' | 'references' | 'bests' | 'prefs'
> & {
  /** Le repos se surcharge **partiellement** : les tests n'en fixent que ce qu'ils regardent. */
  rest?: Partial<ImmersiveRuntime['rest']>;
  /**
   * Entrées et série courante prennent la forme rendue par `seedEntry`, plus étroite que
   * `WorkoutEntry` : un test n'a pas à remplir les champs que le rendu ne lit pas.
   */
  entries?: Entries;
  current?: { entry: Entries[number]; rang: number; set: Entries[number]['sets'][number] } | null;
  /** Mêmes formes, allégées : le rendu ne lit qu'une partie de ces dictionnaires. */
  references?: Record<string, unknown>;
  bests?: Record<string, unknown>;
  prefs?: Record<string, unknown>;
};

export function makeRuntime(over: RuntimeOverrides = {}): ImmersiveRuntime {
  const entries: Entries = over.entries ?? [
    seedEntry('ex-1', 'Développé couché', [{ done: false }, { done: false }]),
  ];

  const firstEntry = entries[0];
  const defaultCurrent =
    firstEntry && firstEntry.sets.length > 0
      ? { entry: firstEntry, rang: 0, set: firstEntry.sets[0] }
      : null;

  const base = {
    workoutId: 'w-1',
    entries,
    current: defaultCurrent,
    currentExerciseId: firstEntry?.exerciseId ?? '',
    level: 'normal',
    colors,
    units,

    elapsed: '12:34',
    totalSets: entries.reduce((n, e) => n + e.sets.length, 0),
    doneSets: entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0),

    displayReps: '10',
    displayWeightKg: 60,
    displayDurationSeconds: null,
    durationValue: '0:30',
    applyEdit: jest.fn(),

    setChips: entries[0]?.sets.map((s, i) => ({ id: s.id, done: s.done, label: `${i + 1}` })) ?? [],
    lastPerfLabel: null,
    suggestionLabel: null,
    plannedLabel: null,
    deltaLabel: null,
    deltaPositive: false,
    currentSetType: 'normal',
    onSetType: jest.fn(),
    rpe: null,
    onSetRpe: jest.fn(),
    note: '',
    onChangeNote: jest.fn(),
    onBlurNote: jest.fn(),
    supersetLink: { state: 'none' },
    chainsToSuperset: false,
    onRequestLinkSuperset: jest.fn(),
    onUnlinkSuperset: jest.fn(),

    onValidate: jest.fn(),
    onFinish: jest.fn(),
    onLeave: jest.fn(),
    onOpenMenu: jest.fn(),
    onAddSet: jest.fn(),
    onSelectExercise: jest.fn(),
    onToggleSetDone: jest.fn(),
    onRemoveSet: jest.fn(),
    onReorder: jest.fn(),
    onSendLater: jest.fn(),
    onReplace: jest.fn(),
    onAddExercise: jest.fn(),
    exerciseNotes: {},
    supersetPairs: {},

    rest: {
      active: false,
      secondsLeft: 0,
      totalSeconds: 90,
      restSeconds: 90,
      collapsed: false,
      onToggleCollapse: jest.fn(),
      onSkip: jest.fn(),
      onExtend: jest.fn(),
      onChangeRest: jest.fn(),
    },

    references: {},
    bests: {},
    muscles: {},
    feedback: null,
    recordsCount: 0,
    prefs: { ghost: true, coach: 'sobre', sleep: false, voice: false, haptics: false },
    speak: jest.fn(),
    onAcceptAdjust: jest.fn(),
    onDismissAdjust: jest.fn(),
    onDismissTakeover: jest.fn(),
    showBarbell: false,
    cue: null,
    openPlanOnMount: false,
    goToSummary: jest.fn(),
  } as unknown as ImmersiveRuntime;

  return { ...base, ...over, rest: { ...base.rest, ...(over.rest ?? {}) } } as ImmersiveRuntime;
}
