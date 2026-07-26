import { describe, expect, it } from 'vitest';
import {
  EXERCISE_TYPE_RUNNING,
  EXERCISE_TYPE_STRENGTH_TRAINING,
  RECORDING_METHOD_ACTIVELY_RECORDED,
  RECORDING_METHOD_MANUAL_ENTRY,
  buildRunRecords,
  buildWorkoutSessionRecord,
  localDateOfInstant,
  selectWeightEntriesToImport,
  shouldImportWeight,
} from './health-connect';

/** Séance nominale : 1 h de muscu, terminée, avec un nom de séance et des notes. */
const WORKOUT = {
  id: '11111111-1111-4111-8111-111111111111',
  startedAt: '2026-07-20T08:00:00.000Z',
  finishedAt: '2026-07-20T09:00:00.000Z',
  updatedAt: '2026-07-20T09:00:05.000Z',
  sessionName: 'Haut du corps A',
  notes: 'Épaule droite douloureuse',
} as const;

const RUN = {
  id: '22222222-2222-4222-8222-222222222222',
  startedAt: '2026-07-21T06:00:00.000Z',
  finishedAt: '2026-07-21T06:30:00.000Z',
  updatedAt: '2026-07-21T06:30:02.000Z',
  distanceM: 5200,
  source: 'gps',
} as const;

describe('buildWorkoutSessionRecord', () => {
  it('construit un ExerciseSession de musculation borné par started_at / finished_at', () => {
    const record = buildWorkoutSessionRecord(WORKOUT);
    expect(record).not.toBeNull();
    expect(record!.recordType).toBe('ExerciseSession');
    expect(record!.exerciseType).toBe(EXERCISE_TYPE_STRENGTH_TRAINING);
    expect(record!.startTime).toBe(WORKOUT.startedAt);
    expect(record!.endTime).toBe(WORKOUT.finishedAt);
  });

  it('utilise le nom de la séance comme titre quand il est résolvable', () => {
    expect(buildWorkoutSessionRecord(WORKOUT)!.title).toBe('Haut du corps A');
  });

  it('retombe sur le libellé fourni quand la séance n’a pas de nom (séance libre / template)', () => {
    const record = buildWorkoutSessionRecord({
      ...WORKOUT,
      sessionName: null,
      defaultTitle: 'Séance de musculation',
    });
    expect(record!.title).toBe('Séance de musculation');
  });

  it('n’exporte JAMAIS les notes de séance (minimisation — texte libre personnel)', () => {
    const record = buildWorkoutSessionRecord(WORKOUT);
    expect(record!.notes).toBeUndefined();
    expect(JSON.stringify(record)).not.toContain('douloureuse');
  });

  it('préfixe le clientRecordId et dérive clientRecordVersion de updated_at', () => {
    const record = buildWorkoutSessionRecord(WORKOUT);
    expect(record!.metadata?.clientRecordId).toBe(`workout-${WORKOUT.id}`);
    expect(record!.metadata?.clientRecordVersion).toBe(Date.parse(WORKOUT.updatedAt));
  });

  it('croît en clientRecordVersion quand la séance est modifiée plus tard', () => {
    const before = buildWorkoutSessionRecord(WORKOUT)!.metadata!.clientRecordVersion!;
    const after = buildWorkoutSessionRecord({
      ...WORKOUT,
      updatedAt: '2026-07-20T10:00:00.000Z',
    })!.metadata!.clientRecordVersion!;
    expect(after).toBeGreaterThan(before);
  });

  it('marque ACTIVELY_RECORDED à la clôture et MANUAL_ENTRY au rattrapage', () => {
    expect(buildWorkoutSessionRecord(WORKOUT)!.metadata?.recordingMethod).toBe(
      RECORDING_METHOD_ACTIVELY_RECORDED,
    );
    expect(
      buildWorkoutSessionRecord({ ...WORKOUT, backfill: true })!.metadata?.recordingMethod,
    ).toBe(RECORDING_METHOD_MANUAL_ENTRY);
  });

  it('renvoie null sans finished_at', () => {
    expect(buildWorkoutSessionRecord({ ...WORKOUT, finishedAt: null })).toBeNull();
  });

  it('renvoie null pour une durée nulle ou négative (Health Connect refuse endTime <= startTime)', () => {
    expect(
      buildWorkoutSessionRecord({ ...WORKOUT, finishedAt: WORKOUT.startedAt }),
    ).toBeNull();
    expect(
      buildWorkoutSessionRecord({ ...WORKOUT, finishedAt: '2026-07-20T07:00:00.000Z' }),
    ).toBeNull();
  });

  it('renvoie null sur un horodatage illisible', () => {
    expect(buildWorkoutSessionRecord({ ...WORKOUT, startedAt: 'pas-une-date' })).toBeNull();
  });

  it('retombe sur une version 0 si updated_at est illisible (jamais NaN dans le record)', () => {
    const record = buildWorkoutSessionRecord({ ...WORKOUT, updatedAt: 'bidon' });
    expect(record!.metadata?.clientRecordVersion).toBe(0);
  });
});

