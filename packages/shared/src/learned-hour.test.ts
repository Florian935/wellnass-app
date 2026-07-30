import { describe, expect, it } from 'vitest';
import { localDayKey } from './date';
import {
  LEARNED_DEADLINE_PERCENTILE,
  LEARNED_HOUR_MIN_SAMPLES,
  LEARNED_HOUR_WINDOW_DAYS,
  type LogSample,
  percentileHour,
  resolveLearnedDeadline,
  resolveReminderDeadline,
  usableDailyHours,
} from './learned-hour';
import { defaultNotificationPrefs } from './notifications';

/**
 * Construit un horodatage ISO UTC à partir d'une **heure locale** — exactement ce que l'app stocke
 * (`created_at = new Date().toISOString()`). Passer par un `Date` local rend ces tests
 * indépendants du fuseau de la machine qui les exécute : c'est le seul moyen de tester une
 * conversion UTC → heure locale sans figer un fuseau.
 */
function localIso(y: number, m: number, d: number, hour: number, minute = 0): string {
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
}

/** Clé de jour local, construite comme l'app le fait. */
function dayKey(y: number, m: number, d: number): string {
  return localDayKey(new Date(y, m - 1, d));
}

/** Raccourci : une saisie faite le jour qu'elle décrit, à l'heure locale donnée. */
function sameDay(y: number, m: number, d: number, hour: number, minute = 0): LogSample {
  return { logDate: dayKey(y, m, d), createdAt: localIso(y, m, d, hour, minute) };
}

describe('usableDailyHours', () => {
  it('convertit created_at (UTC) en heure locale', () => {
    // 8 h locales, sérialisées en UTC : le résultat doit rester 8, pas l'heure UTC.
    expect(usableDailyHours([sameDay(2026, 7, 1, 8)])).toEqual([8]);
  });

  it('retient une saisie de fin de soirée le jour même (23 h 50)', () => {
    expect(usableDailyHours([sameDay(2026, 7, 1, 23, 50)])).toEqual([23]);
  });

  it('rejette une saisie rétroactive (journée décrite ≠ jour de la saisie)', () => {
    // Le repas du 1er, noté le 2 au matin : n'apprend rien sur l'heure du repas.
    const retro: LogSample = {
      logDate: dayKey(2026, 7, 1),
      createdAt: localIso(2026, 7, 2, 9),
    };
    expect(usableDailyHours([retro])).toEqual([]);
  });

  it('rejette une saisie faite après minuit pour la veille (00 h 10)', () => {
    const afterMidnight: LogSample = {
      logDate: dayKey(2026, 7, 1),
      createdAt: localIso(2026, 7, 2, 0, 10),
    };
    expect(usableDailyHours([afterMidnight])).toEqual([]);
  });

  it('garde la plus ancienne entrée du jour', () => {
    expect(
      usableDailyHours([sameDay(2026, 7, 1, 13), sameDay(2026, 7, 1, 8), sameDay(2026, 7, 1, 20)]),
    ).toEqual([8]);
  });

  it("prend la suivante quand la plus ancienne entrée du jour est rejetée", () => {
    // Entrée saisie la veille au soir pour le 2 (planifiée à l'avance) : chronologiquement la
    // première, mais rejetée. On doit retomber sur celle de 9 h, pas abandonner le jour.
    const plannedAhead: LogSample = {
      logDate: dayKey(2026, 7, 2),
      createdAt: localIso(2026, 7, 1, 22),
    };
    expect(usableDailyHours([plannedAhead, sameDay(2026, 7, 2, 9)])).toEqual([9]);
  });

  it("écarte le jour quand aucune de ses entrées n'est retenue", () => {
    const retro: LogSample = {
      logDate: dayKey(2026, 7, 1),
      createdAt: localIso(2026, 7, 2, 9),
    };
    expect(usableDailyHours([retro, sameDay(2026, 7, 3, 8)])).toEqual([8]);
  });

  it('produit une valeur par jour, ordonnée par jour croissant', () => {
    expect(
      usableDailyHours([sameDay(2026, 7, 3, 10), sameDay(2026, 7, 1, 8), sameDay(2026, 7, 2, 9)]),
    ).toEqual([8, 9, 10]);
  });

  it('ignore un horodatage illisible sans lever', () => {
    const broken: LogSample = { logDate: dayKey(2026, 7, 1), createdAt: 'pas-une-date' };
    expect(() => usableDailyHours([broken])).not.toThrow();
    expect(usableDailyHours([broken, sameDay(2026, 7, 2, 8)])).toEqual([8]);
  });

  it('accepte un échantillon vide', () => {
    expect(usableDailyHours([])).toEqual([]);
  });
});

