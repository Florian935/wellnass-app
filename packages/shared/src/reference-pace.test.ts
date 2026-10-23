import { describe, expect, it } from 'vitest';
import {
  COOPER_TEST,
  RACE_CUSTOM_RANGE_M,
  RACE_DISTANCE_KEYS,
  RACE_TIME_EXAMPLE_S,
  classifyReferencePace,
  cooperCue,
  cooperPhase,
  cooperRemainingS,
  evaluateReferenceDoor,
  measureCooperTest,
  raceDistanceMeters,
  referencePaceFromRecord5k,
  referencePaceOrigin,
  shouldOpenRunningWelcome,
  shouldRecordUpdateReference,
  trainingPaceBands,
  voiceChoicePatch,
  type RunningWelcomeInput,
} from './reference-pace';
import { RECORD_DISTANCE_I18N_KEY } from './pace-records';
import { PLAUSIBLE_PACE_S_PER_KM, parsePaceText, parsePaceToSPerKm } from './units';
import type { GpsPoint } from './running';

// ---------------------------------------------------------------------------
// Bornes : une seule, partagée avec la saisie d'allure existante (R4)
// ---------------------------------------------------------------------------

describe('PLAUSIBLE_PACE_S_PER_KM — la borne unique des quatre portes', () => {
  it('est exactement celle de parsePaceToSPerKm (test de garde)', () => {
    expect(PLAUSIBLE_PACE_S_PER_KM).toEqual({ min: 150, max: 720 });
    expect(parsePaceToSPerKm('2:30', 'metric')).toBe(150);
    expect(parsePaceToSPerKm('2:29', 'metric')).toBeNull();
    expect(parsePaceToSPerKm('12:00', 'metric')).toBe(720);
    expect(parsePaceToSPerKm('12:01', 'metric')).toBeNull();
  });

  it('parsePaceText lit sans borne : « illisible » ne se confond plus avec « hors bornes »', () => {
    expect(parsePaceText('1:59', 'metric')).toBe(119);
    expect(parsePaceText('13:00', 'metric')).toBe(780);
    expect(parsePaceText('5:7', 'metric')).toBeNull();
    expect(parsePaceText('abc', 'metric')).toBeNull();
    expect(parsePaceText('8:00', 'imperial')).toBeCloseTo(298.26, 1);
  });
});

describe('classifyReferencePace', () => {
  it('arrondit à la seconde et classe sur la valeur brute', () => {
    expect(classifyReferencePace(149)).toEqual({ status: 'tooFast', sPerKm: 149 });
    expect(classifyReferencePace(150)).toEqual({ status: 'ok', sPerKm: 150 });
    expect(classifyReferencePace(720)).toEqual({ status: 'ok', sPerKm: 720 });
    expect(classifyReferencePace(721)).toEqual({ status: 'tooSlow', sPerKm: 721 });
    expect(classifyReferencePace(298.26)).toEqual({ status: 'ok', sPerKm: 298 });
  });

  it('🔴 compare la valeur BRUTE, comme parsePaceToSPerKm : 4:01 /mi est refusé par les deux', () => {
    const raw = parsePaceText('4:01', 'imperial')!;
    expect(raw).toBeCloseTo(149.75, 1);
    expect(parsePaceToSPerKm('4:01', 'imperial')).toBeNull();
    expect(classifyReferencePace(raw).status).toBe('tooFast');
    expect(classifyReferencePace(720.4).status).toBe('tooSlow');
  });

  it('rend « vide » sur une valeur absente ou absurde, jamais une allure', () => {
    expect(classifyReferencePace(null)).toEqual({ status: 'empty' });
    expect(classifyReferencePace(0)).toEqual({ status: 'empty' });
    expect(classifyReferencePace(Number.NaN)).toEqual({ status: 'empty' });
  });
});

// ---------------------------------------------------------------------------
// Les portes (R1 → R4)
// ---------------------------------------------------------------------------

