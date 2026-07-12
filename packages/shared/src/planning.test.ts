import { describe, expect, it } from 'vitest';
import { generatePlannedSessions, isMissed, type PlanTemplateSession } from './planning';

const sessions: PlanTemplateSession[] = [
  { sessionId: 's-endurance', dayOfWeek: 0 }, // lundi
  { sessionId: 's-fractionne', dayOfWeek: 2 }, // mercredi
  { sessionId: 's-longue', dayOfWeek: 5 },    // samedi
];

describe('generatePlannedSessions', () => {
  it('génère durée × séances instances', () => {
    const out = generatePlannedSessions({ templateSessions: sessions, startDate: '2026-07-13', durationWeeks: 8 });
    expect(out).toHaveLength(24);
  });
  it('place chaque séance sur son jour, semaine 0', () => {
    const out = generatePlannedSessions({ templateSessions: sessions, startDate: '2026-07-13', durationWeeks: 1 });
    expect(out).toEqual([
      { sessionId: 's-endurance', scheduledDate: '2026-07-13', weekIndex: 0 },
      { sessionId: 's-fractionne', scheduledDate: '2026-07-15', weekIndex: 0 },
      { sessionId: 's-longue',    scheduledDate: '2026-07-18', weekIndex: 0 },
    ]);
  });
  it("aligne sur le lundi de la semaine de la date de début (start un mercredi)", () => {
    const out = generatePlannedSessions({ templateSessions: [sessions[0]!], startDate: '2026-07-15', durationWeeks: 1 });
    expect(out[0]!.scheduledDate).toBe('2026-07-13');
  });
  it('incrémente weekIndex et décale de 7 jours par semaine', () => {
    const out = generatePlannedSessions({ templateSessions: [sessions[0]!], startDate: '2026-07-13', durationWeeks: 3 });
    expect(out.map((o) => o.scheduledDate)).toEqual(['2026-07-13', '2026-07-20', '2026-07-27']);
    expect(out.map((o) => o.weekIndex)).toEqual([0, 1, 2]);
  });
});

describe('isMissed', () => {
  it('passée + planned = manquée', () => expect(isMissed('2026-07-10', 'planned', '2026-07-13')).toBe(true));
  it("aujourd'hui + planned ≠ manquée", () => expect(isMissed('2026-07-13', 'planned', '2026-07-13')).toBe(false));
  it('passée + done ≠ manquée', () => expect(isMissed('2026-07-10', 'done', '2026-07-13')).toBe(false));
  it('future + planned ≠ manquée', () => expect(isMissed('2026-07-20', 'planned', '2026-07-13')).toBe(false));
});
