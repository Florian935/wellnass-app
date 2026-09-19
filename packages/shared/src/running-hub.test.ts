import { describe, expect, it } from 'vitest';
import {
  estimateRunMinutes,
  referencePaceFromCooperTest,
  referencePaceFromRaceTime,
  resolveRunHubState,
  resolveRunWeek,
  type RunHubStateInput,
  type RunHubTodaySession,
} from './running-hub';

const seance = (over: Partial<RunHubTodaySession> = {}): RunHubTodaySession => ({
  plannedSessionId: 'ps-1',
  sessionId: 's-1',
  sessionType: 'fractionne',
  targetDistanceM: 7000,
  targetDurationSeconds: null,
  instructions: null,
  segmentSummaries: [],
  totalDistanceM: 7000,
  estimatedMinutes: 40,
  ...over,
});

const entree = (over: Partial<RunHubStateInput> = {}): RunHubStateInput => ({
  activeRun: null,
  todaySession: null,
  hasActiveProgram: false,
  doneToday: null,
  nextUpcoming: null,
  ...over,
});

describe('resolveRunHubState — un seul état, jamais deux cartes', () => {
  it('A — une course en cours prime sur tout', () => {
    const state = resolveRunHubState(
      entree({
        activeRun: { source: 'gps', distanceM: 3200, durationSeconds: 900 },
        todaySession: seance(),
        hasActiveProgram: true,
      }),
    );

    // C'est la seule situation où l'utilisateur a déjà commencé quelque chose qu'il peut perdre.
    expect(state.kind).toBe('resume');
  });

  it('B — la séance du jour prime sur le repos', () => {
    const state = resolveRunHubState(
      entree({ todaySession: seance(), hasActiveProgram: true }),
    );

    expect(state.kind).toBe('today');
    if (state.kind !== 'today') throw new Error('attendu today');
    expect(state.session.plannedSessionId).toBe('ps-1');
  });

  it('🔴 C — un programme actif sans séance aujourd’hui n’est PAS un compte neuf', () => {
    const state = resolveRunHubState(
      entree({
        hasActiveProgram: true,
        nextUpcoming: { scheduledDate: '2026-09-12', sessionType: 'sortie_longue' },
      }),
    );

    // Le hub proposait la même carte « Démarrer une course » à quelqu'un qui suit un plan de
    // 8 semaines et à quelqu'un qui vient d'installer l'app : trois états là où il en faut quatre.
    expect(state.kind).toBe('rest');
    if (state.kind !== 'rest') throw new Error('attendu rest');
    expect(state.nextUpcoming?.scheduledDate).toBe('2026-09-12');
  });

  it('C — la séance du jour déjà faite nuance l’état, elle ne le change pas', () => {
    const state = resolveRunHubState(
      entree({ hasActiveProgram: true, doneToday: { sessionType: 'endurance' } }),
    );

    expect(state.kind).toBe('rest');
    if (state.kind !== 'rest') throw new Error('attendu rest');
    expect(state.doneToday?.sessionType).toBe('endurance');
  });

  it('D — aucun programme actif = compte neuf', () => {
    expect(resolveRunHubState(entree()).kind).toBe('onboarding');
  });
});

