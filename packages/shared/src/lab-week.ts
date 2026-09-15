/**
 * US LABO-01 (roadmap 7.30) — le Labo, onglet « Semaine » : la semaine réelle, pilier par pilier, et
 * ce que le Labo propose d'y changer.
 *
 * ── Ce que ce module n'est pas ──────────────────────────────────────────────────────────────────
 * **Pas une analyse nouvelle.** Chaque proposition est portée par un détecteur déjà livré et testé :
 * collisions (COLLIS-01), garde-fou charge & récupération (GARDE-01), charge aiguë/chronique (META-19),
 * déficit × volume (MN-02), protéines par kilo (MN-06), glucides du coureur (FUEL-01). Le seul signal
 * neuf est la nuit courte, et il ne fait que lire la durée de sommeil saisie au check-in (BIEN-01).
 * Ce fichier **range, ordonne et attache à chaque signal le geste qui le règle** — rien de plus.
 *
 * ── Les trois règles qui tiennent l'écran honnête ──────────────────────────────────────────────
 *  1. **Un pilier désactivé n'existe pas** (décision H) : ni ligne dans la semaine, ni proposition.
 *  2. **Une carte porte toujours le chiffre qui la justifie** (même contrat qu'INSIGHTS-01) : pas de
 *     « tes protéines sont basses » sans le g/kg et l'écart.
 *  3. **Les garde-fous passent devant**, et ne se retirent pas d'un geste : ils sont `safety`.
 *
 * ⚠️ Aucune lecture d'horloge : `todayKey` et `weekStartKey` entrent par paramètre (même raison que
 * `findSessionConflicts` — React Compiler gèlerait une lecture d'horloge dans un hook).
 */

import { addDays, localDateFromDayKey, localDayKey } from './date';
import type { DeficitVolumeAlert } from './bodyweight';
import type { CarbsPerKg } from './carb-target';
import type { Pillar } from './pillar';
import type { ProteinTarget } from './protein-target';
import type { ProgramSessionType } from './running-paces';
import { isIntenseSessionType, REPS_REDUCTION_PCT } from './session-adaptation';
import type { SessionConflict } from './session-conflicts';
import type { AcwrResult, OvertrainingGuardResult } from './training-time';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Sous ce seuil, la nuit est « courte ». 6 h est le repère le plus couramment retenu pour une
 * restriction de sommeil qui dégrade la performance du lendemain — pas un chiffre calibré sur nos
 * utilisateurs. Exporté et nommé pour être rediscuté, comme `LEG_SETS_CONFLICT_THRESHOLD`.
 */
export const SHORT_NIGHT_MINUTES = 6 * 60;

/** Au-dessus, une « bonne » nuit : la borne basse des 7-9 h recommandées à l'adulte. */
export const GOOD_NIGHT_MINUTES = 7 * 60;

/** Sous ce nombre de jours saisis, une moyenne de protéines ne dit rien de la semaine. */
export const LAB_MIN_PROTEIN_DAYS = 2;

/** Au-delà, l'écran devient une liste de reproches : on garde les plus importantes. */
export const LAB_MAX_PROPOSALS = 5;

/**
 * L'ordre des cartes. Les garde-fous d'abord (sécurité), puis ce qui abîme une séance précise de la
 * semaine, puis ce qui se corrige dans l'assiette. Une table plutôt qu'un score : même parti pris que
 * `INSIGHT_ORDER` (INSIGHTS-01) — rien à pondérer, rien à défendre.
 */
export const LAB_PROPOSAL_KINDS = [
  'overtraining',
  'loadRisk',
  'deficitVolume',
  'collision',
  'shortNight',
  'protein',
  'carbs',
] as const;
export type LabProposalKind = (typeof LAB_PROPOSAL_KINDS)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Les « piliers » du Labo : les trois piliers, plus le socle (le sommeil). */
export type LabPillar = Pillar | 'sleep';

/** Deux piliers en jeu. Identiques quand un seul pilier est concerné (aucune médaille alors). */
export type LabPair = readonly [LabPillar, LabPillar];

/** Une séance planifiée de la semaine, réduite à ce que le Labo affiche. */
export type LabSessionInput = {
  id: string;
  dayKey: string;
  pillar: Pillar;
  status: 'planned' | 'done' | 'skipped';
  name: string | null;
  sessionType: ProgramSessionType | null;
  targetDistanceM: number | null;
};

