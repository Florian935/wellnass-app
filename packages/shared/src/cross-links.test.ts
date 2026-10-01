import { describe, expect, it } from 'vitest';

import {
  CROSS_LINK_IDS,
  CROSS_LINK_MIN_PROTEIN_DAYS,
  CROSS_LINK_STATES,
  CROSS_LINKS,
  buildCrossLinkSeries,
  buildCrossLinks,
  crossLinkHistory,
  crossLinkWeekKey,
  crossLinkWeekWrites,
  crossLinkWindows,
  dotsEightWeekDelta,
  echoFor,
  learningAssociations,
  pressingLink,
  stableUuid,
  summarizeCrossLinks,
  zoneState,
  SUSPECT_LINK,
  type CrossLink,
  type CrossLinkSeries,
  type CrossLinksInput,
} from './cross-links';
import { LAB_MIN_PROTEIN_DAYS, buildLabWeek, type LabWeekInput } from './lab-week';
import { MIN_LOGGED_DAYS } from './bodyweight';
import { dotsScore } from './strength-dots';
import type { LabKnowledgeCard } from './lab-experiments';
import type { LabQuestion } from './lab-investigations';
import type { SessionConflict } from './session-conflicts';
import type { WellbeingLink } from './wellbeing-links';

// Semaine du lundi 21 au dimanche 27 septembre 2026 ; aujourd'hui, jeudi 24.
const MON = '2026-09-21';
const TODAY = '2026-09-24';
const FRI = '2026-09-25';
const SAT = '2026-09-26';

function weekInput(over: Partial<LabWeekInput> = {}): LabWeekInput {
  return {
    weekStartKey: MON,
    todayKey: TODAY,
    activePillars: ['strength', 'running', 'nutrition'],
    sessions: [],
    runs: [],
    proteinByDay: [],
    weightKg: 72.4,
    proteinTarget: { min: 1.6, max: 2.2 },
    nights: [],
    conflicts: [],
    overtraining: { show: false, severity: null, streakDays: 0 },
    acwr: null,
    deficitVolume: { show: false, deficitPct: 0, loggedDays: 0 },
    carbs: null,
    ...over,
  };
}

const eight = <T,>(v: T): T[] => Array.from({ length: 8 }, () => v);

function series(over: Partial<CrossLinkSeries> = {}): CrossLinkSeries {
  return {
    weeks: crossLinkWindows(TODAY).map((w) => w.from),
    proteinGPerKg: [1.8, 1.8, 1.7, 1.7, 1.6, 1.5, 1.4, 1.4],
    mainLift: { name: 'Squat', values: [108, 111, 113, 116, 119, 120, 120, 120] },
    acwr: [0.95, 1.02, 1.08, 1.1, 1.05, 1.12, 1.15, 1.12],
    weightKg: [72.9, 72.8, 72.7, 72.7, 72.6, 72.5, 72.4, 72.4],
    sbdTotal: eight(null),
    activeDays: { strength: eight(3), running: eight(3), nutrition: eight(6) },
    legsPace: { exposed: [252, 249, 255, 250, 253, 247], other: [246, 248, 244, 249, 247, 245, 250, 246, 248] },
    carbsByDayType: { hard: 3.2, easy: 3.4, hardDays: 4, easyDays: 10 },
    ...over,
  };
}

function input(over: Partial<CrossLinksInput> = {}, week: Partial<LabWeekInput> = {}): CrossLinksInput {
  const activePillars = over.activePillars ?? week.activePillars ?? ['strength', 'running', 'nutrition'];
  return {
    todayKey: TODAY,
    activePillars,
    cycleTrackingEnabled: false,
    inRealLifePeriod: false,
    week: buildLabWeek(weekInput({ activePillars, ...week })),
    knowledge: [],
    questions: [],
    acwr: { ratio: 1.12, zone: 'safe', showAlert: false },
    overtraining: { show: false, severity: null, streakDays: 3 },
    deficitVolume: { show: false, deficitPct: 0, loggedDays: 5 },
    interference: { show: false, direction: null, runRatio: 1.05, strengthRatio: 0.98 },
    protein: { gPerKg: 1.8, target: { min: 1.6, max: 2.2 }, status: 'in', loggedDays: 5 },
    carbs: { gPerKg: 5.4, target: { min: 5, max: 7 }, status: 'in' },
    activityLevel: { show: false },
    apport: { energy: null, adherence: null, lowFuelDays: 0, distribution: null },
    trainingTime: { strengthSeconds: 7800, runningSeconds: 9600 },
    readiness: null,
    goalConflicts: [],
    rhythm: { streakDays: 12, lastWeekActiveDays: 6, lastWeekDone: 5, lastWeekPlanned: 6 },
    weight: { latestKg: 72.4, kgPerWeek: -0.1, weighIns: 8, loggedDays7: 5 },
    strength: { dots: 318, dotsDelta: 6, sbdTotal: 372 },
    cycle: null,
    series: series(),
    ...over,
  };
}

