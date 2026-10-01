/**
 * US LIENS-01 — le registre des liens entre piliers.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────────────────────────────
 * L'inventaire du 26/09/2026 a compté **106 croisements** au catalogue, dont une trentaine livrés,
 * répartis sur une vingtaine d'écrans, chacun avec sa propre table d'ordre et parfois son propre
 * seuil. Personne ne tenait la liste. Ce registre est cette liste : **un lien, une question, un
 * état, une phrase, un geste**, et les écrans où il fait écho.
 *
 * Le Labo (onglet Croiser, LABO-02) en est la maison ; les piliers n'en gardent qu'un écho
 * (ECHO-01). Voir `docs/specs/functional/us/liens01-registre-liens.md`.
 *
 * ── Ce que ce module n'est pas ──────────────────────────────────────────────────────────────────
 * **Pas une analyse nouvelle.** Chaque état vient d'un détecteur déjà livré et testé : collisions
 * (COLLIS-01), garde-fou (GARDE-01), charge (META-19), déficit × volume (MN-02), protéines (MN-06),
 * glucides (FUEL-01), APPORT-01, MR-08, TRI-03, GUID-01, CYCLE-01, les propositions et enquêtes du
 * Labo (LABO-01). Ce fichier **range** : il dit dans quel état est chaque lien et pourquoi.
 * Une seule règle ajoutée ici décide d'un état : le seuil de données minimal au-dessous duquel un
 * lien est « à découvrir » — et chacun de ces seuils est **emprunté** à un moteur existant.
 *
 * ── Les quatre états (décision du 26/09, validée le 30/09) ──────────────────────────────────────
 * `guard` (garde-fou) · `adjust` (à régler) · `holds` (ça tient) · `discover` (à découvrir).
 * L'ordre du tableau EST la priorité, comme `INSIGHT_ORDER` et `LAB_PROPOSAL_KINDS`.
 *
 * ⚠️ Aucune lecture d'horloge : `todayKey` entre par paramètre (React Compiler).
 */

import { addDays, localDateFromDayKey, localDayKey, startOfWeek } from './date';
import { MIN_LOGGED_DAYS, type DeficitVolumeAlert } from './bodyweight';
import type { CarbsPerKg } from './carb-target';
import type { GoalConflict } from './goal-conflicts';
import type { ActivityLevelSuggestionInput } from './insight-adapters';
import type { LabKnowledgeCard } from './lab-experiments';
import type { LabQuestion, LabSuspectKind } from './lab-investigations';
import type { LabProposal, LabProposalKind, LabWeek } from './lab-week';
import { CYCLE_PHASES, MIN_CYCLES_FOR_INSIGHTS, type CrossPhaseResult, type CyclePhase } from './menstrual-cycle';
import type { Pillar } from './pillar';
import type { ProteinPerKg } from './protein-target';
import type { ReadinessResult } from './readiness';
import { dotsScore, type DotsSex } from './strength-dots';
import { computeAcwr, type AcwrResult, type ConcurrentTrainingInterference, type OvertrainingGuardResult } from './training-time';
import type {
  AdherenceByDayType,
  EnergyByDayType,
  ProteinDistribution,
} from './training-nutrition-cross';
import {
  WELLBEING_LINKS_WINDOW_DAYS,
  WELLBEING_LINK_MIN_CASES,
  isKnownLink,
  linkProgress,
  type WellbeingLink,
  type WellbeingLinkId,
  type WellbeingLinkStatus,
  type WellbeingLinkUnit,
} from './wellbeing-links';

// ---------------------------------------------------------------------------
// Le registre
// ---------------------------------------------------------------------------

/**
 * Les liens, dans l'ordre d'affichage à état égal. Chacun répond à **une question** posée dans les
 * mots de l'utilisateur (`lab.links.<id>.question`) : c'est ce qui permet à une nouvelle analyse
 * du catalogue d'entrer comme une ligne dans une fiche, au lieu d'une carte de plus sur un écran.
 */
export const CROSS_LINK_IDS = [
  'sports', // Tes deux sports se gênent-ils ?
  'fuelStrength', // Manges-tu assez pour ta muscu ?
  'fuelRunning', // Ton carburant suit-il tes kilomètres ?
  'recovery', // Récupères-tu assez ?
  'wellbeing', // Ton état du jour pèse-t-il sur tes séances ? (BIEN-05, si le pilier Bien-être est activé)
  'weight', // Ton poids suit-il ton assiette ?
  'goals', // Tes objectifs tirent-ils dans le même sens ?
  'rhythm', // Tiens-tu le rythme partout ?
  'strengthWeight', // Ta force suit-elle ton poids ?
  'cycle', // Ton cycle et tes piliers (si le suivi est activé)
] as const;
export type CrossLinkId = (typeof CROSS_LINK_IDS)[number];

/** L'ordre de ce tableau est la priorité : le garde-fou passe toujours devant. */
export const CROSS_LINK_STATES = ['guard', 'adjust', 'holds', 'discover'] as const;
export type CrossLinkState = (typeof CROSS_LINK_STATES)[number];

export const CROSS_LINK_STATE_RANK: Record<CrossLinkState, number> = { guard: 0, adjust: 1, holds: 2, discover: 3 };

/** La zone de la carte des disques où se pose la médaille du lien. */
export type CrossLinkZone = 'mc' | 'mn' | 'cn' | 'centre';

/** Les pastilles de la lentille : les piliers, plus ce que le lien croise d'autre. */
export type CrossLinkLens = Pillar | 'sleep' | 'weight' | 'cycle' | 'wellbeing';

/**
 * Les écrans où un lien peut faire **écho** (ECHO-01). L'accueil n'y est pas : son widget montre le
 * lien le plus pressant, quel qu'il soit.
 */
export const CROSS_LINK_SURFACES = [
  'strengthProgress',
  'runningToday',
  'nutritionToday',
  'nutritionStats',
  'planning',
  'progress',
  'cycle',
  // US BIEN-05 — Bien-être › Ce qui compte.
  'wellbeing',
] as const;
export type CrossLinkSurface = (typeof CROSS_LINK_SURFACES)[number];

export type CrossLinkDefinition = {
  /**
   * Présent seulement si les piliers (ou l'option) qu'il croise sont activés (décision H).
   * US BIEN-05 — le pilier Bien-être n'est pas un `Pillar` (il ne porte ni disque, ni paire, ni
   * guidage) : il entre ici comme le cycle, par un drapeau.
   */
  available: (ctx: { activePillars: readonly Pillar[]; cycleTrackingEnabled: boolean; wellbeingEnabled: boolean }) => boolean;
  zone: CrossLinkZone;
  echoes: readonly CrossLinkSurface[];
  /**
   * Les analyses du catalogue qui **entrent** dans la fiche — livrées ou à venir. Sert à la
   * traçabilité (catalogue ↔ fiche) et au test « chaque analyse croisée livrée a une maison ».
   */
  analyses: readonly string[];
};

const has = (active: readonly Pillar[], p: Pillar) => active.includes(p);

