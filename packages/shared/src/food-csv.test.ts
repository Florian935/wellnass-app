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
});