describe('evaluateReferenceDoor — porte « j’ai un chrono »', () => {
  const race = (distance: Parameters<typeof raceDistanceMeters>[0] | 'other', timeText: string, customDistanceText = '') =>
    evaluateReferenceDoor({ door: 'race', distance, customDistanceText, timeText, system: 'metric' });

  it('rend les valeurs de la maquette', () => {
    expect(race('10k', '52:30')).toEqual({ status: 'ok', sPerKm: 302 });
    expect(race('5k', '25:00')).toEqual({ status: 'ok', sPerKm: 300 });
    expect(race('semi', '1:55:00')).toEqual({ status: 'ok', sPerKm: 300 });
  });

  it('distingue vide, illisible et hors bornes', () => {
    expect(race('10k', '')).toEqual({ status: 'empty' });
    expect(race('10k', '  ')).toEqual({ status: 'empty' });
    expect(race('10k', '52:7x')).toEqual({ status: 'unreadable' });
    expect(race('10k', '0:00')).toEqual({ status: 'unreadable' });
    expect(race('5k', '1:20:00')).toEqual({ status: 'tooSlow', sPerKm: 960 });
  });

  it('un semi écrit « 1:45 » se lit 1 min 45 s : trop rapide, jamais une allure', () => {
    expect(race('semi', '1:45').status).toBe('tooFast');
  });

  it('« Autre » accepte de 1 000 à 42 195 m, dans l’unité d’affichage', () => {
    expect(race('other', '45:00', '8').status).toBe('ok');
    expect(race('other', '45:00', '0,999')).toEqual({ status: 'badDistance' });
    expect(race('other', '45:00', '42,196')).toEqual({ status: 'badDistance' });
    expect(race('other', '45:00', 'abc')).toEqual({ status: 'badDistance' });
    expect(race('other', '45:00', '')).toEqual({ status: 'empty' });
    expect(
      evaluateReferenceDoor({ door: 'race', distance: 'other', customDistanceText: '0.63', timeText: '5:00', system: 'imperial' }).status,
    ).not.toBe('badDistance');
    expect(
      evaluateReferenceDoor({ door: 'race', distance: 'other', customDistanceText: '0.62', timeText: '5:00', system: 'imperial' }),
    ).toEqual({ status: 'badDistance' });
  });
});

describe('evaluateReferenceDoor — porte « le test de 12 minutes »', () => {
  const test = (distanceText: string, system: 'metric' | 'imperial' = 'metric') =>
    evaluateReferenceDoor({ door: 'test', distanceText, system });

  it('2 400 m donne 314 s/km, comme referencePaceFromCooperTest', () => {
    expect(test('2400')).toEqual({ status: 'ok', sPerKm: 314 });
    expect(test('2 400')).toEqual({ status: 'ok', sPerKm: 314 });
  });

  it('un test trop court est « trop lent », pas « vide »', () => {
    expect(test('300').status).toBe('tooSlow');
    expect(test('1000').status).toBe('tooSlow');
  });

  it('lit des miles en impérial', () => {
    expect(test('1.49', 'imperial').status).toBe('ok');
  });

  it('vide ou illisible', () => {
    expect(test('')).toEqual({ status: 'empty' });
    expect(test('deux')).toEqual({ status: 'unreadable' });
    expect(test('0')).toEqual({ status: 'unreadable' });
  });
});

describe('evaluateReferenceDoor — porte « je connais mon allure »', () => {
  const known = (paceText: string, system: 'metric' | 'imperial' = 'metric') =>
    evaluateReferenceDoor({ door: 'known', paceText, system });

  it('lit m:ss, arrondit en impérial', () => {
    expect(known('4:58')).toEqual({ status: 'ok', sPerKm: 298 });
    expect(known('8:00', 'imperial')).toEqual({ status: 'ok', sPerKm: 298 });
  });

  it('hors bornes n’est pas illisible', () => {
    expect(known('2:00')).toEqual({ status: 'tooFast', sPerKm: 120 });
    expect(known('13:00')).toEqual({ status: 'tooSlow', sPerKm: 780 });
    expect(known('5h')).toEqual({ status: 'unreadable' });
    expect(known('')).toEqual({ status: 'empty' });
  });
});

describe('les distances du chrono', () => {
  it('ont toutes un libellé et une distance', () => {
    for (const key of RACE_DISTANCE_KEYS) {
      expect(RECORD_DISTANCE_I18N_KEY[key]).toBeTruthy();
      expect(raceDistanceMeters(key)).toBeGreaterThan(0);
      expect(RACE_TIME_EXAMPLE_S[key]).toBeGreaterThan(0);
    }
    expect(raceDistanceMeters('marathon')).toBe(42195);
    expect(RACE_CUSTOM_RANGE_M).toEqual({ min: 1000, max: 42195 });
  });
});

