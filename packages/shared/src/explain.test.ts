import { describe, expect, it } from 'vitest';
import { explainCalorieTarget, explainEnergy, explainRacePrediction, explainReadiness, explainWhatIf } from './explain';
import { RIEGEL_EXPONENT } from './pace-records';
import type { ReadinessResult } from './readiness';
import { projectWhatIf } from './what-if';

const readiness = (over: Partial<ReadinessResult> = {}): ReadinessResult => ({
  show: true,
  verdict: 'push',
  load: { state: 'positive' },
  nutrition: { state: 'neutral' },
  wellbeing: { state: 'positive' },
  negativeCount: 0,
  availableCount: 3,
  ...over,
});

describe('explainReadiness (US DASH-01, « Pourquoi ? » — TRI-03)', () => {
  it('une étape par signal, puis le verdict', () => {
    expect(explainReadiness(readiness())?.steps.map((s) => s.key)).toEqual([
      'explain.readiness.load.positive',
      'explain.readiness.nutrition.neutral',
      'explain.readiness.wellbeing.positive',
      'explain.readiness.verdict.push',
    ]);
  });

  it('trois signaux évaluables → confiance haute ; deux → moyenne ; un → basse', () => {
    expect(explainReadiness(readiness())?.confidence).toBe('high');
    expect(explainReadiness(readiness({ availableCount: 2 }))?.confidence).toBe('medium');
    expect(explainReadiness(readiness({ availableCount: 1 }))?.confidence).toBe('low');
  });

  it('le verdict porte le nombre de signaux au rouge sur le nombre évaluable', () => {
    const steps = explainReadiness(readiness({ verdict: 'rest', negativeCount: 2, availableCount: 3 }))!.steps;
    expect(steps.at(-1)).toEqual({ key: 'explain.readiness.verdict.rest', params: { negative: 2, available: 3 } });
  });

  it('score non affichable → pas d’explication', () => {
    expect(explainReadiness(readiness({ show: false }))).toBeNull();
    expect(explainReadiness(readiness({ verdict: null }))).toBeNull();
  });
});

describe('explainWhatIf', () => {
  const result = projectWhatIf({
    lastTotalKg: 372.5,
    slopePerWeek: 3.06,
    weeks: 9,
    levers: { sessionsPerWeek: 5, baselineSessions: 3, sleep: 'short', protein: 'base' },
  });

  it('pente, séances, récupération, garde-fou — chaque facteur visible', () => {
    const steps = explainWhatIf(result, { baseSlopePerWeek: 3.06, historyPoints: 24 }).steps;
    expect(steps.map((s) => s.key)).toEqual([
      'explain.whatIf.slope',
      'explain.whatIf.sessions',
      'explain.whatIf.recovery',
      'explain.whatIf.overreachOn',
    ]);
    expect(steps[0]!.value).toBe(3.06);
    expect(steps[3]!.value).toBe(0.82);
  });

  it('garde-fou inactif → étape « inactif »', () => {
    const calm = projectWhatIf({
      lastTotalKg: 372.5,
      slopePerWeek: 3.06,
      weeks: 9,
      levers: { sessionsPerWeek: 3, baselineSessions: 3, sleep: 'long', protein: 'base' },
    });
    expect(explainWhatIf(calm, { baseSlopePerWeek: 3.06, historyPoints: 24 }).steps.at(-1)!.key).toBe(
      'explain.whatIf.overreachOff',
    );
  });

  it('la confiance suit le nombre de points d’historique', () => {
    expect(explainWhatIf(result, { baseSlopePerWeek: 3.06, historyPoints: 12 }).confidence).toBe('high');
    expect(explainWhatIf(result, { baseSlopePerWeek: 3.06, historyPoints: 6 }).confidence).toBe('medium');
    expect(explainWhatIf(result, { baseSlopePerWeek: 3.06, historyPoints: 5 }).confidence).toBe('low');
  });
});

