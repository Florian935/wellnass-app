import { describe, expect, it } from 'vitest';
import {
  HOME_NEWS_MAX,
  buildDayDials,
  buildWeekStrip,
  isFreshRecord,
  selectHomeNews,
  type DayDialsInput,
  type WeekStripInput,
} from './home-sections';

const TODAY = '2026-10-23'; // vendredi
const MONDAY = '2026-10-19';

const unavailable = { state: 'unavailable' as const };

function dialsInput(over: Partial<DayDialsInput> = {}): DayDialsInput {
  return {
    pillars: ['strength', 'running', 'nutrition'],
    todayKey: TODAY,
    weekSessions: [
      { pillar: 'strength', dayKey: '2026-10-19', done: true },
      { pillar: 'running', dayKey: '2026-10-20', done: true },
      { pillar: 'strength', dayKey: '2026-10-22', done: true },
      { pillar: 'strength', dayKey: TODAY, done: false },
      { pillar: 'running', dayKey: '2026-10-24', done: false },
    ],
    nutrition: { consumed: 1320, target: 2650, proteinG: 80, proteinTarget: 140 },
    steps: { tracked: true, today: 6240, goal: 8000 },
    readiness: {
      show: true,
      verdict: 'push',
      load: { state: 'positive' },
      nutrition: { state: 'neutral' },
      wellbeing: unavailable,
    },
    checkinPending: false,
    ...over,
  };
}

describe('buildDayDials — Bouger · Manger · Récupérer (D2)', () => {
  it('la journée de séance de la toile : trois cadrans', () => {
    const dials = buildDayDials(dialsInput());
    expect(dials.map((d) => d.key)).toEqual(['move', 'eat', 'recover']);
  });

  it('Bouger : un segment par séance, celle du jour pâle tant qu’elle n’est pas faite', () => {
    const move = buildDayDials(dialsInput())[0];
    expect(move).toEqual({
      key: 'move',
      done: 3,
      total: 5,
      restToday: false,
      segments: ['strength', 'running', 'strength', 'strength-soft', 'idle'],
    });
  });

  it('Bouger dit « repos aujourd’hui » un jour sans séance', () => {
    const sessions = dialsInput().weekSessions.filter((s) => s.dayKey !== TODAY);
    const move = buildDayDials(dialsInput({ weekSessions: sessions }))[0];
    expect(move).toMatchObject({ key: 'move', restToday: true });
  });

  it('Manger : kcal restantes, avancement de l’anneau et protéines', () => {
    const eat = buildDayDials(dialsInput()).find((d) => d.key === 'eat');
    expect(eat).toEqual({
      key: 'eat',
      consumed: 1320,
      target: 2650,
      remaining: 1330,
      progress: 1320 / 2650,
      proteinG: 80,
      proteinTarget: 140,
    });
  });

  it('Manger sans cible : un compte, jamais un reste calculé sur zéro', () => {
    const eat = buildDayDials(
      dialsInput({ nutrition: { consumed: 600, target: null, proteinG: 30, proteinTarget: null } }),
    ).find((d) => d.key === 'eat');
    expect(eat).toMatchObject({ remaining: null, progress: 0 });
  });

  it('Récupérer : le verdict en trois segments (charge, nutrition, bien-être)', () => {
    const recover = buildDayDials(dialsInput()).find((d) => d.key === 'recover');
    expect(recover).toEqual({
      key: 'recover',
      pending: false,
      verdict: 'push',
      segments: ['positive', 'neutral', 'idle'],
    });
  });

  it('le matin sans check-in : « ? », même si le verdict n’a pas encore de quoi se dire', () => {
    const recover = buildDayDials(
      dialsInput({
        checkinPending: true,
        readiness: { show: false, verdict: null, load: unavailable, nutrition: unavailable, wellbeing: unavailable },
      }),
    ).find((d) => d.key === 'recover');
    expect(recover).toMatchObject({ pending: true, verdict: null });
  });

  it('🔴 un cadran n’apparaît que si son pilier est actif (décision H)', () => {
    expect(buildDayDials(dialsInput({ pillars: ['strength'] })).map((d) => d.key)).toEqual(['move', 'recover']);
    expect(buildDayDials(dialsInput({ pillars: ['running', 'nutrition'] })).map((d) => d.key)).toEqual([
      'move',
      'eat',
      'recover',
    ]);
  });

  it('nutrition seule : Manger + Marcher (pas suivis), sans Récupérer', () => {
    const dials = buildDayDials(dialsInput({ pillars: ['nutrition'] }));
    expect(dials.map((d) => d.key)).toEqual(['eat', 'walk']);
    expect(dials[1]).toEqual({ key: 'walk', steps: 6240, goal: 8000, progress: 0.78 });
    expect(
      buildDayDials(dialsInput({ pillars: ['nutrition'], steps: { tracked: false, today: 0, goal: 8000 } })).map(
        (d) => d.key,
      ),
    ).toEqual(['eat']);
  });

  it('sans aucune séance de la semaine, pas de Bouger vide', () => {
    expect(buildDayDials(dialsInput({ weekSessions: [] })).map((d) => d.key)).toEqual(['eat', 'recover']);
  });
});