describe('resolveRunWeek — ma semaine (constat F37)', () => {
  const semaine = () =>
    resolveRunWeek({
      weekStartKey: '2026-09-07', // lundi
      todayKey: '2026-09-10', // jeudi
      runs: [
        { dayKey: '2026-09-07', distanceM: 7000, durationSeconds: 2400, elevationGainM: 30 },
        { dayKey: '2026-09-09', distanceM: 7120, durationSeconds: 2200, elevationGainM: 34 },
      ],
      planned: [
        { dayKey: '2026-09-07', done: true },
        { dayKey: '2026-09-09', done: true },
        { dayKey: '2026-09-12', done: false },
      ],
      targetFrequency: 3,
    });

  it('génère les sept jours, même sans donnée', () => {
    const w = semaine();

    // Une semaine à trous se lit ; une semaine absente ne se lit pas.
    expect(w.days).toHaveLength(7);
    expect(w.days.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(w.days.map((d) => d.dayKey)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
  });

  it('marque les jours courus, les jours prévus et aujourd’hui', () => {
    const w = semaine();

    expect(w.days[0]).toMatchObject({ done: true, planned: false, isToday: false });
    expect(w.days[2]).toMatchObject({ done: true, planned: false });
    expect(w.days[3]).toMatchObject({ done: false, planned: false, isToday: true });
    expect(w.days[5]).toMatchObject({ done: false, planned: true });
  });

  it('cumule distance, temps et dénivelé', () => {
    const w = semaine();

    expect(w.doneCount).toBe(2);
    expect(w.plannedCount).toBe(3);
    expect(w.distanceM).toBe(14_120);
    expect(w.durationSeconds).toBe(4600);
    expect(w.elevationGainM).toBe(64);
  });

  it('🔴 porte la fréquence visée du profil — qui n’était lue nulle part', () => {
    // Constat F40 : le profil demandait « fréquence hebdo visée » et rien ne s'en servait.
    expect(semaine().targetFrequency).toBe(3);
  });

  it('🔴 goalCount — le dénominateur est le MÊME pour la scène et pour la carte', () => {
    // Audit CARDIO-UX02, défaut 2 : la scène affichait « 2 / 0 faites » (doneCount / plannedCount)
    // pendant que la carte, deux blocs plus bas, affichait « 2 / 3 faites » (repli sur la
    // fréquence visée appliqué dans le composant). Les deux lisent désormais `goalCount`.
    const sansProgramme = resolveRunWeek({
      weekStartKey: '2026-09-07',
      todayKey: '2026-09-10',
      runs: [
        { dayKey: '2026-09-07', distanceM: 9000, durationSeconds: 3060, elevationGainM: 45 },
        { dayKey: '2026-09-09', distanceM: 8000, durationSeconds: 2760, elevationGainM: 45 },
      ],
      planned: [],
      targetFrequency: 3,
    });

    expect(sansProgramme.plannedCount).toBe(0);
    expect(sansProgramme.goalCount).toBe(3);
    // Avec un programme, la fréquence visée reste prioritaire : c'est l'objectif déclaré, pas le
    // contenu d'une semaine qui peut être allégée.
    expect(semaine().goalCount).toBe(3);
  });

  it('goalCount retombe sur le prévu quand aucune fréquence n’est déclarée', () => {
    const w = resolveRunWeek({
      weekStartKey: '2026-09-07',
      todayKey: '2026-09-07',
      runs: [],
      planned: [
        { dayKey: '2026-09-08', done: false },
        { dayKey: '2026-09-10', done: false },
      ],
      targetFrequency: null,
    });

    expect(w.goalCount).toBe(2);
  });

  it('goalCount vaut 0 quand il n’y a ni programme ni fréquence — et c’est au rendu de se taire', () => {
    const w = resolveRunWeek({
      weekStartKey: '2026-09-07',
      todayKey: '2026-09-07',
      runs: [{ dayKey: '2026-09-07', distanceM: 5000, durationSeconds: 1500, elevationGainM: 0 }],
      planned: [],
      targetFrequency: null,
    });

    // On ne fabrique pas un objectif par défaut : « 1 / 3 » inventerait une intention.
    expect(w.goalCount).toBe(0);
  });

  it('un jour à plusieurs séances reste « à faire » s’il en reste une', () => {
    const w = resolveRunWeek({
      weekStartKey: '2026-09-07',
      todayKey: '2026-09-07',
      runs: [],
      planned: [
        { dayKey: '2026-09-08', done: true },
        { dayKey: '2026-09-08', done: false },
      ],
      targetFrequency: null,
    });

    expect(w.days[1]!.planned).toBe(true);
  });

  it('ne compte pas deux fois un jour à deux courses', () => {
    const w = resolveRunWeek({
      weekStartKey: '2026-09-07',
      todayKey: '2026-09-07',
      runs: [
        { dayKey: '2026-09-07', distanceM: 5000, durationSeconds: 1500, elevationGainM: 10 },
        { dayKey: '2026-09-07', distanceM: 3000, durationSeconds: 900, elevationGainM: 5 },
      ],
      planned: [],
      targetFrequency: null,
    });

    // Deux courses, un seul jour couru — mais les volumes s'additionnent bien.
    expect(w.doneCount).toBe(1);
    expect(w.distanceM).toBe(8000);
  });

  it('traverse un changement de mois sans dérailler', () => {
    const w = resolveRunWeek({
      weekStartKey: '2026-09-28',
      todayKey: '2026-09-30',
      runs: [],
      planned: [],
      targetFrequency: null,
    });

    expect(w.days.map((d) => d.dayKey)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });
});

describe('referencePaceFromRaceTime — la porte « j’ai un chrono »', () => {
  it('🔴 déduit l’allure de référence d’un 10 km, sans jamais avoir couru un 5 km', () => {
    // 52:30 sur 10 km. Riegel dans l'autre sens : le 5 km estimé vaut
    // 3150 × (5000/10000)^1,06 ≈ 1511 s, soit ≈ 5:02/km.
    const pace = referencePaceFromRaceTime(10_000, 52 * 60 + 30);

    expect(pace).not.toBeNull();
    expect(pace!).toBeGreaterThan(290);
    expect(pace!).toBeLessThan(310);
  });

  it('un chrono sur 5 km rend exactement son allure', () => {
    // 25:00 sur 5 km = 300 s/km, sans passer par la formule (cas limite trivial de Riegel).
    expect(referencePaceFromRaceTime(5000, 25 * 60)).toBe(300);
  });

  it('un semi plus lent donne une allure de référence plus rapide que l’allure du semi', () => {
    const semiPace = (1 * 3600 + 55 * 60) / 21.0975;
    const ref = referencePaceFromRaceTime(21_097, 1 * 3600 + 55 * 60)!;

    // Physiologiquement : on court plus vite sur 5 km que sur semi.
    expect(ref).toBeLessThan(semiPace);
  });

  it('refuse une saisie inexploitable plutôt que d’inventer une allure', () => {
    expect(referencePaceFromRaceTime(0, 1500)).toBeNull();
    expect(referencePaceFromRaceTime(5000, 0)).toBeNull();
    expect(referencePaceFromRaceTime(-1, 1500)).toBeNull();
    expect(referencePaceFromRaceTime(5000, Number.NaN)).toBeNull();
  });
});

describe('referencePaceFromCooperTest — la porte « je fais le test »', () => {
  it('déduit une allure de 2 400 m couverts en 12 minutes', () => {
    const pace = referencePaceFromCooperTest(2400);

    expect(pace).not.toBeNull();
    // 720 s sur 2 400 m = 5:00/km sur le test ; sur 5 km, un peu plus lent.
    expect(pace!).toBeGreaterThan(300);
  });

  it('🔴 refuse sous 400 m — en dessous, la conversion n’a plus de sens', () => {
    expect(referencePaceFromCooperTest(380)).toBeNull();
    expect(referencePaceFromCooperTest(0)).toBeNull();
  });

  it('passe par la même formule que la porte « chrono » — aucune divergence possible', () => {
    expect(referencePaceFromCooperTest(2400)).toBe(referencePaceFromRaceTime(2400, 720));
  });
});

describe('estimateRunMinutes', () => {
  it('une séance bornée en durée donne sa durée, exactement', () => {
    expect(
      estimateRunMinutes({ targetDurationSeconds: 45 * 60, totalDistanceM: 9000, refPaceSPerKm: 300 }),
    ).toBe(45);
  });

  it('une séance bornée en distance passe par l’allure de référence, majorée', () => {
    // 7 km à 5:00/km = 35 min, + 15 % pour la récup et les transitions ≈ 40 min.
    expect(
      estimateRunMinutes({ targetDurationSeconds: null, totalDistanceM: 7000, refPaceSPerKm: 300 }),
    ).toBe(40);
  });

  it('🔴 sans allure de référence, n’estime rien — plutôt que d’inventer', () => {
    expect(
      estimateRunMinutes({ targetDurationSeconds: null, totalDistanceM: 7000, refPaceSPerKm: null }),
    ).toBeNull();
  });

  it('sans volume ni durée, n’estime rien', () => {
    expect(
      estimateRunMinutes({ targetDurationSeconds: null, totalDistanceM: null, refPaceSPerKm: 300 }),
    ).toBeNull();
  });
});