describe('buildRunRecords', () => {
  it('sépare les lots par type de record (insertRecords refuse les lots hétérogènes)', () => {
    const out = buildRunRecords(RUN);
    expect(out).not.toBeNull();
    expect(out!.sessions).toHaveLength(1);
    expect(out!.distances).toHaveLength(1);
    expect(out!.sessions[0]!.recordType).toBe('ExerciseSession');
    expect(out!.distances[0]!.recordType).toBe('Distance');
  });

  it('construit la session de course avec le bon type d’exercice', () => {
    const session = buildRunRecords(RUN)!.sessions[0]!;
    expect(session.exerciseType).toBe(EXERCISE_TYPE_RUNNING);
    expect(session.startTime).toBe(RUN.startedAt);
    expect(session.endTime).toBe(RUN.finishedAt);
    expect(session.metadata?.clientRecordId).toBe(`run-${RUN.id}`);
  });

  it('exprime la distance en objet Length (mètres), pas en nombre nu', () => {
    const distance = buildRunRecords(RUN)!.distances[0]!;
    expect(distance.distance).toEqual({ unit: 'meters', value: 5200 });
    expect(distance.metadata?.clientRecordId).toBe(`run-dist-${RUN.id}`);
    expect(distance.startTime).toBe(RUN.startedAt);
    expect(distance.endTime).toBe(RUN.finishedAt);
  });

  it('laisse le lot Distance VIDE quand la distance est absente ou nulle', () => {
    expect(buildRunRecords({ ...RUN, distanceM: null })!.distances).toEqual([]);
    expect(buildRunRecords({ ...RUN, distanceM: 0 })!.distances).toEqual([]);
    // La session reste écrite : une course sans distance est une course valide.
    expect(buildRunRecords({ ...RUN, distanceM: null })!.sessions).toHaveLength(1);
  });

  it('marque MANUAL_ENTRY une course saisie à la main', () => {
    const out = buildRunRecords({ ...RUN, source: 'manual' })!;
    expect(out.sessions[0]!.metadata?.recordingMethod).toBe(RECORDING_METHOD_MANUAL_ENTRY);
    expect(out.distances[0]!.metadata?.recordingMethod).toBe(RECORDING_METHOD_MANUAL_ENTRY);
  });

  it('marque MANUAL_ENTRY au rattrapage, même pour une course GPS', () => {
    const out = buildRunRecords({ ...RUN, backfill: true })!;
    expect(out.sessions[0]!.metadata?.recordingMethod).toBe(RECORDING_METHOD_MANUAL_ENTRY);
  });

  it('renvoie null sans finished_at ou sur durée ≤ 0', () => {
    expect(buildRunRecords({ ...RUN, finishedAt: null })).toBeNull();
    expect(buildRunRecords({ ...RUN, finishedAt: RUN.startedAt })).toBeNull();
  });

  it('ignore une distance négative (donnée aberrante) sans perdre la session', () => {
    const out = buildRunRecords({ ...RUN, distanceM: -100 })!;
    expect(out.distances).toEqual([]);
    expect(out.sessions).toHaveLength(1);
  });
});

