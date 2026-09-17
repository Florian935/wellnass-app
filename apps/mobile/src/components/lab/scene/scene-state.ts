/**
 * US LABO-01 — ce que la scène 3D reçoit, et comment on le fabrique depuis les moteurs du Labo.
 *
 * Tout passe par la frontière d'un composant DOM (WebView) : l'état doit donc être **sérialisable**
 * — des nombres, des chaînes, des tableaux, rien d'autre. Les fonctions de ce fichier sont pures et
 * testées : la scène ne décide de rien, elle reçoit.
 */

import {
  GOOD_NIGHT_MINUTES,
  PROTEIN_TARGETS_G_PER_KG,
  objectiveCalorieDelta,
  type LabComposerResult,
  type LabDoses,
  type LabKnowledgeCard,
  type LabPair,
  type LabPillar,
  type LabQuestion,
  type LabWeek,
  type NutritionObjective,
  type Pillar,
} from '@wellness/shared';

/** Le vocabulaire de la scène — hérité du prototype, volontairement distinct des piliers de l'app. */
export type ScenePillar = 'muscu' | 'course' | 'nutrition' | 'socle';

export type SceneCrossing = { kind: 'syn' | 'tension' | 'guard'; pair: [ScenePillar, ScenePillar] };

export type SceneLabels = {
  brand: string;
  plate: string;
  trackBig: string;
  trackSmall: string;
  days: string[];
};

export type LabSceneState = {
  mode: 'week' | 'formula';
  pillars: { muscu: boolean; course: boolean; nutrition: boolean };
  /** Les doses lues par la scène (assiette, lampes, vitesse du pacer). */
  values: { fq: number; km: number; fr: number; pr: number; kc: number; gl: number; so: number; fuel: number; guard: boolean };
  /** Le réel de la semaine ; `null` en mode formule. */
  reality: {
    sessions: number;
    sessionsDone: number;
    km: number;
    kmDone: number;
    protein: number;
    nights: (number | null)[];
    today: number | null;
  } | null;
  crossings: SceneCrossing[];
  focus: ScenePillar[] | null;
  selected: ScenePillar | null;
  labels: SceneLabels;
  reducedMotion: boolean;
};

const PILLAR_TO_SCENE: Record<LabPillar, ScenePillar> = {
  strength: 'muscu',
  running: 'course',
  nutrition: 'nutrition',
  sleep: 'socle',
};

export function scenePillar(pillar: LabPillar): ScenePillar {
  return PILLAR_TO_SCENE[pillar];
}

/** Une paire de piliers identiques n'a pas de médaille : la scène ne saurait pas où la poser. */
export function sceneCrossing(kind: SceneCrossing['kind'], pair: LabPair): SceneCrossing | null {
  return pair[0] === pair[1] ? null : { kind, pair: [scenePillar(pair[0]), scenePillar(pair[1])] };
}

function crossingsOf(list: readonly { kind: SceneCrossing['kind']; pair: LabPair }[]): SceneCrossing[] {
  return list.map((c) => sceneCrossing(c.kind, c.pair)).filter((c): c is SceneCrossing => c !== null);
}

const pillarsOf = (active: readonly Pillar[]) => ({
  muscu: active.includes('strength'),
  course: active.includes('running'),
  nutrition: active.includes('nutrition'),
});

/** Les doses « nutrition » de la scène : elles dessinent l'assiette et la portion. */
function dishValues(objective: NutritionObjective, proteinGPerKg: number) {
  return { pr: proteinGPerKg, kc: objectiveCalorieDelta(objective), gl: 0 };
}

/** Une nuit : 1 = au-dessus de 7 h, 0 = en dessous, `null` = pas de check-in. */
export function nightMark(sleepMinutes: number | null): number | null {
  return sleepMinutes === null ? null : sleepMinutes >= GOOD_NIGHT_MINUTES ? 1 : 0;
}

/**
 * Le volume d'un pilier **tel que la semaine s'est passée** : le plus grand du prévu et du fait.
 *
 * 🔴 Le prévu seul ne suffit pas. La scène pilote la pile de disques sur le nombre de séances et
 * l'existence de la piste sur les kilomètres : prendre le **prévu** faisait disparaître le pilier
 * de quelqu'un qui a couru 7,5 km sans les avoir planifiés — pendant que le panneau, juste en
 * dessous, affichait « 7,5 sur 0,0 km ». La scène contredisait le texte, et se lisait comme cassée.
 *
 * Le fait ne remplace pas le prévu, il s'y ajoute : une semaine à 4 séances prévues dont 2 faites
 * garde bien ses 4 disques (2 pleins, 2 fantômes).
 */