describe('trainingPaceBands', () => {
  it('rend les quatre allures de la maquette pour 302 s/km', () => {
    const bands = trainingPaceBands(302);
    expect(bands.map((b) => b.type)).toEqual(['endurance', 'sortie_longue', 'recuperation', 'fractionne']);
    expect(bands.map((b) => [Math.round(b.range.minSPerKm), Math.round(b.range.maxSPerKm)])).toEqual([
      [362, 392],
      [332, 362],
      [392, 422],
      [287, 302],
    ]);
  });
});

// ---------------------------------------------------------------------------
// La mise à jour, ensuite (R18, R21)
// ---------------------------------------------------------------------------

describe('shouldRecordUpdateReference — un record plus rapide seulement', () => {
  it('pose l’allure quand il n’y en a pas', () => {
    expect(shouldRecordUpdateReference(null, 1950)).toBe(true);
  });

  it('remplace une allure plus lente', () => {
    expect(shouldRecordUpdateReference(302, 1475)).toBe(true);
  });

  it('ne touche ni à une allure égale ni à une allure plus rapide', () => {
    expect(shouldRecordUpdateReference(302, 1510)).toBe(false);
    expect(shouldRecordUpdateReference(302, 1950)).toBe(false);
  });

  it('dérive l’allure du record comme le stockage : arrondi de t ÷ 5', () => {
    expect(referencePaceFromRecord5k(1600)).toBe(320);
    expect(referencePaceFromRecord5k(1512)).toBe(302);
  });
});

