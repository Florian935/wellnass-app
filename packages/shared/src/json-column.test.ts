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

  // Régression crash onboarding (fix/onboarding-rejeu-profil) :
  // `active_pillars` triple-encodé → sans garde-fou, parseJsonColumn rendait une
  // *chaîne* typée `Pillar[]` → `activePillars.map` plantait le rendu du summary.
  it('récupère un tableau triple-encodé (client PowerSync)', () => {
    const triple = JSON.stringify(JSON.stringify(JSON.stringify([1, 2])));
    expect(parseJsonColumn(triple, [])).toEqual([1, 2]);
  });

  describe('validateur de type optionnel', () => {
    const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

    it('renvoie le fallback si la valeur décodée ne satisfait pas le validateur', () => {
      // Décodé en objet, mais on attend un tableau → fallback plutôt qu'un type erroné.
      expect(parseJsonColumn(JSON.stringify({ a: 1 }), [], isArray)).toEqual([]);
    });

    it('renvoie le fallback si le déballage laisse une chaîne (encodage trop profond)', () => {
      const quadruple = JSON.stringify(JSON.stringify(JSON.stringify(JSON.stringify([1, 2]))));
      expect(parseJsonColumn(quadruple, ['fallback'], isArray)).toEqual(['fallback']);
    });

    it('renvoie la valeur quand le validateur passe', () => {
      expect(parseJsonColumn(JSON.stringify([1, 2]), [], isArray)).toEqual([1, 2]);
    });
  });
});