export const CROSS_LINKS: Record<CrossLinkId, CrossLinkDefinition> = {
  sports: {
    available: ({ activePillars: a }) => has(a, 'strength') && has(a, 'running'),
    zone: 'mc',
    echoes: ['planning', 'runningToday', 'strengthProgress'],
    analyses: ['COLLIS-01', 'MR-01', 'MR-02', 'MR-06', 'MR-08', 'MR-17', 'MR-18'],
  },
  fuelStrength: {
    available: ({ activePillars: a }) => has(a, 'strength') && has(a, 'nutrition'),
    zone: 'mn',
    echoes: ['strengthProgress', 'nutritionToday', 'nutritionStats'],
    analyses: ['MN-01', 'MN-02', 'MN-03', 'MN-04', 'MN-06', 'MN-10', 'MN-15', 'MN-16', 'MN-18', 'MN-20'],
  },
  fuelRunning: {
    available: ({ activePillars: a }) => has(a, 'running') && has(a, 'nutrition'),
    zone: 'cn',
    echoes: ['runningToday', 'nutritionToday', 'nutritionStats'],
    analyses: ['RN-01', 'RN-02', 'RN-03', 'RN-04', 'RN-05', 'RN-06', 'RN-16', 'RESERV-01'],
  },
  recovery: {
    available: ({ activePillars: a }) => has(a, 'strength') || has(a, 'running'),
    zone: 'centre',
    // Revue du 30/09/2026 — le garde-fou de surentraînement (GARDE-01) ne demande pas la course : une
    // pratique muscu seule doit le retrouver dans son hub. Le planning n'est pas listé : il garde ses
    // bandeaux (collision, douleur), et aucun écho générique n'y est monté.
    echoes: ['runningToday', 'strengthProgress'],
    analyses: ['META-19', 'GARDE-01', 'MR-09', 'MR-14', 'TRI-03', 'TRI-12'],
  },
  wellbeing: {
    // Il faut quelque chose à croiser : un pilier au moins, en plus du Bien-être.
    available: ({ activePillars: a, wellbeingEnabled }) => wellbeingEnabled && a.length >= 1,
    zone: 'centre',
    echoes: ['wellbeing'],
    analyses: ['BW-01', 'BW-02', 'BW-03', 'BW-04', 'BW-05', 'BW-06', 'BW-07'],
  },
  weight: {
    available: ({ activePillars: a }) => has(a, 'nutrition'),
    zone: 'centre',
    echoes: ['nutritionToday'],
    analyses: ['DEPENSE-00', 'TRI-06', 'NUTR-19'],
  },
  goals: {
    available: ({ activePillars: a }) => a.length >= 2,
    zone: 'centre',
    echoes: [],
    analyses: ['GUID-01', 'CONS-01'],
  },
  rhythm: {
    available: ({ activePillars: a }) => a.length >= 2,
    zone: 'centre',
    echoes: [],
    analyses: ['TRI-01', 'TRI-02', 'BILAN-01', 'MR-22'],
  },
  strengthWeight: {
    available: ({ activePillars: a }) => has(a, 'strength'),
    zone: 'centre',
    // Jamais « à régler » (une force relative se lit, elle ne se corrige pas d'un geste) : donc jamais
    // d'écho. Déclarer une surface ici ferait dire à la fiche « tu le retrouves aussi dans… » à tort.
    echoes: [],
    analyses: ['MUSC-27'],
  },
  cycle: {
    available: ({ cycleTrackingEnabled }) => cycleTrackingEnabled,
    zone: 'centre',
    echoes: ['cycle'],
    analyses: ['CYCLE-01'],
  },
};

// ---------------------------------------------------------------------------
// Seuils de données — tous empruntés
// ---------------------------------------------------------------------------

/**
 * Jours saisis sous lesquels une moyenne de protéines ne dit rien. **Le même chiffre partout** :
 * avant LIENS-01, le Labo jugeait dès 2 jours et le verdict de la semaine en exigeait 4
 * (`MIN_LOGGED_DAYS`, MN-02). Une seule question, un seul seuil — celui qui était le plus prudent.
 */
export const CROSS_LINK_MIN_PROTEIN_DAYS = MIN_LOGGED_DAYS;

/** Semaines où les deux sports ont été pratiqués, sous lesquelles on ne parle pas de gêne. */
export const CROSS_LINK_MIN_WEEKS_BOTH_SPORTS = 2;

/** Pesées minimales sur huit semaines pour parler d'une tendance (une droite passe par deux points). */
export const CROSS_LINK_MIN_WEIGH_INS = 3;

/** Points minimaux d'une série avant de tracer un graphique : moins, c'est du bruit dessiné. */
export const CROSS_LINK_MIN_CHART_POINTS = 3;

// ---------------------------------------------------------------------------
// Types de sortie
// ---------------------------------------------------------------------------

/** Un texte traduit par l'écran : `lab.links.<scope>.<key>` interpolé avec `values`. */
export type CrossLinkText = { key: string; values: Record<string, number | string> };

export type CrossLinkRow = CrossLinkText & { state: CrossLinkState | null };

/** Où mène un geste qui n'écrit rien. */
export type CrossLinkRoute =
  | 'planning'
  | 'foodSuggestion'
  | 'nutritionProfile'
  | 'nutritionStats'
  | 'nutritionToday'
  | 'nutritionHistory'
  | 'runningToday'
  | 'review'
  | 'checkin'
  | 'progress'
  | 'cycle'
  | 'learn'
  // US BIEN-05 — le hub Bien-être.
  | 'wellbeing';

export type CrossLinkAction =
  /** Une proposition de l'onglet Semaine : elle écrit (feuille) ou elle ouvre, selon son action. */
  | { type: 'proposal'; proposal: LabProposal }
  | { type: 'open'; route: CrossLinkRoute }
  /** Le Conseil des trois (CONS-01), qui chiffre les deux issues d'une contradiction. */
  | { type: 'council'; conflict: GoalConflict };

export type CrossLinkChart =
  /** Deux mesures d'échelles différentes : deux panneaux alignés, jamais un double axe. */
  | { type: 'pair'; weeks: string[]; protein: (number | null)[]; band: [number, number]; lift: { name: string; values: (number | null)[]; plateauFrom: number | null } }
  /** Allure des séances de qualité, après des jambes lourdes ou non (s/km). */
  | { type: 'split'; exposed: number[]; other: number[] }
  /** Glucides g/kg des jours durs et des jours faciles, face au repère. */
  | { type: 'groups'; hard: number; easy: number; hardDays: number; easyDays: number; band: [number, number] }
  /** Le ratio de charge par semaine, dans sa zone saine. */
  | { type: 'band'; weeks: string[]; values: (number | null)[] }
  /** Une courbe seule (poids, total des trois mouvements). */
  | { type: 'line'; metric: 'weightKg' | 'sbdTotal'; weeks: string[]; values: (number | null)[] }
  /** Les jours actifs par semaine, un pilier par ligne. */
  | { type: 'grid'; weeks: string[]; rows: { pillar: Pillar; values: (number | null)[] }[] }
  /** Les moyennes par phase du cycle, une ligne par mesure prête. */
  | { type: 'phases'; metrics: { metric: CycleMetric; byPhase: Record<CyclePhase, number> }[] }
  /**
   * US BIEN-05 — les écarts des croisements Bien-être qui ont assez de cas : une ligne par
   * croisement, l'écart signé de part et d'autre d'un axe zéro, les cas de chaque côté.
   */
  | { type: 'effects'; items: { id: WellbeingLinkId; unit: WellbeingLinkUnit; delta: number; exposed: number; other: number; adverse: boolean | null; status: WellbeingLinkStatus }[] };

export type CrossLink = {
  id: CrossLinkId;
  zone: CrossLinkZone;
  lens: CrossLinkLens[];
  state: CrossLinkState;
  /** Deux phrases au plus, descriptives, sans « tu devrais » : `lab.links.<id>.verdict.<key>`. */
  verdict: CrossLinkText;
  /** Une ligne, pour la carte compacte et les échos : `lab.links.<id>.short.<key>`. */
  short: CrossLinkText;
  /** Au plus deux chiffres, un par côté du lien : `lab.links.figures.<key>`. */
  figures: CrossLinkText[];
  /** Ce que les données croisent : `lab.links.rows.<key>`. */
  rows: CrossLinkRow[];
  /** Le premier est le geste principal. */
  actions: CrossLinkAction[];
  /** Pour un lien « à découvrir » : ce qui manque, et où on en est. */
  missing: (CrossLinkText & { have: number; need: number }) | null;
  chart: CrossLinkChart | null;
  /** Ce sur quoi le calcul repose : `lab.links.source.<key>`. */
  source: CrossLinkText;
  echoes: readonly CrossLinkSurface[];
};

// ---------------------------------------------------------------------------
// Entrées
// ---------------------------------------------------------------------------

export type CycleMetric = 'energy' | 'mood' | 'stress' | 'tonnage' | 'calories' | 'pace';

/** Huit fenêtres glissantes de 7 jours finissant aujourd'hui — l'horizon des enquêtes du Labo. */
export type CrossLinkSeries = {
  /** Premier jour de chaque fenêtre, de la plus ancienne à la plus récente. */
  weeks: string[];
  proteinGPerKg: (number | null)[];
  mainLift: { name: string; values: (number | null)[] } | null;
  acwr: (number | null)[];
  weightKg: (number | null)[];
  sbdTotal: (number | null)[];
  activeDays: Record<Pillar, (number | null)[]>;
  legsPace: { exposed: number[]; other: number[] };
  carbsByDayType: { hard: number | null; easy: number | null; hardDays: number; easyDays: number };
};

