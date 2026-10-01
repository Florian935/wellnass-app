/** US BIEN-06 — la nuit lue dans Health Connect : une nuit par matin, l'éveil retiré. */
import { describe, expect, it } from 'vitest';

import {
  NIGHT_MIN_MINUTES,
  REGULARITY_MIN_NIGHTS,
  bedtimeSpread,
  canWriteImportedNight,
  nightsFromSleepSessions,
  type RemoteSleepSessionRecord,
} from './wellbeing-sleep';

// Tous les instants sont écrits en UTC avec un décalage explicite de +02:00 (heure d'été de Paris) :
// le test ne dépend pas du fuseau de la machine qui le lance.
const PARIS = 7200;
const at = (dayKey: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) + ((h as number) * 60 + (m as number) - 120) * 60_000).toISOString();
};
const session = (startDay: string, start: string, endDay: string, end: string, over: Partial<RemoteSleepSessionRecord> = {}): RemoteSleepSessionRecord => ({
  startTime: at(startDay, start),
  endTime: at(endDay, end),
  endZoneOffset: { id: '+02:00', totalSeconds: PARIS },
  ...over,
});

describe('nightsFromSleepSessions', () => {
  it('une nuit appartient au matin du réveil', () => {
    const nights = nightsFromSleepSessions([session('2026-09-30', '23:30', '2026-10-01', '07:00')], PARIS);
    expect(nights).toEqual([
      { dayKey: '2026-10-01', minutes: 450, startAt: at('2026-09-30', '23:30'), endAt: at('2026-10-01', '07:00') },
    ]);
  });

  it('retire les phases d’éveil quand la source les donne', () => {
    const d1 = '2026-09-30';
    const d2 = '2026-10-01';
    const nights = nightsFromSleepSessions(
      [
        session(d1, '23:00', d2, '07:00', {
          stages: [
            { startTime: at(d1, '23:00'), endTime: at(d2, '02:00'), stage: 4 }, // léger, 3 h
            { startTime: at(d2, '02:00'), endTime: at(d2, '02:50'), stage: 1 }, // éveillé, 50 min
            { startTime: at(d2, '02:50'), endTime: at(d2, '07:00'), stage: 5 }, // profond
          ],
        }),
      ],
      PARIS,
    );
    expect(nights[0]?.minutes).toBe(8 * 60 - 50);
  });

  it('additionne une nuit coupée en deux sessions', () => {
    const nights = nightsFromSleepSessions(
      [session('2026-09-30', '23:00', '2026-10-01', '03:00'), session('2026-10-01', '03:30', '2026-10-01', '07:00')],
      PARIS,
    );
    // La première session finit à 3 h : c'est une nuit (fin entre 3 h et 14 h) ; la seconde aussi.
    expect(nights).toHaveLength(1);
    expect(nights[0]?.minutes).toBe(4 * 60 + 3 * 60 + 30);
    expect(nights[0]?.startAt).toBe(at('2026-09-30', '23:00'));
  });

  it('une sieste d’après-midi ou de moins de 3 h n’est pas une nuit', () => {
    expect(nightsFromSleepSessions([session('2026-10-01', '13:30', '2026-10-01', '14:10')], PARIS)).toEqual([]);
    expect(nightsFromSleepSessions([session('2026-10-01', '05:00', '2026-10-01', '07:00')], PARIS)).toEqual([]);
    expect(NIGHT_MIN_MINUTES).toBe(180);
  });

  it('écarte une session impossible (fin avant début, plus de 20 h)', () => {
    expect(nightsFromSleepSessions([session('2026-10-01', '07:00', '2026-10-01', '06:00')], PARIS)).toEqual([]);
    expect(nightsFromSleepSessions([session('2026-09-29', '08:00', '2026-10-01', '07:00')], PARIS)).toEqual([]);
  });

  it('sans décalage sur le record, retombe sur le fuseau fourni — jamais sur UTC', () => {
    const record = session('2026-09-30', '23:30', '2026-10-01', '07:00', { endZoneOffset: null });
    expect(nightsFromSleepSessions([record], PARIS)[0]?.dayKey).toBe('2026-10-01');
  });
});

describe('canWriteImportedNight — une saisie manuelle prime toujours', () => {
  it('écrit sur une ligne vide ou déjà lue, jamais sur une nuit saisie à la main', () => {
    expect(canWriteImportedNight(null)).toBe(true);
    expect(canWriteImportedNight({ sleepMinutes: null, sleepSource: null })).toBe(true);
    expect(canWriteImportedNight({ sleepMinutes: 400, sleepSource: 'health_connect' })).toBe(true);
    expect(canWriteImportedNight({ sleepMinutes: 400, sleepSource: 'manual' })).toBe(false);
    expect(canWriteImportedNight({ sleepMinutes: 400, sleepSource: null })).toBe(false);
  });
});

describe('bedtimeSpread — la régularité du coucher', () => {
  const night = (logDate: string, bedDay: string, bed: string) => ({ logDate, sleepStartAt: at(bedDay, bed) });

  it('compte depuis midi : 23 h 30 et 0 h 30 sont à une heure l’un de l’autre', () => {
    const r = bedtimeSpread(
      [
        night('2026-09-27', '2026-09-26', '23:30'),
        night('2026-09-28', '2026-09-28', '00:30'),
        night('2026-09-29', '2026-09-28', '23:30'),
        night('2026-09-30', '2026-09-30', '00:30'),
        night('2026-10-01', '2026-09-30', '23:30'),
        night('2026-10-01', '2026-09-30', '23:30'),
      ].slice(0, 5),
      '2026-10-01',
      PARIS,
    );
    expect(r?.nights).toBe(5);
    expect(r?.spreadMinutes).toBeGreaterThanOrEqual(25);
    expect(r?.spreadMinutes).toBeLessThanOrEqual(35);
    // Moyenne à minuit moins six minutes environ — jamais « 12 h » par un calcul circulaire raté.
    expect(r!.meanBedtimeMinutes > 23 * 60 || r!.meanBedtimeMinutes < 60).toBe(true);
  });

  it('se tait sous 5 nuits lues', () => {
    const few = [night('2026-09-30', '2026-09-29', '23:00'), night('2026-10-01', '2026-09-30', '23:10')];
    expect(bedtimeSpread(few, '2026-10-01', PARIS)).toBeNull();
    expect(REGULARITY_MIN_NIGHTS).toBe(5);
  });
});
