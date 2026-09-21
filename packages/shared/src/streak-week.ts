/**
 * US SERIE-01 — la régularité comptée **en semaines**.
 * Réf. : docs/specs/functional/us/serie01-serie-hebdomadaire.md
 *
 * ── Pourquoi ce module existe ───────────────────────────────────────────────────────────────────
 * La série quotidienne ([`streak.ts`](./streak.ts)) est fragile par construction : rater un mardi la
 * casse. On l'a déjà reconnu **deux fois**, en empilant deux mécanismes correctifs par-dessus — le
 * **joker** ([`streak-joker.ts`](./streak-joker.ts), une US entière et trois règles rien que pour
 * qu'il ne dénature pas la série) et les **jours en pause** de VIE-01, un troisième état de jour.
 * Et le problème reste : un jour de repos, que nos propres programmes recommandent, reste un jour
 * perdu.
 *
 * Une semaine laisse **sept occasions de la sauver**. C'est une réponse au même problème, sans
 * pansement.
 *
 * ⚠️ **Fichier neuf, à côté de `streak.ts` et non dedans.** La série quotidienne et ses deux
 * correctifs sont **en recette** : on n'ouvre pas un module que quelqu'un vérifie en ce moment. Les
 * deux séries coexistent, et celle en jours ne change pas d'un iota.
 *
 * Module **pur** : aucune date « maintenant », aucun I/O, aucune chaîne de texte.
 */

import type { DayActivity } from './streak';

// ---------------------------------------------------------------------------
// Bornes
// ---------------------------------------------------------------------------

/** Objectif hebdomadaire minimal (spec R7). */
export const WEEKLY_GOAL_MIN = 1;

/**
 * Objectif hebdomadaire maximal (spec R7) — deux séances par jour, tous les jours.
 * Au-delà, ce n'est plus un objectif d'habitude mais une erreur de saisie.
 */
export const WEEKLY_GOAL_MAX = 14;

/**
 * Nombre maximal de semaines remontées par le calcul de série.
 *
 * Garde-fou, pas une limite produit : la boucle traverse les semaines « transparentes » (spec R5),
 * et un jeu de données pathologique — un historique entièrement couvert par des périodes de pause —
 * la ferait tourner sans fin. Dix ans de semaines est hors d'atteinte d'un usage réel.
 */
const MAX_WEEKS_WALKED = 520;

// ---------------------------------------------------------------------------
// Clés de semaine
// ---------------------------------------------------------------------------

/**
 * La clé d'une semaine **est le lundi qui l'ouvre**, au format `AAAA-MM-JJ`.
 *
 * 🔴 **Et non un numéro de semaine ISO.** Un numéro traîne ses pièges — la semaine 53, les bascules
 * d'année où le 1ᵉʳ janvier appartient à la semaine de l'année précédente — pour aucun gain. Le
 * lundi est unique, se trie naturellement, se compare comme une date, et se lit à l'œil nu dans une
 * base de données.
 *
 * Arithmétique en UTC (via `Date.UTC`), comme `prevKey` dans `streak.ts` : un calcul en heure locale
 * sauterait ou répéterait un jour aux changements d'heure.
 */
export function weekKeyOf(dayKey: string): string {
  const parts = dayKey.split('-').map(Number);
  const y = parts[0] as number;
  const m = parts[1] as number;
  const d = parts[2] as number;
  const t = Date.UTC(y, m - 1, d);
  // `getUTCDay()` rend 0 pour dimanche ; on veut 0 pour lundi.
  const mondayIndex = (new Date(t).getUTCDay() + 6) % 7;
  return formatUtc(t - mondayIndex * 86_400_000);
}

/** La semaine précédente, toujours sept jours en arrière. */
export function prevWeekKey(weekKey: string): string {
  const parts = weekKey.split('-').map(Number);
  const y = parts[0] as number;
  const m = parts[1] as number;
  const d = parts[2] as number;
  return formatUtc(Date.UTC(y, m - 1, d) - 7 * 86_400_000);
}