export type CrossLinksInput = {
  todayKey: string;
  activePillars: readonly Pillar[];
  cycleTrackingEnabled: boolean;
  /** US VIE-01 : pendant une période « vie réelle », ce qui reproche d'avoir fait moins se tait. */
  inRealLifePeriod: boolean;
  week: LabWeek;
  knowledge: readonly LabKnowledgeCard[];
  questions: readonly LabQuestion[];
  acwr: AcwrResult | null;
  overtraining: OvertrainingGuardResult;
  deficitVolume: DeficitVolumeAlert;
  interference: ConcurrentTrainingInterference | null;
  /** MN-06 sur 7 jours, et le nombre de jours saisis qui la portent. */
  protein: (ProteinPerKg & { loggedDays: number }) | null;
  carbs: CarbsPerKg | null;
  /** RN-03 — la fréquence de course a changé, le niveau d'activité du profil est à revoir. */
  activityLevel: ActivityLevelSuggestionInput | null;
  apport: {
    energy: EnergyByDayType | null;
    adherence: AdherenceByDayType | null;
    lowFuelDays: number;
    distribution: ProteinDistribution | null;
  };
  trainingTime: { strengthSeconds: number; runningSeconds: number } | null;
  readiness: ReadinessResult | null;
  goalConflicts: readonly GoalConflict[];
  rhythm: { streakDays: number; lastWeekActiveDays: number | null; lastWeekDone: number | null; lastWeekPlanned: number | null };
  weight: { latestKg: number | null; kgPerWeek: number | null; weighIns: number; loggedDays7: number };
  strength: { dots: number | null; dotsDelta: number | null; sbdTotal: number | null };
  /**
   * `byMetric` à `null` : le détail par phase n'a pas été calculé (il lit tout l'historique, la
   * fiche le calcule elle-même). Le lien dit alors seulement s'il est lisible.
   */
  cycle: { cyclesObserved: number; byMetric: Partial<Record<CycleMetric, CrossPhaseResult>> | null } | null;
  series: CrossLinkSeries;
  /** US BIEN-05 — le pilier Bien-être est activé. Absent = non (comme le cycle). */
  wellbeingEnabled?: boolean;
  /** US BIEN-05 — les croisements calculés par `buildWellbeingLinks` ; `null` = pas encore calculés. */
  wellbeing?: WellbeingLinksSummary | null;
};

/** Ce que le lien Bien-être lit : les croisements, et les nuits de la semaine. */
export type WellbeingLinksSummary = {
  links: readonly WellbeingLink[];
  /** Nuits courtes ou agitées sur les 7 derniers matins renseignés. */
  recentPoorNights: number;
};

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
const text = (key: string, values: Record<string, number | string> = {}): CrossLinkText => ({ key, values });
const row = (key: string, values: Record<string, number | string>, state: CrossLinkState | null): CrossLinkRow => ({ key, values, state });
const nonNull = (xs: readonly (number | null)[]) => xs.filter((x): x is number => x !== null).length;
// La liste **entière**, pas celle plafonnée pour l'affichage (revue du 30/09/2026, voir `LabWeek`).
const proposalOf = (week: LabWeek, kind: LabProposalKind) => week.allProposals.filter((p) => p.kind === kind);

function lensFor(id: CrossLinkId, active: readonly Pillar[]): CrossLinkLens[] {
  const training = (['strength', 'running'] as const).filter((p) => active.includes(p));
  switch (id) {
    case 'sports':
      return ['strength', 'running'];
    case 'fuelStrength':
      return ['strength', 'nutrition'];
    case 'fuelRunning':
      return ['running', 'nutrition'];
    case 'recovery':
      return [...training, 'sleep'];
    case 'wellbeing':
      return ['wellbeing', ...active];
    case 'weight':
      return ['nutrition', 'weight'];
    case 'goals':
    case 'rhythm':
      return [...active];
    case 'strengthWeight':
      return ['strength', 'weight'];
    case 'cycle':
      return ['cycle', active[0] ?? 'strength'];
  }
}

function base(id: CrossLinkId, input: CrossLinksInput): Pick<CrossLink, 'id' | 'zone' | 'lens' | 'echoes' | 'missing' | 'chart'> {
  return { id, zone: CROSS_LINKS[id].zone, lens: lensFor(id, input.activePillars), echoes: CROSS_LINKS[id].echoes, missing: null, chart: null };
}

/** Le lien n'a pas encore de quoi répondre : on dit ce qui manque, jamais un zéro à la place d'un trou. */
function discover(id: CrossLinkId, input: CrossLinksInput, missingKey: string, have: number, need: number, values: Record<string, number | string> = {}): CrossLink {
  return {
    ...base(id, input),
    state: 'discover',
    verdict: text('discover', { have, need, ...values }),
    short: text('discover', { have, need, ...values }),
    figures: [],
    rows: [],
    actions: [],
    missing: { key: missingKey, values: { have, need, ...values }, have, need },
    source: text('discover'),
  };
}

// ---------------------------------------------------------------------------
// Les neuf liens
// ---------------------------------------------------------------------------

function sports(input: CrossLinksInput): CrossLink {
  const s = input.series;
  const weeksBoth = s.weeks.filter((_, i) => (s.activeDays.strength[i] ?? 0) > 0 && (s.activeDays.running[i] ?? 0) > 0).length;
  if (weeksBoth < CROSS_LINK_MIN_WEEKS_BOTH_SPORTS && proposalOf(input.week, 'collision').length === 0) {
    return discover('sports', input, 'bothSports', weeksBoth, CROSS_LINK_MIN_WEEKS_BOTH_SPORTS);
  }
  const collisions = proposalOf(input.week, 'collision');
  const legs = input.knowledge.find((k) => k.kind === 'heavyLegsPace');
  const interference = input.interference;

  const rows: CrossLinkRow[] = [row('collisions', { count: collisions.length }, collisions.length > 0 ? 'adjust' : 'holds')];
  if (legs !== undefined) {
    if (legs.status === 'learning') rows.push(row('legsPaceLearning', legs.values, 'discover'));
    else if (legs.status === 'noLink') rows.push(row('legsPaceNoLink', legs.values, 'holds'));
    else rows.push(row('legsPace', legs.values, (legs.values.delta ?? 0) > 0 ? 'adjust' : 'holds'));
  }
  // Les DEUX ratios : avec un seul, « tes deux sports évoluent ensemble » affirmerait ce qu'on n'a
  // pas mesuré (revue du 30/09/2026).
  if (interference !== null && (interference.show || (interference.runRatio !== null && interference.strengthRatio !== null))) {
    rows.push(
      interference.show
        ? row(`interference.${interference.direction ?? 'runningUpStrengthDown'}`, { run: round2(interference.runRatio ?? 0), strength: round2(interference.strengthRatio ?? 0) }, 'adjust')
        : row('interferenceNone', {}, 'holds'),
    );
  }
  if (input.trainingTime !== null && input.trainingTime.strengthSeconds + input.trainingTime.runningSeconds > 0) {
    rows.push(row('trainingTime', { strength: Math.round(input.trainingTime.strengthSeconds / 60), running: Math.round(input.trainingTime.runningSeconds / 60) }, null));
  }

  const legsKnown = legs !== undefined && (legs.status === 'solid' || legs.status === 'probable');
  const figures = [text('collisions', { count: collisions.length })];
  if (legsKnown) figures.push(text('legsPace', legs!.values));
  else {
    const time = rows.find((r) => r.key === 'trainingTime');
    if (time !== undefined) figures.push(time);
  }

  const chart: CrossLinkChart | null =
    s.legsPace.exposed.length + s.legsPace.other.length >= CROSS_LINK_MIN_CHART_POINTS && s.legsPace.exposed.length > 0 && s.legsPace.other.length > 0
      ? { type: 'split', exposed: [...s.legsPace.exposed], other: [...s.legsPace.other] }
      : null;

  const first = collisions[0];
  if (first !== undefined) {
    return {
      ...base('sports', input),
      state: 'adjust',
      verdict: text(first.action.type === 'open' && first.action.target === 'runningToday' ? 'collisionToday' : 'collision', first.values),
      short: text('collision', first.values),
      figures,
      rows,
      actions: [{ type: 'proposal', proposal: first }, { type: 'open', route: 'learn' }],
      chart,
      source: text('sports', { quality: s.legsPace.exposed.length + s.legsPace.other.length }),
    };
  }
  if (interference?.show) {
    return {
      ...base('sports', input),
      state: 'adjust',
      verdict: text(`interference.${interference.direction ?? 'runningUpStrengthDown'}`, { run: round2(interference.runRatio ?? 0), strength: round2(interference.strengthRatio ?? 0) }),
      short: text('interference'),
      figures,
      rows,
      actions: [{ type: 'open', route: 'planning' }],
      chart,
      source: text('sports', { quality: s.legsPace.exposed.length + s.legsPace.other.length }),
    };
  }
  return {
    ...base('sports', input),
    state: 'holds',
    verdict: text(legsKnown && (legs!.values.delta ?? 0) > 0 ? 'holdsKnown' : 'holds', legsKnown ? legs!.values : {}),
    short: text('holds'),
    figures,
    rows,
    actions: [{ type: 'open', route: 'planning' }],
    chart,
    source: text('sports', { quality: s.legsPace.exposed.length + s.legsPace.other.length }),
  };
}