export type LabWeekInput = {
  /** Lundi de la semaine affichée. */
  weekStartKey: string;
  todayKey: string;
  activePillars: readonly Pillar[];
  /** Séances planifiées des 7 jours affichés, tous piliers. */
  sessions: readonly LabSessionInput[];
  /** Courses réellement courues cette semaine (planifiées ou non). */
  runs: readonly { dayKey: string; distanceM: number }[];
  /** Protéines des jours saisis cette semaine. */
  proteinByDay: readonly { dayKey: string; proteinG: number }[];
  weightKg: number | null;
  proteinTarget: ProteinTarget | null;
  /** Check-ins : `dayKey` est le matin, `sleepMinutes` la nuit qui le précède. */
  nights: readonly { dayKey: string; sleepMinutes: number | null }[];
  conflicts: readonly SessionConflict[];
  overtraining: OvertrainingGuardResult;
  acwr: AcwrResult | null;
  deficitVolume: DeficitVolumeAlert;
  carbs: CarbsPerKg | null;
};

export type LabDaySession = {
  id: string;
  name: string | null;
  sessionType: ProgramSessionType | null;
  status: 'planned' | 'done' | 'skipped';
  distanceM: number | null;
};

export type LabDay = {
  dayKey: string;
  isToday: boolean;
  isPast: boolean;
  strength: LabDaySession[];
  running: LabDaySession[];
  /** g/kg du jour, `null` si rien de saisi ou pas de poids. */
  proteinGPerKg: number | null;
  /** Nuit qui précède ce matin, `null` si pas de check-in. */
  sleepMinutes: number | null;
};

export type LabNext = { dayKey: string; name: string | null; sessionType: ProgramSessionType | null };

export type LabWeekProgress = {
  /** `null` : pilier désactivé. */
  strength: { done: number; planned: number; next: LabNext | null } | null;
  running: { doneKm: number; plannedKm: number; next: LabNext | null } | null;
  nutrition: { gPerKg: number | null; target: ProteinTarget | null; loggedDays: number } | null;
  sleep: { goodNights: number; loggedNights: number; lastMinutes: number | null };
};

/** Le geste attaché à une proposition. */
export type LabAction =
  /** Déplacer une séance planifiée : passe par la feuille « ce qui change dans ton plan ». */
  | { type: 'reschedule'; plannedSessionId: string; fromDayKey: string; toDayKey: string }
  /** Alléger la séance du jour : même écriture que l'adaptation de CARDIO-UX01. */
  | { type: 'lighten'; plannedSessionId: string; dayKey: string; repsReductionPct: number }
  /** Ouvrir l'écran où ça se règle. Ne modifie rien. */
  | { type: 'open'; target: 'planning' | 'foodSuggestion' | 'nutritionProfile' | 'nutritionStats' };

export type LabProposal = {
  /** Stable d'un rendu à l'autre : sert à mémoriser « prêt » / « appliqué ». */
  id: string;
  kind: LabProposalKind;
  tone: 'guard' | 'warn' | 'info';
  pair: LabPair;
  /** Un garde-fou : jamais masqué, jamais en dernier. */
  safety: boolean;
  /** Les chiffres de la carte, interpolés par l'écran (FR/EN). */
  values: Record<string, number | string>;
  action: LabAction;
};

export type LabWeek = { days: LabDay[]; progress: LabWeekProgress; proposals: LabProposal[] };

// ---------------------------------------------------------------------------
// Semaine
// ---------------------------------------------------------------------------

const round1 = (x: number): number => Math.round(x * 10) / 10;

function weekKeys(weekStartKey: string): string[] {
  const start = localDateFromDayKey(weekStartKey);
  return Array.from({ length: 7 }, (_, i) => localDayKey(addDays(start, i)));
}

function toDaySession(s: LabSessionInput): LabDaySession {
  return { id: s.id, name: s.name, sessionType: s.sessionType, status: s.status, distanceM: s.targetDistanceM };
}

/** La prochaine séance encore à faire, aujourd'hui compris. */
function nextOf(sessions: readonly LabSessionInput[], todayKey: string): LabNext | null {
  const next = sessions.find((s) => s.status === 'planned' && s.dayKey >= todayKey);
  return next ? { dayKey: next.dayKey, name: next.name, sessionType: next.sessionType } : null;
}

function proteinPerKg(proteinG: number, weightKg: number | null): number | null {
  return weightKg !== null && weightKg > 0 ? round1(proteinG / weightKg) : null;
}

