import { describe, expect, it } from 'vitest';

import {
  NEGLECTED_AFTER_WEEKS,
  findNeglectedExercises,
  type FavoriteExercise,
} from './neglected-exercises';

const TODAY = '2026-08-07';

function fav(over: Partial<FavoriteExercise> = {}): FavoriteExercise {
  return {
    exerciseId: 'ex-1',
    name: 'Rowing barre',
    favoritedOn: '2026-01-01',
    lastPracticedOn: '2026-08-06', // hier
    ...over,
  };
}

const find = (favorites: FavoriteExercise[], todayKey = TODAY) =>
  findNeglectedExercises({ favorites, todayKey });

describe('constantes', () => {
  it('expose le seuil, nommé et calibrable', () => {
    expect(NEGLECTED_AFTER_WEEKS).toBe(4);
  });
});

describe('findNeglectedExercises', () => {
  it('rend [] sans aucun favori — l’analyse se tait (R8)', () => {
    expect(find([])).toEqual([]);
  });

  it('ne signale pas un favori pratiqué hier', () => {
    expect(find([fav()])).toEqual([]);
  });

  it('signale un favori pratiqué il y a 6 semaines', () => {
    const out = find([fav({ lastPracticedOn: '2026-06-26' })]);
    expect(out).toHaveLength(1);
    expect(out[0]!.weeksSince).toBe(6);
    expect(out[0]!.neverPracticed).toBe(false);
  });

  it('ne signale pas juste sous le seuil', () => {
    // 27 jours = 3 semaines et 6 jours.
    expect(find([fav({ lastPracticedOn: '2026-07-11' })])).toEqual([]);
  });

  it('signale au seuil pile — 28 jours, borne inclusive', () => {
    const out = find([fav({ lastPracticedOn: '2026-07-10' })]);
    expect(out).toHaveLength(1);
    expect(out[0]!.weeksSince).toBe(4);
  });

  it('🔴 ne signale PAS un favori récent jamais pratiqué', () => {
    // On ne reproche pas de ne pas avoir encore fait ce qu'on vient d'ajouter.
    expect(find([fav({ favoritedOn: '2026-08-05', lastPracticedOn: null })])).toEqual([]);
  });

  it('signale un favori ancien jamais pratiqué, compté depuis son ajout', () => {
    const out = find([fav({ favoritedOn: '2026-05-08', lastPracticedOn: null })]);
    expect(out).toHaveLength(1);
    expect(out[0]!.neverPracticed).toBe(true);
    expect(out[0]!.weeksSince).toBe(13);
  });

  it('ignore une date de pratique dans le futur — horloge décalée ou saisie rétroactive', () => {
    expect(find([fav({ lastPracticedOn: '2026-09-01' })])).toEqual([]);
  });

  it('trie du plus délaissé au moins délaissé', () => {
    const out = find([
      fav({ exerciseId: 'a', name: 'Face pull', lastPracticedOn: '2026-07-03' }),
      fav({ exerciseId: 'b', name: 'Développé incliné', lastPracticedOn: '2026-06-01' }),
      fav({ exerciseId: 'c', name: 'Curl', lastPracticedOn: '2026-07-01' }),
    ]);
    expect(out.map((e) => e.exerciseId)).toEqual(['b', 'c', 'a']);
  });

  it('départage deux ex æquo par ordre alphabétique — sortie déterministe', () => {
    const out = find([
      fav({ exerciseId: 'z', name: 'Zercher squat', lastPracticedOn: '2026-06-01' }),
      fav({ exerciseId: 'a', name: 'Arnold press', lastPracticedOn: '2026-06-01' }),
    ]);
    expect(out.map((e) => e.name)).toEqual(['Arnold press', 'Zercher squat']);
  });

  it('porte le nom résolu par l’appelant — ce module ne connaît pas la langue', () => {
    expect(find([fav({ name: 'Barbell row', lastPracticedOn: '2026-06-01' })])[0]!.name).toBe(
      'Barbell row',
    );
  });

  it('ne rend que les délaissés, pas les autres', () => {
    const out = find([
      fav({ exerciseId: 'recent' }),
      fav({ exerciseId: 'vieux', lastPracticedOn: '2026-06-01' }),
    ]);
    expect(out.map((e) => e.exerciseId)).toEqual(['vieux']);
  });
});
