/**
 * US PRISME-01 — les dossiers que **Prisme** raconte : la journée (carte « Ta journée » de l'accueil,
 * dès 18 h) et la semaine (bilan hebdo, BILAN-01).
 * Réf. : docs/specs/functional/us/prisme01-prisme-raconte.md §6.
 *
 * ── Ce que ce module garantit ─────────────────────────────────────────────────────────────────
 * 1. **Tout ce qu'un texte voudra dire est dans le dossier** (R5). Le garde-fou de NARR-01 n'admet
 *    que les nombres qu'on a donnés au modèle : « il te manque 32 g » n'est acceptable que si 32 est
 *    ici. Les écarts aux cibles sont donc calculés **ici**, par le moteur — jamais par le modèle.
 * 2. **Rien d'autre n'y entre** (R4). `EveningFacts` est une liste blanche : aucun titre ni nom saisi
 *    (on envoie le **type** de séance), aucune note, rien du bien-être (nuit, énergie, humeur), rien de
 *    Health Connect (pas, nuit). Un test-garde fige la liste des champs.
 *
 * ── Pourquoi une brique pure ──────────────────────────────────────────────────────────────────
 * Parce qu'on doit pouvoir lire, en test, exactement ce qui part (patron de `ai-context.ts`). Les
 * libellés passent par `t` : le dossier est envoyé dans la langue de l'app, avec les mots que l'écran
 * emploie (R15). Les nombres restent des nombres — le garde-fou les lit dans le texte **et** dans
 * `values`.
 */

import type { BilanDossier, NarrationFact } from './ai-narration';
import { formatPaceMMSS } from './units';
import type { ReviewChange, WeeklyReview } from './weekly-review';

/** La traduction, injectée : ce module ne connaît pas i18next. */
export type PrismeTranslate = (key: string, params?: Record<string, string | number>) => string;

export type PrismeSessionType = 'strength' | 'run' | 'other';

/** Une séance **terminée** aujourd'hui, réduite à son type et à ses chiffres. */
export type EveningSession =
  | {
      type: 'strength';
      minutes: number;
      tonnageKg: number;
      /** `null` quand l'historique ne les porte pas : on ne les dit pas, plutôt que d'écrire zéro. */
      setsDone: number | null;
      /** `null` pour une séance libre : rien n'était prévu. */
      setsPlanned: number | null;
      records: number;
    }
  | { type: 'run'; minutes: number; distanceKm: number; paceSPerKm: number | null }
  | { type: 'other'; minutes: number };

/** L'assiette du jour. Absente (`null`) tant qu'aucun repas n'est saisi. */
export type EveningPlate = {
  kcal: number;
  targetKcal: number | null;
  proteinG: number;
  targetProteinG: number | null;
  carbsG: number;
  meals: number;
};

/** Les faits de la journée — **la liste blanche** de ce qui peut partir le soir (R4). */
export type EveningFacts = {
  /** Libellé du jour, déjà traduit (« vendredi 2 octobre »). */
  dayLabel: string;
  sessions: readonly EveningSession[];
  plate: EveningPlate | null;
  /** Activités faites / objectif de la semaine (SERIE-01), si un objectif est défini. */
  week: { done: number; goal: number } | null;
  /** La séance prévue demain : son **type**, jamais son nom. */
  tomorrow: { type: PrismeSessionType; time: string | null; distanceKm: number | null } | null;
  /** Période « vie réelle » active (VIE-01). */
  realLife: boolean;
};

const K = 'prisme.dossier';
const DAYS_PER_WEEK = 7;

/** Une journée sans séance ni repas n'a pas de carte (R12) : la semaine et demain ne suffisent pas. */
export function hasEveningFacts(facts: EveningFacts): boolean {
  return facts.sessions.length > 0 || facts.plate !== null;
}

const roundKm = (km: number): number => Math.round(km * 10) / 10;

/** Un fait : ses morceaux traduits, joints, et les nombres qu'il porte. */
function fact(label: string, parts: ReadonlyArray<string | null>, values: readonly number[]): NarrationFact {
  return { label, detail: parts.filter((p): p is string => p !== null).join(', '), values };
}