const conflict = (over: Partial<SessionConflict> = {}): SessionConflict => ({
  runSessionId: 'long',
  runDayKey: SAT,
  runType: 'sortie_longue',
  strengthSessionId: 'legs',
  strengthDayKey: FRI,
  legSets: 22,
  suggestedDayKey: '2026-09-27',
  ...over,
});

const byId = (links: CrossLink[], id: CrossLink['id']) => links.find((l) => l.id === id)!;

describe('le registre', () => {
  it('déclare chaque lien une fois, dans l’ordre des questions', () => {
    expect(new Set(CROSS_LINK_IDS).size).toBe(CROSS_LINK_IDS.length);
    expect(Object.keys(CROSS_LINKS).sort()).toEqual([...CROSS_LINK_IDS].sort());
  });

  it('range les quatre états, garde-fou en tête', () => {
    expect(CROSS_LINK_STATES).toEqual(['guard', 'adjust', 'holds', 'discover']);
  });

  it('juge les protéines avec le même seuil que le verdict nutrition et le Labo', () => {
    // LIENS-01 : une question, un seuil. Avant, 2 jours au Labo, 4 ailleurs.
    expect(CROSS_LINK_MIN_PROTEIN_DAYS).toBe(MIN_LOGGED_DAYS);
    expect(LAB_MIN_PROTEIN_DAYS).toBe(MIN_LOGGED_DAYS);
  });

  it('place les liens à deux piliers à l’intersection de leurs disques, le reste au centre', () => {
    expect(CROSS_LINKS.sports.zone).toBe('mc');
    expect(CROSS_LINKS.fuelStrength.zone).toBe('mn');
    expect(CROSS_LINKS.fuelRunning.zone).toBe('cn');
    for (const id of ['recovery', 'weight', 'goals', 'rhythm', 'strengthWeight', 'cycle'] as const) {
      expect(CROSS_LINKS[id].zone).toBe('centre');
    }
  });
});

describe('décision H — seuls les piliers activés', () => {
  it('trois piliers : huit liens, sans le cycle', () => {
    expect(buildCrossLinks(input()).map((l) => l.id).sort()).toEqual(
      ['fuelRunning', 'fuelStrength', 'goals', 'recovery', 'rhythm', 'sports', 'strengthWeight', 'weight'].sort(),
    );
  });

  it('muscu + course : pas de lien qui passe par l’assiette', () => {
    const ids = buildCrossLinks(input({ activePillars: ['strength', 'running'] })).map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(['sports', 'recovery', 'goals', 'rhythm', 'strengthWeight']));
    expect(ids).not.toContain('fuelStrength');
    expect(ids).not.toContain('fuelRunning');
    expect(ids).not.toContain('weight');
  });

  it('muscu seule : la récupération et la force relative, rien d’autre', () => {
    expect(buildCrossLinks(input({ activePillars: ['strength'] })).map((l) => l.id).sort()).toEqual(['recovery', 'strengthWeight']);
  });

  it('le cycle n’apparaît que si son suivi est activé (Q7)', () => {
    expect(buildCrossLinks(input({ cycleTrackingEnabled: true })).map((l) => l.id)).toContain('cycle');
    expect(buildCrossLinks(input()).map((l) => l.id)).not.toContain('cycle');
  });
});