describe('localDateOfInstant', () => {
  it('gère la forme OBJET du zoneOffset — la seule que la bibliothèque produise réellement', () => {
    // `ZoneOffset = { id, totalSeconds }` (vérifié dans react-native-health-connect 3.5.3).
    // Ne pas la traiter daterait tout en UTC, soit l'inverse de la règle §2.5.
    expect(
      localDateOfInstant('2026-07-20T23:30:00.000Z', { id: '+02:00', totalSeconds: 7200 }),
    ).toBe('2026-07-21');
    expect(
      localDateOfInstant('2026-07-21T02:30:00.000Z', { id: '-05:00', totalSeconds: -18000 }),
    ).toBe('2026-07-20');
  });

  it('dérive la date du fuseau DU RECORD, pas de celui de l’appareil', () => {
    // 23h30 UTC le 20/07, mais +02:00 → on est déjà le 21/07 localement.
    expect(localDateOfInstant('2026-07-20T23:30:00.000Z', '+02:00')).toBe('2026-07-21');
    // Même instant vu depuis -05:00 → encore le 20/07.
    expect(localDateOfInstant('2026-07-20T23:30:00.000Z', '-05:00')).toBe('2026-07-20');
  });

  it('accepte aussi un décalage en secondes (forme défensive)', () => {
    expect(localDateOfInstant('2026-07-20T23:30:00.000Z', 7200)).toBe('2026-07-21');
  });

  it('retombe sur le fuseau fourni quand le record n’a pas de décalage exploitable', () => {
    // `zoneOffset: null` est courant. Le repli est le fuseau de l'appareil (injecté ici pour
    // rester déterministe), surtout PAS UTC — le reste de l'app date les pesées en local.
    expect(localDateOfInstant('2026-07-20T23:30:00.000Z', null, 7200)).toBe('2026-07-21');
    expect(localDateOfInstant('2026-07-20T23:30:00.000Z', undefined, 7200)).toBe('2026-07-21');
    expect(localDateOfInstant('2026-07-20T23:30:00.000Z', { id: 'X' }, 7200)).toBe('2026-07-21');
    expect(localDateOfInstant('2026-07-20T23:30:00.000Z', 'pas-un-offset', 7200)).toBe('2026-07-21');
  });

  it('renvoie null sur un instant illisible', () => {
    expect(localDateOfInstant('n’importe quoi', '+02:00')).toBeNull();
  });
});

