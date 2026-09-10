import { describe, expect, it } from 'vitest';
import { advanceNetSeconds, displayedNetSeconds, pausedSeconds } from './run-clock';

describe('advanceNetSeconds', () => {
  it('ne compte rien au premier pas — il pose seulement le repère', () => {
    const out = advanceNetSeconds({
      netSeconds: 0,
      lastAdvanceAtMs: null,
      nowMs: 1_000_000,
      paused: false,
    });

    // Sans ça, la latence entre la création de la course et le premier point serait comptée
    // comme du temps de course.
    expect(out).toEqual({ netSeconds: 0, lastAdvanceAtMs: 1_000_000 });
  });

  it('ajoute le temps écoulé quand la course tourne', () => {
    const out = advanceNetSeconds({
      netSeconds: 10,
      lastAdvanceAtMs: 1_000_000,
      nowMs: 1_003_500,
      paused: false,
    });

    expect(out.netSeconds).toBeCloseTo(13.5, 6);
    expect(out.lastAdvanceAtMs).toBe(1_003_500);
  });

  it('🔴 déplace le repère MÊME en pause', () => {
    const out = advanceNetSeconds({
      netSeconds: 42,
      lastAdvanceAtMs: 1_000_000,
      nowMs: 1_060_000,
      paused: true,
    });

    // La durée ne bouge pas…
    expect(out.netSeconds).toBe(42);
    // …mais le repère avance : sinon la reprise compterait la minute de pause d'un coup.
    expect(out.lastAdvanceAtMs).toBe(1_060_000);
  });

  it('une pause d’une minute ne coûte rien à la reprise', () => {
    let state = { netSeconds: 100, lastAdvanceAtMs: 0 as number | null };

    // t=0 : on tourne
    state = advanceNetSeconds({ ...state, nowMs: 0, paused: false });
    // t=+5 s en marche
    state = advanceNetSeconds({ ...state, nowMs: 5_000, paused: false });
    // t=+65 s, dont 60 s en pause
    state = advanceNetSeconds({ ...state, nowMs: 65_000, paused: true });
    // t=+70 s, reprise
    state = advanceNetSeconds({ ...state, nowMs: 70_000, paused: false });

    // 100 + 5 (marche) + 5 (après reprise) = 110. Les 60 s de pause sont perdues, c'est le but.
    expect(state.netSeconds).toBeCloseTo(110, 6);
  });

  it('n’enlève jamais de temps si l’horloge recule', () => {
    const out = advanceNetSeconds({
      netSeconds: 50,
      lastAdvanceAtMs: 1_000_000,
      nowMs: 999_000,
      paused: false,
    });

    expect(out.netSeconds).toBe(50);
    expect(out.lastAdvanceAtMs).toBe(999_000);
  });

  it('deux avancements au même instant ne comptent qu’une fois', () => {
    const first = advanceNetSeconds({
      netSeconds: 0,
      lastAdvanceAtMs: 1_000_000,
      nowMs: 1_002_000,
      paused: false,
    });
    const second = advanceNetSeconds({ ...first, nowMs: 1_002_000, paused: false });

    expect(second.netSeconds).toBeCloseTo(2, 6);
  });
});

describe('displayedNetSeconds', () => {
  it('préfère le tracker vivant à la valeur persistée', () => {
    expect(
      displayedNetSeconds({ liveNetSeconds: 128.7, storedDurationSeconds: 120 }),
    ).toBe(128);
  });

  it('🔴 retombe sur la valeur persistée quand aucun tracker ne suit la course', () => {
    // Écran remonté après un redémarrage du runtime : la durée est FIGÉE, pas fausse.
    // L'ancien code retombait sur l'horloge murale — un chiffre faux qui avait l'air vivant.
    expect(displayedNetSeconds({ liveNetSeconds: null, storedDurationSeconds: 240 })).toBe(240);
  });

  it('affiche 0 quand il n’y a aucune donnée, jamais NaN', () => {
    expect(displayedNetSeconds({ liveNetSeconds: null, storedDurationSeconds: null })).toBe(0);
    expect(displayedNetSeconds({ liveNetSeconds: Number.NaN, storedDurationSeconds: 10 })).toBe(0);
    expect(displayedNetSeconds({ liveNetSeconds: -5, storedDurationSeconds: 10 })).toBe(0);
  });

  it('tronque, ne pas arrondit : 59,9 s reste 59 s', () => {
    // Un chrono qui affiche 1:00 alors qu'il compte 59,9 s ment d'une seconde à chaque minute.
    expect(displayedNetSeconds({ liveNetSeconds: 59.9, storedDurationSeconds: null })).toBe(59);
  });
});

describe('pausedSeconds', () => {
  it('rend l’écart et l’écoulé quand il y a eu des pauses', () => {
    const out = pausedSeconds({
      startedAtMs: 0,
      finishedAtMs: 38 * 60_000 + 52_000,
      netSeconds: 36 * 60 + 40,
    });

    expect(out).toEqual({ pausedS: 132, elapsedS: 2332 });
  });

  it('se tait quand la course n’a pas été mise en pause', () => {
    expect(
      pausedSeconds({ startedAtMs: 0, finishedAtMs: 600_000, netSeconds: 600 }),
    ).toBeNull();
  });

  it('se tait sous la seconde d’écart (bruit d’arrondi)', () => {
    expect(
      pausedSeconds({ startedAtMs: 0, finishedAtMs: 600_400, netSeconds: 600 }),
    ).toBeNull();
  });

  it('se tait quand la durée nette est inconnue', () => {
    expect(
      pausedSeconds({ startedAtMs: 0, finishedAtMs: 600_000, netSeconds: null }),
    ).toBeNull();
  });

  it('se tait plutôt que d’afficher une absurdité si le net dépasse l’écoulé', () => {
    expect(
      pausedSeconds({ startedAtMs: 0, finishedAtMs: 600_000, netSeconds: 900 }),
    ).toBeNull();
  });
});