export function buildLabWeek(input: LabWeekInput): LabWeek {
  const { todayKey, activePillars } = input;
  const keys = weekKeys(input.weekStartKey);
  const has = (p: Pillar) => activePillars.includes(p);
  // Tri stable par jour : `find` doit rendre la plus proche, quel que soit l'ordre d'arrivée.
  const sessions = [...input.sessions].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const strengthSessions = has('strength') ? sessions.filter((s) => s.pillar === 'strength') : [];
  const runningSessions = has('running') ? sessions.filter((s) => s.pillar === 'running') : [];

  const days: LabDay[] = keys.map((dayKey) => {
    const protein = has('nutrition') ? input.proteinByDay.find((d) => d.dayKey === dayKey) : undefined;
    return {
      dayKey,
      isToday: dayKey === todayKey,
      isPast: dayKey < todayKey,
      strength: strengthSessions.filter((s) => s.dayKey === dayKey).map(toDaySession),
      running: runningSessions.filter((s) => s.dayKey === dayKey).map(toDaySession),
      proteinGPerKg: protein ? proteinPerKg(protein.proteinG, input.weightKg) : null,
      sleepMinutes: input.nights.find((n) => n.dayKey === dayKey)?.sleepMinutes ?? null,
    };
  });

  const counted = (list: LabSessionInput[]) => list.filter((s) => s.status !== 'skipped');
  const loggedProtein = input.proteinByDay.filter((d) => keys.includes(d.dayKey));
  const avgProteinG =
    loggedProtein.length > 0 ? loggedProtein.reduce((sum, d) => sum + d.proteinG, 0) / loggedProtein.length : null;
  const loggedNights = input.nights.filter((n) => n.sleepMinutes !== null && n.dayKey <= todayKey);
  const lastNight = [...loggedNights].sort((a, b) => b.dayKey.localeCompare(a.dayKey))[0];

  const progress: LabWeekProgress = {
    strength: has('strength')
      ? {
          done: strengthSessions.filter((s) => s.status === 'done').length,
          planned: counted(strengthSessions).length,
          next: nextOf(strengthSessions, todayKey),
        }
      : null,
    running: has('running')
      ? {
          doneKm: round1(input.runs.reduce((sum, r) => sum + r.distanceM, 0) / 1000),
          plannedKm: round1(counted(runningSessions).reduce((sum, s) => sum + (s.targetDistanceM ?? 0), 0) / 1000),
          next: nextOf(runningSessions, todayKey),
        }
      : null,
    nutrition: has('nutrition')
      ? {
          gPerKg: avgProteinG === null ? null : proteinPerKg(avgProteinG, input.weightKg),
          target: input.proteinTarget,
          loggedDays: loggedProtein.length,
        }
      : null,
    sleep: {
      goodNights: loggedNights.filter((n) => n.sleepMinutes! >= GOOD_NIGHT_MINUTES).length,
      loggedNights: loggedNights.length,
      lastMinutes: lastNight ? lastNight.sleepMinutes : null,
    },
  };

  return { days, progress, proposals: buildProposals(input, progress, runningSessions) };
}

// ---------------------------------------------------------------------------
// Propositions
// ---------------------------------------------------------------------------

