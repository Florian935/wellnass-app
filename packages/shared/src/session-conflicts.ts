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
 *
 * 🔴 **Deux fenêtres, et c'est le cœur du module** (spec D7, correctif du 07/08/2026) :
 *  - la **détection** porte sur **8 jours** — la veille du lundi affiché, puis la semaine. « Qu'ai-je
 *    fait hier ? » est une question de physiologie, et hier existe même quand l'écran ne le montre
 *    pas. Borner la détection à l'écran faisait mentir la règle sur son propre énoncé : le conflit
 *    « jambes dimanche → sortie longue lundi » n'était **jamais** détecté, soit une paire de jours
 *    sur sept ;
 *  - le **repli** reste borné aux **7 jours affichés** — « où puis-je le mettre ? » est une question
 *    d'écran, et proposer un jour invisible n'a pas de sens.
 *
 * Les confondre était le bug. `weekKeys` et `scanKeys` ne sont donc **pas interchangeables** : voir
 * `eveOfDisplayedDay`, qui rend cette relation structurelle plutôt que défendue par des gardes.
 */

import { addDays, localDateFromDayKey, localDayKey } from './date';
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

/**
 * La veille d'un jour **affiché** — toujours définie.
 *
 * `scanKeys` vaut `[veille, ...weekKeys]`, donc `scanKeys[i]` **est** la veille de `weekKeys[i]` :
 * l'index se décale d'un cran, et rien d'autre. Les deux appelants ne passent que des jours issus des
 * 7 jours affichés (courses filtrées sur `weekKeys`, candidats découpés dans `weekKeys`), donc la
 * veille existe toujours.
 *
 * 🔴 **C'est là que vivaient les deux bugs du 05/08/2026.** La veille était cherchée dans `weekKeys`,
 * où le lundi est à l'index 0 : la fonction rendait `null`, et le dimanche précédent devenait
 * invisible — pour la détection (conflit du lundi jamais vu) comme pour le repli (lundi proposé sans
 * vérification). La fenêtre de 8 jours fait disparaître ce `null` **par construction** : plus de cas
 * à défendre, donc plus de garde à écrire ni de branche non testée.
 */
function eveOfDisplayedDay(
  dayKey: string,
  weekKeys: ReadonlyArray<string>,
  scanKeys: ReadonlyArray<string>,
): string {
  return scanKeys[weekKeys.indexOf(dayKey)]!;
}

/**
 * Les 8 clés de la fenêtre de **détection** : la veille de `weekStartKey`, puis les 7 jours affichés.
 *
 * La veille se **dérive** ici, elle n'entre pas en paramètre (spec R7) : un `eveKey` fourni par
 * l'appelant serait une seconde source de vérité pour le même fait, et un appelant qui la calcule mal
 * — ou l'oublie après un copier-coller — produirait un moteur silencieusement borgne qu'aucun test
 * de moteur ne verrait, puisqu'il croirait à ce qu'on lui donne.
 *
 * R1 n'est pas contredit : R1 interdit de lire **l'horloge**, pas de faire de l'arithmétique de
 * dates — `weekDayKeys` en fait déjà, et pour cette raison précise.
 */
function scanDayKeys(weekStartKey: string, weekKeys: ReadonlyArray<string>): string[] {
  // `localDateFromDayKey` reconstruit la date composant par composant : `new Date('AAAA-MM-JJ')` est
  // interprété en UTC et décalerait la veille d'un jour à l'ouest de Greenwich.
  const eveKey = localDayKey(addDays(localDateFromDayKey(weekStartKey), -1));
  return [eveKey, ...weekKeys];
}

/**
 * Cherche un jour où déplacer la course, **dans la semaine affichée**.
 *
 * Ordre : les jours **après** le conflit d'abord, puis avant — on préfère repousser une séance que
 * l'avancer.
 *
 * Un jour convient s'il ne porte **ni course**, **ni grosse séance de jambes**, et si **sa veille**
 * n'en porte pas non plus. Les trois conditions sont nécessaires, et la deuxième a été trouvée par
 * les tests : sans elle, le repli proposait le jour **même** de la séance de jambes — soit pire que
 * le conflit qu'on prétendait résoudre.
 *
 * La troisième, elle, était **cassée sur le lundi** jusqu'au 07/08/2026 : la veille d'un candidat
 * était cherchée dans `weekKeys`, où le lundi est à l'index 0. Le lundi passait donc sans
 * vérification et pouvait être proposé alors que le dimanche précédent portait des jambes lourdes.
 *
 * ⚠️ **Jamais un jour antérieur à `todayKey`** : la course y naîtrait « manquée ».
 */
