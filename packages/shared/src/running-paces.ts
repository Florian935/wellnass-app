import { z } from 'zod';

// ---------------------------------------------------------------------------
// Objectifs coureur
// ---------------------------------------------------------------------------

export const RUNNER_OBJECTIVES = ['5k', '10k', 'semi', 'marathon', 'perte_poids', 'endurance'] as const;
export const runnerObjectiveSchema = z.enum(RUNNER_OBJECTIVES);
export type RunnerObjective = z.infer<typeof runnerObjectiveSchema>;

// ---------------------------------------------------------------------------
// Niveaux coureur
// ---------------------------------------------------------------------------

export const RUNNER_LEVELS = ['debutant', 'regulier', 'confirme'] as const;
export const runnerLevelSchema = z.enum(RUNNER_LEVELS);
export type RunnerLevel = z.infer<typeof runnerLevelSchema>;

// ---------------------------------------------------------------------------
// Types de seance
// ---------------------------------------------------------------------------

/**
 * `test` et `course` ajoutes par US RUN-F4 (lot G) : ce sont les deux seances qui CALIBRENT un
 * plan (contre-la-montre de controle, course objectif), et l'analyse du 04/09/2026 a montre
 * qu'aucun type ne les portait. Elles ne sont pas du fractionne : leur intensite ne vient pas
 * d'une bande derivee mais d'un objectif chrono explicite (`sessions.target_time_seconds`).
 */
export const SESSION_TYPES = [
  'endurance',
  'fractionne',
  'sortie_longue',
  'recuperation',
  'test',
  'course',
  'course_libre',
] as const;
export const sessionTypeSchema = z.enum(SESSION_TYPES);
export type SessionType = z.infer<typeof sessionTypeSchema>;

/** Types de seance utilisables dans un programme (course libre exclue). */
export const PROGRAM_SESSION_TYPES = [
  'endurance',
  'fractionne',
  'sortie_longue',
  'recuperation',
  'test',
  'course',
] as const;
export type ProgramSessionType = (typeof PROGRAM_SESSION_TYPES)[number];

/** Les deux types dont l'intensite vient d'un objectif chrono, pas d'une bande derivee. */
export function isTimedSessionType(type: SessionType | null | undefined): boolean {
  return type === 'test' || type === 'course';
}

// ---------------------------------------------------------------------------
// Nature d'un segment de seance (US RUN-F4, lot B)
// ---------------------------------------------------------------------------

/**
 * Reprend le patron `exercise_plans.set_type` (qui accepte deja `'warmup'` cote musculation) :
 * une seance de course est une SUITE DE SEGMENTS TYPES, pas une liste de blocs anonymes.
 * 24 seances sur 24 du plan analyse prescrivent un echauffement precis ; aucune n'etait
 * representable avant ce lot.
 */
export const SEGMENT_KINDS = ['warmup', 'drills', 'work', 'recovery', 'cooldown'] as const;
export const segmentKindSchema = z.enum(SEGMENT_KINDS);
export type SegmentKind = z.infer<typeof segmentKindSchema>;

/** Defaut retenu en base (`session_intervals.kind default 'work'`) = le sens des lignes RUN-F2c. */
export const DEFAULT_SEGMENT_KIND: SegmentKind = 'work';

/**
 * Nature d'une recuperation. Le plan analyse distingue systematiquement « trot tres lent » et
 * « marche active » ; le modele RUN-F2c ne portait aucune intensite de recuperation.
 */
export const RECOVERY_KINDS = ['jog', 'walk', 'static', 'free'] as const;
export const recoveryKindSchema = z.enum(RECOVERY_KINDS);
export type RecoveryKind = z.infer<typeof recoveryKindSchema>;

// ---------------------------------------------------------------------------
// Validation de cible de seance
// ---------------------------------------------------------------------------

/** Une seance running de programme a besoin d'au moins une cible (distance en m OU duree en s). */
export function hasRunningSessionTarget(
  targetDistanceM: number | null | undefined,
  targetDurationSeconds: number | null | undefined,
): boolean {
  return (targetDistanceM != null && targetDistanceM > 0)
    || (targetDurationSeconds != null && targetDurationSeconds > 0);
}

// ---------------------------------------------------------------------------
// Derivation VMA
// ---------------------------------------------------------------------------

/** Allure 5 km ~= 95 % de l'allure a VMA (vitesse). Ajustable. */
export const VMA_COEFFICIENT = 0.95;

/** Allure (s/km) a 100 % VMA, derivee de l'allure de ref 5 km. */
export function derivedVmaPace(ref5kPaceSPerKm: number): number {
  return ref5kPaceSPerKm * VMA_COEFFICIENT;
}