describe('selectWeightEntriesToImport', () => {
  const remote = [
    { time: '2026-07-20T07:00:00.000Z', weight: { inKilograms: 80.4 } },
    { time: '2026-07-21T07:00:00.000Z', weight: { inKilograms: 80.1 } },
  ];

  it('convertit en pesée par jour, en kilogrammes', () => {
    expect(selectWeightEntriesToImport(remote, [])).toEqual([
      { logDate: '2026-07-20', weightKg: 80.4 },
      { logDate: '2026-07-21', weightKg: 80.1 },
    ]);
  });

  it('garde la pesée la PLUS RÉCENTE quand il y en a plusieurs le même jour', () => {
    const sameDay = [
      { time: '2026-07-20T07:00:00.000Z', weight: { inKilograms: 80.9 } },
      { time: '2026-07-20T19:00:00.000Z', weight: { inKilograms: 80.2 } },
      { time: '2026-07-20T12:00:00.000Z', weight: { inKilograms: 80.5 } },
    ];
    expect(selectWeightEntriesToImport(sameDay, [])).toEqual([
      { logDate: '2026-07-20', weightKg: 80.2 },
    ]);
  });

  it('n’écrase JAMAIS un jour déjà saisi dans l’app (la saisie locale gagne)', () => {
    expect(selectWeightEntriesToImport(remote, ['2026-07-20'])).toEqual([
      { logDate: '2026-07-21', weightKg: 80.1 },
    ]);
    expect(selectWeightEntriesToImport(remote, ['2026-07-20', '2026-07-21'])).toEqual([]);
  });

  it('écarte les poids invraisemblables (≤ 0 ou > 500 kg)', () => {
    const absurdes = [
      { time: '2026-07-20T07:00:00.000Z', weight: { inKilograms: 0 } },
      { time: '2026-07-21T07:00:00.000Z', weight: { inKilograms: -5 } },
      { time: '2026-07-22T07:00:00.000Z', weight: { inKilograms: 501 } },
      { time: '2026-07-23T07:00:00.000Z', weight: { inKilograms: 79.5 } },
    ];
    expect(selectWeightEntriesToImport(absurdes, [])).toEqual([
      { logDate: '2026-07-23', weightKg: 79.5 },
    ]);
  });

  it('écarte nos propres records (pas d’aller-retour), l’API n’offrant qu’un filtre inclusif', () => {
    const mixte = [
      {
        time: '2026-07-20T07:00:00.000Z',
        weight: { inKilograms: 80.4 },
        metadata: { dataOrigin: 'com.wellness.app' },
      },
      {
        time: '2026-07-21T07:00:00.000Z',
        weight: { inKilograms: 80.1 },
        metadata: { dataOrigin: 'com.withings.wiscale2' },
      },
    ];
    expect(selectWeightEntriesToImport(mixte, [], 'com.wellness.app')).toEqual([
      { logDate: '2026-07-21', weightKg: 80.1 },
    ]);
  });

  it('utilise le fuseau du record pour dater la pesée (forme objet de la bibliothèque)', () => {
    const tardif = [
      {
        time: '2026-07-20T23:30:00.000Z',
        zoneOffset: { id: '+02:00', totalSeconds: 7200 },
        weight: { inKilograms: 80.0 },
      },
    ];
    expect(selectWeightEntriesToImport(tardif, [])).toEqual([
      { logDate: '2026-07-21', weightKg: 80 },
    ]);
  });

  it('applique le fuseau de repli quand le record n’a pas de décalage', () => {
    const sansOffset = [
      { time: '2026-07-20T23:30:00.000Z', zoneOffset: null, weight: { inKilograms: 80 } },
    ];
    expect(selectWeightEntriesToImport(sansOffset, [], undefined, 7200)).toEqual([
      { logDate: '2026-07-21', weightKg: 80 },
    ]);
  });

  it('ignore un record sans poids exploitable au lieu de planter', () => {
    const bancal = [
      { time: '2026-07-20T07:00:00.000Z' },
      { time: '2026-07-21T07:00:00.000Z', weight: {} },
      { time: '2026-07-22T07:00:00.000Z', weight: { inKilograms: 80.1 } },
    ];
    expect(selectWeightEntriesToImport(bancal, [])).toEqual([
      { logDate: '2026-07-22', weightKg: 80.1 },
    ]);
  });

  it('ignore les records illisibles au lieu de tout faire échouer', () => {
    const bancal = [
      { time: 'pas-une-date', weight: { inKilograms: 80 } },
      { time: '2026-07-21T07:00:00.000Z', weight: { inKilograms: 80.1 } },
    ];
    expect(selectWeightEntriesToImport(bancal, [])).toEqual([
      { logDate: '2026-07-21', weightKg: 80.1 },
    ]);
  });

  it('renvoie une liste vide sur une entrée vide', () => {
    expect(selectWeightEntriesToImport([], [])).toEqual([]);
    expect(selectWeightEntriesToImport([], ['2026-07-20'])).toEqual([]);
  });

  it('rend les jours triés chronologiquement', () => {
    const desordre = [
      { time: '2026-07-22T07:00:00.000Z', weight: { inKilograms: 79 } },
      { time: '2026-07-20T07:00:00.000Z', weight: { inKilograms: 80 } },
    ];
    expect(selectWeightEntriesToImport(desordre, []).map((e) => e.logDate)).toEqual([
      '2026-07-20',
      '2026-07-22',
    ]);
  });
});

describe('shouldImportWeight', () => {
  const now = Date.parse('2026-07-26T12:00:00.000Z');

  it('autorise l’import quand rien n’a jamais été importé', () => {
    expect(shouldImportWeight(null, now, 6)).toBe(true);
  });

  it('bloque à l’intérieur de la fenêtre de throttle', () => {
    expect(shouldImportWeight('2026-07-26T09:00:00.000Z', now, 6)).toBe(false);
  });

  it('autorise au-delà de la fenêtre', () => {
    expect(shouldImportWeight('2026-07-26T05:00:00.000Z', now, 6)).toBe(true);
  });

  it('autorise pile à la limite', () => {
    expect(shouldImportWeight('2026-07-26T06:00:00.000Z', now, 6)).toBe(true);
  });

  it('autorise si l’horodatage stocké est illisible (curseur corrompu → on n’enferme pas)', () => {
    expect(shouldImportWeight('bidon', now, 6)).toBe(true);
  });

  it('autorise si l’horodatage stocké est dans le futur (horloge décalée)', () => {
    expect(shouldImportWeight('2026-07-27T12:00:00.000Z', now, 6)).toBe(true);
  });
});
