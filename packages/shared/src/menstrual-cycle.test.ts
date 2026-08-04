import { describe, expect, it } from 'vitest';
import {
  MIN_CYCLES_FOR_PREDICTION,
  closeOpenPeriodsFor,
  crossPhaseAverages,
  cycleDayFor,
  cycleLengths,
  phaseForDate,
  predictNextPeriod,
  shouldImportCycleData,
  staleOpenPeriods,
  usableCycleLengths,
  type MenstrualPeriod,
} from './menstrual-cycle';

// ---------------------------------------------------------------------------
// Fabriques
// ---------------------------------------------------------------------------

const p = (id: string, startedOn: string, endedOn: string | null = null): MenstrualPeriod => ({
  id,
  startedOn,
  endedOn,
});

/** 4 cycles réguliers de 28 j, du plus ancien au plus récent. */
const REGULAR: MenstrualPeriod[] = [
  p('a', '2026-04-10', '2026-04-14'),
  p('b', '2026-05-08', '2026-05-12'),
  p('c', '2026-06-05', '2026-06-09'),
  p('d', '2026-07-03', '2026-07-08'),
];

// ---------------------------------------------------------------------------
// R2 — une seule période en cours
// ---------------------------------------------------------------------------

describe('closeOpenPeriodsFor (R2)', () => {
  it("clôt la période restée ouverte, la veille du nouveau début", () => {
    const periods = [p('a', '2026-06-05', '2026-06-09'), p('b', '2026-07-03', null)];
    expect(closeOpenPeriodsFor(periods, '2026-07-31')).toEqual([
      { id: 'b', endedOn: '2026-07-30' },
    ]);
  });

  it("ne touche à rien si aucune période n'est ouverte", () => {
    expect(closeOpenPeriodsFor(REGULAR, '2026-07-31')).toEqual([]);
  });

  it('ignore une période ouverte qui commencerait APRÈS le nouveau début', () => {
    // Saisie rétroactive d'un cycle ancien : elle ne doit pas clore une période plus récente.
    const periods = [p('b', '2026-07-03', null)];
    expect(closeOpenPeriodsFor(periods, '2026-05-08')).toEqual([]);
  });

  it("clôt à la date de début elle-même si le nouveau début suit immédiatement", () => {
    // Cas dégénéré : nouveau début = lendemain de l'ouverture → période d'un seul jour, pas négative.
    const periods = [p('b', '2026-07-03', null)];
    expect(closeOpenPeriodsFor(periods, '2026-07-04')).toEqual([{ id: 'b', endedOn: '2026-07-03' }]);
  });
});

// ---------------------------------------------------------------------------
// R3 — clôture automatique à 15 jours
// ---------------------------------------------------------------------------

