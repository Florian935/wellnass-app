/**
 * Échéance apprise d'un rappel programmé — US NUTR-F1 (roadmap 1.14, 2.5).
 *
 * ── Ce que ce module calcule, et pourquoi ce n'est pas ce qu'on croit ─────────────────────────────
 * Un rappel programmé dit « tu n'as pas encore fait le geste ». Il doit donc partir à une heure où
 * l'utilisateur a **d'habitude déjà fini** — pas à l'heure où il le fait d'habitude.
 *
 * La première version de la spec apprenait la **médiane** de l'heure du geste. C'était un défaut de
 * conception : la médiane est par définition l'heure où le geste est fait **une fois sur deux**.
 * Un utilisateur régulier qui logge son petit-déjeuner à 8 h aurait reçu « ton journal est vide » à
 * 8 h, un jour sur deux, **pendant qu'il le remplit** — et la notification n'est plus annulable à ce
 * stade (la re-planification n'a lieu qu'à l'ouverture de l'app).
 *
 * On apprend donc le **9ᵉ décile** : l'heure avant laquelle, 9 jours sur 10, c'est déjà fait. Le
 * rappel devient **rare par construction** pour un utilisateur régulier, ce qui est le but.
 * Décision D1 de la spec.
 *
 * Aucune dépendance native ; toute référence temporelle est **injectée** (convention du dépôt,
 * cf. `localMidnightDaysAgo(daysAgo, ref)`).
 */

import { localDayKey } from './date';
import { clampOutOfDnd, type NotificationPrefs } from './notifications';

/** Une saisie candidate à l'apprentissage. */
export interface LogSample {
  /** Clé de jour du journal (`log_date`, AAAA-MM-JJ) — le jour que l'entrée **décrit**. */
  logDate: string;
  /** Horodatage de création, ISO UTC (`created_at`) — l'instant où l'entrée a été **saisie**. */
  createdAt: string;
}

/**
 * Nombre minimal de jours retenus pour faire confiance à l'apprentissage.
 *
 * En dessous, on utilise l'heure de repli réglée par l'utilisateur. Au seuil exact, `percentileHour`
 * renvoie le **maximum** de l'échantillon (voir sa docstring) : volontairement conservateur, on
 * préfère une échéance tardive à un faux positif.
 */
export const LEARNED_HOUR_MIN_SAMPLES = 5;

/** Fenêtre d'apprentissage, en jours glissants. */
export const LEARNED_HOUR_WINDOW_DAYS = 14;

/** Décile visé — voir D1 : une échéance, pas une habitude. */
export const LEARNED_DEADLINE_PERCENTILE = 0.9;

/**
 * Heures locales exploitables, **une par jour**, triées par jour croissant.
 *
 * Ne retient une entrée que si le **jour local de `createdAt` correspond à son `logDate`**. C'est
 * ce qui écarte la **saisie rétroactive** : logger hier soir ce matin donne un `createdAt` de ce
 * matin, qui n'apprend rien sur l'heure du repas.
 *
 * Pour un même jour, on garde la **plus ancienne entrée retenue** — pas la plus ancienne tout court :
 * si la première entrée du jour est une saisie rétroactive, on prend la suivante qui passe le
 * filtre. Un jour dont aucune entrée n'est retenue est absent du résultat.
 *
 * Le résultat est ordonné par jour croissant. `percentileHour` retrie numériquement de toute façon :
 * cet ordre n'existe que pour rendre la fonction déterministe, donc testable.
 *
 * ⚠️ **Ce filtre n'attrape pas les copies du jour même** (`copyMeal`, `duplicateDay`, repas types) :
 * elles portent `createdAt = maintenant` et `logDate` = le jour affiché, presque toujours
 * aujourd'hui. C'est assumé (décision D4) : sous D1, une contamination qui repousse l'échéance
 * **plus tard** va dans le sens sûr — elle rend le rappel plus rare, jamais plus intrusif.
 *
 * Les horodatages illisibles sont ignorés sans lever.
 */
export function usableDailyHours(samples: LogSample[]): number[] {
  /** Par jour : l'instant retenu le plus ancien, et son heure locale. */
  const byDay = new Map<string, { at: number; hour: number }>();

  for (const sample of samples) {
    const at = new Date(sample.createdAt);
    const ms = at.getTime();
    if (Number.isNaN(ms)) continue;

    // Le cœur du filtre : la saisie doit avoir eu lieu le jour qu'elle décrit.
    if (localDayKey(at) !== sample.logDate) continue;

    const current = byDay.get(sample.logDate);
    if (current === undefined || ms < current.at) {
      byDay.set(sample.logDate, { at: ms, hour: at.getHours() });
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, v]) => v.hour);
}