function fuelStrength(input: CrossLinksInput): CrossLink {
  const p = input.protein;
  if (p === null) return discover('fuelStrength', input, input.weight.latestKg === null ? 'weighIn' : 'proteinDays', 0, CROSS_LINK_MIN_PROTEIN_DAYS);
  if (p.loggedDays < CROSS_LINK_MIN_PROTEIN_DAYS) return discover('fuelStrength', input, 'proteinDays', p.loggedDays, CROSS_LINK_MIN_PROTEIN_DAYS);

  const plateau = input.questions.find((q) => q.kind === 'liftPlateau');
  const deficitGuard = input.deficitVolume.show && !input.inRealLifePeriod;
  const proteinValues = { gPerKg: p.gPerKg, min: p.target.min, max: p.target.max, days: p.loggedDays };
  const rows: CrossLinkRow[] = [row('protein', proteinValues, p.status === 'low' ? 'adjust' : 'holds')];
  const d = input.apport.distribution;
  if (d !== null && d.servings.length > 0) rows.push(row('proteinServings', { count: d.servingsAtReference, grams: d.referenceG }, null));
  const e = input.apport.energy;
  if (e !== null) rows.push(row('energyByDayType', { delta: Math.round(e.deltaKcal), training: Math.round(e.trainingAvgKcal), rest: Math.round(e.restAvgKcal) }, null));
  const a = input.apport.adherence;
  if (a !== null) rows.push(row('adherenceByDayType', { training: Math.round(a.trainingPct), rest: Math.round(a.restPct) }, null));
  rows.push(row('lowFuelDays', { count: input.apport.lowFuelDays }, input.apport.lowFuelDays > 0 ? 'adjust' : 'holds'));
  if (!input.inRealLifePeriod) rows.push(row(deficitGuard ? 'deficitVolume' : 'deficitVolumeNone', { pct: input.deficitVolume.deficitPct }, deficitGuard ? 'guard' : 'holds'));

  const lift = input.series.mainLift;
  const liftPoints = lift === null ? [] : lift.values.filter((v): v is number => v !== null);
  const lastLift = liftPoints.length > 0 ? liftPoints[liftPoints.length - 1]! : null;
  const figures = [text('protein', proteinValues)];
  if (plateau !== undefined) figures.push(text('liftPlateau', plateau.values));
  else if (lift !== null && lastLift !== null) figures.push(text('lift', { name: lift.name, kg: lastLift }));

  const s = input.series;
  const chart: CrossLinkChart | null =
    nonNull(s.proteinGPerKg) >= CROSS_LINK_MIN_CHART_POINTS && lift !== null && nonNull(lift.values) >= CROSS_LINK_MIN_CHART_POINTS
      ? {
          type: 'pair',
          weeks: [...s.weeks],
          protein: [...s.proteinGPerKg],
          band: [p.target.min, p.target.max],
          lift: { name: lift.name, values: [...lift.values], plateauFrom: plateau !== undefined ? Math.max(0, lift.values.length - 3) : null },
        }
      : null;
  const source = text('fuelStrength', { days: p.loggedDays });

  if (deficitGuard) {
    const proposal = proposalOf(input.week, 'deficitVolume')[0];
    return {
      ...base('fuelStrength', input),
      state: 'guard',
      verdict: text('deficitVolume', { pct: input.deficitVolume.deficitPct, days: input.deficitVolume.loggedDays }),
      short: text('deficitVolume', { pct: input.deficitVolume.deficitPct }),
      figures,
      rows,
      actions: proposal ? [{ type: 'proposal', proposal }] : [{ type: 'open', route: 'nutritionProfile' }],
      chart,
      source,
    };
  }
  if (p.status === 'low') {
    const proposal = proposalOf(input.week, 'protein')[0];
    return {
      ...base('fuelStrength', input),
      state: 'adjust',
      verdict: text(plateau !== undefined ? 'proteinLowPlateau' : 'proteinLow', { ...proteinValues, ...(plateau?.values ?? {}) }),
      short: text('proteinLow', proteinValues),
      figures,
      rows,
      actions: [proposal ? { type: 'proposal', proposal } : { type: 'open', route: 'foodSuggestion' }, { type: 'open', route: 'learn' }],
      chart,
      source,
    };
  }
  return {
    ...base('fuelStrength', input),
    state: 'holds',
    verdict: text('holds', proteinValues),
    short: text('holds', proteinValues),
    figures,
    rows,
    actions: [{ type: 'open', route: 'nutritionToday' }],
    chart,
    source,
  };
}

function fuelRunning(input: CrossLinksInput): CrossLink {
  const c = input.carbs;
  // RN-03 se tait en période « vie réelle » (REAL_LIFE_MUTED_INSIGHTS) : même règle ici.
  const level = input.activityLevel !== null && input.activityLevel.show && !input.inRealLifePeriod ? input.activityLevel : null;
  const levelRow = level === null ? null : row('activityLevel', { suggested: level.suggested, runningDays: level.runningDays }, 'adjust');
  if (c === null) {
    if (level === null) return discover('fuelRunning', input, input.weight.latestKg === null ? 'weighIn' : 'carbs', 0, 1);
    return {
      ...base('fuelRunning', input),
      state: 'adjust',
      verdict: text('activityLevel', { suggested: level.suggested, runningDays: level.runningDays }),
      short: text('activityLevel', { runningDays: level.runningDays }),
      figures: [text('activityLevel', { runningDays: level.runningDays })],
      rows: [levelRow!],
      actions: [{ type: 'open', route: 'nutritionProfile' }],
      source: text('fuelRunning', { hardDays: 0, easyDays: 0 }),
    };
  }
  const carbsValues = { gPerKg: c.gPerKg, min: c.target.min, max: c.target.max };
  const split = input.series.carbsByDayType;
  const assoc = input.knowledge.find((k) => k.kind === 'carbsPace');
  const rows: CrossLinkRow[] = [row('carbs', carbsValues, c.status === 'low' ? 'adjust' : 'holds')];
  if (split.hard !== null && split.easy !== null) rows.push(row('carbsHardEasy', { hard: split.hard, easy: split.easy, hardDays: split.hardDays, easyDays: split.easyDays }, null));
  if (assoc !== undefined) {
    if (assoc.status === 'learning') rows.push(row('carbsPaceLearning', assoc.values, 'discover'));
    else if (assoc.status === 'noLink') rows.push(row('carbsPaceNoLink', assoc.values, 'holds'));
    else rows.push(row('carbsPace', assoc.values, (assoc.values.delta ?? 0) > 0 ? 'adjust' : 'holds'));
  }
  if (levelRow !== null) rows.push(levelRow);
  const figures = [text('carbs', carbsValues)];
  if (split.hard !== null && split.easy !== null) figures.push(text('carbsHardEasy', { hard: split.hard, easy: split.easy }));
  const chart: CrossLinkChart | null =
    split.hard !== null && split.easy !== null && split.hardDays > 0 && split.easyDays > 0
      ? { type: 'groups', hard: split.hard, easy: split.easy, hardDays: split.hardDays, easyDays: split.easyDays, band: [c.target.min, c.target.max] }
      : null;
  const source = text('fuelRunning', { hardDays: split.hardDays, easyDays: split.easyDays });

  const proposal = proposalOf(input.week, 'carbs')[0];
  if (proposal !== undefined) {
    return {
      ...base('fuelRunning', input),
      state: 'adjust',
      verdict: text('carbsLowHard', { ...carbsValues, hardSessions: proposal.values.hardSessions ?? 0 }),
      short: text('carbsLowHard', carbsValues),
      figures,
      rows,
      actions: [{ type: 'proposal', proposal }, { type: 'open', route: 'learn' }],
      chart,
      source,
    };
  }
  if (level !== null) {
    return {
      ...base('fuelRunning', input),
      state: 'adjust',
      verdict: text('activityLevel', { suggested: level.suggested, runningDays: level.runningDays }),
      short: text('activityLevel', { runningDays: level.runningDays }),
      figures,
      rows,
      actions: [{ type: 'open', route: 'nutritionProfile' }],
      chart,
      source,
    };
  }
  return {
    ...base('fuelRunning', input),
    state: 'holds',
    verdict: text(c.status === 'low' ? 'holdsLowEasyWeek' : 'holds', carbsValues),
    short: text('holds', carbsValues),
    figures,
    rows,
    actions: [{ type: 'open', route: 'nutritionToday' }],
    chart,
    source,
  };
}