describe('les états', () => {
  it('semaine chargée : collision, protéines basses, glucides bas avant une séance dure', () => {
    const links = buildCrossLinks(
      input(
        {
          protein: { gPerKg: 1.4, target: { min: 1.6, max: 2.2 }, status: 'low', loggedDays: 4 },
          carbs: { gPerKg: 3.2, target: { min: 5, max: 7 }, status: 'low' },
        },
        {
          conflicts: [conflict()],
          sessions: [{ id: 'long', dayKey: SAT, pillar: 'running', status: 'planned', name: null, sessionType: 'sortie_longue', targetDistanceM: 16000 }],
          carbs: { gPerKg: 3.2, target: { min: 5, max: 7 }, status: 'low' },
          proteinByDay: [MON, '2026-09-22', '2026-09-23', TODAY].map((dayKey) => ({ dayKey, proteinG: 101 })),
        },
      ),
    );
    expect(byId(links, 'sports').state).toBe('adjust');
    expect(byId(links, 'sports').actions[0]).toMatchObject({ type: 'proposal', proposal: { kind: 'collision' } });
    expect(byId(links, 'fuelStrength').state).toBe('adjust');
    expect(byId(links, 'fuelRunning').state).toBe('adjust');
    expect(byId(links, 'recovery').state).toBe('holds');
    // Rangés : ce qui est à régler d'abord, dans l'ordre du registre.
    expect(links.slice(0, 3).map((l) => l.id)).toEqual(['sports', 'fuelStrength', 'fuelRunning']);
  });

  it('un garde-fou de charge passe devant tout, et garde son geste', () => {
    const links = buildCrossLinks(
      input(
        { acwr: { ratio: 1.42, zone: 'risk', showAlert: true } },
        { acwr: { ratio: 1.42, zone: 'risk', showAlert: true } },
      ),
    );
    expect(links[0]).toMatchObject({ id: 'recovery', state: 'guard' });
    expect(links[0]!.verdict).toMatchObject({ key: 'loadRisk', values: { ratio: 1.42 } });
    expect(links[0]!.actions[0]).toMatchObject({ type: 'proposal', proposal: { kind: 'loadRisk' } });
  });

  it('déficit avec gros volume : garde-fou sur Muscu × Nutrition, muet en période « vie réelle »', () => {
    const deficit = { show: true, deficitPct: 18, loggedDays: 5 };
    expect(byId(buildCrossLinks(input({ deficitVolume: deficit }, { deficitVolume: deficit })), 'fuelStrength').state).toBe('guard');
    expect(byId(buildCrossLinks(input({ deficitVolume: deficit, inRealLifePeriod: true }, { deficitVolume: deficit })), 'fuelStrength').state).not.toBe('guard');
  });

  it('niveau d’activité à revoir (RN-03) : à régler sur Course × Nutrition, muet en « vie réelle »', () => {
    const level = { show: true as const, suggested: 'active', runningDays: 9 };
    expect(byId(buildCrossLinks(input({ activityLevel: level })), 'fuelRunning')).toMatchObject({ state: 'adjust', verdict: { key: 'activityLevel' } });
    expect(byId(buildCrossLinks(input({ activityLevel: level, inRealLifePeriod: true })), 'fuelRunning').state).toBe('holds');
  });

  it('tout tient : aucun lien à régler', () => {
    const summary = summarizeCrossLinks(buildCrossLinks(input()));
    expect(summary.guard + summary.adjust).toBe(0);
    expect(summary.total).toBe(8);
  });

  it('une contradiction d’objectifs ouvre le Conseil des trois', () => {
    const conflictGoal = { rule: 'bulkVsCut' as const, left: 'goal.muscle', right: 'nutrition.cut' };
    const goals = byId(buildCrossLinks(input({ goalConflicts: [conflictGoal] })), 'goals');
    expect(goals.state).toBe('adjust');
    expect(goals.actions).toEqual([{ type: 'council', conflict: conflictGoal }]);
  });

  it('un plateau de poids ne propose jamais de restreindre : il propose de compléter le journal', () => {
    const plateau = { kind: 'weightPlateau', values: {} } as unknown as LabQuestion;
    const weight = byId(buildCrossLinks(input({ questions: [plateau] })), 'weight');
    expect(weight.state).toBe('adjust');
    expect(weight.actions[0]).toEqual({ type: 'open', route: 'nutritionHistory' });
  });
});