export function weekVolume(planned: number | null | undefined, done: number | null | undefined): number {
  return Math.max(planned ?? 0, done ?? 0);
}

export function labSceneFromWeek(input: {
  week: LabWeek;
  activePillars: readonly Pillar[];
  objective: NutritionObjective;
  /** Les propositions déjà réglées ne portent plus de médaille. */
  resolved: readonly string[];
  labels: SceneLabels;
  reducedMotion: boolean;
  selected: ScenePillar | null;
  focus: ScenePillar[] | null;
}): LabSceneState {
  const { week } = input;
  const target = PROTEIN_TARGETS_G_PER_KG[input.objective];
  const gPerKg = week.progress.nutrition?.gPerKg ?? null;
  const open = week.proposals.filter((p) => !input.resolved.includes(p.id));
  return {
    mode: 'week',
    pillars: pillarsOf(input.activePillars),
    values: {
      fq: weekVolume(week.progress.strength?.planned, week.progress.strength?.done),
      km: weekVolume(week.progress.running?.plannedKm, week.progress.running?.doneKm),
      fr: week.days.reduce((n, d) => n + d.running.filter((s) => s.sessionType === 'fractionne').length, 0),
      ...dishValues(input.objective, target.min),
      so: 7.5,
      // Le panache de vapeur ne monte que si l'assiette est à peu près servie.
      fuel: gPerKg === null ? 0 : Math.round((gPerKg / target.min) * 100),
      guard: open.some((p) => p.tone === 'guard'),
    },
    reality: {
      sessions: weekVolume(week.progress.strength?.planned, week.progress.strength?.done),
      sessionsDone: week.progress.strength?.done ?? 0,
      km: weekVolume(week.progress.running?.plannedKm, week.progress.running?.doneKm),
      kmDone: week.progress.running?.doneKm ?? 0,
      protein: gPerKg === null ? 1 : Math.max(0.6, Math.min(1.1, gPerKg / target.min)),
      nights: week.days.map((d) => nightMark(d.sleepMinutes)),
      today: week.days.findIndex((d) => d.isToday) >= 0 ? week.days.findIndex((d) => d.isToday) : null,
    },
    crossings: crossingsOf(open.map((p) => ({ kind: p.tone === 'guard' ? 'guard' : 'tension', pair: p.pair }))),
    focus: input.focus,
    selected: input.selected,
    labels: input.labels,
    reducedMotion: input.reducedMotion,
  };
}

export function labSceneFromComposer(input: {
  doses: LabDoses;
  result: LabComposerResult;
  activePillars: readonly Pillar[];
  weeklyKm: number;
  labels: SceneLabels;
  reducedMotion: boolean;
  selected: ScenePillar | null;
}): LabSceneState {
  const { doses, result } = input;
  return {
    mode: 'formula',
    pillars: pillarsOf(input.activePillars),
    values: {
      fq: doses.strengthSessions,
      km: input.weeklyKm,
      fr: doses.runningFrequency >= 3 ? 1 : 0,
      ...dishValues(doses.objective, doses.proteinGPerKg),
      so: doses.sleep === 'long' ? 8.5 : 6.5,
      fuel: result.proteinStatus === 'low' ? 40 : 70,
      guard: result.crossings.some((c) => c.tone === 'guard'),
    },
    reality: null,
    crossings: crossingsOf(result.crossings.map((c) => ({ kind: c.tone === 'guard' ? 'guard' : c.tone === 'tension' ? 'tension' : 'syn', pair: c.pair }))),
    focus: null,
    selected: input.selected,
    labels: input.labels,
    reducedMotion: input.reducedMotion,
  };
}

/** L'enquête : la caméra s'approche des piliers en cause, les suspects portent les médailles. */
export function labSceneWithQuestion(base: LabSceneState, question: LabQuestion | null): LabSceneState {
  if (question === null) return base;
  return {
    ...base,
    crossings: crossingsOf(question.suspects.slice(0, 2).map((s) => ({ kind: 'tension' as const, pair: s.pair }))),
    focus: question.focus.map(scenePillar),
  };
}

/** Les acquis : ce qu'on sait de soi devient des médailles d'or. */
export function labSceneWithKnowledge(base: LabSceneState, cards: readonly LabKnowledgeCard[]): LabSceneState {
  const known = cards.filter((c) => c.status === 'verified' || c.status === 'solid' || c.status === 'probable');
  return { ...base, crossings: crossingsOf(known.map((c) => ({ kind: 'syn' as const, pair: c.pair }))), focus: null };
}
