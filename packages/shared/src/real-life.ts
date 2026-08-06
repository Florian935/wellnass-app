/**
 * US VIE-01 (roadmap 1.28) — mode « vie réelle », dégradation gracieuse des objectifs.
 *
 * Une semaine de vacances, de maladie ou de déplacement produit aujourd'hui une cascade de reproches
 * mécaniquement corrects et tous à côté de la plaque : la série tombe au deuxième jour manqué, le
 * déficit calorique continue de courir, et les cartes annoncent « ton tonnage a chuté de 40 % ». Ce
 * module fournit la brique de calcul qui permet à l'app d'**abaisser ce qu'elle demande** le temps
 * d'une période déclarée, puis de reprendre le plan normal toute seule.
 *
 * ── Rien n'est stocké de l'état, tout est dérivé de la fenêtre (patron OBJ-01) ─────────────────────
 * Une période ne porte que son intervalle `[startedOn, endsOn]`, **bornes incluses**. Période active,
 * jours restants, jours en pause, cibles abaissées : tout se recalcule à l'affichage. C'est ce qui
 * évite un travail de fond (aucun cron, personne à réveiller pour clore les périodes échues) et ce
 * qui fait que le dispositif marche hors ligne — il n'y a rien à écrire pour lire.
 *
 * ⚠️ **Aucune lecture d'horloge ici** : `todayKey` entre par paramètre, comme `selectInsights`
 * (INSIGHTS-01) et `findSessionConflicts` (COLLIS-01). Lire l'heure dans un hook la ferait geler par
 * React Compiler dans un slot mount-only.
 *
 * ⚠️ **Ce module ne décide de rien sur les données déjà collectées.** Décision D2 : les jours d'une
 * période restent dans les moyennes, les tendances et l'ACWR — ils sont vrais. La période les
 * **annote** (`realLifeDaysInWeek`), elle ne les retire jamais. C'est la règle que STREAK-01 s'est
 * imposée sur le joker : falsifier la donnée pour sauver un affichage serait le pire des choix.
 */

import { daysBetween } from './date';
import { JOKER_MAX_AGE_DAYS } from './streak-joker';

// ---------------------------------------------------------------------------
// Constantes de règle
// ---------------------------------------------------------------------------

/**
 * Durées proposées à l'activation (décision D3). La date de fin reste modifiable ensuite, et une
 * période se prolonge d'un tap : ces trois valeurs sont des raccourcis, pas des bornes.
 */
export const REAL_LIFE_DURATIONS = [3, 7, 14] as const;

/**
 * Ancienneté maximale d'un début de période rétro-déclaré (décision D5).
 *
 * **On réutilise `JOKER_MAX_AGE_DAYS` littéralement**, on n'en redéclare pas la valeur : STREAK-01 a
 * déjà arbitré exactement cette question pour son joker (« ressusciter une série morte depuis deux
 * semaines n'aurait aucun sens »). Deux constantes à 7 auraient divergé au premier ajustement.
 *
 * Pourquoi autoriser la rétro-déclaration : **le moment du retour est le moment critique**. Quelqu'un
 * qui a été malade n'a pas ouvert l'app et découvre sa série morte en revenant. Sans elle, la
 * fonctionnalité ne servirait que ceux qui ont pensé à l'activer *avant* — c'est-à-dire pas ceux
 * qu'elle doit sauver.
 */
export const REAL_LIFE_MAX_BACKDATE_DAYS = JOKER_MAX_AGE_DAYS;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Une période déclarée, réduite à ce dont le calcul a besoin. Bornes **incluses**. */
export type RealLifePeriod = {
  id: string;
  startedOn: string;
  endsOn: string;
};

/** Cibles de semaine abaissées. `null` sur un pilier inactif — jamais 0, qui se lirait comme un échec. */
export type MinimalWeekTargets = {
  strengthSessions: number | null;
  runs: number | null;
  proteinG: number | null;
};

/** Motif de refus d'une période, que l'UI traduit. */
export type RealLifePeriodError = 'ends_before_start' | 'backdated_too_far';

// ---------------------------------------------------------------------------
// Arithmétique de clés
// ---------------------------------------------------------------------------

/**
 * Clé du jour suivant, calculée à **midi UTC** pour rester insensible aux transitions d'heure d'été
 * — même convention que `daysBetween` (`date.ts`), dont ce module dépend déjà.
 */
function nextDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!, 12) + 86_400_000;
  const next = new Date(t);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** Vrai si `dayKey` tombe dans `[from, to]` — comparaison lexicographique, valide sur `AAAA-MM-JJ`. */
function within(dayKey: string, from: string, to: string): boolean {
  return dayKey >= from && dayKey <= to;
}

// ---------------------------------------------------------------------------
// Lecture des périodes
// ---------------------------------------------------------------------------

/**
 * Vrai si le jour est couvert par au moins une période.
 *
 * Prédicat plutôt qu'appartenance à un ensemble : il n'énumère rien, donc il reste juste même sur une
 * période aberrante venue de la base.
 */
export function isRealLifeDay(
  periods: ReadonlyArray<RealLifePeriod>,
  dayKey: string,
): boolean {
  return periods.some((p) => within(dayKey, p.startedOn, p.endsOn));
}

