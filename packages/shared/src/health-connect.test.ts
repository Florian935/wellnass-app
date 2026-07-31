import { describe, expect, it } from 'vitest';
import {
  EXERCISE_TYPE_RUNNING,
  EXERCISE_TYPE_STRENGTH_TRAINING,
  MENSTRUATION_FLOW_HEAVY,
  MENSTRUATION_FLOW_LIGHT,
  MENSTRUATION_FLOW_MEDIUM,
  RECORDING_METHOD_ACTIVELY_RECORDED,
  RECORDING_METHOD_MANUAL_ENTRY,
  buildMenstruationFlowRecord,
  buildMenstruationPeriodRecord,
  buildRunRecords,
  buildWorkoutSessionRecord,
  flowFromHealthConnect,
  flowToHealthConnect,
  localDateOfInstant,
  selectFlowLogsToImport,
  selectPeriodsToImport,
  selectWeightEntriesToImport,
  shouldImportWeight,
  toIsoInstant,
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

describe('toIsoInstant', () => {
  // Régression device (28/07/2026) : Health Connect rejetait CHAQUE écriture avec
  // « Text '2026-07-24 12:39:10.931Z' could not be parsed at index 10 » — l'index 10 est l'espace.
  // La base locale (PowerSync ← Postgres) stocke ce format ; `Instant.parse` (Java) exige le « T ».
  it('convertit le format de la base locale (espace) en ISO strict', () => {
    expect(toIsoInstant('2026-07-24 12:39:10.931Z')).toBe('2026-07-24T12:39:10.931Z');
  });

  it('laisse passer un ISO déjà strict', () => {
    expect(toIsoInstant('2026-07-24T12:39:10.931Z')).toBe('2026-07-24T12:39:10.931Z');
  });

  it('complète un horodatage sans marqueur de fuseau en UTC (convention du projet)', () => {
    // Sans le « Z », JS interpréterait la valeur en heure locale → décalage selon l'appareil.
    expect(toIsoInstant('2026-07-24 12:39:10')).toBe('2026-07-24T12:39:10.000Z');
  });

  it('accepte un décalage explicite et le ramène en UTC', () => {
    expect(toIsoInstant('2026-07-24T14:39:10+02:00')).toBe('2026-07-24T12:39:10.000Z');
  });

  it('renvoie null sur une valeur vide ou illisible', () => {
    expect(toIsoInstant(null)).toBeNull();
    expect(toIsoInstant(undefined)).toBeNull();
    expect(toIsoInstant('')).toBeNull();
    expect(toIsoInstant('pas une date')).toBeNull();
  });
});

describe('buildWorkoutSessionRecord', () => {
  // Le cas qui a fait échouer la recette : les horodatages du record doivent TOUJOURS sortir en
  // ISO strict, quel que soit le format d'entrée.
  it('normalise les horodatages de la base locale dans le record', () => {
    const record = buildWorkoutSessionRecord({
      ...WORKOUT,
      startedAt: '2026-07-24 12:39:10.931Z',
      finishedAt: '2026-07-24 13:39:10.931Z',
      updatedAt: '2026-07-24 13:39:15.000Z',
    });
    expect(record).not.toBeNull();
    expect(record!.startTime).toBe('2026-07-24T12:39:10.931Z');
    expect(record!.endTime).toBe('2026-07-24T13:39:10.931Z');
    // La version dérive aussi d'un horodatage de la base : elle doit rester un nombre valide.
    expect(record!.metadata?.clientRecordVersion).toBe(Date.parse('2026-07-24T13:39:15.000Z'));
  });

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
  it('normalise les horodatages de la base locale dans les deux types de record', () => {
    const out = buildRunRecords({
      ...RUN,
      startedAt: '2026-07-21 06:00:00.000Z',
      finishedAt: '2026-07-21 06:30:00.000Z',
    });
    expect(out!.sessions[0]!.startTime).toBe('2026-07-21T06:00:00.000Z');
    expect(out!.sessions[0]!.endTime).toBe('2026-07-21T06:30:00.000Z');
    expect(out!.distances[0]!.startTime).toBe('2026-07-21T06:00:00.000Z');
    expect(out!.distances[0]!.endTime).toBe('2026-07-21T06:30:00.000Z');
  });

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

describe('flowToHealthConnect / flowFromHealthConnect', () => {
  it('mappe nos 4 niveaux sur les 3 niveaux Health Connect', () => {
    expect(flowToHealthConnect('spotting')).toBe(MENSTRUATION_FLOW_LIGHT);
    expect(flowToHealthConnect('light')).toBe(MENSTRUATION_FLOW_LIGHT);
    expect(flowToHealthConnect('medium')).toBe(MENSTRUATION_FLOW_MEDIUM);
    expect(flowToHealthConnect('heavy')).toBe(MENSTRUATION_FLOW_HEAVY);
  });

  it('reconstruit le flux depuis Health Connect', () => {
    expect(flowFromHealthConnect(MENSTRUATION_FLOW_LIGHT)).toBe('light');
    expect(flowFromHealthConnect(MENSTRUATION_FLOW_MEDIUM)).toBe('medium');
    expect(flowFromHealthConnect(MENSTRUATION_FLOW_HEAVY)).toBe('heavy');
  });

  it('ne reconstruit jamais « spotting » — inexistant côté Health Connect', () => {
    expect(flowFromHealthConnect(MENSTRUATION_FLOW_LIGHT)).not.toBe('spotting');
  });

  it('ignore UNKNOWN (0) et toute valeur hors échelle', () => {
    expect(flowFromHealthConnect(0)).toBeNull();
    expect(flowFromHealthConnect(99)).toBeNull();
    expect(flowFromHealthConnect(undefined)).toBeNull();
  });
});

describe('buildMenstruationPeriodRecord', () => {
  const PERIOD = {
    startedOn: '2026-07-10',
    endedOn: '2026-07-14',
    updatedAt: '2026-07-14T20:00:00.000Z',
    offsetSeconds: 0,
  };

  it('construit un intervalle minuit(début) → minuit(lendemain de fin), en UTC (offset 0)', () => {
    const record = buildMenstruationPeriodRecord(PERIOD);
    expect(record).not.toBeNull();
    expect(record!.recordType).toBe('MenstruationPeriod');
    expect(record!.startTime).toBe('2026-07-10T00:00:00.000Z');
    // Borne de fin EXCLUSIVE : minuit du lendemain du dernier jour de règles (15/07, pas 14/07).
    expect(record!.endTime).toBe('2026-07-15T00:00:00.000Z');
  });

  it('décale les deux bornes du fuseau donné', () => {
    // UTC+2 : minuit local = 22h00 UTC la veille.
    const record = buildMenstruationPeriodRecord({ ...PERIOD, offsetSeconds: 7200 });
    expect(record!.startTime).toBe('2026-07-09T22:00:00.000Z');
    expect(record!.endTime).toBe('2026-07-14T22:00:00.000Z');
  });

  it('reste constructible pour une période d’un seul jour (endTime > startTime malgré tout)', () => {
    const record = buildMenstruationPeriodRecord({ ...PERIOD, startedOn: '2026-07-10', endedOn: '2026-07-10' });
    expect(record).not.toBeNull();
    expect(Date.parse(record!.endTime)).toBeGreaterThan(Date.parse(record!.startTime));
  });

  it('marque toujours MANUAL_ENTRY (une date de règles est choisie, jamais captée)', () => {
    expect(buildMenstruationPeriodRecord(PERIOD)!.metadata?.recordingMethod).toBe(
      RECORDING_METHOD_MANUAL_ENTRY,
    );
  });

  it('préfixe le clientRecordId par started_on', () => {
    expect(buildMenstruationPeriodRecord(PERIOD)!.metadata?.clientRecordId).toBe(
      'period-2026-07-10',
    );
  });

  it('renvoie null sur une date illisible', () => {
    expect(buildMenstruationPeriodRecord({ ...PERIOD, startedOn: 'bidon' })).toBeNull();
  });
});

describe('buildMenstruationFlowRecord', () => {
  const LOG = {
    logDate: '2026-07-11',
    flow: 'medium' as const,
    updatedAt: '2026-07-11T20:00:00.000Z',
    offsetSeconds: 0,
  };

  it('construit un marqueur à midi local (heure neutre, le flux n’a pas d’heure)', () => {
    const record = buildMenstruationFlowRecord(LOG);
    expect(record).not.toBeNull();
    expect(record!.recordType).toBe('MenstruationFlow');
    expect(record!.time).toBe('2026-07-11T12:00:00.000Z');
    expect(record!.flow).toBe(MENSTRUATION_FLOW_MEDIUM);
  });

  it('traduit chaque niveau de flux vers l’échelle Health Connect', () => {
    expect(buildMenstruationFlowRecord({ ...LOG, flow: 'spotting' })!.flow).toBe(
      MENSTRUATION_FLOW_LIGHT,
    );
    expect(buildMenstruationFlowRecord({ ...LOG, flow: 'heavy' })!.flow).toBe(
      MENSTRUATION_FLOW_HEAVY,
    );
  });

  it('renvoie null sur une date illisible', () => {
    expect(buildMenstruationFlowRecord({ ...LOG, logDate: 'bidon' })).toBeNull();
  });
});

describe('selectPeriodsToImport', () => {
  it('convertit un intervalle Health Connect en période locale (fin exclusive → dernier jour inclus)', () => {
    const remote = [{ startTime: '2026-07-10T00:00:00.000Z', endTime: '2026-07-15T00:00:00.000Z' }];
    expect(selectPeriodsToImport(remote, undefined, 0)).toEqual([
      { startedOn: '2026-07-10', endedOn: '2026-07-14' },
    ]);
  });

  it('écarte nos propres records (pas d’aller-retour)', () => {
    const remote = [
      {
        startTime: '2026-07-10T00:00:00.000Z',
        endTime: '2026-07-15T00:00:00.000Z',
        metadata: { dataOrigin: 'com.wellness.app' },
      },
      {
        startTime: '2026-08-10T00:00:00.000Z',
        endTime: '2026-08-14T00:00:00.000Z',
        metadata: { dataOrigin: 'com.other.app' },
      },
    ];
    expect(selectPeriodsToImport(remote, 'com.wellness.app', 0)).toEqual([
      { startedOn: '2026-08-10', endedOn: '2026-08-13' },
    ]);
  });

  it('utilise le fuseau propre à chaque borne (start/end peuvent différer)', () => {
    const remote = [
      {
        startTime: '2026-07-09T22:00:00.000Z',
        endTime: '2026-07-14T22:00:00.000Z',
        startZoneOffset: { totalSeconds: 7200 },
        endZoneOffset: { totalSeconds: 7200 },
      },
    ];
    expect(selectPeriodsToImport(remote)).toEqual([{ startedOn: '2026-07-10', endedOn: '2026-07-14' }]);
  });

  it('ignore un record illisible sans faire échouer les autres', () => {
    const remote = [
      { startTime: 'bidon', endTime: '2026-07-15T00:00:00.000Z' },
      { startTime: '2026-08-10T00:00:00.000Z', endTime: '2026-08-14T00:00:00.000Z' },
    ];
    expect(selectPeriodsToImport(remote, undefined, 0)).toEqual([
      { startedOn: '2026-08-10', endedOn: '2026-08-13' },
    ]);
  });
});

describe('selectFlowLogsToImport', () => {
  it('convertit un marqueur Health Connect en journal local', () => {
    const remote = [{ time: '2026-07-11T12:00:00.000Z', flow: MENSTRUATION_FLOW_HEAVY }];
    expect(selectFlowLogsToImport(remote, undefined, 0)).toEqual([
      { logDate: '2026-07-11', flow: 'heavy' },
    ]);
  });

  it('ignore un flux UNKNOWN ou absent', () => {
    const remote = [
      { time: '2026-07-11T12:00:00.000Z', flow: 0 },
      { time: '2026-07-12T12:00:00.000Z' },
    ];
    expect(selectFlowLogsToImport(remote, undefined, 0)).toEqual([]);
  });

  it('écarte nos propres records', () => {
    const remote = [
      {
        time: '2026-07-11T12:00:00.000Z',
        flow: MENSTRUATION_FLOW_LIGHT,
        metadata: { dataOrigin: 'com.wellness.app' },
      },
    ];
    expect(selectFlowLogsToImport(remote, 'com.wellness.app', 0)).toEqual([]);
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
