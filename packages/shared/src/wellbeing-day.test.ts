/** US BIEN-04 — ce que l'état du jour change à la séance et à l'assiette : des propositions, jamais des ordres. */
import { describe, expect, it } from 'vitest';

import { buildWellbeingDay, type WellbeingDaySession } from './wellbeing-day';
import { resolveWellbeingSection, WELLBEING_SECTIONS } from './wellbeing-section';

const legs: WellbeingDaySession = { id: 'legs', pillar: 'strength', name: 'Jambes', sessionType: null, status: 'planned', adapted: false };
const intervals: WellbeingDaySession = { id: 'int', pillar: 'running', name: null, sessionType: 'fractionne', status: 'planned', adapted: false };
const easy: WellbeingDaySession = { id: 'easy', pillar: 'running', name: null, sessionType: 'endurance', status: 'planned', adapted: false };

const day = (over: Parameters<typeof buildWellbeingDay>[0] = { today: null, yesterday: null, sessions: [], activePillars: ['strength', 'running', 'nutrition'] }) =>
  buildWellbeingDay(over);

describe('buildWellbeingDay', () => {
  it('nuit courte : alléger la séance intense, ne rien changer au footing', () => {
    const r = day({ today: { logDate: 't', sleepMinutes: 340 }, yesterday: null, sessions: [legs, intervals, easy], activePillars: ['strength', 'running'] });
    expect(r.signals.map((s) => s.code)).toEqual(['poorNight']);
    expect(r.advice.map((a) => [a.sessionId, a.kind])).toEqual([
      ['legs', 'lighten'],
      ['int', 'lighten'],
      ['easy', 'keep'],
    ]);
    // Seule la course intense sait lire un allègement écrit (CARDIO-UX01).
    expect(r.advice.find((a) => a.sessionId === 'int')?.canWriteLighten).toBe(true);
    expect(r.advice.find((a) => a.sessionId === 'legs')?.canWriteLighten).toBe(false);
  });

  it('une course déjà adaptée n’en reçoit pas une seconde écriture', () => {
    const r = day({ today: { logDate: 't', energy: 2 }, yesterday: null, sessions: [{ ...intervals, adapted: true }], activePillars: ['running'] });
    expect(r.advice[0]).toMatchObject({ kind: 'lighten', canWriteLighten: false, adapted: true });
  });

  it('malade : toute séance prévue est proposée au lendemain, et la cible passe en veille', () => {
    const r = day({ today: { logDate: 't', sick: true }, yesterday: null, sessions: [legs, easy], activePillars: ['strength', 'running', 'nutrition'] });
    expect(r.advice.map((a) => a.kind)).toEqual(['postpone', 'postpone']);
    expect(r.nutritionNote).toBe('sick');
  });

  it('envie faible sans fatigue : une version courte, pas un allègement', () => {
    const r = day({ today: { logDate: 't', motivation: 1, energy: 3, sleepMinutes: 450 }, yesterday: null, sessions: [legs], activePillars: ['strength'] });
    expect(r.advice[0]?.kind).toBe('shorten');
  });

  it('le stress de LA VEILLE compte (celui du jour se dit le soir)', () => {
    const r = day({ today: { logDate: 't', sleepMinutes: 450 }, yesterday: { logDate: 'y', stress: 5 }, sessions: [intervals], activePillars: ['running', 'nutrition'] });
    expect(r.signals.map((s) => s.code)).toContain('highStressYesterday');
    expect(r.advice[0]?.kind).toBe('lighten');
    expect(r.nutritionNote).toBe('stressed');
  });

  it('tout au vert : on le dit, sur les séances intenses', () => {
    const r = day({ today: { logDate: 't', sleepMinutes: 480, sleepQuality: 4, energy: 5 }, yesterday: null, sessions: [legs, easy], activePillars: ['strength', 'running'] });
    expect(r.allGood).toBe(true);
    expect(r.advice.map((a) => a.kind)).toEqual(['go', 'keep']);
  });

  it('ne parle de l’assiette que si la nutrition est activée', () => {
    expect(day({ today: { logDate: 't', sleepMinutes: 300 }, yesterday: null, sessions: [], activePillars: ['strength'] }).nutritionNote).toBeNull();
    expect(day({ today: { logDate: 't', sleepMinutes: 300 }, yesterday: null, sessions: [], activePillars: ['nutrition'] }).nutritionNote).toBe('poorNight');
    expect(day({ today: null, yesterday: { logDate: 'y', lateNight: true }, sessions: [], activePillars: ['nutrition'] }).nutritionNote).toBe('lateNight');
  });

  it('ignore les séances déjà faites ou sautées', () => {
    const r = day({ today: { logDate: 't', energy: 1 }, yesterday: null, sessions: [{ ...legs, status: 'done' }, { ...intervals, status: 'skipped' }], activePillars: ['strength', 'running'] });
    expect(r.advice).toEqual([]);
  });
});

describe('resolveWellbeingSection', () => {
  it('paramètre valide, puis le dernier choisi, puis Aujourd’hui', () => {
    expect(WELLBEING_SECTIONS).toEqual(['today', 'journal', 'insights']);
    expect(resolveWellbeingSection({ param: 'journal', remembered: 'insights' })).toBe('journal');
    expect(resolveWellbeingSection({ param: 'nope', remembered: 'insights' })).toBe('insights');
    expect(resolveWellbeingSection({ param: undefined, remembered: null })).toBe('today');
  });
});