function sessionFact(session: EveningSession, t: PrismeTranslate): NarrationFact {
  const label = t(`${K}.session.${session.type}`);
  const minutes = t(`${K}.minutes`, { minutes: Math.round(session.minutes) });

  if (session.type === 'strength') {
    const tonnage = Math.round(session.tonnageKg);
    return fact(
      label,
      [
        minutes,
        t(`${K}.tonnage`, { kg: tonnage }),
        session.setsDone === null
          ? null
          : session.setsPlanned !== null
            ? t(`${K}.sets`, { done: session.setsDone, planned: session.setsPlanned })
            : t(`${K}.setsDone`, { done: session.setsDone }),
        session.records > 0 ? t(`${K}.records`, { count: session.records }) : null,
      ],
      [Math.round(session.minutes), tonnage, session.setsDone ?? 0, session.setsPlanned ?? 0, session.records].filter(
        (v) => v > 0,
      ),
    );
  }

  if (session.type === 'run') {
    const km = roundKm(session.distanceKm);
    return fact(
      label,
      [
        minutes,
        t(`${K}.distance`, { km }),
        session.paceSPerKm !== null && session.paceSPerKm > 0
          ? t(`${K}.pace`, { pace: formatPaceMMSS(session.paceSPerKm, '') })
          : null,
      ],
      [Math.round(session.minutes), km],
    );
  }

  return fact(label, [minutes], [Math.round(session.minutes)]);
}

/**
 * L'assiette, **écarts compris**. Les écarts sont dits en mots (« il reste », « dépassé de »,
 * « atteint ») et en valeur positive : un signe négatif à interpréter est une erreur qu'on évite au
 * modèle plutôt qu'au lecteur.
 */
function plateFact(plate: EveningPlate, t: PrismeTranslate): NarrationFact {
  const kcal = Math.round(plate.kcal);
  const protein = Math.round(plate.proteinG);
  const values: number[] = [kcal, protein, Math.round(plate.carbsG), plate.meals];
  const parts: (string | null)[] = [];

  if (plate.targetKcal !== null) {
    const target = Math.round(plate.targetKcal);
    const left = target - kcal;
    values.push(target, Math.abs(left));
    parts.push(t(`${K}.plate.kcalOfTarget`, { kcal, target }));
    parts.push(
      left > 0
        ? t(`${K}.plate.kcalLeft`, { kcal: left })
        : left < 0
          ? t(`${K}.plate.kcalOver`, { kcal: -left })
          : t(`${K}.plate.kcalOnTarget`),
    );
  } else {
    parts.push(t(`${K}.plate.kcal`, { kcal }));
  }

  if (plate.targetProteinG !== null) {
    const target = Math.round(plate.targetProteinG);
    const missing = target - protein;
    values.push(target);
    parts.push(t(`${K}.plate.proteinOfTarget`, { g: protein, target }));
    if (missing > 0) {
      values.push(missing);
      parts.push(t(`${K}.plate.proteinMissing`, { g: missing }));
    } else {
      parts.push(t(`${K}.plate.proteinReached`));
    }
  } else {
    parts.push(t(`${K}.plate.protein`, { g: protein }));
  }

  parts.push(t(`${K}.plate.carbs`, { g: Math.round(plate.carbsG) }));
  parts.push(t(`${K}.plate.meals`, { count: plate.meals }));

  // `plate.label` et non `plate` : dans les fichiers de traduction, `plate` est aussi le parent de
  // `plate.kcalLeft`, et un nœud JSON ne peut pas être à la fois un texte et un objet.
  return fact(t(`${K}.plate.label`), parts, values);
}

/** Le dossier du soir. Un bloc absent est omis, jamais mis à zéro (IA-LAB-01 R5). */
export function buildEveningDossier(facts: EveningFacts, t: PrismeTranslate): BilanDossier {
  const out: NarrationFact[] = facts.sessions.map((session) => sessionFact(session, t));

  if (facts.plate !== null) out.push(plateFact(facts.plate, t));

  if (facts.week !== null) {
    out.push(
      fact(t(`${K}.week.label`), [t(`${K}.weekProgress`, { done: facts.week.done, goal: facts.week.goal })], [
        facts.week.done,
        facts.week.goal,
      ]),
    );
  }

  if (facts.tomorrow !== null) {
    const { type, time, distanceKm } = facts.tomorrow;
    const km = distanceKm !== null ? roundKm(distanceKm) : null;
    out.push(
      fact(
        t(`${K}.tomorrow`),
        [
          t(`${K}.session.${type}`),
          time !== null ? t(`${K}.at`, { time }) : null,
          km !== null ? t(`${K}.distance`, { km }) : null,
        ],
        km !== null ? [km] : [],
      ),
    );
  }

  return {
    headline: t(`${K}.evening.headline`, { day: facts.dayLabel }),
    facts: out,
    decision: null,
    realLife: facts.realLife,
  };
}

/** Sérialisation à clés triées : deux journées identiques donnent la même empreinte. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * L'empreinte d'une journée (DD12) : le texte lu est marqué « ta journée a bougé depuis » dès que
 * l'empreinte change — un dîner saisi après la lecture, par exemple.
 */