describe('percentileHour', () => {
  it('retourne null sur un échantillon vide', () => {
    expect(percentileHour([], LEARNED_DEADLINE_PERCENTILE)).toBeNull();
  });

  it('retourne la valeur unique pour n = 1', () => {
    expect(percentileHour([8], LEARNED_DEADLINE_PERCENTILE)).toBe(8);
  });

  it('retourne le maximum au seuil de confiance (n = 5) — conservateur par choix', () => {
    // rang = ceil(0,9 × 5) = 5 → le dernier élément trié.
    expect(percentileHour([8, 9, 7, 8, 11], LEARNED_DEADLINE_PERCENTILE)).toBe(11);
  });

  it('cible le bord tardif sur un profil régulier (n = 7)', () => {
    // trié [8,8,8,8,9,9,10] · rang = ceil(6,3) = 7 → 10 h.
    // L'utilisateur logge presque toujours à 8 h : le rappel ne partira qu'à 10 h, donc rarement.
    expect(percentileHour([8, 8, 9, 8, 9, 8, 10], LEARNED_DEADLINE_PERCENTILE)).toBe(10);
  });

  it('prend le 13ᵉ rang sur une fenêtre pleine (n = 14)', () => {
    const hours = [7, 7, 8, 8, 8, 8, 9, 9, 9, 10, 10, 11, 12, 19];
    // rang = ceil(12,6) = 13 → index 12 → 12 h (la valeur aberrante de 19 h est écartée).
    expect(percentileHour(hours, LEARNED_DEADLINE_PERCENTILE)).toBe(12);
  });

  it('renvoie le bord tardif sur un profil de couche-tard — là où la médiane échoue', () => {
    // trié [0,0,0,23,23,23] · rang = ceil(5,4) = 6 → 23 h.
    // La médiane aurait donné 11 h 30, le point antipodal de l'habitude réelle (décision D2).
    expect(percentileHour([23, 0, 23, 0, 23, 0], LEARNED_DEADLINE_PERCENTILE)).toBe(23);
  });

  it("ne dépend pas de l'ordre d'entrée", () => {
    const hours = [10, 8, 9, 8, 8, 9, 8];
    const shuffled = [8, 9, 8, 10, 8, 8, 9];
    expect(percentileHour(hours, LEARNED_DEADLINE_PERCENTILE)).toBe(
      percentileHour(shuffled, LEARNED_DEADLINE_PERCENTILE),
    );
  });

  it('ne mute pas le tableau reçu', () => {
    const hours = [10, 8, 9];
    percentileHour(hours, LEARNED_DEADLINE_PERCENTILE);
    expect(hours).toEqual([10, 8, 9]);
  });

  it('borne le percentile : 0 donne le minimum, 1 le maximum', () => {
    expect(percentileHour([10, 8, 9], 0)).toBe(8);
    expect(percentileHour([10, 8, 9], 1)).toBe(10);
  });

  it('borne un percentile hors [0, 1]', () => {
    expect(percentileHour([10, 8, 9], -3)).toBe(8);
    expect(percentileHour([10, 8, 9], 42)).toBe(10);
  });
});

describe('resolveLearnedDeadline', () => {
  it('retombe sur le repli sans aucun historique', () => {
    expect(resolveLearnedDeadline([], 13)).toEqual({ hour: 13, learned: false });
  });

  it('retombe sur le repli sous le seuil (4 jours)', () => {
    const samples = [
      sameDay(2026, 7, 1, 8),
      sameDay(2026, 7, 2, 8),
      sameDay(2026, 7, 3, 9),
      sameDay(2026, 7, 4, 8),
    ];
    expect(resolveLearnedDeadline(samples, 13)).toEqual({ hour: 13, learned: false });
  });

  it('apprend dès le seuil atteint (5 jours)', () => {
    const samples = [
      sameDay(2026, 7, 1, 8),
      sameDay(2026, 7, 2, 8),
      sameDay(2026, 7, 3, 9),
      sameDay(2026, 7, 4, 8),
      sameDay(2026, 7, 5, 10),
    ];
    expect(resolveLearnedDeadline(samples, 13)).toEqual({ hour: 10, learned: true });
  });

  it('ne compte que les jours retenus pour atteindre le seuil', () => {
    // 5 saisies, mais l'une est rétroactive → 4 jours retenus → repli.
    const samples = [
      sameDay(2026, 7, 1, 8),
      sameDay(2026, 7, 2, 8),
      sameDay(2026, 7, 3, 9),
      sameDay(2026, 7, 4, 8),
      { logDate: dayKey(2026, 7, 5), createdAt: localIso(2026, 7, 6, 9) },
    ];
    expect(resolveLearnedDeadline(samples, 13)).toEqual({ hour: 13, learned: false });
  });

  it('accepte un seuil surchargé', () => {
    const samples = [sameDay(2026, 7, 1, 8), sameDay(2026, 7, 2, 9)];
    expect(resolveLearnedDeadline(samples, 13, 2)).toEqual({ hour: 9, learned: true });
  });

  it('plusieurs entrées le même jour ne comptent que pour un jour', () => {
    const samples = [
      sameDay(2026, 7, 1, 8),
      sameDay(2026, 7, 1, 12),
      sameDay(2026, 7, 1, 20),
      sameDay(2026, 7, 2, 8),
    ];
    expect(resolveLearnedDeadline(samples, 13)).toEqual({ hour: 13, learned: false });
  });
});