function stripInput(over: Partial<WeekStripInput> = {}): WeekStripInput {
  return {
    weekStartKey: MONDAY,
    todayKey: TODAY,
    pillars: ['strength', 'running', 'nutrition'],
    planned: [
      { dayKey: '2026-10-19', pillar: 'strength', done: true },
      { dayKey: '2026-10-20', pillar: 'running', done: true },
      { dayKey: '2026-10-22', pillar: 'strength', done: true },
      { dayKey: TODAY, pillar: 'strength', done: false },
      { dayKey: '2026-10-24', pillar: 'running', done: false },
    ],
    done: [
      { dayKey: '2026-10-19', pillar: 'strength' },
      { dayKey: '2026-10-20', pillar: 'running' },
      { dayKey: '2026-10-22', pillar: 'strength' },
    ],
    nutrition: [
      { dayKey: '2026-10-19', kcal: 2600, effectiveTarget: 2650 },
      { dayKey: '2026-10-20', kcal: 2500, effectiveTarget: 2650 },
      { dayKey: '2026-10-21', kcal: 1500, effectiveTarget: 2400 },
      { dayKey: '2026-10-22', kcal: 2700, effectiveTarget: 2650 },
    ],
    marginPct: 10,
    pausedDays: new Set(),
    ...over,
  };
}

describe('buildWeekStrip — Ta semaine', () => {
  it('sept colonnes du lundi au dimanche, aujourd’hui repéré', () => {
    const strip = buildWeekStrip(stripInput());
    expect(strip.days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(strip.days.map((d) => d.dayOfMonth)).toEqual([19, 20, 21, 22, 23, 24, 25]);
    expect(strip.days.find((d) => d.isToday)?.key).toBe(TODAY);
  });

  it('plein = fait, pointillé = prévu (aujourd’hui et après), rien pour un jour passé manqué', () => {
    const strip = buildWeekStrip(stripInput());
    const mark = (key: string) => strip.days.find((d) => d.key === key)!.marks;
    expect(mark('2026-10-19').strength).toBe('done');
    expect(mark(TODAY).strength).toBe('planned');
    expect(mark('2026-10-24').running).toBe('planned');
    // Prévu lundi, fait lundi : pas de reproche les autres jours.
    expect(mark('2026-10-21').strength).toBe('idle');
  });

  it('nutrition : dans la cible = plein, noté hors cible = pâle, aujourd’hui sans rien = pointillé', () => {
    const strip = buildWeekStrip(stripInput());
    const mark = (key: string) => strip.days.find((d) => d.key === key)!.marks.nutrition;
    expect(mark('2026-10-19')).toBe('done');
    expect(mark('2026-10-21')).toBe('logged');
    expect(mark(TODAY)).toBe('planned');
    expect(mark('2026-10-25')).toBe('idle');
  });

  it('le résumé : 3 séances sur 5 · 3 jours dans ta cible sur 4 notés', () => {
    const strip = buildWeekStrip(stripInput());
    expect(strip).toMatchObject({ sessionsDone: 3, sessionsTotal: 5, daysInTarget: 3, loggedDays: 4 });
  });

  it('une séance faite hors plan compte dans le total', () => {
    const strip = buildWeekStrip(
      stripInput({ done: [...stripInput().done, { dayKey: '2026-10-21', pillar: 'running' }] }),
    );
    expect(strip).toMatchObject({ sessionsDone: 4, sessionsTotal: 6 });
  });

  it('🔴 un pilier éteint n’a pas de pastille (décision H)', () => {
    const strip = buildWeekStrip(stripInput({ pillars: ['nutrition'] }));
    expect(Object.keys(strip.days[0]!.marks)).toEqual(['nutrition']);
    expect(strip).toMatchObject({ sessionsDone: 0, sessionsTotal: 0 });
  });

  it('les jours d’une période « vie réelle » sont repérés', () => {
    const strip = buildWeekStrip(stripInput({ pausedDays: new Set(['2026-10-20']) }));
    expect(strip.days[1]!.paused).toBe(true);
    expect(strip.days[0]!.paused).toBe(false);
  });
});

describe('selectHomeNews — Du nouveau', () => {
  it('deux cartes au plus, dans l’ordre de la table', () => {
    expect(HOME_NEWS_MAX).toBe(2);
    expect(selectHomeNews({ goal: true, record: true, lab: true })).toEqual(['record', 'lab']);
  });

  it('un conflit d’objectifs passe devant tout : il demande une décision', () => {
    expect(selectHomeNews({ goal: true, conflict: true, record: true })).toEqual(['conflict', 'record']);
  });

  it('rien à dire : rien du tout', () => {
    expect(selectHomeNews({})).toEqual([]);
  });

  it('un record se célèbre aujourd’hui et demain, pas au-delà', () => {
    expect(isFreshRecord(TODAY, TODAY)).toBe(true);
    expect(isFreshRecord('2026-10-22', TODAY)).toBe(true);
    expect(isFreshRecord('2026-10-21', TODAY)).toBe(false);
    expect(isFreshRecord(null, TODAY)).toBe(false);
  });
});
