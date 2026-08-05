/**
 * US COLLIS-01 (roadmap 3.57) — détecteur de collisions entre séances planifiées.
 *
 * Le planning **place** les séances ; il ne dit rien de leur **enchaînement**. Une grosse séance de
 * jambes la veille d'une sortie longue est une combinaison qui s'auto-sabote, et rien dans l'app ne
 * le signalait. Ce module la repère et propose un jour de repli — **jamais un blocage**.
 *
 * ⚠️ **Une seule règle en V1, et c'est délibéré.** Quatre règles moyennes valent moins qu'une règle
 * juste : chacune multiplie les faux positifs, et c'est le bruit qui fait désactiver ce genre de
 * fonctionnalité. Les trois autres familles envisagées au brainstorming (course ↔ course, densité de
 * semaine, charge ↔ nutrition) attendront que celle-ci ait fait ses preuves. Le moteur est conçu
 * pour les accueillir : une règle s'ajoute, elle ne réécrit rien.
 *
 * ⚠️ **Aucune lecture d'horloge ici** : `todayKey` entre par paramètre, comme `selectInsights`
 * (INSIGHTS-01). Lire l'heure dans un hook la ferait geler par React Compiler dans un slot
 * mount-only.
 */

import { weekDayKeys } from './meal-plan';
import type { MuscleGroup } from './exercise';
import type { Pillar } from './pillar';
import type { ProgramSessionType } from './running-paces';

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/**
 * Seuil de séries sur les jambes au-delà duquel la séance pèse sur la course du lendemain.
 *
 * ⚠️ **Le seul nombre inventé du dispositif.** Il ne repose sur rien de mesuré dans ce produit —
 * c'est un point de départ explicite, à calibrer à l'usage. Exporté et nommé exprès : un seuil
 * enfoui dans une condition ne se rediscute jamais.
 */
export const LEG_SETS_CONFLICT_THRESHOLD = 8;

/**
 * Les seuls types de course en conflit. `endurance` et `recuperation` au lendemain d'une séance de
 * jambes sont neutres, voire bénéfiques : les inclure aurait produit du bruit permanent.
 */
