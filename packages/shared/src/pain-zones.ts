/**
 * US DOUL-01 (roadmap 1.29) — journal des zones douloureuses.
 *
 * Déclarer où ça fait mal, en garder l'historique, et permettre à l'app d'énoncer un **fait daté**
 * quand une séance planifiée cible une zone récemment signalée.
 *
 * ── Ce que ce module ne fera jamais ───────────────────────────────────────────────────────────────
 * **Aucune suggestion de remplacement d'exercice.** MUSC-F14 avait retiré le motif « zone
 * douloureuse » de ses suggestions, et son motif n'était pas « on ne sait pas où il a mal » mais
 * « nous n'avons en base **ni information articulaire, ni schéma de mouvement** ». Ce journal fournit
 * la moitié gauche de l'équation ; la moitié droite reste absente. Suggérer un remplacement serait un
 * **conseil de santé inventé** (décision D4).
 *
 * ── L'asymétrie qui structure tout le fichier ─────────────────────────────────────────────────────
 * Les 10 zones **musculaires** se projettent vers `FINE_MUSCLES`, donc se relient au tonnage prévu
 * d'une séance : elles peuvent produire un signal. Les 8 zones **articulaires** ne se projettent nulle
 * part : on sait qu'un squat charge les quadriceps, on ne sait pas qu'il charge le genou. Elles sont
 * journalisables et **muettes**.
 *
 * ⚠️ Un test vérifie que les articulations n'ont **aucune** projection. Sans lui, quelqu'un
 * « corrigerait » un jour cette asymétrie en croyant combler un oubli — et l'app se mettrait à
 * produire des affirmations sans fondement sur un sujet où l'erreur blesse.
 *
 * ⚠️ **Aucune lecture d'horloge ici** : `todayKey` entre par paramètre, comme `selectInsights`
 * (INSIGHTS-01), `findSessionConflicts` (COLLIS-01) et `real-life.ts` (VIE-01).
 */

import { daysBetween } from './date';
import { BROAD_TO_FINE, type FineMuscle, type MuscleGroup } from './exercise';

// ---------------------------------------------------------------------------
// Vocabulaire
// ---------------------------------------------------------------------------

/**
 * Les zones **musculaires** — celles qui peuvent produire un signal.
 *
 * Volontairement alignées sur `FINE_MUSCLES` (MUSC-F1b) : c'est l'alignement qui rend la projection
 * possible, et un test le vérifie plutôt que de le supposer.
 */
export const PAIN_MUSCLE_ZONES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'abs',
  'glutes',
  'quadriceps',
  'hamstrings',
  'calves',
] as const;

/**
 * Les zones **articulaires** — journalisables, jamais signalées.
 *
 * Elles n'existent pas dans `FINE_MUSCLES`, et c'est bien le problème que D1 a tranché : les douleurs
 * d'entraînement sont massivement articulaires, et un journal incapable de dire « j'ai mal au genou »
 * ne serait pas utilisé.
 *
 * ⚠️ `shoulder_joint` coexiste avec le muscle `shoulders`, délibérément : « les deltoïdes en compote »
 * et « mon épaule coince » sont deux choses différentes, et seule la première se relie à une séance.
 */
export const PAIN_JOINT_ZONES = [
  'neck',
  'shoulder_joint',
  'elbow',
  'wrist',
  'lower_back',
  'hip',
  'knee',
  'ankle',
] as const;

/** Les 18 zones déclarables (décision D1). */
export const PAIN_ZONES = [...PAIN_MUSCLE_ZONES, ...PAIN_JOINT_ZONES] as const;

export type PainMuscleZone = (typeof PAIN_MUSCLE_ZONES)[number];
export type PainJointZone = (typeof PAIN_JOINT_ZONES)[number];
export type PainZone = (typeof PAIN_ZONES)[number];

/**
 * Les 3 niveaux (décision D3), **du plus léger au plus grave** — l'ordre du tableau porte la
 * comparaison de gravité, il n'y a pas de second endroit où elle serait encodée.
 */
export const PAIN_LEVELS = ['discomfort', 'pain', 'blocking'] as const;
export type PainLevel = (typeof PAIN_LEVELS)[number];

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/**
 * Fenêtre de fraîcheur du signal, en jours (R3).
 *
 * Au-delà, une zone sort du signal **sans rien effacer** : l'historique reste entier. C'est ce qui
 * remplace un drapeau « résolu » que personne ne penserait à cocher (décision D5).
 */
export const PAIN_FRESHNESS_DAYS = 7;

/**
 * Niveaux qui déclenchent un signal (décision D6).
 *
 * `discomfort` en est **exclu** : une gêne au lendemain d'une séance de jambes est une courbature.
 * La signaler ferait de l'app une alarme permanente — et c'est le bruit qui fait désactiver ce genre
 * de fonctionnalité, leçon explicite de COLLIS-01.
 */