function recovery(input: CrossLinksInput): CrossLink {
  const sleep = input.week.progress.sleep;
  const acwr = input.acwr;
  const readiness = input.readiness;
  if (acwr === null && input.overtraining.streakDays === 0 && sleep.loggedNights === 0 && (readiness === null || readiness.availableCount === 0)) {
    return discover('recovery', input, 'load', 0, 1);
  }
  const rows: CrossLinkRow[] = [];
  if (acwr !== null) rows.push(row('acwr', { ratio: round2(acwr.ratio), zone: acwr.zone }, acwr.showAlert ? 'guard' : 'holds'));
  rows.push(row('streak', { days: input.overtraining.streakDays }, input.overtraining.show ? 'guard' : 'holds'));
  if (readiness !== null && readiness.verdict !== null) rows.push(row(`readiness.${readiness.verdict}`, { negative: readiness.negativeCount, available: readiness.availableCount }, readiness.verdict === 'rest' ? 'adjust' : 'holds'));
  rows.push(
    sleep.loggedNights > 0
      ? row('nights', { good: sleep.goodNights, logged: sleep.loggedNights, last: sleep.lastMinutes ?? 0 }, null)
      : row('nightsNone', {}, 'discover'),
  );

  const figures: CrossLinkText[] = [];
  if (acwr !== null) figures.push(text('acwr', { ratio: round2(acwr.ratio) }));
  else figures.push(text('streak', { days: input.overtraining.streakDays }));
  figures.push(sleep.loggedNights > 0 ? text('nights', { good: sleep.goodNights, logged: sleep.loggedNights }) : text('nightsNone'));

  const chart: CrossLinkChart | null =
    nonNull(input.series.acwr) >= CROSS_LINK_MIN_CHART_POINTS ? { type: 'band', weeks: [...input.series.weeks], values: [...input.series.acwr] } : null;
  const source = text('recovery', { nights: sleep.loggedNights });
  const ratioValue = acwr !== null ? round2(acwr.ratio) : 0;

  const overtraining = proposalOf(input.week, 'overtraining')[0];
  const loadRisk = proposalOf(input.week, 'loadRisk')[0];
  if (overtraining !== undefined || loadRisk !== undefined) {
    const lead = loadRisk ?? overtraining!;
    return {
      ...base('recovery', input),
      state: 'guard',
      verdict: text(loadRisk && overtraining ? 'guardBoth' : loadRisk ? 'loadRisk' : 'overtraining', { ratio: ratioValue, days: input.overtraining.streakDays }),
      short: text(loadRisk ? 'loadRisk' : 'overtraining', { ratio: ratioValue, days: input.overtraining.streakDays }),
      figures,
      rows,
      actions: [{ type: 'proposal', proposal: lead }, ...(loadRisk && overtraining ? [{ type: 'proposal' as const, proposal: overtraining }] : [])],
      chart,
      source,
    };
  }
  const shortNight = proposalOf(input.week, 'shortNight')[0];
  if (shortNight !== undefined) {
    return {
      ...base('recovery', input),
      state: 'adjust',
      verdict: text('shortNight', shortNight.values),
      short: text('shortNight', shortNight.values),
      figures,
      rows,
      actions: [{ type: 'proposal', proposal: shortNight }, { type: 'open', route: 'checkin' }],
      chart,
      source,
    };
  }
  // Revue du 30/09/2026 — « repos conseillé » était une alerte d'Insights (INSIGHTS-02). Partie au
  // Labo, elle doit y demander quelque chose : sinon la fiche disait « rien ne signale un manque de
  // récupération » au-dessus d'une ligne « Forme du jour : repos conseillé ».
  if (readiness !== null && readiness.show && readiness.verdict === 'rest') {
    const values = { negative: readiness.negativeCount, available: readiness.availableCount };
    return {
      ...base('recovery', input),
      state: 'adjust',
      verdict: text('readinessRest', values),
      short: text('readinessRest', values),
      figures,
      rows,
      actions: [{ type: 'open', route: 'planning' }, { type: 'open', route: 'checkin' }],
      chart,
      source,
    };
  }
  const shortNights = sleep.loggedNights - sleep.goodNights;
  return {
    ...base('recovery', input),
    state: 'holds',
    verdict: text(acwr !== null ? (shortNights > sleep.goodNights ? 'holdsShortNights' : 'holdsRatio') : 'holds', { ratio: ratioValue, good: sleep.goodNights, logged: sleep.loggedNights }),
    // Sans ratio de charge (un seul sport suivi : l'ACWR demande les deux), la phrase courte ne dit
    // pas « charge saine » — elle n'a rien mesuré (revue du 30/09/2026).
    short: text(
      shortNights > sleep.goodNights ? (acwr !== null ? 'holdsShortNights' : 'shortNightsNoLoad') : acwr !== null ? 'holds' : 'holdsNoLoad',
      { ratio: ratioValue },
    ),
    figures,
    rows,
    actions: [{ type: 'open', route: 'checkin' }],
    chart,
    source,
  };
}

/** Les valeurs d'un croisement Bien-être, telles que les textes les interpolent. */
function wellbeingValues(link: WellbeingLink): Record<string, number> {
  const values: Record<string, number> = { exposed: link.exposed, other: link.other, have: linkProgress(link), need: link.need };
  if (link.delta !== null) values.delta = link.delta;
  return values;
}

/**
 * US BIEN-05 — « Ton état du jour pèse-t-il sur tes séances ? ».
 *
 * Chaque croisement Bien-être × pilier (`wellbeing-links.ts`) est une **ligne** de ce lien. Le lien
 * est « à régler » quand une piste **défavorable** sur la nuit tient ET que la semaine en contient
 * (au moins deux nuits courtes ou agitées) : c'est là qu'il y a quelque chose à faire. Il « tient »
 * sinon — y compris quand une piste existe mais que la semaine ne la déclenche pas.
 */
function wellbeing(input: CrossLinksInput): CrossLink {
  const wb = input.wellbeing ?? null;
  const cross = (wb?.links ?? []).filter((l) => l.scope === 'cross');
  const seen = cross.filter((l) => l.status !== 'learning');
  if (wb === null || seen.length === 0) {
    const have = cross.reduce((m, l) => Math.max(m, linkProgress(l)), 0);
    return discover('wellbeing', input, 'wellbeingCases', have, WELLBEING_LINK_MIN_CASES);
  }
  const known = cross.filter(isKnownLink);
  const adverse = known.filter((l) => l.adverse === true);
  const rows: CrossLinkRow[] = cross.map((l) =>
    row(`wellbeing.${l.id}.${l.status}`, wellbeingValues(l), l.status === 'learning' ? 'discover' : l.adverse === true ? 'adjust' : 'holds'),
  );
  // Les deux chiffres : les pistes défavorables d'abord (ce qui se règle), puis les autres.
  const figures = [...adverse, ...known.filter((l) => l.adverse !== true)].slice(0, 2).map((l) => text(`wellbeing.${l.id}`, wellbeingValues(l)));
  const chart: CrossLinkChart = {
    type: 'effects',
    items: seen.map((l) => ({ id: l.id, unit: l.unit, delta: l.delta ?? 0, exposed: l.exposed, other: l.other, adverse: l.adverse, status: l.status })),
  };
  const source = text('wellbeing', { days: WELLBEING_LINKS_WINDOW_DAYS });
  const nightAdverse = adverse.find((l) => l.id === 'nightStrength' || l.id === 'nightRunning' || l.id === 'nightIntake');
  if (nightAdverse !== undefined && wb.recentPoorNights >= 2) {
    const values = { nights: wb.recentPoorNights, ...wellbeingValues(nightAdverse) };
    return {
      ...base('wellbeing', input),
      state: 'adjust',
      verdict: text(`adjust.${nightAdverse.id}`, values),
      short: text('adjust', { nights: wb.recentPoorNights }),
      figures,
      rows,
      actions: [{ type: 'open', route: 'wellbeing' }, { type: 'open', route: 'learn' }],
      chart,
      source,
    };
  }
  return {
    ...base('wellbeing', input),
    state: 'holds',
    verdict: text(known.length > 0 ? 'holdsKnown' : 'holdsNone', { count: known.length, days: WELLBEING_LINKS_WINDOW_DAYS }),
    short: text(known.length > 0 ? 'holdsKnown' : 'holdsNone', { count: known.length }),
    figures,
    rows,
    actions: [{ type: 'open', route: 'wellbeing' }],
    chart,
    source,
  };
}