function formatUtc(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// ---------------------------------------------------------------------------
// Ce qui rend une semaine active
// ---------------------------------------------------------------------------

/**
 * Un jour compte-t-il pour la **semaine** ?
 *
 * Musculation, course, nutrition, autre activité — **oui**. Les **pas** — non (spec D3).
 *
 * La ligne n'est pas « entraînement contre le reste », c'est **le geste délibéré contre la mesure
 * passive** : noter un repas est un acte, le téléphone qui compte des pas n'en est pas un. Compter
 * les pas rendrait la semaine presque inbrisable, et une série qu'on ne peut pas perdre ne dit plus
 * rien.
 *
 * ⚠️ **La nutrition compte**, contrairement à ce que la première version de la spec (R1) laissait
 * entendre : la série quotidienne la compte déjà, et l'exclure priverait de toute série quelqu'un
 * qui n'utilise que ce pilier — contraire à la décision de cadrage **H** (chaque pilier utile seul).
 */
function countsForWeek(a: DayActivity): boolean {
  return a.strength || a.running || a.nutrition || a.other === true;
}

/**
 * Les semaines **actives** et les semaines **transparentes**, depuis l'activité jour par jour.
 *
 * Une semaine est **transparente** (spec R5) quand ses **sept** jours sont couverts par une période
 * « vie réelle » et qu'aucune activité n'y est enregistrée : la série la franchit sans la compter ni
 * la casser. C'est la règle D4 de VIE-01 — « ni cassée, ni allongée » — transposée à la semaine.
 *
 * ⚠️ **L'activité prime sur la pause** : une semaine entièrement déclarée en pause où l'on s'est
 * quand même entraîné est **active**, pas transparente. C'est le cas C de VIE-01.
 */
export function weekActivity(
  activities: ReadonlyArray<DayActivity>,
  pausedDays: ReadonlySet<string> = new Set(),
): { active: Set<string>; transparent: Set<string> } {
  const active = new Set<string>();
  for (const a of activities) {
    if (countsForWeek(a)) active.add(weekKeyOf(a.day));
  }

  // Une semaine transparente est une semaine dont les 7 jours sont en pause. On compte les jours
  // distincts par semaine plutôt que de dérouler chaque semaine : le même résultat, sans avoir à
  // reconstruire des dates.
  const pausedPerWeek = new Map<string, Set<string>>();
  for (const dayKey of pausedDays) {
    const key = weekKeyOf(dayKey);
    const bucket = pausedPerWeek.get(key);
    if (bucket) bucket.add(dayKey);
    else pausedPerWeek.set(key, new Set([dayKey]));
  }

  const transparent = new Set<string>();
  for (const [key, days] of pausedPerWeek) {
    if (days.size >= 7 && !active.has(key)) transparent.add(key);
  }

  return { active, transparent };
}

// ---------------------------------------------------------------------------
// La série
// ---------------------------------------------------------------------------

/**
 * La série hebdomadaire : le nombre de semaines actives consécutives, en remontant.
 *
 * 🔴 **La semaine courante ne casse JAMAIS la série tant qu'elle n'est pas finie** (spec R3). C'est
 * la transposition exacte de la règle du quotidien (« aujourd'hui inactif ne casse pas encore »), et
 * c'est *la* règle de cette US : sans elle, **la série de tout le monde tomberait à zéro tous les
 * lundis matin**.
 *
 * @param active       semaines portant au moins une activité
 * @param transparent  semaines entièrement en pause (traversées)
 * @param currentWeekKey  le lundi de la semaine en cours
 */
export function computeWeeklyStreak(
  active: ReadonlySet<string>,
  transparent: ReadonlySet<string>,
  currentWeekKey: string,
): { current: number; activeThisWeek: boolean } {
  const activeThisWeek = active.has(currentWeekKey);

  let cursor = currentWeekKey;
  // La semaine en cours n'est ni tenue ni en pause : elle court encore, on ne la juge pas.
  if (!activeThisWeek && !transparent.has(currentWeekKey)) {
    cursor = prevWeekKey(cursor);
  }

  let count = 0;
  for (let walked = 0; walked < MAX_WEEKS_WALKED; walked += 1) {
    if (active.has(cursor)) {
      count += 1;
      cursor = prevWeekKey(cursor);
      continue;
    }
    // Une semaine transparente est franchie sans être comptée.
    if (transparent.has(cursor)) {
      cursor = prevWeekKey(cursor);
      continue;
    }
    break;
  }

  return { current: count, activeThisWeek };
}

// ---------------------------------------------------------------------------
// L'objectif hebdomadaire
// ---------------------------------------------------------------------------

/**
 * La progression de l'objectif de la semaine courante.
 *
 * 🔴 **Rien n'est stocké** (spec R8) : tout se recalcule depuis les activités. L'objectif se réarme
 * donc seul chaque lundi, il est juste hors-ligne, et une activité antidatée le corrige
 * rétroactivement — sans aucune table de compteur à réconcilier entre deux appareils.
 *
 * `goal` à `null` (« la question n'a jamais été posée ») rend `total: null` : l'écran affiche alors
 * le **compte nu**, jamais une cible inventée (spec R9). C'est la leçon d'`activity_level`, dont le
 * repli s'affichait comme un choix.
 *
 * `done` compte des **jours actifs**, pas des activités : deux séances le même jour ne valent qu'un
 * jour, parce que l'objectif mesure une régularité et non un volume.
 */
export function weeklyGoalProgress(
  activities: ReadonlyArray<DayActivity>,
  currentWeekKey: string,
  goal: number | null,
): { done: number; total: number | null; met: boolean } {
  const days = new Set<string>();
  for (const a of activities) {
    if (countsForWeek(a) && weekKeyOf(a.day) === currentWeekKey) days.add(a.day);
  }
  const done = days.size;
  return { done, total: goal, met: goal !== null && done >= goal };
}

/**
 * L'objectif transverse est-il **sous** la fréquence de course visée (spec R10) ?
 *
 * Une fonction d'une ligne, mais nommée : c'est elle qui rend la règle relisible, et son nom dit ce
 * qu'on en fait — **signaler**. L'app ne réécrit ni l'un ni l'autre. Les deux chiffres sont
 * légitimes (l'un compte les sorties, l'autre toutes les activités), et trancher à la place de
 * l'utilisateur serait exactement le défaut que le régime de guidage cherche à éviter.
 */
export function weeklyGoalConflict(
  goal: number | null,
  runningFrequency: number | null | undefined,
): boolean {
  if (goal === null || runningFrequency === null || runningFrequency === undefined) return false;
  return goal < runningFrequency;
}

// ---------------------------------------------------------------------------
// L'unité affichée (spec D1)
// ---------------------------------------------------------------------------

/** L'unité dans laquelle la série s'affiche. */
export type StreakUnit = 'day' | 'week';

/**
 * Quelle unité afficher, quand personne n'a encore choisi.
 *
 * 🔴 **Le jour pour qui a une série en cours, la semaine pour les autres** (spec D1).
 *
 * Ce que la règle protège n'est pas « l'ancienneté du compte », c'est **une série qui court**.
 * Basculer l'unité de quelqu'un qui tient 40 jours, sans le prévenir, serait le pire accueil
 * possible pour cette US : son compteur changerait de valeur **et** de sens du jour au lendemain.
 * À l'inverse, un compte dont la série est déjà à zéro — neuf, ou revenu après une pause — n'a
 * rien à perdre et démarre directement sur l'unité qui ne se casse pas au premier jour de repos.
 *
 * `stored` non nul veut dire « la question a été posée et tranchée » : on respecte, sans condition.
 * Et `null` reste lisible comme « jamais posée » — c'est ce qui permet à la carte de bascule de
 * n'apparaître **qu'une fois**, sans stocker un drapeau « déjà vue » quelque part.
 */
export function resolveStreakUnit(
  stored: StreakUnit | null | undefined,
  hasDailyStreakInProgress: boolean,
): StreakUnit {
  if (stored === 'day' || stored === 'week') return stored;
  return hasDailyStreakInProgress ? 'day' : 'week';
}