describe('resolveReminderDeadline', () => {
  const prefs = defaultNotificationPrefs(); // DND [22, 7)

  /** `n` jours consécutifs de saisies à la même heure locale. */
  function daysAt(hour: number, n: number): LogSample[] {
    return Array.from({ length: n }, (_, i) => sameDay(2026, 7, i + 1, hour));
  }

  it('applique le repli tel quel quand l’apprentissage est coupé', () => {
    // Même avec 14 jours d'historique à 8 h : l'utilisateur a choisi son heure, on la respecte.
    expect(resolveReminderDeadline(daysAt(8, 14), 13, false, prefs)).toEqual({
      hour: 13,
      learned: false,
      shifted: false,
    });
  });

  it('ne rabat JAMAIS une heure réglée à la main, même en pleine fenêtre DND (D6)', () => {
    // 23 h est dans le DND [22,7). L'heure sort inchangée : c'est au planificateur de refuser, et à
    // l'écran de réglages de l'annoncer. Réécrire en douce le choix de l'utilisateur est interdit.
    expect(resolveReminderDeadline([], 23, false, prefs)).toEqual({
      hour: 23,
      learned: false,
      shifted: false,
    });
  });

  it('traite le repli comme une heure manuelle quand l’historique est insuffisant', () => {
    // Apprentissage demandé, mais 4 jours seulement → repli, non rabattu, `learned: false`.
    // C'est ce qui a révélé un trou en revue : l'écran affichait « 23:00 en attendant » pour un
    // rappel qui n'allait jamais partir. Le contrat est ici, il est testé.
    expect(resolveReminderDeadline(daysAt(8, 4), 23, true, prefs)).toEqual({
      hour: 23,
      learned: false,
      shifted: false,
    });
  });

  it('apprend et laisse l’heure intacte quand elle est hors DND', () => {
    expect(resolveReminderDeadline(daysAt(8, 7), 13, true, prefs)).toEqual({
      hour: 8,
      learned: true,
      shifted: false,
    });
  });

  // ── Le seul chemin qui enchaîne apprentissage ET rabattement ──
  it('rabat une heure APPRISE tombant en DND, et le signale (D5)', () => {
    // Couche-tard : 7 jours de première saisie à 23 h → p90 = 23, dans le DND [22,7) → rabattu à
    // 21 h, et `shifted` permet à l'écran de dire « décalé avant ta plage Ne pas déranger ».
    expect(resolveReminderDeadline(daysAt(23, 7), 13, true, prefs)).toEqual({
      hour: 21,
      learned: true,
      shifted: true,
    });
  });

  it('ne signale pas de décalage quand le DND est désactivé', () => {
    const off = { ...prefs, dndEnabled: false };
    expect(resolveReminderDeadline(daysAt(23, 7), 13, true, off)).toEqual({
      hour: 23,
      learned: true,
      shifted: false,
    });
  });
});

describe('constantes', () => {
  it('fixe le seuil de confiance à 5 jours et la fenêtre à 14', () => {
    expect(LEARNED_HOUR_MIN_SAMPLES).toBe(5);
    expect(LEARNED_HOUR_WINDOW_DAYS).toBe(14);
  });

  it('vise le 9ᵉ décile — une échéance, pas une habitude (D1)', () => {
    expect(LEARNED_DEADLINE_PERCENTILE).toBe(0.9);
  });
});