function weight(input: CrossLinksInput): CrossLink {
  const w = input.weight;
  if (w.weighIns < CROSS_LINK_MIN_WEIGH_INS || w.latestKg === null) {
    return discover('weight', input, 'weighIns', w.weighIns, CROSS_LINK_MIN_WEIGH_INS);
  }
  const perWeek = w.kgPerWeek === null ? 0 : round1(w.kgPerWeek);
  const rows: CrossLinkRow[] = [
    row('weightTrend', { kgPerWeek: perWeek, weighIns: w.weighIns }, null),
    row('loggedDays7', { count: w.loggedDays7 }, w.loggedDays7 >= MIN_LOGGED_DAYS ? 'holds' : 'adjust'),
  ];
  const figures = [text('weight', { kg: round1(w.latestKg), kgPerWeek: perWeek }), text('loggedDays7', { count: w.loggedDays7 })];
  const chart: CrossLinkChart | null =
    nonNull(input.series.weightKg) >= CROSS_LINK_MIN_CHART_POINTS ? { type: 'line', metric: 'weightKg', weeks: [...input.series.weeks], values: [...input.series.weightKg] } : null;
  const source = text('weight', { weighIns: w.weighIns });
  const plateau = input.questions.find((q) => q.kind === 'weightPlateau');
  if (plateau !== undefined) {
    // « Mesurer, pas restreindre » (LABO-01 R6) : le seul geste proposé est de compléter le journal.
    return {
      ...base('weight', input),
      state: 'adjust',
      verdict: text('plateau', { kgPerWeek: perWeek, days: w.loggedDays7 }),
      short: text('plateau', { kgPerWeek: perWeek }),
      figures,
      rows,
      actions: [{ type: 'open', route: 'nutritionHistory' }, { type: 'open', route: 'learn' }],
      chart,
      source,
    };
  }
  return {
    ...base('weight', input),
    state: 'holds',
    verdict: text(w.loggedDays7 < MIN_LOGGED_DAYS ? 'holdsGaps' : 'holds', { kgPerWeek: perWeek, days: w.loggedDays7 }),
    short: text('holds', { kgPerWeek: perWeek }),
    figures,
    rows,
    actions: [{ type: 'open', route: 'nutritionHistory' }],
    chart,
    source,
  };
}

function goals(input: CrossLinksInput): CrossLink {
  const conflict = input.goalConflicts[0];
  const rows = [row('goalConflicts', { count: input.goalConflicts.length }, input.goalConflicts.length > 0 ? 'adjust' : 'holds')];
  if (conflict !== undefined) {
    return {
      ...base('goals', input),
      state: 'adjust',
      verdict: text(`conflict.${conflict.rule}`),
      short: text('conflict'),
      figures: [],
      rows,
      actions: [{ type: 'council', conflict }],
      source: text('goals'),
    };
  }
  return {
    ...base('goals', input),
    state: 'holds',
    verdict: text('holds'),
    short: text('holds'),
    figures: [],
    rows,
    actions: [],
    source: text('goals'),
  };
}

function rhythm(input: CrossLinksInput): CrossLink {
  const r = input.rhythm;
  if (r.lastWeekActiveDays === null && r.streakDays === 0) return discover('rhythm', input, 'firstWeek', 0, 1);
  const rows: CrossLinkRow[] = [row('streakDays', { days: r.streakDays }, r.streakDays > 0 ? 'holds' : null)];
  if (r.lastWeekActiveDays !== null) rows.push(row('activeDays', { days: r.lastWeekActiveDays }, null));
  if (r.lastWeekDone !== null && r.lastWeekPlanned !== null && r.lastWeekPlanned > 0) rows.push(row('plannedDone', { done: r.lastWeekDone, planned: r.lastWeekPlanned }, null));
  if (input.trainingTime !== null && input.trainingTime.strengthSeconds + input.trainingTime.runningSeconds > 0) {
    rows.push(row('trainingTime', { strength: Math.round(input.trainingTime.strengthSeconds / 60), running: Math.round(input.trainingTime.runningSeconds / 60) }, null));
  }
  const figures = [text('streakDays', { days: r.streakDays })];
  if (r.lastWeekActiveDays !== null) figures.push(text('activeDays', { days: r.lastWeekActiveDays }));
  const s = input.series;
  const gridRows = input.activePillars.map((pillar) => ({ pillar, values: [...s.activeDays[pillar]] }));
  const chart: CrossLinkChart | null = gridRows.some((g) => nonNull(g.values) >= CROSS_LINK_MIN_CHART_POINTS)
    ? { type: 'grid', weeks: [...s.weeks], rows: gridRows }
    : null;
  return {
    ...base('rhythm', input),
    state: 'holds',
    verdict: text('holds', { days: r.streakDays, active: r.lastWeekActiveDays ?? 0 }),
    short: text('holds', { days: r.streakDays }),
    figures,
    rows,
    actions: [{ type: 'open', route: 'review' }],
    chart,
    source: text('rhythm'),
  };
}

function strengthWeight(input: CrossLinksInput): CrossLink {
  const st = input.strength;
  if (st.dots === null) return discover('strengthWeight', input, 'dots', 0, 1);
  // Revue du 30/09/2026 — sans record d'il y a huit semaines, l'écart est un **trou** : on ne l'écrit
  // pas « 0 en huit semaines », on dit qu'il faut attendre (clés `…NoDelta`).
  const score = Math.round(st.dots);
  const known = st.dotsDelta !== null;
  const dotsValues: Record<string, number> = known ? { score, delta: Math.round(st.dotsDelta!) } : { score };
  const rows: CrossLinkRow[] = [row(known ? 'dots' : 'dotsNoDelta', dotsValues, known && st.dotsDelta! >= 0 ? 'holds' : null)];
  if (st.sbdTotal !== null) rows.push(row('sbdTotal', { kg: Math.round(st.sbdTotal) }, null));
  if (input.weight.latestKg !== null) rows.push(row('weightNow', { kg: round1(input.weight.latestKg) }, null));
  const figures = [text(known ? 'dots' : 'dotsNoDelta', dotsValues)];
  if (input.weight.latestKg !== null) figures.push(text('weightNow', { kg: round1(input.weight.latestKg) }));
  const chart: CrossLinkChart | null =
    nonNull(input.series.sbdTotal) >= CROSS_LINK_MIN_CHART_POINTS ? { type: 'line', metric: 'sbdTotal', weeks: [...input.series.weeks], values: [...input.series.sbdTotal] } : null;
  return {
    ...base('strengthWeight', input),
    state: 'holds',
    verdict: text(!known ? 'holdsNoDelta' : st.dotsDelta! < 0 ? 'holdsDown' : 'holds', dotsValues),
    short: text('holds', { score }),
    figures,
    rows,
    actions: [{ type: 'open', route: 'progress' }],
    chart,
    source: text('strengthWeight'),
  };
}

function cycle(input: CrossLinksInput): CrossLink {
  const cy = input.cycle;
  if (cy === null) return discover('cycle', input, 'cycles', 0, MIN_CYCLES_FOR_INSIGHTS);
  if (cy.byMetric === null) {
    // Seuil de CYCLE-01 (3 cycles) : en dessous, rien de lisible ; au-dessus, la fiche fait le détail.
    if (cy.cyclesObserved < MIN_CYCLES_FOR_INSIGHTS) return discover('cycle', input, 'cycles', cy.cyclesObserved, MIN_CYCLES_FOR_INSIGHTS);
    return {
      ...base('cycle', input),
      state: 'holds',
      verdict: text('observed', { cycles: cy.cyclesObserved, metrics: 0 }),
      short: text('observed', { cycles: cy.cyclesObserved }),
      figures: [text('cycles', { count: cy.cyclesObserved })],
      rows: [],
      actions: [{ type: 'open', route: 'cycle' }],
      source: text('cycle', { cycles: cy.cyclesObserved }),
    };
  }
  const byMetric = cy.byMetric;
  const ready = (Object.keys(byMetric) as CycleMetric[])
    .map((metric) => ({ metric, result: byMetric[metric] }))
    .filter((m): m is { metric: CycleMetric; result: Extract<CrossPhaseResult, { status: 'ready' }> } => m.result !== undefined && m.result.status === 'ready');
  if (ready.length === 0) return discover('cycle', input, 'cycles', Math.min(cy.cyclesObserved, MIN_CYCLES_FOR_INSIGHTS), MIN_CYCLES_FOR_INSIGHTS);
  const metrics = ready.map(({ metric, result }) => ({
    metric,
    byPhase: Object.fromEntries(CYCLE_PHASES.map((ph) => [ph, round1(result.byPhase[ph].average)])) as Record<CyclePhase, number>,
  }));
  return {
    ...base('cycle', input),
    state: 'holds',
    verdict: text('observed', { cycles: cy.cyclesObserved, metrics: ready.length }),
    short: text('observed', { cycles: cy.cyclesObserved }),
    figures: [text('cycles', { count: cy.cyclesObserved })],
    rows: [],
    actions: [{ type: 'open', route: 'cycle' }],
    chart: { type: 'phases', metrics },
    source: text('cycle', { cycles: cy.cyclesObserved }),
  };
}