export const CONFLICTING_RUN_TYPES: ReadonlyArray<ProgramSessionType> = [
  'sortie_longue',
  'fractionne',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Une séance de la semaine, réduite à ce dont la règle a besoin. */
export type ScheduledSession = {
  id: string;
  dayKey: string;
  pillar: Pillar;
  status: 'planned' | 'done' | 'skipped';
  /** Course seulement. **Nullable en base** : une course sans type ne déclenche jamais. */
  runType: ProgramSessionType | null;
  /**
   * Musculation seulement : séries par groupe, **déjà agrégées** par le repository.
   * `null` pour une course. Une valeur `null` sur un groupe = non chiffré, donc ne compte pas.
   */
  setsByMuscle: Partial<Record<MuscleGroup, number | null>> | null;
};

/** Un conflit détecté, avec son repli s'il en existe un. */
export type SessionConflict = {
  /** La course : c'est **elle** qu'on propose de déplacer. */
  runSessionId: string;
  runDayKey: string;
  runType: ProgramSessionType;
  /** La séance de musculation, qui ne bouge jamais — elle est l'ancre du programme. */
  strengthSessionId: string;
  strengthDayKey: string;
  /** Séries sur les jambes, le chiffre que la carte doit afficher. */
  legSets: number;
  /** Jour de repli, ou `null` si aucun ne convient. */
  suggestedDayKey: string | null;
};

// ---------------------------------------------------------------------------
// Règle
// ---------------------------------------------------------------------------

/** Séries réellement chiffrées d'un groupe (`null` et absence valent 0). */
function setsOf(
  setsByMuscle: Partial<Record<MuscleGroup, number | null>>,
  muscle: MuscleGroup,
): number {
  const value = setsByMuscle[muscle];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Vrai si la séance est une **grosse séance de jambes** : les jambes strictement dominantes **et**
 * au moins `LEG_SETS_CONFLICT_THRESHOLD` séries.
 *
 * Les deux conditions sont cumulatives, et chacune écarte un faux positif précis : la dominance
 * évite de se déclencher sur les 3 séries de mollets d'un full body ; le seuil évite de se
 * déclencher sur une séance jambes légère.
 *
 * **Strictement dominantes** : à égalité avec un autre groupe, aucun n'est dominant. Et seul
 * `muscle_primary` compte — inclure les muscles secondaires rendrait la part de jambes
 * ininterprétable (un squat compterait aussi pour le gainage).
 */
export function isHeavyLegSession(
  setsByMuscle: Partial<Record<MuscleGroup, number | null>> | null,
): boolean {
  if (setsByMuscle === null) return false;
  const legSets = setsOf(setsByMuscle, 'legs');
  if (legSets < LEG_SETS_CONFLICT_THRESHOLD) return false;
  return Object.keys(setsByMuscle).every(
    (muscle) => muscle === 'legs' || setsOf(setsByMuscle, muscle as MuscleGroup) < legSets,
  );
}

/** Vrai si la séance est une course de qualité, encore à faire. */
function isQualityRun(s: ScheduledSession): boolean {
  return (
    s.pillar === 'running' &&
    s.status === 'planned' &&
    s.runType !== null &&
    CONFLICTING_RUN_TYPES.includes(s.runType)
  );
}

/** Vrai si la séance est une grosse séance de jambes, encore à faire. */
function isPendingHeavyLegs(s: ScheduledSession): boolean {
  // `done` et `skipped` sont exclus : une séance sautée n'a fatigué personne, et une séance déjà
  // faite ne se commente plus — le détecteur parle du futur, pas du passé.
  return s.pillar === 'strength' && s.status === 'planned' && isHeavyLegSession(s.setsByMuscle);
}

/** Clé du jour précédent, en arithmétique de clés locales (pas de `Date` construite ici). */
function previousDayKey(dayKey: string, weekKeys: ReadonlyArray<string>): string | null {
  const index = weekKeys.indexOf(dayKey);
  return index > 0 ? weekKeys[index - 1]! : null;
}

/**
 * Cherche un jour où déplacer la course, dans la semaine affichée.
 *
 * Ordre : les jours **après** le conflit d'abord, puis avant — on préfère repousser une séance que
 * l'avancer.
 *
 * Un jour convient s'il ne porte **ni course**, **ni grosse séance de jambes**, et si **sa veille**
 * n'en porte pas non plus. Les trois conditions sont nécessaires, et la deuxième a été trouvée par
 * les tests : sans elle, le repli proposait le jour **même** de la séance de jambes — soit pire que
 * le conflit qu'on prétendait résoudre.
 *
 * ⚠️ **Jamais un jour antérieur à `todayKey`** : la course y naîtrait « manquée ».
 */
function findFallbackDay(input: {
  runDayKey: string;
  weekKeys: ReadonlyArray<string>;
  sessions: ReadonlyArray<ScheduledSession>;
  todayKey: string;
}): string | null {
  const { runDayKey, weekKeys, sessions, todayKey } = input;
  // Pas de garde `indexOf === -1` : l'appelant n'entre ici qu'après un `previousDayKey` non nul,
  // qui exige déjà un index ≥ 1. La garde serait du code mort — et le dépôt les supprime plutôt
  // que d'écrire un test qui fige un appel impossible (cf. `bucketOf`, 04/08/2026).
  const runIndex = weekKeys.indexOf(runDayKey);

  const after = weekKeys.slice(runIndex + 1);
  const before = weekKeys.slice(0, runIndex).reverse();

  const heavyLegDays = new Set(
    sessions.filter(isPendingHeavyLegs).map((s) => s.dayKey),
  );
  const runDays = new Set(sessions.filter((s) => s.pillar === 'running').map((s) => s.dayKey));

  for (const candidate of [...after, ...before]) {
    if (candidate < todayKey) continue;
    if (runDays.has(candidate)) continue;
    if (heavyLegDays.has(candidate)) continue;
    const eve = previousDayKey(candidate, weekKeys);
    if (eve !== null && heavyLegDays.has(eve)) continue;
    return candidate;
  }
  return null;
}

/**
 * Les conflits de la semaine affichée.
 *
 * Un conflit par course, au plus : si plusieurs séances de jambes précèdent la même course — cas
 * théorique mais possible — on retient **la plus lourde**. Deux bandeaux le même jour diraient deux
 * fois la même chose.
 */
export function findSessionConflicts(input: {
  sessions: ReadonlyArray<ScheduledSession>;
  weekStartKey: string;
  todayKey: string;
}): SessionConflict[] {
  const { sessions, weekStartKey, todayKey } = input;
  const weekKeys = weekDayKeys(weekStartKey);

  const conflicts: SessionConflict[] = [];

  for (const run of sessions.filter(isQualityRun)) {
    const eve = previousDayKey(run.dayKey, weekKeys);
    if (eve === null) continue;

    const heaviest = sessions
      .filter((s) => s.dayKey === eve && isPendingHeavyLegs(s))
      .reduce<ScheduledSession | null>(
        (best, s) =>
          best === null || setsOf(s.setsByMuscle!, 'legs') > setsOf(best.setsByMuscle!, 'legs')
            ? s
            : best,
        null,
      );
    if (heaviest === null) continue;

    conflicts.push({
      runSessionId: run.id,
      runDayKey: run.dayKey,
      runType: run.runType as ProgramSessionType,
      strengthSessionId: heaviest.id,
      strengthDayKey: heaviest.dayKey,
      legSets: setsOf(heaviest.setsByMuscle!, 'legs'),
      suggestedDayKey: findFallbackDay({ runDayKey: run.dayKey, weekKeys, sessions, todayKey }),
    });
  }

  return conflicts;
}