describe('à découvrir — jamais un zéro à la place d’un trou', () => {
  it('compte neuf : il dit ce qui manque, et combien', () => {
    const links = buildCrossLinks(
      input({
        protein: null,
        carbs: null,
        acwr: null,
        overtraining: { show: false, severity: null, streakDays: 0 },
        rhythm: { streakDays: 0, lastWeekActiveDays: null, lastWeekDone: null, lastWeekPlanned: null },
        weight: { latestKg: null, kgPerWeek: null, weighIns: 0, loggedDays7: 1 },
        strength: { dots: null, dotsDelta: null, sbdTotal: null },
        series: series({ activeDays: { strength: [0, 0, 0, 0, 0, 0, 0, 1], running: [0, 0, 0, 0, 0, 0, 0, 1], nutrition: [0, 0, 0, 0, 0, 0, 0, 1] } }),
      }),
    );
    for (const id of ['sports', 'fuelStrength', 'fuelRunning', 'recovery', 'weight', 'rhythm', 'strengthWeight'] as const) {
      const link = byId(links, id);
      expect(link.state).toBe('discover');
      expect(link.missing).not.toBeNull();
      expect(link.figures).toEqual([]);
      expect(link.chart).toBeNull();
    }
    // Les objectifs se lisent dès l'inscription.
    expect(byId(links, 'goals').state).toBe('holds');
  });

  it('protéines : sous le seuil de jours saisis, pas de verdict', () => {
    const fuel = byId(buildCrossLinks(input({ protein: { gPerKg: 1.2, target: { min: 1.6, max: 2.2 }, status: 'low', loggedDays: 3 } })), 'fuelStrength');
    expect(fuel.state).toBe('discover');
    expect(fuel.missing).toMatchObject({ key: 'proteinDays', have: 3, need: 4 });
  });

  it('les associations en apprentissage vont dans « à découvrir »', () => {
    const cards: LabKnowledgeCard[] = [
      { id: 'association:shortNightPace', source: 'association', kind: 'shortNightPace', status: 'learning', pair: ['sleep', 'running'], values: { cases: 2, needed: 3 }, usedBy: 'shortNight' },
      { id: 'association:heavyLegsPace', source: 'association', kind: 'heavyLegsPace', status: 'solid', pair: ['strength', 'running'], values: { delta: 4, exposed: 6, other: 9 }, usedBy: 'collision' },
    ];
    expect(learningAssociations(cards).map((c) => c.kind)).toEqual(['shortNightPace']);
  });
});

describe('graphiques', () => {
  it('deux mesures d’échelles différentes : deux panneaux, jamais un double axe', () => {
    const fuel = byId(buildCrossLinks(input()), 'fuelStrength');
    expect(fuel.chart).toMatchObject({ type: 'pair', band: [1.6, 2.2], lift: { name: 'Squat' } });
  });

  it('pas assez de points : pas de graphique', () => {
    const fuel = byId(buildCrossLinks(input({ series: series({ proteinGPerKg: [null, null, null, null, null, null, 1.5, 1.4] }) })), 'fuelStrength');
    expect(fuel.chart).toBeNull();
  });
});

/** Une semaine chargée : une collision et des protéines basses. */
const busy = () =>
  buildCrossLinks(
    input(
      { protein: { gPerKg: 1.4, target: { min: 1.6, max: 2.2 }, status: 'low', loggedDays: 4 } },
      { conflicts: [conflict()] },
    ),
  );

describe('carte, échos et accueil', () => {

  it('une zone prend l’état du pire lien qui s’y trouve', () => {
    const links = busy();
    expect(zoneState(links, 'mc')).toBe('adjust');
    expect(zoneState(links, 'centre')).toBe('holds');
    expect(zoneState(buildCrossLinks(input({ activePillars: ['strength'] })), 'mn')).toBeNull();
  });

  it('un pilier ne fait écho qu’à un lien qui le concerne et qui demande quelque chose', () => {
    const links = busy();
    expect(echoFor(links, 'planning')?.id).toBe('sports');
    expect(echoFor(links, 'nutritionToday')?.id).toBe('fuelStrength');
    expect(echoFor(links, 'cycle')).toBeNull();
    expect(echoFor(buildCrossLinks(input()), 'planning')).toBeNull();
  });

  it('l’accueil met en avant le lien le plus pressant, rien s’il n’y a rien à régler', () => {
    expect(pressingLink(busy())?.id).toBe('sports');
    expect(pressingLink(buildCrossLinks(input()))).toBeNull();
  });
});

describe('l’histoire d’un lien — figée chaque semaine (Q5)', () => {
  it('la semaine d’un jour commence le lundi', () => {
    expect(crossLinkWeekKey(TODAY)).toBe(MON);
    expect(crossLinkWeekKey(MON)).toBe(MON);
  });

  it('rend huit semaines, trous compris', () => {
    const history = crossLinkHistory(
      [
        { id: 'a', linkId: 'sports', weekStart: MON, state: 'adjust' },
        { id: 'b', linkId: 'sports', weekStart: '2026-09-14', state: 'holds' },
        { id: 'c', linkId: 'fuelStrength', weekStart: MON, state: 'guard' },
      ],
      'sports',
      TODAY,
    );
    expect(history).toEqual([null, null, null, null, null, null, 'holds', 'adjust']);
  });

  it('n’écrit que la semaine en cours, et seulement ce qui a changé', () => {
    const links = busy();
    const writes = crossLinkWeekWrites(links, [{ id: 'x', linkId: 'recovery', weekStart: MON, state: 'holds' }], TODAY, 'user-1');
    expect(writes.every((w) => w.weekStart === MON)).toBe(true);
    expect(writes.map((w) => w.linkId)).not.toContain('recovery');
    expect(writes.map((w) => w.linkId)).toContain('sports');
  });

  it('deux appareils figent la même semaine d’un lien sous le même identifiant', () => {
    const a = crossLinkWeekWrites(busy(), [], TODAY, 'user-1');
    const b = crossLinkWeekWrites(busy(), [], TODAY, 'user-1');
    expect(a.map((w) => w.id)).toEqual(b.map((w) => w.id));
    expect(crossLinkWeekWrites(busy(), [], TODAY, 'user-2')[0]!.id).not.toBe(a[0]!.id);
  });
});