const BUILDERS: Record<CrossLinkId, (input: CrossLinksInput) => CrossLink> = {
  sports,
  fuelStrength,
  fuelRunning,
  recovery,
  wellbeing,
  weight,
  goals,
  rhythm,
  strengthWeight,
  cycle,
};

/**
 * Tous les liens disponibles, rangés : le garde-fou d'abord, puis ce qui est à régler, ce qui tient,
 * ce qui reste à découvrir. À état égal, l'ordre de `CROSS_LINK_IDS`.
 */
export function buildCrossLinks(input: CrossLinksInput): CrossLink[] {
  const ctx = { activePillars: input.activePillars, cycleTrackingEnabled: input.cycleTrackingEnabled, wellbeingEnabled: input.wellbeingEnabled === true };
  return CROSS_LINK_IDS.filter((id) => CROSS_LINKS[id].available(ctx))
    .map((id) => BUILDERS[id](input))
    .sort((a, b) => CROSS_LINK_STATE_RANK[a.state] - CROSS_LINK_STATE_RANK[b.state] || CROSS_LINK_IDS.indexOf(a.id) - CROSS_LINK_IDS.indexOf(b.id));
}

// ---------------------------------------------------------------------------
// Ce qui se lit à partir des liens
// ---------------------------------------------------------------------------

export type CrossLinksSummary = Record<CrossLinkState, number> & { total: number };

export function summarizeCrossLinks(links: readonly CrossLink[]): CrossLinksSummary {
  const out = { guard: 0, adjust: 0, holds: 0, discover: 0, total: links.length };
  for (const l of links) out[l.state] += 1;
  return out;
}

/** L'état d'une zone de la carte : le pire des liens qui s'y trouvent, `null` si elle est vide. */
export function zoneState(links: readonly CrossLink[], zone: CrossLinkZone): CrossLinkState | null {
  const inZone = links.filter((l) => l.zone === zone);
  if (inZone.length === 0) return null;
  return inZone.reduce<CrossLinkState>((worst, l) => (CROSS_LINK_STATE_RANK[l.state] < CROSS_LINK_STATE_RANK[worst] ? l.state : worst), 'discover');
}

/**
 * L'écho d'un écran (ECHO-01) : le lien le plus pressant **qui le concerne**, et seulement s'il
 * demande quelque chose. Un lien qui tient ne fait pas d'écho : le pilier n'a rien à en dire.
 */
export function echoFor(links: readonly CrossLink[], surface: CrossLinkSurface): CrossLink | null {
  return links.find((l) => (l.state === 'guard' || l.state === 'adjust') && l.echoes.includes(surface)) ?? null;
}

/** Le lien que l'accueil met en avant : le plus pressant de tous, s'il demande quelque chose. */
export function pressingLink(links: readonly CrossLink[]): CrossLink | null {
  return links.find((l) => l.state === 'guard' || l.state === 'adjust') ?? null;
}

// ---------------------------------------------------------------------------
// L'histoire d'un lien — figée chaque semaine (décision Q5 du 30/09/2026)
// ---------------------------------------------------------------------------

/** Lundi de la semaine d'un jour : la clé sous laquelle l'état d'une semaine est figé. */
export function crossLinkWeekKey(dayKey: string): string {
  return localDayKey(startOfWeek(localDateFromDayKey(dayKey)));
}

/** Nombre de semaines montrées par l'histoire d'un lien. */
export const CROSS_LINK_HISTORY_WEEKS = 8;

export type CrossLinkWeekRecord = { id: string; linkId: string; weekStart: string; state: string };

/**
 * Les huit dernières semaines d'un lien, de la plus ancienne à celle en cours. `null` : aucune
 * trace (semaine d'avant le Labo, ou lien absent) — un trou, jamais un état inventé.
 */
export function crossLinkHistory(records: readonly CrossLinkWeekRecord[], linkId: CrossLinkId, todayKey: string): (CrossLinkState | null)[] {
  const current = localDateFromDayKey(crossLinkWeekKey(todayKey));
  return Array.from({ length: CROSS_LINK_HISTORY_WEEKS }, (_, i) => {
    const week = localDayKey(addDays(current, -7 * (CROSS_LINK_HISTORY_WEEKS - 1 - i)));
    const found = records.find((r) => r.linkId === linkId && r.weekStart === week);
    return found !== undefined && (CROSS_LINK_STATES as readonly string[]).includes(found.state) ? (found.state as CrossLinkState) : null;
  });
}

/**
 * Ce qu'il faut écrire pour la semaine **en cours** : un état par lien, seulement s'il a changé.
 *
 * 🔴 Les semaines passées ne sont **jamais** réécrites : c'est ce qui fige l'histoire. Une semaine
 * se referme avec le dernier état observé pendant qu'elle courait — le même principe que le
 * verdict d'une expérience, figé à sa clôture (LABO-04).
 */
export function crossLinkWeekWrites(
  links: readonly CrossLink[],
  records: readonly CrossLinkWeekRecord[],
  todayKey: string,
  userId: string,
  /**
   * Revue du 30/09/2026 — l'état que **cet appareil** avait calculé au passage précédent (vide au
   * premier passage de la session). Une ligne qui diffère n'est réécrite que si le calcul **local** a
   * changé depuis : une différence venue d'un autre appareil (une règle rejetée sur un seul téléphone,
   * deux versions de l'app) ne relance pas d'écriture. Sans ce garde, deux appareils ouverts qui
   * calculent différemment se renvoyaient la ligne à l'infini.
   */
  previous: ReadonlyMap<CrossLinkId, CrossLinkState> = new Map(),
): { id: string; linkId: CrossLinkId; weekStart: string; state: CrossLinkState }[] {
  const weekStart = crossLinkWeekKey(todayKey);
  return links
    .filter((l) => {
      const stored = records.find((r) => r.linkId === l.id && r.weekStart === weekStart);
      if (stored === undefined) return true;
      if (stored.state === l.state) return false;
      const before = previous.get(l.id);
      return before === undefined || before !== l.state;
    })
    .map((l) => ({ id: stableUuid(`${userId}|${weekStart}|${l.id}`), linkId: l.id, weekStart, state: l.state }));
}

// ---------------------------------------------------------------------------
// « Ta force suit-elle ton poids ? » — l'écart DOTS sur huit semaines (MUSC-27)
// ---------------------------------------------------------------------------

/** Tolérance entre un record et la pesée qui sert à le rapporter au poids de ce jour-là. */
export const DOTS_WEIGHT_TOLERANCE_DAYS = 15;

/**
 * L'écart de score DOTS sur huit semaines, ou `null` quand il ne se mesure pas.
 *
 * Revue du 30/09/2026 — deux défauts corrigés :
 *  - le record « d'il y a huit semaines » pouvait dater de quatre mois (le dernier record avant
 *    J−56, sans borne) : l'écart affiché « en huit semaines » n'en portait pas sur huit ;
 *  - le poids de ce jour-là n'était jamais trouvé (les pesées lues commencent à J−55), et le calcul
 *    retombait sur le poids **d'aujourd'hui** : 5 kg perdus à total constant donnaient « 0 ».
 * D'où : un record entre J−70 et J−56, et une pesée à `DOTS_WEIGHT_TOLERANCE_DAYS` jours près de ce
 * record. Sans l'un ou l'autre, c'est un **trou** — la fiche dit qu'il faut attendre, jamais « 0 ».
 */
