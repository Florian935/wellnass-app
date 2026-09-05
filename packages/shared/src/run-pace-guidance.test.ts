/** US RUN-F4 (lot E) — piloter a l'allure pendant la course. */
import { describe, expect, it } from 'vitest';
import {
  PACE_TOLERANCE_S_PER_KM,
  evaluatePace,
  shouldAnnouncePace,
  type PaceVerdict,
} from './run-pace-guidance';

/** 4:20-4:25/km — la consigne de la seance de tempo du plan analyse. */
const tempo = { minSPerKm: 260, maxSPerKm: 265 };

describe('evaluatePace', () => {
  it('dans la plage : verdict in_range, ecart nul', () => {
    expect(evaluatePace(262, tempo)).toEqual({ verdict: 'in_range', deltaSPerKm: 0 });
  });

  it('les bornes elles-memes sont dans la plage', () => {
    expect(evaluatePace(260, tempo)?.verdict).toBe('in_range');
    expect(evaluatePace(265, tempo)?.verdict).toBe('in_range');
  });

  it('trop rapide = chiffre PLUS PETIT que la borne basse', () => {
    // Le piege du sens : en allure, courir vite fait BAISSER le nombre.
    const result = evaluatePace(250, tempo);
    expect(result?.verdict).toBe('too_fast');
    expect(result?.deltaSPerKm).toBe(-10);
  });

  it('trop lent = chiffre plus grand que la borne haute', () => {
    const result = evaluatePace(275, tempo);
    expect(result?.verdict).toBe('too_slow');
    expect(result?.deltaSPerKm).toBe(10);
  });

  it('la tolerance absorbe le bruit GPS de part et d autre', () => {
    // Sans zone morte, le verdict clignoterait a chaque rafraichissement et l'alerte vocale
    // serait inutilisable.
    expect(evaluatePace(260 - PACE_TOLERANCE_S_PER_KM, tempo)?.verdict).toBe('in_range');
    expect(evaluatePace(265 + PACE_TOLERANCE_S_PER_KM, tempo)?.verdict).toBe('in_range');
    expect(evaluatePace(260 - PACE_TOLERANCE_S_PER_KM - 1, tempo)?.verdict).toBe('too_fast');
    expect(evaluatePace(265 + PACE_TOLERANCE_S_PER_KM + 1, tempo)?.verdict).toBe('too_slow');
  });

  it('une tolerance nulle rend le verdict strict', () => {
    expect(evaluatePace(259, tempo, 0)?.verdict).toBe('too_fast');
  });

  it('rend null quand l allure est inexploitable — jamais un verdict neutre', () => {
    // « dans la plage » serait un mensonge a l'arret, « hors plage » une fausse alerte.
    expect(evaluatePace(null, tempo)).toBeNull();
    expect(evaluatePace(0, tempo)).toBeNull();
    expect(evaluatePace(Number.POSITIVE_INFINITY, tempo)).toBeNull();
    expect(evaluatePace(Number.NaN, tempo)).toBeNull();
  });

  it('rend null sans plage cible', () => {
    expect(evaluatePace(262, null)).toBeNull();
  });
});

describe('shouldAnnouncePace', () => {
  const tooSlow = { verdict: 'too_slow' as PaceVerdict, deltaSPerKm: 10 };

  it('annonce un ecart neuf', () => {
    expect(
      shouldAnnouncePace({
        evaluation: tooSlow,
        lastAnnouncedVerdict: null,
        elapsedSecondsSinceLastAnnounce: null,
      }),
    ).toBe(true);
  });

  it("n'annonce jamais que tout va bien", () => {
    expect(
      shouldAnnouncePace({
        evaluation: { verdict: 'in_range', deltaSPerKm: 0 },
        lastAnnouncedVerdict: 'too_slow',
        elapsedSecondsSinceLastAnnounce: 999,
      }),
    ).toBe(false);
  });

  it('ne repete pas le meme verdict — sinon la voix parle pendant toute la cote', () => {
    expect(
      shouldAnnouncePace({
        evaluation: tooSlow,
        lastAnnouncedVerdict: 'too_slow',
        elapsedSecondsSinceLastAnnounce: 999,
      }),
    ).toBe(false);
  });

  it('respecte le delai minimum meme quand le verdict change', () => {
    // Un coureur qui oscille autour de la borne declencherait sinon une alternance permanente.
    expect(
      shouldAnnouncePace({
        evaluation: tooSlow,
        lastAnnouncedVerdict: 'too_fast',
        elapsedSecondsSinceLastAnnounce: 10,
      }),
    ).toBe(false);
    expect(
      shouldAnnouncePace({
        evaluation: tooSlow,
        lastAnnouncedVerdict: 'too_fast',
        elapsedSecondsSinceLastAnnounce: 30,
      }),
    ).toBe(true);
  });

  it("n'annonce rien sans evaluation", () => {
    expect(
      shouldAnnouncePace({
        evaluation: null,
        lastAnnouncedVerdict: null,
        elapsedSecondsSinceLastAnnounce: null,
      }),
    ).toBe(false);
  });
});