function buildProposals(
  input: LabWeekInput,
  progress: LabWeekProgress,
  runningSessions: LabSessionInput[],
): LabProposal[] {
  const { todayKey } = input;
  const has = (p: Pillar) => input.activePillars.includes(p);
  const training = has('strength') || has('running');
  const out: LabProposal[] = [];
  const todayIntenseRun = runningSessions.find(
    (s) => s.dayKey === todayKey && s.status === 'planned' && isIntenseSessionType(s.sessionType),
  );

  // GARDE-01 — des jours d'affilée sans repos. On ouvre le planning : c'est à l'utilisateur de
  // choisir le jour off, le Labo ne supprime pas une séance à sa place.
  if (training && input.overtraining.show) {
    out.push({
      id: 'overtraining',
      kind: 'overtraining',
      tone: 'guard',
      pair: ['strength', 'running'],
      safety: true,
      values: { streakDays: input.overtraining.streakDays, severity: input.overtraining.severity! },
      action: { type: 'open', target: 'planning' },
    });
  }

  // META-19 — charge aiguë au-dessus du seuil. S'il y a une séance intense aujourd'hui, on propose de
  // l'alléger (même geste que CARDIO-UX01) ; sinon on renvoie au planning.
  if (training && input.acwr !== null && input.acwr.showAlert) {
    out.push({
      id: 'loadRisk',
      kind: 'loadRisk',
      tone: 'guard',
      pair: ['strength', 'running'],
      safety: true,
      values: { ratio: Math.round(input.acwr.ratio * 100) / 100 },
      action: todayIntenseRun
        ? { type: 'lighten', plannedSessionId: todayIntenseRun.id, dayKey: todayKey, repsReductionPct: REPS_REDUCTION_PCT }
        : { type: 'open', target: 'planning' },
    });
  }

  // MN-02 — gros volume de musculation sur un déficit marqué.
  if (has('nutrition') && has('strength') && input.deficitVolume.show) {
    out.push({
      id: 'deficitVolume',
      kind: 'deficitVolume',
      tone: 'guard',
      pair: ['nutrition', 'strength'],
      safety: true,
      values: { deficitPct: input.deficitVolume.deficitPct },
      action: { type: 'open', target: 'nutritionProfile' },
    });
  }

  // COLLIS-01 — jambes lourdes la veille d'une course de qualité. Déplacer la course vers le jour que
  // le détecteur a déjà vérifié ; sans repli possible, le planning.
  if (has('strength') && has('running')) {
    for (const c of [...input.conflicts].sort((a, b) => a.runDayKey.localeCompare(b.runDayKey))) {
      out.push({
        id: `collision:${c.runSessionId}`,
        kind: 'collision',
        tone: 'warn',
        pair: ['strength', 'running'],
        safety: false,
        values: { legSets: c.legSets, runDayKey: c.runDayKey, strengthDayKey: c.strengthDayKey, runType: c.runType, toDayKey: c.suggestedDayKey ?? '' },
        action: c.suggestedDayKey
          ? { type: 'reschedule', plannedSessionId: c.runSessionId, fromDayKey: c.runDayKey, toDayKey: c.suggestedDayKey }
          : { type: 'open', target: 'planning' },
      });
    }
  }

  // Nuit courte + séance intense aujourd'hui : on allège, on ne supprime pas.
  const lastNight = input.nights.find((n) => n.dayKey === todayKey)?.sleepMinutes ?? null;
  if (todayIntenseRun && lastNight !== null && lastNight < SHORT_NIGHT_MINUTES) {
    out.push({
      id: `shortNight:${todayIntenseRun.id}`,
      kind: 'shortNight',
      tone: 'warn',
      pair: ['sleep', 'running'],
      safety: false,
      values: { sleepMinutes: lastNight, sessionName: todayIntenseRun.name ?? '' },
      action: { type: 'lighten', plannedSessionId: todayIntenseRun.id, dayKey: todayKey, repsReductionPct: REPS_REDUCTION_PCT },
    });
  }

  // MN-06 — protéines sous la borne basse de l'objectif, sur au moins deux jours saisis.
  const nutrition = progress.nutrition;
  if (
    nutrition !== null &&
    nutrition.target !== null &&
    nutrition.gPerKg !== null &&
    nutrition.loggedDays >= LAB_MIN_PROTEIN_DAYS &&
    nutrition.gPerKg < nutrition.target.min
  ) {
    out.push({
      id: 'protein',
      kind: 'protein',
      tone: 'warn',
      pair: ['nutrition', has('strength') ? 'strength' : has('running') ? 'running' : 'nutrition'],
      safety: false,
      values: {
        gPerKg: nutrition.gPerKg,
        targetMin: nutrition.target.min,
        missingG: Math.round((nutrition.target.min - nutrition.gPerKg) * input.weightKg!),
      },
      action: { type: 'open', target: 'foodSuggestion' },
    });
  }

  // FUEL-01 — glucides sous la cible alors qu'il reste des séances dures dans la semaine.
  const hardAhead = runningSessions.filter(
    (s) => s.status === 'planned' && s.dayKey >= todayKey && (s.sessionType === 'fractionne' || s.sessionType === 'sortie_longue'),
  ).length;
  if (has('nutrition') && input.carbs !== null && input.carbs.status === 'low' && hardAhead > 0) {
    out.push({
      id: 'carbs',
      kind: 'carbs',
      tone: 'info',
      pair: ['nutrition', 'running'],
      safety: false,
      values: { gPerKg: input.carbs.gPerKg, targetMin: input.carbs.target.min, hardSessions: hardAhead },
      action: { type: 'open', target: 'nutritionStats' },
    });
  }

  // Les blocs ci-dessus sont écrits dans l'ordre de `LAB_PROPOSAL_KINDS` : l'ordre d'insertion EST
  // l'ordre d'affichage. Le test « ordre » le fige, pour qu'un bloc ajouté au mauvais endroit se voie.
  return out.slice(0, LAB_MAX_PROPOSALS);
}