export function dotsEightWeekDelta(input: {
  todayKey: string;
  dotsNow: number | null;
  /** Totaux SBD datés (ISO ou clé de jour), du plus ancien au plus récent. */
  history: readonly { date: string; totalKg: number }[];
  weights: readonly { dayKey: string; weightKg: number }[];
  sex: DotsSex;
}): number | null {
  if (input.dotsNow === null) return null;
  const today = localDateFromDayKey(input.todayKey);
  const from = localDayKey(addDays(today, -70));
  const to = localDayKey(addDays(today, -56));
  const past = input.history.filter((p) => p.date.slice(0, 10) >= from && p.date.slice(0, 10) <= to).pop();
  if (past === undefined) return null;
  const pastDay = localDateFromDayKey(past.date.slice(0, 10)).getTime();
  const gap = (w: { dayKey: string }) => Math.abs(localDateFromDayKey(w.dayKey).getTime() - pastDay) / 86_400_000;
  const weight = [...input.weights].filter((w) => gap(w) <= DOTS_WEIGHT_TOLERANCE_DAYS).sort((a, b) => gap(a) - gap(b))[0];
  if (weight === undefined) return null;
  const dotsPast = dotsScore(past.totalKg, weight.weightKg, input.sex);
  return dotsPast === null ? null : input.dotsNow - dotsPast;
}

/**
 * Un UUID **déterministe** (version 8, RFC 9562) tiré d'une clé.
 *
 * Pourquoi : deux appareils du même compte qui figent la même semaine du même lien doivent écrire
 * **la même ligne**. Avec un UUID aléatoire, il aurait fallu un index unique côté base — et un rejet
 * à l'upload fige la file PowerSync de **toutes** les tables (leçon LABO-01 R7 bis). Ici la seconde
 * écriture est un simple remplacement de la première.
 *
 * Hachage cyrb128 (quatre mots de 32 bits) : sans cryptographie, parce qu'il ne protège rien — il
 * évite seulement deux identifiants différents pour une même clé.
 */
export function stableUuid(key: string): string {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < key.length; i++) {
    const k = key.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const hex = [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// ---------------------------------------------------------------------------
// Les séries des graphiques — huit fenêtres de 7 jours
// ---------------------------------------------------------------------------

export type CrossLinkSeriesInput = {
  todayKey: string;
  activePillars: readonly Pillar[];
  /** Poids pour les g/kg ; `null` : aucune série par kilo. */
  weightKg: number | null;
  nutritionDays: readonly { dayKey: string; proteinG: number; carbsG: number }[];
  weights: readonly { dayKey: string; weightKg: number }[];
  /** Meilleur 1RM estimé par fenêtre et par mouvement (même découpage que les enquêtes). */
  lifts: readonly { name: string; weeks: readonly (number | null)[] }[];
  loadSessions: readonly { dayKey: string; rpe: number | null; durationSeconds: number | null }[];
  qualityRuns: readonly { dayKey: string; paceSPerKm: number }[];
  heavyLegDays: readonly string[];
  runDays: readonly { dayKey: string; hard: boolean }[];
  strengthDays: readonly string[];
};

/** Les huit fenêtres : chacune finit 7 × k jours avant aujourd'hui (même découpage que `useLabHistory`). */
export function crossLinkWindows(todayKey: string): { from: string; to: string }[] {
  const today = localDateFromDayKey(todayKey);
  return Array.from({ length: CROSS_LINK_HISTORY_WEEKS }, (_, i) => {
    const to = addDays(today, -7 * (CROSS_LINK_HISTORY_WEEKS - 1 - i));
    return { from: localDayKey(addDays(to, -6)), to: localDayKey(to) };
  });
}

export function buildCrossLinkSeries(input: CrossLinkSeriesInput): CrossLinkSeries {
  const windows = crossLinkWindows(input.todayKey);
  const inWindow = (day: string, w: { from: string; to: string }) => day >= w.from && day <= w.to;
  const avg = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);
  const active = (p: Pillar) => input.activePillars.includes(p);

  const proteinGPerKg = windows.map((w) => {
    const days = input.nutritionDays.filter((d) => inWindow(d.dayKey, w));
    const mean = avg(days.map((d) => d.proteinG));
    return mean === null || input.weightKg === null || input.weightKg <= 0 ? null : round1(mean / input.weightKg);
  });

  const withData = input.lifts.filter((l) => l.weeks.some((v) => v !== null));
  const main = [...withData].sort((a, b) => b.weeks.filter((v) => v !== null).length - a.weeks.filter((v) => v !== null).length)[0];
  const mainLift = main === undefined ? null : { name: main.name, values: [...main.weeks] };

  const sbdTotal = windows.map((_, i) => {
    if (input.lifts.length < 3) return null;
    const values = input.lifts.slice(0, 3).map((l) => l.weeks[i] ?? null);
    return values.every((v) => v !== null) ? values.reduce((s, v) => s + (v ?? 0), 0) : null;
  });

  // Le ratio de charge n'a de sens qu'avec les deux sports (même garde que `useTrainingLoadAlert`).
  const acwr = windows.map((w) => {
    if (!(active('strength') && active('running'))) return null;
    const end = localDateFromDayKey(w.to);
    const acuteFrom = localDayKey(addDays(end, -6));
    const chronicFrom = localDayKey(addDays(end, -27));
    const result = computeAcwr({
      acuteSessions: input.loadSessions.filter((s) => s.dayKey >= acuteFrom && s.dayKey <= w.to),
      chronicSessions: input.loadSessions.filter((s) => s.dayKey >= chronicFrom && s.dayKey <= w.to),
    });
    return result === null ? null : round2(result.ratio);
  });

  const weightKg = windows.map((w) => {
    const mean = avg(input.weights.filter((e) => inWindow(e.dayKey, w)).map((e) => e.weightKg));
    return mean === null ? null : round1(mean);
  });

  const countDays = (keys: readonly string[], w: { from: string; to: string }) => new Set(keys.filter((k) => inWindow(k, w))).size;
  const activeDays: Record<Pillar, (number | null)[]> = {
    strength: windows.map((w) => (active('strength') ? countDays(input.strengthDays, w) : null)),
    running: windows.map((w) => (active('running') ? countDays(input.runDays.map((r) => r.dayKey), w) : null)),
    nutrition: windows.map((w) => (active('nutrition') ? countDays(input.nutritionDays.map((d) => d.dayKey), w) : null)),
  };

  const heavy = new Set(input.heavyLegDays);
  const eve = (day: string) => localDayKey(addDays(localDateFromDayKey(day), -1));
  const legsPace = {
    exposed: input.qualityRuns.filter((r) => heavy.has(eve(r.dayKey))).map((r) => r.paceSPerKm),
    other: input.qualityRuns.filter((r) => !heavy.has(eve(r.dayKey))).map((r) => r.paceSPerKm),
  };

  // Glucides des 4 dernières semaines, jours durs contre jours faciles (FUEL-01 : fractionné et
  // sortie longue sont durs). Un jour sans saisie n'entre dans aucun des deux groupes.
  const since = localDayKey(addDays(localDateFromDayKey(input.todayKey), -27));
  const hardDays = new Set(input.runDays.filter((r) => r.hard).map((r) => r.dayKey));
  const recent = input.nutritionDays.filter((d) => d.dayKey >= since && d.dayKey <= input.todayKey);
  const perKg = (d: { carbsG: number }) => (input.weightKg === null || input.weightKg <= 0 ? null : d.carbsG / input.weightKg);
  const hard = recent.filter((d) => hardDays.has(d.dayKey)).map(perKg).filter((x): x is number => x !== null);
  const easy = recent.filter((d) => !hardDays.has(d.dayKey)).map(perKg).filter((x): x is number => x !== null);
  const carbsByDayType = {
    hard: hard.length === 0 ? null : round1(avg(hard)!),
    easy: easy.length === 0 ? null : round1(avg(easy)!),
    hardDays: hard.length,
    easyDays: easy.length,
  };

  return { weeks: windows.map((w) => w.from), proteinGPerKg, mainLift, acwr, weightKg, sbdTotal, activeDays, legsPace, carbsByDayType };
}

/**
 * La fiche où vit chaque suspect d'une enquête (onglet Apprendre) : « Voir le lien » y mène. Une
 * enquête part d'une courbe qui cale ; ses causes, elles, sont des liens entre piliers.
 */
export const SUSPECT_LINK: Record<LabSuspectKind, CrossLinkId> = {
  legsBeforeQuality: 'sports',
  proteinLow: 'fuelStrength',
  deficit: 'fuelStrength',
  sleepShort: 'recovery',
  loadHigh: 'recovery',
  weekendSurplus: 'weight',
  journalGaps: 'weight',
  carbsLowHardDays: 'fuelRunning',
};

/** Les associations encore en apprentissage : elles vont dans « à découvrir », avec ce qui manque. */
export function learningAssociations(knowledge: readonly LabKnowledgeCard[]): LabKnowledgeCard[] {
  return knowledge.filter((k) => k.source === 'association' && k.status === 'learning');
}