// ---------------------------------------------------------------------------
// Plages d'allure cible par type de seance
// ---------------------------------------------------------------------------

export type PaceRange = { minSPerKm: number; maxSPerKm: number };

/**
 * Plage d'allure cible pour un type de seance, depuis l'allure de ref 5 km (s/km).
 * Retourne null pour course_libre (pas de cible).
 *
 * - endurance     : ref + 60 .. ref + 90  (allure confortable)
 * - sortie_longue : ref + 30 .. ref + 60  (allure moderee)
 * - recuperation  : ref + 90 .. ref + 120 (allure tres lente)
 * - fractionne    : vma .. ref            (effort intense)
 * - course_libre  : null
 */
export function sessionTargetPace(type: SessionType, ref5kPaceSPerKm: number): PaceRange | null {
  switch (type) {
    case 'endurance':
      return { minSPerKm: ref5kPaceSPerKm + 60, maxSPerKm: ref5kPaceSPerKm + 90 };
    case 'sortie_longue':
      return { minSPerKm: ref5kPaceSPerKm + 30, maxSPerKm: ref5kPaceSPerKm + 60 };
    case 'recuperation':
      return { minSPerKm: ref5kPaceSPerKm + 90, maxSPerKm: ref5kPaceSPerKm + 120 };
    case 'fractionne': {
      const vma = derivedVmaPace(ref5kPaceSPerKm);
      return { minSPerKm: vma, maxSPerKm: vma / VMA_COEFFICIENT };
    }
    // US RUN-F4 (lot G) — un test et une course n'ont PAS de bande derivee : leur allure vient
    // de l'objectif chrono saisi (`paceFromDistanceAndTime`), pas d'un decalage sur l'allure de
    // reference. Retourner une bande ici inventerait une consigne que personne n'a donnee.
    case 'test':
    case 'course':
    case 'course_libre':
      return null;
  }
}

// ---------------------------------------------------------------------------
// Allure explicite (US RUN-F4, lot A) — le mur M1 de l'analyse du 04/09/2026
// ---------------------------------------------------------------------------

/**
 * Allure (s/km) impliquee par une distance et un temps. C'est la conversion qui manquait pour
 * lire « 400 m en 1:38 » comme une allure (245 s/km, soit 4:05/km) — la forme canonique de 12
 * des 24 seances du plan analyse.
 *
 * Retourne `null` sur une distance nulle ou negative plutot qu'`Infinity` ou une exception :
 * l'appelant affiche alors « — », jamais un nombre absurde.
 */
export function paceFromDistanceAndTime(
  distanceM: number | null | undefined,
  timeSeconds: number | null | undefined,
): number | null {
  if (distanceM == null || timeSeconds == null) return null;
  if (distanceM <= 0 || timeSeconds <= 0) return null;
  return (timeSeconds * 1000) / distanceM;
}

/**
 * Construit une plage a partir de deux bornes eventuellement partielles ou inversees.
 *
 * - Une seule borne saisie => plage degeneree (min = max). Saisir « 4:00/km » tout court est un
 *   usage normal (le plan analyse le fait pour l'affutage : « exactement 4:00/km »), et refuser
 *   la saisie partielle obligerait a taper deux fois la meme valeur.
 * - Bornes inversees => remises dans l'ordre. En allure, `min` est le chiffre le PLUS PETIT
 *   (donc le plus RAPIDE) : c'est contre-intuitif a la saisie et l'erreur est frequente.
 * - Aucune borne => `null`, jamais une plage a zero.
 */
export function normalizePaceRange(
  minSPerKm: number | null | undefined,
  maxSPerKm: number | null | undefined,
): PaceRange | null {
  const lo = minSPerKm != null && minSPerKm > 0 ? minSPerKm : null;
  const hi = maxSPerKm != null && maxSPerKm > 0 ? maxSPerKm : null;
  if (lo == null && hi == null) return null;
  if (lo == null) return { minSPerKm: hi!, maxSPerKm: hi! };
  if (hi == null) return { minSPerKm: lo, maxSPerKm: lo };
  return lo <= hi ? { minSPerKm: lo, maxSPerKm: hi } : { minSPerKm: hi, maxSPerKm: lo };
}