describe('staleOpenPeriods (R3)', () => {
  it('ne clôt pas une période ouverte depuis 15 jours', () => {
    expect(staleOpenPeriods([p('a', '2026-07-17', null)], '2026-07-31')).toEqual([]);
  });

  it('clôt à J+14 une période ouverte depuis 16 jours, et la signale', () => {
    // J1 = 2026-07-16 → 15 jours de règles = jusqu'au 2026-07-30 inclus.
    expect(staleOpenPeriods([p('a', '2026-07-16', null)], '2026-07-31')).toEqual([
      { id: 'a', endedOn: '2026-07-30', flagged: true },
    ]);
  });

  it('ignore les périodes déjà closes', () => {
    expect(staleOpenPeriods(REGULAR, '2026-12-31')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R5 — longueur = début → début
// ---------------------------------------------------------------------------

describe('cycleLengths (R5)', () => {
  it('mesure du début au début, jamais de la fin au début', () => {
    expect(cycleLengths(REGULAR)).toEqual([
      { startedOn: '2026-04-10', length: 28 },
      { startedOn: '2026-05-08', length: 28 },
      { startedOn: '2026-06-05', length: 28 },
    ]);
  });

  it("la dernière période n'a pas de longueur (le cycle suivant n'a pas commencé)", () => {
    expect(cycleLengths(REGULAR)).toHaveLength(REGULAR.length - 1);
  });

  it('trie par date avant de calculer — un historique désordonné donne le même résultat', () => {
    const shuffled = [REGULAR[2]!, REGULAR[0]!, REGULAR[3]!, REGULAR[1]!];
    expect(cycleLengths(shuffled)).toEqual(cycleLengths(REGULAR));
  });

  it('renvoie une liste vide avec 0 ou 1 période', () => {
    expect(cycleLengths([])).toEqual([]);
    expect(cycleLengths([p('a', '2026-07-03')])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R6 — cycles aberrants exclus du calcul, jamais effacés
// ---------------------------------------------------------------------------

describe('usableCycleLengths (R6)', () => {
  it('exclut un cycle de 119 jours mais le restitue comme ignoré', () => {
    const res = usableCycleLengths([
      { startedOn: '2025-12-13', length: 119 },
      { startedOn: '2026-04-10', length: 28 },
      { startedOn: '2026-05-08', length: 27 },
    ]);
    expect(res.usable.map((c) => c.length)).toEqual([28, 27]);
    expect(res.ignored.map((c) => c.length)).toEqual([119]);
  });

  it('exclut aussi un cycle trop court (saisie erronée)', () => {
    const res = usableCycleLengths([{ startedOn: '2026-04-10', length: 9 }]);
    expect(res.usable).toEqual([]);
    expect(res.ignored.map((c) => c.length)).toEqual([9]);
  });

  it('garde les bornes inclusives (15 et 90 sont retenus)', () => {
    const res = usableCycleLengths([
      { startedOn: 'x', length: 15 },
      { startedOn: 'y', length: 90 },
    ]);
    expect(res.usable).toHaveLength(2);
    expect(res.ignored).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R8 / R9 / R10 — prédiction
// ---------------------------------------------------------------------------

describe('predictNextPeriod', () => {
  it('R8 — pas de prédiction sous 3 cycles complets, et dit combien il en manque', () => {
    const res = predictNextPeriod(REGULAR.slice(0, 3), '2026-07-31'); // 3 périodes = 2 cycles
    expect(res).toEqual({
      status: 'insufficient',
      cyclesAvailable: 2,
      cyclesNeeded: MIN_CYCLES_FOR_PREDICTION,
    });
  });

  it('R9 — 3 cycles réguliers : une date ET sa fourchette', () => {
    const res = predictNextPeriod(REGULAR, '2026-07-31');
    expect(res.status).toBe('ready');
    if (res.status !== 'ready') return;
    expect(res.averageLength).toBe(28);
    expect(res.cyclesUsed).toBe(3);
    // Dernier début 2026-07-03 + 28 j.
    expect(res.predictedOn).toBe('2026-07-31');
    // Cycles identiques → dispersion nulle, mais la fourchette reste affichée (jamais < 1 jour).
    expect(res.marginDays).toBeGreaterThanOrEqual(1);
  });

  it('R10 — cycles très dispersés : AUCUNE date, et on dit pourquoi', () => {
    const irregular = [
      p('a', '2026-01-01', '2026-01-05'),
      p('b', '2026-01-22', '2026-01-26'), // 21 j
      p('c', '2026-03-05', '2026-03-09'), // 42 j
      p('d', '2026-03-27', '2026-03-31'), // 22 j
      p('e', '2026-05-15', '2026-05-19'), // 49 j
    ];
    const res = predictNextPeriod(irregular, '2026-06-01');
    expect(res.status).toBe('irregular');
    if (res.status !== 'irregular') return;
    expect(res.minLength).toBe(21);
    expect(res.maxLength).toBe(49);
    expect(res).not.toHaveProperty('predictedOn');
  });

  it("les cycles aberrants ne comptent ni dans la moyenne ni dans le décompte du seuil", () => {
    // 3 cycles utilisables + 1 aberrant : on doit être `ready` sur les 3 seulement.
    const withOutlier = [
      p('z', '2025-08-16', '2025-08-21'), // suivi d'un trou de 119 j → cycle ignoré
      ...REGULAR,
    ];
    const res = predictNextPeriod(withOutlier, '2026-07-31');
    expect(res.status).toBe('ready');
    if (res.status !== 'ready') return;
    expect(res.cyclesUsed).toBe(3);
    expect(res.averageLength).toBe(28);
  });

  it('une prédiction déjà dépassée reste rendue telle quelle (aucune alerte de retard — R11)', () => {
    const res = predictNextPeriod(REGULAR, '2026-08-20');
    expect(res.status).toBe('ready');
    if (res.status !== 'ready') return;
    expect(res.predictedOn).toBe('2026-07-31'); // dans le passé, et c'est assumé
  });

  it('renvoie `insufficient` sur un historique vide, sans lever', () => {
    expect(predictNextPeriod([], '2026-07-31')).toEqual({
      status: 'insufficient',
      cyclesAvailable: 0,
      cyclesNeeded: MIN_CYCLES_FOR_PREDICTION,
    });
  });
});

// ---------------------------------------------------------------------------
// R12 — phases
// ---------------------------------------------------------------------------

describe('cycleDayFor / phaseForDate (R12)', () => {
  it('J1 est le premier jour de la période, pas J0', () => {
    expect(cycleDayFor('2026-07-03', REGULAR)).toBe(1);
    expect(cycleDayFor('2026-07-04', REGULAR)).toBe(2);
  });

  it('pendant la période : phase menstruelle', () => {
    expect(phaseForDate('2026-07-05', REGULAR, 28)).toBe('menstrual');
  });

  it('après la période et avant l’ovulation : folliculaire', () => {
    expect(phaseForDate('2026-07-12', REGULAR, 28)).toBe('follicular');
  });

  it('autour de J14 sur un cycle de 28 j : ovulatoire', () => {
    expect(phaseForDate('2026-07-16', REGULAR, 28)).toBe('ovulatory');
  });

  it('après la fenêtre ovulatoire : lutéale', () => {
    expect(phaseForDate('2026-07-25', REGULAR, 28)).toBe('luteal');
  });

  it("une date ANTÉRIEURE à toute période n'a pas de phase — on n'invente pas", () => {
    expect(phaseForDate('2026-01-01', REGULAR, 28)).toBeNull();
    expect(cycleDayFor('2026-01-01', REGULAR)).toBeNull();
  });

  it('sans longueur moyenne connue, seule la phase menstruelle est affirmée', () => {
    expect(phaseForDate('2026-07-05', REGULAR, null)).toBe('menstrual');
    expect(phaseForDate('2026-07-20', REGULAR, null)).toBeNull();
  });

  it("au-delà d'un cycle invraisemblable, aucune phase (données périmées)", () => {
    expect(phaseForDate('2027-07-03', REGULAR, 28)).toBeNull();
  });

  it('une période encore ouverte reste menstruelle jusqu’à aujourd’hui', () => {
    const open = [p('x', '2026-07-28', null)];
    expect(phaseForDate('2026-07-30', open, 28)).toBe('menstrual');
  });
});

// ---------------------------------------------------------------------------
// R13 / R14 — croisement
// ---------------------------------------------------------------------------

describe('crossPhaseAverages (R13/R14)', () => {
  const sample = (phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal', n: number, v: number) =>
    Array.from({ length: n }, () => ({ phase, value: v }));

  it("sous le seuil de cycles : insuffisant, et on dit ce qui manque", () => {
    const res = crossPhaseAverages(
      [...sample('menstrual', 12, 3), ...sample('follicular', 12, 4)],
      2,
    );
    expect(res.status).toBe('insufficient');
    if (res.status !== 'insufficient') return;
    expect(res.cyclesAvailable).toBe(2);
  });

  it('assez de cycles mais une phase sous les 10 jours : toujours insuffisant', () => {
    const res = crossPhaseAverages(
      [
        ...sample('menstrual', 12, 3),
        ...sample('follicular', 12, 4),
        ...sample('ovulatory', 4, 4), // trop peu
        ...sample('luteal', 12, 3),
      ],
      4,
    );
    expect(res.status).toBe('insufficient');
    if (res.status !== 'insufficient') return;
    expect(res.missingByPhase.ovulatory).toBe(6);
    expect(res.missingByPhase.menstrual).toBe(0);
  });

  it('seuils atteints : moyennes par phase, arrondies au dixième', () => {
    const res = crossPhaseAverages(
      [
        ...sample('menstrual', 10, 3),
        ...sample('follicular', 10, 4),
        ...sample('ovulatory', 10, 4),
        ...sample('luteal', 10, 2),
        { phase: 'luteal' as const, value: 3 },
      ],
      4,
    );
    expect(res.status).toBe('ready');
    if (res.status !== 'ready') return;
    expect(res.byPhase.menstrual.average).toBe(3);
    expect(res.byPhase.luteal.average).toBe(2.1);
    expect(res.byPhase.luteal.sampleCount).toBe(11);
    expect(res.cyclesObserved).toBe(4);
  });

  it('aucun échantillon : insuffisant, sans division par zéro', () => {
    const res = crossPhaseAverages([], 0);
    expect(res.status).toBe('insufficient');
    if (res.status !== 'insufficient') return;
    expect(res.missingByPhase.luteal).toBe(10);
  });
});

// ── Throttle de la synchro Health Connect (§4, D) ────────────────────────────────
//
// Fonction publique qui n'était appelée par **aucun test**. Sa règle de repli est délibérément
// permissive : en cas de doute (curseur illisible, horloge en avance), on autorise l'import — mieux
// vaut un import de trop, idempotent, qu'une utilisatrice définitivement enfermée hors synchro.
// C'est précisément ce genre de décision qu'un test doit figer, sinon un « durcissement » bien
// intentionné la renverse sans qu'on le voie.
describe('shouldImportCycleData', () => {
  const now = Date.parse('2026-08-04T12:00:00.000Z');

  it('autorise quand aucun import n’a encore eu lieu', () => {
    expect(shouldImportCycleData(null, now, 6)).toBe(true);
    expect(shouldImportCycleData(undefined, now, 6)).toBe(true);
    expect(shouldImportCycleData('', now, 6)).toBe(true);
  });

  it('refuse tant que la fenêtre de throttle n’est pas écoulée', () => {
    expect(shouldImportCycleData('2026-08-04T09:00:00.000Z', now, 6)).toBe(false);
  });

  it('autorise dès que la fenêtre est atteinte, bord inclus', () => {
    expect(shouldImportCycleData('2026-08-04T06:00:00.000Z', now, 6)).toBe(true);
    expect(shouldImportCycleData('2026-08-03T00:00:00.000Z', now, 6)).toBe(true);
  });

  it('accepte un horodatage SQLite sans « T » (espace séparateur)', () => {
    // PowerSync/SQLite stocke parfois « AAAA-MM-JJ HH:MM:SS » : sans la normalisation, `Date.parse`
    // échoue et le throttle deviendrait un blocage permanent… ou une autorisation permanente.
    expect(shouldImportCycleData('2026-08-04 09:00:00', now, 6)).toBe(false);
    expect(shouldImportCycleData('2026-08-03 00:00:00', now, 6)).toBe(true);
  });

  it('autorise en cas de curseur illisible', () => {
    expect(shouldImportCycleData('pas une date', now, 6)).toBe(true);
  });

  it('autorise si le dernier import est daté dans le futur (horloge décalée)', () => {
    // Sans cette garde, une horloge avancée d'un jour bloquerait la synchro pendant 24 h.
    expect(shouldImportCycleData('2026-08-05T12:00:00.000Z', now, 6)).toBe(true);
  });

  it('un throttle nul ou négatif n’interdit jamais rien', () => {
    expect(shouldImportCycleData('2026-08-04T11:59:59.000Z', now, 0)).toBe(true);
    expect(shouldImportCycleData('2026-08-04T11:59:59.000Z', now, -1)).toBe(true);
  });
});