describe('les enquêtes mènent aux fiches', () => {
  it('chaque suspect a une fiche, et elle existe', () => {
    for (const link of Object.values(SUSPECT_LINK)) expect(CROSS_LINK_IDS as readonly string[]).toContain(link);
  });
});

describe('stableUuid', () => {
  it('est un UUID valide, déterministe, de version 8', () => {
    const id = stableUuid('user-1|2026-09-21|sports');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(stableUuid('user-1|2026-09-21|sports')).toBe(id);
    expect(stableUuid('user-1|2026-09-21|recovery')).not.toBe(id);
  });
});

describe('les séries des graphiques', () => {
  it('huit fenêtres de 7 jours finissant aujourd’hui', () => {
    const w = crossLinkWindows(TODAY);
    expect(w).toHaveLength(8);
    expect(w[7]).toEqual({ from: '2026-09-18', to: TODAY });
    expect(w[0]).toEqual({ from: '2026-07-31', to: '2026-08-06' });
  });

  it('calcule protéines par kilo, poids, jours actifs, allures et glucides par type de jour', () => {
    const s = buildCrossLinkSeries({
      todayKey: TODAY,
      activePillars: ['strength', 'running', 'nutrition'],
      weightKg: 72,
      nutritionDays: [
        { dayKey: '2026-09-22', proteinG: 144, carbsG: 216 },
        { dayKey: '2026-09-23', proteinG: 72, carbsG: 360 },
      ],
      weights: [{ dayKey: '2026-09-20', weightKg: 72.4 }, { dayKey: '2026-09-23', weightKg: 72.2 }],
      lifts: [{ name: 'Squat', weeks: [null, null, null, null, null, 118, 120, 120] }],
      loadSessions: [],
      qualityRuns: [{ dayKey: '2026-09-23', paceSPerKm: 252 }, { dayKey: '2026-09-15', paceSPerKm: 246 }],
      heavyLegDays: ['2026-09-22'],
      runDays: [{ dayKey: '2026-09-23', hard: true }],
      strengthDays: ['2026-09-22'],
    });
    expect(s.proteinGPerKg[7]).toBe(1.5);
    expect(s.weightKg[7]).toBe(72.3);
    expect(s.activeDays.strength[7]).toBe(1);
    expect(s.activeDays.running[7]).toBe(1);
    expect(s.legsPace).toEqual({ exposed: [252], other: [246] });
    expect(s.carbsByDayType).toEqual({ hard: 5, easy: 3, hardDays: 1, easyDays: 1 });
    expect(s.mainLift).toEqual({ name: 'Squat', values: [null, null, null, null, null, 118, 120, 120] });
    // Le ratio de charge : rien sans séances.
    expect(s.acwr.every((v) => v === null)).toBe(true);
  });

  it('n’invente pas de jours actifs pour un pilier désactivé', () => {
    const s = buildCrossLinkSeries({
      todayKey: TODAY,
      activePillars: ['strength'],
      weightKg: null,
      nutritionDays: [{ dayKey: TODAY, proteinG: 100, carbsG: 200 }],
      weights: [],
      lifts: [],
      loadSessions: [],
      qualityRuns: [],
      heavyLegDays: [],
      runDays: [],
      strengthDays: [],
    });
    expect(s.activeDays.nutrition.every((v) => v === null)).toBe(true);
    expect(s.proteinGPerKg.every((v) => v === null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Revue du 30/09/2026 — ce que la revue de code a trouvé, figé par un test
// ---------------------------------------------------------------------------

describe('revue du 30/09/2026', () => {
  it('🔴 une semaine chargée garde sa proposition « glucides » : le registre lit la liste ENTIÈRE', () => {
    const intense = { id: 'q', dayKey: TODAY, pillar: 'running' as const, status: 'planned' as const, name: 'VMA', sessionType: 'fractionne' as const, targetDistanceM: 8000 };
    const hardSat = { id: 'long', dayKey: SAT, pillar: 'running' as const, status: 'planned' as const, name: null, sessionType: 'sortie_longue' as const, targetDistanceM: 16000 };
    const low = { gPerKg: 3.2, target: { min: 5, max: 7 }, status: 'low' as const };
    const week: Partial<LabWeekInput> = {
      sessions: [intense, hardSat],
      conflicts: [conflict(), conflict({ runSessionId: 'long2', runDayKey: '2026-09-27', strengthSessionId: 'legs2', strengthDayKey: SAT, suggestedDayKey: null })],
      nights: [{ dayKey: TODAY, sleepMinutes: 300 }],
      acwr: { ratio: 1.45, zone: 'risk', showAlert: true },
      overtraining: { show: true, severity: 'streak', streakDays: 9 },
      carbs: low,
      proteinByDay: [MON, '2026-09-22', '2026-09-23', TODAY].map((dayKey) => ({ dayKey, proteinG: 90 })),
    };
    const built = buildLabWeek(weekInput(week));
    // L'affichage reste plafonné ; la liste entière, elle, contient les glucides.
    expect(built.proposals.length).toBeLessThanOrEqual(5);
    expect(built.allProposals.length).toBeGreaterThan(built.proposals.length);
    expect(built.proposals.map((p) => p.kind)).not.toContain('carbs');
    expect(built.allProposals.map((p) => p.kind)).toContain('carbs');

    const fuel = byId(buildCrossLinks(input({ carbs: low, acwr: { ratio: 1.45, zone: 'risk', showAlert: true } }, week)), 'fuelRunning');
    // Tronquée, la proposition manquait et le lien affirmait « il ne reste rien de dur cette semaine ».
    expect(fuel.state).toBe('adjust');
    expect(fuel.verdict.key).not.toBe('holdsLowEasyWeek');
  });

  it('🔴 la forme du jour « repos conseillé » demande quelque chose sur « Récupères-tu assez ? »', () => {
    const readiness = { show: true, verdict: 'rest', negativeCount: 2, availableCount: 3 } as unknown as CrossLinksInput['readiness'];
    const recovery = byId(buildCrossLinks(input({ readiness })), 'recovery');
    expect(recovery.state).toBe('adjust');
    expect(recovery.verdict).toEqual({ key: 'readinessRest', values: { negative: 2, available: 3 } });
    expect(recovery.actions).toEqual([{ type: 'open', route: 'planning' }, { type: 'open', route: 'checkin' }]);
    // Une forme correcte ne demande rien.
    const ok = { show: true, verdict: 'ok', negativeCount: 0, availableCount: 3 } as unknown as CrossLinksInput['readiness'];
    expect(byId(buildCrossLinks(input({ readiness: ok })), 'recovery').state).toBe('holds');
  });

  it('🔴 sans record d’il y a huit semaines, l’écart DOTS est un trou, pas « 0 »', () => {
    const link = byId(buildCrossLinks(input({ strength: { dots: 312, dotsDelta: null, sbdTotal: 360 } })), 'strengthWeight');
    expect(link.verdict).toEqual({ key: 'holdsNoDelta', values: { score: 312 } });
    expect(link.figures[0]).toEqual({ key: 'dotsNoDelta', values: { score: 312 } });
    expect(link.rows[0]).toMatchObject({ key: 'dotsNoDelta', state: null });
    expect(JSON.stringify(link)).not.toContain('"delta"');
  });

  it('un seul ratio d’interférence connu : pas de « tes deux sports évoluent ensemble »', () => {
    const sports = byId(buildCrossLinks(input({ interference: { show: false, direction: null, runRatio: 1.05, strengthRatio: null } })), 'sports');
    expect(sports.rows.map((r) => r.key)).not.toContain('interferenceNone');
  });

  it('zéro minute d’entraînement n’est pas une mesure : pas de ligne « 0 + 0 min »', () => {
    const sports = byId(buildCrossLinks(input({ trainingTime: { strengthSeconds: 0, runningSeconds: 0 } })), 'sports');
    expect(sports.rows.map((r) => r.key)).not.toContain('trainingTime');
    expect(sports.figures.map((f) => f.key)).not.toContain('trainingTime');
  });

  it('🔴 le garde-fou de surentraînement fait écho dans le hub muscu, même sans la course', () => {
    const guard = { show: true, severity: 'streak' as const, streakDays: 9 };
    const links = buildCrossLinks(input({ activePillars: ['strength'], overtraining: guard }, { overtraining: guard }));
    expect(byId(links, 'recovery').state).toBe('guard');
    expect(echoFor(links, 'strengthProgress')?.id).toBe('recovery');
  });

  it('sans ratio de charge (un seul sport), « Récupères-tu assez ? » ne prétend pas « charge saine »', () => {
    const recovery = byId(buildCrossLinks(input({ activePillars: ['running'], acwr: null })), 'recovery');
    expect(recovery.short.key).toBe('holdsNoLoad');
    const nights = byId(
      buildCrossLinks(input({ activePillars: ['running'], acwr: null }, { nights: [MON, '2026-09-22', '2026-09-23'].map((dayKey) => ({ dayKey, sleepMinutes: 320 })) })),
      'recovery',
    );
    expect(nights.short.key).toBe('shortNightsNoLoad');
  });

  it('un lien qui ne peut jamais être « à régler » ne déclare aucun écho', () => {
    // Sinon la fiche dirait « tu le retrouves aussi dans… » un écran où il n'apparaîtra jamais.
    expect(CROSS_LINKS.strengthWeight.echoes).toEqual([]);
  });

  describe('🔴 écriture de l’histoire déclenchée par un changement LOCAL (pas de ping-pong entre appareils)', () => {
    const tient = () => buildCrossLinks(input());
    const stored = (state: 'adjust' | 'holds') => [{ id: 'x', linkId: 'goals', weekStart: MON, state }];
    const goalsWrite = (writes: { linkId: string }[]) => writes.filter((w) => w.linkId === 'goals');

    it('premier passage de la session : une ligne qui diffère est réécrite', () => {
      expect(goalsWrite(crossLinkWeekWrites(tient(), stored('adjust'), TODAY, 'user-1'))).toHaveLength(1);
    });

    it('la ligne a changé AILLEURS (le calcul local, lui, n’a pas bougé) : on ne réécrit pas', () => {
      // L'autre appareil a écrit « à régler » ; celui-ci calcule toujours « ça tient », comme avant.
      const previous = new Map([['goals', 'holds']] as const);
      expect(goalsWrite(crossLinkWeekWrites(tient(), stored('adjust'), TODAY, 'user-1', previous))).toHaveLength(0);
    });

    it('le calcul local a changé : on écrit', () => {
      const previous = new Map([['goals', 'adjust']] as const);
      expect(goalsWrite(crossLinkWeekWrites(tient(), stored('adjust'), TODAY, 'user-1', previous))).toHaveLength(1);
    });

    it('une semaine sans ligne s’écrit toujours', () => {
      const previous = new Map([['goals', 'holds']] as const);
      expect(goalsWrite(crossLinkWeekWrites(tient(), [], TODAY, 'user-1', previous))).toHaveLength(1);
    });
  });
});

describe('dotsEightWeekDelta — l’écart DOTS porte vraiment sur huit semaines (revue du 30/09/2026)', () => {
  // Aujourd'hui 24/09 : la fenêtre du record passé va du 16/07 (J−70) au 30/07 (J−56).
  const now = dotsScore(372, 72, 'male')!;

  it('record d’il y a 9 semaines et pesée de ce jour-là : l’écart se calcule au poids d’alors', () => {
    const delta = dotsEightWeekDelta({
      todayKey: TODAY,
      dotsNow: now,
      history: [{ date: '2026-07-23', totalKg: 372 }],
      weights: [{ dayKey: '2026-07-25', weightKg: 77 }, { dayKey: TODAY, weightKg: 72 }],
      sex: 'male',
    });
    // Même total, 5 kg de moins : la force relative a MONTÉ. Au poids d'aujourd'hui, on lisait « 0 ».
    expect(delta).not.toBeNull();
    expect(delta!).toBeGreaterThan(0);
    expect(delta!).toBeCloseTo(now - dotsScore(372, 77, 'male')!, 6);
  });

  it('🔴 un record trop ancien (4 mois) ne se fait pas passer pour « il y a huit semaines »', () => {
    expect(
      dotsEightWeekDelta({ todayKey: TODAY, dotsNow: now, history: [{ date: '2026-05-20', totalKg: 340 }], weights: [{ dayKey: '2026-05-21', weightKg: 74 }], sex: 'male' }),
    ).toBeNull();
  });

  it('🔴 sans pesée à quinze jours près du record, c’est un trou — pas un calcul au poids d’aujourd’hui', () => {
    expect(
      dotsEightWeekDelta({ todayKey: TODAY, dotsNow: now, history: [{ date: '2026-07-23', totalKg: 360 }], weights: [{ dayKey: TODAY, weightKg: 72 }], sex: 'male' }),
    ).toBeNull();
  });

  it('sans score aujourd’hui, rien', () => {
    expect(dotsEightWeekDelta({ todayKey: TODAY, dotsNow: null, history: [], weights: [], sex: 'male' })).toBeNull();
  });
});

describe('US BIEN-05 — le lien « Ton état du jour pèse-t-il sur tes séances ? »', () => {
  const link = (over: Partial<WellbeingLink>): WellbeingLink => ({
    id: 'nightStrength',
    scope: 'cross',
    unit: 'pct',
    pillars: ['strength'],
    status: 'learning',
    delta: null,
    exposed: 3,
    other: 10,
    need: 8,
    adverse: null,
    ...over,
  });

  it('n’existe que si le pilier Bien-être est activé, et qu’un pilier a de quoi croiser', () => {
    expect(buildCrossLinks(input()).map((l) => l.id)).not.toContain('wellbeing');
    expect(buildCrossLinks(input({ wellbeingEnabled: true })).map((l) => l.id)).toContain('wellbeing');
    expect(buildCrossLinks(input({ wellbeingEnabled: true, activePillars: [] })).map((l) => l.id)).not.toContain('wellbeing');
    expect(CROSS_LINKS.wellbeing.zone).toBe('centre');
    expect(CROSS_LINKS.wellbeing.echoes).toEqual(['wellbeing']);
  });

  it('à découvrir tant qu’aucun croisement n’a assez de cas — la jauge prend le côté le plus maigre', () => {
    const l = byId(buildCrossLinks(input({ wellbeingEnabled: true, wellbeing: { links: [link({})], recentPoorNights: 0 } })), 'wellbeing');
    expect(l.state).toBe('discover');
    expect(l.missing).toMatchObject({ key: 'wellbeingCases', have: 3, need: 8 });
    expect(byId(buildCrossLinks(input({ wellbeingEnabled: true, wellbeing: null })), 'wellbeing').state).toBe('discover');
  });

  it('à régler : une piste défavorable sur la nuit ET des nuits courtes cette semaine', () => {
    const known = link({ status: 'probable', delta: -9, exposed: 11, other: 38, adverse: true });
    const l = byId(buildCrossLinks(input({ wellbeingEnabled: true, wellbeing: { links: [known], recentPoorNights: 3 } })), 'wellbeing');
    expect(l.state).toBe('adjust');
    expect(l.verdict.key).toBe('adjust.nightStrength');
    expect(l.verdict.values).toMatchObject({ nights: 3, delta: -9 });
    expect(l.actions[0]).toEqual({ type: 'open', route: 'wellbeing' });
    expect(l.lens[0]).toBe('wellbeing');
    expect(l.chart).toMatchObject({ type: 'effects', items: [{ id: 'nightStrength', delta: -9 }] });
    expect(l.rows[0]).toMatchObject({ key: 'wellbeing.nightStrength.probable', state: 'adjust' });
  });

  it('ça tient : la piste existe mais la semaine ne la déclenche pas ; ou rien de visible', () => {
    const known = link({ status: 'solid', delta: -9, exposed: 15, other: 38, adverse: true });
    expect(byId(buildCrossLinks(input({ wellbeingEnabled: true, wellbeing: { links: [known], recentPoorNights: 1 } })), 'wellbeing')).toMatchObject({
      state: 'holds',
      verdict: { key: 'holdsKnown' },
    });
    const none = link({ status: 'noLink', delta: -2, exposed: 9, other: 20 });
    const l = byId(buildCrossLinks(input({ wellbeingEnabled: true, wellbeing: { links: [none], recentPoorNights: 4 } })), 'wellbeing');
    expect(l).toMatchObject({ state: 'holds', verdict: { key: 'holdsNone' } });
    expect(l.figures).toEqual([]);
    expect(l.rows[0]?.state).toBe('holds');
  });

  it('les croisements internes au pilier ne remontent pas au Labo', () => {
    const intra = link({ id: 'caffeineNight', scope: 'intra', unit: 'minutes', pillars: [], status: 'solid', delta: -40, exposed: 20, other: 20, adverse: true });
    expect(byId(buildCrossLinks(input({ wellbeingEnabled: true, wellbeing: { links: [intra], recentPoorNights: 5 } })), 'wellbeing').state).toBe('discover');
  });
});