export const SIGNALLING_LEVELS: ReadonlyArray<PainLevel> = ['pain', 'blocking'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Une déclaration, réduite à ce dont le calcul a besoin. */
export type PainReport = {
  id: string;
  logDate: string;
  zone: PainZone;
  level: PainLevel;
};

/** Le signal à afficher sur une séance, ou rien. */
export type SessionPainSignal = {
  zone: PainMuscleZone;
  level: PainLevel;
  /** Ancienneté de la déclaration, en jours. `0` = aujourd'hui. */
  daysAgo: number;
};

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * Projection **partielle** d'une zone vers le muscle correspondant.
 *
 * Identité sur les zones musculaires, `null` sur les articulations. C'est le cœur honnête du
 * dispositif : une zone sans projection est journalisable mais ne peut rien affirmer sur une séance.
 */
export function painZoneToMuscle(zone: PainZone): FineMuscle | null {
  return isPainMuscleZone(zone) ? zone : null;
}

/** Vrai si la zone est musculaire — donc capable de produire un signal. */
export function isPainMuscleZone(zone: PainZone): zone is PainMuscleZone {
  return (PAIN_MUSCLE_ZONES as ReadonlyArray<string>).includes(zone);
}

// ---------------------------------------------------------------------------
// Règles
// ---------------------------------------------------------------------------

/** Gravité comparable d'un niveau : sa position dans `PAIN_LEVELS`. */
function severity(level: PainLevel): number {
  return PAIN_LEVELS.indexOf(level);
}

/**
 * Les déclarations « actuellement sensibles » (R3 + D6) : dans la fenêtre de fraîcheur **et** à un
 * niveau qui signale.
 *
 * Une déclaration **future** (date saisie en avance, ou horloge d'un autre appareil en avance) est
 * conservée : `daysBetween` rend alors un négatif, et l'exclure ferait disparaître une donnée réelle
 * pour une raison technique.
 */
export function freshPainReports(
  reports: ReadonlyArray<PainReport>,
  todayKey: string,
): PainReport[] {
  return reports.filter((r) => {
    if (!SIGNALLING_LEVELS.includes(r.level)) return false;
    const age = daysBetween(r.logDate, todayKey);
    return age <= PAIN_FRESHNESS_DAYS;
  });
}

/**
 * Le signal d'une séance, ou `null`.
 *
 * Une séance ne reçoit **qu'un seul** message (§5) : deux bandeaux diraient deux fois la même chose,
 * même parti pris que COLLIS-01. En cas de plusieurs zones concernées, on retient **la plus grave** ;
 * à gravité égale, **la plus récemment déclarée**.
 *
 * ⚠️ `sessionMuscles` ne contient que des muscles : les zones articulaires ne peuvent donc, par
 * construction, jamais correspondre. C'est l'asymétrie du §0.2 rendue mécanique plutôt que gardée par
 * une condition qu'on pourrait oublier.
 */
export function pickSessionPainSignal(input: {
  reports: ReadonlyArray<PainReport>;
  sessionMuscles: ReadonlyArray<FineMuscle>;
  todayKey: string;
}): SessionPainSignal | null {
  const { reports, sessionMuscles, todayKey } = input;

  const candidates = freshPainReports(reports, todayKey).filter((r) => {
    const muscle = painZoneToMuscle(r.zone);
    return muscle !== null && sessionMuscles.includes(muscle);
  });

  const best = candidates.reduce<PainReport | null>((winner, r) => {
    if (winner === null) return r;
    if (severity(r.level) > severity(winner.level)) return r;
    // À gravité égale, la déclaration la plus récente : c'est l'information la plus à jour.
    if (severity(r.level) === severity(winner.level) && r.logDate > winner.logDate) return r;
    return winner;
  }, null);

  if (best === null) return null;

  return {
    zone: best.zone as PainMuscleZone,
    level: best.level,
    // Jamais négatif à l'affichage : « il y a −2 jours » n'a aucun sens pour l'utilisateur, même si
    // une déclaration future est légitime en base.
    daysAgo: Math.max(0, daysBetween(best.logDate, todayKey)),
  };
}

/**
 * Les muscles fins d'une séance dont le tonnage est **majoritaire** (R4).
 *
 * L'entrée vient de la requête d'enrichissement de COLLIS-01, qui rend des séries par **groupe
 * large** (6 groupes). On retient le groupe dominant, puis on l'étend via `BROAD_TO_FINE`.
 *
 * ⚠️ **L'extension est une approximation assumée**, et c'est exactement le repli que MUSC-F1b avait
 * déjà posé (« repli automatique sur les groupes larges tant qu'un exercice n'est pas tagué fin ») :
 * une séance `legs` compte comme ciblant quadriceps, ischio-jambiers **et** mollets. Elle peut donc
 * signaler une douleur aux ischios sur une séance surtout axée quadriceps — mais elle n'invente
 * jamais une relation inexistante, puisqu'une séance de jambes les sollicite bel et bien tous.
 *
 * **Strictement dominant** : à égalité entre deux groupes, aucun ne l'est — même règle que
 * `isHeavyLegSession` (COLLIS-01). Un « majoritaire » ambigu ne justifie aucune affirmation.
 */
export function dominantFineMuscles(
  setsByMuscle: Partial<Record<MuscleGroup, number | null>> | null,
): FineMuscle[] {
  if (setsByMuscle === null) return [];

  const sets = (group: string): number => {
    const value = setsByMuscle[group as MuscleGroup];
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  };

  const groups = Object.keys(setsByMuscle).filter((g) => sets(g) > 0);
  if (groups.length === 0) return [];

  const best = groups.reduce((a, b) => (sets(b) > sets(a) ? b : a));
  // Égalité : personne n'est majoritaire.
  if (groups.some((g) => g !== best && sets(g) === sets(best))) return [];

  return [...(BROAD_TO_FINE[best as MuscleGroup] ?? [])];
}

/**
 * La déclaration la plus récente de chaque zone, la plus récente d'abord — l'état « actuellement
 * sensible » à afficher (R5).
 *
 * Rend **la dernière déclaration**, pas une moyenne : une douleur qui passe de bloquant à gêne est
 * une information, sa moyenne n'en est pas une.
 */
export function latestByZone(reports: ReadonlyArray<PainReport>): PainReport[] {
  const byZone = new Map<PainZone, PainReport>();
  for (const r of reports) {
    const current = byZone.get(r.zone);
    if (current === undefined || r.logDate > current.logDate) byZone.set(r.zone, r);
  }
  return [...byZone.values()].sort((a, b) => (a.logDate < b.logDate ? 1 : -1));
}
