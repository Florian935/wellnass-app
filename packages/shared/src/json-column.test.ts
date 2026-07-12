import { describe, expect, it } from 'vitest';
import { parseJsonColumn } from './json-column';

describe('parseJsonColumn', () => {
  it('parse un objet déjà décodé', () => {
    expect(parseJsonColumn({ a: 1 }, null)).toEqual({ a: 1 });
  });

  it('parse un simple encodage (données serveur)', () => {
    expect(parseJsonColumn('{"a":1}', null)).toEqual({ a: 1 });
  });

  it('parse un double encodage (écriture client PowerSync)', () => {
    expect(parseJsonColumn(JSON.stringify('{"a":1}'), null)).toEqual({ a: 1 });
  });

  it('gère les tableaux (portions)', () => {
    expect(parseJsonColumn(JSON.stringify(JSON.stringify([1, 2])), [])).toEqual([1, 2]);
  });

  it('renvoie le fallback sur JSON invalide', () => {
    expect(parseJsonColumn('{oops', [])).toEqual([]);
  });

  it('renvoie le fallback sur null/undefined', () => {
    expect(parseJsonColumn(null, [])).toEqual([]);
    expect(parseJsonColumn(undefined, [])).toEqual([]);
    expect(parseJsonColumn('null', [])).toEqual([]);
  });
});