export function eveningFingerprint(facts: EveningFacts): string {
  return stableStringify(facts);
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// La semaine
// ───────────────────────────────────────────────────────────────────────────────────────────────

/** Un objectif réduit à son **type** et sa progression : jamais le nom saisi (R4). */
export type WeekGoal = { typeLabel: string; ratioPct: number };

/**
 * L'entrée du dossier de la semaine. `WeeklyReview` ne porte ni les objectifs ni les piliers actifs
 * (ce sont des entrées de son calcul) : ils sont passés à part, tels que l'écran les lit (spec §6.2).
 */
export type WeekDossierInput = {
  review: WeeklyReview;
  /** « du 21 au 27 septembre », déjà traduit. */
  periodLabel: string;
  goals: readonly WeekGoal[];
  activePillars: { strength: boolean; running: boolean; nutrition: boolean };
  /** La décision de la semaine **telle qu'affichée** ; `null` pour une semaine vide. */
  decisionText: string | null;
};

/** Une variation en mots, comme l'écran du bilan la dit (jamais seulement un signe). */
function changePart(change: ReviewChange, t: PrismeTranslate): { text: string | null; value: number | null } {
  if (change === null) return { text: null, value: null };
  if (change.direction === 'flat') return { text: t(`${K}.changeFlat`), value: null };
  if (change.pct === null) return { text: null, value: null };
  const pct = Math.abs(change.pct);
  return {
    text: change.direction === 'up' ? t(`${K}.changeUp`, { pct }) : t(`${K}.changeDown`, { pct }),
    value: pct,
  };
}

/** Le dossier de la semaine : n'est envoyé que ce que l'écran du bilan affiche. */
export function buildWeekDossier(input: WeekDossierInput, t: PrismeTranslate): BilanDossier {
  const { review, activePillars } = input;
  const week = review.current;
  const out: NarrationFact[] = [];

  if (activePillars.strength) {
    const tonnage = Math.round(week.tonnageKg);
    const change = changePart(review.changes.tonnage, t);
    out.push(
      fact(
        t(`${K}.session.strength`),
        [t(`${K}.week.workouts`, { count: week.workouts }), t(`${K}.tonnage`, { kg: tonnage }), change.text],
        [week.workouts, tonnage, ...(change.value !== null ? [change.value] : [])],
      ),
    );
  }

  if (activePillars.running) {
    const km = roundKm(week.distanceM / 1000);
    const change = changePart(review.changes.distance, t);
    out.push(
      fact(
        t(`${K}.session.run`),
        [t(`${K}.week.runs`, { count: week.runs }), t(`${K}.distance`, { km }), change.text],
        [week.runs, km, ...(change.value !== null ? [change.value] : [])],
      ),
    );
  }

  if (activePillars.nutrition) {
    out.push(
      fact(
        t(`${K}.plate.label`),
        [
          t(`${K}.week.loggedDays`, { days: week.loggedDays }),
          week.daysInTarget !== null ? t(`${K}.week.daysInTarget`, { days: week.daysInTarget }) : null,
        ],
        [week.loggedDays, ...(week.daysInTarget !== null ? [week.daysInTarget] : [])],
      ),
    );
  }

  const activeChange = changePart(review.changes.activeDays, t);
  out.push(
    fact(
      t(`${K}.week.activeDays`),
      // « sur 7 », comme l'écran du bilan (« 5 / 7 ») : sans le 7, « 5 jours sur 7 » était jeté.
      [t(`${K}.week.activeDaysValue`, { days: week.activeDays, of: DAYS_PER_WEEK }), activeChange.text],
      [week.activeDays, DAYS_PER_WEEK, ...(activeChange.value !== null ? [activeChange.value] : [])],
    ),
  );

  if (review.recordsBeaten > 0) {
    out.push(
      fact(t(`${K}.week.records`), [t(`${K}.week.recordsValue`, { count: review.recordsBeaten })], [
        review.recordsBeaten,
      ]),
    );
  }

  for (const goal of input.goals) {
    out.push(
      fact(t(`${K}.week.goal`), [t(`${K}.week.goalValue`, { type: goal.typeLabel, pct: goal.ratioPct })], [
        goal.ratioPct,
      ]),
    );
  }

  if (review.realLifeDays > 0) {
    out.push(
      fact(t(`${K}.week.realLife`), [t(`${K}.week.realLifeValue`, { days: review.realLifeDays })], [
        review.realLifeDays,
      ]),
    );
  }

  return {
    headline: t(`${K}.week.headline`, { period: input.periodLabel }),
    facts: out,
    decision: input.decisionText,
    realLife: review.realLifeDays > 0,
  };
}