describe('explainRacePrediction', () => {
  const prediction = {
    distanceKey: '10k' as const,
    predictedSeconds: 3288,
    sourceTimeSeconds: 1580,
    sourceAchievedAt: '2026-09-01T08:00:00.000Z',
  };

  it('source 5 km, exposant de Riegel, résultat', () => {
    const steps = explainRacePrediction(prediction, '2026-09-14T08:00:00.000Z').steps;
    expect(steps).toEqual([
      { key: 'explain.race.source', value: 1580 },
      { key: 'explain.race.riegel', value: RIEGEL_EXPONENT },
      { key: 'explain.race.result', value: 3288, params: { distance: '10k' } },
    ]);
  });

  it('une source récente est plus sûre qu’une vieille', () => {
    expect(explainRacePrediction(prediction, '2026-09-14T08:00:00.000Z').confidence).toBe('high');
    expect(explainRacePrediction(prediction, '2026-11-01T08:00:00.000Z').confidence).toBe('medium');
    expect(explainRacePrediction(prediction, '2027-02-01T08:00:00.000Z').confidence).toBe('low');
  });
});

describe('explainCalorieTarget', () => {
  it('dépense, objectif, jour d’entraînement, cible', () => {
    expect(
      explainCalorieTarget({ tdee: 2480, objectiveDeltaKcal: -300, trainingDayBonusKcal: 0, target: 2180, profileComplete: true }),
    ).toEqual({
      steps: [
        { key: 'explain.kcal.tdee', value: 2480 },
        { key: 'explain.kcal.objective', value: -300 },
        { key: 'explain.kcal.target', value: 2180 },
      ],
      confidence: 'high',
    });
  });

  it('un bonus de jour d’entraînement s’affiche comme une étape à part', () => {
    const r = explainCalorieTarget({ tdee: 2480, objectiveDeltaKcal: -300, trainingDayBonusKcal: 120, target: 2300, profileComplete: false });
    expect(r.steps.map((s) => s.key)).toContain('explain.kcal.trainingDay');
    expect(r.confidence).toBe('low');
  });
});

describe('explainEnergy (US DEPENSE-02)', () => {
  const base = {
    restingKcalPerHour: 74.17,
    personalised: true,
    met: 6,
    activeMinutes: 60,
    kcal: 370,
    low: 260,
    high: 480,
    confidence: 'medium' as const,
  };

  it('raconte le calcul dans l’ordre, et désamorce la montre et le niveau', () => {
    const e = explainEnergy(base);
    expect(e.steps.map((s) => s.key)).toEqual([
      'explain.energy.resting',
      'explain.energy.met',
      'explain.energy.minutes',
      'explain.energy.result',
      'explain.energy.watch',
      'explain.energy.level',
      'explain.energy.target',
    ]);
    // Le repos pendant l'heure d'effort : c'est l'écart avec une montre.
    expect(e.steps.find((s) => s.key === 'explain.energy.watch')?.params).toEqual({ kcal: 74 });
    // La cible ne retient que le bas de la fourchette.
    expect(e.steps.at(-1)).toMatchObject({ key: 'explain.energy.target', value: 260 });
  });

  it('dit le repli quand le profil est incomplet', () => {
    const e = explainEnergy({ ...base, personalised: false, confidence: 'low' });
    expect(e.steps[0]?.key).toBe('explain.energy.restingFallback');
    expect(e.confidence).toBe('low');
  });

  it('un chiffre de montre n’a ni MET ni durée à expliquer', () => {
    const e = explainEnergy({ ...base, met: null, kcal: 812, low: 812, high: 812, confidence: 'high' });
    expect(e.steps.map((s) => s.key)).toEqual([
      'explain.energy.resting',
      'explain.energy.device',
      'explain.energy.target',
    ]);
  });

  it('ne peut pas être plus sûre que le chiffre qu’elle explique', () => {
    expect(explainEnergy({ ...base, confidence: 'high' }).confidence).toBe('high');
  });
});