/**
 * **Union** des jours couverts par les périodes.
 *
 * L'union, et pas une agrégation plus fine : deux périodes qui se chevauchent sont un cas **normal**
 * et non une erreur. La base ne l'interdit pas volontairement (patron REPAS-01 D6 — une contrainte
 * violée bloquerait la file d'upload PowerSync, et deux appareils hors réseau peuvent déclarer la
 * même semaine). Ici on absorbe : un jour couvert deux fois est un jour couvert.
 *
 * Une période inversée (`endsOn < startedOn`, refusée à la saisie mais possible par un chemin non
 * prévu) ne produit **aucun** jour au lieu de boucler.
 */
export function realLifeDayKeys(periods: ReadonlyArray<RealLifePeriod>): Set<string> {
  const days = new Set<string>();
  for (const period of periods) {
    if (period.endsOn < period.startedOn) continue;
    let cursor = period.startedOn;
    while (cursor <= period.endsOn) {
      days.add(cursor);
      cursor = nextDayKey(cursor);
    }
  }
  return days;
}

/**
 * La période qui couvre `todayKey`, ou `null`.
 *
 * Si plusieurs se recouvrent, on retient **celle qui a commencé le plus tard** — c'est la déclaration
 * la plus récente, donc l'intention la plus à jour. À égalité de début, celle qui finit le plus tard :
 * entre deux réponses défendables, on prend celle qui protège le plus longtemps.
 */
export function activeRealLifePeriod(
  periods: ReadonlyArray<RealLifePeriod>,
  todayKey: string,
): RealLifePeriod | null {
  return periods
    .filter((p) => within(todayKey, p.startedOn, p.endsOn))
    .reduce<RealLifePeriod | null>((best, p) => {
      if (best === null) return p;
      if (p.startedOn > best.startedOn) return p;
      if (p.startedOn === best.startedOn && p.endsOn > best.endsOn) return p;
      return best;
    }, null);
}

/**
 * Jours restants, **bornes incluses** : `0` le dernier jour de la période, jamais négatif.
 *
 * `0` le dernier jour et non `1` : c'est le sens de « encore combien de jours après aujourd'hui ». Une
 * période échue renvoie `0` elle aussi — l'appelant sait déjà, par `activeRealLifePeriod`, s'il y a
 * une période en cours.
 */
export function realLifeDaysRemaining(period: RealLifePeriod, todayKey: string): number {
  return Math.max(0, daysBetween(todayKey, period.endsOn));
}

/**
 * Nombre de jours de période tombant dans `[weekStart, weekEnd]` — l'annotation du bilan hebdo (R7).
 *
 * Compté sur l'**union** : une période à cheval sur deux semaines annote les deux, chacune avec son
 * propre décompte, et deux périodes qui se recouvrent dans la même semaine ne comptent pas deux fois.
 */
export function realLifeDaysInWeek(
  periods: ReadonlyArray<RealLifePeriod>,
  weekStart: string,
  weekEnd: string,
): number {
  let count = 0;
  for (const day of realLifeDayKeys(periods)) {
    if (within(day, weekStart, weekEnd)) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Les cibles abaissées
// ---------------------------------------------------------------------------

/**
 * Cibles de semaine minimales (règle R3).
 *
 * **Dérivées du plan habituel, jamais inventées** — c'est le point de la fonction. La cible muscu est
 * la moitié du plan, plancher à 1 : quelqu'un qui fait 2 séances par semaine se voit demander 1, pas
 * 2 (une cible dégradée égale à la cible normale ne dégrade rien). Le plancher évite aussi la cible
 * à 0, qui se lirait comme « ne fais rien » alors que le message est « fais peu ».
 *
 * La course ne reçoit **aucune cible d'allure ni de distance** : sur une semaine allégée, seule la
 * sortie compte.
 *
 * Côté nutrition, ce sont les **protéines** qui sont conservées telles quelles, la cible calorique
 * passant au maintien (R4) : en période dégradée, protéger la masse maigre compte plus que tenir un
 * déficit.
 *
 * **Un pilier inactif rend `null`**, pas `0` (décision H — intégration sans imposition).
 */
export function minimalWeekTargets(input: {
  activePillars: { strength: boolean; running: boolean; nutrition: boolean };
  habitualStrengthSessions: number;
  proteinTargetG: number | null;
}): MinimalWeekTargets {
  const { activePillars, habitualStrengthSessions, proteinTargetG } = input;

  const strengthSessions = activePillars.strength
    ? Math.max(1, Math.floor(Math.max(0, habitualStrengthSessions) / 2))
    : null;

  return {
    strengthSessions,
    runs: activePillars.running ? 1 : null,
    proteinG: activePillars.nutrition ? proteinTargetG : null,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Valide une période avant écriture. `null` si tout va bien, sinon le code d'erreur que l'UI traduit.
 *
 * Deux refus seulement, et **aucune borne haute sur `startedOn`** : déclarer une période qui commence
 * dans le futur (des vacances déjà posées) est légitime et sans danger, puisque tous les effets sont
 * dérivés de la fenêtre — la période n'agit pas avant d'avoir commencé.
 *
 * ⚠️ Cette validation est **la seule** protection contre une période incohérente : la table ne porte
 * volontairement aucune contrainte de plage, parce qu'une violation bloquerait la file d'upload
 * PowerSync (patron REPAS-01 D6). Elle doit donc être appelée par **tous** les chemins d'écriture,
 * création comme prolongation.
 */
export function validateRealLifePeriod(input: {
  startedOn: string;
  endsOn: string;
  todayKey: string;
}): RealLifePeriodError | null {
  const { startedOn, endsOn, todayKey } = input;

  if (endsOn < startedOn) return 'ends_before_start';
  if (daysBetween(startedOn, todayKey) > REAL_LIFE_MAX_BACKDATE_DAYS) return 'backdated_too_far';
  return null;
}
