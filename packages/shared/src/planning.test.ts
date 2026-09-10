import { describe, expect, it } from 'vitest';
import {
  countPlannedSessions,
  generatePlannedSessions,
  isMissed,
  planProgramInputSchema,
  type PlanTemplateSession,
} from './planning';

/** Répartition L / M / V, utilisée par les tests de démarrage en milieu de semaine. */
const lunMerVen: PlanTemplateSession[] = [
  { sessionId: 'a', dayOfWeek: 0 },
  { sessionId: 'b', dayOfWeek: 2 },
  { sessionId: 'c', dayOfWeek: 4 },
];

// ── US MUSCU-UX01 — première semaine partielle ────────────────────────────────────────────────
describe('generatePlannedSessions — démarrage en milieu de semaine', () => {
  it('ne génère pas les séances antérieures au jour de départ', () => {
    // Départ le mercredi 09/09/2026 : la séance du lundi 07 ne doit pas naître « manquée ».
    const out = generatePlannedSessions({
      templateSessions: lunMerVen,
      startDate: '2026-09-09',
      durationWeeks: 2,
    });
    expect(out.every((o) => o.scheduledDate >= '2026-09-09')).toBe(true);
    expect(out.some((o) => o.scheduledDate === '2026-09-07')).toBe(false);
  });

  it('rend la première semaine partielle et les suivantes pleines', () => {
    const out = generatePlannedSessions({
      templateSessions: lunMerVen,
      startDate: '2026-09-09',
      durationWeeks: 2,
    });
    expect(out.filter((o) => o.weekIndex === 0)).toHaveLength(2); // mercredi + vendredi
    expect(out.filter((o) => o.weekIndex === 1)).toHaveLength(3); // semaine pleine
  });

  it('garde `weekIndex` calé sur la semaine calendaire', () => {
    // MUSC-F15 compare l'adhérence d'une semaine à la précédente : décaler l'index la fausserait.
    const out = generatePlannedSessions({
      templateSessions: lunMerVen,
      startDate: '2026-09-09',
      durationWeeks: 2,
    });
    expect(out.filter((o) => o.weekIndex === 1).map((o) => o.scheduledDate)).toEqual([
      '2026-09-14',
      '2026-09-16',
      '2026-09-18',
    ]);
  });

  it('ne change rien quand le départ est un lundi — non-régression course', () => {
    // Côté course, `startDate` reste toujours un lundi : le filtre ne doit rien retirer.
    const out = generatePlannedSessions({
      templateSessions: lunMerVen,
      startDate: '2026-09-07',
      durationWeeks: 3,
    });
    expect(out).toHaveLength(9);
  });

  it('génère la séance du jour même quand on démarre dessus', () => {
    // Le cas qui motive l'US : « je commence aujourd'hui » doit produire une séance aujourd'hui,
    // pas la semaine prochaine.
    const out = generatePlannedSessions({
      templateSessions: lunMerVen,
      startDate: '2026-09-09',
      durationWeeks: 1,
    });
    expect(out[0]?.scheduledDate).toBe('2026-09-09');
  });
});

describe('countPlannedSessions', () => {
  it('compte la première semaine partielle', () => {
    // Le bouton annonçait `séances × semaines` — faux dès qu'on démarre en milieu de semaine.
    expect(
      countPlannedSessions({
        templateSessions: lunMerVen,
        startDate: '2026-09-09',
        durationWeeks: 2,
      }),
    ).toBe(5);
  });

  it('retombe sur le produit simple quand on démarre un lundi', () => {
    expect(
      countPlannedSessions({
        templateSessions: lunMerVen,
        startDate: '2026-09-07',
        durationWeeks: 4,
      }),
    ).toBe(12);
  });
});

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
  it("reste aligné sur le lundi, mais sans générer avant la date de début (start un mercredi)", () => {
    // ── Comportement modifié par l'US MUSCU-UX01 ────────────────────────────────────────────
    // Avant : un départ le mercredi 15 générait quand même la séance du lundi 13, donc une
    // occurrence **née manquée**. Inoffensif tant que l'assistant imposait de démarrer un lundi ;
    // inacceptable dès qu'on peut démarrer aujourd'hui.
    // L'alignement au lundi n'a pas changé — c'est toujours lui qui fixe la grille et `weekIndex`,
    // comme le montre la semaine 1 ci-dessous. Seule la première semaine est tronquée.
    const out = generatePlannedSessions({
      templateSessions: [sessions[0]!],
      startDate: '2026-07-15',
      durationWeeks: 2,
    });
    expect(out.map((o) => o.scheduledDate)).toEqual(['2026-07-20']);
    expect(out[0]!.weekIndex).toBe(1);
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

describe('planProgramInputSchema', () => {
  const valid = {
    startDate: '2026-07-13',
    durationWeeks: 8,
    dayAssignments: { 's-endurance': 0, 's-longue': 6 },
  };

  it('accepte une entrée valide', () => {
    expect(planProgramInputSchema.parse(valid)).toEqual(valid);
  });
  it('rejette une durée de 0', () => {
    expect(() => planProgramInputSchema.parse({ ...valid, durationWeeks: 0 })).toThrow();
  });
  it('rejette une durée négative', () => {
    expect(() => planProgramInputSchema.parse({ ...valid, durationWeeks: -3 })).toThrow();
  });
  it('rejette une durée non entière', () => {
    expect(() => planProgramInputSchema.parse({ ...valid, durationWeeks: 2.5 })).toThrow();
  });
  it('rejette une durée NaN', () => {
    expect(() => planProgramInputSchema.parse({ ...valid, durationWeeks: NaN })).toThrow();
  });
  it('rejette une date au mauvais format', () => {
    expect(() => planProgramInputSchema.parse({ ...valid, startDate: '13/07/2026' })).toThrow();
  });
  it('rejette un jour affecté hors [0..6]', () => {
    expect(() =>
      planProgramInputSchema.parse({ ...valid, dayAssignments: { 's-1': 7 } }),
    ).toThrow();
  });
});