function findFallbackDay(input: {
  runDayKey: string;
  weekKeys: ReadonlyArray<string>;
  scanKeys: ReadonlyArray<string>;
  sessions: ReadonlyArray<ScheduledSession>;
  todayKey: string;
}): string | null {
  const { runDayKey, weekKeys, scanKeys, sessions, todayKey } = input;
  // Pas de garde `indexOf === -1` : l'appelant filtre les courses sur `weekKeys.includes(...)` avant
  // d'entrer ici, donc `runDayKey` y est toujours. La garde serait du code mort — et le dépôt les
  // supprime plutôt que d'écrire un test qui fige un appel impossible (cf. `bucketOf`, 04/08/2026).
  //
  // ⚠️ Ce filtre a remplacé le 07/08/2026 un invariant devenu **accidentel** : jusque-là la garde
  // tenait parce que `previousDayKey` rendait `null` sur l'index 0. Avec la fenêtre de 8 jours, une
  // course le jour de la veille aurait un index `-1` dans `weekKeys` — l'ancien raisonnement ne
  // protégeait plus rien, il se contentait de ne pas encore avoir échoué.
  const runIndex = weekKeys.indexOf(runDayKey);

  // Les **candidats** restent bornés aux 7 jours affichés (spec D7) : proposer un jour que
  // l'utilisateur ne voit pas serait incompréhensible, et le bouton déplacerait la course hors du
  // champ de vision.
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
    // 🔴 La veille d'un candidat se lit dans `scanKeys` : sinon celle du **lundi** est invisible et
    // le lundi passe sans vérification. Le repli fabriquerait alors le conflit qu'il prétend
    // résoudre, un jour plus tôt (spec §4.1 n° 2) — le mode d'échec le plus coûteux du dispositif.
    if (heavyLegDays.has(eveOfDisplayedDay(candidate, weekKeys, scanKeys))) continue;
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
 *
 * ⚠️ **`sessions` doit couvrir 8 jours** — la veille de `weekStartKey` incluse (spec R7). Le moteur
 * ne voit que ce qu'on lui donne : un appelant qui ne lit que 7 jours obtient un moteur silencieusement
 * borgne, et **aucun test de ce fichier ne peut l'attraper**, puisqu'il croit à ce qu'on lui passe.
 * C'est `apps/mobile/.../session-conflicts-window.test.ts` qui tient cette borne, côté appelant.
 *
 * Les **courses de la veille ne sont pas jugées** : elles n'entrent que pour servir de contexte à la
 * séance de jambes. Leur propre conflit appartient au bandeau de la semaine précédente.
 */
export function findSessionConflicts(input: {
  sessions: ReadonlyArray<ScheduledSession>;
  weekStartKey: string;
  todayKey: string;
}): SessionConflict[] {
  const { sessions, weekStartKey, todayKey } = input;
  /** Les 7 jours affichés — borne du **repli**. */
  const weekKeys = weekDayKeys(weekStartKey);
  /** La veille + les 7 jours — borne de la **détection** (spec D7). */
  const scanKeys = scanDayKeys(weekStartKey, weekKeys);

  const conflicts: SessionConflict[] = [];

  // ⚠️ **La veille est lue, pas jugée.** `sessions` porte désormais les séances du jour précédent :
  // sans ce filtre, une course de qualité ce jour-là serait jugée ici alors que son conflit
  // appartient au bandeau de la semaine précédente (D5 — le bandeau vit sur le jour de la course).
  // Le filtre rend aussi **local et explicite** l'invariant dont dépend `findFallbackDay`.
  const weekDaySet = new Set(weekKeys);

  for (const run of sessions.filter((s) => isQualityRun(s) && weekDaySet.has(s.dayKey))) {
    const eve = eveOfDisplayedDay(run.dayKey, weekKeys, scanKeys);

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
      suggestedDayKey: findFallbackDay({
        runDayKey: run.dayKey,
        weekKeys,
        scanKeys,
        sessions,
        todayKey,
      }),
    });
  }

  return conflicts;
}
