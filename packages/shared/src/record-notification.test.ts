import { describe, expect, it } from 'vitest';
import {
  buildRecordPushContent,
  RECORD_PUSH_MAX_NAMED,
  type BeatenRecordSummary,
} from './record-notification';

function record(
  exerciseId: string,
  exerciseName: string,
  formattedValue = '10 kg',
): BeatenRecordSummary {
  return { exerciseId, exerciseName, formattedValue };
}

describe('buildRecordPushContent', () => {
  it('renvoie null pour un tableau vide', () => {
    expect(buildRecordPushContent([])).toBeNull();
  });

  it('un seul exercice, un seul type battu → titleOne + bodyOne', () => {
    const content = buildRecordPushContent([record('e1', 'Développé couché', '82,5 kg')]);
    expect(content).toEqual({
      titleKey: 'notifications.record.titleOne',
      titleParams: {},
      bodyKey: 'notifications.record.bodyOne',
      bodyParams: { exercise: 'Développé couché', value: '82,5 kg' },
    });
  });

  it('3 types battus sur 1 SEUL exerciseId → titleOne (dédoublonnage par id, D10)', () => {
    // C'est le test qui échouerait sur une implémentation naïve comptant `records.length`.
    const content = buildRecordPushContent([
      record('e1', 'Développé couché'),
      record('e1', 'Développé couché'),
      record('e1', 'Développé couché'),
    ]);
    expect(content?.titleKey).toBe('notifications.record.titleOne');
  });

  it('2 exercices, 3 types chacun (6 lignes) → titleMany, count = 2, PAS 6', () => {
    // Le bug trouvé en revue : la spec parlait de « 15 records battus ! » avant d'être corrigée en
    // « records battus sur 5 exercices ». Ce test verrouille que le compte porte sur les exercices.
    const content = buildRecordPushContent([
      record('e1', 'Développé couché'),
      record('e1', 'Développé couché'),
      record('e1', 'Développé couché'),
      record('e2', 'Squat'),
      record('e2', 'Squat'),
      record('e2', 'Squat'),
    ]);
    expect(content).toMatchObject({
      titleKey: 'notifications.record.titleMany',
      titleParams: { count: 2 },
      bodyKey: 'notifications.record.bodyMany',
      bodyParams: { names: 'Développé couché, Squat' },
    });
  });

  it('2 exerciseId différents, même libellé → liste avec un seul nom, mais count = 2', () => {
    // Exercice custom dupliqué, ou archivé puis recréé.
    const content = buildRecordPushContent([record('e1', 'Squat'), record('e2', 'Squat')]);
    expect(content).toMatchObject({
      titleParams: { count: 2 },
      bodyParams: { names: 'Squat' },
    });
  });

  it('exerciseName vide → exclu de la liste, mais compté dans count', () => {
    const content = buildRecordPushContent([record('e1', 'Squat'), record('e2', '')]);
    expect(content).toMatchObject({
      titleParams: { count: 2 },
      bodyKey: 'notifications.record.bodyMany',
      bodyParams: { names: 'Squat' },
    });
  });

  it(`exactement ${RECORD_PUSH_MAX_NAMED} exercices → bodyMany, tous nommés`, () => {
    const content = buildRecordPushContent([
      record('e1', 'A'),
      record('e2', 'B'),
      record('e3', 'C'),
    ]);
    expect(content).toMatchObject({
      bodyKey: 'notifications.record.bodyMany',
      bodyParams: { names: 'A, B, C' },
    });
  });

  it('4 exercices → bodyManyOverflow, 3 nommés + rest = 1', () => {
    const content = buildRecordPushContent([
      record('e1', 'A'),
      record('e2', 'B'),
      record('e3', 'C'),
      record('e4', 'D'),
    ]);
    expect(content).toEqual({
      titleKey: 'notifications.record.titleMany',
      titleParams: { count: 4 },
      bodyKey: 'notifications.record.bodyManyOverflow',
      bodyParams: { names: 'A, B, C', rest: 1 },
    });
  });

  it('15 records sur 5 exercices (le cas de la spec) → count 5, 3 nommés, rest 2', () => {
    const beaten: BeatenRecordSummary[] = [];
    for (const id of ['e1', 'e2', 'e3', 'e4', 'e5']) {
      for (const t of ['charge', 'volume', 'reps']) beaten.push(record(id, `Exo ${id} ${t}`));
    }
    // Chaque exercice a un nom distinct par type ici — pour isoler le comptage par id de l'effet du
    // dédoublonnage par libellé, ce test utilise des libellés uniques par exerciseId au lieu de 3.
    const named: BeatenRecordSummary[] = ['e1', 'e2', 'e3', 'e4', 'e5'].flatMap((id) => [
      record(id, `Exo ${id}`),
      record(id, `Exo ${id}`),
      record(id, `Exo ${id}`),
    ]);
    const content = buildRecordPushContent(named);
    expect(content).toMatchObject({
      titleParams: { count: 5 },
      bodyKey: 'notifications.record.bodyManyOverflow',
      bodyParams: { names: 'Exo e1, Exo e2, Exo e3', rest: 2 },
    });
  });

  it("ne dépend pas de l'ordre d'entrée pour le décompte", () => {
    const a = buildRecordPushContent([record('e1', 'A'), record('e2', 'B'), record('e1', 'A')]);
    const b = buildRecordPushContent([record('e1', 'A'), record('e1', 'A'), record('e2', 'B')]);
    expect(a).toEqual(b);
  });

  it("ne mute pas le tableau reçu", () => {
    const records = [record('e1', 'A'), record('e2', 'B')];
    const copy = [...records];
    buildRecordPushContent(records);
    expect(records).toEqual(copy);
  });
});