/**
 * Percentile **par rang**, sans interpolation : `trié[ceil(p × n) − 1]`.
 *
 * Défini pour tout `n >= 1`, et le résultat est toujours une heure **effectivement observée**.
 * Deux pièges de la médiane évités au passage (décision D2) :
 *
 * - **pas d'ambiguïté sur les échantillons pairs.** Avec une fenêtre de 14 jours et un seuil de 5,
 *   les tailles paires sont le cas majoritaire ; « la moyenne des deux valeurs centrales » aurait
 *   été une règle à inventer, et à arrondir.
 * - **le problème circulaire est neutralisé dans le sens utile.** Une moyenne d'heures est
 *   mathématiquement fausse près de minuit (moyenne de 23 h et 1 h = 12 h) et la médiane ne le
 *   répare pas : sur `{23, 0, 23, 0, 23, 0}` elle renvoie 11 h 30, le point antipodal de
 *   l'habitude réelle. Le p90 renvoie 23 — le bord tardif, précisément ce qu'on cherche.
 *
 * `null` si l'échantillon est vide. `percentile` est borné à [0, 1].
 */
export function percentileHour(hours: number[], percentile: number): number | null {
  if (hours.length === 0) return null;

  const p = Math.min(1, Math.max(0, percentile));
  const sorted = [...hours].sort((a, b) => a - b);
  // `Math.max(1, …)` couvre p = 0, qui donnerait sinon l'index -1.
  const rank = Math.max(1, Math.ceil(p * sorted.length));
  return sorted[rank - 1]!;
}

/** Résultat de la résolution d'une échéance, avec sa provenance. */
export interface LearnedHourResult {
  /** Heure retenue (0-23). */
  hour: number;
  /** `true` si elle vient de l'apprentissage, `false` si c'est le repli réglé par l'utilisateur. */
  learned: boolean;
}

/**
 * Résout l'échéance d'un rappel : p90 des heures apprises si l'échantillon est suffisant, sinon
 * `fallbackHour`.
 *
 * Le drapeau `learned` est ce qui permet à l'écran de réglages de **dire** d'où vient l'heure — une
 * heure qui bouge sans explication est un bug perçu — et au planificateur d'appliquer la bonne
 * politique « Ne pas déranger » (rabattement pour une heure apprise, respect strict pour une heure
 * réglée à la main : décisions D5 et D6).
 *
 * Ne s'occupe **pas** du DND : c'est `clampOutOfDnd` qui s'en charge, en aval.
 */
export function resolveLearnedDeadline(
  samples: LogSample[],
  fallbackHour: number,
  minSamples: number = LEARNED_HOUR_MIN_SAMPLES,
): LearnedHourResult {
  const hours = usableDailyHours(samples);
  if (hours.length < minSamples) {
    return { hour: fallbackHour, learned: false };
  }

  const learnedHour = percentileHour(hours, LEARNED_DEADLINE_PERCENTILE);
  // `hours.length >= minSamples >= 1` garantit un résultat non nul ; la garde est défensive.
  if (learnedHour === null) {
    return { hour: fallbackHour, learned: false };
  }

  return { hour: learnedHour, learned: true };
}

/** Échéance d'un rappel, prête à être planifiée, avec de quoi l'expliquer à l'utilisateur. */
export interface ReminderDeadline {
  /** Heure effective du rappel (0-23). */
  hour: number;
  /** L'heure vient-elle de l'apprentissage (`true`) ou du repli réglé (`false`) ? */
  learned: boolean;
  /** Le rabattement « Ne pas déranger » a-t-il modifié l'heure apprise ? */
  shifted: boolean;
}

/**
 * Résout l'échéance complète d'un rappel : apprentissage puis rabattement DND.
 *
 * C'est ici que les décisions **D5** et **D6** sont réellement câblées, et c'est pour ça que cette
 * fonction vit dans `shared` plutôt que dans le repository mobile : elle est pure, elle n'a aucune
 * dépendance React, et c'était le seul morceau de logique métier de l'US qui n'était pas testé.
 *
 * - `useLearned === false` → l'heure de repli s'applique telle quelle, jamais rabattue.
 * - apprentissage insuffisant → repli, traité **comme une heure manuelle** : pas de rabattement non
 *   plus. C'est cohérent, puisque le repli *est* la valeur que l'utilisateur a réglée au stepper.
 * - heure apprise → rabattue hors DND si nécessaire, et `shifted` dit si ça a bougé, pour que
 *   l'écran de réglages puisse l'annoncer.
 *
 * Le corollaire à ne pas rater : une heure **non apprise** peut donc tomber en DND. C'est voulu (on
 * ne réécrit pas un choix de l'utilisateur, D6), mais l'appelant doit alors **le dire** — sinon le
 * rappel ne partira jamais sans que personne ne comprenne pourquoi.
 */
export function resolveReminderDeadline(
  samples: LogSample[],
  fallbackHour: number,
  useLearned: boolean,
  prefs: NotificationPrefs,
): ReminderDeadline {
  if (!useLearned) {
    return { hour: fallbackHour, learned: false, shifted: false };
  }

  const { hour, learned } = resolveLearnedDeadline(samples, fallbackHour);
  if (!learned) {
    return { hour, learned: false, shifted: false };
  }

  const clamped = clampOutOfDnd(hour, prefs);
  return { hour: clamped, learned: true, shifted: clamped !== hour };
}