/**
 * Lit une saisie d'allure ou de chrono en `m:ss` et rend des secondes (US RUN-F4, lot A).
 *
 * Personne n'ecrit « 245 s/km » : tout le monde ecrit « 4:05 ». C'est la saisie qu'attend un
 * coureur, et la seule qui rende le champ utilisable sans calculatrice.
 *
 * Accepte aussi `h:mm:ss` (un objectif de marathon depasse l'heure) et un nombre nu, interprete
 * comme des MINUTES entieres — « 20 » vaut 20:00, jamais 20 secondes : sur un objectif de course
 * comme sur une allure, l'unite naturelle est la minute.
 *
 * Rend `null` sur une saisie illisible plutot qu'un zero : a l'appelant de decider s'il efface
 * la consigne ou s'il repose la valeur d'origine — ecrire 0 effacerait une consigne sans le dire.
 */
export function parseMmSs(input: string | null | undefined): number | null {
  if (input == null) return null;
  const trimmed = input.trim().replace(',', ':');
  if (trimmed === '') return null;

  const parts = trimmed.split(':');
  if (parts.length > 3) return null;
  if (parts.some((p) => p.trim() === '' || !/^\d+$/.test(p.trim()))) {
    // Un nombre nu sans separateur est valide (minutes) ; tout le reste ne l'est pas.
    if (parts.length !== 1) return null;
    return null;
  }

  const numbers = parts.map((p) => Number.parseInt(p.trim(), 10));
  if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return null;

  if (numbers.length === 1) return numbers[0]! * 60;
  if (numbers.length === 2) {
    const [minutes, seconds] = numbers as [number, number];
    if (seconds > 59) return null;
    return minutes * 60 + seconds;
  }
  const [hours, minutes, seconds] = numbers as [number, number, number];
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formate des secondes en `m:ss` (ou `h:mm:ss` au-dela de l'heure) pour la SAISIE.
 *
 * Distinct de `formatPaceMMSS` (units.ts), qui formate pour l'AFFICHAGE avec son unite et son
 * texte de repli. Ici, la sortie doit pouvoir etre relue telle quelle par `parseMmSs` : c'est
 * la valeur d'un champ de formulaire, pas une phrase.
 */
export function formatMmSs(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '';
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** D'ou vient l'allure cible affichee — l'information compte autant que le nombre. */
export type PaceSource = 'explicit' | 'target-time' | 'derived';

export type ResolvedPace = { range: PaceRange; source: PaceSource };

/**
 * L'allure cible effective d'une seance, et sa provenance.
 *
 * Ordre de priorite, du plus intentionnel au plus devine :
 *  1. **explicit** — la plage saisie par un humain (`sessions.target_pace_*`). C'est tout
 *     l'objet du lot A : jusqu'ici cette source n'existait pas.
 *  2. **target-time** — deduite de l'objectif chrono sur la distance (seances test/course).
 *  3. **derived** — la bande calculee par `sessionTargetPace()`, comportement historique.
 *
 * Retourne `null` si rien n'est calculable (pas d'allure de reference ET pas de saisie) : il
 * n'existe **aucune valeur neutre** pour une allure, et afficher « — » avec son remede est le
 * patron deja retenu par ALLURE-01.
 */
export function resolveSessionPace(input: {
  explicitMinSPerKm?: number | null;
  explicitMaxSPerKm?: number | null;
  sessionType?: SessionType | null;
  targetDistanceM?: number | null;
  targetTimeSeconds?: number | null;
  ref5kPaceSPerKm?: number | null;
}): ResolvedPace | null {
  const explicit = normalizePaceRange(input.explicitMinSPerKm, input.explicitMaxSPerKm);
  if (explicit !== null) return { range: explicit, source: 'explicit' };

  const fromTime = paceFromDistanceAndTime(input.targetDistanceM, input.targetTimeSeconds);
  if (fromTime !== null) {
    return { range: { minSPerKm: fromTime, maxSPerKm: fromTime }, source: 'target-time' };
  }

  if (input.sessionType != null && input.ref5kPaceSPerKm != null && input.ref5kPaceSPerKm > 0) {
    const derived = sessionTargetPace(input.sessionType, input.ref5kPaceSPerKm);
    if (derived !== null) return { range: derived, source: 'derived' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Allure a un pourcentage de VMA (US RUN-F2c, blocs fractionne)
// ---------------------------------------------------------------------------

/**
 * Allure (s/km) a un pourcentage donne de VMA. Un pourcentage plus bas donne une allure plus
 * LENTE (chiffre s/km plus grand) — courir a 95 % de sa vitesse maximale, pas 95 % de son allure.
 * `vmaPaceSPerKm` = allure a 100 % VMA (typiquement `derivedVmaPace(ref5kPaceSPerKm)`).
 */
export function paceAtVmaPercent(vmaPaceSPerKm: number, pct: number): number {
  return vmaPaceSPerKm / (pct / 100);
}
