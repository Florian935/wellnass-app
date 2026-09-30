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

/**
 * Les zones de croisement, vues du dessus (onglet Croiser) : là où deux disques se chevauchent, et
 * le centre — les trois piliers ensemble, ou « tes piliers × tes nuits » quand moins de trois
 * piliers sont actifs.
 */
export type SceneZone = 'mc' | 'mn' | 'cn' | 'centre';

/** `orbit` : la scène qu'on fait tourner (semaine, formule, enquête, acquis). `top` : vue du dessus. */
export type SceneView = 'orbit' | 'top';

/** L'état d'un lien, tel que le registre des liens le donne. */
export type SceneLinkState = 'guard' | 'adjust' | 'holds' | 'discover';

/**
 * La médaille d'une zone. `discover` n'a pas de médaille en 3D (rien n'est encore établi : poser un
 * métal ferait croire à un verdict) ; le repli 2D la dessine en pointillé.
 * `label` : libellé d'accessibilité **déjà traduit** par l'appelant — la scène ne traduit rien.
 */
export type SceneZoneMedal = { zone: SceneZone; kind: SceneCrossing['kind'] | 'discover'; label: string };

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
  view: SceneView;
  /** Les médailles par zone de la vue du dessus ; vide en orbite. */
  zones: SceneZoneMedal[];
  zoneSelected: SceneZone | null;
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

/** La vue par défaut : on tourne autour, sans zones. Un objet neuf à chaque appel (pas de tableau partagé). */
function orbitView(): Pick<LabSceneState, 'view' | 'zones' | 'zoneSelected'> {
  return { view: 'orbit', zones: [], zoneSelected: null };
}

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
    ...orbitView(),
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
    ...orbitView(),
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

/** L'état d'un lien → la médaille qui le dit. « À régler » est une tension, « ça tient » une synergie. */
const LINK_TO_MEDAL: Record<SceneLinkState, SceneZoneMedal['kind']> = {
  guard: 'guard',
  adjust: 'tension',
  holds: 'syn',
  discover: 'discover',
};

/** Du plus grave au plus neutre : c'est le pire état d'une zone qui porte sa médaille. */
const LINK_RANK: Record<SceneLinkState, number> = { guard: 0, adjust: 1, holds: 2, discover: 3 };

/**
 * L'onglet Croiser : la même scène, **vue du dessus**, où chaque zone de croisement porte une
 * médaille à l'état de son lien.
 *
 * Les médailles par paire de l'orbite (`crossings`) sont vidées : les zones les remplacent, et deux
 * jeux de médailles superposés ne se liraient plus. Le focus aussi : c'est la vue du dessus qui cadre.
 *
 * Une zone reçue deux fois ne pose qu'**une** médaille, celle de son pire état — deux médailles au
 * même endroit se chevaucheraient, et un garde-fou ne doit jamais disparaître sous un « ça tient ».
 */
export function labSceneWithZones(
  base: LabSceneState,
  zones: readonly { zone: SceneZone; state: SceneLinkState; label: string }[],
  selected: SceneZone | null,
): LabSceneState {
  const worst = new Map<SceneZone, { zone: SceneZone; state: SceneLinkState; label: string }>();
  for (const z of zones) {
    const current = worst.get(z.zone);
    if (current === undefined || LINK_RANK[z.state] < LINK_RANK[current.state]) worst.set(z.zone, z);
  }
  return {
    ...base,
    view: 'top',
    zones: [...worst.values()].map((z) => ({ zone: z.zone, kind: LINK_TO_MEDAL[z.state], label: z.label })),
    zoneSelected: selected,
    crossings: [],
    focus: null,
  };
}

/**
 * Les couleurs du ruban d'une médaille de zone : les deux piliers qui s'y croisent.
 * Le centre porte l'or du socle quand les trois piliers sont là (« tes trois piliers ensemble ») ;
 * sinon ce sont tes piliers actifs, ou ton pilier et tes nuits s'il n'en reste qu'un.
 */
export function sceneZonePair(zone: SceneZone, pillars: LabSceneState['pillars']): [ScenePillar, ScenePillar] {
  if (zone === 'mc') return ['muscu', 'course'];
  if (zone === 'mn') return ['muscu', 'nutrition'];
  if (zone === 'cn') return ['course', 'nutrition'];
  const on = (['muscu', 'course', 'nutrition'] as const).filter((p) => pillars[p]);
  if (on.length === 3 || on.length === 0) return ['socle', 'socle'];
  return on.length === 2 ? [on[0]!, on[1]!] : [on[0]!, 'socle'];
}