describe('referencePaceOrigin — déduite, jamais stockée', () => {
  const record5k = { bestTimeSeconds: 1600, achievedAt: '2026-10-12T08:00:00Z' };

  it('égale au record ÷ 5 → le record', () => {
    expect(referencePaceOrigin({ refSPerKm: 320, record5k })).toEqual({
      kind: 'record',
      timeSeconds: 1600,
      achievedAt: '2026-10-12T08:00:00Z',
    });
  });

  it('une seconde d’écart → donnée par toi', () => {
    expect(referencePaceOrigin({ refSPerKm: 321, record5k })).toEqual({ kind: 'declared' });
  });

  it('sans record → donnée ; sans allure → rien', () => {
    expect(referencePaceOrigin({ refSPerKm: 320, record5k: null })).toEqual({ kind: 'declared' });
    expect(referencePaceOrigin({ refSPerKm: null, record5k })).toEqual({ kind: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Le test de 12 minutes (R10 → R12)
// ---------------------------------------------------------------------------

describe('cooperPhase et cooperRemainingS', () => {
  it('bascule à 11:00 puis à 12:00', () => {
    expect(COOPER_TEST).toEqual({ durationS: 720, lastMinuteS: 660 });
    expect(cooperPhase(659, false)).toBe('running');
    expect(cooperPhase(660, false)).toBe('lastMinute');
    expect(cooperPhase(719, false)).toBe('lastMinute');
    expect(cooperPhase(720, false)).toBe('done');
    expect(cooperPhase(300, true)).toBe('interrupted');
  });

  it('le temps restant ne descend jamais sous zéro', () => {
    expect(cooperRemainingS(462)).toBe(258);
    expect(cooperRemainingS(462.8)).toBe(258);
    expect(cooperRemainingS(900)).toBe(0);
  });
});

describe('cooperCue — deux annonces, jamais rejouées', () => {
  it('se tait au montage : on adopte l’état sans parler', () => {
    expect(cooperCue(null, 'lastMinute')).toBeNull();
    expect(cooperCue(null, 'done')).toBeNull();
  });

  it('annonce chaque passage une seule fois', () => {
    expect(cooperCue('running', 'lastMinute')).toBe('lastMinute');
    expect(cooperCue('lastMinute', 'lastMinute')).toBeNull();
    expect(cooperCue('lastMinute', 'done')).toBe('done');
    expect(cooperCue('done', 'done')).toBeNull();
  });

  it('un saut direct au-delà de 12:00 ne dit que « terminé »', () => {
    expect(cooperCue('running', 'done')).toBe('done');
  });

  it('plus rien après une interruption', () => {
    expect(cooperCue('running', 'interrupted')).toBeNull();
    expect(cooperCue('interrupted', 'done')).toBeNull();
  });
});

/** Trace régulière : un point toutes les `step` secondes, à `speed` m/s vers le nord. */
function trace(seconds: number, speed: number, step = 5): GpsPoint[] {
  const points: GpsPoint[] = [];
  const metersPerDegree = 111_195;
  for (let t = 0; t <= seconds; t += step) {
    points.push({ lat: 45 + (t * speed) / metersPerDegree, lng: 5, t });
  }
  return points;
}

describe('measureCooperTest — la distance à 12:00, sur la trace', () => {
  it('mesure à t = 720 s, même si la course a continué', () => {
    const result = measureCooperTest(trace(1200, 2400 / 720), { interrupted: false });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(Math.abs(result.distanceM - 2400)).toBeLessThanOrEqual(2);
    expect(result.sPerKm).toBe(314);
  });

  it('un trou GPS compte son temps, et sa distance en ligne droite', () => {
    const points = trace(900, 2400 / 720).filter((p) => p.t < 300 || p.t > 400);
    const result = measureCooperTest(points, { interrupted: false });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(Math.abs(result.distanceM - 2400)).toBeLessThanOrEqual(2);
  });

  it('un point aberrant est filtré, comme pour les records', () => {
    const points = trace(900, 2400 / 720);
    const i = points.findIndex((p) => p.t === 300);
    points[i] = { ...points[i]!, lat: points[i]!.lat + 0.05 };
    const result = measureCooperTest(points, { interrupted: false });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.distanceM).toBeLessThan(2400);
  });

  it('dans l’ordre : pas de trace, incomplet, interrompu', () => {
    expect(measureCooperTest([], { interrupted: false })).toEqual({ status: 'noTrack' });
    expect(measureCooperTest([{ lat: 45, lng: 5, t: 0 }], { interrupted: true })).toEqual({ status: 'noTrack' });
    expect(measureCooperTest(trace(580, 3), { interrupted: true })).toEqual({ status: 'incomplete', lastSeconds: 580 });
    expect(measureCooperTest(trace(900, 3), { interrupted: true })).toEqual({ status: 'interrupted' });
  });

  it('un test trop lent rend sa distance et son statut, jamais une allure retenable', () => {
    const result = measureCooperTest(trace(800, 1.2), { interrupted: false });
    expect(result.status).toBe('tooSlow');
  });
});

// ---------------------------------------------------------------------------
// L'accueil (R14, R16)
// ---------------------------------------------------------------------------

describe('shouldOpenRunningWelcome', () => {
  const base: RunningWelcomeInput = {
    online: true,
    syncedThisLaunch: true,
    profileLoading: false,
    hasProfile: false,
    hasActiveRun: false,
    alreadyOpened: false,
  };

  it('s’ouvre dans un seul cas', () => {
    expect(shouldOpenRunningWelcome(base)).toBe(true);
  });

  it.each([
    ['hors ligne', { online: false }],
    ['sans synchro de ce lancement', { syncedThisLaunch: false }],
    ['profil en cours de chargement', { profileLoading: true }],
    ['profil existant', { hasProfile: true }],
    ['course en cours', { hasActiveRun: true }],
    ['déjà ouvert', { alreadyOpened: true }],
  ])('jamais %s', (_label, patch) => {
    expect(shouldOpenRunningWelcome({ ...base, ...patch })).toBe(false);
  });
});

describe('voiceChoicePatch', () => {
  it('produit les trois couples (annonces, guidage)', () => {
    expect(voiceChoicePatch('all')).toEqual({ voiceAnnouncementsEnabled: true, intervalGuidanceEnabled: true });
    expect(voiceChoicePatch('intervals')).toEqual({ voiceAnnouncementsEnabled: false, intervalGuidanceEnabled: true });
    expect(voiceChoicePatch('none')).toEqual({ voiceAnnouncementsEnabled: false, intervalGuidanceEnabled: false });
  });
});
