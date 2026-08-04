import { describe, expect, it } from 'vitest';
import { parseFoodCsv } from './food-csv';

const base = {
  import_key: 'CIQUAL_1',
  name_fr: 'Pomme',
  name_en: 'Apple',
  category: 'fruits',
  kcal_per_100g: '52',
};

describe('parseFoodCsv', () => {
  it('mappe une ligne valide (macros + micros optionnels)', () => {
    const r = parseFoodCsv([
      { ...base, protein_per_100g: '0.3', sodium_mg: '1', vitamin_c_mg: '4.6' },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0]!).toMatchObject({
      importKey: 'CIQUAL_1',
      nameFr: 'Pomme',
      nameEn: 'Apple',
      category: 'fruits',
      kcalPer100g: 52,
      proteinPer100g: 0.3,
      micronutrients: { sodium_mg: 1, vitamin_c_mg: 4.6 },
    });
  });

  it('cellule optionnelle vide → null / micro absent', () => {
    const r = parseFoodCsv([{ ...base, protein_per_100g: '', sodium_mg: '' }]);
    expect(r.valid[0]!.proteinPer100g).toBeNull();
    expect(r.valid[0]!.micronutrients).toEqual({});
  });

  it('catégorie inconnue → erreur', () => {
    const r = parseFoodCsv([{ ...base, category: 'zzz' }]);
    expect(r.valid).toHaveLength(0);
    expect(r.errors[0]!).toMatchObject({ rowIndex: 1, field: 'category' });
  });

  it('kcal manquant / négatif → erreur', () => {
    expect(parseFoodCsv([{ ...base, kcal_per_100g: '' }]).errors[0]!.field).toBe('kcal_per_100g');
    expect(parseFoodCsv([{ ...base, kcal_per_100g: '-1' }]).errors[0]!.field).toBe('kcal_per_100g');
  });

  it('nombre invalide → erreur (champ concerné)', () => {
    const r = parseFoodCsv([{ ...base, protein_per_100g: 'abc' }]);
    expect(r.valid).toHaveLength(0);
    expect(r.errors[0]!.field).toBe('protein_per_100g');
  });

  it('name_en manquant → erreur (bilingue obligatoire)', () => {
    expect(parseFoodCsv([{ ...base, name_en: '' }]).errors[0]!.field).toBe('name_en');
  });

  it('import_key dupliqué dans le fichier → erreur sur les 2 lignes', () => {
    const r = parseFoodCsv([base, { ...base, name_fr: 'Pomme 2' }]);
    expect(r.valid).toHaveLength(0);
    expect(r.errors.filter((e) => e.field === 'import_key')).toHaveLength(2);
  });

  it('sépare valides et invalides sur plusieurs lignes', () => {
    const r = parseFoodCsv([
      base,
      { ...base, import_key: 'CIQUAL_2', name_fr: 'Banane', name_en: 'Banana', category: 'bad' },
    ]);
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0]!.importKey).toBe('CIQUAL_1');
    expect(r.errors[0]!).toMatchObject({ rowIndex: 2, field: 'category' });
  });

  // ── Colonnes ABSENTES du fichier (et non simplement vides) ────────────────────────
  //
  // Distinction qui compte à l'import : une cellule vide, c'est `''` ; une colonne absente de
  // l'en-tête, c'est `undefined`. Les tests ci-dessus ne couvraient que le premier cas. Or un
  // fichier fourni par un client dont l'en-tête ne contient pas `name_en` est le scénario le plus
  // probable d'un import raté — et sans repli, `.trim()` sur `undefined` lèverait une exception,
  // faisant échouer tout l'import au lieu de rapporter la ligne fautive.
  describe('colonne absente de l’en-tête', () => {
    it('rapporte les champs requis manquants sans lever d’exception', () => {
      // Objet volontairement nu : aucune des colonnes attendues.
      const r = parseFoodCsv([{}]);
      expect(r.valid).toHaveLength(0);
      expect(r.errors.map((e) => e.field).sort()).toEqual([
        'category',
        'import_key',
        'kcal_per_100g',
        'name_en',
        'name_fr',
      ]);
      expect(r.errors.every((e) => e.rowIndex === 1)).toBe(true);
    });

    it('accepte un fichier sans aucune colonne optionnelle', () => {
      // `base` ne porte que les colonnes requises : macros et micros absentes, pas vides.
      const r = parseFoodCsv([base]);
      expect(r.errors).toEqual([]);
      expect(r.valid[0]!).toMatchObject({
        proteinPer100g: null,
        micronutrients: {},
      });
    });

    it('ne compte pas une colonne import_key absente comme un doublon', () => {
      // Deux lignes sans `import_key` : deux erreurs « requis », et surtout PAS « dupliqué »
      // (le comptage des doublons doit ignorer les clés vides, sinon toute ligne incomplète
      // serait signalée deux fois pour deux raisons contradictoires).
      const r = parseFoodCsv([{}, {}]);
      const keyErrors = r.errors.filter((e) => e.field === 'import_key');
      expect(keyErrors).toHaveLength(2);
      expect(keyErrors.every((e) => e.reason === 'requis')).toBe(true);
    });

    it('rapporte un MICRONUTRIENT invalide, comme une macro invalide', () => {
      // Les tests existants ne validaient que les macros : un micro non numérique passait sans
      // qu'aucun test ne le vérifie, alors que c'est la même colonne libre dans un CSV client.
      const r = parseFoodCsv([{ ...base, sodium_mg: 'beaucoup', vitamin_c_mg: '-3' }]);
      expect(r.valid).toHaveLength(0);
      expect(r.errors.map((e) => [e.field, e.reason])).toEqual([
        ['sodium_mg', 'nombre ≥ 0 attendu'],
        ['vitamin_c_mg', 'nombre ≥ 0 attendu'],
      ]);
    });

    it('traite une valeur explicitement undefined comme absente', () => {
      const r = parseFoodCsv([
        { ...base, name_en: undefined as unknown as string, protein_per_100g: undefined as unknown as string },
      ]);
      expect(r.errors.map((e) => e.field)).toEqual(['name_en']);
    });
  });
});
